import { api } from "./client";

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function requestTrip(token, payload) {
  const { data } = await api.post("/trips", payload, authHeader(token));
  return data;
}

export async function getMyTrips(token) {
  const { data } = await api.get("/trips/my", authHeader(token));
  return data;
}

export async function cancelTrip(token, tripId) {
  const { data } = await api.patch(`/trips/${tripId}/cancel`, null, authHeader(token));
  return data;
}

// ---------------- Driver-side ----------------

export async function getDriverAssignedTrips(token) {
  const { data } = await api.get("/trips/driver/assigned", authHeader(token));
  return data;
}

export async function acceptTrip(token, tripId) {
  const { data } = await api.patch(`/trips/${tripId}/accept`, null, authHeader(token));
  return data;
}

export async function startTrip(token, tripId) {
  const { data } = await api.patch(`/trips/${tripId}/start`, null, authHeader(token));
  return data;
}

export async function completeTrip(token, tripId) {
  const { data } = await api.patch(`/trips/${tripId}/complete`, null, authHeader(token));
  return data;
}