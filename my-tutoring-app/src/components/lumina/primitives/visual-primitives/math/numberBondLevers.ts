/**
 * The in-item levers on number-bond (`/add-support-tiers`, handoff 21 M1, slice 1; the equation levers are a
 * later slice). Approved table: qa/support-levers/m1-lever-tables-2026-09-28.md. No real-learner evidence; the
 * misses are what `bondMiss` observes, plus the catalog's documented struggles.
 *
 * - decompose (build): `made_ways` (help) draws the pairs the learner already made as small dot bonds, in the
 *   order made, and marks the one the board shows now. Answers `same_way_again`. Leak rule: only pairs the
 *   learner made, never sorted by part (a sorted row shows the gaps), never a pair not yet found. Offered once a
 *   pair is made.
 * - ten_and_ones (build): `ten_frame_part` (help) lays each part's own counters out in a two-by-five outline.
 *   Answers `ten_one_off`, `no_full_ten`. Leak rule: draws placed counters only; no "N more" and no box filled
 *   for the learner. `smaller_teen` (simplify) opens an ungraded split of eleven first, then the full item.
 *   Answers `no_full_ten`. Leak rule: still a teen with the ten-and-ones accept set, never the learner's whole;
 *   refused at twelve or below (eleven would be as hard, or the item itself).
 * - related_fact (join / separate): `show_move` (help) highlights the move button. Answers `other_move`. The
 *   move is the instruction, not the assessed answer; no count is shown.
 * - missing_part (spoken): `open_counters` (help) opens the counters tray for the learner. The covered part
 *   stays covered; the support is recorded as counters. Answers every spoken miss of the turn (the given part, the
 *   whole, both added, off by one or more): each is a quantity the learner can now act out.
 * - The spoken say turns (decompose and ten_and_ones after the split, related_fact after the move): `ten_frame_part`
 *   (help) lays the counters the learner is asked about out in a two-by-five outline (on related_fact, the whole's
 *   counters, whose groups stay coloured). Answers the turn's spoken misses. Leak rule: only counters already on the
 *   board, rearranged; empty boxes drawn, never filled; no count. The turn's number is on the board by design
 *   (the learner counts it), so the frame changes how it is counted, not what is there.
 * `not_all_placed` cannot be committed on the split path (a split commits only when the parts make the whole),
 * so the catalog lists it as unanswered.
 *
 * Slice 2, the equation modes (approved 2026-09-28; build steps of build_equation and fact_family):
 * - `equation_frame` (help) draws empty slot shapes and an equals sign above the tray: box, circle, box, equals,
 *   box. Answers `unfinished_equation`, `other_numbers`. Leak rule: the same shapes for every form; no tile,
 *   number, `+` or `-` in any slot. Choosing the operator is part of the answer (contract R9, R12). Easy starts
 *   with it drawn (a starting position, never a pull).
 * - `move_strip` (help) draws the move the equation must describe, before and after, as dots in the group
 *   colours. Answers `false_equation`, `other_fact`. Leak rule: dots only; no numeral, no operator, no equals
 *   sign, and only the committed move (the learner's own on build_equation, the named one on fact_family).
 * - `smaller_bond` (simplify) opens one ungraded equation step on a bond with a whole of five or less and the
 *   same move, then the full item. Answers `false_equation`, `other_numbers`. Leak rule: never the bond of any
 *   item in the session; the family builder recomputes the answer; the move type is kept.
 * - fact_family model steps reuse `show_move`: the instruction names the move there, so the glow gives nothing
 *   away. build_equation's model step is the learner's free choice and gets no lever; its only wrong move (a
 *   swap) is not offered, so `other_move` there is listed as unanswered.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { BondFamilyForm, BondModelAction, NumberBondItem } from './numberBondScript';
import { buildBondItems } from './numberBondScript';
import { actionForFamilyForm, expandNumberBondInteractions } from './numberBondModes';

export const WAYS_LEVER = 'made_ways';
export const FRAME_LEVER = 'ten_frame_part';
export const SMALLER_LEVER = 'smaller_teen';
export const MOVE_LEVER = 'show_move';
export const COUNTERS_LEVER = 'open_counters';
export const EQ_FRAME_LEVER = 'equation_frame';
export const STRIP_LEVER = 'move_strip';
export const SMALLER_BOND_LEVER = 'smaller_bond';

/** A related-fact say turn: the groups stay in the whole and the learner says one of them. */
export const isRelatedSay = (item: NumberBondItem | null | undefined) =>
  item?.interactionPhase === 'related-say-addend' || item?.interactionPhase === 'related-say-remainder';

/** The spoken misses a say turn can show (`numberBondSpokenMisses`), by kind. */
const SAY_MISSES = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const sayMisses = (item: NumberBondItem) => item.kind === 'ten-and-ones' ? ['said_ten', 'said_whole', ...SAY_MISSES]
  : isRelatedSay(item) ? ['said_given_part', 'said_change', 'said_whole', 'added_both', ...SAY_MISSES]
    : ['said_given_part', 'said_whole', ...SAY_MISSES];

export const isEquationBuild = (item: NumberBondItem | null | undefined) =>
  item?.interactionPhase === 'equation-build' || item?.interactionPhase === 'family-build';

/** The family form an equation for a move takes: join is part + part, a take-away starts from the whole. */
const FORM_FOR: Record<BondModelAction, BondFamilyForm> = {
  join: 'add-left', swap: 'add-right', 'separate-left': 'subtract-left', 'separate-right': 'subtract-right' };

/** The move the equation on this build step must describe: the learner's own on build_equation, the named one on fact_family. */
export const equationMove = (item: NumberBondItem | null, committed?: BondModelAction): BondModelAction | undefined =>
  item?.interactionPhase === 'equation-build' ? committed ?? item.bondAction
    : item?.interactionPhase === 'family-build' ? item.bondAction : undefined;

const bondKey = (whole: number, a: number, b: number) => `${whole}:${Math.min(a, b)}:${Math.max(a, b)}`;

/**
 * The easier equation step for `item`, or null: one fact-family build step on a bond with a whole of five or less
 * and the same move, never the bond of any item in `session`. Deterministic, largest whole first. A swap or a
 * take-away of the second group needs two different parts (an equal-parts family has only two forms).
 */
export function smallerBond(item: NumberBondItem | null, session: readonly NumberBondItem[], committed?: BondModelAction):
    NumberBondItem | null {
  const move = equationMove(item, committed);
  if (!item || !isEquationBuild(item) || !move) return null;
  const form = FORM_FOR[move];
  const used = new Set([item, ...session].filter(i => i.whole > 0).map(i => bondKey(i.whole, i.knownPart, i.otherPart)));
  for (let whole = Math.min(5, item.whole - 1); whole >= 2; whole--)
    for (let a = 1; a < whole; a++) {
      const b = whole - a;
      if (a === b && form !== 'add-left' && form !== 'subtract-left') continue;
      if (used.has(bondKey(whole, a, b))) continue;
      const built = buildBondItems([{ id: `${item.sourceId}~smaller`, type: 'fact-family', whole, part1: a, part2: b }] as never,
        { band: '1', maxNumber: 10 });
      const step = expandNumberBondInteractions(built.items)
        .find(i => i.interactionPhase === 'family-build' && i.familyForm === form);
      if (step && actionForFamilyForm(form) === move) return step;
    }
  return null;
}

/** One frame of the move strip: dots inside the whole, and groups set aside in drawing order. No numbers anywhere. */
export interface StripFrame { inWhole: { red: number; blue: number }; aside: Array<{ tone: 'red' | 'blue'; count: number }> }

/** The committed move as two frames, before and after, drawn as dots. */
export function moveStrip(item: NumberBondItem | null, move: BondModelAction | undefined): StripFrame[] {
  if (!item || !move) return [];
  const red = item.knownPart, blue = item.otherPart;
  const apart = (first: 'red' | 'blue'): StripFrame['aside'] => first === 'red'
    ? [{ tone: 'red', count: red }, { tone: 'blue', count: blue }] : [{ tone: 'blue', count: blue }, { tone: 'red', count: red }];
  const none = { red: 0, blue: 0 }, all = { red, blue };
  switch (move) {
    case 'join': return [{ inWhole: none, aside: apart('red') }, { inWhole: all, aside: [] }];
    case 'swap': return [{ inWhole: none, aside: apart('red') }, { inWhole: none, aside: apart('blue') }];
    case 'separate-left': return [{ inWhole: all, aside: [] }, { inWhole: { red: 0, blue }, aside: [{ tone: 'red', count: red }] }];
    case 'separate-right': return [{ inWhole: all, aside: [] }, { inWhole: { red, blue: 0 }, aside: [{ tone: 'blue', count: blue }] }];
  }
}

/** The easier teen split for `item`, or null: eleven as ten and one, on its own id; never at twelve or below. */
export function smallerTeen(item: NumberBondItem | null): NumberBondItem | null {
  if (item?.kind !== 'ten-and-ones' || item.splitPhase !== 'build' || item.whole <= 12) return null;
  const built = buildBondItems([{ id: `${item.sourceId}~smaller`, type: 'ten-and-ones', whole: 11 }], { band: 'K', maxNumber: 10 });
  return expandNumberBondInteractions(built.items).find(i => i.splitPhase === 'build') ?? null;
}

export function numberBondLevers(item: NumberBondItem | null, pulled: readonly string[],
  view: { pairsMade: number; countersOpen: boolean; session?: readonly NumberBondItem[]; committed?: BondModelAction }):
    WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  if (item.kind === 'decompose' && item.splitPhase === 'build')
    return view.pairsMade > 0 || pulled.includes(WAYS_LEVER) ? [lever(WAYS_LEVER, 'help', 'shown', ['same_way_again'],
      'The learner makes a way to split the whole that they already made.',
      'Draws the ways the learner already made as small pictures of dots, in the order made, and marks the way the board shows now.')] : [];
  if (item.splitPhase === 'say' || isRelatedSay(item)) return [lever(FRAME_LEVER, 'help', 'both', sayMisses(item),
    'The learner miscounts the counters they are asked about, or says another number on the board.',
    isRelatedSay(item) ? "Lays the whole's counters out in a ten-frame outline, two rows of five, each still in its colour."
      : "Lays each part's counters out in a ten-frame outline, two rows of five.")];
  if (item.kind === 'ten-and-ones' && item.splitPhase === 'build') return [
    lever(FRAME_LEVER, 'help', 'both', ['ten_one_off', 'no_full_ten'],
      'The learner cannot see how many make a ten while moving counters.',
      "Lays each part's counters out in a ten-frame outline, two rows of five. Only the learner's own counters are in it."),
    ...(smallerTeen(item) ? [lever(SMALLER_LEVER, 'simplify', 'shown', ['no_full_ten'],
      'The learner cannot find the ten in a number this big yet.',
      'Opens an easier teen number to split first. It is not graded; the full item comes back after it.')] : []),
  ];
  if (isEquationBuild(item)) return [
    lever(EQ_FRAME_LEVER, 'help', 'shown', ['unfinished_equation', 'other_numbers'],
      'The learner cannot put the tiles into the shape of an equation, or uses numbers that are not in the bond.',
      'Draws empty slots and an equals sign above the tiles: a number, a sign, a number, equals, a number. Nothing is placed in them.'),
    ...(equationMove(item, view.committed) ? [lever(STRIP_LEVER, 'help', 'shown', ['false_equation', 'other_fact'],
      'The learner builds an equation that is not true, or an equation for a different move.',
      'Draws the move the equation must describe as two small pictures of dots, before and after. No numbers or signs.')] : []),
    ...(smallerBond(item, view.session ?? [], view.committed) ? [lever(SMALLER_BOND_LEVER, 'simplify', 'shown',
      ['false_equation', 'other_numbers'], 'The learner still cannot build a true equation for these numbers.',
      'Opens an easier equation to build first, on a smaller bond with the same move. It is not graded; the full item comes back after it.')] : []),
  ];
  if (item.interactionPhase === 'related-join' || item.interactionPhase === 'related-separate'
    || item.interactionPhase === 'family-model')
    return [lever(MOVE_LEVER, 'help', 'shown', ['other_move'],
      'The learner does not know which move to make with the groups.',
      'Highlights the button for the move this step asks for.')];
  if (item.interactionPhase === 'missing-infer' && (!view.countersOpen || pulled.includes(COUNTERS_LEVER)))
    return [lever(COUNTERS_LEVER, 'help', 'shown',
      ['said_given_part', 'said_whole', 'added_both', 'one_short', 'one_over', 'short_by_more', 'over_by_more'],
      'The learner cannot work out the covered part in their head.',
      'Opens the counters tray so the learner can set the known part aside and look at the rest. The covered part stays covered.')];
  return [];
}

/** What the pulled levers put on screen, as a scene fact. Never a count, a pair still to find, or the covered part. */
export function leverFacts(item: NumberBondItem | null, pulled: readonly string[]): string {
  if (!item) return '';
  return [
    pulled.includes(WAYS_LEVER) && item.kind === 'decompose' && 'The ways already made are drawn as small dot pictures, in the order made.',
    pulled.includes(FRAME_LEVER) && isRelatedSay(item) && "The whole's counters sit in a ten-frame outline, each in its colour.",
    pulled.includes(FRAME_LEVER) && !isRelatedSay(item) && (item.kind === 'ten-and-ones' || item.splitPhase === 'say')
      && "Each part's counters sit in a ten-frame outline.",
    pulled.includes(MOVE_LEVER) && (item.kind === 'related-fact' || item.interactionPhase === 'family-model')
      && 'The move button for this step is highlighted.',
    pulled.includes(EQ_FRAME_LEVER) && isEquationBuild(item)
      && 'Empty slots and an equals sign are drawn above the tiles; nothing is placed in them.',
    pulled.includes(STRIP_LEVER) && isEquationBuild(item)
      && 'The move the equation must describe is drawn as dots, before and after, with no numbers.',
    pulled.includes(COUNTERS_LEVER) && item.kind === 'missing-part' && 'The counters tray is open; the covered part stays covered.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for `made_ways`: the pairs in the order made, exactly as made; nothing added, nothing sorted. */
export const madeWaysOrder = (found: ReadonlyArray<readonly [number, number]>) => found.map(([a, b]) => [a, b] as const);
