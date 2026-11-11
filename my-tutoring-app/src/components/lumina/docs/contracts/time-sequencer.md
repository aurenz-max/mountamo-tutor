# Contract: time-sequencer

- **Component:** `primitives/visual-primitives/math/TimeSequencer.tsx` ·
  **Domain:** `primitives/visual-primitives/math/timeSequencerWorkspace.ts` ·
  **Generator:** `service/math/gemini-time-sequencer.ts` ·
  **Card / boss:** `timeSequencer.card.ts` · `timeSequencer.boss.ts` (spoken preset; the adapter is `bossAdapter`) ·
  **Catalog:** `service/manifest/catalog/math.ts` (`id: 'time-sequencer'`)
- **Status:** ACTIVE. Seeded 2026-10-09 by the W1 workspace binding; not a full `/primitive-contract` derivation.

## Requirements

### R1 — no clock time at Kindergarten except clock-sequence's face · OBSERVED
- **Property:** at gradeBand K no card, instruction or tutor line prints or says a clock time; the easy tier's
  anchor is the sun-position strip. clock-sequence draws an analog face (a picture) at a whole hour.
- **Demanded by:** catalog `constraints`, reader-fit `qa/reader-fit/k-band-floor-2026-09-08.md`.
- **Probe:** `TimeSequencer.workspace.test.tsx` "clock-sequence never names the hours to the tutor".

### R2 — the pre-placed first card is the ONLY seeded slot · OBSERVED
- **Property:** `prelabelFirstSlot` seeds `correctOrder[0]` and nothing else, on a fresh item and after Try again.
- **Probe:** `TimeSequencer.workspace.test.tsx` "a pre-placed first card returns after Try again".

### R3 — shared teaching workspace · OBSERVED 2026-10-09 (re-based 2026-10-13; re-based on the boss 2026-10-19)
- **Property:** `withWorkspaceOnly('time-sequencer', ...)`, assignment `timeSequencerBoss.assignment`: the tutor owns
  the lesson, the activity's own Check commits a checked gesture with a named miss (`timeSequencerMiss`), the runtime
  owns progression (no Next button, no scripted `sendText`, no `useLuminaAI`), input closes until Try again, and
  evaluation submits only under a lesson's provider. An unbound mount shows the shared needs-the-tutor card; Pip comes
  from the runner (`<PipDock />`, `<PipWorkspace>`). No `correct*` field is published. An order (sequence-events, clock-sequence) is tap-only and
  carries no key: cards are listed alphabetically (never in the day's order) and clock-sequence hours are not listed.
  A one-choice challenge (time-of-day, before-after, duration-compare, read-schedule) is a SAY_OR_SHOW card mode: the
  item is spoken with `acceptsGesture`, its key is a `SpokenKey` (`timeKey`: a menu key said in full in the ask on the
  picture choices, `timeAsk`; the schedule's activity with its short forms, asked as printed), JEV credits only from
  the tutor's feedback against it, and the tap stays checked by the activity. The old guidance's never-say rules are
  the scene's `constraints`, per type (`timeScene`; the no-clock rule only at Kindergarten); rules the shared doctrine
  states (read the instruction and card names aloud, do nothing for the learner) are not repeated. A spoken credit is
  recorded once, as a correct tap is (`onSolved`).
- **Probe:** `TimeSequencer.workspace.test.tsx` (every catalog mode), `TimeSequencer.spoken.workspace.test.tsx`,
  `scripts/tutor-verdict-probe.mjs --timeseq`; journey sweep on
  `runtime/testing/w1-payloads/time-sequencer.*.json`; tutor replay
  `qa/tutor-reports/replay/time-sequencer-2026-10-09.json`.

### R4 — levers on every mode, none drawing the key · OBSERVED 2026-10-09
- **Property:** every mode publishes a help and a simplify lever (one lever set, `TIME_LEVERS`), each answering every
  miss of its mode (duration `missed_same`: the bar model only). Help never places, numbers or ranks a card, never
  draws on the time-of-day card (a sky strip there is the period's own picture), never puts a sky strip on
  clock-sequence (the face is the task), and models before/after and duration only on bank cards that share no word
  family with the item (`clashes`). Simplify builds a new item of the same mode from a code bank (same card count,
  far apart; two choices; a three-row schedule), never the learner's activities, never the same time of day or asked
  time (`practiceLeaks`); it is ungraded and the full item comes back blank. The tier's sky strip counts as pulled
  (`tierPulled`).
  Read-schedule answer buttons carry `aria-label` (the option-pictures lever adds an emoji to their text).
- **Probe:** `timeSequencerLevers.test.ts`, `TimeSequencer.levers.workspace.test.tsx`; journey sweep J9/J12.

### R5 — time of day names every part of the day, with its sun, and refuses a bad key · OBSERVED 2026-11-11
- **Property:** match-time-of-day offers morning, afternoon, evening and night at every band, Kindergarten included
  (TIME001-01-A). Code chooses each challenge's part of the day (`periodPlan`: all four before a repeat); a challenge is
  kept only when its period is one of the four AND its typical time falls in that period (`keyTimeOfDay`,
  `periodOfTime`), and the refused parts are asked for once more. An invalid period is never keyed as morning. Each
  choice draws its own sky strip with the sun or moon at that part of the day (`PERIOD_DISPLAY.sun`); the activity card
  draws none, and no label, instruction or hint may name a part of the day.
- **Demanded by:** K TIME001-01-A (`qa/curriculum-coverage/math-k/REPORT.md`, Repairs).
- **Probe:** `service/math/gemini-time-sequencer.keys.test.ts`; payload `time-sequencer.time-of-day-evening.json`.

### R6 — duration-order's key is the minutes, checked twice · OBSERVED 2026-11-11
- **Property:** three activities ordered shortest to longest (MEAS001-07-C). The model gives each activity's minutes and
  its own shortest-to-longest order; code keys `correctOrder` from the minutes and refuses a challenge whose minutes are
  missing, not each at least `DURATION_GAP` (3) times the one before, or disagree with the stated order, or whose label
  prints a duration. The boss refuses an order that does not rise in minutes. Minutes are never drawn or published; no
  sky strip or clock time is drawn on its cards. Tap-only board, no key to the tutor.
- **Probe:** `gemini-time-sequencer.keys.test.ts`, `timeSequencerLevers.test.ts`; payload `time-sequencer.duration-order.json`.

### R7 — missing-middle is built from a five-step routine · OBSERVED 2026-11-11
- **Property:** the first and last cards are steps 2 and 4 of a routine the model writes in order; the key is step 3 and
  the other two choices are steps 1 and 5, recorded as before the first card and after the last (`optionPlaces`, misses
  `before_first` / `after_last`). The empty middle place looks the same whatever the answer; instruction is code copy.
  A SAY_OR_SHOW item, keyed like before-after (`timeKey`).
- **Probe:** `gemini-time-sequencer.keys.test.ts`, `TimeSequencer.spoken.workspace.test.tsx`; payload `time-sequencer.missing-middle.json`.

## Changelog

- 2026-11-11: R5-R7 added (K math coverage repairs and modes). R3's list of one-choice modes gains missing-middle and its
  list of orders gains duration-order; R4's lever set gains `middle_model` / `two_middle_cards` and `duration_ladder` /
  `far_apart_durations`. R1, R2 unchanged.

- 2026-10-13: R3 re-based (VB-1). "Every challenge answered on the screen, no key to the tutor" protected no unearned credit for the one-choice modes; their answer is one sayable choice. time-of-day, before-after, duration-compare and read-schedule are now spoken items that also take the tap (`TeachingItem.acceptsGesture`); the orders stay tap-only with no key. JEV verdict probe 27/27, false credit 0 (one expectedAnswer wording revision for duration-compare).
- 2026-10-19: R3 re-based on the boss (`timeSequencer.card.ts` + `.boss.ts`, spokenBoss). The scripted path, the catalog `tutoring` block and guidance prose, the hand Pip and its pose are gone; the guidance's never-say rules moved to scene `constraints`; the one-choice keys became `SpokenKey`s, the picture choices asked with their whole menu. R1, R2, R4 unchanged.
