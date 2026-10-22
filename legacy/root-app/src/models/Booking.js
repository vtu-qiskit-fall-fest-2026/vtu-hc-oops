import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  load: { type: mongoose.Schema.Types.ObjectId, ref: "Load", required: true, index: true },
  truck: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", required: true },
  routeLegId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  factory: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  transporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  agreedPrice: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["Pending", "Confirmed", "Rejected", "In Transit", "Cancelled", "Completed"], default: "Pending", index: true },
  liveLocation: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    updatedAt: { type: Date },
  },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
  respondedAt: { type: Date },
  confirmedAt: { type: Date }
}, { timestamps: true });

bookingSchema.index({ factory: 1, createdAt: -1 });
bookingSchema.index({ transporter: 1, createdAt: -1 });
export default mongoose.model("Booking", bookingSchema);
