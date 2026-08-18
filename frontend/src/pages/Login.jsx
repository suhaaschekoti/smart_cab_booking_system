import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  login,
  saveSession,
  getSession,
  clearSession,
  fetchCurrentUser,
} from "../api/auth";

const ROLES = [
  { key: "user", label: "Passenger" },
  { key: "driver", label: "Driver" },
  { key: "admin", label: "Admin" },
];

export default function Login() {
  const [role, setRole] = useState("user");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(getSession());
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // If already logged in as a passenger, fetch their profile to prove
    // the token actually works end-to-end (GET /users/me is protected).
    if (session?.role === "user") {
      fetchCurrentUser(session.token)
        .then(setProfile)
        .catch(() => {
          clearSession();
          setSession(null);
        });
    }
  }, [session]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(role, identifier, password);
      saveSession(role, data.access_token);
      setSession({ token: data.access_token, role });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Login failed. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setProfile(null);
    setIdentifier("");
    setPassword("");
  }

  if (session) {
    return (
      <div className="page">
        <div className="auth-card">
          <div className="brand">
            <div className="brand-mark">SC</div>
            <div className="brand-name">Smart Cab Booking</div>
          </div>
          <div className="success-panel">
            <div className="success-icon">&#10003;</div>
            <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>Logged in</p>
            <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 13 }}>
              Role: {session.role}
            </p>

            <div className="session-info">
              <strong>Token (first 40 chars):</strong>
              <br />
              {session.token.slice(0, 40)}...
              {profile && (
                <>
                  <br />
                  <br />
                  <strong>/users/me response:</strong>
                  <br />
                  {profile.name} &middot; {profile.email}
                </>
              )}
            </div>

            <button className="logout-btn" onClick={handleLogout}>
              Log out
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

        <div className="route-divider">
          <div className="route-dot" />
          <div className="route-line" />
          <div className="route-dot" />
        </div>

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
            <label>{role === "admin" ? "Username" : "Email"}</label>
            <input
              type={role === "admin" ? "text" : "email"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={role === "admin" ? "admin_username" : "you@example.com"}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="submit-btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : `Sign in as ${ROLES.find((r) => r.key === role).label}`}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-dim)", marginTop: 18, marginBottom: 0 }}>
          Don't have an account? <Link to="/register" style={{ color: "var(--accent)" }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}