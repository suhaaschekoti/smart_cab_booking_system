import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";

const ROLES = [
  { key: "user", label: "Passenger" },
  { key: "driver", label: "Driver" },
];

export default function ForgotPassword() {
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(role, email);
      setSubmitted(true); // backend always returns a generic success message
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="page">
        <div className="auth-card">
          <div className="brand">
            <div className="brand-mark">SC</div>
            <div className="brand-name">Smart Cab Booking</div>
          </div>
          <div className="success-panel">
            <div className="success-icon">&#10003;</div>
            <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>Check your email</p>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-dim)", fontSize: 13 }}>
              If an account exists for {email}, a password reset link has been sent.
            </p>
            <Link to="/login" style={{ color: "var(--accent)", fontSize: 13 }}>
              Back to login
            </Link>
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
          Enter your email and we'll send you a link to reset your password.
        </p>

        <div className="role-tabs">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`role-tab ${role === r.key ? "active" : ""}`}
              onClick={() => setRole(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <button className="submit-btn" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-dim)", marginTop: 18, marginBottom: 0 }}>
          <Link to="/login" style={{ color: "var(--accent)" }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
}