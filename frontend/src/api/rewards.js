import { api } from "./client";
const h = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
export const getMyRewards = async (t) => (await api.get("/rewards/me", h(t))).data;