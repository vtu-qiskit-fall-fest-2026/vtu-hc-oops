const REQUEST_SCHEMA = "loadsetu.delay-prediction.request.v1";
const RESPONSE_SCHEMA = "loadsetu.delay-prediction.response.v1";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000;

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toFeatureRequest(load) {
  const material = String(load.material || load.title || "").trim();
  const pickup = String(load.pickup || "").trim();
  const destination = String(load.destination || "").trim();
  const weightTonnes = Number(load.weightTonnes);
  const pickupAt = validDate(load.pickupDate);
  const loadId = String(load._id || load.id || "");
  if (!loadId || !material || !pickup || !destination || !Number.isFinite(weightTonnes) || weightTonnes <= 0 || !pickupAt) {
    return null;
  }
  return {
    loadId,
    features: { material, pickup, destination, weightTonnes, pickupAt: pickupAt.toISOString() },
  };
}

function unavailable(state, message, extras = {}) {
  return { available: false, state, message, predictions: [], ...extras };
}

export async function requestDelayPredictions(loads, {
  endpoint = process.env.LOADSETU_DELAY_MODEL_URL,
  apiKey = process.env.LOADSETU_DELAY_MODEL_API_KEY,
  timeoutMs = Number(process.env.LOADSETU_DELAY_MODEL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  maxAgeMs = Number(process.env.LOADSETU_DELAY_MODEL_MAX_AGE_MS) || DEFAULT_MAX_AGE_MS,
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  if (!Array.isArray(loads)) throw new TypeError("Loads must be provided as an array.");
  if (!endpoint) return unavailable("not_configured", "No trained delay-prediction service is configured.");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    return unavailable("invalid_configuration", "The delay-prediction timeout and freshness limits must be positive numbers.");
  }

  const requests = loads.map(toFeatureRequest);
  const supported = requests.filter(Boolean);
  const unsupportedLoadCount = requests.length - supported.length;
  if (supported.length === 0) {
    return unavailable("missing_features", "No loads contain the required model input fields.", { unsupportedLoadCount });
  }
  if (typeof fetchImpl !== "function") {
    return unavailable("service_error", "The delay-prediction service could not be reached.", { unsupportedLoadCount });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ schemaVersion: REQUEST_SCHEMA, requests: supported }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    return unavailable(
      error?.name === "AbortError" ? "timeout" : "service_error",
      error?.name === "AbortError" ? "The delay-prediction service timed out." : "The delay-prediction service could not be reached.",
      { unsupportedLoadCount },
    );
  }

  if (!response.ok) {
    clearTimeout(timeout);
    return unavailable("service_error", `The delay-prediction service returned HTTP ${response.status}.`, { unsupportedLoadCount });
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      return unavailable("timeout", "The delay-prediction service timed out.", { unsupportedLoadCount });
    }
    return unavailable("invalid_response", "The delay-prediction service returned invalid JSON.", { unsupportedLoadCount });
  }
  clearTimeout(timeout);

  const generatedAt = validDate(payload?.generatedAt);
  if (payload?.schemaVersion !== RESPONSE_SCHEMA
    || !String(payload?.model?.name || "").trim()
    || !String(payload?.model?.version || "").trim()
    || !generatedAt
    || !Array.isArray(payload?.predictions)
  ) {
    return unavailable("invalid_response", "The delay-prediction response did not match the documented schema.", { unsupportedLoadCount });
  }
  const age = now.getTime() - generatedAt.getTime();
  if (age < -60_000 || age > maxAgeMs) {
    return unavailable("stale", "The delay-prediction response is stale or has an invalid timestamp.", { unsupportedLoadCount });
  }

  const requestedIds = new Set(supported.map((request) => request.loadId));
  const seenIds = new Set();
  const predictions = [];
  for (const prediction of payload.predictions) {
    const loadId = String(prediction?.loadId || "");
    const eta = prediction?.eta == null ? null : validDate(prediction.eta);
    const risk = prediction?.delayRiskProbability;
    const hasEta = prediction?.eta == null || eta !== null;
    const hasRisk = risk == null || (Number.isFinite(risk) && risk >= 0 && risk <= 1);
    if (!requestedIds.has(loadId) || seenIds.has(loadId) || !hasEta || (eta && eta < generatedAt) || !hasRisk || (eta === null && risk == null)) {
      return unavailable("invalid_response", "The delay-prediction service returned an unsupported or malformed prediction.", { unsupportedLoadCount });
    }
    seenIds.add(loadId);
    predictions.push({
      loadId,
      ...(eta ? { predictedEta: eta.toISOString() } : {}),
      ...(risk != null ? { delayRiskProbability: risk } : {}),
    });
  }
  if (seenIds.size !== requestedIds.size) {
    return unavailable("incomplete_response", "The delay-prediction service did not return a prediction for every supported load.", { unsupportedLoadCount });
  }

  return {
    available: true,
    state: "live",
    source: "configured-model-service",
    generatedAt: generatedAt.toISOString(),
    model: { name: String(payload.model.name), version: String(payload.model.version) },
    predictions,
    unsupportedLoadCount,
  };
}
