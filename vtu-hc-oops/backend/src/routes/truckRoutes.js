import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getTruckMatches, upsertMyTruck } from "../controllers/truckController.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
const router = Router();
router.use(requireAuth);
router.get("/matches", getTruckMatches);
router.post("/profile", requireActiveSubscription, upsertMyTruck);
export default router;
