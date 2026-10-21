/**
 * number-line's boss (`components/live-activity/boss.ts`), bespoke because the modes are points, landings and an
 * order placed on the line, and an open build of hops, each checked by the line's own code: the card is
 * `numberLine.card.ts`; this file validates a lesson, lists its challenges, asks one, carries the lever set and plays
 * the harness.
 */
import type { NumberLineChallenge, NumberLineData } from './NumberLine';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { hopsTaskOf, simplerHops, waysFor } from './numberLineBuildHops';
import { NUMBER_LINE_LEVERS, practiceParent, simplerItem } from './numberLineLevers';
import { settledView } from './numberLineView';
import { numberLineHarnessInputs } from './numberLineWorkspace';
import { numberLineCard, type NumberLineMiss } from './numberLine.card';

/** Validate the renderer contract at the service boundary, including jump arithmetic. */
export function validateNumberLineData(value: unknown): NumberLineData {
  const d = value as NumberLineData | null;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!d || typeof d.title !== 'string' || !d.range || !finite(d.range.min) || !finite(d.range.max)
      || d.range.min >= d.range.max || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > 12) throw new Error('Generated number line has no valid challenges or range');
  const inRange = (v: unknown) => finite(v) && v >= d.range.min && v <= d.range.max;
  for (const c of d.challenges) {
    if (!c || typeof c.id !== 'string' || typeof c.instruction !== 'string' || typeof c.hint !== 'string'
        || !['plot_point', 'show_jump', 'order_values', 'find_between', 'build_hops'].includes(c.type)
        || !Array.isArray(c.targetValues) || !c.targetValues.length || !c.targetValues.every(inRange))
      throw new Error('Generated number line has an invalid challenge');
    if (c.exactTargetValue !== undefined && !inRange(c.exactTargetValue)) throw new Error('Invalid missing value');
    if (c.type === 'build_hops') {
      // The open build: a start on the line, and a target its hop buttons reach at least two different ways.
      const task = hopsTaskOf(c);
      if (!task || !inRange(task.start) || task.target <= task.start || waysFor(task.target - task.start, task.hopCount).length < 2)
        throw new Error('Invalid hops build');
    }
    if (c.type === 'show_jump') {
      if (!inRange(c.startValue) || !Array.isArray(c.operations) || !c.operations.length) throw new Error('Missing jump operations');
      let landing = c.startValue!;
      for (const [index, op] of Array.from(c.operations.entries())) {
        if (!op || !['add', 'subtract'].includes(op.type) || !finite(op.changeValue) || op.changeValue < 0
            || !finite(op.startValue) || Math.abs(op.startValue - landing) > 0.0001) throw new Error('Invalid jump operation');
        landing += op.type === 'add' ? op.changeValue : -op.changeValue;
        if (!inRange(landing)) throw new Error('Jump leaves the number line');
        if (Math.abs(landing - c.targetValues[index]) > 0.0001) throw new Error('Jump answer does not match its operations');
      }
      if (c.targetValues.length !== c.operations.length) throw new Error('Missing jump answer');
    }
  }
  return d;
}

/** The easier practice item a simplify lever opened on `parent`, rebuilt from the payload alone as the component built it. */
export function numberLinePractice(parent: NumberLineChallenge, data: NumberLineData): NumberLineChallenge | null {
  return parent.type === 'build_hops' ? simplerHops(parent, data.range) : simplerItem(parent, data, settledView(data, parent));
}

export const numberLineBoss = defineBoss<NumberLineData, NumberLineChallenge, NumberLineMiss>({
  card: numberLineCard,
  validate: validateNumberLineData,
  items: d => d.challenges ?? [],
  ask: c => c.instruction,
  // Placed or built on the line and checked by its own code: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: NUMBER_LINE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/NumberLine.tsx',
    instanceId: 'line',
    defaults: { grade: 'Grade 1', mode: 'jump',
      topic: 'Subtract within 10: two independent single backward jumps, each taking away 1 to 4, starting at 5 to 9. No addition.' },
    mounted: 'svg[viewBox="0 0 760 240"]',
    probes: { modelHop: { selector: '[data-lever="model-hop"]', kind: 'count' } },
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as NumberLineData, all = data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, all);
      return parent ? numberLinePractice(parent, data) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    play: (right, c) => numberLineHarnessInputs(c, right),
  },
});
