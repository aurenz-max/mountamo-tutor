# Contract: comparison-builder

- **Derived:** 2026-07-16 · evidence window: reader-fit 2026-07-14/07-16 (Pulse walk), eval-reports 2026-03/06, topic-fidelity 2026-06-28, oracle registry, git log through `7cb5e5f`
- **Component:** `src/components/lumina/primitives/visual-primitives/math/ComparisonBuilder.tsx` · **Generator:** `src/components/lumina/service/math/gemini-comparison-builder.ts` · **Catalog:** `service/manifest/catalog/math.ts:2110`
- **Status:** ACTIVE (static derivation — no live census this run; refresh with `--census K` when the dev server is up)

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K PRE band — compare_groups ("count/tell number of objects up to 5/10") | reader-fit + live `--lesson` | `qa/reader-fit/comparison-builder-PRE-2026-07-14.md`; Pulse 2026-07-16 | 2026-07-16 |
| K PRE band — one_more_less, compare_numbers, order (same K math census) | reader-fit BACKLOG 2b | `BACKLOG.md` item 2b | 2026-07-16 |
| Grade-1 (EMERGING+) — all four modes, text-button answer surface | catalog `constraints` (1-20) + code (`gradeBand==='1'`) | component `renderCompareGroups` non-K branch | ongoing |
| Support-tier axis (config.difficulty easy/medium/hard) | structural-difficulty campaign | `1c3e774`; generator `resolveSupportStructure`/`resolveProblemShape` | 2026-07 |
| Misconception loop (primitive-scope) | misconception loop | `74a09f9`; `misconceptionScope: 'primitive'` + `DiagnosisEvidence` | 2026-07 |
| Oracle (content-contract QA) | oracle registry | `service/qa/oracles/comparison-builder.ts` | 2026-07 |

## Requirements

### R1 — compare-groups K answer surface is picture-primary tap=choose · OBSERVED
- **Property:** At `gradeBand==='K'`, compare-groups presents the two group PICTURES + a middle "=" as the tappable answer surface. No "More/Fewer/The Same" text buttons, no Check button; one tap both selects and evaluates. Grade-1 keeps text buttons + Check.
- **Demanded by:** K PRE compare_groups (reader-fit item 1b / 2 fix).
- **Evidence:** `comparison-builder-PRE-2026-07-14.md` Audit C rules 2/3/8 → PASS after fix; `ComparisonBuilder.reader-fit.test.tsx` 5/5.
- **Probe:** jsdom `ComparisonBuilder.reader-fit.test.tsx` — no text/Check buttons at K; tap-left(more)/tap-right(less)/tap-`=`(equal) auto-complete; wrong tap does not complete.

### R2 — tutor ORIENT/DISAMBIGUATE reads the question + names the specific comparison · OBSERVED
- **Property:** On each challenge start (`[PRIMITIVE SWITCH]`/`[ACTIVITY_START]`/`[NEXT_ITEM]`) the tutor reads the on-screen question aloud and NAMES the specific comparison for the active `challengeType`, answer-free, surviving the lesson one-sentence cap. The child is a non-reader; the catalog `aiDirectives` block is the durable carrier.
- **Demanded by:** all K PRE modes (live K failure 2026-07-13).
- **Evidence:** catalog `math.ts:2142` aiDirective; live `--lesson` 3/3 PASS `qa/tutor-reports/comparison-builder-live-lesson-2026-07-14.md`.
- **Probe:** `/tutor-test --probe comparison-builder` 0 findings + live `--lesson --eval-mode <mode>` — the question + a comparison word + a side/choice word are voiced; no answer word asserted.

### R3 — answer-free scaffold; no `{{correctAnswer}}` in a spoken line; no `{{#if}}` handlebars · OBSERVED
- **Property:** `scaffoldingLevels`/`taskDescription`/`aiDirectives` never interpolate the answer into a spoken script and never use `{{#if}}` (interpolate_template does key substitution only → conditionals render as literal junk).
- **Demanded by:** all consumers (pedagogy rule #1).
- **Evidence:** `comparison-builder-PRE-2026-07-14.md` Audit B answer-leak HIGH → gone; loop log P2/P3.
- **Probe:** `/tutor-test --probe` — no answer word in any resolved scaffold line; no literal `{{`.

### R4 — correctAnswer/correctSymbol computed from the actual quantities (code, never LLM) · OBSERVED
- **Property:** compare-groups `correctAnswer` and compare-numbers `correctSymbol` are recomputed in the generator from `leftGroup/rightGroup` counts and `leftNumber/rightNumber`. order ships no key (component sorts); one-more-one-less answer = target±1. No stored relation may disagree with its quantities.
- **Demanded by:** oracle (answer-key-desync), all consumers.
- **Evidence:** generator per-type validation (`gemini-comparison-builder.ts:641`); `service/qa/oracles/comparison-builder.ts` independence rule.
- **Probe:** `/oracle-test comparison-builder` — answer-key-desync 0 across draws.

### R5 — support tier (config.difficulty) drives scaffolding withdrawal + structural shape, NOT magnitude · OBSERVED
- **Property:** `difficulty` easy/medium/hard withdraws on-screen aids (count badges, correspondence lines, alligator mnemonic, number-line target marker, slot hints) and hardens structure (count-gap, digit-overlap, ask breadth, sort direction) within the SAME number band (K→10, 1→20). A harder tier never means bigger numbers. Data fields: `showCountBadges`, `correspondenceMode`, `useAlligatorMnemonic`, `showTargetMarker`, `showSlotHints`, `supportTier`.
- **Demanded by:** support-tier / structural-difficulty axis.
- **Evidence:** `1c3e774`; generator `resolveSupportStructure`/`resolveProblemShape`.
- **Probe:** generator draws per tier — magnitude band constant; withdrawal flags flip per tier.

### R6 — mastery-over-demo + evaluation submission · OBSERVED
- **Property:** ≥3 challenges per session (per-mode COUNT_BY_MODE = 5); evaluation submits via `useChallengeProgress` on completion with per-type accuracy metrics + a `DiagnosisEvidence` packet on failed sessions.
- **Demanded by:** oracle (schema ≥3), misconception loop, IRT.
- **Evidence:** oracle schema check; `advanceToNextChallenge` submit; `noteWrongAnswer` log.
- **Probe:** `/oracle-test` schema 0; jsdom completion reaches Next/submit.

### R7 — grade band is a CEILING; instruction never leaks the answer · OBSERVED
- **Property:** Generated numbers/counts stay within the grade band (K 1-10, G1 1-20); the instruction text names no answer (more/less/=, the sorted order).
- **Demanded by:** oracle (scope), grade-fidelity, pedagogy rule #1.
- **Evidence:** generator `maxNumber` clamps; prompt "Do NOT name or hint at any answer"; oracle scope check.
- **Probe:** `/oracle-test` scope 0; `/eval-test @ K` no leak.

## Conflicts

_None open._ (2026-07-16 chrome band-gate is COMPATIBLE — see changelog.)

## Gap requirements (close matches — the improvement queue)

### G1 — one_more_less / compare_numbers / order @ PRE not yet reader-fit complete · QUEUED in reader-fit 2b
- **Near-consumer:** K math census routes these three modes at K, but only compare_groups has the full PRE band-gate (Audit C). one_more_less shows up to 21 number cells (rule-4 load); order shows a direction badge text; compare_numbers shows the `< > =` symbol read.
- **Shortfall:** each needs its own tap/picture-primary pass + a symmetric DISAMBIGUATE (one_more_less voices "one more" but not "one less" — Pulse 2026-07-16).
- **Path:** band gate (component) + catalog directive → `/reader-fit --fix comparison-builder`.
- **Relation to R-series:** extends R1/R2 to the other three modes; no conflict.

## Catalog projection

- **description:** faithful as of 2026-07-16 ("four challenge types… ESSENTIAL for K-1 math"). No change.
- **constraints:** faithful (1-20, groups ≤10, order 3-5). No change.
- **evalModes:** faithful (compare_groups/one_more_less/compare_numbers/order with betas). No change.

## Changelog

- 2026-07-16 — derived (initial). 7 requirements, 0 conflicts, 1 gap (G1).
- 2026-07-16 — item 2b edit (K chrome band-gate + symmetric one_more_less DISAMBIGUATE + shared 🔊 Read-me). Assessed **COMPATIBLE**: band-gating `showCountBadges` OFF at all K tiers is *stricter than* the R5 tier lever (which only hid it at `hard`) and no consumer depends on K count badges being visible — the reader-fit Audit A already classified them as a count leak ("Supportive→leaks count"). R5's grade-1 behavior is untouched (band-gate keys on `gradeBand==='K'`, not on tier). R1 tap surface preserved (band-gate hides chrome, not the group pictures/`=`). R2 extended (one_less now voiced identically). No fork required.
