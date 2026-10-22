import Subscription from "../models/Subscription.js";
import Truck from "../models/Truck.js";

export async function requireVerified(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Please log in to continue." });
  if (req.user.role === "broker") return next();
  if (["shipper", "factory", "transporter"].includes(req.user.role) && req.user.verificationStatus !== "VERIFIED") {
    return res.status(403).json({ code: "VERIFICATION_REQUIRED", verificationStatus: req.user.verificationStatus, message: req.user.verificationStatus === "REJECTED" ? `Your verification was rejected. ${req.user.verificationRejectionReason || "Please contact LOADSETU support."}` : "Your account verification is pending. Please wait until the broker verifies your submitted information." });
  }
  next();
}

export async function requireActiveSubscription(req, res, next) {
  try {
    if (!req.user || !["shipper", "factory", "transporter"].includes(req.user.role)) return res.status(403).json({ message: "This action is available to factory owners and transporters." });
    if (req.user.verificationStatus !== "VERIFIED") return res.status(403).json({ code: "VERIFICATION_REQUIRED", message: "Your account must be verified before creating loads or trucks." });
    // Existing truck records can still be updated; only new truck registrations require a subscription.
    if (req.user.role === "transporter" && req.body?.registrationNumber) {
      const existingTruck = await Truck.exists({ transporter: req.user._id, registrationNumber: String(req.body.registrationNumber).trim().toUpperCase() });
      if (existingTruck) return next();
    }
    const subscription = await Subscription.findOne({ user: req.user._id, subscriptionStatus: "ACTIVE", endDate: { $gt: new Date() } }).sort({ endDate: -1 });
    if (!subscription) {
      await Subscription.updateMany({ user: req.user._id, subscriptionStatus: "ACTIVE", endDate: { $lte: new Date() } }, { $set: { subscriptionStatus: "EXPIRED" } });
      return res.status(402).json({ code: "SUBSCRIPTION_REQUIRED", message: "An active LOADSETU subscription is required to create a load or register a truck." });
    }
    req.subscription = subscription;
    next();
  } catch (error) { next(error); }
}
