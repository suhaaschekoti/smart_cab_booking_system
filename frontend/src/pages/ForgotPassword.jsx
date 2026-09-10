import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import AuthShell from "../components/AuthShell";
import Segmented from "../components/Segmented";
import { Button } from "../components/motion";

const ROLES = [{ key: "user", label: "Passenger" }, { key: "driver", label: "Driver" }];

export default function ForgotPassword() {
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { await forgotPassword(role, email); setSent(true); } catch { setError("Something went wrong. Try again."); } finally { setLoading(false); }
  }
  if (sent) return (
    <AuthShell><div className="success-panel"><div className="success-icon">✓</div><h1 className="auth-title">Check your email</h1><p className="auth-sub">If an account exists for {email}, a reset link is on its way.</p><Link to="/login">Back to sign in</Link></div></AuthShell>
  );
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one" foot={<Link to="/login">Back to sign in</Link>}>
      <Segmented options={ROLES} value={role} onChange={setRole} />
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        <Button className="btn-block" type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
      </form>
    </AuthShell>
  );
}