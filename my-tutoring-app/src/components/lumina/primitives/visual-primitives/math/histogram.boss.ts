/**
 * histogram's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a tapped shape word, a tapped
 * bar and a typed number, every one checked by the activity: the card is `histogram.card.ts`; this file validates a
 * lesson, lists its graphs, asks one, carries the lever set and plays the harness.
 */
import type { HistogramData } from './Histogram';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { computeBins, histogramCorrect, histogramHarnessInput } from './histogramWorkspace';
import { HISTOGRAM_LEVERS, practiceParent, simplerHistogram } from './histogramLevers';
import { histogramCard, type HistogramMiss } from './histogram.card';

const TYPES = ['identify_shape', 'find_modal_bin', 'read_frequency', 'estimate_center'];

/** Reject a histogram lesson whose challenges cannot be attempted. */
export function validateHistogramData(value: unknown): HistogramData {
  const d = value as HistogramData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType)
        || typeof c.prompt !== 'string' || !c.prompt.trim() || !Array.isArray(c.data) || !c.data.length || !(c.binWidth > 0)))
    throw new Error('Generated histogram has invalid lesson content.');
  // Each item needs what its own check reads, and its key must be reachable through the controls: a shape among the
  // chips, a modal bin that is a drawn bar, an asked bin that is drawn, a center with a tolerance.
  for (const c of d.challenges) {
    const bins = computeBins(c.data, c.binWidth, c.binStart);
    const input = histogramHarnessInput(c, 'correct');
    const work = input.kind === 'choose'
      ? { shape: c.shapeOptions?.find(s => s === c.expectedShape) ?? null, binIndex: null, typed: '' }
      : input.kind === 'bar' ? { shape: null, binIndex: input.index, typed: '' } : { shape: null, binIndex: null, typed: input.text };
    const ok = (c.challengeType !== 'read_frequency' || bins.some(b => b.start === c.targetBinStart))
      && (c.challengeType !== 'estimate_center' || Number.isFinite(c.tolerance))
      && histogramCorrect(c, work, bins);
    if (!ok) throw new Error(`A histogram ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

export const histogramBoss = defineBoss<HistogramData, HistogramData['challenges'][number], HistogramMiss>({
  card: histogramCard,
  validate: validateHistogramData,
  items: d => d.challenges,
  ask: c => c.prompt,
  // A shape, a bar or a number the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.prompt, null),
  levers: HISTOGRAM_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/Histogram.tsx',
    instanceId: 'histo',
    defaults: { grade: 'Grade 7', mode: 'read_frequency', topic: 'Reading histograms: shape, modal bin, frequency and center' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice graph a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as HistogramData).challenges ?? [];
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = all.find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? simplerHistogram(parent) ?? undefined : parent;
    },
    // Every mode through its real controls (`histogramHarnessInput`): a shape chip tapped, a bar tapped (`bar-<i>`), or
    // a number typed into "Your answer", then Check. A wrong answer is the item's signature miss: the other skew or one
    // peak for two, the bar next to the tallest, an edge of the asked bin, two bar widths off the center.
    play: (right, c): DriverInput[] => {
      const input = histogramHarnessInput(c, right ? 'correct' : 'wrong');
      if (input.kind === 'choose') return [{ type: 'choose', label: input.label }, { type: 'check' }];
      if (input.kind === 'bar') return [{ type: 'touch', target: `bar-${input.index}` }, { type: 'check' }];
      return [{ type: 'write', label: 'Your answer', text: input.text }, { type: 'check' }];
    },
  },
});
