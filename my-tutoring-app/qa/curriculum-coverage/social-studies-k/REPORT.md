# K Social Studies to Lumina audit

Scope: `SOCIAL_STUDIES`, grade Kindergarten. 5 units, 159 subskills, grouped into 23 families.
Snapshot sha256 `bd1905d82fe439cf98c724415649bd67f4a06a8199f44b2e4cd740cc9c2739ba` (`snapshot.json`), 2026-11-11.
Model spend: $0 (no generation; `canvas-check` calls no model). No SS-K panel existed, so nothing was carried over.
Records and routes: `audit.json` (rebuild with `python build.py`).

## Score

**66 of 159 at level 2** (42%). 0 at level 3 (played), 0 at level 4 (served). Level 1: 38. Level 0: 55.

| Unit | Level 2+ | Subskills |
|---|---|---|
| Civics and Government | 20 | 46 |
| Economics | 15 | 35 |
| Geography | 11 | 17 |
| History | 15 | 44 |
| Culture and Diversity | 5 | 17 |

| Route | Level 2+ | Subskills |
|---|---|---|
| specialist | 56 | 83 |
| canvas-new | 10 | 33 |
| add-mode | 0 | 13 |
| native (converge) | 0 | 8 |
| ambiguous | 0 | 22 |

The level-2 specialists are `sorting-station` sort_one (picture sorts with named bins, 17), `knowledge-check` and
`foundation-explorer` (voiced recall and reasons, 27), `time-sequencer` (daily order, before/after, 5), `era-explorer`
era_sort (then/now/both, 5), `spatial-scene` and `open-builder` (1 each). The two canvases built here add 10.

## Canvases

Built in this push, both passing `canvas-check` with screenshots read, user play owed:

| Canvas | Family | Problems | Subskills |
|---|---|---|---|
| `care-for-it` | F11 spot and fix what is not cared for | classroom caps and put-away; water left running; park recycling vs trash; empty house; Grandma reading (one light stays on) | SS001-01-B, -01-E, -02-A, -02-G, -05-A, SS002-01-E |
| `coin-basket` | F12 shop with fixed coins, needs first | lunch; cold day; storm kit (exact budget); beach trip (a want fits after the needs) | SS002-01-D, -01-F, -01-H, -03-G |
| `market-stall` (11-11) | F13 stock the stall for the day's demand | rainy stock; hot day swapping out yesterday's rain stock; restock a wagon from yesterday's sold/left shelf; sale day (lower the unsold price only); rain (raise the scarce umbrella, lower sunglasses) | SS002-04-A, C, F, I |

To build next (records for 1-5 are in `audit.json` on each family):

| Rank | Canvas | Action | Subskills | Cost |
|---|---|---|---|---|
| 1 | market-stall | compare one item's price in two stores; vote on a scarce toy | 2 (SS002-04-H, E) | new params / task |
| 2 | map-maker | put symbols on a bird's-eye plan | 4 (SS001-02-H, SS001-04-E, SS003-02-B, SS003-03-E) | new program |
| 3 | trade-day | trade so every neighbour has needs | 4 (SS002-03-A, C, I, SS002-01-I) | new program |
| 4 | class-vote | count votes, plan fair turns | 4 (SS001-02-E, SS001-03-E, SS001-05-H, SS002-04-D) | new program |
| 5 | coin-basket | buy a service, pay a helper | 2 (SS002-03-F, SS002-02-H) | new params |
| 6 | family-tree | place a told family in generations | 2 (SS004-01-E, SS004-02-F) | new program |
| 7 | sign-walk | stop, cross and exit by the signs | 1 (SS001-02-I) | new program |

Stopped after two: K canvases in science and math are already waiting on play, and play is the limit.

## Converge

| Strand | Signals | Target | Executor | Absorbs |
|---|---|---|---|---|
| CV1 picture knowledge: helpers, tools, places, symbols, goods, partners (F02 + F09, 29 subskills) | open value space, 18% of the grade, one world for two families, fast-fact K options never read aloud | a social-studies walk in `wonder-walk` | `/agent-primitive` | none built; knowledge-check and fast-fact keep serving |
| CV2 I-messages and conflict talk (F16, 8 subskills) | spoken sentence, named misses (blame, no cause), 8 subskills, scenarios vary | `oral-sentence-studio` mode `i_message` | `/add-eval-modes` | none |

## Modes, repairs, ambiguous

- **Add mode** `timeline-builder` three_days (yesterday/today/tomorrow), with picture labels at K: SS004-03-D, E, F, G, SS004-01-D, B, F, SS004-04-G, SS004-02-J (`/add-eval-modes`, `/eval-fix`).
- **Add mode** `map-explorer` find_place (tap the named building; city hall missing from `PLACE_KINDS`) and the home continent: SS001-03-B, SS005-02-A (`/add-eval-modes`).
- **Add scenes** `open-builder` park/library and old/new home: SS001-04-F, SS004-04-H (`/add-eval-modes`).
- **Add mode** `di-spoken-practice` repeat a greeting: SS005-01-B, SS005-02-B (`/add-eval-modes`; non-English phrase judging unverified).
- **Repair** `fast-fact` K: the options are a single emoji and nobody reads them aloud (`gemini-fast-fact.ts` L847-856): F02, 12 subskills at level 1 (`/eval-fix`).
- **Repair** `sorting-station` four seasons need 4 bins, K cap 3 (`gradeBinCap` L184): SS003-02-G (`/eval-fix`).
- **Repair** `time-sequencer` random `SCENARIO_THEMES` can pull classroom-routine events off topic (L540-547): SS001-01-A (`/eval-fix`).
- **Verify** `sorting-station` only-A / both / only-B bins on a culture comparison: F15, 8 subskills at level 1 (`/eval-test`).
- **Ambiguous** (user ruling, `/curriculum-author`): F22 personal artifacts with no stated success (SS004-01-I, SS004-05-A, C, D, H, SS005-01-I, SS001-05-I, SS002-04-G, SS003-03-G, SS002-02-G); F23 in-person group participation (SS001-01-J, SS001-02-D, SS001-03-H, SS001-04-G, H, SS001-05-J, SS004-02-I, SS004-05-F, SS005-01-E, SS005-02-F, SS002-03-E, SS002-02-F). 22 subskills.

## Not verified

- No generation ran: every specialist level 2 rests on a generator read, not a draw for these objectives.
- No play: `care-for-it` and `coin-basket` passed the gate only. `coin-basket` uses emoji item pictures (the water is a droplet).
- Voice paths (sorting-station, era-explorer, knowledge-check read-aloud) were not exercised.
- Neither canvas is promoted; `--promote` after the user plays them.
