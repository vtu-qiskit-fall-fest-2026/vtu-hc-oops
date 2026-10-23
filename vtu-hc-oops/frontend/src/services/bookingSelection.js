function idOf(value) {
  return String(value?._id || value?.id || "");
}

export function resolveBookingSelection(loads, matches, { loadId, truckId, routeLegId = "" }) {
  if (!Array.isArray(loads) || !Array.isArray(matches)) {
    throw new TypeError("Loads and matches must be arrays.");
  }
  const load = loads.find((candidate) => idOf(candidate) === String(loadId || ""));
  if (!load) throw new Error("This load is no longer available in your account. Refresh your loads.");

  const truck = matches.find((candidate) =>
    idOf(candidate) === String(truckId || "")
      && String(candidate.routeLegId || "") === String(routeLegId || "")
      && candidate.isEligible !== false
  );
  if (!truck) throw new Error("This truck match is no longer available. Return to matches and refresh.");

  const quoteValue = typeof truck.quotedPrice === "string" && truck.quotedPrice.trim() === ""
    ? Number.NaN
    : Number(truck.quotedPrice);
  const hasQuote = truck.quotedPrice !== null
    && truck.quotedPrice !== undefined
    && Number.isFinite(quoteValue)
    && quoteValue >= 0;
  const offeredPrice = typeof load.offeredPrice === "string" && load.offeredPrice.trim() === ""
    ? Number.NaN
    : Number(load.offeredPrice);
  if (!hasQuote && (!Number.isFinite(offeredPrice) || offeredPrice < 0)) {
    throw new Error("Neither a valid transporter quote nor a factory offer is available for this booking.");
  }

  return {
    loadId: idOf(load),
    truckId: idOf(truck),
    routeLegId: routeLegId || null,
    pickup: load.pickup,
    destination: load.destination,
    material: load.material || load.title,
    weightTonnes: load.weightTonnes,
    pickupDate: load.pickupDate,
    truckType: truck.truckType,
    vehicleNumber: truck.registrationNumber,
    registrationNumber: truck.registrationNumber,
    capacityTonnes: truck.capacityTonnes,
    driverName: truck.transporter?.name || truck.transporterName || "",
    driverPhone: truck.transporter?.phone || "",
    freightPrice: hasQuote ? quoteValue : offeredPrice,
    priceBasis: hasQuote ? "transporter-quote" : "factory-offer-estimate",
    source: "live-matching",
  };
}

export function createBookingPayload(selection, { acceptTerms = false } = {}) {
  if (!selection?.loadId || !selection?.truckId) {
    throw new TypeError("A live load and truck selection are required to create a booking.");
  }
  if (acceptTerms !== true) throw new Error("Please accept the shipment terms before sending a booking request.");
  return {
    loadId: selection.loadId,
    truckId: selection.truckId,
    routeLegId: selection.routeLegId || undefined,
    acceptTerms,
  };
}
