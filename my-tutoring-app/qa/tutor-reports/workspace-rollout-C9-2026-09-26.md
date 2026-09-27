# Workspace rollout C9: hundreds-chart, math-fact-fluency, equation-builder, pattern-builder, strategy-picker (2026-09-26)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C9. Executor: `/add-live-tutor-tools`.

## What shipped

First plain-shape (P) batch after the runner-era rows. Each family moved from `useChallengeProgress` to
`useWorkspaceProgress` and runs only on the teaching workspace (`withWorkspaceOnly`), every catalog mode. Every mode
is a checked gesture: the primitive's own Check commits through `commitCheck`, and no answer key reaches the tutor.
No mode is spoken, so there are no `--audio` rows.

| Primitive | Commit | Modes and answer | Production (+/−) |
| --- | --- | --- | --- |
| hundreds-chart | `fe6c889a` | highlight/complete sequence: cells tapped, then Check. identify_pattern, find_skip_value: a choice tapped, then Check | +287 / −226 |
| math-fact-fluency | `f5d5ff43` | visual_fact, equation_solve, match: a tapped choice. missing_number, speed_round: stepper then Submit | ≈ +200 / −471 |
| equation-builder | `c43b9f2d` | build-simple, rewrite: tiles into the slot row. missing-result/operand, true-false: a tapped choice. balance-both-sides: a typed number | ≈ +320 / −300 |
| pattern-builder | `59e6a080` | extend, find_rule: palette tokens into the blanks. identify_core: select the repeating part. translate: tokens by the drawn key. create: any row whose first part repeats (≥4 tokens) | +459 / −532 |
| strategy-picker | `8460f6ee` | guided, try_another: stepper then Check. choose: a menu strategy, then the number (only the number is checked). match: the strategy the worked solution used. compare: any pick, all credited | +397 / −276 |

Each family has a `<x>Workspace.ts` domain module, an adapter, a catalog `teachingWorkspace` block, a journey row, a
`<X>.workspace.test.tsx`, ported Pip suites and w1 payloads (19 files). The old per-tier reveal cue suffix
(`tutorRevealPolicy` / `tutorRevealClause`) is now a `coaching` scene fact in all five. The tests that used
`hundreds-chart` as the unbound example now use `concept-card-grid`.

## Behaviour changes (recorded)

- Removed on all five: the Next button, `useLuminaAI` and every scripted cue. The runtime advances; the evaluation
  submits only under an evaluation provider. An unbound mount shows the needs-the-tutor card.
- math-fact-fluency: the 1.5 s reveal timer, the "The answer is N" line and the right-choice highlight after a miss, and
  the attempt cap are gone. Response time is still recorded; nothing advances or grades on it. A finished session now
  always scores 100 (the runtime keeps the child on a fact until it is right); misses stay in `attemptsCount`.
- equation-builder: build now accepts a true reordering of the target's own tiles ("5 = 3 + 2" for "3 + 2 = 5"), because
  the target is never printed and the tutor no longer knows it. The "Try to build: <target>" line after a miss is gone.
- pattern-builder: the phase comes from the current challenge; the translate key draws the tokens, not colour swatches;
  find_rule shows the top-level rule only on challenges that use it.
- strategy-picker: a choose item keeps its menu pick through Try again; the success line shows the whole fact.
- hundreds-chart: solved items lock; a cell toggles on a pointer-less click (keyboard, assistive tech).
- Added aria-labels (steppers, tiles, menu options) for the drive harness.

## Generator fixes (answer keys and leaks found while driving)

- equation-builder rewrite: accepted forms were wrong for subtraction ("7 - 3 = 4" accepted "1 = 4 - 3", not
  "4 = 7 - 3"), every family accepted unrelated facts, and one item could not be built. Now the original's fact family.
  A repeated number now gets two tiles.
- math-fact-fluency match: an equation-to-picture match arrived with no pictures to tap (not in the schema); it is now
  converted to picture-to-equation. Code-built equation choices were all "n + 1"; now varied and shuffled.
- pattern-builder: generated identify_core instructions named the answer ("This is an AAB pattern"); create
  instructions asked for structures the check never enforces and the palette cannot draw. Both prompts fixed.
- strategy-picker: a subtraction match offered one button, the answer; foils now fill the set and the adapter refuses a
  match with fewer than 2 options. Fallback worked solutions named the strategy. A literal `Let\'s` in schema examples
  reached the screen.

## Smoke drives (`--lesson-entry --progression-only`, text)

| Row | Result | Raw file |
| --- | --- | --- |
| hundreds-chart highlight_sequence (G1) | PASS | `hundreds-chart-w1-highlight_sequence-text-2026-09-26.json` |
| hundreds-chart find_skip_value (G2) | PASS | `hundreds-chart-w1-find_skip_value-text-2026-09-26.json` |
| math-fact-fluency visual_fact (K) | PASS | `math-fact-fluency-w1-visual_fact-text-2026-09-26.json` |
| math-fact-fluency missing_number (G1) | FAIL (observer `unavailable` while a second `next dev` rebuilt `.next`), rerun PASS | `…-missing_number-text-2026-09-26.json`, `…-text-b-…` |
| math-fact-fluency match (G1) | PASS on run c (a: one generated item; b: ws 1012 from another session's backend edit) | `…-match-text-c-2026-09-26.json` |
| equation-builder true-false, build-simple, balance-both-sides, missing-operand | PASS | `equation-builder-w1-<mode>-text-2026-09-26.json` |
| equation-builder rewrite | PASS ×3 (r2 leaked at entry, guidance fixed, r3 clean) | `…-rewrite-text-2026-09-26{,-r2,-r3}.json` |
| pattern-builder extend (K) | PASS on r3 (r1 observer timeouts, r2 tutor silent after "Let me try that again") | `pattern-builder-w1-extend-text-2026-09-26-r3.json` |
| pattern-builder identify_core, create, translate, find_rule | PASS (identify_core r3, create r2, translate r2 after the fixes above) | `pattern-builder-w1-<mode>-text-2026-09-26[-rN].json` |
| strategy-picker guided, match, try_another | PASS | `strategy-picker-w1-<mode>-text-2026-09-26[-r2].json` |
| strategy-picker choose | FAIL (harness pressed the menu again after Try again), row fixed, r2 PASS | `…-choose-text-2026-09-26{,-r2}.json` |

Undriven, each covered by its workspace test: hundreds-chart complete_sequence and identify_pattern;
math-fact-fluency equation_solve, speed_round and equation-to-picture match; equation-builder missing-result (same
handler as missing-operand); strategy-picker compare (no wrong answer, so the journey's wrong phase throws by design).

## Findings (recorded, not patched)

- **After-miss near-answers**, now in eleven families: hundreds-chart find_skip_value ("How many jumps from two to
  four?"), equation-builder rewrite ("try swapping the two and the three"). pattern-builder identify_core ("tap only the
  first two shapes") and translate were fixed in guidance and reran clean.
- **Leak at entry** (fixed): equation-builder rewrite, "Can you build it starting with the three?"; guidance now forbids
  saying which number goes first.
- **The first ask did not read what is printed**: hundreds-chart find_skip_value skipped the choices; math-fact-fluency
  visual_fact said "count the dots" without reading "2 + 1". Same shape as C3/C4/C8's shortened asks.
- **Scratch text reached the learner once** (equation-builder missing-operand: "…I must introduce the next activity
  naturally…"). Same family as C2/C7/C8.
- **Rulings owed**:
  - equation-builder build rejects a true equation that meets the instruction using distractor tiles ("4 + 1 = 5" when
    the target is "3 + 2 = 5"): widen the check to any true equation that meets the instruction, or stop the generator
    from offering distractors that make a second answer.
  - pattern-builder create: the catalog says "Generate a pattern from a rule", the check accepts any repeating row. The
    generator now matches the check; requiring a given structure would need a structure key.
  - strategy-picker counting-on/back hop animation (500 ms per hop) still plays on its own; it neither advances nor
    reveals.
- **Pre-existing content bugs** (`/eval-fix`): math-fact-fluency's fingers picture draws 3 as 🤞 and 4 and 5 alike;
  strategy-picker assigns make-ten to sums of 8–9 ("take 4 from 2"); strategy-picker's subtraction choose menu has one
  option.
- **Environment**: a second `next dev` on :3001 started at 19:27 (not from this batch) and rebuilt `.next`; :3000 and
  :8000 dropped and recovered. Two failed drives trace to it.

## Checks

- `typecheck:lumina` 0; full `tsc` 770 (C8 close 771).
- Per primitive: its workspace test, Pip suite, `components/live-activity` including the generic W1 contract on the 19
  new payloads. Full Lumina suite at close: 586 files, 8,250 tests pass (10 skipped).

Human acceptance (browser) remains open under HUMAN-CHECKS #167.
