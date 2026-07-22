# Eval Report: sorting-station — `sort_variety` mode added — 2026-07-21

Origin: user report that a single sorting station replays **"essentially the same comparison 5 times"** (e.g. "Tow Truck vs Car" every round). Ran `/eval-fix` → escalated to `/add-eval-modes`.

## Diagnosis (what the complaint actually was)

The first read (SST-1, 2026-07-21) measured **object-noun** variety and found cross-session convergence (hook 5/5). A prompt-entropy prototype (random seed + rotating "reach into the long tail" directive) was A/B-proven against the tow-truck objective:

| Metric | Baseline | Prompt-entropy |
|---|---|---|
| Distinct items / 5 sessions | 44 | 54 |
| Item in every session | pillow (5/5) | none |
| Most-repeated | 5/5 | 4/5 |

Real but only **moderate** — and it addressed the wrong axis. The user clarified: the monotony is the **classification RULE** being identical every round (same 2 bins), not which nouns fill them. Different nouns, same cognitive task. The prompt-entropy patch was **reverted**; object-noun convergence remains as **SST-1 (DEFERRED)**.

Rule-rotation is exactly contract gap **G3** ("re-sort the same set by a different rule"), which is in pre-detected **conflict with R1** (taught-rule stability). The contract's recorded ruling: fork into a NEW mode where rotation is the declared task — **do not edit R1's guard in place** (in-place axis-switching is the 2026-07-14 drift bug that broke shapes/needs/helpers, C1).

## What shipped: `sort_variety` (fork rung 1)

- **Catalog** (`math.ts`): eval mode `sort_variety`, β 3.0, scaffoldingMode 2, challengeTypes `['sort-variety']`, **Grade 1+ floor** (following a new named rule each round is a reading demand above a pre-reader). Backend prior added to match.
- **Generator** (`gemini-sorting-station.ts`): new challengeType `sort-variety` + `generateVarietyChallenges` sub-generator + `GENERATOR_MAP` entry; excluded from the unpinned `MIXED_TYPES` set (a whole-session task, meaningless interleaved). R1 exemption realized via `buildVarietyObjectiveSection` (instructs rotation for THIS mode only). **Code owns the axes:** the LLM supplies one object set with required `type`/`size`/`category`; code derives 2-3 rounds, each an axis that splits the shared set into 2..binCap groups — the LLM never picks the axis or bin count. Retry-once + required fields fixed a ~50% thin-draw flake.
- **Component** (`SortingStation.tsx`): `sort-variety` renders via the existing `sort-by-one` interaction (6 additive branches; no new interaction surface).
- **Contract**: G3 → LANDED; R1 carries the `sort_variety` exemption + inverted probe.

## Results

| Eval Mode | Status | Notes |
|-----------|--------|-------|
| sort_variety | **PASS** | 5/5 fully-valid: 3 rounds, distinct rules (category/size/type), constant object set, bins ≤ grade cap |
| sort_one | PASS | no regression (4× sort-by-one) |
| sort_attribute | PASS | no regression |
| odd_one_out | PASS | no regression |
| tally_record | PASS | no regression |

- **tsc:** 0 new errors vs. baseline.
- **G1–G4 checks (on sort_variety):** required fields present (type/size/category), rules differ every round while the object set is constant, bins within 2..cap, answers derivable from visible attributes.

## Follow-ups (queued)

1. **K voiced-rule variant** — unfloor `sort_variety` to Kindergarten via a reader-fit re-audit (voiced rule per round + pictorial cues), mirroring G2's "re-audit, not unfloor" ruling. Executor: `/reader-fit` + `/add-tutoring-scaffold`.
2. **R1 automated-probe exemption** — teach the `/topic-fidelity` probe that `sort_variety` SHOULD switch axes.
3. **SST-1 (object-noun convergence)** — DEFERRED; needs an entropy lever better than prompt-only that doesn't hardcode per-topic pools.
