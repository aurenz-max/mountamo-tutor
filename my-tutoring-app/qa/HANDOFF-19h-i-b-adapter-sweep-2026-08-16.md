# HANDOFF — 19h-i-b, the adapter sweep, ports 4–11 (2026-08-16)

**Scope:** one `DiPortAdapter` per judged-runner port, so `/tutor-test --di` can drive it headlessly.
**Queue of record:** `qa/di/BACKLOG.md` item **19h-i-b**. **18d rides inside each port's slice.**
**Executor:** per port — extract the cue surface → harness answers → adapter → drive → fix → commit.
**State: 3 of 11 done.** `counting-board` `d7f4133b` · `addition-subtraction-scene` `6e114db1` ·
per-mode backfill `76287c78` · `push-pull-arena` `e41691d1`.
**Supersedes** `HANDOFF-19h-i-b-adapter-sweep-2026-08-15.md` (kept for the ports 1–2 record).

> **Read §2 before you scope anything.** The eight remaining ports carry **30 eval modes between
> them**, and the standing ruling is one drive per mode per drill. That is 90 live sessions if
> applied flat. The arithmetic is in §4 with the one piece of evidence that bears on it.

---

## 1. The eight remaining ports, censused today (not copied forward)

Every column below was re-derived from the files on `e41691d1`, because the ports-1–2 handoff's
"has a build gate already?" column was a guess in two places and the 18d column did not exist.

| Port | Catalog | Eval modes | Script ln | Build gate? | 18d rungs needing fix |
|---|---|---|---|---|---|
| `picture-vocabulary` | `literacy.ts` | receptive_match · naming · association · opposite · sentence_frame · gradable_scale (**6**) | 417 | ✗ none | 2 of 3 |
| `phoneme-explorer` | `literacy.ts` | isolate · blend · segment · manipulate (**4**) | 415 | ✓ | 2 of 3 |
| `letter-spotter` | `literacy.ts` | name_it · find_it · match_it (**3**) | 674 | ✓ | 2 of 3 |
| `letter-sound-link` | `literacy.ts` | see_hear · hear_see · keyword_match (**3**) | 488 | ✗ none | 2 of 3 |
| `decodable-reader` | `literacy.ts` | read_along · literal · sequence · inference · main_idea (**5**) | 672 | ✓ | 2 of 3 |
| `rhyme-studio` | `literacy.ts` | recognition · identification · production (**3**) | 638 | ✗ none | 2 of 3 |
| `read-aloud-studio` | `literacy.ts` | accuracy · expression · dialogue (**3**) | 377 | ✓ | 2 of 3 |
| `di-spoken-practice` | `di.ts` | count_and_say · read_aloud · say_answer (**3**) | 472 | ✓ (thin) | **3 of 3** |

**None of the eight exports a `PackBase`, an `itemsFromChallenges`, or a `HarnessAnswers`. None
carries `TWO_BRANCH_LAW`. None carries `NEVER_PERFORM`.** All eight need the full treatment.

**The four pre-runner packs are still NOT in scope** (`phonics-blender`, `sound-swap`, `word-flip`,
`cvc-speller`) — they match a `useJudgedScriptRunner` grep only in COMMENTS, and have their own
handoff: `qa/HANDOFF-18d-pre-runner-four-2026-08-15.md`.

### The `literacy.ts` collision, re-checked

The ports-1–2 handoff warned that a concurrent session was editing `literacy.ts` and told you to
take `push-pull-arena` first because it was the only port outside that file. **That port is done, so
the dodge is spent — the remaining seven are all in `literacy.ts`.** As of `e41691d1` that session
has committed nothing and the working tree is clean, so the file is currently uncontested. Rebase
before each port anyway and check `git status` before staging (§9 trap 1); do not assume.

---

## 2. ⭐ 18d in literacy is a DIFFERENT SHAPE, and a grep will tell you it is already fixed

This is the most important thing in this document.

The 18d symptom on the three shipped ports was a rung that **quoted a speakable line** (*"Touch each
one just one time as you count."*). Only `rhyme-studio` has that shape. **On the other seven the rung
is an instruction to RE-SPEAK THE ASK:**

- `picture-vocabulary` / `letter-spotter` / `letter-sound-link` / `phoneme-explorer` —
  level1 *"Say the question once more, then wait for them alone."*, level2 *"Say the question again
  slowly and clearly, then wait."*
- `decodable-reader` / `read-aloud-studio` — the same two with "instruction" for "question".
- `di-spoken-practice` is the sharpest in the queue and the only 3-of-3:
  level1 *"Repeat the prompt once, slowly."*, level2 ***"Give one concrete clue that does not name
  the answer, then ask for one retry."***, level3 *"Accept the attempt warmly and continue as
  instructed."* — **level 2 is an explicit standing invitation to improvise a hint**, which is the
  exact channel that produced word-workout's `di-no-verdict` on a FIRST wrong answer (improvised
  praise). Nothing here routes through the correction.

**It is the same defect.** A re-spoken ask opens with neither sentinel, so the reducer records
`di-no-verdict` and the correction counter freezes with the child waiting. The disguise is that it
sounds like restraint rather than like a hint.

**⚠️ AND `level3` ALREADY ROUTES THROUGH THE CORRECTION ON ALL EIGHT.** So the obvious census —
`grep -c 'scripted correction'` per entry — returns a hit for every one of them and reads as
**fixed**. I ran exactly that grep first and it told me all seven literacy entries were done. They
are not; **only the third rung is.** Census per rung, never per entry.

The fix is unchanged from §5 of the previous handoff and is now proven on three ports — apply it, do
not redesign it. Consume `wordWorkoutScript`'s `TWO_BRANCH_LAW` wording verbatim so a grep finds
them all, state it BEFORE the branches in the judging contract, route all three rungs through the
scripted correction, add the law to the catalog's sentinel directive, and pin it.

---

## 3. The per-port recipe, as it stands after three ports

1. **Read the script module and the component's `pack` memo.** The fork (which modes speak, which
   keep their hands) is already decided — you are moving it, not re-deciding it.
2. **Export from the script module:**
   - `<primitive>PackBase(items): JudgedCueSurface<Item>` — `primitiveType`, `activityLine`, `items`,
     `itemCue`, `moveOnCue`, `completeCue`, `pronounceCue?`, `contextFor`.
   - `itemsFromChallenges(challenges, ctx)` — ONE builder, so the harness and the component drop the
     same items.
   - `<primitive>HarnessAnswers(item)` — `correct`, `plainWrong`, `signatureWrong?`, `leakTokens`,
     plus `placed?` (numeric commit) or `tapped?` (text commit), plus `leakExemptSpan?`.
3. **Audit `contextFor` for the answer before you move it.** See §4 — this has now bitten on two of
   three ports and it is the highest-value ten minutes in the slice.
4. **Component spreads the surface** — `...<primitive>PackBase(items)` as the first line of its
   `pack` memo, then only what differs (`statusLines`, `diagnosisObservation`; those close over
   component state and stay in the component).
5. **Register in `DI_PORTS`** (`service/qa/di/diDrivePlan.ts`) with a docblock naming what is
   different about this port's answer material.
6. **Replace the di-script suite's hand-rolled `packOf` with the exported surface.** All three ports
   so far carried that drift — a literal that could go green while production sent something else.
   It is now the default expectation, not a surprise.
7. **Fix the catalog's rungs (18d, §2) and give every cue the `NEVER_PERFORM` tail** (item 21's
   ruling: every port carries it, whether or not it has reproduced there).
8. **Gates** (§8), then **probe** (§4), then **drive** (§5), then fix what they find, **re-drive**,
   commit.

### The adapter is ~40 lines. Everything else in each slice is a defect the port already had.

Do not scope a port as "write the adapter". Scope it as "drive the port and fix what comes back".
Three ports, three times: 4–6 real defects each, none of them in the adapter.

---

## 4. The three defect classes that have repeated — check these FIRST

Ports 1–3 found different bugs, but three classes have now hit more than once. Each is cheap to
check before you spend a session.

**(a) The answer standing in the state block.** `counting-board` pushed `targetCount`;
`push-pull-arena` pushed `expectedAnswer` AND rendered it in the catalog as a sentence — *"The
correct spoken answer: {{expectedAnswer}}."* — so the tutor held the graded answer in prose, in the
persistent block, all session, while the child was still being asked for it. **Read the port's
`contextFor` and its catalog `taskDescription` together before anything else.** The per-turn judging
contract already names the answer, scoped to the turn that needs it; the state block carries the
STIMULUS only. Watch for the quiet version too: on `compare` the key `objectName` was the answer on
half the draws, because it named only the primary of two candidates. A discrimination may show the
state block both candidates or neither.

**(b) A generator that collapses deterministically.** `push-pull-arena`'s `design` mode asked *the
same problem twice in a row* — byte-identical — with three of four items answering "big", so a child
saying "big" every time scored 75%. Not an LLM slip: `pickObject(Math.max(8, weight))` returns the
FIRST library object at that weight, so every draw from 5 to 8 became the Barrel, and the branch
pinned the surface to carpet. **The free probe caught it and the pack gate named it.** Look at the
generator's post-processing for `Math.max`/`Math.min` clamps feeding a first-match picker — the
clamp is what destroys the variety the LLM supplied. (`N challenges = N problems`, third sighting.)

**(c) A missing build gate, and the positional bindings that hide behind it.** Three of the eight
have no gate. Adding one is right — an ask with no defensible answer is broken, not hard — but the
moment an item can DROP, every `challenges[runner.currentIndex]` in the component desyncs, because
the runner's index counts ITEMS. On `push-pull-arena` that was four bindings plus
`evalMode: challenges[0]?.type` and the phase-summary rows (which would report a 0 against an item
the child was never shown). **Bind by id, and grep the component for `challenges[` before you commit.**

---

## 5. Drives — the standing ruling is ONE PER EVAL MODE, and here is what that costs

```bash
cd backend/tests/tutor_live
python run_tutor_live.py --component <id> --di --eval-mode <mode> --topic "<topic>" --grade <grade>
python run_tutor_live.py --component <id> --di --di-wrong signature --eval-mode <mode> ...
python run_tutor_live.py --component <id> --di --di-cap --eval-mode <mode> ...
```

Needs backend :8000 + frontend :3000 up (`npm run dev` in `my-tutoring-app`). **Probe first — it is
free, it runs the real generator, and on port 3 it caught a content defect no machine gate could
have predicted:**

```bash
curl -s "http://localhost:3000/api/lumina/tutor-test?componentId=<id>&probe=1&live=1&di=1&evalMode=<m>&topic=<t>&gradeLevel=<g>"
```

Read `.probe.diPlan` — `droppedChallenges`, `packGateIssues`, and every item's `askLine`,
`affirmLine`, `answers` and `context`. A repeated ask, a degenerate answer distribution, or the
answer sitting in `context` are all visible here for zero sessions.

**Why per-mode is not optional.** `--di` drives whichever mode the manifest routes, so a mode-forked
port ships on one mode's evidence. The backfill on ports 1–2 found four defects, **all on gesture or
non-default modes** — the ones a single drive structurally cannot reach.

### The arithmetic, stated honestly

30 eval modes across eight ports × 3 drills = **90 live sessions**, concentrated unevenly:
`picture-vocabulary` alone is 18, `decodable-reader` 15, `phoneme-explorer` 12.

**One observation bearing on it, from one port only:** on `push-pull-arena` the cap drill was
**mode-invariant** — all four modes returned the identical pair of known-open 18c WARNs and nothing
else, because the cap path exercises the contract's correction branch, which does not vary by mode
on a port whose modes share a contract. Plain and signature were NOT invariant in what they tested
(each mode has its own signature wrong), only in that they passed.

That is one port's evidence and it is not enough to change a user ruling. **It is enough to be worth
asking:** if the cap drill's job is to exercise one shared correction branch, per-mode cap drills may
be buying repetition rather than coverage, and dropping to plain+signature per mode with one cap
drill per port would take 90 sessions to 68. **Put the question to the user before assuming either
way** — and if the ruling stands, budget the full 90 and say so up front rather than quietly
sampling. A silently narrowed sweep reads as full coverage later.

---

## 6. What a green run does and does not buy

A `--di` run holds the SEMANTIC half — refusal, affirmation, leak discipline, sentinel discipline,
correction shape, cue compliance. It says nothing about acoustics, ASR, mic transport, VAD or the
audio tail, because the student's turn crosses the wire as TEXT. **It does not close a mic row.** The
mic sitting is closed by user ruling (2026-08-14), so a port ships on machine gates + a live
generation probe + `--di` — but say what you drove. File a new mic row only for genuinely new ANSWER
MATERIAL (a new response class), the way word-workout did for its pseudoword.

---

## 7. Open findings, and where they live

| Finding | Home | State |
|---|---|---|
| `di-verdict-embellished` / `di-false-completion-claim` | **19h-i-c** | ⭐ **The candidate list just halved, and the next step is a CHEAP EXPERIMENT rather than another measurement.** Standing: ten-frame 5/7, counting-board 3/7 then 5/7, ASS 0/14, **push-pull-arena 0 of 16 (2026-08-16)**. ASS's protection had two candidates — its `NEVER_PERFORM` tail, or its longer contentful affirm lines. push-pull-arena has the tail and **the shortest affirm lines in the family** ("Yes, push.") and does not embellish. **So affirm-line length is out and the tail is in.** counting-board already received the extended tail during the item-21 backfill, so **one re-drive of counting-board `count` over text is the direct before/after.** One session. |
| `di-tag-spoken` on non-cue beats | **19h-i-a** | ⭐ **A HARNESS ARTIFACT, not a production defect.** `attach` fires on any unscripted floor-giving TEXT message, and on `--di` the child's answer is one. In production the child answers with AUDIO → `audio_queue`, so attach cannot fire mid-run. **Distinguish by format:** the real block says `[CURRENT STATE] Where the student is in this activity:` with an indented list; a FABRICATED one has a colon after the tag and invented fields. |
| Fabricated `[CURRENT STATE]` | **item 21** | Fix known: the `NEVER_PERFORM` tail that forbids *announcing the activity's state*, not merely reading the tag. Took counting-board's `subitize_perceptual` from 2/7 to 0/7. **Give every port that tail** — port 3 shipped it prophylactically and drove clean on 12 sessions, which is consistent with the fix but is not a second before/after. |
| 18c pair (`di-correction-verbatim-repeat`, `di-capped-item-asks-then-withdraws`) | **18c** | Expected on every cap drill. These contracts deliberately COMMAND the verbatim repeat. Do not re-file. |
| `counting-board` `subitize` un-glanced | 19c residual | Still owed — one screen on the next counting-board touch. `--di` cannot cover it (the harness never mounts the runner). **The 19h-i-c re-drive above lands on counting-board anyway — pair them.** |

---

## 8. Gates

| Gate | Bar |
|---|---|
| `cd my-tutoring-app && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **803 = HEAD baseline**, 0 new, 0 in any touched file |
| `npm run typecheck:lumina` | 0 |
| `npx vitest run` | **3337 pass / 4 skipped / 0 fail** at `e41691d1` |
| probe `.probe.diPlan` | `droppedChallenges` explained, `packGateIssues` empty |
| `--di` plain + signature + cap, per eval mode | 0 HIGH, or every HIGH fixed and re-driven |

Bare `npx tsc --noEmit` from the repo root false-passes. Use the project-local binary with an
absolute path. The two canvas-confetti "Errors" in the vitest tail (WordSorter,
SolarSystemExplorer) are pre-existing jsdom teardown noise, not failures — 0 test files fail.

---

## 9. Traps that have cost time

1. **`git add -A` swept another session's untracked handoff into a commit.** Check `git status`
   before staging and add paths explicitly; you are not alone in this lane.
2. **Do not heredoc TypeScript through the Bash tool.** Backticks and `${}` break it. Use Write/Edit.
3. **Apostrophes in python `sed`/replace strings** silently produced `'item's'` and broke a catalog
   parse. Verify with the test run, not by eye.
4. **`leakExemptSpan` is needed wherever the stimulus legitimately contains the answer** — and on
   `push-pull-arena` it was needed where the QUESTION does: every mode closes on a two-word menu, so
   the answer is in the ask by construction. Subtracting the menu keeps the oracle live over the
   greeting, the how-to-play and the hand-over, which is what caught predict's how-to-play priming
   its own answer. **Emptying `leakTokens` would have switched the oracle off instead.**
5. **Singular/plural in verdict lines.** "Yes! One bunnies." shipped in two packs. Not a stemmer job
   — assert an explicit map exhaustive over the generator's enum.
6. **A new build gate desyncs positional bindings.** `challenges[runner.currentIndex]` breaks the
   moment an item can drop. Bind by id. (§4c.)
7. **⭐ NEW — a partial fix greps as a whole one.** `level3` already routes through the scripted
   correction on all eight remaining ports, so a per-ENTRY grep for `scripted correction` reports
   every one of them as 18d-clean. Census per RUNG. (§2.)
8. **⭐ NEW — `for...of` over `Array.entries()` fails the tsc gate** (`TS2802`, no
   `--downlevelIteration`). Use `.forEach((x, i) => …)` in test files.
9. **⭐ NEW — python reading harness JSON on Windows needs `io.open(..., encoding='utf-8')` and
   `PYTHONIOENCODING=utf-8`,** or it dies on the em-dashes and arrows in the reports mid-loop and
   you lose the earlier output.

---

## 10. One-paragraph version

Eight ports left, all but `di-spoken-practice` in `literacy.ts`, and the dodge that let port 3 avoid
that file is spent. Per port: export the cue surface and harness answers from the script module,
spread it in the component, register the adapter, replace the suite's hand-rolled pack fixture, fix
the catalog's rungs, then probe (free, and it has found a content defect the machine gates could not)
and drive plain + signature + cap once per eval mode. **Check three things before you spend a
session: whether the answer is sitting in `contextFor` or the catalog's `taskDescription`, whether
the generator collapses distinct draws onto one problem, and whether adding a build gate will desync
a `challenges[index]` binding.** The 18d rungs here are a shape nobody has named — not a quoted hint
but *"Say the question once more, then wait"*, which is the same sentinel-less stall wearing
restraint as a disguise — **and because `level3` already routes through the correction on all eight,
a per-entry grep will tell you they are already fixed.** They are not. The adapter is forty lines;
the slice is whatever the drives hand back, which on three ports has been four to six real defects
each, none of them in the adapter. Budget the sessions honestly: 30 modes × 3 drills is 90, and if
that is too many, get a ruling rather than quietly sampling.
