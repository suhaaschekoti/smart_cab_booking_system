import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getMyProfile, updateMyProfile, changeMyPassword, getSession } from "../api/auth";
import { getMyDriverVehicle } from "../api/drivers";
import { Popover, Button } from "./motion";

const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export default function ProfileModal({ open, onClose, role, onUpdated, anchorRef }) {
  const session = getSession();
  const [tab, setTab] = useState("details");
  const [me, setMe] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", gender: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!open || !session) return;
    setError(""); setOk(""); setTab("details");
    getMyProfile(role, session.token).then((p) => { setMe(p); setForm({ name: p.name || "", phone: p.phone || "", gender: p.gender || "" }); }).catch(() => setError("Could not load your profile."));
    if (role === "driver") getMyDriverVehicle(session.token).then((v) => setVehicle(v?.[0] || null)).catch(() => {});
  }, [open, role, session?.token]);

  async function saveDetails(e) {
    e.preventDefault(); setError(""); setOk(""); setBusy(true);
    try {
      const payload = { name: form.name, phone: form.phone }; if (role === "user") payload.gender = form.gender || null;
      const p = await updateMyProfile(role, session.token, payload); setMe(p); setOk("Details saved."); onUpdated?.(p);
    } catch (err) { setError(err?.response?.data?.detail?.[0]?.msg || err?.response?.data?.detail || "Could not save."); }
    finally { setBusy(false); }
  }
  async function savePassword(e) {
    e.preventDefault(); setError(""); setOk("");
    if (pw.next !== pw.confirm) return setError("New passwords don't match.");
    setBusy(true);
    try { await changeMyPassword(role, session.token, pw.current, pw.next); setOk("Password updated."); setPw({ current: "", next: "", confirm: "" }); }
    catch (err) { setError(err?.response?.data?.detail?.[0]?.msg || err?.response?.data?.detail || "Could not update password."); }
    finally { setBusy(false); }
  }

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} width={400}>
      <div className="modal-header" style={{ marginBottom: 12 }}><h3 className="modal-title">Your profile</h3><button className="modal-close" onClick={onClose} aria-label="Close">✕</button></div>
      {me && (
        <div className="profile-head">
          <div className="avatar avatar-lg">{initials(me.name)}</div>
          <div><h3>{me.name}</h3><div className="muted">{me.email}</div></div>
        </div>
      )}
      <div className="profile-tabs">
        {[["details", "Details"], ["password", "Password"]].map(([k, l]) => <button key={k} className={`profile-tab ${tab === k ? "active" : ""}`} onClick={() => { setTab(k); setError(""); setOk(""); }}>{l}</button>)}
      </div>
      {error && <div className="error-msg">{error}</div>}
      {ok && <div className="ok-msg">{ok}</div>}
      <AnimatePresence mode="wait" initial={false}>
        {tab === "details" ? (
          <motion.form key="d" onSubmit={saveDetails} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: .15 }}>
            <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></div>
            <div className="field"><label>Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required pattern="^\\+?[0-9]{10,15}$" title="10 to 15 digits" /></div>
            {role === "user" && <div className="field"><label>Gender (optional)</label><input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></div>}
            {me && (
              <div className="kv" style={{ margin: "4px 0 18px" }}>
                <span>Email</span><span>{me.email}</span>
                {role === "user" && <><span>Reward points</span><span>{me.reward_points}</span></>}
                {role === "driver" && <><span>Licence</span><span>{me.license_number}</span><span>Rating</span><span>★ {Number(me.rating).toFixed(1)}</span>{vehicle && <><span>Vehicle</span><span>{vehicle.vehicle_number}{vehicle.vehicle_type && `, ${vehicle.vehicle_type}`}</span></>}</>}
                <span>Verified</span><span>{me.is_verified ? "Yes" : "No"}</span>
                <span>Member since</span><span>{new Date(me.created_at).toLocaleDateString()}</span>
              </div>
            )}
            <Button className="btn-block" type="submit" disabled={busy || !me}>{busy ? "Saving…" : "Save details"}</Button>
          </motion.form>
        ) : (
          <motion.form key="p" onSubmit={savePassword} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: .15 }}>
            <div className="field"><label>Current password</label><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required /></div>
            <div className="field"><label>New password</label><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} required /></div>
            <div className="field"><label>Confirm new password</label><input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" minLength={8} required /></div>
            <p className="field-hint">At least 8 characters.</p>
            <Button className="btn-block" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
          </motion.form>
        )}
      </AnimatePresence>
    </Popover>
  );
}