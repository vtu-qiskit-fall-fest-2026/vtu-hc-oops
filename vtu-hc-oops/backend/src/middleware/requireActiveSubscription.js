import Subscription from "../models/Subscription.js";

export async function requireActiveSubscription(req, res, next) {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (!["shipper", "factory", "transporter"].includes(role)) {
      return res.status(403).json({ message: "This account cannot create loads or register trucks." });
    }
    if (req.user.verificationStatus && req.user.verificationStatus !== "VERIFIED") {
      return res.status(403).json({ code: "VERIFICATION_REQUIRED", message: "Your account must be verified before this action." });
    }
    const now = new Date();
    const subscription = await Subscription.findOne({
      user: req.user._id,
      subscriptionStatus: "ACTIVE",
      paymentStatus: "SUCCESS",
      endDate: { $gt: now }
    }).sort({ endDate: -1 }).lean();
    if (!subscription) {
      return res.status(402).json({ code: "SUBSCRIPTION_REQUIRED", message: "An active LOADSETU subscription is required before creating a load or registering a truck." });
    }
    req.activeSubscription = subscription;
    next();
  } catch (error) { next(error); }
}
