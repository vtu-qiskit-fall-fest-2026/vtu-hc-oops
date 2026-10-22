// Demo accounts and freight around Pune so the app is usable from a fresh clone.
// Every account's password is DEMO_PASSWORD. Idempotent: does nothing if the demo
// factory already exists.
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Load from "../models/Load.js";
import Truck from "../models/Truck.js";
import { geocode } from "../services/routingService.js";

export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_ACCOUNTS = [
  { role: "shipper", name: "Deccan Steel Works", email: "factory@demo.loadsetu.in", gstin: "27AAPFU0939F1ZV" },
  { role: "transporter", name: "Sahyadri Roadways", email: "transporter1@demo.loadsetu.in" },
  { role: "transporter", name: "Godavari Freight Lines", email: "transporter2@demo.loadsetu.in" },
  { role: "broker", name: "Pune Freight Desk", email: "broker@demo.loadsetu.in" },
];

const day = (n) => new Date(Date.now() + n * 86_400_000);

// 4 loads x 5 trucks gives 9 eligible (load, truck) pairs: a 9-qubit QAOA instance, with
// a real trade-off (truck T1 is cheapest for two loads, T5 only fits one).
const LOADS = [
  { title: "Steel coils to Nashik", material: "Steel coils", pickup: "Pune", destination: "Nashik", weightTonnes: 8, truckType: "Open truck", offeredPrice: 18000, pickupDate: day(3) },
  { title: "Export cartons to JNPT", material: "Packed auto parts", pickup: "Pune", destination: "Mumbai", weightTonnes: 6, truckType: "Container", offeredPrice: 15000, pickupDate: day(3) },
  { title: "Machined castings", material: "Castings", pickup: "Pune", destination: "Aurangabad", weightTonnes: 10, truckType: "Open truck", offeredPrice: 24000, pickupDate: day(4) },
  { title: "Spare parts to Kolhapur", material: "Spare parts", pickup: "Pune", destination: "Kolhapur", weightTonnes: 5, truckType: "Any suitable truck", offeredPrice: 14000, pickupDate: day(4) },
];

const leg = (origin, destination, legType = "OUTWARD") => ({ legType, origin, destination, availableFrom: day(1), status: "Available" });
const TRUCKS = [
  { owner: 1, registrationNumber: "MH12AB1001", truckType: "Open truck", capacityTonnes: 12, quotedPrice: 17000, currentLocation: "Pune",
    routeLegs: [leg("Pune", "Nashik"), leg("Pune", "Aurangabad"), leg("Aurangabad", "Pune", "RETURN")] },
  { owner: 1, registrationNumber: "MH14CD2002", truckType: "Open truck", capacityTonnes: 16, quotedPrice: 21000, currentLocation: "Pune",
    routeLegs: [leg("Pune", "Nashik"), leg("Pune", "Aurangabad"), leg("Pune", "Kolhapur")] },
  { owner: 2, registrationNumber: "MH12EF3003", truckType: "Container", capacityTonnes: 10, quotedPrice: 14500, currentLocation: "Pune",
    routeLegs: [leg("Pune", "Mumbai"), leg("Pune", "Kolhapur")] },
  { owner: 2, registrationNumber: "MH09GH4004", truckType: "LCV", capacityTonnes: 6, quotedPrice: 12000, currentLocation: "Pune",
    routeLegs: [leg("Pune", "Kolhapur"), leg("Kolhapur", "Pune", "RETURN")] },
  { owner: 1, registrationNumber: "MH12JK5005", truckType: "Open truck", capacityTonnes: 9, quotedPrice: 16000, currentLocation: "Pune",
    routeLegs: [leg("Pune", "Nashik")] },
];

export async function seedDemoData({ log = console.log } = {}) {
  if (await User.exists({ email: DEMO_ACCOUNTS[0].email })) {
    log("Demo data already present; skipping seed.");
    return;
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [];
  for (const a of DEMO_ACCOUNTS) {
    users.push(await User.create({
      name: a.name, email: a.email, phone: "", passwordHash, role: a.role,
      verificationStatus: "VERIFIED", verifiedAt: new Date(), gstin: a.gstin || "",
    }));
  }
  // Paid-up yearly plans so loads and trucks can be created without Razorpay.
  for (const u of users.filter((u) => u.role !== "broker")) {
    await Subscription.create({
      user: u._id, role: u.role, plan: "YEARLY", amountPaise: 100, durationMonths: 12,
      razorpayOrderId: `demo_order_${u._id}`, razorpayPaymentId: `demo_payment_${u._id}`, paymentStatus: "SUCCESS", subscriptionStatus: "ACTIVE",
      startDate: new Date(), endDate: day(365), verifiedAt: new Date(),
    });
  }
  const [factory, t1, t2] = users;
  for (const l of LOADS) {
    const [from, to] = await Promise.all([geocode(l.pickup), geocode(l.destination)]);
    await Load.create({
      ...l, factory: factory._id, notes: "Demo load",
      pickupCoordinates: { latitude: from?.lat ?? null, longitude: from?.lng ?? null },
      deliveryCoordinates: { latitude: to?.lat ?? null, longitude: to?.lng ?? null },
    });
  }
  for (const { owner, ...t } of TRUCKS) {
    const transporter = owner === 1 ? t1 : t2;
    await Truck.create({
      ...t, transporter: transporter._id, transporterName: transporter.name,
      serviceAreas: [...new Set(t.routeLegs.flatMap((l) => [l.origin, l.destination]))],
      tripType: t.routeLegs.some((l) => l.legType === "RETURN") ? "ROUND_TRIP" : "ONE_WAY",
      isAvailable: true,
    });
  }
  log(`Seeded demo data: ${users.length} accounts, ${LOADS.length} loads, ${TRUCKS.length} trucks. Password for all: ${DEMO_PASSWORD}`);
}
