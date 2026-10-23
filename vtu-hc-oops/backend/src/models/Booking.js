import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  load: { type: mongoose.Schema.Types.ObjectId, ref: "Load", required: true, index: true },
  truck: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", required: true },
  routeLegId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  factory: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  transporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  broker: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  agreedPrice: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["Pending", "Confirmed", "Rejected", "In Transit", "Cancelled", "Completed"], default: "Pending", index: true },
  liveLocation: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    updatedAt: { type: Date },
  },
  factoryReview: { rating: { type: Number, min: 1, max: 5 }, comment: { type: String, trim: true, maxlength: 1000, default: "" }, createdAt: Date },
  transporterReview: { rating: { type: Number, min: 1, max: 5 }, comment: { type: String, trim: true, maxlength: 1000, default: "" }, createdAt: Date },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
  respondedAt: { type: Date },
  confirmedAt: { type: Date },
  confirmationTokenHash: { type: String, default: null, select: false, index: true },
  confirmationTokenExpiresAt: { type: Date, default: null },
  shipmentWorkflowStatus: { type: String, enum: ["awaiting_factory_confirmation", "awaiting_transporter_confirmation", "awaiting_payment", "partially_paid", "confirmed", "cancelled", "completed"], default: "awaiting_factory_confirmation", index: true },
  pricingSnapshot: {
    distanceKm: { type: Number, default: null },
    distanceMethod: { type: String, default: "unavailable" },
    depositRatePerKm: { type: Number, default: 5 },
    depositRupees: { type: Number, default: null },
    commissionRatePerKm: { type: Number, default: 3 },
    commissionRupees: { type: Number, default: null },
    otherChargesRupees: { type: Number, default: 0 },
    totalPerPartyRupees: { type: Number, default: null },
    totalFactoryPayableRupees: { type: Number, default: null },
    totalTransporterPayableRupees: { type: Number, default: null },
    amountPaisePerParty: { type: Number, default: null },
    amountPaiseFactory: { type: Number, default: null },
    amountPaiseTransporter: { type: Number, default: null },
    calculatedAt: { type: Date, default: null }
  },
  termsVersion: { type: String, default: "LOADSETU-SHIPMENT-TERMS-1.0" },
  termsAcceptance: {
    factory: { accepted: { type: Boolean, default: false }, acceptedAt: { type: Date, default: null }, version: { type: String, default: null } },
    transporter: { accepted: { type: Boolean, default: false }, acceptedAt: { type: Date, default: null }, version: { type: String, default: null } }
  },
  shipmentPayments: {
    factory: { status: { type: String, enum: ["not_started", "pending", "paid", "failed", "cancelled"], default: "not_started" }, amountPaise: { type: Number, default: null }, razorpayOrderId: { type: String, default: null }, razorpayPaymentId: { type: String, default: null }, paidAt: { type: Date, default: null } },
    transporter: { status: { type: String, enum: ["not_started", "pending", "paid", "failed", "cancelled"], default: "not_started" }, amountPaise: { type: Number, default: null }, razorpayOrderId: { type: String, default: null }, razorpayPaymentId: { type: String, default: null }, paidAt: { type: Date, default: null } }
  },
  cancellation: {
    reason: { type: String, default: "" },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    initiatedRole: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    forfeitedDepositRupees: { type: Number, default: 0 },
    oppositePartyAllocationRupees: { type: Number, default: 0 },
    brokerAllocationRupees: { type: Number, default: 0 },
    settlementStatus: { type: String, enum: ["not_applicable", "pending_settlement", "pending_review"], default: "not_applicable" },
    loadRestored: { type: Boolean, default: false },
    truckReleased: { type: Boolean, default: false }
  },
  history: [{ action: { type: String, required: true }, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, details: { type: mongoose.Schema.Types.Mixed, default: {} }, at: { type: Date, default: Date.now } }]
}, { timestamps: true });

bookingSchema.index({ factory: 1, createdAt: -1 });
bookingSchema.index({ transporter: 1, createdAt: -1 });
export default mongoose.model("Booking", bookingSchema);
