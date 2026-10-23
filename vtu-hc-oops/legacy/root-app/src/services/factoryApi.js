const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed. Please try again.");
  return data;
}

export const getFactorySummary = () => request("/factory/summary");
export const getMyLoads = () => request("/factory/loads");
export const createFactoryLoad = (body) => request("/factory/loads", { method: "POST", body });
export const getLoadMatches = (id) => request(`/factory/loads/${id}/matches`);
export const confirmFactoryBooking = (id, body) => request(`/factory/loads/${id}/booking`, { method: "POST", body });
export const updateFactoryShipmentStatus = (id, body) => request(`/factory/loads/${id}/status`, { method: "PATCH", body });
