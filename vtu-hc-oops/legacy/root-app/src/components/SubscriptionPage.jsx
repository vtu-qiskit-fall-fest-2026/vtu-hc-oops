import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ShieldCheck, Truck, Factory, WalletCards } from "lucide-react";
import { getLoadsetuTheme } from "../theme.js";
import { createSubscriptionOrder, failSubscriptionPayment, getMySubscription, verifySubscriptionPayment } from "../services/subscriptionApi.js";

const plans = [
  { id: "MONTHLY", title: "Monthly", duration: "1 Month", price: 299 },
  { id: "HALF_YEARLY", title: "Half-Yearly", duration: "6 Months", price: 599 },
  { id: "YEARLY", title: "Yearly", duration: "1 Year", price: 999 },
];
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Check your internet connection."));
    document.body.appendChild(script);
  });
}

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = (() => { try { return JSON.parse(localStorage.getItem("loadsetu-user") || "{}"); } catch { return {}; } })();
  const [theme] = useState(getLoadsetuTheme());
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState(null);
  const next = new URLSearchParams(location.search).get("next") || (user.role === "transporter" ? "/transporter/dashboard" : "/factory/loads");

  useEffect(() => { getMySubscription().then(result => { setActive(result.subscription || null); if (result.active) { setNotice("Your subscription is already active."); } }).catch(e => setError(e.message)).finally(() => setChecking(false)); }, []);

  async function pay(plan) {
    setLoading(true); setError(""); setNotice("");
    try {
      const order = await createSubscriptionOrder(plan.id);
      await loadRazorpay();
      const checkout = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, name: "LOADSETU", description: `${plan.title} subscription`, order_id: order.orderId,
        prefill: { name: order.user.name || "", email: order.user.email || "", contact: order.user.phone || "" },
        theme: { color: "#829477" },
        handler: async response => {
          try {
            const verified = await verifySubscriptionPayment(response);
            setActive(verified.subscription); setNotice(verified.message || "Subscription activated.");
            window.setTimeout(() => navigate(next, { replace: true }), 900);
          } catch (e) { setError(e.message || "Payment verification failed. Please contact support before retrying."); }
          finally { setLoading(false); }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      checkout.on("payment.failed", async () => { try { await failSubscriptionPayment(order.subscriptionId); } catch {} setError("Payment failed. You can safely try again."); setLoading(false); });
      checkout.open();
    } catch (e) { setError(e.message || "Unable to start payment."); setLoading(false); }
  }

  return <main className={`subscription-page ${theme === "light" ? "subscription-light" : "subscription-dark"}`}>
    <header className="subscription-header"><button onClick={() => navigate(user.role === "transporter" ? "/transporter/dashboard" : "/factory/dashboard")}><ArrowLeft size={16}/> Dashboard</button><strong>LOADSETU</strong><span><ShieldCheck size={16}/> Secure subscription</span></header>
    <section className="subscription-intro"><span className="subscription-icon"><WalletCards size={25}/></span><p>LOADSETU MEMBERSHIP</p><h1>Choose Your LoadSetu Plan</h1><div>One subscription for your {user.role === "transporter" ? "truck registrations" : "load creation"}. Pay securely and continue using your existing workspace.</div><span className="subscription-role">{user.role === "transporter" ? <Truck size={15}/> : <Factory size={15}/>} {user.role === "transporter" ? "Transporter account" : "Factory owner account"}</span></section>
    {error && <p className="subscription-message error" role="alert">{error}</p>}{notice && <p className="subscription-message success" role="status">{notice}</p>}
    {active?.subscriptionStatus === "ACTIVE" && active.endDate && <p className="subscription-message success">Active until {new Date(active.endDate).toLocaleDateString("en-IN")}.</p>}
    <section className="subscription-plans">{plans.map((plan, i) => <article className={`subscription-plan ${i === 1 ? "recommended" : ""}`} key={plan.id}>{i === 1 && <span className="plan-ribbon">POPULAR</span>}<h2>{plan.title}</h2><p>{plan.duration} access</p><div className="plan-price"><sup>₹</sup>{plan.price}</div><ul><li><CheckCircle2 size={16}/> Create loads or register trucks</li><li><CheckCircle2 size={16}/> Use matching features</li><li><CheckCircle2 size={16}/> No repeat payment while active</li></ul><button disabled={loading || checking || Boolean(active?.subscriptionStatus === "ACTIVE")} onClick={() => pay(plan)}>{loading ? "Please wait…" : active?.subscriptionStatus === "ACTIVE" ? "Subscription Active" : "Pay Now"}</button></article>)}</section>
    <p className="subscription-footnote">Payment is activated only after the backend verifies the Razorpay signature. Your existing loads and trucks are retained if your subscription expires.</p>
  </main>;
}
