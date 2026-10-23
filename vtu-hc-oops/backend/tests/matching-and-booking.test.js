import test from 'node:test';
import assert from 'node:assert/strict';

import { matchTrucksToLoad, scoreTruckForLoad, evaluateTruckAgainstLoad } from '../src/services/matchingEngine.js';
import { validateBookingCandidate, isBookingExpired, isValidStatusTransition, createBooking } from '../src/controllers/bookingController.js';
import { calculateCostSummary } from '../src/config/shipmentPricing.js';

const validLoad = {
  pickup: 'Pune',
  destination: 'Nashik',
  weightTonnes: 10,
  truckType: 'Open truck',
  offeredPrice: 140000,
  pickupDate: '2026-10-15T00:00:00.000Z',
  deliveryDate: '2026-10-18T00:00:00.000Z',
  requiredEquipment: ['tail-lift'],
};

const validTruck = {
  _id: '664cfe9d0f9266a940b36101',
  truckType: 'Open truck',
  capacityTonnes: 18,
  isAvailable: true,
  currentLocation: 'Pune',
  serviceAreas: ['Pune', 'Nashik'],
  quotedPrice: 130000,
  equipment: ['tail-lift'],
  routeLegs: [{ status: 'Available', origin: 'Pune', destination: 'Nashik', availableFrom: '2026-10-15T00:00:00.000Z' }],
};

test('valid loads match eligible real fleet trucks and invalid loads are rejected', () => {
  const accepted = scoreTruckForLoad(validLoad, validTruck);
  assert.equal(accepted.isEligible, true);
  assert.ok(accepted.matchScore >= 50);

  const invalidWeight = scoreTruckForLoad({ ...validLoad, weightTonnes: 25 }, validTruck);
  assert.equal(invalidWeight.isEligible, false);
  assert.match(invalidWeight.rejectionReasons.join(' '), /capacity/i);

  const invalidType = scoreTruckForLoad({ ...validLoad, truckType: 'Container' }, validTruck);
  assert.equal(invalidType.isEligible, false);
  assert.match(invalidType.rejectionReasons.join(' '), /type/i);

  const routeMissing = evaluateTruckAgainstLoad(validLoad, { ...validTruck, isAvailable: true, currentLocation: '', serviceAreas: [], routeLegs: [] });
  assert.equal(routeMissing.eligible, false);
  assert.match(routeMissing.rejectionReasons.join(' '), /route|service-area/i);
});

test('overweight and oversized loads are rejected before scoring', () => {
  const overweight = scoreTruckForLoad({ ...validLoad, weightTonnes: 20 }, { ...validTruck, capacityTonnes: 18, isAvailable: true });
  assert.equal(overweight.isEligible, false);
  assert.match(overweight.rejectionReasons.join(' '), /capacity/i);

  const oversized = scoreTruckForLoad({ ...validLoad, dimensions: { length: 12, width: 2.5, height: 2.6 } }, { ...validTruck, dimensions: { length: 10, width: 2.1, height: 2.1 }, isAvailable: true });
  assert.equal(oversized.isEligible, false);
  assert.match(oversized.rejectionReasons.join(' '), /length|width|height/i);
});

test('deadline infeasibility and unavailable trucks are rejected', () => {
  const latePickup = scoreTruckForLoad({ ...validLoad, pickupDate: '2026-10-15T00:00:00.000Z', deliveryDate: '2026-10-15T06:00:00.000Z', pickup: 'Pune', destination: 'Nashik' }, { ...validTruck, routeLegs: [{ status: 'Available', origin: 'Pune', destination: 'Nashik', availableFrom: '2026-10-16T00:00:00.000Z' }] });
  assert.equal(latePickup.isEligible, false);
  assert.match(latePickup.rejectionReasons.join(' '), /availability/i);

  const unavailable = scoreTruckForLoad(validLoad, { ...validTruck, isAvailable: false });
  assert.equal(unavailable.isEligible, false);
  assert.match(unavailable.rejectionReasons.join(' '), /unavailable/i);
});

test('matching against actual fleet records filters down to eligible trucks', () => {
  const fleet = [
    { ...validTruck, _id: '1', equipment: ['tail-lift'], isAvailable: true },
    { ...validTruck, _id: '2', truckType: 'Container', capacityTonnes: 30, isAvailable: true },
    { ...validTruck, _id: '3', isAvailable: false },
    { ...validTruck, _id: '4', currentLocation: 'Mumbai', serviceAreas: ['Mumbai'], routeLegs: [], isAvailable: true },
  ];

  const matches = matchTrucksToLoad(validLoad, fleet);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]._id, '1');
});

test('empty result is returned when no eligible truck matches', () => {
  const matches = matchTrucksToLoad(validLoad, [{ ...validTruck, isAvailable: false }, { ...validTruck, capacityTonnes: 4, truckType: 'Mini truck', isAvailable: true }]);
  assert.deepEqual(matches, []);
});

test('duplicate assignment and overlapping bookings are rejected by validation helpers', () => {
  const load = { _id: 'load-1', status: 'Open', pickup: 'Pune', destination: 'Nashik', weightTonnes: 10, truckType: 'Open truck' };
  const truck = { _id: 'truck-1', truckType: 'Open truck', capacityTonnes: 18, isAvailable: true, routeLegs: [{ status: 'Available', origin: 'Pune', destination: 'Nashik', _id: 'leg-1' }] };
  const ok = validateBookingCandidate(load, truck, { routeLegId: 'leg-1', routeLegs: truck.routeLegs });
  assert.equal(ok.valid, true);

  const duplicateLoad = { ...load, status: 'Booked' };
  const duplicate = validateBookingCandidate(duplicateLoad, truck, { routeLegId: 'leg-1', routeLegs: truck.routeLegs });
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.status, 409);
});

test('booking expiry and cancellation transitions are validated', () => {
  assert.equal(isValidStatusTransition('Booked', 'Cancelled'), true);
  assert.equal(isValidStatusTransition('Booked', 'Delivered'), false);
  assert.equal(isValidStatusTransition('In Transit', 'Delivered'), true);
  assert.equal(isBookingExpired({ expiresAt: '2024-01-01T00:00:00.000Z' }, new Date('2025-01-01T00:00:00.000Z')), true);
  assert.equal(isBookingExpired({ expiresAt: '2025-02-01T00:00:00.000Z' }, new Date('2025-01-01T00:00:00.000Z')), false);
});

test('non-factory users are rejected before booking confirmation', async () => {
  const res = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };

  await createBooking({ user: { role: 'transporter' }, body: { loadId: '507f1f77bcf86cd799439011', truckId: '507f1f77bcf86cd799439012', acceptTerms: true } }, res, () => {});
  assert.equal(res.code, 403);
});

test('cost calculations remain internally consistent for distance-based and fixed charges', () => {
  const summary = calculateCostSummary({
    distanceKm: 120,
    depositRatePerKm: 5,
    brokerCommissionRatePerKm: 3,
    otherChargesRupees: 150,
    fuelCostRupees: 800,
    tollCostRupees: 100,
    loadingCostRupees: 200,
    unloadingCostRupees: 200,
    waitingCostRupees: 50,
  });

  const expectedFactory = 120 * 5 + 120 * 3 + 150 + 800 + 100 + 200 + 200 + 50;
  const expectedTransporter = 120 * 5 + 800 + 100 + 200 + 200 + 50;

  assert.equal(summary.totalFactoryPayableRupees, expectedFactory);
  assert.equal(summary.totalTransporterPayableRupees, expectedTransporter);
});
