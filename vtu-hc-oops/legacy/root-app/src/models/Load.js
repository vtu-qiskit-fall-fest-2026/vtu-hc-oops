import mongoose from "mongoose";

const loadSchema = new mongoose.Schema({
  factory: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  pickup: { type: String, required: true, trim: true, maxlength: 160 },
  destination: { type: String, required: true, trim: true, maxlength: 160 },
  material: { type: String, required: true, trim: true, maxlength: 100 },
  weightTonnes: { type: Number, required: true, min: 0.1, max: 1000 },
  truckType: { type: String, required: true, enum: ["Any suitable truck", "Mini truck", "Pickup", "LCV", "Open truck", "Container", "Trailer", "Tipper"] },
  pickupDate: { type: Date, required: true },
  offeredPrice: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  status: { type: String, enum: ["Open", "Matched", "Booked", "In Transit", "Delivered", "Cancelled"], default: "Open", index: true }
}, { timestamps: true });

loadSchema.index({ factory: 1, createdAt: -1 });
export default mongoose.model("Load", loadSchema);
