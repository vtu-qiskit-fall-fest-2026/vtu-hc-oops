import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createBooking, getMyBookings } from "../controllers/bookingController.js";

const router = Router();
router.use(requireAuth);
router.get("/mine", getMyBookings);
router.post("/", createBooking);
export default router;
