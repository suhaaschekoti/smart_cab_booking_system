import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { resetPassword } from "../api/auth";
import AuthShell from "../components/AuthShell";
import { Button } from "../components/motion";

export default function ResetPassword() {
  const [sp] = useSearchParams(); const navigate = useNavigate();
  const token = sp.get("token"), role = sp.get("role");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [done, setDone] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError("");
    if (!token || !role) return setError("This reset link is missing required information.");
    if (pw !== pw2) return setError("Passwords don't match.");
    setLoading(true);
    try { await resetPassword(role, token, pw); setDone(true); } catch (err) { setError(err?.response?.data?.detail || "This reset link is invalid or has expired."); } finally { setLoading(false); }
  }
  if (done) return (
    <AuthShell><div className="success-panel"><div className="success-icon">✓</div><h1 className="auth-title">Password updated</h1><p className="auth-sub">Sign in with your new password.</p><Button className="btn-block" onClick={() => navigate("/login")}>Go to sign in</Button></div></AuthShell>
  );
  return (
    <AuthShell title="Choose a new password" foot={<Link to="/login">Back to sign in</Link>}>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>New password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required /></div>
        <div className="field"><label>Confirm new password</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required /></div>
        <Button className="btn-block" type="submit" disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
      </form>
    </AuthShell>
  );
}