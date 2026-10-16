# reaction-lab: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/reaction-lab-w1-2026-10-15.md`). This was a non-interactive run, so the
lever table was built without stopping for review. Not committed.

## Failure inventory
There is no real-learner evidence: no demonstration, misconception, remediation or eval report names reaction-lab.
The documented failures come from the catalog's `commonStruggles`: confusing chemical and physical change, not
spotting the signs of a reaction, struggling with the particle view, and balancing. The synthetic ones are the
journey's scripted wrong answers. The rest are inferred.

| Mode | Miss | Class |
|---|---|---|
| predict | `no_change` (picks "nothing will happen"), `chemical_physical_swap`, `other_choice` | inferred, synthetic |
| observe | `chemical_physical_swap` (classify), `no_change`, `other_choice` | documented, synthetic |
| explain | `unbalanced_equation`, `true_false_flipped` (conservation), `other_choice` | documented, synthetic |

## Lever table (built, `reactionLabLevers.ts`)
| Lever | Kind | Where | Leak rule (code) |
|---|---|---|---|
| `signs_legend`: a card listing the seven signs that a new substance may be forming, with pictures, none marked | help | predict and observe items | `legendLeak`: withheld when a choice is itself a sign on the card, or when a question about signs has only one choice that names a sign |
| `replay_reaction`: the beaker plays the reaction again | help | items asked after mixing, once the first run is over | shows only what was already seen |
| `particle_view`: reactant molecules → product molecules, with no caption | help | explain items at grade bands that draw the particle view | `particleLeak`: withheld when a choice is a molecule; the caption is never drawn |
| `drop_far_choice`: greys out the wrong choice that shares the fewest words with the key | simplify (on the item, user ruling 09-27) | MC items with at least two untried choices left after the drop | never the key |

Every help lever answers every miss of its mode. `drop_far_choice` answers every miss except `true_false_flipped`.
Starting position: no tier code. The generator reads no `config.difficulty`, so every item starts with no levers
pulled.

**Considered and rejected:** a line in the legend for physical changes ("melting, dissolving..."), because it states
the answer to a classify question about those changes. A code-built simpler practice item, because a simpler item
about the same reaction repeats its outcome, and one about another reaction changes what is being predicted.

## Gates
- `ReactionLab.workspace.test.tsx` covers: each pull changes the screen and the scene fact in one commit, a second
  pull of the same lever is blocked and changes nothing, the next attempt records the levers, `nextLever` after a
  miss, the leak rules, and the particle view having no caption.
- Sweep lever inventory: every catalog miss in every mode is answered (J9, J12 and J13 pass on 3 payloads).
- Replay `-r3`: every stuck reply pulls the help lever, or the legend plus the greyed choice, and describes it after
  the call (`no_change_before_receipt` 0/15). No reply names the key.

## Failures with no lever
- None by miss. A predict item where the legend is withheld and only 3 choices remain has no lever after one wrong
  answer. None of the saved payloads has such an item.
