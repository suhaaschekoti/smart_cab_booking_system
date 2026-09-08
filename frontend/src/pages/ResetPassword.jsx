import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { resetPassword } from "../api/auth";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const role = searchParams.get("role");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!token || !role) {
      setError("This reset link is missing required information.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(role, token, password);
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="page">
        <div className="auth-card">
          <div className="brand">
            <div className="brand-mark">SC</div>
            <div className="brand-name">Smart Cab Booking</div>
          </div>
          <div className="success-panel">
            <div className="success-icon">&#10003;</div>
            <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>Password updated</p>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-dim)", fontSize: 13 }}>
              You can now log in with your new password.
            </p>
            <button className="submit-btn" onClick={() => navigate("/login")}>
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mark">SC</div>
          <div className="brand-name">Smart Cab Booking</div>
        </div>

        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
          Choose a new password for your account.
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="submit-btn" type="submit" disabled={loading}>
            {loading ? "Updating..." : "Reset password"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-dim)", marginTop: 18, marginBottom: 0 }}>
          <Link to="/login" style={{ color: "var(--accent)" }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
}