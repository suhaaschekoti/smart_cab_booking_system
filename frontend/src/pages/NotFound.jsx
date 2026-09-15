import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { getSession } from "../api/auth";
import { useTheme } from "../theme/ThemeContext";
import { Button } from "../components/motion";

const HOME = { user: "/dashboard", driver: "/driver/dashboard", admin: "/admin" };

export default function NotFound() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { theme, toggle } = useTheme();
  const session = getSession();
  const home = session ? HOME[session.role] || "/login" : "/login";

  return (
    <div className="notfound">
      <motion.div className="auth-card" style={{ maxWidth: 460 }}
        initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Link to="/" className="brand"><div className="brand-mark">SC</div><div className="brand-name">Smart Cab</div></Link>
          <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
        <motion.div className="notfound-code" initial={reduce ? false : { scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: .9 }} transition={{ delay: .08, type: "spring", stiffness: 220, damping: 20 }}>404</motion.div>
        <motion.div className="notfound-road" initial={reduce ? false : { backgroundPositionX: 0 }} animate={reduce ? {} : { backgroundPositionX: [0, -60] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
        <h1>This road doesn't exist</h1>
        <p>The page you're looking for was moved, renamed, or never built. Let's get you back on route.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={() => navigate(home)}>{session ? "Back to dashboard" : "Go to sign in"}</Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </motion.div>
    </div>
  );
}