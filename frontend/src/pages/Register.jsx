import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import AuthShell from "../components/AuthShell";
import Segmented from "../components/Segmented";
import { Button } from "../components/motion";

const ROLES = [{ key: "user", label: "Passenger" }, { key: "driver", label: "Driver" }, { key: "admin", label: "Admin" }];
const VT = ["Hatchback", "Sedan", "SUV"], FT = ["Petrol", "Diesel", "EV", "CNG"];
const EMPTY = { name: "", email: "", phone: "", password: "", gender: "", license_number: "", vehicle_number: "", vehicle_type: "", fuel_type: "", username: "" };

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("user");
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const up = (k, v) => setF((x) => ({ ...x, [k]: v }));

  function payload() {
    if (role === "user") return { name: f.name, email: f.email, phone: f.phone, password: f.password, gender: f.gender || null };
    if (role === "driver") return { name: f.name, email: f.email, phone: f.phone, password: f.password, license_number: f.license_number, vehicle_number: f.vehicle_number, vehicle_type: f.vehicle_type || null, fuel_type: f.fuel_type || null };
    return { username: f.username, password: f.password };
  }
  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { await register(role, payload()); setDone(true); }
    catch (err) { setError(err?.response?.data?.detail || "Registration failed. Check your details and try again."); }
    finally { setLoading(false); }
  }

  if (done) return (
    <AuthShell>
      <div className="success-panel">
        <div className="success-icon">✓</div>
        <h1 className="auth-title">Account created</h1>
        <p className="auth-sub">{role === "admin" ? "You can sign in now." : "Check your inbox for a verification link, then sign in."}</p>
        <Button className="btn-block" onClick={() => navigate("/login")}>Go to sign in</Button>
      </div>
    </AuthShell>
  );

  return (
    <AuthShell title="Create your account" subtitle="Takes about a minute"
      foot={<>Already have one? <Link to="/login">Sign in</Link></>}>
      <Segmented options={ROLES} value={role} onChange={(r) => { setRole(r); setF(EMPTY); setError(""); }} />
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={submit}>
        {role === "admin" ? (
          <div className="field"><label>Username</label><input value={f.username} onChange={(e) => up("username", e.target.value)} required /></div>
        ) : (<>
          <div className="field"><label>Full name</label><input value={f.name} onChange={(e) => up("name", e.target.value)} required /></div>
          <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => up("email", e.target.value)} placeholder="you@example.com" required /></div>
          <div className="field"><label>Phone</label><input type="tel" value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="9000000000" required /></div>
        </>)}
        {role === "driver" && (<>
          <div className="field"><label>Driving licence number</label><input value={f.license_number} onChange={(e) => up("license_number", e.target.value)} placeholder="DL-0001" required /></div>
          <div className="field"><label>Vehicle number</label><input value={f.vehicle_number} onChange={(e) => up("vehicle_number", e.target.value)} placeholder="KL-07-AB-1234" required /></div>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "span 1" }}><label>Vehicle type</label><select value={f.vehicle_type} onChange={(e) => up("vehicle_type", e.target.value)}><option value="">Select</option>{VT.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field" style={{ gridColumn: "span 1" }}><label>Fuel</label><select value={f.fuel_type} onChange={(e) => up("fuel_type", e.target.value)}><option value="">Select</option>{FT.map((t) => <option key={t}>{t}</option>)}</select></div>
          </div>
        </>)}
        {role === "user" && <div className="field"><label>Gender (optional)</label><input value={f.gender} onChange={(e) => up("gender", e.target.value)} /></div>}
        <div className="field"><label>Password</label><input type="password" value={f.password} onChange={(e) => up("password", e.target.value)} autoComplete="new-password" required /></div>
        <Button className="btn-block" type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}