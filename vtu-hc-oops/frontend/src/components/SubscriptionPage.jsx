import React, { useEffect, useState } from "react";
import "./SubscriptionPage.css";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ShieldCheck, Truck, Factory, CreditCard } from "lucide-react";
import { createSubscriptionOrder, getMySubscription, getSubscriptionPlans, verifySubscriptionPayment } from "../services/subscriptionApi.js";
import { getLoadsetuTheme } from "../theme.js";

const fallbackPlans = [
  { id: "MONTHLY", name: "Monthly", amount: 299, durationMonths: 1 },
  { id: "HALF_YEARLY", name: "Half-Yearly", amount: 599, durationMonths: 6 },
  { id: "YEARLY", name: "Yearly", amount: 999, durationMonths: 12 }
];

function loadCheckoutScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay Checkout.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Check your internet connection."));
    document.body.appendChild(script);
  });
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = String(JSON.parse(localStorage.getItem("loadsetu-user") || "{}").role || "shipper").toLowerCase();
  const isTransporter = role === "transporter";
  const returnTo = location.state?.returnTo || (isTransporter ? "/transporter/dashboard" : "/factory/dashboard");
  const [plans, setPlans] = useState(fallbackPlans);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [busyPlan, setBusyPlan] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(() => getLoadsetuTheme());

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSubscriptionPlans(), getMySubscription()])
      .then(([planResult, subscriptionResult]) => {
        if (cancelled) return;
        if (Array.isArray(planResult.plans) && planResult.plans.length) setPlans(planResult.plans);
        setActiveSubscription(subscriptionResult.active ? subscriptionResult.subscription : null);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    const themeUpdate = event => setTheme(event.detail || getLoadsetuTheme());
    window.addEventListener("loadsetu-theme-change", themeUpdate);
    return () => { cancelled = true; window.removeEventListener("loadsetu-theme-change", themeUpdate); };
  }, []);

  async function buyPlan(plan) {
    setBusyPlan(plan.id); setError(""); setNotice("");
    try {
      const order = await createSubscriptionOrder(plan.id);
      await loadCheckoutScript();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not initialize.");
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "LOADSETU",
        description: `${order.plan.name} subscription`,
        order_id: order.orderId,
        prefill: order.prefill || {},
        notes: { role },
        theme: { color: theme === "light" ? "#829477" : "#35E0D0" },
        modal: { ondismiss: () => setNotice("Checkout closed. No subscription was activated; you can retry whenever you are ready.") },
        handler: async response => {
          try {
            const result = await verifySubscriptionPayment(response);
            setActiveSubscription(result.subscription);
            setNotice("Payment verified. Your subscription is active.");
            window.setTimeout(() => navigate(returnTo, { replace: true, state: { subscriptionActivated: true } }), 900);
          } catch (verificationError) {
            setError(verificationError.message || "Payment verification failed. Your subscription remains inactive.");
          } finally { setBusyPlan(""); }
        }
      });
      checkout.on("payment.failed", event => {
        setError(event?.error?.description || "Payment failed. Your subscription remains inactive. You can retry.");
        setBusyPlan("");
      });
      checkout.open();
    } catch (e) {
      setError(e.message || "Could not start checkout.");
      setBusyPlan("");
    }
  }

  if (busy) return <main className={`subscription-page ${theme === "light" ? "workspace-light" : "workspace-dark"}`}><p>Checking your subscription…</p></main>;

  return (
    <main className={`subscription-page ${theme === "light" ? "workspace-light" : "workspace-dark"}`}>
      <header className="subscription-header">
        <button className="subscription-back" onClick={() => navigate(isTransporter ? "/transporter/dashboard" : "/factory/dashboard")}><ArrowLeft size={17}/> Dashboard</button>
        <span className="subscription-brand"><Truck size={20}/> LOADSETU</span>
      </header>
      <section className="subscription-intro">
        <span className="subscription-kicker"><ShieldCheck size={16}/> SECURE TEST MODE CHECKOUT</span>
        <h1>Choose your LOADSETU plan</h1>
        <p>{isTransporter ? "Activate a subscription to register and manage your trucks." : "Activate a subscription to create and manage your loads."} Payments are processed using Razorpay Test Mode during local development.</p>
      </section>
      {error && <div className="subscription-alert error" role="alert">{error}</div>}
      {notice && <div className="subscription-alert success" role="status">{notice}</div>}
      {activeSubscription ? (
        <section className="subscription-active"><CheckCircle2 size={28}/><div><h2>Your subscription is active</h2><p>Valid until {new Date(activeSubscription.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.</p></div><button onClick={() => navigate(returnTo, { replace: true })}>Continue</button></section>
      ) : (
        <section className="subscription-plans">
          {plans.map((plan, index) => <article className={`subscription-plan ${index === 1 ? "featured" : ""}`} key={plan.id}>
            <span className="subscription-plan-icon">{isTransporter ? <Truck size={21}/> : <Factory size={21}/>}</span>
            <p className="subscription-plan-name">{plan.name}</p>
            <h2>₹{Number(plan.amount).toLocaleString("en-IN")}</h2>
            <p className="subscription-plan-duration">Access for {plan.durationMonths} {plan.durationMonths === 1 ? "month" : "months"}</p>
            <ul><li><CheckCircle2 size={15}/> Create {isTransporter ? "truck registrations" : "loads"}</li><li><CheckCircle2 size={15}/> Use matching and booking tools</li><li><CheckCircle2 size={15}/> Existing records remain saved</li></ul>
            <button disabled={Boolean(busyPlan)} onClick={() => buyPlan(plan)}><CreditCard size={16}/>{busyPlan === plan.id ? "Opening checkout…" : "Pay Now"}</button>
          </article>)}
        </section>
      )}
      <p className="subscription-footnote">Test mode only: use Razorpay's official test payment details. No webhook is used in this local workflow. A subscription is activated only after the backend verifies the payment.</p>
    </main>
  );
}
