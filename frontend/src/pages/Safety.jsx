import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, fetchCurrentUser } from "../api/auth";
import { getMyAlerts } from "../api/emergency";
import EmergencyContacts from "../components/EmergencyContacts";
import Navbar from "../components/Navbar";
import { Page, Card } from "../components/motion";

export default function Safety() {
  const navigate = useNavigate(); const session = getSession();
  const [profile, setProfile] = useState(null); const [alerts, setAlerts] = useState([]);
  useEffect(() => { fetchCurrentUser(session.token).then(setProfile).catch(() => navigate("/login")); getMyAlerts(session.token).then(setAlerts).catch(() => {}); }, [session.token, navigate]);
  return (
    <div className="dashboard-shell">
      <Navbar role="user" name={profile?.name} onProfileUpdated={setProfile} />
      <Page className="dashboard-content">
        <Card>
          <h2 className="card-title">Emergency contacts</h2>
          <p className="muted" style={{ marginBottom: 16 }}>During a trip, the SOS button emails these people your live location, route, and driver details. Add up to five.</p>
          <EmergencyContacts token={session.token} />
        </Card>
        <Card>
          <h2 className="card-title">Alert history</h2>
          {alerts.length === 0 ? <p className="empty-state">No alerts sent.</p> : (
            <div className="trip-list">{alerts.map((a) => (
              <div key={a.alert_id} className="trip-list-item">
                <div><div className="trip-list-route">Trip #{a.trip_id}</div><div className="trip-list-meta">{new Date(a.alert_time).toLocaleString()}, {a.notifications.filter((n) => n.delivery_status === "SENT").length} notified{a.alert_lat && <> · <a href={`https://www.google.com/maps?q=${a.alert_lat},${a.alert_lng}`} target="_blank" rel="noreferrer">location</a></>}</div></div>
                <span className={`status-badge ${a.alert_status === "ACKNOWLEDGED" ? "status-completed" : "status-cancelled"}`}>{a.alert_status === "ACKNOWLEDGED" ? "Acknowledged" : "Sent"}</span>
              </div>))}</div>
          )}
        </Card>
      </Page>
    </div>
  );
}