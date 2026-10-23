import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createLoad, getMyLoads } from "../controllers/loadController.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import * as optimization from "../controllers/optimizationController.js";

// A factory so tests can inject auth and handlers; the app uses the default export.
export function createLoadRouter({
  authMiddleware = requireAuth,
  subscriptionMiddleware = requireActiveSubscription,
  optimizationHandlers = optimization,
} = {}) {
  const router = Router();
  router.use(authMiddleware);
  router.get("/mine", getMyLoads);
  router.post("/", subscriptionMiddleware, createLoad);
  router.get("/optimization", optimizationHandlers.getOptimization);
  router.get("/optimization/quantum", optimizationHandlers.getQuantumComparison);
  router.get("/ai-insights", optimizationHandlers.getAiInsights);
  return router;
}

export default createLoadRouter();
