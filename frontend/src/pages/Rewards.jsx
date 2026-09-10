import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, fetchCurrentUser } from "../api/auth";
import { getMyRewards } from "../api/rewards";
import Navbar from "../components/Navbar";
import { Page, Card, Counter } from "../components/motion";

export default function Rewards() {
  const navigate = useNavigate(); const session = getSession();
  const [profile, setProfile] = useState(null); const [data, setData] = useState(null);
  useEffect(() => { fetchCurrentUser(session.token).then(setProfile).catch(() => navigate("/login")); getMyRewards(session.token).then(setData).catch(() => {}); }, [session.token, navigate]);
  const pts = data?.reward_points ?? 0;
  return (
    <div className="dashboard-shell">
      <Navbar role="user" name={profile?.name} />
      <Page className="dashboard-content">
        <Card className="reward-hero">
          <div className="reward-points-big"><Counter value={pts} /></div>
          <div className="reward-sub">reward points, worth ₹{pts}</div>
          <p className="muted" style={{ marginTop: 12, maxWidth: 420, marginInline: "auto" }}>You earn 10 points for every trip you pay for. Spend them at checkout, 1 point per rupee, on up to half the fare.</p>
        </Card>
        <Card>
          <h2 className="card-title">Activity</h2>
          {!data ? <p className="empty-state">Loading…</p> : data.history.length === 0 ? <p className="empty-state">Complete a trip to start earning.</p> : (
            <div className="trip-list">{data.history.map((h) => (
              <div key={h.reward_txn_id} className="trip-list-item">
                <div><div className="trip-list-route">{h.reason === "trip_completed" ? "Trip completed" : h.reason === "redeemed_discount" ? "Redeemed at checkout" : h.reason}</div><div className="trip-list-meta">{new Date(h.created_at).toLocaleString()}{h.trip_id && `, trip #${h.trip_id}`}</div></div>
                <span style={{ fontWeight: 800, fontSize: 15, color: h.points_change > 0 ? "var(--positive)" : "var(--danger)" }}>{h.points_change > 0 ? "+" : ""}{h.points_change}</span>
              </div>))}</div>
          )}
        </Card>
      </Page>
    </div>
  );
}