/**
 * The in-item levers on a spatial-scene item (`/add-support-tiers`, report
 * qa/eval-reports/spatial-scene-levers-2026-10-08.md). No real-learner evidence: the misses are what `spatialMiss`
 * observes, and the catalog's commonStruggles. Pure: the component draws from these, the workspace publishes them, the
 * tests hold each leak rule. Every simpler item has the id `<item>~simpler`, the same mode, and is built by
 * `practiceItem`.
 *
 * - `mark_reference` (help): a ring on the thing(s) the item compares with. identify, describe, place, place_between,
 *   follow_directions (the current step's named thing). Never on place_in, where the container's cell IS the answer
 *   (`markLeaks`), never on the target or an answer cell.
 * - `word_picture` (help): what a position word means, drawn as a dot and a square, never with the scene's things.
 *   identify / describe: a picture on EVERY word button (`pictureLeaks`: a picture on some options only points at one);
 *   place, place_in, place_between, follow_directions: one picture of the asked word beside the grid.
 * - `side_labels` (help, describe_scene): left and right hands at the bottom corners and "nearer you" by the YOU arrow,
 *   the same marks on every scene and none on an object.
 * - `fewer_things` (simplify): the same mode with two things on the grid (and two word choices), in other things and a
 *   different answer (`practiceLeaks`). Not on follow_directions: its items are two steps round one thing already, and
 *   one step is the `place` mode.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { PositionWord, SceneObject, SpatialSceneChallenge } from './SpatialScene';
import { placeCellCorrect } from './spatialSceneWorkspace';

export const MARK_LEVER = 'mark_reference';
export const PICTURE_LEVER = 'word_picture';
export const SIDES_LEVER = 'side_labels';
export const FEWER_LEVER = 'fewer_things';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice scene, ungraded; the full item comes back after it.';

type Cell = { row: number; col: number };
const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;
const text = (word: string) => word.replaceAll('_', ' ');

/** `positionHolds` (resolvePrepositionScope.ts) for the words this primitive draws; the test holds the two equal. */
export function holds(word: string, t: Cell, ref: Cell): boolean | null {
  const dr = t.row - ref.row, dc = t.col - ref.col;
  switch (word) {
    case 'above': return dr < 0 && dc === 0;
    case 'below': return dr > 0 && dc === 0;
    case 'left_of': return dc < 0 && dr === 0;
    case 'right_of': return dc > 0 && dr === 0;
    case 'beside': case 'next_to': return dr === 0 && Math.abs(dc) === 1;
    case 'on': return dr === -1 && dc === 0;
    case 'under': return dr === 1 && dc === 0;
    case 'in': return dr === 0 && dc === 0;
    default: return null;
  }
}

// ── what is drawn for a word ───────────────────────────────────────────────

/** How each word's picture is drawn: a dot (the thing) and a square (the thing compared with). Never the scene's things. */
export const PICTURE_TEXT: Record<string, string> = {
  above: 'a dot higher than a square, with a gap', below: 'a dot lower than a square, with a gap',
  on: 'a dot sitting on top of a square, touching', under: 'a dot right under a square, touching',
  left_of: 'a dot to the left of a square, with a gap', right_of: 'a dot to the right of a square, with a gap',
  beside: 'a dot touching the side of a square', next_to: 'a dot touching the side of a square',
  in: 'a dot inside a cup shape', between: 'a dot with a square on each side',
};

// ── what the item asks about ───────────────────────────────────────────────

const WORD_PHRASES: Array<[PositionWord, RegExp]> = [
  ['left_of', /\bleft of\b/i], ['right_of', /\bright of\b/i], ['next_to', /\bnext to\b/i], ['beside', /\bbeside\b/i],
  ['above', /\babove\b/i], ['below', /\bbelow\b/i], ['under', /\bunder\b/i], ['on', /\bon\b/i],
];
const named = (instruction: string, name: string) =>
  new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(instruction);

/** A follow-directions step's word and the thing it names, read from its sentence and held to its cell; else null. */
export function stepAsk(c: SpatialSceneChallenge, step: number): { word: PositionWord; ref: string; at: Cell } | null {
  const s = c.steps?.[step];
  if (!s) return null;
  const words = WORD_PHRASES.filter(([, re]) => re.test(s.instruction)).map(([w]) => w);
  if (words.length !== 1) return null;
  const word = words[0];
  const things = [...c.sceneObjects.map(o => ({ name: o.name, at: o.position })),
    ...(c.steps ?? []).slice(0, step).map(p => ({ name: p.targetObject.name, at: p.correctCell }))];
  const fits = things.filter(t => t.name !== s.targetObject.name && named(s.instruction, t.name)
    && holds(word, s.correctCell, t.at) === true);
  return fits.length === 1 ? { word, ref: fits[0].name, at: fits[0].at } : null;
}

/** The word a picture is drawn for, per mode: every option, or the one asked word. */
export function pictureWords(c: SpatialSceneChallenge, step = 0): string[] {
  switch (c.type) {
    case 'identify': case 'describe': return c.options ?? [];
    case 'place': case 'place_in': return [c.correctPosition];
    case 'place_between': return ['between'];
    case 'follow_directions': { const ask = stepAsk(c, step); return ask ? [ask.word] : []; }
    default: return [];
  }
}

/** Leak rule: a picture set that is not exactly the options (or the asked word) points at an answer; a word with no
 *  drawing would be text. */
export function pictureLeaks(c: SpatialSceneChallenge, words: readonly string[], step = 0): boolean {
  const want = c.type === 'identify' || c.type === 'describe' ? c.options ?? []
    : c.type === 'place_between' ? ['between'] : c.type === 'follow_directions' ? [stepAsk(c, step)?.word ?? '']
    : c.type === 'describe_scene' ? [] : [c.correctPosition];
  return words.length === 0 || words.length !== want.length || words.some(w => !want.includes(w) || !PICTURE_TEXT[w]);
}

const at = (c: SpatialSceneChallenge, name?: string) => c.sceneObjects.find(o => o.name === name)?.position;

/** The cells the reference ring goes on: the thing(s) the item compares with. */
export function markCells(c: SpatialSceneChallenge, step = 0): Cell[] {
  switch (c.type) {
    case 'identify': case 'describe': case 'place': { const r = at(c, c.referenceObjectName); return r ? [r] : []; }
    case 'place_between': return [at(c, c.referenceObjectName), at(c, c.referenceObjectName2)].filter((r): r is Cell => !!r);
    case 'follow_directions': { const ask = stepAsk(c, step); return ask ? [ask.at] : []; }
    default: return [];
  }
}

/** Leak rule: the ring goes on a drawn thing that is neither the target nor an answer cell (place_in: always leaks). */
export function markLeaks(c: SpatialSceneChallenge, cells: readonly Cell[], step = 0): boolean {
  const occupied = (cell: Cell) => c.sceneObjects.some(o => same(o.position, cell))
    || (c.steps ?? []).slice(0, step).some(s => same(s.correctCell, cell));
  const wordItem = c.type === 'identify' || c.type === 'describe';
  return c.type === 'place_in' || cells.some(cell => !occupied(cell) || placeCellCorrect(c, cell)
    || (wordItem && same(cell, c.targetObject.position))
    || (c.type === 'follow_directions' && !!c.steps?.[step] && same(c.steps[step].correctCell, cell)));
}

const ringNames = (c: SpatialSceneChallenge, step: number) => c.type === 'follow_directions'
  ? [stepAsk(c, step)?.ref ?? ''] : c.type === 'place_between' ? [c.referenceObjectName ?? '', c.referenceObjectName2 ?? '']
  : [c.referenceObjectName ?? ''];

// ── scene facts ────────────────────────────────────────────────────────────

export function markFact(c: SpatialSceneChallenge, step = 0): string {
  const names = ringNames(c, step).map(n => `the ${n}`);
  return `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} ringed in yellow on the grid: the thing${names.length > 1 ? 's' : ''} `
    + 'to compare with. No empty square is marked.';
}

export function pictureFact(c: SpatialSceneChallenge, step = 0): string {
  if (c.type === 'identify' || c.type === 'describe') {
    return 'Each word button has a small picture of its own word, drawn with a dot and a square (not the scene\'s things). '
      + 'Nothing on the grid is marked.';
  }
  const word = pictureWords(c, step)[0];
  return `A small picture beside the grid shows "${text(word)}": ${PICTURE_TEXT[word]}. Nothing on the grid is marked.`;
}

/** The same on every scene, whatever its relation: the leak rule is that it never depends on the item. */
export const SIDES_FACT = 'A left-hand picture labelled left at the bottom-left of the scene, a right-hand picture labelled '
  + 'right at the bottom-right, and "nearer you" by the YOU arrow. Every scene has the same marks; no object is marked.';

// ── simpler items ──────────────────────────────────────────────────────────

const THINGS: ReadonlyArray<Omit<SceneObject, 'position'>> = [
  { name: 'star', image: '⭐' }, { name: 'apple', image: '🍎' }, { name: 'duck', image: '🦆' }, { name: 'car', image: '🚗' },
  { name: 'ball', image: '⚽' }, { name: 'cat', image: '🐱' }, { name: 'tree', image: '🌳' }, { name: 'flower', image: '🌸' },
  { name: 'chair', image: '🪑' }, { name: 'house', image: '🏠' }, { name: 'dog', image: '🐕' },
];
/** place_in: small things to put in, and big things that hold nothing. */
const SMALL = THINGS.slice(0, 5), BIG = [THINGS[6], THINGS[7], THINGS[8], THINGS[9]];
const CONTAINERS: ReadonlyArray<Omit<SceneObject, 'position'>> = [
  { name: 'basket', image: '🧺' }, { name: 'box', image: '📦' }, { name: 'bowl', image: '🥣' }, { name: 'bucket', image: '🪣' },
  { name: 'bag', image: '👜' },
];

const itemNames = (c: SpatialSceneChallenge) => new Set([...c.sceneObjects.map(o => o.name), c.targetObject.name,
  c.referenceObjectName ?? '', c.referenceObjectName2 ?? '', ...(c.steps ?? []).map(s => s.targetObject.name)].map(n => n.toLowerCase()));
const free = (c: SpatialSceneChallenge, pool = THINGS) => pool.filter(t => !itemNames(c).has(t.name));
const put = (t: Omit<SceneObject, 'position'>, position: Cell): SceneObject => ({ ...t, position });

/** The cells an item credits. */
const answerCells = (c: SpatialSceneChallenge): Cell[] =>
  c.type === 'place' && c.acceptableCells?.length ? c.acceptableCells : c.correctCell ? [c.correctCell] : [];

/**
 * Leak rule for a simpler item: never the item's id or mode change, never one of the item's things, never the item's
 * answer: a word item's key never holds for the practice pair, a cell item's answer never shares a cell with the
 * item's, a spoken item never asks the item's relation.
 */
export function practiceLeaks(p: SpatialSceneChallenge, c: SpatialSceneChallenge): boolean {
  if (p.id === c.id || p.type !== c.type) return true;
  const names = itemNames(c);
  if (p.sceneObjects.some(o => names.has(o.name.toLowerCase())) || names.has(p.targetObject.name.toLowerCase())) return true;
  if (p.type === 'identify' || p.type === 'describe') {
    const ref = at(p, p.referenceObjectName);
    return p.correctPosition === c.correctPosition || !ref || holds(c.correctPosition, p.targetObject.position, ref) === true;
  }
  if (p.type === 'describe_scene') return p.correctPosition === c.correctPosition;
  return answerCells(p).some(a => answerCells(c).some(b => same(a, b)));
}

const practiceOf = (c: SpatialSceneChallenge, fields: Partial<SpatialSceneChallenge>): SpatialSceneChallenge => ({
  id: `${c.id}${PRACTICE_SUFFIX}`, type: c.type, instruction: '', sceneObjects: [], targetObject: c.targetObject,
  correctPosition: c.correctPosition, ...fields,
});

/** Where the target sits beside a centre reference for each word: adjacent, so one cell says it. */
const OFFSET: Record<string, Cell> = { above: { row: -1, col: 0 }, on: { row: -1, col: 0 }, below: { row: 1, col: 0 },
  under: { row: 1, col: 0 }, left_of: { row: 0, col: -1 }, right_of: { row: 0, col: 1 }, beside: { row: 0, col: 1 },
  next_to: { row: 0, col: 1 } };
const VERTICAL = new Set(['above', 'below', 'on', 'under']);

/** identify / describe: the target and one other thing, two words (a far foil first). Null on a two-thing, two-word item. */
function fewerWords(c: SpatialSceneChallenge): SpatialSceneChallenge | null {
  const opts = c.options ?? [];
  if (c.sceneObjects.length <= 2 && opts.length <= 2) return null;
  const [t, r] = free(c);
  if (!r) return null;
  const centre = { row: 1, col: 1 };
  for (const word of opts) {
    const off = OFFSET[word];
    if (word === c.correctPosition || !off) continue;
    const tc = { row: centre.row + off.row, col: centre.col + off.col };
    if (holds(word, tc, centre) !== true) continue;
    const foils = opts.filter(o => o !== word && holds(o, tc, centre) === false);
    const foil = foils.find(o => VERTICAL.has(o) !== VERTICAL.has(word)) ?? foils[0];
    if (!foil) continue;
    const target = put(t, tc);
    const p = practiceOf(c, {
      instruction: c.type === 'identify' ? `Where is the ${t.name} compared with the ${r.name}?`
        : `Which word tells where the ${t.name} is compared with the ${r.name}?`,
      sceneObjects: [put(r, centre), target], targetObject: target, correctPosition: word as PositionWord,
      referenceObjectName: r.name, options: opts.filter(o => o === word || o === foil),
    });
    if (!practiceLeaks(p, c)) return p;
  }
  return null;
}

const cells = (n: number) => Array.from({ length: n * n }, (_, i) => ({ row: Math.floor(i / n), col: i % n }));

/** place: the same word round one other thing, with exactly one right cell. Null on a one-thing, one-cell item. */
function fewerPlace(c: SpatialSceneChallenge, gridSize: number): SpatialSceneChallenge | null {
  const word = c.correctPosition;
  if (c.sceneObjects.length <= 1 && answerCells(c).length <= 1) return null;
  const [t, r] = free(c);
  const itemRef = at(c, c.referenceObjectName);
  if (!r || holds(word, { row: 0, col: 0 }, { row: 0, col: 0 }) === null) return null;
  for (const ref of cells(gridSize)) {
    if (itemRef && same(ref, itemRef)) continue;
    const ok = cells(gridSize).filter(x => !same(x, ref) && holds(word, x, ref) === true);
    if (ok.length !== 1) continue;
    const p = practiceOf(c, {
      instruction: `Put the ${t.name} ${text(word)} the ${r.name}.`, sceneObjects: [put(r, ref)],
      targetObject: put(t, { row: 0, col: 0 }), referenceObjectName: r.name, correctCell: ok[0], acceptableCells: ok,
    });
    if (!practiceLeaks(p, c)) return p;
  }
  return null;
}

/** place_in: one container and one other thing, the container in another cell. Null on a two-thing item. */
function fewerContainment(c: SpatialSceneChallenge, gridSize: number): SpatialSceneChallenge | null {
  if (c.sceneObjects.length <= 2) return null;
  const box = free(c, CONTAINERS)[0];
  const t = free(c, SMALL)[0], other = free(c, BIG)[0];
  if (!box || !t || !other) return null;
  for (const boxCell of cells(gridSize)) {
    const far = cells(gridSize).find(x => Math.abs(x.row - boxCell.row) + Math.abs(x.col - boxCell.col) >= 2);
    if (!far) continue;
    const p = practiceOf(c, {
      instruction: `Put the ${t.name} IN the ${box.name}.`, sceneObjects: [put(box, boxCell), put(other, far)],
      targetObject: put(t, { row: 0, col: 0 }), referenceObjectName: box.name, correctPosition: 'in', correctCell: boxCell,
    });
    if (!practiceLeaks(p, c)) return p;
  }
  return null;
}

/** place_between: the two references alone on another line. Null on a two-thing item. */
function fewerBetween(c: SpatialSceneChallenge, gridSize: number): SpatialSceneChallenge | null {
  if (c.sceneObjects.length <= 2 || gridSize < 3) return null;
  const [t, a, b] = free(c);
  if (!b) return null;
  const lines = [0, 1, 2].flatMap(i => [
    { a: { row: i, col: 0 }, b: { row: i, col: 2 }, gap: { row: i, col: 1 } },
    { a: { row: 0, col: i }, b: { row: 2, col: i }, gap: { row: 1, col: i } },
  ]);
  for (const line of lines) {
    const p = practiceOf(c, {
      instruction: `Put the ${t.name} BETWEEN the ${a.name} and the ${b.name}.`, sceneObjects: [put(a, line.a), put(b, line.b)],
      targetObject: put(t, { row: 0, col: 0 }), referenceObjectName: a.name, referenceObjectName2: b.name,
      correctPosition: 'between', correctCell: line.gap,
    });
    if (!practiceLeaks(p, c)) return p;
  }
  return null;
}

const OTHER_WAY: Record<string, { word: PositionWord; t: Cell; r: Cell }> = {
  left_of: { word: 'right_of', t: { row: 1, col: 2 }, r: { row: 1, col: 0 } },
  right_of: { word: 'left_of', t: { row: 1, col: 0 }, r: { row: 1, col: 2 } },
  in_front_of: { word: 'behind', t: { row: 0, col: 1 }, r: { row: 2, col: 1 } },
  behind: { word: 'in_front_of', t: { row: 2, col: 1 }, r: { row: 0, col: 1 } },
};

/** describe_scene: two things only, the relation on the same line pointing the other way. Null on a two-thing scene. */
function fewerScene(c: SpatialSceneChallenge): SpatialSceneChallenge | null {
  const way = OTHER_WAY[c.correctPosition];
  if (!way || c.sceneObjects.length <= 2) return null;
  const [t, r] = free(c);
  if (!r) return null;
  const target = put(t, way.t);
  const p = practiceOf(c, {
    instruction: `Look from the YOU arrow. Describe where the ${t.name} is compared with the ${r.name}.`,
    sceneObjects: [target, put(r, way.r)], targetObject: target, correctPosition: way.word, referenceObjectName: r.name,
    scenePerspective: 'viewer_depth',
  });
  return practiceLeaks(p, c) ? null : p;
}

/** The simpler item for a session item, same mode, or null on an item already the plainest shape. */
export function practiceItem(c: SpatialSceneChallenge, gridSize = 3): SpatialSceneChallenge | null {
  switch (c.type) {
    case 'identify': case 'describe': return fewerWords(c);
    case 'place': return fewerPlace(c, gridSize);
    case 'place_in': return fewerContainment(c, gridSize);
    case 'place_between': return fewerBetween(c, gridSize);
    case 'describe_scene': return fewerScene(c);
    default: return null;
  }
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly SpatialSceneChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/** Easy starts with the reference ringed (a perception aid, like the tier's grid and labels); not a pull. */
export const markStartsShown = (c: SpatialSceneChallenge) => c.supportTier === 'easy';

// ── the levers on an item ──────────────────────────────────────────────────

const WORD_MISSES = ['opposite_word', 'same_axis_word', 'other_axis_word'];
const PLACE_MISSES = ['opposite_cell', 'same_axis_cell', 'other_axis_cell', 'off_line_cell'];
const IN_MISSES = ['other_object', 'next_to_container', 'away_from_container'];
const BETWEEN_MISSES = ['next_to_one', 'touches_neither'];
const STEP_MISSES = ['later_step_cell', 'other_cell'];

/** The levers on a session item at its current step. `pulled` holds this item's runtime pulls. */
export function spatialSceneLevers(c: SpatialSceneChallenge | null, pulled: readonly string[], step = 0, gridSize = 3):
  WorkspaceLever[] {
  if (!c) return [];
  const levers: WorkspaceLever[] = [];
  const back = 'then this item comes back blank.';
  const mark = (answers: string[]) => {
    const ring = markCells(c, step);
    if (!ring.length || markLeaks(c, ring, step)) return;
    levers.push({ id: MARK_LEVER, kind: 'help', carrier: 'shown', pulled: markStartsShown(c) || pulled.includes(MARK_LEVER), answers,
      when: 'The learner compares with the wrong thing, or cannot find the thing the item names.',
      does: 'Rings the thing to compare with in yellow on the grid. You may point to it and say its name; never say '
        + 'where the other thing is from it, which word fits or which square to tap.' });
  };
  const picture = (does: string, answers: string[]) => {
    const words = pictureWords(c, step);
    if (pictureLeaks(c, words, step)) return;
    levers.push({ id: PICTURE_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(PICTURE_LEVER), answers,
      when: 'The learner does not know what the position word means, or mixes it up with its opposite.', does });
  };
  const fewer = (does: string, answers: string[]) => {
    if (practiceItem(c, gridSize)) levers.push({ id: FEWER_LEVER, kind: 'simplify', carrier: 'shown',
      pulled: pulled.includes(FEWER_LEVER), answers, does,
      when: 'The learner cannot do this item even with the help on screen: a scene with less in it first.' });
  };
  const fence = 'You may point to the picture and say what it shows; never say which picture matches the scene, and '
    + 'never move the picture onto the grid or say which square it means.';
  switch (c.type) {
    case 'identify': case 'describe':
      mark(['other_axis_word']);
      picture(`Puts a small picture on every word button: a dot and a square showing what that word means. ${fence}`, WORD_MISSES);
      fewer(`Opens an ungraded practice scene with two other things and two words to choose from; ${back}`, WORD_MISSES);
      return levers;
    case 'place':
      mark(['other_axis_cell', 'off_line_cell']);
      picture(`Draws a small picture of the asked word beside the grid, with a dot and a square. ${fence}`, PLACE_MISSES);
      fewer(`Opens an ungraded practice scene: the same word round one other thing, with one right square; ${back}`, PLACE_MISSES);
      return levers;
    case 'place_in':
      picture(`Draws a small picture of "in" beside the grid: a dot inside a cup shape. ${fence} Never point to the `
        + 'thing on the grid it goes in.', IN_MISSES);
      fewer(`Opens an ungraded practice scene with one other container and one other thing; ${back}`, IN_MISSES);
      return levers;
    case 'place_between':
      mark(BETWEEN_MISSES);
      picture(`Draws a small picture of "between" beside the grid: a dot with a square on each side. ${fence}`, BETWEEN_MISSES);
      fewer(`Opens an ungraded practice scene with only two other things, on another line; ${back}`, BETWEEN_MISSES);
      return levers;
    case 'follow_directions':
      mark(['other_cell']);
      picture(`Draws a small picture of this step's word beside the step, with a dot and a square. ${fence}`, STEP_MISSES);
      return levers;
    case 'describe_scene':
      levers.push({ id: SIDES_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(SIDES_LEVER), answers: ['opposite_word'],
        when: 'The learner says the relation that points the other way (left for right, behind for in front of).',
        does: 'Puts a left hand at the bottom-left of the scene and a right hand at the bottom-right, labelled, and '
          + '"nearer you" by the YOU arrow, the same on every scene. You may point to them and to the learner\'s own '
          + 'hands; never say which side or how near the object is, or the relation.' });
      fewer(`Opens an ungraded practice scene with only two other things; ${back}`, ['opposite_word']);
      return levers;
  }
}

/** What the pulled help levers put on screen, for the tutor and JEV; never the answer. */
export function leverFacts(c: SpatialSceneChallenge, shown: readonly string[], step = 0): string | undefined {
  const facts = [
    shown.includes(MARK_LEVER) ? markFact(c, step) : '',
    shown.includes(PICTURE_LEVER) ? pictureFact(c, step) : '',
    shown.includes(SIDES_LEVER) ? SIDES_FACT : '',
  ].filter(Boolean);
  return facts.length ? facts.join(' ') : undefined;
}
