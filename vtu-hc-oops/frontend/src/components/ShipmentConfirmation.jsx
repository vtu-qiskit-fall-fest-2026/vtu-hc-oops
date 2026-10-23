import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CircleAlert, ExternalLink, MapPin, ShieldCheck, Truck, Wallet } from "lucide-react";
import { getLoadsetuTheme } from "../theme.js";
import "./ShipmentConfirmation.css";

const API = import.meta.env.VITE_API_URL || "/api";
const TERMS_VERSION = "LOADSETU-SHIPMENT-TERMS-1.0";
async function request(path, body) {
  const token = localStorage.getItem("loadsetu-token");
  const response = await fetch(`${API}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || `Request failed (${response.status}).`); error.status = response.status; throw error; }
  return data;
}
function money(value) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0); }
function loadRazorpay() { return new Promise((resolve, reject) => { if (window.Razorpay) return resolve(true); const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(true); script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Check your internet connection.")); document.body.appendChild(script); }); }
function Detail({ label, value }) { return <div className="sc-detail"><span>{label}</span><strong>{value || "—"}</strong></div>; }

export default function ShipmentConfirmation() {
  const { token: linkToken } = useParams(); const navigate = useNavigate();
  const [booking, setBooking] = useState(null); const [party, setParty] = useState(""); const [termsVersion, setTermsVersion] = useState(TERMS_VERSION);
  const [termsOpened, setTermsOpened] = useState(false); const [accepted, setAccepted] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [coordinates, setCoordinates] = useState({ pickupLat: "", pickupLng: "", deliveryLat: "", deliveryLng: "" });
  const [cancelOpen, setCancelOpen] = useState(false); const [cancelReason, setCancelReason] = useState("Emergency cancellation"); const [theme] = useState(getLoadsetuTheme());
  const load = booking?.load || {}; const truck = booking?.truck || {}; const factory = booking?.factory || {}; const transporter = booking?.transporter || {}; const broker = booking?.broker || {};
  const pricing = booking?.pricingSnapshot || {}; const payments = booking?.shipmentPayments || {}; const acceptance = booking?.termsAcceptance || {};
  const coordsMissing = !load.pickupCoordinates?.latitude && load.pickupCoordinates?.latitude !== 0 || !load.pickupCoordinates?.longitude && load.pickupCoordinates?.longitude !== 0 || !load.deliveryCoordinates?.latitude && load.deliveryCoordinates?.latitude !== 0 || !load.deliveryCoordinates?.longitude && load.deliveryCoordinates?.longitude !== 0;
  const currentPayment = payments[party] || {};
  const currentAccepted = Boolean(acceptance[party]?.accepted);
  const amountDue = Number(party === "factory" ? pricing.totalFactoryPayableRupees : pricing.totalTransporterPayableRupees) || 0;

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("loadsetu-token")) { sessionStorage.setItem("loadsetu-return-to", window.location.pathname); navigate("/", { replace: true }); return; }
    setBusy(true); setError("");
    try { const result = await request(`/bookings/confirmation/${encodeURIComponent(linkToken)}`); setBooking(result.booking); setParty(result.currentParty); setTermsVersion(result.termsVersion || TERMS_VERSION); const l = result.booking?.load || {}; setCoordinates({ pickupLat: l.pickupCoordinates?.latitude ?? "", pickupLng: l.pickupCoordinates?.longitude ?? "", deliveryLat: l.deliveryCoordinates?.latitude ?? "", deliveryLng: l.deliveryCoordinates?.longitude ?? "" }); }
    catch (e) { if (e.status === 401) { sessionStorage.setItem("loadsetu-return-to", window.location.pathname); navigate("/", { replace: true }); } else setError(e.message); }
    finally { setBusy(false); }
  }, [linkToken, navigate]);
  useEffect(() => { refresh(); }, [refresh]);

  async function saveCoordinates() {
    setBusy(true); setError(""); setNotice("");
    try { const result = await request(`/bookings/confirmation/${encodeURIComponent(linkToken)}/coordinates`, { pickupCoordinates: { latitude: Number(coordinates.pickupLat), longitude: Number(coordinates.pickupLng) }, deliveryCoordinates: { latitude: Number(coordinates.deliveryLat), longitude: Number(coordinates.deliveryLng) } }); setBooking(result.booking); setNotice(result.message); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function pay() {
    setError(""); setNotice("");
    if (!termsOpened) { setError("Open and read the Terms & Conditions before accepting."); return; }
    if (!accepted && !currentAccepted) { setError("Accept the Terms & Conditions before continuing."); return; }
    setBusy(true);
    try {
      if (!currentAccepted) await request(`/bookings/confirmation/${encodeURIComponent(linkToken)}/terms`, { acceptTerms: true, termsVersion });
      const orderData = await request(`/bookings/confirmation/${encodeURIComponent(linkToken)}/payment/order`, {});
      await loadRazorpay();
      const checkout = new window.Razorpay({ key: orderData.keyId, amount: orderData.order.amount, currency: orderData.order.currency, name: "LOADSETU", description: `Shipment commitment · ${String(booking._id).slice(-8)}`, order_id: orderData.order.id, prefill: { name: party === "factory" ? factory.name : transporter.name, email: party === "factory" ? factory.email : transporter.email, contact: party === "factory" ? factory.phone : transporter.phone }, theme: { color: theme === "light" ? "#829477" : "#d6a34f" }, handler: async response => {
        setBusy(true);
        try { const verified = await request(`/bookings/confirmation/${encodeURIComponent(linkToken)}/payment/verify`, response); setNotice(verified.message); setAccepted(false); await refresh(); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); }
      }, modal: { ondismiss: () => { setNotice("Checkout was closed. Your shipment remains unconfirmed until the payment is verified."); setBusy(false); } } });
      checkout.on("payment.failed", async response => { try { await request(`/bookings/confirmation/${encodeURIComponent(linkToken)}/payment/failed`, { razorpay_order_id: orderData.order.id, reason: response?.error?.description || "Checkout reported failure" }); } catch { /* a failure report must never mark a payment successful */ } setError(response?.error?.description || "Payment failed. The shipment remains unconfirmed; you can retry."); await refresh(); setBusy(false); });
      checkout.open();
    } catch (e) { setError(e.message); setBusy(false); }
  }
  async function cancelShipment() {
    setBusy(true); setError(""); setNotice("");
    try { const result = await request(`/bookings/confirmation/${encodeURIComponent(linkToken)}/cancel`, { reason: cancelReason }); setBooking(result.booking); setNotice(result.message); setCancelOpen(false); if (result.notification?.phone) { const phone = String(result.notification.phone).replace(/\D/g, ""); if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(result.notification.message)}`, "_blank", "noopener,noreferrer"); } await refresh(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!booking && busy) return <main className="sc-page"><div className="sc-card sc-loading">Loading secure shipment details…</div></main>;
  if (!booking) return <main className="sc-page"><div className="sc-card"><Link className="sc-back" to="/"><ArrowLeft size={16}/> Back to Login</Link><h1>Shipment confirmation</h1><div className="sc-alert error"><CircleAlert size={17}/>{error || "Unable to load this confirmation link."}</div><p>Sign in with the Factory Owner or Transporter account linked to this shipment. If the link has expired, ask the Broker to create a new one.</p><button className="sc-primary" onClick={refresh}>Retry</button></div></main>;

  const status = booking.shipmentWorkflowStatus || booking.status;
  return <main className={`sc-page sc-theme-${theme}`}><header className="sc-header"><button className="sc-back" onClick={() => navigate(-1)}><ArrowLeft size={16}/> Back</button><strong>LOADSETU <span>Shipment confirmation</span></strong><span className="sc-status">{String(status).replaceAll("_", " ")}</span></header>
    <section className="sc-heading"><span className="sc-eyebrow"><ShieldCheck size={15}/> SECURE SHIPMENT WORKFLOW</span><h1>Review and confirm shipment</h1><p>Check the route, participants, charges, and cancellation policy before paying.</p><div className="sc-ref">Match ID: <strong>{booking._id}</strong></div></section>
    {error && <div className="sc-alert error"><CircleAlert size={17}/>{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="sc-alert success"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice("")}>×</button></div>}
    <div className="sc-layout"><div className="sc-main-column">
      <section className="sc-card"><h2><MapPin size={18}/> Route and load</h2><div className="sc-route"><div><span>Pickup location</span><strong>{load.pickup || "—"}</strong></div><i/><div><span>Delivery location</span><strong>{load.destination || "—"}</strong></div></div><div className="sc-grid"><Detail label="Load / material" value={`${load.title || load.material || "Shipment"} · ${load.material || "—"}`}/><Detail label="Load weight" value={`${load.weightTonnes ?? "—"} tonnes`}/><Detail label="Required truck" value={load.truckType}/><Detail label="Pickup date" value={load.pickupDate ? new Date(load.pickupDate).toLocaleDateString("en-IN") : "—"}/><Detail label="Agreed freight price" value={money(booking.agreedPrice)}/><Detail label="Calculated distance" value={pricing.distanceKm != null ? `${pricing.distanceKm} km` : "Unavailable until coordinates are saved"}/></div>{pricing.distanceMethod === "straight_line_haversine_fallback" && <p className="sc-note">Distance method: straight-line estimate (Haversine), not road distance. Road routing is not connected in the supplied project.</p>}</section>
      <section className="sc-card"><h2><Truck size={18}/> Participants and vehicle</h2><div className="sc-grid"><Detail label="Factory Owner" value={`${factory.name || "—"}${factory.phone ? ` · ${factory.phone}` : ""}`}/><Detail label="Transporter" value={`${transporter.name || "—"}${transporter.phone ? ` · ${transporter.phone}` : ""}`}/><Detail label="Truck registration" value={truck.registrationNumber}/><Detail label="Truck type / capacity" value={`${truck.truckType || "—"} · ${truck.capacityTonnes ?? "—"} tonnes`}/><Detail label="Transporter location" value={truck.currentLocation}/><Detail label="Broker" value={broker.name || "Broker details not available"}/></div></section>
      {coordsMissing && party === "factory" && <section className="sc-card"><h2><MapPin size={18}/> Add valid location coordinates</h2><p className="sc-note">The existing load record does not contain valid coordinates for both locations. Payment is blocked until these are supplied. Enter the coordinates from your existing map/geocoding source; do not guess.</p><div className="sc-coordinate-grid">{[["pickupLat","Pickup latitude"],["pickupLng","Pickup longitude"],["deliveryLat","Delivery latitude"],["deliveryLng","Delivery longitude"]].map(([key,label])=><label key={key}>{label}<input inputMode="decimal" value={coordinates[key]} onChange={e=>setCoordinates(v=>({...v,[key]:e.target.value}))} placeholder={label}/></label>)}</div><button className="sc-secondary" onClick={saveCoordinates} disabled={busy}>Save coordinates and calculate distance</button></section>}
      <section className="sc-card"><h2><ShieldCheck size={18}/> Terms & Conditions</h2><p>Each participant must read the terms and accept separately. Your acceptance is stored by the server with a timestamp and terms version.</p><Link className="sc-terms-link" to="/shipment-terms" target="_blank" rel="noreferrer" onClick={()=>setTermsOpened(true)}>Read Shipment Terms & Conditions <ExternalLink size={15}/></Link><label className={`sc-checkbox ${currentAccepted ? "is-accepted" : ""}`}><input type="checkbox" checked={currentAccepted || accepted} disabled={currentAccepted || !termsOpened || busy} onChange={e=>setAccepted(e.target.checked)}/><span>I have read and agree to the LoadSetu Shipment Terms & Conditions, including the deposit, commission, and emergency cancellation policy.</span></label><p className="sc-note">Terms version: {termsVersion}. Checkbox acceptance is not payment or shipment confirmation.</p><div className="sc-acceptance-grid"><Detail label="Factory Owner acceptance" value={acceptance.factory?.accepted ? `Accepted · ${new Date(acceptance.factory.acceptedAt).toLocaleString("en-IN")}` : "Not yet accepted"}/><Detail label="Transporter acceptance" value={acceptance.transporter?.accepted ? `Accepted · ${new Date(acceptance.transporter.acceptedAt).toLocaleString("en-IN")}` : "Not yet accepted"}/></div></section>
    </div><aside className="sc-side-column"><section className="sc-card sc-price-card"><h2><Wallet size={18}/> Charges</h2><div className="sc-charge"><span>Total route distance</span><strong>{pricing.distanceKm != null ? `${pricing.distanceKm} km` : "—"}</strong></div><div className="sc-charge"><span>Broker commission <small>₹3 × distance</small></span><strong>{pricing.commissionRupees != null ? money(pricing.commissionRupees) : "—"}</strong></div><div className="sc-charge"><span>Shipment deposit <small>₹5 × distance</small></span><strong>{pricing.depositRupees != null ? money(pricing.depositRupees) : "—"}</strong></div>{Number(pricing.otherChargesRupees)>0&&<div className="sc-charge"><span>Other platform charges</span><strong>{money(pricing.otherChargesRupees)}</strong></div>}<div className="sc-total"><span>Total payable by you</span><strong>{(party === "factory" ? pricing.totalFactoryPayableRupees : pricing.totalTransporterPayableRupees) != null ? money(party === "factory" ? pricing.totalFactoryPayableRupees : pricing.totalTransporterPayableRupees) : "Unavailable"}</strong></div><p className="sc-note">Deposit and broker commission are separate. The commission is charged once to the Factory Owner; the Transporter pays the commitment deposit. Amounts are calculated by the backend and saved as the shipment pricing snapshot.</p><div className="sc-pay-state"><span>Your payment</span><strong className={`sc-pay-${currentPayment.status || "not_started"}`}>{String(currentPayment.status || "not_started").replaceAll("_", " ")}</strong></div><div className="sc-pay-state"><span>Other participant</span><strong>{String(payments[party === "factory" ? "transporter" : "factory"]?.status || "not_started").replaceAll("_", " ")}</strong></div>{status !== "confirmed" && status !== "cancelled" && status !== "completed" && <button className="sc-primary sc-pay-button" onClick={pay} disabled={busy || coordsMissing || (!currentAccepted && (!accepted || !termsOpened)) || !pricing.distanceKm || currentPayment.status === "paid"}>{busy ? "Please wait…" : currentPayment.status === "paid" ? "Payment verified" : "Accept terms & pay securely"}</button>}{status === "confirmed" && <div className="sc-confirmed"><CheckCircle2 size={18}/> Both parties accepted and payments are verified. Shipment confirmed.</div>}{status === "partially_paid" && <p className="sc-note">One payment has been verified. The shipment remains unconfirmed until the other participant completes their process.</p>}</section>
      {status === "confirmed" && <section className="sc-card sc-cancel-card"><h2><CircleAlert size={18}/> Emergency cancellation</h2><p>Amount at risk: <strong>{money(pricing.depositRupees || 0)}</strong>. The applicable forfeited deposit is allocated 50% to the opposite party and 50% to the Broker, with settlement recorded as pending.</p><button className="sc-danger" onClick={()=>setCancelOpen(true)} disabled={busy}>Emergency Cancellation</button></section>}
    </aside></div>
    {cancelOpen && <div className="sc-modal-backdrop" role="presentation"><section className="sc-modal" role="dialog" aria-modal="true" aria-labelledby="sc-cancel-title"><h2 id="sc-cancel-title">Confirm emergency cancellation?</h2><p>Emergency cancellation may result in forfeiture of the shipment deposit under the accepted LoadSetu Terms & Conditions. The applicable amount and distribution will be recorded. Do you want to continue?</p><div className="sc-risk-amount">Deposit at risk: {money(pricing.depositRupees || 0)}<small>50% opposite party · 50% Broker · pending settlement</small></div><label>Reason (optional)<input value={cancelReason} onChange={e=>setCancelReason(e.target.value)} maxLength={300}/></label><div className="sc-modal-actions"><button className="sc-secondary" onClick={()=>setCancelOpen(false)} disabled={busy}>Keep shipment</button><button className="sc-danger" onClick={cancelShipment} disabled={busy}>{busy ? "Cancelling…" : "Confirm cancellation"}</button></div></section></div>}
  </main>;
}
