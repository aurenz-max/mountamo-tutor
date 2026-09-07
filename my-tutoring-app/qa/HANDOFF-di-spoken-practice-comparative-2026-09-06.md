# Handoff — `di-spoken-practice`: a closed-set comparative-word production mode

**For:** a fresh session running `/add-eval-modes di-spoken-practice`.
**Opened:** 2026-09-06, routed from `qa/lesson-bench/BACKLOG.md` item 30(c) / `qa/di/BACKLOG.md` item 34.
**Why this primitive, now:** di-spoken-practice already has the **worst hit rate of any primitive
in `qa/lesson-coverage/evals.jsonl`** (10 rows, 6 with a `generation_failure`/`insufficient_items`
constraint, avg coverage ~0.7). This handoff scopes ONE class inside that — the rest is
out-of-scope by design (see "Explicitly NOT in scope" below); don't let it creep.

## The gap, precisely

Objective: **"Describe the size and weight of objects using words like longer, shorter, heavier,
and lighter."** (kindergarten, compare-attributes package, two independent fresh draws:
`packages/kindergarten-compare-and-describe-objects-attributes-longer-s-20260906034421-3rvk.json`
and `…-20260906035023-wxyu.json`.) This is a **closed set of four benched comparison words**, cued
by showing/describing TWO objects — structurally identical to `visual_naming`'s "say the name of
the thing you're shown," except the stimulus is a PAIR (which is longer? which is heavier?) and
the answer is drawn from the four-word set, not an open name.

Both draws generated the slot with **`items: []`** — a deliberate, correct refusal, not a crash:

- `spokenPracticePlan.ts`'s `TASKS` enum (`visual_naming | read_aloud | say_answer | count_and_say
  | unsupported`) has no task shaped like "pick the correct word for a two-object comparison."
  The planner most likely calls it `unsupported` (or misroutes to `say_answer` with empty
  `targets`, which then fails in the free-form path).
- The generic pack's item schema
  ([gemini-di-spoken-practice.ts](../src/components/lumina/service/direct-instruction/gemini-di-spoken-practice.ts),
  `itemSchema`) carries exactly ONE `stimulusText`/`stimulusEmoji` per item. There is no way to
  express "here are two things; which is X?" in the current shape.
- `deriveResponseClass` (the benched-registry gate in
  [diSpokenPracticeScript.ts](../src/components/lumina/primitives/visual-primitives/direct-instruction/diSpokenPracticeScript.ts))
  has no response class for "one of {longer, shorter, heavier, lighter}" today — even if an item
  got past the planner, it would likely be dropped as unbenched open production.

Confirmed twice on independent draws (same topic, different generation) — this is the primitive,
not a one-off prompt miss.

## What to build

A new spoken-practice **mode** for closed-set comparative word choice. Rough shape (the skill
should design the details — this is a sketch, not a spec):

1. **A new task**, e.g. `compare_choice`, in `spokenPracticePlan.ts`'s `TASKS`. `closedSet: true`,
   and `targets` enumerates the REQUIRED words (here: longer, shorter, heavier, lighter — pull
   from the objective text the same way `visual_naming`'s named-set extraction already works).
2. **A comparative stimulus shape.** Each item needs two things to compare, not one. Options,
   roughly in order of how much they disturb the existing schema:
   - Extend `itemSchema` with an optional second stimulus pair (`stimulusText2`/`stimulusEmoji2`)
     used only by this mode — keeps the "one flat bounded array" schema shape the file's own
     header calls out as the flash-lite-safe design (don't introduce nesting).
   - OR keep one stimulus and phrase the comparison against a fixed reference the ask states
     aloud ("Which is longer: a pencil, or this line?") — cheaper schema-wise, but reduces to
     "which is longer than a [fixed thing]" rather than a genuine two-object comparison; check
     against the objective text whether that still honors "compare two real objects."
3. **A new response class** in the benched registry for the four-word (or however many the
   objective names) closed set, alongside the existing benched classes — `deriveResponseClass`
   must accept e.g. `'longer'` as a valid single-word answer, and the answer-leak gates
   (`findAnswerLeaks`, `findUnspokenStimulus`) need to see BOTH stimuli when checking for a leak
   (an item must not print/say the answer word itself).
4. **CHALLENGE_TYPE_DOCS** entry + wiring through `resolveEvalModes` exactly like the three
   existing modes — this part IS the standard `/add-eval-modes` path.

## Architecture gotcha the standard skill playbook won't flag

`di-spoken-practice` is **Fork B** (per its own file header) — content-generic, code-owned safety
rails, no catalog `challenges[].type` enum to constrain. The skill's reference implementation
(`gemini-ten-frame.ts`) and its Phase 3 steps (`constrainChallengeTypeEnum`,
`buildModeConstraintSection`) are the WRONG template here. The real surface to read first is
`spokenPracticePlan.ts` in full (231 lines, already read for this handoff) — it owns task
classification, target extraction, and a second Gemini call that reviews the first plan's output
before any item gets written. A new mode touches THIS file's `TASKS`/`parseSpokenPlan`/
`modeForSpokenPlan`/`buildPlannedSpokenItems`/`hasPlannedCoverage`, not just the catalog.

## Explicitly NOT in scope (do not fold in)

Two OTHER `di-spoken-practice` generation-failure rows in `evals.jsonl` are a **different, harder**
shape — genuine open-ended verbal explanation, not closed-set word choice:
- `1st-grade-understanding-the-equal-sign-with-balance-scales-…-ah5w`, obj2 "Explain what the equal
  sign means using the balance scale example" (verb: explain).
- `grade-1-repeating-and-growing-patterns-…-f00i`, obj-with-`obj3-speak-the-rule` "state the rule
  of the pattern" — also explain-shaped.

These need a multi-word, unbenched, judged utterance — the response-class registry this pack is
built around structurally refuses that class ("a 4-word answer is open-set production — a BLOCKED
class"), and CLAUDE.md's pedagogy-over-runnability stance says that refusal is correct, not a bug.
Making open verbal explanation gradeable is a different, much bigger design question (probably:
does it even belong in this pre-generated-item pack, or does it need the live DI judged-loop
instead — see `SPOKEN_INTERACTION_DOCTRINE.md`). If it comes up while working this ticket, name it
and move on; don't design it here. It's the same shape already flagged separately at
`qa/lesson-bench/BACKLOG.md` item 21(c) (comparison-panel's "explain … bigger number").

## Verification (pilot-then-sweep, CLAUDE.md Verification Doctrine)

1. `tsc` baseline first (`qa/lesson-bench/BACKLOG.md` records the current number — check it's
   still current before comparing).
2. Unit tests for the new task in `spokenPracticePlan.test.ts` (or create it if it doesn't exist)
   + `diSpokenPracticeScript`'s response-class tests for the new benched class.
3. **Pilot on this exact package first** — regenerate
   `kindergarten-compare-and-describe-objects-attributes-…` fresh ×3 (topic-trace, source=script),
   confirm `obj3-spoken-explanation`/`obj3-spoken-attribute-description` now produces items across
   all three draws, not just one.
4. `LIVE_GEMINI=1` run if one exists for this generator (check for
   `gemini-di-spoken-practice.live.test.ts` / similar) — this touches the Gemini schema and the
   two-call plan+review prompt, which is exactly the kind of change that passes mocked tests and
   fails live.
5. `/lesson-coverage confirm` on the wxyu package: obj3 should move off `ASSESSED_INDIRECTLY`
   toward `ASSESSED_SUFFICIENTLY` (or at minimum lose the `generation_failure` constraint).
6. Only after the pilot lands live: check whether any OTHER lesson in `evals.jsonl` shares this
   closed-set comparative shape (grep for "compare" + "words like" style objectives) before
   calling the class closed — do not sweep via workflow before this one pilot is runtime-verified.

## Files

| File | Role |
|---|---|
| [spokenPracticePlan.ts](../src/components/lumina/service/direct-instruction/spokenPracticePlan.ts) | Task classification, target extraction, plan+review — the real surface for this change |
| [gemini-di-spoken-practice.ts](../src/components/lumina/service/direct-instruction/gemini-di-spoken-practice.ts) | Item schema, CHALLENGE_TYPE_DOCS, resolveEvalModes wiring, the safety-rail gates |
| [diSpokenPracticeScript.ts](../src/components/lumina/primitives/visual-primitives/direct-instruction/diSpokenPracticeScript.ts) | `deriveResponseClass` benched registry, leak/unspoken-stimulus detectors |
| `qa/lesson-bench/packages/kindergarten-compare-and-describe-objects-attributes-longer-s-20260906034421-3rvk.json` + `…-20260906035023-wxyu.json` | Both frozen pre-fix draws showing the empty-items refusal |
| `qa/lesson-coverage/evals.jsonl` | 10 di-spoken-practice rows; grep `di-spoken-practice` for the full failure census before starting |
