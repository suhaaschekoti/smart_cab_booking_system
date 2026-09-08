import { api } from "./client";

// role: "user" | "driver" | "admin"
export async function login(role, emailOrUsername, password) {
  const { data } = await api.post(`/auth/${role}/login`, {
    email_or_username: emailOrUsername,
    password,
  });
  return data; // { access_token, token_type }
}

// payload shape differs per role -- matches each RegisterIn schema on the backend
export async function register(role, payload) {
  const { data } = await api.post(`/auth/${role}/register`, payload);
  return data;
}

// role: "user" | "driver" only -- admins have no email
export async function verifyEmail(role, token) {
  const { data } = await api.get(`/auth/${role}/verify-email`, { params: { token } });
  return data; // { message }
}

export async function forgotPassword(role, email) {
  const { data } = await api.post(`/auth/${role}/forgot-password`, { email });
  return data; // { message }
}

export async function resetPassword(role, token, newPassword) {
  const { data } = await api.post(`/auth/${role}/reset-password`, {
    token,
    new_password: newPassword,
  });
  return data; // { message }
}

export function saveSession(role, token) {
  localStorage.setItem("scb_token", token);
  localStorage.setItem("scb_role", role);
}

export function getSession() {
  const token = localStorage.getItem("scb_token");
  const role = localStorage.getItem("scb_role");
  return token && role ? { token, role } : null;
}

export function clearSession() {
  localStorage.removeItem("scb_token");
  localStorage.removeItem("scb_role");
}

export async function fetchCurrentUser(token) {
  const { data } = await api.get("/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}