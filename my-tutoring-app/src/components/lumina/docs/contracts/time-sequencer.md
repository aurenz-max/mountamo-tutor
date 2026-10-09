# Contract: time-sequencer

- **Component:** `primitives/visual-primitives/math/TimeSequencer.tsx` ·
  **Domain:** `primitives/visual-primitives/math/timeSequencerWorkspace.ts` ·
  **Generator:** `service/math/gemini-time-sequencer.ts` ·
  **Live adapter:** `components/live-activity/adapters/timeSequencerLive.ts` ·
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

### R3 — shared teaching workspace (W1, plain shape) · OBSERVED 2026-10-09
- **Property:** with a catalog `teachingWorkspace`, the tutor owns the lesson: the activity's own Check commits
  a checked gesture with a named miss (`timeSequencerMiss`), the runtime owns progression (no Next button, no
  scripted `sendText`, `useLuminaAI` disabled), input closes until Try again, and evaluation submits only under
  a lesson's provider. The tutor packet carries no key: cards are listed alphabetically (never in the day's
  order), clock-sequence hours are not listed, and no `correct*` field is published.
- **Probe:** `TimeSequencer.workspace.test.tsx` (every catalog mode); journey sweep on
  `runtime/testing/w1-payloads/time-sequencer.*.json`; tutor replay
  `qa/tutor-reports/replay/time-sequencer-2026-10-09.json`.
- **Scripted path:** `withWorkspaceController` keeps the legacy `useScriptedProgress` path and the catalog
  `tutoring` block for mounts without a workspace binding.

### R4 — levers on every mode, none drawing the key · OBSERVED 2026-10-09
- **Property:** every mode publishes a help and a simplify lever (`timeSequencerLevers.ts`), each answering every
  miss of its mode (duration `missed_same`: the bar model only). Help never places, numbers or ranks a card, never
  draws on the time-of-day card (a sky strip there is the period's own picture), never puts a sky strip on
  clock-sequence (the face is the task), and models before/after and duration only on bank cards that share no word
  family with the item (`clashes`). Simplify builds a new item of the same mode from a code bank (same card count,
  far apart; two choices; a three-row schedule), never the learner's activities, never the same time of day or asked
  time (`practiceLeaks`); it is ungraded and the full item comes back blank. The tier's sky strip counts as pulled.
  Read-schedule answer buttons carry `aria-label` (the option-pictures lever adds an emoji to their text).
- **Probe:** `timeSequencerLevers.test.ts`, `TimeSequencer.levers.workspace.test.tsx`; journey sweep J9/J12.
