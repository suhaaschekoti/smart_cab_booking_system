import { useState, useEffect, useCallback } from "react";

import { getSession } from "../api/auth";
import * as A from "../api/admin";
import Navbar from "../components/Navbar";
import StatusBadge from "../components/StatusBadge";
import ServiceTypeBadge from "../components/ServiceTypeBadge";
import { Page, Card, Counter } from "../components/motion";
import { formatIST } from "../api/client";

const TABS = [
  "Overview",
  "Users",
  "Drivers",
  "Trips",
  "Payments",
  "Alerts",
  "Attractions",
];

export default function AdminDashboard() {
  const session = getSession();
  const token = session?.token;

  const [tab, setTab] = useState("Overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [payments, setPayments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [newAttr, setNewAttr] = useState({
    name: "",
    description: "",
    city: "",
    category: "",
    latitude: "",
    longitude: "",
  });

  const loadAll = useCallback(async () => {
    if (!token) return;

    // Keep one failed endpoint from preventing the other sections from loading.
    const safe = async (promise, label) => {
      try {
        const result = await promise;
        return result;
      } catch (error) {
        console.error(`Admin dashboard: failed to load ${label}`, error);
        return null;
      }
    };

    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:8000"
    ).replace(/\/$/, "");

    const [
      statsResult,
      usersResult,
      driversResult,
      tripsResult,
      paymentsResult,
      alertsResult,
      attractionsResult,
    ] = await Promise.all([
      safe(A.getStats(token), "stats"),
      safe(A.getUsers(token), "users"),
      safe(A.getDrivers(token), "drivers"),
      safe(A.getTrips(token), "trips"),
      safe(A.getPayments(token), "payments"),
      safe(A.getAlerts(token), "alerts"),
      safe(
        fetch(`${apiBase}/attractions`).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Attractions request failed: ${response.status}`);
          }
          return response.json();
        }),
        "attractions"
      ),
    ]);

    if (statsResult) setStats(statsResult);
    if (Array.isArray(usersResult)) setUsers(usersResult);
    if (Array.isArray(driversResult)) setDrivers(driversResult);
    if (Array.isArray(tripsResult)) setTrips(tripsResult);
    if (Array.isArray(paymentsResult)) setPayments(paymentsResult);
    if (Array.isArray(alertsResult)) setAlerts(alertsResult);
    if (Array.isArray(attractionsResult)) setAttractions(attractionsResult);
  }, [token]);

  useEffect(() => {
    loadAll();
    const intervalId = setInterval(loadAll, 15000);
    return () => clearInterval(intervalId);
  }, [loadAll]);

  const act = async (fn) => {
    try {
      await fn();
      await loadAll();
    } catch (error) {
      alert(
        error?.response?.data?.detail ||
          error?.message ||
          "Action failed. Check the browser console."
      );
    }
  };

  const Stat = ({ label, value, accent, prefix = "", decimals = 0 }) => (
    <div className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="stat-value">
        {typeof value === "number" ? (
          <Counter value={value} prefix={prefix} decimals={decimals} />
        ) : (
          value
        )}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );

  const Toggle = ({ on, onLabel, offLabel, onClick }) => (
    <button
      type="button"
      className={on ? "rate-btn" : "pay-btn"}
      style={{ marginTop: 0 }}
      onClick={onClick}
    >
      {on ? onLabel : offLabel}
    </button>
  );

  return (
    <div className="dashboard-shell">
      <Navbar role="admin" name="Admin" />

      <Page className="dashboard-content wide">
        <div className="chip-row" style={{ marginTop: 0 }}>
          {TABS.map((item) => (
            <button
              type="button"
              key={item}
              className={`chip ${tab === item ? "active" : ""}`}
              onClick={() => setTab(item)}
            >
              {item}
              {item === "Alerts" && stats?.open_alerts > 0 && (
                <span className="chip-badge">{stats.open_alerts}</span>
              )}
            </button>
          ))}
        </div>

        {/* Plain wrapper for diagnosis: animations are intentionally removed. */}
        <div
          key={tab}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {tab === "Overview" && (
            stats ? (
              <>
                <div className="stat-grid" style={{ marginBottom: 4 }}>
                  <Stat
                    label="Revenue"
                    value={Number(stats.total_revenue ?? 0)}
                    prefix="₹"
                    accent
                  />
                  <Stat
                    label="Completed trips"
                    value={stats.completed_trips ?? 0}
                  />
                  <Stat
                    label="Trips in progress"
                    value={stats.ongoing_trips ?? 0}
                  />
                  <Stat label="Cancelled" value={stats.cancelled_trips ?? 0} />
                  <Stat label="Passengers" value={stats.total_users ?? 0} />
                  <Stat
                    label="Drivers online"
                    value={`${stats.active_drivers ?? 0} / ${stats.total_drivers ?? 0}`}
                  />
                  <Stat
                    label="Avg driver rating"
                    value={
                      stats.avg_driver_rating
                        ? `★ ${Number(stats.avg_driver_rating).toFixed(1)}`
                        : "—"
                    }
                  />
                  <Stat
                    label="Open SOS alerts"
                    value={stats.open_alerts ?? 0}
                    accent={Number(stats.open_alerts) > 0}
                  />
                </div>

                <Card>
                  <h2 className="card-title">Recent trips</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Type</th>
                        <th>Passenger</th>
                        <th>Driver</th>
                        <th>Route</th>
                        <th>Fare</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.slice(0, 10).map((trip) => (
                        <tr key={trip.trip_id}>
                          <td>{trip.trip_id}</td>
                          <td><ServiceTypeBadge type={trip.service_type} /></td>
                          <td>{trip.passenger_name}</td>
                          <td>{trip.driver_name || "—"}</td>
                          <td className="cell-route">
                            {(trip.pickup_location || "—").split(",")[0]} →{" "}
                            {(trip.drop_location || "—").split(",")[0]}
                          </td>
                          <td>₹{trip.fare}</td>
                          <td><StatusBadge status={trip.trip_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            ) : (
              <Card><p className="empty-state">Loading dashboard statistics… If this remains visible, check the browser console for the stats request error.</p></Card>
            )
          )}

          {tab === "Users" && (
            <Card>
              <h2 className="card-title">Passengers ({users.length})</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Email</th><th>Phone</th>
                    <th>Points</th><th>Verified</th><th>Flags</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.user_id}
                      className={!user.is_active ? "row-muted" : ""}
                    >
                      <td>{user.user_id}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td>{user.reward_points}</td>
                      <td>{user.is_verified ? "✓" : "—"}</td>
                      <td>
                        {user.is_flagged && <span className="tag-warn">⚑ flagged</span>}
                        {!user.is_active && <span className="tag-warn"> suspended</span>}
                      </td>
                      <td className="cell-actions">
                        <Toggle
                          on={user.is_flagged}
                          onLabel="Unflag"
                          offLabel="Flag"
                          onClick={() => act(() => A.setUserFlag(token, user.user_id, !user.is_flagged))}
                        />
                        <Toggle
                          on={!user.is_active}
                          onLabel="Reactivate"
                          offLabel="Suspend"
                          onClick={() => act(() => A.setUserActive(token, user.user_id, !user.is_active))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "Drivers" && (
            <Card>
              <h2 className="card-title">Drivers ({drivers.length})</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>License</th><th>Rating</th>
                    <th>Incentive</th><th>Online</th><th>Verified</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr
                      key={driver.driver_id}
                      className={!driver.is_active ? "row-muted" : ""}
                    >
                      <td>{driver.driver_id}</td>
                      <td>
                        {driver.name}
                        <div className="cell-sub">{driver.email}</div>
                      </td>
                      <td>{driver.license_number}</td>
                      <td>★ {Number(driver.rating ?? 0).toFixed(1)}</td>
                      <td>{Number(driver.incentive_score ?? 0).toFixed(0)}</td>
                      <td>
                        {driver.availability_status
                          ? <span className="paid-badge">● online</span>
                          : "—"}
                      </td>
                      <td>{driver.is_verified ? "✓" : "—"}</td>
                      <td className="cell-actions">
                        <Toggle
                          on={driver.is_verified}
                          onLabel="Unverify"
                          offLabel="Verify"
                          onClick={() => act(() => A.setDriverVerified(token, driver.driver_id, !driver.is_verified))}
                        />
                        <Toggle
                          on={!driver.is_active}
                          onLabel="Reactivate"
                          offLabel="Suspend"
                          onClick={() => act(() => A.setDriverActive(token, driver.driver_id, !driver.is_active))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "Trips" && (
            <Card>
              <h2 className="card-title">All trips ({trips.length})</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Type</th><th>Passenger</th><th>Driver</th>
                    <th>Route</th><th>Km</th><th>Fare</th><th>Surge</th>
                    <th>Status</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => (
                    <tr key={trip.trip_id}>
                      <td>{trip.trip_id}</td>
                      <td><ServiceTypeBadge type={trip.service_type} /></td>
                      <td>{trip.passenger_name}</td>
                      <td>{trip.driver_name || "—"}</td>
                      <td className="cell-route">
                        {(trip.pickup_location || "—").split(",")[0]} →{" "}
                        {(trip.drop_location || "—").split(",")[0]}
                      </td>
                      <td>{trip.distance_km}</td>
                      <td>₹{trip.fare}</td>
                      <td>
                        {Number(trip.surge_multiplier) > 1
                          ? `×${Number(trip.surge_multiplier).toFixed(2)}`
                          : "—"}
                        {trip.night_surcharge && " 🌙"}
                      </td>
                      <td><StatusBadge status={trip.trip_status} /></td>
                      <td className="cell-sub">{formatIST(trip.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "Payments" && (
            <Card>
              <h2 className="card-title">Payments ({payments.length})</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Trip</th><th>Amount</th><th>Discount</th>
                    <th>Points used</th><th>Mode</th><th>Status</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.payment_id}>
                      <td>{payment.payment_id}</td>
                      <td>#{payment.trip_id}</td>
                      <td>₹{payment.amount}</td>
                      <td>{Number(payment.discount_applied) > 0 ? `₹${payment.discount_applied}` : "—"}</td>
                      <td>{payment.points_redeemed || "—"}</td>
                      <td>{payment.payment_mode}</td>
                      <td><span className="paid-badge">{payment.payment_status}</span></td>
                      <td className="cell-sub">{formatIST(payment.payment_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "Alerts" && (
            <Card>
              <h2 className="card-title">SOS alerts ({alerts.length})</h2>
              {alerts.length === 0 ? (
                <p className="empty-state">No alerts.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Trip</th><th>User</th><th>Time</th>
                      <th>Location</th><th>Notified</th><th>Status</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alertItem) => (
                      <tr
                        key={alertItem.alert_id}
                        className={alertItem.alert_status === "SENT" ? "row-alert" : ""}
                      >
                        <td>{alertItem.alert_id}</td>
                        <td>#{alertItem.trip_id}</td>
                        <td>#{alertItem.user_id}</td>
                        <td className="cell-sub">{formatIST(alertItem.alert_time)}</td>
                        <td>
                          {alertItem.alert_lat ? (
                            <a
                              href={`https://www.google.com/maps?q=${alertItem.alert_lat},${alertItem.alert_lng}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--accent)" }}
                            >
                              map ↗
                            </a>
                          ) : "—"}
                        </td>
                        <td>
                          {(alertItem.notifications || []).filter((item) => item.delivery_status === "SENT").length}
                          /{(alertItem.notifications || []).length}
                        </td>
                        <td>
                          <span className={`status-badge ${alertItem.alert_status === "ACKNOWLEDGED" ? "status-completed" : "status-cancelled"}`}>
                            {alertItem.alert_status}
                          </span>
                        </td>
                        <td>
                          {alertItem.alert_status === "SENT" && (
                            <button
                              type="button"
                              className="pay-btn"
                              style={{ marginTop: 0 }}
                              onClick={() => act(() => A.acknowledgeAlert(token, alertItem.alert_id))}
                            >
                              Acknowledge
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {tab === "Attractions" && (
            <>
              <Card>
                <h2 className="card-title">Add attraction</h2>
                <div className="form-grid">
                  {["name", "city", "category", "latitude", "longitude"].map((key) => (
                    <div key={key} className="field">
                      <label style={{ textTransform: "capitalize" }}>{key}</label>
                      <input
                        value={newAttr[key]}
                        onChange={(event) => setNewAttr((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))}
                      />
                    </div>
                  ))}
                  <div className="field" style={{ gridColumn: "span 2" }}>
                    <label>Description</label>
                    <input
                      value={newAttr.description}
                      onChange={(event) => setNewAttr((current) => ({
                        ...current,
                        description: event.target.value,
                      }))}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="submit-btn"
                  disabled={!newAttr.name.trim() || !newAttr.latitude || !newAttr.longitude}
                  onClick={() => act(async () => {
                    await A.addAttraction(token, {
                      ...newAttr,
                      latitude: Number(newAttr.latitude),
                      longitude: Number(newAttr.longitude),
                    });
                    setNewAttr({
                      name: "",
                      description: "",
                      city: "",
                      category: "",
                      latitude: "",
                      longitude: "",
                    });
                  })}
                >
                  Add
                </button>
              </Card>

              <Card>
                <h2 className="card-title">Catalogue ({attractions.length})</h2>
                <table className="admin-table">
                  <thead>
                    <tr><th>#</th><th>Name</th><th>City</th><th>Category</th><th>Coords</th><th></th></tr>
                  </thead>
                  <tbody>
                    {attractions.map((attraction) => (
                      <tr key={attraction.attraction_id}>
                        <td>{attraction.attraction_id}</td>
                        <td>{attraction.name}</td>
                        <td>{attraction.city}</td>
                        <td>{attraction.category}</td>
                        <td className="cell-sub">{attraction.latitude}, {attraction.longitude}</td>
                        <td>
                          <button
                            type="button"
                            className="cancel-link"
                            onClick={() => act(() => A.deleteAttraction(token, attraction.attraction_id))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      </Page>
    </div>
  );
}
