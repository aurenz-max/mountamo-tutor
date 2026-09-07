# Eval Report: di-spoken-practice — 2026-09-05

**Filed by `/lesson-coverage` item 21** (`qa/lesson-bench/BACKLOG.md`), not a direct `/eval-test` curl — the
component has no eval-test tester wiring of its own; these came from a real assembled lesson
(`kindergarten-addition-20260905190456-xr70`, objective "Identify the plus sign (+) and equal sign (=) as math
symbols") plus a follow-up runtime probe of the generator in isolation (Vite SSR module runner, 3 live calls,
same objective text, `targetEvalMode: 'read_aloud'` — see the Data lines below).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| read_aloud | FAIL | 2 |
| say_answer | not probed | — |
| count_and_say | not probed | — |

## Issues

### read_aloud — Named-set element dropped (DSP-1)
- **Severity:** HIGH
- **What's broken:** The objective names a closed 2-element set ("the plus sign (+) **and** equal sign (=)").
  All 5 generated items asked about "+"; zero asked about "=". The prompt had a NUMBER_SEEDS section forcing
  numeric variety but nothing analogous for a small named symbol/word set, so the model defaulted to whichever
  element felt most central to the topic ("addition" → "+") every time.
- **Data:** live package `obj2-symbol-spotter` items: `dsp-1..5` all `{stimulusText: "+", expectedAnswer: "plus"}`
  or `"plus sign"`; none target `"="`.
- **Fix in:** GENERATOR — **partial fix landed same-slice.** Added a named-set-coverage rule to
  `gemini-di-spoken-practice.ts`'s prompt ("every named element must get at least one item before any element
  repeats"). Re-probed live 3×: `run1: +,+,+,+ (no =)` · `run2: +,+,=,= (COVERS BOTH)` · `run3: +,+,+,+ (no =)` —
  **1/3, up from 0/3.** flash-lite still ignores the rule most of the time; this is a real but incomplete fix.
  tsc 770 (baseline 802, 0 new). Not yet re-confirmed end-to-end on a full assembled lesson — 3 fresh
  `topic-trace` reruns on the same frozen objectives didn't re-select `di-spoken-practice` for obj2 at all
  (curator picked `concept-card-grid`/`foundation-explorer`/`equation-builder` instead), so `confirm` is owed
  once a run lands back on this generator.

### read_aloud — Eval-mode identity mismatch for symbol/word-naming objectives (DSP-2)
- **Severity:** HIGH (n=1, needs a probe across more objectives before the rate is asserted)
- **What's broken:** `read_aloud`'s own catalog contract (`di.ts`): *"the printed stimulus IS the utterance — the
  child reads it aloud. Decoding, not recall."* — i.e. `stimulusText` and `expectedAnswer` should be the SAME
  text. But "identify/name a symbol" is recall, not decoding: the model is asked to make `stimulusText` ("+")
  and `expectedAnswer` ("plus") deliberately DIFFER, which fights the mode's own prompt section
  ("`stimulusText` is the exact text the child reads and `expectedAnswer` is that same text"). On one live "="
  item the model broke down under the contradiction and emitted `stimulusText: "_"` instead of "=" — a printed
  stimulus the child cannot even name. `say_answer`'s contract — *"the child meets a stimulus and produces a
  spoken answer they were not shown — the recall workhorse"* — is the identity-correct fit and does not force
  stimulus/answer to match.
- **Data:** run 2 (the "=" items): `{stimulusText: "_", expectedAnswer: "equal sign"}` and
  `{stimulusText: "_", expectedAnswer: "equal"}` — the underscore is not a rendering artifact, it is what the
  model wrote for `stimulusText`.
- **Fix in:** CATALOG + resolver. The eval-mode RESOLVER (`resolveEvalModes` reading `di.ts`'s `evalModes[]`
  descriptions) picked `read_aloud` for this objective; it should prefer `say_answer` whenever the objective's
  verb is "identify/name" a printed symbol rather than "read" printed text. This resolver path is shared by
  every `di-spoken-practice` call, so the fix needs a probe across 2-3 more symbol/label-naming objectives
  (not just this one) before touching it — do not patch on n=1. Not started.

## Product Decision

None yet — both issues are GENERATOR/CATALOG fixes, no product ruling needed. DSP-2 may surface a rule worth
generalizing to other DI-family multi-mode packs (`di-math-facts`, `di-letter-sounds`) if the probe finds the
same identity-mismatch shape elsewhere; that would earn a new Systemic Pattern, not yet warranted at n=1.

## Follow-up implementation and runtime retest — 2026-09-05

**DSP-1 and DSP-2 resolved for the reported task.** Visual naming is `say_answer`, with a displayed target,
an answer-free question, and no pronunciation shortcut. Required targets are interpreted once, independently
reviewed, and allocated in code before repetition. Source token IDs preserve exact printed glyphs; the model
does not rewrite `=` per item. Stimulus, answer, alternatives, correction, and private judging cue share the
same checked mapping. After item gates, an incomplete planned session is refused rather than shipped thin.

Catalog descriptions now distinguish naming from decoding inside the lesson selector's 160-character window.
The shared resolver was not changed. Explicit incompatible pins are refused, not silently reclassified;
the planner can choose a coherent mode within an allowed blend or unconstrained request.

Source tracing corrected the original causal claim: the saved manifest already pins `read_aloud`, and the
three original isolated probes explicitly supplied that pin. They bypassed the generator's automatic selector.
The saved package alone does not establish which upstream stage originally wrote the bad pin.

### Evidence, including failed implementation passes

[Development logs](di-spoken-practice-2026-09-05-development.log) preserve planning refusals, retries,
gate rejection counts, and selector decisions across all five passes.

| Pass | Result and resulting change |
|---|---|
| [First planner](di-spoken-practice-2026-09-05-retest.json) | Direct glyph/quote emission still corrupted `=` or its grounding; all three original-objective draws were empty. Replaced copying with selection of code-owned source token IDs. |
| [Token references](di-spoken-practice-2026-09-05-retest-v2.json) | Original naming 3/3 and saved slot passed; reviewer incorrectly rejected open arithmetic/counting plans. Clarified task-plan versus generated-session contracts. |
| [Review contract](di-spoken-practice-2026-09-05-retest-v3.json) | Original naming 2/3; a wrong planner mode was refused. Moved mode compatibility into the bounded planning retry. Manual content review also found arithmetic scope drift, filed below as DSP-3. |
| [Retry path](di-spoken-practice-2026-09-05-retest-v4.json) | Original coverage 1/3: Flash Lite recast naming as generic recall, and its review approved the empty plan, reopening all-`+` output. Changed semantic planning/review to `gemini-flash-latest`, the repository's existing judging tier. |
| [Final implementation](di-spoken-practice-2026-09-05-retest-v5.json) | All final mechanical checks passed. Original naming 3/3, punctuation naming 1/1, paraphrase 1/1, named word/numeral reading 2/2, arithmetic/counting 2/2, and wrong-pin refusal 1/1. |

Final automatic **lesson-level** routing: 7/7 intended modes across three naming objectives and four reading,
arithmetic, and counting controls. The saved full manifest, including its sibling components and original
`read_aloud` pin, was re-resolved: `obj2-symbol-spotter` changed to `say_answer`, then ran through its production
context-native registry dispatch with objective config. It returned four valid items covering `+` and `=`.
This verifies saved-slot selection/hydration, not a newly assembled full lesson or a microphone sitting.

Final named plans used their first attempt. The deliberately incompatible pin exhausted its two attempts and
returned empty, as required. The final arithmetic draw kept 3/4 items (one existing gate rejection); counting
kept 4/4. Independent inspection confirmed the final arithmetic sums and counts stayed within five and that
the displayed naming symbols had correct names/alternates. The 66-second final matrix is a small sample,
not a reliability-rate estimate. Earlier failures remain recorded above.

**Offline verification:** 56/56 focused tests, including missing-target reviews, the generic-plan bypass,
corrupted copied glyphs, post-filter coverage loss, exhausted retries, incompatible and blended pins, numeral
normalization, and rendered stimulus/answer visibility and pronunciation controls. Model responses are mocked
in those tests; the JSON artifacts above contain actual model output. No live audio judgment was exercised.

**Type check:** final whole-project check matches the 770-diagnostic baseline exactly, with no new diagnostics.
An intermediate check briefly had 771 due to a concurrent `phonemeExplorerScript.ts` change outside this task;
that unrelated delta was gone by the final check.

### Remaining finding: say_answer numeric scope (DSP-3)

- **Severity:** HIGH, observed in one of the earlier live draws; frequency unmeasured.
- **Evidence:** `retest-v3.json`, `listening-arithmetic`, objective "Listen to addition facts within five and
  say the sum." Accepted facts included `3 + 3 → six`, `3 + 4 → seven`, and `2 + 5 → seven`.
- **Boundary:** the existing arithmetic gate checks the fact against its answer; it does not verify the
  objective's range. The initial probe's mechanical checks missed this; inspecting the actual values caught it.
- **Status:** open. The final draw stayed in range but does not retire this earlier counterexample. The numeric
  generation path needs its own source-grounded range contract and baseline probe; introduced-versus-existing
  rate was not established here. Executor: `/eval-fix DSP-3`.

Current mode status: `read_aloud` PASS on reading controls, `count_and_say` PASS on the sampled counting task,
`say_answer` naming PASS but overall FAIL while DSP-3 remains open. Original report and results above are historical.

### Workflow lessons applied

The repository eval-fix skill now calls out source references instead of model copying, validating empty/open
plans as well as enumerated ones, calibrating the semantic reviewer on valid and invalid inputs, and measuring
usable-session yield. A second model call or an all-empty result is not itself evidence of a robust repair.
