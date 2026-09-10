import { Link, NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { clearSession } from "../api/auth";
import { useTheme } from "../theme/ThemeContext";

const LINKS = {
  user: [
    { to: "/dashboard", label: "Book" },
    { to: "/tours", label: "Tour guide" },
    { to: "/rewards", label: "Rewards" },
    { to: "/safety", label: "Safety" },
  ],
  driver: [{ to: "/driver/dashboard", label: "Dashboard" }],
  admin: [{ to: "/admin", label: "Admin" }],
};

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ rotate: -90, opacity: 0, scale: .6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: .6 }} transition={{ type: "spring", stiffness: 400, damping: 26 }} style={{ display: "grid", placeItems: "center", fontSize: 16 }}>
          {theme === "dark" ? "☀️" : "🌙"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default function Navbar({ role, name, extra }) {
  const navigate = useNavigate();
  const links = LINKS[role] || [];
  return (
    <header className="dashboard-header">
      <Link to={links[0]?.to || "/login"} className="brand">
        <div className="brand-mark">SC</div>
        <div className="brand-name">Smart Cab</div>
      </Link>
      <nav className="nav-links">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>{l.label}</NavLink>
        ))}
      </nav>
      <div className="header-right">
        {extra}
        {name && <span className="header-user">{name}</span>}
        <ThemeToggle />
        <button className="logout-btn-small" onClick={() => { clearSession(); navigate("/login"); }}>Log out</button>
      </div>
    </header>
  );
}