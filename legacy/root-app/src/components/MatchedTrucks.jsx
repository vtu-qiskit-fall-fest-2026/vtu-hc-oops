import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw, Truck, MapPin, CalendarDays, IndianRupee, Package, Languages, Moon, Sun, Route, Gauge, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { getMyLoads } from "../services/loadApi.js";
import { getTruckMatches } from "../services/truckApi.js";
import { useLoadsetuLanguage } from "../hooks/useLoadsetuLanguage.js";
import { getLoadsetuTheme, setLoadsetuTheme } from "../theme.js";
import "../matched-trucks.css";

const copy = {
 en: { eyebrow:"FACTORY WORKSPACE", title:"Matched trucks", desc:"Compare available transporters for your shipment using capacity, vehicle type, route fit and estimated quote.", choose:"Select a load", loadPrompt:"Choose one of your saved loads to find compatible trucks.", loading:"Loading your loads…", noLoads:"No loads available yet", createFirst:"Create a load first, then return here to find suitable trucks.", create:"Create load", refresh:"Refresh matches", route:"Route", capacity:"Capacity", vehicle:"Vehicle type", quote:"Factory offer", score:"Match score", fit:"Compatibility", available:"Available", noMatches:"No suitable trucks found", noMatchesDesc:"There are no available transporter profiles matching this load yet. Matches will appear when transporters register truck details.", loadingMatches:"Finding suitable trucks…", selectLoad:"Find trucks", pickup:"Pickup", destination:"Destination", weight:"Load weight", pickupDate:"Pickup date", offered:"Offered price", capacityOk:"Capacity fits", routeFit:"Route fit", typeFit:"Vehicle fit", unknownRoute:"Route not specified", estimated:"Quote not provided", back:"Dashboard", module:"SMART MATCHING", error:"Could not load matching results.", retry:"Try again", notice:"Matching is based on registered truck profiles. A match score is a compatibility estimate, not a guarantee of availability or final price." },
 mr: { eyebrow:"फॅक्टरी कार्यक्षेत्र", title:"जुळणारे ट्रक", desc:"क्षमता, वाहन प्रकार, मार्ग आणि अंदाजित दरानुसार तुमच्या मालासाठी उपलब्ध ट्रकची तुलना करा.", choose:"माल निवडा", loadPrompt:"योग्य ट्रक शोधण्यासाठी तुमच्या जतन केलेल्या मालाची निवड करा.", loading:"तुमचा माल लोड होत आहे…", noLoads:"अद्याप माल उपलब्ध नाही", createFirst:"प्रथम माल नोंदवा आणि योग्य ट्रक शोधण्यासाठी येथे परत या.", create:"माल नोंदवा", refresh:"जुळणी रिफ्रेश करा", route:"मार्ग", capacity:"क्षमता", vehicle:"वाहन प्रकार", quote:"प्रस्तावित दर", score:"जुळणी गुण", fit:"अनुकूलता", available:"उपलब्ध", noMatches:"योग्य ट्रक सापडले नाहीत", noMatchesDesc:"या मालाशी जुळणारे उपलब्ध ट्रक प्रोफाइल नाहीत. वाहतूकदार ट्रकची माहिती नोंदवल्यावर जुळणी दिसेल.", loadingMatches:"योग्य ट्रक शोधत आहे…", selectLoad:"ट्रक शोधा", pickup:"उचलण्याचे ठिकाण", destination:"गंतव्य", weight:"मालाचे वजन", pickupDate:"उचलण्याची तारीख", offered:"प्रस्तावित दर", capacityOk:"क्षमता योग्य", routeFit:"मार्ग जुळतो", typeFit:"वाहन जुळते", unknownRoute:"मार्ग दिलेला नाही", estimated:"दर दिलेला नाही", back:"डॅशबोर्ड", module:"स्मार्ट जुळणी", error:"जुळणी निकाल लोड करता आले नाहीत.", retry:"पुन्हा प्रयत्न करा", notice:"जुळणी नोंदवलेल्या ट्रक प्रोफाइलवर आधारित आहे. जुळणी गुण हा अंदाज आहे; उपलब्धता किंवा अंतिम दराची हमी नाही." },
 hi: { eyebrow:"फैक्टरी कार्यक्षेत्र", title:"मिलान वाले ट्रक", desc:"क्षमता, वाहन प्रकार, मार्ग और अनुमानित किराये के आधार पर अपने शिपमेंट के लिए ट्रकों की तुलना करें।", choose:"लोड चुनें", loadPrompt:"उपयुक्त ट्रक खोजने के लिए अपने सेव किए गए लोड में से एक चुनें।", loading:"आपके लोड लोड हो रहे हैं…", noLoads:"अभी कोई लोड उपलब्ध नहीं है", createFirst:"पहले लोड बनाएँ, फिर उपयुक्त ट्रक खोजने के लिए यहाँ आएँ।", create:"लोड बनाएँ", refresh:"मिलान रीफ़्रेश करें", route:"मार्ग", capacity:"क्षमता", vehicle:"वाहन प्रकार", quote:"प्रस्तावित किराया", score:"मिलान स्कोर", fit:"अनुकूलता", available:"उपलब्ध", noMatches:"कोई उपयुक्त ट्रक नहीं मिला", noMatchesDesc:"इस लोड से मेल खाने वाले उपलब्ध ट्रक प्रोफ़ाइल अभी नहीं हैं। ट्रांसपोर्टर ट्रक विवरण जोड़ेंगे तो मिलान दिखेंगे।", loadingMatches:"उपयुक्त ट्रक खोज रहे हैं…", selectLoad:"ट्रक खोजें", pickup:"पिकअप स्थान", destination:"गंतव्य", weight:"लोड का वजन", pickupDate:"पिकअप तारीख", offered:"प्रस्तावित किराया", capacityOk:"क्षमता उपयुक्त", routeFit:"मार्ग मेल खाता है", typeFit:"वाहन मेल खाता है", unknownRoute:"मार्ग नहीं दिया गया", estimated:"किराया नहीं दिया गया", back:"डैशबोर्ड", module:"स्मार्ट मिलान", error:"मिलान परिणाम लोड नहीं हो सके।", retry:"फिर कोशिश करें", notice:"मिलान पंजीकृत ट्रक प्रोफ़ाइल पर आधारित है। स्कोर केवल अनुकूलता का अनुमान है, उपलब्धता या अंतिम किराये की गारंटी नहीं।" }
};
const money = value => value == null ? "—" : new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(value);
const dateText = value => value ? new Date(value).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";

export default function MatchedTrucks() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLoadsetuLanguage();
  const t = copy[language] || copy.en;
  const [theme, setTheme] = React.useState(getLoadsetuTheme());
  const [loads, setLoads] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [matches, setMatches] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [matching, setMatching] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { const update = e => setTheme(e.detail || getLoadsetuTheme()); window.addEventListener("loadsetu-theme-change", update); return () => window.removeEventListener("loadsetu-theme-change", update); }, []);
  const changeTheme = value => { setLoadsetuTheme(value); setTheme(value); };
  const selectedLoad = loads.find(load => load._id === selectedId);
  const loadLoads = React.useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await getMyLoads();
      const list = Array.isArray(result.loads) ? result.loads : [];
      setLoads(list);
      setSelectedId(current => list.some(load => load._id === current) ? current : (list[0]?._id || ""));
    } catch (e) { setError(e.message || t.error); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { loadLoads(); }, [loadLoads]);
  const runMatches = React.useCallback(async id => {
    if (!id) { setMatches([]); return; }
    setMatching(true); setError("");
    try { const result = await getTruckMatches(id); setMatches(Array.isArray(result.matches) ? result.matches : []); }
    catch (e) { setMatches([]); setError(e.message || t.error); }
    finally { setMatching(false); }
  }, [t.error]);
  React.useEffect(() => { if (selectedId) runMatches(selectedId); }, [selectedId, runMatches]);

  return <main className="matched-page">
    <div className="matched-ambient" aria-hidden="true"><span className="matched-orb"/><span className="matched-orb matched-orb-two"/><div className="matched-grid"/><div className="matched-route matched-route-one"/><div className="matched-route matched-route-two"/></div>
    <header className="matched-header">
      <button className="matched-back" onClick={() => navigate("/factory/dashboard")}><ArrowLeft size={17}/>{t.back}</button>
      <div className="matched-brand"><span className="matched-brand-icon"><Truck size={21}/></span><div><strong>LOADSETU</strong><small>{t.module}</small></div></div>
      <div className="matched-header-actions"><label className="matched-language"><Languages size={15}/><select value={language} aria-label="Language" onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select></label><div className="theme-control"><button className={theme === "light" ? "active" : ""} onClick={() => changeTheme("light")} aria-label="Light theme"><Sun size={15}/></button><button className={theme === "dark" ? "active" : ""} onClick={() => changeTheme("dark")} aria-label="Dark theme"><Moon size={15}/></button></div></div>
    </header>
    <section className="matched-intro"><p className="workspace-eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p>{t.desc}</p></section>
    {error && <div className="matched-error" role="alert"><AlertCircle size={18}/><span>{error}</span><button onClick={() => selectedId ? runMatches(selectedId) : loadLoads()}>{t.retry}</button></div>}
    <section className="matched-filter">
      <label><span>{t.choose}</span><select value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={loading || loads.length === 0}><option value="">{loading ? t.loading : t.choose}</option>{loads.map(load => <option key={load._id} value={load._id}>{load.title} — {load.pickup} → {load.destination}</option>)}</select></label>
      <button className="matched-refresh" onClick={() => selectedId ? runMatches(selectedId) : loadLoads()} disabled={loading || matching}><RefreshCw size={16} className={matching || loading ? "matched-spin" : ""}/>{t.refresh}</button>
    </section>
    {!loading && loads.length === 0 && <section className="matched-empty"><Package size={32}/><h2>{t.noLoads}</h2><p>{t.createFirst}</p><button className="workspace-primary" onClick={() => navigate("/factory/loads")}>{t.create}<ArrowRight size={16}/></button></section>}
    {selectedLoad && <section className="matched-load-summary"><div className="matched-summary-title"><div><p className="matched-summary-eyebrow">{t.choose}</p><h2>{selectedLoad.title}</h2></div><span className={`load-status ${String(selectedLoad.status || "Open").toLowerCase().replaceAll(" ", "-")}`}>{selectedLoad.status || "Open"}</span></div><div className="matched-summary-grid"><div><MapPin size={16}/><span>{t.pickup}</span><strong>{selectedLoad.pickup}</strong></div><div><Route size={16}/><span>{t.destination}</span><strong>{selectedLoad.destination}</strong></div><div><Gauge size={16}/><span>{t.weight}</span><strong>{selectedLoad.weightTonnes} tonnes</strong></div><div><CalendarDays size={16}/><span>{t.pickupDate}</span><strong>{dateText(selectedLoad.pickupDate)}</strong></div><div><Truck size={16}/><span>{t.vehicle}</span><strong>{selectedLoad.truckType}</strong></div><div><IndianRupee size={16}/><span>{t.offered}</span><strong>{money(selectedLoad.offeredPrice)}</strong></div></div></section>}
    {selectedLoad && <section className="matched-results"><div className="matched-results-heading"><div><p className="matched-summary-eyebrow">{t.module}</p><h2>{t.fit}</h2></div><span>{matching ? t.loadingMatches : `${matches.length} ${t.available}`}</span></div>
      {matching ? <div className="matched-empty"><RefreshCw className="matched-spin" size={27}/><p>{t.loadingMatches}</p></div> : matches.length === 0 ? <div className="matched-empty"><Search size={31}/><h3>{t.noMatches}</h3><p>{t.noMatchesDesc}</p></div> : <div className="matched-cards">{matches.map((truck, index) => <article className="matched-truck-card" key={`${truck._id}-${truck.routeLegId || "legacy"}`}><div className="matched-truck-top"><span className="matched-truck-icon"><Truck size={24}/></span><span className="matched-score"><strong>{truck.matchScore}%</strong><small>{t.score}</small></span></div><div className="matched-truck-name"><h3>{truck.transporter?.name || truck.transporterName || "Transporter"}</h3><span className="matched-rank">#{index + 1}</span></div><p className="matched-registration">{truck.registrationNumber || "Vehicle details"} · {truck.truckType}</p>{truck.routeLeg&&<p className="matched-registration"><strong>{truck.routeLeg.legType==="RETURN"?"Return Journey":"Outward Journey"}:</strong> {truck.routeLeg.origin} → {truck.routeLeg.destination}</p>}<div className="matched-truck-details"><div><Gauge size={15}/><span>{t.capacity}</span><strong>{truck.capacityTonnes} tonnes</strong></div><div><Route size={15}/><span>{t.route}</span><strong>{truck.currentLocation || t.unknownRoute}</strong></div><div><IndianRupee size={15}/><span>{t.quote}</span><strong>{truck.quotedPrice == null ? t.estimated : money(truck.quotedPrice)}</strong></div></div><div className="matched-reasons">{truck.capacityTonnes >= Number(selectedLoad.weightTonnes) && <span><CheckCircle2 size={13}/>{t.capacityOk}</span>}{truck.routeFit && <span><CheckCircle2 size={13}/>{t.routeFit}</span>}{truck.typeFit && <span><CheckCircle2 size={13}/>{t.typeFit}</span>}</div><button className="matched-select-truck" onClick={() => navigate(`/factory/bookings?loadId=${selectedLoad._id}&truckId=${truck._id}&routeLegId=${truck.routeLegId||""}`)}>{language === "mr" ? "बुकिंग तपासा" : language === "hi" ? "बुकिंग देखें" : "Review booking"}<ArrowRight size={16}/></button></article>)}</div>}
    </section>}
    <p className="matched-disclaimer">{t.notice}</p>
  </main>;
}
