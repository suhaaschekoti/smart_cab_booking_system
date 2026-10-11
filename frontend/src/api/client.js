import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export function formatIST(value) {
  if (!value) return "—";

  let timestamp = value;

  // Database timestamps without timezone information represent UTC.
  if (
    typeof timestamp === "string" &&
    !/(Z|[+-]\d{2}:\d{2})$/i.test(timestamp)
  ) {
    timestamp = timestamp.replace(" ", "T") + "Z";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}