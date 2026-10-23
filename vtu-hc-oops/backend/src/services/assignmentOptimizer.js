import { performance } from "node:perf_hooks";
import { evaluateTruckAgainstLoad, locationsMatch } from "./matchingEngine.js";

const MAX_LOADS = 12;
const DEFAULT_TIME_LIMIT_MS = 500;
const ACTIVE_BOOKING_STATUSES = new Set(["Pending", "Confirmed", "In Transit"]);

function getTruckId(truck) {
  return String(truck?._id || truck?.id || "");
}

function candidateLegs(truck) {
  if (Array.isArray(truck.routeLegs) && truck.routeLegs.length > 0) {
    return truck.routeLegs
      .filter((leg) => leg.status === "Available")
      .map((leg) => ({
        ...truck,
        routeLegId: String(leg._id || ""),
        routeLeg: leg,
        routeLegs: [leg],
        currentLocation: leg.origin,
        serviceAreas: [leg.origin, leg.destination],
      }));
  }
  return [truck];
}

function candidateCost(load, truck) {
  const quote = Number(truck.quotedPrice);
  if (truck.quotedPrice !== null && truck.quotedPrice !== undefined && Number.isFinite(quote) && quote >= 0) {
    return { amount: quote, basis: "transporter-quote" };
  }
  const offer = Number(load.offeredPrice);
  if (Number.isFinite(offer) && offer >= 0) {
    return { amount: offer, basis: "factory-offer-estimate" };
  }
  return null;
}

function routeCoversLoad(load, candidate) {
  const leg = candidate.routeLeg;
  if (leg) {
    return locationsMatch(load.pickup, leg.origin)
      && locationsMatch(load.destination, leg.destination);
  }
  const areas = Array.isArray(candidate.serviceAreas) ? candidate.serviceAreas : [];
  return areas.some((area) => locationsMatch(load.pickup, area))
    && areas.some((area) => locationsMatch(load.destination, area));
}

function buildLoadOptions(load, trucks, blockedTruckIds, activeAssignments) {
  const optionsByTruck = new Map();
  const rejections = new Set();

  for (const truck of trucks) {
    const truckId = getTruckId(truck);
    if (!truckId || blockedTruckIds.has(truckId) || truck.isAvailable !== true) continue;

    for (const candidate of candidateLegs(truck)) {
      if (!routeCoversLoad(load, candidate)) {
        rejections.add("No available truck route or service area covers both load endpoints.");
        continue;
      }
      const result = evaluateTruckAgainstLoad(load, candidate, { conflictingAssignments: activeAssignments });
      if (!result.eligible) {
        result.rejectionReasons.forEach((reason) => rejections.add(reason));
        continue;
      }
      const cost = candidateCost(load, truck);
      if (!cost) {
        rejections.add("No valid quote or factory-offer estimate is available.");
        continue;
      }
      const option = {
        loadId: String(load._id || load.id || ""),
        truckId,
        routeLegId: candidate.routeLegId || null,
        cost: cost.amount,
        costBasis: cost.basis,
        truck,
      };
      const previous = optionsByTruck.get(truckId);
      if (!previous || option.cost < previous.cost) optionsByTruck.set(truckId, option);
    }
  }

  return {
    options: [...optionsByTruck.values()].sort((a, b) => a.cost - b.cost || a.truckId.localeCompare(b.truckId)),
    rejectionReasons: [...rejections],
  };
}

export function optimizeAssignments({
  loads = [],
  trucks = [],
  activeAssignments = [],
  timeLimitMs = DEFAULT_TIME_LIMIT_MS,
} = {}) {
  const startedAt = performance.now();
  if (!Array.isArray(loads) || !Array.isArray(trucks) || !Array.isArray(activeAssignments)) {
    throw new TypeError("Loads, trucks, and active assignments must be arrays.");
  }
  const loadIds = loads.map((load) => String(load?._id || load?.id || ""));
  if (loadIds.some((id) => !id) || new Set(loadIds).size !== loadIds.length) {
    throw new TypeError("Every load must have a unique identifier.");
  }
  if (loads.length > MAX_LOADS) {
    throw new RangeError(`The exact baseline supports at most ${MAX_LOADS} open loads per run.`);
  }
  if (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
    throw new RangeError("The optimizer time limit must be a positive number.");
  }

  const blockedTruckIds = new Set(
    activeAssignments
      .filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status))
      .map((booking) => String(booking.truck?._id || booking.truck || ""))
      .filter(Boolean),
  );
  const rows = loads.map((load) => {
    const { options, rejectionReasons } = buildLoadOptions(load, trucks, blockedTruckIds, activeAssignments);
    return { load, options, rejectionReasons };
  }).sort((a, b) => a.options.length - b.options.length
    || new Date(a.load.pickupDate || 0) - new Date(b.load.pickupDate || 0)
    || String(a.load._id || a.load.id || "").localeCompare(String(b.load._id || b.load.id || "")));

  const greedyAssignments = [];
  const greedyTruckIds = new Set(blockedTruckIds);
  for (const row of rows) {
    const option = row.options.find((candidate) => !greedyTruckIds.has(candidate.truckId));
    if (!option) continue;
    greedyTruckIds.add(option.truckId);
    greedyAssignments.push({ ...option, load: row.load });
  }
  let bestAssignedCount = greedyAssignments.length;
  let bestCost = greedyAssignments.reduce((sum, assignment) => sum + assignment.cost, 0);
  let bestAssignments = greedyAssignments;
  let timedOut = false;
  const selected = [];
  const usedTruckIds = new Set(blockedTruckIds);

  function search(index, totalCost) {
    if (performance.now() - startedAt >= timeLimitMs) {
      timedOut = true;
      return;
    }
    if (selected.length + (rows.length - index) < bestAssignedCount) return;
    if (index === rows.length) {
      if (selected.length > bestAssignedCount || (selected.length === bestAssignedCount && totalCost < bestCost)) {
        bestAssignedCount = selected.length;
        bestCost = totalCost;
        bestAssignments = [...selected];
      }
      return;
    }

    const row = rows[index];
    for (const option of row.options) {
      if (usedTruckIds.has(option.truckId)) continue;
      usedTruckIds.add(option.truckId);
      selected.push({ ...option, load: row.load });
      search(index + 1, totalCost + option.cost);
      selected.pop();
      usedTruckIds.delete(option.truckId);
      if (timedOut) return;
    }
    search(index + 1, totalCost);
  }

  search(0, 0);
  const assignedLoadIds = new Set(bestAssignments.map((assignment) => assignment.loadId));
  const assignments = bestAssignments.map(({ load, truck, ...assignment }) => ({
    ...assignment,
    load: {
      id: assignment.loadId,
      title: load.title || load.material || "Load",
      pickup: load.pickup,
      destination: load.destination,
      weightTonnes: load.weightTonnes,
    },
    truck: {
      id: assignment.truckId,
      registrationNumber: truck.registrationNumber || "",
      truckType: truck.truckType || "",
      capacityTonnes: truck.capacityTonnes,
    },
  })).sort((a, b) => a.loadId.localeCompare(b.loadId));

  const unassignedLoads = rows
    .filter(({ load }) => !assignedLoadIds.has(String(load._id || load.id || "")))
    .map(({ load, options, rejectionReasons }) => ({
      loadId: String(load._id || load.id || ""),
      reason: options.length > 0
        ? "No unused compatible truck remains after assigning the other loads."
        : rejectionReasons[0] || "No eligible available truck or usable transport cost was found.",
      additionalReasons: rejectionReasons.slice(1, 4),
    }));
  const totalCost = assignments.reduce((sum, assignment) => sum + assignment.cost, 0);

  return {
    source: "live-database",
    optimizer: { name: "LOADSETU exact assignment baseline", version: "1.0.0" },
    feasible: unassignedLoads.length === 0,
    assignmentCount: assignments.length,
    requestedLoadCount: loads.length,
    assignments,
    unassignedLoads,
    objective: {
      name: "Maximize assigned loads, then minimize total transport cost",
      value: totalCost,
      currency: "INR",
      costBasis: [...new Set(assignments.map((assignment) => assignment.costBasis))],
      lateDeliveryPenaltyIncluded: false,
      limitation: "Delivery deadlines and late penalties are not scored because the current load schema and routing data do not provide a verified delivery ETA/deadline pair.",
    },
    // Every eligible (load, truck) pair with its cost: the same input the QAOA solver gets,
    // so the classical and quantum answers are for one identical problem.
    candidates: rows.flatMap(({ load, options }) => options.map(({ loadId, truckId, routeLegId, cost, costBasis, truck }) => ({
      loadId, truckId, routeLegId, cost, costBasis,
      loadTitle: load.title || load.material || "Load",
      route: `${load.pickup} → ${load.destination}`,
      truckRegistration: truck.registrationNumber || "",
    }))),
    runtimeMs: Number((performance.now() - startedAt).toFixed(3)),
    timedOut,
    optimal: !timedOut,
    fallbackUsed: timedOut,
    limitations: [
      "Trucks with active bookings are conservatively treated as unavailable because assignment time windows are not represented consistently in the data model.",
      "A missing transporter quote is represented using the factory offer as an estimate, not an actual cost.",
    ],
  };
}
