"""Run the demo assignment QAOA on real IBM Quantum hardware and save the result.

    set IBM_QUANTUM_TOKEN=<your API key from quantum.cloud.ibm.com>
    optional: IBM_QUANTUM_INSTANCE=<CRN>, IBM_QUANTUM_CHANNEL (default ibm_quantum_platform)
    python scripts/run_on_ibm.py            (from the quantum/ folder)

Parameters are trained on a classical simulator first (hardware queues make training on
the device impractical), then the tuned circuit is sampled once on the least busy device.
Writes results/ibm_hardware_run.json, which the service serves at GET /hardware-run.
The free plan gives 10 minutes of device time per month; one run uses a few seconds.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from qlogistics.demo import DEMO_OPTIONS  # noqa: E402
from qlogistics.qaoa import solve  # noqa: E402
from qlogistics.qubo import build_qubo  # noqa: E402

OUT = ROOT / "results" / "ibm_hardware_run.json"


def main() -> None:
    q = build_qubo(DEMO_OPTIONS)
    print(f"Submitting {q.num_qubits}-qubit QAOA (p=2) to IBM Quantum; this waits for the queue...")
    r = solve(q, mode="ibm", reps=2, shots=4096, seed=7)
    picked = q.decode(r.x) if r.x is not None else []
    result = {
        "ranAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "backend": r.backend,
        "jobId": r.circuit.get("ibmJobId"),
        "shots": r.shots,
        "reps": r.reps,
        "circuit": r.circuit,
        "bestValidSample": [{"loadId": o.load_id, "truckId": o.truck_id, "cost": o.cost} for o in picked],
        "totalCost": sum(o.cost for o in picked),
        "matchesOptimum": r.energy is not None and abs(r.energy - r.optimal_energy) < 1e-9,
        "probabilityOfOptimal": r.probability_of_optimal,
        "feasibleShotFraction": r.feasible_shot_fraction,
        "counts": r.counts,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("backend", "jobId", "totalCost", "matchesOptimum",
                                              "probabilityOfOptimal", "feasibleShotFraction")}, indent=2))
    print(f"Saved {OUT}")


if __name__ == "__main__":
    main()
