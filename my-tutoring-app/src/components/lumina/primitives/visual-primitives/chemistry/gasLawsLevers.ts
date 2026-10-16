/**
 * The in-item levers on gas-laws-simulator (`/add-support-tiers`; report qa/eval-reports/gas-laws-simulator-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `gasMiss` observes; the failures behind them come from the catalog's
 * commonStruggles (what is held constant, pressure and volume moving opposite ways, Celsius in a ratio, more gas read
 * as a higher temperature). Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `particle_card` (help; observe): what the change does to the particles, and what pressure, volume and temperature
 *   are in particle terms. It names no direction for the asked quantity.
 * - `held_label` (help; observe, an item whose ask does not name what is held and whose asked quantity is not held):
 *   labels what the container does (the piston slides until..., the steel cannot stretch, the bath keeps...).
 * - `kelvin_scale` (help; predict, calculate, Celsius items): each Celsius temperature with its kelvin value.
 * - `factor_line` (help; predict, calculate): each change as a factor, temperatures in kelvin ("twice as much"). It
 *   names only the changed quantities.
 * - `relation_card` (help; predict, calculate): what stays constant for this container (pressure times volume, ...).
 * - `simpler_numbers` (simplify; predict): the same container, change and question with a factor of 2 or 1/2 in kelvin,
 *   ungraded, then the full item back.
 * - `one_change` (simplify; calculate): the same cylinder and question with only the first change, ungraded, then the
 *   full item back.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  choicesOf, directionOf, fmtNum, GAS_MISSES, heldVars, keyChoice, NAME, numericChoices, showValue, stateAfter,
  type GasChange, type GasItem, type GasLawsMiss,
} from './gasLawsWorkspace';

export const PARTICLE_LEVER = 'particle_card';
export const HELD_LEVER = 'held_label';
export const KELVIN_LEVER = 'kelvin_scale';
export const FACTOR_LEVER = 'factor_line';
export const RELATION_LEVER = 'relation_card';
export const SIMPLER_LEVER = 'simpler_numbers';
export const ONE_CHANGE_LEVER = 'one_change';

const DEFINITIONS = 'Pressure is how hard and how often the particles hit the walls. Volume is the room they have. '
  + 'Temperature is how fast they move.';

/** particle_card: the change in particle terms, then the three definitions. */
export function particleLines(item: GasItem): string[] {
  const c = item.changes[0], up = c.to > item.before[c.v];
  const line = c.v === 'T'
    ? (up ? 'Heating makes the particles move faster, so each one hits the walls harder and more often than before.'
      : 'Cooling slows the particles down, so each one hits the walls more softly and less often than before.')
    : c.v === 'n'
      ? (up ? 'Pumping gas in puts more particles in the container; each one still moves as fast as before.'
        : 'Letting gas out leaves fewer particles in the container; each one still moves as fast as before.')
      : (up ? 'Pulling the plunger out gives the particles more room, so they reach the walls less often.'
        : 'Pushing the plunger in gives the particles less room, so they reach the walls more often.');
  return [line, DEFINITIONS];
}

/** held_label: what the container does, for the quantity it holds. */
export function heldLines(item: GasItem): string[] {
  const held = heldVars(item), out: string[] = [];
  if (held.includes('P') && item.apparatus === 'piston') out.push('The piston slides freely: it moves until the gas pushes up on it exactly as hard as the weight pushes down.');
  if (held.includes('V')) out.push('The steel walls cannot stretch or shrink.');
  if (held.includes('T') && item.apparatus === 'syringe') out.push('The large water bath keeps the syringe at the bath\'s temperature.');
  if (held.includes('T') && item.apparatus !== 'syringe') out.push('The container stays at the room\'s temperature.');
  if (held.includes('n')) out.push('It is sealed: no gas gets in or out.');
  return out;
}

/** The leak rule for particle_card and held_label: no direction stated for the asked quantity. */
export function directionLeak(line: string, item: GasItem): boolean {
  const name = NAME[item.asked];
  const dir = /\b(goes up|goes down|rises|falls|increases?|decreases?|stays the same|does not change|higher|lower|bigger|smaller|unchanged)\b/i;
  return line.toLowerCase().split(/[.:;]/).some(s => s.includes(name) && dir.test(s));
}

/** kelvin_scale: each Celsius temperature with its kelvin value. */
export function kelvinLines(item: GasItem): string[] {
  const temps = [item.before.T, ...item.changes.filter(c => c.v === 'T').map(c => c.to)];
  return [...temps.map(k => `${showValue(item, 'T', k)} = ${fmtNum(k)} K`), 'Kelvin = degrees Celsius + 273.'];
}

const RATIO_WORD = (r: number) => {
  for (const [v, s] of [[2, 'twice as much'], [3, '3 times as much'], [1.5, '1.5 times as much'], [0.5, 'half as much'],
    [1 / 3, 'a third as much'], [2 / 3, 'two thirds as much'], [4 / 3, '4/3 as much'], [0.75, 'three quarters as much']] as const) {
    if (Math.abs(r - v) < 1e-9) return s;
  }
  return `${fmtNum(r)} times as much`;
};

/** factor_line: each change as a factor, temperatures in kelvin. Names only the changed quantities. */
export function factorLines(item: GasItem): string[] {
  return item.changes.map((c: GasChange) => {
    const from = item.before[c.v];
    const show = (x: number) => (c.v === 'T' ? `${fmtNum(x)} K` : showValue(item, c.v, x));
    return c.v === 'n' ? `Amount of gas: ${RATIO_WORD(c.to / from)} as before.`
      : `${NAME[c.v].charAt(0).toUpperCase()}${NAME[c.v].slice(1)}: ${show(from)} to ${show(c.to)}, ${RATIO_WORD(c.to / from)}.`;
  });
}

/** relation_card: what stays constant here, in words, with no numbers. */
export function relationLines(item: GasItem): string[] {
  const c = item.changes[0].v;
  if (item.apparatus === 'cylinder') return ['With the amount of gas held, pressure times volume divided by temperature (in kelvin) stays the same.'];
  if (item.apparatus === 'syringe') return ['With the temperature and the amount of gas held, pressure times volume stays the same.'];
  const free = item.apparatus === 'tank' ? 'pressure' : 'volume';
  const held = item.apparatus === 'tank' ? 'the volume' : 'the pressure';
  return c === 'T' ? [`With ${held} and the amount of gas held, ${free} divided by temperature (in kelvin) stays the same.`]
    : [`With ${held} and the temperature held, ${free} divided by the amount of gas stays the same.`];
}

/** The leak rule for the ask, factor_line and relation_card: never the asked quantity's value after the change. */
export function valueLeak(line: string, item: GasItem): boolean {
  if (item.mode === 'observe') return false;
  // A whole value, not the tail of another number ("2 L" inside "12 L").
  const at = (v: string) => line.split(v).slice(0, -1).some(before => !/[\d.]$/.test(before));
  return at(keyChoice(item)) || at(showValue(item, item.asked, stateAfter(item)[item.asked]));
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<GasItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

const sameItem = (a: GasItem, b: GasItem) => JSON.stringify({ ...a, id: '' }) === JSON.stringify({ ...b, id: '' });

/** An item at the easy shape already: whole factor of 2 or 1/2, kelvin, held named. */
const alreadySimple = (item: GasItem) => !item.celsius && item.heldNamed && item.changes.length === 1
  && [2, 0.5].some(f => Math.abs(item.changes[0].to / item.before[item.changes[0].v] - f) < 1e-9);

/**
 * The simpler item. predict: the same container, change and question, factor 2 (or 1/2, the same way), kelvin, held
 * named. calculate: only the first change (else the second, when the first alone gives the full key). Null when the
 * item is already that simple, or no such item has three distinct choices.
 */
export function simplerItem(item: GasItem): GasItem | null {
  if (isPractice(item) || item.mode === 'observe') return null;
  const id = `${item.id}${PRACTICE}`;
  if (item.mode === 'predict') {
    if (alreadySimple(item)) return null;
    const c = item.changes[0], up = c.to > item.before[c.v], f = up ? 2 : 0.5;
    const before = { ...item.before, ...(c.v === 'T' && !up ? { T: 600 } : {}), ...(c.v === 'T' && up ? { T: 300 } : {}) };
    const to = c.v === 'n' ? f : Math.round(before[c.v] * f * 100) / 100;
    const practice: GasItem = { ...item, id, before, celsius: false, heldNamed: true, changes: [{ v: c.v, to }] };
    return numericChoices(practice) && !sameItem(practice, item) && keyChoice(practice) !== keyChoice(item) ? practice : null;
  }
  for (const change of item.changes) {
    const practice: GasItem = { ...item, id, changes: [change], free: item.asked };
    if (!numericChoices(practice) || keyChoice(practice) === keyChoice(item)) continue;
    return practice;
  }
  return null;
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly GasLawsMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });

/** The levers on the current session item. A practice item has none. */
export function gasLevers(item: GasItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  if (item.mode === 'observe') {
    out.push(lever(PARTICLE_LEVER, 'help', pulled, GAS_MISSES.observe,
      'The learner cannot connect the change to what the particles do, or mixes up which way the quantity moves.',
      'Shows a card beside the container: what the change does to the particles, and what pressure, volume and temperature are in particle terms. It names no direction for the asked quantity.'));
    if (!item.heldNamed && !heldVars(item).includes(item.asked)) {
      out.push(lever(HELD_LEVER, 'help', pulled, GAS_MISSES.observe,
        'The learner does not see what the container keeps the same.',
        'Labels the container with what it does (the piston slides freely, the steel cannot stretch, the water bath, sealed). It says nothing about the asked quantity.'));
    }
    return out;
  }
  const misses = GAS_MISSES[item.mode];
  if (item.celsius) {
    out.push(lever(KELVIN_LEVER, 'help', pulled, ['celsius_ratio'],
      'The learner divides degrees Celsius, or does not convert to kelvin.',
      'Writes each Celsius temperature with its kelvin value beside the table. It computes nothing else.'));
  }
  out.push(lever(RELATION_LEVER, 'help', pulled, misses.filter(m => m !== 'celsius_ratio'),
    'The learner applies a change the wrong way round, or does not know what stays constant for this container.',
    'Shows what stays constant for this container in words (for example "pressure times volume stays the same"), with no numbers.'));
  out.push(lever(FACTOR_LEVER, 'help', pulled, misses,
    'The learner cannot see how big the change is, or keeps the old value.',
    'Writes each change as a factor under the table, temperatures in kelvin (for example "twice as much"). It names only the changed quantities.'));
  const simpler = simplerItem(item);
  if (simpler) {
    out.push(item.mode === 'predict'
      ? lever(SIMPLER_LEVER, 'simplify', pulled, misses, 'The learner cannot work with these numbers.',
        'Opens the same container and question first with the change doubled or halved, in kelvin. It is not graded; this item comes back after it.')
      : lever(ONE_CHANGE_LEVER, 'simplify', pulled, misses, 'The learner cannot handle two changes at once.',
        `Opens the same cylinder and question first with only the ${NAME[item.changes[0].v]} change (the ${NAME[item.changes[1].v]} stays as it was). It is not graded; this item comes back after it.`));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(item: GasItem | undefined, pulled: readonly string[]): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (pulled.includes(PARTICLE_LEVER)) parts.push(`Beside the container, a particle card: ${particleLines(item).join(' ')}`);
  if (pulled.includes(HELD_LEVER)) parts.push(`On the container, a label: ${heldLines(item).join(' ')}`);
  if (pulled.includes(KELVIN_LEVER)) parts.push(`Beside the table: ${kelvinLines(item).join('; ')}`);
  if (pulled.includes(RELATION_LEVER)) parts.push(`A relation card: ${relationLines(item).join(' ')}`);
  if (pulled.includes(FACTOR_LEVER)) parts.push(`Under the table: ${factorLines(item).join(' ')}`);
  return parts.join(' ');
}

/** For tests: every miss this item's choices can show. */
export const possibleMisses = (item: GasItem): GasLawsMiss[] =>
  item.mode === 'observe' ? (directionOf(item) === 'Stays the same' ? ['missed_unchanged'] : ['opposite_direction', 'said_unchanged'])
    : (numericChoices(item) ?? []).filter(c => c.kind !== 'key').map(c => c.kind as GasLawsMiss);
