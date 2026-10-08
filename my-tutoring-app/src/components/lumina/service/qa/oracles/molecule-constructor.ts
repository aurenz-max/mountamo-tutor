import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';
import {
  askParts, askText, buildOf, formulaOf, makesMolecule, simplerAskFor, VALENCE,
  type BondOrder, type MoleculeAsk, type MoleculeSpec,
} from '../../../primitives/visual-primitives/chemistry/moleculeBuild';

/**
 * Molecule-constructor oracle, `make_molecule` (the open build). The board judges a molecule with `moleculeMiss`: one
 * piece, every atom's bonds equal to its valence, and every asked property. The generator picks each ask from a menu
 * that carries its own proof molecules; this oracle does NOT trust them. It builds random molecules itself (a random
 * skeleton of the palette's atoms with random bond orders, the rest filled with hydrogen) and requires two different
 * passing molecules for the ask and for its smaller practice ask: an ask only one molecule meets is a closed answer.
 *
 * Checks (make_molecule only):
 *  - schema         : the ask has a property, known elements, whole numbers in range; the palette offers its atoms.
 *  - answer-key     : two different passing molecules found from the palette, for the ask and for its practice ask.
 *  - task-statement : the instruction states every asked property (it is the task, not a leak).
 *  - answer-leak    : no molecule name or formula in the item's text; no target formula, name or atoms on the item.
 *  - clustering     : no two items in a session ask the same thing.
 * Other challenge types are reported as unchecked.
 */

const MOLECULE_NAME = /\b(water|methane|ethane|ethene|ethylene|ethyne|acetylene|propane|propene|ammonia|ethanol|methanol|formaldehyde|carbon dioxide|ozone|cyanide|O2|CO2|H2O|CH4|C2H4|C2H2|N2|HCN)\b/i;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/** One random molecule: 1-4 skeleton atoms joined in a random tree with random bond orders, hydrogens on what is left. */
function randomMolecule(palette: readonly string[], rand: () => number): MoleculeSpec | null {
  const heavy = palette.filter(e => (VALENCE[e] ?? 1) > 1);
  const halogen = palette.filter(e => e !== 'H' && (VALENCE[e] ?? 1) === 1);
  if (!heavy.length) return null;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const n = 1 + Math.floor(rand() * 4);
  const atoms: string[] = [pick(heavy)];
  const free: number[] = [VALENCE[atoms[0]]];
  const bonds: Array<[number, number, BondOrder]> = [];
  for (let i = 1; i < n; i++) {
    const e = pick(heavy), open = free.map((f, k) => (f > 0 ? k : -1)).filter(k => k >= 0);
    if (!open.length) break;
    const to = pick(open);
    const max = Math.min(3, free[to], VALENCE[e]);
    const order = (1 + Math.floor(rand() * max)) as BondOrder;
    atoms.push(e); free.push(VALENCE[e] - order); free[to] -= order;
    bonds.push([to, atoms.length - 1, order]);
  }
  // A ring-free skeleton; whatever bonds are left go to hydrogen, or now and then a halogen.
  free.forEach((f, k) => {
    for (let j = 0; j < f; j++) {
      atoms.push(halogen.length && rand() < 0.15 ? pick(halogen) : 'H');
      bonds.push([k, atoms.length - 1, 1]);
    }
  });
  return atoms.length <= 15 ? { atoms, bonds } : null;
}

const shapeKey = (s: MoleculeSpec) => `${formulaOf(s.atoms)}|${s.bonds.map(b => b[2]).sort().join('')}`;

/** Different passing molecules found from the palette, up to two. */
export function searchMolecules(ask: MoleculeAsk, palette: readonly string[], tries = 40000, seed = 11): number {
  const rand = rng(seed), found = new Set<string>();
  for (let t = 0; t < tries && found.size < 2; t++) {
    const s = randomMolecule(palette, rand);
    if (s && makesMolecule(ask, buildOf(s))) found.add(shapeKey(s));
  }
  return found.size;
}

function readAsk(a: unknown): MoleculeAsk | null {
  if (!a || typeof a !== 'object') return null;
  const t = a as Record<string, unknown>;
  const whole = (v: unknown, lo: number, hi: number) => v === undefined || (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi);
  if (!whole(t.doubleBonds, 1, 3) || !whole(t.carbons, 1, 4) || !whole(t.maxAtoms, 2, 15)) return null;
  if (t.tripleBond !== undefined && t.tripleBond !== true) return null;
  if (t.contains !== undefined && (typeof t.contains !== 'string' || !(t.contains in VALENCE))) return null;
  const ask = t as MoleculeAsk;
  return askParts(ask).length ? ask : null;
}

export const moleculeConstructorOracle: ContentOracle = {
  componentId: 'molecule-constructor',
  modes: ['make_molecule'],
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    const challenges = asRecordArray(data.challenges);
    const palette = ((data.palette as { availableElements?: unknown } | undefined)?.availableElements ?? []) as string[];
    const unchecked = new Set<string>();
    const seen = new Set<string>();
    let checked = 0;
    for (const field of ['title', 'description']) {
      const m = String(data[field] ?? '').match(MOLECULE_NAME);
      if (m && challenges.some(c => c.type === 'make_molecule')) violations.push({ check: 'answer-leak', where: field, detail: `names a molecule ("${m[0]}")` });
    }
    challenges.forEach((c, i) => {
      const where = `challenge[${i}] ${c.id ?? ''}`.trim();
      if (c.type !== 'make_molecule') { unchecked.add(String(c.type)); return; }
      checked++;
      const ask = readAsk(c.ask);
      if (!ask) { violations.push({ check: 'schema', where, detail: `unreadable ask: ${JSON.stringify(c.ask)}` }); return; }
      const needs = [ask.carbons ? 'C' : null, ask.contains ?? null].filter((e): e is string => !!e);
      const missing = needs.filter(e => !palette.includes(e));
      if (missing.length) violations.push({ check: 'schema', where, detail: `the palette lacks ${missing.join(', ')}` });
      const key = askText(ask);
      if (seen.has(key)) violations.push({ check: 'clustering', where, detail: `ask repeated in the session: ${key}` });
      seen.add(key);
      const found = searchMolecules(ask, palette);
      if (found < 2) violations.push({ check: 'answer-key-desync', where,
        detail: found ? `only one molecule passes "${key}": a closed answer, not an open build` : `no molecule from the palette passes "${key}"` });
      const simpler = simplerAskFor(ask);
      if (simpler) {
        const easier = searchMolecules(simpler, palette, 40000, 23);
        if (easier < 2) violations.push({ check: 'answer-key-desync', where, detail: `the practice ask "${askText(simpler)}" has ${easier} passing molecule(s)` });
      }
      const text = String(c.instruction ?? '');
      const states: Array<[boolean, RegExp, string]> = [
        [!!ask.doubleBonds, /double bond/i, 'a double bond'],
        [!!ask.tripleBond, /triple bond/i, 'a triple bond'],
        [ask.carbons !== undefined, new RegExp(`\\b${ask.carbons} carbon`, 'i'), `${ask.carbons} carbon atoms`],
        [!!ask.contains, /(hydrogen|carbon|nitrogen|oxygen|sulfur|chlorine|fluorine|phosphorus) atom/i, 'the asked atom'],
        [ask.maxAtoms !== undefined, /no more than \d+ atoms/i, 'the atom limit'],
      ];
      for (const [asked, re, what] of states) {
        if (asked && !re.test(text)) violations.push({ check: 'schema', where, detail: `instruction does not state ${what}: ${JSON.stringify(text)}` });
      }
      for (const field of ['instruction', 'hint', 'narration']) {
        const m = String(c[field] ?? '').match(MOLECULE_NAME);
        if (m) violations.push({ check: 'answer-leak', where, detail: `${field} names a molecule ("${m[0]}")` });
      }
      if (c.targetFormula || c.targetName || (Array.isArray(c.targetAtoms) && c.targetAtoms.length)) {
        violations.push({ check: 'answer-leak', where, detail: 'the item carries a target molecule' });
      }
    });
    return { violations, uncheckedTypes: Array.from(unchecked), checkedChallenges: checked };
  },
};
