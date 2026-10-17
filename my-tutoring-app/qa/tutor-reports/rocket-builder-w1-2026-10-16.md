# rocket-builder W1 binding (R2 batch B1), 2026-10-16

**Shape P, rebuilt under the 10-15 ruling, four modes, all bound.** Levers in
`../eval-reports/rocket-builder-levers-2026-10-16.md`. Not committed.

## What the old screen did, and what changed
The old builder was a sandbox: pick parts from a Gemini-written library, stack stages, launch. A live green/red
Thrust/Weight panel and the failure line "(TWR: 0.85)" stated the lift-off answer; two failed launches went unscored and a
success on the third scored 100; the score was altitude over target; Gemini's parts, budget and target altitude were never
checked for reachability.

Rebuilt (`rocketWorkspace.ts`) on one toy flight model: each part shows its weight as grey blocks, each engine its push
as orange arrows; a rocket lifts off only when push is more than weight; a full tank weighs 2 and burns 1 block of fuel;
a staged rocket drops each tank once empty. Code builds every item and key; Gemini writes the title and overview only.
Nothing launches before the answer is checked; no total, ratio, unit or readout is drawn.
- **can_it_lift** (say yes/no or tap): one rocket. easy 3 parts, push 3-4 from weight; medium 1-2 apart; hard two engines
  to add, 0-1 apart (equal stays down).
- **add_to_lift** (say or tap a part, "Add it and check"): a grounded rocket and 2-4 parts. easy: the key and one foil
  (fuel tank, heavy engine or weak engine); medium: key, tank and a heavy or weak engine; hard: key, heavy, weak and tank
  or cargo (the biggest push is never the key). No fixed strategy wins more than 68% at any tier (levers report). The learner's part launches after any
  check (it stays down when wrong).
- **on_budget** (say or tap a rocket): coins on every part, a budget in the ask; the rocket that lifts off and costs no
  more. easy 2 rockets; medium key + over budget + stays down; hard 4, one a coin over, cheapest stays down.
- **reach_target** (say or tap a rocket): which flies highest (or least high, easy/medium); rockets differ in fuel,
  engine, cargo weight or staging. hard: 4 rockets, the one with the most fuel never lifts off.
- Default modes by grade (no pin): K-1 can_it_lift; 2 + add_to_lift; 3 + on_budget; 4-5 all four. No floor.
- Scripted path (tester): two tries then a reveal (one try on two-choice items); only first-try answers score.
- Propulsion-lab overlap checked: that primitive owns action/reaction and which engines need air; this one stays on
  weight, push, fuel, cost and stages. Both catalog entries say so.

Misses (`rocketMiss`, spoken ids the same): lift `said_equal_lifts`, `said_lifts`, `said_stays`; add `heavy_engine`,
`added_no_push`, `too_weak`; budget `fails_both`, `over_budget`, `no_lift`; reach `picked_no_lift`, `picked_lower`,
`picked_higher`.

Production lines: rocketWorkspace.ts 669, rocketLevers.ts 118, RocketBuilder.tsx 645 (was 1452), generator 133 (was 709),
adapter 28, catalog entry about 70. Tests: workspace 271, reader-fit 85 + 109.

## Gates
- `typecheck:lumina` 0. Full `tsc` 771 (the baseline); none in these files (the one `.next/types/.../eval-test/route.ts`
  error is pre-existing).
- `RocketBuilder.workspace.test.tsx` 17/17; both reader-fit files rewritten to the rebuild (8 + 10 pass); Pip surface
  test passes on the legacy fixture. live-activity + catalog + astronomy + Pip: 75 files, 5051 pass, 2 fail, both
  `fraction-bar.compare` (another session's work in progress).
- Payloads `w1-payloads/rocket-builder.{can_it_lift (K, medium), add_to_lift (G2, hard), on_budget (G3, hard),
  reach_target (G5, hard)}.json` from `save_payload.py` (add_to_lift regenerated at G2 medium after the strategy fix). Sweep: 0 findings on all four. W1 contract: first run failed
  "scene facts over 500 characters" on on_budget and reach_target (all rockets in one fact); fixed with one fact per
  rocket, then 25/25. Sweep advisories ("the scene facts contain the key") are the option list, as orbit's.
- J8: the journey row answers by tap, so the sweep sent no spoken_miss request; spoken misses are covered by the unit
  test of `workspaceAssignment(...).misses`. Not run: `spoken-miss-probe.mjs`.

## Replay (gemini-3.8-flash, 16 items x 5 samples, `--observe`)
Saved `qa/tutor-reports/replay/rocket-builder-2026-10-16{,-r2,-r3}.json`. Every non-credit reply read by hand.
- **r1.** Automatic checks: 1 miss (add_to_lift stuck: "...if you try the purple engine?", the key). Reading found what
  the checks scored 0:
  - can_it_lift miss: "The rocket stayed on the launch pad!" after a wrong "yes" (8/20 replies): on a yes-or-no item that
    is the key; after a wrong "no" on a lifting rocket it is also false. Nothing launches after a miss.
  - on_budget / reach_target miss: "The yellow/blue rocket stayed on the pad" (about 20/40): false, and it states the
    learner's pick's verdict ("didn't lift off because fuel is heavy").
  - add_to_lift stuck: "try the purple engine" (the key), "add one of the other engines" (rules out the tank).
- **Fix 1** (scene + guidance): a `launches` fact per mode ("After a wrong answer nothing has launched: the screen shows
  no rocket flying or staying down"); guidance: never say a rocket stayed on the pad or flew after a miss, never say why
  the pick was wrong, never suggest a part, rocket or kind of part.
- **r2.** 0 automatic misses; no reply claims a launch or names a key. Reading found reach_target steering at the key's
  feature: "look closely at the rockets to see which one drops its tanks", "see which rocket fits what the card
  describes", "see if any have special markings" (4-5/60).
- **Fix 2** (guidance): never send the learner to look for one feature (the rocket that drops its tanks, the most fuel,
  the strongest engine, the one the card describes). **r3** (reach_target, 4 items x 5): 0 misses; no such pointer.
- Residual: replies restate the fuel card's rules in full on most lever turns (the card is on screen; allowed).

## Browser
Headless Chromium on the Astronomy tester (scripted path, :3000): can_it_lift K/medium, add_to_lift G2/hard and
G2/easy, on_budget G3/hard, reach_target G5/hard, 2 items each, real clicks. 62/62: nothing launched before the answer,
no unit/ratio/readout, a wrong answer checks wrong (add_to_lift: its own part added, rocket stays; two-choice items
reveal), the key credits, the launch moves up (rider y sampled 0.9 s apart). Phone width 390: no horizontal scroll.
Console: the same four `<ellipse>/<circle> ... "undefined"` errors per Generate that orbit's report traces to the
tester's loading state. Not driven in a browser: the workspace path (tutor) and the lever cards (covered in jsdom).

## Undriven modes
None (every mode answers by `choose` on its button label, then the check).

## Open findings
- `replay_checks.no_key_before_try` missed "stayed on the pad" against the key "No, it stays on the pad" (an inflected
  form of a two-choice key): the class check is code over words; a fix belongs in `replay_checks.py` with a pinned case
  (shared harness, not edited here).
- No `docs/contracts/rocket-builder.md`; the new requirements (keys from the flight model, nothing launches before the
  check, first answer scores, no totals drawn) live here and in the tests. `/primitive-contract`.
- (Closed 10-16) easy/medium add_to_lift were winnable by "pick the engine" / "pick the biggest push"; rebuilt, see the
  levers report's strategy table.
- Ratify: modes reshaped from the triage proposal. `on_budget` is lift-off + coins (decidable by counting), not
  "reach a target within budget", and sits below `reach_target` (β 3.5 vs 5.0). `reach_target` asks highest/lowest
  instead of a code-chosen altitude line. Scripted path scores first try only.
- Human check: phone width with four rockets (each panel is narrow), reach_target's after-launch picture (panels of
  different heights make the heights harder to compare by eye), K-1 with the voice.
