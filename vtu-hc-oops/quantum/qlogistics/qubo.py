"""Load→truck assignment as a QUBO, and its Ising form for QAOA.

Problem (same objective as backend/src/services/assignmentOptimizer.js):
    choose options x_i in {0, 1}, one per candidate (load, truck) pair, so that
      * each load gets at most one truck,
      * each truck takes at most one load,
    maximising the number of assigned loads first, then minimising total cost.

QUBO (minimise):
    E(x) = sum_i (c_i - A) x_i  +  P * sum_{i<j conflicting} x_i x_j

    c_i  = cost_i / max_cost, in [0, 1]           normalised so the scale is fixed
    A    = number_of_loads + 1                    reward per assignment
    P    = 2 * A                                  penalty per conflicting pair

Why these weights:
  * A > any total of normalised costs (at most one per load), so assigning one more
    load always lowers E more than any cost difference raises it: count first, cost second.
  * Adding an option that clashes with a chosen one changes E by c_j - A + P > 0, so a
    clash never pays; every minimum of E is a feasible assignment.
Both properties are checked against brute force in tests/test_qubo.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations

import numpy as np
from qiskit.quantum_info import SparsePauliOp


@dataclass(frozen=True)
class Option:
    load_id: str
    truck_id: str
    cost: float


@dataclass
class Qubo:
    options: list[Option]
    linear: np.ndarray            # h_i
    quadratic: dict[tuple[int, int], float]   # J_ij for i < j
    reward: float
    penalty: float
    max_cost: float

    @property
    def num_qubits(self) -> int:
        return len(self.options)

    def energy(self, x: np.ndarray) -> float:
        e = float(self.linear @ x)
        for (i, j), w in self.quadratic.items():
            e += w * x[i] * x[j]
        return float(e)  # plain float: NumPy scalars break JSON encoding in the API

    def conflicts(self, x: np.ndarray) -> int:
        return sum(1 for (i, j) in self.quadratic if x[i] and x[j])

    def is_feasible(self, x: np.ndarray) -> bool:
        return self.conflicts(x) == 0

    def decode(self, x: np.ndarray) -> list[Option]:
        return [o for o, bit in zip(self.options, x) if bit]


def build_qubo(options: list[Option]) -> Qubo:
    if not options:
        raise ValueError("At least one candidate option is required.")
    if any(o.cost < 0 for o in options):
        raise ValueError("Costs must be non-negative.")
    loads = {o.load_id for o in options}
    max_cost = max(o.cost for o in options) or 1.0
    reward = len(loads) + 1.0
    penalty = 2.0 * reward

    linear = np.array([o.cost / max_cost - reward for o in options], dtype=float)
    quadratic: dict[tuple[int, int], float] = {}
    for i, j in combinations(range(len(options)), 2):
        a, b = options[i], options[j]
        if a.load_id == b.load_id or a.truck_id == b.truck_id:
            quadratic[(i, j)] = penalty
    return Qubo(options, linear, quadratic, reward, penalty, max_cost)


def to_ising(q: Qubo) -> tuple[SparsePauliOp, float]:
    """Substitute x_i = (1 - Z_i) / 2. Returns (H, offset) with E(x) = <H> + offset.

    Qubit i is Pauli index i; in Qiskit bitstrings qubit 0 is the rightmost character.
    """
    n = q.num_qubits
    z = np.zeros(n)
    terms: list[tuple[str, list[int], float]] = []
    offset = 0.0
    for i, h in enumerate(q.linear):
        offset += h / 2
        z[i] -= h / 2
    for (i, j), w in q.quadratic.items():
        offset += w / 4
        z[i] -= w / 4
        z[j] -= w / 4
        terms.append(("ZZ", [i, j], w / 4))
    terms += [("Z", [i], z[i]) for i in range(n) if abs(z[i]) > 1e-12]
    return SparsePauliOp.from_sparse_list(terms, num_qubits=n).simplify(), offset


def bits_to_x(bitstring: str) -> np.ndarray:
    """Qiskit bitstring (qubit 0 rightmost) → x vector indexed by qubit."""
    return np.array([int(b) for b in reversed(bitstring)], dtype=int)


def brute_force(q: Qubo) -> tuple[np.ndarray, float]:
    """Exact minimum by enumerating all 2^n assignments. Fine up to ~20 qubits."""
    n = q.num_qubits
    if n > 22:
        raise ValueError("Brute force is limited to 22 variables.")
    idx = np.arange(2**n)
    xs = ((idx[:, None] >> np.arange(n)) & 1).astype(float)
    energies = xs @ q.linear
    for (i, j), w in q.quadratic.items():
        energies += w * xs[:, i] * xs[:, j]
    best = int(np.argmin(energies))
    return xs[best].astype(int), float(energies[best])


def reduce_options(options: list[Option], max_qubits: int) -> tuple[list[Option], bool]:
    """Keep the cheapest options per load, round-robin, until max_qubits.

    Simulating QAOA needs one qubit per option, so a large instance is trimmed to a
    smaller sub-problem. The caller reports that the result is for the reduced problem.
    """
    if len(options) <= max_qubits:
        return options, False
    by_load: dict[str, list[Option]] = {}
    for o in sorted(options, key=lambda o: o.cost):
        by_load.setdefault(o.load_id, []).append(o)
    kept: list[Option] = []
    rank = 0
    while len(kept) < max_qubits:
        added = False
        for opts in by_load.values():
            if rank < len(opts) and len(kept) < max_qubits:
                kept.append(opts[rank])
                added = True
        if not added:
            break
        rank += 1
    return kept, True
