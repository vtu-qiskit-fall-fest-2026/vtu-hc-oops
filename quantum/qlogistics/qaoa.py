"""QAOA on the assignment QUBO.

Training: the circuit parameters (gamma, beta) are tuned with COBYLA against the exact
expectation value <H> from a statevector (cheap for <= ~20 qubits and noise-free).
Sampling: the tuned circuit is then measured with shots on
    * "ideal"  - AerSimulator, no noise
    * "noisy"  - AerSimulator with the noise model of a real IBM device (FakeBrisbane)
    * "ibm"    - real IBM Quantum hardware via Qiskit Runtime (needs IBM_QUANTUM_TOKEN)
and the best *feasible* sampled assignment is returned. Training on hardware is not
attempted: queue times make that impractical for an interactive request.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field

import numpy as np
from qiskit import transpile
from qiskit.circuit.library import qaoa_ansatz
from scipy.optimize import minimize

from .qubo import Qubo, bits_to_x, brute_force, to_ising

MODES = ("ideal", "noisy", "ibm")


@dataclass
class QaoaResult:
    mode: str
    backend: str
    reps: int
    shots: int
    x: np.ndarray | None
    energy: float | None
    optimal_x: np.ndarray
    optimal_energy: float
    probability_of_optimal: float
    feasible_shot_fraction: float
    iterations: int
    params: list[float]
    counts: dict[str, int]
    circuit: dict = field(default_factory=dict)
    runtime_ms: float = 0.0


def qaoa_state(diag: np.ndarray, gammas, betas) -> np.ndarray:
    """Exact QAOA statevector for a diagonal cost Hamiltonian, in plain NumPy.

    Same circuit as Qiskit's qaoa_ansatz: |+>^n, then per layer exp(-i gamma H) and
    exp(-i beta X) on every qubit. Index k's bit i is qubit i, as in Qiskit.
    Re-simulating the Qiskit circuit for every optimiser step re-synthesised it each
    time and took minutes at 12 qubits; this takes milliseconds.
    """
    n = int(np.log2(diag.size))
    psi = np.full(diag.size, 1 / np.sqrt(diag.size), dtype=complex)
    for g, b in zip(gammas, betas):
        psi = psi * np.exp(-1j * g * diag)
        c, s = np.cos(b), -1j * np.sin(b)
        for i in range(n):
            v = psi.reshape(-1, 2, 2**i)
            a0, a1 = v[:, 0, :].copy(), v[:, 1, :].copy()
            v[:, 0, :] = c * a0 + s * a1
            v[:, 1, :] = s * a0 + c * a1
            psi = v.reshape(-1)
    return psi


def _train(diag: np.ndarray, reps: int, seed: int, maxiter: int) -> tuple[np.ndarray, np.ndarray, int]:
    rng = np.random.default_rng(seed)
    evals = 0

    def objective(theta):
        nonlocal evals
        evals += 1
        psi = qaoa_state(diag, theta[:reps], theta[reps:])
        return float(np.abs(psi) ** 2 @ diag)

    best = None
    # Several starts: the QAOA landscape is rugged and one start often stalls.
    starts = [np.concatenate([np.linspace(0.1, 0.8, reps), np.linspace(0.8, 0.1, reps)])]  # linear-ramp start
    starts += [np.concatenate([rng.uniform(0, np.pi, reps), rng.uniform(0, np.pi / 2, reps)]) for _ in range(5)]
    for theta0 in starts:
        res = minimize(objective, theta0, method="COBYLA", options={"maxiter": maxiter, "rhobeg": 0.3})
        if best is None or res.fun < best.fun:
            best = res
    return best.x[:reps], best.x[reps:], evals


def bind(ansatz, gammas, betas):
    """Bind by name: qaoa_ansatz calls its parameters β[k] and γ[k]."""
    values = {}
    for p in ansatz.parameters:
        k = int(p.name.split("[")[1].rstrip("]"))
        values[p] = gammas[k] if p.name.startswith("γ") else betas[k]
    return ansatz.assign_parameters(values)


def ising_diagonal(q: Qubo) -> np.ndarray:
    """Diagonal of the Ising Hamiltonian over all 2^n basis states (offset included)."""
    n = q.num_qubits
    idx = np.arange(2**n)
    xs = ((idx[:, None] >> np.arange(n)) & 1).astype(float)
    e = xs @ q.linear
    for (i, j), w in q.quadratic.items():
        e += w * xs[:, i] * xs[:, j]
    return e


def _sampler_backend(mode: str):
    from qiskit_aer import AerSimulator

    if mode == "ideal":
        return AerSimulator(), "aer_simulator (noiseless)"
    if mode == "noisy":
        from qiskit_ibm_runtime.fake_provider import FakeBrisbane

        fake = FakeBrisbane()
        return AerSimulator.from_backend(fake), f"aer_simulator with {fake.name} noise model"
    raise ValueError(f"Unknown simulator mode {mode!r}")


def _run_on_ibm(circuit, shots: int):
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

    token = os.environ.get("IBM_QUANTUM_TOKEN")
    if not token:
        raise RuntimeError("Set IBM_QUANTUM_TOKEN to run on IBM Quantum hardware.")
    service = QiskitRuntimeService(
        channel=os.environ.get("IBM_QUANTUM_CHANNEL", "ibm_quantum_platform"),
        token=token,
        instance=os.environ.get("IBM_QUANTUM_INSTANCE") or None,
    )
    backend = service.least_busy(operational=True, simulator=False, min_num_qubits=circuit.num_qubits)
    isa = transpile(circuit, backend=backend, optimization_level=3)
    job = SamplerV2(mode=backend).run([isa], shots=shots)
    counts = job.result()[0].data.meas.get_counts()
    return counts, backend.name, isa, job.job_id()


def solve(q: Qubo, *, mode: str = "ideal", reps: int = 2, shots: int = 2048, seed: int = 7,
          maxiter: int = 150) -> QaoaResult:
    if mode not in MODES:
        raise ValueError(f"mode must be one of {MODES}")
    started = time.perf_counter()
    hamiltonian, offset = to_ising(q)
    # Normalise the Hamiltonian so gamma has the same useful range for any instance size.
    scale = float(np.max(np.abs(hamiltonian.coeffs))) or 1.0
    h_norm = hamiltonian / scale
    diag = (ising_diagonal(q) - offset) / scale   # diagonal of h_norm

    gammas, betas, evals = _train(diag, reps, seed, maxiter)
    params = np.concatenate([gammas, betas])

    ansatz = qaoa_ansatz(h_norm, reps=reps)
    circuit = bind(ansatz, gammas, betas)
    circuit.measure_all()

    job_id = None
    if mode == "ibm":
        counts, backend_name, isa, job_id = _run_on_ibm(circuit, shots)
    else:
        backend, backend_name = _sampler_backend(mode)
        isa = transpile(circuit, backend=backend, optimization_level=1, seed_transpiler=seed)
        counts = backend.run(isa, shots=shots, seed_simulator=seed).result().get_counts()

    opt_x, opt_e = brute_force(q)
    opt_key = "".join(str(b) for b in reversed(opt_x))

    best_x, best_e = None, None
    feasible_shots = 0
    for bits, c in counts.items():
        x = bits_to_x(bits.replace(" ", ""))
        if not q.is_feasible(x):
            continue
        feasible_shots += c
        e = q.energy(x)
        if best_e is None or e < best_e:
            best_x, best_e = x, e

    ops = isa.count_ops()
    two_qubit = sum(v for k, v in ops.items() if k in ("cx", "cz", "ecr", "rzz", "swap"))
    top = dict(sorted(counts.items(), key=lambda kv: -kv[1])[:16])
    return QaoaResult(
        mode=mode,
        backend=backend_name,
        reps=reps,
        shots=shots,
        x=best_x,
        energy=best_e,
        optimal_x=opt_x,
        optimal_energy=opt_e,
        probability_of_optimal=counts.get(opt_key, 0) / shots,
        feasible_shot_fraction=feasible_shots / shots,
        iterations=evals,
        params=[float(p) for p in params],
        counts=top,
        circuit={
            "qubits": q.num_qubits,
            "logicalDepth": circuit.depth(),
            "transpiledDepth": isa.depth(),
            "twoQubitGates": int(two_qubit),
            "hamiltonianTerms": len(hamiltonian),
            **({"ibmJobId": job_id} if job_id else {}),
        },
        runtime_ms=round((time.perf_counter() - started) * 1000, 1),
    )
