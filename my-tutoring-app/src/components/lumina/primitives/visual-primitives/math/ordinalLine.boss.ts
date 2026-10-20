/**
 * ordinal-line's boss, on the spoken preset (`components/live-activity/boss.ts`): identify, match, relative_position
 * and sequence_story are a spoken name or place word the tutor judges against the key; build_sequence has no key and
 * the line checks it, so it plays through `show`. The card is `ordinalLine.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play.
 */
import type { OrdinalLineData } from './OrdinalLine';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { ordinalLineCard, type OrdinalLineMiss } from './ordinalLine.card';
import { ORDINAL_LEVERS, practiceFromId } from './ordinalLineLevers';
import {
  askFor, itemsFromChallenges, ordinalKey, ordinalLineHarnessAnswers, ordinalSpokenMisses, VALID_CONTEXTS,
  type OrdinalContext, type OrdinalLineItem,
} from './ordinalLineDomain';

/** The line's context, as the component resolves it: an unknown one draws the race. */
export const ordinalContextOf = (line: Pick<OrdinalLineData, 'context'>): OrdinalContext =>
  ((VALID_CONTEXTS as readonly string[]).includes(line.context) ? line.context : 'race');

/** The session's items, built through the family's own gates (an unaskable challenge is dropped). */
export const ordinalLineItems = (line: OrdinalLineData): OrdinalLineItem[] =>
  itemsFromChallenges(line.challenges ?? [], { band: line.gradeBand ?? 'K', context: ordinalContextOf(line) }).items;

/** Reject a line whose challenges cannot be ASKED before it reaches a five-year-old. */
export function validateOrdinalLineData(value: unknown): OrdinalLineData {
  const d = value as OrdinalLineData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !(VALID_CONTEXTS as readonly string[]).includes(d.context) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated ordinal line has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so an empty build means this lesson
  // would mount with nothing to ask.
  if (!ordinalLineItems(d).length) throw new Error('An ordinal-line challenge cannot run in the lesson.');
  return d;
}

export const ordinalLineBoss = spokenBoss<OrdinalLineData, OrdinalLineItem, OrdinalLineMiss>({
  card: ordinalLineCard,
  validate: validateOrdinalLineData,
  items: ordinalLineItems,
  levers: ORDINAL_LEVERS,
  speech: {
    ask: askFor,
    // A build has no key: the line checks it, and its misses come from that check.
    key: ordinalKey,
    // The story states every character's place by design: hearing it is the task.
    given: item => (item.kind === 'sequence_story' ? [item.storyText] : []),
    misses: ordinalSpokenMisses,
    say: item => { const { correct, plainWrong } = ordinalLineHarnessAnswers(item); return { correct, plainWrong }; },
    // A build touches each picture, then its place: in the clued order, or reversed (the wrong-end error through the hands).
    show: (right, item) => (right ? item.answerOrder : [...item.answerOrder].reverse()).flatMap((name, i): DriverInput[] =>
      [{ type: 'touch', target: `picture-${name}` }, { type: 'touch', target: `slot-${i + 1}` }]),
  },
  drive: {
    component: 'primitives/visual-primitives/math/OrdinalLine.tsx',
    instanceId: 'line-up',
    defaults: { grade: 'Kindergarten', mode: 'identify', topic: 'Saying which place someone is standing in a line' },
    mounted: '[data-pip-object="stage"]',
    // The session item, or an easier practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const items = ordinalLineItems(ctx.data as OrdinalLineData);
      return items.find(i => i.id === ctx.itemId) ?? practiceFromId(ctx.itemId ?? '', items) ?? undefined;
    },
  },
});
