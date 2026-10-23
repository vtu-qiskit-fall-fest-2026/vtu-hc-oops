
import React, { useState } from "react";
import "./ConfirmBooking.css";

const translations = {
  en: {
    back: "Back",
    title: "Confirm Your Booking",
    subtitle: "Review the shipment and truck details before confirming.",
    shipment: "Shipment Details",
    truck: "Selected Truck",
    driver: "Driver Details",
    pickup: "Pickup Location",
    destination: "Delivery Location",
    material: "Material",
    weight: "Load Weight",
    pickupDate: "Pickup Date",
    truckType: "Truck Type",
    registration: "Vehicle Number",
    capacity: "Truck Capacity",
    name: "Driver Name",
    phone: "Contact Number",
    price: "Agreed Freight Price",
    fee: "Booking Fee",
    total: "Total Amount",
    editLoad: "Edit Load",
    changeTruck: "Change Truck",
    confirm: "Confirm Booking",
    confirming: "Confirming...",
    success: "Booking confirmed successfully!",
    demo: "Demo booking details are displayed. Connect your booking API to save a real booking.",
    profile: "View Driver Profile",
    close: "Close",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    required: "Please review the booking details before continuing.",
  },
  mr: {
    back: "मागे",
    title: "बुकिंग निश्चित करा",
    subtitle: "बुकिंग निश्चित करण्यापूर्वी माल आणि ट्रकची माहिती तपासा.",
    shipment: "मालाची माहिती",
    truck: "निवडलेला ट्रक",
    driver: "चालकाची माहिती",
    pickup: "माल उचलण्याचे ठिकाण",
    destination: "पोहोचवण्याचे ठिकाण",
    material: "मालाचा प्रकार",
    weight: "मालाचे वजन",
    pickupDate: "माल उचलण्याची तारीख",
    truckType: "ट्रकचा प्रकार",
    registration: "वाहन क्रमांक",
    capacity: "ट्रकची क्षमता",
    name: "चालकाचे नाव",
    phone: "संपर्क क्रमांक",
    price: "ठरलेले भाडे",
    fee: "बुकिंग शुल्क",
    total: "एकूण रक्कम",
    editLoad: "मालाची माहिती बदला",
    changeTruck: "ट्रक बदला",
    confirm: "बुकिंग निश्चित करा",
    confirming: "निश्चित करत आहे...",
    success: "बुकिंग यशस्वीरीत्या निश्चित झाली!",
    demo: "ही प्रात्यक्षिक बुकिंग माहिती आहे. खरी बुकिंग जतन करण्यासाठी API जोडा.",
    profile: "चालकाची माहिती पहा",
    close: "बंद करा",
    language: "भाषा",
    theme: "थीम",
    light: "लाइट",
    dark: "डार्क",
    required: "पुढे जाण्यापूर्वी बुकिंगची माहिती तपासा.",
  },
  hi: {
    back: "वापस",
    title: "बुकिंग की पुष्टि करें",
    subtitle: "पुष्टि करने से पहले माल और ट्रक की जानकारी जाँचें।",
    shipment: "माल की जानकारी",
    truck: "चुना गया ट्रक",
    driver: "ड्राइवर की जानकारी",
    pickup: "माल उठाने का स्थान",
    destination: "डिलीवरी का स्थान",
    material: "माल का प्रकार",
    weight: "माल का वजन",
    pickupDate: "माल उठाने की तारीख",
    truckType: "ट्रक का प्रकार",
    registration: "वाहन नंबर",
    capacity: "ट्रक की क्षमता",
    name: "ड्राइवर का नाम",
    phone: "संपर्क नंबर",
    price: "तय किया गया किराया",
    fee: "बुकिंग शुल्क",
    total: "कुल राशि",
    editLoad: "माल की जानकारी बदलें",
    changeTruck: "ट्रक बदलें",
    confirm: "बुकिंग की पुष्टि करें",
    confirming: "पुष्टि हो रही है...",
    success: "बुकिंग सफलतापूर्वक कन्फर्म हुई!",
    demo: "यह डेमो बुकिंग जानकारी है। वास्तविक बुकिंग सेव करने के लिए API जोड़ें।",
    profile: "ड्राइवर की प्रोफ़ाइल देखें",
    close: "बंद करें",
    language: "भाषा",
    theme: "थीम",
    light: "लाइट",
    dark: "डार्क",
    required: "आगे बढ़ने से पहले बुकिंग की जानकारी जाँचें।",
  },
};

const demoBooking = {
  id: "LS-2026-001",
  pickup: "Pune, Maharashtra",
  destination: "Kolhapur, Maharashtra",
  material: "Steel Products",
  weightTonnes: 10,
  pickupDate: "2026-10-20",
  truckType: "14-Wheeler Truck",
  vehicleNumber: "MH 12 AB 1234",
  capacityTonnes: 15,
  driverName: "Rajesh Patil",
  driverPhone: "+91 98765 43210",
  freightPrice: 18000,
  bookingFee: 500,
};

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function Detail({ label, value }) {
  return (
    <div className="cb-detail">
      <span className="cb-detail-label">{label}</span>
      <strong className="cb-detail-value">{value || "—"}</strong>
    </div>
  );
}

export function ConfirmBooking({
  booking = demoBooking,
  onBack,
  onEditLoad,
  onChangeTruck,
  onConfirmBooking,
  language: languageProp,
  onLanguageChange,
  theme: themeProp,
  onThemeChange,
}) {
  const [localLanguage, setLocalLanguage] = useState(
    () => localStorage.getItem("loadsetu-language") || "en"
  );

  const [localTheme, setLocalTheme] = useState(
    () =>
      localStorage.getItem("loadsetu-theme") ||
      document.documentElement.getAttribute("data-theme") ||
      "dark"
  );

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [showDriver, setShowDriver] = useState(false);

  const language = languageProp || localLanguage;
  const theme = themeProp || localTheme;
  const t = translations[language] || translations.en;

  const freightPrice = Number(booking?.freightPrice ?? booking?.offeredPrice ?? 18000);
  const bookingFee = Number(booking?.bookingFee ?? 500);
  const total = freightPrice + bookingFee;

  function changeLanguage(nextLanguage) {
    setLocalLanguage(nextLanguage);
    localStorage.setItem("loadsetu-language", nextLanguage);
    onLanguageChange?.(nextLanguage);
  }

  function changeTheme(nextTheme) {
    setLocalTheme(nextTheme);
    localStorage.setItem("loadsetu-theme", nextTheme);
    onThemeChange?.(nextTheme);
  }

  async function handleConfirm() {
    setError("");
    setIsConfirming(true);

    try {
      if (typeof onConfirmBooking !== "function") {
        setError(t.demo);
        return;
      }

      await onConfirmBooking(booking);
      setConfirmed(true);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to confirm the booking. Please try again."
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <main className={`confirm-booking-page cb-theme-${theme}`}>
      <header className="cb-header">
        <button
          type="button"
          className="cb-back-button"
          onClick={onBack}
        >
          ← {t.back}
        </button>

        <div className="cb-header-controls">
          <label className="cb-control">
            <span>{t.language}</span>
            <select
              value={language}
              onChange={(event) => changeLanguage(event.target.value)}
              aria-label={t.language}
            >
              <option value="en">English</option>
              <option value="mr">मराठी</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>

          <label className="cb-control">
            <span>{t.theme}</span>
            <select
              value={theme}
              onChange={(event) => changeTheme(event.target.value)}
              aria-label={t.theme}
            >
              <option value="dark">{t.dark}</option>
              <option value="light">{t.light}</option>
            </select>
          </label>
        </div>
      </header>

      <section className="cb-page-heading">
        <div className="cb-eyebrow">LOADSETU / BOOKING</div>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
        {booking?.id && (
          <span className="cb-booking-id">
            Booking reference: {booking.id}
          </span>
        )}
      </section>

      {confirmed && (
        <div className="cb-success" role="status">
          <span className="cb-status-icon">✓</span>
          <div>
            <strong>{t.success}</strong>
            <p>{booking?.id ? `Reference: ${booking.id}` : t.demo}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="cb-error" role="alert">
          {error}
        </div>
      )}

      <div className="cb-content-grid">
        <section className="cb-card cb-shipment-card">
          <div className="cb-card-heading">
            <span className="cb-card-icon">📦</span>
            <div>
              <h2>{t.shipment}</h2>
              <p>Shipment route and cargo information</p>
            </div>
          </div>

          <div className="cb-route">
            <div className="cb-route-point">
              <span className="cb-route-dot cb-pickup-dot" />
              <div>
                <span className="cb-detail-label">{t.pickup}</span>
                <strong>{booking?.pickup || "—"}</strong>
              </div>
            </div>

            <div className="cb-route-line" />

            <div className="cb-route-point">
              <span className="cb-route-dot cb-destination-dot" />
              <div>
                <span className="cb-detail-label">{t.destination}</span>
                <strong>{booking?.destination || "—"}</strong>
              </div>
            </div>
          </div>

          <div className="cb-details-grid">
            <Detail
              label={t.material}
              value={booking?.material || "General Cargo"}
            />
            <Detail
              label={t.weight}
              value={`${booking?.weightTonnes ?? booking?.weight ?? "—"} ${
                booking?.weightTonnes != null || booking?.weight != null
                  ? "tonnes"
                  : ""
              }`}
            />
            <Detail
              label={t.pickupDate}
              value={
                booking?.pickupDate
                  ? new Date(`${booking.pickupDate}T00:00:00`).toLocaleDateString(
                      language === "mr"
                        ? "mr-IN"
                        : language === "hi"
                          ? "hi-IN"
                          : "en-IN",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }
                    )
                  : "—"
              }
            />
          </div>

          <button
            type="button"
            className="cb-secondary-button"
            onClick={onEditLoad}
          >
            {t.editLoad}
          </button>
        </section>

        <section className="cb-card cb-truck-card">
          <div className="cb-card-heading">
            <span className="cb-card-icon">🚚</span>
            <div>
              <h2>{t.truck}</h2>
              <p>Transport details for this shipment</p>
            </div>
          </div>

          <div className="cb-truck-illustration" aria-hidden="true">
            <span>🚛</span>
            <div>
              <strong>{booking?.truckType || "Truck not specified"}</strong>
              <span>{booking?.vehicleNumber || "Vehicle number pending"}</span>
            </div>
          </div>

          <div className="cb-details-grid">
            <Detail
              label={t.truckType}
              value={booking?.truckType || "—"}
            />
            <Detail
              label={t.registration}
              value={booking?.vehicleNumber || booking?.registrationNumber || "—"}
            />
            <Detail
              label={t.capacity}
              value={
                booking?.capacityTonnes != null
                  ? `${booking.capacityTonnes} tonnes`
                  : "—"
              }
            />
          </div>

          <button
            type="button"
            className="cb-secondary-button"
            onClick={onChangeTruck}
          >
            {t.changeTruck}
          </button>
        </section>

        <section className="cb-card cb-driver-card">
          <div className="cb-card-heading">
            <span className="cb-card-icon">👤</span>
            <div>
              <h2>{t.driver}</h2>
              <p>Contact information for your transporter</p>
            </div>
          </div>

          <div className="cb-driver-profile">
            <div className="cb-avatar">
              {(booking?.driverName || "D").trim().charAt(0).toUpperCase()}
            </div>
            <div className="cb-driver-info">
              <strong>{booking?.driverName || "Driver details pending"}</strong>
              <span>{booking?.driverPhone || "Contact details unavailable"}</span>
            </div>
            <span className="cb-verified-tag">Transport</span>
          </div>

          <button
            type="button"
            className="cb-secondary-button"
            onClick={() => setShowDriver((previous) => !previous)}
          >
            {showDriver ? t.close : t.profile}
          </button>

          {showDriver && (
            <div className="cb-driver-extra">
              <Detail label={t.name} value={booking?.driverName} />
              <Detail label={t.phone} value={booking?.driverPhone} />
            </div>
          )}
        </section>

        <section className="cb-card cb-payment-card">
          <div className="cb-card-heading">
            <span className="cb-card-icon">₹</span>
            <div>
              <h2>Price Summary</h2>
              <p>Review the expected payment</p>
            </div>
          </div>

          <div className="cb-price-row">
            <span>{t.price}</span>
            <strong>{formatCurrency(freightPrice)}</strong>
          </div>

          <div className="cb-price-row">
            <span>{t.fee}</span>
            <strong>{formatCurrency(bookingFee)}</strong>
          </div>

          <div className="cb-price-divider" />

          <div className="cb-total-row">
            <span>{t.total}</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <button
            type="button"
            className="cb-confirm-button"
            onClick={handleConfirm}
            disabled={isConfirming || confirmed}
          >
            {confirmed
              ? `✓ ${t.success}`
              : isConfirming
                ? t.confirming
                : t.confirm}
          </button>

          <p className="cb-payment-note">
            Final charges should be verified with the transporter before payment.
          </p>
        </section>
      </div>

      <footer className="cb-footer">
        LOADSETU · Connecting cargo with the right transport
      </footer>
    </main>
  );
}

export default ConfirmBooking;
