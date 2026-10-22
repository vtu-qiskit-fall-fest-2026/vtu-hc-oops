# AI and optimization integration

## Repository findings

There is no trained delay, ETA, or suitability model, training dataset, model artifact, or inference package in this repository. The truck matching engine is deterministic rule-based matching; it is not a trained model, and the API and dashboard do not invent prediction values. The quantum solver is described under "Quantum comparison" below.

## Delay-model adapter contract

Configure `LOADSETU_DELAY_MODEL_URL` to enable calls to a separately deployed, trained model service. Optional service authentication uses `LOADSETU_DELAY_MODEL_API_KEY`. The adapter accepts only loads with material, positive weight, pickup, destination, and a valid pickup date. It sends JSON with schema version `loadsetu.delay-prediction.request.v1`:

```json
{
  "schemaVersion": "loadsetu.delay-prediction.request.v1",
  "requests": [{
    "loadId": "database-load-id",
    "features": {
      "material": "steel",
      "pickup": "Pune",
      "destination": "Nashik",
      "weightTonnes": 8,
      "pickupAt": "2026-10-21T12:00:00.000Z"
    }
  }]
}
```

The service must return schema version `loadsetu.delay-prediction.response.v1`, a nonempty model name/version, an ISO `generatedAt`, and exactly one prediction for every requested load. A prediction may contain a valid ISO `eta`, a `delayRiskProbability` in `[0, 1]`, or both. The adapter rejects malformed, incomplete, or stale responses and times out after the configured limit. No predictions are exposed for unsupported inputs or service errors. Model quality has not been evaluated because no held-out dataset or trained model is present.

## Classical fleet assignment

`GET /api/loads/optimization` runs an exact branch-and-bound assignment baseline against the authenticated factory's open loads, registered available trucks, and active bookings. It first applies the deterministic mandatory matching constraints, then maximizes the number of assigned loads and minimizes quoted transport cost (using a factory-offer estimate only when no transporter quote exists). The objective does not include late-delivery penalties: current load data and routing services do not supply a verified delivery deadline/ETA pair. Active bookings conservatively reserve their trucks because booking time windows are not represented consistently. The exact search accepts at most 12 loads and has a 500 ms runtime limit; timeout is reported.

The endpoint identifies its source as live database data. Results are suggestions, not reservations; booking endpoints must still validate availability at confirmation.

## Quantum comparison

`GET /api/loads/optimization/quantum?mode=ideal|noisy` sends the same eligible (load, truck, cost) candidates the classical baseline used to the Python service in `quantum/` (`POST /solve`). It formulates the assignment as a QUBO (one binary variable per candidate pair; reward `A = loads + 1` per assignment, penalty `P = 2A` per pair sharing a load or truck), converts it to an Ising Hamiltonian, and runs QAOA (p = 2, COBYLA) in Qiskit. Sampling runs on Qiskit Aer, either noiseless or with the FakeBrisbane noise model. The response carries both answers, the exact QUBO optimum by brute force, circuit depth and gate counts, the probability of measuring the optimum, and the share of valid samples.

Limits, reported in the response and UI:

- Simulation is capped at 12 qubits (10 with noise). Larger instances keep the cheapest candidates per load, and the result is flagged `reduced`.
- If the service is not running, the endpoint returns `status: "unavailable"`. The classical result is unaffected.
- No speedup is claimed. At this size the classical solver is faster and exact.

The formulation is explained step by step in `quantum/notebooks/qaoa_fleet_assignment.ipynb`. `quantum/scripts/run_on_ibm.py` samples the demo instance on real IBM hardware.
