import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["shipper", "factory", "transporter"], required: true },
  plan: { type: String, enum: ["MONTHLY", "HALF_YEARLY", "YEARLY"], required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  currency: { type: String, enum: ["INR"], default: "INR" },
  durationMonths: { type: Number, required: true },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  // No default: a sparse unique index still indexes explicit nulls, so a null default made the
  // second unpaid subscription fail with a duplicate-key error. Absent until payment succeeds.
  razorpayPaymentId: { type: String, unique: true, sparse: true, index: true },
  paymentStatus: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING", index: true },
  subscriptionStatus: { type: String, enum: ["PENDING", "ACTIVE", "EXPIRED", "FAILED"], default: "PENDING", index: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });

subscriptionSchema.index({ user: 1, subscriptionStatus: 1, endDate: -1 });
export default mongoose.model("Subscription", subscriptionSchema);
