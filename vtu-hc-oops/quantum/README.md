---
title: LoadSetu QAOA
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
short_description: QAOA load-to-truck assignment service (Qiskit)
---

# LoadSetu quantum service

The front matter above configures the Hugging Face Space this folder deploys to. See `../docs/DEPLOY.md`.

FastAPI service the LoadSetu API calls to solve the load→truck assignment with QAOA (Qiskit).

| Endpoint | |
| :--- | :--- |
| `GET /health` | Versions and limits. Open, so uptime checks can ping it. |
| `POST /solve` | `{options: [{loadId, truckId, cost}], mode: "ideal" \| "noisy"}`. Needs header `X-Quantum-Key` when `QUANTUM_SERVICE_KEY` is set. |
| `GET /hardware-run` | Last real IBM hardware result from `scripts/run_on_ibm.py`, or 404. |

- Formulation and results: `notebooks/qaoa_fleet_assignment.ipynb`
- Code: `qlogistics/qubo.py` (QUBO and Ising), `qlogistics/qaoa.py` (QAOA), `qlogistics/service.py` (HTTP)
- Local run, from this folder: `.venv/Scripts/python -m uvicorn qlogistics.service:app --port 8000`
