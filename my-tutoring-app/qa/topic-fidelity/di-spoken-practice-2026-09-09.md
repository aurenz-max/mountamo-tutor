# Topic Fidelity: di-spoken-practice — 2026-09-09

Issue: DSP-5. Mode: `say_answer`. Canonical grade: K.

Scope intended: the learner solves a word riddle from spoken context clues. The
answer may be revealed only after the learner responds; an illustration of the
answer is not part of the evidence.

## Diagnosis

The learner should infer a short spoken answer from the riddle's clues. The
registry passes `ctx.intent` into the generator, and the generator interpolates
the objective focus, so topic/intent propagation is intact. The item generator
nevertheless emitted `stimulusEmoji` with a semantic `stimulusText` equal to an
accepted answer. `buildSpokenItem` treated every such emoji as a legitimate
picture stimulus, and `DiSpokenPractice` rendered it before the response. The
missing invariant was: a generated picture whose label names an accepted answer
is forbidden outside the separately planned `visual_naming` task.

The original saved evidence contains two production-dispatcher draws, 8/8
answer-depicting items (sun, fish, apple, dog). A fresh pre-fix pinned draw on
2026-09-09 reproduced the mechanism in 4/4 items. The prior prompt/schema already
said not to depict the answer, so the 12/12 observed failures established that a
prompt-only instruction was insufficient.

## Repair

- `gemini-di-spoken-practice.ts` now defines riddle/context-clue delivery
  explicitly: the complete spoken clue is the stimulus, `printStimulus` is false,
  and `stimulusEmoji` is empty.
- `diSpokenPracticeScript.ts` enforces the invariant at the shared item boundary.
  When a model-generated `say_answer` picture label matches the primary answer or
  an accepted alternate, code removes the emoji, retains the complete `ask` as a
  replayable listening stimulus, and renders the item as `none`. The answer,
  alternates, judging rules, and correction remain unchanged.
- Code-planned `visual_naming` items bypass this normalization and retain their
  picture/symbol target. A generated picture whose label is not an answer is also
  retained.

## Probe results

| Probe | Topic / intent | Result | Verdict |
|---|---|---|---|
| pre-fix reproduction | word riddles / same | 4/4 emoji depicted accepted answers | FIDELITY BUG |
| riddle draw 1 | broad K vocabulary / solve word riddles from clues | 4/4 `none`; complete clues retained; 0 emoji | HONORED |
| riddle draw 2 | broad K vocabulary / solve word riddles from clues | 4/4 `none`; complete clues retained; 0 emoji | HONORED |
| exact objective | word riddles from context clues / same | 4/4 `none`; complete clues retained; 0 emoji | HONORED |
| neighboring visual naming | identify `+` and `=` / same | 8/8 code-planned targets visible; names hidden | PRESERVED |
| no-regression | addition within five / spoken addition | 4/4 printed facts; no emoji; answers agree | PRESERVED |

**Verdict:** FIDELITY BUG → fixed with prompt clarification plus a deterministic
item-integrity invariant. Post-fix stochastic evidence: 12/12 riddle items across
three complete sessions, with zero picture leaks and zero dropped items.

## Verification

- Focused Vitest: 3 files, 114 tests passed. This includes the saved failure
  family, a different answer vocabulary, a non-answer picture, visual naming,
  listening arithmetic, component rendering, and the existing script gates.
- Lumina typecheck: 0 errors before and after.
- Production eval-test route: three riddle sessions, two symbol-naming sessions,
  and one arithmetic session as recorded above.

Limitation: two additional live prompts asking to name cat/dog pictures returned
empty sessions from the semantic planner before item construction. The
answer-picture repair cannot cause that path (planned visual naming bypasses the
changed builder), and mocked generation plus live symbol naming prove the planned
visual-target contract remains intact, but picture-plan yield itself was not
established by those two calls. No microphone or human-device run was needed to
establish the pre-response visibility invariant.

