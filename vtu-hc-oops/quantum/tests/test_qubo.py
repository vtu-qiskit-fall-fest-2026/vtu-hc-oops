"""The QUBO must have the same optimum as the classical assignment problem."""
from itertools import product

import numpy as np
import pytest

from qlogistics.qaoa import solve
from qlogistics.qubo import Option, brute_force, build_qubo, reduce_options, to_ising

# Two loads, three trucks: the cheapest option for L1 (T1) is also L2's only cheap truck,
# so the optimum must trade off: L1->T2 (450) + L2->T1 (300) = 750 beats L1->T1 + L2->T3 = 400 + 600.
DEMO = [
    Option("L1", "T1", 400), Option("L1", "T2", 450),
    Option("L2", "T1", 300), Option("L2", "T3", 600),
]


def classical_optimum(options):
    """Max assigned count, then min cost, by trying every subset."""
    best = None
    for pick in product([0, 1], repeat=len(options)):
        chosen = [o for o, b in zip(options, pick) if b]
        if len({o.load_id for o in chosen}) < len(chosen) or len({o.truck_id for o in chosen}) < len(chosen):
            continue
        key = (-len(chosen), sum(o.cost for o in chosen))
        if best is None or key < best[0]:
            best = (key, chosen)
    return best[1]


def test_qubo_minimum_is_the_classical_optimum():
    rng = np.random.default_rng(1)
    for _ in range(40):
        loads = [f"L{i}" for i in range(rng.integers(1, 4))]
        trucks = [f"T{i}" for i in range(rng.integers(1, 4))]
        options = [Option(l, t, float(rng.integers(0, 5000))) for l in loads for t in trucks if rng.random() < 0.7]
        if not options:
            continue
        q = build_qubo(options)
        x, _ = brute_force(q)
        assert q.is_feasible(x)
        got = q.decode(x)
        want = classical_optimum(options)
        assert len(got) == len(want)
        assert sum(o.cost for o in got) == pytest.approx(sum(o.cost for o in want))


def test_ising_energy_equals_qubo_energy():
    q = build_qubo(DEMO)
    h, offset = to_ising(q)
    mat = h.to_matrix(sparse=True).diagonal().real
    for idx in range(2 ** q.num_qubits):
        x = np.array([(idx >> i) & 1 for i in range(q.num_qubits)])
        assert mat[idx] + offset == pytest.approx(q.energy(x))


def test_qaoa_finds_the_optimum_on_the_demo_instance():
    r = solve(build_qubo(DEMO), mode="ideal", reps=2, shots=2048, seed=7)
    assert r.x is not None
    assert r.energy == pytest.approx(r.optimal_energy)
    assert r.probability_of_optimal > 0.05


def test_reduction_keeps_cheapest_per_load_within_budget():
    opts = [Option(f"L{l}", f"T{t}", 100 * t + l) for l in range(4) for t in range(6)]
    kept, reduced = reduce_options(opts, 10)
    assert reduced and len(kept) == 10
    assert {o.load_id for o in kept} == {"L0", "L1", "L2", "L3"}


def test_numpy_training_state_matches_the_qiskit_circuit():
    """Training uses a NumPy simulation; it must be the same state as the circuit we sample."""
    from qiskit.circuit.library import qaoa_ansatz
    from qiskit.quantum_info import Statevector

    from qlogistics.qaoa import bind, ising_diagonal, qaoa_state

    q = build_qubo(DEMO)
    h, offset = to_ising(q)
    diag = ising_diagonal(q) - offset
    gammas, betas = [0.3, 0.7], [0.5, 0.2]
    ours = qaoa_state(diag, gammas, betas)
    theirs = Statevector(bind(qaoa_ansatz(h, reps=2), gammas, betas)).data
    assert abs(np.vdot(ours, theirs)) == pytest.approx(1.0, abs=1e-9)
