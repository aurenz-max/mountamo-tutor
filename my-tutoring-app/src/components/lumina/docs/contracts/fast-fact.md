# Contract: fast-fact

- **Component:** `primitives/visual-primitives/core/FastFact.tsx` ·
  **Domain:** `primitives/visual-primitives/core/fastFactWorkspace.ts` ·
  **Generator:** `service/core/gemini-fast-fact.ts` ·
  **Oracle:** `service/qa/oracles/fast-fact.ts` ·
  **Card + boss:** `primitives/visual-primitives/core/fastFact.card.ts` + `fastFact.boss.ts` (`bossAdapter`, `bossJourney`) ·
  **Levers:** `primitives/visual-primitives/core/fastFactLevers.ts` (`FAST_FACT_LEVERS`) ·
  **Catalog:** `service/manifest/catalog/core.ts` (`id: 'fast-fact'`)
- **Status:** ACTIVE. Seeded 2026-10-09 by the W1 workspace binding; not a full `/primitive-contract` derivation.

## Requirements

### R1 — untimed · OBSERVED
- **Property:** no countdown, deadline or speed wording on screen or from the tutor. Nothing measures response time
  (the scripted path and its silent `isFast` metric are gone, 2026-10-19), the summary shows no duration, nothing
  advances or grades on a clock, and every item's scene says there is no timer.
- **Demanded by:** user ruling "no timer on fact fluency"; catalog `constraints`.
- **Probe:** `FastFact.workspace.test.tsx` "nothing advances or grades on a clock".

### R2 — exactly one choice credits; no visual or stem carries the answer · OBSERVED
- **Property:** `isAnswerCorrect` credits one option; the visual is a different representation from the answer.
- **Probe:** `gemini-fast-fact.answer-leak.test.ts`, oracle `fast-fact`; the boss's `validate` refuses an item where
  zero or two choices credit.

### R3 — a try that continues shows no answer · OBSERVED 2026-10-09, re-based 2026-10-19
- **Property:** a wrong tap shows "Not quite." and never the answer or the explanation; nothing reveals it (the
  scripted drill's give-up reveal went with the scripted path, 2026-10-19).
- **Probe:** `FastFact.workspace.test.tsx` (every mode); sweep J3.

### R4 — shared teaching workspace, on a boss · OBSERVED 2026-10-09, re-based 2026-10-19
- **Property:** taught only on the workspace (`withWorkspaceOnly`; an unbound mount shows the shared "needs the
  tutor" card): no Start screen, each tap commits a checked gesture with a named miss (`fastFactMiss`), the runtime
  owns progression (no Next button, no `useLuminaAI`), choices close until Try again, and evaluation submits only under
  a lesson's provider. The packet carries the question and the choices as shown, never `correctAnswer`,
  `acceptableAnswers`, `explanation`, or a counting picture's count; the key reaches the observer only as the spoken
  key (`factKey`) on a keyed item.
- **Per item (every mode SAY_OR_SHOW):** every choice sayable → a key (a menu key when the question says every
  choice); a picture or symbol choice, or a question that names its own answer beyond its operands → no key, the
  gesture assignment, played by the harness's `show` tap.
- **Probe:** `FastFact.workspace.test.tsx`; `boss.test.ts` (ask-leak gate over `runtime/testing/w1-payloads/fast-fact.*.json`);
  journey sweep; tutor replay `qa/tutor-reports/replay/fast-fact-2026-10-09-r2.json` (pre-boss).

### R5 — levers that never draw or say the answer · OBSERVED 2026-10-09
- **Property:** one lever set (`FAST_FACT_LEVERS`: `spread_pictures` layout, `count_model` custom, `drop_far_choice`
  custom). `spread_pictures` redraws a counting picture one glyph per
  box with no numeral (`spreadLeak`: numeric key, a counting question, one repeated glyph, at most 20).
  `count_model` draws a sum as two groups in two colors, a difference with the taken dots hollow, a product as rows,
  no numeral, never the result as one group (`modelLeak`: the key must be that expression's value, whole numbers, at
  most 30 dots). `drop_far_choice` greys out an untried wrong choice only while two untried choices remain after it,
  so it never leaves the answer alone; a wrong answer said aloud counts as one choice tried (`wrongs`). Scene facts name the question's own numbers and a greyed-out choice, never the
  key or a total. A pull records the lever on the next attempt (assisted).
- **Probe:** `fastFactLevers.test.ts`, `FastFact.levers.workspace.test.tsx`, sweep J12/J13.

## History
- 2026-10-09 — seeded with the W1 binding; R3 fixed on the scripted path in the same slice. R5 levers added.
- 2026-10-19 — moved onto the boss framework (wave 2). Scripted path, `tutoring` block, `adapters/fastFactLive.ts`
  and the hand Pip surface deleted; R1, R3 and R4 re-based from the scripted path onto the workspace; R1 now also
  drops the silent response-time metric and the summary's duration.
