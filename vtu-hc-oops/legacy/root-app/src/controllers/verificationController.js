import mongoose from "mongoose";
import User from "../models/User.js";
import { sendEmail } from "../services/notifications.js";
import { decryptDocument } from "../services/documentCrypto.js";

const publicUser = user => ({ id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, gstin: user.gstin || "", verificationStatus: user.verificationStatus, verificationSubmittedAt: user.verificationSubmittedAt, verifiedAt: user.verifiedAt, verificationRejectionReason: user.verificationRejectionReason || "" });

export async function listVerificationRequests(req, res, next) {
  try {
    if (String(req.user?.role || "").toLowerCase() !== "broker") return res.status(403).json({ message: "Broker access only." });
    const users = await User.find({ role: { $in: ["shipper", "factory", "transporter"] }, verificationStatus: { $in: ["PENDING_VERIFICATION", "REJECTED"] } }).select("name email phone role gstin verificationStatus verificationSubmittedAt verifiedAt verificationRejectionReason aadhaarFileName drivingLicenseFileName createdAt").sort({ verificationSubmittedAt: 1 }).lean();
    res.json({ requests: users.map(publicUser) });
  } catch (e) { next(e); }
}

export async function getVerificationDocument(req, res, next) {
  try {
    if (String(req.user?.role || "").toLowerCase() !== "broker") return res.status(403).json({ message: "Broker access only." });
    if (!mongoose.isValidObjectId(req.params.userId) || !["aadhaar", "driving-license"].includes(req.params.kind)) return res.status(400).json({ message: "Invalid document request." });
    const fields = req.params.kind === "aadhaar" ? "+aadhaarDocument aadhaarFileName" : "+drivingLicenseDocument drivingLicenseFileName";
    const user = await User.findById(req.params.userId).select(fields);
    if (!user || user.role !== "transporter") return res.status(404).json({ message: "Verification document not found." });
    const stored = req.params.kind === "aadhaar" ? user.aadhaarDocument : user.drivingLicenseDocument;
    const raw = decryptDocument(stored);
    if (!raw) return res.status(404).json({ message: "Document was not submitted." });
    const match = /^data:(application\/pdf|image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/.exec(raw);
    if (!match) return res.status(422).json({ message: "Stored document format is invalid." });
    const buffer = Buffer.from(match[2], "base64");
    res.set({ "Content-Type": match[1] === "image/jpg" ? "image/jpeg" : match[1], "Content-Disposition": `inline; filename="${req.params.kind}.file"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" });
    res.send(buffer);
  } catch (e) { next(e); }
}

export async function decideVerification(req, res, next) {
  try {
    if (String(req.user?.role || "").toLowerCase() !== "broker") return res.status(403).json({ message: "Broker access only." });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID." });
    const { decision, reason = "" } = req.body || {};
    if (!["VERIFY", "REJECT"].includes(decision)) return res.status(400).json({ message: "Choose verify or reject." });
    const user = await User.findById(req.params.userId);
    if (!user || !["shipper", "factory", "transporter"].includes(user.role)) return res.status(404).json({ message: "Factory owner or transporter account not found." });
    if (decision === "VERIFY" && user.role === "transporter" && (!user.aadhaarDocument || !user.drivingLicenseDocument)) return res.status(409).json({ message: "Both Aadhaar and Driving License documents are required." });
    if (decision === "VERIFY" && ["shipper", "factory"].includes(user.role) && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(user.gstin || "")) return res.status(409).json({ message: "A valid GSTIN is required before verification." });
    user.verificationStatus = decision === "VERIFY" ? "VERIFIED" : "REJECTED";
    user.verificationRejectionReason = decision === "REJECT" ? String(reason).trim().slice(0, 500) : "";
    user.verifiedAt = decision === "VERIFY" ? new Date() : null;
    user.verifiedBy = req.user._id;
    await user.save();
    if (decision === "VERIFY") {
      const transporter = user.role === "transporter";
      await sendEmail({ to: user.email, subject: transporter ? "LoadSetu – Your Documents Have Been Verified" : "LoadSetu – Your Business Verification Is Complete", text: `Dear ${user.name},\n\nCongratulations!\n\nYour ${transporter ? "identity documents" : "business verification"} have been successfully verified by LoadSetu. Your account is now verified and you can continue using the platform.\n\nYou can now log in using your registered email address.\n\nThank you for choosing LoadSetu.\nEvery Load Finds Its Match.` });
    }
    res.json({ message: decision === "VERIFY" ? "User verified. Verification email was attempted if SMTP is configured." : "Verification request rejected.", user: publicUser(user) });
  } catch (e) { next(e); }
}
