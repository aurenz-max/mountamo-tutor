# practice-studio birth (2026-11-08)

**What:** the first general agent primitive. One catalog entry, one eval mode (`practice`). An author agent assembles each
item for the lesson objective from shared kit capabilities and revises it after seeing it the way a child will.

**User rulings (11-08):** eval mode means a capability the agent can use, not a per-primitive task; one entry, mixed only;
items stream to the child; coexist with knowledge-check, sorting-station and the sequencers, bench later.

## Built

| Piece | File | Owns |
|---|---|---|
| Answer surfaces | `service/agent-kit/surfaces.ts` | choose / categorize / order: structure, scoring, misses, code shortcut checks, difficulty from structure, shown order that never gives the answer |
| Displays | `service/agent-kit/displays.ts` | agent SVG (sanitized), code-drawn bar graph and number line, table, text |
| Look | `service/agent-kit/look.ts` | screenshot in headless Chromium, blind solve from the screenshot, problems in sentences (falls back to words with no browser) |
| Item loop | `service/agent-kit/itemLoop.ts` | one call writes the set; each item looked at and revised in parallel (2 rounds, 140 s); kit-built help (adds a display) and simplify (removes cards, must be easier) levers |
| Primitive | `primitives/visual-primitives/core/practice-studio/` | component, card (TAP_ONE, 3 misses), tap boss, scene |
| Author | `service/core/practice-studio/agent-practice-studio.ts` | the lesson around the kit: objective, grade, scope, remediation focus, tier plan |
| Tester | `components/PracticeStudioTester.tsx` | generate, reviewer view with key and loop record, play offline or Live |

Registered: types, primitiveRegistry, catalog core, coreGenerators, evaluation metrics, activityContract, liveJourneySpec,
backend prior (`practice` 0.5), dev panel, guard lists.

## Verified

- `npm run test:primitive -- practice-studio`: 759/759 plus the journey sweep on both saved payloads.
- Kit tests 18/18 (`surfaces.test.ts`); `typecheck:lumina` 0; full tsc: no errors in new or touched files.
- Real generations (`save_payload.py`): G2 bar graphs (111 s, 4/4 items, 1 item revised twice); G1 Monarch (175 s, 4/4, 5 revisions).
- Browser: the tester in headless Chrome with a saved payload: bar graph and agent SVG cards render; a wrong choice shows its misconception hint.

## Open

1. Item streaming (needs the lesson pipeline to carry a component's data before exhibit-complete).
2. Difficulty: computed band reads a G2 easy put-together as medium; agent "hard" items read medium. Calibrate against user ratings.
3. Monarch request ran past the 180 s probe timeout twice before the 140 s budget fix; re-measure.
4. Miss hints could describe the right option (Monarch item 1); prompt rule added, not yet re-run.
5. No Chromium on a production host: the look falls back to words.
6. Not run: `/eval-test`, Live sample (user).

## Queued by `/review-agent-primitive` (11-08)

Executor `/agent-primitive practice-studio`, in this order, unless marked. Evidence is the two saved payloads.

1. Help levers can state the answer (`buildSurfaceLevers` checks neither `says` nor a text display): 4 of 8 helps only add text, and 3 of those give the key or the whole sum. Route the item loop through the kit's lever checks; a text display does not count as drawing more.
2. Refused levers never reach the author: run the lever build inside the revise round.
3. Tier miss does not block: `difficultyOf` is never compared with the aim (4 of 8 off). Send it back in the loop. Score ignores steps: all 3 bar-graph choose items score 2.35.
4. Solver shortcuts and false facts ship as advisory (Monarch items 1 and 4); a failed solve ships with no independent check and `run.look.unread` stays 0.
5. Derived keys on code-drawn displays are not computed (`DERIVED` exempts all 3 bar-graph choose items).
6. Display wiring steps 4-5 (`displayIssues`, `displayText`) are unused; `svg` stays on the menu with no browser; help drawings are never looked at.
7. Session variety rule with a test; a decline path; `*.coverage` fixtures for the catalog's six claimed families.
8. Regenerate both saved payloads (they predate `agentDebug.run`).
9. Voice is a modality (USER 11-08: practice-studio also serves language arts and literacy). Build it in the kit (`surfaces.ts`, `itemLoop.ts`), not in this primitive: a production field per item, one pure spoken module for key and misses, and `spokenBoss` in place of `tapBoss`. Cover the literacy productions from `/agent-primitive` I11 (say the value, make any that fits, say the parts in order), not only say-the-number. A speech-only production needs its own eval mode. Remove "not for answers a learner must say" from the catalog constraints.
10. `/add-live-tutor-tools practice-studio`: the tutor is told to say a hint the scene does not carry; trim `words.special` and scene `constraints`.

Spend: probes $1.12 (11-07) plus two generations; day total $3.12 of the $5 cap at the time of the runs.
