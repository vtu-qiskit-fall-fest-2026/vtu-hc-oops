import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Load from "../models/Load.js";
import Truck from "../models/Truck.js";

const isFactory = user => ["shipper", "factory"].includes(String(user?.role || "").toLowerCase());
const idOf = user => user?._id || user?.id;

export async function createBooking(req, res, next) {
  let reservedLoadId = null;
  let createdBookingId = null;
  try {
    if (!isFactory(req.user)) {
      return res.status(403).json({ message: "Only factory/goods-owner accounts can confirm bookings." });
    }
    const { loadId, truckId, routeLegId, acceptTerms } = req.body || {};
    if (!mongoose.isValidObjectId(loadId) || !mongoose.isValidObjectId(truckId)) {
      return res.status(400).json({ message: "Choose a valid load and truck before confirming." });
    }
    if (acceptTerms !== true) {
      return res.status(400).json({ message: "Please confirm that you have reviewed the booking details." });
    }

    const factoryId = idOf(req.user);
    const load = await Load.findOne({ _id: loadId, factory: factoryId }).lean();
    if (!load) return res.status(404).json({ message: "This load was not found for your factory account." });
    if (["Booked", "In Transit", "Delivered", "Cancelled"].includes(load.status)) {
      return res.status(409).json({ message: "This load is no longer available for booking." });
    }

    const truck = await Truck.findOne({ _id: truckId });
    if (!truck) return res.status(404).json({ message: "This truck is no longer available. Refresh the matching results." });
    let selectedLeg = null;
    if (truck.routeLegs?.length) {
      if (!mongoose.isValidObjectId(routeLegId)) return res.status(400).json({ message: "Choose the exact route leg for this booking." });
      selectedLeg = truck.routeLegs.id(routeLegId);
      if (!selectedLeg || selectedLeg.status !== "Available") return res.status(409).json({ message: "This route leg is no longer available." });
      const origin = String(selectedLeg.origin).trim().toLowerCase(), pickup = String(load.pickup).trim().toLowerCase();
      const destination = String(selectedLeg.destination).trim().toLowerCase(), targetDestination = String(load.destination).trim().toLowerCase();
      if (!(origin && pickup && (origin === pickup || origin.includes(pickup) || pickup.includes(origin)) && destination && targetDestination && (destination === targetDestination || destination.includes(targetDestination) || targetDestination.includes(destination)))) return res.status(409).json({ message: "The selected route leg does not match this load." });
      if (selectedLeg.availableFrom && load.pickupDate && new Date(selectedLeg.availableFrom) > new Date(load.pickupDate)) return res.status(409).json({ message: "This route leg is not available by the load pickup date." });
    } else if (!truck.isAvailable) return res.status(404).json({ message: "This truck is no longer available. Refresh the matching results." });
    if (Number(truck.capacityTonnes) < Number(load.weightTonnes)) {
      return res.status(409).json({ message: "The selected truck capacity is below the load weight." });
    }
    const requestedType = String(load.truckType || "").toLowerCase();
    const truckType = String(truck.truckType || "").toLowerCase();
    if (requestedType !== "any suitable truck" && truckType !== requestedType && truckType !== "any suitable truck") {
      return res.status(409).json({ message: "The selected truck type does not meet this load's requirements." });
    }

    const agreedPrice = truck.quotedPrice == null ? Number(load.offeredPrice) : Number(truck.quotedPrice);
    // Keep the load in Matched state while the transporter reviews the booking.
    const booking = await Booking.create({
      load: load._id,
      truck: truck._id,
      routeLegId: selectedLeg?._id || null,
      factory: factoryId,
      transporter: truck.transporter,
      agreedPrice,
      status: "Pending"
    });
    createdBookingId = booking._id;

    const reserved = await Load.findOneAndUpdate(
      { _id: load._id, factory: factoryId, status: { $in: ["Open", "Matched"] } },
      { $set: { status: "Matched" } },
      { new: true }
    );
    if (!reserved) {
      await Booking.deleteOne({ _id: booking._id });
      createdBookingId = null;
      return res.status(409).json({ message: "This load was just booked or is no longer available. Refresh your loads." });
    }
    reservedLoadId = reserved._id;

    if (selectedLeg) selectedLeg.status = "Pending";
    truck.isAvailable = truck.routeLegs?.length ? truck.routeLegs.some(leg => leg.status === "Available") : false;
    await truck.save();
    const populated = await Booking.findById(booking._id)
      .populate("load")
      .populate("truck")
      .populate("transporter", "name email phone role")
      .lean();
    return res.status(201).json({ message: "Booking request sent. Awaiting transporter acceptance.", booking: populated });
  } catch (error) {
    // If a later operation failed, avoid leaving an accidental booking record behind.
    if (createdBookingId) {
      try { await Booking.deleteOne({ _id: createdBookingId }); } catch {}
    }
    if (reservedLoadId) {
      try { await Load.updateOne({ _id: reservedLoadId, status: "Matched" }, { $set: { status: "Open" } }); } catch {}
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This load already has a booking. Open My Loads to check its status." });
    }
    return next(error);
  }
}

export async function getMyBookings(req, res, next) {
  try {
    if (!isFactory(req.user)) {
      return res.status(403).json({ message: "Only factory/goods-owner accounts can view factory bookings." });
    }
    const bookings = await Booking.find({ factory: idOf(req.user) })
      .sort({ createdAt: -1 })
      .populate("load")
      .populate("truck")
      .populate("transporter", "name email phone role")
      .lean();
    return res.json({ bookings });
  } catch (error) { return next(error); }
}
