# DI canvas roadmap (user 11-15)

A DI canvas teaches one rule. The child works a picture, says or shows the answer, and the tutor corrects from the
misrule the program named. It is a canvas spec (`qa/canvas/specs/<id>/`) on the `agent-canvas` host, checked by
`scripts/canvas-check.mjs`. Pilot: `same-amount-squares`.

Status on 11-16 (end of the loop): 71 of 71 built (every wave, science and social studies; batches 6-11 built and evaluated by a self-paced `/loop`, see "Themes from the evals"); every built DI canvas has been through `/canvas-eval`. `add-like-parts` gained an action in the batch 5 eval and needs a play. Played and approved by the user in Live sessions: `same-amount-squares`,
`equal-parts`, `whole-matters` (as Stretch the Whole, "the best one yet"). Gate-passed, not played: `count-the-spaces`, `smaller-pieces`, `past-one`, `wholes-as-fractions`, `add-like-parts`, and batch 2: `fair-shares`, `times-a-whole`, `recut-to-add`, `part-of-a-part`.
The plays found three shared faults, all fixed: the tutor cut off mid-sentence (backend floor gate), credit said twice
(the observer read the untouched canvas as an unsolved task), a blank results screen after a voice-only session (the
shared progress hook). Nothing below is built unless marked.

71 canvases are listed: 13 fractions, 8 place value, 8 operations, 10 measurement and geometry, 7 early number,
8 ratio and algebra, 12 science, 5 social studies. Each is a design record, not a spec: the picture, the answer and the
problem set are a starting point for `/canvas-primitive`, and the play decides what holds. Standards codes are from
memory; match each to a published subskill id before writing `serves`. Canvases in brackets exist already and have not
been read for this roadmap.

## Hand-off (written 11-15 for the next session)

Read this section first. It is the state of the work, what to do next, and what the first day taught.

### State

| Canvas (spec id) | Shown as | Gate | Played by the user |
|---|---|---|---|
| `same-amount-squares` | Same Amount Squares | 5/5 | Yes, approved (replayed after the fixes) |
| `equal-parts` | Equal Parts | 5/5 | Yes, "worked fine" |
| `whole-matters` | Stretch the Whole | 5/5 | Yes, approved: "the best one yet in terms of pedagogy and fractions" |
| `count-the-spaces` | Number Line Dot | 5/5 | No |
| `past-one` | Pie Shop | 5/5 | No |
| `wholes-as-fractions` | Cut the Wholes | 5/5 | No |
| `add-like-parts` | Join the Pieces | 5/5 | No |
| `smaller-pieces` | Cut the Bar | 5/5 | No |
| `fair-shares` | Fair Shares | 5/5, eval ready | No |
| `times-a-whole` | Jump Line | 6/6, eval ready | No |
| `recut-to-add` | Recut and Join | 5/5, eval ready | No |
| `part-of-a-part` | Square Cutter | 5/5, eval ready | No |
| `compare-pieces` | Beat the Card | 5/5 (rebuilt batch 4), eval ready | No |
| `ten-for-one` | Ten for One | 5/5, eval ready | No |
| `tenths-hundredths` | Hundred Grids | 5/5, eval ready | No |
| `biggest-place-first` | Card Count | 6/6, eval ready | No |
| `longer-not-bigger` | Decimal Cards | 5/5, eval ready | No |
| `same-on-both-sides` | Pan Balance | 6/6, eval ready | No |
| `equal-groups` | Equal Groups | 5/5, eval ready | No |
| `turn-the-array` | Cookie Trays | 5/5, eval ready | No |
| `two-divisions` | Crate Yard | 5/5, eval ready | No |
| `left-over` | Apple Packing | 5/5, eval ready | No |
| `split-the-array` | Split the Array | 5/5, eval ready | No |
| `undo-it` | Backwards Machine | 5/5, eval ready | No |
| `parts-and-whole` | Cup and Counters | 5/5, eval ready | No |
| `digit-value` | Digit Builder | 5/5, eval ready | No |
| `zero-holds` | Block Number | 5/5, eval ready | No |
| `nearer-ten` | Nearer Ten | 5/5, eval ready | No |
| `shift-the-places` | Place Chart | 5/5, eval ready | No |
| `start-at-zero` | Ribbon Ruler | 5/5, eval ready | No |
| `smaller-unit-more` | Tile the Ribbon | 5/5, eval ready | No |
| `area-and-fence` | Garden Fence | 5/5, eval ready | No |
| `turn-not-arms` | Same Turn | 5/5, eval ready | No |
| `turned-shapes` | Shape Tray | 6/6, eval ready | No |
| `what-makes-it` | Shape Workshop | 6/6, eval ready | No |
| `hidden-cubes` | Hidden Cubes | 5/5, eval ready | No |
| `fold-line` | Paper Folding | 6/6, eval ready (creases healed) | No |
| `hour-hand` | Turn the Clock | 6/6, eval ready | No |
| `picture-key` | Picture Key | 5/5, eval ready | No |
| `one-thing-changes` | Fair Test | 5/5, eval ready | No |
| `material-not-size` | Water Tank | 6/6, eval ready | No |
| `fall-together` | Drop Tower | 6/6, eval ready (hang line healed) | No |
| `shadow-size` | Shadow Stage | 6/6, eval ready (switch healed) | No |
| `pour-it` | Pour It | 6/6, eval ready (stage height healed) | No |
| `still-there` | Kitchen Scale | 6/6, eval ready | No |
| `energy-arrows` | Food Chain | 6/6, eval ready (mirrored) | No |
| `tilt-not-distance` | Tilted Planet | 5/5, eval ready (marker removed); a "distance" problem queued | No |
| `balanced-forces` | Push the Crate | 6/6, eval ready; an unbalanced sliding problem queued | No |
| `needs-a-path` | Bell Tank | 6/6, eval ready | No |
| `complete-loop` | Light the Bulb | 5/5, eval ready (p4 healed) | No |
| `light-to-eye` | Light Paths | 5/5, eval ready (p1/p2 healed) | No |
| `spread-out` | Spread Out | 7/7, eval ready (asks give the ladybug count) | No |
| `last-number` | Count and Move | 6/6, eval ready | No |
| `one-more` | Block Tower | 6/6, eval ready | No |
| `ten-and-some` | Ten and Some | 5/5, eval ready (17 is a card problem) | No |
| `count-on` | Cup Count | 5/5, eval ready | No |
| `match-up` | Match Up | 5/5, eval ready | No |
| `partners` | Partner Frame | 6/6, eval ready | No |
| `same-factor` | Paint Shop | 5/5, eval ready | No |
| `for-one` | For One | 5/5, eval ready | No |
| `through-zero` | Rate Graph | 6/6, eval ready (p3 healed) | No |
| `left-is-less` | Flag the Line | 5/5, eval ready | No |
| `rise-per-run` | Rise and Run | 5/5, eval ready (start pins healed) | No |
| `keep-it-level` | Keep It Level | 6/6, eval ready | No |
| `out-of-hundred` | Percent Grid | 6/6, eval ready | No |
| `any-number` | Tile Patterns | 5/5, eval ready (p1-3 ask which figure) | No |
| `need-or-want` | Five Coins | 5/5, eval ready (ask "need to buy") | No |
| `good-or-service` | Main Street | 5/5, eval ready (workers drawn) | No |
| `both-want` | Trade Mat | 6/6, eval ready (p3 a build problem) | No |
| `map-key` | Map Key | 5/5, eval ready | No |
| `not-enough` | Not Enough Toys | 5/5, eval ready ("fair" dropped) | No |

- 17 of 71 built (wave 1 complete; wave 2 4 of 8), 3 played. All 17 are in the dev panel "Canvas (agent)" saved list and have a journey payload
  (`runtime/testing/w1-payloads/agent-canvas.canvas-<title>.json`).
- None has `serves`, so none is offered in a lesson. Add it only after the user approves a play.
- **Nothing from 11-15 is committed.** The user commits through `/ship`.
- Gates at hand-off: `typecheck:lumina` 0 errors; `test:primitive agent-canvas` passed; full Lumina vitest run passed
  (1,123 files, 21,130 tests); backend `test_lumina_tutor_session_units.py` 62 passed. Full `tsc` was not run.
  `/canvas-eval` was not run on any of the 8. No Gemini call was made by an agent.

### Do next, in this order

1. **DONE 11-15: batch 2** (1.10-1.13), four Opus subagents from one shared brief plus a record each; eval 4/4 ready.
2. **Plays are optional per batch** (USER 11-15, "The process per batch"). Nine canvases are eval-ready and unplayed;
   what to listen for is under "To watch on the plays". A fault a play finds is fixed at its shared cause.
3. **DONE 11-15: batch 3 eval** (`qa/canvas/eval/report-2026-11-15.md`, Batch 3): 4 ready after one heal each
   (`zero-holds` goal refused 3, blank, 5; `nearer-ten` p5 takes 345-349, still refuses 350; `shift-the-places` asks
   no longer say how; `digit-value` scene key). Payloads re-saved, `test:primitive agent-canvas` green.
   **`compare-pieces` REJECTED:** both bars start at one left edge, so the child shades until the edges pass, by eye,
   and no number is shown so the misrule cannot occur. Redesign it in batch 4 (see 1.5).
4. **DONE 11-15 (built; eval 5/5 ready): batch 4, `compare-pieces` redesign plus the rest of wave 2.** Eval healed `ten-for-one` (rod length now always shows its count) and `tenths-hundredths` (amount in either grid; 0.25 gains the add-the-digits misrule, 7). Next: batch 5 (wave 3). Was: `ten-for-one` and `tenths-hundredths` are bracketed (read `ten-first`,
   `ring-the-tens`, `bead-rack`, `decimal-garden` first); `biggest-place-first` and `longer-not-bigger` need the
   principle 7 redesign first (they compare two drawn amounts). Then waves 3-4.
4b. **DONE 11-15: batch 5, wave 3** (8 canvases; eval 8/8 ready unchanged). The same eval swept batch 1's DI canvases (never swept before) and healed three: `add-like-parts` (bottom bar starts uncut, the child cuts it; the add-the-bottoms misrule is now a build; **adds an action, needs a play**), `past-one` (goal needs the named full pies), `wholes-as-fractions` (p2/p3 start finely cut). Probe fix at the class: the monkey picks from controls live at each step (`canvasProbes.ts`), so dimmed-at-rest controls are pressed; `--all` re-probe moved no ready canvas. Out of scope, listed: `truck-trips` p1 monkey 4/8 (an older canvas, already heal). Next: batch 6 (wave 4, measurement and geometry; `turn-not-arms`, `spread-out`, `match-up`, `left-is-less`, `fall-together`, `pour-it` need the principle 7 redesign first).
4c. **DONE 11-16: batch 6, wave 4** (10 canvases; eval 10/10 ready, `fold-line` healed; `qa/canvas/eval/report-2026-11-16.md`). Built and evaluated by a self-paced `/loop`: Opus builders from one shared brief, the eval in a background Opus agent (a loop wake-up cannot start a session; a subagent cannot write the report file, so the coordinator writes it from the agent's reply). Next: batch 7 (science A: `one-thing-changes`, `material-not-size`, `fall-together`, `shadow-size`, `pour-it`, `still-there`), then batch 8 (science B), 9 (wave 5), 10 (wave 6), 11 (social studies).
4d. **DONE 11-16: batch 7, science A** (6 canvases; eval 6/6 ready after 3 heals: `shadow-size` start shadow beside the target frame, `fall-together` two hang heights, `pour-it` empty stage band). Next: batch 8 (science B).
4e. **DONE 11-16: batch 8, science B** (6 canvases; eval 6/6 ready after 4 heals: `energy-arrows` every arrow right passed, `tilt-not-distance` invisible marker walked the probe, `complete-loop` p4 and `light-to-eye` p2 said key about a state the goal changed). Follow-ups run with batch 9: `tilt-not-distance` gains a no-tilt stretched-orbit problem (key "distance"), `balanced-forces` a sliding crate with unbalanced pushes. Next: batch 9 (wave 5, early number).
4f. **DONE 11-16: batch 9, wave 5 plus the two follow-ups** (9 canvases; eval 9/9 ready after 3 heals: `spread-out` asks give the ladybug count so the misrule can occur, `ten-and-some` 17 becomes a card problem, `tilt-not-distance` p5 ask no longer states "no tilt"). Next: batch 10 (wave 6, ratio and algebra), then batch 11 (social studies).
4g. **DONE 11-16: batch 10, wave 6** (8 canvases; eval 8/8 ready after 4 heals: `through-zero` p3 ask, `rise-per-run` start pins drew the key, `any-number` printed rule made substitution, `keep-it-level` empty polish). Shared fixes during batches 9-10: the gate blocks a 7th problem and a rule spec with no polish, and prints the accepted spoken forms; negatives are said "minus/negative N". Next: batch 11 (social studies).
4h. **DONE 11-16: batch 11, social studies** (5 canvases; eval 5/5 ready after 4 heals: `need-or-want` and `not-enough` ask wording a K teacher would dispute, `good-or-service` workers not drawn, `both-want` token copied speech). **All 71 built and evaluated.**
4i. **FIXED 11-16: `test:primitive agent-canvas` was red on `both-want`.** Its p3 is a shown-only build problem between said problems. On the advance from p3 the next problem republished its scene (same item and phase) before the visibility wait started, and the wait, given only a revision that was no longer current, had no item or phase to follow and ended "superseded" (J7-commit-visible). `waitForVisible` now takes the committed snapshot, so it follows a republish of the same item and phase; the transport, `LessonWorkspace` and the test harness pass the receipt's state (test in `waitForVisible.test.ts`). `test:primitive agent-canvas` green.
4j. **Next (the loop stops here; each needs the user):** plays from the eval sheet's ready group (no batch 6-11 canvas is played; the "To watch on the plays" lines say what to listen for); kit item 9 (host `checked` message, decision owed); `serves` for a canvas only after a play is approved; commit through `/ship` (nothing from 11-15 or 11-16 is committed).
5. **DONE 11-15: kit item 4** (next problem without a reload).

### The process per batch (USER 11-15)

Build, eval and repair, then the next batch. **The user does not hand-test each canvas before work continues**:
testing every one by hand is the burden `/canvas-eval` exists to remove.

1. **Build:** the coordinating session briefs one Opus subagent per canvas, re-runs the gate, reads the screenshots,
   saves the payloads and fixes any fault several builders hit at its shared cause (in `src/`).
2. **Eval and repair:** a new session runs `/canvas-eval` on the batch (sweep, screenshot read, heals, sheet, report
   in `qa/canvas/eval/report-<date>.md`). It writes only in the batch's spec folders and `qa/canvas/eval/`.
3. **Fold back:** the coordinator checks the heals, re-saves payloads, runs `test:primitive agent-canvas`, updates
   this file and `WORKSTREAMS.md`, and starts the next batch.
4. **Plays** happen when the user chooses, from the eval sheet's ready group. A fault a play finds is fixed at its
   shared cause and then becomes a probe or a bar item, so the eval catches it next time.

### How a canvas gets built

One canvas is one folder: `qa/canvas/specs/<id>/program.tsx` and `spec.json`. Nothing else is written by hand.

```bash
cd "<abs>/my-tutoring-app" && node scripts/canvas-check.mjs --spec=<id>      # the gate: plays every problem both ways, no model call
cd "<abs>/my-tutoring-app" && node scripts/canvas-payload.mjs --name=<id>    # the journey payload the tests sweep
cd "<abs>/my-tutoring-app" && npm run test:primitive -- agent-canvas          # after new payloads
```

**Division of work that held on batch 1.** One Opus subagent per canvas (Agent tool, `model: opus`), about 2 minutes
each, four in parallel. Each may write only inside its own spec folder. The main session then re-runs the gate, reads
the screenshots in `specs/<id>/plays/`, saves the payload, runs `test:primitive`, and is the only writer of this file,
`WORKSTREAMS.md` and anything under `src/`. Records with hard design choices stay with the main session.

**A subagent brief has these parts** (batch 1's briefs are in the 11-15 session transcript):

- Read first: `.claude/skills/canvas-primitive/SKILL.md`; this file's seven principles and the record; the three
  approved specs (`same-amount-squares`, `whole-matters`, `count-the-spaces`); `canvasStyle.ts`; `sdkSource.ts`.
- The record made concrete: the rule sentence, the picture, the child's action with element ids, the ask pattern, the
  said answer as code (`lumina.answer('5/4', misrules)`), the goal condition, each misrule and its `because`, the five
  problems with params, and what the proof and the miss are.
- The gate facts below, so the subagent does not find them by failing.
- Hard limits: only its own folder; no `serves`; no dev server; no model script; no commit; no `--promote`.
- Report: the gate output, a table of the five problems, what the screenshots show, every deviation and why.

**Gate facts every author hit:**

- **Two problems cannot start on the same screen.** When only the ask differs, the gate blocks it. All four batch 1
  subagents changed a start state or a count to pass (Pie Shop has 3, 2, 2, 4 and 3 pies for this reason). Design a
  visible difference into each problem.
- **The ask cannot contain the answer in any spoken form**, as a whole word or phrase. An answer of 1 fails on "one
  fourth" (write "a fourth"); an answer of 2 fails on "two times" (write "twice"). "fourths" does not match "four".
- **A misrule equal to the answer, or repeating another, is refused.** Programs filter their computed misrules.
- **A spec with `rule` needs** 5 or more problems, a misrule on at least 3, and no answer three times in a row.
- **A proof over 6 steps** wants `"shot": "<name>"` on a middle step.
- **An ask with choices** passes them third, `lumina.answer('second', misrules, ['first', 'second', 'same'])`, and must
  say every choice. No built canvas uses this now (the first `whole-matters` did), so it has had no Live play.
- On this Windows shell a bash heredoc holding quotes fails; write scripts and files with the Write tool.
- **A said fraction accepts every named equal fraction** (11-15, batch 2): a key of 3/4 also takes "six eighths";
  a key of 6/4 takes "three halves" and "one and one half". Whole numbers are not added for a fraction key (4/4 does
  not take "one"), because an ask says "one whole pie". A misrule equal in amount to the key is refused. Write the
  key in the form the picture produces.
- **Whole numbers are said in words to 9,999** (11-15, batch 3): 305 takes "three hundred five" and "three hundred
  and five"; past 9,999 a number is said as digits only.
- **Subagents also run the probes** (`canvas-eval.mjs --spec=<id>`, no `--read`) and clear blocking and major
  findings before reporting (batch 3 brief). Monkey hits on small state spaces were the main finding: `compare-pieces`
  changed a problem because a three-part bar met the goal by chance in 5 of 8 random plays.

### Faults the plays found (all fixed at the shared cause)

Each looked like "canvas behaves differently". Each was a shared rule canvas was the first to hit. Look there first.

| Symptom in the play | Cause | Fix | Evidence |
|---|---|---|---|
| The tutor was cut off mid-sentence, twice, then silent 39 s | The backend floor gate held the floor only when the backend had sent the text that started her turn. A reply to the learner's voice held none, so a queued state note went out 440 ms into it | `backend/app/api/endpoints/lumina_tutor.py`: `FloorGate.expect_reply` on `activity_end`, `take()` on the first model audio, a re-check after the settle | Same signature in the logs of 7 primitives (canvas 3 cuts, curator-brief 5, circuit-workbench 6, di-word-reading 2). Unit test added; user Live replay clean |
| She had to credit an answer twice; one right answer was refused | The observer (JEV) is sent the same facts as the tutor. It read the untouched canvas ("0 parts shaded") beside "That's correct" as an unsolved task: 4 of 5 clear credits scored under its 0.9 bar | The canvas names that fact `shownWork`; `service/typesafe/observeDialogue.ts` leaves it out when the answer was spoken | Real-observer replay of the session's five credits: 0.37-0.97 before, 0.99-1.0 after; corrections still reopen. Canvas needed a second credit on 7 of 15 spoken answers in November logs, spoken-only primitives 1 of 22. User Live replay clean |
| Blank results screen after a session answered only by voice | The shared progress hook recorded a result only on a checked answer; each primitive had to record a spoken credit itself. 44 did, canvas and 4 others did not | `components/live-activity/runtime/useWorkspaceProgress.ts` records a result on any credit | A test plays a voice-only session and fails without the fix. Full suite green. User saw the results screen |

How each was found, for the next one: the session ledgers are in `backend/logs/lumina-sessions/*.jsonl`
(`text-to-gemini`, `barge-in`, `activity-signal`, `dialogue-observation`, `ai-transcript`, `user-transcript`). The
observer can be replayed for free by calling `observeDialogue` through vite's module runner, the way
`scripts/spoken-miss-probe.mjs` does: remove one fact at a time and read P(correct).

### Still open

- **Mic turn has no maximum length** (`hooks/voiceTurnMachine.ts`). Room noise held the mic open 26 s in one session
  and opened it three times in 10 s in another. The user has not decided on a cap. Kit item 2.
- **`shownWork` has one user.** `practice-studio` and `life-lab` also take said-or-shown answers and may repeat
  credit the same way; nobody has looked. Executor: `/review-live-wiring`.
- **Noise is transcribed as words** ("¿Qué?", "perro"). One made the tutor start help, one made her ask again.
- **Seven seconds of silence** before one item in the first session: the state note went out and she did not speak
  until the learner made a sound. Cause not found.
- **No canvas has a lever** (kit item 6), and each problem reloads the frame (kit item 4).
- **The Gemini author** has the say-and-show prompt and checks but no real run (kit item 8).
- `/review-live-wiring agent-canvas` has not been run (kit item 7).
- Standards codes in the records are from memory. Canvases in brackets were not read.

### Themes from the evals (fold into every builder brief)

Patterns seen in two or more canvases of a batch. Each is either fixed at its shared cause (marked FIXED) or a rule
for the next brief.

1. **(batch 6, 5 canvases) Controls beside the picture instead of on the thing.** Put the child's hand on the object: drag
   the arm, drag a tile from a bin, drag the layer off. A stepper only where one step is the unit the child counts;
   no more than two buttons outside the picture.
2. **(batch 6, 3) The ask names the move, so only speech tests the rule.** Each record says which half carries the rule,
   Check or speech. Where speech carries it, add a problem whose goal is not a move (`hour-hand` p6, the old clock).
3. **(batch 6, 4) Random play meets an exact target 1 time in 8.** Put a stepper key 5 or more steps from the start;
   trays need several non-examples; pair each 0-answer problem with an earlier one where keeping is required.
4. **(batch 6, 4) Problem 1's misrule agrees with the key and is filtered.** Plan the 3 misrules on problems 2-5.
5. **(batch 6, 3) FIXED: the same-first-screen check compared text and scene only**, so geometry-only differences were
   blocked and builders put sizes in the scene (one leaked the count). `canvas-check` now compares rest pixels; same
   facts with a different picture is an advisory: name in the scene what differs, never the count.
6. **(batch 6, 2) FIXED: control-overlap fired on overlap drawn on purpose** (isometric cubes, bands inside a shape).
   `canvasProbes.ts` counts a pair only when a control cannot be hit at its own centre. A closed stack's hidden cubes
   still report it at rest, correctly.
7. **(batch 6, 4) Record order breaks the gate.** Builders reorder freely to keep the minimal pair adjacent and avoid an
   answer three times in a row, and say so.
8. **(batch 7, 2) A drawn target beside the live quantity gives the answer.** `shadow-size`'s frame beside the starting
   shadow said "bigger" or "smaller" before any reasoning. When the goal is a drawn target (frame, mark, outline), hide
   the live quantity at rest, behind the child's first move.
9. **(batch 7, 4) The world never reacts after Check**, because the host never tells the program Check was pressed. Science
   canvases want "commit, then watch". Kit item 9.
10. **(batches 6-7, 2) A fixed viewBox height leaves empty bands** (`pour-it`, `hidden-cubes`). Size the viewBox per
    problem; read the shortest problem's rest screenshot.
11. **(batch 7) Science pictures keep the physics the rule depends on.** `fall-together` hung things at two heights, so
    half would land first. Draw every quantity the rule depends on equal unless it is the variable.
12. **(batch 7, 3) Answers that alternate or repeat give a pattern** (strict sink/float alternation). Break strict
    alternation on two-choice canvases.
13. **(batch 8, 2) The said key is about the start state while the goal changes it** (`complete-loop` p4 showed NO beside
    a lit bulb; `light-to-eye` p2 switched the lamp on). The said answer is about the state the goal leaves, or about
    something the child cannot change. "Predict, then change it" is two problems, never one.
14. **(batch 8) The layout carries the answer** (`energy-arrows`: every eater on the right, so all-right passed). Vary
    left-right placement across problems; a minimal pair keeps one picture.
15. **(batch 8) Invisible proof markers are monkey targets** (`tilt-not-distance`: a 1px marker moving with the planet
    walked random drags to the goal). Give an id only to what a proof uses. If it repeats: `canvasProbes.ts`
    `liveTargets` skips transparent named elements under ~4px.
16. **(batch 8, 2) A cause question has one key on every problem** (`tilt-not-distance` "tilt", `balanced-forces` sliding
    always "stays the same"). Include one case where the rule gives the other answer.
17. **(batch 8) Say in `polish` what the picture leaves out** (`needs-a-path`'s bell swings the same in water).
18. **(batch 9, 2) A said misrule needs its number in front of the child** (`spread-out` misrule was the ladybug count, never
    told; `ten-and-some` digit misread with no numeral printed). For each misrule, say where its number comes from:
    printed, said in the ask, or counted.
19. **(batch 9) The ask must not state the fact that decides the key** (`tilt-not-distance` p5 "has no tilt"). The ask names
    the task; the picture carries the deciding fact.
20. **(batch 9, 4) Early-number keys can be counted off the screen**, so speech tests the rule only with a competing number
    (a lure) in the ask or picture. Each K record names its lure.
21. **(batch 9) One-move goals** ("one more") are exempt from theme 3's five-step rule; such a canvas needs one Check problem
    whose goal is not a move (`one-more` p5, make six).
22. **(batch 9) When the rule includes a strategy** (`count-on`: start from the bigger pile), the record says whether Check
    tests the strategy or only the result, and gives the tutor a line for a right total by the slower way.
23. **(batch 9, 2) FIXED: a 7th problem passed the gate but cannot be delivered** (`spread-out`, `balanced-forces`: the
    payload loader refused them, since `validateAgentCanvasData` caps a lesson at 6). `canvas-check` now blocks more than 6;
    both specs were trimmed to 6.
24. **(batch 10, 2) FIXED: negative numbers had no spoken forms** (`left-is-less` -7, `rise-per-run` -2/3).
    `spokenForms` now adds "minus ..." and "negative ..." (test added).
25. **(batch 10) The start state draws the key** (`rise-per-run`: the starting pins drew the key's run and rise). Any reading
    drawn at rest must give no key or misrule; list the rest values in `polish`.
26. **(batch 10, 2) A unique ask marks a problem as special** (`through-zero` p3 alone named the line to draw; `any-number`).
    Change the goal and keep the ask's wording like its neighbours.
27. **(batch 10) A printed rule turns the said question into substitution** (`any-number`). On faded-support problems the
    question undoes or compares the rule, never just fills it in.
28. **(batch 10, 2) The world's honest reaction is a verdict before Check** (`same-factor`'s stirred colour, `keep-it-level`'s
    beam): Start over or trial reaches the key. Kit item 9; until then each record names its trial path.
29. **(batch 10) FIXED: the gate prints the spoken forms the tutor accepts, and blocks a rule spec with no `polish`**
    (`canvas-check`).
30. **(batch 10) Check every record problem against the canvas's actions before building** (`keep-it-level`'s "half a bag"
    needs a doubling action; replaced).
31. **(batch 11, 2) For a judgement rule, the ask's word decides whether the key holds** (`need-or-want` "are needs" made a
    coat you own three of disputable; `not-enough` "fair"). The ask uses the word the action means (buy, give out),
    never a value word the class uses differently.
32. **(batch 11) Draw who acts** (`good-or-service`: car + sponge reads as a shop). A rule about work or a cause shows the
    actor; the scene names only what is drawn.
33. **(batches 6-11, 3) A two-choice token copies the said answer** (`both-want`; close in `what-makes-it`,
    `balanced-forces`). A two-choice canvas needs one build problem where Check carries the rule.
34. **(batch 11) Write K asks without number words**: one is usually some problem's key (`not-enough` "only one").

## What makes a canvas a DI canvas

1. **One rule, stated in the spec.** "The same amount takes more parts when the parts are smaller." Not a skill, not a standard.
2. **A range of examples.** 5 or more problems on one program through `params`: the rule holding in easy cases, in a
   case that looks different, and in a new case the child has not seen (the transfer item).
3. **A minimal pair.** Two adjacent problems that differ in one thing, so the child sees which feature the rule depends on.
4. **A case where the misrule gives a different answer.** If the wrong rule and the right rule agree, the item tests nothing.
5. **A named misrule.** `lumina.answer(value, [{ says, because }])`, so the tutor can tell a slip from a wrong rule.
6. **Nothing printed that answers it.** No counts, no verdict colours, no labels that carry the key.
7. **The child changes the thing the rule is about (user play, 11-15).** The first `whole-matters` drew two shaded
   amounts and asked which was more. A child answers that by eye, so the rule is never used and the named wrong rule
   cannot occur. The rebuild lets the child stretch the whole, which is the variable the rule is about. A record whose
   answer is "first", "second" or "same" over two drawn amounts needs this redesign before it is built.

## Where a canvas is the right tool

Build a DI canvas when all three hold:

- the rule can be seen in a picture the child changes;
- the answer is one value a child can say (a number, a word, yes or no);
- the known wrong answer comes from a wrong rule, not from a slip.

Do not build one for:

- **Phonics, word reading, spelling.** These need the word library, the mic and phoneme judging. They go to the `di-*`
  specialists (K LA audit, WORKSTREAMS row 22).
- **Fact fluency.** An item space picks the facts; a canvas adds nothing.
- **Open speech** (retell, explain, give a reason). `oral-sentence-studio`, `story-ribbon`, the `teach` surface.
- **Building a system** (a circuit, a boat). The science build worlds already do this. A canvas takes the one
  discrimination a world does not isolate.

## Kit work, in order

Each item is built once in the kit or the host, so every canvas gains it. Items 1 and 2 block everything after them.

| # | Work | Why | Owner |
|---|---|---|---|
| 1 | **DONE 11-15** (user replay: each answer credited once, no cut-offs). Replay `same-amount-squares` in a Live session: say the right answer, say the misrule answer, ask for help before answering | Say and show has no clean Live run yet | user |
| 2 | Cap on one open mic turn (`voiceTurnMachine.ts`) | Room noise held the mic open 26 s and blocked the tutor | decision owed |
| 3 | **BUILT 11-15** (`spokenForms`, `choices`; numbers to 100, mixed numbers). Spoken forms beyond 0-20: fractions ("one fourth"), decimals, yes/no, comparison words (more, less, same, first, second) | 48 of the 71 canvases below are answered with these, not a small whole number | `canvasSpoken.ts` |
| 4 | **BUILT 11-15.** Next problem without reloading the frame: the page shell (`gen-display/document.ts`) mounts the program fresh from params posted by the host (`CanvasFrame` `swap`, `source: 'lumina-host'`); Start over posts the same params again. A page built before the change (no listener) still reloads per problem. Checked in Chromium on three canvases (one load, each problem's proof meets its goal) and in the running app's dev panel (Jump Line: Next and Start over on the same frame, zero reloads) | DI moves through examples quickly; a reload between each breaks the minimal pair | `CanvasFrame.tsx`, `AgentCanvas.tsx`, `document.ts` |
| 5 | **BUILT 11-15** (`ruleIssues`, on a spec with `rule`; the no-repeat check is three in a row, since a minimal pair may share an answer). Gate checks for a DI spec: a problem where the misrule answer differs from the key, no answer repeated on adjacent problems, 5 or more problems | Turns rules 2-4 above into a blocked spec, not a convention | `canvas-check.mjs` |
| 6 | Levers the program declares (show the cut lines, overlay the two wholes, a simpler case) | A canvas has no help today; correction is words only | `/agent-primitive` (I13), `/add-support-tiers` |
| 7 | `/review-live-wiring agent-canvas` | Closes the say-and-show wiring | skill |
| 9 | A host-to-program `checked` message (after Check is judged), so a canvas can play the drop, pour or melt once the child has committed, without a verdict before it | Batch 7 eval: four science canvases end with nothing happening; the rule is never seen working | `CanvasFrame.tsx`, `gen-display/document.ts`, `sdkSource.ts`; decision owed: whether the reaction may show after a wrong Check |
| 8 | Same prompt section and checks in the Gemini author | Both authors write to one spec | `canvasAuthor.ts` (prompt built; no real run yet) |

## How to read a record

- **Rule:** the one sentence the canvas teaches.
- **Child does:** the action in the picture that shows the answer (the Check path).
- **Says:** the spoken answer the tutor judges. "Shown only" means the discrimination cannot be heard in one value.
- **Misrule:** the wrong rule, and the answer it produces.
- **Problems:** the range. P marks the minimal pair, T the transfer item.

## Wave 1: fractions, G3-5 (13 canvases, all built 11-15; 1.5 built in batch 3, eval owed)

First because the misconceptions are the best documented and almost all are whole-number rules applied to fractions.

### 1.1 `same-amount-squares` (BUILT, PLAYED and approved 11-15; 3.NF.A.3)
- **Rule:** the same amount takes fewer parts when the parts are bigger and more when they are smaller.
- **Child does:** shades parts of a second square cut a different way.
- **Says:** the number of parts to shade.
- **Misrule:** shade the same number of parts as the first square.
- **Problems:** 2/8 as fourths (1) · as sixteenths (4) · as 2x2 fourths (1) · 1/3 as sixths (2) · T: 2/4 as sixths (3).

### 1.2 `equal-parts` (BUILT 11-15, gate 5/5, PLAYED 11-15: worked; 3.G.A.2, 3.NF.A.1)
- **Rule:** fourths are four equal parts of the whole; four unequal parts are not fourths.
- **Child does:** taps every shape in a tray of four whose shaded part is one fourth.
- **Says:** how many of the shapes show one fourth.
- **Misrule:** counts four parts and ignores their size, so every shape with four parts counts.
- **Problems:** two squares cut evenly, two cut plainly unevenly (2) · P: the same square with one cut line moved a little (1) · equal parts that look different: a square cut by diagonals and one cut into strips (both count; catches "parts must look alike") · a circle cut by three parallel lines against one cut by two diameters (1) · T: the same judgement for thirds and sixths.

### 1.3 `whole-matters` (BUILT 11-15, gate 5/5, PLAYED and approved 11-15; shown as Stretch the Whole; 3.NF.A.3d)
- **As built (second version, 11-15):** the child drags the edge of their own rectangle to stretch or shrink the WHOLE until its shaded fraction is the same amount as the first rectangle's, and says how many squares wide it is (4, 8, 6, 4, 8). The first version (tap the rectangle with more shaded) was dropped after the user's Live play: the answer could be seen by eye and the named wrong rule could not occur.
- **Lesson for the other records:** a compare-two-pictures task with the amounts drawn is a perception task. `smaller-pieces` (1.4) and `compare-pieces` (1.5) have the same shape and need a design where the child makes or changes the thing the rule is about.
- **Rule:** a fraction is an amount of its whole; half of a big whole is more than half of a small one.
- **Child does:** drags a shaded piece from one shape onto the other to compare them.
- **Says:** "first", "second" or "same".
- **Misrule:** the same fraction name means the same amount ("same").
- **Problems:** half of a big square against half of a small one (first) · P: half against half of equal squares (same; the misrule agrees, so this is the positive case) · half of a small square against a quarter of one four times the size (second) · half of a small against a quarter of one twice the size (same; catches "the bigger whole always wins") · T: strips of different lengths.

### 1.4 `smaller-pieces` (BUILT 11-15 by an Opus subagent, gate 5/5 re-run and screenshots read by the main session, play owed; shown as Cut the Bar; 3.NF.A.3d)
- **Rule:** the more equal parts a whole is cut into, the smaller each part.
- **Redesigned 11-15 (principle 7).** The first design (tap the bigger of two pieces) was a comparison by eye.
- **Child does:** sets how many equal parts their bar is cut into, with a stepper, to make each piece a named size
  against the first bar's pieces.
- **Says:** how many parts their bar has.
- **Misrule:** half the size means half the number (the first bar is in fourths, pieces half as big: "two", not eight).
- **Problems:** fourths, pieces half as big (8) · P: fourths, pieces twice as big (2) · sixths, pieces twice as big (3) · halves, pieces a third as big (6) · T: thirds, pieces a fourth as big (12).

### 1.5 `compare-pieces` (REBUILT 11-15 in batch 4 as Beat the Card; eval owed; 3.NF.A.3d)
- **Beat the Card (batch 4):** the first amount is only a printed fraction on a card; the child shades the fewest parts
  of their own bar (other parts) that make more, and says how many. Problems 1/8 on eighths (2) · P: 1/8 on fourths (1;
  misrule 2) · 3/4 on eighths (7; misrules 4, 3) · 1/2 on eighths (5) · T: 2/3 on sixths (5). Goes past the letter of
  3.NF.A.3d (equivalence with one denominator dividing the other).
- **Eval 11-15 rejected Beat the Bar:** the two bars share a left edge, so shading until the edges pass is read by eye;
  no number is shown, so "compared the top and bottom numbers" cannot happen. Eval's option: give the first amount as
  a said or written fraction name with no first bar ("three fourths"); the child shades their own bar (other parts) to
  beat it; Check uncovers the first bar under theirs. Then part size decides and the bigger-numbers misrule can occur.
- **Needs redesign before building (principle 7):** as written the child compares two drawn amounts. One option: the
  first bar is fixed, and the child shades the fewest of their own parts that make more than it, then says how many.
- **Rule:** with parts of the same size, more parts is more; with the same number of parts, bigger parts is more.
- **Child does:** shades both bars to the given fractions, then taps the larger amount.
- **Says:** "first" or "second".
- **Misrule:** bigger numbers make a bigger fraction. It gives the right answer with like denominators and the wrong one with like numerators.
- **Problems:** 3/8 v 5/8 (second) · P: 3/8 v 3/4 (second; the misrule says first) · 2/6 v 4/6 · 2/6 v 2/3 · T: 5/6 v 5/8 with the bars covered until Check.

### 1.6 `count-the-spaces` (BUILT 11-15 as a new program, gate 5/5, play owed; shown as Number Line Dot; 3.NF.A.2)
- **As built:** the dot is fixed and the child names its fraction (says it, or sets a top and bottom number); `fraction-number-line` keeps the place-the-marker task.
- **Rule:** on a number line the denominator is the number of equal spaces from 0 to 1, not the number of marks.
- **Child does:** drags a marker to the named fraction.
- **Says:** how many equal spaces there are from 0 to 1, then the fraction at a marked point.
- **Misrule:** counts the marks, so a line cut into fourths (five marks) is read as fifths.
- **Problems:** fourths · thirds · P: a line from 0 to 2 with the same mark spacing as the fourths line (still fourths) · sixths with the marker at 5/6 · T: a line that starts at 1.
- **Known leak to remove:** the 11-10 Gemini run labelled every tick and showed the marker's value.

### 1.7 `past-one` (BUILT 11-15 by an Opus subagent, gate 5/5 re-run and screenshots read by the main session, play owed; shown as Pie Shop; 3.NF.A.2b, 4.NF.B.3)
- **As built:** the ask names a mixed amount ("one whole pie and one fourth of the next"), the child shades slices and says the fraction (4/4, 5/4, 3/2, 7/4, 7/3). The pie count varies (3, 2, 2, 4, 3) because the gate blocks two problems with the same first screen.
- **Rule:** the whole sets the size of the part; five fourths is one whole and one more fourth.
- **Child does:** shades five fourths across two pies.
- **Says:** the fraction of one pie that is shaded ("five fourths").
- **Misrule:** counts every part in both pies as the denominator ("five eighths"); or stops at four because a fraction cannot pass the whole.
- **Problems:** P: 4/4 then 5/4 · 3/2 · 7/4 · 8/4 (two wholes) · T: 7/3 on a number line.

### 1.8 `wholes-as-fractions` (BUILT 11-15 by an Opus subagent, gate 5/5 re-run and screenshots read by the main session, play owed; shown as Cut the Wholes; 3.NF.A.3c)
- **As built:** one stepper cuts every whole the same way; the child says the total parts (4, 4, 9, 6, 12).
- **Rule:** a whole number is a fraction: 3 wholes are 6 halves.
- **Child does:** cuts each whole into the named parts.
- **Says:** how many parts there are in all.
- **Misrule:** says the number of wholes, or the number of parts in one whole.
- **Problems:** 1 as fourths (4) · 2 as halves (4) · P: 3 as thirds (9) then 3 as ones (3) · 2 as sixths (12) · T: 4 on a number line marked in fourths (16).

### 1.9 `add-like-parts` (BUILT 11-15 by an Opus subagent, gate 5/5 re-run and screenshots read by the main session, play owed; shown as Join the Pieces; 4.NF.B.3a)
- **As built:** the child taps shaded pieces down into an empty bar (a second bar past one whole) and says the sum (3/4, 5/6, 6/8, 7/8, 5/4). No subtraction item.
- **Rule:** adding fourths to fourths gives fourths; the size of the part does not change.
- **Child does:** drags the shaded pieces of two bars into one empty bar.
- **Says:** the sum as a fraction ("three fourths").
- **Misrule:** adds the tops and adds the bottoms ("three eighths").
- **Problems:** 1/4 + 2/4 · 2/6 + 3/6 · P: 3/8 + 3/8 then 3/8 + 4/8 · 3/4 + 2/4 (five fourths; needs a second bar) · T: 5/6 - 2/6.

### 1.10 `fair-shares` [`pizza-share`, `brownie-pans`] (5.NF.B.3)
- **Rule:** sharing 3 wholes among 4 gives each one 3/4.
- **Child does:** cuts the wholes and deals the pieces to the plates.
- **Says:** how much one plate gets.
- **Misrule:** puts the bigger number on the bottom whatever the story says, or says "one fourth" (counts the cut, not the pieces dealt).
- **Problems:** 1 among 4 · 3 among 4 · P: 4 among 3 (four thirds) · 2 among 3 · T: 5 among 2.

### 1.11 `times-a-whole` (4.NF.B.4)
- **Rule:** three jumps of 2/5 is 6/5; multiplying by a whole number counts more of the same part.
- **Child does:** sets the number of jumps on a number line marked in fifths.
- **Says:** where the jumps land.
- **Misrule:** multiplies top and bottom ("six fifteenths").
- **Problems:** 2 x 1/3 · 3 x 2/5 · P: 3 x 1/4 then 3 x 2/4 · 4 x 1/2 (two) · T: how many jumps of 2/3 reach 2.

### 1.12 `recut-to-add` (5.NF.A.1)
- **Rule:** parts of different sizes cannot be counted together; recut them to the same size first.
- **Child does:** recuts one or both bars with a stepper until the parts match, then joins them.
- **Says:** the sum.
- **Misrule:** adds tops and bottoms (1/2 + 1/4 = "two sixths").
- **Problems:** 1/2 + 1/4 · 1/3 + 1/6 · P: 1/2 + 1/3 (both must be recut) · 3/4 - 1/2 · T: 2/3 + 1/4.

### 1.13 `part-of-a-part` (5.NF.B.4)
- **Rule:** a fraction of a fraction is a smaller part of the whole.
- **Child does:** shades a third of the square one way, then half of that the other way.
- **Says:** the fraction of the whole square shaded twice.
- **Misrule:** multiplying makes it bigger, or adds the fractions.
- **Problems:** 1/2 of 1/2 · 1/2 of 1/3 · P: 1/3 of 1/2 (same answer, cut the other way) · 2/3 of 1/2 · T: 3/4 of 2/3.

## Wave 2: place value and decimals, G1-5 (8)

| Canvas | Rule | Child does | Says | Misrule and its answer | Problems |
|---|---|---|---|---|---|
| `ten-for-one` [`ten-first`, `ring-the-tens`, `bead-rack`] (1.NBT.B.2) | Ten ones make one ten, and a ten counts as ten | Rings loose cubes into tens | The number | Counts each ten as one: 3 tens and 4 ones is "seven" | 14 · 34 · P: 43 · 40 (no ones) · T: 104 |
| `digit-value` (2.NBT.A.1) | A digit's value comes from its place | Builds the value of the underlined digit with blocks | The value ("thirty") | Face value ("three") | 38 · P: 83 · 308 · 333 (one digit, three values) · T: a four-digit number |
| `zero-holds` (2.NBT.A.3) | Zero holds an empty place | Sets digit dials to match the blocks shown | The number | Leaves the empty place out: 3 hundreds 5 ones is "thirty-five" | 305 · P: 350 · 35 · 3,005 · T: 4,050 |
| `biggest-place-first` (2.NBT.A.4) | Compare the biggest place first | Uncovers one place of each number to decide | "first" or "second" | Compares the ones, or adds the digits: 299 beats 301 | 52 v 39 · 299 v 301 · P: 480 v 408 · 1,002 v 999 · T: 3.2 v 2.9 |
| `tenths-hundredths` [`decimal-garden`] (4.NF.C.6) | Each place to the right is ten times smaller: 0.3 is 30 hundredths | Shades a hundred grid | How many small squares | Reads 0.3 as 3 hundredths ("three") | 0.3 · P: 0.03 · 0.30 (same as 0.3) · 0.25 · T: 1.4 |
| `longer-not-bigger` (4.NF.C.7, 5.NBT.A.3b) | Compare decimals place by place; length does not decide | Builds both on grids | "first", "second" or "same" | More digits is bigger (0.35 over 0.5); the reverse rule, shorter is bigger, is caught by 0.5 v 0.75 | 0.5 v 0.35 · 0.5 v 0.75 · P: 0.4 v 0.40 · 0.09 v 0.1 · T: 1.2 v 1.15 |
| `shift-the-places` (4.NBT.A.1, 5.NBT.A.2) | Times ten moves every digit one place left | Slides digit tiles on a place chart | The new number | "Add a zero": 2.5 x 10 is 2.50 | 25 x 10 · P: 2.5 x 10 · 0.25 x 10 · 250 ÷ 10 · T: x 100 |
| `nearer-ten` (3.NBT.A.1) | Rounding asks which ten the number is nearer | Drags the number onto a line between two tens | The nearer ten | Keeps the tens digit and drops the ones (37 is "thirty") | 32 · P: 37 · 35 · 96 (one hundred) · T: 349 to the nearest hundred |

## Wave 3: what the operations mean, G1-4 (8)

| Canvas | Rule | Child does | Says | Misrule and its answer | Problems |
|---|---|---|---|---|---|
| `same-on-both-sides` (1.OA.D.7) | The equals sign means both sides are the same amount | Adds dots to one pan until the balance is level | The missing number | "The answer comes next": 8 + 4 = _ + 5 is "twelve" | 3 + 4 = _ · 8 = _ + 3 · P: 8 + 4 = _ + 5 · 5 = 5 (yes or no) · T: 6 + _ = 4 + 7 |
| `equal-groups` (3.OA.A.1) | Multiplication counts groups of the same size | Moves items between plates until the groups are equal | How many in each group | Any groups count: plates of 4, 4 and 5 are "three fours" | 3 plates of 4 · P: plates of 4, 4, 5 (move one: not possible, say "no") · 12 on 3 plates · 12 on 4 plates · T: 20 on 4 plates |
| `turn-the-array` (3.OA.B.5) | Turning an array does not change the total | Presses Turn, with part of the array covered | The total after the turn | Treats the turned array as a new problem and counts what is visible | 3 x 5 · 2 x 7 · P: 6 x 4 half covered · 1 x 8 · T: 7 x 3 is 21, array covered, what is 3 x 7 |
| `two-divisions` [`truck-trips`] (3.OA.A.2) | Division answers two questions: how many in each group, or how many groups | Deals crates onto trucks | The number and what it counts ("four trucks") | Builds the number in the question as groups either way. The number said is the same, so the picture carries this one | 12 crates on 3 trucks · P: 12 crates, 3 per truck · 15 and 5 both ways · T: 18, 6 per truck |
| `left-over` [`remainder-depot`] (3.OA, 4.OA.A.3) | The remainder is what cannot make another full group | Fills groups of the given size | How many are left over | Makes a short last group ("none left"), or gives the number of groups | 13 in fours (1) · 14 in fours (2) · P: 12 in fours (0) · 14 in fives (4) · T: 14 children, 4 to a car, how many cars |
| `split-the-array` (3.OA.B.5) | A big product is two smaller products added | Drags a line that splits the array into two known facts | The total | Gives one part only, or multiplies the two parts | 6 x 7 · 8 x 6 · P: 12 x 4 split at ten · 7 x 7 · T: 14 x 5 |
| `undo-it` [`zero-machine`] (1.OA.B.4, 2.OA.A.1) | Adding and subtracting undo each other | Runs the machine backwards from its output | The number that went in | Applies the rule again: + 5 gave 12, so "seventeen" | + 3 gave 8 · + 5 gave 12 · P: - 4 gave 6 (ten) · two steps · T: doubled gave 10 |
| `parts-and-whole` [`two-ways`] (K.OA.A.3, 1.OA.B.4) | If the whole stays and one part grows, the other part shrinks by the same amount | Moves counters between two piles, one covered | How many are under the cover | Says the whole, or the pile that can be seen | 5 as 4 and _ · 7 as 2 and _ · P: 7 as 3 and _ · 10 as 6 and _ · T: 10 as 10 and _ |

## Wave 4: measurement and geometry, K-5 (10; all built 11-16 in batch 6, eval 10/10 ready)

| Canvas | Rule | Child does | Says | Misrule and its answer | Problems |
|---|---|---|---|---|---|
| `start-at-zero` [`fair-measure`] (2.MD.A.1) | Length is the number of units between the two ends | Slides a ribbon along a ruler | The length | Reads the number at the far end (a ribbon from 2 to 7 is "seven"), or counts marks ("six") | 0 to 4 · 2 to 7 · P: 1 to 5 (same length as the first) · a ruler broken off at 3 · T: half-unit marks |
| `smaller-unit-more` (2.MD.A.2) | A smaller unit gives a bigger count for the same length | Lays long tiles, predicts, then lays short tiles | "more" or "fewer", then the count | A bigger unit gives a bigger number | long 3, short 6 · long 2, short 6 · P: same tiles, longer ribbon · T: Ana counted 4 and Ben 8 on one ribbon; whose unit is bigger |
| `area-and-fence` [`patio-pavers`] (3.MD.D.8) | Shapes with the same area can have different perimeters | Builds a rectangle from 12 tiles | The length of fence around it | Same tiles, same fence (repeats the last answer), or gives the area ("twelve") | 3 x 4 (14) · P: 2 x 6 (16) · 1 x 12 (26) · fence fixed at 16: 4 x 4 against 2 x 6, say the tiles · T: an L shape |
| `turn-not-arms` (4.MD.C.5) | An angle's size is how far one arm has turned from the other | Turns one angle onto another | "first", "second" or "same" | Longer arms make a bigger angle | same turn, long and short arms (same) · small turn long arms v big turn short arms · P: near-equal turns · T: a clock hand and a pie slice |
| `turned-shapes` (K.G.A.2, 1.G.A.1) | A shape keeps its name when turned, stretched or resized | Taps every triangle in a tray | How many triangles | Only the point-up, equal-sided one is a triangle; a turned square is a "diamond" | upright and turned · a long thin triangle · non-examples: open, a curved side, four sides · P: a square and the same square turned · T: hexagons |
| `what-makes-it` (3.G.A.1) | A shape's name comes from its sides and corners: a square is a rectangle | Drags one corner of a rectangle, or changes its size and colour | "yes" or "no": is it still a rectangle | Looks decide: a rectangle must be long, so a square is not one; a slanted shape with two long sides is one | bigger (yes) · recoloured (yes) · P: one corner pulled (no) · made square (yes) · T: is every rhombus a square |
| `hidden-cubes` [`cube-crate`] (5.MD.C.4) | Volume counts every cube, including the ones that cannot be seen | Lifts the stack apart layer by layer | The number of cubes | Counts only the cubes or faces in view (2 x 2 x 2 is "seven") | 2 x 2 x 2 · 3 x 2 x 2 · P: 3 x 3 x 2 then 3 x 3 x 3 · T: a closed box with only its three sizes |
| `fold-line` (4.G.A.3) | A line of symmetry folds the shape exactly onto itself | Turns a line and presses Fold | How many lines of symmetry | Any line that cuts the shape in half counts, so a rectangle has "four" | square (4) · P: rectangle (2) · a triangle with two equal sides (1) · parallelogram (0) · T: capital letters |
| `hour-hand` (1.MD.B.3) | The hour is the number the short hand has passed | Drags the minute hand and watches the hour hand | The hour | Names the number the short hand is nearest: 4:50 is "five" | 4:00 · 4:30 · P: 4:50 then 5:10 · T: the long hand hidden, about what time |
| `picture-key` [`class-vote`] (3.MD.B.3) | In a picture graph each picture stands for the number in the key | Adds pictures to a row to show a count | How many votes | Counts pictures as ones | key of 1 · key of 2 · P: the same row with a key of 5 · a half picture · T: how many more than another row |

## Wave 5: early number, K-1 (7)

| Canvas | Rule | Child does | Says | Misrule and its answer | Problems |
|---|---|---|---|---|---|
| `spread-out` (K.CC.B.4, K.CC.B.5) | Moving things apart does not change how many | Drags a row of counters apart or together | How many now | A longer row is more | 5 close then spread · 6 and 6, one spread ("same") · P: 5 spread v 6 close (which has more) · a ring · T: rearranged under a cover |
| `last-number` (K.CC.B.4b) | The last number counted says how many | Taps each object once | How many | Counts again when asked, or says the next number | 3 · 5 · 7 scattered · P: 7 counted from the other end · T: 10 in two rows |
| `one-more` (K.CC.B.4c) | One more is the next counting number | Adds one cube to a tower | The new count | Keeps the old number, or starts again from one and loses count | 3 to 4 · 6 to 7 · 9 to 10 · P: 7 to 6 (one less) · T: 12 to 13 |
| `ten-and-some` [`ten-first`] (K.NBT.A.1) | A teen number is ten and some more | Fills a ten frame and leaves the rest loose | The number | Reads 14 as 1 and 4 ("five") | 11 · 14 · 17 · P: 10 (none loose) · T: 20 as two tens |
| `count-on` (1.OA.C.5) | Start from the pile already counted and count on | Taps only the loose counters beside a covered, labelled pile | The total | Counts only what can be seen ("three"), or starts from one | 5 and 2 · 8 and 3 · P: 3 and 8 (start from the bigger) · 9 and 4 · T: 18 and 3 |
| `match-up` (K.CC.C.6) | The group with some left after matching has more | Drags lines to match two groups one to one | "first", "second" or "same" | Bigger objects, or a longer row, is more | 4 big v 6 small · 5 v 5 in rows of different length · P: 6 v 7 · T: how many more |
| `partners` (2.OA.C.3) | A number is even when every one has a partner | Pairs up counters | "even" or "odd" | Judges by the tens digit or by size: 30 is odd, 12 is odd | 6 · P: 7 · 12 · 13 · T: 30 and 21 with no counters |

## Wave 6: ratio and algebra, G5-8 (8)

| Canvas | Rule | Child does | Says | Misrule and its answer | Problems |
|---|---|---|---|---|---|
| `same-factor` (6.RP.A.3) | Equivalent ratios multiply both amounts by the same number | Adds cups of two colours until the mix matches the sample colour | How many cups of the second colour | Adds the same amount to both: 2 to 3 becomes 6 to "seven" | 2:3 to 4:? · 2:3 to 6:? · P: 6:9 back to 2:? · 1:4 to 3:? · T: 5:2 to 15:? |
| `for-one` (6.RP.A.2) | A unit rate is how much for one | Shares coins evenly over the items | The price of one | Subtracts (12 for 4 is "eight"), or divides the wrong way | 12 for 4 · 10 for 5 · P: 3 for 12 against 5 for 15, which is cheaper · T: 150 km in 3 hours |
| `through-zero` (7.RP.A.2) | A proportional relationship goes through zero and keeps one rate | Drags a line through plotted points | "yes" or "no": is it proportional | Any straight line is proportional | y = 2x · P: y = 2x + 3 · y = x ÷ 2 · a curve · T: a table with no graph |
| `left-is-less` (6.NS.C.7) | On the number line, further left is less | Places two numbers on the line | The smaller number | The bigger digit is the bigger number: -7 is more than -3 | 3 v 7 · P: -3 v -7 · -2 v 1 · 0 v -5 · T: order -4, 2, -6 |
| `rise-per-run` [`slope-two-points`] (8.EE.B.5) | Slope is the rise for each one unit of run | Drags two points | The slope | Run over rise, or counts grid points and not spaces | the four built problems, plus T: a line read from a table |
| `keep-it-level` (6.EE.B.7) | An equation stays true when both sides change the same way | Removes the same thing from both pans | What one bag holds | Changes one side only: 2x + 3 = 11 gives "eight" | x + 3 = 7 · 2x = 10 · P: 2x + 3 = 11 · 3x + 2 = x + 8 · T: half a bag is 3 |
| `out-of-hundred` (6.RP.A.3c) | A percent is that many out of each hundred of the whole | Shades a hundred grid whose whole is worth a given amount | The amount shaded | The percent is the amount: 20% of 50 is "twenty" | 50% of 80 · 20% of 100 (the misrule agrees) · P: 20% of 50 · 10% of 30 · T: 150% of 20 |
| `any-number` (6.EE.A.2) | A letter stands for any number, and the rule holds for all of them | Sets the figure number on a growing tile pattern | How many tiles in figure 10 | Counts on by the first step only, or treats n as one fixed number | n + 2 · 2n · P: 2n + 1 · 3n - 1 · T: which figure has 25 tiles |

## Science discriminations, K-5 (12, alongside waves 2-4)

Only rules a build world does not already isolate.

| Canvas | Rule | Child does | Says | Misrule and its answer | Problems |
|---|---|---|---|---|---|
| `one-thing-changes` (3-5-ETS1-3) | A fair test changes one thing and keeps the rest the same | Sets up two ramps to test one named thing | How many things differ between the ramps | Changes everything to make one car win | test the surface · test the height · P: a set-up with two differences, find the extra one · T: a plant test (light, water) |
| `material-not-size` (2-PS1-1, 5-PS1-3) | Sinking depends on what a thing is made of, not how big it is | Predicts, then drops blocks in water | "sink" or "float" | Big or heavy things sink, small things float | small steel · P: big wood · wax · a pebble against a log · T: the wood block cut in half |
| `fall-together` (3-PS2-1, 5-PS2-1) | Without air, heavy and light things fall at the same rate | Sets the mass of two balls and drops them | "first", "second" or "same" | The heavier one lands first | same size, different mass · P: air on, feather and ball · air off, feather and ball · T: on the Moon |
| `shadow-size` [`flashlight-room`, `shadow-materials`] (1-PS4-3) | A shadow grows as the object moves toward the light | Slides the object between lamp and wall | "bigger" or "smaller" | A shadow is always the size of the object | toward the lamp · toward the wall · P: the lamp moved, object still · T: two objects, make equal shadows |
| `pour-it` (K.MD.A.2, 2-PS1) | Pouring into a different container does not change how much there is | Pours from a tall thin glass to a wide one | "more", "less" or "same" | Taller means more | tall to wide · wide to tall · P: one glass into two · T: clay rolled long |
| `still-there` (5-PS1-2) | Matter that dissolves is still there, and the weight is unchanged | Stirs sugar into water on a scale | The weight after | It disappeared, so the weight is the water alone | 100 and 10 · 200 and 25 · P: salt, then sand that does not dissolve · T: ice melting on the scale |
| `energy-arrows` (5-LS2-1) | An arrow in a food chain points to the one that gets the energy | Sets the direction of each arrow | Who gets the energy | The arrow points from the eater to what it eats | grass and rabbit · rabbit and fox · P: a three-link chain · a decomposer · T: the rabbit is removed; who loses energy |
| `tilt-not-distance` [`night-sky-orbit`] (5-ESS1-2) | Seasons come from the tilt of the Earth, not its distance from the Sun | Sets tilt and orbit to make northern summer | "tilt" or "distance" | Summer is when the Earth is closer | tilted, round orbit · P: no tilt (no seasons) · closest in January, still winter · the south at the same time · T: a planet with a large tilt |
| `balanced-forces` (3-PS2-1) | Balanced forces do not change motion | Sets the pushes on a box | "left", "right" or "stays the same" | A moving thing needs a push to keep moving; the bigger pusher always wins | 3 against 3 at rest · 5 against 3 · P: 3 against 3 while already sliding · T: three pushes |
| `needs-a-path` [`listen-spot`, `sound-bridge`] (1-PS4-1, 4-PS4-1) | Sound needs something to travel through | Pumps the air out of a jar with a bell in it | "louder", "quieter" or "silent" | Sound crosses empty space; or only air carries sound | air · water · a solid · P: air, then no air · T: a string phone, slack against tight |
| `complete-loop` [`circuit-loop`, `circuit-lab`] (4-PS3-2) | A bulb lights only on a complete loop back to the battery | Predicts, then closes the circuit | "yes" or "no": will it light | One wire from the battery to the bulb is enough | one wire · P: two wires, loop closed · both wires on one battery end · a gap · T: two bulbs on one loop |
| `light-to-eye` (4-PS4-2) | We see a thing when light from it reaches the eye | Draws the path of the light | Where the light starts | Sight goes out from the eye to the thing | lamp, apple, eye · P: lamp off · a wall between · a mirror · T: the Moon at night |

## Social studies, K-2 (5, last)

| Canvas | Rule | Child does | Says | Misrule and its answer | Problems |
|---|---|---|---|---|---|
| `need-or-want` [`coin-basket`] | A need is something a person must have to live and stay safe | Spends five coins, needs first | How many of the things are needs | Things I like a lot are needs | food and a toy · P: a coat in winter, a coat when you own three · water · T: a new set of things |
| `good-or-service` [`market-stall`] | A good is a thing; a service is work someone does for you | Taps every service on a street | How many services | Only things you can hold are bought | bread, haircut · bus ride · P: a pizza, and the pizza delivered · T: a doctor's visit |
| `both-want` [`trade-day`] | A trade happens when each side wants what the other has | Offers one thing for another | "yes" or "no": will they trade | Wanting something is enough | both want · P: only one wants · offer a different thing · T: a three-way trade |
| `map-key` [`map-maker`, `treasure-map`] | A map symbol stands for a real thing, and the key says which | Places symbols to match a scene | How many schools the map shows | A symbol is a picture of how the thing looks | one symbol · three kinds · P: two maps, same symbol, different keys · T: a map with no key (cannot be answered: say so) |
| `not-enough` [`class-vote`] | Scarcity means there is not enough for everyone, so a choice is made | Deals 3 toys to 5 children | How many go without | Everyone can have one | 3 for 5 · 5 for 5 (none) · P: 4 for 5 · T: taking turns, how many turns |

## Records that compare two drawn amounts (redesign first)

By principle 7 these are perception tasks as written. Each needs the child to make or change the thing the rule is
about: `compare-pieces` (1.5), `biggest-place-first`, `longer-not-bigger`, `turn-not-arms`, `spread-out`, `match-up`,
`left-is-less`, `fall-together`, `pour-it`. `shadow-size`, `balanced-forces` and `needs-a-path` already have the
child move the cause and predict the effect; check each on its first play.

## Batches

**Batch 1 (11-15, built, plays owed):** `past-one`, `wholes-as-fractions`, `add-like-parts`, `smaller-pieces`. Four Opus
subagents, one canvas each from a brief naming the record, the three approved pilots and the gate; about 2 minutes
each. All four passed the gate first time when re-run. Every subagent hit the same gate rule (two problems may not
share a first screen) and changed a start state or a count to pass it; a brief should say so up front.

**Batch 2 (11-15, built, plays owed):** `fair-shares` (1.10), `times-a-whole` (1.11), `recut-to-add` (1.12),
`part-of-a-part` (1.13). Built before batch 1 was played, at the user's request. Four Opus subagents, 2.5-4.5 minutes
each, from one shared brief (read-first list, gate facts, limits) plus one record each; all passed when re-run. Three of the four asked
for equal fractions in speech (a child who recuts 1/2 + 1/4 into eighths says "six eighths"); fixed once in
`canvasSpoken.ts`, and all 12 canvases re-gated. Deviations: `times-a-whole` has 6 problems (the pair counts as two)
and problem 5's key is 2, not 4/2; `recut-to-add` problem 2 is 2/3 + 1/6 (not 1/3 + 1/6); `part-of-a-part` keys are
2/6 and 6/12 (the picture's form, equal forms now accepted); `fair-shares` keeps a third misrule (the pizza count).

**Batch 3 (11-15, built; eval: 4 ready, `compare-pieces` rejected):** `compare-pieces` (1.5, redesigned: the first bar is fixed and the child
shades the fewest parts of their own bar that make more; says how many), `digit-value`, `zero-holds`, `nearer-ten`,
`shift-the-places`. Five Opus subagents, 3-5.5 minutes each; all passed the gate when re-run on the new page shell.
Deviations: `compare-pieces` problem 3 is 4/8 against sixths (key 4), not 2/6 against thirds; `zero-holds` problem 3
(35) shows three dials so the 305 misrule can be made; `digit-value` steppers cap at 9, so a place's block is the only
way to build it; `shift-the-places` chart always runs thousands to thousandths. Open points are in the eval brief.

**Batch 4 (11-15, built; eval 5/5 ready after two heals):** five Opus subagents, 4-10 minutes each; the coordinator re-ran the gate and read
the screenshots. All pass with 0 blocking/major probe findings. `compare-pieces` rebuilt as Beat the Card (see 1.5).
`ten-for-one` (Ten for One): pick cubes, snap a rod; adapted from `ring-the-tens` (strokes too fine); 104 starts with 6
locked tens; ten tens stay rods (no flat). `tenths-hundredths` (Hundred Grids): adapted from `decimal-garden`; column
tabs plus squares on two grids; grid 2 counts only once grid 1 is full (coordinator); 0.25 has no misrule (the digit
rule agrees). `biggest-place-first` (Card Count, principle 7 redesign): face-down place cards; the goal is the rule as
an action (every place down to the deciding place turned on both numbers, none to its right); 6 problems, 2,354 v
2,348 added (a ones-decided pair makes "turn everything" meet the goal, so it was refused). `longer-not-bigger`
(Decimal Cards, principle 7): each card's decimal is built on an empty hundred grid, so the misrule lives in the build
(5 squares for 0.5); the transfer uses a one-tap small whole grid. First two specs to pass `choices` to
`lumina.answer` (no Live check of a choices answer yet). Minor probe findings: 32px column tabs on both grid canvases.
For the eval: `compare-pieces` p1's proof clears a part to lengthen the monkey probe's plays.

**Batch 5 (11-15, built; eval 8/8 ready):** wave 3, eight Opus subagents, 5-7.5 minutes each; the coordinator re-ran the
gate on all eight after a shared fix and read screenshots. All pass with 0 blocking/major probe findings. Three records
were reworked so one button cannot meet the goal: `turn-the-array` (Cookie Trays: the child builds the turned tray
with row and column steppers under a fixed cloth; no Turn button), `undo-it` (Backwards Machine: the child sets each
backwards step from operation cards; the goal is that the backwards machine undoes the forward one for every start,
so a lucky mix that reaches the number is refused), `two-divisions` (Crate Yard: trucks stepper plus loading; the goal
checks truck count and load, so the misrule build fails even when the said number matches). `same-on-both-sides`
(Pan Balance) has 6 problems (8 + 4 = _ added as the minimal pair's partner); from problem 3 a peg holds the beam
until Let go; 5 = 5 is a yes/no item whose Check only copies the 5. `equal-groups` has a left-over tray on every
problem (13 on 3 plates says "no"). `left-over` (Apple Packing) transfer is 18 children in cars of 4 (key 5; 14 would
key 4, the car size the ask states). `split-the-array` accepts any split where both parts are facts with 1, 2, 5 or 10;
labels show "6 x 5" but no products. `parts-and-whole` (Cup and Counters) was written fresh (two-ways is a 3-addend tree).
**Shared fix:** a key of 0 now also accepts "none" and "nothing" (`canvasSpoken.ts`, test added). **Open (kit):** the
spoken key has no unit, so "four crates" passes where the ask is how many trucks. **Probe limit** (a control dimmed at rest never in the monkey pool): FIXED at the class by the batch 5 eval.

**Batch 6 (11-16, built; eval 10/10 ready):** wave 4, ten Opus subagents, 5-8 minutes each, from one shared brief; the coordinator re-ran the gate on all ten and read screenshots. `turn-not-arms` (Same Turn, principle 7): the child turns an arm of a different length in 15° steps to make the card's turn, or the fewest steps that beat it, and says the steps; the misrule is the step count where the arm ends are as far apart as the card's. `start-at-zero` colours the unit spaces between the ribbon's ends (sliding it to 0 is the strategy, not the check). `area-and-fence`'s ask states the depth, so one garden is right. `hidden-cubes` marks the hidden cubes (Lift alone would be one button that meets the goal). `fold-line` keeps creases by the child's own Keep; every stop must be folded so a 0-line shape does not pass at rest. `hour-hand` p1 moved to 3:00 (three "four"s in a row); the transfer target is a drawn clock. `picture-key` has some votes already drawn as pictures, so the misrule shows in speech as well as the build. **Shared fixes:** `canvas-check` same-first-screen also compares the rest pixels (three builders added scene facts only to pass it; one leaked a count); `canvasProbes.ts` control-overlap counts a pair only when a control cannot be hit at its centre. Eval heal: `fold-line` creases were painted under the far half.

**Batch 7 (11-16, built; eval 6/6 ready after 3 heals):** science A, six Opus subagents, 8-14 minutes each. `fall-together` (Drop Tower, principle 7): nothing falls; the child hangs on a release bar every thing that lands with the hanging one (air in, air out, the Moon) and says how many. `pour-it` (principle 7): juice moves only through countable cups, so "taller is more" gives a different cup count. `one-thing-changes` says how many things to change on ramp B (how many differ is always 1). `material-not-size` commits a tag before the drop; adds a big steel block beside the big wood one. `shadow-size` slides puppet or lamp until the shadow fills a frame; the lamp stays off until a move. `still-there` (Kitchen Scale) shows "? g" for any mix; adds "make 130 g" (a goal that is not a move). The gate's new same-picture advisory fired once and the builder named the difference in the scene.

**Batch 8 (11-16, built; eval 6/6 ready after 4 heals):** science B, six Opus subagents, 6-10 minutes each. `energy-arrows` (Food Chain): tap arrows to point to the eater; mixed start directions. `tilt-not-distance` (Tilted Planet): top view, axis fixed in space, near-round orbit marked "Not to scale"; no month names (a northern child would answer from experience). `balanced-forces` (Push the Crate): push arrows set on 1-8 tracks over ice; pushers differ in body size (the misrule); p6 sets a push to keep a sliding crate at speed. `needs-a-path` (Bell Tank): pump, pour water, drag blocks, tighten a string phone; no waves or meter drawn. `complete-loop` (Light the Bulb): a guess tag first, then wires; the bulb glows only after the guess. `light-to-eye` (Light Paths): drag source → object → eye; arrows through a wall are refused.

**Batch 9 (11-16, built; eval 9/9 ready after 3 heals):** wave 5 (K-2), seven Opus subagents, 6-9 minutes each, plus two one-problem extensions (`tilt-not-distance` p5 "distance", `balanced-forces` p3 "slower"; sliding choices are now faster, slower, stays the same, stops). `spread-out` (principle 7): the child drags shells to the length of a ladybug row and says how many shells. `match-up` (principle 7): strings between the rows; the fewer group always has the bigger things or the longer row; the choices are group names. `last-number`: drag each thing to a shelf (a tap mark would let tap-all pass). `one-more`: added blocks stay yellow; p5 "make it six" says how many were put on. `ten-and-some`: card problems (14, 17, 20) build the card's number; 11 and 10 are counted. `count-on`: the cup can be lifted (the count-all miss) or moved to the bigger pile. `partners`: a two-row partner frame and one lone spot; ten-sticks fill five columns.

**Batch 10 (11-16, built; eval 8/8 ready after 4 heals):** wave 6 (G5-8), eight Opus subagents, 4-11 minutes each. `same-factor` (Paint Shop): pour cups one at a time; the mix shows only after Stir. `for-one`: share coins from a purse onto items; the transfer shares 10 km road pieces over hours. `through-zero` (Rate Graph): lay a line with two pins; p6 plots a table first. `left-is-less` (Flag the Line, principle 7): drag number flags onto a line with only two numbers written. `rise-per-run` (Rise and Run): drag two pins onto the line; run and rise drawn without numbers. `keep-it-level`: take bags and weights off the pans; the beam tilts by the true weights; share into groups. `out-of-hundred` (Percent Grid): a whole worth a given amount; shade the percent; p5 is the inverse. `any-number` (Tile Patterns): figures 1-4 on a stepper, build figure 5 on a board; figure 10 by the rule. Two specs were trimmed to 6 problems when the payload loader refused 7 (theme 23).

**Batch 11 (11-16, built; eval 5/5 ready after 4 heals):** social studies K-2, five Opus subagents, 5-7 minutes each. `need-or-want` (Five Coins): pay coins onto price rings; the deciding fact is drawn in the scene (snow and an empty or full coat hook). `good-or-service` (Main Street): tap every service on a street; every service shows its worker. `both-want` (Trade Mat): wants shown as picture bubbles; offer on a mat, a YES/NO token; p3 builds the offer that works. `map-key`: build the street from the key; a look-alike schoolhouse symbol is the lure; p5 has no key ("can't tell"). `not-enough`: deal toys one per friend; p5 plans bike turns.

**To watch on the plays:** batch 11: `not-enough` p2 (5 for 5) "zero"? `map-key` p4, counting schoolhouse shapes? Batch 10: `same-factor` Start over allows trial to the key; `keep-it-level` levelling by trial. Batch 9: `count-on` p3 refuses a correct count-on from the smaller pile; `spread-out` p2, will the child say "nine"? Batch 8: `light-to-eye` p2 (candle lit, lamp off): does the child say lamp? `complete-loop` p4: yes because the gap is closed? Batch 7: `material-not-size` alternates sink/float; `fall-together` air problems assume a short drop. Batch 6: does `smaller-unit-more`'s row of buttons read as hands-on (theme 1 below); in `turned-shapes` the child sorts and never turns a shape; in `hour-hand`, `what-makes-it` and `area-and-fence` the ask names the move, so only speech tests the rule. `past-one` problem 1 has the answer 4/4, and a child may say "one whole" (not accepted:
whole numbers are not added to a fraction key); a cut bar at 12 parts dims its plus button in `smaller-pieces`, which
a child could read as a hint. Batch 2: in `times-a-whole` problem 5 the landing dot sits on the printed "2" once the
jumps are made; in `recut-to-add` Join lights up as soon as the parts match, (kept by bar item 10), so
a child could press + until Join lights; in `part-of-a-part` the minimal pair (1/3 then 1/2, 1/2 then 1/3) is carried by
the starting cut, since either order now meets the goal; in `fair-shares` p3 and p5 go past one whole ("four thirds"
and "one and a third" are both accepted); in `times-a-whole` p5 the key is the whole number 2, so "four halves" is not
accepted.

**Batch 2 eval (11-15, separate session, `qa/canvas/eval/report-2026-11-15.md`):** 4 of 4 ready, no probe findings.
Heals: `fair-shares` title to "Fair Shares" and the pizza-count misrule's `because` explained; `recut-to-add` p1's
ask no longer says how, steppers dim at their ends; `part-of-a-part` goal accepts either fraction in columns (the rows
stripe the whole square, so the swapped picture is correct; the old misses for p3 and p4 were that swap and now carry
the previous problem's cut over). The coordinator checked the heals, re-saved the payloads and re-ran
`test:primitive agent-canvas` (green).

## Order of work

1. DONE 11-15: kit item 1 (user Live replay). Kit item 2 (mic cap) still waits on the user.
2. DONE 11-15: kit items 3 and 5, and the pilots 1.2, 1.3 and 1.6.
3. DONE 11-15: wave 1 (13 of 13 built; 1.5 eval owed) and kit item 4. IN PROGRESS: wave 2 (4 of 8).
4. Waves 2-4 and the science rules, one batch at a time through build, eval and repair (no hand play between batches). Bracketed canvases first:
   they need a read, `lumina.answer` and a DI problem set, not a new program.
5. Kit item 6 (levers) once ten or more DI canvases have play records showing where words alone did not fix a miss.
6. Waves 5 and 6 and social studies.

## What counts as working

- **Played:** the user or a child finished it in a Live session. Gate-passed is not played.
- **The misrule was heard:** in the session log, a wrong spoken answer was classed as the named misrule and the tutor's
  correction addressed that rule.
- **Transfer:** first-try result on the last problem (the unseen case), compared with the first problem.
