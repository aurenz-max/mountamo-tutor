/**
 * Atom Builder `make_atom` as an open build (`/add-eval-modes` references/build-mode.md).
 *
 * Code states a property ("any neutral atom whose outer shell is full", "any ion with a charge of -1", "two isotopes
 * of the same element") and the learner makes an atom with it from an empty board. Many atoms pass: He, Ne, Ar, Kr
 * for a full shell; F-, Cl-, H-, O with nine electrons... for -1; any element at two neutron counts for isotopes.
 * The judge is code, at "I'm done!". Pure, no React, so the generator, the component and vitest share it.
 */

export type AtomAsk =
  | { kind: 'full_shell' }
  | { kind: 'valence'; outer: number }
  | { kind: 'charge'; charge: number }
  | { kind: 'isotopes' };

export interface BuiltAtom { protons: number; neutrons: number; electrons: number }

export type AtomBuildMiss =
  | 'no_protons' | 'nucleus_off' | 'not_neutral' | 'shell_not_full' | 'valence_off'
  | 'still_neutral' | 'charge_sign' | 'charge_size' | 'need_two' | 'different_element' | 'same_neutrons';

export interface AtomBuildVerdict { pass: boolean; miss: AtomBuildMiss | null }

/** The verdict's words. They name what is wrong with the learner's atom and never which particle to add or remove. */
export const ATOM_BUILD_MISS_WORDS: Record<AtomBuildMiss, string> = {
  no_protons: 'Your atom has no protons yet. The protons in the middle decide which element it is.',
  nucleus_off: 'That nucleus would not hold together. Look at how many neutrons it has next to its protons.',
  not_neutral: 'That atom has a charge, so it is not neutral.',
  shell_not_full: 'The outer shell of your atom is not full.',
  valence_off: 'Count the electrons on the outermost ring: that is not the number asked for.',
  still_neutral: 'Your atom has no charge yet.',
  charge_sign: 'Your atom has a charge, but with the wrong sign.',
  charge_size: 'The sign of the charge is right, but not its size.',
  need_two: 'Make one atom and press Keep, then make the second one.',
  different_element: 'Your two atoms are different elements.',
  same_neutrons: 'Your two atoms are exactly alike in the nucleus: they are the same isotope.',
};

/** Subshells in filling order (n, capacity): 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p. */
const AUFBAU: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [2, 2], [2, 6], [3, 2], [3, 6], [4, 2], [3, 10], [4, 6], [5, 2], [4, 10], [5, 6],
];

/**
 * Electrons per shell, innermost first, as a middle-school Bohr model draws them: potassium 2,8,8,1, iron 2,8,14,2,
 * krypton 2,8,18,8. The subshells fill in order and are grouped by shell, with chromium's and copper's known
 * exceptions. (The classic modes draw 2/8/8/18, which gives bromine eighteen outer places; this build judges
 * outer shells, so it uses the real ones.)
 */
export function atomShells(electrons: number): number[] {
  if (electrons === 24) return [2, 8, 13, 1];
  if (electrons === 29) return [2, 8, 18, 1];
  const shells: number[] = [];
  let left = Math.max(0, Math.floor(electrons));
  for (const [n, cap] of AUFBAU) {
    if (left <= 0) break;
    const put = Math.min(left, cap);
    while (shells.length < n) shells.push(0);
    shells[n - 1] += put;
    left -= put;
  }
  return shells;
}

/** Electrons on the outermost ring (0 with none). */
export function outerElectrons(electrons: number): number {
  const shells = atomShells(electrons);
  return shells.length ? shells[shells.length - 1] : 0;
}

/** The outer shell is full: two on the first shell, eight on any shell after it. */
export function outerShellFull(electrons: number): boolean {
  const shells = atomShells(electrons);
  if (!shells.length) return false;
  return shells[shells.length - 1] === (shells.length === 1 ? 2 : 8);
}

/**
 * A nucleus that holds together: hydrogen needs no neutrons (up to two, tritium); every other element has about as
 * many neutrons as protons or a few more (helium-3 to calcium-48 and krypton-86 all sit inside). A tolerance band,
 * not a table of real isotopes: a learner is not asked to know which isotopes exist.
 */
export function nucleusHolds(protons: number, neutrons: number): boolean {
  if (protons <= 0) return false;
  if (protons === 1) return neutrons >= 0 && neutrons <= 2;
  return neutrons >= protons - 1 && neutrons <= Math.floor(1.5 * protons) + 2;
}

/** The check at "I'm done!". `kept` is the first atom of an isotope pair. */
export function judgeAtomBuild(ask: AtomAsk, atom: BuiltAtom, kept?: BuiltAtom | null): AtomBuildVerdict {
  const miss = (m: AtomBuildMiss): AtomBuildVerdict => ({ pass: false, miss: m });
  if (ask.kind === 'isotopes' && !kept) return miss('need_two');
  if (atom.protons <= 0) return miss('no_protons');
  if (!nucleusHolds(atom.protons, atom.neutrons)) return miss('nucleus_off');
  const charge = atom.protons - atom.electrons;
  switch (ask.kind) {
    case 'full_shell':
      if (charge !== 0) return miss('not_neutral');
      if (!outerShellFull(atom.electrons)) return miss('shell_not_full');
      break;
    case 'valence':
      if (charge !== 0) return miss('not_neutral');
      if (outerElectrons(atom.electrons) !== ask.outer) return miss('valence_off');
      break;
    case 'charge':
      if (charge === 0) return miss('still_neutral');
      if (Math.sign(charge) !== Math.sign(ask.charge)) return miss('charge_sign');
      if (charge !== ask.charge) return miss('charge_size');
      break;
    case 'isotopes': {
      const first = kept as BuiltAtom;
      if (first.protons <= 0 || !nucleusHolds(first.protons, first.neutrons)) return miss('nucleus_off');
      if (first.protons !== atom.protons) return miss('different_element');
      if (first.neutrons === atom.neutrons) return miss('same_neutrons');
      break;
    }
  }
  return { pass: true, miss: null };
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** The ask as the learner reads it. It states the property (that is the task); it never names an atom that has it. */
export function atomAskInstruction(ask: AtomAsk): string {
  switch (ask.kind) {
    case 'full_shell': return 'Make any neutral atom whose outer shell is full.';
    case 'valence': return `Make any neutral atom with ${WORDS[ask.outer] ?? ask.outer} electron${ask.outer === 1 ? '' : 's'} in its outer shell.`;
    case 'charge': return `Make any ion with a charge of ${ask.charge > 0 ? '+' : '-'}${Math.abs(ask.charge)}.`;
    case 'isotopes': return 'Make two different isotopes of the same element. Build one atom and press Keep, then build the other.';
  }
}

/** Every atom the board can hold that passes the ask (isotopes: every passing pair). For tests and the probe. */
export function passingBuilds(ask: AtomAsk, maxProtons: number): BuiltAtom[] | Array<[BuiltAtom, BuiltAtom]> {
  const atoms: BuiltAtom[] = [];
  for (let p = 1; p <= maxProtons; p++) for (let n = 0; n <= maxProtons + 10; n++) {
    if (!nucleusHolds(p, n)) continue;
    for (let e = 0; e <= maxProtons + 4; e++) atoms.push({ protons: p, neutrons: n, electrons: e });
  }
  if (ask.kind !== 'isotopes') return atoms.filter(a => judgeAtomBuild(ask, a).pass);
  const pairs: Array<[BuiltAtom, BuiltAtom]> = [];
  const neutral = atoms.filter(a => a.electrons === a.protons);
  for (const a of neutral) for (const b of neutral) if (judgeAtomBuild(ask, b, a).pass) pairs.push([a, b]);
  return pairs;
}

/**
 * The session's asks, distinct, easier first. Grades 3-5 make neutral atoms only (outer electrons, a full shell),
 * as the classic modes keep ions and isotopes for 6-8. `rand` is injectable for tests.
 */
export function buildAtomAsks(gradeBand: '3-5' | '6-8', rand: () => number = Math.random): AtomAsk[] {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length) % xs.length];
  const outers = [1, 2, 3, 4, 5, 6, 7];
  const takeOuter = () => { const k = pick(outers); outers.splice(outers.indexOf(k), 1); return k; };
  if (gradeBand === '3-5') {
    return [{ kind: 'valence', outer: takeOuter() }, { kind: 'full_shell' }, { kind: 'valence', outer: takeOuter() }];
  }
  return [
    { kind: 'valence', outer: takeOuter() },
    { kind: 'full_shell' },
    { kind: 'charge', charge: pick([-1, -2, 1, 2]) },
    { kind: 'isotopes' },
  ];
}
