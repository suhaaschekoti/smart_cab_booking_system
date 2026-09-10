import { api } from "./client";
export const getAttractions = async (params = {}) => (await api.get("/attractions", { params })).data;
export const getCategories = async () => (await api.get("/attractions/categories")).data;