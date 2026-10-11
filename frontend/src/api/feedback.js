import { api } from "./client";

const auth = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export async function getEmergencyContacts(token) {
  const { data } = await api.get("/emergency/contacts", auth(token));
  return data;
}

export async function addEmergencyContact(token, payload) {
  const { data } = await api.post(
    "/emergency/contacts",
    payload,
    auth(token),
  );
  return data;
}

export async function updateEmergencyContact(token, id, payload) {
  const { data } = await api.patch(
    `/emergency/contacts/${id}`,
    payload,
    auth(token),
  );
  return data;
}

export async function deleteEmergencyContact(token, id) {
  await api.delete(`/emergency/contacts/${id}`, auth(token));
}
