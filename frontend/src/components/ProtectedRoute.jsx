import { Navigate } from "react-router-dom";
import { getSession } from "../api/auth";

export default function ProtectedRoute({ role, children }) {
  const session = getSession();
  if (!session || session.role !== role) {
    return <Navigate to="/login" replace />;
  }
  return children;
}