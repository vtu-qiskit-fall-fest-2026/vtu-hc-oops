import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { decideVerification, getVerificationDocument, listVerificationRequests } from "../controllers/verificationController.js";
const router = Router();
router.use(requireAuth);
router.get("/requests", listVerificationRequests);
router.get("/documents/:userId/:kind", getVerificationDocument);
router.patch("/requests/:userId", decideVerification);
export default router;
