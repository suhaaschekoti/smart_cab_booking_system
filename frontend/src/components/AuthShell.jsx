import { motion, useReducedMotion } from "motion/react";
import { useTheme } from "../theme/ThemeContext";

export default function AuthShell({ title, subtitle, children, foot }) {
  const reduce = useReducedMotion();
  const { theme, toggle } = useTheme();
  return (
    <div className="page">
      <motion.div className="auth-card"
        initial={reduce ? false : { opacity: 0, y: 16, scale: .98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div className="brand" style={{ marginBottom: 0 }}><div className="brand-mark">SC</div><div className="brand-name">Smart Cab</div></div>
          <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
        {title && <h1 className="auth-title">{title}</h1>}
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
        {foot && <p className="auth-foot">{foot}</p>}
      </motion.div>
    </div>
  );
}