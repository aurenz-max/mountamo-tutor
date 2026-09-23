# Workspace rollout batch A1: place-value-chart, ordinal-line, sorting-station at W1 (2026-09-23)

Queue: [ROLLOUT.md](../workspace-rollout/ROLLOUT.md) · Handoff: [15](../live-runtime-handoffs/15-workspace-rollout.md) ·
Executor: `/add-live-tutor-tools`, "W1 minimal binding". These were the last three runner-owned live adapters.
No live adapter is `di-runner` any more.

| Primitive | Response | Code | Smokes (`--lesson-entry --progression-only`) |
|---|---|---|---|
| place-value-chart | printed number spoken; dictated number written, checked by `chartMatches` | domain 49 lines, component +~80 | `build` text PASS (third attempt, after two harness fixes); `identify --audio` PASS |
| ordinal-line | four modes spoken; `build_sequence` placed, checked by `placementMatches` | domain 51, component +90/−27 | `build_sequence` text PASS; `identify --audio` PASS ×2 |
| sorting-station | all spoken | domain 31, component +~70 | `sort_one` text PASS; `count_compare --audio` PASS |

Ordinal-line was built by a fresh session from the skill alone (the recipe's second dry run): about 6 minutes
to a clean typecheck. Raw reports: `<id>-w1-<mode>[-audio]-2026-09-23[-b|-c|-d].json` in this folder.

## Shared fixes

1. **Success hook at the commit.** A tutor verdict that credits and advances in one step never rendered the
   checked phase, so `useWorkspaceRunner` never called `onAffirmed`. Every W1 adopter skipped its success
   handler on that path; number-bond also lost the split evidence it banks there. `useTeachingWorkspace` now
   calls `onSolved` synchronously at a correct commit, before any advance. Regression test in
   `SortingStation.workspace.test.tsx` (fails with the hook stubbed out, passes with it).
2. **Driver text entry.** `primitive-runtime-driver.mjs` imported `react-dom` before installing the JSDOM
   globals, so React took its IE input path and typed text never reached `onChange`. It now loads after the
   globals and has a `write` input.
3. **Retry-path timeout.** After the learner's Try again, the harness waited for another tutor turn even when
   the press had already reopened the item; a tutor that had just re-asked stayed silent until timeout.

## Findings

- **The tutor omits what the screen withholds.** Place value: one audio run opened a dictation item with
  "let's write a new number" without saying it (the number is never printed). Ordinal line: the first audio run
  never named the front (the end labels are words a K child cannot read). Guidance sentences were added for
  both; ordinal-line's rerun named the front on the first ask but not the second, and place value's has not
  been re-driven. W2 candidates if a human sitting confirms it.
- The runner-owned sandbox handoff branch (`LiveActivitySandbox.tsx`, `teachingOwner === 'di-runner'`) is now
  unreachable; its test was deleted. Queued in ROLLOUT for removal.

## Gates

typecheck:lumina 0 · full tsc 770 (baseline 770) · live-activity + visual-primitives + pip: 306 files,
4299 tests. Browser and microphone acceptance: HUMAN-CHECKS #167.
