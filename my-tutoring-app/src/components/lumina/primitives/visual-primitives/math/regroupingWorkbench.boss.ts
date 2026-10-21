/**
 * regrouping-workbench's boss (`components/live-activity/boss.ts`), bespoke because every mode is a typed number the
 * activity checks: the card is `regroupingWorkbench.card.ts`; this file validates a lesson, lists its problems, asks
 * one, carries the lever set and plays the harness.
 */
import type { RegroupingWorkbenchData } from './RegroupingWorkbench';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { operandsOf, regroupAsk, regroupingHarnessDigits, resultOf } from './regroupingWorkbenchWorkspace';
import { REGROUP_LEVERS, practiceParent, smallerProblem } from './regroupingWorkbenchLevers';
import { regroupingWorkbenchCard, type RegroupMiss } from './regroupingWorkbench.card';

type Challenge = RegroupingWorkbenchData['challenges'][number];
const PROBLEM = /^\s*(\d+)\s*([+\-−])\s*(\d+)\s*$/;
const PLACES: Record<string, number> = { tens: 2, hundreds: 3, thousands: 4 };
const NAMES = ['Ones', 'Tens', 'Hundreds', 'Thousands'];

/** Reject a regrouping lesson whose challenges cannot be attempted. */
export function validateRegroupingWorkbenchData(value: unknown): RegroupingWorkbenchData {
  const d = value as RegroupingWorkbenchData;
  if (!d || typeof d.title !== 'string' || !['addition', 'subtraction'].includes(d.operation)
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.problem !== 'string'))
    throw new Error('Generated regrouping workbench has invalid lesson content.');
  // The component grades on the session operation with the operands read from the problem string, so the string's
  // sign must agree with it and a take-away must not go below zero (the digit boxes cannot write a negative).
  for (const c of d.challenges) {
    const m = PROBLEM.exec(c.problem);
    const [a, b] = operandsOf(c, d);
    const ok = !!m && (m[2] === '+') === (d.operation === 'addition') && resultOf(d.operation, a, b) >= 0;
    if (!ok) throw new Error(`A regrouping-workbench challenge "${c.problem}" cannot be answered as generated.`);
  }
  return d;
}

/** The session item, or the easier practice problem a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): Challenge | undefined {
  const d = ctx.data as RegroupingWorkbenchData;
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const parent = (d.challenges ?? []).find(c => c.id === parentId);
  return parent && parentId !== ctx.itemId ? smallerProblem(parent, d.operation, d) ?? undefined : parent;
}

export const regroupingWorkbenchBoss = defineBoss<RegroupingWorkbenchData, Challenge, RegroupMiss>({
  card: regroupingWorkbenchCard,
  validate: validateRegroupingWorkbenchData,
  items: d => d.challenges,
  ask: c => regroupAsk(c),
  // A typed number the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, regroupAsk(c), null),
  levers: REGROUP_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/RegroupingWorkbench.tsx',
    instanceId: 'regroup',
    defaults: { grade: 'Grade 2', mode: 'add_regroup', topic: 'Adding two-digit numbers with regrouping' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    // The answer typed one digit per place box ("Ones digit", "Tens digit", ...) and Check. A wrong answer is the mode's
    // signature error from `regroupMiss`: the carry left out, the smaller digit taken from the larger, or (no regroup)
    // the ones digit off by one. Trades are optional and never checked, so the harness does not make them.
    play: (right, c, ctx) => {
      const d = ctx.data as RegroupingWorkbenchData;
      const [a, b] = operandsOf(c, d);
      const digits = regroupingHarnessDigits(d.operation, a, b, PLACES[d.maxPlace] ?? 2, right ? 'correct' : 'wrong');
      return [...digits.map((n, i) => ({ type: 'write' as const, label: `${NAMES[i]} digit`, text: String(n) })), { type: 'check' as const }];
    },
    replayKeys: ctx => {
      const c = currentItem(ctx);
      if (!c) return [];
      const d = ctx.data as RegroupingWorkbenchData;
      const [a, b] = operandsOf(c, d);
      return [String(resultOf(d.operation, a, b))];
    },
  },
});
