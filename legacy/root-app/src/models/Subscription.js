import mongoose from "mongoose";
const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["shipper", "factory", "transporter"], required: true },
  plan: { type: String, enum: ["MONTHLY", "HALF_YEARLY", "YEARLY"], required: true },
  amount: { type: Number, required: true },
  durationMonths: { type: Number, required: true },
  razorpayOrderId: { type: String, default: "", index: true },
  razorpayPaymentId: { type: String, default: "" },
  paymentStatus: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
  subscriptionStatus: { type: String, enum: ["PENDING", "ACTIVE", "EXPIRED", "FAILED"], default: "PENDING", index: true },
  startDate: { type: Date, default: null }, endDate: { type: Date, default: null },
}, { timestamps: true });
subscriptionSchema.index({ user: 1, subscriptionStatus: 1, endDate: -1 });
export default mongoose.model("Subscription", subscriptionSchema);
