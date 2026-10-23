
const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("loadsetu-token");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed (${response.status}).`
    );
  }

  return data;
}

export const getTransporterOverview = () =>
  request("/transporter/overview");

export const saveTruckProfile = (payload) =>
  request("/trucks/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateTransporterBooking = (
  bookingId,
  status,
  rejectionReason = ""
) =>
  request(
    `/transporter/bookings/${encodeURIComponent(bookingId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, rejectionReason }),
    }
  );

export const submitTransporterReview = (
  bookingId,
  rating,
  comment
) =>
  request(
    `/bookings/${encodeURIComponent(bookingId)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }
  );
