import { api } from "./client";
const h = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

export const estimateFare = async (t, payload) => (await api.post("/trips/estimate", payload, h(t))).data;
export const requestTrip = async (t, payload) => (await api.post("/trips", payload, h(t))).data;
export const requestTour = async (t, payload) => (await api.post("/trips/tour", payload, h(t))).data;
export const requestRental = async (t, payload) => (await api.post("/trips/rental", payload, h(t))).data;
export const getMyTrips = async (t) => (await api.get("/trips/my", h(t))).data;
export const getTrip = async (t, id) => (await api.get(`/trips/${id}`, h(t))).data;
export const cancelTrip = async (t, id, reason) => (await api.patch(`/trips/${id}/cancel`, { reason: reason || null }, h(t))).data;

// Driver-side
export const getDriverAssignedTrips = async (t) => (await api.get("/trips/driver/assigned", h(t))).data;
export const acceptTrip = async (t, id) => (await api.patch(`/trips/${id}/accept`, null, h(t))).data;
export const rejectTrip = async (t, id) => (await api.patch(`/trips/${id}/reject`, null, h(t))).data;
export const startTrip = async (t, id) => (await api.patch(`/trips/${id}/start`, null, h(t))).data;
export const completeTrip = async (t, id) => (await api.patch(`/trips/${id}/complete`, null, h(t))).data;