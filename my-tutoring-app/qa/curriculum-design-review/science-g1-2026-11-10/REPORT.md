# Science G1 panel, 2026-11-10

Seeded sample of 5 skills, 1 subskill each (`sample.json`, seed 4825414861537544376). Records and routes: `panel.json`.

**Score: 4 of 5 at level 2 or above. 0 played. 0 served.** Model spend: none.

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| SCI001-04-d light needed to see | mark toys the flashlight shows | canvas-new | `flashlight-room` | 2 checked |
| SCI001-07-d light or sound signal | drag a device onto the sender | canvas-new | `signal-scene` | 2 checked |
| SCI003-02-c day-night order | order a day's event cards | specialist | `time-sequencer` sequence-5 | 2 checked (catalog and generator read) |
| SCI002-07-b inherited plant traits | tap parent, seedling or both | specialist | `bio-compare-contrast` venn-interactive | 2 checked (catalog and component read) |
| SCI003-03-d predict the Moon | set the Moon for nights later | add-mode | `moon-phases-lab` (scores only "find the named phase") | 1 routed |

## The two canvases

Each passed `canvas-check` with 5 problems played both ways, and the main session read the screenshots.

| Canvas | Author | Problems (what changes) | Open points from the screenshots |
|---|---|---|---|
| `flashlight-room` | main session | whole beam drawn; beam start only; a white ball out of the beam; a box in the way; a glow lamp out of the beam | Problem 1 is answered by reading the drawn beam. The action is tapping toys, not moving anything. The room never goes dark after Check, so the child does not see the result. |
| `signal-scene` | subagent, Opus 5.5 medium, 5.0 min | clear night; fog; waterfall noise; a hill; two senders (fog and crowd) with one tray | Problem 1 rejects the drum and whistle as too quiet, which sits close to the misconception "sound cannot go far". The flag is drawn bright at night. The receiver stays visible to the child over the hill. Every problem is at night; daylight is supported by the program and unused. |

## Not confirmed

- `time-sequencer`: no generation was run, so it is unchecked that a day-night lesson produces sunrise, noon, sunset and night as the events.
- `bio-compare-contrast`: no generation was run, so it is unchecked that a parent plant and seedling come out with the inherited traits as the shared region.

## The user plays next

Dev panel "Canvas (agent)" saved list: `flashlight-room`, `signal-scene`. After an approved play, add `serves` to the spec and run `node scripts/canvas-check.mjs --spec=<id> --promote`, then the serve check in `/canvas-primitive` step 8.

## Queued

- `/add-eval-modes moon-phases-lab`: a predict-next-phase mode (tonight's Moon given, set the Moon for N nights later) (SCI003-03-d).
- `/eval-test time-sequencer` and `/eval-test bio-compare-contrast` on these two objectives, one generation each (metered).
