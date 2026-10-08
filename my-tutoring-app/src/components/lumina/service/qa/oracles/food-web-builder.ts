import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, containsWord } from './helpers';

/**
 * Food-web-builder oracle. The component judges every arrow against the lesson's feeding relations
 * (`correctConnections`, food → eater), so the relations ARE the answer key, and on `build_chain` the targets
 * (length, end) must be makeable from them. This oracle re-derives the chains with its own walk, never the
 * generator's `feedingChains`, so a shared wrong assumption cannot certify itself.
 *
 * Checks:
 * - answer-key-desync: a relation names an organism that is not in the web, points at itself, makes something eat a
 *   producer, or makes a decomposer feed a living consumer (an arrow the learner can never draw right, or one that
 *   marks a true chain wrong); on build_chain, a target no chain of the stated length from a producer reaches, an end
 *   that is a producer or decomposer, or an ask that does not state its length and end.
 * - answer-leak: a build_chain ask names a living thing other than its end (it would hand over a link).
 * - clustering: build_chain targets repeat; fewer than 3 items (mastery-over-demo).
 * - variety (advisory as clustering): a target only one chain reaches is allowed, but every target being single-path
 *   means "many chains pass" is not true for the session.
 *
 * Not checked: whether the relations are ecologically complete (a real relation the model left out marks a right
 * chain wrong). That needs a judge, not a walk; /eval-test reads it.
 */

const KNOWN_TYPES = new Set(['complete_web', 'build_chain']);
const NUMBER_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };

interface Org { id: string; name: string; level: string }

/** Producer-rooted simple paths, counted per (end, length). Written here, independent of the primitive's walk. */
function chainCounts(orgs: Org[], arrows: Array<[string, string]>, maxLength: number): Map<string, number> {
  const counts = new Map<string, number>();
  const next = (id: string) => arrows.filter(([from]) => from === id).map(([, to]) => to);
  const stack: string[][] = orgs.filter(o => o.level === 'producer').map(o => [o.id]);
  while (stack.length) {
    const path = stack.pop()!;
    if (path.length >= 2) {
      const k = `${path[path.length - 1]}|${path.length}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (path.length < maxLength) for (const n of next(path[path.length - 1])) if (!path.includes(n)) stack.push([...path, n]);
  }
  return counts;
}

export const foodWebBuilderOracle: ContentOracle = {
  componentId: 'food-web-builder',
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    const orgs: Org[] = asRecordArray(data.organisms).map(o => ({ id: String(o.id), name: String(o.name ?? ''), level: String(o.trophicLevel ?? '') }));
    const level = new Map(orgs.map(o => [o.id, o.level]));
    const arrows: Array<[string, string]> = [];
    asRecordArray(data.correctConnections).forEach((c, i) => {
      const from = String(c.fromId), to = String(c.toId), where = `correctConnections[${i}] ${from}→${to}`;
      if (!level.has(from) || !level.has(to)) { violations.push({ check: 'answer-key-desync', where, detail: 'names an organism that is not in the web' }); return; }
      if (from === to) { violations.push({ check: 'answer-key-desync', where, detail: 'an organism eats itself' }); return; }
      if (level.get(to) === 'producer') violations.push({ check: 'answer-key-desync', where, detail: 'something eats into a producer (arrow points at a plant)' });
      if (level.get(from) === 'decomposer' && level.get(to) !== 'decomposer') violations.push({ check: 'answer-key-desync', where, detail: 'a decomposer is the food of a consumer' });
      arrows.push([from, to]);
    });
    if (!arrows.length) violations.push({ check: 'schema', where: 'correctConnections', detail: 'no feeding relations' });

    const type = String(data.challengeType ?? 'complete_web');
    if (!KNOWN_TYPES.has(type)) return { violations, uncheckedTypes: [type], checkedChallenges: 0 };
    if (type === 'complete_web') return { violations, uncheckedTypes: [], checkedChallenges: 1 };

    // build_chain: the component judges against the cleaned relations, so walk only those.
    const clean = arrows.filter(([from, to]) => level.get(to) !== 'producer' && !(level.get(from) === 'decomposer' && level.get(to) !== 'decomposer'));
    const counts = chainCounts(orgs, clean, 6);
    const items = asRecordArray(data.challenges);
    if (items.length < 3) violations.push({ check: 'clustering', where: 'challenges', detail: `only ${items.length} chain(s) — mastery-over-demo requires 3+` });
    const seen = new Set<string>();
    let checked = 0, multi = 0;
    items.forEach((c, i) => {
      const where = String(c.id ?? `#${i + 1}`), length = Number(c.length), end = String(c.endId), ask = String(c.instruction ?? '');
      if (c.type !== 'build_chain' || !Number.isInteger(length) || length < 2) {
        violations.push({ check: 'schema', where, detail: `not a build_chain target: ${JSON.stringify(c)}` });
        return;
      }
      checked++;
      const endOrg = orgs.find(o => o.id === end);
      if (!endOrg) { violations.push({ check: 'answer-key-desync', where, detail: `end ${end} is not in the web` }); return; }
      if (endOrg.level === 'producer' || endOrg.level === 'decomposer') violations.push({ check: 'answer-key-desync', where, detail: `ends at a ${endOrg.level}` });
      const ways = counts.get(`${end}|${length}`) ?? 0;
      if (!ways) violations.push({ check: 'answer-key-desync', where, detail: `no chain of ${length} from a producer ends at ${endOrg.name}` });
      if (ways > 1) multi++;
      if (!ask.includes(String(length)) && !containsWord(ask, NUMBER_WORDS[length] ?? '#')) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not state ${length}` });
      if (!containsWord(ask, endOrg.name)) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not name the end ${endOrg.name}` });
      const named = orgs.filter(o => o.id !== end && o.name && containsWord(ask, o.name) && !containsWord(endOrg.name, o.name));
      if (named.length) violations.push({ check: 'answer-leak', where, detail: `the ask names ${named.map(o => o.name).join(', ')}, a link the learner must choose` });
      const k = `${end}|${length}`;
      if (seen.has(k)) violations.push({ check: 'clustering', where, detail: `target ${length} → ${endOrg.name} repeats` });
      seen.add(k);
    });
    if (checked >= 2 && multi === 0) violations.push({ check: 'clustering', where: 'challenges[]', detail: 'every target has exactly one chain: no target lets many builds pass' });
    return { violations, uncheckedTypes: [], checkedChallenges: checked };
  },
};
