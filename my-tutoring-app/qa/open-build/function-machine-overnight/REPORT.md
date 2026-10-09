# function-machine `make_rule`: open build (OB-9M), 2026-10-08

New eval mode, built as a fork; no existing mode was edited in place. The mode is a real build: "Make a machine that turns 4 into 12. Now make a different machine that also turns 4 into 12." Many rules pass (3x, x + 8, 2x + 4, x^2 − 4). `create_rule` fits one rule to several pairs. Here the learner gets one pair and chooses the rule. No contract file exists for function-machine.

## What changed
- **Domain file (new, `functionMachineDomain.ts`):**
  - `evaluateRule`, `normalizeRule` and `rulesEquivalent` moved here unchanged from `FunctionMachine.tsx`. The generator's private copy of `evaluateRule` now imports this one.
  - New for `make_rule`:
    - `tilesToRule`: digit tiles join into one number, and "3x" or "2(x+1)" multiply.
    - `showRule`, `judgeMakeRule`, `sameMachine`, `makeRuleMissWords`, `makeRuleAsk`, `makeRuleTarget`.
    - `makeRulePairs`, the code-owned pairs.
    - `makeRuleKeys`, the keypad for each band.
- **Judge (code, at "I'm done!"):** misses are checked in this order:
  - `not_a_rule`: the machine cannot run.
  - `no_input`: the rule has no x, or the output is the same for every input (12, x − x + 12, 0x + 12).
  - `wrong_output`: the words name what the machine gave, e.g. "Your machine turns 4 into 13, not 12." That is the machine running the learner's own rule, not a leak.
  - `same_machine`: the same output on every input as the first machine. This is `rulesEquivalent`, plus machines that cannot take 0 (48÷x after 96÷2x). So x×3 after 3x, 8 + x after x + 8, and x + 4 + 4 after x + 8 are all refused.
  - Miss words never name a tile or a rule that would work.
- **Surface (FunctionMachine.tsx):**
  - A tile row, not an svg scene, so the watcher is skipped.
  - The input hopper shows the asked input. The machine body shows "f(x) = <the learner's row>". After a check, the output chute shows what the machine gave.
  - Keypad: x, 0-9, + − × ÷. Grade 5 adds ( ). Advanced adds ^. Every key is at least 44 px.
  - Tap a row tile to take it out. "Start over" clears the row. "I'm done!" checks it.
  - A miss keeps the row (Try again), and the verdict stays on screen until the next check.
  - An accepted first machine stays shown ("Machine 1: f(x) = x + 8 ✓"), the row opens empty, and the ask becomes "Now make a different machine…".
  - After both machines pass, the interstitial feeds both one more input ("f(x) = x + 8 gives 13, f(x) = 3x gives 15") so the learner sees two different functions share one pair.
  - A strategy hint ("add, take away, multiply, or divide?") appears after one miss at easy, after two at medium, never at hard.
  - The stored machine is never on screen, and the tutor gets `rule: ''` for this mode.
- **Generator:**
  - Added `make_rule` to `CHALLENGE_TYPE_DOCS`, the schema enum, the valid-types list, `MODE_PROFILES`, `COUNT_BY_MODE` (3 items, two machines each) and the support-tier switch.
  - New `buildMakeRuleChallenges`. Code owns every pair: inputs, outputs and stored machines are distinct within a session.
  - Grades 3-4: grow pairs (in → k·in) plus one shrink pair, so every pair has both an add/subtract and a multiply/divide one-step machine.
  - Grade 5: two-step outputs off the times table, plus one product pair.
  - Advanced: square-based pairs, plus one product pair.
  - The model writes only the title and description.
- **Oracle:** `make_rule` added to the known modes, with its own branch. It checks:
  - whole-number pairs within the ceiling;
  - the stored machine really makes the pair (independent evaluator);
  - a second, different machine exists;
  - no repeated input or output;
  - `showRule` is false;
  - no machine appears in the title or description.
- **Registry:**
  - Catalog mode "Make a Machine (Open Build)", `answers: ['build']`, β 4.0 (between discover_rule 3.5 and create_rule 4.5).
  - Backend `PROBLEM_TYPE_REGISTRY` `make_rule` = 4.0, matching.
  - A catalog guidance line: never say a rule, an operation or a number that would make the pair.
  - `FunctionMachineMetrics.challengeType` now includes `make_rule`.
- **Legacy tutor:** gets the verdicts as facts through `sendText`, e.g. `[MACHINE_CHECKED] … Fed 4, it gave 13 … not right (wrong_output)`, plus a make_rule reveal policy.
- **Older payloads:** the four existing modes are unchanged and still render. A `make_rule` item with no pair takes it from `inputQueue[0]` and its rule.

## Gates
| Gate | Result |
|---|---|
| vitest `functionMachineDomain.test.ts` + `FunctionMachine.build.test.tsx` | 15/15. Covers a pass, a second different pass, more makes (2x+4, x^2−4), one over (x+9 → 13), one under (x+7 → 11), same machine ×3, no_input ×3, not_a_rule ×2, miss words name no rule, 200 sessions × 3 bands oracle-clean. Component flow: over → miss keeps row → fix → first kept → same_machine → Start over → pass → interstitial → next item opens empty. Also an old-payload fallback and a create_rule smoke test |
| vitest: oracles, MathWorkspaces surface, catalog suites, evalModeKey | 818/818 |
| vitest: whole math primitive folder + the above | 3342/3344. The 2 failures (counting-board `recount_moved` levers, TenFrame DI mode list) come from the main-tree `catalog/math.ts` copied in without its peer files. Neither touches function-machine |
| `typecheck:lumina` | 0 errors in touched files. 2 errors in `catalog/math.ts` at 2595 and 3104 (`one_colour`, `other_shape`): ten-frame `build_pair` and pattern-builder lines from the main-tree copy, whose miss types live in uncommitted main-tree files. They resolve in the main tree. The known `liveJourneySpec.ts:2313` peer error did not appear in this worktree |
| full tsc | 772 = 770 baseline + the same 2 copy artifacts |
| Real generation (`scripts/function-machine-make-rule-probe.mjs --run`, flash-lite wrapper) | 3/3 clean, 2 runs. G3 pairs 4→20, 2→6, 20→5. G5 4→18, 6→25, 5→20. G8 hard 6→37, 4→13, 2→8. Routing, oracle, the judge accepting two different machines per pair, and no rule in the prose all passed. The first run had two doubling items at G3, so stored machines are now kept distinct per session. Saved to `qa/open-build/function-machine-overnight/generation.json` |
| Live-activity suite / journey sweep | Not run: the family is not bound |
| Headless drive | Written, not run (no dev server allowed) |

Ratio: about 340 production lines (245 domain, of which about 30 are moved code, plus about 100 net in component, generator and oracle), against 215 test lines and 200 probe/drive lines.

## Not done / open
- **Not bound and no levers.** function-machine is a legacy primitive (`useLuminaAI` and `sendText`, no `teachingWorkspace`). So there are no catalog misses, no numeric scene facts, no `workHistory`, and no pause fact. The next layer is `/add-live-tutor-tools` (bind every mode), then `/add-support-tiers`. Suggested help lever: run the learner's machine on the input step by step. Suggested simplify lever: a smaller pair.
- **No watcher**, as planned: the build is typed tokens in a tile row.
- **Two judgment calls for a ruling:**
  - A constant machine (`12`) counts as a miss (`no_input`), although f(x) = 12 does turn 4 into 12.
  - `make_rule` is in the schema enum, so unpinned sessions can now pick it (same question as R4/R7).
- **Grade 5 pair variety is weak:** one run gave three items all built on 4x. Pairs differ, but the multiplier is not spread yet.
- The existing family layout is fixed width (machine picture `md:w-48`), so the phone check squeezes only the build card.
- No Live run.
- Existing modes do not set `firstResponseScore`; `make_rule` follows the family (attempts = misses + 1, score `phaseScore`).

## WORKTREE PATH
C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-7

The worktree was fast-forwarded to af7df5b8. The main-tree versions of `buildLayer.ts`, `gemini-build-watch.ts`, `gemini-function-machine.ts`, the oracle, `catalog/math.ts` and `problem_type_registry.py` were copied in first. The node_modules junction was created and removed; the shared install is intact.

## Changed files
New:
- my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/functionMachineDomain.ts
- my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/functionMachineDomain.test.ts
- my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/FunctionMachine.build.test.tsx
- my-tutoring-app/scripts/function-machine-make-rule-probe.mjs
- my-tutoring-app/qa/open-build/function-machine-overnight/drive.mjs
- my-tutoring-app/qa/open-build/function-machine-overnight/open.mjs (copy of browser-drive-2026-10-07/open.mjs)
- my-tutoring-app/qa/open-build/function-machine-overnight/generation.json

Modified by this slice:
- my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/FunctionMachine.tsx
- my-tutoring-app/src/components/lumina/service/math/gemini-function-machine.ts
- my-tutoring-app/src/components/lumina/service/qa/oracles/function-machine.ts
- my-tutoring-app/src/components/lumina/service/manifest/catalog/math.ts (function-machine guidance line + `make_rule` mode only)
- my-tutoring-app/src/components/lumina/evaluation/types.ts (one union member)
- backend/app/services/calibration/problem_type_registry.py (one `make_rule` line)

Differ from HEAD only by the main-tree copy (no edits of mine):
- my-tutoring-app/src/components/lumina/primitives/build-layer/buildLayer.ts
- my-tutoring-app/src/components/lumina/service/build-layer/gemini-build-watch.ts
- The rest of the `catalog/math.ts` and `problem_type_registry.py` diffs

## Drive command
Run after merging, with next dev on :3000, from a scratch folder that has `playwright-core@1.52.0` installed:
```
cp "C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/function-machine-overnight/drive.mjs" "C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/function-machine-overnight/open.mjs" . && node drive.mjs
```
It writes `drive.json` and `shots/` to `my-tutoring-app/qa/open-build/function-machine-overnight/`. It opens Function Machine → "Make a Machine" → Elementary and runs about 22 checks:
- **Item 1:** the ask states the pair; the row opens empty and the stored machine is not on screen; one over → `wrong_output` naming what it gave, row kept; fix the number → first machine kept and the ask changes; d + x → `same_machine`; Start over; the stored machine → pass and the interstitial comparison.
- **Item 2:** a bare number → `no_input`; "x +" → `not_a_rule`; two machines → pass.
- **Then:** miss words never write a rule; the build card squeezed to 360 px has no overflow and every key is at least 44 px; no page errors.

Probe re-run (from the worktree or main tree `my-tutoring-app`):
```
node scripts/function-machine-make-rule-probe.mjs --run
```

## Browser drive (coordinator, after merge into the main tree, 2026-10-09)
**20/21**. The one fail is the pre-existing svg `rx/r undefined` console errors. Keypad keys >= 44 px at 360.
