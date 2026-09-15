import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { submitFeedback } from "../api/feedback";
import { Modal, Button } from "./motion";

function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <motion.button key={s} type="button" className={`star-btn ${s <= (hover || value) ? "filled" : ""}`}
          onMouseEnter={() => setHover(s)} onClick={() => onChange(s)} whileTap={{ scale: .8 }}
          animate={{ scale: s <= value ? [1, 1.25, 1] : 1 }} transition={{ duration: .25 }} aria-label={`${s} stars`}>★</motion.button>
      ))}
      {value > 0 && <span className="star-label">{["", "Poor", "Fair", "Good", "Great", "Excellent"][value]}</span>}
    </div>
  );
}

export default function FeedbackModal({ trip, token, onSubmitted, onClose }) {
  const [rating, setRating] = useState(0); const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function submit(e) {
    e.preventDefault(); if (!rating) return setError("Pick a star rating first.");
    setError(""); setBusy(true);
    try { const f = await submitFeedback(token, trip.trip_id, rating, comments); setDone(true); onSubmitted(f); }
    catch (err) { setError(err?.response?.data?.detail || "Could not submit feedback."); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} width={400}>
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" className="success-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="success-icon">✓</div><h3 className="modal-title">Thanks for rating</h3>
            <p className="muted" style={{ margin: "8px 0 18px" }}>Your rating helps other riders choose well.</p>
            <Button className="btn-block" onClick={onClose}>Done</Button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="modal-header"><h3 className="modal-title">How was your trip?</h3><button className="modal-close" onClick={onClose} aria-label="Close">✕</button></div>
            <p className="muted" style={{ marginBottom: 16 }}>{trip.pickup_location.split(",")[0]} → {trip.drop_location.split(",")[0]}{trip.driver_name && `, with ${trip.driver_name}`}</p>
            <form onSubmit={submit}>
              <Stars value={rating} onChange={setRating} />
              <div className="field" style={{ marginTop: 16 }}><label>Anything to add? (optional)</label><textarea className="feedback-textarea" value={comments} onChange={(e) => setComments(e.target.value)} rows={3} maxLength={500} /></div>
              {error && <div className="error-msg">{error}</div>}
              <Button className="btn-block" type="submit" disabled={busy}>{busy ? "Sending…" : "Submit rating"}</Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}