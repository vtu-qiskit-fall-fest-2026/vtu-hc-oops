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

function locationsMatch(left, right) {
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

export function scoreTruckForLoad(load, truck) {
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

  return {
    ...truck,
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

export function matchTrucksToLoad(load, trucks) {
  return trucks
    .map((truck) => scoreTruckForLoad(load, truck))
    .filter((truck) => truck.isAvailable && truck.capacityFit && (truck.routeCoverage !== "none" || truck.typeFit))
    .sort((a, b) => b.matchScore - a.matchScore || (a.quotedPrice ?? Number.MAX_SAFE_INTEGER) - (b.quotedPrice ?? Number.MAX_SAFE_INTEGER));
}
