
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { triggerSOS } from "../api/emergency";

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        const messages = {
          1: "Location permission denied. Allow location access and try again.",
          2: "Your location is unavailable. Check your device's location settings.",
          3: "Location request timed out. Please try again.",
        };

        reject(
          new Error(messages[err.code] || "Could not obtain your location.")
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

export default function SOSButton({ token, trip, onSent }) {
  const reduce = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function fire() {
    setSending(true);
    setError("");

    try {
      const location = await getLocation();

      const alert = await triggerSOS(
        token,
        trip.trip_id,
        location.lat,
        location.lng
      );

      setResult(alert);
      setConfirming(false);
      onSent?.(alert);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err.message ||
        "Could not send the alert."
      );
    } finally {
      setSending(false);
    }
  }

  if (result) {
    const sentCount = (result.notifications || []).filter(
      (notification) => notification.delivery_status === "SENT"
    ).length;

    return (
      <motion.div
        className="sos-sent"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Emergency alert sent to {sentCount} contact
        {sentCount !== 1 ? "s" : ""} with your location snapshot.
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!confirming ? (
        <motion.button
          key="btn"
          type="button"
          className="sos-btn"
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
          animate={
            reduce
              ? {}
              : {
                  boxShadow: [
                    "0 0 0 0 rgba(255,90,95,.55)",
                    "0 0 0 12px rgba(255,90,95,0)",
                  ],
                }
          }
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeOut",
          }}
          whileTap={{ scale: 0.96 }}
        >
          SOS
        </motion.button>
      ) : (
        <motion.div
          key="confirm"
          className="sos-confirm"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          <p>
            Send your current location and trip details to all your
            emergency contacts?
          </p>

          {error && <div className="error-msg">{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="sos-btn"
              onClick={fire}
              disabled={sending}
            >
              {sending ? "Getting location…" : "Yes, send alert"}
            </button>

            <button
              type="button"
              className="logout-btn-small"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              disabled={sending}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
