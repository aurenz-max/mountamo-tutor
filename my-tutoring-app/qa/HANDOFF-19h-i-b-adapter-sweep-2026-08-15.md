# HANDOFF — 19h-i-b, the adapter sweep (2026-08-15)

**Scope:** one `DiPortAdapter` per judged-runner port, so `/tutor-test --di` can drive it headlessly.
**Queue of record:** `qa/di/BACKLOG.md` item **19h-i-b**. **18d rides inside each port's slice** (its
own executor line asked for that; see §5).
**Executor:** per port — extract the cue surface → harness answers → adapter → drive → fix → commit.
**State: 2 of 11 done.** `counting-board` `d7f4133b` · `addition-subtraction-scene` `6e114db1` ·
PM slice `836482d0` · per-mode backfill `76287c78`.
**Est:** ~1 slice per port. Budget 3–6 live Gemini sessions each (~5 min per drive), not 1.

---

## 1. The census is 11, and it is not the number the queue used to carry

Sixteen components call `useJudgedScriptRunner`. Five had adapters before this sweep (`ten-frame`
pilot, plus `number-bond` / `interactive-book` / `story-talk` / `word-workout` at port time). Two
shipped here. **Nine remain:**

| Port | Catalog | Eval modes to drive | Script module | Has a build gate already? |
|---|---|---|---|---|
| `push-pull-arena` | `physics.ts` | observe · predict · compare · design | 195 ln | ✗ — you write one |
| `picture-vocabulary` | `literacy.ts` | receptive_match · naming · association · opposite · sentence_frame · gradable_scale | 417 ln | partial |
| `phoneme-explorer` | `literacy.ts` | isolate · blend · segment · manipulate | 415 ln | ✓ |
| `letter-spotter` | `literacy.ts` | name_it · find_it · match_it | 674 ln | ✓ |
| `letter-sound-link` | `literacy.ts` | see_hear · hear_see · keyword_match | 488 ln | partial |
| `decodable-reader` | `literacy.ts` | read_along · literal · sequence · inference · main_idea | 672 ln | ✗ |
| `rhyme-studio` | `literacy.ts` | recognition · identification · production | 638 ln | partial |
| `read-aloud-studio` | `literacy.ts` | accuracy · expression · dialogue | 377 ln | ✗ |
| `di-spoken-practice` | `di.ts` | count_and_say · read_aloud · say_answer | 472 ln | ✗ |

**The four pre-runner packs are NOT in scope** (`phonics-blender`, `sound-swap`, `word-flip`,
`cvc-speller`) — they match a `useJudgedScriptRunner` grep only in COMMENTS. They have their own
handoff: `qa/HANDOFF-18d-pre-runner-four-2026-08-15.md`.

### ⚠️ Read this before you open `literacy.ts`

**A concurrent session is editing that file** (the 18d handoff above, §1). Eight of your nine ports
live in it. Different entries, so git merges — but this lane has already paid once for two sessions
in one file (`\ship` could not slice six files apart on 2026-08-14). **Take `push-pull-arena` first:
it is in `physics.ts` and is collision-free.** Rebase before each literacy port.

---

## 2. The per-port recipe, as it settled over two ports

1. **Read the script module and the component's `pack` memo.** The fork (which modes speak, which
   keep their hands) is already decided — you are moving it, not re-deciding it.
2. **Export from the script module:**
   - `<primitive>PackBase(items): JudgedCueSurface<Item>` — `primitiveType`, `activityLine`, `items`,
     `itemCue`, `moveOnCue`, `completeCue`, `pronounceCue?`, `contextFor`.
   - `itemsFromChallenges(challenges, ctx)` — ONE builder, so the harness and the component drop the
     same items.
   - `<primitive>HarnessAnswers(item)` — `correct`, `plainWrong`, `signatureWrong?`, `leakTokens`,
     plus `placed?` (numeric commit) or `tapped?` (text commit), plus `leakExemptSpan?`.
3. **Component spreads the surface** — `...<primitive>PackBase(items)` as the first line of its
   `pack` memo, then only what differs (`statusLines`, `diagnosisObservation`; those close over
   component state and stay in the component).
4. **Register in `DI_PORTS`** (`service/qa/di/diDrivePlan.ts`) with a docblock naming what is
   different about this port's answer material.
5. **Replace the di-script suite's hand-rolled `packOf` with the exported surface.** Both ports so
   far carried that drift — a literal that could go green while production sent something else.
   Expect it on the rest.
6. **Fix the catalog `scaffoldingLevels` in the same slice (18d)** — see §5.
7. **Gates** (§7), then **drive** (§3), then fix what the drives find, **re-drive**, commit.

### The adapter is ~40 lines. Everything else in each slice was a defect the drive found.

Do not scope a port as "write the adapter". Scope it as "drive the port and fix what comes back".

---

## 3. Drives — the user ruled ONE PER EVAL MODE (2026-08-15)

```bash
cd backend/tests/tutor_live
python run_tutor_live.py --component <id> --di --eval-mode <mode> --topic "<topic>" --grade <grade>
python run_tutor_live.py --component <id> --di --di-wrong signature --eval-mode <mode> ...
python run_tutor_live.py --component <id> --di --di-cap --eval-mode <mode> ...
```

Needs backend :8000 + frontend :3000 up. Probe the plan first — it is free and it catches shape
errors before you spend a session:

```bash
curl -s "http://localhost:3000/api/lumina/tutor-test?componentId=<id>&probe=1&live=1&di=1&evalMode=<m>&topic=<t>&gradeLevel=<g>"
```

**Why per-mode is not optional.** `--di` drives whichever mode the manifest routes, so a mode-forked
port ships on one mode's evidence. Backfilling the two shipped ports found **four defects, all of
them on gesture or non-default modes** — the ones a single drive structurally cannot reach.

**The cap drill has the best hit rate of the three.** It found 18d on 2 of 2 ports.

---

## 4. What a green run does and does not buy

A `--di` run holds the SEMANTIC half — refusal, affirmation, leak discipline, sentinel discipline,
correction shape, cue compliance. It says nothing about acoustics, ASR, mic transport, VAD or the
audio tail. **It does not close a mic row.** The mic sitting is closed by user ruling (2026-08-14),
so a port ships on machine gates + a live generation probe + `--di` — but say what you drove.

---

## 5. 18d rides inside each port's slice — and it is now CONFIRMED

**The defect:** a catalog `scaffoldingLevels` rung that quotes a speakable line is a third reply
channel. On repeat wrong answers the model speaks the rung VERBATIM; it opens with neither sentinel,
so the reducer records **`di-no-verdict`** and the correction counter freezes with the child waiting.

Reproduced live, with exact fingerprints:

- `counting-board` — *"Touch each one just one time as you count."* / *"Point at the first one. Count
  with your finger. Then tell me how many."*
- `addition-subtraction-scene` — *"…think about what happened in the story"* / *"Take your time. Look
  at the picture. Then tell me."*

**The fix, proven three times — apply it, do not redesign it:**

1. State the two-branch law **before** the branches in the judging contract. **Consume
   `wordWorkoutScript`'s `TWO_BRANCH_LAW` wording** (counting-board and ASS both extend it with
   `no reminder of the method, no scaffolding line`). Keep the wording identical so a grep finds them.
2. Rewrite the three rungs to route the same pedagogy **through the correction**, which already opens
   `"My turn:"`. Content is good pedagogy; the bare channel is the bug.
3. Pin it: assert every rung matches `/scripted correction|say nothing further/` and that the two
   quoted lines are gone from the entry.
4. Re-drive `--di-cap`. Both HIGHs should vanish, leaving the known-open 18c pair
   (`di-correction-verbatim-repeat`, which these contracts now deliberately COMMAND, and
   `di-capped-item-asks-then-withdraws`).

⚠️ **I filed this as a new item `19h-i-f` and it was already queued as 18d.** I grepped for the
defect (`TWO_BRANCH_LAW`) instead of the symptom (`scaffoldingLevels`), so a queued item one screen
away read as a discovery. It is withdrawn. **Grep the symptom before you file.**

---

## 6. Open findings, and where they live

| Finding | Home | State |
|---|---|---|
| `di-verdict-embellished` / `di-false-completion-claim` | **19h-i-c** | ⭐ **The channel hypothesis is DEAD.** ten-frame 5/7, counting-board 3/7 then 5/7, **ASS 0 of 14** — same text channel, same day. It varies BY PACK, so the next step is **diffing ASS's contract and catalog against the other two** (its `NEVER_PERFORM` tail and longer, contentful affirm lines are the visible candidates), not another measurement. A pack that does not embellish exists; that is worth more than another one that does. |
| `di-tag-spoken` on non-cue beats | **19h-i-a** | ⭐ **A HARNESS ARTIFACT, not a production defect.** `attach` fires on any unscripted floor-giving TEXT message, and on `--di` the child's answer is one. In production the child answers with AUDIO → `audio_queue`, never `text_queue`, so attach cannot fire mid-run on a real session. Only eligible on modes whose stimulus VARIES per item (a constant stimulus never changes the signature). **Distinguish by format:** the real block says `[CURRENT STATE] Where the student is in this activity:` with an indented list; a FABRICATED one has a colon after the tag and invented fields. |
| Fabricated `[CURRENT STATE]` | **item 21** | ⭐ **Has a fix now, with its first before/after on one beat.** Gesture-verdict cues DESCRIBE what the child did rather than only scripting a line, and a description is what the model re-narrates. Consuming ASS's `NEVER_PERFORM` tail (which forbids *announcing the activity's state*, not merely reading the tag) took counting-board's `subitize_perceptual` from 2/7 to 0/7. One run each way — a strong note, not CONFIRMED by the ≥2/3 rule. **Give every port that tail.** |
| `counting-board` `subitize` un-glanced | 19c residual | Still owed — one screen on the next counting-board touch. `--di` cannot cover it (the harness never mounts the runner). |

---

## 7. Gates

| Gate | Bar |
|---|---|
| `cd my-tutoring-app && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **803 = HEAD baseline**, 0 new, 0 in any touched file |
| `npm run typecheck:lumina` | 0 |
| `npx vitest run` | **3323 pass / 4 skipped / 0 fail** at `76287c78` |
| `--di` plain + signature + cap, per eval mode | 0 HIGH, or every HIGH fixed and re-driven |

Bare `npx tsc --noEmit` from the repo root false-passes. Use the project-local binary.

---

## 8. Traps that cost me time

1. **`git add -A` swept another session's untracked handoff into my commit.** Check `git status`
   before staging; you are not alone in this lane.
2. **Do not heredoc TypeScript through the Bash tool.** Backticks and `${}` break it. Write the block
   with the Write tool to the scratchpad, then `cat file >> target`.
3. **Apostrophes in python `sed`/replace strings** silently produced `'item's'` and broke the
   catalog parse. Verify with the test run, not by eye.
4. **`leakExemptSpan` is needed wherever the stimulus legitimately contains the answer.** ASS's
   `create-story` filed 5 false HIGHs because the EQUATION is the prompt there. Subtracting the span
   keeps the oracle stronger than emptying `leakTokens` would.
5. **Singular/plural in verdict lines.** "Yes! One bunnies." shipped in two packs. It cannot be a
   stemmer — `bunnies`→bunny and `cookies`→cookie are the same three letters. Both generators use
   closed schema-enforced enums, so `objectSingularFor`'s map is asserted exhaustive over
   `VALID_OBJECT_TYPES`. Extend the map, keep the test.
6. **A new build gate desyncs positional bindings.** `challenges[runner.currentIndex]` breaks the
   moment an item can drop — the runner's index counts ITEMS. Bind by id.

---

## 9. One-paragraph version

Nine ports left, `push-pull-arena` first because it is the only one not in `literacy.ts`, where a
concurrent 18d session is working. Per port: export the cue surface and harness answers from the
script module, spread it in the component, register the adapter, replace the suite's hand-rolled pack
fixture, fix the catalog's scaffolding rungs (that is 18d, and it is confirmed on 2 of 2 ports so
far), then drive — plain, signature and cap, **once per eval mode**, because every defect the backfill
found was on a mode a single drive cannot reach. The adapter is forty lines; the slice is whatever the
drives hand back, which on both ports so far has been four to six real defects including a shared gate
mis-measuring its own limit, a generator shipping one problem N times, and the answer standing in the
state block. Budget for that, not for the adapter.
