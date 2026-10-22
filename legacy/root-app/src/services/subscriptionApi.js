const API_URL = import.meta.env.VITE_API_URL || "/api";
async function request(path, options = {}) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || "Request failed."); error.status = response.status; error.code = data.code; throw error; }
  return data;
}
export const getMySubscription = () => request("/subscriptions/me");
export const createSubscriptionOrder = plan => request("/subscriptions/orders", { method: "POST", body: JSON.stringify({ plan }) });
export const verifySubscriptionPayment = payload => request("/subscriptions/verify", { method: "POST", body: JSON.stringify(payload) });
export const failSubscriptionPayment = subscriptionId => request("/subscriptions/failed", { method: "POST", body: JSON.stringify({ subscriptionId }) });
