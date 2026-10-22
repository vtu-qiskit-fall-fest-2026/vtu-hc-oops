import Load from "../models/Load.js";

const statuses = ["Open", "Booking Pending", "Booked", "In Transit", "Delivered", "Cancelled"];
const vehicleTypes = ["Any", "Mini Truck", "LCV", "6-Wheeler", "10-Wheeler", "Trailer", "Container"];

function makeMatch(load) {
  // Rule-based demo scoring. Distance and transporter reliability need real data to be accurate.
  const candidates = [
    { id: "demo-1", name: "Shree Ganesh Logistics", phone: "", truckNumber: "MH-09-DEMO-01", capacity: Math.max(load.weightTonnes * 1.25, load.weightTonnes + 1), type: load.vehicleType === "Any" ? "10-Wheeler" : load.vehicleType, price: Math.round(load.offeredPrice * 0.96), available: true, routeFit: 94, reliability: 92, verified: false },
    { id: "demo-2", name: "Western Route Carriers", phone: "", truckNumber: "MH-12-DEMO-02", capacity: Math.max(load.weightTonnes * 1.5, load.weightTonnes + 2), type: load.vehicleType === "Any" ? "Trailer" : load.vehicleType, price: Math.round(load.offeredPrice * 1.02), available: true, routeFit: 88, reliability: 89, verified: false },
    { id: "demo-3", name: "Sahyadri Transport", phone: "", truckNumber: "MH-10-DEMO-03", capacity: Math.max(load.weightTonnes * 1.1, load.weightTonnes + 0.5), type: load.vehicleType === "Any" ? "6-Wheeler" : load.vehicleType, price: Math.round(load.offeredPrice * 0.91), available: true, routeFit: 80, reliability: 82, verified: false }
  ];
  return candidates.map((truck) => {
    const capacityFit = Math.min(100, Math.round((load.weightTonnes / truck.capacity) * 100));
    const priceFit = Math.max(35, Math.min(100, Math.round(100 - Math.abs(truck.price - load.offeredPrice) / Math.max(load.offeredPrice, 1) * 100)));
    const score = Math.round(truck.routeFit * 0.35 + truck.reliability * 0.25 + priceFit * 0.25 + capacityFit * 0.15);
    const reasons = [];
    if (truck.capacity >= load.weightTonnes) reasons.push(`Capacity ${truck.capacity} t covers your ${load.weightTonnes} t load`);
    reasons.push(`Route compatibility estimate: ${truck.routeFit}%`);
    reasons.push(`Indicative quote: ₹${truck.price.toLocaleString("en-IN")}`);
    reasons.push("Availability and transporter details are demo placeholders until connected to real transporter records");
    return { ...truck, score, reasons };
  }).filter((truck) => truck.capacity >= load.weightTonnes).sort((a, b) => b.score - a.score);
}

function validDateOrder(pickupDate, deliveryDate) {
  return new Date(deliveryDate) >= new Date(pickupDate);
}

export async function createLoad(req, res) {
  try {
    const { factoryName, cargo, pickup, destination, weightTonnes, vehicleType = "Any", pickupDate, deliveryDate, offeredPrice, notes = "" } = req.body;
    if (!factoryName || !cargo || !pickup || !destination || !pickupDate || !deliveryDate) return res.status(400).json({ message: "Please complete all required load details." });
    if (!validDateOrder(pickupDate, deliveryDate)) return res.status(400).json({ message: "Delivery date must be on or after pickup date." });
    if (!Number.isFinite(Number(weightTonnes)) || Number(weightTonnes) <= 0 || !Number.isFinite(Number(offeredPrice)) || Number(offeredPrice) <= 0) return res.status(400).json({ message: "Enter a valid load weight and offered price." });
    if (!vehicleTypes.includes(vehicleType)) return res.status(400).json({ message: "Choose a valid vehicle type." });
    const load = await Load.create({ factory: req.user._id, factoryName, cargo, pickup, destination, weightTonnes: Number(weightTonnes), vehicleType, pickupDate, deliveryDate, offeredPrice: Number(offeredPrice), notes, statusHistory: [{ status: "Open", note: "Load posted by factory" }] });
    res.status(201).json({ load });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    throw error;
  }
}

export async function getMyLoads(req, res) {
  const loads = await Load.find({ factory: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ loads });
}

export async function getMatches(req, res) {
  const load = await Load.findOne({ _id: req.params.id, factory: req.user._id });
  if (!load) return res.status(404).json({ message: "Load not found." });
  res.json({ loadId: load._id, matches: makeMatch(load), demo: true, note: "Demo match candidates only. Connect real transporter/truck records before using for operational decisions." });
}

export async function confirmBooking(req, res) {
  const { transporterName, transporterPhone = "", truckNumber, truckCapacityTonnes, quotedPrice } = req.body;
  if (!transporterName || !truckNumber || !Number.isFinite(Number(quotedPrice)) || Number(quotedPrice) <= 0) return res.status(400).json({ message: "Transporter, truck number and valid quote are required." });
  const load = await Load.findOne({ _id: req.params.id, factory: req.user._id });
  if (!load) return res.status(404).json({ message: "Load not found." });
  if (["Cancelled", "Delivered"].includes(load.status)) return res.status(400).json({ message: `Cannot book a ${load.status.toLowerCase()} load.` });
  load.booking = { transporterName, transporterPhone, truckNumber, truckCapacityTonnes: Number(truckCapacityTonnes) || 0, quotedPrice: Number(quotedPrice), confirmedAt: new Date() };
  load.status = "Booked";
  load.statusHistory.push({ status: "Booked", note: `Booking recorded for ${transporterName}` });
  await load.save();
  res.json({ load });
}

export async function updateShipmentStatus(req, res) {
  const { status, note = "" } = req.body;
  if (!statuses.includes(status)) return res.status(400).json({ message: "Invalid shipment status." });
  const load = await Load.findOne({ _id: req.params.id, factory: req.user._id });
  if (!load) return res.status(404).json({ message: "Load not found." });
  const allowed = {
    "Open": ["Booking Pending", "Cancelled"],
    "Booking Pending": ["Booked", "Cancelled"],
    "Booked": ["In Transit", "Cancelled"],
    "In Transit": ["Delivered"],
    "Delivered": [], "Cancelled": []
  };
  if (!allowed[load.status].includes(status)) return res.status(400).json({ message: `Cannot change status from ${load.status} to ${status}.` });
  load.status = status;
  load.statusHistory.push({ status, note: String(note).slice(0, 300) });
  await load.save();
  res.json({ load });
}

export async function getFactorySummary(req, res) {
  const loads = await Load.find({ factory: req.user._id }).lean();
  const total = loads.length;
  const delivered = loads.filter(l => l.status === "Delivered").length;
  const active = loads.filter(l => ["Open", "Booking Pending", "Booked", "In Transit"].includes(l.status)).length;
  const booked = loads.filter(l => ["Booked", "In Transit", "Delivered"].includes(l.status));
  const estimatedSavings = booked.reduce((sum, l) => sum + Math.max(0, Number(l.offeredPrice || 0) - Number(l.booking?.quotedPrice || 0)), 0);
  res.json({ summary: { total, active, delivered, bookings: booked.length, estimatedSavings } });
}
