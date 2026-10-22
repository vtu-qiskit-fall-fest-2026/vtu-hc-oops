import Load from "../models/Load.js";
import Truck from "../models/Truck.js";
import Booking from "../models/Booking.js";
import { optimizeAssignments } from "../services/assignmentOptimizer.js";
import { requestDelayPredictions } from "../services/delayPredictionService.js";
import { runQuantumComparison } from "../services/quantumClient.js";

const FACTORY_ROLES = new Set(["shipper", "factory"]);
const OPEN_LOAD_STATUSES = ["Open", "Matched"];
const ACTIVE_BOOKING_STATUSES = ["Pending", "Confirmed", "In Transit"];

export function createOptimizationHandlers({
  LoadModel = Load,
  TruckModel = Truck,
  BookingModel = Booking,
  predictDelays = requestDelayPredictions,
  runQuantum = runQuantumComparison,
} = {}) {
  async function getOptimization(req, res, next) {
    try {
      if (!FACTORY_ROLES.has(String(req.user?.role || "").toLowerCase())) {
        return res.status(403).json({ message: "Only factory/goods-owner accounts can run fleet optimization." });
      }
      const factoryId = req.user._id || req.user.id;
      const [loads, trucks, activeAssignments] = await Promise.all([
        LoadModel.find({ factory: factoryId, status: { $in: OPEN_LOAD_STATUSES }, withdrawn: { $ne: true } })
          .sort({ pickupDate: 1, createdAt: 1 }).lean(),
        TruckModel.find({ isAvailable: true }).populate("transporter", "name").lean(),
        BookingModel.find({ status: { $in: ACTIVE_BOOKING_STATUSES } }).select("truck routeLegId status").lean(),
      ]);
      if (loads.length > 12) {
        return res.status(413).json({ message: "Fleet optimization currently supports at most 12 open loads per run. Reduce the open-load set and retry." });
      }
      return res.json(optimizeAssignments({ loads, trucks, activeAssignments }));
    } catch (error) {
      return next(error);
    }
  }

  async function getAiInsights(req, res, next) {
    try {
      if (!FACTORY_ROLES.has(String(req.user?.role || "").toLowerCase())) {
        return res.status(403).json({ message: "Only factory/goods-owner accounts can view AI shipment insights." });
      }
      const factoryId = req.user._id || req.user.id;
      const loads = await LoadModel.find({
        factory: factoryId,
        status: { $in: OPEN_LOAD_STATUSES },
        withdrawn: { $ne: true },
      }).sort({ pickupDate: 1, createdAt: 1 }).lean();
      const insights = await predictDelays(loads);
      const loadsById = new Map(loads.map((load) => [String(load._id || load.id || ""), load]));
      const predictions = insights.predictions.map((prediction) => {
        const load = loadsById.get(prediction.loadId);
        return {
          ...prediction,
          load: load ? {
            title: load.title || load.material || "Load",
            pickup: load.pickup,
            destination: load.destination,
          } : null,
        };
      });
      return res.json({ ...insights, predictions });
    } catch (error) {
      return next(error);
    }
  }

  // Classical exact assignment and QAOA on the identical candidate set, side by side.
  async function getQuantumComparison(req, res, next) {
    try {
      if (!FACTORY_ROLES.has(String(req.user?.role || "").toLowerCase())) {
        return res.status(403).json({ message: "Only factory/goods-owner accounts can run fleet optimization." });
      }
      const mode = req.query.mode === "noisy" ? "noisy" : "ideal";
      const factoryId = req.user._id || req.user.id;
      const [loads, trucks, activeAssignments] = await Promise.all([
        LoadModel.find({ factory: factoryId, status: { $in: OPEN_LOAD_STATUSES }, withdrawn: { $ne: true } })
          .sort({ pickupDate: 1, createdAt: 1 }).lean(),
        TruckModel.find({ isAvailable: true }).populate("transporter", "name").lean(),
        BookingModel.find({ status: { $in: ACTIVE_BOOKING_STATUSES } }).select("truck routeLegId status").lean(),
      ]);
      if (loads.length > 12) {
        return res.status(413).json({ message: "Fleet optimization currently supports at most 12 open loads per run. Reduce the open-load set and retry." });
      }
      const classical = optimizeAssignments({ loads, trucks, activeAssignments });
      const quantum = await runQuantum(classical.candidates, { mode });
      return res.json({
        classical: {
          solver: classical.optimizer.name,
          assignedCount: classical.assignmentCount,
          totalCost: classical.objective.value,
          optimal: classical.optimal,
          runtimeMs: classical.runtimeMs,
          assignments: classical.assignments.map(({ loadId, truckId, cost }) => ({ loadId, truckId, cost })),
        },
        quantum,
        agreement: quantum.status === "ok" && !quantum.problem?.reduced
          ? {
            sameAssignedCount: quantum.quantum.assignedCount === classical.assignmentCount,
            sameTotalCost: Math.abs(quantum.quantum.totalCost - classical.objective.value) < 1e-6,
          }
          : null,
      });
    } catch (error) {
      return next(error);
    }
  }

  return { getOptimization, getAiInsights, getQuantumComparison };
}

const handlers = createOptimizationHandlers();
export const getOptimization = handlers.getOptimization;
export const getAiInsights = handlers.getAiInsights;
export const getQuantumComparison = handlers.getQuantumComparison;
