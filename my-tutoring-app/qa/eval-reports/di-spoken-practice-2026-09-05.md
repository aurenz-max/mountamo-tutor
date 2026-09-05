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
