import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';
import { HABITAT_ANIMALS, HABITAT_PIECES } from '../../../primitives/visual-primitives/biology/habitatBuild';
import { itemFromChallenge } from '../../../primitives/visual-primitives/biology/habitatDioramaScript';

/**
 * Habitat-diorama oracle, `build_habitat` (the open build). The component judges a habitat with `readHabitatBuild`:
 * every asked need is met by some piece the animal can use, and no piece would hurt it. This oracle reads the animal
 * table (the data contract) and does its own search over every subset of the tray, under its own reading of that rule.
 *
 * Checks (build_habitat only):
 *  - schema           : a known animal, known needs including food and water, every tray piece known.
 *  - answer-key       : the tray can make a passing habitat AND at least two different passing habitats (open build),
 *                       and holds at least one piece that does not serve the animal (the choice is real), and no
 *                       piece the animal sometimes uses offered as wrong for it (`contested`).
 *  - answer-leak      : the ask the learner hears names the animal and no need ("food", "water", "shelter", ...).
 *  - scope            : K-2 asks food, water and shelter only; from grade 3 the right weather is asked too.
 *  - clustering       : no animal twice in a session.
 * Other challenge types are reported as unchecked.
 */
const NEED_WORD = /\b(food|water|drink|eat|shelter|hide|rest|weather|climate|warm|cold|snow|rain|sun)\b/i;
const NEEDS = ['food', 'water', 'shelter', 'weather'];

/** Passing habitats among the tray's subsets, by this oracle's own reading of the rule (capped). */
export function passingHabitats(animalId: string, needs: readonly string[], tray: readonly string[], cap = 64): string[][] {
  const animal = HABITAT_ANIMALS.find(a => a.id === animalId);
  if (!animal) return [];
  const out: string[][] = [];
  const n = Math.min(tray.length, 14);
  for (let mask = 1; mask < 1 << n && out.length < cap; mask++) {
    const pick = tray.filter((_, i) => mask & (1 << i));
    if (pick.some(p => animal.harmedBy.includes(p))) continue;
    const ok = needs.every(need => pick.some(p => (animal.meets as Record<string, readonly string[]>)[need]?.includes(p)));
    if (ok) out.push(pick);
  }
  return out;
}

export const habitatDioramaOracle: ContentOracle = {
  componentId: 'habitat-diorama',
  modes: ['build_habitat'],
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    const challenges = asRecordArray(data.challenges);
    const unchecked = new Set<string>();
    const band = String(data.gradeBand ?? '3-5');
    const seen = new Set<string>();
    let checked = 0;
    challenges.forEach((c, i) => {
      const where = `challenge[${i}] ${c.id ?? ''}`.trim();
      if (c.type !== 'build_habitat') { unchecked.add(String(c.type)); return; }
      checked++;
      const animalId = String(c.targetAnimal ?? '');
      const needs = Array.isArray(c.needs) ? c.needs.map(String) : [];
      const tray = Array.isArray(c.trayPieces) ? c.trayPieces.map(String) : [];
      const animal = HABITAT_ANIMALS.find(a => a.id === animalId);
      if (!animal || !needs.length || needs.some(n => !NEEDS.includes(n)) || !needs.includes('food') || !needs.includes('water')
        || tray.some(p => !HABITAT_PIECES.some(x => x.id === p))) {
        violations.push({ check: 'schema', where, detail: `unreadable build: ${JSON.stringify({ animalId, needs, tray })}` });
        return;
      }
      if (seen.has(animalId)) violations.push({ check: 'clustering', where, detail: `animal repeated in the session: ${animalId}` });
      seen.add(animalId);
      const passing = passingHabitats(animalId, needs, tray);
      if (passing.length < 2) violations.push({ check: 'answer-key-desync', where,
        detail: passing.length ? `only one habitat passes from ${tray.join(',')}: a closed answer` : `no habitat passes from ${tray.join(',')}` });
      const serves = (p: string) => needs.some(n => (animal.meets as Record<string, readonly string[]>)[n].includes(p));
      if (tray.every(serves)) violations.push({ check: 'answer-key-desync', where, detail: 'every piece on offer serves the animal: no real choice' });
      // A piece the animal sometimes uses in nature, offered where the check would call it wrong, teaches a false fact.
      const contested = tray.filter(p => animal.contested.includes(p) && !serves(p));
      if (contested.length) violations.push({ check: 'answer-key-desync', where,
        detail: `offers ${contested.join(', ')} as wrong for the ${animal.name}, which sometimes uses it` });
      const item = itemFromChallenge(c as never, { organisms: [], relationships: [] }, i);
      const ask = item?.prompt ?? '';
      if (!item) violations.push({ check: 'schema', where, detail: 'the component drops this build item' });
      else {
        if (!ask.toLowerCase().includes(animal.name)) violations.push({ check: 'schema', where, detail: `the ask does not name the ${animal.name}: ${JSON.stringify(ask)}` });
        const m = ask.match(NEED_WORD);
        if (m) violations.push({ check: 'answer-leak', where, detail: `the ask names a need ("${m[0]}"): ${JSON.stringify(ask)}` });
      }
      const wantsWeather = band !== 'K-2';
      if (needs.includes('weather') !== wantsWeather) violations.push({ check: 'scope', where,
        detail: `${band} ask ${wantsWeather ? 'omits' : 'includes'} the weather need` });
    });
    return { violations, uncheckedTypes: Array.from(unchecked), checkedChallenges: checked };
  },
};
