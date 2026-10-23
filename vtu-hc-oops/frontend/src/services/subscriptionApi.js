const API_URL = import.meta.env.VITE_API_URL || "/api";
async function request(path, options = {}) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}
export const getSubscriptionPlans = () => request("/subscriptions/plans");
export const getMySubscription = () => request("/subscriptions/me");
export const createSubscriptionOrder = plan => request("/subscriptions/orders", { method: "POST", body: { plan } });
export const verifySubscriptionPayment = payment => request("/subscriptions/verify", { method: "POST", body: payment });
