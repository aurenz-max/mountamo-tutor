/**
 * Oral sentence studio's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one original
 * spoken sentence the tutor judges against its key, on meaning. The card is `oralSentenceStudio.card.ts`; this file
 * holds the content check, the items, the ask and key, the levers and the harness play.
 */
import type { OralSentenceStudioData } from './OralSentenceStudio';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { oralSentenceStudioCard, type SpokenOralSentenceMiss } from './oralSentenceStudio.card';
import { ORAL_SENTENCE_LEVERS } from './oralSentenceStudioLevers';
import {
  askFor, challengeAskable, itemsFromChallenges, oralSentenceHarnessAnswers, oralSentenceKey, oralSentenceSpokenMisses,
  type OralSentenceStudioItem,
} from './oralSentenceStudioDomain';

/** The session's items, built from the generated challenges (unaskable ones dropped). */
export const oralSentenceItems = (d: OralSentenceStudioData): OralSentenceStudioItem[] => itemsFromChallenges(d.challenges ?? []);

/** Reject a lesson the build would drop: a label with a control word, a word pair that is not two distinct words,
 *  example sentences that miss a word or the scene, a story line the examples copy. */
export function validateOralSentenceStudioData(value: unknown): OralSentenceStudioData {
  return validateChallengePool<OralSentenceStudioData>(value, c => !!c && challengeAskable(c),
    { pool: 'Generated oral sentence studio has invalid lesson content.', item: 'An oral sentence studio challenge cannot be asked.' });
}

export const oralSentenceStudioBoss = spokenBoss<OralSentenceStudioData, OralSentenceStudioItem, SpokenOralSentenceMiss>({
  card: oralSentenceStudioCard,
  validate: validateOralSentenceStudioData,
  items: oralSentenceItems,
  levers: ORAL_SENTENCE_LEVERS,
  speech: {
    ask: askFor,
    key: oralSentenceKey,
    misses: oralSentenceSpokenMisses,
    say: oralSentenceHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/OralSentenceStudio.tsx',
    instanceId: 'oral',
    defaults: { grade: 'Kindergarten', mode: 'describe_scene', topic: 'Using new vocabulary words' },
    mounted: '[data-pip-object="stimulus"]',
  },
});
