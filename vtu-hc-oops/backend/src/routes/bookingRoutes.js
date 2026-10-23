import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createBooking, getMyBookings, submitBookingReview } from "../controllers/bookingController.js";
import { getShipmentConfirmation, acceptShipmentTerms, createShipmentPaymentOrder, verifyShipmentPayment, markShipmentPaymentFailed, cancelShipmentEmergency, updateShipmentCoordinates } from "../controllers/shipmentConfirmationController.js";

const router = Router();
router.use(requireAuth);
router.get("/mine", getMyBookings);
router.get("/confirmation/:token", getShipmentConfirmation);
router.post("/confirmation/:token/terms", acceptShipmentTerms);
router.post("/confirmation/:token/coordinates", updateShipmentCoordinates);
router.post("/confirmation/:token/payment/order", createShipmentPaymentOrder);
router.post("/confirmation/:token/payment/verify", verifyShipmentPayment);
router.post("/confirmation/:token/payment/failed", markShipmentPaymentFailed);
router.post("/confirmation/:token/cancel", cancelShipmentEmergency);
router.post("/:bookingId/review", submitBookingReview);
router.post("/", createBooking);
export default router;
