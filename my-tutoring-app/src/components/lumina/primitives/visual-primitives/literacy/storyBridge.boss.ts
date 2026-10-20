/**
 * Story bridge's boss, on the spoken preset (`components/live-activity/boss.ts`): say alike, say different and compare
 * big ideas are spoken comparisons the tutor judges against a meaning key; the four tap modes have no key (the activity
 * checks the tap, and the tutor is never told the answer), so they play through `show`. The card is
 * `storyBridge.card.ts`; this file holds the content check, the items, the ask and key, the levers and the harness play.
 */
import type { StoryBridgeData } from './StoryBridge';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { storyBridgeCard, type SpokenStoryBridgeMiss, type StoryBridgeMiss } from './storyBridge.card';
import { STORY_BRIDGE_LEVERS } from './storyBridgeLevers';
import {
  askFor, itemsFromChallenges, storyBridgeHarnessAnswers, storyBridgeKey, storyBridgeSpokenMisses, storyBridgeTargets,
  type StoryBridgeItem,
} from './storyBridgeDomain';

/** The session's items, built through the family's gates (an unaskable comparison is dropped). */
export const storyBridgeItems = (d: Pick<StoryBridgeData, 'challenges' | 'stories'>): StoryBridgeItem[] =>
  itemsFromChallenges(d.challenges ?? [], d.stories ?? []);

/** Reject a comparison the session would drop: stories it cannot find, a pair that is one story, a behaviour that
 *  names a friend, a Venn detail or event pairing its gates refuse. */
export function validateStoryBridgeData(value: unknown): StoryBridgeData {
  const d = value as StoryBridgeData;
  if (!d || !Array.isArray(d.stories) || d.stories.length < 2) throw new Error('Generated story bridge has no story pair.');
  return validateChallengePool<StoryBridgeData>(value, c => !!c && itemsFromChallenges([c], d.stories).length === 1,
    { pool: 'Generated story bridge has invalid lesson content.', item: 'A story bridge comparison cannot be asked.' });
}

export const storyBridgeBoss = spokenBoss<StoryBridgeData, StoryBridgeItem, StoryBridgeMiss | SpokenStoryBridgeMiss>({
  card: storyBridgeCard,
  validate: validateStoryBridgeData,
  items: storyBridgeItems,
  levers: STORY_BRIDGE_LEVERS,
  speech: {
    ask: askFor,
    // The tap modes have no key: the activity checks the tap.
    key: storyBridgeKey,
    misses: storyBridgeSpokenMisses,
    say: storyBridgeHarnessAnswers,
    show: (right, item) => [{ type: 'touch', target: right ? storyBridgeTargets(item).correct : storyBridgeTargets(item).wrong }],
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/StoryBridge.tsx',
    instanceId: 'bridge',
    defaults: { grade: 'Kindergarten', mode: 'match_character', topic: 'Two stories about friends who share' },
    mounted: '[data-pip-object="stories"]',
  },
});
