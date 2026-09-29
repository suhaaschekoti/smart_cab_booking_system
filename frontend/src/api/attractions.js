import { api } from "./client";

export const getAttractions = async (params = {}) =>
  (await api.get("/attractions", { params })).data;

export const getCategories = async () =>
  (await api.get("/attractions/categories")).data;

export const getNearbyAttractions = async (lat, lng, radiusKm = 40) => {
  const res = await api.get("/attractions/nearby", {
    params: { lat, lng, radius_km: radiusKm },
  });
  return res.data;
};

export const planTour = async (payload) => {
  const res = await api.post("/attractions/plan", payload);
  return res.data;
};