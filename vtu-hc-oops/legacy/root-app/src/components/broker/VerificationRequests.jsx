import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, FileText, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("loadsetu-token") || ""}`, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}
export default function VerificationRequests() {
  const [requests, setRequests] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => { setBusy(true); setError(""); try { const result = await request("/broker/verification/requests"); setRequests(result.requests || []); } catch (e) { setError(e.message); } finally { setBusy(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  async function decide(user, decision) {
    let reason = ""; if (decision === "REJECT") { reason = window.prompt(`Optional rejection reason for ${user.name}:`, "") ?? ""; }
    setBusy(true); setError(""); setNotice("");
    try { const result = await request(`/broker/verification/requests/${user.id}`, { method: "PATCH", body: JSON.stringify({ decision, reason }) }); setNotice(result.message); await refresh(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function viewDocument(user, kind) {
    try {
      const response = await fetch(`${API_URL}/broker/verification/documents/${user.id}/${kind}`, { headers: { Authorization: `Bearer ${localStorage.getItem("loadsetu-token") || ""}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Unable to open document."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) { const link = document.createElement("a"); link.href = url; link.download = `${user.name}-${kind}`; link.click(); }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e.message); }
  }
  return <section className="bd-card verification-panel"><div className="bd-section-title"><div><h2><ShieldCheck size={20}/> Verification requests</h2><p>Review factory GSTIN and transporter documents. Only brokers can access submitted documents.</p></div><button className="bd-refresh" disabled={busy} onClick={refresh}><RefreshCw size={15}/> Refresh</button></div>
    {error && <div className="bd-alert bd-alert-error">{error}</div>}{notice && <div className="bd-alert bd-alert-success">{notice}</div>}
    {requests.map(user => <article className="verification-request" key={user.id}><div className="verification-request-main"><div><strong>{user.name}</strong><small>{user.email} · {user.phone || "No phone provided"}</small><small>Role: {user.role === "transporter" ? "Transporter" : "Factory owner"} · Submitted: {user.verificationSubmittedAt ? new Date(user.verificationSubmittedAt).toLocaleDateString("en-IN") : "—"}</small>{user.gstin && <small>GSTIN: <strong>{user.gstin}</strong></small>}<span className={`bd-status ${String(user.verificationStatus).toLowerCase().replaceAll("_","-")}`}>{user.verificationStatus}</span>{user.verificationRejectionReason && <small>Previous rejection: {user.verificationRejectionReason}</small>}</div>
      {user.role === "transporter" && <div className="verification-documents"><button className="bd-small-button" onClick={() => viewDocument(user,"aadhaar")}><FileText size={14}/> Aadhaar</button><button className="bd-small-button" onClick={() => viewDocument(user,"driving-license")}><FileText size={14}/> Driving License</button></div>}</div>
      <div className="verification-actions"><button className="bd-primary-button" disabled={busy} onClick={() => decide(user,"VERIFY")}><BadgeCheck size={15}/> Verify</button><button className="bd-danger-button" disabled={busy} onClick={() => decide(user,"REJECT")}><XCircle size={15}/> Reject</button></div></article>)}
    {!requests.length && !busy && <p className="bd-empty">No pending verification requests.</p>}
  </section>;
}
