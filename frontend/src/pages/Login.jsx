import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, saveSession, getSession } from "../api/auth";
import AuthShell from "../components/AuthShell";
import Segmented from "../components/Segmented";
import { Button } from "../components/motion";

const ROLES = [{ key: "user", label: "Passenger" }, { key: "driver", label: "Driver" }, { key: "admin", label: "Admin" }];
const HOME = { user: "/dashboard", driver: "/driver/dashboard", admin: "/admin" };

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("user");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { const s = getSession(); if (s && HOME[s.role]) navigate(HOME[s.role], { replace: true }); }, [navigate]);

  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const d = await login(role, identifier, password); saveSession(role, d.access_token); navigate(HOME[role], { replace: true }); }
    catch (err) { setError(err?.response?.data?.detail || "Login failed. Check your details and try again."); }
    finally { setLoading(false); }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue"
      foot={<>New here? <Link to="/register">Create an account</Link></>}>
      <Segmented options={ROLES} value={role} onChange={setRole} />
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>{role === "admin" ? "Username" : "Email"}</label>
          <input type={role === "admin" ? "text" : "email"} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={role === "admin" ? "admin" : "you@example.com"} autoComplete="username" required /></div>
        <div className="field"><label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          {role !== "admin" && <div style={{ textAlign: "right", marginTop: 6 }}><Link to="/forgot-password" style={{ color: "var(--ink-2)", fontSize: 13 }}>Forgot password?</Link></div>}
        </div>
        <Button className="btn-block" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
    </AuthShell>
  );
}