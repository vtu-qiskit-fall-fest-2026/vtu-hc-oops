import Truck from "../models/Truck.js";
import Load from "../models/Load.js";
import Booking from "../models/Booking.js";
import { matchTrucksToLoad } from "../services/matchingEngine.js";

const truckTypes = ["Mini truck", "Pickup", "LCV", "Open truck", "Container", "Trailer", "Tipper", "Any suitable truck"];
const isFactory = user => ["shipper", "factory"].includes(String(user?.role || "").toLowerCase());
const isTransporter = user => String(user?.role || "").toLowerCase() === "transporter";
const idOf = user => user?._id || user?.id;

// Transporter-side API endpoint for registering a truck profile.
export async function upsertMyTruck(req, res, next) {
  try {
    if (!isTransporter(req.user)) return res.status(403).json({ message: "Only transporter accounts can register trucks." });
    const body = req.body || {};
    const { registrationNumber, truckType, capacityTonnes, currentLocation = "", serviceAreas = [], quotedPrice = null, isAvailable = true } = body;
    const tripType = body.tripType === "ROUND_TRIP" ? "ROUND_TRIP" : "ONE_WAY";
    const capacity = Number(capacityTonnes);
    const price = quotedPrice === "" || quotedPrice == null ? null : Number(quotedPrice);
    const outwardOrigin = String(body.outwardOrigin || "").trim();
    const outwardDestination = String(body.outwardDestination || "").trim();
    const returnOrigin = String(body.returnOrigin || outwardDestination).trim();
    const returnDestination = String(body.returnDestination || outwardOrigin).trim();
    const validLeg = (origin, destination) => origin && destination && origin.toLowerCase() !== destination.toLowerCase();
    if (typeof registrationNumber !== "string" || !registrationNumber.trim()) return res.status(400).json({ message: "Enter the truck registration number." });
    if (!truckTypes.includes(truckType)) return res.status(400).json({ message: "Choose a valid truck type." });
    if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 1000) return res.status(400).json({ message: "Enter a valid truck capacity in tonnes." });
    if (price !== null && (!Number.isFinite(price) || price < 0)) return res.status(400).json({ message: "Enter a valid quote." });
    if (!validLeg(outwardOrigin, outwardDestination)) return res.status(400).json({ message: "Enter valid, different outward origin and destination locations." });
    if (body.outwardAvailableFrom && Number.isNaN(Date.parse(body.outwardAvailableFrom))) return res.status(400).json({ message: "Enter a valid outward availability date." });
    if (tripType === "ROUND_TRIP") {
      if (!validLeg(returnOrigin, returnDestination)) return res.status(400).json({ message: "Enter valid, different return origin and destination locations." });
      if (body.returnAvailableFrom && Number.isNaN(Date.parse(body.returnAvailableFrom))) return res.status(400).json({ message: "Enter a valid return availability date." });
    }
    const userId = idOf(req.user);
    const userName = req.user.name || "";
    const normalizedAreas = Array.isArray(serviceAreas) ? serviceAreas.map(String).map(s => s.trim()).filter(Boolean).slice(0, 30) : [];
    const existingTruck = await Truck.findOne({ transporter: userId, registrationNumber: registrationNumber.trim().toUpperCase() });
    if (existingTruck) {
      const activeLegBookings = await Booking.find({ truck: existingTruck._id, status: { $in: ["Pending", "Confirmed", "In Transit"] }, routeLegId: { $ne: null } }).select("routeLegId status").lean();
      const proposed = [{ legType: "OUTWARD", origin: outwardOrigin, destination: outwardDestination }];
      if (tripType === "ROUND_TRIP") proposed.push({ legType: "RETURN", origin: returnOrigin, destination: returnDestination });
      for (const booking of activeLegBookings) {
        const currentLeg = existingTruck.routeLegs.id(booking.routeLegId);
        const nextLeg = proposed.find(leg => leg.legType === currentLeg?.legType);
        if (!currentLeg || !nextLeg || currentLeg.origin !== nextLeg.origin || currentLeg.destination !== nextLeg.destination) {
          return res.status(409).json({ message: "This truck has a pending, accepted or active booking on a route leg. That route cannot be removed or changed until the booking is cancelled or completed." });
        }
      }
    }
    const makeLeg = (legType, origin, destination, availableFrom) => {
      const previous = existingTruck?.routeLegs?.find(leg => leg.legType === legType && leg.origin === origin && leg.destination === destination);
      const status = previous && ["Pending", "Booked", "In Transit", "Completed"].includes(previous.status)
        ? previous.status
        : Boolean(isAvailable) ? "Available" : "Unavailable";
      return { ...(previous?._id ? { _id: previous._id } : {}), legType, origin, destination, availableFrom: availableFrom || null, status };
    };
    const routeLegs = [makeLeg("OUTWARD", outwardOrigin, outwardDestination, body.outwardAvailableFrom)];
    if (tripType === "ROUND_TRIP") routeLegs.push(makeLeg("RETURN", returnOrigin, returnDestination, body.returnAvailableFrom));
    const truck = await Truck.findOneAndUpdate(
      { transporter: userId, registrationNumber: registrationNumber.trim().toUpperCase() },
      { $set: { transporterName: userName, truckType, capacityTonnes: capacity, currentLocation: String(currentLocation).trim(), serviceAreas: normalizedAreas, quotedPrice: price, tripType, routeLegs, isAvailable: Boolean(isAvailable) }, $setOnInsert: { transporter: userId, registrationNumber: registrationNumber.trim().toUpperCase() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ message: "Truck profile and trip routes saved.", truck });
  } catch (error) { next(error); }
}

export async function getTruckMatches(req, res, next) {
  try {
    if (!isFactory(req.user)) return res.status(403).json({ message: "Only factory/goods-owner accounts can view truck matches." });
    const loadId = String(req.query.loadId || "");
    if (!loadId) return res.status(400).json({ message: "Choose a load to find truck matches." });
    const load = await Load.findOne({ _id: loadId, factory: idOf(req.user) }).lean();
    if (!load) return res.status(404).json({ message: "Load not found for this factory account." });
    if (!["Open", "Matched"].includes(load.status)) return res.status(409).json({ message: "Truck matching is only available for open or matched loads." });
    const trucks = await Truck.find({ isAvailable: true, capacityTonnes: { $gte: Number(load.weightTonnes) } })
      .populate("transporter", "name")
      .lean();
    const expanded = trucks.flatMap(truck => {
      const legs = Array.isArray(truck.routeLegs) && truck.routeLegs.length
        ? truck.routeLegs.filter(leg => leg.status === "Available").map(leg => ({ ...truck, routeLegId: leg._id, routeLeg: leg, currentLocation: leg.origin, serviceAreas: [leg.origin, leg.destination] }))
        : [truck];
      return legs;
    });
    const matches = matchTrucksToLoad(load, expanded);
    return res.json({
      load: { _id: load._id, title: load.title, pickup: load.pickup, destination: load.destination, weightTonnes: load.weightTonnes, truckType: load.truckType, offeredPrice: load.offeredPrice },
      matching: { version: 1, capacityEligibleTruckCount: trucks.length, eligibleTruckCount: matches.length, weights: { route: 40, capacity: 20, vehicleType: 15, price: 20, availability: 5 } },
      matches,
    });
  } catch (error) { next(error); }
}
