# Reader Fit: time-sequencer @ PRE — 2026-09-08

Modes audited: sequence-3, sequence-5, before-after, duration-compare, read-schedule
Probes: eval-test ✓ (12 K draws + 2 Grade-1 controls) · tutor-test --probe ✓ · headless Chrome drive ✓
Origin: K Math atlas item `time-sequencer-k-prereader` (slice 5), requirements PTRN001-03-C,
TIME001-01-B, MEAS001-07-F. Live drives were not run (no mic sitting).

## The finding, restated from the probe

For `sequence-3` at K, **all ten items across both saved draws — and ten more in two fresh
draws taken today — told the child to read the clock time on each card.** Not as flavour: the
time was the *only* on-screen ordering cue, the strategy hint spelled the reading strategy out,
and the card printed `8:30 AM` under every label.

The mechanism was one missing argument. `resolveSupportStructure(pinnedType, tier)` took no
grade. The grade band WAS resolved in the same file — 90 lines later, at the tail, where it did
nothing but label the payload. So the easy tier set `showTimeAnchors = true` and emitted the
line *"names the ordering strategy (read the time on each card, earliest → latest)"* at every
band, and every probe ran at easy. The pre-reader's **support** was a reading task.

## Audit A — text census (K, easy tier, before the fix)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| `8:30 AM` under each event label | `EventCardVisual`, `showTime` | **Load-bearing** — the ordering cue | none (tutor may point at it, cannot read it for them) | **UNCOVERED** |
| "Read the time on each card and tap them in order" | `challenge.instruction` | Load-bearing | `[ACTIVITY_START]` speaks it | COVERED as speech, but it instructs a task the child cannot do |
| "Read the time on each card and put them in order from earliest to latest." | `strategyHint` | Load-bearing | none | **UNCOVERED** |
| "Check the hour on each clock time." | `challenge.hint` | Supportive | none | **UNCOVERED** |
| "…by reading the times!" | activity `description` | Decorative | none | UNCOVERED (harmless) |
| Event label ("Cook breakfast in the kitchen") | card | Supportive — emoji carries it | tutor reads instruction only | acceptable |

Audit A **FAILS**: the only cue that distinguishes two cards is a printed clock time.

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| sequence-3 / -5 | PASS — `[ACTIVITY_START]` fires with `{{instruction}}`, which resolves from the component bag | PASS — the cards are pictures | PASS — the instruction states the direction | **FAIL** — "Not quite — 2 out of 3 are in the right spot" is quantitative error prose (band rule 5) | **FAIL** — `tutorRevealPolicy('easy')` licensed the tutor to "name the ordering strategy (read the time on each card)" and `commonStruggles` coached clock reading ("look at the number before the colon") |
| before-after | PASS | PASS | PASS — relation word in the instruction | PASS | FAIL (same two spoken lines) |
| duration-compare | PASS | PASS | PASS | PASS | PASS |
| read-schedule | PASS | **FAIL** — the schedule table is the stimulus and nothing reads it | FAIL | PASS | n/a |

Eight contextKeys (`events`, `correctOrder`, `event`, `correctPeriod`, `referenceEvent`,
`relation`, `schedule`, `targetTime`) are declared in the catalog and absent from the
component's `aiPrimitiveData`, so their RUNTIME STATE lines are silently dropped. That is a
pre-existing `/tutor-test` HIGH, not a reader-fit blocker — the tutor never needed to name a
card — but it means the tutor cannot describe the sky cue either. Left open; see residuals.

## Audit C — band contract (K)

| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is the instruction channel | **FAIL** → PASS | the clock time gated progress; now nothing printed does |
| 2 Tap = choose | PASS | sequencing is a multi-part construction, so its Check button is sanctioned |
| 3 Pictures are the answer surface | PASS (sequence/before-after) · **FAIL** (duration-compare "About the Same" was the one text-only option) · FAIL (read-schedule) | |
| 4 One thing per screen, ≤ ~5 elements | PASS — 3 cards at sequence-3, 4-5 at sequence-5 | |
| 5 Feedback on the touched object, no quantitative error prose | **FAIL** → PASS | "2 out of 3 are in the right spot" |
| 6 No typing | PASS | |
| 7 No adult chrome | PARTIAL — grade badge and `n/5` counter sit in the child's field | the shared K-stage case, not fixed here |
| 8 Assessment hides in the mechanics | PASS | |

## Verdicts

| Mode | Verdict | Fix layer |
|---|---|---|
| sequence-3 | **PRIMITIVE-GAP + SCAFFOLD-GAP** → READY | generator (band-aware scaffold), component (sun strip, feedback), catalog (tutor lines) |
| sequence-5 | same → READY | same, plus the card-count fix below |
| before-after | same → READY | same |
| duration-compare | PRIMITIVE-GAP (minor) → READY | component (picture on the third option) |
| read-schedule | **WRONG-BAND** | none — printed clock times ARE its task. Floor holds at Grade 1-2, and the catalog now says why |

## What was built

**The K easy tier's perception anchor is a sun position, not a printed time.**
`dayFractionFor(typicalTime)` turns the time the model already supplies into a 0-1 position
through the day; `SkyStrip` draws a sun or moon at that point on a slice of sky. Nothing is
read, and the same perceptual information survives the swap.

Four decisions inside that are worth keeping:

1. **A position, not a sky emoji.** Four buckets (🌅 ☀️ 🌇 🌙) would give three events inside
   one morning the same picture, and the child could not order them. The marker slides
   monotonically with the time, so any two events that differ in time differ on screen.
2. **The strip is windowed to the challenge, not the day.** 7:00, 8:00 and 9:00 are 4% of a
   24-hour strip apart — about five pixels — which is not a scaffold. `skyWindowFor` zooms to
   the challenge's own span (padded), and the gradient is sampled over that same window, so
   the picture stays true and becomes readable. Measured in Chrome: markers at 40px, 67px and
   94px on a 150px strip.
3. **The cue is withdrawn rather than allowed to lie.** If the model's times do not rise along
   `correctOrder`, or a card has no usable time, `showSkyCue` goes false for that challenge and
   the strategy line falls back to routine reasoning. Copy that named the sky is rewritten in
   the same branch, so a withdrawn strip never leaves "look at the sun in the picture" pointing
   at nothing. 0 of 20 challenges needed it after the schema fix below; before it, 4 of 5 did.
4. **Grade 1-2 is untouched.** `showTimeAnchors` is still the easy-tier anchor there. Reading a
   clock is a real Grade-1 skill; it is only at K that offering it as *help* is the bug.

**Copy guard.** `PRE_READER_PROMPT_SECTION` bars clock language from K instructions, hints,
titles and descriptions; `mentionsClockReading` + `repairPreReaderCopy` are the backstop, in the
shape slice 1 established on number-sequencer — replace the offending field, keep the generated
events, log what was rewritten. Plain "time" is deliberately not matched: "Which one takes more
time?" IS the duration task.

**Spoken lines followed the screen.** `tutorRevealPolicy` takes the band and, at K easy, licenses
the sun-picture strategy while banning any mention of a clock, a time or a number. The catalog's
clock-reading `commonStruggle` is now marked Grade 1-2 only, and `level1` gained the K clause.

**Two caps found on the way, both below what the published objective names:**

- `sequence-5` returned three cards. The prompt said "For K: 3 events max" — a *band* rule where
  the eval mode should decide — and the schema required only slots 0-2 while describing slots 3
  and 4 as "use empty string if fewer". `buildSequenceEventsSchema(minEvents)` now requires the
  slots the mode needs and withdraws the empty-string escape from them. K PTRN001-03-F asks for
  4-5 picture cards; draws now return 4.
- `event{n}Time` was optional. Draws came back with labels and no times, which at K is not
  cosmetic — the sun cue is derived from that time, so a missing one silently costs the child the
  whole easy-tier scaffold. It is required now.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | **0** (one unrelated error in `gemini-sorting-station.ts` belongs to a concurrent session, not this slice) |
| `npm test -- src/components/lumina/service/math` | **192/192**, 26 files |
| K clock language, fresh draws | **0 / 25 items** — sequence-3 ×2, sequence-5, before-after, duration-compare (was 10/10 on sequence-3) |
| Grade-1 control | **5 / 5 items still read the clock** — the band split does what it claims |
| Sun cue vs `correctOrder` | **0 / 20 challenges contradict**; withdrawal branch fired 0 times after the schema fix |
| Headless Chrome, K + easy | strips render at 40 / 67 / 94px on a 150px band; `CLOCK TIME VISIBLE ON SCREEN: false` |

**Overall: READY @ PRE** for sequence-3, sequence-5, before-after and duration-compare.
**WRONG-BAND** for read-schedule, by design.

## Residuals

1. **No live drive.** `[ACTIVITY_START]` and the reveal policy were read from the tutor-test
   prompt preview, not heard. The spoken half of Audit B is unconfirmed — needs a mic sitting.
2. **No anchor at K when no support tier is pinned.** The sun cue lives on the easy tier, so a
   session that pins no `difficulty` gets no perception anchor. That is unchanged from before
   (the clock anchor was equally tier-only), but at K it may be the wrong default.
3. **Eight unresolvable contextKeys** (`/tutor-test` HIGH, pre-existing). The tutor cannot name
   a card or the sky it shows.
4. **Adult chrome** — the grade badge and `n/5` counter. The shared K-stage case.
