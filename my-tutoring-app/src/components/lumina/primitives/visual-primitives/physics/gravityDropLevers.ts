/**
 * The in-item levers on gravity-drop-tower, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/gravity-drop-tower-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `dropMiss` observes; the failures behind them come from the catalog's
 * commonStruggles (heavier falls faster, air and no-air mixed up, height not connected to fall time, h = 1/2 g t^2).
 * Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `slow_replay` (custom; observe): replays the drop at a quarter of the speed with a line joining the objects (or, on
 *   a one-object item, ghost pictures at equal times), so what happened is easier to see. It states nothing.
 * - `moon_card` (clue; predict): a card outside the item: the Apollo 15 hammer and feather dropped on the Moon, where
 *   there is no air. It never names this item's objects.
 * - `air_arrows` (marks; predict and compare items with air): an arrow on each object for how hard air pushes back on
 *   it compared with its weight. It never says which lands first.
 * - `fall_lines` (marks; compare): a bar beside each column from its platform to the ground, with its length.
 * - `same_look` (layout; compare without air, different masses): draws the three as the same grey ball and hides the masses.
 * - `pattern_line` (clue; measure): the measured rows' pattern in words ("4 times the height, 2 times the time").
 * - `formula_card` (clue; calculate): h = 1/2 g t^2 rearranged for the asked quantity, in symbols.
 * - `fill_in` (clue; calculate): the item's numbers placed in that formula, with no result.
 * - `outcome_only` (easier; predict reason items): the same pair and air, asking only which lands first.
 * - `two_drops` (easier; compare): two of the three drops to order.
 * - `one_row` (easier; measure): one measured row and the 4x height (2x time) step.
 * - `time_first` (easier; calculate impact items): the fall time from the same height first.
 * A practice item gets no lever: the component declares none while one is open.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { DROP_MISSES } from './gravityDropTower.card';
import {
  dropChoices, fallTime, FALLERS, fmt, isFloater, keyChoice, keyOrder, measuredTime, nameOf, orderMiss,
  round2, validDropItem, type DropItem, type DropMode, type GravityDropMiss,
} from './gravityDropWorkspace';

export const SLOW_LEVER = 'slow_replay';
export const MOON_LEVER = 'moon_card';
export const AIR_LEVER = 'air_arrows';
export const FALL_LEVER = 'fall_lines';
export const SAME_LOOK_LEVER = 'same_look';
export const PATTERN_LEVER = 'pattern_line';
export const FORMULA_LEVER = 'formula_card';
export const FILL_LEVER = 'fill_in';
export const OUTCOME_LEVER = 'outcome_only';
export const TWO_DROPS_LEVER = 'two_drops';
export const ONE_ROW_LEVER = 'one_row';
export const TIME_FIRST_LEVER = 'time_first';

export const MOON_LINES = [
  'On the Moon there is no air.',
  'In 1971 the astronaut David Scott held up a hammer and a falcon feather there and let go of both at the same moment.',
  // No result line: on a no-air item "they hit the ground at the same moment" is the answer by analogy, and tutors
  // read the card aloud (10-15 replay). The card sets up the case; the learner reasons from it.
  'Is there air in this drop?',
];

/** air_arrows: how hard air pushes back on each object for its weight, in words. */
export function airLines(item: DropItem): string[] {
  return item.drops.map(d => `${FALLERS[d.obj].emoji} ${nameOf(d)}: ${isFloater(d.obj) ? 'a long arrow: air pushes back almost as hard as its weight once it is moving'
    : FALLERS[d.obj].vt < 30 ? 'a short arrow: air pushes back a little for its weight' : 'a tiny arrow: air hardly pushes back for its weight'}.`);
}

/** fall_lines: each column's fall length. */
export const fallLines = (item: DropItem) => item.drops.map(d => `${nameOf(d)}: falls ${d.height} m`);

const TIMES_WORD = (r: number) => {
  for (const [v, s] of [[2, '2 times'], [3, '3 times'], [4, '4 times'], [9, '9 times'], [16, '16 times']] as const) if (Math.abs(r - v) < 0.02) return s;
  return `${fmt(r)} times`;
};
/** pattern_line: from the first measured row to the last, how many times the height and the time. */
export function patternLines(item: DropItem): string[] {
  const rows = item.measured ?? [];
  if (rows.length < 2) return ['Look at how the time grows from one row to the next as the height grows.'];
  const [a, b] = [rows[0], rows[rows.length - 1]];
  return [`From ${a} m to ${b} m the height is ${TIMES_WORD(b / a)} as much, and the time is ${TIMES_WORD(measuredTime(b) / measuredTime(a))} as much.`];
}

/** formula_card: the rule for the asked quantity, symbols only. */
export function formulaLines(item: DropItem): string[] {
  if (item.ask === 'time') return ['h = ½ × g × t²', 'so t = √(2 × h ÷ g)'];
  if (item.ask === 'height') return ['h = ½ × g × t²'];
  return ['h = ½ × g × t², so t = √(2 × h ÷ g)', 'then the speed at the ground is v = g × t'];
}
/** fill_in: the item's own numbers in that formula, never a result. */
export function fillLines(item: DropItem): string[] {
  const h = item.drops[0].height;
  if (item.ask === 'time') return [`t = √(2 × ${h} ÷ 9.8)`];
  if (item.ask === 'height') return [`h = ½ × 9.8 × ${fmt(item.time!)}²`];
  return [`t = √(2 × ${h} ÷ 9.8)`, 'v = 9.8 × t'];
}

/** The leak rule for every lever text: no key, no landing outcome. */
export function leverLeak(line: string, item: DropItem): boolean {
  if (/\b(first|together|lands? before|faster|slower|wins?)\b/i.test(line)) return true;
  if (item.ask === 'order') return false;
  const key = keyChoice(item);
  if (item.mode === 'measure' || item.mode === 'calculate') {
    // The key written as a value: with its unit ("4.04 s"), or as a result ("= 4.04"). A formula constant (the 2 in
    // "2 × h") is not the key even when the key is 2 s.
    const [num, unit] = key.split(' ');
    const n = num.replace('.', '\\.');
    return new RegExp(String.raw`(^|[^\d.])${n} ?${unit.replace('/', '\\/')}(?![a-z])`).test(line)
      || new RegExp(String.raw`=\s*${n}(?![\d.])`).test(line);
  }
  return line.includes(key);
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<DropItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** The simpler item for the item's simplify lever, or null (none, or it would repeat the item or its key). */
export function simplerItem(item: DropItem): DropItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  let practice: DropItem | null = null;
  if (item.mode === 'predict' && item.ask === 'reason') practice = { ...item, id, ask: 'first' };
  else if (item.mode === 'compare') {
    // The two drops whose order is closest in time: the pair the learner most needs to tell apart.
    const k = keyOrder(item), t = (i: number) => fallTime(item.drops[i].obj, item.drops[i].height, item.air);
    const pair = t(k[1]) - t(k[0]) <= t(k[2]) - t(k[1]) ? [k[0], k[1]] : [k[1], k[2]];
    practice = { ...item, id, drops: pair.sort().map(i => item.drops[i]) };
    return practice.drops.length === 2 ? practice : null;
  } else if (item.mode === 'measure') {
    const h0 = item.measured![0];
    practice = item.ask === 'time' ? { ...item, id, measured: [h0], drops: [{ obj: 'rock', height: 4 * h0 }] }
      : { ...item, id, measured: [h0], time: round2(2 * measuredTime(h0)), drops: [{ obj: 'rock', height: 4 * h0 }] };
  } else if (item.mode === 'calculate' && item.ask === 'impact') practice = { ...item, id, ask: 'time' };
  if (!practice || !validDropItem(practice) || !dropChoices(practice)) return null;
  return keyChoice(practice) === keyChoice(item) ? null : practice;
}

// ── The lever set ────────────────────────────────────────────────────────────────────────

const distinctMasses = (item: DropItem) => new Set(item.drops.map(d => FALLERS[d.obj].mass)).size === item.drops.length;
const NOT_GRADED = 'It is not graded; this item comes back after it.';
const simplerSpec = (id: string, mode: DropMode, when: string, does: string) => ({
  id, type: 'easier' as const, modes: [mode], answers: 'all' as const, when, does: `${does} ${NOT_GRADED}`,
  content: (item: DropItem) => simplerItem(item),
});
const AIR_FACT = (_on: unknown, item: DropItem) => `Air arrows on the objects: ${airLines(item).join(' ')}`;

/** The levers read nothing beside the item. */
export type DropLeverContext = Record<string, never>;

export const DROP_LEVERS = leverSet<DropItem, DropLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => DROP_MISSES[mode as DropMode] ?? [],
  // The words a clue card must never carry: this item's key choice.
  answersOf: item => (item.ask === 'order' ? [] : [keyChoice(item)]),
  specs: [
    { id: SLOW_LEVER, type: 'custom', modes: ['observe'], answers: 'all', carrier: 'shown',
      why: 'It replays the drop itself, slowed, with a line or ghost pictures drawn as it falls; no stock type re-runs what the learner watched.',
      when: 'The learner did not see clearly what happened in the drop.',
      does: item => (item.ask === 'speed'
        ? 'Replays the drop at a quarter of the speed and draws a ghost picture of the object at equal moments of its fall. It states nothing.'
        : 'Replays the drop at a quarter of the speed with a line joining the two objects as they fall. It states nothing.'),
      fact: (_on: unknown, item) => (item.ask === 'speed' ? 'The drop replays at a quarter of the speed with ghost pictures at equal moments.'
        : 'The drop replays at a quarter of the speed with a line joining the two objects.') },
    { id: AIR_LEVER, type: 'marks', modes: ['predict'], answers: ['ignored_air', 'slowed_first', 'heavier_reason'],
      when: 'The learner leaves the air out, or thinks weight alone decides.',
      does: 'Draws an arrow on each object for how hard air pushes back on it compared with its weight. It does not say which lands first.',
      offer: item => item.air, fact: AIR_FACT },
    { id: MOON_LEVER, type: 'clue', modes: ['predict'], carrier: 'shown',
      answers: ['heavier_reason', 'heavier_first', 'lighter_first', 'shape_first', 'air_when_none'],
      answersOn: item => (item.air ? ['heavier_reason', 'heavier_first', 'lighter_first'] : ['heavier_first', 'lighter_first', 'shape_first', 'air_when_none']),
      when: 'The learner thinks weight or shape decides how fast things fall with no air.',
      does: 'Shows a card about a different drop: the Apollo 15 hammer and feather on the Moon, where there is no air. It never names this item\'s objects.',
      fact: `A Moon card: ${MOON_LINES.join(' ')}` },
    simplerSpec(OUTCOME_LEVER, 'predict', 'The learner cannot hold the outcome and the reason together.',
      'Opens the same pair and air first, asking only which lands first.'),
    { id: AIR_LEVER, type: 'marks', modes: ['compare'], answers: ['ignored_air', 'ranked_by_mass'],
      when: 'The learner orders by height alone though air is in the tower.',
      does: 'Draws an arrow on each object for how hard air pushes back on it compared with its weight. It does not order them.',
      offer: item => item.air, fact: AIR_FACT },
    { id: SAME_LOOK_LEVER, type: 'layout', modes: ['compare'], answers: ['ranked_by_mass'],
      when: 'The learner orders by weight.',
      does: 'Draws the three as the same grey ball and hides their masses; the heights stay. It does not order them.',
      offer: item => !item.air && distinctMasses(item),
      fact: 'The three objects are drawn as the same grey ball with no masses; the heights stay.' },
    { id: FALL_LEVER, type: 'marks', modes: ['compare'], answers: ['reversed', 'other_order', 'ranked_by_mass', 'ignored_air'],
      when: 'The learner does not connect how far each falls with how long it takes.',
      does: 'Draws a bar beside each column from its platform to the ground, labelled with how far it falls. It does not order them.',
      fact: (_on: unknown, item) => `Bars beside the columns: ${fallLines(item).join('; ')}.` },
    simplerSpec(TWO_DROPS_LEVER, 'compare', 'Three at once is too many to order.', 'Opens two of the three drops first to put in order.'),
    { id: PATTERN_LEVER, type: 'clue', modes: ['measure'], answers: 'all', carrier: 'shown',
      when: 'The learner does not see how the time grows with the height in the table.',
      does: 'Writes under the table how many times the height and how many times the time grew between the measured rows. It names no value for the asked row.',
      fact: (_on: unknown, item) => `Under the table: ${patternLines(item).join(' ')}` },
    simplerSpec(ONE_ROW_LEVER, 'measure', 'The step in the table is too big a jump.',
      'Opens a table with one measured row and asks about 4 times that height (or the height for twice its time) first.'),
    { id: FORMULA_LEVER, type: 'clue', modes: ['calculate'], answers: 'all', carrier: 'shown',
      when: 'The learner does not know which rule to use or how to turn it round.',
      does: 'Shows h = ½ g t² turned round for the asked quantity, in symbols only.',
      fact: (_on: unknown, item) => `A formula card: ${formulaLines(item).join('; ')}.` },
    { id: FILL_LEVER, type: 'clue', modes: ['calculate'], answers: ['forgot_half', 'no_root', 'not_squared', 'gave_time'], carrier: 'shown',
      when: 'The learner has the rule but slips putting the numbers in.',
      does: 'Writes this item\'s numbers into the rule, with no result.',
      fact: (_on: unknown, item) => `Filled in: ${fillLines(item).join('; ')} (no result shown).` },
    simplerSpec(TIME_FIRST_LEVER, 'calculate', 'Two steps at once is too much.', 'Opens the same height first, asking only for the fall time.'),
  ],
});

/** For tests: every miss this item's answers can show. */
export function possibleMisses(item: DropItem): GravityDropMiss[] {
  if (item.ask === 'order') {
    const out = new Set<GravityDropMiss>();
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const p of perms) { const m = orderMiss(item, p); if (m) out.add(m); }
    return Array.from(out);
  }
  return (dropChoices(item) ?? []).filter(c => c.kind !== 'key').map(c => c.kind as GravityDropMiss);
}
