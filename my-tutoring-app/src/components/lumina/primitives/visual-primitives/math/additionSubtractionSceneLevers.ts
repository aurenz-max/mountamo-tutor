/**
 * The in-item levers on an addition-subtraction-scene item (`/add-support-tiers`, report
 * qa/eval-reports/addition-subtraction-scene-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `addSubMiss` (pictures, number sentences) and `additionSubtractionSpokenMisses` (spoken numbers) observe.
 * Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 *
 * - `story_groups` (help, every mode): the objects there at the start move into a dashed pen on the left; any that
 *   join sit to its right; any that go away stay as faded outlines inside it. Leak rule (`groupsLeak`): never on a
 *   solve-story whose unknown is the change or the start, where the joined or departed group IS the answer as a
 *   group to count; never when nothing was there at the start.
 * - `sentence_frame` (help, build_equation): the tray is drawn as five boxes, square for a number and round for a
 *   sign; the learner's tiles fill them in order and nothing else is put in a box.
 * - `smaller_story` (simplify, every mode): an ungraded practice story of the same mode and operation with one
 *   joining or going away (and, on a solve-story asking for the change or the start, asking for the end instead).
 *   Built by `smallerStory`; id `<item>~simpler`; never the item's numbers, its hidden answer, or another item's
 *   story (`practiceLeaks`). Not offered on an item already the plainest shape.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { numberWordFor } from './countingBoardScript';
import { publicValuesFor, storyLeaksAnswer, type AddSubSceneItem } from './additionSubtractionSceneScript';

export const GROUPS_LEVER = 'story_groups';
export const FRAME_LEVER = 'sentence_frame';
export const SIMPLER_LEVER = 'smaller_story';
export const PRACTICE_SUFFIX = '~simpler';

/** A story picture's misses: what `addSubMiss` names on a built picture and `additionSubtractionSpokenMisses` on a
 *  spoken number. One list for both, since act_out is a picture at K and a spoken number at Grade 1. */
const STORY_MISSES = ['no_change', 'wrong_way', 'one_short', 'one_over', 'short_by_more', 'over_by_more',
  'said_start', 'said_change', 'said_result', 'other_operation'];

const enacted = (item: AddSubSceneItem) =>
  item.kind === 'create-story' || (item.kind === 'act-out' && (item.band === 'K' || item.operation === 'subtraction'));
/** Where an enacted picture starts: empty on a create-story join, the start group everywhere else. */
export const seededCount = (item: AddSubSceneItem) =>
  !enacted(item) ? 0 : item.kind === 'create-story' && item.operation === 'addition' ? 0 : item.startCount;

// ── story_groups ───────────────────────────────────────────────────────────

/** Leak rule: on a solve-story asking for the change or the start, the group the pen sets apart is the answer. */
export const groupsLeak = (item: AddSubSceneItem) => item.kind === 'solve-story' && item.unknownPosition !== 'result';
export const groupsOffered = (item: AddSubSceneItem | null) => !!item && item.startCount >= 1 && !groupsLeak(item);

export interface GroupLayout { positions: Array<{ x: number; y: number }>; pen: { x: number; y: number; w: number; h: number } }

const CELL = 44;
const grid = (n: number) => { const rows = Math.min(4, Math.max(1, Math.ceil(n / 3))); return { rows, cols: Math.max(1, Math.ceil(n / rows)) }; };

/** Slots below `start` in a grid inside the pen on the left, the rest in a grid to its right; `capacity` slots in all. */
export function groupLayout(start: number, capacity: number, height: number): GroupLayout {
  const a = grid(start), b = grid(Math.max(0, capacity - start));
  const pen = { x: 16, y: (height - (a.rows * CELL + 16)) / 2, w: a.cols * CELL + 16, h: a.rows * CELL + 16 };
  const at = (i: number, g: { rows: number; cols: number }, x0: number) => {
    const top = (height - g.rows * CELL) / 2;
    return { x: x0 + (i % g.cols) * CELL + CELL / 2, y: top + Math.floor(i / g.cols) * CELL + CELL / 2 };
  };
  const right = pen.x + pen.w + 30;
  return { pen, positions: Array.from({ length: capacity }, (_, i) => i < start ? at(i, a, pen.x + 8) : at(i - start, b, right)) };
}

/** The start slots drawn as faded outlines: the ones that went away. An empty create-story pen draws none. */
export function departedSlots(item: AddSubSceneItem, inPicture: readonly number[]): number[] {
  if (enacted(item)) {
    const seeded = seededCount(item);
    return Array.from({ length: seeded }, (_, i) => i).filter(i => !inPicture.includes(i));
  }
  return item.operation === 'subtraction'
    ? Array.from({ length: item.startCount - item.resultCount }, (_, i) => item.resultCount + i) : [];
}

/** What the pen puts on screen, for the tutor and JEV: what is drawn, never a count the learner has not made. */
export function groupsFact(item: AddSubSceneItem): string {
  if (enacted(item) && seededCount(item) === 0) {
    return `An empty dashed pen on the left, sized for the first number of the number sentence: the first ${item.objectType} `
      + 'brought in go inside it, any more go to its right.';
  }
  return `The ${numberWordFor(item.startCount)} ${item.objectType} there at the start are drawn inside a dashed pen on the left. `
    + (item.operation === 'addition' ? `Any ${item.objectType} that joined are drawn to the right of the pen.`
      : `Any ${item.objectType} that went away stay as faded outlines inside the pen.`);
}

// ── sentence_frame ─────────────────────────────────────────────────────────

/** Square for a number, round for a sign. */
export const FRAME_SHAPE = ['number', 'sign', 'number', 'sign', 'number'] as const;

/** What each box shows: the learner's own tile in that place, or nothing. Never a tile the learner did not place. */
export const frameBoxes = (tiles: readonly string[]) => FRAME_SHAPE.map((shape, i) => ({ shape, tile: tiles[i] ?? null }));

export const FRAME_FACT = 'The tray is drawn as five boxes in a row, square for a number and round for a sign: number, sign, '
  + 'number, sign, number. The learner\'s tiles fill the boxes in order; the empty boxes hold nothing.';

// ── smaller_story ──────────────────────────────────────────────────────────

export interface StoryContext { items: readonly AddSubSceneItem[]; maxNumber: number }

const triple = (i: Pick<AddSubSceneItem, 'operation' | 'startCount' | 'changeCount'>) => `${i.operation}:${i.startCount}:${i.changeCount}`;

/** The item's answer when the story does not say it: a number a practice story must not say either. */
const hiddenAnswer = (item: AddSubSceneItem) => publicValuesFor(item).includes(item.answer) ? null : item.answer;

/**
 * Leak rule for a practice story: never the item's id or story numbers, never another item's story, never an answer
 * equal to the item's, never a number the item hides, and its own story never states its own answer.
 */
export function practiceLeaks(practice: AddSubSceneItem, item: AddSubSceneItem, items: readonly AddSubSceneItem[]): boolean {
  if (practice.id === item.id || practice.kind !== item.kind || practice.operation !== item.operation) return true;
  if (items.some(i => triple(i) === triple(practice)) || triple(item) === triple(practice)) return true;
  if (practice.answer === item.answer) return true;
  const hidden = hiddenAnswer(item);
  if (hidden !== null && [practice.startCount, practice.changeCount, practice.resultCount].includes(hidden)) return true;
  return practice.kind !== 'create-story' && storyLeaksAnswer(practice.situation, practice.answer, publicValuesFor(practice));
}

/** Already the plainest shape: one joining or going away, a start of two or less, asking for the end. */
export const isPlainest = (item: AddSubSceneItem) =>
  item.changeCount === 1 && item.startCount <= 2 && !groupsLeak(item);

/**
 * The practice story for `item`: same mode, band and operation, one joining or going away, asking for the end; the
 * smallest start that passes the leak rule, never a bigger picture than the item's. On an item that already has one
 * joining or going away, a smaller start. Null on the plainest shape or when no story passes.
 */
export function smallerStory(item: AddSubSceneItem, ctx: StoryContext): AddSubSceneItem | null {
  if (isPlainest(item)) return null;
  const add = item.operation === 'addition';
  const biggest = Math.max(item.startCount, item.resultCount);
  const first = add && item.kind === 'create-story' ? 1 : 2;
  for (let start = first; start <= ctx.maxNumber; start++) {
    const result = add ? start + 1 : start - 1;
    if (result > ctx.maxNumber || Math.max(start, result) > biggest) continue;
    // One joining already: only a smaller start is one step simpler (unless the unknown moves to the end).
    if (item.changeCount === 1 && !groupsLeak(item) && start >= item.startCount) continue;
    if (item.answerKind === 'voice' && result < 1) continue;
    const situation = item.kind === 'create-story' ? ''
      : `There are ${numberWordFor(start)} ${item.objectType} in the ${item.scene}. ${add ? 'One more joins them.' : 'One goes away.'}`;
    const practice: AddSubSceneItem = {
      ...item, id: `${item.id}${PRACTICE_SUFFIX}`, startCount: start, changeCount: 1, resultCount: result,
      unknownPosition: 'result', answer: result, situation,
      equation: `${start} ${add ? '+' : '-'} 1 = ${result}`,
      ...(item.allowedTiles ? { allowedTiles: [String(start), '1', String(result)] } : {}),
    };
    if (!practiceLeaks(practice, item, ctx.items)) return practice;
  }
  return null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, items: readonly AddSubSceneItem[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── the levers ─────────────────────────────────────────────────────────────

/** The levers on a session item. `pulled` holds this item's runtime pulls. */
export function addSubLevers(item: AddSubSceneItem | null, pulled: readonly string[], ctx: StoryContext): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const equation = item.kind === 'build-equation';
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string) =>
    levers.push({ id, kind, carrier: 'shown', when, does, pulled: pulled.includes(id), answers });
  if (groupsOffered(item)) lever(GROUPS_LEVER, 'help',
    equation ? ['false_equation', 'other_operation', 'other_numbers'] : STORY_MISSES,
    'The learner loses which objects were there at the start, which joined and which went away.',
    (enacted(item) && seededCount(item) === 0
      ? 'Draws an empty dashed pen on the left, sized for the first number of the number sentence: the first objects '
        + 'brought in go inside it, any more go to its right.'
      : 'Moves the objects there at the start into a dashed pen on the left; any that join sit to the right of it, any '
        + 'that go away stay as faded outlines inside it.')
      + ' You may point to the pen and the groups; never count them for the learner or say the answer.');
  if (equation) lever(FRAME_LEVER, 'help', ['unfinished_equation'],
    'The learner\'s number sentence is unfinished or out of shape.',
    'Draws the tray as five boxes, square for a number and round for a sign: number, sign, number, sign, number. '
      + 'The learner\'s tiles fill them in order; nothing is put in a box for them.');
  if (smallerStory(item, ctx)) lever(SIMPLER_LEVER, 'simplify',
    equation ? ['unfinished_equation', 'false_equation', 'other_operation'] : STORY_MISSES,
    'The learner cannot do this story even with the help on screen: a smaller one first.',
    `Opens an ungraded practice story with one ${item.operation === 'addition' ? 'joining' : 'going away'}`
      + (groupsLeak(item) ? ' that asks how many there are at the end' : ' and smaller numbers')
      + '; then this story comes back blank.');
  return levers;
}

export const PRACTICE_NOTE = 'An easier practice story, ungraded; the full story comes back after it.';
