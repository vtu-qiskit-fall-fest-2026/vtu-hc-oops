import mongoose from "mongoose";
import Load from "../models/Load.js";
import Truck from "../models/Truck.js";
import Booking from "../models/Booking.js";

const isBroker = (user) => String(user?.role || "").toLowerCase() === "broker";
const idOf = (user) => user?._id || user?.id;
const norm = (value) => String(value || "").trim().toLowerCase();
const availableLoadStatuses = ["Open", "Matched"];

function matchTruck(load, truck, routeLeg = null) {
  const required = norm(load.truckType);
  const actual = norm(truck.truckType);
  const typeFit = required === "any suitable truck" || actual === required || actual === "any suitable truck";
  const capacity = Number(truck.capacityTonnes || 0);
  const weight = Number(load.weightTonnes || 0);
  const capacityFit = capacity >= weight;
  const pickup = norm(load.pickup);
  const destination = norm(load.destination);
  const areas = (truck.serviceAreas || []).map(norm);
  const current = norm(truck.currentLocation);
  const legOrigin = norm(routeLeg?.origin);
  const legDestination = norm(routeLeg?.destination);
  const pickupFit = routeLeg
    ? Boolean(legOrigin && (pickup === legOrigin || pickup.includes(legOrigin) || legOrigin.includes(pickup)))
    : areas.some((area) => area && (pickup.includes(area) || area.includes(pickup))) || Boolean(current && (pickup.includes(current) || current.includes(pickup)));
  const destinationFit = routeLeg
    ? Boolean(legDestination && (destination === legDestination || destination.includes(legDestination) || legDestination.includes(destination)))
    : areas.some((area) => area && (destination.includes(area) || area.includes(destination)));
  const routeFit = pickupFit && destinationFit;
  const quoted = truck.quotedPrice == null ? null : Number(truck.quotedPrice);
  const offered = Number(load.offeredPrice || 0);
  const priceFit = quoted == null || offered <= 0 || quoted <= offered * 1.15;
  let score = 0;
  const reasons = [];
  if (typeFit) { score += 25; reasons.push("Truck type is compatible"); } else reasons.push("Truck type differs from the requested type");
  if (capacityFit) { score += 30; reasons.push(`Capacity fits (${capacity} t for ${weight} t)`); } else reasons.push(`Insufficient capacity (${capacity} t available, ${weight} t required)`);
  if (routeFit) { score += 25; reasons.push("Pickup and destination match service areas"); }
  else if (pickupFit || destinationFit) { score += 12; reasons.push("Partial route/service-area match"); }
  else reasons.push("Route is not listed in truck service areas");
  if (priceFit) { score += 15; reasons.push(quoted == null ? "Transporter quote not provided yet" : "Quote is within the target range"); }
  else reasons.push("Quote is above the target range");
  const pickupDate = load.pickupDate ? new Date(load.pickupDate) : null;
  const routeDateFit = !routeLeg || !routeLeg.availableFrom || !pickupDate || new Date(routeLeg.availableFrom) <= pickupDate;
  const available = (routeLeg ? routeLeg.status === "Available" : Boolean(truck.isAvailable)) && routeDateFit;
  if (available) { score += 5; reasons.push("This route leg is available for the requested date"); }
  else reasons.push(routeDateFit ? "This route leg is currently unavailable" : "Route leg becomes available after the load pickup date");
  const eligible = typeFit && capacityFit && available && (routeLeg ? routeFit : (routeFit || !truck.routeLegs?.length));
  return { score: Math.min(100, score), reasons, eligible, typeFit, capacityFit, routeFit, priceFit, routeLeg: routeLeg ? { _id: routeLeg._id, legType: routeLeg.legType, origin: routeLeg.origin, destination: routeLeg.destination, availableFrom: routeLeg.availableFrom, status: routeLeg.status } : null, routeLegId: routeLeg?._id || null };
}

export async function getBrokerOverview(req, res, next) {
  try {
    if (!isBroker(req.user)) return res.status(403).json({ message: "Broker access only." });
    const [loads, trucks, bookings] = await Promise.all([
      Load.find({ status: { $in: availableLoadStatuses } }).sort({ createdAt: -1 }).populate("factory", "name email phone role").lean(),
      Truck.find({}).sort({ isAvailable: -1, updatedAt: -1 }).populate("transporter", "name email phone role").lean(),
      Booking.find({}).sort({ createdAt: -1 }).populate("load").populate("truck").populate("factory", "name email phone role").populate("transporter", "name email phone role").lean(),
    ]);
    const loadIdsWithBookings = new Set(bookings.filter(b => !["Cancelled", "Rejected"].includes(b.status)).map(b => String(b.load?._id || b.load)));
    const openLoads = loads.filter(load => !loadIdsWithBookings.has(String(load._id)));
    const matches = openLoads.map(load => ({
      loadId: load._id,
      load,
      trucks: trucks.flatMap(truck => {
        const legs = Array.isArray(truck.routeLegs) && truck.routeLegs.length
          ? truck.routeLegs.map(leg => ({ leg, result: matchTruck(load, truck, leg) }))
          : [{ leg: null, result: matchTruck(load, truck) }];
        return legs.map(({ leg, result }) => ({ truck, ...result }));
      }).sort((a,b) => b.score - a.score).slice(0, 12),
    }));
    return res.json({
      metrics: {
        openLoads: openLoads.length,
        availableTrucks: trucks.filter(t => t.isAvailable).length,
        pendingBookings: bookings.filter(b => b.status === "Pending").length,
        activeShipments: bookings.filter(b => ["Confirmed", "In Transit"].includes(b.status) || ["Booked", "In Transit"].includes(b.load?.status)).length,
      },
      loads: openLoads,
      trucks,
      bookings,
      matches,
    });
  } catch (error) { next(error); }
}

export async function createBrokerBooking(req, res, next) {
  try {
    if (!isBroker(req.user)) return res.status(403).json({ message: "Broker access only." });
    const { loadId, truckId, routeLegId, agreedPrice } = req.body || {};
    if (!mongoose.isValidObjectId(loadId) || !mongoose.isValidObjectId(truckId)) return res.status(400).json({ message: "Choose a valid load and truck." });
    const price = Number(agreedPrice);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Enter a valid agreed freight price." });
    const load = await Load.findById(loadId);
    if (!load) return res.status(404).json({ message: "Load not found." });
    if (!availableLoadStatuses.includes(load.status)) return res.status(409).json({ message: "This load is no longer available for booking." });
    const truck = await Truck.findOne({ _id: truckId });
    if (!truck) return res.status(404).json({ message: "Truck not found." });
    let selectedLeg = null;
    if (Array.isArray(truck.routeLegs) && truck.routeLegs.length) {
      if (!mongoose.isValidObjectId(routeLegId)) return res.status(400).json({ message: "Choose the exact available route leg for this match." });
      selectedLeg = truck.routeLegs.id(routeLegId);
      if (!selectedLeg || selectedLeg.status !== "Available") return res.status(409).json({ message: "This route leg is no longer available." });
      if (selectedLeg.availableFrom && load.pickupDate && new Date(selectedLeg.availableFrom) > new Date(load.pickupDate)) return res.status(409).json({ message: "This route leg is not available by the load pickup date." });
      const origin = norm(selectedLeg.origin), pickup = norm(load.pickup);
      const destination = norm(selectedLeg.destination), targetDestination = norm(load.destination);
      if (!(origin && pickup && (origin === pickup || origin.includes(pickup) || pickup.includes(origin)) && destination && targetDestination && (destination === targetDestination || destination.includes(targetDestination) || targetDestination.includes(destination)))) return res.status(409).json({ message: "The selected route leg does not match this load direction." });
    } else if (!truck.isAvailable) return res.status(409).json({ message: "This truck is no longer available." });
    if (Number(truck.capacityTonnes) < Number(load.weightTonnes)) return res.status(409).json({ message: "Truck capacity is below the load weight." });
    const wanted = norm(load.truckType), actual = norm(truck.truckType);
    if (wanted !== "any suitable truck" && actual !== wanted && actual !== "any suitable truck") return res.status(409).json({ message: "Truck type is incompatible with this load." });
    const booking = await Booking.create({ load: load._id, truck: truck._id, routeLegId: selectedLeg?._id || null, factory: load.factory, transporter: truck.transporter, agreedPrice: price, status: "Pending" });
    // Reserve only the selected route leg while the transporter reviews the request.
    if (selectedLeg) selectedLeg.status = "Pending";
    const hasAvailableLeg = Array.isArray(truck.routeLegs) && truck.routeLegs.length
      ? truck.routeLegs.some(leg => leg.status === "Available")
      : false;
    truck.isAvailable = Array.isArray(truck.routeLegs) && truck.routeLegs.length ? hasAvailableLeg : false;
    await truck.save();
    const populated = await Booking.findById(booking._id).populate("load").populate("truck").populate("factory", "name email phone role").populate("transporter", "name email phone role").lean();
    return res.status(201).json({ message: "Booking request sent to the transporter and factory. Awaiting transporter acceptance.", booking: populated });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "This load already has a booking." });
    next(error);
  }
}

export async function updateBrokerBooking(req, res, next) {
  try {
    if (!isBroker(req.user)) return res.status(403).json({ message: "Broker access only." });
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(400).json({ message: "Invalid booking ID." });
    if (!["Cancelled", "Completed", "In Transit"].includes(status)) return res.status(400).json({ message: "Transporter acceptance or rejection must be recorded by the transporter." });
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (status === "In Transit" && booking.status !== "Confirmed") return res.status(409).json({ message: "The transporter must accept the booking before transit can begin." });
    if (status === "Completed" && booking.status !== "In Transit") return res.status(409).json({ message: "Only in-transit bookings can be completed." });
    if (status === "Cancelled" && ["Completed", "Cancelled"].includes(booking.status)) return res.status(409).json({ message: "This booking can no longer be cancelled." });
    booking.status = status;
    await booking.save();
    const load = await Load.findById(booking.load);
    const truck = await Truck.findById(booking.truck);
    if (load) {
      load.status = status === "Cancelled" ? "Open" : status === "In Transit" ? "In Transit" : status === "Completed" ? "Delivered" : "Booked";
      await load.save();
    }
    if (truck) {
      if (booking.routeLegId && truck.routeLegs?.length) {
        const leg = truck.routeLegs.id(booking.routeLegId);
        if (leg) leg.status = status === "Cancelled" ? "Available" : status === "In Transit" ? "In Transit" : status === "Completed" ? "Completed" : leg.status;
        truck.isAvailable = truck.routeLegs.some(item => item.status === "Available");
        await truck.save();
      } else if (["Cancelled", "Completed"].includes(status)) {
        truck.isAvailable = true;
        await truck.save();
      }
    }
    const populated = await Booking.findById(booking._id).populate("load").populate("truck").populate("factory", "name email phone role").populate("transporter", "name email phone role").lean();
    return res.json({ message: "Booking status updated.", booking: populated });
  } catch (error) { next(error); }
}

export async function updateBrokerShipment(req, res, next) {
  try {
    if (!isBroker(req.user)) return res.status(403).json({ message: "Broker access only." });
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.loadId)) return res.status(400).json({ message: "Invalid load ID." });
    if (!["Booked", "In Transit", "Delivered", "Cancelled"].includes(status)) return res.status(400).json({ message: "Choose a valid shipment status." });
    const load = await Load.findById(req.params.loadId);
    if (!load) return res.status(404).json({ message: "Shipment not found." });
    load.status = status;
    await load.save();
    const booking = await Booking.findOne({ load: load._id });
    if (booking && ["In Transit", "Delivered", "Cancelled"].includes(status)) {
      booking.status = status === "Delivered" ? "Completed" : status;
      await booking.save();
      if (["Delivered", "Cancelled"].includes(status)) await Truck.updateOne({ _id: booking.truck }, { $set: { isAvailable: true } });
    }
    return res.json({ message: "Shipment status updated.", load });
  } catch (error) { next(error); }
}
