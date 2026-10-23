import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, PackagePlus, RefreshCw, Truck, MapPin, CalendarDays, IndianRupee, ClipboardList } from "lucide-react";
import { createLoad, getMyLoads } from "../services/loadApi.js";
import { getMySubscription } from "../services/subscriptionApi.js";
import { useLoadsetuLanguage } from "../hooks/useLoadsetuLanguage.js";
import RouteMap from "./RouteMap.jsx";
import "../factory-loads.css";

const initialForm = {
  title: "", pickup: "", destination: "", material: "", weightTonnes: "",
  truckType: "Any suitable truck", pickupDate: "", offeredPrice: "", notes: ""
};
const truckTypes = ["Any suitable truck", "Mini truck", "Pickup", "LCV", "Open truck", "Container", "Trailer", "Tipper"];

// Common load titles. Suggestions appear as the user types, but custom titles are allowed.
const loadTitleSuggestions = [
  "Steel coils delivery",
  "Cement bags shipment",
  "Construction materials delivery",
  "FMCG goods transport",
  "Food grains delivery",
  "Agricultural produce transport",
  "Industrial machinery transport",
  "Electrical equipment delivery",
  "Furniture delivery",
  "Textile goods shipment",
  "Plastic raw materials transport",
  "Chemical drums transport",
  "Automobile parts delivery",
  "Ceramic tiles shipment",
  "Bricks and sand transport",
  "Packaged goods delivery",
  "Refrigerated goods transport",
  "Warehouse stock transfer",
  "Container cargo transport",
  "General goods delivery"
];
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
const dateText = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function FactoryLoads({ onBack }) {
  const navigate = useNavigate();
  const { t } = useLoadsetuLanguage();
  const location = useLocation();
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get("tab") === "mine" ? "mine" : "create");
  const [form, setForm] = useState(initialForm);
  const [loads, setLoads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [notice, setNotice] = useState(null);
  const [openRoute, setOpenRoute] = useState(null);

  const refreshLoads = useCallback(async () => {
    setLoadingLoads(true);
    try {
      const result = await getMyLoads();
      setLoads(Array.isArray(result.loads) ? result.loads : []);
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally { setLoadingLoads(false); }
  }, []);

  useEffect(() => { refreshLoads(); }, [refreshLoads]);

  useEffect(() => {
    // Existing loads remain viewable; subscription is checked only when the create tab is selected.
    if (tab !== "create" || new URLSearchParams(location.search).get("tab") === "mine") return;
    let cancelled = false;
    getMySubscription().then(result => {
      if (!cancelled && !result.active) navigate("/subscription", { replace: true, state: { returnTo: "/factory/loads" } });
    }).catch(() => { /* backend still enforces the subscription gate on creation */ });
    return () => { cancelled = true; };
  }, [tab, location.search, navigate]);

  function update(key, value) { setForm(old => ({ ...old, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setNotice(null);
    setBusy(true);
    try {
      await createLoad({ ...form, weightTonnes: Number(form.weightTonnes), offeredPrice: Number(form.offeredPrice) });
      setForm(initialForm);
      setNotice({ type: "success", text: t("loadSaved") });
      setTab("mine");
      await refreshLoads();
    } catch (error) {
      setNotice({ type: "error", text: error.message || t("createFailed") });
    } finally { setBusy(false); }
  }

  return (
    <main className="loads-page">
      <header className="loads-header">
        <button className="loads-back" type="button" onClick={() => onBack ? onBack() : navigate("/factory/dashboard")}><ArrowLeft size={17}/> Dashboard</button>
        <div className="loads-brand"><span className="loads-brand-icon"><Truck size={21}/></span><div><strong>LOADSETU</strong><small>{t("loadManagement")}</small></div></div>
        <button className="loads-refresh" type="button" onClick={refreshLoads} disabled={loadingLoads}><RefreshCw size={16}/>{t("refresh")}</button>
      </header>

      <section className="loads-intro">
        <p className="loads-eyebrow">{t("eyebrowFactory")}</p>
        <h1>{t("loadPageTitle")}</h1>
        <p>{t("loadPageDesc")}</p>
      </section>

      <div className="loads-tabs" role="tablist" aria-label="Load management">
        <button type="button" role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => { setTab("create"); setNotice(null); if (location.search) navigate("/factory/loads", { replace: true }); }}><PackagePlus size={17}/>{t("createLoad")}</button>
        <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => { setTab("mine"); setNotice(null); refreshLoads(); }}><ClipboardList size={17}/>{t("loadOverview")} <span className="loads-count">{loads.length}</span></button>
      </div>

      {notice && <div className={`loads-notice ${notice.type}`} role="status">{notice.text}</div>}

      {tab === "create" ? (
        <form className="loads-form" onSubmit={submit}>
          <div className="loads-form-heading"><PackagePlus size={21}/><div><h2>{t("createNewLoad")}</h2><p>{t("loadFormDesc")}</p></div></div>
          <div className="loads-form-grid">
            <label>
              {t("loadTitle")}
              <input
                required
                maxLength={100}
                list="load-title-suggestions"
                value={form.title}
                onChange={e => update("title", e.target.value)}
                placeholder="Choose a suggestion or type your own title"
                autoComplete="off"
              />
              <datalist id="load-title-suggestions">
                {loadTitleSuggestions.map(title => (
                  <option key={title} value={title} />
                ))}
              </datalist>
            </label>
            <label>{t("material")}<input required maxLength={100} value={form.material} onChange={e => update("material", e.target.value)} placeholder="e.g. Steel, cement, FMCG" /></label>
            <label><span><MapPin size={14}/> {t("pickup")}</span><input required maxLength={160} value={form.pickup} onChange={e => update("pickup", e.target.value)} placeholder="City, area or factory address" /></label>
            <label><span><MapPin size={14}/> {t("destination")}</span><input required maxLength={160} value={form.destination} onChange={e => update("destination", e.target.value)} placeholder="Delivery city or address" /></label>
            <label>{t("weight")}<input required type="number" min="0.1" max="1000" step="0.1" value={form.weightTonnes} onChange={e => update("weightTonnes", e.target.value)} placeholder="e.g. 5" /></label>
            <label>{t("truckType")}<select required value={form.truckType} onChange={e => update("truckType", e.target.value)}>{truckTypes.map(type => <option key={type}>{type}</option>)}</select></label>
            <label><span><CalendarDays size={14}/> {t("pickupDate")}</span><input required type="date" min={new Date().toLocaleDateString("en-CA")} value={form.pickupDate} onChange={e => update("pickupDate", e.target.value)} /></label>
            <label><span><IndianRupee size={14}/> {t("offeredPrice")}</span><input required type="number" min="0" step="1" value={form.offeredPrice} onChange={e => update("offeredPrice", e.target.value)} placeholder="e.g. 12000" /></label>
            <label className="loads-full">{t("notes")}<textarea rows={3} maxLength={1000} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder={t("notesPlaceholder")} /></label>
            <div className="loads-full loads-route-preview">
              <span className="loads-route-label"><MapPin size={14}/> Route preview</span>
              <RouteMap from={form.pickup} to={form.destination} height={240} />
            </div>
          </div>
          <div className="loads-form-footer"><p>{t("reviewBeforeSave")}</p><button className="loads-submit" disabled={busy} type="submit">{busy ? t("savingLoad") : t("saveLoad")}<ArrowLeft className="loads-submit-arrow" size={17}/></button></div>
        </form>
      ) : (
        <section className="my-loads">
          <div className="my-loads-heading"><div><h2>My Loads</h2><p>{t("loadsPostedByFactory")}</p></div><span>{loads.length} total</span></div>
          {loadingLoads ? <div className="loads-empty">{t("loadingLoads")}</div> : loads.length === 0 ? <div className="loads-empty"><PackagePlus size={30}/><h3>{t("noLoads")}</h3><p>{t("firstLoad")}</p><button type="button" className="loads-submit" onClick={() => { setTab("create"); if (location.search) navigate("/factory/loads", { replace: true }); }}>{t("firstLoad")}</button></div> : <div className="loads-list">{loads.map(load => <article className="load-item" key={load._id}><div className="load-item-top"><div><p className="load-item-id">LOAD-{String(load._id).slice(-6).toUpperCase()}</p><h3>{load.title}</h3></div><span className={`load-status ${String(load.status).toLowerCase().replaceAll(" ", "-")}`}>{load.status}</span></div><div className="load-route"><span>{load.pickup}</span><span className="route-arrow">→</span><span>{load.destination}</span></div><div className="load-meta"><span><Truck size={15}/>{load.weightTonnes} tonnes · {load.truckType}</span><span><CalendarDays size={15}/>{dateText(load.pickupDate)}</span><strong>{money(load.offeredPrice)}</strong></div><p className="load-material">{t("goods")}: {load.material}</p>{load.notes && <p className="load-notes">{load.notes}</p>}<button type="button" className="load-route-toggle" onClick={() => setOpenRoute(openRoute === load._id ? null : load._id)}><MapPin size={14}/>{openRoute === load._id ? "Hide route" : "Show route & estimate"}</button>{openRoute === load._id && <RouteMap from={load.pickup} to={load.destination} height={220} compact />}</article>)}</div>}
        </section>
      )}
    </main>
  );
}
