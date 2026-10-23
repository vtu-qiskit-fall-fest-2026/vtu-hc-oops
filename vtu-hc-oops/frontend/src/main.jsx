import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import FactoryDashboard from "./components/FactoryDashboard.jsx";
import FactoryLoads from "./components/FactoryLoads.jsx";
import WorkspacePlaceholder from "./components/WorkspacePlaceholder.jsx";
import MatchedTrucks from "./components/MatchedTrucks.jsx";
import ConfirmBooking from "./components/ConfirmBooking.jsx";
import CostSavings from "./components/CostSavings.jsx";
import FleetOptimizer from "./components/FleetOptimizer.jsx";
import BrokerDashboard from "./components/broker/BrokerDashboard.jsx";
import TransporterDashboard from "./components/TransporterDashboard.jsx";
import SubscriptionPage from "./components/SubscriptionPage.jsx";
import "./components/SubscriptionPage.css";
import RoleBackground from "./components/RoleBackground.jsx";
import ShipmentConfirmation from "./components/ShipmentConfirmation.jsx";
import ShipmentTerms from "./components/ShipmentTerms.jsx";

import { initializeLoadsetuTheme, setLoadsetuTheme } from "./theme.js";

import "./styles.css";
import "./factory-loads.css";
import "./components/ConfirmBooking.css";

initializeLoadsetuTheme();

// Protect pages that require authentication or a specific role.
function Protected({ children, roles }) {
  const token = localStorage.getItem("loadsetu-token");

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("loadsetu-user") || "null");
  } catch {
    user = null;
  }

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(String(user.role || "").toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  const role = String(user.role || "").toLowerCase();
  if (role !== "broker" && ["PENDING_VERIFICATION", "REJECTED"].includes(String(user.verificationStatus || "VERIFIED"))) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Factory loads page.
function FactoryLoadsRoute() {
  const navigate = useNavigate();

  return <FactoryLoads onBack={() => navigate("/factory/dashboard")} />;
}

// Confirm Booking page.
function FactoryBookingRoute() {
  const navigate = useNavigate();

  const [language, setLanguage] = useState(
    () => localStorage.getItem("loadsetu-language") || "en",
  );

  const [theme, setTheme] = useState(() => {
    return (
      localStorage.getItem("loadsetu-theme") ||
      document.documentElement.getAttribute("data-theme") ||
      "dark"
    );
  });

  function handleLanguageChange(nextLanguage) {
    setLanguage(nextLanguage);
    localStorage.setItem("loadsetu-language", nextLanguage);

    window.dispatchEvent(
      new CustomEvent("loadsetu-language-change", {
        detail: nextLanguage,
      }),
    );
  }

  function handleThemeChange(nextTheme) {
    setTheme(nextTheme);
    localStorage.setItem("loadsetu-theme", nextTheme);
    setLoadsetuTheme(nextTheme);
  }

  return (
    <ConfirmBooking
      language={language}
      onLanguageChange={handleLanguageChange}
      theme={theme}
      onThemeChange={handleThemeChange}
      onBack={() => navigate("/factory/matches")}
      onEditLoad={() => navigate("/factory/loads")}
      onChangeTruck={() => navigate("/factory/matches")}
    />
  );
}

// Broker and transporter dashboard placeholders.
function RoleHome({ role }) {
  return (
    <WorkspacePlaceholder
      title={`${role} dashboard`}
      description={`Your ${role.toLowerCase()} tools will be available here. Your LOADSETU account is connected successfully.`}
    />
  );
}

// Other factory feature placeholders.
function FactoryFeature({ titleKey, descriptionKey }) {
  return (
    <WorkspacePlaceholder titleKey={titleKey} descriptionKey={descriptionKey} />
  );
}

function AppRoutes() {
  return (
    <>
      <RoleBackground />
      <div className="loadsetu-route-layer">
    <Routes>
      <Route path="/shipment-confirmation/:token" element={<ShipmentConfirmation />} />
      <Route path="/shipment-terms" element={<ShipmentTerms />} />
      {/* Login and signup */}
      <Route path="/" element={<App />} />

      {/* Factory dashboard */}
      <Route
        path="/factory/dashboard"
        element={
          <Protected roles={["shipper", "factory"]}>
            <FactoryDashboard />
          </Protected>
        }
      />

      {/* Create Load and My Loads */}
      <Route
        path="/factory/loads"
        element={
          <Protected roles={["shipper", "factory"]}>
            <FactoryLoadsRoute />
          </Protected>
        }
      />

      {/* Matched Trucks */}
      <Route
        path="/factory/matches"
        element={
          <Protected roles={["shipper", "factory"]}>
            <MatchedTrucks />
          </Protected>
        }
      />

      {/* Confirm Booking */}
      <Route
        path="/factory/bookings"
        element={
          <Protected roles={["shipper", "factory"]}>
            <FactoryBookingRoute />
          </Protected>
        }
      />

      {/* Shipment Status */}
      <Route
        path="/factory/shipments"
        element={
          <Protected roles={["shipper", "factory"]}>
            <Navigate to="/factory/loads?tab=mine" replace />
          </Protected>
        }
      />

      {/* Cost and Savings */}
      <Route
        path="/factory/savings"
        element={
          <Protected roles={["shipper", "factory"]}>
            <CostSavings />
          </Protected>
        }
      />
      <Route
        path="/factory/optimizer"
        element={
          <Protected roles={["shipper", "factory"]}>
            <FleetOptimizer />
          </Protected>
        }
      />

      {/* Subscription plans and local Razorpay checkout */}
      <Route
        path="/subscription"
        element={
          <Protected roles={["shipper", "factory", "transporter"]}>
            <SubscriptionPage />
          </Protected>
        }
      />

      {/* Broker dashboard */}
      <Route
        path="/broker/dashboard"
        element={
          <Protected roles={["broker"]}>
            <BrokerDashboard />
          </Protected>
        }
      />

      {/* Transporter dashboard */}
      <Route
        path="/transporter/dashboard"
        element={
          <Protected roles={["transporter"]}>
            <TransporterDashboard />
          </Protected>
        }
      />

      {/* Unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>,
);
