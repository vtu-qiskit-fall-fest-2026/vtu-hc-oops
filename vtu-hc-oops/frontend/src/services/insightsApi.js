const API_URL = import.meta.env.VITE_API_URL || "/api";

async function get(path) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

export const getAssignmentOptimization = () => get("/loads/optimization");
export const getAiInsights = () => get("/loads/ai-insights");
// Runs QAOA on the same candidates as the classical optimizer; takes ~5-15 s.
export const getQuantumComparison = (mode = "ideal") => get(`/loads/optimization/quantum?mode=${encodeURIComponent(mode)}`);
