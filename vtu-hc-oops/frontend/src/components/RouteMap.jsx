import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { Clock, Fuel, Leaf, Navigation, IndianRupee } from "lucide-react";
import { getRoute } from "../services/routesApi.js";
import "./RouteMap.css";

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28] });
  }, [map, points]);
  return null;
}

const hours = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min` : `${Math.round(min)} min`);
const rupees = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

/**
 * Road route between two place names, with distance, drive time and diesel/CO2 estimates.
 * Waits until both places are typed (debounced) so the free routing services aren't spammed.
 */
export default function RouteMap({ from, to, height = 260, compact = false, onRoute }) {
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const a = String(from || "").trim();
    const b = String(to || "").trim();
    setError("");
    if (a.length < 3 || b.length < 3 || a.toLowerCase() === b.toLowerCase()) {
      setRoute(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await getRoute(a, b, { signal: controller.signal });
        setRoute(r);
        onRoute?.(r);
      } catch (e) {
        if (e.name !== "AbortError") { setRoute(null); setError(e.message); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!route) {
    return (
      <div className="ls-routemap ls-routemap-empty" style={{ minHeight: compact ? 0 : 90 }}>
        {loading ? "Finding the road route…" : error || "Enter a pickup and a destination to see the route, distance and fuel estimate."}
      </div>
    );
  }

  const start = [route.from.lat, route.from.lng];
  const end = [route.to.lat, route.to.lng];
  const e = route.estimates;
  return (
    <div className="ls-routemap">
      <div className="ls-routemap-canvas" style={{ height }}>
        <MapContainer center={start} zoom={7} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={route.geometry} pathOptions={{ color: "#e4a444", weight: 5, opacity: 0.9 }} />
          <CircleMarker center={start} radius={8} pathOptions={{ color: "#fff", weight: 2, fillColor: "#2f9e77", fillOpacity: 1 }}>
            <Tooltip direction="top">Pickup: {from}</Tooltip>
          </CircleMarker>
          <CircleMarker center={end} radius={8} pathOptions={{ color: "#fff", weight: 2, fillColor: "#d9534f", fillOpacity: 1 }}>
            <Tooltip direction="top">Destination: {to}</Tooltip>
          </CircleMarker>
          <FitBounds points={[start, end, ...route.geometry.filter((_, i) => i % 25 === 0)]} />
        </MapContainer>
        {loading && <span className="ls-routemap-updating">Updating…</span>}
      </div>
      <dl className="ls-routemap-stats">
        <div><dt><Navigation size={14} /> Road distance</dt><dd>{route.distanceKm.toLocaleString("en-IN")} km</dd></div>
        <div><dt><Clock size={14} /> Drive time</dt><dd>{hours(route.durationMin)}</dd></div>
        <div><dt><Fuel size={14} /> Diesel (est.)</dt><dd>{e.dieselLitres} L</dd></div>
        <div><dt><IndianRupee size={14} /> Fuel cost (est.)</dt><dd>{rupees(e.fuelCostRupees)}</dd></div>
        <div><dt><Leaf size={14} /> CO₂ (est.)</dt><dd>{e.co2Kg} kg</dd></div>
      </dl>
      {!compact && (
        <p className="ls-routemap-note">
          Route: {route.provider}. Estimates assume {e.assumptions.truckKmPerLitre} km/L,
          ₹{e.assumptions.dieselRupeesPerLitre}/L diesel and {e.assumptions.co2KgPerLitreDiesel} kg CO₂ per litre.
        </p>
      )}
    </div>
  );
}
