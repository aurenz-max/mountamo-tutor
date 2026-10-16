/**
 * The in-item levers on gravity-drop-tower (`/add-support-tiers`; report qa/eval-reports/gravity-drop-tower-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `dropMiss` observes; the failures behind them come from the catalog's
 * commonStruggles (heavier falls faster, air and no-air mixed up, height not connected to fall time, h = 1/2 g t^2).
 * Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `slow_replay` (help; observe): replays the drop at a quarter of the speed with a line joining the objects (or, on
 *   a one-object item, ghost pictures at equal times), so what happened is easier to see. It states nothing.
 * - `moon_card` (help; predict): a card outside the item: the Apollo 15 hammer and feather dropped on the Moon, where
 *   there is no air. It never names this item's objects.
 * - `air_arrows` (help; predict and compare items with air): an arrow on each object for how hard air pushes back on
 *   it compared with its weight. It never says which lands first.
 * - `fall_lines` (help; compare): a bar beside each column from its platform to the ground, with its length.
 * - `same_look` (help; compare without air, different masses): draws the three as the same grey ball and hides the masses.
 * - `pattern_line` (help; measure): the measured rows' pattern in words ("4 times the height, 2 times the time").
 * - `formula_card` (help; calculate): h = 1/2 g t^2 rearranged for the asked quantity, in symbols.
 * - `fill_in` (help; calculate): the item's numbers placed in that formula, with no result.
 * - `outcome_only` (simplify; predict reason items): the same pair and air, asking only which lands first.
 * - `two_drops` (simplify; compare): two of the three drops to order.
 * - `one_row` (simplify; measure): one measured row and the 4x height (2x time) step.
 * - `time_first` (simplify; calculate impact items): the fall time from the same height first.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  dropChoices, DROP_MISSES, fallTime, FALLERS, fmt, isFloater, keyChoice, keyOrder, measuredTime, nameOf, orderMiss,
  round2, validDropItem, type DropItem, type GravityDropMiss,
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

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly GravityDropMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });

const distinctMasses = (item: DropItem) => new Set(item.drops.map(d => FALLERS[d.obj].mass)).size === item.drops.length;

/** The levers on the current session item. A practice item has none. */
export function dropLevers(item: DropItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  const simpler = simplerItem(item);
  switch (item.mode) {
    case 'observe':
      out.push(lever(SLOW_LEVER, 'help', pulled, DROP_MISSES.observe, 'The learner did not see clearly what happened in the drop.',
        item.ask === 'speed' ? 'Replays the drop at a quarter of the speed and draws a ghost picture of the object at equal moments of its fall. It states nothing.'
          : 'Replays the drop at a quarter of the speed with a line joining the two objects as they fall. It states nothing.'));
      return out;
    case 'predict': {
      if (item.air) {
        out.push(lever(AIR_LEVER, 'help', pulled, ['ignored_air', 'slowed_first', 'heavier_reason'],
          'The learner leaves the air out, or thinks weight alone decides.',
          'Draws an arrow on each object for how hard air pushes back on it compared with its weight. It does not say which lands first.'));
      }
      out.push(lever(MOON_LEVER, 'help', pulled, item.air ? ['heavier_reason', 'heavier_first', 'lighter_first'] : ['heavier_first', 'lighter_first', 'shape_first', 'air_when_none'],
        'The learner thinks weight or shape decides how fast things fall with no air.',
        'Shows a card about a different drop: the Apollo 15 hammer and feather on the Moon, where there is no air. It never names this item\'s objects.'));
      if (simpler) out.push(lever(OUTCOME_LEVER, 'simplify', pulled, DROP_MISSES.predict, 'The learner cannot hold the outcome and the reason together.',
        'Opens the same pair and air first, asking only which lands first. It is not graded; this item comes back after it.'));
      return out;
    }
    case 'compare':
      if (item.air) out.push(lever(AIR_LEVER, 'help', pulled, ['ignored_air', 'ranked_by_mass'], 'The learner orders by height alone though air is in the tower.',
        'Draws an arrow on each object for how hard air pushes back on it compared with its weight. It does not order them.'));
      if (!item.air && distinctMasses(item)) out.push(lever(SAME_LOOK_LEVER, 'help', pulled, ['ranked_by_mass'], 'The learner orders by weight.',
        'Draws the three as the same grey ball and hides their masses; the heights stay. It does not order them.'));
      out.push(lever(FALL_LEVER, 'help', pulled, ['reversed', 'other_order', 'ranked_by_mass', 'ignored_air'], 'The learner does not connect how far each falls with how long it takes.',
        'Draws a bar beside each column from its platform to the ground, labelled with how far it falls. It does not order them.'));
      if (simpler) out.push(lever(TWO_DROPS_LEVER, 'simplify', pulled, DROP_MISSES.compare, 'Three at once is too many to order.',
        'Opens two of the three drops first to put in order. It is not graded; this item comes back after it.'));
      return out;
    case 'measure':
      out.push(lever(PATTERN_LEVER, 'help', pulled, DROP_MISSES.measure, 'The learner does not see how the time grows with the height in the table.',
        'Writes under the table how many times the height and how many times the time grew between the measured rows. It names no value for the asked row.'));
      if (simpler) out.push(lever(ONE_ROW_LEVER, 'simplify', pulled, DROP_MISSES.measure, 'The step in the table is too big a jump.',
        'Opens a table with one measured row and asks about 4 times that height (or the height for twice its time) first. It is not graded; this item comes back after it.'));
      return out;
    case 'calculate':
      out.push(lever(FORMULA_LEVER, 'help', pulled, DROP_MISSES.calculate, 'The learner does not know which rule to use or how to turn it round.',
        'Shows h = ½ g t² turned round for the asked quantity, in symbols only.'));
      out.push(lever(FILL_LEVER, 'help', pulled, ['forgot_half', 'no_root', 'not_squared', 'gave_time'], 'The learner has the rule but slips putting the numbers in.',
        'Writes this item\'s numbers into the rule, with no result.'));
      if (simpler) out.push(lever(TIME_FIRST_LEVER, 'simplify', pulled, DROP_MISSES.calculate, 'Two steps at once is too much.',
        'Opens the same height first, asking only for the fall time. It is not graded; this item comes back after it.'));
      return out;
  }
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(item: DropItem | undefined, pulled: readonly string[]): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (pulled.includes(SLOW_LEVER)) parts.push(item.ask === 'speed' ? 'The drop replays at a quarter of the speed with ghost pictures at equal moments.'
    : 'The drop replays at a quarter of the speed with a line joining the two objects.');
  if (pulled.includes(MOON_LEVER)) parts.push(`A Moon card: ${MOON_LINES.join(' ')}`);
  if (pulled.includes(AIR_LEVER)) parts.push(`Air arrows on the objects: ${airLines(item).join(' ')}`);
  if (pulled.includes(SAME_LOOK_LEVER)) parts.push('The three objects are drawn as the same grey ball with no masses; the heights stay.');
  if (pulled.includes(FALL_LEVER)) parts.push(`Bars beside the columns: ${fallLines(item).join('; ')}.`);
  if (pulled.includes(PATTERN_LEVER)) parts.push(`Under the table: ${patternLines(item).join(' ')}`);
  if (pulled.includes(FORMULA_LEVER)) parts.push(`A formula card: ${formulaLines(item).join('; ')}.`);
  if (pulled.includes(FILL_LEVER)) parts.push(`Filled in: ${fillLines(item).join('; ')} (no result shown).`);
  return parts.join(' ');
}

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
