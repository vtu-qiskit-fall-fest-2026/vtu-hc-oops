import crypto from "node:crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Load from "../models/Load.js";
import Truck from "../models/Truck.js";
import { SHIPMENT_PRICING, haversineKm, roundRupees, toPaise } from "../config/shipmentPricing.js";
import { sendShipmentEmail } from "../services/emailService.js";

const roleOf = user => String(user?.role || "").toLowerCase();
const idOf = user => String(user?._id || user?.id || "");
const participantRole = (booking, user) => {
  const id = idOf(user);
  if (id && String(booking.factory) === id && ["shipper", "factory"].includes(roleOf(user))) return "factory";
  if (id && String(booking.transporter) === id && roleOf(user) === "transporter") return "transporter";
  return null;
};
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function getFrontendBaseUrl() {
  const configured = process.env.FRONTEND_BASE_URL || String(process.env.CLIENT_ORIGIN || "").split(",")[0].trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:5173";
  const error = new Error("FRONTEND_BASE_URL must be configured to generate secure shipment confirmation links."); error.status = 503; throw error;
}
function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID, key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) { const error = new Error("Razorpay Test Mode is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env."); error.status = 503; throw error; }
  return { client: new Razorpay({ key_id, key_secret }), key_id, key_secret };
}
function coordinatePair(value) {
  const latitude = Number(value?.latitude), longitude = Number(value?.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? { latitude, longitude } : null;
}
function partyTotalPlaceholder(factoryTotal, transporterTotal) { return roundRupees(factoryTotal); }
async function calculateSnapshot(booking) {
  const load = await Load.findById(booking.load).lean();
  if (!load) { const error = new Error("The shipment load could not be found."); error.status = 404; throw error; }
  const pickup = coordinatePair(load.pickupCoordinates), delivery = coordinatePair(load.deliveryCoordinates);
  if (!pickup || !delivery) { const error = new Error("Payment is unavailable because pickup or delivery coordinates are missing. Update both locations using valid latitude and longitude, then retry."); error.status = 422; throw error; }
  const distanceKm = haversineKm(pickup, delivery);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) { const error = new Error("A valid positive distance could not be calculated from the saved coordinates."); error.status = 422; throw error; }
  const depositRupees = roundRupees(distanceKm * SHIPMENT_PRICING.depositRupeesPerKm);
  const commissionRupees = roundRupees(distanceKm * SHIPMENT_PRICING.brokerCommissionRupeesPerKm);
  const otherChargesRupees = SHIPMENT_PRICING.otherChargesRupees;
  // The broker commission is charged once to the Factory Owner; the Transporter pays the commitment deposit.
  const totalFactoryPayableRupees = roundRupees(depositRupees + commissionRupees + otherChargesRupees);
  const totalTransporterPayableRupees = roundRupees(depositRupees);
  return { distanceKm, distanceMethod: "straight_line_haversine_fallback", depositRatePerKm: SHIPMENT_PRICING.depositRupeesPerKm, depositRupees, commissionRatePerKm: SHIPMENT_PRICING.brokerCommissionRupeesPerKm, commissionRupees, otherChargesRupees, totalPerPartyRupees: partyTotalPlaceholder(totalFactoryPayableRupees, totalTransporterPayableRupees), totalFactoryPayableRupees, totalTransporterPayableRupees, amountPaisePerParty: null, amountPaiseFactory: toPaise(totalFactoryPayableRupees), amountPaiseTransporter: toPaise(totalTransporterPayableRupees), calculatedAt: new Date() };
}
function publicBooking(booking) {
  const obj = booking.toObject ? booking.toObject() : booking;
  delete obj.confirmationTokenHash; delete obj.confirmationTokenExpiresAt;
  return obj;
}
async function authorizedBooking(req, tokenRequired = true) {
  const raw = String(req.params.token || "");
  if (!raw || raw.length < 32) { const error = new Error("This shipment confirmation link is invalid."); error.status = 404; throw error; }
  const booking = await Booking.findOne({ confirmationTokenHash: sha(raw), confirmationTokenExpiresAt: { $gt: new Date() } }).select("+confirmationTokenHash");
  if (!booking) { const error = new Error("This confirmation link has expired or is no longer valid. Ask the broker for a new link."); error.status = 410; throw error; }
  if (booking.status === "Cancelled" || booking.shipmentWorkflowStatus === "cancelled") { const error = new Error("This shipment was cancelled. The old confirmation link can no longer be used."); error.status = 409; throw error; }
  if (tokenRequired && !participantRole(booking, req.user)) { const error = new Error("Only the Factory Owner and Transporter associated with this shipment can access this confirmation."); error.status = 403; throw error; }
  return booking;
}
async function populatedBooking(id) {
  return Booking.findById(id).populate("load").populate("truck").populate("factory", "name email phone role").populate("transporter", "name email phone role").populate("broker", "name email phone role").lean();
}

export async function getShipmentConfirmation(req, res, next) {
  try {
    const booking = await authorizedBooking(req);
    if (!booking.pricingSnapshot?.calculatedAt) {
      try { booking.pricingSnapshot = await calculateSnapshot(booking); await booking.save(); }
      catch (e) { if (e.status !== 422) throw e; }
    }
    const result = await populatedBooking(booking._id);
    return res.json({ booking: result, currentParty: participantRole(booking, req.user), termsVersion: booking.termsVersion || SHIPMENT_PRICING.termsVersion, distanceAvailable: Boolean(booking.pricingSnapshot?.distanceKm), distanceMethod: booking.pricingSnapshot?.distanceMethod || "unavailable" });
  } catch (error) { next(error); }
}


export async function updateShipmentCoordinates(req, res, next) {
  try {
    const booking = await authorizedBooking(req), party = participantRole(booking, req.user);
    if (party !== "factory") return res.status(403).json({ message: "Only the Factory Owner can correct pickup and delivery coordinates." });
    if (booking.shipmentPayments?.factory?.status === "paid" || booking.shipmentPayments?.transporter?.status === "paid" || booking.shipmentPayments?.factory?.status === "pending" || booking.shipmentPayments?.transporter?.status === "pending") return res.status(409).json({ message: "Locations cannot be changed after a payment order has been created. Finish or resolve the payment attempt first." });
    const pickup = coordinatePair(req.body?.pickupCoordinates), delivery = coordinatePair(req.body?.deliveryCoordinates);
    if (!pickup || !delivery) return res.status(400).json({ message: "Enter valid latitude (-90 to 90) and longitude (-180 to 180) for both pickup and delivery." });
    const load = await Load.findById(booking.load); if (!load) return res.status(404).json({ message: "Load not found." });
    load.pickupCoordinates = pickup; load.deliveryCoordinates = delivery; await load.save();
    booking.pricingSnapshot = await calculateSnapshot(booking);
    booking.termsAcceptance.factory = { accepted: false, acceptedAt: null, version: null };
    booking.termsAcceptance.transporter = { accepted: false, acceptedAt: null, version: null };
    booking.shipmentWorkflowStatus = "awaiting_factory_confirmation";
    booking.history.push({ action: "coordinates_updated", actor: req.user._id, details: { distanceKm: booking.pricingSnapshot.distanceKm, method: booking.pricingSnapshot.distanceMethod, priorTermsAcceptanceReset: true } }); await booking.save();
    return res.json({ message: "Coordinates saved and distance recalculated.", booking: await populatedBooking(booking._id) });
  } catch (error) { next(error); }
}

export async function acceptShipmentTerms(req, res, next) {
  try {
    const booking = await authorizedBooking(req), party = participantRole(booking, req.user);
    if (req.body?.acceptTerms !== true) return res.status(400).json({ message: "You must accept the LoadSetu Shipment Terms & Conditions before proceeding." });
    if (["confirmed", "cancelled", "completed"].includes(booking.shipmentWorkflowStatus)) return res.status(409).json({ message: "This shipment is no longer accepting confirmations." });
    const snapshot = booking.pricingSnapshot?.calculatedAt ? booking.pricingSnapshot.toObject?.() || booking.pricingSnapshot : await calculateSnapshot(booking);
    const field = `termsAcceptance.${party}`;
    const update = { [field]: { accepted: true, acceptedAt: new Date(), version: SHIPMENT_PRICING.termsVersion }, pricingSnapshot: snapshot, termsVersion: SHIPMENT_PRICING.termsVersion };
    booking.set(update);
    booking.history.push({ action: "terms_accepted", actor: req.user._id, details: { party, version: SHIPMENT_PRICING.termsVersion } });
    const factoryAccepted = party === "factory" || booking.termsAcceptance?.factory?.accepted;
    const transporterAccepted = party === "transporter" || booking.termsAcceptance?.transporter?.accepted;
    booking.shipmentWorkflowStatus = !factoryAccepted ? "awaiting_factory_confirmation" : !transporterAccepted ? "awaiting_transporter_confirmation" : "awaiting_payment";
    await booking.save();
    return res.json({ message: "Terms acceptance saved by the server.", booking: await populatedBooking(booking._id) });
  } catch (error) { next(error); }
}

export async function createShipmentPaymentOrder(req, res, next) {
  try {
    const booking = await authorizedBooking(req), party = participantRole(booking, req.user);
    if (!booking.termsAcceptance?.[party]?.accepted) return res.status(403).json({ message: "Read and accept the Terms & Conditions before payment." });
    if (["confirmed", "cancelled", "completed"].includes(booking.shipmentWorkflowStatus)) return res.status(409).json({ message: "This shipment is not accepting a new payment." });
    const snapshot = booking.pricingSnapshot?.calculatedAt ? booking.pricingSnapshot : await calculateSnapshot(booking);
    const payment = booking.shipmentPayments?.[party];
    if (payment?.status === "paid") return res.status(409).json({ message: "Your payment is already verified." });
    const { client, key_id } = getRazorpay();
    let order;
    if (payment?.status === "pending" && payment.razorpayOrderId) {
      try { order = await client.orders.fetch(payment.razorpayOrderId); } catch { order = null; }
    }
    if (!order) order = await client.orders.create({ amount: (party === "factory" ? snapshot.amountPaiseFactory : snapshot.amountPaiseTransporter), currency: "INR", receipt: `ls_${String(booking._id).slice(-16)}_${party}`.slice(0, 40), notes: { bookingId: String(booking._id), party, termsVersion: booking.termsVersion } });
    booking.pricingSnapshot = snapshot;
    booking.shipmentPayments[party] = { status: "pending", amountPaise: (party === "factory" ? snapshot.amountPaiseFactory : snapshot.amountPaiseTransporter), razorpayOrderId: order.id, razorpayPaymentId: null, paidAt: null };
    booking.history.push({ action: "payment_order_created", actor: req.user._id, details: { party, orderId: order.id, amountPaise: (party === "factory" ? snapshot.amountPaiseFactory : snapshot.amountPaiseTransporter) } });
    await booking.save();
    return res.status(201).json({ keyId: key_id, order: { id: order.id, amount: order.amount, currency: order.currency }, bookingId: String(booking._id), party });
  } catch (error) { next(error); }
}

export async function markShipmentPaymentFailed(req, res, next) {
  try {
    const booking = await authorizedBooking(req), party = participantRole(booking, req.user);
    const orderId = String(req.body?.razorpay_order_id || "");
    if (!orderId) return res.status(400).json({ message: "Payment order ID is required." });
    if (booking.shipmentPayments?.[party]?.razorpayOrderId !== orderId) return res.status(409).json({ message: "This order is not active for your account." });
    const { client } = getRazorpay();
    const orderPayments = await client.orders.fetchPayments(orderId);
    const paymentItems = Array.isArray(orderPayments?.items) ? orderPayments.items : [];
    if (paymentItems.some(item => ["authorized", "captured"].includes(item.status))) return res.status(409).json({ message: "Razorpay reports an authorized or captured payment for this order. Verify payment instead of marking it failed." });
    const update = await Booking.updateOne({ _id: booking._id, [`shipmentPayments.${party}.razorpayOrderId`]: orderId, [`shipmentPayments.${party}.status`]: "pending" }, { $set: { [`shipmentPayments.${party}.status`]: "failed" }, $push: { history: { action: "payment_failed", actor: req.user._id, details: { party, orderId, reason: String(req.body?.reason || "Checkout reported failure").slice(0, 300) }, at: new Date() } } });
    if (!update.modifiedCount) return res.json({ message: "Payment status was already updated; no duplicate failure record was created." });
    return res.json({ message: "Failed payment attempt recorded. You can retry with a new order." });
  } catch (error) { next(error); }
}

export async function verifyShipmentPayment(req, res, next) {
  try {
    const booking = await authorizedBooking(req), party = participantRole(booking, req.user);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ message: "Payment verification details are incomplete." });
    const paymentRecord = booking.shipmentPayments?.[party];
    if (paymentRecord?.status === "paid" && paymentRecord.razorpayPaymentId === paymentId) return res.json({ message: "Payment is already verified.", booking: await populatedBooking(booking._id) });
    if (!paymentRecord || paymentRecord.razorpayOrderId !== orderId || paymentRecord.status !== "pending") return res.status(409).json({ message: "This payment order is not active for your account." });
    const { client, key_secret } = getRazorpay();
    const expected = crypto.createHmac("sha256", key_secret).update(`${orderId}|${paymentId}`).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { paymentRecord.status = "failed"; await booking.save(); return res.status(400).json({ message: "Payment signature is invalid. The shipment has not been confirmed." }); }
    let payment = await client.payments.fetch(paymentId);
    if (String(payment.order_id) !== orderId || Number(payment.amount) !== Number(paymentRecord.amountPaise) || payment.currency !== "INR") return res.status(400).json({ message: "Payment details do not match this shipment order." });
    if (payment.status === "authorized") { try { await client.payments.capture(paymentId, paymentRecord.amountPaise, "INR"); } catch { /* re-fetch below */ } payment = await client.payments.fetch(paymentId); }
    if (payment.status !== "captured") { if (["failed", "refunded"].includes(payment.status)) { paymentRecord.status = "failed"; await booking.save(); } return res.status(409).json({ message: `Payment is not captured (current status: ${payment.status}). Shipment remains unconfirmed.` }); }
    if (Object.values(booking.shipmentPayments || {}).some(p => p?.razorpayPaymentId === paymentId && p !== paymentRecord)) return res.status(409).json({ message: "This payment has already been assigned to another participant." });
    const paymentPath = `shipmentPayments.${party}`;
    const paidAt = new Date();
    const paymentUpdate = await Booking.updateOne(
      { _id: booking._id, [`${paymentPath}.status`]: "pending", [`${paymentPath}.razorpayOrderId`]: orderId },
      { $set: { [`${paymentPath}.status`]: "paid", [`${paymentPath}.razorpayPaymentId`]: paymentId, [`${paymentPath}.paidAt`]: paidAt }, $push: { history: { action: "payment_verified", actor: req.user._id, details: { party, orderId, paymentId, amountPaise: paymentRecord.amountPaise }, at: paidAt } } }
    );
    if (paymentUpdate.modifiedCount !== 1) {
      const current = await Booking.findById(booking._id).lean();
      if (current?.shipmentPayments?.[party]?.status === "paid" && current.shipmentPayments[party].razorpayPaymentId === paymentId) return res.json({ message: "Payment is already verified.", booking: await populatedBooking(booking._id) });
      return res.status(409).json({ message: "This payment was already processed or the order is no longer active." });
    }
    let fresh = await Booking.findById(booking._id);
    const bothAccepted = fresh.termsAcceptance?.factory?.accepted && fresh.termsAcceptance?.transporter?.accepted;
    const bothPaid = fresh.shipmentPayments?.factory?.status === "paid" && fresh.shipmentPayments?.transporter?.status === "paid";
    if (bothPaid && bothAccepted) {
      const confirmed = await Booking.findOneAndUpdate(
        { _id: fresh._id, status: { $nin: ["Cancelled", "Completed"] }, shipmentWorkflowStatus: { $nin: ["confirmed", "cancelled", "completed"] }, "shipmentPayments.factory.status": "paid", "shipmentPayments.transporter.status": "paid", "termsAcceptance.factory.accepted": true, "termsAcceptance.transporter.accepted": true },
        { $set: { status: "Confirmed", shipmentWorkflowStatus: "confirmed", confirmedAt: new Date() }, $push: { history: { action: "shipment_confirmed", actor: req.user._id, details: { reason: "Both participant payments verified" }, at: new Date() } } },
        { new: true }
      );
      if (confirmed) {
        const loadReservation = await Load.findOneAndUpdate({ _id: confirmed.load, status: { $in: ["Open", "Matched", "Booked"] }, withdrawn: { $ne: true } }, { $set: { status: "Booked" } });
        if (!loadReservation) { await Booking.updateOne({ _id: confirmed._id, shipmentWorkflowStatus: "confirmed" }, { $set: { status: "Pending", shipmentWorkflowStatus: "partially_paid", confirmedAt: null } }); return res.status(409).json({ message: "Payment was verified, but the load is no longer available. Shipment was not confirmed; contact the Broker to resolve the booking." }); }
        const confirmedTruck = await Truck.findById(confirmed.truck);
        if (confirmedTruck) {
          if (confirmed.routeLegId && confirmedTruck.routeLegs?.length) { const confirmedLeg = confirmedTruck.routeLegs.id(confirmed.routeLegId); if (confirmedLeg) confirmedLeg.status = "Booked"; confirmedTruck.isAvailable = confirmedTruck.routeLegs.some(leg => leg.status === "Available"); }
          else confirmedTruck.isAvailable = false;
          await confirmedTruck.save();
        }
      }
      fresh = await Booking.findById(booking._id);
    } else {
      fresh.shipmentWorkflowStatus = bothPaid ? "awaiting_payment" : "partially_paid";
      await fresh.save();
    }
    const finalWorkflowStatus = fresh.shipmentWorkflowStatus;
    const details = await populatedBooking(booking._id);
    const receiptBody = `Payment verified for ${party === "factory" ? "Factory Owner" : "Transporter"}.\nShipment ID: ${booking._id}\nPayer: ${party}\nVerified payment amount: ₹${(paymentRecord.amountPaise / 100).toFixed(2)}\nRazorpay order ID: ${orderId}\nRazorpay payment ID: ${paymentId}\nYour payment status: paid\nShipment status: ${finalWorkflowStatus}\n${finalWorkflowStatus === "confirmed" ? "Both parties have accepted and paid. The shipment is confirmed." : "The other participant must still complete their acceptance/payment before the shipment is confirmed."}`;
    await Promise.all([details.factory, details.transporter].filter(person => person?.email).map(person => sendShipmentEmail(person, `LOADSETU payment receipt — ${String(booking._id)}`, receiptBody).catch(err => console.warn("Shipment receipt email failed:", err.message))));
    return res.json({ message: finalWorkflowStatus === "confirmed" ? "Both payments are verified. Shipment confirmed." : "Payment verified. Shipment is waiting for the other participant.", booking: details });
  } catch (error) { next(error); }
}

export async function cancelShipmentEmergency(req, res, next) {
  try {
    const booking = await authorizedBooking(req), party = participantRole(booking, req.user);
    if (booking.shipmentWorkflowStatus !== "confirmed" || booking.status !== "Confirmed") return res.status(409).json({ message: "Emergency cancellation is available only after both participants have paid and the shipment is confirmed." });
    const existing = await Booking.findOneAndUpdate({ _id: booking._id, status: "Confirmed", shipmentWorkflowStatus: "confirmed", "cancellation.cancelledAt": null }, { $set: { status: "Cancelled", shipmentWorkflowStatus: "cancelled", "cancellation.reason": String(req.body?.reason || "Emergency cancellation").slice(0, 300), "cancellation.initiatedBy": req.user._id, "cancellation.initiatedRole": party, "cancellation.cancelledAt": new Date(), "cancellation.forfeitedDepositRupees": roundRupees(booking.pricingSnapshot?.depositRupees || 0), "cancellation.oppositePartyAllocationRupees": roundRupees((booking.pricingSnapshot?.depositRupees || 0) / 2), "cancellation.brokerAllocationRupees": roundRupees((booking.pricingSnapshot?.depositRupees || 0) - roundRupees((booking.pricingSnapshot?.depositRupees || 0) / 2)), "cancellation.settlementStatus": "pending_settlement" } }, { new: true });
    if (!existing) return res.status(409).json({ message: "This shipment has already been cancelled or changed. No duplicate allocation was created." });
    const load = await Load.findById(booking.load), truck = await Truck.findById(booking.truck);
    let loadRestored = false, truckReleased = false;
    if (truck) {
      const otherActiveTruckBooking = await Booking.exists({ _id: { $ne: booking._id }, truck: truck._id, status: { $in: ["Pending", "Confirmed", "In Transit"] } });
      if (!otherActiveTruckBooking) {
        if (booking.routeLegId && truck.routeLegs?.length) { const leg = truck.routeLegs.id(booking.routeLegId); if (leg && ["Pending", "Booked", "In Transit"].includes(leg.status)) leg.status = "Available"; truck.isAvailable = truck.routeLegs.some(item => item.status === "Available"); }
        else truck.isAvailable = true;
        await truck.save(); truckReleased = true;
      }
    }
    if (load && !load.withdrawn && !["Cancelled", "Delivered"].includes(load.status)) { const otherActive = await Booking.exists({ _id: { $ne: booking._id }, load: load._id, status: { $in: ["Pending", "Confirmed", "In Transit"] } }); if (!otherActive) { load.status = "Open"; await load.save(); loadRestored = true; } }
    existing.cancellation.loadRestored = loadRestored; existing.cancellation.truckReleased = truckReleased;
    existing.history.push({ action: "emergency_cancelled", actor: req.user._id, details: { party, loadRestored, truckReleased, settlementStatus: "pending_settlement" } });
    await existing.save();
    const full = await populatedBooking(existing._id);
    const other = party === "factory" ? full.transporter : full.factory;
    const emailBody = `Unfortunately, your shipment has been cancelled due to an emergency.\nShipment/match ID: ${existing._id}\nCancellation status: cancelled\nInitiated by: ${party}\nRoute: ${load?.pickup || "—"} → ${load?.destination || "—"}\nDistance: ${existing.pricingSnapshot?.distanceKm ?? "Unavailable"} km (straight-line estimate)\nDeposit: ₹${existing.pricingSnapshot?.depositRupees ?? "—"}\nBroker commission: ₹${existing.pricingSnapshot?.commissionRupees ?? "—"}\nFactory payment: ${existing.shipmentPayments?.factory?.status || "not_started"} (₹${((existing.shipmentPayments?.factory?.amountPaise || 0) / 100).toFixed(2)}; order ${existing.shipmentPayments?.factory?.razorpayOrderId || "—"}; payment ${existing.shipmentPayments?.factory?.razorpayPaymentId || "—"})\nTransporter payment: ${existing.shipmentPayments?.transporter?.status || "not_started"} (₹${((existing.shipmentPayments?.transporter?.amountPaise || 0) / 100).toFixed(2)}; order ${existing.shipmentPayments?.transporter?.razorpayOrderId || "—"}; payment ${existing.shipmentPayments?.transporter?.razorpayPaymentId || "—"})\nDeposit allocation: ₹${existing.cancellation.oppositePartyAllocationRupees} to opposite party; ₹${existing.cancellation.brokerAllocationRupees} to broker.\nSettlement status: pending settlement; no payout is represented as completed.\nLoad restored: ${loadRestored ? "yes" : "no"}. Truck released: ${truckReleased ? "yes" : "no"}.\nLoadSetu will notify you when another suitable match is found.`;
    const recipients = [full.factory, full.transporter].filter(Boolean);
    await Promise.all(recipients.filter(person => person.email).map(person => sendShipmentEmail(person, `LOADSETU emergency cancellation — ${String(existing._id)}`, emailBody).catch(err => console.warn("Cancellation email failed:", err.message))));
    return res.json({ message: "Shipment cancelled. The deposit allocation is recorded as pending settlement; no payout has been claimed.", booking: full, notification: other?.phone ? { phone: other.phone, message: "Unfortunately, your LoadSetu shipment has been cancelled due to an emergency. The applicable deposit allocation has been recorded according to the accepted cancellation policy. Your eligible load or truck will be made available for a new match where applicable. LoadSetu will notify you when another suitable match is found." } : null });
  } catch (error) { next(error); }
}

export async function createConfirmationLink(booking, brokerId) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  booking.confirmationTokenHash = sha(rawToken);
  booking.confirmationTokenExpiresAt = new Date(Date.now() + SHIPMENT_PRICING.confirmationTokenTtlHours * 60 * 60 * 1000);
  if (brokerId) booking.broker = brokerId;
  booking.termsVersion = SHIPMENT_PRICING.termsVersion;
  booking.shipmentWorkflowStatus = "awaiting_factory_confirmation";
  booking.history.push({ action: "confirmation_link_created", actor: brokerId || null, details: { expiresAt: booking.confirmationTokenExpiresAt } });
  await booking.save();
  return `${getFrontendBaseUrl()}/shipment-confirmation/${rawToken}`;
}
