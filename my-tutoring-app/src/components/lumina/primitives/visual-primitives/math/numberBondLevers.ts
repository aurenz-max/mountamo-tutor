/**
 * The in-item levers on number-bond, as one lever set (`NUMBER_BOND_LEVERS`, `bossLevers.ts`; `/add-support-tiers`,
 * handoff 21 M1, slice 1; the equation levers are a later slice). Approved table: qa/support-levers/m1-lever-tables-2026-09-28.md. No real-learner evidence; the
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
import { leverSet } from '../../../components/live-activity/bossLevers';
import { OFF_BY } from '../../../components/live-activity/boss';
import { numberWordFor } from './countingBoardDomain';
import { numberBondCard } from './numberBond.card';
import { buildBondItems, type BondFamilyForm, type BondModelAction, type NumberBondItem } from './numberBondDomain';
import { actionForFamilyForm, expandNumberBondInteractions } from './numberBondModes';
import { evalModeForKind, isRelatedSay, spokenQuestion } from './numberBondWorkspace';

export const WAYS_LEVER = 'made_ways';
export const FRAME_LEVER = 'ten_frame_part';
export const SMALLER_LEVER = 'smaller_teen';
export const MOVE_LEVER = 'show_move';
export const COUNTERS_LEVER = 'open_counters';
export const EQ_FRAME_LEVER = 'equation_frame';
export const STRIP_LEVER = 'move_strip';
export const SMALLER_BOND_LEVER = 'smaller_bond';

export { isRelatedSay };

/** The spoken misses a say turn can show (`numberBondSpokenMisses`), by kind. */
const sayMisses = (item: NumberBondItem): string[] => item.kind === 'ten-and-ones' ? ['said_ten', 'said_whole', ...OFF_BY]
  : isRelatedSay(item) ? ['said_given_part', 'said_change', 'said_whole', 'added_both', ...OFF_BY]
    : ['said_given_part', 'said_whole', ...OFF_BY];

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

/** Leak rule for `made_ways`: the pairs in the order made, exactly as made; nothing added, nothing sorted. */
export const madeWaysOrder = (found: ReadonlyArray<readonly [number, number]>) => found.map(([a, b]) => [a, b] as const);

/** The lesson's lever state for the step on screen. */
export interface NumberBondLeverContext {
  /** decompose: the ways the learner already made for this whole. */
  pairsMade: number;
  /** missing_part: the learner opened the counters tray with Use counters (the lever is then not offered). */
  countersOpen: boolean;
  /** Every step of the session: the smaller bond is never one of its bonds. */
  session?: readonly NumberBondItem[];
  /** build_equation: the move the learner committed on the model step. */
  committed?: BondModelAction;
}

const BACK = 'It is not graded; the full item comes back after it.';
const splitOrSay = (item: NumberBondItem) => item.splitPhase === 'say' || isRelatedSay(item)
  || (item.kind === 'ten-and-ones' && item.splitPhase === 'build');
const isMoveStep = (item: NumberBondItem) => item.interactionPhase === 'related-join'
  || item.interactionPhase === 'related-separate' || item.interactionPhase === 'family-model';
const EQUATION_MODES = ['build_equation', 'fact_family'];

export const NUMBER_BOND_LEVERS = leverSet<NumberBondItem, NumberBondLeverContext>({
  modeOf: item => evalModeForKind(item.kind),
  missesOf: mode => numberBondCard.modes[mode]?.misses ?? [],
  // The number a say step wants, which no clue may name.
  answersOf: item => { const q = spokenQuestion(item); return q ? [numberWordFor(q.answer), String(q.answer)] : []; },
  specs: [
    { id: WAYS_LEVER, type: 'custom', modes: ['decompose'], carrier: 'shown', answers: ['same_way_again'],
      why: 'It shows the learner\'s own earlier ways for this whole; no stock type replays the learner\'s work.',
      content: (item, { pairsMade }) => (item.splitPhase === 'build' && pairsMade > 0 ? true : null),
      when: 'The learner makes a way to split the whole that they already made.',
      does: 'Draws the ways the learner already made as small pictures of dots, in the order made, and marks the way the board shows now.',
      fact: 'The ways already made are drawn as small dot pictures, in the order made.' },
    // The say steps' number is on the board by design (the learner counts it): the frame changes how it is counted,
    // not what is there. On ten_and_ones' split step it lays out only the learner's own counters.
    { id: FRAME_LEVER, type: 'layout', modes: ['decompose', 'ten_and_ones', 'related_fact'], carrier: 'both',
      answers: ['ten_one_off', 'no_full_ten', 'said_ten', 'said_given_part', 'said_change', 'said_whole', 'added_both', ...OFF_BY],
      answersOn: item => (item.splitPhase === 'build' ? ['ten_one_off', 'no_full_ten'] : sayMisses(item)),
      content: item => (splitOrSay(item) ? true : null),
      when: item => (item.splitPhase === 'build' ? 'The learner cannot see how many make a ten while moving counters.'
        : 'The learner miscounts the counters they are asked about, or says another number on the board.'),
      does: item => (isRelatedSay(item) ? "Lays the whole's counters out in a ten-frame outline, two rows of five, each still in its colour."
        : item.splitPhase === 'build' ? "Lays each part's counters out in a ten-frame outline, two rows of five. Only the learner's own counters are in it."
          : "Lays each part's counters out in a ten-frame outline, two rows of five."),
      fact: (_content: unknown, item: NumberBondItem) => (isRelatedSay(item) ? "The whole's counters sit in a ten-frame outline, each in its colour."
        : "Each part's counters sit in a ten-frame outline.") },
    { id: SMALLER_LEVER, type: 'easier', modes: ['ten_and_ones'], carrier: 'shown', answers: ['no_full_ten'],
      content: item => smallerTeen(item),
      when: 'The learner cannot find the ten in a number this big yet.',
      does: `Opens an easier teen number to split first. ${BACK}` },
    // The instruction names the move, so the glow gives nothing away. build_equation's model step is the learner's
    // free choice and gets no lever.
    { id: MOVE_LEVER, type: 'marks', modes: ['related_fact', 'fact_family'], answers: ['other_move'],
      content: item => (isMoveStep(item) ? true : null),
      when: 'The learner does not know which move to make with the groups.',
      does: 'Highlights the button for the move this step asks for.',
      fact: 'The move button for this step is highlighted.' },
    { id: COUNTERS_LEVER, type: 'custom', modes: ['missing_part'], carrier: 'shown', answers: 'all',
      why: 'It opens a tool the learner works with (the counters tray); no stock type hands the learner a tool.',
      content: item => (item.interactionPhase === 'missing-infer' ? true : null),
      offer: (_item, { countersOpen }) => !countersOpen,
      when: 'The learner cannot work out the covered part in their head.',
      does: 'Opens the counters tray so the learner can set the known part aside and look at the rest. The covered part stays covered.',
      fact: 'The counters tray is open; the covered part stays covered.' },
    // Choosing the operator is part of the answer (contract R9, R12): the same shapes for every form.
    { id: EQ_FRAME_LEVER, type: 'marks', modes: EQUATION_MODES, answers: ['unfinished_equation', 'other_numbers'],
      content: item => (isEquationBuild(item) ? true : null),
      when: 'The learner cannot put the tiles into the shape of an equation, or uses numbers that are not in the bond.',
      does: 'Draws empty slots and an equals sign above the tiles: a number, a sign, a number, equals, a number. Nothing is placed in them.',
      fact: 'Empty slots and an equals sign are drawn above the tiles; nothing is placed in them.' },
    // Dots only, and only the committed move (the learner's own on build_equation, the named one on fact_family).
    { id: STRIP_LEVER, type: 'clue', modes: EQUATION_MODES, carrier: 'shown', answers: ['false_equation', 'other_fact'],
      content: (item, { committed }) => { const move = equationMove(item, committed); return move ? moveStrip(item, move) : null; },
      when: 'The learner builds an equation that is not true, or an equation for a different move.',
      does: 'Draws the move the equation must describe as two small pictures of dots, before and after. No numbers or signs.',
      fact: 'The move the equation must describe is drawn as dots, before and after, with no numbers.' },
    { id: SMALLER_BOND_LEVER, type: 'easier', modes: EQUATION_MODES, carrier: 'shown', answers: ['false_equation', 'other_numbers'],
      content: (item, { session, committed }) => smallerBond(item, session ?? [], committed),
      when: 'The learner still cannot build a true equation for these numbers.',
      does: `Opens an easier equation to build first, on a smaller bond with the same move. ${BACK}` },
  ],
});
