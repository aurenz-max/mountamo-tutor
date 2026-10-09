/**
 * The in-item levers on a pattern-builder item (`/add-support-tiers`, report
 * qa/eval-reports/pattern-builder-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `patternBuilderMiss` observes. Pure: the component draws from these, the workspace publishes them, the tests hold
 * each leak rule. Every simpler item has the id `<item>~simpler`, the same mode, and is built by `practiceItem`.
 *
 * - create: `shape_model` (help) the asked shape twice in pictures off the palette (`modelLeaks`); `shape_ab`
 *   (simplify) an A B ask with the same palette, never when A B is the ask.
 * - extend / find_rule, a row that repeats: `repeat_groups` (help) a gap in the SHOWN row each time it starts over,
 *   never on a blank. A row of numbers that does not repeat: `number_line` (help) the shown numbers as dots on a line
 *   that spans them only, a hop between neighbours and no hop size written (`lineLeaks`).
 * - identify_core: the part IS the answer, so the help acts on a model outside the item: `core_model` (help) a row of
 *   pictures off the palette, its own repeating part boxed, of a different shape from the item's part (`coreModelLeaks`).
 * - translate: `place_marker` (help) a marker under the next place of the original row and a tick under each place
 *   made, from the learner's own row; it never names a new token (`markerFact`).
 * - extend, identify_core, translate, find_rule: `simpler_row` (simplify) a shorter or plainer row of the same mode in
 *   other tokens or with a different step (`practiceLeaks`). Never offered on an item already the plainest shape.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { PatternBuilderChallenge, PatternBuilderData } from './PatternBuilder';
import {
  activeMapping, activeSequence, createInstruction, paletteFor, repeatedPart, shapeLetters, shapeOf, translationOf,
} from './patternBuilderWorkspace';

export const MODEL_LEVER = 'shape_model';
export const AB_LEVER = 'shape_ab';
export const GROUPS_LEVER = 'repeat_groups';
export const LINE_LEVER = 'number_line';
export const CORE_MODEL_LEVER = 'core_model';
export const MARKER_LEVER = 'place_marker';
export const SIMPLER_LEVER = 'simpler_row';
export const PRACTICE_SUFFIX = '~simpler';

/** What a lever reads beyond the item: the lesson's shared pattern and key, and every item (for "still ahead"). */
export type PatternSession = Pick<PatternBuilderData, 'sequence' | 'tokens' | 'translationTarget' | 'showOptions'>
  & { challenges?: readonly PatternBuilderChallenge[] };

const lower = (t: string) => t.toLowerCase();
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((t, i) => lower(t) === lower(b[i]));
const startsWith = (row: readonly string[], head: readonly string[]) => head.length > 0 && head.length <= row.length
  && head.every((t, i) => lower(t) === lower(row[i]));
const distinct = (row: readonly string[]) => row.filter((t, i) => row.findIndex(u => lower(u) === lower(t)) === i);

/** The items from `c` on: an answer still to be given. */
const ahead = (c: PatternBuilderChallenge, session: PatternSession) => {
  const all = session.challenges ?? [];
  const at = all.findIndex(x => x.id === c.id);
  return at < 0 ? [c, ...all] : all.slice(at);
};

// ── model pictures (create, identify_core) ─────────────────────────────────

/** Model pictures, none of them a pattern-builder token: each is drawn as itself, and its name goes to the tutor. */
const MODEL_POOL: ReadonlyArray<{ glyph: string; name: string }> = [
  { glyph: '🍎', name: 'apple' }, { glyph: '🐟', name: 'fish' }, { glyph: '⚽', name: 'ball' },
  { glyph: '🌙', name: 'moon' }, { glyph: '🍌', name: 'banana' }, { glyph: '🐢', name: 'turtle' },
];

export interface ShapeModel { glyphs: string[]; names: string[] }

/** The leak rule: a model token the learner could tap (by name or as drawn) would make the model a row to copy. */
export function modelLeaks(model: ShapeModel, palette: readonly string[]): boolean {
  const onPalette = new Set(palette.map(lower));
  return [...model.glyphs, ...model.names].some(t => onPalette.has(lower(t)));
}

/** `shape` repeated `times`, in the first pictures `avoid` does not hold; null with too few pictures. */
function modelRow(shape: string, times: number, avoid: readonly string[]): ShapeModel | null {
  const off = new Set(avoid.map(lower));
  const free = MODEL_POOL.filter(p => !off.has(p.glyph) && !off.has(p.name));
  const letters = Array.from(new Set(shape.split('')));
  if (free.length < letters.length) return null;
  const row = Array.from({ length: times }, () => shape.split('')).flat().map(l => free[letters.indexOf(l)]);
  const model = { glyphs: row.map(p => p.glyph), names: row.map(p => p.name) };
  return modelLeaks(model, avoid) ? null : model;
}

/** create: the asked shape twice, in pictures the palette does not hold; null with no shape or too few pictures. */
export function shapeModel(c: PatternBuilderChallenge, palette: readonly string[]): ShapeModel | null {
  const shape = c.type === 'create' ? c.createShape : undefined;
  return shape ? modelRow(shape, 2, palette) : null;
}

/** What a pulled model puts on screen, for the tutor and JEV: the pictures drawn, which are not the learner's tokens. */
export function modelFact(model: ShapeModel): string {
  return `A model row beside the build: ${model.names.join(', ')} (pictures, not on the palette)`;
}

// ── identify_core: a model row with its part boxed ─────────────────────────

const MODEL_SHAPES = ['AB', 'ABB', 'AAB', 'ABC'] as const;
export interface CoreModel extends ShapeModel { shape: string }

/** The shape of the item's repeating part: the shortest part its row repeats, else the declared core. */
const partShape = (data: PatternSession, c: PatternBuilderChallenge) => {
  const seq = activeSequence(data, c);
  return shapeOf(repeatedPart(seq.given) ?? seq.core);
};

/** Leak rule: a model of the item's own shape boxes the answer's length and shape; a model token on the palette or
 *  in the row is a part to copy. */
export function coreModelLeaks(model: CoreModel, data: PatternSession, c: PatternBuilderChallenge): boolean {
  return model.shape === partShape(data, c) || modelLeaks(model, [...paletteFor(data, c), ...activeSequence(data, c).given]);
}

/** Three repeats of a shape other than the item's part, preferring one no identify item still ahead has. */
export function coreModel(data: PatternSession, c: PatternBuilderChallenge): CoreModel | null {
  if (c.type !== 'identify_core') return null;
  const own = partShape(data, c);
  const later = new Set(ahead(c, data).filter(x => x.type === 'identify_core').map(x => partShape(data, x)));
  const order = [...MODEL_SHAPES.filter(s => !later.has(s)), ...MODEL_SHAPES.filter(s => later.has(s))].filter(s => s !== own);
  const avoid = [...paletteFor(data, c), ...activeSequence(data, c).given];
  for (const shape of order) {
    const row = modelRow(shape, 3, avoid);
    const model = row && { ...row, shape };
    if (model && !coreModelLeaks(model, data, c)) return model;
  }
  return null;
}

export function coreModelFact(model: CoreModel): string {
  const k = model.shape.length;
  const parts = Array.from({ length: model.names.length / k }, (_, i) => `[${model.names.slice(i * k, i * k + k).join(', ')}]`);
  return `A model row beside the item, in other pictures, with its own repeating part boxed each time: ${parts.join(' ')} `
    + '(pictures, not the learner\'s tokens; nothing is boxed on the learner\'s row)';
}

// ── extend / find_rule: gaps in the shown row, or a number line ────────────

/** The length of the part the SHOWN row repeats (at least two different tokens), or null. Gaps go on the shown row
 *  only, so the blanks are never touched; never on identify_core, where the part is the answer. */
export function repeatGroups(data: PatternSession, c: PatternBuilderChallenge): number | null {
  if (c.type !== 'extend' && c.type !== 'find_rule') return null;
  const given = activeSequence(data, c).given;
  const part = repeatedPart(given);
  return part && distinct(part).length >= 2 && part.length < given.length ? part.length : null;
}

export function groupsFact(data: PatternSession, c: PatternBuilderChallenge, k: number): string {
  const given = activeSequence(data, c).given;
  const groups = Array.from({ length: Math.ceil(given.length / k) }, (_, i) => given.slice(i * k, i * k + k).join(', '));
  return `The shown row is drawn with a gap each time it starts over: ${groups.join(' | ')} (no gap or mark on the blanks)`;
}

const numeric = (t: string) => /^-?\d+(\.\d+)?$/.test(t.trim());
export interface NumberLineModel { min: number; max: number; points: number[] }

/** The shown numbers as dots on a line that spans them only, when the row is numbers that do not repeat. */
export function numberLine(data: PatternSession, c: PatternBuilderChallenge): NumberLineModel | null {
  if ((c.type !== 'extend' && c.type !== 'find_rule') || repeatGroups(data, c) !== null) return null;
  const given = activeSequence(data, c).given;
  if (given.length < 2 || !given.every(numeric)) return null;
  const points = given.map(Number), min = Math.min(...points), max = Math.max(...points);
  return min === max ? null : { min, max, points };
}

/** Leak rule: the line draws only the shown numbers, and ends at them; it never reaches a place a blank would land. */
export function lineLeaks(line: NumberLineModel, data: PatternSession, c: PatternBuilderChallenge): boolean {
  const shown = activeSequence(data, c).given.map(Number);
  return line.points.some(p => !shown.includes(p)) || line.min < Math.min(...shown) || line.max > Math.max(...shown);
}

export function lineFact(line: NumberLineModel): string {
  return `A number line beside the row from ${line.min} to ${line.max}, the row's numbers as dots on it (${line.points.join(', ')}), `
    + 'and a hop drawn from each dot to the next with no size written';
}

// ── translate: the place marker ────────────────────────────────────────────

/** Where the marker is: the next place of the original row to make, from how many tokens the learner has placed. */
export const markerPlace = (data: PatternSession, c: PatternBuilderChallenge, placed: number) =>
  c.type === 'translate' && placed < activeSequence(data, c).given.length ? placed : null;

/** Says only places and counts, never a token, so it ties no key entry to a place. */
export function markerFact(data: PatternSession, c: PatternBuilderChallenge, placed: number): string {
  const n = activeSequence(data, c).given.length;
  return placed < n
    ? `A marker under place ${placed + 1} of ${n} on the original row (the next to make), and a tick under each of the ${placed} places made`
    : `A tick under every place of the original row (${placed} tokens made for ${n} places)`;
}

// ── simpler items ──────────────────────────────────────────────────────────

/** What the learner must produce on an item: the blanks, the part, or the new row. */
const answerOf = (data: PatternSession, c: PatternBuilderChallenge): string[] => {
  const seq = activeSequence(data, c);
  if (c.type === 'identify_core') return seq.core;
  if (c.type === 'translate') return translationOf(data, c) ?? [];
  return seq.hidden;
};

/**
 * Leak rule for a simpler item: never the item's own id or row (or a row one is the start of), never an answer that
 * is the item's answer or its start, and never the row of another item in the lesson.
 */
export function practiceLeaks(practice: PatternBuilderChallenge, c: PatternBuilderChallenge, data: PatternSession): boolean {
  if (practice.id === c.id || practice.type !== c.type) return true;
  const pg = activeSequence(data, practice).given, ig = activeSequence(data, c).given;
  if (startsWith(ig, pg) || startsWith(pg, ig)) return true;
  const pa = answerOf(data, practice), ia = answerOf(data, c);
  if (startsWith(ia, pa) || startsWith(pa, ia)) return true;
  return (data.challenges ?? []).some(x => x.type !== 'create' && same(activeSequence(data, x).given, pg));
}

const practiceOf = (c: PatternBuilderChallenge, fields: Partial<PatternBuilderChallenge>): PatternBuilderChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, supportTier: undefined, hint: '', narration: '', ...fields });

const INSTRUCTION: Record<'extend' | 'identify_core' | 'translate' | 'find_rule', string> = {
  extend: 'Look at this pattern. What comes next? Fill the blank.',
  identify_core: 'Tap the smallest part that repeats in this pattern.',
  translate: 'Make the same pattern with the new tokens. Follow the key.',
  find_rule: 'Look at how the numbers change. Fill in the next number.',
};

/** extend, identify_core: two tokens taking turns, in other tokens first. extend: one blank (two when the item's part
 *  is longer than two); identify_core: three repeats. Null when the item is already A B (with one blank on extend). */
function shorterRepeat(c: PatternBuilderChallenge, data: PatternSession): PatternBuilderChallenge | null {
  const seq = activeSequence(data, c);
  const k = (repeatedPart(seq.given) ?? seq.core).length;
  const extend = c.type !== 'identify_core';
  if (k <= 2 && (!extend || seq.hidden.length <= 1)) return null;
  const blanks = k > 2 ? Math.min(2, Math.max(1, seq.hidden.length)) : 1;
  const palette = distinct(paletteFor(data, c));
  const inRow = new Set(seq.given.map(lower));
  const order = [...palette.filter(t => !inRow.has(lower(t))), ...palette.filter(t => inRow.has(lower(t)))];
  for (const a of order) for (const b of order) {
    if (lower(a) === lower(b)) continue;
    const given = [a, b, a, b, a, b];
    const practice = practiceOf(c, {
      instruction: INSTRUCTION[extend ? 'extend' : 'identify_core'],
      sequence: extend ? { given, hidden: [a, b].slice(0, blanks), core: [a, b] } : { given, hidden: [a, b], core: [a, b] },
      answer: extend ? [a, b].slice(0, blanks) : [a, b],
      availableTokens: paletteFor(data, c),
    });
    if (!practiceLeaks(practice, c, data)) return practice;
  }
  return null;
}

/** The constant step a number row adds, or null. */
const stepOf = (row: readonly string[]): number | null => {
  if (row.length < 2 || !row.every(numeric)) return null;
  const n = row.map(Number), d = n[1] - n[0];
  return n.every((v, i) => i === 0 || v - n[i - 1] === d) ? d : null;
};
const SKIP_STEPS = [2, 1, 10, 5] as const;

/** find_rule (and a number extend): add the same small step four times, one blank, a step other than the item's and
 *  any number item's still ahead. Null when the item already adds 1, 2, 5 or 10. */
function simplerRule(c: PatternBuilderChallenge, data: PatternSession): PatternBuilderChallenge | null {
  const own = stepOf(activeSequence(data, c).given);
  if (own !== null && (SKIP_STEPS as readonly number[]).includes(own)) return null;
  const used = new Set(ahead(c, data).map(x => stepOf(activeSequence(data, x).given)).filter((s): s is number => s !== null));
  for (const s of SKIP_STEPS.filter(x => !used.has(x))) {
    for (const start of [s, 1, 3, 10]) {
      const given = [0, 1, 2, 3].map(i => String(start + i * s)), ans = start + 4 * s;
      const choices = Array.from(new Set([ans - s, ans - 1, ans, ans + 1, ans + s])).filter(v => v > 0).sort((x, y) => x - y);
      const practice = practiceOf(c, {
        instruction: INSTRUCTION[c.type === 'extend' ? 'extend' : 'find_rule'],
        sequence: { given, hidden: [String(ans)], core: [...given, String(ans)] },
        answer: [String(ans)], availableTokens: choices.map(String),
      });
      if (!practiceLeaks(practice, c, data)) return practice;
    }
  }
  return null;
}

/** translate: B A B A with the first two tokens of the item's part and their key entries (a row the item's does not
 *  start with). Null when the item is already A B four long. */
function shorterTranslate(c: PatternBuilderChallenge, data: PatternSession): PatternBuilderChallenge | null {
  const seq = activeSequence(data, c), mapping = activeMapping(data, c);
  if (!mapping) return null;
  const k = (repeatedPart(seq.given) ?? seq.core).length;
  if (k <= 2 && seq.given.length <= 4) return null;
  const [a, b] = distinct(seq.given);
  const to = (t: string) => mapping[lower(t)] ?? mapping[t];
  if (!a || !b || !to(a) || !to(b)) return null;
  const given = [b, a, b, a];
  const practice = practiceOf(c, {
    instruction: INSTRUCTION.translate,
    sequence: { given, hidden: given.map(to), core: [b, a] },
    translationMapping: { [a]: to(a), [b]: to(b) },
    answer: given.map(to), availableTokens: [to(a), to(b)],
  });
  return practiceLeaks(practice, c, data) ? null : practice;
}

/** A B practice for create: the same palette, asking for A B. Null when A B (or no shape) is already the ask. */
export function abPractice(c: PatternBuilderChallenge): PatternBuilderChallenge | null {
  if (c.type !== 'create' || !c.createShape || c.createShape === 'AB') return null;
  return { ...c, id: `${c.id}${PRACTICE_SUFFIX}`, createShape: 'AB', instruction: createInstruction('AB'), supportTier: undefined };
}

/** The simpler item for a session item, same mode, or null on an item already the plainest shape. */
export function practiceItem(c: PatternBuilderChallenge, data: PatternSession): PatternBuilderChallenge | null {
  switch (c.type) {
    case 'create': return abPractice(c);
    case 'translate': return shorterTranslate(c, data);
    case 'identify_core': return shorterRepeat(c, data);
    case 'extend':
    case 'find_rule': return numberLine(data, c) ? simplerRule(c, data) : shorterRepeat(c, data);
  }
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly PatternBuilderChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/** Easy starts with the item's help shown (the learner can check against it); a starting position is not a pull. */
export const helpStartsShown = (c: PatternBuilderChallenge) => c.supportTier === 'easy';

const ROW_MISSES = ['repeated_last', 'started_over', 'one_wrong', 'two_swapped', 'several_wrong'];

/** The levers on a session item. `pulled` holds this item's runtime pulls. */
export function patternBuilderLevers(c: PatternBuilderChallenge | null, data: PatternSession, pulled: readonly string[]):
  WorkspaceLever[] {
  if (!c) return [];
  const levers: WorkspaceLever[] = [];
  const isOn = (id: string) => helpStartsShown(c) || pulled.includes(id);
  const help = (id: string, when: string, does: string, answers: string[]) =>
    levers.push({ id, kind: 'help', carrier: 'shown', when, does, pulled: isOn(id), answers });
  const simplify = (does: string, answers: string[]) => {
    if (practiceItem(c, data)) levers.push({ id: SIMPLER_LEVER, kind: 'simplify', carrier: 'shown',
      when: 'The learner cannot do this item even with the help on screen: a smaller one first.', does,
      pulled: pulled.includes(SIMPLER_LEVER), answers });
  };
  const back = 'then this item comes back blank.';
  switch (c.type) {
    case 'create': {
      if (!c.createShape) return [];
      const shape = shapeLetters(c.createShape);
      if (shapeModel(c, paletteFor(data, c))) help(MODEL_LEVER,
        `The learner's row is not a ${shape} part made twice, or they do not know how a ${shape} pattern goes.`,
        `Draws a model ${shape} pattern beside the row, two times, in pictures that are not on the palette. `
          + 'You may point to it and say the pictures; never turn it into the learner\'s tokens.',
        ['too_short', 'other_shape', 'no_repeat']);
      if (abPractice(c)) levers.push({
        id: AB_LEVER, kind: 'simplify', carrier: 'shown',
        when: `The learner cannot make ${shape} even with the model: a smaller ask first.`,
        does: `Opens an ungraded practice row asking for A B (two things taking turns) with the same tokens; then the ${shape} item comes back blank.`,
        pulled: pulled.includes(AB_LEVER), answers: ['other_shape', 'no_repeat'],
      });
      return levers;
    }
    case 'extend':
    case 'find_rule':
      if (repeatGroups(data, c)) help(GROUPS_LEVER,
        'The learner fills the blanks with tokens that do not keep the pattern going, or cannot tell where it starts over.',
        'Draws a gap in the shown row each time the pattern starts over; nothing on the blanks. You may point to the gaps '
          + 'and read the groups; never say a blank\'s token or point to its choice.', ROW_MISSES);
      else if (numberLine(data, c)) help(LINE_LEVER,
        'The learner cannot see how the numbers change from one to the next.',
        'Draws the row\'s numbers as dots on a number line beside it, spanning only those numbers, with a hop from each '
          + 'to the next and no size written. You may point to the hops; never say a hop size, the rule or a next number.', ROW_MISSES);
      simplify(numberLine(data, c)
        ? `Opens an ungraded practice row that adds the same small number each time, with one blank; ${back}`
        : `Opens an ungraded practice row of two other tokens taking turns, with fewer blanks; ${back}`,
        ['repeated_last', 'started_over', 'several_wrong']);
      return levers;
    case 'identify_core':
      if (coreModel(data, c)) help(CORE_MODEL_LEVER,
        'The learner selects more or less than one repeat, or a part that is not the one that repeats.',
        'Draws a model row beside the item in other pictures, its own repeating part boxed each time; the model has a '
          + 'different shape from this row. You may point to the model and say its pictures; never box, count or name a '
          + 'part of the learner\'s row.', ['two_repeats', 'too_long', 'too_short', 'other_part']);
      simplify(`Opens an ungraded practice row of two tokens taking turns; ${back}`, ['two_repeats', 'too_long', 'other_part']);
      return levers;
    case 'translate':
      if (activeMapping(data, c)) help(MARKER_LEVER,
        'The learner loses their place in the original row, leaves places out, or makes too many.',
        'Puts a marker under the next place of the original row to make and a tick under each place made, following '
          + 'the learner\'s own row. You may point to the marked token and to the key; never say which new token goes there.',
        ['blanks_left', 'extra_tokens', 'one_wrong', 'two_swapped', 'several_wrong']);
      simplify(`Opens an ungraded practice row: a shorter pattern of two tokens with their key; ${back}`, ['two_swapped', 'several_wrong']);
      return levers;
  }
}

export const PRACTICE_NOTE = 'An easier practice row, ungraded; the full item comes back after it.';
