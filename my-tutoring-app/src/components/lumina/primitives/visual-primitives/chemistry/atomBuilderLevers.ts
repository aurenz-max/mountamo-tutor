/**
 * The in-item levers on atom-builder (`/add-support-tiers`; report qa/eval-reports/atom-builder-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `atomMiss` observes; the failures behind them come from the catalog's
 * documented struggles (electrons before protons, ions with the sign flipped, isotopes, identity from the proton count)
 * and the generator's own items. Every lever starts released; no lever comes from the tier.
 *
 * Classic items (build_element, identify, fill_shells, make_ion, make_isotope, find_on_table):
 * - `table_key` (help): the mini periodic table writes each element's symbol and its usual mass number in its cell.
 *   Learners do not connect the element named to its atomic number, and the generated items ask for the usual
 *   neutron count without stating it ("discover neon" checks 10 neutrons). The table is the same for every item and
 *   highlights only the learner's own proton count, so it names nothing the item asks for that a periodic table would not.
 * - `mass_meter` (help): under the tally, "mass number = protons + neutrons" with the learner's own sum. Learners read
 *   "carbon-14" as 14 neutrons. Never the target.
 * - `pair_up` (help): under the tally, each electron drawn beside a proton; a particle with no partner stands alone,
 *   ringed. Learners flip an ion's sign or forget that a neutral atom has as many electrons as protons. It shows the
 *   learner's own particles; it never says how many to add.
 * - `one_part_first` (simplify): an ungraded step first, then the full item. A make_ion item asks for the neutral atom
 *   the ion comes from (electrons = protons); any other item asks for its nucleus only (electrons not checked).
 *
 * make_atom (the open build): the asked property is the task, so nothing reads it off.
 * - `table_key` (help) as above, for `no_protons` and `nucleus_off`: the usual mass numbers show how many neutrons a
 *   nucleus that holds has.
 * - `pair_up` (help) for the charge misses (full_shell, valence and charge asks).
 * - `ring_counts` (help, full_shell and valence asks): each ring of the learner's atom labelled "n of cap". Learners
 *   count every electron instead of the outer ring, or do not know a ring's capacity.
 * - `isotope_compare` (help, isotopes): the kept atom's and the current atom's protons and neutrons side by side.
 *   Learners change the protons (`different_element`) or nothing in the nucleus (`same_neutrons`).
 * - `simpler_ask` (simplify): an ungraded easier ask first ("any neutral atom", or a charge of one where two was
 *   asked), then the full item. Its answers are not the full item's answers.
 * `need_two` has no lever: its words say to press Keep, and the Keep button is on the board.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { AtomBuilderChallenge } from './AtomBuilder';
import { ELEMENTS, USUAL_MASS, atomAskInstruction, atomShells, type AtomAsk, type BuiltAtom } from './atomBuild';
import { CLASSIC_ATOM_MISSES, openAskOf, type AtomMiss } from './atomBuilderWorkspace';

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

// ── Declarations ────────────────────────────────────────────────────────────

/** The levers on the current session item. A practice item has none. */
export function atomLevers(c: AtomBuilderChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeAtom(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly AtomMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const table = (answers: readonly AtomMiss[]) => lever(TABLE_KEY_LEVER, 'help', answers,
    'The learner does not know how many protons the element has, or how many neutrons its usual atom has.',
    'Writes each element\'s symbol and its usual mass number (protons + neutrons) in its cell of the periodic table. '
    + 'The table is the same for every item and lights only the learner\'s own proton count.');
  const pair = (answers: readonly AtomMiss[]) => lever(PAIR_UP_LEVER, 'help', answers,
    'The learner has the electrons wrong: too many or too few for the protons, or the charge with the wrong sign.',
    'Draws each of the learner\'s electrons beside a proton, under the particle count; a proton or electron with no partner stands alone, ringed. It never says how many to add.');
  const out: WorkspaceLever[] = [];
  const ask = openAskOf(c);
  if (!ask) {
    out.push(table(['protons_off', 'neutrons_off']));
    if (c.targetNeutrons !== null) out.push(lever(MASS_METER_LEVER, 'help', ['neutrons_off'],
      'The learner mixes up the mass number with the number of neutrons.',
      'Writes under the particle count the learner\'s mass number as a sum: protons + neutrons. It shows the learner\'s own counts, never the target.'));
    if (c.targetElectrons !== null) out.push(pair(['electrons_off']));
    if (onePartFirst(c)) out.push(lever(ONE_PART_FIRST_LEVER, 'simplify', CLASSIC_ATOM_MISSES,
      'The learner cannot get all three counts right at once.',
      c.type === 'make_ion'
        ? 'Opens an ungraded step first: the neutral atom the ion comes from. Then the full item comes back with the board cleared.'
        : 'Opens an ungraded step first: just the nucleus, with the electrons not checked. Then the full item comes back with the board cleared.'));
    return out;
  }
  out.push(table(['no_protons', 'nucleus_off']));
  if (ask.kind !== 'isotopes') out.push(pair(['not_neutral', 'still_neutral', 'charge_sign', 'charge_size']));
  if (ask.kind === 'full_shell' || ask.kind === 'valence') out.push(lever(RING_COUNTS_LEVER, 'help', ['shell_not_full', 'valence_off'],
    'The learner counts every electron instead of the outer ring, or does not know how many a ring holds.',
    'Labels each ring of the learner\'s atom with how many electrons it holds and how many it can hold, as "6 of 8".'));
  if (ask.kind === 'isotopes') out.push(lever(ISOTOPE_COMPARE_LEVER, 'help', ['different_element', 'same_neutrons'],
    'The learner changes the protons between the two atoms, or changes nothing in the nucleus.',
    'Shows the kept atom\'s and the current atom\'s protons and neutrons side by side under the board.'));
  if (simplerAtom(c)) out.push(lever(SIMPLER_ASK_LEVER, 'simplify',
    ['no_protons', 'nucleus_off', 'not_neutral', 'shell_not_full', 'valence_off', 'still_neutral', 'charge_sign', 'charge_size',
      'different_element', 'same_neutrons'],
    'The learner cannot make an atom with the asked property yet.',
    'Opens an easier ask first, ungraded: any neutral atom, or a charge of one where two was asked. Then the full item comes back with the board cleared.'));
  return out;
}

/** A pull with nothing to draw yet, refused with what to do instead. Null when the pull can go ahead. */
export function atomRefusal(id: string, atom: BuiltAtom, kept: BuiltAtom | null): string | null {
  if (id === RING_COUNTS_LEVER && atom.electrons === 0) return 'The atom has no electrons yet, so there is no ring to label; ask the learner to add some first.';
  if (id === PAIR_UP_LEVER && atom.protons + atom.electrons === 0) return 'There are no protons or electrons on the board to pair yet.';
  if (id === ISOTOPE_COMPARE_LEVER && !kept) return 'No atom is kept yet; the learner presses "Keep this atom" first.';
  return null;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFacts(pulled: readonly string[]): string {
  const parts: string[] = [];
  if (pulled.includes(TABLE_KEY_LEVER)) parts.push('The periodic table shows each element\'s symbol and usual mass number in its cell.');
  if (pulled.includes(MASS_METER_LEVER)) parts.push('Under the particle count: the learner\'s mass number written as protons + neutrons.');
  if (pulled.includes(PAIR_UP_LEVER)) parts.push('Under the particle count: each electron beside a proton, any particle with no partner ringed.');
  if (pulled.includes(RING_COUNTS_LEVER)) parts.push('Each ring of the atom is labelled with how many electrons it holds of how many it can hold.');
  if (pulled.includes(ISOTOPE_COMPARE_LEVER)) parts.push('Under the board: the kept atom\'s and the current atom\'s protons and neutrons side by side.');
  return parts.join(' ');
}
