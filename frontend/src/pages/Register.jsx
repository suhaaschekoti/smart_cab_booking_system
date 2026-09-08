import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";

const ROLES = [
  { key: "user", label: "Passenger" },
  { key: "driver", label: "Driver" },
  { key: "admin", label: "Admin" },
];

const VEHICLE_TYPES = ["Hatchback", "Sedan", "SUV"];
const FUEL_TYPES = ["Petrol", "Diesel", "EV", "CNG"];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
  gender: "",
  license_number: "",
  vehicle_number: "",
  vehicle_type: "",
  fuel_type: "",
  username: "",
};

export default function Register() {
  const [role, setRole] = useState("user");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function switchRole(newRole) {
    setRole(newRole);
    setForm(EMPTY_FORM);
    setError("");
  }

  function buildPayload() {
    if (role === "user") {
      return {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        gender: form.gender || null,
      };
    }
    if (role === "driver") {
      return {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        license_number: form.license_number,
        vehicle_number: form.vehicle_number,
        vehicle_type: form.vehicle_type || null,
        fuel_type: form.fuel_type || null,
      };
    }
    // admin
    return {
      username: form.username,
      password: form.password,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(role, buildPayload());
      setSuccess(true);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Registration failed. Please check your details and try again.");
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
            <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>Account created</p>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-dim)", fontSize: 13 }}>
              {role === "admin"
                ? `You can now log in as ${ROLES.find((r) => r.key === role).label}.`
                : "Check your email for a verification link before logging in."}
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
              onClick={() => switchRole(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          {role === "admin" ? (
            <div className="field">
              <label>Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="admin_username"
                required
              />
            </div>
          ) : (
            <>
              <div className="field">
                <label>Full name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="9000000000"
                  required
                />
              </div>
            </>
          )}

          {role === "driver" && (
            <>
              <div className="field">
                <label>Driving license number</label>
                <input
                  type="text"
                  value={form.license_number}
                  onChange={(e) => update("license_number", e.target.value)}
                  placeholder="DL-0001"
                  required
                />
              </div>
              <div className="field">
                <label>Vehicle number</label>
                <input
                  type="text"
                  value={form.vehicle_number}
                  onChange={(e) => update("vehicle_number", e.target.value)}
                  placeholder="KL-07-AB-1234"
                  required
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Vehicle type</label>
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => update("vehicle_type", e.target.value)}
                  >
                    <option value="">Select...</option>
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Fuel type</label>
                  <select
                    value={form.fuel_type}
                    onChange={(e) => update("fuel_type", e.target.value)}
                  >
                    <option value="">Select...</option>
                    {FUEL_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {role === "user" && (
            <div className="field">
              <label>Gender (optional)</label>
              <input
                type="text"
                value={form.gender}
                onChange={(e) => update("gender", e.target.value)}
                placeholder="Optional"
              />
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button className="submit-btn" type="submit" disabled={loading}>
            {loading ? "Creating account..." : `Create ${ROLES.find((r) => r.key === role).label} account`}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-dim)", marginTop: 18, marginBottom: 0 }}>
          Already have an account? <Link to="/login" style={{ color: "var(--accent)" }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}