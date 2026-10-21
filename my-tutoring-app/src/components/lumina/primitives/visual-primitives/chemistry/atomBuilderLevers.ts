/**
 * The in-item levers on atom-builder, as one lever set (`bossLevers.ts`; report
 * qa/eval-reports/atom-builder-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `atomMiss` observes; the failures behind them come from the catalog's
 * documented struggles (electrons before protons, ions with the sign flipped, isotopes, identity from the proton count)
 * and the generator's own items. Every lever starts released; no lever comes from the tier.
 *
 * Classic items (build_element, identify, fill_shells, make_ion, make_isotope, find_on_table):
 * - `table_key` (legend): the mini periodic table writes each element's symbol and its usual mass number in its cell.
 *   Learners do not connect the element named to its atomic number, and the generated items ask for the usual
 *   neutron count without stating it ("discover neon" checks 10 neutrons). The table is the same for every item and
 *   highlights only the learner's own proton count, so it names nothing the item asks for that a periodic table would not.
 * - `mass_meter` (custom, shown): under the tally, "mass number = protons + neutrons" with the learner's own sum. Learners read
 *   "carbon-14" as 14 neutrons. Never the target.
 * - `pair_up` (layout): under the tally, each electron drawn beside a proton; a particle with no partner stands alone,
 *   ringed. Learners flip an ion's sign or forget that a neutral atom has as many electrons as protons. It shows the
 *   learner's own particles; it never says how many to add.
 * - `one_part_first` (easier): an ungraded step first, then the full item. A make_ion item asks for the neutral atom
 *   the ion comes from (electrons = protons); any other item asks for its nucleus only (electrons not checked).
 *
 * make_atom (the open build): the asked property is the task, so nothing reads it off.
 * - `table_key` (legend) as above, for `no_protons` and `nucleus_off`: the usual mass numbers show how many neutrons a
 *   nucleus that holds has.
 * - `pair_up` (layout) for the charge misses (full_shell, valence and charge asks).
 * - `ring_counts` (custom, shown; full_shell and valence asks): each ring of the learner's atom labelled "n of cap". Learners
 *   count every electron instead of the outer ring, or do not know a ring's capacity.
 * - `isotope_compare` (layout, isotopes): the kept atom's and the current atom's protons and neutrons side by side.
 *   Learners change the protons (`different_element`) or nothing in the nucleus (`same_neutrons`).
 * - `simpler_ask` (easier): an ungraded easier ask first ("any neutral atom", or a charge of one where two was
 *   asked), then the full item. Its answers are not the full item's answers.
 * `need_two` has no lever: its words say to press Keep, and the Keep button is on the board.
 * A lever with nothing to draw yet is not offered: `pair_up` before a proton or electron is on the board,
 * `ring_counts` before an electron, `isotope_compare` before an atom is kept.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { AtomBuilderChallenge } from './AtomBuilder';
import { ELEMENTS, USUAL_MASS, atomAskInstruction, atomShells, type AtomAsk, type BuiltAtom } from './atomBuild';
import { openAskOf } from './atomBuilderWorkspace';
import { ATOM_MISSES_BY_MODE, CLASSIC_ATOM_MISSES, type AtomMode } from './atomBuilder.card';

export const TABLE_KEY_LEVER = 'table_key';
export const MASS_METER_LEVER = 'mass_meter';
export const PAIR_UP_LEVER = 'pair_up';
export const RING_COUNTS_LEVER = 'ring_counts';
export const ISOTOPE_COMPARE_LEVER = 'isotope_compare';
export const ONE_PART_FIRST_LEVER = 'one_part_first';
export const SIMPLER_ASK_LEVER = 'simpler_ask';

const FIRST = '~first';
const SIMPLER = '~simpler';
export const isPracticeAtom = (c: Pick<AtomBuilderChallenge, 'id'>) => c.id.endsWith(FIRST) || c.id.endsWith(SIMPLER);
/** The session item a practice item was opened from. */
export const practiceParentId = (id: string) =>
  id.endsWith(FIRST) ? id.slice(0, -FIRST.length) : id.endsWith(SIMPLER) ? id.slice(0, -SIMPLER.length) : null;

// ── The pictures the help levers draw, as pure data ─────────────────────────

/** `table_key`: what each cell of the table shows, for every element on the board. The same for every item. */
export const tableKey = (maxZ: number) => Object.keys(ELEMENTS).map(Number).filter(z => z <= maxZ)
  .map(z => ({ z, symbol: ELEMENTS[z].symbol, mass: USUAL_MASS[z] }));

/** `pair_up`: the learner's protons and electrons in pairs, and what is left over. */
export const pairUp = (a: BuiltAtom) => ({ pairs: Math.min(a.protons, a.electrons),
  lonePositive: Math.max(0, a.protons - a.electrons), loneNegative: Math.max(0, a.electrons - a.protons) });

/**
 * `ring_counts`: each ring of the learner's atom as "n of cap", innermost first (the open build's real shells). The
 * first ring holds 2; an outer ring counts as full at 8 (the rule `outerShellFull` checks); an inner ring past the
 * second shows what it can really hold (18, 32).
 */
const RING_CAPACITY = [2, 8, 18, 32, 32];
export const ringCounts = (electrons: number) => {
  const shells = atomShells(electrons);
  return shells.map((n, i) => `${n} of ${i === 0 ? 2 : i === shells.length - 1 ? 8 : RING_CAPACITY[i]}`);
};

/** `mass_meter`: the learner's own sum. */
export const massLine = (a: BuiltAtom) => `mass number = protons + neutrons = ${a.protons} + ${a.neutrons} = ${a.protons + a.neutrons}`;

// ── Simplify builders ───────────────────────────────────────────────────────

/** `one_part_first`: the neutral atom a make_ion item comes from, or any other item's nucleus alone. */
export function onePartFirst(c: AtomBuilderChallenge): AtomBuilderChallenge | null {
  if (openAskOf(c) || isPracticeAtom(c) || c.targetProtons === null) return null;
  if (c.type === 'make_ion') {
    if (c.targetElectrons === null || c.targetElectrons === c.targetProtons) return null;
    return { ...c, id: `${c.id}${FIRST}`, type: 'build_element', targetElectrons: c.targetProtons, hint: '', narration: '',
      instruction: 'First, build the neutral atom this ion comes from: the same nucleus, and as many electrons as protons.' };
  }
  if (c.targetElectrons === null) return null;
  return { ...c, id: `${c.id}${FIRST}`, type: 'build_element', targetElectrons: null, hint: '', narration: '',
    instruction: 'First, build just the nucleus of this atom: its protons and neutrons. Electrons are not checked this time.' };
}

/** `simpler_ask`: a charge of two becomes a charge of one with the same sign; anything else becomes any neutral atom. */
export function simplerAsk(ask: AtomAsk): AtomAsk | null {
  if (ask.kind === 'neutral') return null;
  if (ask.kind === 'charge' && Math.abs(ask.charge) > 1) return { kind: 'charge', charge: Math.sign(ask.charge) };
  return { kind: 'neutral' };
}

export function simplerAtom(c: AtomBuilderChallenge): AtomBuilderChallenge | null {
  const ask = openAskOf(c);
  if (!ask || isPracticeAtom(c)) return null;
  const easier = simplerAsk(ask);
  if (!easier) return null;
  return { ...c, id: `${c.id}${SIMPLER}`, ask: easier, instruction: atomAskInstruction(easier) };
}

/** The practice item a simplify lever opens on this item. */
export const practiceFor = (c: AtomBuilderChallenge) => (openAskOf(c) ? simplerAtom(c) : onePartFirst(c));

/** A practice item rebuilt from its id and the session's items (the journey row reads it). */
export function practiceById(challenges: readonly AtomBuilderChallenge[], id: string | null | undefined): AtomBuilderChallenge | null {
  const parent = id ? practiceParentId(id) : null;
  const c = parent ? challenges.find(x => x.id === parent) : null;
  return c ? practiceFor(c) : null;
}

// ── The lever set ───────────────────────────────────────────────────────────

/** What the levers read beside the item: the learner's atom on the board, and the kept atom of an isotope pair. */
export interface AtomLeverContext {
  atom: BuiltAtom;
  kept: BuiltAtom | null;
}

/** The card mode an item belongs to: make_atom with an ask is the open build; every classic type sits in any classic
 *  mode (the generator does not pin them), so every classic lever is in all three classic modes. */
const MODE_OF: Record<AtomBuilderChallenge['type'], AtomMode> = {
  build_element: 'build', find_on_table: 'build', identify: 'identify', fill_shells: 'identify',
  make_ion: 'ion_isotope', make_isotope: 'ion_isotope', make_atom: 'build',
};
const CLASSIC: readonly AtomMode[] = ['build', 'identify', 'ion_isotope'];
const MAKE: readonly AtomMode[] = ['make_atom'];
const CHARGE_MISSES = ['not_neutral', 'still_neutral', 'charge_sign', 'charge_size'];
const particles = (ctx?: AtomLeverContext) => (ctx?.atom.protons ?? 0) + (ctx?.atom.electrons ?? 0);

export const ATOM_LEVERS = leverSet<AtomBuilderChallenge, AtomLeverContext>({
  modeOf: c => (openAskOf(c) ? 'make_atom' : MODE_OF[c.type] ?? 'build'),
  missesOf: mode => ATOM_MISSES_BY_MODE[mode as AtomMode] ?? [],
  specs: [
    { id: TABLE_KEY_LEVER, type: 'legend', answers: ['protons_off', 'neutrons_off', 'no_protons', 'nucleus_off'],
      answersOn: c => (openAskOf(c) ? ['no_protons', 'nucleus_off'] : ['protons_off', 'neutrons_off']),
      when: 'The learner does not know how many protons the element has, or how many neutrons its usual atom has.',
      does: 'Writes each element\'s symbol and its usual mass number (protons + neutrons) in its cell of the periodic table. '
        + 'The table is the same for every item and lights only the learner\'s own proton count.',
      fact: 'The periodic table shows each element\'s symbol and usual mass number in its cell.' },
    { id: MASS_METER_LEVER, type: 'custom', carrier: 'shown', modes: CLASSIC, answers: ['neutrons_off'],
      why: 'It writes the learner\'s own mass number as a sum and changes as they add particles; no stock type reads back '
        + 'the learner\'s own work.',
      when: 'The learner mixes up the mass number with the number of neutrons.',
      does: 'Writes under the particle count the learner\'s mass number as a sum: protons + neutrons. It shows the learner\'s own counts, never the target.',
      content: c => (c.targetNeutrons !== null ? true : null),
      fact: 'Under the particle count: the learner\'s mass number written as protons + neutrons.' },
    { id: PAIR_UP_LEVER, type: 'layout', answers: ['electrons_off', ...CHARGE_MISSES],
      answersOn: c => (openAskOf(c) ? CHARGE_MISSES : ['electrons_off']),
      when: 'The learner has the electrons wrong: too many or too few for the protons, or the charge with the wrong sign.',
      does: 'Draws each of the learner\'s electrons beside a proton, under the particle count; a proton or electron with no partner stands alone, ringed. It never says how many to add.',
      content: c => {
        const ask = openAskOf(c);
        return (ask ? ask.kind !== 'isotopes' : c.targetElectrons !== null) ? true : null;
      },
      // Nothing to pair until a proton or an electron is on the board.
      offer: (_c, ctx) => particles(ctx) > 0,
      fact: 'Under the particle count: each electron beside a proton, any particle with no partner ringed.' },
    { id: RING_COUNTS_LEVER, type: 'custom', carrier: 'shown', modes: MAKE, answers: ['shell_not_full', 'valence_off'],
      why: 'It labels each ring of the learner\'s own atom with its count and changes as they add electrons; no stock type '
        + 'reads back the learner\'s own work.',
      when: 'The learner counts every electron instead of the outer ring, or does not know how many a ring holds.',
      does: 'Labels each ring of the learner\'s atom with how many electrons it holds and how many it can hold, as "6 of 8".',
      content: c => {
        const kind = openAskOf(c)?.kind;
        return kind === 'full_shell' || kind === 'valence' ? true : null;
      },
      // No ring to label until there is an electron.
      offer: (_c, ctx) => (ctx?.atom.electrons ?? 0) > 0,
      fact: 'Each ring of the atom is labelled with how many electrons it holds of how many it can hold.' },
    { id: ISOTOPE_COMPARE_LEVER, type: 'layout', modes: MAKE, answers: ['different_element', 'same_neutrons'],
      when: 'The learner changes the protons between the two atoms, or changes nothing in the nucleus.',
      does: 'Shows the kept atom\'s and the current atom\'s protons and neutrons side by side under the board.',
      content: c => (openAskOf(c)?.kind === 'isotopes' ? true : null),
      // Nothing to compare until the learner presses "Keep this atom".
      offer: (_c, ctx) => !!ctx?.kept,
      fact: 'Under the board: the kept atom\'s and the current atom\'s protons and neutrons side by side.' },
    { id: ONE_PART_FIRST_LEVER, type: 'easier', modes: CLASSIC, answers: CLASSIC_ATOM_MISSES,
      when: 'The learner cannot get all three counts right at once.',
      does: c => (c.type === 'make_ion'
        ? 'Opens an ungraded step first: the neutral atom the ion comes from. Then the full item comes back with the board cleared.'
        : 'Opens an ungraded step first: just the nucleus, with the electrons not checked. Then the full item comes back with the board cleared.'),
      content: c => onePartFirst(c) },
    { id: SIMPLER_ASK_LEVER, type: 'easier', modes: MAKE,
      answers: ['no_protons', 'nucleus_off', 'not_neutral', 'shell_not_full', 'valence_off', 'still_neutral', 'charge_sign',
        'charge_size', 'different_element', 'same_neutrons'],
      when: 'The learner cannot make an atom with the asked property yet.',
      does: 'Opens an easier ask first, ungraded: any neutral atom, or a charge of one where two was asked. Then the full item comes back with the board cleared.',
      content: c => simplerAtom(c) },
  ],
});
