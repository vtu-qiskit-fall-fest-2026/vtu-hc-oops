import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  verificationStatus: user.verificationStatus || "VERIFIED",
  ...(user.role === "shipper" && user.gstin ? { gstin: user.gstin } : {})
});

function makeToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export async function signup(req, res, next) {
  try {
    const { name, email, phone = "", password, role = "broker" } = req.body;
    const gstin = String(req.body.gstin || "").trim().toUpperCase();
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Please fill in your name, email and password." });
    if (name.trim().length < 2) return res.status(400).json({ message: "Name must have at least 2 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters long." });
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ message: "Use at least one letter and one number in your password." });
    const allowedRoles = ["broker", "transporter", "shipper"];
    if (!allowedRoles.includes(role)) return res.status(400).json({ message: "Choose a valid account type." });
    if (role === "shipper" && !gstinPattern.test(gstin)) return res.status(400).json({ message: "Enter a valid 15-character GSTIN." });
    if (role === "transporter" && (!req.files?.aadhaarDocument?.[0] || !req.files?.drivingLicenseDocument?.[0])) return res.status(400).json({ message: "Upload both Aadhaar Card and Driving License documents." });

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: "An account with this email already exists. Please log in." });
    const passwordHash = await bcrypt.hash(password, 12);
    const isBroker = role === "broker";
    const user = await User.create({
      name: name.trim(), email: normalizedEmail, phone: phone.trim(), passwordHash, role,
      verificationStatus: isBroker ? "VERIFIED" : "PENDING_VERIFICATION",
      gstin: role === "shipper" ? gstin : "",
      verificationDocuments: {
        aadhaar: req.files?.aadhaarDocument?.[0]?.filename || "",
        drivingLicense: req.files?.drivingLicenseDocument?.[0]?.filename || ""
      },
      verificationSubmittedAt: isBroker ? null : new Date(),
      verifiedAt: isBroker ? new Date() : null
    });
    if (!isBroker) return res.status(201).json({ message: "Registration submitted. Your verification is pending broker review. You can log in after your account is verified.", user: safeUser(user), pendingVerification: true });
    return res.status(201).json({ message: "Your account is ready.", token: makeToken(user), user: safeUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    if (error?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Each verification document must be 5 MB or smaller." });
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) return res.status(400).json({ message: "Enter your email and password." });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect." });
    if (user.role !== "broker" && user.verificationStatus === "PENDING_VERIFICATION") return res.status(403).json({ code: "VERIFICATION_PENDING", message: "Your account verification is pending. Please wait until the broker verifies your submitted information." });
    if (user.role !== "broker" && user.verificationStatus === "REJECTED") return res.status(403).json({ code: "VERIFICATION_REJECTED", message: `Your verification was rejected.${user.verificationRejectionReason ? ` Reason: ${user.verificationRejectionReason}` : " Please contact the broker for details."}` });
    return res.json({ message: "Welcome back.", token: makeToken(user), user: safeUser(user) });
  } catch (error) { next(error); }
}
