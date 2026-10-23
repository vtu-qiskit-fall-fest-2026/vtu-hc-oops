import Load from "../models/Load.js";
import { geocode } from "../services/routingService.js";

const allowedTruckTypes = ["Any suitable truck", "Mini truck", "Pickup", "LCV", "Open truck", "Container", "Trailer", "Tipper"];

export async function createLoad(req, res, next) {
  try {
    if (!["shipper", "factory"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only factory/goods-owner accounts can create loads." });
    }

    const { title, pickup, destination, material, weightTonnes, truckType, pickupDate, offeredPrice, notes = "" } = req.body;
    if (![title, pickup, destination, material, truckType, pickupDate].every(v => typeof v === "string" && v.trim())) {
      return res.status(400).json({ message: "Please complete all required load details." });
    }
    const weight = Number(weightTonnes);
    const price = Number(offeredPrice);
    const date = new Date(pickupDate);
    if (!Number.isFinite(weight) || weight <= 0) return res.status(400).json({ message: "Enter a valid load weight in tonnes." });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Enter a valid offered price." });
    if (Number.isNaN(date.getTime())) return res.status(400).json({ message: "Choose a valid pickup date." });
    if (!allowedTruckTypes.includes(truckType)) return res.status(400).json({ message: "Choose a valid truck type." });
    if (pickup.trim().toLowerCase() === destination.trim().toLowerCase()) return res.status(400).json({ message: "Pickup and destination must be different." });

    // Best effort: coordinates power the route map and distance estimates. A load is
    // still saved if a place can't be found; the map then says so.
    const [from, to] = await Promise.all([geocode(pickup), geocode(destination)]).catch(() => [null, null]);
    const coords = (p) => (p ? { latitude: p.lat, longitude: p.lng } : { latitude: null, longitude: null });
    const load = await Load.create({
      factory: req.user._id,
      title: title.trim(), pickup: pickup.trim(), destination: destination.trim(),
      material: material.trim(), weightTonnes: weight, truckType, pickupDate: date,
      offeredPrice: price, notes: String(notes).trim(),
      pickupCoordinates: coords(from), deliveryCoordinates: coords(to)
    });
    return res.status(201).json({ message: "Load created successfully.", load });
  } catch (error) { next(error); }
}

export async function getMyLoads(req, res, next) {
  try {
    if (!["shipper", "factory"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only factory/goods-owner accounts can view factory loads." });
    }
    const loads = await Load.find({ factory: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ loads });
  } catch (error) { next(error); }
}
