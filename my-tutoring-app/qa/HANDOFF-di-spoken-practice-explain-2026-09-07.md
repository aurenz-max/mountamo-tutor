# Handoff — `di-spoken-practice`: `explain_concept`, the first open-proposition mode

**For:** the session that runs the bench sitting, then `/add-eval-modes di-spoken-practice`.
**Opened:** 2026-09-07, from `qa/di/BACKLOG.md` item 36 (merges lesson-bench 21(c) + 26(a)/(b)).
**Status (2026-09-07, later the same day): BUILT AND BENCHED.** `concept_statement` cleared its
bench — `qa/di-bench/run-2026-09-07-concept-statement.md` (0 false affirmations over 32 hard REFUSE
probes, `valid-paraphrase` 8/8) — and `explain_concept` shipped on all five touch points plus the
`DI_PORTS` adapter (§5), the pilot probe (§7.4, 6/6 fresh draws) and the confirm runs (§7.5; results
in `qa/di/BACKLOG.md` item 36). Three things the build found that this doc did not predict, all
recorded in the run record's *Yield* section: anchors need TIDYING at plan and build time rather than
refusal (one redundant planned wording zeroed a whole stamped session); the ask must name the thing
being explained, so an anchor that is a word of that name ("equal") has to be reconciled per item;
and an explain session needs spare capacity (ask `count + 2`, ship `count`) because it is gated twice.
The text below is the design as reviewed, kept as written.

**Original status:** DESIGN REVIEWED, NOTHING WIRED. Standing gate 1 applies: the response class benches
BEFORE the generator, script, or catalog change. Sequencing per item 36: filed behind
`gas-laws-simulator` / `ph-explorer`; this doc banks the design so the slice starts on the bench,
not on a re-read.

## 0. Review of item 36's design note — what holds, what was wrong

Read against `spokenPracticePlan.ts`, `gemini-di-spoken-practice.ts`, `diSpokenPracticeScript.ts`,
`judgedScriptContract.ts`, `diDrivePlan.ts`, `openSetWordBench.ts`, and the two frozen packages.

| Claim in the note | Verdict | Evidence |
|---|---|---|
| Not a new primitive; a new task identity on `di-spoken-practice`, same shape as `compare_choice` | **Holds.** | `compare_choice` set the precedent: task enum + mode + `MODE_SHAPE` + `HOW_TO_PLAY` + one catalog eval mode + one registry β. Same five touch points. |
| `explain_concept` in the `TASKS` enum | **Holds.** | The planner today calls the explain objective `unsupported` (compare-choice report line 53; dev log: "Ungrounded or unsupported target" ×2 per attempt) — the prompt literally lists "open-ended answers" under `unsupported`. |
| Item content = `stimulusPrompt` + 2-3 **code-validated** `acceptableConcepts` | **Half right.** Code can validate STRUCTURE only. | Nothing in the sources grounds a paraphrase. `compare_choice` grounds its menu because the objective *prints* the words; "= means both sides are the same" is nowhere in the objective text. The honest split is the one `planSpokenPractice` already uses for open visual naming: code checks shape (count, length, distinctness, ear-separability, no echo), the second flash-latest REVIEW call checks meaning. See §3. |
| "The runtime judge does NOT need new machinery" | **Holds.** | `judgingContract` is a string; the engine reads sentinels. Nothing in `useJudgedSpeechLoop` changes. |
| "What's new is model-then-elicit branches in the script" | **Wrong, and worth correcting before it misleads a build.** | The correction branch is ALREADY model-then-re-elicit (`My turn: <correctionBody> Your turn. <ask>`). Modeling the concept inside the ASK would put the answer in the ask — the same leak `findAnswerLeaks` exists to catch, and the coverage judge would file it `ASSESSED_INDIRECTLY` (recall of a sentence just heard). What is new is the JUDGING CLAUSE (concept-anchored, not token-anchored) and the AFFIRM line (restates the concept, not a token). See §4. |
| New response class → bench sitting first | **Holds — and the bench is currently UNRUNNABLE.** | `di-spoken-practice` has NO adapter in `DI_PORTS` (`diDrivePlan.ts`), so `--di` and `--di-bench` refuse it by name. The compare-choice slice logged the same gap as "mic — HUMAN-CHECKS #137, no live drive". The bench sitting therefore starts with an adapter. See §5. |
| "Check `comparison-panel`'s digest mapping (21c) first — evidence may only need counting" | **Checked: does not shrink the ask.** | `gates` is NOT in `digest.ts` `ITEM_KEYS`, so the gates are indeed uncounted (a real, small digest gap). But the gate that "argues the concept" is a TRUE/FALSE statement ("Putting groups together makes a smaller number." → false) — recognition. Counting it moves `assessmentCount`, never the category past `ASSESSED_INDIRECTLY` for an explain verb. File the one-line `ITEM_KEYS` add separately; it is not this slice's lever. |
| Two failure rows, `…ah5w` obj2 and `…f00i` obj3 | **Holds, and they are two SUB-SHAPES of one mode.** | ah5w: one session-wide concept ("= means the same amount on both sides"), varied instances. f00i: a per-item concept ("the rule of THIS pattern"), whose answer is often ≤3 words ("plus two"). One mode covers both only if anchors are PER ITEM. See §2. |

**Census, so the class is sized honestly:** `evals.jsonl` has 22 `explain`/`describe` objective rows;
2 `SUFFICIENT` (both DI spoken), 1 `NOT_EVALUATED`, the rest `INDIRECTLY`/`INSUFFICIENTLY`/`TAUGHT_NOT_ASSESSED`.
Every K-2 math lesson the curator writes carries one. This is the widest single supply gap in the file.

## 1. The response class — `concept_statement`

New `ResponseClassId` in `judgedScriptContract.ts`, status `blocked` until the bench passes (the
validator refuses it, `packGateIssues` non-empty — the honest label on a bench run).

> **`concept_statement`** — the child states an IDEA in their own words, 1–10 spoken words, and the
> judge decides whether the utterance EXPRESSES the concept, not whether it contains a token. Open
> production of a proposition. Sits between `closed_set_choice` (a proposition from a printed menu)
> and `open_set_word` (any word satisfying a rule). Distinct from both: no menu bounds the wrong
> answers, and the target is a MEANING, so token overlap is neither necessary ("they match") nor
> sufficient ("they are NOT the same").

Notes the record must carry (things a pack must do that the class cannot):

1. **Judge meaning, not words.** The clause hands the judge ONE concept sentence and 2–3 anchor
   phrasings, and says explicitly that a five-year-old's paraphrase with none of those words counts.
2. **The four refusals, each a bench bucket** (§5): ECHO (stimulus read back), ANSWER-NOT-EXPLANATION
   (the arithmetic result: "five"), ADJACENT-CONCEPT (the real misconception: "= means the answer
   comes next", "the rule is it gets bigger"), NEGATED-KEYWORD (anchor tokens present, idea absent:
   "they're not the same"). Plus OFF-TASK, shared with every open class.
3. **The correction cap is load-bearing** exactly as `open_set_word` records: open items reach long
   correction runs; never raise `maxCorrections`.
4. **Length ceiling is a WORD count on the anchors, not on the child.** A rambling correct answer is
   correct. Anchors ≤ 4 words, the concept sentence ≤ 12, so the affirm line stays speakable.

## 2. The task and the item — what the model emits, what code builds

### `TASKS` gains `explain_concept`

Planner prompt line (the one that flips today's `unsupported` verdict):

> - explain_concept: the child says, IN THEIR OWN WORDS, what something means, why it is so, or
>   what rule governs it ("what does = mean?", "what is the rule of this pattern?"). The answer is
>   an IDEA, 1-10 words, with many correct wordings. Choose this for an explain/describe/tell-why
>   objective whose answer is a short proposition. targets: when the objective names ONE concept
>   (the equal sign, a ten rod), emit one target whose stimulusId is the named symbol/picture and
>   whose expectedAnswer is the shortest correct statement of the concept, with alsoAccept holding
>   1-2 more wordings. When the concept varies per instance (the rule of a pattern), targets is
>   empty and closedSet false — the item generator writes each instance and its rule.

`parseSpokenPlan`: `explain_concept` targets may carry `alternates` (unlike `compare_choice`) and the
answer may be up to 4 words (`deriveResponseClass(task, …)` gets the new class). The grounding rule
for the STIMULUS stays exactly as it is (token inventory or `picture`); the anchors are reviewed,
not grounded — see §3. `modeForSpokenPlan` maps 1:1. `buildPlannedSpokenItems` REFUSES it like
`compare_choice` does: a planned concept is a session-wide anchor set, not a stimulus→answer pair
to repeat — the instances are written by the item generator around it.

### The item (flat schema, no nesting — the flash-lite-safe shape holds)

| Field | `explain_concept` use | New? |
|---|---|---|
| `stimulusText` | the INSTANCE the child looks at: `"3 + 2 = 5"`, `"2, 4, 6, 8"`, `"a ten rod"` | no |
| `stimulusEmoji` | optional picture (⚖️ for a balance) | no |
| `ask` | the bare elicit, MUST NOT contain any anchor token or the concept sentence: *"Look at the balance. What does the equal sign tell us?"* | no |
| `expectedAnswer` | **primary anchor**, ≤ 4 words: `"both sides the same"` / `"plus two"` | length rule changes |
| `alsoAccept` | 1–2 more anchors: `"balanced, equal amounts"` | no |
| `conceptStatement` | **the one sentence the judge holds**, ≤ 12 words: *"The equal sign means both sides have the same amount."* | **NEW** |
| `acceptRule` | *"Any words that say the two sides match or are equal count, even without the word same."* | no |
| `signatureError` | *"Saying the sum, like five, is NOT an explanation. Saying it means the answer is coming is NOT correct."* | no |
| `correctionBody` | re-teach, states the concept, no question | no |

Session-planned case (ah5w): the plan's anchors are stamped INTO every item by code (like the
`compare_choice` menu is stamped into `choices`) and `hasConceptCoverage` re-checks after gates that
every item carries them. Open case (f00i): each item's anchors come from the model and go through
§3's review.

`MODE_SHAPE.explain_concept = { stimulusKind: 'text', answerSource: 'recall', label: 'Say Why' }`
(stimulusKind may become `'emoji'` per item exactly as `say_answer` does — reuse that branch).
`HOW_TO_PLAY.explain_concept = 'I will show you something, and you tell me what it means in your own words.'`

## 3. Code gates vs. review — the split, stated so it is not overclaimed

**Code validates (new `findConceptDefects`, run inside `dropLeakingItems`):**

- `conceptStatement` present, 4–12 words; `expectedAnswer` 1–4 words; 1–3 anchors total, distinct.
- No anchor and no concept-sentence token run ≥ 3 words appears in the `ask` (`containsPhrase`,
  the existing leak scan extended to the new field — a leak of the concept is the leak).
- No anchor equals the stimulus (`echo` would be un-refusable).
- Anchors ear-separable from each other (`sharesEar`) — not for the judge's sake, for the affirm
  line's: the affirm restates ONE thing.
- `stimulusText` non-empty; `findUnspokenStimulus` extended: an explain ask must SAY its instance
  aloud ("Three plus two equals five. What does the equal sign tell us?") — same reason as the
  arithmetic case, the voice is the carrier.

**Review validates (semantic — one flash-latest call per session, only on this mode):**

> Independently check these explain items against the objective. For EACH item: is
> `conceptStatement` a TRUE, grade-appropriate statement of what the objective asks the child to
> explain, for THIS stimulus? Does every anchor mean the same thing as the concept sentence? Would a
> child who says only the anchor have shown the understanding the objective names? Reject the ITEM
> (by id) on any no. Reject the SESSION if the items do not vary the instance.

This is the same authority split as `planSpokenPractice`'s plan+review ("task interpretation and
review are semantic judgments, like lesson coverage") applied one layer down. It is NOT
"code-validated anchors"; say so in the docblock so the next reader does not go looking for the
grounding that isn't there. A session with a rejected item regenerates once; two failures ship
`items: []` as today — pedagogy over runnability.

## 4. The script — judging clause and affirm line (the only new script surface)

`judgingContract` gets a mode branch, code-owned like the menu clause:

> The learner is explaining in their own words, and there is no single right wording. The idea they
> must express: "**{conceptStatement}**". Any wording that means that counts — for example
> "{anchor1}", "{anchor2}", "{anchor3}" — and so does a child's own phrasing that uses none of those
> words, as long as the idea is there. Judge the MEANING of what you heard, not the words. {acceptRule}
> {signatureError} The stimulus read back ("{stimulusText}") is NOT an explanation. A turn with no
> idea in it, or "I don't know", is wrong — run the correction. If the idea is right, say exactly:
> "**Yes, {conceptStatement}**" If it is wrong, say exactly: "My turn: {correctionBody} Your turn. {ask}"

Two deliberate departures from the other modes, both needing the bench to confirm:

- **Affirm restates the CONCEPT SENTENCE, not `expectedAnswer`.** "Yes, both sides the same." is a
  clipped echo of a token; "Yes, the equal sign means both sides have the same amount." is the DISTAR
  firm-up. Sentinel discipline holds (code prepends "Yes,"; `conceptStatement` runs through
  `opensWithSentinel` like every generated string).
- **No model in the ask, at ANY support tier.** The model lives in the correction (already
  model-then-re-elicit). If a later `/add-support-tiers` rung wants an easy tier that models first,
  it is a TEACH item and must not be counted as assessment — flag it, don't fold it in here.

`contextFor` pushes `stimulus` only (the instance), never the concept — stimulus side, as ever.
`pronounceCue` re-hears the instance; never the concept.

## 5. The bench sitting — the first gate, and what it needs built

**Prerequisite (not optional): a `di-spoken-practice` adapter in `DI_PORTS`.** `build` goes through
`buildItem` + `dropLeakingItems` (the shipped gate, so the same items drop); `benchBuild` returns the
fixture below through the same `buildItem`; `answersFor` returns `correct` / `plainWrong` /
`signatureWrong` / `leakTokens` for every mode and attaches `probes` BY ITEM ID for the bench items.
This also closes the "no live drive" residual the compare-choice slice left (HUMAN-CHECKS #137) for
free — `/tutor-test di-spoken-practice --di` becomes runnable for all five modes.

**Fixture: `service/qa/di/conceptStatementBench.ts`** (+ `.test.ts` keying the key, like
`openSetWordBench.test.ts`). Hand-authored, ≥ 4 stimuli across BOTH sub-shapes so a single concept
cannot hide a contract gap (the open-set bench's own method note: one stimulus would have passed
12/12 and hidden everything). ~11 probes per stimulus:

| Bucket | Expect | What it catches | Example (`3 + 2 = 5`, "what does = tell us?") |
|---|---|---|---|
| `valid-canonical` | AFFIRM | baseline | "both sides are the same" |
| `valid-paraphrase` | AFFIRM | **the bucket the class exists for** — none of the anchor tokens present | "they match", "this side and that side are even" |
| `valid-childlike` | AFFIRM | grammar/diction is not the skill | "it's, um, same same on the two" |
| `valid-partial` | AFFIRM, **soft** | a defensible half-answer; recorded, not gated | "same" |
| `echo` | REFUSE | stimulus read back | "three plus two equals five" |
| `answer-not-explanation` | REFUSE | the result, not the meaning — the K-1 signature error | "five" |
| `adjacent-concept` | REFUSE | the documented misconception | "it means the answer is next", "it means add them" |
| `negated-keyword` | REFUSE | **the bucket that fails a word-matching judge** | "they are not the same" |
| `off-task` | REFUSE | shared | "I don't know", "um" |

Suggested stimuli: `3 + 2 = 5` (equal sign, concept session-wide); `2, 4, 6, 8` (rule per item —
anchors "plus two / add two / counting by twos"; adjacent "it goes up", echo "two four six eight");
`red, blue, red, blue` (repeat unit; adjacent "colors"); `a ten rod next to ten unit cubes` (vhjy's
shape: "ten ones make one ten"; answer-not-explanation "ten"; adjacent "it's longer").

**Gate:** asymmetric, as the family's benches are — **zero false affirmations** in `echo`,
`answer-not-explanation`, `adjacent-concept`, `negated-keyword`; `valid-paraphrase` affirmed on
≥ 80% of probes (a class that only affirms canonical wording is `closed_set_choice` in disguise and
should not clear); no-verdict turns never count as agreement. Record →
`qa/di-bench/run-<date>-concept-statement.md`; flip the class to `benched` with the run pointer in
`evidence`.

**What the bench cannot answer** (write it in the run record): the harness sends TEXT. Semantics of
the judge, yes; ASR on a six-year-old's "they're even", no. Mic row stays owed.

## 6. Catalog + backend (the `/add-eval-modes` half, AFTER the bench)

```ts
{
  evalMode: 'explain_concept',
  label: 'Say Why',
  beta: 4.0,            // hardest act in the pack: unaided production of a proposition
  scaffoldingMode: 4,
  challengeTypes: ['explain_concept'],
  description: 'The child sees one instance (an equation on a balance, a pattern, a ten rod) and '
    + 'says in their own words what it means or what rule it follows. Use for explain / describe / '
    + 'tell-why objectives whose answer is a short idea with many correct wordings. Judged on '
    + 'meaning; the ask never states the concept.',
}
```

Backend `problem_type_registry.py` → `"di-spoken-practice"`:
`"explain_concept": PriorConfig(4.0, "Open proposition: state in own words what a shown instance means or the rule it follows")`.
Catalog `description`/`constraints` lose the "never a multi-sentence explanation" line and gain
one sentence for this mode; `CHALLENGE_TYPE_DOCS.explain_concept` mirrors §2's planner line.
`affordances` unchanged (`answers: ['spoken']`, `reader: 'none'`).

Within-mode support tier (`config.difficulty`): NOT in this slice. The only honest lever here is the
stimulus richness (picture + equation → equation only), and it must not touch the ask (§4). Queue for
`/add-support-tiers` after the class is benched and one lesson has run it.

## 7. Verification (pilot-then-sweep)

1. `tsc` project-local, baseline first (`qa/lesson-bench/BACKLOG.md` records it); `typecheck:lumina` 0.
2. Unit: `spokenPracticePlan` accepts/refuses `explain_concept` plans (named-concept + open);
   `findConceptDefects` on each defect; `judgingContract` explain branch; `validateJudgedScriptPack`
   refuses the class while `blocked`, accepts it once `benched`; bench key test.
3. **Bench** (§5) — the gate. Nothing below runs before it passes.
4. Pilot on BOTH frozen packages — `scripts/probe-di-spoken-practice-explain.mjs`, modeled on the
   compare probe: SELECTION (`…ah5w` and `…f00i` stripped of pins route to `explain_concept` through
   the real `resolveLessonEvalModes`), RESOLUTION (≥ 3 independent draws each, every item leak-free,
   instance varied, anchors reviewed), and REFUSAL (the compare probe's `refuses-open-explanation`
   case FLIPS — update that probe's expectation in the same slice or it goes red for the right reason).
5. `/lesson-coverage confirm` on `…ah5w` (obj2) and `…f00i` (obj3): `generation_failure` gone,
   category past `ASSESSED_INDIRECTLY`. If the judge still says INDIRECTLY, read its note before
   touching anything — it will name whether the ask leaked or the items didn't vary.
6. Then the grade-1 sweep ×3 per item 26's `rerun`. Do NOT convert the other 18 explain rows via
   workflow; check first which of them are this shape (most) and which are `compare_choice` or
   `say_answer` in disguise (x2yo "describe the number patterns" may be the latter).

## Explicitly NOT in scope

- Multi-sentence explanations, "explain how to solve" procedures (xr3w, 3w6h): a PROCEDURE is a
  sequence of steps, not one proposition — a different class again. Name it, move on.
- Any teach-first (model-then-elicit) item form. Teaching lives in the correction and in the other
  blocks of the lesson.
- The `digest.ts` `ITEM_KEYS` `gates` add — file at lesson-bench, one line, separate commit.
- Support tiers / structural difficulty for the new mode.

## Files

| File | Role in this slice |
|---|---|
| [judgedScriptContract.ts](../src/components/lumina/hooks/judgedScriptContract.ts) | `concept_statement` class record — `blocked` → `benched` |
| [diDrivePlan.ts](../src/components/lumina/service/qa/di/diDrivePlan.ts) | NEW `di-spoken-practice` adapter: `build` / `benchBuild` / `answersFor` |
| `service/qa/di/conceptStatementBench.ts` (+ test) | NEW hand-authored bench key |
| [spokenPracticePlan.ts](../src/components/lumina/service/direct-instruction/spokenPracticePlan.ts) | `TASKS`, planner + review prompt lines, `parseSpokenPlan` explain branch, `hasConceptCoverage` |
| [gemini-di-spoken-practice.ts](../src/components/lumina/service/direct-instruction/gemini-di-spoken-practice.ts) | `conceptStatement` schema field, `CHALLENGE_TYPE_DOCS`, prompt EXPLAIN SPECIFICS, per-session review call, `findConceptDefects` in `dropLeakingItems` |
| [diSpokenPracticeScript.ts](../src/components/lumina/primitives/visual-primitives/direct-instruction/diSpokenPracticeScript.ts) | mode, `MODE_SHAPE`, `HOW_TO_PLAY`, `deriveResponseClass`, `findConceptDefects`, `judgingContract` explain branch, leak/unspoken extensions |
| [di.ts](../src/components/lumina/service/manifest/catalog/di.ts) · `problem_type_registry.py` | eval mode β 4.0, both sides |
| `qa/lesson-bench/packages/…-ah5w.json` · `…-f00i.json` | the two frozen pre-fix draws |
| [probe-di-spoken-practice-compare.mjs](../scripts/probe-di-spoken-practice-compare.mjs) | its `refuses-open-explanation` check inverts once this ships |
