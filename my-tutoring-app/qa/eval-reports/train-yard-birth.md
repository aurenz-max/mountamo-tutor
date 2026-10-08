# Birth Certificate — train-yard (2026-10-05)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core mode, bound to the teaching workspace.
Ported from the approved Train Yard demo (artifact V5ynYAKhyX6JCj9PbTY2qt, "Haul a job" tab).

- Core task identity: `build_train` — the fewest cars of the kind that carries the cargo, and the fewest engines that climb the hill (β 0.8).
- Generator fork: B variant — one Gemini call writes 6 job stories (title, cargo, cargoForm, from, to, hillName); code picks 4 (passenger job always kept) and `buildTrainYardChallenge` sets amount, grade and distance. K-2: whole cars (3-10); 3-5: 6-24 cars with a part-full last car, engine targets rotated 1-3.
- Workspace binding: `trainYardWorkspace.ts`; response `gesture` (the train run is the check); misses `wrong_car`, `mixed_cars`, `too_few_cars`, `stalled`, `extra_cars`, `extra_engines`; guidance ~880 chars. Checks: `TrainYard.workspace.test.tsx` 6/6, W1 contract + journey sweep on the saved payload pass (live-activity 2,414 tests green), catalog/misses pass, tutor replay 5 samples 0 misses (`qa/tutor-reports/replay/train-yard-2026-10-05.json`).
- Answer-leak audit: walked job ticket, car cards, engine card, consist strip, route canvas, result card. Gated: car cards say how a car is built, never what it carries; the train weight and the pull the hill needs show only after a run (the demo's live gauges would let a child add engines until a bar turns green); the instruction never names a car kind or a count; no default consist (0 engines, 0 cars).
- Design gate (Phase 2):
  - manipulation — pass: the child couples engines and cars onto the train; the consist strip is the thing built. Add/remove buttons, not drag (exception noted: drag-to-couple is a later polish).
  - simulation — pass: the run loads the cars (cargo left behind piles at the station), climbs or stalls with wheel slip, and on delivery draws one icon per truck replaced.
  - production — pass: the child builds the whole train; nothing is chosen from options.
  - timer — pass: no clock; the run is a fixed ≤3.5 s animation, and attempts are counted silently.
  - layout leak — pass: see the audit above.
- Curriculum home: retrieval MATCH at grade 1 — SCI005-02-d (truck loads to move a pile) and SCI005-01-c (ramp steepness vs force), K-2 engineering-machines homes it shares with dump-truck-loader and ramp-lab. Grade 3 resolves to unrelated motion skills (SCI001-04, race track): attribution risk. No published skill covers rail/freight transport or how trains help communities — curriculum gap, needs a user decision (`/curriculum-author`). Not a reviewed edge in the coverage atlas (pilot is K Language Arts only).
- Pip surface (Phase 2d): classic workspace hook; points at the yard as a whole; never at a car card (choosing the car is the task); surface test pass.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| ✓ 1 | `/add-eval-modes` (DONE 10-05: 4 modes, β −1.5/−0.5/0.3/0.8; `rush_hour` not built) | L1 eval-dense | Ladder from the demo plan: `match_car` (only the car kind; counts fixed — easiest, K-1), `enough_cars` (car kind given; count the cars — skip-count/divide), `enough_pull` (cars given; choose engines from the rule of the rails — the Hydraulics-style input→output rung), then `build_train` on top. Later: `rush_hour` (passenger: doors and dwell time). |
| ✓ 3 | `/add-support-tiers` (DONE 10-06: 9 levers, every miss answered; live gauge rejected as a leak — `train-yard-levers-2026-10-06.md`) | L3 levered | Why children fail: (a) car kind — matching by name not build → help: show the cargo beside each car's picture as it would sit; simplify: two car choices. (b) counts — division/rounding up → help: the strip fills car by car with the load as cars are added; simplify: whole-car loads. (c) engines — can't apply the rule → help: the demo's live "pull needed vs pull given" gauges (exists in the demo, hidden at birth); simplify: a flat-track job or a fixed cars count. |
| 5 | `/add-sound` | L5 polished | Coupling clank on add/remove, diesel rumble rising on the climb, wheel-slip squeal on a stall, horn on arrival. |
| ✓ | `/eval-test train-yard` | QA loop | Born 5/5 live generations PASS after the passenger-job fix (`qa/eval-reports/train-yard-2026-10-05.md`). Re-run after every layer. |

Not yet done at birth: a browser check of the real lesson (canvas sizing on a phone, the run animation, the truck line). The tester page shows the "needs the tutor" card by design; drive it from a lesson.
