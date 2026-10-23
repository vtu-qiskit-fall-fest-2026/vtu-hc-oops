// Road distance, drive time and the route line between two places, for the map and the
// cost/CO2 estimates.
//
// Provider order:
//   1. OpenRouteService (ORS_API_KEY set): free key, truck ("driving-hgv") routing, geocoding.
//   2. OSRM public demo + OpenStreetMap Nominatim: no key, car routing, fair-use limits.
//   3. Built-in city coordinates + straight-line distance x 1.3: works offline; labelled.
// Results are cached in memory so a page of loads costs one lookup per city pair.

const ORS = "https://api.openrouteservice.org";
const OSRM = "https://router.project-osrm.org";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "LoadSetu/1.0 (VTU-QFF hackathon demo; routing for freight estimates)";
// The OSRM demo server answers in 1-4 s and sometimes much slower; 8 s dropped real routes.
const TIMEOUT_MS = 15000;

// Truck figures for the estimates. Medium/heavy diesel trucks in India run ~3.5-5 km/l;
// burning a litre of diesel emits ~2.68 kg CO2. Override with env vars if you have better data.
export const ESTIMATE_ASSUMPTIONS = Object.freeze({
  truckKmPerLitre: Number(process.env.TRUCK_KM_PER_LITRE) || 4,
  dieselRupeesPerLitre: Number(process.env.DIESEL_RUPEES_PER_LITRE) || 90,
  co2KgPerLitreDiesel: 2.68,
  roadFactorForStraightLine: 1.3,
});

// Offline fallback for common freight cities (lat, lng). Keeps demos working without network.
const CITY_COORDS = {
  pune: [18.5204, 73.8567], mumbai: [19.076, 72.8777], nashik: [19.9975, 73.7898], nagpur: [21.1458, 79.0882],
  aurangabad: [19.8762, 75.3433], "chhatrapati sambhajinagar": [19.8762, 75.3433], kolhapur: [16.705, 74.2433],
  solapur: [17.6599, 75.9064], satara: [17.6805, 73.9997], sangli: [16.8524, 74.5815], thane: [19.2183, 72.9781],
  "navi mumbai": [19.033, 73.0297], bhiwandi: [19.2967, 73.0631], ahmednagar: [19.0952, 74.7496], jalgaon: [21.0077, 75.5626],
  latur: [18.4088, 76.5604], nanded: [19.1383, 77.321], amravati: [20.9374, 77.7796], akola: [20.7002, 77.0082],
  bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946], hyderabad: [17.385, 78.4867], chennai: [13.0827, 80.2707],
  delhi: [28.6139, 77.209], "new delhi": [28.6139, 77.209], ahmedabad: [23.0225, 72.5714], surat: [21.1702, 72.8311],
  vadodara: [22.3072, 73.1812], indore: [22.7196, 75.8577], bhopal: [23.2599, 77.4126], goa: [15.2993, 74.124],
  belagavi: [15.8497, 74.4977], belgaum: [15.8497, 74.4977], hubli: [15.3647, 75.124], mysuru: [12.2958, 76.6394],
  kolkata: [22.5726, 88.3639], jaipur: [26.9124, 75.7873], lucknow: [26.8467, 80.9462], raipur: [21.2514, 81.6296],
  chakan: [18.7606, 73.8636], ranjangaon: [18.7558, 74.2475], talegaon: [18.7353, 73.6755], hinjewadi: [18.5913, 73.7389],
};

const geocodeCache = new Map();
const routeCache = new Map();

// Nominatim and the OSRM demo server allow about one request per second per client;
// parallel lookups got throttled and fell back to estimates. Space calls out per host.
const nextSlot = new Map();
async function politely(url) {
  const host = new URL(url).host;
  if (host.includes("openrouteservice")) return; // ORS has its own per-key quota
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) || 0);
  nextSlot.set(host, at + 1100);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

async function fetchJson(url, { fetchImpl = fetch, headers = {}, body } = {}) {
  if (fetchImpl === fetch) await politely(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: body ? "POST" : "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function key(place) {
  return String(place || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function builtIn(place) {
  const k = key(place);
  if (CITY_COORDS[k]) return CITY_COORDS[k];
  // "Pune, Maharashtra" / "MIDC Chakan, Pune" → try each comma part.
  for (const part of k.split(",").map((s) => s.trim())) if (CITY_COORDS[part]) return CITY_COORDS[part];
  return null;
}

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Place name → { label, lat, lng, source }, or null if nothing found. */
export async function geocode(place, { fetchImpl } = {}) {
  const k = key(place);
  if (!k) return null;
  if (geocodeCache.has(k)) return geocodeCache.get(k);
  let hit = null;
  if (CITY_COORDS[k]) {
    hit = { label: place, lat: CITY_COORDS[k][0], lng: CITY_COORDS[k][1], source: "built-in" };
    geocodeCache.set(k, hit);
    return hit;
  }
  try {
    if (process.env.ORS_API_KEY) {
      const q = new URLSearchParams({ api_key: process.env.ORS_API_KEY, text: place, "boundary.country": "IN", size: "1" });
      const data = await fetchJson(`${ORS}/geocode/search?${q}`, { fetchImpl });
      const f = data?.features?.[0];
      if (f) hit = { label: f.properties?.label || place, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], source: "openrouteservice" };
    } else {
      const q = new URLSearchParams({ q: place, format: "json", limit: "1", countrycodes: "in" });
      const data = await fetchJson(`${NOMINATIM}/search?${q}`, { fetchImpl });
      if (data?.[0]) hit = { label: data[0].display_name, lat: Number(data[0].lat), lng: Number(data[0].lon), source: "nominatim" };
    }
  } catch {
    // Network or quota problem: fall through to the built-in table.
  }
  if (!hit) {
    const c = builtIn(place);
    if (c) hit = { label: place, lat: c[0], lng: c[1], source: "built-in" };
  }
  if (hit) geocodeCache.set(k, hit);
  return hit;
}

function estimates(distanceKm) {
  const a = ESTIMATE_ASSUMPTIONS;
  const litres = distanceKm / a.truckKmPerLitre;
  return {
    dieselLitres: Math.round(litres * 10) / 10,
    fuelCostRupees: Math.round(litres * a.dieselRupeesPerLitre),
    co2Kg: Math.round(litres * a.co2KgPerLitreDiesel),
    assumptions: a,
  };
}

// A page asks for the same pair from several components at once; share one lookup.
const inFlight = new Map();

/** Road route between two place names (or {lat,lng} objects). */
export function getRoute(from, to, options = {}) {
  const k = `${typeof from === "object" ? JSON.stringify(from) : key(from)}|${typeof to === "object" ? JSON.stringify(to) : key(to)}`;
  if (!inFlight.has(k)) inFlight.set(k, lookupRoute(from, to, options).finally(() => inFlight.delete(k)));
  return inFlight.get(k);
}

async function lookupRoute(from, to, { fetchImpl } = {}) {
  const [a, b] = await Promise.all([
    typeof from === "object" && from ? { label: from.label || "", lat: from.lat, lng: from.lng, source: "given" } : geocode(from, { fetchImpl }),
    typeof to === "object" && to ? { label: to.label || "", lat: to.lat, lng: to.lng, source: "given" } : geocode(to, { fetchImpl }),
  ]);
  if (!a || !b) {
    const missing = !a ? from : to;
    const err = new Error(`Could not find "${missing}" on the map. Try adding the city or state.`);
    err.status = 404;
    throw err;
  }
  const cacheKey = `${a.lat},${a.lng}|${b.lat},${b.lng}`;
  if (routeCache.has(cacheKey)) return routeCache.get(cacheKey);

  let route = null;
  try {
    if (process.env.ORS_API_KEY) {
      const data = await fetchJson(`${ORS}/v2/directions/driving-hgv/geojson`, {
        fetchImpl,
        headers: { Authorization: process.env.ORS_API_KEY },
        body: { coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      });
      const f = data?.features?.[0];
      if (f) route = {
        distanceKm: f.properties.summary.distance / 1000,
        durationMin: f.properties.summary.duration / 60,
        geometry: f.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        provider: "openrouteservice (heavy goods vehicle profile)",
      };
    } else {
      const data = await fetchJson(`${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { fetchImpl });
      const r = data?.routes?.[0];
      if (r) route = {
        distanceKm: r.distance / 1000,
        durationMin: r.duration / 60,
        geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        provider: "OSRM public server (car profile; trucks are slower)",
      };
    }
  } catch {
    route = null;
  }
  if (!route) {
    const km = haversineKm([a.lat, a.lng], [b.lat, b.lng]) * ESTIMATE_ASSUMPTIONS.roadFactorForStraightLine;
    route = {
      distanceKm: km,
      durationMin: (km / 45) * 60, // ~45 km/h average truck speed
      geometry: [[a.lat, a.lng], [b.lat, b.lng]],
      provider: "estimate (straight line x 1.3; routing service unreachable)",
    };
  }
  const result = {
    from: a,
    to: b,
    distanceKm: Math.round(route.distanceKm * 10) / 10,
    durationMin: Math.round(route.durationMin),
    geometry: route.geometry,
    provider: route.provider,
    estimates: estimates(route.distanceKm),
  };
  if (!route.provider.startsWith("estimate")) routeCache.set(cacheKey, result);
  return result;
}
