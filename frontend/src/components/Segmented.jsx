import { motion } from "motion/react";

/** options: [{key,label}], value, onChange */
export default function Segmented({ options, value, onChange, style }) {
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  return (
    <div className="role-tabs" style={{ "--n": options.length, ...style }}>
      <motion.div className="role-tab-pill" animate={{ x: `${idx * 100}%` }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />
      {options.map((o) => (
        <button key={o.key} type="button" className={`role-tab ${value === o.key ? "active" : ""}`} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}