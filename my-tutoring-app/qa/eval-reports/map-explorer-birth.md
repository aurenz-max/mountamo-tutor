# Birth Certificate: map-explorer (2026-10-18)

**Lifecycle layer: L1 (born, then eval-dense in the same push).** A real map from space to the street: a MapLibre GL
globe over OpenFreeMap (OpenStreetMap) tiles, with our own bright continent layer that fades as the camera flies down
into a real city. Each city's places come from Gemini with Google Maps grounding and are pinned at their true
coordinates. Source: SS G1 design review, Brief 3 (`qa/curriculum-design-review/ss-g1-2026-10-17`). The Geography unit
asks for the same thing in SS003-01-a (globe, land and water), -01-c (compass rose), -02-c (directions on a map) and
-06-c (speaking about where things are).

## What was built

| Mode | β | Ask | Answer channel |
|---|---|---|---|
| `find_on_globe` | -1.0 | Find a named continent or ocean on the spinning globe; names appear only once found | tap land or water |
| `find_by_direction` (core) | -0.5 | What is north/south/east/west of a place in a real city | tap a pin |
| `name_direction` | 0.0 | Which way is one place from another | spoken word, or tap a compass arm |
| `world_direction` | 0.5 | The continent or ocean just N/S/E/W of a named continent | tap land or water |
| `build_route` | 1.0 | Fly the helicopter between two places in compass hops, then Land | arrow buttons, then Land |

- **Directions are computed, not read off a picture.** The bearing between real coordinates sets each direction. An ask
  is kept only when its answer is within 25° of the named direction and every other place is more than 45° off it.
  World relations come from a curated table of the 19 pairs with exactly one answer.
- **Hard tier turns the map** (bearing 90/180/270). The compass rose turns with the map, and the learner can turn it
  too. The miss `screen_direction` names a learner who reads up as north.
- **Generator: Fork A plus a grounded map.** The pipeline runs in order: wrapper (structured), then Google Maps
  grounding (no schema), then extraction (structured). Code then validates each place: within 3 km, a known kind, a
  short kid label, no unsuitable venues, no two pins closer than 60 m. Each grounded city has a 30 s limit. Fallback is
  the curated National Mall. The mixed path is an explicit session, globe first (SP-21).
- **Workspace:** `mapExplorerWorkspace.ts`. Gesture items, except `name_direction`, which is speech with
  `acceptsGesture` (J14). Every mode has misses. The scene names the map, the places and the compass's live
  orientation. It never names the target, a relation, or `name_direction`'s answer.
- **Answer-leak audit:**
  - On the globe the base-map labels are hidden, and a continent is named only after it is found.
  - City POI layers are hidden, so the lesson's pins are the only places shown.
  - Feedback names what was tapped and where it is, never the answer.
  - Pip outlines the whole map, never a pin, region or arm.
- **Design gate:**
  - Manipulation: pass. The child spins and zooms a real globe, turns the map, and taps pins, land or water.
  - Simulation: pass. The camera flies from space to the street, and the helicopter flies the plan.
  - Production: pass. The trip is a plan the child builds, and "which way" is answered by speaking.
  - Timer: none.
  - Layout leak: pass, by the audit above.

## Verification

- `npm run test:primitive -- map-explorer`: 187 passed. The sweep and contract rows pass too: 26 passed.
  `typecheck:lumina` is 0.
- Real headless Chromium with SwiftShader WebGL ran a mixed session of all 5 modes on the live map. It covered a wrong
  answer, Try again, the right answer, Next, and the summary, and every mode was credited. Screenshots are in the
  session scratchpad.
- Real grounding, through `/api/lumina/eval-test`:
  - Downtown Chicago: 9 places, 15 s.
  - San Francisco: 8 places, 14 s.
  - Midtown Manhattan: driven earlier on the first grid version.
  - Probe: Chicago and Boston, about 12 s each, 4 clean find asks each.
- Dry sweep: `find_by_direction`, `find_on_globe` and `world_direction` are baselined for J1 and J13, because a WebGL
  tap can't be driven in jsdom (the same case as construction-site).
- **Not exercised:**
  - A Live tutor session.
  - Phone width in the browser.
  - A real touch twist to rotate the map.
  - Frame rate on a tablet.
  - Spoken credit on `name_direction` through the observer (the wiring is unit-tested only).
  - `/curriculum-fit map-explorer` was not run.

## Known issues

- On 2026-10-17 the Gemini project hit its monthly spend cap partway through. While it was capped, every generation
  fell back to the curated map. The fallback worked as designed.
- `find_by_direction` capacity on real cities is tight: 3-4 clean asks from 9 places. A session is 4 asks when a city
  supports only 4. A city with fewer is swapped for the next one.

## Follow-up queue

| # | Skill | Input |
|---|---|---|
| 1 | `/curriculum-fit map-explorer` | Homes expected: SS003-01-a, -01-c, -02-c, -06-c. -01-d is an arrow fluency drill and may not fit. |
| 2 | `/add-support-tiers` | Help: glow the compass, then draw the direction cone from the start pin. Simplify: fewer pins, or north-up. Trips: show the hop grid. |
| 3 | `/add-voice-control` / spoken | `find_by_direction` could also take the place name spoken (sayable labels). Brief 3's "describe where X is" (two words plus a reference place) needs a judged spoken mode. |
| 4 | `/add-sound` | Whoosh on the fly-down, a pop when a pin is tapped, helicopter rotor, a chime on landing. |
| 5 | Legend mode (new eval mode) | SS003-02-a/b: real map symbols to a legend. |
| ✓ | `/eval-test map-explorer` | After each layer. |
