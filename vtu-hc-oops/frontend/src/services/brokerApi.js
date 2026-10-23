const API_URL = import.meta.env.VITE_API_URL || "/api";
async function request(path, options = {}) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}
async function documentRequest(path) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Unable to open verification document."); }
  return URL.createObjectURL(await response.blob());
}
export const getBrokerOverview = () => request("/broker/overview");
export const createBrokerBooking = (payload) => request("/broker/bookings", { method: "POST", body: JSON.stringify(payload) });
export const updateBrokerBooking = (bookingId, status) => request(`/broker/bookings/${encodeURIComponent(bookingId)}`, { method: "PATCH", body: JSON.stringify({ status }) });
export const updateBrokerShipment = (loadId, status) => request(`/broker/shipments/${encodeURIComponent(loadId)}`, { method: "PATCH", body: JSON.stringify({ status }) });
export const getVerificationRequests = () => request("/broker/verifications");
export const updateVerification = (userId, status, reason = "") => request(`/broker/verifications/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
export const openVerificationDocument = (userId, type) => documentRequest(`/broker/verifications/${encodeURIComponent(userId)}/documents/${encodeURIComponent(type)}`);
