# LA-13: the observer's `correct` criterion, measured across eight domains

Date: 2026-09-22 · Handoff: [14](../live-runtime-handoffs/14-la13-crediting-reply-abstains.md) ·
Executor: `/add-live-tutor-tools` (shared observer criterion, user ruling 09-21)

## What changed

Three sentences in `service/typesafe/observeDialogue.ts`, `DIALOGUE_QUESTIONS.verdict`. No
threshold, margin, route gate, client gate, phrase rule or per-domain clause changed.

| # | Criterion | Before | After |
|---|---|---|---|
| 2 | `none` | "...help, demonstrations, **generic praise**, initial instructions..." | "...help, demonstrations, **encouragement for effort that credits no answer**, initial instructions..." |
| 3 | `correct` | "praise for having done the whole task correctly is enough." | "...is enough, **and so is praise for the accuracy or completeness of the learner's whole answer.**" |
| 4b | `correct` | (none) | "**A reply that affirms the learner's answer to the assignment credits the learner, even when it repeats the answer back or an earlier tutor turn modelled that answer.**" |

Change 2 removes the overlap the evidence pointed at. "You did it!" and "just right" are
praise that credits the answer, but "generic praise" in the `none` list also matched them,
so `none` kept 0.10–0.25 of the probability and the 0.9 gate refused a `correct` that had
won. Change 3 is handoff candidate 2 (quality of the whole answer). Change 4b is candidate 3:
the model read an affirmation of the learner's turn as the tutor's own model when an
earlier turn had modelled the answer ("Yes, /t/.", "There you go, that is the sound!").

## Verdict probe: before and after

`scripts/tutor-verdict-probe.mjs`, 3 repetitions per case, all eight domains. Sweep-to-sweep
noise is about ±6 cases in total because many cases sit at 0.85–0.92, so both the baseline and
the kept criterion were run twice.

| Domain | Baseline (2 sweeps) | Kept criterion (2 sweeps) | False credit |
|---|---|---|---|
| counting-board | 59, 58 /60 | 60, 60 | 0 → 0 |
| shape-sorter | 98, 98 /111 | **97, 97** | 0 → 0 |
| di-letter-sounds | 39, 39 /57 | 46, 46 | 0 → 0 |
| di-word-reading | 45, 45 /54 | 50, 50 | 0 → 0 |
| number-sequencer | 48, 48 /48 | 48, 48 | 0 → 0 |
| di-math-facts | 69, 68 /69 | 69, 69 | 0 → 0 |
| letter-sound-link | 57, 57 /69 | 62, 63 | 0 → 0 |
| di-sentence-reading | 30, 30 /42 | 32, 35 | 0 → 0 |
| **Total** | **445, 443 /510** | **473, 478** | **0 → 0** |

Under-credit went from 65 to 37 on average (sentence 12 → 8.5, word 9 → 4, letter sounds
18 → 11). False credit stayed 0 in every domain in every sweep, including the reverted attempts.

The guard cases (every case where success must not be recorded) did not move toward the
gate. Highest P(correct) on a guard case: `homophone_praise` 0.88 → 0.83,
`sound_said_back_praise` 0.73 → 0.74, shape `bare_substep` 0.58 → 0.58.

**Exit condition not fully met: shape-sorter is one case below its baseline in both sweeps.**
The case is `group` ("Yes, this triangle belongs with the 3 sides group."). Its mean
P(correct) is 0.90 over the six baseline repetitions and 0.88 over the six final ones, so it
passes 2/6 instead of 4/6. It started with change 2. Measured without change 2 (changes 3 + 4b
only), shape-sorter scores 99, but counting-board drops to 57 and number-sequencer to 45,
total 458. The kept set is the better trade, and this report states the cost rather than
calling it noise.

Raw: `*-jev-la13-before-*`, `*-before2-*` (baseline), `*-final1-*`, `*-final2-*` (kept),
`*-c1-*`, `*-c2-*`, `*-c3-*`, `*-c4-*`, `*-c4b-*`, `*-c5-*`, `*-noc2-*` (attempts), all `2026-09-22.json`
in this folder. `*-after-*` is the kept set scored before a whitespace fix (two sentences were
joined without a space); it is superseded by `final1`/`final2`.

## Attempts, in order

| Step | Change | Total /510 | Kept? | Why |
|---|---|---|---|---|
| c1 | Candidate 1: "praise that states no result" decided by what the prior turn asked, stated in both `none` and `correct` | 440 | reverted | Lost cases on board, letter sounds, links and trains |
| c2 | "generic praise" → "encouragement for effort that credits no answer" | 453 | kept | Board 60, links 59; shape `group` -1 (see above) |
| c3 | + quality of the whole answer credits it | 457 | kept | Sentence +3, word +1, no domain lower |
| c4 | + "a reply that affirms the learner's **turn** credits the learner..." | 475 | replaced | Most passes, but raised the sub-step guard cases (letter-sounds `bare_substep` 0.33 → 0.42, `blend_substep` 0.23 → 0.41) and `sound_said_back_praise` to 0.80. It also contradicts the `none` rule for affirming a partial step. |
| c4b | same, scoped to "the learner's **answer to the assignment**" | 466 | kept | Guard cases back to or below baseline |
| c5 | "an explanation question" → "a follow-up question about the learner's reasoning or about the content" (for sentence `open_question`) | 459 | reverted | `open_question` still failed; sentence 33 → 31 |
| noc2 | c3 + c4b without c2 | 458 | not adopted | Shape 99, but board 57 and trains 45 |

## Cases added to the probe

- di-letter-sounds `la13_live_just_right`: the refused live `--audio` exchange verbatim
  (learner transcribed "M", correction that modelled "mmm", then "Great job, you made the
  "mmm" sound just right."). Baseline 0/3 abstained; kept criterion 3/3 at P(correct) 0.98.
- shape-sorter `sort_live_three_sides`, `sort_live_straight`, `sort_live_should_place`: verbatim
  crediting replies from the refused connected `sort` runs, plus two `curved`-rule items.
- For every domain: `la13_whole_praise` (praise with no result after the prior turn asked the
  assignment) and `la13_quality_praise` (praise for the quality of the whole answer).

Labels were written before any run and none was changed after a failure. Honestly ambiguous:

- **di-word-reading `la13_whole_praise` ("You read it!")** also reads as an imperative. The
  model scores feedback `open` 0.99 and verdict `none` 0.90 every time. It is a bad case, not a
  criterion finding. The same reply as "You did it!" passes on counting board, number train and math facts.
- **shape-sorter `sort_live_should_place`** ("...you should place it on the mat printed
  "Curved"") can read as setting a further step.
- **di-letter-sounds `keyword_elicitation` / `clipped_keyword`** (pre-existing): the tutor credits
  the keyword word, and the domain's own assignment fact says naming the picture is a step
  toward the sound. The case labels and the scene fact disagree. That is a domain question
  for di-letter-sounds, not this criterion.

## What is still refused

- **shape-sorter `sort` and `count` (0 improvement).** "That's right! You found that the shape
  has three straight sides." scores `none` 0.35–0.54: the model reads the mat label ("3 sides")
  as the side-count sub-step even though the scene fact says the label is the group. "Yes, this
  shape has six sides." sits at 0.75–0.81. The shared criterion does not reach this; it is
  the mat-label/sub-step overlap recorded in the
  [siblings report](shape-sorter-siblings-teaching-2026-09-22.md).
- **di-sentence-reading `noisy`** ("You read every word. The cat sat!") and **`open_question`**
  ("You read it all! What did the cat do?"): 0.65–0.75 and 0.40–0.50. `noisy` keeps 0.10–0.12
  on `incorrect`, which no other domain shows for a crediting reply.
- **letter-sound-link / letter sounds `la13_whole_praise` ("You did it!")**: 0.78–0.87.

## Connected runs

Three `--lesson-entry --audio` runs each, kept criterion, saved payloads
(`*-la13-lesson-entry-audio-2026-09-22.json`).

| Journey | S5 before | Now | Failures |
|---|---|---|---|
| di-word-reading `cvc_reading` | 1/3, then 3/3 | **3/3** | none |
| di-sentence-reading `read_sentence` | 3/3 | **2/3** | run 2: "Exactly, you read every word perfectly!" refused (correct 0.84, **incorrect 0.14**); then a tutor turn with the literal text `<no speech>{pause}` was judged incorrect 0.92 and reopened the item |
| di-letter-sounds `letter_sound` | 1/3 and 1/3 | **1/3** | run 1: synthetic "sss" transcribed "S" and the **tutor** judged it wrong (synthetic-audio limit, counted separately); run 3: "Perfect! The letter S makes the sss sound." refused (correct 0.85, none 0.12) |
| shape-sorter `sort` | 0/5 | **1/3** | run 1 passed all ten items (0.95-0.99). Runs 2-3: "That's it! You found that the red shape has three sides." (0.77) and "Exactly, that shape has three sides." (0.71) refused: the side count read as a sub-step |
| counting-board `count` (anchor) | 3/3 | **3/3** (re-run) | first batch 0/3: every observation `unavailable`, 0 ms, no model input (the page's observer call threw); the route answered 60/60 probe cases right after, and the re-run passed 3/3 |

Excluding the synthetic-audio run, the remaining connected refusals are one shape: a crediting
reply phrased as a statement of fact ("The letter S makes the sss sound", "that shape has
three sides", "you read every word perfectly"), at 0.71-0.85. The original live letter-sounds
miss ("...made the "mmm" sound just right") passes at 0.98 in the probe and in run 1.

Two defects outside this criterion:

- **A turn with no words can reopen an item.** Gemini Live emitted `<no speech>{pause}` as tutor
  text; the observer judged it and committed a retry. Any domain can hit this.
  `dialogue-observer-probe.mjs` already carries a silence case expecting `none`.
- **Sentence reading puts weight on `incorrect` for crediting replies** (0.10-0.14 here and in the
  probe's `noisy` case), which no other domain shows. The likely source is the sentence domain's
  strict scene fact combined with a correction in the prior turn.

## Deterministic gates

- `npm test -- src/components/lumina/service/typesafe src/components/lumina/components/live-activity`:
  26 files, 205 tests passed (includes `observeDialogue`/`observeLearnerIntent` tests).
- `npm run typecheck:lumina`: 0.
- Full `tsc --noEmit`: 771, against the handoff's 770. No error is in `service/typesafe/` or
  any file this slice touched (the change is string content). The +1 comes from the
  126 other uncommitted files in the working tree.

- Every `*.teaching.test.tsx`: 7 files, 178 tests passed.

## Follow-up in this slice: a turn with no words is not observed

`DialogueObserver` already skipped an empty tutor transcript, but `<no speech>{pause}` is not empty.
`hasSpokenWords` now strips `<...>` and `{...}` markup and requires one character that is not
whitespace or ASCII punctuation (digits, accented and non-Latin letters count). Such a turn is not
observed and does not become the next observation's `priorTutor`. New test in
`DialogueObserver.test.ts`; 33 files / 384 tests pass; `typecheck:lumina` 0. Sentence reading re-run
after the fix: **3/3** (`*-la13-nospeech-audio-2026-09-22.json`); the markup turn did not recur in it,
so the unit test is the only evidence for the skip itself.

Human: the user ran all four shape-sorter modes in the browser on 09-22 and reported they worked.

## Next

- **Queued: sort-domain slice** (`/add-live-tutor-tools`, shape-sorter only). Rewrite how the
  sort assignment and scene describe the mats so that the side count stated as the learner's
  reads as the group. Pass condition: `group` back to at least baseline and the three
  `sort_live_*` cases up, 0 false credit. It owns this slice's shape-sorter -1.
- The empty-turn retry and sentence reading's `incorrect` weight (above).
- The fact-statement shape as the next LA-13 evidence set.
- Human sitting: HUMAN-CHECKS #167.
