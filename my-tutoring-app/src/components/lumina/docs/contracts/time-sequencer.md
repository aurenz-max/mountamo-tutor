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
