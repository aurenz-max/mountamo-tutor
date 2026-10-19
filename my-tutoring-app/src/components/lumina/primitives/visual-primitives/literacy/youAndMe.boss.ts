/**
 * You & Me's boss, on the spoken preset (`components/live-activity/boss.ts`): every turn is one spoken sentence the
 * tutor judges against its key, on meaning. The card is `youAndMe.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { YouAndMeChallenge, YouAndMeData } from './YouAndMe';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { youAndMeCard, type SpokenYouAndMeMiss } from './youAndMe.card';
import { YOU_AND_ME_LEVERS } from './youAndMeLevers';
import { YOU_AND_ME_MODES, youAndMeAsk, youAndMeHarnessAnswers, youAndMeKey, youAndMeSpokenMisses } from './youAndMeDomain';

/** Reject a turn that cannot be asked: two named partners, an actor and a speaker among them, and an action. */
export function validateYouAndMeData(value: unknown): YouAndMeData {
  return validateChallengePool<YouAndMeData>(value,
    c => !!c && (YOU_AND_ME_MODES as readonly string[]).includes(c.type) && Array.isArray(c.participants)
      && c.participants.length === 2 && c.participants.every(p => !!p?.name) && [0, 1].includes(c.actor)
      && [0, 1].includes(c.speaker) && typeof c.action === 'string' && !!c.action.trim(),
    { pool: 'Generated You & Me has invalid lesson content.', item: 'A You & Me turn cannot be asked.' });
}

export const youAndMeBoss = spokenBoss<YouAndMeData, YouAndMeChallenge, SpokenYouAndMeMiss>({
  card: youAndMeCard,
  validate: validateYouAndMeData,
  items: data => data.challenges,
  levers: YOU_AND_ME_LEVERS,
  speech: {
    ask: youAndMeAsk,
    key: youAndMeKey,
    misses: youAndMeSpokenMisses,
    say: youAndMeHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/YouAndMe.tsx',
    instanceId: 'partners',
    defaults: { grade: 'Kindergarten', mode: 'describe_action', topic: 'Using I and you to tell a partner what happened' },
    mounted: '[data-pip-object="scene"]',
  },
});
