import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireVerified, requireActiveSubscription } from "../middleware/access.js";
import { createLoad, getMyLoads } from "../controllers/loadController.js";

const router = Router();
router.use(requireAuth, requireVerified);
router.get("/mine", getMyLoads);
router.post("/", requireActiveSubscription, createLoad);
export default router;
