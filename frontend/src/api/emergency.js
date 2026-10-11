
import { api } from "./client";

const auth = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// Emergency contacts
export async function getContacts(token) {
  const { data } = await api.get("/emergency/contacts", auth(token));
  return data;
}

export async function addContact(token, payload) {
  const { data } = await api.post(
    "/emergency/contacts",
    payload,
    auth(token)
  );
  return data;
}

export async function updateContact(token, id, payload) {
  const { data } = await api.patch(
    `/emergency/contacts/${id}`,
    payload,
    auth(token)
  );
  return data;
}

export async function deleteContact(token, id) {
  await api.delete(`/emergency/contacts/${id}`, auth(token));
}

// SOS
export async function triggerSOS(
  token,
  tripId,
  currentLat = null,
  currentLng = null
) {
  const { data } = await api.post(
    "/emergency/sos",
    {
      trip_id: tripId,
      current_lat: currentLat,
      current_lng: currentLng,
    },
    auth(token)
  );
  return data;
}
export async function getMyAlerts(token) {
  const { data } = await api.get("/emergency/alerts/my", auth(token));
  return data;
}

// Compatibility aliases for ProfileModal.jsx
export const getEmergencyContacts = getContacts;
export const addEmergencyContact = addContact;
export const updateEmergencyContact = updateContact;
export const deleteEmergencyContact = deleteContact;
