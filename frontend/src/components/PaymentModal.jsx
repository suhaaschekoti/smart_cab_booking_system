import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { makePayment } from "../api/payments";
import { getMyRewards } from "../api/rewards";
import { Modal, Button } from "./motion";

const MODES = [{ key: "UPI", label: "UPI", icon: "⚡" }, { key: "CARD", label: "Card", icon: "💳" }, { key: "WALLET", label: "Wallet", icon: "👛" }, { key: "CASH", label: "Cash", icon: "💵" }];
const Row = ({ k, v, total }) => <div className={`receipt-row ${total ? "receipt-total" : ""}`}><span>{k}</span><span>{v}</span></div>;

export default function PaymentModal({ trip, token, onPaid, onClose }) {
  const [mode, setMode] = useState("UPI");
  const [points, setPoints] = useState(0);
  const [balance, setBalance] = useState(0);
  const [maxFrac, setMaxFrac] = useState(.5);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => { getMyRewards(token).then((r) => { setBalance(r.reward_points); setMaxFrac(Number(r.max_discount_fraction)); }).catch(() => {}); }, [token]);

  const fare = Number(trip.fare);
  const maxUsable = Math.min(balance, Math.floor(fare * maxFrac));
  const discount = Math.min(points, maxUsable);
  const due = (fare - discount).toFixed(2);
  const route = `${trip.pickup_location.split(",")[0]} → ${trip.drop_location.split(",")[0]}`;

  async function pay() {
    setError(""); setPaying(true);
    try { const p = await makePayment(token, trip.trip_id, mode, points); setReceipt(p); onPaid(p); }
    catch (err) { setError(err?.response?.data?.detail || "Payment failed."); } finally { setPaying(false); }
  }

  return (
    <Modal open onClose={onClose}>
      <AnimatePresence mode="wait" initial={false}>
        {receipt ? (
          <motion.div key="receipt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="success-panel"><div className="success-icon">✓</div><h3 className="modal-title">Paid</h3></div>
            <div className="receipt" style={{ marginTop: 16 }}>
              <Row k="Trip" v={`#${trip.trip_id}`} /><Row k="Route" v={route} />
              {trip.distance_km != null && <Row k="Distance" v={`${trip.distance_km} km`} />}
              <Row k="Fare" v={`₹${fare.toFixed(2)}`} />
              {Number(receipt.discount_applied) > 0 && <Row k="Reward discount" v={`− ₹${Number(receipt.discount_applied).toFixed(2)}`} />}
              <Row k="Amount paid" v={`₹${Number(receipt.amount).toFixed(2)}`} total />
              <Row k="Method" v={receipt.payment_mode} />
              <Row k="Time" v={new Date(receipt.payment_time).toLocaleString()} />
              <p className="receipt-reward">You earned 10 reward points</p>
            </div>
            <Button className="btn-block" onClick={onClose}>Done</Button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="modal-header"><h3 className="modal-title">Pay for your trip</h3><button className="modal-close" onClick={onClose} aria-label="Close">✕</button></div>
            <div className="receipt">
              <Row k="Route" v={route} /><Row k="Fare" v={`₹${fare.toFixed(2)}`} />
              {Number(trip.surge_multiplier) > 1 && <Row k="Surge" v={`×${Number(trip.surge_multiplier).toFixed(2)}`} />}
              {trip.night_surcharge && <Row k="Night rate" v="×1.25" />}
              <AnimatePresence>{discount > 0 && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><Row k="Reward discount" v={`− ₹${discount}`} /></motion.div>}</AnimatePresence>
              <Row k="Amount due" v={`₹${due}`} total />
            </div>
            {balance > 0 && (
              <div className="reward-slider" style={{ marginBottom: 16 }}>
                <div className="reward-slider-head"><span>Use reward points <span className="muted">({balance} available)</span></span><strong>{points} pts</strong></div>
                <input type="range" min="0" max={maxUsable} value={Math.min(points, maxUsable)} onChange={(e) => setPoints(Number(e.target.value))} />
              </div>
            )}
            <div className="payment-modes">
              {MODES.map((m) => <motion.button key={m.key} type="button" className={`payment-mode-btn ${mode === m.key ? "active" : ""}`} onClick={() => setMode(m.key)} whileTap={{ scale: .95 }}><span className="payment-mode-icon">{m.icon}</span><span>{m.label}</span></motion.button>)}
            </div>
            {error && <div className="error-msg">{error}</div>}
            <Button className="btn-block" onClick={pay} disabled={paying}>{paying ? "Processing…" : `Pay ₹${due}`}</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}