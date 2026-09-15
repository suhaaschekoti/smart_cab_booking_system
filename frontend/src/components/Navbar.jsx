import { useState, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import ProfileModal from "./ProfileModal";
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

const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export default function Navbar({ role, name, extra, onProfileUpdated }) {
  const navigate = useNavigate();
  const links = LINKS[role] || [];
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef(null);
  const canEdit = role === "user" || role === "driver";
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
        {name && (canEdit
          ? <button ref={avatarRef} className={`header-user-btn ${profileOpen ? "active" : ""}`} onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen} title="View and edit your profile"><span className="avatar">{initials(name)}</span>{name}</button>
          : <span className="header-user">{name}</span>)}
        <ThemeToggle />
        <button className="logout-btn-small" onClick={() => { clearSession(); navigate("/login"); }}>Log out</button>
      </div>
      {canEdit && <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} role={role} onUpdated={onProfileUpdated} anchorRef={avatarRef} />}
    </header>
  );
}