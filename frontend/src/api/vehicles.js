import { api } from "./client";
const h = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

export const getMyVehicles = async (t) => (await api.get("/vehicles", h(t))).data;
export const addVehicle = async (t, payload) => (await api.post("/vehicles", payload, h(t))).data;
export const deleteVehicle = async (t, id) => api.delete(`/vehicles/${id}`, h(t));