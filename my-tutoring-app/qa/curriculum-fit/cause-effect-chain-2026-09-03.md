# Curriculum-Fit: cause-effect-chain — 2026-09-03

**Domain → Subject:** history → SOCIAL_STUDIES (mapping already shipped by `era-explorer`, 08-23)
**Query (embedded):** "Students build chains of historical cause and effect: given an outcome and a shuffled bank of event cards, they place the events in the order they happened…"

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| 1 | **MATCH** | 0.723 | 4/5 | `SS004-02` "Personal Timelines — read stories about events and choose the best…" |
| 2 | **MATCH** | 0.733 | 4/5 | `SS004-03` "Change Over Time — order the developments of a community over…" |
| 3 | not probed — **quota** | — | — | embedding call returned 429 RESOURCE_EXHAUSTED on every attempt |
| 4 | not probed — **quota** | — | — | same |
| K | not probed — **quota** | — | — | same |

The two grades that completed both land in the **SS004 family** (timelines / sequencing /
change over time) with 4-of-5 coherence — the right home for causal ordering. G1's top-5 is
`SS004-02/03/04/05` plus `SS001-05` (sequence the events of the first Thanksgiving); G2's is
`SS004-03/01/03/02` plus `SS001-01`. Both peaks, not plateaus.

## Diagnosis & Recommendation

**No curriculum action.** The primitive has a clear home at both grades that could be probed,
in the family the PRD predicted.

**One probe defect worth knowing (not this primitive's bug):** when the subskill embedding
call fails, `curriculum_fit_probe.py` reports **`ABSTAIN [no_scope]`** with `candidates=0` —
the same shape a genuinely unpublished grade produces. The first (auto-grades) run surfaced the
real reason as `embed_error` for two grades and `no_scope` for two others, from the *same*
429s. Read literally, this run would say SOCIAL_STUDIES G3 and G4 are unpublished; the
`era-explorer` fit report (08-23) probed both and found them published, so the abstain is a
quota artifact. **A 429 during subskill embedding must not be reported as `no_scope`** — a
future sweep will otherwise file phantom curriculum gaps. Filed as a queue item, not fixed
here.

Grades 3-6 remain unverified. Re-run when quota is free:

```bash
cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/curriculum_fit_probe.py \
  --primitive cause-effect-chain --domain history --grades 3,4 --description "<catalog description>"
```

## Assessability (the check a MATCH does not give you)

Per the skill's rule 4 — a MATCH says a home exists, not that the primitive can measure
anything. Grepped: `CauseEffectChain.tsx` carries `handleCheck`, `correctOrder`,
`recordResult`, `usePrimitiveEvaluation` and a `challenges[]` array. **Solve surface present**
— this primitive is a real `/add-eval-modes` candidate, not an exploration sandbox.
