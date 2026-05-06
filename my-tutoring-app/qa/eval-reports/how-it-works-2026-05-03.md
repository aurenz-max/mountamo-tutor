# Eval Report: how-it-works — 2026-05-03

User-reported bug: "When I click a question after getting one wrong, it doesn't activate or allow selection." Screenshot showed Challenge 3 of 3 — "Why are nitrogen shocks important for a monster truck?" — with four options that did nothing on click.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| guided    | PASS   | — |
| sequence  | FAIL   | 1 |
| predict   | FAIL   | 2 |

## Issues

### predict — `explain`-type challenges are unselectable (matches user report)
- **Severity:** CRITICAL
- **What's broken:** [HowItWorks.tsx:386](my-tutoring-app/src/components/lumina/primitives/visual-primitives/core/HowItWorks.tsx#L386) — `handleMCAnswer` early-returns for any type other than `identify` or `predict`. But the render block at [HowItWorks.tsx:748](my-tutoring-app/src/components/lumina/primitives/visual-primitives/core/HowItWorks.tsx#L748) DOES include `explain` in the option-button render condition. Result: explain-type questions render four `<Button>` options, but clicking any of them returns silently — no selection state, no feedback, no advance. Student is stuck. The `predict` eval mode's `challengeTypes: ['predict', 'explain']` (catalog [core.ts:432](my-tutoring-app/src/components/lumina/service/manifest/catalog/core.ts#L432)) routinely produces explain challenges, so this hits in normal use. The user's screenshot ("Why are nitrogen shocks important...") is exactly an explain question.
- **Data:** `currentChallenge.type === 'explain'` → `handleMCAnswer` returns at line 386
- **Fix in:** COMPONENT — add `'explain'` to the allowed-types check on line 386.

### predict — validator pads with `identify` even when mode disallows it
- **Severity:** HIGH
- **What's broken:** [gemini-how-it-works.ts:322-331](my-tutoring-app/src/components/lumina/service/core/gemini-how-it-works.ts#L322-L331) — `validateHowItWorksData` pads `challenges` to a minimum of 3 with hardcoded `type: 'identify'`. The eval-test API confirmed this: predict mode (allowed: predict, explain) returned a third challenge of type `identify` with explicit validation error `Found disallowed types [identify] in challenges. Allowed: [predict, explain]`. The padded challenge is also boilerplate ("Which step involves the key transformation?" with options "Step 1, Step 2, Step 3, Step 4") which gives the student a trivial multiple-choice. In predict mode, this trivial identify question would be the only one playable today (since explain is broken — see HW-1).
- **Data:** generated `challenges[2] = { type: 'identify', question: 'Which step involves the key transformation?', correctIndex: 0 }`
- **Fix in:** GENERATOR — pad using a type from `evalConstraint.allowedTypes` instead of hardcoded `identify`, or skip padding when Gemini under-delivers and let the run fail loudly.

### sequence — sequence challenges generate with only 2 items and empty `correctOrder`
- **Severity:** HIGH
- **What's broken:** SP-14 variant. The schema has 5 nullable flat-indexed pairs (`sequenceItem0Id..sequenceItem4Id`/`Text`) and Flash Lite frequently drops most of them. Observed: a sequence challenge with `sequenceItems: [{id:'s0',...}, {id:'s4',...}]` (only 2) and `correctOrder: []` (empty CSV reconstruction). The component renders only 2 reorder rows, and `JSON.stringify(sequenceOrder) === JSON.stringify([])` is never true → the challenge cannot be marked correct. Generator validator ([gemini-how-it-works.ts:290-316](my-tutoring-app/src/components/lumina/service/core/gemini-how-it-works.ts#L290-L316)) accepts the sparse output without minimum-count validation.
- **Data:** challenge 1 of sequence-mode generation had `sequenceItems.length=2`, `correctOrder.length=0`
- **Fix in:** GENERATOR — after flat→nested reconstruction, reject any sequence challenge with fewer than 3 items or empty/mismatched `correctOrder`. Match the orchestrator-refactor pattern used for time-sequencer (SP-3) and dot-plot (DP-1) — splitting per-mode sub-generators with focused, all-required schemas would structurally eliminate this.

## Secondary observation (not flagged)

In one predict-mode generation, both Gemini-authored MC challenges (predict + explain) returned `correctIndex: 0` while the explanation pointed at a different option. In a separate sequence-mode generation, both identify challenges had a correct `correctIndex` matching the explanation. Single-sample evidence of "always picks 0" is too thin to call systemic — re-test after HW-1 is fixed.

## Visual Check

Open MathPrimitivesTester in the app, select **how-it-works** mode **predict**, click Generate, scroll to the challenges and click any option on an `explain`-typed question. Confirm: nothing happens (no highlight, no feedback, no "Next Challenge" button appears). After fix, the option should highlight and the feedback panel should render.
