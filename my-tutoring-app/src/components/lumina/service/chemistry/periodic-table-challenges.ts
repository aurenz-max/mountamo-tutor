/**
 * periodic-table-challenges — the judged-session DRAW for periodic-table.
 *
 * Deliberately NOT a Gemini generator (no `gemini-` prefix): all 118 elements
 * live in code with name, symbol, group, period and shells, so an LLM in this
 * path could only add hallucination risk to facts we already hold. The draw
 * picks WHICH elements; every answer key is computed by the script module's
 * build gates (`periodicTableScript.itemFromChallenge`), which re-validate
 * every challenge emitted here — both sides of the wire import the same pools
 * from ONE address, the letter-spotter rule.
 *
 * Session invariant, generator-side half: an element appears in at most ONE
 * challenge per session (the script's `itemsFromChallenges` enforces the same
 * rule on whatever actually arrives, covering cached or hand-authored
 * payloads).
 */

import {
  CONFUSABLE_NAME_PAIRS,
  FAMILIAR_ELEMENT_NUMBERS,
  REACTIVITY_COMPARE_GROUPS,
  SIZE_COMPARE_GROUPS,
  elementFactsOf,
  type PeriodicChallengeType,
} from '../../primitives/chemistry-primitives/periodicTableScript';
import type { PeriodicTableChallenge } from '../../types';

const SESSION_LENGTH = 6;

const shuffle = <T,>(values: readonly T[]): T[] => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const isConfusable = (aName: string, bName: string): boolean => {
  const a = aName.toLowerCase();
  const b = bName.toLowerCase();
  return CONFUSABLE_NAME_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
};

/** Familiar elements, optionally scoped to a lesson's focus category when the
 *  category holds enough of them to fill a session. */
const familiarPool = (focusCategory?: string): number[] => {
  const all = FAMILIAR_ELEMENT_NUMBERS
    .map(elementFactsOf)
    .filter((e): e is NonNullable<typeof e> => e != null);
  if (focusCategory) {
    const scoped = all.filter((e) => e.category === focusCategory);
    if (scoped.length >= 3) return scoped.map((e) => e.number);
  }
  return all.map((e) => e.number);
};

/** Valence candidates: main-group familiar elements whose tall-column count
 *  agrees with their actual outer shell (the script gate re-checks; drawing
 *  only passing candidates keeps the drop rate at zero). */
const valencePool = (focusCategory?: string): number[] =>
  familiarPool(focusCategory).filter((n) => {
    const e = elementFactsOf(n);
    if (!e || e.group == null) return false;
    if (e.group > 2 && e.group < 13) return false;
    const taught = e.group <= 2 ? e.group : e.group - 10;
    return taught === e.outerElectrons && taught >= 1 && taught <= 8;
  });

const FIND_BYS = ['name', 'number', 'position', 'symbol'] as const;
const CLUE_BYS = ['position', 'number', 'symbol'] as const;

export interface PeriodicChallengeOptions {
  focusCategory?: string;
  count?: number;
}

/**
 * Build one judged session's challenges across the requested eval modes
 * (round-robin when more than one). Every challenge is re-validated by the
 * script module's gates before it becomes an item, so this builder aims for a
 * zero drop rate rather than relying on one.
 */
export const buildPeriodicChallenges = (
  types: PeriodicChallengeType[],
  opts: PeriodicChallengeOptions = {},
): PeriodicTableChallenge[] => {
  const count = opts.count ?? SESSION_LENGTH;
  const used = new Set<number>();
  const challenges: PeriodicTableChallenge[] = [];

  const claim = (n: number): boolean => {
    if (used.has(n)) return false;
    used.add(n);
    return true;
  };

  const drawFrom = (pool: number[], positional: boolean): number | null => {
    for (const n of shuffle(pool)) {
      if (used.has(n)) continue;
      const e = elementFactsOf(n);
      if (!e) continue;
      if (positional && e.group == null) continue;
      claim(n);
      return n;
    }
    return null;
  };

  const pool = familiarPool(opts.focusCategory);
  const valences = valencePool(opts.focusCategory);
  let findByIdx = 0;
  let clueByIdx = 0;
  /** trend rotation: size → valence → reactivity → … */
  let trendIdx = 0;

  const drawComparePair = (
    groupsMap: Readonly<Record<number, readonly number[]>>,
  ): [number, number] | null => {
    for (const group of shuffle(Object.keys(groupsMap).map(Number))) {
      const members = groupsMap[group].filter((n) => !used.has(n));
      if (members.length < 2) continue;
      for (const a of shuffle(members)) {
        for (const b of shuffle(members)) {
          if (a === b) continue;
          const ea = elementFactsOf(a);
          const eb = elementFactsOf(b);
          if (!ea || !eb || ea.period === eb.period) continue;
          if (isConfusable(ea.name, eb.name)) continue;
          claim(a);
          claim(b);
          return [a, b];
        }
      }
    }
    return null;
  };

  let index = 0;
  let attempts = 0;
  while (challenges.length < count && attempts < count * 4) {
    attempts += 1;
    const type = types[index % types.length];
    index += 1;
    const id = `pt-${challenges.length + 1}-${type}`;

    if (type === 'explore') {
      const findBy = FIND_BYS[findByIdx % FIND_BYS.length];
      findByIdx += 1;
      const target = drawFrom(pool, findBy === 'position');
      if (target == null) continue;
      challenges.push({ id, challengeType: 'explore', findBy, targetNumber: target });
      continue;
    }

    if (type === 'identify') {
      const clueBy = CLUE_BYS[clueByIdx % CLUE_BYS.length];
      clueByIdx += 1;
      const target = drawFrom(pool, clueBy === 'position');
      if (target == null) continue;
      challenges.push({ id, challengeType: 'identify', clueBy, targetNumber: target });
      continue;
    }

    // trend — rotate size / valence / reactivity so a single-mode session
    // still varies its task identity within the mode.
    const trendKind = trendIdx % 3;
    trendIdx += 1;
    if (trendKind === 1) {
      const target = drawFrom(valences, true);
      if (target == null) continue;
      challenges.push({ id, challengeType: 'trend', targetNumber: target });
      continue;
    }
    const axis = trendKind === 0 ? 'size' : 'reactivity';
    const pair = drawComparePair(axis === 'size' ? SIZE_COMPARE_GROUPS : REACTIVITY_COMPARE_GROUPS);
    if (!pair) continue;
    challenges.push({ id, challengeType: 'trend', axis, pairNumbers: [pair[0], pair[1]] });
  }

  return challenges;
};
