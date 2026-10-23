const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method: payload ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Please try again.");
  return data;
}

export const signup = (payload) => {
  if (payload?.aadhaarDocument || payload?.drivingLicenseDocument) {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== "") form.append(key, value);
    }
    return fetch(`${API_URL}/auth/signup`, { method: "POST", body: form })
      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Please try again."); return data; });
  }
  return request("/auth/signup", payload);
};
export const login = (payload) => request("/auth/login", payload);
