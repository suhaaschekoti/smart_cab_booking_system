import { api } from "./client";
const h = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

export const getStats = async (t) => (await api.get("/admin/stats", h(t))).data;
export const getUsers = async (t) => (await api.get("/admin/users", h(t))).data;
export const getDrivers = async (t) => (await api.get("/admin/drivers", h(t))).data;
export const getTrips = async (t) => (await api.get("/admin/trips", h(t))).data;
export const getPayments = async (t) => (await api.get("/admin/payments", h(t))).data;
export const getAlerts = async (t) => (await api.get("/admin/alerts", h(t))).data;
export const acknowledgeAlert = async (t, id) => (await api.patch(`/admin/alerts/${id}/acknowledge`, null, h(t))).data;
export const setUserActive = async (t, id, value) => (await api.patch(`/admin/users/${id}/active`, { value }, h(t))).data;
export const setUserFlag = async (t, id, value) => (await api.patch(`/admin/users/${id}/flag`, { value }, h(t))).data;
export const setDriverActive = async (t, id, value) => (await api.patch(`/admin/drivers/${id}/active`, { value }, h(t))).data;
export const setDriverVerified = async (t, id, value) => (await api.patch(`/admin/drivers/${id}/verify`, { value }, h(t))).data;
export const addAttraction = async (t, payload) => (await api.post("/admin/attractions", payload, h(t))).data;
export const deleteAttraction = async (t, id) => api.delete(`/admin/attractions/${id}`, h(t));