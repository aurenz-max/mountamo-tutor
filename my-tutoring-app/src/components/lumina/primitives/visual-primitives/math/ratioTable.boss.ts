/**
 * ratio-table's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a typed number and a slider the
 * activity checks: the card is `ratioTable.card.ts`; this file validates a lesson, lists its problems, asks one,
 * carries the lever set and plays the harness.
 */
import type { RatioTableData } from './RatioTable';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { SLIDER_MIN, SLIDER_STEP, matchesKey, ratioHarnessInput } from './ratioTableWorkspace';
import { RATIO_LEVERS, practiceParent, simplerRatio } from './ratioTableLevers';
import { ratioTableCard, type RatioMiss } from './ratioTable.card';

const TYPES = ['missing-value', 'find-multiplier', 'build-ratio', 'unit-rate'];
const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Reject a ratio-table lesson whose challenges cannot be attempted. */
export function validateRatioTableData(value: unknown): RatioTableData {
  const d = value as RatioTableData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated ratio table has invalid lesson content.');
  // Each item needs what its own check reads: two positive base numbers, a positive multiplier, two labels, and on a
  // build item a multiplier the slider can reach within the check's band.
  const max = d.maxMultiplier ?? 10;
  for (const c of d.challenges) {
    const ok = Array.isArray(c.baseRatio) && c.baseRatio.length === 2 && c.baseRatio.every(positive)
      && positive(c.targetMultiplier) && Array.isArray(c.rowLabels) && c.rowLabels.length === 2
      && (c.type !== 'build-ratio' || (() => {
        const nearest = Math.min(max, Math.max(SLIDER_MIN, Math.round(c.targetMultiplier / SLIDER_STEP) * SLIDER_STEP));
        return matchesKey(c, nearest);
      })());
    if (!ok) throw new Error(`A ratio-table ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

export const ratioTableBoss = defineBoss<RatioTableData, RatioTableData['challenges'][number], RatioMiss>({
  card: ratioTableCard,
  validate: validateRatioTableData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A typed number or a slider setting the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: RATIO_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/RatioTable.tsx',
    instanceId: 'ratio',
    defaults: { grade: 'Grade 6', mode: 'missing_value', topic: 'Equivalent ratios and unit rates' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice problem a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as RatioTableData).challenges ?? [];
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = all.find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? simplerRatio(parent) ?? undefined : parent;
    },
    // A number typed into "Your answer", or the "Multiplier" slider set, then Check. A wrong answer is the item's
    // signature miss from `ratioMiss` (the change added, the multiplier upside down, the rate inverted, one step off),
    // else half again too high.
    play: (right, c, ctx) => {
      const input = ratioHarnessInput(c, right ? 'correct' : 'wrong', (ctx.data as RatioTableData).maxMultiplier ?? 10);
      return input.kind === 'type'
        ? [{ type: 'write', label: 'Your answer', text: input.text }, { type: 'check' }]
        : [{ type: 'write', label: 'Multiplier', text: String(input.value) }, { type: 'check' }];
    },
  },
});
