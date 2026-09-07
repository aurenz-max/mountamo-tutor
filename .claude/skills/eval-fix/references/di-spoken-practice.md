# Case: di-spoken-practice, 2026-09-05

Source: `my-tutoring-app/qa/eval-reports/di-spoken-practice-2026-09-05.md`.
This is a source review and repair design, not a claim that DSP-1/DSP-2 are fixed.

## Observations and limits

- The saved lesson's `obj2-symbol-spotter` asks only about `+`, although the
  objective names `+` and `=`. Its manifest config pins `read_aloud`.
- The report records three subsequent generator calls explicitly pinned to
  `read_aloud`. A new coverage prompt rule yields coverage in 1/3 draws.
- That covering draw contains `_` stimuli with answers naming the equal sign.
  Coverage of answer labels alone therefore does not establish usable coverage.
- The mode contract describes `read_aloud` as decoding printed text. Naming a
  displayed mathematical symbol requires retrieving its name.

The generator's `resolveEvalModes` returns immediately for a recognized explicit
pin. These three calls cannot establish the error rate of automatic selection.
The saved manifest confirms an upstream pin but does not alone identify which
selector wrote it. Inspect `service/manifest/resolveLessonEvalModes.ts`, curator
inputs, and available routing evidence before blaming the generator's resolver.
The contradiction may contribute to malformed stimuli; its causal role in `_`
emission needs an experiment rather than assertion.

## Contracts that a repair must reconcile

Read these under `my-tutoring-app/src/components/lumina/`:

- `service/direct-instruction/gemini-di-spoken-practice.ts`: mode docs, schema,
  `buildPrompt`, `buildItem`, filtering, and retry loop.
- `service/manifest/catalog/di.ts` and `service/evalMode/index.ts`: candidate task
  identities and explicit-pin versus automatic behavior.
- `primitives/visual-primitives/direct-instruction/diSpokenPracticeScript.ts`:
  `MODE_SHAPE`, normalization, leak detection, and `findUnspokenStimulus`.
- `primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx`:
  `renderStimulus` and the script/runner consumer.

Switching to `say_answer` addresses the catalog-level task identity, but its
current prompt/schema say the tutor must speak the problem and must not merely
point to the screen. For symbol naming, the visible symbol IS the problem and
speaking its name gives away the answer. The contract must distinguish visual
naming from listening/arithmetic recall. Establish whether existing fields can
express that distinction consistently before proposing a new mode or config.

`findUnspokenStimulus` tokenizes text into alphanumeric tokens. A punctuation-only
symbol contributes no tokens, so this check cannot establish whether that visual
task is coherent. Conversely, `read_aloud` classifies response shape without
checking that the expected answer actually represents the printed reading.
Neither returning no gate issues nor stamping a valid mode establishes task fit.
Do not turn the report's literal equality shorthand into a blanket string-equality
guard: existing normalization supports printed digits and spoken number words.

The generator retries only while zero items survive. A nonempty session that
omits a required target exits that retry loop. Item-validity filters do not
enforce session coverage.

## Repair design to investigate

1. Probe automatic routing on several visual-naming objectives and nearby true
   reading/listening objectives. Compare with explicit pins and inspect the
   lesson-level selection path. Preserve explicit-pin semantics.
2. Reconcile task identity and stimulus delivery in the owning catalog/prompt/
   contract. Changing a shared resolver requires evidence beyond this one case.
3. Establish the required target set from trustworthy objective data. Allocate
   slots across that set and keep target identity tied to the displayed stimulus,
   expected name, alternates, correction, and judging rules. LLM-written questions
   can vary around the target; do not ask it to reinvent membership on every item.
4. Verify coverage after all item gates. Use bounded repair/retry or an explicit
   incomplete outcome when valid required coverage cannot be produced. Replacing
   `_` with `=` or cycling two hardcoded symbols does not solve the general case.

Check whether DSP-1 remains under a coherent mode: these two findings may interact,
but correcting routing does not itself guarantee complete target coverage.

## Useful verification cases

- Original `+`/`=` objective: both symbols actually displayed with correct names,
  a question that does not reveal the name, and usable session length.
- Another supported closed visual-naming set: tests membership/coverage beyond
  the original literals, with an independently checked interpretation.
- Reworded/reordered objective: same task despite different keywords/order.
- Printed word reading and printed numeral reading: legitimate decoding survives,
  including the existing digit-to-word answer normalization.
- Listening recall/arithmetic and counting: their information delivery, hidden
  answers, and task identities survive the change.
- A required target rejected late, partial output, and exhausted retries: no
  silent success with only the easiest target remaining.
- A frozen lesson slot through hydration plus an automatic selection probe:
  isolates consumer behavior without relying on random curator reselection.

Letter naming is currently excluded by the catalog; do not use the prompt's
`b, d, p` example as authorization to expand that response class. These cases
are a proposed verification matrix, not results from newly executed live calls.

## Implementation lessons from the follow-up

The follow-up implementation and dated results are appended to the original
eval report; the observations above describe the pre-fix source.

- A first planner still emitted `_` for `=` and corrupted its own source quotes.
  Rejecting those plans prevented bad items but left empty activities. The repair
  retained source tokens in code and asked the model to select token IDs.
- A planner/reviewer pair using Flash Lite sometimes approved an empty generic
  plan for symbol naming. That routed back to the old all-`+` generator path.
  The plan and review now use the repository's semantic-judging model,
  `gemini-flash-latest`; source references and post-filter coverage remain code-owned.
- Reviewing every plan initially rejected valid arithmetic/counting plans because
  the reviewer mistook a task plan for a finished session. The reviewer needs the
  same precise distinction between enumerated targets and open practice.
- UI inspection found another consumer: tap-to-hear would pronounce a naming
  target. Visual naming now withholds that affordance and loose stimulus context,
  while the actual question and private judging/correction contract remain available.

These findings explain why an added validator or model call cannot alone certify
a repair. Preserve failed passes and check nearby valid tasks as well as the bug.
