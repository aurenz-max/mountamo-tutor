/**
 * reaction-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one challenge the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. A challenge asked after mixing first needs Mix Substances!. The card is `reactionLab.card.ts`; this
 * file holds the content check, the items, the ask and key, the levers and the harness play.
 */
import type { ReactionLabData } from './ReactionLab';
import { spokenBoss } from '../../../components/live-activity/boss';
import { reactionLabCard } from './reactionLab.card';
import { REACTION_LEVERS } from './reactionLabLevers';
import {
  askOf, itemChoices, keyValue, reactionHarnessAnswers, reactionItems, reactionKey, reactionMode, reactionSpokenMisses,
  type ReactionItem, type ReactionMiss,
} from './reactionLabWorkspace';

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

export const reactionLabBoss = spokenBoss<ReactionLabData, ReactionItem, ReactionMiss>({
  card: reactionLabCard,
  validate: validateReactionLabData,
  // The workspace keeps only challenges with a code-held key, predictions first.
  items: d => reactionItems(d.challenges, { checkedOnly: true }),
  levers: REACTION_LEVERS,
  speech: {
    ask: askOf,
    key: reactionKey,
    misses: reactionSpokenMisses,
    say: reactionHarnessAnswers,
    // A challenge asked after mixing: nothing to answer from until the learner runs the reaction.
    before: (item, ctx) => (item.stage === 'after' && ctx.demand?.presentation !== 'ready'
      ? [{ type: 'choose', label: 'Mix Substances!' }] : []),
    modeOf: reactionMode,
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/ReactionLab.tsx',
    instanceId: 'reaction-lab',
    defaults: { grade: 'Grade 4', mode: 'observe', topic: 'Signs of a chemical reaction' },
    mounted: '[data-pip-object="workspace"]',
  },
});
