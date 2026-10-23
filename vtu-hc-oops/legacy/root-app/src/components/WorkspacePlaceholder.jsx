import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Construction, Languages, Moon, Sun } from "lucide-react";
import { getLoadsetuTheme, setLoadsetuTheme } from "../theme.js";
import { useLoadsetuLanguage } from "../hooks/useLoadsetuLanguage.js";
export default function WorkspacePlaceholder({ title, description, titleKey, descriptionKey }) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLoadsetuLanguage();
  title = titleKey ? t(titleKey) : title;
  description = descriptionKey ? t(descriptionKey) : description;
  const [theme, setTheme] = React.useState(getLoadsetuTheme());
  React.useEffect(() => { const update = e => setTheme(e.detail || getLoadsetuTheme()); window.addEventListener("loadsetu-theme-change", update); return () => window.removeEventListener("loadsetu-theme-change", update); }, []);
  const change = value => { setLoadsetuTheme(value); setTheme(value); };
  return <main className="placeholder-page"><div className="workspace-ambient" aria-hidden="true"><span className="ambient-orb orb-a"/><span className="ambient-orb orb-b"/><div className="ambient-route route-a"/><div className="ambient-route route-b"/><div className="ambient-grid"/></div><header className="placeholder-header"><button onClick={() => navigate("/factory/dashboard")}><ArrowLeft size={17}/>{t("backDashboard")}</button><strong>LOADSETU <small>{t("factoryPanel")}</small></strong><div className="workspace-header-actions"><label className="dashboard-language"><Languages size={15}/><select aria-label={t("languageLabel")} value={language} onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select></label><div className="theme-control"><button className={theme === "light" ? "active" : ""} onClick={() => change("light")} aria-label={t("light")}><Sun size={15}/></button><button className={theme === "dark" ? "active" : ""} onClick={() => change("dark")} aria-label={t("dark")}><Moon size={15}/></button></div></div></header><section className="placeholder-card"><span><Construction size={28}/></span><p className="workspace-eyebrow">{t("placeholderModule")}</p><h1>{title}</h1><p>{description}</p><button className="workspace-primary" onClick={() => navigate("/factory/loads")}>{t("goCreateLoad")} <ArrowLeft size={16}/></button><small>{t("placeholderNotice")}</small></section></main>;
}
