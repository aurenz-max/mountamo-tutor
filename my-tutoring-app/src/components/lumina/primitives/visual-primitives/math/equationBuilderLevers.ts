/**
 * The in-item levers on equation-builder's open build, make-n (`/add-eval-modes` references/build-mode.md). They start
 * bare at every tier: making the sentence and working out what it makes IS the task, so the levers come on a miss.
 * From the misses `makeNMiss` observes (no real-learner evidence yet):
 * - `number_dots` (help): dots under each number tile in the learner's row, as many as the tile says. Answers a
 *   sentence that makes a different amount. Leak rule: the learner's own numbers only; never the row's total.
 * - `sentence_frame` (help): the shape of a sentence beside the row, empty boxes for number, sign, number. Answers a
 *   lone number and a row that is not a sentence yet. Leak rule: no number or sign is filled in.
 * - `smaller_total` (simplify): an ungraded practice ask for about half the total, one way, with only the + tile; the
 *   full item comes back after it. Leak rule: at least 2, below the total.
 * `same_way` has no lever: the way already made stays on screen beside the row, and "different" has no smaller form.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { EquationBuilderChallenge } from './EquationBuilder';

export const DOTS_LEVER = 'number_dots';
export const FRAME_LEVER = 'sentence_frame';
export const SMALLER_LEVER = 'smaller_total';

/** The easier ask for a make-n item, or null: about half the total, one way, + only, the same bank numbers up to it. */
export function smallerMakeN(c: EquationBuilderChallenge): EquationBuilderChallenge | null {
  if (c.type !== 'make-n' || c.target === undefined) return null;
  const target = Math.ceil(c.target / 2);
  if (target < 2 || target >= c.target) return null;
  const numbers = Array.from({ length: target }, (_, i) => String(i + 1));
  return { id: `${c.id}~smaller`, type: 'make-n', target, ways: 1, availableTiles: [...numbers, '+'],
    instruction: `Make a number sentence that equals ${target}.` };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly string[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

/** The levers on a make-n session item (none on another type, or while the easier practice item is up). */
export function makeNLevers(c: EquationBuilderChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (c?.type !== 'make-n') return [];
  return [
    lever(DOTS_LEVER, 'help', ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
      'The learner\'s sentence makes one more, one less, or a different amount than the total.',
      'Puts dots under each number tile the learner placed, as many as that tile says. Never the amount the sentence makes.',
      pulled),
    lever(FRAME_LEVER, 'help', ['bare_number', 'unfinished_sentence'],
      'The learner puts down one number alone, or tiles that are not a sentence yet (two numbers together, a sign at an end).',
      'Shows the shape of a number sentence beside the row: empty boxes for a number, a + or −, and a number. Nothing is filled in.',
      pulled),
    ...(smallerMakeN(c) ? [lever(SMALLER_LEVER, 'simplify', ['short_by_more', 'over_by_more'],
      'The learner\'s sentence is far from the total, or they cannot start.',
      'Opens an easier ask first: a smaller total, about half, one way, with only the + tile. It is not graded; the full item comes back after it.',
      pulled)] : []),
  ];
}

/** What the pulled levers put on screen, for the tutor's `onScreen` fact. */
export function makeNLeverFacts(pulled: readonly string[]): string | undefined {
  const notes = [
    pulled.includes(DOTS_LEVER) && 'Each number tile in the row has that many dots under it.',
    pulled.includes(FRAME_LEVER) && 'An empty sentence shape (number, sign, number) is beside the row.',
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}
