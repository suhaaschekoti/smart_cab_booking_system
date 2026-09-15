import { api } from "./client";
const h = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

export const getMyDriverProfile = async (t) => (await api.get("/drivers/me", h(t))).data;
export const getMyDriverStats = async (t) => (await api.get("/drivers/me/stats", h(t))).data;
export const getMyDriverVehicle = async (t) => (await api.get("/drivers/me/vehicle", h(t))).data;
export async function setAvailability(t, availabilityStatus, location) {
  const payload = { availability_status: availabilityStatus };
  if (location) { payload.current_lat = location.lat; payload.current_lng = location.lng; }
  return (await api.patch("/drivers/me/availability", payload, h(t))).data;
}