import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Atom, Cpu, Leaf, Navigation, Play, RefreshCw, Sun, Moon, Truck, IndianRupee, Info } from "lucide-react";
import { getAssignmentOptimization, getQuantumComparison } from "../services/insightsApi.js";
import { getLoadsetuTheme, setLoadsetuTheme } from "../theme.js";
import RouteMap from "./RouteMap.jsx";
import { getRoute } from "../services/routesApi.js";
import "./FleetOptimizer.css";

const rupees = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v) || 0);
const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

const MODES = [
  { id: "ideal", label: "Noiseless simulator", hint: "Qiskit Aer, perfect qubits" },
  { id: "noisy", label: "IBM Brisbane noise", hint: "Aer with a real device's noise model" },
];

function Stat({ icon, label, value, note }) {
  return (
    <div className="fo-stat">
      <span className="fo-stat-icon">{icon}</span>
      <div><small>{label}</small><strong>{value}</strong>{note && <em>{note}</em>}</div>
    </div>
  );
}

/** Top measured bitstrings, decoded back into load → truck pairs. */
function Histogram({ counts, variables, names, optimalBits, shots }) {
  const rows = Object.entries(counts || {}).slice(0, 10);
  const max = Math.max(1, ...rows.map(([, c]) => c));
  const decode = (bits) => {
    const n = variables.length;
    const picked = variables.filter((v) => bits[n - 1 - v.qubit] === "1");
    return picked.length ? picked.map((v) => `${names.load(v.loadId)} → ${names.truck(v.truckId)}`).join(" · ") : "no assignment";
  };
  return (
    <div className="fo-hist">
      {rows.map(([bits, c]) => (
        <div key={bits} className={`fo-hist-row ${bits === optimalBits ? "is-optimal" : ""}`} title={decode(bits)}>
          <code>{bits}</code>
          <div className="fo-hist-bar"><span style={{ width: `${(c / max) * 100}%` }} /></div>
          <b>{((c / shots) * 100).toFixed(1)}%</b>
          <small>{decode(bits)}</small>
        </div>
      ))}
    </div>
  );
}

export default function FleetOptimizer() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getLoadsetuTheme());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [routes, setRoutes] = useState({});
  const [mode, setMode] = useState("ideal");
  const [quantum, setQuantum] = useState(null);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try { setData(await getAssignmentOptimization()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Every assignment's road route, for the distance/fuel/CO2 totals; the map draws only the selected one.
  useEffect(() => {
    if (!data?.assignments?.length) return undefined;
    let cancelled = false;
    setRoutes({});
    data.assignments.forEach((a) => {
      getRoute(a.load.pickup, a.load.destination)
        .then((r) => { if (!cancelled) setRoutes((s) => ({ ...s, [a.loadId]: r })); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [data]);

  async function runQuantum() {
    setRunning(true); setQuantum(null);
    try { setQuantum(await getQuantumComparison(mode)); }
    catch (e) { setQuantum({ quantum: { status: "error", reason: e.message } }); }
    finally { setRunning(false); }
  }

  const assignments = data?.assignments || [];
  const current = assignments[selected];
  const totals = useMemo(() => Object.values(routes).reduce((t, r) => ({
    km: t.km + r.distanceKm, co2: t.co2 + r.estimates.co2Kg, fuel: t.fuel + r.estimates.fuelCostRupees,
  }), { km: 0, co2: 0, fuel: 0 }), [routes]);
  const routesComplete = assignments.length > 0 && assignments.every((a) => routes[a.loadId]);

  const names = useMemo(() => {
    const loads = new Map(), trucks = new Map();
    for (const c of data?.candidates || []) { loads.set(c.loadId, c.loadTitle); trucks.set(c.truckId, c.truckRegistration); }
    return { load: (id) => loads.get(id) || id.slice(-6), truck: (id) => trucks.get(id) || id.slice(-6) };
  }, [data]);

  // An older quantum service build sent no qubit mapping; treat that as an error, not a blank page.
  const q = quantum?.quantum?.status === "ok" && !quantum.quantum.variables
    ? { status: "error", reason: "The quantum service is out of date. Restart it from quantum/." }
    : quantum?.quantum;
  const optimalBits = q?.status === "ok"
    ? q.variables.map((v) => (q.exactQubo.assignments.some((a) => a.loadId === v.loadId && a.truckId === v.truckId) ? "1" : "0")).reverse().join("")
    : null;

  return (
    <main className={`fleet-opt ${theme === "light" ? "fo-light" : ""}`}>
      <header className="fo-top">
        <button className="fo-btn" onClick={() => navigate("/factory/dashboard")}><ArrowLeft size={16} /> Dashboard</button>
        <div className="fo-brand">LOADSETU <small>FACTORY CONTROL PANEL</small></div>
        <div className="fo-top-actions">
          <button className="fo-btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          <button className={`fo-icon ${theme === "light" ? "on" : ""}`} aria-label="Light theme" onClick={() => { setLoadsetuTheme("light"); setTheme("light"); }}><Sun size={15} /></button>
          <button className={`fo-icon ${theme === "dark" ? "on" : ""}`} aria-label="Dark theme" onClick={() => { setLoadsetuTheme("dark"); setTheme("dark"); }}><Moon size={15} /></button>
        </div>
      </header>

      <section className="fo-heading">
        <span className="fo-eyebrow">QUANTUM FLEET OPTIMIZER</span>
        <h1>Which truck should carry each load?</h1>
        <p>An exact classical solver picks the cheapest way to cover all your open loads. Then run the same problem as QAOA, a quantum algorithm, on Qiskit and compare.</p>
      </section>

      {loading && <div className="fo-panel fo-muted">Optimising your open loads…</div>}
      {error && <div className="fo-panel fo-error">{error}</div>}

      {data && !loading && (
        <>
          <section className="fo-stats">
            <Stat icon={<Truck size={18} />} label="Loads assigned" value={`${data.assignmentCount} of ${data.requestedLoadCount}`} note={data.optimal ? "Proven optimal" : "Best found before timeout"} />
            <Stat icon={<IndianRupee size={18} />} label="Total freight cost" value={rupees(data.objective.value)} note={`Solved in ${data.runtimeMs} ms`} />
            <Stat icon={<Navigation size={18} />} label="Total road distance" value={routesComplete ? `${Math.round(totals.km).toLocaleString("en-IN")} km` : "…"} note={routesComplete ? `Fuel ≈ ${rupees(totals.fuel)}` : "Fetching routes"} />
            <Stat icon={<Leaf size={18} />} label="CO₂ for these trips" value={routesComplete ? `${Math.round(totals.co2).toLocaleString("en-IN")} kg` : "…"} note="Estimate, diesel trucks" />
          </section>

          {assignments.length === 0 ? (
            <div className="fo-panel fo-muted">No load could be matched to an available truck yet. Reasons are listed below.</div>
          ) : (
            <section className="fo-grid">
              <div className="fo-panel">
                <h2>Classical assignment</h2>
                <ul className="fo-assign">
                  {assignments.map((a, i) => (
                    <li key={a.loadId}>
                      <button className={i === selected ? "on" : ""} onClick={() => setSelected(i)}>
                        <span><b>{a.load.title}</b><small>{a.load.pickup} → {a.load.destination} · {a.load.weightTonnes} t</small></span>
                        <span className="fo-assign-right"><b>{rupees(a.cost)}</b><small>{a.truck.registrationNumber} · {a.truck.truckType}</small>
                          {routes[a.loadId] && <small>{routes[a.loadId].distanceKm} km</small>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="fo-panel">
                <h2>Route: {current?.load.pickup} → {current?.load.destination}</h2>
                {current && <RouteMap from={current.load.pickup} to={current.load.destination} height={300} />}
              </div>
            </section>
          )}

          {data.unassignedLoads?.length > 0 && (
            <section className="fo-panel">
              <h2>Not assigned</h2>
              <ul className="fo-unassigned">{data.unassignedLoads.map((u) => <li key={u.loadId}><b>{names.load(u.loadId)}</b> — {u.reason}</li>)}</ul>
            </section>
          )}

          <section className="fo-panel fo-quantum">
            <div className="fo-quantum-head">
              <div>
                <span className="fo-eyebrow"><Atom size={13} /> QISKIT · QAOA</span>
                <h2>Solve the same problem on a quantum computer</h2>
                <p>Each eligible load–truck pair becomes one qubit ({data.candidates?.length || 0} here). Clashes are penalty terms; QAOA searches for the lowest-energy assignment.</p>
              </div>
              <div className="fo-modes">
                {MODES.map((m) => (
                  <button key={m.id} className={mode === m.id ? "on" : ""} onClick={() => setMode(m.id)} title={m.hint}>{m.label}</button>
                ))}
                <button className="fo-run" onClick={runQuantum} disabled={running || !data.candidates?.length}>
                  <Play size={15} /> {running ? "Running QAOA…" : "Run QAOA"}
                </button>
              </div>
            </div>

            {running && <p className="fo-muted">Training the circuit and sampling 2,048 shots. This takes about 5–15 seconds.</p>}

            {q && q.status !== "ok" && <div className="fo-error">{q.reason || "The quantum comparison failed."}</div>}

            {q?.status === "ok" && (
              <>
                <div className="fo-compare">
                  <div className="fo-card">
                    <small><Cpu size={14} /> Classical (exact branch-and-bound)</small>
                    <strong>{rupees(quantum.classical.totalCost)}</strong>
                    <span>{quantum.classical.assignedCount} loads · {quantum.classical.runtimeMs} ms</span>
                  </div>
                  <div className={`fo-card ${q.metrics.matchesOptimum ? "good" : "warn"}`}>
                    <small><Atom size={14} /> QAOA · {q.solver.backend}</small>
                    <strong>{q.quantum.foundFeasible ? rupees(q.quantum.totalCost) : "no valid sample"}</strong>
                    <span>{q.quantum.assignedCount} loads · {(q.runtimeMs / 1000).toFixed(1)} s</span>
                  </div>
                  <div className="fo-card">
                    <small>Verdict</small>
                    <strong>{q.metrics.matchesOptimum ? "Same optimum" : "Sub-optimal"}</strong>
                    <span>{quantum.agreement ? (quantum.agreement.sameTotalCost ? "QAOA matches the classical answer" : "QAOA differs from the classical answer") : "Compared on a reduced problem"}</span>
                  </div>
                </div>

                <dl className="fo-metrics">
                  <div><dt>Qubits</dt><dd>{q.circuit.qubits}</dd></div>
                  <div><dt>Circuit depth</dt><dd>{q.circuit.logicalDepth} → {q.circuit.transpiledDepth}</dd></div>
                  <div><dt>Two-qubit gates</dt><dd>{q.circuit.twoQubitGates}</dd></div>
                  <div><dt>Approximation ratio</dt><dd>{q.metrics.approximationRatio ?? "—"}</dd></div>
                  <div><dt>P(optimal answer)</dt><dd>{pct(q.metrics.probabilityOfOptimal)}</dd></div>
                  <div><dt>Valid samples</dt><dd>{pct(q.metrics.feasibleShotFraction)}</dd></div>
                  <div><dt>Layers (p)</dt><dd>{q.solver.reps}</dd></div>
                  <div><dt>Optimizer steps</dt><dd>{q.solver.iterations}</dd></div>
                </dl>

                <h3>Most frequent measurements</h3>
                <Histogram counts={q.counts} variables={q.variables} names={names} optimalBits={optimalBits} shots={q.solver.shots} />

                <p className="fo-honest"><Info size={14} />
                  {q.problem.reduced && `The full problem had ${q.problem.candidateOptions} pairs; QAOA ran on the ${q.problem.variables} cheapest to fit the simulator. `}
                  At this size the classical solver is faster and exact. The point is a working quantum formulation of real
                  freight data, and how noise affects it: compare circuit depth and valid samples between the two modes.
                </p>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
