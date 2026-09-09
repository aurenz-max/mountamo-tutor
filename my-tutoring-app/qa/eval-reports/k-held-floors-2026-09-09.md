# The two HELD band floors get K-reachable modes — 2026-09-09

K Math atlas item `k-band-floor-reaudit`, the half the 2026-09-08 re-audit left open.
Executor `/add-eval-modes`. Three rows: **OPS001-02-G**, **OPS001-03-F**, **TIME001-03-G**.

The re-audit gave twelve floored modes a verdict each and brought ten down. Two held as
WRONG-BAND at PRE, and holding them was right: `number-bond / fact_family` types four
equations and `time-sequencer / read-schedule` reads printed clock times, and in both the
banned medium IS the declared skill. But the three published K rows behind them were left
pointing at redirects nobody had run. This slice ran them, found both redirects wanting,
and built the two modes they were missing.

## What the probe found

`qa/eval-reports/k-held-floors-2026-09-09.json` — the live generators, each redirect
pinned at Kindergarten, 2 draws apiece.

**`number-bond / missing_part` does not carry the inverse relationship.** Ten K turns
across both objectives, every one of them the same shape:

> "Three is the whole. One part is one. What is the other part?"

The words "take away" do not occur anywhere in the session. That is part-part-whole, ten
times. Both objectives name the *connection* — "connect addition and subtraction as inverse
operations **using related facts**", "demonstrating addition-subtraction relationship" — and
one unknown-addend turn is one fact, not a relationship.

**`analog-clock / read` and `sequence-5` cannot meet.** The draw for `read` was even titled
"My Daily Schedule" and paired each clock with an activity — but its four answer options are
printed digital times ("7:00", "9:30", "1:30"), and every challenge stands alone: there is no
sequence in it. `sequence-5` has the sequence and, since slice 5, deliberately puts **no**
clock time on screen at K. The objective asks for whole-hour times *and* daily activities
*in sequence*; one mode has the first half, the other the third, and the mode that had all
three is the one whose floor held.

## What was built

### `number-bond / related_fact` — β 3.0, K + Grade 1, spoken

One bond, two judged turns. Turn 1 is the addition fact; turn 2 is the subtraction that
matches it, and its known part is **the number the child produced on turn 1**:

```
c1::f0  (whole 4, known 1 -> 3)  "One and how many more make four?"
c1::f1  (whole 4, known 3 -> 1)  "Good — now the other way round. Four take away three. What is left?"
c2::f0  (whole 5, known 2 -> 3)  "Two and how many more make five?"
c2::f1  (whole 5, known 3 -> 2)  "Good — now the other way round. Five take away three. What is left?"
```

The child has to spend their own answer to get the next one. That is the inverse
relationship as an action rather than an assertion, and it uses the benched
`number_word_to_20` channel — no new response class, no new bench sitting.

**The parts must differ, and that is a gate, not a preference.** With `part1 === part2`
both turns answer the same number and a child who simply repeats themselves scores the turn
that measures the relationship. The script drops a symmetric bond outright; the generator
repairs one before it gets there, so a draw does not lose challenges to it. The oracle
refuses it as an `answer-key-desync`.

`fact_family` keeps its Grade-1 floor and its catalog prose now names the redirect and cites
the probe.

### `time-sequencer / clock-sequence` — β 3.5, K

The child orders daily activity cards, and each card carries an **analog clock face** at the
hour that activity happens. Same ordering gesture `sequence-5` uses; the face supplies the
whole-hour time the objective asks them to connect. The face is a picture, so it carries no
reading demand — which is what lets it sit at K under a constraint whose first sentence still
says nothing on screen prints a clock time. It does not: a dial is not digits.

β 3.5 fills the gap between `duration-compare` (3.0) and `read-schedule` (4.0), and the
placement is the pedagogy: this is the bridge from ordering a routine to reading a schedule.

**Three code-owned drop gates**, because the face is the child's only cue and a cue that
lies is worse than none:

| Gate | Why |
|---|---|
| every time is a whole hour | 7:30 needs a minute hand this band has not been taught |
| no two cards share an hour | identical faces make the pair unorderable by the taught cue |
| one half of the day | a 12-hour face cannot separate 8 AM from 8 PM |
| hours rise along `correctOrder` | slice 5 could withdraw the sun strip here; there is nothing to withdraw to |

All four fired on real draws (2 crosses-noon, 1 order-disagreement across 8 draws) and yield
stayed at 4-5 challenges, above the mastery floor.

This is the one challenge type whose copy may say "clock" at K — the objective sits under the
skill *Telling Time to the Hour*, so a rule forbidding the word would be a cap below what the
lesson asks. Printed digits stay banned for it like everywhere else.

## Evidence

| Check | Result |
|---|---|
| `probe-number-bond-related-fact.mjs --draws=3` | **18/18 clean** — K on both objectives + a G1 control, auto and hard tiers; oracle clean, 2 turns per bond, turn 2 answers a different number, no answer word in either ask or in the opening how-to-play |
| `probe-time-sequencer-clock-sequence.mjs --draws=2` | **8/8 clean** — K auto/easy/hard + a G1 control; whole hours, distinct hours, one half-day, hours rise along `correctOrder`, no printed time |
| Headless Chrome drive | **9/9** — 3 analog faces render and are tappable, ordering works with them, no printed time on the K stage; the bond shows `?` for the unknown and does not show turn 2 before turn 1 is answered |
| `typecheck:lumina` | 0 errors in the files this slice touched |
| `npm test` (number-bond, time-sequencer) | 55/55 |
| `curriculum-coverage-check.mjs --scope math-k` | 51/51 draws, 0 failed |
| Atlas rebuild | candidate 137 → **140**, partial 24 → **21** |

Screenshots: `clock-sequence-k-2026-09-09.png`, `related-fact-k-2026-09-09.png`.

## Two defects the probes caught in this slice's own code

1. **A number word inside a fixed phrase is an answer leak.** Turn 2's ask began "now the
   same **three** numbers the other way", and the how-to-play read "the same three numbers
   **two** ways" — so the script said the answer aloud whenever it was 3 or 2. The G1 draws
   failed on it 4 times before the phrasing went number-free ("the other way round", "I will
   ask about the same number bond twice"). This is the same class the file's own comments
   already record for `missing-part` ("has TWO parts" would put "two" in every ask).
2. **`KINDS` is a second registration point.** Adding the kind to the union, to `K_KINDS`
   and to every switch was not enough: `itemsFromChallenge` looks the type up in a separate
   `KINDS` array, so the first probe returned 12 draws of *zero judged turns* from perfectly
   good challenges.

Neither would have shown up in a type check, and neither showed up in the unit tests.

## Residuals

1. **No live mic drive of `related_fact`.** The two-turn loop has been probed, oracle-checked
   and rendered, but never *heard*. Its judging contract, its correction and its
   relationship-naming affirmation are all untested against a real tutor. `/tutor-test
   number-bond --di` is the next executor.
2. **No `/eval-test` on either mode.** This slice proves the modes are structurally sound and
   K-reachable; it does not judge content quality across a full session. Both rows record it
   as `nextAction`.
3. **No time-sequencer oracle.** `clock-sequence`'s content contract lives only in the probe
   script. `/oracle-test time-sequencer` would make it CI-able — the four drop gates are
   already code-judged and would port directly.
4. **The support tier does nothing for `clock-sequence` beyond `prelabelFirstSlot` and the
   strategy hint.** The face is structural and neither time anchors nor the sun cue apply, so
   easy and hard differ less here than in `sequence-events`. `/add-structural-difficulty`
   (more cards, closer hours) is the honest lever if the mode needs a real ramp.
