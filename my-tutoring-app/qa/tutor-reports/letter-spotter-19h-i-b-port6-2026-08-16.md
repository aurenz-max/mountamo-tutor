# letter-spotter joins the judged-loop harness — 19h-i-b, port 6 of 11

**Date:** 2026-08-16 · **Queue:** `qa/di/BACKLOG.md` 19h-i-b · **Handoff followed:**
`qa/HANDOFF-19h-i-b-adapter-sweep-2026-08-16b.md` · **18d rode inside this slice.**

The adapter is 21 lines. Everything else was a defect the port already had — the
sixth port in a row where that sentence is true.

---

## 1. The port

- `letterSpotterScript` exports `letterSpotterPackBase` + `letterSpotterHarnessAnswers`
  + `leakExemptSpanFor`. The component spreads the surface and keeps only
  `statusLines` and `diagnosisObservation` (which closes over tap state).
- The di-script suite's hand-rolled pack literal is gone — **sixth port in a row
  carrying that drift**, and the one whose drift named the type: `JudgedCueSurface`
  exists because 19f found this pack's sayable-length bound at 90 on one side of
  the wire and 100 on the other.
- Registered in `DI_PORTS`. Gesture commits carry the **tapped letter**
  (interactive-book's `tapped` shape); both tap modes draw their wrong tap off the
  item itself, so unlike interactive-book no wrong-tap side table is needed.
- `NEVER_PERFORM` on four cue channels, replacing the weaker *"never read bracket
  tags aloud"* — which is what this pack shipped under when it fabricated an
  `[LSP_TAP]` message and read it out, tag and instructions included.
- `TWO_BRANCH_LAW` before the branches in the spoken judging contract.

**Clean on §4(a) and §4(c).** `contextFor` is question-side in all three modes
(`name-it` and `match-it` push no letter at all; `find-it` pushes it because there
the letter is the question), and every display was already bound to `items` —
including `phaseResultsFromSummary`. This port has had a build gate since birth.

---

## 2. ⭐ The one-character answer, and the first non-flat leak oracle in the sweep

Every earlier port answers with a WORD or a NUMBER WORD, so `\bcow\b` over a
lowercased tutor turn is a precise oracle. **Here the answer is a single letter,
and two of the twenty-six are also English words**: `\ba\b` matches the article,
`\bi\b` matches the pronoun.

The fix is not the exemption. Three of our OWN lines collided, and each was
reworded rather than exempted:

| Line | Was | Now |
|---|---|---|
| name-it how-to-play | "**A** star is hiding the first letter of **a** word" | "**The** star is hiding the first letter of **the** word" |
| name-it guide (easy) | "**I** will say the word on its own after the sentence." | "Then you will hear the word on its own." |
| match-it model line | "**A** big letter and **a** little letter can look different…" | "Big letters and little letters can look different…" |

All three read better on their own terms — there is exactly one marker, so "the
star" is what a child sees, and the match-it line was always trying to make the
general statement. **That leaves the collision only in the GENERATED sentence a
name-it ask reads aloud**, which is exempted, and only for those two letters.

Result: `match-it`'s oracle is **flat for all 26 letters**; `name-it`'s is flat for
24 and subtracts one span for `a` and `i`, with the greeting, how-to-play, lead-in
and hand-over still governed even there. Emptying `leakTokens` (trap 4) would have
switched the oracle off over exactly the prose most likely to leak.

`find-it` carries **no leak tokens at all**, and that is not the oracle switched
off: its answer is a POSITION, the tutor is told the letter (its stimulus) and is
never told where it is, so the leak class is structurally unreachable.

---

## 3. ⭐ §4(d) — one letter may be ANSWERED once per session

The leak neither item can commit alone:

> `find-it`'s ask NAMES its target letter out loud, because the letter is its
> stimulus and a search for an unnamed target is a broken task, not a harder one.
> `name-it`'s and `match-it`'s answers ARE a letter.

Put *"Find the letter A"* at item 2 and *"say the letter that ant starts with"* at
item 5, and the tutor has spoken item 5's answer, unearned, as item 2's question.
The same thing happens one beat later between two answer-side items: **an item
always closes on an affirmation or a capped move-on and both name the letter**
("Yes, ant starts with A."), so a second item on `a` is answered from memory
rather than from the sound of its word.

Under the click-era tap surface this was invisible — nothing said the answer
aloud. **It arrives with the modality**, which is what this sweep is for.

Gated in `itemsFromChallenges` (the boundary the RUNNER reads, so it also covers
cached and hand-authored payloads), with the prompt fixed too so the gate rarely
bites. `find-it` may repeat a letter freely. Revert-bite: a session of distinct
letters loses nothing.

---

## 4. ⭐ The free probe found `"Say the letter that sheep starts with"` — answer key `S`

Every gate passed it. The word does lead with the target letter; orthographically
that is even true. But the ask one line earlier says *"Listen for the sound at the
very start of the word"*, the catalog calls this mode "initial sound to grapheme",
and the sound at the very start of `sheep` is /ʃ/ — which `s` does not spell.
**Affirming `S` there teaches a five-year-old a false mapping inside the primitive
whose job is to make it true.**

It is a CLASS, not a word: the initial digraphs are exactly the shape where letter
one is the target and letter one is not the sound. Gated on `sh ch th ph kn wr gn`,
both in `itemFromChallenge` (drop) and generator-side (swap to the fallback word,
which keeps the item). Blends (`grass`, `stop`), `wh`, `gh` and `qu` are
deliberately NOT banned — there the first letter does spell the first sound, and
banning them would cost real items to buy nothing.

Six items were drawn per session; `sheep` was item 1 of 6.

---

## 5. ⭐ A pinned name_it lesson came back entirely code-authored — silently

The probe's second finding, visible only by reading the WORDS: one `name_it` draw
in two returned six challenges carrying `targetLetter` and nothing else, so every
item fell through to the hardcoded fallback word and a code-built frame — *"Look
at the ant."*, *"We found the ink."* A complete, well-formed, pedagogically sound,
**entirely topic-free** lesson, graded as a success and indistinguishable from a
good one downstream.

Cause: `required` on the challenge item lists only what EVERY mode needs, because
a find-it challenge must not be forced to carry a sentence. **But the manifest pins
an eval mode for essentially every production lesson**, and when exactly one mode
is allowed the schema can demand that mode's fields outright. `requireFieldsForPinnedMode`
does that for all three modes, turning a silent degrade into a schema violation the
retry can act on. Fallback substitutions are now counted and logged, with a `warn`
when the whole name-it lesson is code-authored.

**Before:** 1 of 2 draws fully code-authored, 0 topic words.
**After:** 3 of 3 draws model-authored — turkey, insects, pigs, alpaca, nannies,
nests, chicks. (Item 1's `s` word still swaps: the model reliably reaches for
"sheep", and the digraph gate is doing its job. That cost is visible and explained.)

---

## 6. 18d — the census was right about the rungs and blind to the row below them

`level1` and `level2` were both a re-spoken ask offered as a response to an
ATTEMPT; the census counted them correctly, because this entry calls its stimulus
"the question" and matches the family fingerprint exactly. All three rungs now
route through the scripted correction.

**What the fingerprint could not see, and this one was worse than a stall:**

> `commonStruggles`: *"Says a letter out loud instead of touching one"* →
> *"Stay silent and keep waiting; **only a touch is an answer here**."*

Written before `name-it` became a SPOKEN mode on 2026-08-13 and never revisited. A
tutor reading it in the sentence direction sits silent through a child's **correct**
spoken letter: no verdict, no advance, in the one direction where speaking IS the
answer. Scoped to the two touch directions, where silence is genuinely right
because nothing has been committed yet.

The *"goes quiet"* rows on other entries remain untouched — silence is not an
attempt, so no verdict is owed.

---

## 7. Drives — 7 sessions, 0 HIGH, 0 findings outside the known 18c pair

Contract shapes, counted before spending a session (§1): `moveOnCue` forks exactly
once — `name-it` carries a close line ("The word sun starts with S.") because its
corrections never name the letter, while `find-it` and `match-it` carry none. **But
`--di-cap` hangs the drill off the first VOICE item, so a session pinned to either
tap mode has no cap path at all** (the harness now raises). Honest budget: **7
drives, not 8.**

| # | Drive | Result |
|---|---|---|
| 1 | `name_it` plain | PASS — 6/6 refused, 6/6 affirmed |
| 2 | `name_it` signature | PASS — **6/6 refused the word said straight back**, 6/6 affirmed |
| 3 | `name_it` cap | 3/3 corrections opened `My turn:`, close line spoken, no `di-no-verdict`, no ladder swap · 18c pair |
| 4 | `find_it` plain | PASS — **6/6 `hands-hold` beats SILENT**, 6/6 code-computed verdicts |
| 5 | `match_it` plain | PASS — 6/6 `hands-hold` silent |
| 6 | `blended` plain | PASS — 2 spoken + 4 hands in ONE session; holds silent even directly after a voice item it just judged in-band |
| 7 | `blended` cap | move-on carried a **find-it** ask; `hands-hold` then SILENT · 18c pair |

**Signature wrong** is this port's sharpest: the child says the WORD back ("sun",
"ant", "turkeys", "insects", "pigs", "nine"). It carries the target sound at its
front, it is a real word said confidently, and the tutor spoke it aloud two
seconds earlier — the utterance a judge listening loosely for "something beginning
with /s/" affirms. Refused 6/6.

**Drive 7 is new coverage the handoff listed as open.** §7's *"Tap-mode `moveOnCue`
is UNDRIVABLE"* row is half-closed: a move-on cue whose payload is a TAP contract
is now driven, and the tutor honoured the silence that arrived inside it. What
remains undrivable is a cap drill on a tap ITEM itself — the cap hangs off a voice
item, so `moveOnCue(tapItem, next)` is still gate-covered only. **`blended` is not
a catalog eval mode**; an unknown `evalMode` resolves to a null constraint, which
is how a mixed session is reachable without touching the harness.

`--di-wrong signature` on a gesture-only session is a **no-op** — the journey
builder `continue`s past the wrong-kind branch for gesture items, so it replays the
plain drive byte for byte. Not driven, and not counted.

---

## 8. Gates

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **803 = HEAD baseline**, 0 new, **0 in any touched file** |
| `npm run typecheck:lumina` | **0** |
| `npx vitest run` | **3375 pass / 4 skipped / 0 fail** (+12) |
| probe `.probe.diPlan` | **0 dropped, 0 `packGateIssues`** on every post-fix draw |
| `--di` | 7 sessions, **0 HIGH** |
| revert-bite | session gate + digraph gate + 18d rungs each bite |

The canvas-confetti "Errors" line in the vitest tail is the known pre-existing
jsdom teardown noise; 0 test files fail.

---

## 9. Residual — queued, not fixed

1. **`x` cannot be asked in `name-it`.** The fallback word is `x-ray`, which fails
   `isSayableWord` (hyphen), so every `x` name-it item silently drops. The drop is
   the RIGHT behaviour — there is no phonetically clean x-initial word a
   five-year-old knows — but it is implicit rather than declared, and it only
   reaches Group 4. A curriculum call about whether `x` belongs in this mode at
   all, not a build gate.
2. **`match-it` speaks a byte-identical ask on every repeat item.** By design and
   already litigated (the mode has nothing sayable that varies), and the
   repeated-ask gate passes it at 9 words. Five identical asks in a row is still
   what a child hears in a pinned `match_it` session.
3. **Transcript-only WARN class unchanged.** The two cap drills carry the 18c
   verbatim-repeat pair, which these contracts deliberately command. Not re-filed.

---

## 10. For port 7 (`letter-sound-link`)

Its `scaffoldingLevels.level1` is **byte-identical** to the one fixed here
(*"Say the question once more, then wait for them alone."*, `literacy.ts:1574`) —
the census's 2 rungs are real. Two of its three modes tap, so expect the same
`--di-cap` arithmetic: budget cap drills only among modes with a voice item, and
reach the tap contracts through a blended drive instead.
