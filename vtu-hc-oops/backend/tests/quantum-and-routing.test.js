import assert from "node:assert/strict";
import test from "node:test";
import { runQuantumComparison } from "../src/services/quantumClient.js";
import { getRoute, geocode } from "../src/services/routingService.js";
import { createOptimizationHandlers } from "../src/controllers/optimizationController.js";

const offline = async () => { throw new Error("network down"); };

test("routing falls back to built-in city coordinates when the network is down", async () => {
  delete process.env.ORS_API_KEY;
  const place = await geocode("Pune", { fetchImpl: offline });
  assert.equal(place.source, "built-in");
  const route = await getRoute("Kolhapur", "Satara", { fetchImpl: offline });
  assert.match(route.provider, /estimate/);
  // Straight line Kolhapur–Satara is ~110 km; x1.3 road factor.
  assert.ok(route.distanceKm > 120 && route.distanceKm < 160, `got ${route.distanceKm}`);
  assert.equal(route.estimates.co2Kg, Math.round((route.distanceKm / 4) * 2.68));
});

test("routing reports an unknown place instead of inventing coordinates", async () => {
  await assert.rejects(getRoute("Nowhereville Xyz", "Pune", { fetchImpl: offline }), /Could not find/);
});

test("routing reads OSRM geometry as [lat, lng]", async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => (url.includes("nominatim")
      ? [{ display_name: "X", lat: url.includes("Thane") ? "19.2" : "18.5", lon: "73.0" }]
      : { routes: [{ distance: 150000, duration: 9000, geometry: { coordinates: [[73.0, 18.5], [73.0, 19.2]] } }] }),
  });
  const route = await getRoute("Panvel", "Thane", { fetchImpl });
  assert.equal(route.distanceKm, 150);
  assert.equal(route.durationMin, 150);
  assert.deepEqual(route.geometry[0], [18.5, 73.0]);
  assert.match(route.provider, /OSRM/);
});

test("quantum client reports a stopped service instead of failing the request", async () => {
  const r = await runQuantumComparison([{ loadId: "l", truckId: "t", cost: 1 }], { fetchImpl: offline });
  assert.equal(r.status, "unavailable");
  assert.equal((await runQuantumComparison([])).status, "skipped");
});

test("quantum comparison sends the classical candidates and flags agreement", async () => {
  const query = (value) => ({ sort() { return this; }, select() { return this; }, populate() { return this; }, lean() { return Promise.resolve(value); } });
  const load = { _id: "load-1", pickup: "Pune", destination: "Nashik", weightTonnes: 6, truckType: "Open truck", pickupDate: "2026-11-01", offeredPrice: 150 };
  const truck = { _id: "truck-1", truckType: "Open truck", capacityTonnes: 8, isAvailable: true, quotedPrice: 100,
    routeLegs: [{ _id: "leg-1", status: "Available", origin: "Pune", destination: "Nashik" }] };
  let sent;
  const handlers = createOptimizationHandlers({
    LoadModel: { find: () => query([load]) },
    TruckModel: { find: () => query([truck]) },
    BookingModel: { find: () => query([]) },
    runQuantum: async (candidates, opts) => {
      sent = { candidates, opts };
      return { status: "ok", problem: { reduced: false }, quantum: { assignedCount: 1, totalCost: 100 } };
    },
  });
  let body;
  await handlers.getQuantumComparison(
    { user: { _id: "f", role: "shipper" }, query: { mode: "noisy" } },
    { status() { return this; }, json(b) { body = b; } },
    (e) => { throw e; },
  );
  assert.deepEqual(sent.candidates.map((c) => [c.loadId, c.truckId, c.cost]), [["load-1", "truck-1", 100]]);
  assert.equal(sent.opts.mode, "noisy");
  assert.equal(body.classical.totalCost, 100);
  assert.deepEqual(body.agreement, { sameAssignedCount: true, sameTotalCost: true });
});
