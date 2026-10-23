import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 70 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, trim: true, default: "", maxlength: 20 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["broker", "transporter", "shipper"], default: "broker" },
  verificationStatus: { type: String, enum: ["PENDING_VERIFICATION", "VERIFIED", "REJECTED"], default: "VERIFIED", index: true },
  gstin: { type: String, trim: true, uppercase: true, select: false, default: "" },
  verificationDocuments: {
    aadhaar: { type: String, select: false, default: "" },
    drivingLicense: { type: String, select: false, default: "" }
  },
  verificationSubmittedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verificationRejectionReason: { type: String, trim: true, maxlength: 500, default: "" }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
