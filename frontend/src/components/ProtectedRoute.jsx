import { Navigate } from "react-router-dom";
import { getSession } from "../api/auth";

const HOME = { user: "/dashboard", driver: "/driver/dashboard", admin: "/admin" };

export default function ProtectedRoute({ role, children }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) return <Navigate to={HOME[session.role] || "/login"} replace />;
  return children;
}