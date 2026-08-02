# HANDOFF — reader-fit 14f: knowledge-check @ EMERGING (Grade 1) — modality/reading-load audit

Written by `/pm` 2026-08-01, after 14e landed (precise `ctx.grade` is now available at the
generator boundary — this audit was deliberately sequenced behind it). Owning queue:
`my-tutoring-app/qa/reader-fit/BACKLOG.md` item **14f**. Executors: `/primitive-contract` (derive,
REQUIRED first) → audit → `/eval-fix` / `/reader-fit --fix`.

## Paste-able prompt

> Audit knowledge-check at the EMERGING (Grade 1) band — reader-fit BACKLOG 14f. It is the
> census's most-routed primitive (6/42, in every census lesson): scope holds almost everywhere,
> but Grade-1 MODALITY fails where it matters — map-symbol matching becomes reading descriptions
> of pictures, and an `analyze` draw promised picture support but emitted long text-only
> multi-clause tasks. Read `qa/HANDOFF-reader-fit-14f-knowledge-check-emerging-2026-08-01.md`
> first. **Contract-first is REQUIRED: `docs/contracts/knowledge-check.md` does not exist yet —
> derive it before any edit.**

## Census evidence (all six saved topics, 2026-08-01 traces)

| Topic (report `qa/topic-traces/g1-<t>-2026-08-01.md`) | Mode | Verdict |
|---|---|---|
| map-legends | `mixed` | **PARTIAL** — symbol matching is text-description-primary rather than interpreting rendered symbols |
| invention-listening | `analyze` | **READER-FIT FAIL** — promised picture support; generated long, text-only multi-clause analysis/matching |
| silent-e | `mixed` | scope OK — but six text-primary problems (reading-load data point) |
| common-nouns | `mixed` | scope OK — six aligned text problems |
| count-forward-to-120 | `mixed` | healthy (values through 115, aligned tasks) |
| identical-coins | `recall\|apply` | healthy (small totals through 30¢) |

The pattern: **content scope is fine; the failure axis is Grade-1 reading load and missing visual
modality** — clustered where the task itself is visual (symbols, pictures).

## Contract-first (this is the audit's first deliverable)

`docs/contracts/knowledge-check.md` does not exist, knowledge-check is the highest-frequency
routed primitive, and the PARKED contracts queue already lists it (item #2, wanted "before
`true_false @ PRE` lands"). Derive via `/primitive-contract knowledge-check`, then run `--check`
against every edit. Requirements the derivation must capture (all live consumers):

- The **K/PRE treatment**: picture-primary MCQ + read-aloud + the K type-floor. Must not be
  ablated by G1 changes — and must NOT be copied wholesale to G1 either (queue text is explicit).
  An EMERGING reader reads short sentences; the fix is calibrated reading load plus picture/visual
  insets where the TASK is visual, not picture-primacy everywhere.
- **Voice control** on MCQ/TF (committed pilot, viewport-gated) — don't ablate.
- **Composite advance gate**: knowledge-check stamps `::pN` instance eval ids; regressing this
  soft-locks the K stage.
- **Final-assessment orchestration**: 14e now stamps `objectiveGrade` + per-objective grade
  fallbacks into the final-assessment config (`flattenManifest.ts`) — the generator receives a
  precise grade there too.

## Audit axes (from the queue item, in order)

1. **Grade consumption:** `gemini-knowledge-check.ts` derives structural load from the BAND
   (see the comment near `:155` referencing `normalizeGradeLevel`). With 14e landed, `ctx.grade`
   is `'1'` — decide where precise grade should gate reading load (sentence length, clause count,
   distractor text) instead of the band's "grades 1-5" blur.
2. **Mixed-mode selection:** which types `mixed` draws at G1 and whether the mix respects the
   band (the invention `analyze` draw is the worst case — long multi-clause analysis/matching).
3. **Visual insets:** when the stimulus is inherently visual (map symbols, coins, pictures), the
   problem must render the visual and ask about IT — not describe it in text. This is the
   map-legends failure. Check what the schema/component can already render before inventing new
   fields (schema-over-prompt; flash-lite rules: answer TEXT over index, bounded arrays, 3-4
   types max).

## Scope boundary

Same-trace findings in OTHER primitives (fast-fact `gradeBand: 3-5`, deep-dive generic prose,
flashcard padding = 14l, blueprint-canvas chrome) stay in their own queue items — do not fix them
here. DI items belong to the DI stream (14g).

## Gates

- Contract derived + `--check` on the edit — COMPATIBLE or a recorded deliberate fork.
- `npm run typecheck:lumina` 0; full `npm test` green; non-vacuous new tests.
- Real-Gemini `/eval-test`: the failing shapes (`analyze` @ G1, `mixed` on a map-symbol topic)
  plus a K regression (picture-primary floor + type-floor intact).
- Replay the two failing census topics via `/topic-trace` and show the verdicts flip.
- Report `qa/reader-fit/knowledge-check-14f-<date>.md`; strike 14f with evidence; pixel/feel →
  HUMAN-CHECKS (next free ID = **59**); WORKSTREAMS "last touched" in the same slice.

## Collision discipline

The DI stream may be running its next ladder rung concurrently (file-disjoint). No other
reader-fit session is expected, but the standing rule holds: re-read shared registers
(`BACKLOG.md`, `WORKSTREAMS.md`, `EVAL_TRACKER.md`, `HUMAN-CHECKS.md`) immediately before
editing; commit contract + fix + strike as one tight slice.
