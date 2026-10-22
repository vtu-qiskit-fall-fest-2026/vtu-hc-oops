import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createLoad, getMyLoads, getMatches, confirmBooking, updateShipmentStatus, getFactorySummary } from "../controllers/factoryController.js";

const router = Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(requireAuth);
router.use((req, res, next) => {
  // Existing signup flow uses "shipper" for factory accounts.
  if (req.user.role !== "shipper") return res.status(403).json({ message: "Factory panel access is available to factory/shipper accounts only." });
  next();
});
router.get("/summary", asyncRoute(getFactorySummary));
router.get("/loads", asyncRoute(getMyLoads));
router.post("/loads", asyncRoute(createLoad));
router.get("/loads/:id/matches", asyncRoute(getMatches));
router.post("/loads/:id/booking", asyncRoute(confirmBooking));
router.patch("/loads/:id/status", asyncRoute(updateShipmentStatus));
export default router;
