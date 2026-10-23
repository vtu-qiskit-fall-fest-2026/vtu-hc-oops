export const SHIPMENT_PRICING = Object.freeze({
  depositRupeesPerKm: 5,
  brokerCommissionRupeesPerKm: 3,
  otherChargesRupees: 0,
  termsVersion: "LOADSETU-SHIPMENT-TERMS-1.0",
  confirmationTokenTtlHours: 72,
});

export function roundRupees(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
export function toPaise(rupees) { return Math.round(roundRupees(rupees) * 100); }
export function haversineKm(a, b) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 100) / 100;
}

/**
 * Who pays what for one shipment. Distance-based deposit and broker commission plus the
 * trip's running costs. The factory pays all of it; the transporter's payable excludes the
 * broker commission and other platform charges, which stay with the broker.
 */
export function calculateCostSummary({
  distanceKm = 0,
  depositRatePerKm = SHIPMENT_PRICING.depositRupeesPerKm,
  brokerCommissionRatePerKm = SHIPMENT_PRICING.brokerCommissionRupeesPerKm,
  otherChargesRupees = SHIPMENT_PRICING.otherChargesRupees,
  fuelCostRupees = 0,
  tollCostRupees = 0,
  loadingCostRupees = 0,
  unloadingCostRupees = 0,
  waitingCostRupees = 0,
} = {}) {
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  const depositRupees = roundRupees(n(distanceKm) * n(depositRatePerKm));
  const brokerCommissionRupees = roundRupees(n(distanceKm) * n(brokerCommissionRatePerKm));
  const tripCostsRupees = roundRupees(n(fuelCostRupees) + n(tollCostRupees) + n(loadingCostRupees) + n(unloadingCostRupees) + n(waitingCostRupees));
  return {
    distanceKm: n(distanceKm),
    depositRupees,
    brokerCommissionRupees,
    otherChargesRupees: roundRupees(n(otherChargesRupees)),
    tripCostsRupees,
    totalFactoryPayableRupees: roundRupees(depositRupees + brokerCommissionRupees + n(otherChargesRupees) + tripCostsRupees),
    totalTransporterPayableRupees: roundRupees(depositRupees + tripCostsRupees),
  };
}
