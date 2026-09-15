import { useState, useEffect, useCallback } from "react";
import { getSession } from "../api/auth";
import * as A from "../api/admin";
import Navbar from "../components/Navbar";
import StatusBadge from "../components/StatusBadge";
import ServiceTypeBadge from "../components/ServiceTypeBadge";
import { motion, AnimatePresence } from "motion/react";
import { Page, Card, Counter } from "../components/motion";

const TABS = ["Overview", "Users", "Drivers", "Trips", "Payments", "Alerts", "Attractions"];

export default function AdminDashboard() {
  const session = getSession();
  const t = session.token;
  const [tab, setTab] = useState("Overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [payments, setPayments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [newAttr, setNewAttr] = useState({ name: "", description: "", city: "", category: "", latitude: "", longitude: "" });

  const loadAll = useCallback(async () => {
    const safe = (p) => p.catch(() => null);
    const [s, u, d, tr, p, al, at] = await Promise.all([
      safe(A.getStats(t)), safe(A.getUsers(t)), safe(A.getDrivers(t)), safe(A.getTrips(t)), safe(A.getPayments(t)), safe(A.getAlerts(t)),
      safe(fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/attractions`).then((r) => r.json())),
    ]);
    if (s) setStats(s); if (u) setUsers(u); if (d) setDrivers(d); if (tr) setTrips(tr); if (p) setPayments(p); if (al) setAlerts(al); if (at) setAttractions(at);
  }, [t]);
  useEffect(() => { loadAll(); const id = setInterval(loadAll, 15000); return () => clearInterval(id); }, [loadAll]);

  const act = async (fn) => { try { await fn(); loadAll(); } catch (e) { alert(e?.response?.data?.detail || "Action failed"); } };

  const Stat = ({ label, value, accent, prefix = "", decimals = 0 }) => <div className={`stat ${accent ? "stat-accent" : ""}`}><div className="stat-value">{typeof value === "number" ? <Counter value={value} prefix={prefix} decimals={decimals} /> : value}</div><div className="stat-label">{label}</div></div>;
  const Toggle = ({ on, onLabel, offLabel, onClick }) => <button className={on ? "rate-btn" : "pay-btn"} style={{ marginTop: 0 }} onClick={onClick}>{on ? onLabel : offLabel}</button>;

  return (
    <div className="dashboard-shell">
      <Navbar role="admin" name="Admin" />
      <Page className="dashboard-content wide">
        <div className="chip-row" style={{ marginTop: 0 }}>{TABS.map((x) => <button key={x} className={`chip ${tab === x ? "active" : ""}`} onClick={() => setTab(x)}>{x}{x === "Alerts" && stats?.open_alerts > 0 && <span className="chip-badge">{stats.open_alerts}</span>}</button>)}</div>

        <AnimatePresence mode="wait" initial={false}><motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .16 }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {tab === "Overview" && stats && (
          <>
            <div className="stat-grid" style={{ marginBottom: 4 }}>
              <Stat label="Revenue" value={Number(stats.total_revenue)} prefix="₹" accent />
              <Stat label="Completed trips" value={stats.completed_trips} />
              <Stat label="Trips in progress" value={stats.ongoing_trips} />
              <Stat label="Cancelled" value={stats.cancelled_trips} />
              <Stat label="Passengers" value={stats.total_users} />
              <Stat label="Drivers online" value={`${stats.active_drivers} / ${stats.total_drivers}`} />
              <Stat label="Avg driver rating" value={stats.avg_driver_rating ? `★ ${stats.avg_driver_rating.toFixed(1)}` : "—"} />
              <Stat label="Open SOS alerts" value={stats.open_alerts} accent={stats.open_alerts > 0} />
            </div>
            <Card><h2 className="card-title">Recent trips</h2>
              <table className="admin-table"><thead><tr><th>#</th><th>Type</th><th>Passenger</th><th>Driver</th><th>Route</th><th>Fare</th><th>Status</th></tr></thead>
                <tbody>{trips.slice(0, 10).map((tr) => <tr key={tr.trip_id}><td>{tr.trip_id}</td><td><ServiceTypeBadge type={tr.service_type} /></td><td>{tr.passenger_name}</td><td>{tr.driver_name || "—"}</td><td className="cell-route">{tr.pickup_location.split(",")[0]} → {tr.drop_location.split(",")[0]}</td><td>₹{tr.fare}</td><td><StatusBadge status={tr.trip_status} /></td></tr>)}</tbody></table>
            </Card>
          </>
        )}

        {tab === "Users" && (
          <Card><h2 className="card-title">Passengers ({users.length})</h2>
            <table className="admin-table"><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Points</th><th>Verified</th><th>Flags</th><th>Actions</th></tr></thead>
              <tbody>{users.map((u) => <tr key={u.user_id} className={!u.is_active ? "row-muted" : ""}><td>{u.user_id}</td><td>{u.name}</td><td>{u.email}</td><td>{u.phone}</td><td>{u.reward_points}</td><td>{u.is_verified ? "✓" : "—"}</td><td>{u.is_flagged && <span className="tag-warn">⚑ flagged</span>}{!u.is_active && <span className="tag-warn"> suspended</span>}</td>
                <td className="cell-actions"><Toggle on={u.is_flagged} onLabel="Unflag" offLabel="Flag" onClick={() => act(() => A.setUserFlag(t, u.user_id, !u.is_flagged))} /><Toggle on={!u.is_active} onLabel="Reactivate" offLabel="Suspend" onClick={() => act(() => A.setUserActive(t, u.user_id, !u.is_active))} /></td></tr>)}</tbody></table>
          </Card>
        )}

        {tab === "Drivers" && (
          <Card><h2 className="card-title">Drivers ({drivers.length})</h2>
            <table className="admin-table"><thead><tr><th>#</th><th>Name</th><th>License</th><th>Rating</th><th>Incentive</th><th>Online</th><th>Verified</th><th>Actions</th></tr></thead>
              <tbody>{drivers.map((d) => <tr key={d.driver_id} className={!d.is_active ? "row-muted" : ""}><td>{d.driver_id}</td><td>{d.name}<div className="cell-sub">{d.email}</div></td><td>{d.license_number}</td><td>★ {Number(d.rating).toFixed(1)}</td><td>{Number(d.incentive_score).toFixed(0)}</td><td>{d.availability_status ? <span className="paid-badge">● online</span> : "—"}</td><td>{d.is_verified ? "✓" : "—"}</td>
                <td className="cell-actions"><Toggle on={d.is_verified} onLabel="Unverify" offLabel="Verify" onClick={() => act(() => A.setDriverVerified(t, d.driver_id, !d.is_verified))} /><Toggle on={!d.is_active} onLabel="Reactivate" offLabel="Suspend" onClick={() => act(() => A.setDriverActive(t, d.driver_id, !d.is_active))} /></td></tr>)}</tbody></table>
          </Card>
        )}

        {tab === "Trips" && (
          <Card><h2 className="card-title">All trips ({trips.length})</h2>
            <table className="admin-table"><thead><tr><th>#</th><th>Type</th><th>Passenger</th><th>Driver</th><th>Route</th><th>Km</th><th>Fare</th><th>Surge</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>{trips.map((tr) => <tr key={tr.trip_id}><td>{tr.trip_id}</td><td><ServiceTypeBadge type={tr.service_type} /></td><td>{tr.passenger_name}</td><td>{tr.driver_name || "—"}</td><td className="cell-route">{tr.pickup_location.split(",")[0]} → {tr.drop_location.split(",")[0]}</td><td>{tr.distance_km}</td><td>₹{tr.fare}</td><td>{Number(tr.surge_multiplier) > 1 ? `×${Number(tr.surge_multiplier).toFixed(2)}` : "—"}{tr.night_surcharge && " 🌙"}</td><td><StatusBadge status={tr.trip_status} /></td><td className="cell-sub">{new Date(tr.created_at).toLocaleString()}</td></tr>)}</tbody></table>
          </Card>
        )}

        {tab === "Payments" && (
          <Card><h2 className="card-title">Payments ({payments.length})</h2>
            <table className="admin-table"><thead><tr><th>#</th><th>Trip</th><th>Amount</th><th>Discount</th><th>Points used</th><th>Mode</th><th>Status</th><th>Time</th></tr></thead>
              <tbody>{payments.map((p) => <tr key={p.payment_id}><td>{p.payment_id}</td><td>#{p.trip_id}</td><td>₹{p.amount}</td><td>{Number(p.discount_applied) > 0 ? `₹${p.discount_applied}` : "—"}</td><td>{p.points_redeemed || "—"}</td><td>{p.payment_mode}</td><td><span className="paid-badge">{p.payment_status}</span></td><td className="cell-sub">{new Date(p.payment_time).toLocaleString()}</td></tr>)}</tbody></table>
          </Card>
        )}

        {tab === "Alerts" && (
          <Card><h2 className="card-title">SOS alerts ({alerts.length})</h2>
            {alerts.length === 0 ? <p className="empty-state">No alerts.</p> : (
              <table className="admin-table"><thead><tr><th>#</th><th>Trip</th><th>User</th><th>Time</th><th>Location</th><th>Notified</th><th>Status</th><th></th></tr></thead>
                <tbody>{alerts.map((a) => <tr key={a.alert_id} className={a.alert_status === "SENT" ? "row-alert" : ""}><td>{a.alert_id}</td><td>#{a.trip_id}</td><td>#{a.user_id}</td><td className="cell-sub">{new Date(a.alert_time).toLocaleString()}</td><td>{a.alert_lat ? <a href={`https://www.google.com/maps?q=${a.alert_lat},${a.alert_lng}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>map ↗</a> : "—"}</td><td>{a.notifications.filter((n) => n.delivery_status === "SENT").length}/{a.notifications.length}</td><td><span className={`status-badge ${a.alert_status === "ACKNOWLEDGED" ? "status-completed" : "status-cancelled"}`}>{a.alert_status}</span></td><td>{a.alert_status === "SENT" && <button className="pay-btn" style={{ marginTop: 0 }} onClick={() => act(() => A.acknowledgeAlert(t, a.alert_id))}>Acknowledge</button>}</td></tr>)}</tbody></table>
            )}
          </Card>
        )}

        {tab === "Attractions" && (
          <>
            <Card><h2 className="card-title">Add attraction</h2>
              <div className="form-grid">
                {["name", "city", "category", "latitude", "longitude"].map((k) => <div key={k} className="field"><label style={{ textTransform: "capitalize" }}>{k}</label><input value={newAttr[k]} onChange={(e) => setNewAttr({ ...newAttr, [k]: e.target.value })} /></div>)}
                <div className="field" style={{ gridColumn: "span 2" }}><label>Description</label><input value={newAttr.description} onChange={(e) => setNewAttr({ ...newAttr, description: e.target.value })} /></div>
              </div>
              <button className="submit-btn" disabled={!newAttr.name || !newAttr.latitude || !newAttr.longitude} onClick={() => act(async () => { await A.addAttraction(t, { ...newAttr, latitude: Number(newAttr.latitude), longitude: Number(newAttr.longitude) }); setNewAttr({ name: "", description: "", city: "", category: "", latitude: "", longitude: "" }); })}>Add</button>
            </Card>
            <Card><h2 className="card-title">Catalogue ({attractions.length})</h2>
              <table className="admin-table"><thead><tr><th>#</th><th>Name</th><th>City</th><th>Category</th><th>Coords</th><th></th></tr></thead>
                <tbody>{attractions.map((a) => <tr key={a.attraction_id}><td>{a.attraction_id}</td><td>{a.name}</td><td>{a.city}</td><td>{a.category}</td><td className="cell-sub">{a.latitude}, {a.longitude}</td><td><button className="cancel-link" onClick={() => act(() => A.deleteAttraction(t, a.attraction_id))}>Remove</button></td></tr>)}</tbody></table>
            </Card>
          </>
        )}
        </motion.div></AnimatePresence>
      </Page>
    </div>
  );
}