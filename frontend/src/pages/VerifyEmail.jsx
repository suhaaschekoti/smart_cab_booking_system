import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import AuthShell from "../components/AuthShell";
import { Button } from "../components/motion";
import { useNavigate } from "react-router-dom";

export default function VerifyEmail() {
  const [sp] = useSearchParams(); const navigate = useNavigate();
  const token = sp.get("token"), role = sp.get("role");
  const [status, setStatus] = useState("verifying"); const [message, setMessage] = useState("");
  useEffect(() => {
    if (!token || !role) { setStatus("error"); setMessage("This verification link is missing required information."); return; }
    verifyEmail(role, token).then((d) => { setStatus("success"); setMessage(d.message); })
      .catch((err) => { setStatus("error"); setMessage(err?.response?.data?.detail || "This verification link is invalid or has expired."); });
  }, [token, role]);
  return (
    <AuthShell>
      <div className="success-panel">
        {status === "verifying" && <p className="auth-sub">Verifying your email…</p>}
        {status === "success" && <><div className="success-icon">✓</div><h1 className="auth-title">Email verified</h1><p className="auth-sub">{message}</p><Button className="btn-block" onClick={() => navigate("/login")}>Go to sign in</Button></>}
        {status === "error" && <><div className="error-msg" style={{ textAlign: "left" }}>{message}</div><Link to="/login">Back to sign in</Link></>}
      </div>
    </AuthShell>
  );
}