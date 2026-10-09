/**
 * The in-item levers on a letter-workshop item (`/add-support-tiers`, report
 * qa/eval-reports/letter-workshop-levers-2026-10-09.md). No real-learner evidence: the misses are what
 * `letterWorkshopMiss` observes and the catalog's documented struggles. Pure: the component draws from these, the
 * workspace publishes them, the tests hold each leak rule. Every simpler item has the id `<item>~simpler`, the same mode.
 *
 * - trace (the letter is drawn by design): `start_dots`, `stroke_arrows` on the dotted path (the tiers' own guides,
 *   now pullable), `writing_lines`; `trace_part` (simplify) its first stroke, or the first half of a one-stroke letter.
 * - copy (the model is the task): `model_strokes` the model drawn with numbered starts and arrows, never on the paper;
 *   `start_dots` points on the paper; `writing_lines`; `copy_part` (simplify) as trace_part.
 * - write (the shape is the answer): `start_dots` points only, `first_part` the opening of the first stroke, never
 *   more than a third of the letter (`firstPartLeaks`), `writing_lines`; `simpler_letter` (simplify) a different letter
 *   of the same case, one complexity step down, never this letter, its mirror or another item's letter.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { LetterWorkshopChallenge } from './LetterWorkshop';
import { getLetterTemplate, LETTER_TEMPLATES, type LetterTemplate } from './letterWorkshopGeometry';
import { letterStructure } from './letterWorkshopDifficulty';
import { pathLength, strokePrefix, type LetterWorkshopMiss } from './letterWorkshopWorkspace';

export const DOTS_LEVER = 'start_dots';
export const ARROWS_LEVER = 'stroke_arrows';
export const LINES_LEVER = 'writing_lines';
export const MODEL_STROKES_LEVER = 'model_strokes';
export const FIRST_PART_LEVER = 'first_part';
export const TRACE_PART_LEVER = 'trace_part';
export const COPY_PART_LEVER = 'copy_part';
export const SIMPLER_LETTER_LEVER = 'simpler_letter';
export const SIMPLER_SUFFIX = '~simpler';

const ALL: readonly LetterWorkshopMiss[] = ['other_letter', 'reversed', 'wrong_case', 'stroke_count', 'start_or_order',
  'part_left_out', 'extra_ink', 'direction_or_shape'];

type Decl = Omit<WorkspaceLever, 'pulled'>;
const DECL: Record<string, Decl> = {
  [DOTS_LEVER]: { id: DOTS_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner starts a stroke in the wrong place, draws the strokes out of order, or uses the wrong number of strokes',
    does: 'Puts a numbered dot on the paper where each stroke of the letter starts. Point to dot 1; do not describe the shape of any stroke.',
    answers: ['start_or_order', 'stroke_count', 'reversed'] },
  [ARROWS_LEVER]: { id: ARROWS_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner follows the path the wrong way or stops partway along it',
    does: 'Draws an arrow at the start of each stroke of the dotted letter, showing which way it goes.',
    answers: ['direction_or_shape', 'start_or_order', 'part_left_out'] },
  [LINES_LEVER]: { id: LINES_LEVER, kind: 'help', carrier: 'shown',
    when: 'the letter is the wrong size for its lines, the wrong case, or has marks off the letter',
    does: 'Labels the writing lines top, middle and base and shades the space between the middle and base lines. '
      + 'Say which lines the letter touches only if the letter is on the screen.',
    answers: ['wrong_case', 'extra_ink', 'part_left_out', 'direction_or_shape'] },
  [MODEL_STROKES_LEVER]: { id: MODEL_STROKES_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner\'s copy does not look like the model, or its strokes are out of order',
    does: 'Draws a numbered dot and an arrow at the start of each stroke on the model beside the paper. The paper stays blank.',
    answers: ['stroke_count', 'start_or_order', 'direction_or_shape', 'part_left_out', 'other_letter', 'reversed'] },
  [FIRST_PART_LEVER]: { id: FIRST_PART_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner cannot begin the letter from memory, writes another letter, or leaves part of it out',
    does: 'Draws the opening part of the letter\'s first stroke dotted on the paper; the learner writes the rest. '
      + 'Do not describe the rest of the shape.',
    answers: ['other_letter', 'reversed', 'part_left_out', 'direction_or_shape', 'start_or_order'] },
  [TRACE_PART_LEVER]: { id: TRACE_PART_LEVER, kind: 'simplify', carrier: 'shown',
    when: 'tracing the whole letter is too much at once',
    does: 'Opens an easier, ungraded practice: trace only the first part of this letter. Then the whole letter comes back blank.',
    answers: ALL },
  [COPY_PART_LEVER]: { id: COPY_PART_LEVER, kind: 'simplify', carrier: 'shown',
    when: 'copying the whole letter is too much at once',
    does: 'Opens an easier, ungraded practice: copy only the first part of this letter beside its model. Then the whole letter comes back blank.',
    answers: ALL },
  [SIMPLER_LETTER_LEVER]: { id: SIMPLER_LETTER_LEVER, kind: 'simplify', carrier: 'voiced',
    when: 'writing this letter from memory is too much at once',
    does: 'Opens an easier, ungraded practice: write a different, simpler letter of the same case, which you name as its task says. '
      + 'Then this letter comes back blank.',
    answers: ALL },
};

/** The simplify lever a mode has, if it has one. */
export const simplifyLeverOf = (mode: LetterWorkshopChallenge['type']) =>
  mode === 'trace' ? TRACE_PART_LEVER : mode === 'copy' ? COPY_PART_LEVER : SIMPLER_LETTER_LEVER;

/** The levers an item declares, in the order `nextLever` reads them (help before simplify). `others`: the session's other items. */
export function leverIdsFor(ch: LetterWorkshopChallenge, others: readonly LetterWorkshopChallenge[] = []): string[] {
  const simplify = practiceItem(ch, others) ? [simplifyLeverOf(ch.type)] : [];
  switch (ch.type) {
    case 'trace': return [DOTS_LEVER, ARROWS_LEVER, LINES_LEVER, ...simplify];
    case 'copy': return [MODEL_STROKES_LEVER, DOTS_LEVER, LINES_LEVER, ...simplify];
    case 'write': return [DOTS_LEVER, FIRST_PART_LEVER, LINES_LEVER, ...simplify];
  }
}

/** Where an item's guides start (its support tier's), as lever ids. Not a pull: never recorded. */
export function startingLevers(ch: LetterWorkshopChallenge, support: { showStarts: boolean; showArrows: boolean; showLineLabels: boolean }): string[] {
  return [
    ...(ch.type === 'trace' && support.showStarts ? [DOTS_LEVER] : []),
    ...(ch.type === 'trace' && support.showArrows ? [ARROWS_LEVER] : []),
    ...(support.showLineLabels ? [LINES_LEVER] : []),
  ];
}

export function letterWorkshopLevers(ch: LetterWorkshopChallenge, pulled: readonly string[],
  others: readonly LetterWorkshopChallenge[] = []): WorkspaceLever[] {
  return leverIdsFor(ch, others).map(id => ({ ...DECL[id], pulled: pulled.includes(id) }));
}

/** What the help levers in force have put on screen, in words the tutor and JEV read. Never the letter or its shape. */
export function leverFacts(ch: LetterWorkshopChallenge, on: readonly string[]): string | undefined {
  const n = getLetterTemplate(ch.templateId).strokes.length;
  const facts: Record<string, string> = {
    [DOTS_LEVER]: n > 1 ? `A numbered dot on the paper marks where each of the ${n} strokes starts.` : 'A dot on the paper marks where the stroke starts.',
    [ARROWS_LEVER]: 'An arrow at the start of each stroke of the dotted letter shows which way it goes.',
    [LINES_LEVER]: 'The writing lines are labelled top, middle and base, and the space between the middle and base lines is shaded.',
    [MODEL_STROKES_LEVER]: 'The model beside the paper has a numbered dot and an arrow where each of its strokes starts.',
    [FIRST_PART_LEVER]: 'The opening part of the first stroke is drawn dotted on the paper; the rest of the paper is blank.',
  };
  const shown = leverIdsFor(ch).filter(id => on.includes(id) && facts[id]).map(id => facts[id]);
  return shown.length ? shown.join(' ') : undefined;
}

// ── help-lever geometry and leak rules ──────────────────────────────────────

type Point = { x: number; y: number };

/** Where each stroke starts, numbered in drawing order. Points only: never a stroke's shape. */
export const startDots = (t: LetterTemplate): Point[] => t.strokes.filter(s => s.length > 0).map(s => s[0]);

/** `start_dots` leaks when it draws anything but each stroke's first point. */
export const startDotsLeak = (t: LetterTemplate, dots: readonly Point[]) =>
  dots.length !== t.strokes.length || dots.some((d, i) => d.x !== t.strokes[i][0].x || d.y !== t.strokes[i][0].y);

/** The opening of the first stroke `first_part` draws: at most a third of the letter's length and half its first stroke. */
export function firstPart(t: LetterTemplate): Point[] {
  const first = t.strokes[0] ?? [];
  if (first.length < 2) return [];
  const total = t.strokes.reduce((n, s) => n + pathLength(s), 0);
  return strokePrefix(first, Math.min(total / 3, pathLength(first) / 2));
}

const nearSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const r = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + dx * r), p.y - (a.y + dy * r));
};

/** `first_part` leaks when it is longer than a third of the letter or most of its first stroke, or leaves the first stroke's start. */
export function firstPartLeaks(t: LetterTemplate, part: readonly Point[]): boolean {
  const first = t.strokes[0] ?? [], total = t.strokes.reduce((n, s) => n + pathLength(s), 0);
  if (!part.length) return false;
  if (pathLength(part) > total / 3 + 0.5 || pathLength(part) > pathLength(first) / 2 + 0.5) return true;
  if (part[0].x !== first[0].x || part[0].y !== first[0].y) return true;
  return part.some(p => first.slice(1).every((b, i) => nearSegment(p, first[i], b) > 1));
}

// ── simplify builders ───────────────────────────────────────────────────────

const simplerId = (ch: LetterWorkshopChallenge) => `${ch.id}${SIMPLER_SUFFIX}`;
const MIRRORS: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };

/** trace / copy: the first part of this letter (`part`), the same mode. */
export function letterPart(ch: LetterWorkshopChallenge): LetterWorkshopChallenge | null {
  if (ch.type === 'write' || ch.part) return null;
  return { id: simplerId(ch), type: ch.type, templateId: ch.templateId, part: true, ...(ch.supportTier ? { supportTier: ch.supportTier } : {}) };
}

/**
 * write: a different letter of the same case, the most complex one simpler than this letter (one step down), never
 * this letter in either case, its mirror, or a letter another item of the session asks for. None for the simplest.
 */
export function simplerLetter(ch: LetterWorkshopChallenge, others: readonly LetterWorkshopChallenge[] = []): LetterWorkshopChallenge | null {
  if (ch.type !== 'write' || ch.part) return null;
  const t = getLetterTemplate(ch.templateId), own = letterStructure(t.id).complexity;
  const banned = new Set([t.letter.toLowerCase(), MIRRORS[t.letter.toLowerCase()] ?? '',
    ...others.map(o => getLetterTemplate(o.templateId).letter.toLowerCase())]);
  const pick = LETTER_TEMPLATES.filter(c => c.letterCase === t.letterCase && !banned.has(c.letter.toLowerCase())
    && letterStructure(c.id).complexity < own)
    .sort((a, b) => letterStructure(b.id).complexity - letterStructure(a.id).complexity || a.letter.localeCompare(b.letter))[0];
  return pick ? { id: simplerId(ch), type: 'write', templateId: pick.id, ...(ch.supportTier ? { supportTier: ch.supportTier } : {}) } : null;
}

/** A practice item leaks when it is the source item: the whole letter again, or (write) the same letter, its mirror or case. */
export function practiceLeaks(source: LetterWorkshopChallenge, practice: LetterWorkshopChallenge): boolean {
  if (practice.id === source.id || practice.type !== source.type) return true;
  if (source.type !== 'write') return !practice.part || practice.templateId !== source.templateId;
  const a = getLetterTemplate(source.templateId).letter.toLowerCase(), b = getLetterTemplate(practice.templateId).letter.toLowerCase();
  return a === b || MIRRORS[a] === b;
}

/** The easier item this item's simplify lever opens. */
export function practiceItem(ch: LetterWorkshopChallenge, others: readonly LetterWorkshopChallenge[] = []): LetterWorkshopChallenge | null {
  return ch.type === 'write' ? simplerLetter(ch, others) : letterPart(ch);
}

/** The item a `~simpler` practice id came from. */
export const practiceParent = (challenges: readonly LetterWorkshopChallenge[], id: string | null | undefined) =>
  id?.endsWith(SIMPLER_SUFFIX) ? challenges.find(c => `${c.id}${SIMPLER_SUFFIX}` === id) ?? null : null;

export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back blank after it.';
