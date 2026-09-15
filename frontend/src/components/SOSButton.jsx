import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { triggerSOS } from "../api/emergency";

function getLocation() {
  return new Promise((r) => { if (!navigator.geolocation) return r(null); navigator.geolocation.getCurrentPosition((p) => r({ lat: p.coords.latitude, lng: p.coords.longitude }), () => r(null), { timeout: 5000 }); });
}

export default function SOSButton({ token, trip, onSent }) {
  const reduce = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function fire() {
    setSending(true); setError("");
    try { const a = await triggerSOS(token, trip.trip_id, await getLocation()); setResult(a); setConfirming(false); onSent?.(a); }
    catch (err) { setError(err?.response?.data?.detail || "Could not send the alert."); } finally { setSending(false); }
  }

  if (result) {
    const n = result.notifications.filter((x) => x.delivery_status === "SENT").length;
    return <motion.div className="sos-sent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>Alert sent to {n} contact{n !== 1 ? "s" : ""} with your live location.</motion.div>;
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!confirming ? (
        <motion.button key="btn" className="sos-btn" onClick={() => setConfirming(true)}
          animate={reduce ? {} : { boxShadow: ["0 0 0 0 rgba(255,90,95,.55)", "0 0 0 12px rgba(255,90,95,0)"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} whileTap={{ scale: .96 }}>
          SOS
        </motion.button>
      ) : (
        <motion.div key="confirm" className="sos-confirm" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
          <p>Send your live location and trip details to all your emergency contacts?</p>
          {error && <div className="error-msg">{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="sos-btn" onClick={fire} disabled={sending}>{sending ? "Sending…" : "Yes, send alert"}</button>
            <button className="logout-btn-small" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}