// Calls the Python QAOA service (quantum/qlogistics/service.py) with the same candidate
// load→truck options the classical optimizer used, so the two answers are comparable.

const DEFAULT_URL = "http://127.0.0.1:8000";

export async function runQuantumComparison(candidates, {
  mode = "ideal",
  baseUrl = process.env.QUANTUM_SERVICE_URL || DEFAULT_URL,
  fetchImpl = fetch,
  timeoutMs = 120_000,
} = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { status: "skipped", reason: "No eligible load–truck pairs to optimise." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        options: candidates.map((c) => ({ loadId: c.loadId, truckId: c.truckId, cost: c.cost })),
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { status: "error", reason: data?.detail || `Quantum service returned HTTP ${res.status}.` };
    return { status: "ok", ...data };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error?.name === "AbortError"
        ? "The quantum service took too long to answer."
        : "The quantum service is not running. Start it with `npm run quantum` (see README).",
    };
  } finally {
    clearTimeout(timer);
  }
}
