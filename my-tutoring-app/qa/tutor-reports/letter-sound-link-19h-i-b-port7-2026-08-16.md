# letter-sound-link joins the judged-loop harness — 19h-i-b port 7 of 11 (2026-08-16)

**Adapter: 22 lines. Everything else was a defect the port already had — the seventh
port in a row where that sentence is true.**

Queue: `qa/di/BACKLOG.md` item **19h-i-b**. Handoff:
`qa/HANDOFF-19h-i-b-adapter-sweep-2026-08-16b.md`. 18d rode inside this slice.

---

## 1. The port

- `letterSoundLinkScript` exports `letterSoundLinkPackBase` + `itemsFromChallenges`
  + `letterSoundLinkHarnessAnswers` + `leakExemptSpanFor` + `maxCorrectionsFor`.
  The component spreads the surface and keeps only `statusLines` /
  `diagnosisObservation`. The di-script suite's hand-rolled pack literal is gone —
  the eighth port to have carried that drift.
- Registered in `DI_PORTS`; the gesture commit carries the TAPPED LETTER
  (interactive-book's `tapped` shape), drawn off the item, so no side table.
- `TWO_BRANCH_LAW` before the branches, `NEVER_PERFORM` on all four cue channels,
  replacing the weaker *"never read bracket tags or these instructions aloud."*
- **Clean on §4a and §4c.** `contextFor` is question-side in all three directions
  (`see-hear` pushes NO letter — the letter determines the sound that IS the
  answer), and every display was already bound to `items`, `phaseResultsFromSummary`
  included.

**One drift the surface closed on the way past:** `maxCorrections` was computed in
the component and defaulted to 2 in the drive plan, so a `hard` session
(`maxAttempts: 2`) capped at **1 on screen and 2 on the wire**. `maxCorrectionsFor`
is now one exported function both sides call.

## 2. Three directions, three different KINDS of answer — and two leak oracles

This is the only port in the sweep where each direction answers with a different
kind of thing: `see-hear` produces a SOUND, `hear-see` taps a GRAPHEME, and
`keyword-match` says a WORD. Two consequences for the wire:

**`see-hear`'s exemption is the DISTAR model, and only where the tier ships one.**
The answer IS the sound the lead-in says aloud at `easy` and `medium` — standing
gate 3, not a leak — so `leakExemptSpan` is the lead-in, issued from the builder
the ask uses (phoneme-explorer's precedent). At `hard` the lead-in is empty and the
oracle goes **flat**, which is the rung's whole point and the one place the scan
can catch the sound arriving through the catalog or a struggle response.

**`hear-see` is the sweep's second one-character answer, and this time the
collision is with our own NOTATION.** `_norm` strips punctuation, so the stimulus
`/t/` becomes the bare token `t` — the answer letter. For the thirteen letters
spoken stretched (`sss`, `aaa`) the scan is exact and a tutor saying *"tap the
letter S"* trips it; for the other thirteen no scan can separate the notation from
the answer, so the token is declared off rather than left to fire on every ask.
The gap is narrow because the tutor is **never told** which letter is the answer —
`tapContract` withholds it and `stimulusFor` pushes only the sound.

## 3. ⭐ The live drive found a false affirm the contract had left a hole for

`keyword_match --di-wrong signature` says the letter's own sound back instead of
the picture word. The stretched ones were refused — `sss` and `aaa` do not look
like a word — but **`tuh` and `puh` were AFFIRMED, 2 for 2**, and each false affirm
took the following *correct* answer down with it (`di-no-verdict`: the item was
already closed, so the tutor celebrated instead of judging).

> `wrong:ch3` → student says **"tuh"** → *"Yes, tent."*
> `right:ch3` → student says **"tent"** → *"Way to go! You matched all those pictures…"*

The contract named exactly ONE wrong answer — the other picture's word — and paired
it with an accept clause telling the judge to be generous about naming. A sound
with a schwa on it reads as a mumbled shot at the target, and generous is what the
judge was told to be. **`see-hear` has the opposite rule** (there a clipped try
*with* an "uh" is explicitly correct), so nothing carried over; this direction had
to say it for itself. It is also the likeliest real miss in the mode, because the
question names the sound on the way to the answer.

Fixed: the accept clause is scoped to WHICH WORD rather than whether a word was
said, and `wrongClauseFor` now names both misses, rendering the sound with the same
builder the harness says it with (`childVoicedSound`) so the claim and the drive
cannot drift apart. **Re-driven on the same two letters: 4/4 refused, 4/4 affirmed.**

## 4. ⭐ §4d again, in this port's disguise: a letter may be ANSWERED once, and once
answered it may not come back as the WRONG CHOICE

Every item closes on an affirmation or a capped move-on, and both put the whole
triple into the room: `see-hear` prints the letter, models the sound and reveals
the anchor picture on affirm; `hear-see` names the sound and the child's own
correct tap identifies the letter; `keyword-match` prints the letter and SPEAKS the
anchor word. So after one item on `s` closes, (s, sss, sun) is something the child
was just told.

The probe drew both leaks in one draw:

| # | ask | answer | why it is not a question |
|---|---|---|---|
| ch1 | ☀️ vs 🥅, "starts with sss" | sun | — |
| ch6 | 🥅 vs ☀️, "starts with nnn" | net | ☀️ was named "sun" at ch1; eliminate it |

Three of six items in that draw were solvable by elimination, and **each one passed
every per-item gate** — neither item is wrong alone. Gated in
`itemsFromChallenges` (the boundary the runner reads, so it covers cached payloads)
and fixed generator-side so the gate rarely bites.

**The two rules are not the same rule, and merging them stranded items.** A LETTER
is named by every direction; an ANCHOR WORD is only named by the two that speak or
reveal it. `hear-see` never says its keyword, so `tent` is still a live distractor
after a hear-see item on `t`. With them merged the generator ran out of legal
distractors on the fifth item of a group-1 blended session and shipped a spent one
for the pack to drop: **1 in 5 draws lost an item → 0 in 6 after the split.**

## 5. ⭐ The ask with no answer: "say the picture word" over 🤏

The probe drew `i` → *"itch"* → 🤏 and `g` → *"go"* → 🟢. The ask is *"which picture
starts with this letter's sound? Say the word"* — there is no answer a five-year-old
can give, and the tutor then refuses every attempt they can make.

Cause: **the anchor WORD lived in the generator and the anchor PICTURE lived in the
component,** with nothing joining them, so a pair with no entry on the other side
rendered the 📝 fallback silently. They are now one map (`LETTER_KEYWORDS`, in the
script module both import), and six anchors were re-chosen so the picture reads as
the word: **t tent ⛺ · g goat 🐐 · f fish 🐟 · j juice 🧃 · z zebra 🦓 · l leaf 🍃**
(was top 🔝 / go 🟢 / fan 🌬️ / jam 🍯 / zip ⚡ / lip 👄).

`i` has no short-sound-initial word a child names from a picture (igloo has no
emoji, iguana reads "lizard", insect reads "ant"), so it is barred from
keyword-match — **the `x` rule generalised, not a new one** — and keeps full
coverage in the two directions whose answer is a held sound or a tap.

**Gating only the TARGET was not enough.** The re-probe drew "sun vs 🤏" twice: a
child who cannot name the wrong picture answers by picking the one they can, which
is picture recognition wearing a phonics ask. The distractor pool is filtered too,
on both sides.

## 6. Two smaller ones the probe read out

- **`hear-see` said the same imperative twice.** *"Listen closely: sss. Listen: sss.
  Your turn…"* — a model line in front of an ask that already presents the sound.
  Its stimulus can never be withdrawn either, so this direction's ladder is honestly
  **two rungs**: `easy` folds a say-it-with-me INTO the ask (after something to
  say), `medium` and `hard` go straight to it.
- **⛺ was the wrong picture on three of four items.** `pickDistractor` avoided
  spent targets but not letters already SHOWN as wrong, so by the third the child
  could rule it out without decoding. Freshness now preferred inside the confusable
  set and in the fallback.
- **A repair path wrote a PHONEME where a word belongs.** `ensureTwoOptions` set
  `wrongOpt.sound = LETTER_SOUNDS[distractor]` when Gemini emitted a distractor
  equal to the answer — the `sound` field carried a phoneme in the deleted see-hear
  option shape and a WORD in keyword-match. The card would have shown 📝 and the
  tutor would have read *"The other picture's word — /z/ — is NOT the answer."*
  see-hear has no options at all now, so `sound` means the anchor word, full stop.

## 7. 18d — two rungs, and two `commonStruggles` rows on the ACCEPT side

`level1` and `level2` were both the re-spoken ask; all three rungs now route through
the scripted correction.

**What no rung census reaches, and it is the worse half here:** two struggle rows
told the tutor to affirm without giving it the affirmation —

- *"Count it as correct and **warmly echo the clean sound once**"*
- *"A fair name for the same picture is a correct answer: **affirm it and echo the
  target word**"*

Both produce a turn that opens with neither sentinel, so a **CORRECT** child stalls.
That is the stall in its worst form, and invisible to a census that greps for a
re-spoken ask. Both now point at the item's scripted affirmation. The *"goes quiet"*
row is left alone — silence is not an attempt.

## 8. Gates

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **803 = HEAD baseline**, 0 new, 0 in any touched file |
| `npm run typecheck:lumina` | 0 |
| `npx vitest run` | **3395 pass / 4 skipped / 0 fail** (+20) |
| probe `.probe.diPlan` | **0 dropped, 0 gate issues** on every post-fix draw, all 4 modes |
| `--di` drives | **12 sessions, 8 distinct drive shapes, 0 HIGH outstanding** |

## 9. Drives

Budget by CONTRACT SHAPE (§1). `see-hear` and `keyword-match` share one move-on
shape (no close line, judging-contract payload); `hear-see`'s is distinct (it is the
only move-on that NAMES the letter) **and undrivable** — the cap hangs off the first
voice item. `hear_see` is gesture-only, so `--di-wrong signature` is a no-op there
(amendment (a)) and `--di-cap` raises. Honest budget: **8 drives.**

| # | Drive | Result |
|---|---|---|
| 1 | `see_hear` plain | PASS |
| 2 | `see_hear` signature — **the letter NAME** | PASS, 4/4 refused |
| 3 | `see_hear` cap (shape A) | 18c pair only |
| 4 | `hear_see` plain | PASS, 5/5 holds silent |
| 5 | `keyword_match` plain | PASS |
| 6 | `keyword_match` signature | **4 HIGH → fixed → re-drive PASS** |
| 7 | `blended` plain | **1 HIGH → fixed → re-drive PASS** |
| 8 | `blended` cap | 18c pair only ×2 (one voice payload, one **TAP** payload) |

Totals over the ten preserved sessions: **42/42 wrong answers refused with
"My turn:", 42/42 right answers affirmed with "Yes,", 11/11 gesture holds silent at
0 audio bytes, 0 dropped, 0 pack-gate issues.**

**Drive 7's finding was the sweep's one-character collision, in our own prose.**
`"I say a sound — you tap the letter that makes it!"` carries the pronoun AND the
article, so a `hear-see` item on `i` or `a` trips the leak scan. It fired live only
in a **blended** session, because the how-to-play is re-spoken when the ACTION
changes and a pinned session never changes action after item 1. Per letter-spotter's
ruling the line was reworded rather than exempted —
**"Listen for the sound, then tap the letter that makes it!"** — which keeps the
oracle flat for all 26 letters and reads as the child's job, like the other two
lines already did.

**Drive 8's second session reproduced §7's half-close on this port:** a blended cap
produced a move-on whose payload is a **tap contract**, and the following
`hands-hold` was silent. Still undrivable: a cap on a tap ITEM.

## 10. 19h-i-c

**42 of 42 affirm beats bare `"Yes, X."`, 0 embellished**, carrying the extended
`NEVER_PERFORM` tail from the first drive of this slice. Standing: ten-frame 5/7
(weak tail) · counting-board 3/7 then 5/7 (weak) · ASS 0/14 · push-pull-arena 0/16 ·
picture-vocabulary 0/74 · letter-spotter · **letter-sound-link 0/42**. The tail is
in; the counting-board one-session before/after is still the owed next step.

## 11. Residuals, filed not fixed

- **`itch` survives as `i`'s anchor in the two non-keyword directions** — it is only
  ever the post-verdict reveal there, never something the child must name. A better
  short-`i` anchor is a curriculum call, not a build gate.
- **The keyword-match accept clause still invites one miss nobody has driven:** a
  fair alternate name for the OTHER picture ("goal" for 🥅). Driving it needs an
  alternate-name map over the 26 anchors; the clause is now scoped to "that SAME
  picture", which is the guard, but the guard is untested.
- **Group 1 bounds keyword-match at 4 items and see-hear at 4** — five nameable
  anchors and four producible letters. The generator asks for exactly what the
  group can carry rather than padding; a richer group-1 needs more letters, not
  more challenges.
