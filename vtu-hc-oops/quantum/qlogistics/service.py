"""HTTP API the Node backend calls: POST /solve with candidate (load, truck, cost) options.

Run:  uvicorn qlogistics.service:app --port 8000   (from the quantum/ folder)
"""
from __future__ import annotations

import hmac
import json
import os
from pathlib import Path

import qiskit
import qiskit_aer
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .qaoa import MODES, solve
from .qubo import Option, build_qubo, reduce_options

MAX_QUBITS = 12  # ~5 s noiseless; statevector training cost doubles per qubit
MAX_NOISY_QUBITS = 10  # noisy simulation of the routed circuit grows much faster
HARDWARE_RESULT = Path(__file__).resolve().parent.parent / "results" / "ibm_hardware_run.json"

# Shared secret with the Node API. A public deployment (e.g. a Hugging Face Space) is
# reachable by anyone, and each /solve burns seconds of CPU. Unset = open (local dev).
SERVICE_KEY = os.environ.get("QUANTUM_SERVICE_KEY", "")

app = FastAPI(title="LoadSetu quantum assignment service", version="1.0.0")


def require_key(x_quantum_key: str = Header(default="")):
    if SERVICE_KEY and not hmac.compare_digest(x_quantum_key.encode(), SERVICE_KEY.encode()):
        raise HTTPException(401, "Missing or wrong X-Quantum-Key.")


class OptionIn(BaseModel):
    loadId: str
    truckId: str
    cost: float = Field(ge=0)


class SolveIn(BaseModel):
    options: list[OptionIn] = Field(min_length=1, max_length=200)
    mode: str = "ideal"
    reps: int = Field(default=2, ge=1, le=4)
    shots: int = Field(default=2048, ge=100, le=20000)
    seed: int = 7


@app.get("/health")
def health():
    return {"status": "ok", "qiskit": qiskit.__version__, "qiskitAer": qiskit_aer.__version__,
            "maxQubits": MAX_QUBITS, "modes": [m for m in MODES if m != "ibm"]}


@app.post("/solve", dependencies=[Depends(require_key)])
def solve_endpoint(body: SolveIn):
    if body.mode not in ("ideal", "noisy"):
        # Hardware runs queue for minutes; they go through scripts/run_on_ibm.py instead.
        raise HTTPException(400, "mode must be 'ideal' or 'noisy'.")
    all_options = [Option(o.loadId, o.truckId, o.cost) for o in body.options]
    options, reduced = reduce_options(all_options, MAX_NOISY_QUBITS if body.mode == "noisy" else MAX_QUBITS)
    q = build_qubo(options)
    r = solve(q, mode=body.mode, reps=body.reps, shots=body.shots, seed=body.seed)

    def assignments(x):
        if x is None:
            return []
        return [{"loadId": o.load_id, "truckId": o.truck_id, "cost": o.cost} for o in q.decode(x)]

    quantum = assignments(r.x)
    exact = assignments(r.optimal_x)
    q_cost = sum(a["cost"] for a in quantum)
    e_cost = sum(a["cost"] for a in exact)
    return {
        "solver": {"name": "QAOA", "framework": f"Qiskit {qiskit.__version__}", "mode": r.mode,
                   "backend": r.backend, "reps": r.reps, "shots": r.shots,
                   "classicalOptimizer": "COBYLA", "iterations": r.iterations},
        "problem": {"variables": q.num_qubits, "candidateOptions": len(all_options), "reduced": reduced,
                    "loads": len({o.load_id for o in options}), "conflictPairs": len(q.quadratic),
                    "reward": q.reward, "penalty": q.penalty},
        # Qubit i is option i; in the bitstrings of "counts", qubit 0 is the rightmost character.
        "variables": [{"qubit": i, "loadId": o.load_id, "truckId": o.truck_id, "cost": o.cost} for i, o in enumerate(q.options)],
        "circuit": r.circuit,
        "quantum": {"assignments": quantum, "assignedCount": len(quantum), "totalCost": q_cost,
                    "energy": r.energy, "foundFeasible": r.x is not None},
        "exactQubo": {"assignments": exact, "assignedCount": len(exact), "totalCost": e_cost,
                      "energy": r.optimal_energy, "method": f"brute force over 2^{q.num_qubits} states"},
        "metrics": {
            "matchesOptimum": r.energy is not None and abs(r.energy - r.optimal_energy) < 1e-9,
            # Energies are negative; 1.0 means QAOA's best sample is the optimum.
            "approximationRatio": round(r.energy / r.optimal_energy, 4) if r.energy is not None and r.optimal_energy else None,
            "probabilityOfOptimal": round(r.probability_of_optimal, 4),
            "feasibleShotFraction": round(r.feasible_shot_fraction, 4),
        },
        "counts": r.counts,
        "runtimeMs": r.runtime_ms,
    }


@app.get("/hardware-run")
def hardware_run():
    if not HARDWARE_RESULT.exists():
        raise HTTPException(404, "No IBM hardware run recorded yet. See quantum/scripts/run_on_ibm.py.")
    return json.loads(HARDWARE_RESULT.read_text(encoding="utf-8"))
