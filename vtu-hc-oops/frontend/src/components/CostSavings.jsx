import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Languages, Sun, Moon } from "lucide-react";
import { getLoadsetuTheme, setLoadsetuTheme } from "../theme.js";
import { useLoadsetuLanguage } from "../hooks/useLoadsetuLanguage.js";
import "./CostSavings.css";

// Demo data for the UI. Replace this with records from your backend API.
const savingsWords = {
  en: { back:"Dashboard", panel:"FACTORY CONTROL PANEL", eyebrow:"COST & SAVINGS", title:"Cost & Savings", subtitle:"Track your freight spending, compare prices and discover return-load opportunities.", date:"Date Range", route:"Route", shipmentStatus:"Shipment Status", apply:"Apply Filters", spending:"Total Freight Spending", avg:"Average Cost per Tonne", completed:"Completed Shipments", estimated:"Estimated Savings", lowerMonth:"Lower than last month", marketLower:"Lower than market average", identified:"Potential savings identified", trend:"Monthly Freight Cost Trend", compare:"Route-wise Price Comparison", perTonne:"Per tonne", breakdown:"Cost Breakdown", recent:"Recent Shipments & Savings", viewLoads:"View Loads", returnLoads:"Return-load Opportunities", sample:"Sample opportunities", dateCol:"Date", truckType:"Truck Type", freight:"Freight Price", market:"Market Avg.", savings:"Savings", status:"Status", action:"Action", view:"View", noRows:"{ui.noRows}", disclaimer:"{ui.disclaimer}" },
  mr: { back:"डॅशबोर्ड", panel:"फॅक्टरी नियंत्रण पॅनेल", eyebrow:"खर्च आणि बचत", title:"खर्च आणि बचत", subtitle:"वाहतूक खर्च पहा, दरांची तुलना करा आणि परतीच्या मालाच्या संधी शोधा.", date:"तारीख श्रेणी", route:"मार्ग", shipmentStatus:"शिपमेंट स्थिती", apply:"फिल्टर लागू करा", spending:"एकूण वाहतूक खर्च", avg:"प्रति टन सरासरी खर्च", completed:"पूर्ण शिपमेंट", estimated:"अंदाजित बचत", lowerMonth:"मागील महिन्यापेक्षा कमी", marketLower:"बाजार दरापेक्षा कमी", identified:"संभाव्य बचत", trend:"मासिक वाहतूक खर्चाचा कल", compare:"मार्गानुसार दर तुलना", perTonne:"प्रति टन", breakdown:"खर्च विभागणी", recent:"अलीकडील शिपमेंट आणि बचत", viewLoads:"माल पहा", returnLoads:"परतीच्या मालाच्या संधी", sample:"नमुना संधी", dateCol:"तारीख", truckType:"ट्रक प्रकार", freight:"वाहतूक दर", market:"बाजार सरासरी", savings:"बचत", status:"स्थिती", action:"कृती", view:"पहा", noRows:"या फिल्टरशी जुळणारा नमुना माल नाही.", disclaimer:"नमुना डॅशबोर्ड: आकडे आणि परतीच्या संधी केवळ उदाहरणासाठी आहेत; थेट डेटा नाही." },
  hi: { back:"डैशबोर्ड", panel:"फैक्टरी कंट्रोल पैनल", eyebrow:"लागत और बचत", title:"लागत और बचत", subtitle:"माल ढुलाई खर्च देखें, कीमतों की तुलना करें और वापसी-लोड के अवसर खोजें।", date:"तारीख सीमा", route:"रूट", shipmentStatus:"शिपमेंट स्थिति", apply:"फ़िल्टर लागू करें", spending:"कुल माल ढुलाई खर्च", avg:"प्रति टन औसत लागत", completed:"पूरे शिपमेंट", estimated:"अनुमानित बचत", lowerMonth:"पिछले महीने से कम", marketLower:"बाज़ार औसत से कम", identified:"संभावित बचत मिली", trend:"मासिक माल ढुलाई लागत", compare:"रूट के अनुसार कीमत तुलना", perTonne:"प्रति टन", breakdown:"लागत विभाजन", recent:"हाल के शिपमेंट और बचत", viewLoads:"लोड देखें", returnLoads:"वापसी-लोड अवसर", sample:"नमूना अवसर", dateCol:"तारीख", truckType:"ट्रक प्रकार", freight:"भाड़ा", market:"बाज़ार औसत", savings:"बचत", status:"स्थिति", action:"कार्रवाई", view:"देखें", noRows:"इन फ़िल्टर से मेल खाने वाला कोई नमूना शिपमेंट नहीं है।", disclaimer:"डेमो डैशबोर्ड: आँकड़े उदाहरण के लिए हैं, लाइव शिपमेंट डेटा नहीं।" }
};

const demoShipments = [
  { date: "20 Oct 2026", route: "Pune → Kolhapur", truck: "14-Wheeler", freight: 18000, market: 22000, status: "Completed" },
  { date: "18 Oct 2026", route: "Pune → Mumbai", truck: "22-Wheeler", freight: 32000, market: 36000, status: "Completed" },
  { date: "15 Oct 2026", route: "Pune → Nashik", truck: "12-Wheeler", freight: 14000, market: 17000, status: "Completed" },
  { date: "12 Oct 2026", route: "Pune → Solapur", truck: "14-Wheeler", freight: 20000, market: 23000, status: "In Transit" },
];

const returnLoads = [
  { route: "Kolhapur → Pune", date: "22 Oct 2026", truck: "14-Wheeler", saving: 3500 },
  { route: "Mumbai → Pune", date: "25 Oct 2026", truck: "22-Wheeler", saving: 5000 },
  { route: "Nashik → Pune", date: "27 Oct 2026", truck: "12-Wheeler", saving: 2500 },
  { route: "Solapur → Pune", date: "29 Oct 2026", truck: "14-Wheeler", saving: 3000 },
];

const trend = [
  { month: "Apr", cost: 4.7, market: 5.6 },
  { month: "May", cost: 4.6, market: 5.2 },
  { month: "Jun", cost: 3.7, market: 4.9 },
  { month: "Jul", cost: 5.2, market: 5.7 },
  { month: "Aug", cost: 4.8, market: 5.3 },
  { month: "Sep", cost: 4.1, market: 5.5 },
  { month: "Oct", cost: 3.9, market: 4.8 },
];

const routeComparisons = [
  { route: "Pune → Kolhapur", yours: 1800, market: 2200 },
  { route: "Pune → Mumbai", yours: 2400, market: 2800 },
  { route: "Pune → Nashik", yours: 1600, market: 1900 },
  { route: "Pune → Solapur", yours: 2000, market: 2400 },
];

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function Icon({ children }) {
  return <span className="cs-icon" aria-hidden="true">{children}</span>;
}

function KpiCard({ icon, label, value, note, tone = "" }) {
  return (
    <article className={`cs-kpi ${tone}`}>
      <Icon>{icon}</Icon>
      <div className="cs-kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function TrendChart() {
  const width = 520;
  const height = 160;
  const max = 6.5;
  const x = (index) => 18 + index * ((width - 36) / (trend.length - 1));
  const y = (value) => height - 18 - (value / max) * (height - 36);
  const line = (key) => trend.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`).join(" ");
  const area = `${line("cost")} L ${x(trend.length - 1)} ${height - 18} L ${x(0)} ${height - 18} Z`;

  return (
    <div className="cs-chart-wrap">
      <svg className="cs-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly freight cost and estimated market average trend">
        {[0, 2, 4, 6].map((tick) => (
          <g key={tick}>
            <line x1="18" x2={width - 18} y1={y(tick)} y2={y(tick)} className="cs-grid-line" />
            <text x="16" y={y(tick) - 5} className="cs-axis-label">{tick === 0 ? "₹0" : `₹${tick}L`}</text>
          </g>
        ))}
        <path d={area} className="cs-area-fill" />
        <path d={line("market")} className="cs-market-line" />
        <path d={line("cost")} className="cs-cost-line" />
        {trend.map((point, index) => (
          <g key={point.month}>
            <circle cx={x(index)} cy={y(point.cost)} r="3.5" className="cs-cost-point" />
            <text x={x(index)} y={height - 2} textAnchor="middle" className="cs-month-label">{point.month}</text>
          </g>
        ))}
      </svg>
      <div className="cs-chart-legend">
        <span><i className="cs-legend-dot cs-amber" /> Your freight cost</span>
        <span><i className="cs-legend-dot cs-muted-dot" /> Market average (est.)</span>
      </div>
    </div>
  );
}

function ComparisonChart() {
  const max = Math.max(...routeComparisons.map((item) => item.market));
  return (
    <div className="cs-comparison">
      {routeComparisons.map((item) => (
        <div className="cs-comparison-item" key={item.route}>
          <div className="cs-bars">
            <div className="cs-bar-group">
              <span className="cs-bar-value">{money(item.yours)}</span>
              <div className="cs-bar cs-bar-yours" style={{ height: `${(item.yours / max) * 100}%` }} />
            </div>
            <div className="cs-bar-group">
              <span className="cs-bar-value">{money(item.market)}</span>
              <div className="cs-bar cs-bar-market" style={{ height: `${(item.market / max) * 100}%` }} />
            </div>
          </div>
          <span className="cs-route-label">{item.route.replace("Pune → ", "Pune →\n")}</span>
        </div>
      ))}
      <div className="cs-chart-legend">
        <span><i className="cs-legend-dot cs-amber" /> Your price / tonne</span>
        <span><i className="cs-legend-dot cs-muted-dot" /> Market average / tonne</span>
      </div>
    </div>
  );
}

function CostBreakdown() {
  const slices = [
    { label: "Pune → Kolhapur", percent: 32, color: "#f5a623" },
    { label: "Pune → Mumbai", percent: 28, color: "#55b8a8" },
    { label: "Pune → Nashik", percent: 20, color: "#54a7ef" },
    { label: "Pune → Solapur", percent: 15, color: "#8c6de9" },
    { label: "Other routes", percent: 5, color: "#708c98" },
  ];
  let current = 0;
  const gradient = slices.map((slice) => {
    const start = current;
    current += slice.percent;
    return `${slice.color} ${start}% ${current}%`;
  }).join(", ");

  return (
    <div className="cs-breakdown">
      <div className="cs-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="cs-donut-hole">
          <strong>₹4,85,000</strong>
          <span>Total cost</span>
        </div>
      </div>
      <div className="cs-breakdown-legend">
        {slices.map((slice) => (
          <div key={slice.label}>
            <span><i style={{ background: slice.color }} />{slice.label}</span>
            <strong>{slice.percent}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CostSavings() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLoadsetuLanguage();
  const ui = savingsWords[language] || savingsWords.en;
  const [theme, setTheme] = useState(getLoadsetuTheme());
  useEffect(() => { const update = e => setTheme(e.detail || getLoadsetuTheme()); window.addEventListener("loadsetu-theme-change", update); return () => window.removeEventListener("loadsetu-theme-change", update); }, []);
  const [month, setMonth] = useState("Oct 2026");
  const [route, setRoute] = useState("All Routes");
  const [status, setStatus] = useState("All Status");
  const [appliedFilters, setAppliedFilters] = useState({ month: "Oct 2026", route: "All Routes", status: "All Status" });

  const filteredShipments = useMemo(() => demoShipments.filter((shipment) => {
    const routeMatch = appliedFilters.route === "All Routes" || shipment.route === appliedFilters.route;
    const statusMatch = appliedFilters.status === "All Status" || shipment.status === appliedFilters.status;
    const monthMatch = ["Oct 2026", "Last 30 days"].includes(appliedFilters.month);
    return routeMatch && statusMatch && monthMatch;
  }), [appliedFilters]);

  const filteredSavings = filteredShipments.reduce((sum, shipment) => sum + Math.max(0, shipment.market - shipment.freight), 0);

  function applyFilters() {
    setAppliedFilters({ month, route, status });
  }

  return (
    <main className={`cost-savings-page ${theme === "light" ? "cs-theme-light" : ""}`} lang={language}>
      <header className="cs-topbar">
        <button className="cs-back" onClick={() => navigate("/factory/dashboard")}>← <span>{ui.back}</span></button>
        <div className="cs-brand">LOADSETU <small>{ui.panel}</small></div>
        <div className="cs-top-actions">
          <label className="cs-language"><Languages size={14}/><select value={language} onChange={e=>setLanguage(e.target.value)} aria-label="Language"><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select></label>
          <button type="button" className={`cs-theme-icon ${theme === "light" ? "cs-moon" : ""}`} onClick={()=>{setLoadsetuTheme("light");setTheme("light");}} aria-label="Sandstone Light"><Sun size={16}/></button>
          <button type="button" className={`cs-theme-icon ${theme === "dark" ? "cs-moon" : ""}`} onClick={()=>{setLoadsetuTheme("dark");setTheme("dark");}} aria-label="Midnight Logistics"><Moon size={16}/></button>
        </div>
      </header>

      <section className="cs-heading-row">
        <div className="cs-heading-icon"><Icon>▤</Icon></div>
        <div className="cs-heading-copy">
          <span className="cs-eyebrow">{ui.eyebrow}</span>
          <h1>{ui.title}</h1>
          <p>{ui.subtitle}</p>
        </div>
        <div className="cs-filters">
          <label>{ui.date}
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option>Oct 2026</option><option>Sep 2026</option><option>Aug 2026</option><option>Last 30 days</option>
            </select>
          </label>
          <label>{ui.route}
            <select value={route} onChange={(event) => setRoute(event.target.value)}>
              <option>All Routes</option>
              {demoShipments.map((shipment) => <option key={shipment.route}>{shipment.route}</option>)}
            </select>
          </label>
          <label>{ui.shipmentStatus}
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>All Status</option><option>Completed</option><option>In Transit</option>
            </select>
          </label>
          <button className="cs-apply" onClick={applyFilters}>{ui.apply}</button>
        </div>
      </section>

      <section className="cs-kpi-grid">
        <KpiCard icon="▤" label={ui.spending} value="₹4,85,000" note={`↓ 12% ${ui.lowerMonth}`} tone="cs-kpi-amber" />
        <KpiCard icon="▥" label={ui.avg} value="₹1,850" note={`↓ 8% ${ui.marketLower}`} tone="cs-kpi-green" />
        <KpiCard icon="🚚" label={ui.completed} value="28" note="↗ +4" tone="cs-kpi-blue" />
        <KpiCard icon="🐷" label={ui.estimated} value={money(filteredSavings)} note={ui.identified} tone="cs-kpi-gold" />
      </section>

      <section className="cs-analytics-grid">
        <article className="cs-panel cs-trend-panel">
          <div className="cs-panel-title"><h2>{ui.trend}</h2><span className="cs-sample-label">Illustrative data</span></div>
          <TrendChart />
        </article>
        <article className="cs-panel">
          <div className="cs-panel-title"><h2>{ui.compare}</h2><span className="cs-sample-label">{ui.perTonne}</span></div>
          <ComparisonChart />
        </article>
        <article className="cs-panel">
          <div className="cs-panel-title"><h2>{ui.breakdown}</h2><span className="cs-sample-label">{appliedFilters.month}</span></div>
          <CostBreakdown />
        </article>
      </section>

      <section className="cs-bottom-grid">
        <article className="cs-panel cs-table-panel">
          <div className="cs-panel-title"><h2>{ui.recent}</h2><button className="cs-text-button" onClick={() => navigate("/factory/loads")}>{ui.viewLoads} ↗</button></div>
          <div className="cs-table-scroll">
            <table className="cs-table">
              <thead><tr><th>{ui.dateCol}</th><th>Route</th><th>{ui.truckType}</th><th>{ui.freight}</th><th>{ui.market}</th><th>{ui.savings}</th><th>{ui.status}</th></tr></thead>
              <tbody>
                {filteredShipments.map((shipment) => (
                  <tr key={`${shipment.date}-${shipment.route}`}>
                    <td>{shipment.date}</td><td>{shipment.route}</td><td>{shipment.truck}</td>
                    <td>{money(shipment.freight)}</td><td>{money(shipment.market)}</td>
                    <td className="cs-saving-cell">{money(Math.max(0, shipment.market - shipment.freight))}</td>
                    <td><span className={`cs-status ${shipment.status === "Completed" ? "is-completed" : "is-transit"}`}>{shipment.status}</span></td>
                  </tr>
                ))}
                {filteredShipments.length === 0 && <tr><td colSpan="7" className="cs-empty">{ui.noRows}</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="cs-panel cs-table-panel">
          <div className="cs-panel-title"><h2>{ui.returnLoads}</h2><span className="cs-sample-label">{ui.sample}</span></div>
          <div className="cs-table-scroll">
            <table className="cs-table cs-return-table">
              <thead><tr><th>Return Route</th><th>{ui.dateCol}</th><th>{ui.truckType}</th><th>Est. Saving</th><th>{ui.action}</th></tr></thead>
              <tbody>{returnLoads.map((load) => (
                <tr key={load.route}>
                  <td>{load.route}</td><td>{load.date}</td><td>{load.truck}</td><td className="cs-saving-cell">{money(load.saving)}</td>
                  <td><button className="cs-view-button" onClick={() => navigate("/factory/matches")}>{ui.view}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </article>
      </section>
      <p className="cs-disclaimer">{ui.disclaimer}</p>
    </main>
  );
}
