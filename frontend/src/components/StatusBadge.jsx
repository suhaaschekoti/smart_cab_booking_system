import { motion, AnimatePresence } from "motion/react";
const LABELS = { REQUESTED: "Requested", ACCEPTED: "Accepted", ONGOING: "On the way", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export default function StatusBadge({ status }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={status} className={`status-badge status-${(status || "").toLowerCase()}`}
        initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .85 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}>
        {LABELS[status] || status}
      </motion.span>
    </AnimatePresence>
  );
}