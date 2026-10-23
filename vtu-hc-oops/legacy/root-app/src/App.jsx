import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setLoadsetuTheme } from "./theme.js";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Languages,
  LockKeyhole,
  Moon,
  Sun,
  Truck,
  Waypoints,
  Factory,
  Handshake,
} from "lucide-react";
import AnimatedLogistics from "./components/AnimatedLogistics.jsx";
import { translations } from "./i18n/translations.js";
import { login, signup } from "./services/api.js";

const ROLE_DESCRIPTIONS = {
  en: {
    broker: "Connect goods owners with transporters.",
    shipper: "Find suitable trucks to move your goods.",
    transporter: "Register trucks and receive load requests.",
    selectRole: "Choose how you want to use LOADSETU.",
    roleRequired: "Please select your account type.",
    loginRoleRequired: "Select the account type linked to your account.",
    roleMismatch: "The selected account type does not match this account.",
  },
  mr: {
    broker: "माल मालक आणि ट्रान्सपोर्टर यांना जोडा.",
    shipper: "तुमचा माल नेण्यासाठी योग्य ट्रक शोधा.",
    transporter: "ट्रक नोंदवा आणि मालवाहतुकीची कामे मिळवा.",
    selectRole: "तुम्हाला LOADSETU कसे वापरायचे आहे ते निवडा.",
    roleRequired: "कृपया तुमच्या खात्याचा प्रकार निवडा.",
    loginRoleRequired: "तुमच्या खात्याशी संबंधित भूमिका निवडा.",
    roleMismatch: "निवडलेली भूमिका या खात्याशी जुळत नाही.",
  },
  hi: {
    broker: "माल मालिकों और ट्रांसपोर्टरों को जोड़ें।",
    shipper: "अपने सामान के लिए सही ट्रक खोजें।",
    transporter: "ट्रक रजिस्टर करें और माल ढुलाई के काम पाएँ।",
    selectRole: "चुनें कि आप LOADSETU का उपयोग कैसे करना चाहते हैं।",
    roleRequired: "कृपया अपने खाते का प्रकार चुनें।",
    loginRoleRequired: "अपने खाते से जुड़ी भूमिका चुनें।",
    roleMismatch: "चुनी गई भूमिका इस खाते से मेल नहीं खाती।",
  },
};

const ROLES = [
  { value: "broker", icon: Handshake, labelKey: "broker" },
  { value: "shipper", icon: Factory, labelKey: "shipper" },
  { value: "transporter", icon: Truck, labelKey: "transporter" },
];

export default function App() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loginRole, setLoginRole] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("loadsetu-theme") || "dark"
  );
  const [lang, setLang] = useState(
    () => localStorage.getItem("loadsetu-language") || "en"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState({ aadhaar: null, drivingLicense: null });
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "",
    gstin: "",
  });

  const t = translations[lang] || translations.en;
  const roleText = ROLE_DESCRIPTIONS[lang] || ROLE_DESCRIPTIONS.en;
  const isSignup = mode === "signup";

  function changeTheme(next) {
    setTheme(next);
    setLoadsetuTheme(next);
  }

  function changeLanguage(next) {
    setLang(next);
    localStorage.setItem("loadsetu-language", next);
    document.documentElement.lang = next;
    window.dispatchEvent(
      new CustomEvent("loadsetu-language-change", { detail: next })
    );
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    if (notice) setNotice(null);
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setNotice(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function destinationFor(role) {
    if (role === "broker") return "/broker/dashboard";
    if (role === "transporter") return "/transporter/dashboard";
    return "/factory/dashboard";
  }

  function readDocument(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      if (file.size > 3 * 1024 * 1024) return reject(new Error("Each verification document must be 3 MB or smaller."));
      if (!/[.]pdf$/i.test(file.name) && !["image/jpeg", "image/png", "image/jpg"].includes(file.type)) return reject(new Error("Upload documents as PDF, JPG or PNG files."));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the selected document."));
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    if (!isSignup && !loginRole) {
      setNotice({ type: "error", message: roleText.loginRoleRequired });
      return;
    }
    if (isSignup && !form.role) {
      setNotice({ type: "error", message: roleText.roleRequired });
      return;
    }
    if (isSignup && form.password !== form.confirmPassword) {
      setNotice({ type: "error", message: t.passwordMismatch || "Passwords do not match." });
      return;
    }

    setBusy(true);
    try {
      const payload = isSignup
        ? {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            password: form.password,
            role: form.role,
            gstin: form.gstin.trim().toUpperCase(),
            aadhaarDocument: form.role === "transporter" ? await readDocument(documents.aadhaar) : "",
            drivingLicenseDocument: form.role === "transporter" ? await readDocument(documents.drivingLicense) : "",
            aadhaarFileName: documents.aadhaar?.name || "",
            drivingLicenseFileName: documents.drivingLicense?.name || "",
          }
        : {
            email: form.email.trim(),
            password: form.password,
          };

      const result = isSignup ? await signup(payload) : await login(payload);
      const user = result?.user;
      const token = result?.token;

      if (!token || !user) {
        throw new Error("The server response was incomplete. Please try again.");
      }

      if (!isSignup && String(user.role || "").toLowerCase() !== loginRole) {
        setNotice({ type: "error", message: roleText.roleMismatch });
        return;
      }

      if (isSignup && user.role !== "broker" && user.verificationStatus !== "VERIFIED") {
        setNotice({ type: "success", message: result.message || "Your account has been submitted for broker verification. You can log in after approval." });
        setMode("login");
        setForm(previous => ({ ...previous, password: "", confirmPassword: "" }));
        setDocuments({ aadhaar: null, drivingLicense: null });
        return;
      }

      localStorage.setItem("loadsetu-token", token);
      localStorage.setItem("loadsetu-user", JSON.stringify(user));
      setNotice({
        type: "success",
        message: result.message || (isSignup ? t.successSignup : t.successLogin),
      });
      navigate(destinationFor(String(user.role || "").toLowerCase()), { replace: true });
    } catch (error) {
      setNotice({
        type: "error",
        message: error?.message || t.genericError || "Something went wrong. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`app ${theme === "light" ? "theme-light" : "theme-dark"}`}>
      <AnimatedLogistics />

      <header className="topbar">
        <a className="brand" href="/" onClick={(event) => event.preventDefault()} aria-label="LOADSETU home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span className="brand-copy">
            <strong>LOADSETU</strong>
            <small>{t.brandLine || "LOGISTICS, MADE SIMPLE"}</small>
          </span>
        </a>

        <div className="top-controls">
          <label className="select-wrap" aria-label={t.languageLabel || "Language"}>
            <Languages size={15} />
            <select value={lang} onChange={(event) => changeLanguage(event.target.value)} aria-label={t.languageLabel || "Language"}>
              <option value="en">English</option>
              <option value="mr">मराठी</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>
          <div className="theme-switch" aria-label={t.theme || "Theme"}>
            <button type="button" className={theme === "light" ? "selected" : ""} onClick={() => changeTheme("light")} aria-pressed={theme === "light"}>
              <Sun size={14} /><span>{t.light || t.themeLight || "Light"}</span>
            </button>
            <button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => changeTheme("dark")} aria-pressed={theme === "dark"}>
              <Moon size={14} /><span>{t.dark || t.themeDark || "Dark"}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="auth-layout">
        <div className="story-panel">
          <div className="story-kicker"><span className="kicker-line" />{t.eyebrow || "A better way to move goods"}</div>
          <h1>{t.headline || "Your next load.\nYour next connection."}</h1>
          <p className="story-intro">{t.intro || "Find the right people to move goods, with less waiting and more trust."}</p>
          <div className="feature-pills">
            <span><Waypoints size={16} />{t.stat1 || "Smarter connections"}</span>
            <span><Truck size={16} />{t.stat2 || "Clear routes"}</span>
            <span><CheckCircle2 size={16} />{t.stat3 || "Less waiting"}</span>
          </div>
          <div className="story-bottom">
            <span className="story-icon"><Truck size={21} /></span>
            <div>
              <strong>{t.featureTitle || "Every journey starts with a connection."}</strong>
              <p>{t.featureText || "Bring loads and available trucks closer together with clear information and simple steps."}</p>
            </div>
          </div>
        </div>

        <section className="auth-card" aria-label={isSignup ? t.signupTitle : t.loginTitle}>
          <div className="card-topline">
            <span>LOADSETU</span><b>•</b><span>{t.brandLine || "LOGISTICS, MADE SIMPLE"}</span>
            <LockKeyhole size={15} />
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? "active" : ""} onClick={() => switchMode("login")}>{t.login || "Log in"}</button>
            <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? "active" : ""} onClick={() => switchMode("signup")}>{t.signup || "Create account"}</button>
          </div>

          <div className="form-heading">
            <h2>{isSignup ? (t.signupTitle || "Create your account") : (t.loginTitle || "Welcome back")}</h2>
            <p>{isSignup ? (t.signupSub || "Join LOADSETU and get started in minutes.") : (t.loginSub || "Log in to keep your work moving.")}</p>
          </div>

          {notice && (
            <div className={`notice ${notice.type}`} role="status">
              <span className="notice-mark">{notice.type === "success" ? "✓" : "!"}</span>
              <span>{notice.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {isSignup && (
              <label className="field-label">
                {t.name || "Full name"}
                <input name="name" value={form.name} onChange={updateField} autoComplete="name" placeholder="e.g. Your full name" minLength={2} maxLength={70} required />
              </label>
            )}

            <label className="field-label">
              {t.email || "Email address"}
              <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" placeholder="you@example.com" maxLength={254} required />
            </label>

            {isSignup && (
              <label className="field-label">
                {t.phone || "Phone number (optional)"}
                <input name="phone" type="tel" value={form.phone} onChange={updateField} autoComplete="tel" maxLength={20} placeholder="+91 ..." />
              </label>
            )}

            <div className="role-field">
              <p className="role-instruction">{roleText.selectRole}</p>
              <div className="role-options">
                {ROLES.map(({ value, icon: Icon, labelKey }) => {
                  const selected = isSignup ? form.role === value : loginRole === value;
                  return (
                    <button
                      className={`role-option${selected ? " selected" : ""}`}
                      type="button"
                      key={value}
                      aria-pressed={selected}
                      onClick={() => {
                        if (isSignup) setForm((previous) => ({ ...previous, role: value }));
                        else setLoginRole(value);
                        setNotice(null);
                      }}
                    >
                      <span className="role-icon"><Icon size={20} /></span>
                      <span className="role-copy">
                        <strong>{t[labelKey] || (value === "shipper" ? "Goods owner" : value[0].toUpperCase() + value.slice(1))}</strong>
                        <span className="field-hint">{roleText[value]}</span>
                      </span>
                      {selected && <CheckCircle2 className="role-check" size={19} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {isSignup && form.role === "shipper" && (
              <label className="field-label">
                GSTIN / GST Number
                <input name="gstin" value={form.gstin} onChange={updateField} autoCapitalize="characters" maxLength={15} minLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" placeholder="27ABCDE1234F1Z5" required />
                <span className="field-hint">Enter your 15-character GSTIN. The broker will verify it.</span>
              </label>
            )}

            {isSignup && form.role === "transporter" && (
              <>
                <label className="field-label">Aadhaar Card (PDF, JPG or PNG; max 3 MB)
                  <input type="file" accept="application/pdf,image/jpeg,image/png" required onChange={e => setDocuments(prev => ({ ...prev, aadhaar: e.target.files?.[0] || null }))} />
                </label>
                <label className="field-label">Driving License (PDF, JPG or PNG; max 3 MB)
                  <input type="file" accept="application/pdf,image/jpeg,image/png" required onChange={e => setDocuments(prev => ({ ...prev, drivingLicense: e.target.files?.[0] || null }))} />
                </label>
                <p className="field-hint">Documents are stored privately and can only be viewed by an authenticated broker.</p>
              </>
            )}

            {isSignup && (
              <label className="field-label">
                {t.password || "Password"}
                <span className="field-hint">{t.forgot || "Use at least 8 characters, with a letter and a number."}</span>
                <span className="password-wrap">
                  <input name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={updateField} autoComplete="new-password" minLength={8} placeholder="Create a password" required />
                  <button className="reveal-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (t.hidePassword || "Hide password") : (t.showPassword || "Show password")}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}

            {!isSignup && (
              <label className="field-label">
                {t.password || "Password"}
                <span className="password-wrap">
                  <input name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={updateField} autoComplete="current-password" placeholder="Enter your password" required />
                  <button className="reveal-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (t.hidePassword || "Hide password") : (t.showPassword || "Show password")}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}

            {isSignup && (
              <label className="field-label">
                {t.confirmPassword || "Confirm password"}
                <span className="password-wrap">
                  <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={updateField} autoComplete="new-password" placeholder="Enter password again" required />
                  <button className="reveal-button" type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}

            {!isSignup && <div className="login-help"><span><LockKeyhole size={13} />{t.secure || "Your password is protected"}</span></div>}

            <button className="submit-button" type="submit" disabled={busy}>
              <span>{busy ? (t.loading || "Please wait…") : (isSignup ? (t.submitSignup || "Create my account") : (t.submitLogin || "Log in"))}</span>
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="mode-switch">
            {isSignup ? (t.haveAccount || "Already have an account?") : (t.noAccount || "New to LOADSETU?")}
            <button type="button" onClick={() => switchMode(isSignup ? "login" : "signup")}>
              {isSignup ? (t.switchLogin || "Log in") : (t.switchSignup || "Create an account")}
            </button>
          </p>

          <div className="card-footer">
            <span className="footer-lock"><LockKeyhole size={13} /></span>
            <span>{t.terms || "By continuing, you agree to use LOADSETU responsibly."}</span>
          </div>
        </section>
      </section>

      <footer className="page-footer">
        <span>{t.footerTag || "LOGISTICS, MADE SIMPLE"}</span>
        <span><i />{t.footerLine || "Built for clearer journeys."}</span>
      </footer>
    </main>
  );
}
