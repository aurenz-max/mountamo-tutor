# Oracle Test — Deterministic Content-Contract QA

Give a primitive a machine-checkable guarantee that its generated content honors its own answer contract — then run that check N times against real Gemini generations for a pass/fail signal that is free, repeatable, and CI-able. This is the harness that lets QA scale past a human clicking through lessons: the four recurring bug classes it catches all shipped to students during June 2026 and were caught by hand.

| Check class | The bug it makes unshippable |
|---|---|
| `answer-key-desync` | correct click marked wrong — vocabulary-explorer `correctIndex` fallback (2026-07-04) |
| `scope` | content exceeds the objective — "Counting to 10" generating 0–20; poetry-lab grade-4-for-K |
| `answer-leak` | the sentence/labels/layout contain the answer |
| `clustering` | "every answer is 5" — no entropy across a challenge set |

**The two halves (this is the whole architecture):**
1. **Generation tap** — `GET /api/lumina/oracle-test` calls `generateComponentContent` directly (the same call the real pipeline and `/eval-test` use), N times per invocation. Nothing per-primitive here; it exists already.
2. **Calculation engine per primitive** — a pure `ContentOracle` in `my-tutoring-app/src/components/lumina/service/qa/oracles/` that re-derives the answer **independently** from the data and checks the shipped key agrees. This is the only per-primitive work, and the registry (`oracles/index.ts`) is its single source of truth.

**Division of labor vs. the other QA skills:** `/eval-test` is agent-judged and qualitative (pedagogy, feel, one-off structure reads); `/oracle-test` is code-judged and quantitative (contract violations, flakiness rates, N runs). They complement — a primitive at any lifecycle layer can have both. Spoken/production modalities are judge-owned, not oracle-able: bench those with fixture clips in the Blend Judge Lab instead.

**Arguments:** `/oracle-test <componentId> [evalMode] [runs] [topic]`
- `/oracle-test vocabulary-explorer recall 5 "Weather and Seasons"`
- `/oracle-test coverage` — which of the ~127 evaluable primitives have an oracle
- `/oracle-test <componentId> --write` — author the oracle for an uncovered primitive

## The route

```
GET /api/lumina/oracle-test                          → coverage report (covered / uncovered)
GET /api/lumina/oracle-test?componentId=X&evalMode=Y → run it
    &runs=5           N generations (default 3, max 25, sequential — rate limits)
    &topic= &gradeLevel= &difficulty= &intent= &grade=   same knobs as /eval-test
    &scopeMax=10      explicit scope ceiling (overrides topic parsing)
    &includeData=1    attach fullData of the first violating run
```

HTTP status IS the signal: **200** all runs clean · **422** violations or generation failures (body has `violationsByCheck`, `runResults`, `flakinessRate`) · **400** no oracle registered. `flakinessRate` counts generations that crashed outright (e.g. Gemini emitting unterminated JSON) — a real student-facing failure mode, tracked per run.

## Workflow

### Phase 0 — Coverage check

`curl -s http://localhost:3001/api/lumina/oracle-test` (dev server must be up; port may be 3000). If the target primitive is covered → Phase 2. If not → Phase 1.

### Phase 1 — Write the oracle (the creative work)

1. **Read how the COMPONENT judges correctness** — the component's check handler is the contract the oracle must mirror. Read the data types and one real generation (`/api/lumina/eval-test?componentId=…`) for the actual shape.
2. **THE INDEPENDENCE RULE:** derive the expected answer from the data a *different way* than the shipped key. vocabulary-explorer's oracle resolves `relatedTermId → term.word` and compares to `options[correctIndex]` — it never trusts `correctIndex` itself. Never port the generator's own answer computation into the oracle: a shared wrong assumption false-passes, which is worse than no oracle.
3. **Write the oracle** at `service/qa/oracles/<componentId>.ts` implementing `ContentOracle` (see `types.ts`). Use the shared helpers (`parseScopeCeiling`, `containsWord`, `checkAnswerVariety`, `checkUniqueOptions`). Challenge types you don't check go into `uncheckedTypes` — honest partial coverage beats silent skips.
4. **Register it** in `oracles/index.ts` (`CONTENT_ORACLES`).
5. **Prove it fires — mandatory.** An oracle that never fires is decoration. Add seeded-violation tests to `oracles/__tests__/oracles.test.ts`: one clean fixture that passes + one mutated fixture per check class that MUST produce the violation (mirror the existing ten-frame / vocabulary-explorer cases). `npm test` green before proceeding.

### Phase 2 — Run

For each eval mode (and each difficulty tier if the generator honors `config.difficulty`):

```bash
curl -s "http://localhost:3001/api/lumina/oracle-test?componentId=<id>&evalMode=<mode>&gradeLevel=<g>&topic=<scope-bearing topic>&runs=5"
```

Use a **scope-bearing topic** ("Counting to 10") when the primitive has a numeric target — otherwise the scope check has nothing to bite on (same principle as `/topic-fidelity`).

### Phase 3 — Interpret

- **Violations** → real content bugs. Hand the JSON evidence (`violationsByCheck`, `&includeData=1` payload) to `/eval-fix`. `answer-key-desync` is always CRITICAL — it marks correct students wrong.
- **`flakinessRate` > 0** → the generator crashes on some generations (malformed Gemini JSON, no retry). Note the rate; a persistent >10% earns an `/eval-fix` of its own (retry/fallback in the generator).
- **`uncheckedTypes` non-empty** → the oracle has a coverage gap for types the generator actually emits. Extend the oracle or record the gap in the report — never read PASS as covering types the oracle skipped.

### Phase 4 — Verify & report

1. `cd "<abs>/my-tutoring-app" && npm run typecheck:lumina` — 0 errors (the gate self-checks that tsc actually ran; a run completing in milliseconds means it didn't).
2. `npm test` — the seeded-violation suite stays green.
3. Report per mode: status, runs, violations by check, flakiness rate, unchecked types, oracle coverage delta (N covered / 127).

## Gotchas

- **False-pass is the enemy, in both halves.** The oracle side is guarded by the independence rule + seeded-violation tests. The harness side has history: the typecheck gate itself once false-passed on this repo's space-containing path (fixed with quoting + a did-tsc-run guard in `scripts/typecheck-lumina.js`). If any check completes suspiciously fast or reads suspiciously clean, prove it can fail before trusting it.
- **Oracles check contracts, not quality.** A generation can pass every oracle and still be pedagogically weak, ugly, or mis-toned — that stays `/eval-test`'s and the user's job. Don't retire qualitative QA because the oracle is green.
- **Pilot-then-sweep applies to oracle-writing campaigns** (CLAUDE.md Verification Doctrine): when back-filling oracles across an archetype family, write ONE, prove it fires on seeded fixtures AND run it live, then fan out.
- **One oracle per componentId; modes share it.** Use the `modes` field only when a mode's data shape is genuinely unverifiable — and say so in the report.
- **This is the seed of pulse-agent v2** (synthetic student playing real content): the same oracle's `solve` answers challenges through `/api/problems/submit` with 2PL-driven correctness. Keep `verify` pure and data-in/verdict-out so that path stays open.

## Checklist

- [ ] Coverage checked; oracle written only after reading the COMPONENT's judging logic
- [ ] Independence rule honored — expected answer derived differently from the shipped key
- [ ] Registered in `CONTENT_ORACLES`; `uncheckedTypes` used for anything not checked
- [ ] Seeded-violation tests added and green (`npm test`) — every check class proven to fire
- [ ] Live runs: ≥5 per mode with a scope-bearing topic; tiers swept where wired
- [ ] Violations routed to `/eval-fix` with JSON evidence; flakiness rate reported
- [ ] `npm run typecheck:lumina` 0 errors; report includes coverage delta
---
name: oracle-test
description: >-
  Create and run deterministic content-contract QA oracles for Lumina primitives. Use when preventing answer-key desynchronization, scope violations, invalid generated values, or other generator contract regressions.
---
