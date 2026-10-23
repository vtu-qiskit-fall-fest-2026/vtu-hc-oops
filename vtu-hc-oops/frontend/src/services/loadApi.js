const API_URL = import.meta.env.VITE_API_URL || "/api";

async function loadRequest(path, options = {}) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

export const createLoad = (payload) => loadRequest("/loads", {
  method: "POST", body: JSON.stringify(payload)
});
export const getMyLoads = () => loadRequest("/loads/mine");
