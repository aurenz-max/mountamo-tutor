# HANDOFF — 19h-i-b, the adapter sweep, ports 5–11 (2026-08-16, after port 4)

**Scope:** one `DiPortAdapter` per judged-runner port, so `/tutor-test --di` can drive it headlessly.
**Queue of record:** `qa/di/BACKLOG.md` item **19h-i-b**. **18d rides inside each port's slice.**
**Executor:** per port — extract the cue surface → harness answers → adapter → drive → fix → commit.
**State: 4 of 11 done.** `counting-board` `d7f4133b` · `addition-subtraction-scene` `6e114db1` ·
per-mode backfill `76287c78` · `push-pull-arena` `e41691d1` · **`picture-vocabulary` (this slice)**.
**Supersedes** `HANDOFF-19h-i-b-adapter-sweep-2026-08-16.md`.

> **Two things changed that affect how you scope. Read §1 and §2.**
> The drive budget has a RULING now, and the previous handoff's census had a
> structural blind spot that left a live defect on a SHIPPED port.

---

## 1. ⭐ THE DRIVE BUDGET IS RULED: cap drills are PER CONTRACT SHAPE, not per mode

**User ruling, 2026-08-16.** The previous handoff asked the question and budgeted 90
sessions if the answer was "keep it flat". The answer is neither 90 nor a flat 68:

> **plain × every eval mode · signature × every eval mode · cap × every distinct CONTRACT SHAPE.**

A "contract shape" is a distinct `moveOnCue` + judging-contract pairing, not a mode.
On `picture-vocabulary` six modes collapsed to **three** cap shapes:

| Shape | Modes | Why distinct |
|---|---|---|
| spoken | naming · opposite · gradable_scale · sentence_frame | the judging contract |
| tap | receptive_match | the SILENCE contract — nothing is owed until the tap is described |
| tap + close | association | the only move-on that names its pair, because its corrections never may |

That took port 4 from 18 sessions to **15**. It reproduces port 3's observed
mode-invariance (one shared contract → one cap drill) without over-claiming it on a
port that genuinely forks.

**How to count YOUR port before you start:** read `moveOnCue` and ask what varies —
a close line, a gesture-vs-voice contract on the NEXT item, a per-mode correction.
Modes that produce a byte-identical move-on shape share one cap drill. Say in your
report which modes you collapsed and why; a silently narrowed sweep reads as full
coverage later.

### ⚠️ A CAP SHAPE THAT IS GESTURE-ONLY CANNOT BE DRIVEN — budget only the spoken ones

`--di-cap` hangs the drill off the **first VOICE item** in the session. Pin a tap eval
mode with `--eval-mode` and the session has no voice item at all, so on port 4 two of the
three planned cap drills **silently ran as ordinary plain drives** — both logged
`wrong-answer mode: plain` and would have been counted as cap coverage by anyone reading
the sweep afterwards. Port 4's honest count is **13 distinct drives, not 15.**

**Fixed in port 4's slice:** `build_di_journey` now raises with an explanation instead of
degrading. You will get a clear error rather than a false pass.

**What that means for your budget:** count cap shapes only among modes that produce at
least one VOICE item. A tap mode's `moveOnCue` is reachable only by capping a tap item,
which the harness cannot do — cover it with pack gates and **say in your report that it
is gate-covered, not driven.** The revised table below already assumes this.

**Revised arithmetic for the seven remaining ports** (contract shapes are an estimate
until you read each `moveOnCue` — the mode counts are exact):

| Port | Modes | plain+sig | cap shapes (est.) | Total (est.) |
|---|---|---|---|---|
| `phoneme-explorer` | 4 | 8 | 1–2 | 9–10 |
| `letter-spotter` | 3 | 6 | 2 (name/find are different acts) | 8 |
| `letter-sound-link` | 3 | 6 | 2 (hear_see taps) | 8 |
| `decodable-reader` | 5 | 10 | 2–3 (read_along vs Q-modes vs proposition tap) | 12–13 |
| `rhyme-studio` | 3 | 6 | 1–2 | 7–8 |
| `read-aloud-studio` | 3 | 6 | 1–2 | 7–8 |
| `di-spoken-practice` | 3 | 6 | 1 | 7 |
| **Total** | **24** | **48** | **10–14** | **≈58–62** |

Down from the 90 the flat reading implied, and every cap drill now tests a move-on
line no other one sends.

---

## 2. ⭐ THE PREVIOUS CENSUS HAD A BLIND SPOT: it counted only UNPORTED primitives

The 08-16 handoff censused "the eight remaining ports". 18d, however, lives in the
**catalog**, and every DI port has a catalog entry whether or not it has an adapter.
So a port that had already SHIPPED was never censused — and one was carrying the
defect:

**`interactive-book` (port 14, shipped 2026-08-14, adapter registered) still had the
full sentinel-less pair.** It shipped before 18d's literacy shape was named, and its
own di-script suite had no rung assertion at all, so nothing caught it. **Fixed, gated
and cap-re-driven inside port 4's slice** — 3/3 corrections opened `My turn:`, no
`di-no-verdict`, only the known 18c verbatim-repeat WARNs. Nothing outstanding on it.

**Rule for the next handoff: census EVERY DI catalog entry, not the queue.**

### The corrected per-rung census (LIVE rungs only, comments excluded)

Regenerate this rather than trusting it — the script is four lines of `grep` with a
comment filter, and the previous handoff's version double-counted a comment.

| Entry | scaffoldingLevels rungs to fix |
|---|---|
| `decodable-reader` | 2 |
| `letter-sound-link` | 2 |
| `letter-spotter` | 2 |
| `read-aloud-studio` | 2 |
| `phoneme-explorer` | **1** — the previous handoff implied 2 |
| ~~`picture-vocabulary`~~ | fixed (port 4) |
| ~~`interactive-book`~~ | fixed (port 4, off-queue) |

**`commonStruggles` "goes quiet" responses are NOT 18d instances. Do not "fix" them.**
Silence is not an attempt, so no verdict is owed and a re-spoken ask is correct there.
`push-pull-arena` shipped that shape deliberately. The defect is a re-spoken ask
offered as a response to an ATTEMPT.

---

## 3. The per-port recipe (unchanged; four ports have now run it)

1. **Read the script module and the component's `pack` memo.** The fork is decided —
   you are moving it, not re-deciding it.
2. **Export from the script module:** `<primitive>PackBase(items): JudgedCueSurface<Item>`,
   `itemsFromChallenges(challenges, ctx)`, `<primitive>HarnessAnswers(item)`.
   ⭐ **If a session-level invariant exists, `itemsFromChallenges` is where it goes** —
   see §4(d); it is the only builder that sees all the items at once.
3. **Audit `contextFor` + the catalog `taskDescription` together** before moving anything.
4. **Component spreads the surface**; only `statusLines` / `diagnosisObservation` stay.
5. **Register in `DI_PORTS`** with a docblock naming what is different about this port's
   answer material.
6. **Replace the di-script suite's hand-rolled `packOf`/pack literal with the exported
   surface.** All four ports so far carried that drift.
7. **Fix the catalog rungs (18d) and give every cue the `NEVER_PERFORM` tail.**
8. **Gates → probe → drive → fix → re-drive → commit.**

### The adapter is ~15–40 lines. Everything else is a defect the port already had.
Four ports, four times: 4–6 real defects each, none in the adapter.

---

## 4. The defect classes that have repeated — check these FIRST

**(a) The answer standing in the state block.** `counting-board` pushed `targetCount`;
`push-pull-arena` pushed `expectedAnswer` AND rendered it in prose. Read the port's
`contextFor` and its catalog `taskDescription` together. Watch the quiet version: a
key that names only the primary of two candidates IS the answer half the time.
*(picture-vocabulary was clean here — the first port that was.)*

**(b) A generator that collapses deterministically.** `push-pull-arena`'s `design` asked
the same problem twice — a `Math.max` clamp feeding a first-match picker.
⭐ **New variant on port 4, and it is worth knowing because it is invisible to a
"are the items distinct?" check:** `picture-vocabulary`'s `assembleGradable` padded a
thin scale pool to 5 by **re-blanking a scale it had already used**. The items were
distinct — different missing word — but two blanks on ONE scale means *each ask speaks
the other's answer*: item 1 asked "quiet, soft, hmm, noisy" while item 5's answer was
"soft". The second item is recall, not reasoning. **And the padding DEFEATED THE
CALLER'S OWN RETRY** — the caller warns at "only N/5 usable" and regenerates asking for
6 scales, but a padded array is always length 5, so that path could never fire.
**Look for a generator that pads past a guard the caller already wrote.**

**(c) A missing build gate, and the positional bindings behind it.** The moment an item
can DROP, every `challenges[...]` binding desyncs. On port 4 that was FIVE: the IRT
evidence metrics (`totalChallenges`, `averageAttemptsPerChallenge`), the phase-summary
rows, the celebration count, the counter dots, and the empty-state guard.
⭐ **`phaseResultsFromSummary` binds by ID and is still wrong when fed `challenges`** —
it deliberately scores a missing outcome 0 rather than dropping the row, so a gated-out
item renders a **0 against a word the child was never shown.** Bind it to `items`.

**(d) ⭐ NEW — an invariant that no single item can violate.** A per-item gate cannot see
a leak that lives BETWEEN items (§4b's shared scale: neither item is wrong alone).
Put it in `itemsFromChallenges`, which sees the session. That is also the boundary the
runner reads, so it covers hand-authored and cached payloads the generator fix cannot.

**(e) ⭐ NEW — a line that is only correct for some generated values.** Port 4 said
*"My turn: this is a shoes."* — `article()` guessed from the first letter, and the pool
is an open LLM word list carrying plurals and mass nouns (`soap`, `bread`). A stemmer
would be wrong too. **The fix is to stop putting the value in a frame that requires the
agreement**, not to compute the agreement. (§9 trap 5, third sighting.)

---

## 5. Drives

```bash
cd backend/tests/tutor_live
python run_tutor_live.py --component <id> --di --eval-mode <mode> --topic "<topic>" --grade <grade>
python run_tutor_live.py --component <id> --di --di-wrong signature --eval-mode <mode> ...
python run_tutor_live.py --component <id> --di --di-cap --eval-mode <mode> ...   # per CONTRACT SHAPE (§1)
```

Needs backend :8000 + frontend :3000. **Probe first — it is free and it has now found a
content defect on two of four ports:**

```bash
curl -s "http://localhost:3000/api/lumina/tutor-test?componentId=<id>&probe=1&live=1&di=1&evalMode=<m>&topic=<t>&gradeLevel=<g>"
```

Read `.probe.diPlan`: `droppedChallenges`, `packGateIssues`, and every item's `askLine`,
`affirmLine`, `answers`, `context`. ⭐ **Read the ask against the CONTEXT, not just on its
own** — port 4's worst defect was only visible in that comparison: the spoken ask was
`"Turn on the... hmm... what?"` while `context.stimulus` held
`"Turn on the ____ when it gets dark."` The generator emitted the spoken frame TRUNCATED
AT THE BLANK, so the clause that decides the answer existed only in printed text a
pre-reader cannot read. Four of five asks had no decidable answer. **Fix: derive the
spoken form from the structural field in CODE** (`gradable_scale` always did) — never
take a second LLM field for what the child hears.

⚠️ **Reports are named per DRILL, not per mode** — six plain drives overwrite one file.
Keep your own per-mode log; it is the record.

---

## 6. What a green run does and does not buy

Unchanged. `--di` holds the SEMANTIC half — refusal, affirmation, leak, sentinel,
correction shape, cue compliance. It says nothing about acoustics, ASR, mic transport,
VAD or the audio tail, because the student's turn crosses as TEXT. It does not close a
mic row. The mic sitting is closed by user ruling (2026-08-14), so a port ships on
machine gates + a live generation probe + `--di` — **but say what you drove.** File a mic
row only for genuinely new ANSWER MATERIAL.

---

## 7. Open findings

| Finding | Home | State |
|---|---|---|
| `di-verdict-embellished` / `di-false-completion-claim` | **19h-i-c** | ⭐ **The tail hypothesis got its largest sample: `picture-vocabulary` 0 of 74 affirm beats over the text channel, carrying the `NEVER_PERFORM` tail from birth.** Standing: ten-frame 5/7 (weak tail), counting-board 3/7 then 5/7 (weak), ASS 0/14 (strong), push-pull-arena 0/16 (strong), picture-vocabulary 0/74 (strong, 15 sessions × 6 modes). Affirm-line length is out; the tail is in. **The cheap experiment is still owed and unchanged: counting-board received the extended tail in the item-21 backfill, so one re-drive of `count` over text is the direct before/after.** One session. |
| `di-tag-spoken` on non-cue beats | **19h-i-a** | A HARNESS ARTIFACT, not a production defect. `attach` fires on any unscripted floor-giving TEXT message, and on `--di` the child's answer is one. In production the child answers with AUDIO. Distinguish by format. |
| Fabricated `[CURRENT STATE]` | **item 21** | Fix known: the `NEVER_PERFORM` tail. Give every port that tail. |
| 18c pair | **18c** | Expected on every cap drill; these contracts deliberately COMMAND the verbatim repeat. Do not re-file. |
| ~~`interactive-book` `--di-cap` re-drive~~ | **18d** | ✅ **DONE in port 4's slice** — 3/3 corrections opened `My turn:`, no `di-no-verdict`; only the known 18c verbatim-repeat WARNs. Its off-queue 18d fix is live-verified, not assumed. |
| Tap-mode `moveOnCue` is UNDRIVABLE | **19h-i-b** | ⭐ NEW. `--di-cap` drills the first VOICE item, so a gesture-only session has no cap path at all. On port 4 that leaves `receptive_match`'s move-on (must carry the next item's silence contract) and `association`'s close line covered by pack gates only, never live. The harness now RAISES instead of silently running a plain drive. Closing it needs either a mixed-session drive mode or a `--di-cap-item <id>` flag. |
| `counting-board` `subitize` un-glanced | 19c residual | One screen on the next counting-board touch. Pair it with the 19h-i-c re-drive, which lands on counting-board anyway. |

---

## 8. Gates

| Gate | Bar |
|---|---|
| `cd my-tutoring-app && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **803 = HEAD baseline**, 0 new, 0 in any touched file |
| `npm run typecheck:lumina` | 0 |
| `npx vitest run` | **3346 pass / 4 skipped / 0 fail** after port 4 |
| probe `.probe.diPlan` | `droppedChallenges` explained, `packGateIssues` empty |
| `--di` plain + signature per mode, cap per contract shape | 0 HIGH, or every HIGH fixed and re-driven |
| revert-bite | every new gate bites |

Bare `npx tsc --noEmit` from the repo root false-passes. The canvas-confetti "Errors" in
the vitest tail are pre-existing jsdom teardown noise; 0 test files fail.

---

## 9. Traps that have cost time

1. **`git add -A` swept another session's untracked handoff into a commit.** Check
   `git status` before staging and add paths explicitly.
2. **Do not heredoc TypeScript through the Bash tool.** Backticks and `${}` break it.
3. **Apostrophes in python `sed`/replace strings.** Verify with the test run, not by eye.
   ⭐ Prefer LINE-based replacement over matching a long string containing `\'` — an
   escaped apostrophe inside a heredoc'd python literal cost a retry this slice.
4. **`leakExemptSpan` wherever the stimulus — or the question — legitimately contains the
   answer.** On port 4 exactly ONE of six modes needed it (`receptive_match`: the tutor
   SAYS the word, the child taps its picture, so the word is the question). Emptying
   `leakTokens` would switch the oracle off instead.
5. **Singular/plural agreement in verdict lines.** See §4(e) — do not reach for a stemmer;
   remove the frame that needs the agreement.
6. **A new build gate desyncs positional bindings.** §4(c). Grep for `challenges[` AND for
   `challenges` passed whole into a helper.
7. **A partial fix greps as a whole one.** `level3` already routes through the correction
   on every remaining entry, so a per-ENTRY grep reports them all 18d-clean. Census per RUNG.
8. **`for...of` over `Array.entries()` fails the tsc gate** (`TS2802`). Use `.forEach`.
9. **python reading harness JSON on Windows needs `io.open(..., encoding='utf-8')` and
   `PYTHONIOENCODING=utf-8`.**
10. **⭐ NEW — verify any bracket tag you write into a catalog rung.** Port 4's
    interactive-book rung was drafted with `[BOOK_TAP]`; the real tag is `[IB_TAP]`.
    A rung is prompt text the tutor reads — an invented tag ships as an instruction.

---

## 10. One-paragraph version

Seven ports left, all in `literacy.ts` except `di-spoken-practice`. Per port: export the
cue surface and harness answers from the script module, spread it in the component,
register the adapter, replace the suite's hand-rolled pack fixture, fix the catalog's
rungs, then probe and drive **plain + signature per mode and cap per CONTRACT SHAPE** —
the budget is ruled, and it is ≈58–62 sessions rather than 90. Check four things before
you spend a session: whether the answer sits in `contextFor` or the catalog's
`taskDescription`, whether the generator pads past a guard the caller already wrote,
whether a build gate will desync a `challenges[...]` binding (five of them on port 4,
one of which scores a 0 against a word the child never saw), and whether any spoken line
is only grammatical for some generated values. **Read the probe's ask against its
context, not just on its own** — port 4's worst defect was a spoken frame truncated at
the blank, decidable only from print a pre-reader cannot read, and it was invisible in
either field alone. And census 18d across EVERY DI catalog entry, not the queue: the
previous handoff counted only unported primitives and a shipped port had been carrying
the stall for two days.
