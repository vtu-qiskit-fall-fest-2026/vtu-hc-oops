import crypto from "node:crypto";
import Subscription from "../models/Subscription.js";

const PLANS = {
  MONTHLY: { name: "Monthly", amount: 29900, rupees: 299, durationMonths: 1 },
  HALF_YEARLY: { name: "Half-Yearly", amount: 59900, rupees: 599, durationMonths: 6 },
  YEARLY: { name: "Yearly", amount: 99900, rupees: 999, durationMonths: 12 },
};
const supported = ["shipper", "factory", "transporter"];
const activeFor = userId => Subscription.findOne({ user: userId, subscriptionStatus: "ACTIVE", endDate: { $gt: new Date() } }).sort({ endDate: -1 }).lean();

export async function getMySubscription(req, res, next) {
  try {
    const [active, latest] = await Promise.all([activeFor(req.user._id), Subscription.findOne({ user: req.user._id }).sort({ createdAt: -1 }).lean()]);
    res.json({ active: Boolean(active), subscription: active || latest || null, plans: Object.entries(PLANS).map(([id,p]) => ({ id, name:p.name, amount:p.rupees, durationMonths:p.durationMonths })) });
  } catch (e) { next(e); }
}

export async function createSubscriptionOrder(req, res, next) {
  try {
    if (!supported.includes(req.user.role) || req.user.role === "broker") return res.status(403).json({ message: "Subscriptions are available to factory owners and transporters." });
    if (req.user.verificationStatus !== "VERIFIED") return res.status(403).json({ code: "VERIFICATION_REQUIRED", message: "Your account must be verified before subscribing." });
    const plan = PLANS[req.body?.plan];
    if (!plan) return res.status(400).json({ message: "Choose one of the available subscription plans." });
    const existing = await activeFor(req.user._id);
    if (existing) return res.status(409).json({ message: "You already have an active subscription.", subscription: existing });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: "Online payments are not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env." });
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: plan.amount, currency: "INR", receipt: `ls_${req.user._id}_${Date.now()}` }) });
    const order = await response.json();
    if (!response.ok) return res.status(502).json({ message: order.error?.description || "Unable to create a payment order." });
    const record = await Subscription.create({ user: req.user._id, role: req.user.role, plan: req.body.plan, amount: plan.rupees, durationMonths: plan.durationMonths, razorpayOrderId: order.id, paymentStatus: "PENDING", subscriptionStatus: "PENDING" });
    res.status(201).json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency, subscriptionId: record._id, plan: plan.name, user: { name: req.user.name, email: req.user.email, phone: req.user.phone } });
  } catch (e) { next(e); }
}

export async function verifySubscriptionPayment(req, res, next) {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every(v => typeof v === "string" && v.length)) return res.status(400).json({ message: "Payment verification details are incomplete." });
    const subscription = await Subscription.findOne({ user: req.user._id, razorpayOrderId: orderId });
    if (!subscription) return res.status(404).json({ message: "Payment order not found for this account." });
    if (subscription.subscriptionStatus === "ACTIVE" && subscription.razorpayPaymentId === paymentId) return res.json({ message: "Subscription is already active.", subscription });
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${orderId}|${paymentId}`).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(signature);
    if (!process.env.RAZORPAY_KEY_SECRET || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: "Payment signature could not be verified." });
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + subscription.durationMonths);
    subscription.razorpayPaymentId = paymentId;
    subscription.paymentStatus = "SUCCESS";
    subscription.subscriptionStatus = "ACTIVE";
    subscription.startDate = start;
    subscription.endDate = end;
    await subscription.save();
    res.json({ message: "Payment verified. Your subscription is now active.", subscription });
  } catch (e) { next(e); }
}

export async function failSubscriptionPayment(req, res, next) {
  try {
    const { subscriptionId } = req.body || {};
    const subscription = await Subscription.findOne({ _id: subscriptionId, user: req.user._id, subscriptionStatus: "PENDING" });
    if (subscription) { subscription.paymentStatus = "FAILED"; subscription.subscriptionStatus = "FAILED"; await subscription.save(); }
    res.json({ message: "Payment attempt recorded. You can choose a plan and retry." });
  } catch (e) { next(e); }
}
