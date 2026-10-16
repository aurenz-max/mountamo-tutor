# mixing-and-dissolving: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/mixing-and-dissolving-w1-2026-10-15.md`), same pass. Non-interactive run:
the lever table was built without a review stop. Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or eval-report files for this primitive).
Documented = the catalog's `commonStruggles` (dissolved means disappeared; solutions vs mixtures; saturation; wrong
separation method). Synthetic = the journey's wrong choices. The rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| dissolve | says it dissolves when the beaker shows it does not, or the other way (`chose_dissolves`, `chose_does_not_dissolve`) | inferred, synthetic |
| dissolve | particle question: the particles disappeared (`chose_disappeared`), sank (`chose_sank`) | documented, synthetic |
| classify | the wrong kind of mixture (`called_solution`, `called_suspension`, `called_layers`) | documented, synthetic |
| separate | filters a dissolved solid (`filter_for_dissolved`), evaporates an undissolved one (`evaporate_for_undissolved`), `other_method` | documented, synthetic |

Evidence corrupted, fixed first: classify had no items at all and every mode got the same mixed set (generator ignored
the pin); the key sat in the same slot on every separation question.

## Lever table (built, `mixingAndDissolvingLevers.ts`)
| Lever | Kind | Where | Answers | Leak rule (code) |
|---|---|---|---|---|
| `model_beakers`: three small beakers of things not in the lesson (drink powder, pebbles, liquid wax), drawn as spread through / on the bottom / a floating layer and tagged | help | sort, classify | every sort and classify miss | `modelsLeak`: one model per look, none sharing a word with a lesson substance or the solvent ("Lamp oil" is skipped when the lesson has cooking oil); no model left, no lever |
| `particle_view`: opens the particle view of the learner's own beaker | help | particle question | `chose_disappeared`, `chose_sank` | offered only once something is in the beaker and the view is closed; the view's caption names the dots and no rule |
| `method_cards`: a card per method on the choices, fixed words on what each catches | help | separate | every separate miss | names no substance, marks no card; the learner still has to see whether the substance dissolved |
| `drop_far_choice`: greys the wrong choice sharing fewest words with the key | simplify (on the item, user ruling 09-27) | multiple choice | every choice miss | never the key; only while two untried wrong choices remain, so true-false never has it |

Starting position: no tier code; the generator reads no `config.difficulty`, so every item starts bare.

**Considered and rejected:** a lever that adds the item's substance to the beaker (it runs the experiment that is the
answer); the generated `description` of each separation method as the card text (it names the lesson's substances);
a code-built practice item (a simpler sort is still one of the lesson's substances, or one outside the shelf the beaker
cannot test).

## Gates
- `MixingAndDissolving.workspace.test.tsx`: miss table per mode, model and drop leak rules, each help lever changes
  the screen and the scene fact in one commit, the next attempt carries the lever, `nextLever` after a named miss, an
  empty beaker withholds `particle_view`, a fully pulled item offers no further pull.
- Sweep lever inventory: every catalog miss answered on every mode (J9, J12, J13 pass).
- Replay r3: every stuck reply pulls the mode's help lever itself and describes it after the call; no reply points at
  a model or a card.

## Failures with no lever
- None by miss. True-false sort items have only `model_beakers` (a two-way choice is already the smallest).
- Saturation, factor and concentration questions (unpinned lessons only) get `drop_far_choice` and nothing else.
