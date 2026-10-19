/**
 * Story ribbon's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken account the
 * tutor judges against its key, on meaning. The card is `storyRibbon.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { StoryRibbonData } from './StoryRibbon';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { storyRibbonCard, type SpokenStoryRibbonMiss } from './storyRibbon.card';
import { STORY_RIBBON_LEVERS } from './storyRibbonLevers';
import {
  askFor, itemFromChallenge, itemsFromChallenges, storyRibbonHarnessAnswers, storyRibbonKey, storyRibbonSpokenMisses,
  type StoryRibbonItem,
} from './storyRibbonDomain';

/** The session's items, built from the generated challenges (unaskable ones dropped). */
export const storyRibbonItems = (d: StoryRibbonData): StoryRibbonItem[] => itemsFromChallenges(d.challenges ?? []);

/** Reject a ribbon the build would drop: not exactly three valid events, a time cue that does not match the mode, or
 *  a picture label that is a sentence. */
export function validateStoryRibbonData(value: unknown): StoryRibbonData {
  return validateChallengePool<StoryRibbonData>(value, c => !!c && itemFromChallenge(c) !== null,
    { pool: 'Generated story ribbon has invalid lesson content.', item: 'A story ribbon item cannot be asked.' });
}

export const storyRibbonBoss = spokenBoss<StoryRibbonData, StoryRibbonItem, SpokenStoryRibbonMiss>({
  card: storyRibbonCard,
  validate: validateStoryRibbonData,
  items: storyRibbonItems,
  levers: STORY_RIBBON_LEVERS,
  speech: {
    ask: askFor,
    key: storyRibbonKey,
    misses: storyRibbonSpokenMisses,
    say: storyRibbonHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/StoryRibbon.tsx',
    instanceId: 'ribbon',
    defaults: { grade: 'Kindergarten', mode: 'tell_connected_account', topic: 'A day at the park' },
    mounted: '[data-pip-object="ribbon"]',
  },
});
