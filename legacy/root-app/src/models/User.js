import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 70 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, trim: true, default: "", maxlength: 20 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["broker", "transporter", "shipper", "factory"], default: "broker" },
  // Existing accounts remain compatible; signup explicitly sets non-broker accounts to PENDING_VERIFICATION.
  verificationStatus: { type: String, enum: ["PENDING_VERIFICATION", "VERIFIED", "REJECTED"], default: "VERIFIED", index: true },
  gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: "" },
  aadhaarDocument: { type: String, select: false, default: "" },
  drivingLicenseDocument: { type: String, select: false, default: "" },
  aadhaarFileName: { type: String, default: "" },
  drivingLicenseFileName: { type: String, default: "" },
  verificationSubmittedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verificationRejectionReason: { type: String, maxlength: 500, default: "" }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
