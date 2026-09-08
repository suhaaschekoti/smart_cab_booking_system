import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEmail } from "../api/auth";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const role = searchParams.get("role");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !role) {
      setStatus("error");
      setMessage("This verification link is missing required information.");
      return;
    }
    verifyEmail(role, token)
      .then((data) => {
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err?.response?.data?.detail || "This verification link is invalid or has expired.");
      });
  }, [token, role]);

  return (
    <div className="page">
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mark">SC</div>
          <div className="brand-name">Smart Cab Booking</div>
        </div>

        <div className="success-panel">
          {status === "verifying" && (
            <>
              <p style={{ margin: 0, color: "var(--text-dim)" }}>Verifying your email...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="success-icon">&#10003;</div>
              <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>Email verified</p>
              <p style={{ margin: "0 0 20px 0", color: "var(--text-dim)", fontSize: 13 }}>{message}</p>
              <Link to="/login" className="submit-btn" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
                Go to login
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="error-msg" style={{ marginBottom: 20 }}>{message}</div>
              <Link to="/login" style={{ color: "var(--accent)", fontSize: 13 }}>
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}