/**
 * compare-objects' boss, on the spoken preset (`components/live-activity/boss.ts`): identify_attribute, compare_two
 * and non_standard are a spoken answer the tutor judges against the key; order_three has no key and the board checks
 * it, so it plays through `show`. The card is `compareObjects.card.ts`; this file holds the content check, the items,
 * the ask and key, the levers and the harness play.
 */
import type { CompareObjectsData } from './CompareObjects';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { compareObjectsCard, type CompareObjectsMiss } from './compareObjects.card';
import { COMPARE_LEVERS, practiceFromId } from './compareObjectsLevers';
import {
  askFor, askGiven, buildCompareItems, compareKey, compareObjectsHarnessAnswers, compareObjectsSpokenMisses,
  type CompareObjectsChallengeLike, type CompareObjectsItem,
} from './compareObjectsDomain';

/** The session's items, built through the family's own gates (an unaskable challenge is dropped). */
export const compareObjectsItems = (data: Pick<CompareObjectsData, 'challenges' | 'gradeBand'>): CompareObjectsItem[] =>
  buildCompareItems((data.challenges ?? []) as CompareObjectsChallengeLike[], { band: data.gradeBand === '1' ? '1' : 'K' }).items;

/** Reject a comparison whose challenges cannot be ASKED before they reach a five-year-old. */
export function validateCompareObjectsData(value: unknown): CompareObjectsData {
  const d = value as CompareObjectsData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? 'K')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated comparison has invalid lesson content.');
  // `buildCompareItems` DROPS anything unaskable, so an empty build means this lesson would mount with nothing to ask.
  if (!compareObjectsItems(d).length) throw new Error('A compare-objects challenge cannot run in the lesson.');
  return d;
}

export const compareObjectsBoss = spokenBoss<CompareObjectsData, CompareObjectsItem, CompareObjectsMiss>({
  card: compareObjectsCard,
  validate: validateCompareObjectsData,
  items: compareObjectsItems,
  levers: COMPARE_LEVERS,
  speech: {
    ask: askFor,
    // An ordering has no key: the board checks it, and its misses come from that check.
    key: compareKey,
    // The closed menu (identify_attribute) and both names (compare_two) must be said for the question to be answerable.
    given: askGiven,
    misses: compareObjectsSpokenMisses,
    say: compareObjectsHarnessAnswers,
    // An ordering touches each object button: in the asked order, or reversed (the mode's signature error).
    show: (right, item) => (right ? item.answerNames : [...item.answerNames].reverse())
      .map((name): DriverInput => ({ type: 'touch', target: `pick-${name}` })),
  },
  drive: {
    component: 'primitives/visual-primitives/math/CompareObjects.tsx',
    instanceId: 'measure',
    defaults: { grade: 'Kindergarten', mode: 'compare_two', topic: 'Deciding which of two objects is longer' },
    mounted: '[data-pip-object="drawing"]',
    // The session item, or an easier practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const items = compareObjectsItems(ctx.data as CompareObjectsData);
      return items.find(i => i.id === ctx.itemId) ?? practiceFromId(ctx.itemId ?? '', items) ?? undefined;
    },
  },
});
