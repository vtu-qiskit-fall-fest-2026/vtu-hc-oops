import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { encryptDocument } from "../services/documentCrypto.js";

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  verificationStatus: user.verificationStatus || "VERIFIED",
  gstin: user.gstin || ""
});

function makeToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

export async function signup(req, res, next) {
  try {
    const { name, email, phone = "", password, role = "broker", gstin = "", aadhaarDocument = "", drivingLicenseDocument = "", aadhaarFileName = "", drivingLicenseFileName = "" } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Please fill in your name, email and password." });
    }
    if (name.trim().length < 2) return res.status(400).json({ message: "Name must have at least 2 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters long." });
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ message: "Use at least one letter and one number in your password." });
    }
    const allowedRoles = ["broker", "transporter", "shipper"];
    if (!allowedRoles.includes(role)) return res.status(400).json({ message: "Choose a valid account type." });

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists. Please log in." });
    }
    const isTransporter = role === "transporter";
    const isFactory = ["shipper", "factory"].includes(role);
    const gst = String(gstin || "").trim().toUpperCase();
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    if (isFactory && !gstPattern.test(gst)) return res.status(400).json({ message: "Enter a valid 15-character GSTIN to register as a factory owner." });
    const validDoc = (value) => {
      if (!value) return false;
      const match = /^data:(application\/pdf|image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/.exec(value);
      return Boolean(match && Buffer.from(match[2], "base64").length <= 3 * 1024 * 1024);
    };
    if (isTransporter && (!validDoc(aadhaarDocument) || !validDoc(drivingLicenseDocument))) return res.status(400).json({ message: "Upload Aadhaar and Driving License as PDF, JPG or PNG files up to 3 MB each." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(), email: normalizedEmail, phone: phone.trim(), passwordHash, role,
      verificationStatus: role === "broker" ? "VERIFIED" : "PENDING_VERIFICATION",
      gstin: isFactory ? gst : "",
      aadhaarDocument: isTransporter ? encryptDocument(aadhaarDocument) : "",
      drivingLicenseDocument: isTransporter ? encryptDocument(drivingLicenseDocument) : "",
      aadhaarFileName: isTransporter ? String(aadhaarFileName).slice(0, 120) : "",
      drivingLicenseFileName: isTransporter ? String(drivingLicenseFileName).slice(0, 120) : "",
      verificationSubmittedAt: role === "broker" ? null : new Date(),
    });
    const message = role === "broker" ? "Your account is ready." : "Your account was created and submitted for broker verification. You can log in after it is approved.";
    return res.status(201).json({ message, token: makeToken(user), user: safeUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) return res.status(400).json({ message: "Enter your email and password." });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    if (user.role !== "broker" && user.verificationStatus !== "VERIFIED") {
      const message = user.verificationStatus === "REJECTED"
        ? `Your account verification was rejected. ${user.verificationRejectionReason || "Please contact LOADSETU support."}`
        : "Your account verification is pending. Please wait until the broker verifies your submitted information.";
      return res.status(403).json({ code: "VERIFICATION_REQUIRED", verificationStatus: user.verificationStatus, message });
    }
    return res.json({ message: "Welcome back.", token: makeToken(user), user: safeUser(user) });
  } catch (error) { next(error); }
}
