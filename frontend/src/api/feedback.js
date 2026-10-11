import { api } from "./client";

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function submitFeedback(token, tripId, rating, comments) {
  const { data } = await api.post(
    `/feedback/${tripId}`,
    { rating, comments: comments || null },
    authHeader(token)
  );
  return data;
}

export async function getFeedback(token, tripId) {
  const { data } = await api.get(`/feedback/${tripId}`, authHeader(token));
  return data;
}