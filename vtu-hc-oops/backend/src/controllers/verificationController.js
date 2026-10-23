import path from "node:path";
import fs from "node:fs";
import User from "../models/User.js";
import { privateDirectory } from "../middleware/verificationUpload.js";
import { sendVerificationEmail } from "../services/emailService.js";

const isBroker = user => String(user?.role || "").toLowerCase() === "broker";

export async function listVerificationRequests(req, res, next) {
  try {
    if (!isBroker(req.user)) return res.status(403).json({ message: "Broker access only." });
    const users = await User.find({ role: { $in: ["shipper", "transporter"] }, verificationStatus: { $in: ["PENDING_VERIFICATION", "REJECTED"] } })
      .select("name email phone role verificationStatus verificationSubmittedAt verifiedAt verificationRejectionReason createdAt +gstin +verificationDocuments.aadhaar +verificationDocuments.drivingLicense")
      .sort({ verificationSubmittedAt: 1, createdAt: 1 }).lean();
    return res.json({ requests: users.map(user => ({
      id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role,
      verificationStatus: user.verificationStatus || "VERIFIED", gstin: user.role === "shipper" ? user.gstin : undefined,
      documents: { aadhaarAvailable: Boolean(user.verificationDocuments?.aadhaar), drivingLicenseAvailable: Boolean(user.verificationDocuments?.drivingLicense) },
      verificationSubmittedAt: user.verificationSubmittedAt || user.createdAt,
      verificationRejectionReason: user.verificationRejectionReason || ""
    })) });
  } catch (error) { next(error); }
}

export async function viewVerificationDocument(req, res, next) {
  try {
    if (!isBroker(req.user)) return res.status(403).json({ message: "Broker access only." });
    const user = await User.findById(req.params.userId).select("role +verificationDocuments.aadhaar +verificationDocuments.drivingLicense");
    if (!user || !["shipper", "transporter"].includes(user.role)) return res.status(404).json({ message: "Verification request not found." });
    const key = req.params.documentType === "aadhaar" ? "aadhaar" : req.params.documentType === "driving-license" ? "drivingLicense" : null;
    if (!key) return res.status(400).json({ message: "Unknown document type." });
    const filename = user.verificationDocuments?.[key];
    if (!filename || path.basename(filename) !== filename) return res.status(404).json({ message: "Document not available." });
    const absolutePath = path.join(privateDirectory, filename);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ message: "The stored document file is missing. Ask the transporter to upload it again." });
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(absolutePath, { dotfiles: "deny" }, error => { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
}

export async function updateVerificationStatus(req, res, next) {
  try {
    if (!isBroker(req.user)) return res.status(403).json({ message: "Broker access only." });
    const status = String(req.body?.status || "");
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    if (!["VERIFIED", "REJECTED"].includes(status)) return res.status(400).json({ message: "Choose Verify or Reject." });
    const user = await User.findOne({ _id: req.params.userId, role: { $in: ["shipper", "transporter"] } });
    if (!user) return res.status(404).json({ message: "Verification request not found." });
    user.verificationStatus = status;
    user.verifiedAt = status === "VERIFIED" ? new Date() : null;
    user.verifiedBy = req.user._id;
    user.verificationRejectionReason = status === "REJECTED" ? reason : "";
    await user.save();
    let emailSent = false;
    let emailMessage = "";
    if (status === "VERIFIED") {
      try { const result = await sendVerificationEmail(user); emailSent = result.sent; if (!emailSent) emailMessage = "SMTP is not configured; verification was saved, but email was not sent."; }
      catch (emailError) { console.error("Verification email delivery failed after status update."); emailMessage = "Verification was saved, but email delivery failed. Check SMTP configuration."; }
    }
    return res.json({ message: status === "VERIFIED" ? "User verified." : "User verification rejected.", emailSent, emailMessage, user: { id: user._id, name: user.name, role: user.role, verificationStatus: user.verificationStatus } });
  } catch (error) { next(error); }
}
