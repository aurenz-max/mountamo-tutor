import { itemsFromChallenges } from '../../primitives/visual-primitives/math/baseTenScript';
import { readCount } from '../../primitives/visual-primitives/math/baseTenModel';
import type { BaseTenBlocksChallenge } from '../../primitives/visual-primitives/math/BaseTenBlocks';

export type BaseTenRemediationMove = 'contrast_block_count_and_worth';

export function compiledBlockWorthContrast(challenges: readonly BaseTenBlocksChallenge[]) {
  const items = itemsFromChallenges(challenges, 'read_blocks');
  const worth = items.filter(i => i.step === 'worth');
  const pair = worth.flatMap((a, index) => worth.slice(index + 1)
    .filter(b => a.problem.place !== b.problem.place && readCount(a.problem) === readCount(b.problem))
    .map(b => [a, b]))[0];
  return { items, targets: pair ?? [], count: pair ? 2 : 0 };
}

/** Preserve each mat's zero pattern and magnitude; change at most two counts.
 * The existing compiler remains the authority for which places are asked. */
export function selectBlockWorthContrast(baseline: readonly BaseTenBlocksChallenge[], move: BaseTenRemediationMove | null,
  range = { min: 1000, max: 9999 }) {
  const result = (challenges: readonly BaseTenBlocksChallenge[], status: 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus') =>
    ({ challenges, status, ...compiledBlockWorthContrast(challenges) });
  if (!move || baseline.some(c => c.type !== 'read_blocks')) return result(baseline, 'no-focus');
  if (baseline.some(c => !Number.isInteger(c.targetNumber) || c.targetNumber < 1000 || c.targetNumber > 9999))
    return result(baseline, 'insufficient-capacity');
  const compiled = compiledBlockWorthContrast(baseline);
  if (compiled.count === 2) return result(baseline, 'already-targeted');
  const worth = compiled.items.filter(i => i.step === 'worth');
  for (let a = 0; a < worth.length; a++) for (let b = a + 1; b < worth.length; b++) {
    const p = worth[a].problem.place, q = worth[b].problem.place;
    if (p === q) continue;
    for (const digit of [readCount(worth[a].problem), ...[1,2,3,4,5,6,7,8,9].filter(d => d !== readCount(worth[a].problem))]) {
      const first = baseline[a].targetNumber + (digit - readCount(worth[a].problem)) * 10 ** p;
      const second = baseline[b].targetNumber + (digit - readCount(worth[b].problem)) * 10 ** q;
      if ([first, second].some(n => n < Math.max(1000, range.min) || n > Math.min(9999, range.max))) continue;
      const next = baseline.map((c, i) => i === a ? { ...c, targetNumber: first } : i === b ? { ...c, targetNumber: second } : c);
      if (new Set(next.map(c => c.targetNumber)).size !== next.length) continue;
      const candidate = compiledBlockWorthContrast(next);
      if (candidate.count === 2 && candidate.items.map(i => i.id).join('|') === compiled.items.map(i => i.id).join('|'))
        return result(next, 'targeted');
    }
  }
  return result(baseline, 'insufficient-capacity');
}

/** Delivery gate on the manifest config: the reviewed Grade 4 read_blocks task at medium. */
export function baseTenDeliveryEligible(config: Record<string, unknown>): boolean {
  return config.targetEvalMode === 'read_blocks' && config.difficulty === 'medium' && config.objectiveGrade === '4';
}
