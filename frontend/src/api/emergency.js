import { api } from "./client";
const h = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

export const getContacts = async (t) => (await api.get("/emergency/contacts", h(t))).data;
export const addContact = async (t, payload) => (await api.post("/emergency/contacts", payload, h(t))).data;
export const deleteContact = async (t, id) => api.delete(`/emergency/contacts/${id}`, h(t));
export const triggerSOS = async (t, tripId, location) =>
  (await api.post("/emergency/sos", { trip_id: tripId, current_lat: location?.lat ?? null, current_lng: location?.lng ?? null }, h(t))).data;
export const getMyAlerts = async (t) => (await api.get("/emergency/alerts/my", h(t))).data;