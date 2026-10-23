import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createOrder, getMySubscription, getPlans, verifyPayment } from "../controllers/subscriptionController.js";

const router = Router();
router.get("/plans", getPlans);
router.use(requireAuth);
router.get("/me", getMySubscription);
router.post("/orders", createOrder);
router.post("/verify", verifyPayment);
export default router;
