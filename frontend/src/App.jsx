import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PassengerDashboard from "./pages/PassengerDashboard";
import TourGuide from "./pages/TourGuide";
import Rewards from "./pages/Rewards";
import Safety from "./pages/Safety";
import DriverDashboard from "./pages/DriverDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const P = (role, el) => <ProtectedRoute role={role}>{el}</ProtectedRoute>;

function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname}
        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.16 }}>
        <Routes location={location}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={P("user", <PassengerDashboard />)} />
          <Route path="/tours" element={P("user", <TourGuide />)} />
          <Route path="/rewards" element={P("user", <Rewards />)} />
          <Route path="/safety" element={P("user", <Safety />)} />
          <Route path="/driver/dashboard" element={P("driver", <DriverDashboard />)} />
          <Route path="/admin" element={P("admin", <AdminDashboard />)} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return <BrowserRouter><AnimatedRoutes /></BrowserRouter>;
}