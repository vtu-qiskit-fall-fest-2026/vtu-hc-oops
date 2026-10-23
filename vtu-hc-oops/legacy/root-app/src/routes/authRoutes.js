import { Router } from "express";
import { login, signup } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, phone: req.user.phone, role: req.user.role, verificationStatus: req.user.verificationStatus, gstin: req.user.gstin || "" } });
});
export default router;
