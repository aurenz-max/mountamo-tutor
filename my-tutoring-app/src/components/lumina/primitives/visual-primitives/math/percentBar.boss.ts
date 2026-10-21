/**
 * percent-bar's boss (`components/live-activity/boss.ts`), bespoke because its modes mix the bar, a typed amount and a
 * tapped option, every step checked by the activity: the card is `percentBar.card.ts`; this file validates a lesson,
 * lists its problems, asks one, carries the lever set and plays the harness.
 */
import type { PercentBarChallenge, PercentBarData } from './PercentBar';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { challengeSteps, percentAsk, percentHarnessSteps } from './percentBarWorkspace';
import { PERCENT_LEVERS, practiceParent, simplerPercent } from './percentBarLevers';
import { percentBarCard, type PercentBarMiss } from './percentBar.card';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';

const TYPES = ['direct', 'subtraction', 'addition', 'comparison', 'part_of', 'whole_of'];

/** Reject a percent-bar lesson whose challenges cannot be attempted. */
export function validatePercentBarData(value: unknown): PercentBarData {
  const d = value as PercentBarData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type) || typeof c.scenario !== 'string'))
    throw new Error('Generated percent bar has invalid lesson content.');
  // Each step needs what its own check reads: a percent the bar can reach, a consistent amount, or the right option
  // among the options.
  for (const c of d.challenges) {
    const ok = challengeSteps(c).every(s => s.kind === 'place'
      ? Number.isFinite(s.targetPercent) && s.targetPercent >= 0 && s.targetPercent <= (s.maxPercent ?? 100) && s.wholeValue > 0
      : s.kind === 'amount'
        ? s.whole > 0 && s.part > 0 && Math.abs((s.percent * s.whole) / 100 - s.part) < 0.005
        : Array.isArray(s.options) && s.options.some(o => o.id === s.correctOptionId));
    if (!ok) throw new Error(`A percent-bar ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

export const percentBarBoss = defineBoss<PercentBarData, PercentBarChallenge, PercentBarMiss>({
  card: percentBarCard,
  validate: validatePercentBarData,
  items: d => d.challenges,
  ask: c => percentAsk(c),
  // The bar, a typed amount or a tapped option the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, percentAsk(c), null),
  levers: PERCENT_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/PercentBar.tsx',
    instanceId: 'percent',
    defaults: { grade: 'Grade 6', mode: 'find_part', topic: 'Percents of a whole: discounts, tax and tips' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice problem a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as PercentBarData).challenges ?? [];
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = all.find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? simplerPercent(parent) ?? undefined : parent;
    },
    // From the step the scene reports (Try again keeps the steps already right): each place step sets the bar's slider
    // ("Percent on the bar") and presses Check, an amount step types into "Amount in dollars", the compare step taps an
    // option. A wrong answer is the step's signature miss from `percentMiss` (the discount placed, the rate not added,
    // the rest of the whole, the other option), else ten points off.
    play: (right, c, ctx) => {
      const from = Math.max(0, Number(String(ctx.demand?.step ?? '1').split(' ')[0]) - 1);
      return percentHarnessSteps(c, from, right ? 'correct' : 'wrong').flatMap((s): DriverInput[] => s.kind === 'place'
        ? [{ type: 'write', label: 'Percent on the bar', text: String(s.percent) }, { type: 'check' }]
        : s.kind === 'amount' ? [{ type: 'write', label: 'Amount in dollars', text: s.amount }, { type: 'check' }]
          : [{ type: 'choose', label: s.label }, { type: 'check' }]);
    },
  },
});
