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
 *
 * The other six modes (report qa/eval-reports/equation-builder-levers-2026-10-08.md), from the misses
 * `equationBuilderMiss` observes and the catalog's documented struggles (no real-learner evidence):
 * - `number_dots` (help, build-simple + rewrite): the same dots, under the learner's own row tiles. Answers
 *   `false_equation`. Leak rule: the learner's numbers only; never a side's value.
 * - `equation_frame` (help, build-simple): empty boxes in the target's shape, a circle for its sign, the = in place.
 *   Answers `unfinished_equation`. Leak rule: no number and no + or − is drawn (`frameLeaks`).
 * - `printed_dots` (help, missing-result, missing-operand, true-false, balance-both-sides): dots under each number
 *   printed in the equation. Leak rule: none under the ?, never a side's total (`printedDots`).
 * - `rewrite_model` (model, rewrite): an example equation and the same one turned around the =, in numbers the item
 *   does not use. Leak rule: no number of the item, not an accepted form (`rewriteModelLeaks`).
 * - `match_marks` (help, rewrite): a ring on each pool tile showing a number printed in the equation; never a sign.
 * - `smaller_numbers` (simplify, all six): an ungraded practice item of the same type and sign, numbers about half
 *   (`practiceItem`). Leak rule: never the item's numbers (`repeatsItem`), and never the item's missing number.
 * Easy starts with the dots lever shown (a starting position, never a recorded pull); make-n starts bare.
 *
 * Declared once as a lever set (`EQUATION_BUILDER_LEVERS`, `bossLevers.ts`): the dots and match marks are `marks`, the
 * frames `layout`, the rewrite example `model` (when it comes is the set's `support`), the practice items `easier`.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { EquationBuilderChallenge } from './EquationBuilder';
import { EQUATION_BUILDER_MISSES_BY_MODE, equationBuilderMode, parseEquationTokens, type EquationBuilderMiss,
  type EquationBuilderTier } from './equationBuilderWorkspace';

export const DOTS_LEVER = 'number_dots';
export const FRAME_LEVER = 'sentence_frame';
export const SMALLER_LEVER = 'smaller_total';
export const PRACTICE_SUFFIX = '~smaller';

/** The easier ask for a make-n item, or null: about half the total, one way, + only, the same bank numbers up to it. */
export function smallerMakeN(c: EquationBuilderChallenge): EquationBuilderChallenge | null {
  if (c.type !== 'make-n' || c.target === undefined) return null;
  const target = Math.ceil(c.target / 2);
  if (target < 2 || target >= c.target) return null;
  const numbers = Array.from({ length: target }, (_, i) => String(i + 1));
  return { id: `${c.id}${PRACTICE_SUFFIX}`, type: 'make-n', target, ways: 1, availableTiles: [...numbers, '+'],
    instruction: `Make a number sentence that equals ${target}.` };
}

// ── The other six modes ─────────────────────────────────────────────────────

export const EQ_FRAME_LEVER = 'equation_frame';
export const PRINTED_DOTS_LEVER = 'printed_dots';
export const REWRITE_MODEL_LEVER = 'rewrite_model';
export const MATCH_LEVER = 'match_marks';
export const SMALLER_NUMBERS_LEVER = 'smaller_numbers';

type Op = '+' | '-';
/** A fact a op b = c, and whether it is printed whole-first ("c = a op b"). */
export interface Fact { a: number; op: Op; b: number; c: number; flipped?: boolean }

const isNum = (t: string) => /^\d+$/.test(t);
const asOp = (t: string): Op | null => t === '+' ? '+' : t === '-' || t === '−' ? '-' : null;

/** Reads "a op b = c" or "c = a op b" (a "?" read as `missing`); null for any other shape. */
export function factOf(eq: string, missing?: number): Fact | null {
  const t = parseEquationTokens(eq).map(x => x === '?' && missing !== undefined ? String(missing) : x);
  if (t.length !== 5) return null;
  if (isNum(t[0]) && asOp(t[1]) && isNum(t[2]) && t[3] === '=' && isNum(t[4])) return { a: +t[0], op: asOp(t[1])!, b: +t[2], c: +t[4] };
  if (isNum(t[0]) && t[1] === '=' && isNum(t[2]) && asOp(t[3]) && isNum(t[4])) return { a: +t[2], op: asOp(t[3])!, b: +t[4], c: +t[0], flipped: true };
  return null;
}

/** The fact written out, in its printed order, with the token at `blank` as "?". */
export function factText(f: Fact, blank = -1): string {
  const t = f.flipped ? [f.c, '=', f.a, f.op, f.b] : [f.a, f.op, f.b, '=', f.c];
  return t.map((x, i) => i === blank ? '?' : String(x)).join(' ');
}
const tokenValue = (f: Fact, index: number) => Number(factText(f).split(' ')[index]);

/**
 * The same sign, numbers about half: a + b = c makes a sum about half of c; a − b = c starts from about half of a.
 * Null when the fact is already that small (a sum or a start below 3). `swap` gives the other order of the parts.
 */
export function smallerFact(f: Fact, swap = false): Fact | null {
  if (f.op === '+') {
    const c = Math.ceil(f.c / 2);
    if (c < 2 || c >= f.c) return null;
    const big = Math.ceil(c / 2);
    return { a: swap ? c - big : big, op: '+', b: swap ? big : c - big, c, flipped: f.flipped };
  }
  const a = Math.ceil(f.a / 2);
  if (a < 2 || a >= f.a) return null;
  const b = swap ? Math.ceil(a / 2) : Math.floor(a / 2);
  return { a, op: '-', b, c: a - b, flipped: f.flipped };
}

/** A smaller fact whose value at `blank` is not `avoid`, so the practice item never shows the item's answer. */
function smallerAvoiding(f: Fact, blank: number, avoid: number | undefined): Fact | null {
  for (const swap of [false, true]) {
    const s = smallerFact(f, swap);
    if (s && tokenValue(s, blank) !== avoid) return s;
  }
  return null;
}

/** Every way to write a family (two parts, one whole), as the generator accepts them, less `except`. */
export function familyForms(a: number, b: number, c: number, except = ''): string[] {
  const out: string[] = [];
  for (const form of [`${a} + ${b} = ${c}`, `${b} + ${a} = ${c}`, `${c} = ${a} + ${b}`, `${c} = ${b} + ${a}`,
    `${c} - ${a} = ${b}`, `${c} - ${b} = ${a}`, `${b} = ${c} - ${a}`, `${a} = ${c} - ${b}`]) {
    if (!out.includes(form) && form.replace(/\s+/g, '') !== except.replace(/\s+/g, '')) out.push(form);
  }
  return out;
}

/** Each tile any of the forms needs, as many times as one form needs it. */
function neededTiles(forms: string[]): string[] {
  const need = new Map<string, number>();
  for (const form of forms) {
    const counts = new Map<string, number>();
    for (const t of parseEquationTokens(form)) counts.set(t, (counts.get(t) ?? 0) + 1);
    counts.forEach((n, t) => need.set(t, Math.max(n, need.get(t) ?? 0)));
  }
  return Array.from(need).flatMap(([t, n]) => Array<string>(n).fill(t));
}

const numbersOf = (text: string) => (text.match(/\d+/g) ?? []).map(Number).sort((x, y) => x - y);
const practiceId = (c: EquationBuilderChallenge) => `${c.id}${PRACTICE_SUFFIX}`;

/** The value of a balance side: a number or "a + b" / "a − b"; null otherwise. */
const sideValue = (side: string) => {
  const t = parseEquationTokens(side);
  if (t.length === 1 && isNum(t[0])) return +t[0];
  if (t.length === 3 && isNum(t[0]) && isNum(t[2]) && asOp(t[1])) return asOp(t[1]) === '+' ? +t[0] + +t[2] : +t[0] - +t[2];
  return null;
};

/** The practice balance: the left side about half, as a + b; the right keeps where its ? is, with + only. */
function smallerBalance(c: EquationBuilderChallenge): EquationBuilderChallenge | null {
  const left = sideValue(c.leftSide ?? ''), right = parseEquationTokens(c.rightSide ?? '');
  if (left === null) return null;
  const total = Math.ceil(left / 2);
  if (total < 2 || total >= left) return null;
  const big = Math.ceil(total / 2);
  const base = { id: practiceId(c), type: 'balance' as const, instruction: 'Make both sides equal.', leftSide: `${big} + ${total - big}` };
  if (right.length === 1 && right[0] === '?') return total === c.correctAnswer ? null : { ...base, rightSide: '?', correctAnswer: total };
  const q = right.indexOf('?');
  if (right.length !== 3 || asOp(right[1]) !== '+' || (q !== 0 && q !== 2)) return null;
  for (const known of [1, total - 1]) {
    const answer = total - known;
    if (known < 1 || answer < 1 || answer === c.correctAnswer) continue;
    return { ...base, rightSide: q === 0 ? `? + ${known}` : `${known} + ?`, correctAnswer: answer };
  }
  return null;
}

/**
 * The ungraded practice item a `smaller_numbers` (or make-n `smaller_total`) pull puts in place of the session item:
 * the same type, the same sign, numbers about half. Null when the item is already the plainest shape.
 */
export function practiceItem(c: EquationBuilderChallenge): EquationBuilderChallenge | null {
  switch (c.type) {
    case 'make-n': return smallerMakeN(c);
    case 'build': {
      const f = factOf(c.targetEquation ?? ''), s = f && smallerFact({ ...f, flipped: false });
      if (!s) return null;
      const target = factText(s);
      return { id: practiceId(c), type: 'build', targetEquation: target, availableTiles: [...parseEquationTokens(target), String(s.c + 1)],
        instruction: `Build the equation: ${s.a} ${s.op === '+' ? 'plus' : 'minus'} ${s.b} equals ${s.c}.` };
    }
    case 'missing-value': {
      const blank = parseEquationTokens(c.equation ?? '').indexOf('?');
      const f = factOf(c.equation ?? '', c.correctValue), s = f && smallerAvoiding(f, blank, c.correctValue);
      if (!s) return null;
      const answer = tokenValue(s, blank), foil = answer < 3 ? answer + 3 : answer - 3;
      return { id: practiceId(c), type: 'missing-value', instruction: 'What number makes this true?', equation: factText(s, blank),
        missingPosition: blank, correctValue: answer, options: [answer, foil].sort((x, y) => x - y) };
    }
    case 'true-false': {
      const t = parseEquationTokens(c.displayEquation ?? '');
      const opSide = t[1] === '=' ? t.slice(2).join(' ') : t.slice(0, 3).join(' ');
      const v = sideValue(opSide), f = v === null ? null : factOf(`${opSide} = ${v}`);
      const s = f && smallerFact(f);
      if (!s) return null;
      // True or false by the item's id, never from the item's own answer.
      const isTrue = Array.from(c.id).reduce((n, ch) => n + ch.charCodeAt(0), 0) % 2 === 0;
      return { id: practiceId(c), type: 'true-false', instruction: 'Is this equation true or false?',
        displayEquation: factText(isTrue ? s : { ...s, c: s.c + 2 }), isTrue };
    }
    case 'balance': return smallerBalance(c);
    case 'rewrite': {
      const f = factOf(c.originalEquation ?? '');
      if (!f) return null;
      // The family's two parts and whole; a − b = c has the whole a.
      const fam = f.op === '+' ? { a: f.a, b: f.b, c: f.c } : { a: f.b, b: f.c, c: f.a };
      const s = smallerFact({ ...fam, op: '+' });
      if (!s) return null;
      const small: Fact = f.op === '+' ? { ...s, flipped: f.flipped } : { a: s.c, op: '-', b: s.a, c: s.b, flipped: f.flipped };
      const original = factText(small), acceptedForms = familyForms(s.a, s.b, s.c, original);
      return { id: practiceId(c), type: 'rewrite', instruction: 'Write this equation another way.', originalEquation: original,
        acceptedForms, availableTiles: neededTiles([original, ...acceptedForms]) };
    }
  }
}

/** The equation a challenge prints or asks for (balance: both sides). */
const equationOf = (c: EquationBuilderChallenge) => c.targetEquation ?? c.equation ?? c.displayEquation ?? c.originalEquation
  ?? `${c.leftSide ?? ''} = ${c.rightSide ?? ''}`;

/** The practice leak rule: a practice item repeats the session item when its equation has the same numbers. */
export const repeatsItem = (practice: EquationBuilderChallenge, item: EquationBuilderChallenge) =>
  numbersOf(equationOf(practice)).join() === numbersOf(equationOf(item)).join();

/** The session item a practice id stands in for. */
export const practiceParent = (itemId: string | null | undefined, challenges: readonly EquationBuilderChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => practiceId(c) === itemId) ?? null : null;

/** `equation_frame`: the shape of the build's target, as box kinds only. */
export type FrameBox = 'number' | 'sign' | 'equals';
export function equationFrame(c: EquationBuilderChallenge): FrameBox[] {
  return c.type !== 'build' ? [] : parseEquationTokens(c.targetEquation ?? '')
    .map(t => t === '=' ? 'equals' : asOp(t) ? 'sign' : 'number');
}
/** The frame's leak rule: it draws no number and no + or −. */
export const frameLeaks = (frame: readonly string[]) => frame.some(b => /\d|[+\-−]/.test(b));

/** The tokens printed on a dots item (balance: left, =, right). */
export function printedTokens(c: EquationBuilderChallenge): string[] {
  if (c.type === 'balance') return [...parseEquationTokens(c.leftSide ?? ''), '=', ...parseEquationTokens(c.rightSide ?? '')];
  return parseEquationTokens((c.type === 'missing-value' ? c.equation : c.type === 'true-false' ? c.displayEquation : '') ?? '');
}
/** `printed_dots`: a dot count under each printed number; null under the ?, a sign and the =. Never a total. */
export const printedDots = (tokens: readonly string[]): (number | null)[] => tokens.map(t => isNum(t) ? +t : null);

export interface RewriteModel { from: string; to: string }

/** `rewrite_model`: an equation in the item's shape and sign, then turned around the =, in numbers the item does not use. */
export function rewriteModel(c: EquationBuilderChallenge): RewriteModel | null {
  const f = c.type === 'rewrite' ? factOf(c.originalEquation ?? '') : null;
  if (!f) return null;
  for (let whole = 3; whole <= 20; whole++) {
    for (let a = 1; a < whole; a++) {
      const b = whole - a;
      if (a === b) continue;
      const m: Fact = f.op === '+' ? { a, op: '+', b, c: whole, flipped: f.flipped } : { a: whole, op: '-', b: a, c: b, flipped: f.flipped };
      const model = { from: factText(m), to: factText({ ...m, flipped: !m.flipped }) };
      if (!rewriteModelLeaks(model, c)) return model;
    }
  }
  return null;
}
/** The model's leak rule: it uses a number of the item's equation, or it is one of the item's accepted forms. */
export function rewriteModelLeaks(m: RewriteModel, c: EquationBuilderChallenge): boolean {
  const used = new Set(numbersOf(c.originalEquation ?? ''));
  const accepted = (c.acceptedForms ?? []).map(x => x.replace(/\s+/g, ''));
  return [m.from, m.to].some(e => numbersOf(e).some(n => used.has(n)) || accepted.includes(e.replace(/\s+/g, '')));
}

/** `match_marks`: whether a pool tile gets a ring (a number printed in the equation; never a sign or the =). */
export const matchMarked = (c: EquationBuilderChallenge, tile: string) =>
  c.type === 'rewrite' && isNum(tile) && parseEquationTokens(c.originalEquation ?? '').includes(tile);

// ── The lever set ───────────────────────────────────────────────────────────

/** The dots lever a type starts with on an easy tier (a starting position, not a pull); make-n starts bare. */
export const dotsLeverFor = (c: EquationBuilderChallenge) =>
  c.type === 'make-n' ? null : c.type === 'build' || c.type === 'rewrite' ? DOTS_LEVER : PRINTED_DOTS_LEVER;

/** The levers shown before any pull: the dots on an easy tier. Passed to `declare` beside the runtime's pulls. */
export const startingLevers = (c: EquationBuilderChallenge | null, tier?: EquationBuilderTier): string[] => {
  const dots = c && tier === 'easy' ? dotsLeverFor(c) : null;
  return dots ? [dots] : [];
};

const OFF: EquationBuilderMiss[] = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const NUMBER_MISSES: EquationBuilderMiss[] = ['printed_number', ...OFF];
const TILE_MODES = ['build-simple', 'rewrite'];
const PRINTED_MODES = ['missing-result', 'missing-operand', 'true-false', 'balance-both-sides'];

/** The misses a lever answers on each item type; its `answers` lists every type's, `answersOn` keeps the item's. */
const ANSWERS: Record<string, Partial<Record<EquationBuilderChallenge['type'], readonly EquationBuilderMiss[]>>> = {
  [DOTS_LEVER]: { 'make-n': OFF, build: ['false_equation'], rewrite: ['false_equation'] },
  [PRINTED_DOTS_LEVER]: { 'missing-value': NUMBER_MISSES, balance: ['other_side_total', ...NUMBER_MISSES],
    'true-false': ['said_true', 'said_false'] },
  [SMALLER_NUMBERS_LEVER]: { build: ['other_operation', 'other_numbers', 'false_equation'],
    rewrite: ['other_form', 'same_as_printed', 'other_numbers', 'false_equation'], 'true-false': ['said_true', 'said_false'],
    'missing-value': ['sum_of_printed', 'short_by_more', 'over_by_more'], balance: ['short_by_more', 'over_by_more'] },
};
const everyType = (id: string) => Array.from(new Set(Object.values(ANSWERS[id]).flat())) as EquationBuilderMiss[];
const own = (id: string) => (c: EquationBuilderChallenge) => ANSWERS[id][c.type] ?? [];

/**
 * The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing
 * while one is on screen.
 */
export const EQUATION_BUILDER_LEVERS = leverSet<EquationBuilderChallenge, null>({
  modeOf: equationBuilderMode,
  missesOf: mode => EQUATION_BUILDER_MISSES_BY_MODE[mode] ?? [],
  support: { tier: c => c.supportTier ?? 'medium', different: 'an equation in other numbers written another way',
    own: 'a way to write this equation' },
  specs: [
    { id: REWRITE_MODEL_LEVER, type: 'model', modes: ['rewrite'], answers: ['same_as_printed', 'other_form', 'unfinished_equation'],
      when: 'The learner builds the printed equation again, or does not know what writing it another way means.',
      does: 'Shows an example beside the printed equation, in other numbers: an equation and the same equation turned '
        + 'around the =. Never the learner\'s numbers.',
      content: c => rewriteModel(c),
      fact: (m: RewriteModel) => `An example in other numbers is beside the printed equation: ${m.from} written as ${m.to}.` },
    { id: DOTS_LEVER, type: 'marks', modes: [...TILE_MODES, 'make-n'], answers: everyType(DOTS_LEVER), answersOn: own(DOTS_LEVER),
      when: c => (c.type === 'make-n'
        ? 'The learner\'s sentence makes one more, one less, or a different amount than the total.'
        : 'The learner\'s equation is not true: its two sides are not the same amount.'),
      does: c => (c.type === 'make-n'
        ? 'Puts dots under each number tile the learner placed, as many as that tile says. Never the amount the sentence makes.'
        : 'Puts dots under each number tile in the learner\'s row, as many as that tile says. Never the amount either side makes.'),
      fact: 'Each number tile in the row has that many dots under it.' },
    { id: EQ_FRAME_LEVER, type: 'layout', modes: ['build-simple'], answers: ['unfinished_equation'],
      when: 'The learner\'s tiles are not an equation yet (no =, a sign at an end, two numbers together).',
      does: 'Draws the empty shape of the equation above the row: a box for each number, a circle for the sign, and the = '
        + 'in its place. Nothing is filled in.',
      content: c => (equationFrame(c).length ? equationFrame(c) : null),
      fact: 'An empty equation shape is above the row: a box for each number, a circle for the sign, and the = in its place.' },
    { id: FRAME_LEVER, type: 'layout', modes: ['make-n'], answers: ['bare_number', 'unfinished_sentence'],
      when: 'The learner puts down one number alone, or tiles that are not a sentence yet (two numbers together, a sign at an end).',
      does: 'Shows the shape of a number sentence beside the row: empty boxes for a number, a + or −, and a number. Nothing is filled in.',
      fact: 'An empty sentence shape (number, sign, number) is beside the row.' },
    { id: PRINTED_DOTS_LEVER, type: 'marks', modes: PRINTED_MODES, answers: everyType(PRINTED_DOTS_LEVER),
      answersOn: own(PRINTED_DOTS_LEVER),
      when: 'The learner\'s number is off, or they pick without working out each side.',
      does: 'Puts dots under each number printed in the equation, as many as that number says; the ? gets none. Never a side\'s total.',
      fact: 'Each number printed in the equation has that many dots under it; the ? has none.' },
    { id: MATCH_LEVER, type: 'marks', modes: ['rewrite'], answers: ['other_numbers'],
      when: 'The learner uses numbers that are not in the printed equation.',
      does: 'Puts a ring on each pool tile that shows a number printed in the equation. No order and no sign is marked.',
      fact: 'Each pool tile showing a number from the printed equation has a ring.' },
    { id: SMALLER_LEVER, type: 'easier', modes: ['make-n'], answers: ['short_by_more', 'over_by_more'],
      when: 'The learner\'s sentence is far from the total, or they cannot start.',
      does: 'Opens an easier ask first: a smaller total, about half, one way, with only the + tile. It is not graded; the '
        + 'full item comes back after it.',
      content: c => smallerMakeN(c) },
    { id: SMALLER_NUMBERS_LEVER, type: 'easier', modes: [...TILE_MODES, ...PRINTED_MODES], answers: everyType(SMALLER_NUMBERS_LEVER),
      answersOn: own(SMALLER_NUMBERS_LEVER),
      when: 'The learner is far off, or the numbers are too big to work yet.',
      does: 'Opens an easier practice item of the same kind first: the same sign, smaller numbers. It is not graded; the '
        + 'full item comes back after it.',
      content: c => practiceItem(c) },
  ],
});
