export function setLoadsetuTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  localStorage.setItem("loadsetu-theme", next);
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  document.body.dataset.theme = next;
  window.dispatchEvent(new CustomEvent("loadsetu-theme-change", { detail: next }));
  return next;
}

export function getLoadsetuTheme() {
  return localStorage.getItem("loadsetu-theme") === "light" ? "light" : "dark";
}

export function initializeLoadsetuTheme() {
  setLoadsetuTheme(getLoadsetuTheme());
}
