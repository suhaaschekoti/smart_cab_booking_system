import { api } from "./client";

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function getMyDriverProfile(token) {
  const { data } = await api.get("/drivers/me", authHeader(token));
  return data;
}

export async function setAvailability(token, availabilityStatus, location) {
  const payload = { availability_status: availabilityStatus };
  if (location) {
    payload.current_lat = location.lat;
    payload.current_lng = location.lng;
  }
  const { data } = await api.patch("/drivers/me/availability", payload, authHeader(token));
  return data;
}