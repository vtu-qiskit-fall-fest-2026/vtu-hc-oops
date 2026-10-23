import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, BadgeCheck, Boxes, CalendarDays, Check,
  CheckCircle2, ChevronRight, CircleDollarSign, Clock3, Factory, FileText,
  Leaf, LoaderCircle, MapPin, MessageCircle, PackagePlus, RefreshCw, Route,
  Search, ShieldCheck, Truck, Wallet, X
} from "lucide-react";
import {
  confirmFactoryBooking, createFactoryLoad, getFactorySummary, getLoadMatches,
  getMyLoads, updateFactoryShipmentStatus
} from "../services/factoryApi.js";
import "../factory-panel.css";

const EMPTY_FORM = {
  factoryName: "", cargo: "", pickup: "", destination: "", weightTonnes: "",
  vehicleType: "Any", pickupDate: "", deliveryDate: "", offeredPrice: "", notes: ""
};
const STATUS_NEXT = {
  Open: ["Booking Pending", "Cancelled"],
  "Booking Pending": ["Booked", "Cancelled"],
  Booked: ["In Transit", "Cancelled"],
  "In Transit": ["Delivered"], Delivered: [], Cancelled: []
};
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set";

export default function FactoryPanel({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState({ total: 0, active: 0, delivered: 0, bookings: 0, estimatedSavings: 0 });
  const [loads, setLoads] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchNotice, setMatchNotice] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [booking, setBooking] = useState(null);
  const [statusChoice, setStatusChoice] = useState({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResult, loadsResult] = await Promise.all([getFactorySummary(), getMyLoads()]);
      setSummary(summaryResult.summary || summary);
      setLoads(loadsResult.loads || []);
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredLoads = useMemo(() => loads.filter((load) => {
    const text = `${load.cargo} ${load.pickup} ${load.destination} ${load.status}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [loads, search]);

  function changeForm(key, value) { setForm((old) => ({ ...old, [key]: value })); }
  function notify(type, text) { setNotice({ type, text }); window.setTimeout(() => setNotice(null), 5000); }

  async function submitLoad(event) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const result = await createFactoryLoad({ ...form, weightTonnes: Number(form.weightTonnes), offeredPrice: Number(form.offeredPrice) });
      setForm(EMPTY_FORM); await refresh(); setSelectedLoad(result.load); setTab("loads");
      notify("success", "Load posted successfully. You can now view match suggestions.");
    } catch (error) { notify("error", error.message); }
    finally { setBusy(false); }
  }

  async function viewMatches(load) {
    setSelectedLoad(load); setMatches([]); setMatchNotice(""); setTab("matches"); setBusy(true);
    try { const result = await getLoadMatches(load._id); setMatches(result.matches || []); setMatchNotice(result.note || ""); }
    catch (error) { notify("error", error.message); }
    finally { setBusy(false); }
  }

  async function submitBooking(event) {
    event.preventDefault(); if (!selectedLoad || !booking) return;
    setBusy(true);
    try {
      await confirmFactoryBooking(selectedLoad._id, booking);
      setBooking(null); await refresh(); setSelectedLoad(null); setTab("loads");
      notify("success", "Booking saved. Confirm the transporter details before dispatch.");
    } catch (error) { notify("error", error.message); }
    finally { setBusy(false); }
  }

  async function changeStatus(load, status) {
    setBusy(true);
    try { await updateFactoryShipmentStatus(load._id, { status, note: "Updated from factory panel" }); await refresh(); notify("success", `Shipment status updated to ${status}.`); }
    catch (error) { notify("error", error.message); }
    finally { setBusy(false); }
  }

  const navItems = [
    ["overview", "Overview", Activity], ["create", "Create Load", PackagePlus],
    ["loads", "My Loads", Boxes], ["matches", "View Matched Trucks", Truck],
    ["shipments", "Shipment Status", Route]
  ];

  return <main className="factory-shell">
    <aside className="factory-sidebar">
      <a className="factory-brand" href="#factory" onClick={(e) => { e.preventDefault(); setTab("overview"); }}>
        <span className="factory-brand-icon"><Route size={21}/></span><span><strong>LOADSETU</strong><small>FACTORY WORKSPACE</small></span>
      </a>
      <div className="factory-profile"><span className="factory-avatar"><Factory size={19}/></span><div><strong>{JSON.parse(localStorage.getItem("loadsetu-user") || "{}").name || "Factory account"}</strong><small>Factory / Shipper</small></div></div>
      <span className="factory-nav-label">WORKSPACE</span>
      <nav className="factory-nav">{navItems.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setNotice(null); }}><Icon size={18}/><span>{label}</span>{tab === id && <ChevronRight size={16} className="nav-chevron"/>}</button>)}</nav>
      <div className="factory-sidebar-bottom"><div className="factory-help-card"><ShieldCheck size={20}/><strong>Safer freight decisions</strong><p>Review match reasons and verify transporter details before confirming.</p></div><button className="factory-logout" onClick={onLogout}><ArrowDownRight size={17}/> Log out</button></div>
    </aside>

    <section className="factory-main">
      <header className="factory-topbar"><div><span className="factory-eyebrow">FACTORY PANEL</span><h1>{({ overview: "Operations overview", create: "Create a new load", loads: "My loads", matches: "Matched trucks", shipments: "Shipment control" })[tab]}</h1></div><div className="factory-top-actions"><span className="factory-live"><span/> Workspace active</span><button className="factory-icon-button" onClick={refresh} aria-label="Refresh data"><RefreshCw size={17}/></button><span className="factory-top-avatar"><Factory size={17}/></span></div></header>
      {notice && <div className={`factory-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16}/></button></div>}

      {tab === "overview" && <>
        <section className="factory-welcome"><div><span className="factory-welcome-kicker">YOUR FREIGHT, IN ONE PLACE</span><h2>Move goods smarter.</h2><p>Post a load, compare suitable trucks, and keep every shipment visible from pickup to delivery.</p><button className="factory-primary" onClick={() => setTab("create")}><PackagePlus size={17}/> Create a load <ArrowRight size={16}/></button></div><div className="factory-welcome-art"><div className="factory-orbit orbit-one"/><div className="factory-orbit orbit-two"/><span className="factory-truck-illustration"><Truck size={72}/></span><span className="factory-art-pin pin-a"><MapPin size={17}/></span><span className="factory-art-pin pin-b"><Boxes size={17}/></span></div></section>
        <section className="factory-kpis">
          <Kpi icon={Boxes} label="Total loads" value={summary.total} hint="Loads posted"/>
          <Kpi icon={Activity} label="Active shipments" value={summary.active} hint="Open to in transit"/>
          <Kpi icon={CheckCircle2} label="Delivered" value={summary.delivered} hint="Completed loads"/>
          <Kpi icon={Wallet} label="Estimated savings" value={money(summary.estimatedSavings)} hint="Based on saved quotes"/>
        </section>
        <div className="factory-content-grid"><section className="factory-card factory-recent-card"><div className="factory-card-heading"><div><span className="factory-eyebrow">RECENT ACTIVITY</span><h3>Latest loads</h3></div><button className="factory-text-button" onClick={() => setTab("loads")}>View all <ArrowRight size={15}/></button></div>
          {loading ? <Loading/> : loads.length === 0 ? <EmptyState icon={Boxes} title="No loads yet" text="Post your first shipment to start finding truck options." action={() => setTab("create")} actionText="Create your first load"/> : <div className="factory-recent-list">{loads.slice(0, 4).map((load) => <LoadRow key={load._id} load={load} onMatches={viewMatches}/>)}</div>}
        </section><section className="factory-card factory-insight-card"><div className="factory-card-heading"><div><span className="factory-eyebrow">SMART LOGISTICS</span><h3>Decision support</h3></div><span className="factory-insight-icon"><Leaf size={20}/></span></div><div className="factory-insight"><span className="factory-insight-number">01</span><div><strong>Compare before booking</strong><p>Check capacity, price, route fit and the reasons behind each match score.</p></div></div><div className="factory-insight"><span className="factory-insight-number">02</span><div><strong>Look for return-load potential</strong><p>When route data is available, a return trip may help reduce empty kilometres.</p></div></div><div className="factory-demo-note"><ShieldCheck size={17}/><span>Truck suggestions are currently demo candidates until real transporter inventory is connected.</span></div></section></div>
      </>}

      {tab === "create" && <section className="factory-card factory-form-card"><div className="factory-card-heading"><div><span className="factory-eyebrow">NEW SHIPMENT</span><h3>Load details</h3><p>Enter accurate details to help find a suitable vehicle.</p></div><span className="factory-form-icon"><PackagePlus size={23}/></span></div><form className="factory-form" onSubmit={submitLoad}>
        <div className="factory-form-section"><h4><Factory size={16}/> Factory and cargo</h4><div className="factory-form-grid"><Field label="Factory / company name" required><input value={form.factoryName} onChange={e => changeForm("factoryName", e.target.value)} required maxLength="100" placeholder="e.g. Balaji Industries"/></Field><Field label="Material / cargo" required><input value={form.cargo} onChange={e => changeForm("cargo", e.target.value)} required maxLength="100" placeholder="e.g. Steel coils, cement, machinery"/></Field></div></div>
        <div className="factory-form-section"><h4><MapPin size={16}/> Route information</h4><div className="factory-form-grid"><Field label="Pickup location" required><input value={form.pickup} onChange={e => changeForm("pickup", e.target.value)} required placeholder="City, area or factory address"/></Field><Field label="Destination" required><input value={form.destination} onChange={e => changeForm("destination", e.target.value)} required placeholder="Delivery city or address"/></Field><Field label="Pickup date" required><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.pickupDate} onChange={e => changeForm("pickupDate", e.target.value)} required/></Field><Field label="Delivery date" required><input type="date" min={form.pickupDate || new Date().toISOString().slice(0, 10)} value={form.deliveryDate} onChange={e => changeForm("deliveryDate", e.target.value)} required/></Field></div></div>
        <div className="factory-form-section"><h4><Truck size={16}/> Load requirements</h4><div className="factory-form-grid"><Field label="Load weight (tonnes)" required><input type="number" min="0.1" max="1000" step="0.1" value={form.weightTonnes} onChange={e => changeForm("weightTonnes", e.target.value)} required placeholder="e.g. 5"/></Field><Field label="Preferred vehicle" required><select value={form.vehicleType} onChange={e => changeForm("vehicleType", e.target.value)}><option>Any</option><option>Mini Truck</option><option>LCV</option><option>6-Wheeler</option><option>10-Wheeler</option><option>Trailer</option><option>Container</option></select></Field><Field label="Offered freight price (₹)" required><input type="number" min="1" step="1" value={form.offeredPrice} onChange={e => changeForm("offeredPrice", e.target.value)} required placeholder="Your planned freight budget"/></Field><Field label="Additional instructions"><input value={form.notes} onChange={e => changeForm("notes", e.target.value)} maxLength="1000" placeholder="Loading hours, handling needs, etc."/></Field></div></div>
        <div className="factory-form-footer"><p><ShieldCheck size={16}/> Review the details before posting. You can review match suggestions next.</p><button className="factory-primary" disabled={busy}>{busy ? <LoaderCircle className="factory-spin" size={17}/> : <PackagePlus size={17}/>} {busy ? "Posting load…" : "Post load"}</button></div>
      </form></section>}

      {tab === "loads" && <section className="factory-card"><div className="factory-card-heading"><div><span className="factory-eyebrow">LOAD REGISTER</span><h3>All your loads</h3><p>Track postings, compare trucks and manage booking progress.</p></div><button className="factory-primary" onClick={() => setTab("create")}><PackagePlus size={16}/> Create load</button></div><div className="factory-table-tools"><label className="factory-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cargo, route or status"/></label><span>{filteredLoads.length} result{filteredLoads.length === 1 ? "" : "s"}</span></div>{loading ? <Loading/> : filteredLoads.length === 0 ? <EmptyState icon={Boxes} title="No matching loads" text="Try another search or post a new load." action={() => setTab("create")} actionText="Create load"/> : <div className="factory-load-list">{filteredLoads.map(load => <LoadCard key={load._id} load={load} onMatches={viewMatches} onStatus={changeStatus}/>)}</div>}</section>}

      {tab === "matches" && <section className="factory-card"><div className="factory-card-heading"><div><span className="factory-eyebrow">MATCH INTELLIGENCE</span><h3>Matched truck options</h3><p>Review scores and reasons before recording a booking.</p></div><span className="factory-match-icon"><Truck size={23}/></span></div>{!selectedLoad ? <EmptyState icon={Route} title="Choose a load first" text="Open My Loads and select View matched trucks for a shipment." action={() => setTab("loads")} actionText="Go to my loads"/> : <><div className="factory-selected-load"><div><span>SELECTED LOAD</span><strong>{selectedLoad.cargo}</strong><small>{selectedLoad.pickup} <ArrowRight size={13}/> {selectedLoad.destination}</small></div><div><span>WEIGHT</span><strong>{selectedLoad.weightTonnes} t</strong></div><div><span>OFFERED PRICE</span><strong>{money(selectedLoad.offeredPrice)}</strong></div></div>{matchNotice && <div className="factory-demo-warning"><Activity size={17}/><span>{matchNotice}</span></div>}{busy ? <Loading/> : matches.length === 0 ? <EmptyState icon={Truck} title="No suitable candidates" text="No demo truck met the capacity rule for this load." action={() => setTab("loads")} actionText="Choose another load"/> : <div className="factory-match-list">{matches.map((truck, index) => <article className="factory-match-card" key={truck.id}><div className="factory-match-rank">{index === 0 ? <BadgeCheck size={21}/> : `0${index + 1}`}</div><div className="factory-match-main"><div className="factory-match-title"><div><h4>{truck.name}</h4><p><Truck size={14}/> {truck.type} · {truck.truckNumber}</p></div><span className="factory-score"><strong>{truck.score}</strong><small>/ 100 match</small></span></div><div className="factory-score-track"><span style={{ width: `${truck.score}%` }}/></div><div className="factory-match-metrics"><span><Boxes size={14}/>{truck.capacity} t capacity</span><span><CircleDollarSign size={14}/>{money(truck.price)} indicative</span><span><Clock3 size={14}/>{truck.available ? "Candidate available" : "Availability unknown"}</span></div><div className="factory-reasons"><strong>Why this match?</strong>{truck.reasons.map(reason => <span key={reason}><Check size={13}/>{reason}</span>)}</div><div className="factory-match-footer"><span className="factory-demo-tag">Demo candidate · not verified</span><button className="factory-primary" onClick={() => setBooking({ transporterName: truck.name, transporterPhone: truck.phone || "", truckNumber: truck.truckNumber, truckCapacityTonnes: truck.capacity, quotedPrice: truck.price })}><CheckCircle2 size={16}/> Record booking</button></div></div></article>)}</div>}</>}</section>}

      {tab === "shipments" && <section className="factory-card"><div className="factory-card-heading"><div><span className="factory-eyebrow">SHIPMENT CONTROL</span><h3>Status and delivery progress</h3><p>Update statuses only when the real shipment milestone occurs.</p></div><span className="factory-status-icon"><Route size={22}/></span></div>{loading ? <Loading/> : loads.filter(l => !["Cancelled"].includes(l.status)).length === 0 ? <EmptyState icon={Route} title="No shipments to track" text="Your posted loads will appear here." action={() => setTab("create")} actionText="Post a load"/> : <div className="factory-shipment-list">{loads.filter(l => l.status !== "Cancelled").map(load => <article className="factory-shipment" key={load._id}><div className="factory-shipment-route"><span className="factory-route-dot"/><div><strong>{load.pickup}</strong><small>Pickup · {dateLabel(load.pickupDate)}</small></div><span className="factory-route-line"/><MapPin size={17}/><div><strong>{load.destination}</strong><small>Delivery · {dateLabel(load.deliveryDate)}</small></div></div><div className="factory-shipment-bottom"><div><strong>{load.cargo}</strong><span>{load.weightTonnes} t · {load.booking?.truckNumber || "No truck booked"}</span></div><div className="factory-shipment-actions"><StatusPill status={load.status}/><select aria-label={`Update status for ${load.cargo}`} value={statusChoice[load._id] || ""} onChange={e => { const value = e.target.value; setStatusChoice(old => ({ ...old, [load._id]: value })); if (value) changeStatus(load, value); }} disabled={busy || !(STATUS_NEXT[load.status] || []).length}><option value="">Update status…</option>{(STATUS_NEXT[load.status] || []).map(s => <option key={s}>{s}</option>)}</select></div></div>{Array.isArray(load.statusHistory) && load.statusHistory.length > 0 && <div className="factory-history"><span>Latest update:</span> {load.statusHistory[load.statusHistory.length - 1].note || load.statusHistory[load.statusHistory.length - 1].status}</div>}</article>)}</div>}</section>}
    </section>

    {booking && <div className="factory-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setBooking(null); }}><section className="factory-modal" role="dialog" aria-modal="true" aria-labelledby="factory-booking-title"><div className="factory-modal-heading"><div><span className="factory-eyebrow">BOOKING RECORD</span><h3 id="factory-booking-title">Confirm truck details</h3></div><button className="factory-icon-button" onClick={() => setBooking(null)} aria-label="Close"><X size={18}/></button></div><div className="factory-modal-warning"><ShieldCheck size={17}/> Verify identity, availability, documents and price with the transporter. Demo candidates are not verified.</div><form className="factory-form" onSubmit={submitBooking}><Field label="Transporter / company" required><input required value={booking.transporterName} onChange={e => setBooking({ ...booking, transporterName: e.target.value })}/></Field><Field label="WhatsApp phone (with country code)"><input value={booking.transporterPhone} onChange={e => setBooking({ ...booking, transporterPhone: e.target.value })} placeholder="e.g. 919876543210"/></Field><Field label="Truck registration number" required><input required value={booking.truckNumber} onChange={e => setBooking({ ...booking, truckNumber: e.target.value })}/></Field><Field label="Truck capacity (tonnes)"><input type="number" min="0" step="0.1" value={booking.truckCapacityTonnes} onChange={e => setBooking({ ...booking, truckCapacityTonnes: e.target.value })}/></Field><Field label="Agreed freight price (₹)" required><input type="number" min="1" required value={booking.quotedPrice} onChange={e => setBooking({ ...booking, quotedPrice: e.target.value })}/></Field><div className="factory-modal-actions"><button type="button" className="factory-secondary" onClick={() => setBooking(null)}>Cancel</button><button className="factory-primary" disabled={busy}>{busy ? "Saving…" : "Save booking"}</button></div></form></section></div>}
  </main>;
}

function Kpi({ icon: Icon, label, value, hint }) { return <article className="factory-kpi"><span className="factory-kpi-icon"><Icon size={19}/></span><span className="factory-kpi-label">{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
function Field({ label, required, children }) { return <label className="factory-field"><span>{label}{required && <i> *</i>}</span>{children}</label>; }
function Loading() { return <div className="factory-loading"><LoaderCircle className="factory-spin" size={22}/> Loading your factory data…</div>; }
function EmptyState({ icon: Icon, title, text, action, actionText }) { return <div className="factory-empty"><span><Icon size={25}/></span><h4>{title}</h4><p>{text}</p>{action && <button className="factory-secondary" onClick={action}>{actionText} <ArrowRight size={15}/></button>}</div>; }
function StatusPill({ status }) { const cls = status.toLowerCase().replaceAll(" ", "-"); return <span className={`factory-status status-${cls}`}>{status}</span>; }
function LoadRow({ load, onMatches }) { return <div className="factory-recent-row"><span className="factory-recent-icon"><Boxes size={18}/></span><div className="factory-recent-copy"><strong>{load.cargo}</strong><span>{load.pickup} <ArrowRight size={12}/> {load.destination}</span></div><StatusPill status={load.status}/><button className="factory-row-action" onClick={() => onMatches(load)} aria-label="View matched trucks"><ChevronRight size={18}/></button></div>; }
function LoadCard({ load, onMatches, onStatus }) { const [nextStatus, setNextStatus] = useState(""); const whatsappPhone = load.booking?.transporterPhone?.replace(/\D/g, ""); const waUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Hello ${load.booking.transporterName}, contacting you about LOADSETU shipment ${load._id}.`)}` : null; return <article className="factory-load-card"><div className="factory-load-card-top"><div><span className="factory-load-id">LOAD-{String(load._id).slice(-6).toUpperCase()}</span><h4>{load.cargo}</h4><p>{load.pickup} <ArrowRight size={13}/> {load.destination}</p></div><StatusPill status={load.status}/></div><div className="factory-load-facts"><span><Boxes size={14}/>{load.weightTonnes} tonnes</span><span><CalendarDays size={14}/>{dateLabel(load.pickupDate)}</span><span><Wallet size={14}/>{money(load.offeredPrice)}</span><span><Truck size={14}/>{load.vehicleType}</span></div>{load.booking?.truckNumber && <div className="factory-booking-strip"><CheckCircle2 size={16}/><span>Truck: <strong>{load.booking.truckNumber}</strong> · {load.booking.transporterName}</span>{waUrl ? <a href={waUrl} target="_blank" rel="noreferrer" className="factory-whatsapp"><MessageCircle size={15}/> WhatsApp</a> : <span className="factory-no-phone">No phone added</span>}</div>}<div className="factory-load-actions"><button className="factory-secondary" onClick={() => onMatches(load)}><Search size={15}/> View matched trucks</button>{(STATUS_NEXT[load.status] || []).length > 0 && <div className="factory-inline-status"><select value={nextStatus} onChange={e => setNextStatus(e.target.value)} aria-label="Next shipment status"><option value="">Update status</option>{STATUS_NEXT[load.status].map(s => <option key={s}>{s}</option>)}</select><button className="factory-text-button" disabled={!nextStatus} onClick={() => { onStatus(load, nextStatus); setNextStatus(""); }}>Apply</button></div>}</div></article>; }
