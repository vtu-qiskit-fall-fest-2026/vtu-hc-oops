const API_URL = import.meta.env.VITE_API_URL || "/api";

/** Road route, drive time and fuel/CO2 estimates between two places (see backend routingService). */
export async function getRoute(from, to, { signal } = {}) {
  const token = localStorage.getItem("loadsetu-token");
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`${API_URL}/routes?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Route lookup failed (${response.status}).`);
  return data;
}
