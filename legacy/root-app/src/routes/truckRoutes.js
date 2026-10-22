import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireVerified, requireActiveSubscription } from "../middleware/access.js";
import { getTruckMatches, upsertMyTruck } from "../controllers/truckController.js";
const router = Router();
router.use(requireAuth, requireVerified);
router.get("/matches", getTruckMatches);
router.post("/profile", requireActiveSubscription, upsertMyTruck);
export default router;
