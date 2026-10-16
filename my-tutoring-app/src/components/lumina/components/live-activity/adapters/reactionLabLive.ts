import type { ReactionLabData } from '../../../primitives/visual-primitives/chemistry/ReactionLab';
import { askOf, itemChoices, keyValue, reactionItems } from '../../../primitives/visual-primitives/chemistry/reactionLabWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a lab whose challenges cannot be attempted: every check reads the challenge's own key. */
export function validateReactionLabData(value: unknown): ReactionLabData {
  const d = value as ReactionLabData;
  if (!d || typeof d.title !== 'string' || !d.experiment || typeof d.experiment.name !== 'string'
      || !Array.isArray(d.substances) || !d.substances.length || !d.reaction || !Array.isArray(d.reaction.signs)
      || !d.animation?.realView || !Array.isArray(d.animation.realView.effects) || !d.animation.particleView
      || !Array.isArray(d.challenges))
    throw new Error('Generated reaction lab has invalid lesson content.');
  const items = reactionItems(d.challenges, { checkedOnly: true });
  if (!items.length || items.length > 12) throw new Error('Generated reaction lab has no askable challenge.');
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated reaction lab repeats a challenge id.');
  for (const { challenge: c } of items) {
    const choices = itemChoices(c);
    if (typeof c.instruction !== 'string' || !c.instruction.trim() || choices.length < 2
        || choices.some(x => !x.label) || new Set(choices.map(x => x.label.toLowerCase())).size !== choices.length
        || !choices.some(x => x.value === keyValue(c)))
      throw new Error('A reaction-lab challenge cannot be answered as generated.');
  }
  return d;
}

/** What the live adapter needs from the reaction lab; the catalog's `teachingWorkspace` declares the rest. */
export const reactionLabLiveDomain: WorkspaceDomain<ReactionLabData> = {
  validate: validateReactionLabData,
  initialState: d => {
    const items = reactionItems(d.challenges, { checkedOnly: true });
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
