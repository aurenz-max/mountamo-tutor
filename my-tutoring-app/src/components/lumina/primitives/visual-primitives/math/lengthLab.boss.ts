/**
 * length-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): compare and indirect are said (the
 * tutor judges the words against the key) or tapped (the activity checks the tap), SAY_OR_SHOW items; laying units,
 * guessing then measuring, measuring with two units and ordering have no key, the activity checks them, and they play
 * through `show`. The card is `lengthLab.card.ts`; this file holds the content check, the items, the ask and key, the
 * levers and the harness play.
 */
import type { LengthLabChallenge, LengthLabData } from './LengthLab';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { lengthLabCard, type LengthMiss } from './lengthLab.card';
import { LENGTH_LEVERS, simplerLength } from './lengthLabLevers';
import { lengthAsk, lengthHarnessWords, lengthItems, lengthKey, lengthSpokenMisses } from './lengthLabWorkspace';

const CHALLENGE_TYPES = ['compare', 'tile_and_count', 'order', 'indirect', 'estimate_then_tile', 'two_unit_compare'];
const len = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

/** Reject a length lesson whose challenges cannot be attempted. */
export function validateLengthLabData(value: unknown): LengthLabData {
  const d = value as LengthLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !c.objectName0 || !len(c.objectLength0)))
    throw new Error('Generated length lab has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const order = (c.correctOrderCsv ?? '').split(',').map(s => s.trim());
    const names = [c.objectName0, c.objectName1, c.objectName2];
    const ok = c.type === 'compare' ? !!c.objectName1 && ['longer', 'shorter', 'same'].includes(c.correctAnswer)
      : c.type === 'tile_and_count' ? len(c.correctUnitCount ?? c.objectLength0)
      : c.type === 'estimate_then_tile' ? (c.estimateOptions ?? []).includes(c.correctUnitCount || c.objectLength0)
      : c.type === 'two_unit_compare' ? len(c.correctUnitCount) && len(c.correctUnitCountB)
        && c.correctUnitCount !== c.correctUnitCountB && (c.unitType || d.unitType) !== (c.unitTypeB || d.unitType)
      : c.type === 'order' ? !!c.objectName1 && !!c.objectName2 && order.length === 3
        && order.every(n => names.includes(n)) && new Set(order).size === 3
      : !!c.objectName1 && !!c.clue0 && !!c.clue1 && [c.objectName0, c.objectName1, 'same'].includes(c.correctAnswer);
    if (!ok) throw new Error(`A length-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });
const check: DriverInput = { type: 'check' };
const unitLabel = (u: string | undefined, d: LengthLabData | undefined) => (u || d?.unitType || 'cubes').replace('_', ' ');
const lay = (unit: string, n: number) => Array.from({ length: n }, () => choose(`Add ${unit}`));

export const lengthLabBoss = spokenBoss<LengthLabData, LengthLabChallenge, LengthMiss>({
  card: lengthLabCard,
  validate: validateLengthLabData,
  items: lengthItems,
  levers: LENGTH_LEVERS,
  speech: {
    ask: lengthAsk,
    // The boards have no key: the activity checks them.
    key: lengthKey,
    misses: lengthSpokenMisses,
    say: lengthHarnessWords,
    modeOf: c => c.type,
    // The boards through their real controls. A wrong one is the mode's signature error from `lengthMiss`: one unit
    // too many, tiling to the guess, the bigger unit, the order reversed. A guess kept from a wrong attempt (Try again
    // keeps it) is read from the scene's `guess` fact.
    show: (right, c, ctx) => {
      const d = ctx.data as LengthLabData | undefined;
      const truth = c.correctUnitCount || c.objectLength0;
      if (c.type === 'tile_and_count') return [...lay(unitLabel(c.unitType, d), right ? truth : truth + 1), check];
      if (c.type === 'estimate_then_tile') {
        const kept = Number(ctx.demand?.guess);
        const guess = Number.isInteger(kept) ? kept
          : right ? truth : (c.estimateOptions ?? []).find(g => g !== truth) ?? truth;
        const pick = Number.isInteger(kept) ? [] : [choose(String(guess))];
        return [...pick, ...lay(unitLabel(c.unitType, d), right ? truth : guess !== truth ? guess : truth + 1), check];
      }
      if (c.type === 'two_unit_compare') {
        const a = unitLabel(c.unitType, d), b = unitLabel(c.unitTypeB, d);
        const more = (c.correctUnitCount ?? 0) > (c.correctUnitCountB ?? 0) ? a : b;
        return [...lay(a, c.correctUnitCount ?? 0), check, ...lay(b, c.correctUnitCountB ?? 0), check,
          choose(right ? more : more === a ? b : a)];
      }
      const names = String(c.correctOrderCsv ?? '').split(',').map(s => s.trim());
      return [...(right ? names : [...names].reverse()).map(choose), check];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/LengthLab.tsx',
    instanceId: 'length',
    defaults: { grade: 'Kindergarten', mode: 'compare', topic: 'Comparing and measuring lengths' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const d = ctx.data as LengthLabData;
      const items = lengthItems(d);
      const parent = ctx.itemId?.endsWith('~simpler') ? items.find(c => `${c.id}~simpler` === ctx.itemId) : null;
      return parent ? simplerLength(parent, d.unitType) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
  },
});
