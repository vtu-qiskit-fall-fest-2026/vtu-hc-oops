import { useEffect, useState } from "react";
import { translations } from "../i18n/translations.js";

export function setLoadsetuLanguage(language) {
  const next = ["en", "mr", "hi"].includes(language) ? language : "en";
  localStorage.setItem("loadsetu-language", next);
  document.documentElement.lang = next;
  window.dispatchEvent(new CustomEvent("loadsetu-language-change", { detail: next }));
  return next;
}

export function useLoadsetuLanguage() {
  const [language, setLanguage] = useState(() => localStorage.getItem("loadsetu-language") || "en");
  useEffect(() => {
    const update = event => setLanguage(event.detail || localStorage.getItem("loadsetu-language") || "en");
    window.addEventListener("loadsetu-language-change", update);
    return () => window.removeEventListener("loadsetu-language-change", update);
  }, []);
  const dictionary = translations[language] || translations.en;
  const t = key => dictionary[key] || translations.en[key] || key;
  return { language, setLanguage: setLoadsetuLanguage, t };
}
