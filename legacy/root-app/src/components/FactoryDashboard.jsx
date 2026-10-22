
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  Languages,
  Leaf,
  LogOut,
  Moon,
  PackagePlus,
  Route,
  Sun,
  Truck,
  WalletCards,
  Waypoints,
  MapPin,
  MessageCircle,
  RefreshCw
} from "lucide-react";

import { getLoadsetuTheme, setLoadsetuTheme } from "../theme.js";
import { useLoadsetuLanguage } from "../hooks/useLoadsetuLanguage.js";
import LoadsetuMap from "./LoadsetuMap";
import { getMyBookings } from "../services/bookingApi.js";
import "../factory-panel.css";

export default function FactoryDashboard() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLoadsetuLanguage();

  const [theme, setTheme] = useState(getLoadsetuTheme());
  const [bookings, setBookings] = useState([]);
  const [bookingError, setBookingError] = useState("");
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("loadsetu-user") || "{}");
    } catch {
      return {};
    }
  })();

  useEffect(() => {
    const update = event =>
      setTheme(event.detail || getLoadsetuTheme());

    window.addEventListener("loadsetu-theme-change", update);

    return () =>
      window.removeEventListener("loadsetu-theme-change", update);
  }, []);

  const refreshBookings = async () => {
    setBookingsLoading(true);
    setBookingError("");
    try {
      const result = await getMyBookings();
      setBookings(result.bookings || []);
    } catch (error) {
      setBookingError(error.message || "Could not load booking updates.");
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    refreshBookings();
    const timer = window.setInterval(refreshBookings, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const contactTransporter = booking => {
    const phone = String(booking.transporter?.phone || "").replace(/\D/g, "");
    if (!phone) {
      setBookingError("The assigned transporter has not added a phone number yet.");
      return;
    }
    const message = `Hello ${booking.transporter?.name || "Transporter"},\n\nGreetings from LOADSETU!\n\nWe are coordinating booking ${String(booking._id).slice(-7).toUpperCase()}.\nRoute: ${booking.load?.pickup || "—"} to ${booking.load?.destination || "—"}\nGoods: ${booking.load?.material || booking.load?.title || "Shipment"}\nQuantity: ${booking.load?.weightTonnes || "—"} Tonnes\nAgreed cost: ₹${Number(booking.agreedPrice || 0).toLocaleString("en-IN")}\nFactory: ${user.name || booking.load?.factoryName || "Factory owner"}\n\nPlease contact us here to coordinate pickup and delivery.\n\nRegards,\n${user.name || "Factory Owner"}\nTeam LOADSETU`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const changeTheme = next => {
    setLoadsetuTheme(next);
    setTheme(next);
  };

  const logout = () => {
    localStorage.removeItem("loadsetu-token");
    localStorage.removeItem("loadsetu-user");
    navigate("/", { replace: true });
  };

  const actions = [
    {
      title: t("createLoad"),
      desc: t("createLoadDesc"),
      icon: PackagePlus,
      path: "/factory/loads",
      tag: t("newShipment"),
      primary: true
    },
    {
      title: t("loadOverview"),
      desc: t("myLoadsDesc"),
      icon: ClipboardList,
      path: "/factory/loads?tab=mine",
      tag: t("loadManagement")
    },
    {
      title: t("matchedTrucks"),
      desc: t("matchedDesc"),
      icon: Truck,
      path: "/factory/matches",
      tag: t("smartMatching")
    },
    {
      title: t("confirmBooking"),
      desc: t("bookingDesc"),
      icon: CheckCircle2,
      path: "/factory/bookings",
      tag: t("bookingDesk")
    },
    {
      title: t("shipmentStatus"),
      desc: t("shipmentDesc"),
      icon: Route,
      path: "/factory/shipments",
      tag: t("liveWorkflow")
    },
    {
      title: t("costSavings"),
      desc: t("savingsDesc"),
      icon: WalletCards,
      path: "/factory/savings",
      tag: t("costIntelligence")
    }
  ];

  return (
    <main
      className={`workspace-page ${
        theme === "light" ? "workspace-light" : "workspace-dark"
      }`}
    >
      <div className="workspace-ambient" aria-hidden="true">
        <span className="ambient-orb orb-a" />
        <span className="ambient-orb orb-b" />
        <div className="ambient-route route-a" />
        <div className="ambient-route route-b" />
        <div className="ambient-truck">
          <Truck size={21} />
          <span>LOADSETU</span>
        </div>
        <div className="ambient-grid" />
      </div>

      <header className="workspace-header">
        <button
          className="workspace-brand"
          onClick={() => navigate("/factory/dashboard")}
          aria-label={t("dashboardHome")}
        >
          <span className="workspace-brand-mark">
            <Waypoints size={22} />
          </span>
          <span>
            <strong>LOADSETU</strong>
            <small>{t("factoryPanel")}</small>
          </span>
        </button>

        <div className="workspace-header-actions">
          <label
            className="dashboard-language"
            title={t("languageLabel")}
          >
            <Languages size={16} />
            <select
              aria-label={t("languageLabel")}
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="mr">मराठी</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>

          <div className="theme-control" aria-label={t("theme")}>
            <button
              type="button"
              className={theme === "light" ? "active" : ""}
              onClick={() => changeTheme("light")}
              aria-pressed={theme === "light"}
            >
              <Sun size={16} />
              <span>{t("light")}</span>
            </button>

            <button
              type="button"
              className={theme === "dark" ? "active" : ""}
              onClick={() => changeTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              <Moon size={16} />
              <span>{t("dark")}</span>
            </button>
          </div>

          <button
            className="workspace-icon-button"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={17} />
            <i />
          </button>

          <button className="workspace-logout" onClick={logout}>
            <LogOut size={16} />
            <span>{t("logout")}</span>
          </button>
        </div>
      </header>

      <section className="workspace-hero">
        <div className="workspace-hero-copy">
          <p className="workspace-eyebrow">
            <span />
            {t("eyebrowFactory")}
            <span className="eyebrow-line" />
          </p>

          <h1>
            {t("heroLine1")}
            <br />
            <em>{t("heroLine2")}</em>
          </h1>

          <p className="workspace-lede">
            {t("welcome")},{" "}
            <strong>{user.name || t("factoryPartner")}</strong>.{" "}
            {t("heroDescription")}
          </p>

          <div className="workspace-hero-actions">
            <button
              className="workspace-primary"
              onClick={() => navigate("/factory/loads")}
            >
              <PackagePlus size={18} />
              {t("createLoad")}
              <ArrowRight size={17} />
            </button>

            <button
              className="workspace-secondary"
              onClick={() =>
                navigate("/factory/loads?tab=mine")
              }
            >
              <ClipboardList size={17} />
              {t("viewLoads")}
            </button>
          </div>
        </div>

        <div
          className="hero-visual"
          aria-label="Animated logistics route illustration"
        >
          <div className="hero-visual-glow" />
          <div className="route-ring ring-one" />
          <div className="route-ring ring-two" />

          <div className="route-node node-one">
            <span />
            <small>{t("origin")}</small>
          </div>

          <div className="route-node node-two">
            <span />
            <small>{t("destinationTag")}</small>
          </div>

          <div className="route-line">
            <i />
          </div>

          <div className="hero-truck-card">
            <div className="hero-truck-icon">
              <Truck size={26} />
            </div>
            <div>
              <strong>{t("inMotion")}</strong>
              <small>{t("routeTagline")}</small>
            </div>
            <Activity size={18} />
          </div>

          <div className="floating-chip chip-top">
            <CheckCircle2 size={15} />
            {t("matchReady")}
          </div>

          <div className="floating-chip chip-bottom">
            <Leaf size={15} />
            {t("fewerEmpty")}
          </div>
        </div>
      </section>

      <section
        className="workspace-metrics"
        aria-label={t("operations")}
      >
        <article className="metric-card">
          <span className="metric-icon">
            <ClipboardList size={18} />
          </span>
          <div>
            <small>{t("loadOverview")}</small>
            <strong>{t("manage")}</strong>
            <p>{t("allRequests")}</p>
          </div>
          <ArrowDownRight size={17} className="metric-trend" />
        </article>

        <article className="metric-card">
          <span className="metric-icon">
            <Waypoints size={18} />
          </span>
          <div>
            <small>{t("truckMatching")}</small>
            <strong>{t("compare")}</strong>
            <p>{t("capacityRouteQuote")}</p>
          </div>
          <ArrowDownRight size={17} className="metric-trend" />
        </article>

        <article className="metric-card">
          <span className="metric-icon">
            <Route size={18} />
          </span>
          <div>
            <small>{t("shipmentControl")}</small>
            <strong>{t("track")}</strong>
            <p>{t("pickupDelivery")}</p>
          </div>
          <ArrowDownRight size={17} className="metric-trend" />
        </article>

        <article className="metric-card">
          <span className="metric-icon">
            <Leaf size={18} />
          </span>
          <div>
            <small>{t("efficiency")}</small>
            <strong>{t("reduceEmpty")}</strong>
            <p>{t("returnLoads")}</p>
          </div>
          <ArrowDownRight size={17} className="metric-trend" />
        </article>
      </section>

      {/* Booking responses shared by the transporter and broker */}
      <section className="factory-booking-updates">
        <div className="factory-tracking-heading">
          <div>
            <p className="workspace-eyebrow">BOOKING UPDATES</p>
            <h2>Transporter Confirmation</h2>
            <p>See booking requests, acceptance or rejection, and contact the assigned transporter.</p>
          </div>
          <button className="workspace-secondary" onClick={refreshBookings} disabled={bookingsLoading}>
            <RefreshCw size={16} /> {bookingsLoading ? "Refreshing…" : "Refresh updates"}
          </button>
        </div>
        {bookingError && <p className="factory-booking-error" role="alert">{bookingError}</p>}
        {bookings.length === 0 && !bookingsLoading && !bookingError && <p className="factory-booking-empty">No booking requests yet. Once the broker matches a transporter, the request will appear here.</p>}
        <div className="factory-booking-list">
          {bookings.map(booking => (
            <article className="factory-booking-card" key={booking._id}>
              <div className="factory-booking-copy">
                <strong>{booking.load?.pickup || "—"} → {booking.load?.destination || "—"}</strong>
                <span>{booking.load?.material || booking.load?.title || "Shipment"} · {booking.load?.weightTonnes || "—"} Tonnes</span>
                <span>Transporter: {booking.transporter?.name || "Awaiting assignment"}</span>
                <span>Phone: {booking.transporter?.phone || "Not provided"}</span>
                <span>Vehicle: {booking.truck?.registrationNumber || "Pending"} · Agreed cost: ₹{Number(booking.agreedPrice || 0).toLocaleString("en-IN")}</span>
                {booking.status === "Rejected" && <p className="factory-rejection-notice">Transporter rejected this booking.{booking.rejectionReason ? ` Reason: ${booking.rejectionReason}` : " The load is available for another broker match."}</p>}
                {booking.status === "Pending" && <p className="factory-pending-notice">Waiting for transporter to accept or reject.</p>}
              </div>
              <div className="factory-booking-actions">
                <span className={`factory-booking-status status-${String(booking.status).toLowerCase().replace(/\s+/g, "-")}`}>{booking.status}</span>
                {booking.transporter?.phone && <button className="workspace-secondary" onClick={() => contactTransporter(booking)}><MessageCircle size={15} /> WhatsApp transporter</button>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* NEW: Factory shipment map */}
      <section className="factory-tracking-section">
        <div className="factory-tracking-heading">
          <div>
            <p className="workspace-eyebrow">
              <MapPin size={15} />
              SHIPMENT TRACKING
            </p>
            <h2>Track Your Shipments</h2>
            <p>
              View pickup and delivery locations on the map.
              Live truck tracking will be connected to your shipment data.
            </p>
          </div>

          <button
            className="workspace-secondary"
            onClick={() => navigate("/factory/shipments")}
          >
            <Route size={17} />
            View Shipments
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="factory-tracking-map">
          <LoadsetuMap
            pickup={{ lat: 16.705, lng: 74.243 }}
            destination={{ lat: 19.076, lng: 72.877 }}
          />
        </div>

        <p className="factory-map-note">
          Demo route: Kolhapur to Mumbai. These are sample locations,
          not a real shipment or live truck position.
        </p>
      </section>

      <section className="workspace-section-heading">
        <div>
          <p className="workspace-eyebrow">{t("operations")}</p>
          <h2>{t("whatNext")}</h2>
          <p>{t("chooseWorkspace")}</p>
        </div>

        <span className="section-status">
          <span />
          {t("systemWorkspace")}
        </span>
      </section>

      <section className="workspace-action-grid">
        {actions.map((item, index) => {
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              className={`workspace-action-card ${
                item.primary ? "primary" : ""
              }`}
              style={{ "--card-index": index }}
              onClick={() => navigate(item.path)}
            >
              <div className="action-card-top">
                <span className="action-icon">
                  <Icon size={20} />
                </span>
                <span className="action-tag">{item.tag}</span>
                <ArrowRight size={17} className="action-arrow" />
              </div>

              <h3>{item.title}</h3>
              <p>{item.desc}</p>

              <span className="action-card-bottom">
                {t("openWorkspace")}
                <ArrowRight size={14} />
              </span>
            </button>
          );
        })}
      </section>

      <footer className="workspace-footer">
        <span>© {new Date().getFullYear()} LOADSETU</span>
        <span>
          <i /> {t("footerTag")}
        </span>
        <span>{t("footerLine")}</span>
      </footer>
    </main>
  );
}
