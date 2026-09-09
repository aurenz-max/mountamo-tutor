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

### R8 — compare-groups counts are code-rolled, distinct, and include an equal case · OBSERVED
- **Property:** The two group counts come from a pool rolled in code per generation and injected into the prompt — never invented by the model. Magnitude stays inside the range the OBJECTIVE names — resolved through the shared Tier-2 micro-call (`resolveScopeRange`, `{min,max}` schema over topic/intent/objective) with the grade band as the OUTER ceiling (K 1-10, G1 1-20); a lesson that names no range keeps the band. The gap comes from the tier (R5), refitted downward when a window is too narrow to supply a session's worth of distinct pairs, so the two axes stay separate and scope outranks structure. Every session includes at least one equal pair wherever the tier allows one (withheld at `hard`, which excludes gap=0 by contract), orientation is rolled so the key is not "more" every time, and no two comparisons in a session use the same pair of counts — a repeat is reassigned to an unused pooled pair. The grade band itself comes from `config.gradeBand` → `ctx.grade` → grade prose, never from the model.
- **Demanded by:** K `COUNT001-03-A` + `MEAS001-02-B` (atlas finding CB-4: the same five comparisons — 5v1, 1v4, 3v3, 1v5 — across two objectives and two draws, only the objectType changing).
- **Evidence:** `gemini-comparison-builder.ts` (`buildCountPairPool`, `pickUnusedPair`, the distinct-problem gate); `gemini-comparison-builder.variety.test.ts` 7/7; five live `eval-test` draws 5/5 distinct each.
- **Probe:** two `/api/lumina/eval-test?componentId=comparison-builder&evalMode=compare_groups&grade=K` draws — pairs differ between draws, one equal case per session, every count inside the objective's range (the band when it names none).

## Conflicts

_None open._ (2026-07-16 chrome band-gate is COMPATIBLE — see changelog.)

## Gap requirements (close matches — the improvement queue)

### G1 — one_more_less / compare_numbers / order @ PRE not yet reader-fit complete · BUILT 2026-07-20 (item 2b tail)
- **Near-consumer:** K math census routes these three modes at K, but only compare_groups has the full PRE band-gate (Audit C). one_more_less shows up to 21 number cells (rule-4 load); order shows a direction badge text; compare_numbers shows the `< > =` symbol read.
- **Shortfall:** each needs its own tap/picture-primary pass + a symmetric DISAMBIGUATE (one_more_less voices "one more" but not "one less" — Pulse 2026-07-16).
- **Path:** band gate (component) + catalog directive → `/reader-fit --fix comparison-builder`.
- **Relation to R-series:** extends R1/R2 to the other three modes; no conflict.
- **Built (2026-07-20):** compare_numbers @ K → tap the BIGGER numeral + middle "=" (K.CC.C.7 compare-written-numerals; no `< > =` buttons, no alligator, no Check); order @ K → wordless graduated-bar direction cue (text badge Grade-1 only); one_more_less @ K → 5-cell window centered on the target (down from up to 21) + wordless ⬆/⬇ row headers + tap=choose. Rule-5: wrong taps shake the touched object (group/numeral/cell), text card hidden at K (SFX + spoken hint carry it). Report: `qa/reader-fit/comparison-builder-PRE-2b-tail-2026-07-20.md`.

## Catalog projection

- **description:** faithful as of 2026-07-16 ("four challenge types… ESSENTIAL for K-1 math"). No change.
- **constraints:** faithful (1-20, groups ≤10, order 3-5). No change.
- **evalModes:** faithful (compare_groups/one_more_less/compare_numbers/order with betas). No change.

## Changelog

- 2026-09-09 — R8 AMENDED for atlas CB-5 (`/eval-fix`): the pooled counts now sit inside
  the range the objective names, not just the grade band. The 09-09 K redraw found
  COUNT001-03-A and MEAS001-02-B ("groups of UP TO 5") shipping 5v9, 10v4, 3v8 — the pool
  was anchored on the band and nothing read the objective. The window comes from the
  SHARED `resolveScopeRange` micro-call (not a regex — [[schema-over-regex-and-prompt]]
  rule 1; it reads the 6-10 FLOOR in COUNT001-03-B that a ceiling-only parse cannot), and
  the band remains the outer clamp, so a lesson naming no range is byte-identical to
  before. Assessed **COMPATIBLE**: R4 still recomputes every key from the shipped counts;
  R7's band ceiling is unchanged and now strengthened by a tighter objective clamp; R6
  counts untouched. The ONE tension is R5 — a window narrower than the tier's gap (1-5
  holds three pairs three-or-more apart, one short of a five-challenge session) now
  relaxes the GAP rather than the window, because leaving the window would break both the
  objective and "N challenges = N problems". Magnitude never widens for a tier, which is
  what R5 exists to protect. Verified on real generations (vite module-runner drive, the
  dev server being wedged by another session): A ×2 + MEAS 1-5, B easy+medium 6-10, all
  5/5 distinct with an equal case, no-window K still 1-10. 14/14 focused tests,
  `typecheck:lumina` clean for this file.
- 2026-09-08 — R8 added for atlas CB-4 via `/add-number-pool-service` (counts pooled
  in code, one guaranteed equal case, repeats reassigned). Assessed **COMPATIBLE**:
  R4 still recomputes every answer from the shipped counts, R5's tier levers are
  unchanged and the gap-enforcement pass now LEAVES a gap that already satisfies the
  tier (it used to pin every gap to the maximum, which was itself throwing away
  variety), R6 counts are untouched, R7 is strengthened — the band was being taken
  from Gemini, so a `grade=K` run shipped band 1 and rolled 19v15; it now reads
  `ctx.grade` (already normalized by `resolveGenerationContext`). Focused 7/7, Lumina
  typecheck 0. Residual: the other three modes still let the model pick its numbers.
- 2026-07-16 — derived (initial). 7 requirements, 0 conflicts, 1 gap (G1).
- 2026-07-16 — item 2b edit (K chrome band-gate + symmetric one_more_less DISAMBIGUATE + shared 🔊 Read-me). Assessed **COMPATIBLE**: band-gating `showCountBadges` OFF at all K tiers is *stricter than* the R5 tier lever (which only hid it at `hard`) and no consumer depends on K count badges being visible — the reader-fit Audit A already classified them as a count leak ("Supportive→leaks count"). R5's grade-1 behavior is untouched (band-gate keys on `gradeBand==='K'`, not on tier). R1 tap surface preserved (band-gate hides chrome, not the group pictures/`=`). R2 extended (one_less now voiced identically). No fork required.
- 2026-07-20 — item 2b TAIL edit (rule-5 feedback-on-object at K + per-mode PRE picture passes for compare_numbers / order / one_more_less). Assessed **COMPATIBLE** — a band+mode fork keyed on `gradeBand==='K'`, never on tier; it BUILDS gap G1. Other-consumer probes held: R1 compare-groups tap surface unchanged (added only a shake class on wrong taps); R5 Grade-1 tier levers untouched (K gates are band-scoped — the alligator/count-badge/target-marker/slot-hint tier withdrawal still applies at Grade-1); R4/R7 generator untouched; R6 K taps still record + submit on completion; R2 directive reworded compare-numbers answer-free ("tap the bigger number"), keys unchanged. R3 no handlebars/answer added. Verified: `typecheck:lumina` 0, full vitest **857/857**, `ComparisonBuilder.reader-fit.test.tsx` **25/25**. Check report: `qa/primitive-contracts/comparison-builder-check-2026-07-20.md`. No fork ladder needed (K presentation is the fork). Residual: live `--lesson` + browser pixel → HUMAN-CHECKS.
