import crypto from "node:crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";

export const PLANS = Object.freeze({
  MONTHLY: { id: "MONTHLY", name: "Monthly", amountPaise: 29900, durationMonths: 1 },
  HALF_YEARLY: { id: "HALF_YEARLY", name: "Half-Yearly", amountPaise: 59900, durationMonths: 6 },
  YEARLY: { id: "YEARLY", name: "Yearly", amountPaise: 99900, durationMonths: 12 }
});

function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    const error = new Error("Razorpay Test Mode is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.");
    error.status = 503;
    throw error;
  }
  return { client: new Razorpay({ key_id, key_secret }), key_id, key_secret };
}

function isEligibleRole(role) { return ["shipper", "factory", "transporter"].includes(String(role || "").toLowerCase()); }
function isVerified(user) { return String(user?.verificationStatus || "VERIFIED") === "VERIFIED"; }
function addCalendarMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export async function getPlans(_req, res) {
  res.json({ plans: Object.values(PLANS).map(p => ({ ...p, amount: p.amountPaise / 100, currency: "INR" })) });
}

export async function getMySubscription(req, res, next) {
  try {
    const now = new Date();
    await Subscription.updateMany({ user: req.user._id, subscriptionStatus: "ACTIVE", endDate: { $lte: now } }, { $set: { subscriptionStatus: "EXPIRED" } });
    const subscription = await Subscription.findOne({ user: req.user._id, paymentStatus: "SUCCESS", subscriptionStatus: "ACTIVE", endDate: { $gt: now } }).sort({ endDate: -1 }).lean();
    if (!subscription) {
      const latest = await Subscription.findOne({ user: req.user._id }).sort({ createdAt: -1 }).lean();
      return res.json({ active: false, subscription: latest && latest.endDate && new Date(latest.endDate) <= now ? { ...latest, subscriptionStatus: "EXPIRED" } : latest || null });
    }
    return res.json({ active: true, subscription });
  } catch (error) { next(error); }
}

export async function createOrder(req, res, next) {
  try {
    if (!isEligibleRole(req.user.role) || req.user.role === "broker") return res.status(403).json({ message: "Subscriptions are available to factory owners and transporters only." });
    if (!isVerified(req.user)) return res.status(403).json({ code: "VERIFICATION_REQUIRED", message: "Your account must be verified before purchasing a subscription." });
    const plan = PLANS[String(req.body?.plan || "")];
    if (!plan) return res.status(400).json({ message: "Choose one of the supported subscription plans." });
    const active = await Subscription.findOne({ user: req.user._id, subscriptionStatus: "ACTIVE", paymentStatus: "SUCCESS", endDate: { $gt: new Date() } }).lean();
    if (active) return res.status(409).json({ code: "SUBSCRIPTION_ACTIVE", message: "You already have an active subscription.", subscription: active });
    const { client, key_id } = getRazorpay();
    const receipt = `ls_${req.user._id.toString().slice(-10)}_${crypto.randomBytes(6).toString("hex")}`;
    const order = await client.orders.create({ amount: plan.amountPaise, currency: "INR", receipt, notes: { userId: req.user._id.toString(), role: req.user.role, plan: plan.id } });
    await Subscription.create({ user: req.user._id, role: req.user.role, plan: plan.id, amountPaise: plan.amountPaise, durationMonths: plan.durationMonths, razorpayOrderId: order.id, paymentStatus: "PENDING", subscriptionStatus: "PENDING" });
    return res.status(201).json({ keyId: key_id, orderId: order.id, amount: order.amount, currency: order.currency, plan: { id: plan.id, name: plan.name, durationMonths: plan.durationMonths, amount: plan.amountPaise / 100 }, prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || undefined } });
  } catch (error) { next(error); }
}

export async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ message: "Payment verification details are incomplete." });
    const record = await Subscription.findOne({ razorpayOrderId: orderId, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Payment order not found for this account." });
    if (record.paymentStatus === "SUCCESS" && record.razorpayPaymentId === paymentId && record.subscriptionStatus === "ACTIVE" && record.endDate > new Date()) return res.json({ message: "Subscription is already active.", active: true, subscription: record });
    if (record.razorpayPaymentId && record.razorpayPaymentId !== paymentId) return res.status(409).json({ message: "This order has already been associated with a different payment." });
    const { client, key_secret } = getRazorpay();
    const expected = crypto.createHmac("sha256", key_secret).update(`${orderId}|${paymentId}`).digest("hex");
    const a = Buffer.from(expected); const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: "Payment signature is invalid. The subscription has not been activated." });
    let payment = await client.payments.fetch(paymentId);
    if (String(payment.order_id) !== orderId || Number(payment.amount) !== record.amountPaise || payment.currency !== "INR") return res.status(400).json({ message: "Payment details do not match the selected order." });
    if (payment.status === "authorized") {
      try { await client.payments.capture(paymentId, record.amountPaise, "INR"); } catch (captureError) {
        payment = await client.payments.fetch(paymentId);
        if (payment.status !== "captured") return res.status(409).json({ message: "Payment is authorized but not captured yet. Please retry verification shortly." });
      }
      payment = await client.payments.fetch(paymentId);
    }
    if (payment.status !== "captured") {
      if (["failed", "refunded"].includes(payment.status)) {
        record.paymentStatus = "FAILED"; record.subscriptionStatus = "FAILED"; await record.save();
      }
      return res.status(409).json({ message: `Payment is not captured (current status: ${payment.status}). Subscription remains inactive.` });
    }
    if (record.subscriptionStatus === "ACTIVE" && record.razorpayPaymentId !== paymentId) return res.status(409).json({ message: "This order has already activated a subscription." });
    const start = new Date(); const end = addCalendarMonths(start, record.durationMonths);
    const activated = await Subscription.findOneAndUpdate(
      { _id: record._id, paymentStatus: { $ne: "SUCCESS" }, $or: [{ razorpayPaymentId: null }, { razorpayPaymentId: paymentId }] },
      { $set: { razorpayPaymentId: paymentId, paymentStatus: "SUCCESS", subscriptionStatus: "ACTIVE", startDate: start, endDate: end, verifiedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!activated) {
      const current = await Subscription.findById(record._id).lean();
      if (current?.paymentStatus === "SUCCESS" && current.razorpayPaymentId === paymentId && current.subscriptionStatus === "ACTIVE") return res.json({ message: "Subscription is already active.", active: true, subscription: current });
      return res.status(409).json({ message: "This order has already been used or verified by another payment attempt." });
    }
    return res.json({ message: "Payment verified and subscription activated.", active: true, subscription: activated });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "This payment has already been recorded." });
    next(error);
  }
}
