import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Please log in to continue." });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "This account could not be found." });
    if (user.role !== "broker" && user.verificationStatus === "PENDING_VERIFICATION") {
      return res.status(403).json({ code: "VERIFICATION_PENDING", message: "Your account verification is pending. Please wait until the broker verifies your submitted information." });
    }
    if (user.role !== "broker" && user.verificationStatus === "REJECTED") {
      return res.status(403).json({ code: "VERIFICATION_REJECTED", message: `Your verification was rejected.${user.verificationRejectionReason ? ` Reason: ${user.verificationRejectionReason}` : " Please contact the broker for details."}` });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
}
