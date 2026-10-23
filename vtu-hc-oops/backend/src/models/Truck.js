import mongoose from "mongoose";

const routeLegSchema = new mongoose.Schema({
  legType: { type: String, enum: ["OUTWARD", "RETURN"], required: true },
  origin: { type: String, trim: true, maxlength: 160, required: true },
  destination: { type: String, trim: true, maxlength: 160, required: true },
  availableFrom: { type: Date, default: null },
  status: { type: String, enum: ["Available", "Pending", "Booked", "In Transit", "Completed", "Unavailable"], default: "Available" },
}, { timestamps: true });

const truckSchema = new mongoose.Schema({
  transporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  transporterName: { type: String, trim: true, maxlength: 100, default: "" },
  registrationNumber: { type: String, trim: true, uppercase: true, maxlength: 20, required: true },
  truckType: { type: String, required: true, enum: ["Mini truck", "Pickup", "LCV", "Open truck", "Container", "Trailer", "Tipper", "Any suitable truck"] },
  capacityTonnes: { type: Number, required: true, min: 0.1, max: 1000 },
  currentLocation: { type: String, trim: true, maxlength: 160, default: "" },
  serviceAreas: [{ type: String, trim: true, maxlength: 100 }],
  quotedPrice: { type: Number, min: 0, default: null },
  tripType: { type: String, enum: ["ONE_WAY", "ROUND_TRIP"], default: "ONE_WAY", index: true },
  routeLegs: { type: [routeLegSchema], default: [] },
  isAvailable: { type: Boolean, default: true, index: true }
}, { timestamps: true });
truckSchema.index({ transporter: 1, registrationNumber: 1 }, { unique: true });
export default mongoose.model("Truck", truckSchema);
