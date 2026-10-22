const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
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

export const createBooking = ({ loadId, truckId, routeLegId, acceptTerms }) => request("/bookings", {
  method: "POST",
  body: JSON.stringify({ loadId, truckId, routeLegId, acceptTerms })
});
export const getMyBookings = () => request("/bookings/mine");
