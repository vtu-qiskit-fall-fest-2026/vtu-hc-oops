import mongoose from "mongoose";
import Truck from "../models/Truck.js";
import Booking from "../models/Booking.js";
import Load from "../models/Load.js";

const isTransporter = (user) => String(user?.role || "").toLowerCase() === "transporter";
const userId = (user) => user?._id || user?.id;

export async function getTransporterOverview(req, res, next) {
  try {
    if (!isTransporter(req.user)) return res.status(403).json({ message: "Transporter access only." });
    const id = userId(req.user);
    const [trucks, bookings] = await Promise.all([
      Truck.find({ transporter: id }).sort({ updatedAt: -1 }).lean(),
      Booking.find({ transporter: id }).sort({ createdAt: -1 })
        .populate("load").populate("truck")
        .populate("factory", "name email phone role").lean(),
    ]);
    return res.json({
      trucks,
      bookings,
      metrics: {
        trucks: trucks.length,
        availableTrucks: trucks.filter((truck) => truck.isAvailable).length,
        activeJobs: bookings.filter((booking) => ["Confirmed", "In Transit"].includes(booking.status)).length,
        completedJobs: bookings.filter((booking) => booking.status === "Completed").length,
      },
    });
  } catch (error) { next(error); }
}

export async function updateTransporterBooking(req, res, next) {
  try {
    if (!isTransporter(req.user)) return res.status(403).json({ message: "Transporter access only." });
    const { status, rejectionReason = "" } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(400).json({ message: "Invalid booking ID." });
    if (!["Confirmed", "Rejected", "In Transit", "Completed"].includes(status)) {
      return res.status(400).json({ message: "Choose Accept, Reject, In Transit or Completed." });
    }
    const booking = await Booking.findOne({ _id: req.params.bookingId, transporter: userId(req.user) });
    if (!booking) return res.status(404).json({ message: "Assigned booking not found." });

    if (["Confirmed", "Rejected"].includes(status)) {
      if (booking.status !== "Pending") return res.status(409).json({ message: "Only pending booking requests can be accepted or rejected." });
      booking.status = status;
      booking.respondedAt = new Date();
      if (status === "Confirmed") booking.confirmedAt = new Date();
      booking.rejectionReason = status === "Rejected" ? String(rejectionReason).trim().slice(0, 500) : "";
      await booking.save();
      const truck = await Truck.findOne({ _id: booking.truck, transporter: userId(req.user) });
      if (truck && booking.routeLegId) {
        const leg = truck.routeLegs.id(booking.routeLegId);
        if (leg) leg.status = status === "Confirmed" ? "Booked" : "Available";
        truck.isAvailable = truck.routeLegs.some(item => item.status === "Available");
        await truck.save();
      }
      if (status === "Confirmed") {
        await Load.updateOne({ _id: booking.load }, { $set: { status: "Booked" } });
      } else {
        await Load.updateOne({ _id: booking.load, status: { $in: ["Open", "Matched", "Booked"] } }, { $set: { status: "Open" } });
        if (!booking.routeLegId) await Truck.updateOne({ _id: booking.truck, transporter: userId(req.user) }, { $set: { isAvailable: true } });
      }
    } else {
      if (status === "In Transit" && booking.status !== "Confirmed") return res.status(409).json({ message: "Accept the booking before starting transit." });
      if (status === "Completed" && booking.status !== "In Transit") return res.status(409).json({ message: "Only in-transit shipments can be marked completed." });
      booking.status = status;
      await booking.save();
      if (booking.routeLegId) {
        const truck = await Truck.findOne({ _id: booking.truck, transporter: userId(req.user) });
        if (truck) {
          const leg = truck.routeLegs.id(booking.routeLegId);
          if (leg) leg.status = status === "In Transit" ? "In Transit" : "Completed";
          truck.isAvailable = truck.routeLegs.some(item => item.status === "Available");
          await truck.save();
        }
      }
      const load = await Load.findById(booking.load);
      if (load) { load.status = status === "Completed" ? "Delivered" : "In Transit"; await load.save(); }
      if (status === "Completed" && !booking.routeLegId) await Truck.updateOne({ _id: booking.truck, transporter: userId(req.user) }, { $set: { isAvailable: true } });
    }

    const updated = await Booking.findById(booking._id)
      .populate("load").populate("truck")
      .populate("factory", "name email phone role")
      .populate("transporter", "name email phone role").lean();
    return res.json({ message: status === "Confirmed" ? "Booking accepted. The factory and broker have been notified." : status === "Rejected" ? "Booking rejected. The truck is available for other matches." : `Shipment updated to ${status}.`, booking: updated });
  } catch (error) { next(error); }
}

export async function updateTransporterLocation(req, res, next) {
  try {
    if (!isTransporter(req.user)) return res.status(403).json({ message: "Transporter access only." });
    const { latitude, longitude, accuracy } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(400).json({ message: "Invalid booking ID." });
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: "A valid latitude and longitude are required." });
    }
    const booking = await Booking.findOne({ _id: req.params.bookingId, transporter: userId(req.user) });
    if (!booking) return res.status(404).json({ message: "Assigned booking not found." });
    if (booking.status !== "In Transit") return res.status(409).json({ message: "Location sharing is available only while a shipment is in transit." });
    booking.liveLocation = {
      latitude, longitude,
      accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined,
      updatedAt: new Date(),
    };
    await booking.save();
    return res.json({ message: "Location updated.", updatedAt: booking.liveLocation.updatedAt });
  } catch (error) { next(error); }
}

export async function getLoadLiveLocation(req, res, next) {
  try {
    if (!['shipper', 'factory'].includes(String(req.user?.role || '').toLowerCase())) {
      return res.status(403).json({ message: "Factory access only." });
    }
    if (!mongoose.isValidObjectId(req.params.loadId)) return res.status(400).json({ message: "Invalid load ID." });
    const booking = await Booking.findOne({ load: req.params.loadId, factory: userId(req.user) })
      .select("status liveLocation")
      .lean();
    if (!booking) return res.status(404).json({ message: "No booking found for this load." });
    return res.json({ status: booking.status, location: booking.liveLocation || null });
  } catch (error) { next(error); }
}
