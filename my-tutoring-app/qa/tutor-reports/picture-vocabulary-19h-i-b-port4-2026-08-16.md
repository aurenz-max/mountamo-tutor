# picture-vocabulary joins the judged-loop harness — 19h-i-b, port 4 of 11 (2026-08-16)

**Queue:** `qa/di/BACKLOG.md` 19h-i-b · **18d rode inside this slice** · handoff
`qa/HANDOFF-19h-i-b-adapter-sweep-2026-08-16.md`.
**Widest port in the sweep: SIX eval modes**, and the first whose fork is a
response-class ruling rather than a difficulty one.

The per-drill reports (`picture-vocabulary-live-di-{plain,signature}-2026-08-16.md`)
are overwritten by each successive mode — the harness names them per DRILL, not per
mode — so **this file is the per-mode record**.

---

## 1. What the adapter cost, and what the slice actually was

The adapter is ~15 lines. Everything else below is a defect the port already had —
the fourth port in a row where that has been true.

| Class | picture-vocabulary |
|---|---|
| (a) answer in the state block | **clean** — `contextFor` and the catalog `taskDescription` push only `challengeType` + `stimulus`, and `stimulusFor` is answer-free by construction (naming pushes "the picture on screen", the scale pushes "hmm" in the blanked rung) |
| (b) generator collapse | **clean** — `shuffle` throughout, pair dedupe across both bidirectional modes, distinct-emoji enforcement, interior-rung preference. No clamp feeding a first-match picker |
| (c) no build gate | **real** — added; and it desynced five `challenges`-bound displays (below) |

---

## 2. The build gate this port did not have

`itemFromChallenge` was a pure map — every generated challenge became an item.
It now returns `null` for an ask with **no defensible answer**:

- a tap mode whose cards do not contain the target — the tap can never match, so
  the child is corrected to the cap **for answering correctly**;
- an `opposite`/`association` with no base word (the ask renders "the opposite of
  undefined", and every correction re-ask inherits it), or whose two sides are the
  same word;
- a scale whose blanked rung is not the answer, or whose answer appears twice —
  `scaleSpokenFor` then speaks the answer while asking for it;
- a frame with no blank (`frameFilledFor` returns the sentence unchanged, so the
  correction never models the word in place) or one that names its own target.

### The gate desynced five bindings, and one of them was scoring the child

`phaseResultsFromSummary` binds by **id**, so it does not shift — but its documented
behaviour is that *"an item with no outcome scores 0 rather than vanishing"*. Fed
`challenges`, a gated-out item the child was **never shown** would render a 0 row in
the summary. The same argument applies harder to `totalChallenges` /
`averageAttemptsPerChallenge`, which are **IRT evidence**: a dropped challenge would
deflate accuracy against a denominator that never ran.

All five now bind to `items`: the evidence metrics, the phase-summary rows, the
celebration count, the challenge-counter dots, and the empty-state guard (a payload
whose challenges are *all* rejected would otherwise mount a runner with nothing to run).

---

## 3. 18d — the disguise was exactly as the handoff described, and the grep trap is real

Both rungs were the sentinel-less stall:

```
level1: 'Say the question once more, then wait for them alone.'
level2: 'Say the question again slowly and clearly, then wait.'
level3: 'Use the scripted correction line for this item…'   ← already correct
```

**Three catalog entries carried that wording byte-for-byte**, which is why a
per-ENTRY grep for `scripted correction` reports all of them clean. Census per RUNG.

Applied unchanged from the proven fix: `TWO_BRANCH_LAW` consumed verbatim from
`wordWorkoutScript` (extended the way counting-board / ASS / push-pull-arena extend
it), stated **before** the branches; all three rungs routed through the scripted
correction; the law added to the catalog's sentinel directive; the `NEVER_PERFORM`
tail (item 21) given to every cue, prophylactically.

### ⭐ A SHIPPED port was carrying the same defect, and the sweep's census could not see it

The per-rung census run for this port found **`interactive-book`** (port 14, shipped
2026-08-14, adapter already registered) still carrying the full sentinel-less pair.
The handoff's table censused only the ports still **unported**, so a port that had
already shipped fell through the gap — it shipped before 18d's literacy shape was
named. Fixed and gated in this slice (its suite had no rung assertion at all, which
is why it regressed silently); **its `--di-cap` re-drive is owed.**

Corrected census for whoever takes ports 5–11 — LIVE rungs only, comments excluded:

| Entry | scaffoldingLevels | note |
|---|---|---|
| `decodable-reader` | 2 | |
| `letter-sound-link` | 2 | |
| `letter-spotter` | 2 | |
| `read-aloud-studio` | 2 | |
| `phoneme-explorer` | **1**, not 2 | handoff implied two |
| ~~`interactive-book`~~ | ~~2~~ | **fixed this slice** — shipped port, not in the handoff's table |
| ~~`picture-vocabulary`~~ | ~~2~~ | fixed this slice |

**`commonStruggles` "goes quiet" responses are NOT instances.** Silence is not an
attempt, so no verdict is owed; push-pull-arena shipped the same shape deliberately.
Do not "fix" them.

---

## 4. ⭐ What the free probe found — the sharpest defect in the slice

**`sentence_frame` was unanswerable for the audience it is built for.**

The generator emits `frameDisplay` (the sentence, with a blank) and `frameSpoken`
(what the tutor says) as two fields. `frameSpoken` arrives **truncated at the blank**:

| `frameDisplay` (printed — a pre-reader cannot read it) | `frameSpoken` (what the child HEARD) |
|---|---|
| `Turn on the ____ when it gets dark.` | `Turn on the... hmm... what?` |
| `Look at the ____ to see what time it is.` | `Look at the... hmm... what?` |
| `Please open the ____ to go outside.` | `Please open the... hmm... what?` |

The clause that makes `lamp` and `clock` the one defensible answer exists **only in
the channel the child cannot use**. Four of five asks in one probe had no decidable
answer — "Turn on the… hmm… what?" is honestly answered by light, TV, oven, tap —
and the child is then **corrected** for it. The mode is *vocabulary in context*, and
the context was precisely what was being cut. The correction line always did read the
whole sentence, so the ask and the correction disagreed.

**Fix — the family's own pattern, not a new one:** `gradable_scale` never trusted an
LLM for its spoken form; `frameSpokenFor` now derives the spoken frame from
`frameDisplay` in code, blanking to `... hmm ...`. One source of truth, and the LLM
supplies the sentence while code builds the structure. `frameSpoken` now has no
consumer. Re-probed: *"We turn on the ... hmm ... when it is dark."*

**Second probe finding (harness-side, mine):** `naming`'s signature wrong was a fixed
category word `"animal"` — but the probe drew *bed, door, soap, cup, clock*, none of
them animals, so it was **false of the picture** and therefore an easy refuse that
tested nothing `plainWrong` did not. Changed to the empty superordinate `"a thing"`,
which is TRUE of every picturable noun — the discrimination the accept clause actually
claims (a fair different NAME counts; a word that merely describes does not). The
contract's wrong clause was extended to name it, so the claim and the test of the
claim stay together.

---

## 5. What the first live drive found

**`"My turn: this is a shoes."`** — §9 trap 5, third sighting in the family.

`article()` guessed the article from the first letter. The word pool is an open LLM
list carrying plurals (`shoes`) and mass nouns (`soap`, `bread`, `milk`) beside
singular count nouns, and English takes the article from a countability the word does
not carry. A stemmer would not fix it either. **The fix is to stop putting the target
in a frame that requires an article** — the bare word is the model DISTAR wants
anyway, and it is correct for every noun class: `My turn: Shoes. Your turn. What is
this?` Confirmed live on the re-drive (`My turn: Soap.`), and `soap` drew again,
which is the pool proving the point.

---

## 6. Gates

| Gate | Bar | Result |
|---|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.json` | 803 = HEAD baseline | **803**, 0 in touched files |
| `npm run typecheck:lumina` | 0 | **0** |
| `npx vitest run` | no new failures | **3344 pass / 4 skipped / 0 fail** |
| probe `.probe.diPlan`, 6 modes | drops explained, gates empty | **5 items each, 0 dropped, 0 gate issues** |
| revert-bite | every new gate bites | **5/5** |

Revert-bitten: the 18d catalog rung · the build gate's tap-target check ·
`TWO_BRANCH_LAW` ordering · the `NEVER_PERFORM` tail · interactive-book's rung gate.

The two canvas-confetti "Errors" in the vitest tail are the documented pre-existing
jsdom teardown noise (SolarSystemExplorer); 0 test files fail.

---

## 7. Drives

**Budget ruling (user, 2026-08-16): the cap drill is per CONTRACT SHAPE, not per mode.**
This port forks across two judging contracts (spoken, and the tap-mode silence
contract), and only `association`'s move-on carries a closing line — so three cap
shapes, not six. Port 3's mode-invariance observation reproduces under this rule
(one shared contract → one cap drill) without over-claiming it here.

**15 sessions run. 0 HIGH. 74 affirms / 77 refusals, every one with the right sentinel.
0 challenges dropped by the build gates in any session.**

| Drill | Modes | Result |
|---|---|---|
| plain | all 6 | 30/30 refused · 30/30 affirmed · 0 findings |
| signature | all 6 | 30/30 refused · 30/30 affirmed · 0 findings |
| cap | `opposite` (spoken shape) | 3/3 corrections opened `My turn:` · move-on carried the next ask · **only the known-open 18c pair** |
| cap | `receptive_match`, `association` | ⚠️ **did NOT run as cap drills — see below** |

**Sentinel discipline: 74/74 affirms opened "Yes", 77/77 corrections opened "My turn".
Embellishment: 0 of 74.**

### ⚠️ TWO OF THE THREE CAP SHAPES DID NOT ACTUALLY DRIVE, AND THE HARNESS DID NOT SAY SO

`--di-cap` hangs the drill off the **first VOICE item**:

```python
capped_id = next((i["id"] for i in plan["items"] if i["answerKind"] == "voice"), None)
```

On a gesture-only session — which is exactly what `--eval-mode receptive_match` and
`--eval-mode association` produce — `capped_id` is `None`, and the run **fell through
to an ordinary plain drive with no notice**. Both logged `wrong-answer mode: plain` and
would have been counted as cap drills by anyone reading the sweep afterwards.

**So the honest count is 13 distinct drives, not 15: 6 plain + 6 signature + 1 cap.**

This is the "a silently narrowed sweep reads as full coverage later" failure with the
HARNESS doing the narrowing. **Fixed in this slice:** `build_di_journey` now raises
instead of degrading, and says why. Verified — the same command now errors.

**The real coverage gap it was hiding:** a tap item's `moveOnCue` is only reachable by
capping a tap item, which this harness cannot do. On this port that leaves two things
driven by pack gates only, never live: `receptive_match`'s move-on (which must carry the
NEXT item's silence contract) and `association`'s close line (the only move-on that names
its pair, because its corrections deliberately never may). Both are asserted in
`PictureVocabulary.di-script.test.ts`. **Queued, not closed.**

### The 18d fix, verified at the beat it protects

The cap drill is the only path that reaches 18d, and on `opposite` all three corrections
routed through the scripted correction:

```
[wrong1] My turn: the opposite of empty is full. Your turn. What is the opposite of empty?
[wrong2] My turn: the opposite of empty is full. Your turn. What is the opposite of empty?
[wrong3] My turn: the opposite of empty is full. Your turn. What is the opposite of empty?
[moveon] Good try! Here comes the next one. Night. Your turn. What is the opposite of night?
```

The model did **not** swap in the ladder's *"Say the question once more"* on the 2nd or
3rd wrong answer — which is exactly what `counting-board` and `addition-subtraction-scene`
did before their fix (`di-no-verdict` ×2 each). **`interactive-book`'s cap drill was run
in this slice too and is equally clean** (3/3 `My turn:`), so its off-queue 18d fix is
live-verified rather than assumed.

### Content confirmations from the drives

- **`sentence_frame`** — every ask decidable, including blank-at-start (*"The ... hmm ...
  tells us what time it is."*) and blank-at-end with the tidy applied (*"Wash your hands
  with water and ... hmm."*). Pre-fix these were *"…hmm… what?"*.
- **`gradable_scale`** — post-fix drive drew **5 distinct scales, 0 dropped**; the repeat
  is gone and session length held at 5.
- **`naming`** — the judge refused `"a thing"` 5/5. The empty superordinate is TRUE of the
  picture, so this is a real discrimination rather than the easy refuse `"animal"` was.
- **`opposite`** — the judge refused the base word said straight back 5/5, and
  `pickModelOppositePair` was verified live: the session drew `down/up`, so the model pair
  correctly skipped its first entry and taught on **"day and night"**.
- **`association`** — the retry never named the answer (*"think about which one is used
  with plate"*), so the retry stays a real retry.

---

## 8. For 19h-i-c

picture-vocabulary carries the `NEVER_PERFORM` tail from birth in this slice, and
embellished **0 of 74 affirm beats** over the text channel across 15 sessions and 6 eval
modes — **the largest clean sample in the family by a factor of four.**

Standing comparison:

| Pack | Embellished | Tail |
|---|---|---|
| ten-frame | 5/7 | weak |
| counting-board | 3/7, then 5/7 | weak (at the time) |
| addition-subtraction-scene | 0/14 | strong |
| push-pull-arena | 0/16 | strong |
| **picture-vocabulary** | **0/74** | strong |

Affirm-line length was already ruled out by push-pull-arena (shortest lines in the
family, zero embellishment). This adds the largest sample on the other side, across six
modes and both answer kinds. **The tail is in.**

The item's own next step is unchanged and still owed, because none of this is a
before/after on ONE pack: `counting-board` received the extended tail during the item-21
backfill, so a single re-drive of `count` over text is the direct comparison. One session.
