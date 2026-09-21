# di-math-facts on the shared teaching workspace — sixth adopter

Date: 2026-09-20 · Skill: `/add-live-tutor-tools` · Scope: `di-math-facts`, all five eval
modes, development live host (`/lumina/live-activity`).
Handoff: [07-sunset-scripted-tutoring.md](../live-runtime-handoffs/07-sunset-scripted-tutoring.md) ·
Census: [07-census.md](../live-runtime-handoffs/07-census.md) · Contract:
[TEACHING_WORKSPACE.md](../../src/components/lumina/docs/TEACHING_WORKSPACE.md)

## Why this primitive

`di-math-facts` is the only remaining math surface on the legacy runner whose every mode is
a bounded spoken answer, and it is the first adopter whose answer is *neither* printed on
the screen nor a produced phoneme — the two families where the observer's affirmation
criterion has failed. That makes it the cheapest available test of whether the LA-13 finding
is about produced sound or about something else. The results are in §"What this says about
LA-13", and they are the substantive output of the slice.

Candidates rejected: `BalanceScaleEquality`, `BalanceScaleWorkshop`, `BaseTenBlocksDi` and
`FractionTouch` are gesture or mixed-gesture, and every gesture mode is still blocked from
lesson entry by the missing learner-owned **Try again** in the lesson shell (census,
"Deletion blockers"). `BarModelExplanation` is an open explanation, which needs a rubric the
`expectedAnswer` field does not provide.

## What was built

| File | What it owns |
|---|---|
| `direct-instruction/diMathFactsDomain.ts` (new) | The assignment: item shape, validity gates, the ask, the success condition, the counting route, harness answers. |
| `direct-instruction/diMathFactsScript.ts` | Now only the retiring control protocol; re-exports the domain so the generator, tester, Pip pose and lesson-bench extractor keep one address. |
| `direct-instruction/DiMathFactsTeaching.tsx` (new) | The stage as a workspace: one printed problem, term targets, the committed-answer reveal. |
| `direct-instruction/DiMathFacts.tsx` | Host selection — a live runtime plus a resolved workspace mode mounts the teaching stage; everywhere else the scripted drill runs unchanged. |
| `live-activity/adapters/diMathFactsLive.ts` (new) | Registry row: five modes, `teachingOwner: 'tutor'`, `canAdvance: false`, `tutoring: null`, K/G1 grade gate, guidance. |
| `live-activity/activityContract.ts`, `liveRenderers.tsx`, `liveJourneySpec.ts` | One line each. No new harness, no backend branch. |
| `DiMathFacts.teaching.test.tsx` (new, 34 cases) | The TW behavioural matrix in this domain, plus this pack's own four risks. |
| `scripts/tutor-verdict-probe.mjs --facts`, `scripts/learner-intent-probe.mjs --facts` | Real-model case sets for this domain. |

Nothing was deleted. The standalone scripted drill, its sentinels, its correction cap and
its `MAX_CORRECTIONS_PER_ITEM` are untouched and still serve every non-live entry point.

## What is genuinely new in this adopter

**1. The answer is neither drawn nor withheld from the tutor — the inverse of word reading.**
There, the word was printed, so handing it to the tutor cost nothing. Here the answer exists
nowhere on screen (the pack's own answer-leak rule), yet the tutor must have it to judge.
So the scene cannot prevent the tutor saying the answer first; only the guidance can, and
`askFor` never contains it. `name_numeral` inverts *within* the pack — the printed numeral
IS the answer — so its gate is inverted rather than exempted: that mode requires
`display === String(answerNumeral)`, and every other mode forbids an `=` and forbids the
answer word appearing in the printed form.

**2. Answer-key desync is a gate, not a convention.** The tutor judges the answer WORD and
the evaluation records the NUMERAL, and the two are produced by different code paths. A
desynced item would have the tutor affirm one number while the record stored another, which
no teaching can recover, so `mathFactChallengeValid` rejects any item where
`answerWord !== spokenIntegerWord(answerNumeral)`. That check runs at the service boundary
and in the component.

**3. Printed terms are real demonstration targets, and a bare numeral has none.** On a
computed fact each drawn token (`2`, `+`, `1`) is its own object, so pointing at one is the
counting-on gesture. A `name_numeral` stimulus is a single token, so it publishes no term
and a tutor pointing inside it is refused by the scene rather than by a sentence — the same
structural move as a sight word publishing no letters.

**4. The completed equation follows the committed attempt, not a local phase.** The
standalone drill completes the fact in place ("2 + 1" → "2 + 1 = 3") for a held beat. That
beat needs a `phase === 'affirmed'` window this path does not have: `apply_tutor_verdict`
submits and advances in one `flushSync`, so a reward keyed on the current item's phase would
render on the held-success path and never on the advance path. The solved form is therefore
keyed on `lesson.state.attempts` and rendered small and secondary, keeping one large fact on
the stage — which is what the 2026-07-25 overload check was actually about.

**5. `meanResponseMs` is reported as `null`.** The fluency signal is the standalone drill's
tutor-audio-fall timing. This path does not measure it, and reporting a number it never took
would make a silent signal quietly wrong.

## What was verified, and at which layer

### Deterministic (mounted component, real runtime, real transport)

`DiMathFacts.teaching.test.tsx` — **34 cases, all pass.** The TW matrix in this domain:
intermediate vs final praise, incorrect praise, held success with an open question, help
without grading, wrong then corrected, gestures absent (this pack has no gesture channel),
separate demonstration and learner work, stale and duplicate outcomes, new-word
cancellation, stop/unmount, and single submission after settlement. Plus the four risks
above, the packet carrying `learner.signals`, and the tutor's own settled turn counting as
`tutorTurns` rather than `learnerTurns`.

**One reachability limit, recorded rather than hidden.** The recap's unsolved branch prints
the problem instead of the solved form, and it is unreachable today: `advance` is offered
only after a correct response, so every completed session has all facts solved. It stays as
the guard for the lesson-shell navigation the census still lists as missing, and what IS
reachable is asserted directly (nothing carries a solved form before a commit).

### Real model — learner-turn observation

`node scripts/learner-intent-probe.mjs --facts` → **42/42 pass, false help/stop requests 0**,
latency median 217 ms, p90 278 ms.
Evidence: `di-math-facts-learner-intent-2026-09-20.json`.

One number worth carrying: the th-fronted transcript of a correct answer (`free` for
*three*) reads faintly as a stop request — `stop 0.32/0.33` across all three repetitions.
That is well under the 0.8 policy, so it raises nothing, but it is the same shape as the
letter-sounds `hmm` case and the margin is smaller than any other case in this set.

### Real model — assignment outcome

`node scripts/tutor-verdict-probe.mjs --facts` → **63/63 pass** (21 cases × 3).
Evidence: `di-math-facts-tutor-verdict-2026-09-20.json`.

Including the domain's own discriminations: counting up or back to the answer credits
(0.99–1.00), an echoed operand affirmed as the answer does not (refused 3/3), reciting the
sequence to reach a printed numeral does not (refused 3/3), and affirming *thirty* for
**thirteen** does not (refused 3/3).

### Connected journeys

`run_live_runtime.py --primitive di-math-facts --startup [--audio]`, **19 journeys across
all five modes, 12 pass.** All failures and their families are below.

| Mode | Channel | Result |
|---|---|---|
| `answer_fact` | audio | **3/3** |
| `name_numeral` | audio | **3/3** |
| `subtraction_fact` | audio | 3/4 |
| `counting_next` | audio | 1/1 |
| `fact_review` | audio | 1/1 |
| `answer_fact` | text | 2/7 |

Payloads for replay: `di-math-facts-runtime-<mode>-payload-2026-09-20.json`.
Run records: `di-math-facts-workspace-{text,text-b,text-c,audio,audio-<mode>}-2026-09-20.json`.

**The audio gate ran and passed the channel letter sounds could not.** A synthesised number
word transcribes correctly, and connected runs closed wrong → retry → correct → advance →
next item → completion, with retry transitions accepted at 0.95–0.99. The retry-path stall
that scored `sight_word` 0/3 for word reading did not occur here in 19 journeys.

## Failures, by family

**1. A requested demonstration narrated without being performed — 6 of 19.** The tutor calls
`begin_help`, is asked "can you show me what you mean?", and answers with a verbal analogy
("imagine you have two apples") without touching the board. The harness fails it on
`Help never changed the actual board`.

This is the shared family the census already lists as past three occurrences, and this
domain adds two things to it. First, **the modality split is the opposite of word
reading's**: there text called `demonstrate` 3/3 and audio 0/2; here audio called it 10/12
and text 2/7. A cause that predicts both does not exist yet, so the current framing of that
family is incomplete. Second, **there may be nothing useful to demonstrate with**. The
stimulus is an abstract symbol string; the only legal marks are the whole card and its
printed terms, and none of them models addition. The blocks and fingers the tutor reaches
for are better teaching than pointing at a "+". That is a capability question, not a
guidance one.

*One guidance attempt was made and reverted.* A sentence telling the tutor to mark the part
it is talking about before describing it measured **1/3 before, 1/3 after** on three text
runs. It bought nothing measurable and cost 60 characters of a capped budget, so it was
removed rather than kept as decoration. Both run sets are preserved
(`-text-b-` before, `-text-c-` after).

**2. One completion stall (1 of 19), and its cause is now isolated.** See below — it is the
most useful thing this slice produced.

**3. Truncated tutor turns.** Several text runs show the tutor's turn cut mid-sentence
("What is one ", "If you have three ", and once a lone zero-width character). It always
coincided with a demonstration miss, so it may be the same event rather than a second one.
Not investigated; recorded so a later reader does not mistake it for new.

## What this says about LA-13

**The sub-threshold-affirmation shape does NOT reproduce on a spoken number word.** The
probe's `wrong_then_corrected` case — a bare affirmation after a turn in which the tutor
corrected and modelled the target, with a wrong prior attempt and full answer exposure —
is the exact shape that scored 0.83–0.89 for letter sounds and 0.86 for word reading. Here
it scores **0.95–0.96, accepted 3/3**.

A controlled variant was added to rule out the obvious confound. The failing domains' prior
turns modelled the *act* ("listen to me sound it out") without naming the target, while the
first math case's prior turn names the answer ("two plus one is three"), which would make
the target visible to the observer. `wrong_then_corrected_unnamed_model` matches their shape
exactly — prior turn "Listen to me count it out, then you try" — and still scores
**0.94–0.95, accepted 3/3**.

So five adopters and three domains is now six adopters and four domains, and the split runs
along a different line than "produced sound": the two failing families are ones where **the
child's answer and the tutor's own model are the same utterance in the same channel** (a
held phoneme; a word read off the card the tutor just read aloud). A computed number is not.

**But a different abstention did occur, and the word-reading remedy does not cover it.**
One connected run stalled to timeout on the final item. Replayed through the observer it
abstains deterministically, and a seven-cell isolation (3 repetitions each, all deterministic)
locates the cause:

| Prior tutor turn | Tutor reply | Result |
|---|---|---|
| "Great job! Now, let's look at another one. What is five minus two?" | "Fantastic, five minus two is three." | **abstain 3/3** |
| *(removed)* | same | correct/advance 3/3 |
| "What is five minus two?" | same | correct/advance 3/3 |
| "Great job!" | same | correct/advance 3/3 |
| as recorded | "That's right, five minus two is three." | correct/advance 3/3 |
| as recorded | "That is right!" | correct/advance 3/3 |

The learner's transcript form (`3` vs `three`) makes no difference — both abstain in the
failing cell.

Read plainly: **the reply names the answer and is still refused.** What rescues it is a
relational credit phrase, not naming. The failing combination is a prior turn that already
carried praise for the previous item and introduced this one, plus a reply whose only credit
marker is an interjection followed by the model sentence — and on this pack, naming the
answer back *produces* the model sentence, because "five minus two is three" is exactly the
DISTAR model line. The word-reading fix ("name the answer in the same breath") therefore
does not generalise to a domain where the answer and the model are the same sentence; it may
even be the wrong instruction here.

Evidence: `di-math-facts-abstention-isolation-2026-09-20.json` (21 calls),
`di-math-facts-workspace-audio-subtraction_fact-b-2026-09-20.json` (the live stall).

This is a shared-criterion input for LA-13, not something to patch in this primitive's
layer. No threshold, phrase rule or success-condition clause was added for it.

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck:lumina` | **0** |
| `./node_modules/.bin/tsc --noEmit` | **770**, unchanged from the pre-slice baseline |
| Affected tests (live-activity, all DI, CountingBoard runtime, ShapeSorter runtime, typesafe) | **698 pass, 62 files** |
| Adapter guidance vs the 2000-character `parse_activity_spec` cap | **1855** |

Counting Board, Shape Sorter and the number train were regressed as part of that suite; no
shared workspace behaviour changed in this slice, so their own real-model figures were not
re-run.

## Withheld, and what is not certified

- **Ordinary lessons are not wired.** `lessonWorkspacePlan` still admits only Counting Board
  `count`, Shape Sorter `identify` and the five Number Train spoken modes. This slice adds a
  development-host adopter, nothing in `LessonScreen`.
- **Nothing was deleted.** The pack remains a `RUNNER` row in the census; its standalone
  drill is the legacy path and the deletion gate is S3.
- **Two modes have one connected run each** (`counting_next`, `fact_review`), not three.
  They pass, and the deterministic and JEV coverage is complete for them, but the 3-run
  connected gate ran only on `answer_fact`, `name_numeral` and `subtraction_fact`.
- **Synthetic audio and JSDOM paint are not human acceptance.** Microphone and visual
  acceptance is [HUMAN-CHECKS #167](../HUMAN-CHECKS.md); no new queue row was opened.
- The generated pool produced several zero-operand facts ("zero plus three", "three plus
  zero"), which make for odd teaching at this age. That is a generator question, not a
  workspace one, and it was not touched.

## Next bounded slice

LA-13's shared criterion, with the isolation table above as its input — specifically whether
a whole-assignment affirmation should be creditable when its only credit marker is an
interjection and its remaining words restate the target. That question now has cases from
four domains, one of which shows that the naming remedy is domain-specific.
