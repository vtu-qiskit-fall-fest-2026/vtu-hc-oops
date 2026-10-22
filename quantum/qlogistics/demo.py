"""The demo instance: the 9 eligible (load, truck) pairs the seeded database produces
(backend/src/seed/demoData.js). Used by the notebook and scripts/run_on_ibm.py so they
solve exactly what the app shows on /factory/optimizer. Classical optimum: Rs 59,500.
"""
from .qubo import Option

LOADS = {
    "L-JNPT": "Export cartons to JNPT (Pune → Mumbai)",
    "L-AUR": "Machined castings (Pune → Aurangabad)",
    "L-NSK": "Steel coils to Nashik (Pune → Nashik)",
    "L-KOP": "Spare parts to Kolhapur (Pune → Kolhapur)",
}

DEMO_OPTIONS = [
    Option("L-JNPT", "MH12EF3003", 14500),
    Option("L-AUR", "MH12AB1001", 17000),
    Option("L-AUR", "MH14CD2002", 21000),
    Option("L-NSK", "MH12JK5005", 16000),
    Option("L-NSK", "MH12AB1001", 17000),
    Option("L-NSK", "MH14CD2002", 21000),
    Option("L-KOP", "MH09GH4004", 12000),
    Option("L-KOP", "MH12EF3003", 14500),
    Option("L-KOP", "MH14CD2002", 21000),
]
