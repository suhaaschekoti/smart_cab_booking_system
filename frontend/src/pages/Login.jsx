import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, saveSession, getSession, clearSession } from "../api/auth";

const ROLES = [
  { key: "user", label: "Passenger" },
  { key: "driver", label: "Driver" },
  { key: "admin", label: "Admin" },
];

const DASHBOARD_ROUTES = {
  user: "/dashboard",
  driver: "/driver/dashboard",
};

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("user");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(getSession());

  useEffect(() => {
    if (!session) return;
    const dest = DASHBOARD_ROUTES[session.role];
    if (dest) {
      navigate(dest, { replace: true });
    }
  }, [session, navigate]);

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
    setIdentifier("");
    setPassword("");
  }

  // Admin: no dashboard yet -- show debug success screen
  if (session && session.role === "admin") {
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
              <br />
              <br />
              <em>No dashboard built yet for this role — coming soon.</em>
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
            {role !== "admin" && (
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <Link to="/forgot-password" style={{ color: "var(--text-dim)", fontSize: 12 }}>
                  Forgot password?
                </Link>
              </div>
            )}
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