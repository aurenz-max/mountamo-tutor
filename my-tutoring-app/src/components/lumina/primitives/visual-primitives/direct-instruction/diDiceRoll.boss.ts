/**
 * Dice roll's boss, on the spoken preset (`components/live-activity/boss.ts`): the card is `diDiceRoll.card.ts`;
 * this file is what the preset cannot know — the content check, the key, the known misses, the levers, the roll
 * before the answer and the harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiDiceRollData } from './DiDiceRoll';
import type { DiDiceRollChallenge } from './diDiceRollScript';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diDiceRollCard } from './diDiceRoll.card';
import { diceAskFor, diceChallengeValid, diceKey, diceSpokenMisses, diDiceRollHarnessAnswers,
  type SpokenDiceMiss } from './diDiceRollWorkspace';
import { DICE_LEVERS } from './diDiceRollLevers';

/** Reject a pool whose items cannot be asked: die faces 1-6 and an answer that matches them. */
export function validateDiDiceRollData(value: unknown): DiDiceRollData {
  const d = value as DiDiceRollData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated dice practice has invalid lesson content.');
  if (!d.challenges.every(diceChallengeValid)) throw new Error('A dice item cannot run in the teaching workspace.');
  return d;
}

export const diDiceRollBoss = spokenBoss<DiDiceRollData, DiDiceRollChallenge, SpokenDiceMiss>({
  card: diDiceRollCard,
  validate: validateDiDiceRollData,
  items: data => data.challenges,
  levers: DICE_LEVERS,
  speech: {
    ask: diceAskFor,
    key: diceKey,
    // A comparison's ask says its three words ("left, right, or same"), the answer among them.
    given: item => (item.challengeType === 'compare_dice' ? ['left, right, or same'] : []),
    misses: diceSpokenMisses,
    say: diDiceRollHarnessAnswers,
    // The dice are covered until the learner rolls them.
    before: (item, ctx) => (ctx.demand?.rolled === 'yes' ? []
      : [{ type: 'choose', label: item.challengeType === 'count_pips' ? 'Roll the die' : 'Roll both dice' }]),
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiDiceRoll.tsx',
    instanceId: 'dice',
    defaults: { grade: 'Kindergarten', mode: 'count_pips', topic: 'Counting the dots on a die' },
    mounted: '[data-dice-object="dice"]',
    probes: { reward: { selector: '[data-dice-trail]', kind: 'count' } },
  },
});
