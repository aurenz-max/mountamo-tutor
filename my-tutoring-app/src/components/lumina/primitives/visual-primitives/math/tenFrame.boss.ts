/**
 * ten-frame's boss, on the spoken preset (`components/live-activity/boss.ts`): subitize, operate and Grades 1-2
 * make-ten are a spoken number the tutor judges against the key; every other item has no key, the frame checks it,
 * and it plays through `show`. The card is `tenFrame.card.ts`; this file holds the content check, the items, the ask
 * and key, the levers and the harness play.
 */
import type { TenFrameData } from './TenFrame';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { tenFrameCard, type TenFrameMiss } from './tenFrame.card';
import { TEN_FRAME_LEVERS, practiceItem } from './tenFrameLevers';
import { askFor, itemsFromChallenges, tenFrameHarnessAnswers, type TenFrameBand, type TenFrameItem } from './tenFrameDomain';
import { countsFlips, tenFrameGiven, tenFrameKey, tenFrameSpokenMisses } from './tenFrameWorkspace';

/** The session's items, built through the family's own gate (an unaskable challenge is dropped). */
export const tenFrameItems = (d: Pick<TenFrameData, 'challenges' | 'mode' | 'gradeBand'>): TenFrameItem[] =>
  itemsFromChallenges(d.challenges ?? [], { capacity: d.mode === 'double' ? 20 : 10, band: d.gradeBand ?? 'K' });

/** Reject a generated frame whose challenges the component would drop, at the service boundary. */
export function validateTenFrameData(value: unknown): TenFrameData {
  const d = value as TenFrameData;
  if (!d || typeof d.title !== 'string' || !['single', 'double'].includes(d.mode)
      || !['K', '1-2'].includes(d.gradeBand ?? '') || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.instruction !== 'string'))
    throw new Error('Generated ten frame has invalid lesson content.');
  if (tenFrameItems(d).length !== d.challenges.length) throw new Error('A ten-frame challenge cannot run in the lesson.');
  return d;
}

const cell = (i: number): DriverInput => ({ type: 'touch', target: `cell-${i}` });

/** The cells a placement touches, in order: the seeded counters to flip, or the empty boxes to fill. */
const frameCells = (item: TenFrameItem): number[] => {
  const seeded = item.seedCells ?? Array.from({ length: item.kind === 'subitize' ? 0 : item.shown }, (_, i) => i);
  return countsFlips(item) ? seeded
    : Array.from({ length: item.capacity }, (_, i) => i).filter(c => !seeded.includes(c));
};

export const tenFrameBoss = spokenBoss<TenFrameData, TenFrameItem, TenFrameMiss>({
  card: tenFrameCard,
  validate: validateTenFrameData,
  items: tenFrameItems,
  levers: TEN_FRAME_LEVERS,
  speech: {
    ask: askFor,
    // A placement or a flip has no key: the frame checks it.
    key: tenFrameKey,
    given: tenFrameGiven,
    misses: tenFrameSpokenMisses,
    say: item => { const { correct, plainWrong } = tenFrameHarnessAnswers(item); return { correct, plainWrong }; },
    // A quick look not yet shown is the learner's to start: they press Show me, then answer.
    before: (item, ctx) => (item.kind === 'subitize' && ctx.demand?.presentation !== 'ready'
      ? [{ type: 'choose', label: 'Show me' }] : []),
    show: (right, item, ctx) => {
      // build_pair (open build): Try again keeps the build, so a kept frame is cleared counter by counter first (the
      // driver placed it from cell 0). Wrong: the whole number in red. Right: red, then yellow, a pair that moves with
      // the item's ordinal so a repeated total gets a different way; then I'm done.
      if (item.kind === 'build_pair') {
        const kept = Number(ctx.demand?.countersOnFrame ?? 0);
        const clear = Array.from({ length: Number.isInteger(kept) ? kept : 0 }, (_, i) => cell(i));
        const n = item.answer;
        const yellow = right ? Math.min(n - 1, Math.max(1, Math.floor(n / 2) + (item.splitOrdinal ?? 1) - 1)) : 0;
        return [...clear, { type: 'choose', label: 'Red counters' }, ...Array.from({ length: n - yellow }, (_, i) => cell(i)),
          ...(yellow ? [{ type: 'choose' as const, label: 'Yellow counters' }, ...Array.from({ length: yellow }, (_, i) => cell(n - yellow + i))] : []),
          { type: 'choose', label: "I'm done!" }];
      }
      // Placing modes tap empty boxes, flipping modes tap the seeded counters.
      const placed = tenFrameHarnessAnswers(item).placed!;
      return frameCells(item).slice(0, right ? placed.correct : placed.wrong).map(cell);
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/TenFrame.tsx',
    instanceId: 'frame',
    defaults: { grade: 'Kindergarten', mode: 'build', topic: 'Build numbers to 10 on a ten frame' },
    mounted: '[data-pip-object="frame"]',
    // The session item, or an easier practice item (`~smaller`) rebuilt from its parent with the component's builder.
    current: ctx => {
      const d = ctx.data as TenFrameData;
      const all = tenFrameItems(d);
      const parent = ctx.itemId?.endsWith('~smaller') ? all.find(i => `${i.id}~smaller` === ctx.itemId) : undefined;
      return parent ? practiceItem(parent, (d.gradeBand ?? 'K') as TenFrameBand, all) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});
