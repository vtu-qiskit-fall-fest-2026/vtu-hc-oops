import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { optimizeAssignments } from "../src/services/assignmentOptimizer.js";
import { requestDelayPredictions } from "../src/services/delayPredictionService.js";
import { scoreTruckForLoad } from "../src/services/matchingEngine.js";
import { createOptimizationHandlers } from "../src/controllers/optimizationController.js";
import { createLoadRouter } from "../src/routes/loadRoutes.js";
import { createBookingPayload, resolveBookingSelection } from "../../frontend/src/services/bookingSelection.js";

const loadOne = {
  _id: "load-1",
  title: "Steel coils",
  material: "Steel",
  pickup: "Pune",
  destination: "Nashik",
  weightTonnes: 6,
  truckType: "Open truck",
  pickupDate: "2026-11-01T00:00:00.000Z",
  offeredPrice: 150,
};
const loadTwo = {
  ...loadOne,
  _id: "load-2",
  title: "Cement",
  material: "Cement",
  destination: "Aurangabad",
  weightTonnes: 9,
};
const truckOne = {
  _id: "truck-1",
  registrationNumber: "MH12AA1001",
  truckType: "Open truck",
  capacityTonnes: 8,
  isAvailable: true,
  quotedPrice: 100,
  routeLegs: [
    { _id: "leg-1", status: "Available", origin: "Pune", destination: "Nashik" },
  ],
};
const truckTwo = {
  _id: "truck-2",
  registrationNumber: "MH12AA1002",
  truckType: "Open truck",
  capacityTonnes: 15,
  isAvailable: true,
  quotedPrice: 120,
  routeLegs: [
    { _id: "leg-2a", status: "Available", origin: "Pune", destination: "Nashik" },
    { _id: "leg-2b", status: "Available", origin: "Pune", destination: "Aurangabad" },
  ],
};

test("optimizer assigns multiple loads to distinct compatible trucks at minimum cost", () => {
  const result = optimizeAssignments({ loads: [loadOne, loadTwo], trucks: [truckOne, truckTwo] });
  assert.equal(result.feasible, true);
  assert.equal(result.assignmentCount, 2);
  assert.equal(result.objective.value, 220);
  assert.deepEqual(new Set(result.assignments.map((assignment) => assignment.truckId)), new Set(["truck-1", "truck-2"]));
  assert.equal(result.assignments.find((assignment) => assignment.loadId === "load-2").truckId, "truck-2");
  assert.equal(result.optimal, true);
  assert.equal(result.objective.lateDeliveryPenaltyIncluded, false);
});

test("optimizer enforces capacity, availability, route, and existing-booking constraints", () => {
  const result = optimizeAssignments({
    loads: [loadTwo],
    trucks: [
      { ...truckOne, capacityTonnes: 20, quotedPrice: 10 },
      { ...truckTwo, isAvailable: false, quotedPrice: 20 },
      { ...truckTwo, _id: "truck-3", capacityTonnes: 20, quotedPrice: 30, routeLegs: [{ status: "Available", origin: "Pune", destination: "Mumbai" }] },
      truckTwo,
    ],
    activeAssignments: [{ truck: "truck-2", status: "Confirmed" }],
  });
  assert.equal(result.feasible, false);
  assert.equal(result.assignmentCount, 0);
  assert.ok(result.unassignedLoads[0].reason);
});

test("optimizer prefers complete feasible coverage before minimizing cost", () => {
  const result = optimizeAssignments({ loads: [loadOne, loadTwo], trucks: [truckTwo] });
  assert.equal(result.assignmentCount, 1);
  assert.equal(result.feasible, false);
  assert.equal(result.assignments[0].loadId, "load-1");
  assert.equal(result.unassignedLoads[0].loadId, "load-2");
});

test("optimizer is deterministic for identical inputs and keeps a feasible result on timeout", () => {
  const input = { loads: [loadOne, loadTwo], trucks: [truckOne, truckTwo] };
  const first = optimizeAssignments(input);
  const second = optimizeAssignments(input);
  assert.deepEqual(first.assignments, second.assignments);
  assert.equal(first.objective.value, second.objective.value);

  const timedOut = optimizeAssignments({ ...input, timeLimitMs: 0.000001 });
  assert.equal(timedOut.timedOut, true);
  assert.equal(timedOut.fallbackUsed, true);
  assert.ok(timedOut.assignmentCount > 0);
});

test("optimizer rejects repeated cargo identifiers instead of assigning one load twice", () => {
  assert.throws(
    () => optimizeAssignments({ loads: [loadOne, { ...loadTwo, _id: loadOne._id }], trucks: [truckOne, truckTwo] }),
    /unique identifier/i,
  );
});

test("matching rejects a route leg that is unavailable even when its service areas match", () => {
  const result = scoreTruckForLoad(loadOne, {
    ...truckOne,
    routeLegs: [
      { _id: "leg-1", status: "Booked", origin: "Pune", destination: "Nashik" },
    ],
    serviceAreas: ["Pune", "Nashik"],
  });
  assert.equal(result.isEligible, false);
  assert.ok(result.rejectionReasons.includes("No truck route leg is currently marked available."));
});

test("matching blocks overlapping truck assignments but permits known non-overlapping dates", () => {
  const overlapping = scoreTruckForLoad(loadOne, truckOne, {
    conflictingAssignments: [{ truck: "truck-1", load: { pickupDate: "2026-11-01T00:00:00.000Z", deliveryDate: "2026-11-02T00:00:00.000Z" } }],
  });
  const nonOverlapping = scoreTruckForLoad(loadOne, truckOne, {
    conflictingAssignments: [{ truck: "truck-1", load: { pickupDate: "2026-11-03T00:00:00.000Z", deliveryDate: "2026-11-05T00:00:00.000Z" } }],
  });
  const unknownWindow = scoreTruckForLoad(loadOne, truckOne, {
    conflictingAssignments: [{ truck: "truck-1" }],
  });
  assert.equal(overlapping.isEligible, false);
  assert.equal(nonOverlapping.isEligible, true);
  assert.equal(unknownWindow.isEligible, false);
});

test("live booking selection uses the chosen load, truck, route leg, and real quote", () => {
  const booking = resolveBookingSelection(
    [loadOne],
    [{ ...truckOne, routeLegId: "leg-1", quotedPrice: 100, transporter: { name: "Fleet One", phone: "123" } }],
    { loadId: "load-1", truckId: "truck-1", routeLegId: "leg-1" },
  );
  assert.equal(booking.source, "live-matching");
  assert.equal(booking.freightPrice, 100);
  assert.equal(booking.priceBasis, "transporter-quote");
  assert.deepEqual(createBookingPayload(booking, { acceptTerms: true }), {
    loadId: "load-1",
    truckId: "truck-1",
    routeLegId: "leg-1",
    acceptTerms: true,
  });
});

test("live booking selection rejects stale matches and missing prices", () => {
  assert.throws(
    () => resolveBookingSelection([loadOne], [], { loadId: "load-1", truckId: "truck-1" }),
    /match is no longer available/i,
  );
  assert.throws(
    () => resolveBookingSelection(
      [{ ...loadOne, offeredPrice: "" }],
      [{ ...truckOne, routeLegId: "leg-1", quotedPrice: "" }],
      { loadId: "load-1", truckId: "truck-1", routeLegId: "leg-1" },
    ),
    /valid transporter quote nor a factory offer/i,
  );
  assert.throws(
    () => createBookingPayload({ loadId: "load-1", truckId: "truck-1" }),
    /accept the shipment terms/i,
  );
});

test("prediction adapter reports an unconfigured model and skips missing features", async () => {
  const absent = await requestDelayPredictions([loadOne], { endpoint: "" });
  assert.equal(absent.available, false);
  assert.equal(absent.state, "not_configured");

  const missing = await requestDelayPredictions([{ ...loadOne, pickupDate: "invalid" }], {
    endpoint: "https://model.example.test/predict",
  });
  assert.equal(missing.available, false);
  assert.equal(missing.state, "missing_features");
  assert.equal(missing.unsupportedLoadCount, 1);
});

test("prediction adapter validates inputs and only returns fresh model predictions", async () => {
  let requestBody;
  const now = new Date("2026-10-21T00:00:00.000Z");
  const prediction = await requestDelayPredictions([loadOne], {
    endpoint: "https://model.example.test/predict",
    apiKey: "test-key",
    now,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          schemaVersion: "loadsetu.delay-prediction.response.v1",
          model: { name: "delay-model", version: "2.1.0" },
          generatedAt: now.toISOString(),
          predictions: [{ loadId: "load-1", eta: "2026-11-01T05:00:00.000Z", delayRiskProbability: 0.2 }],
        }),
      };
    },
  });
  assert.equal(requestBody.schemaVersion, "loadsetu.delay-prediction.request.v1");
  assert.equal(requestBody.requests[0].features.weightTonnes, 6);
  assert.equal(prediction.available, true);
  assert.equal(prediction.model.version, "2.1.0");
  assert.equal(prediction.predictions[0].delayRiskProbability, 0.2);
  assert.equal(prediction.predictions[0].predictedEta, "2026-11-01T05:00:00.000Z");
});

test("prediction adapter handles malformed, stale, and timed-out model responses", async () => {
  const now = new Date("2026-10-21T00:00:00.000Z");
  const basePayload = {
    schemaVersion: "loadsetu.delay-prediction.response.v1",
    model: { name: "delay-model", version: "1" },
    generatedAt: now.toISOString(),
    predictions: [{ loadId: "load-1", delayRiskProbability: 1.2 }],
  };
  const malformed = await requestDelayPredictions([loadOne], {
    endpoint: "https://model.example.test/predict",
    now,
    fetchImpl: async () => ({ ok: true, json: async () => basePayload }),
  });
  assert.equal(malformed.state, "invalid_response");

  const stale = await requestDelayPredictions([loadOne], {
    endpoint: "https://model.example.test/predict",
    now,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        ...basePayload,
        generatedAt: "2026-10-20T00:00:00.000Z",
        predictions: [{ loadId: "load-1", delayRiskProbability: 0.5 }],
      }),
    }),
  });
  assert.equal(stale.state, "stale");

  const timeout = await requestDelayPredictions([loadOne], {
    endpoint: "https://model.example.test/predict",
    fetchImpl: async () => {
      const error = new Error("timeout");
      error.name = "AbortError";
      throw error;
    },
  });
  assert.equal(timeout.state, "timeout");

  const serviceFailure = await requestDelayPredictions([loadOne], {
    endpoint: "https://model.example.test/predict",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(serviceFailure.state, "service_error");
});

test("loads API integrates optimization and AI handlers and enforces factory role", async (context) => {
  const query = (value) => ({
    sort() { return this; },
    select() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(value); },
  });
  const loadQueries = [];
  let truckQuery;
  let bookingQuery;
  const handlers = createOptimizationHandlers({
    LoadModel: { find: (filter) => { loadQueries.push(filter); return query([loadOne]); } },
    TruckModel: { find: (filter) => { truckQuery = filter; return query([truckOne]); } },
    BookingModel: { find: (filter) => { bookingQuery = filter; return query([]); } },
    predictDelays: async () => ({ available: false, state: "not_configured", message: "No trained model configured.", predictions: [] }),
  });
  const router = createLoadRouter({
    authMiddleware(req, _res, next) {
      req.user = { _id: "factory-1", role: req.headers["x-test-role"] || "shipper" };
      next();
    },
    optimizationHandlers: handlers,
  });
  const app = express();
  app.use("/api/loads", router);
  const server = app.listen(0, "127.0.0.1");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/loads`;

  const optimized = await fetch(`${baseUrl}/optimization`);
  const optimizationBody = await optimized.json();
  assert.equal(optimized.status, 200);
  assert.equal(optimizationBody.source, "live-database");
  assert.equal(optimizationBody.assignmentCount, 1);
  assert.equal(loadQueries[0].factory, "factory-1");
  assert.deepEqual(truckQuery, { isAvailable: true });
  assert.deepEqual(bookingQuery.status.$in, ["Pending", "Confirmed", "In Transit"]);

  const ai = await fetch(`${baseUrl}/ai-insights`);
  const aiBody = await ai.json();
  assert.equal(ai.status, 200);
  assert.equal(aiBody.available, false);
  assert.equal(aiBody.state, "not_configured");
  assert.equal(loadQueries[1].factory, "factory-1");

  const forbidden = await fetch(`${baseUrl}/optimization`, { headers: { "x-test-role": "transporter" } });
  assert.equal(forbidden.status, 403);
});
