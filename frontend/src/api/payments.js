import { api } from "./client";
const h = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

export const makePayment = async (t, tripId, paymentMode, pointsToRedeem = 0) =>
  (await api.post(`/payments/${tripId}`, { payment_mode: paymentMode, points_to_redeem: pointsToRedeem }, h(t))).data;
export const getReceipt = async (t, tripId) => (await api.get(`/payments/${tripId}/receipt`, h(t))).data;