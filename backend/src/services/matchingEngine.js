const SCORE_WEIGHTS = Object.freeze({ route: 40, capacity: 20, vehicleType: 15, price: 20, availability: 5 });

const STOP_WORDS = new Set(["india", "state", "district", "city", "road", "street", "near", "the", "of", "and"]);

function normalizeLocation(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !STOP_WORDS.has(part));
}

export function locationsMatch(left, right) {
  const a = normalizeLocation(left);
  const b = normalizeLocation(right);
  if (!a.length || !b.length) return false;
  const aText = a.join(" ");
  const bText = b.join(" ");
  if (aText === bText) return true;
  const bTokens = new Set(b);
  const overlap = a.filter((token) => bTokens.has(token)).length;
  return overlap > 0 && overlap / Math.min(a.length, b.length) >= 0.5;
}

function clampScore(value, max) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

const idOf = (value) => String(value?._id || value?.id || value || "");
const time = (value) => {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};

/** [start, end] of a load's trip; end falls back to the pickup date when no delivery date is set. */
function loadWindow(load) {
  const start = time(load?.pickupDate);
  if (start === null) return null;
  const end = time(load?.deliveryDate);
  return [start, end !== null && end >= start ? end : start];
}

function legCovers(leg, load) {
  return locationsMatch(load.pickup, leg.origin) && locationsMatch(load.destination, leg.destination);
}

/**
 * Hard constraints: a truck that fails any of these is never offered for the load,
 * however well it scores. Returns every reason, not just the first, for the UI.
 */
export function evaluateTruckAgainstLoad(load, truck, { conflictingAssignments = [] } = {}) {
  const reasons = [];

  if (truck?.isAvailable !== true) reasons.push("Truck is unavailable.");

  const weight = Number(load?.weightTonnes);
  const capacity = Number(truck?.capacityTonnes);
  if (!(Number.isFinite(weight) && weight > 0)) reasons.push("Load weight is missing, so capacity cannot be checked.");
  else if (!(Number.isFinite(capacity) && capacity >= weight)) reasons.push("Load weight exceeds truck capacity.");

  const required = String(load?.truckType || "").trim().toLowerCase();
  const actual = String(truck?.truckType || "").trim().toLowerCase();
  if (required && required !== "any suitable truck" && actual !== required && actual !== "any suitable truck") {
    reasons.push("Truck type does not match the requested type.");
  }

  const loadDims = load?.dimensions || {};
  const truckDims = truck?.dimensions || {};
  for (const dim of ["length", "width", "height"]) {
    const need = Number(loadDims[dim]);
    const have = Number(truckDims[dim]);
    if (Number.isFinite(need) && need > 0 && Number.isFinite(have) && have > 0 && need > have) {
      reasons.push(`Load ${dim} (${need} m) exceeds the truck's ${dim} (${have} m).`);
    }
  }

  const needed = Array.isArray(load?.requiredEquipment) ? load.requiredEquipment : [];
  const fitted = new Set((Array.isArray(truck?.equipment) ? truck.equipment : []).map((e) => String(e).toLowerCase()));
  const missing = needed.filter((e) => !fitted.has(String(e).toLowerCase()));
  if (missing.length) reasons.push(`Truck lacks required equipment: ${missing.join(", ")}.`);

  // Route: a truck with route legs is bound by them; otherwise its service areas must
  // cover both ends. Being near the pickup is not enough to promise the delivery.
  const legs = Array.isArray(truck?.routeLegs) ? truck.routeLegs : [];
  let coveringLeg = null;
  if (legs.length > 0) {
    const open = legs.filter((leg) => leg.status === "Available");
    if (open.length === 0) reasons.push("No truck route leg is currently marked available.");
    else {
      coveringLeg = open.find((leg) => legCovers(leg, load)) || null;
      if (!coveringLeg) reasons.push("No available route leg runs from the pickup to the destination.");
    }
  } else {
    const areas = Array.isArray(truck?.serviceAreas) ? truck.serviceAreas : [];
    const covered = areas.some((a) => locationsMatch(load?.pickup, a)) && areas.some((a) => locationsMatch(load?.destination, a));
    if (!covered) reasons.push("No registered route or service-area covers both the pickup and the destination.");
  }

  const window = loadWindow(load);
  const from = time(coveringLeg?.availableFrom);
  if (window && from !== null && from > window[1]) {
    reasons.push("Truck availability starts after the load's pickup/delivery window.");
  }

  // Another assignment of the same truck blocks this one unless both time windows are
  // known and do not overlap.
  const truckId = idOf(truck);
  for (const assignment of conflictingAssignments) {
    if (!truckId || idOf(assignment?.truck) !== truckId) continue;
    const other = loadWindow(assignment.load);
    if (!window || !other) {
      reasons.push("Truck already has an active assignment with an unknown time window.");
      break;
    }
    if (window[0] <= other[1] && other[0] <= window[1]) {
      reasons.push("Truck is already assigned during this load's time window.");
      break;
    }
  }

  return { eligible: reasons.length === 0, rejectionReasons: reasons };
}

export function scoreTruckForLoad(load, truck, options = {}) {
  const serviceAreas = Array.isArray(truck.serviceAreas) ? truck.serviceAreas : [];
  const pickupCovered = serviceAreas.some((area) => locationsMatch(load.pickup, area));
  const destinationCovered = serviceAreas.some((area) => locationsMatch(load.destination, area));
  const currentNearPickup = locationsMatch(load.pickup, truck.currentLocation);

  let routeCoverage = "none";
  if (pickupCovered && destinationCovered) routeCoverage = "full";
  else if (pickupCovered) routeCoverage = "pickup";
  else if (destinationCovered) routeCoverage = "destination";
  else if (currentNearPickup) routeCoverage = "current-location";

  const routePoints = { full: 40, pickup: 27, destination: 23, "current-location": 12, none: 0 };
  const routeScore = routePoints[routeCoverage];

  const loadWeight = Number(load.weightTonnes);
  const truckCapacity = Number(truck.capacityTonnes);
  const capacityRatio = truckCapacity > 0 ? loadWeight / truckCapacity : 0;
  const capacityFit = Number.isFinite(capacityRatio) && capacityRatio > 0 && capacityRatio <= 1;
  let capacityScore = 0;
  if (capacityFit) {
    if (capacityRatio < 0.4) capacityScore = 12 + (capacityRatio / 0.4) * 8;
    else if (capacityRatio <= 0.9) capacityScore = 20;
    else capacityScore = 20 - ((capacityRatio - 0.9) / 0.1) * 5;
  }

  const requiredType = String(load.truckType || "").trim().toLowerCase();
  const actualType = String(truck.truckType || "").trim().toLowerCase();
  const typeFit = requiredType === "any suitable truck" || actualType === requiredType || actualType === "any suitable truck";
  const typeScore = typeFit ? (requiredType === "any suitable truck" || actualType === "any suitable truck" ? 12 : 15) : 4;

  const offeredPrice = Number(load.offeredPrice);
  const quote = truck.quotedPrice == null ? null : Number(truck.quotedPrice);
  let priceScore = 10;
  let priceFit = null;
  if (quote !== null && Number.isFinite(quote) && quote >= 0 && Number.isFinite(offeredPrice) && offeredPrice > 0) {
    const ratio = quote / offeredPrice;
    priceScore = clampScore(20 - Math.max(0, ratio - 1) * 60, 20);
    priceFit = quote <= offeredPrice;
  } else if (quote === 0 && offeredPrice === 0) {
    priceScore = 20;
    priceFit = true;
  }

  const available = truck.isAvailable === true;
  const availabilityScore = available ? SCORE_WEIGHTS.availability : 0;
  const breakdown = {
    route: { score: Math.round(routeScore), max: SCORE_WEIGHTS.route, coverage: routeCoverage },
    capacity: { score: clampScore(capacityScore, SCORE_WEIGHTS.capacity), max: SCORE_WEIGHTS.capacity, utilizationPercent: Math.round(capacityRatio * 100) },
    vehicleType: { score: typeScore, max: SCORE_WEIGHTS.vehicleType, fit: typeFit },
    price: { score: priceScore, max: SCORE_WEIGHTS.price, withinOffer: priceFit },
    availability: { score: availabilityScore, max: SCORE_WEIGHTS.availability, available },
  };
  const matchScore = Object.values(breakdown).reduce((sum, part) => sum + part.score, 0);
  const matchReasons = [
    routeCoverage === "full" ? "Service areas cover pickup and destination" :
      routeCoverage === "pickup" ? "Service areas cover pickup; destination coverage is unconfirmed" :
        routeCoverage === "destination" ? "Service areas cover destination; pickup coverage is unconfirmed" :
          routeCoverage === "current-location" ? "Truck is currently near pickup; route coverage is unconfirmed" :
            "No service-area route coverage is registered",
    capacityFit ? `Capacity fits; load uses ${Math.round(capacityRatio * 100)}% of truck capacity` : "Truck capacity is insufficient",
    typeFit ? "Truck type matches the load" : "Truck type differs from the requested type",
    quote === null || !Number.isFinite(quote) ? "Transporter has not provided a quote" :
      !Number.isFinite(offeredPrice) || offeredPrice <= 0 ? "Factory offer is not set, so price fit cannot be calculated" :
        priceFit ? "Quote is within the factory offer" : `Quote is ${Math.round((quote / offeredPrice - 1) * 100)}% above the factory offer`,
    available ? "Truck is marked available" : "Truck is not available",
  ];

  const { eligible, rejectionReasons } = evaluateTruckAgainstLoad(load, truck, options);
  return {
    ...truck,
    isEligible: eligible,
    rejectionReasons,
    matchScore,
    matchBand: matchScore >= 80 && priceFit !== false ? "Strong" : matchScore >= 65 ? "Good" : matchScore >= 50 ? "Partial" : "Weak",
    routeFit: routeCoverage === "full",
    routeCoverage,
    typeFit,
    capacityFit,
    priceFit,
    scoreBreakdown: breakdown,
    matchReasons,
  };
}

export function matchTrucksToLoad(load, trucks, options = {}) {
  return trucks
    .map((truck) => scoreTruckForLoad(load, truck, options))
    .filter((truck) => truck.isEligible)
    .sort((a, b) => b.matchScore - a.matchScore || (a.quotedPrice ?? Number.MAX_SAFE_INTEGER) - (b.quotedPrice ?? Number.MAX_SAFE_INTEGER));
}
