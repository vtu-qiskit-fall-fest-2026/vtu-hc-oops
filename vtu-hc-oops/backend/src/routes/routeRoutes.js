import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { getRoute } from "../services/routingService.js";

const router = Router();
router.use(requireAuth);
// The free routing/geocoding services have daily quotas; keep one user from draining them.
router.use(rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }));

// GET /api/routes?from=Pune&to=Nashik
router.get("/", async (req, res, next) => {
  try {
    const from = String(req.query.from || "").trim().slice(0, 160);
    const to = String(req.query.to || "").trim().slice(0, 160);
    if (!from || !to) return res.status(400).json({ message: "Give both a 'from' and a 'to' place." });
    return res.json(await getRoute(from, to));
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ message: error.message });
    return next(error);
  }
});

export default router;
