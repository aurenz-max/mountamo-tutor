# Contract: fast-fact

- **Component:** `primitives/visual-primitives/core/FastFact.tsx` ·
  **Domain:** `primitives/visual-primitives/core/fastFactWorkspace.ts` ·
  **Generator:** `service/core/gemini-fast-fact.ts` ·
  **Oracle:** `service/qa/oracles/fast-fact.ts` ·
  **Live adapter:** `components/live-activity/adapters/fastFactLive.ts` ·
  **Catalog:** `service/manifest/catalog/core.ts` (`id: 'fast-fact'`)
- **Status:** ACTIVE. Seeded 2026-10-09 by the W1 workspace binding; not a full `/primitive-contract` derivation.

## Requirements

### R1 — untimed · OBSERVED
- **Property:** no countdown, deadline or speed wording on screen or from the tutor. Response time is measured
  silently on the scripted path only (`isFast`, the automaticity metric); the workspace path publishes no time and
  nothing advances or grades on a clock.
- **Demanded by:** user ruling "no timer on fact fluency"; catalog `constraints`.
- **Probe:** `FastFact.workspace.test.tsx` "nothing advances or grades on a clock".

### R2 — exactly one choice credits; no visual or stem carries the answer · OBSERVED
- **Property:** `isAnswerCorrect` credits one option; the visual is a different representation from the answer.
- **Probe:** `gemini-fast-fact.answer-leak.test.ts`, oracle `fast-fact`; the live adapter refuses an item where
  zero or two choices credit.

### R3 — a try that continues shows no answer · OBSERVED 2026-10-09
- **Property:** the answer and explanation appear only when the scripted drill gives up on a challenge
  (`maxAttemptsPerChallenge` reached). Before 2026-10-09 the first wrong tap printed "The answer is X" and then
  allowed a second try. With the tutor, a wrong tap shows "Not quite." and never the answer.
- **Probe:** `FastFact.workspace.test.tsx` (every mode); sweep J3.

### R4 — shared teaching workspace (W1, plain shape) · OBSERVED 2026-10-09
- **Property:** with a catalog `teachingWorkspace`, the tutor owns the lesson: no Start screen, each tap commits a
  checked gesture with a named miss (`fastFactMiss`), the runtime owns progression (no Next button, no scripted
  `sendText`, `useLuminaAI` disabled), choices close until Try again, and evaluation submits only under a lesson's
  provider. The packet carries the question and the choices as shown, never `correctAnswer`, `acceptableAnswers`,
  `explanation`, or a counting picture's count.
- **Probe:** `FastFact.workspace.test.tsx`; journey sweep on `runtime/testing/w1-payloads/fast-fact.*.json`; tutor
  replay `qa/tutor-reports/replay/fast-fact-2026-10-09-r2.json`.
- **Scripted path:** `withWorkspaceController` keeps `useScriptedProgress` and the catalog `tutoring` block for
  mounts without a workspace binding.

### R5 — levers that never draw or say the answer · OBSERVED 2026-10-09
- **Property:** workspace path only (`fastFactLevers.ts`). `spread_pictures` redraws a counting picture one glyph per
  box with no numeral (`spreadLeak`: numeric key, a counting question, one repeated glyph, at most 20).
  `count_model` draws a sum as two groups in two colors, a difference with the taken dots hollow, a product as rows,
  no numeral, never the result as one group (`modelLeak`: the key must be that expression's value, whole numbers, at
  most 30 dots). `drop_far_choice` greys out an untried wrong choice only while two untried choices remain after it,
  so it never leaves the answer alone. Scene facts name the question's own numbers and a greyed-out choice, never the
  key or a total. A pull records the lever on the next attempt (assisted).
- **Probe:** `fastFactLevers.test.ts`, `FastFact.levers.workspace.test.tsx`, sweep J12/J13.

## History
- 2026-10-09 — seeded with the W1 binding; R3 fixed on the scripted path in the same slice. R5 levers added.
