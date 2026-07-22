# Eval Report: sorting-station — 2026-07-21

Triggered by user report: "getting a lot of repeats … bed/fridge/hook/cable multiple times" (sort_one, "Tow Truck Helper: Sorting Parts" — tow-truck-part vs house-item).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| sort_one  | PASS (solvable) / **variety FAIL** | 1 (SST-1, HIGH) |

Everything renders, sorts correctly, no answer leak, no crash. The defect is **content variety across sessions**, not correctness.

## What I measured

- **Within one session** (4 challenges): object sets are mostly distinct — variety is acceptable. Not the problem.
- **Across sessions** (5 independent generations, same topic+intent `Tow trucks` / `Sort tow truck parts from house items`, K):

  | appears in N/5 sessions | item |
  |---|---|
  | 5/5 | hook |
  | 4/5 | tire, wrench, pillow |
  | 3/5 | sofa, lamp, book, fork, mirror, toothbrush |
  | 2/5 | chain, cable, toaster, sock, spoon, oil can, coffee mug, safety cone |

  "hook" appeared in **every** session; the same ~10 canonical items dominate every draw. This is exactly the bed/fridge/hook/cable convergence the student experiences as "repeats."

Contrast: a broad-universe topic ("Tow trucks", no narrowing intent) produced good variety (Tow Truck / Police Car / Fire Truck / Ambulance / Taxi / Tractor / Bicycle…). The convergence is **amplified when the objective's object universe is small** (a tow truck has ~6 nameable parts a K child knows: hook, cable, winch, chain, boom, flatbed), so flash-lite lands on the same anchors every session.

## Issues

### sort_one — Cross-session object convergence (no injected variety)
- **Severity:** HIGH (variety/engagement; not a correctness or leak break)
- **What's broken:** The generator gives flash-lite no per-session entropy — no shuffled variety pool, no "avoid these" exclusion, no directive forcing the object set to differ from prior draws. Structured output over a small LLM-chosen object universe converges on the same canonical anchors every session. A replaying student sees hook/cable/winch + bed/fridge/sofa repeatedly.
- **Data:** `hook` in 5/5 sessions; top-10 items dominate all draws.
- **Related pattern:** SP-19 (orchestrator/LLM-chosen answer space converges) — here the convergence is the LLM-owned **object set**, cross-session rather than cross-parallel-call. Same remedy class as [[skip-counting-skipvalue-resolver]]: entropy belongs in the prompt, injected by code.
- **Fix in:** GENERATOR (`gemini-sorting-station.ts`)

## Recommended fix (for `/eval-fix`, not applied)

Inject code-owned entropy into the sort-family sub-generator prompt so successive sessions diverge:
1. **Per-session variety directive + seed** — pass a shuffled hint list ("this session prefer these example objects: …") drawn round-robin from a broader per-topic object pool, so the anchor set rotates. (Matches the SP-18/SP-19 round-robin remedy.)
2. **Cross-challenge disjointness** — instruct that the N challenges in a session use mutually-disjoint object sets (already mostly true; make it explicit).
3. Do **not** rely on temperature alone — semantic convergence on canonical anchors survives it.

No CATALOG/COMPONENT change needed; solvability, bins, pictures (RF-3), and reader-fit (RF-1/2) are intact.
