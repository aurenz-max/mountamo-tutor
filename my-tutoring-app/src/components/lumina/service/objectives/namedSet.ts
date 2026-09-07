/**
 * `namedSetFromObjective` — does an objective NAME an enumerable set, and
 * what is it? (KC redesign P0/P3, 2026-09-05.)
 *
 * "Identify the minus sign and the equals sign" names two elements. "Review
 * letters p, n, i" names three. "Sort circles, squares and triangles" names
 * three. A plan sized by a curator `count` samples ONE of them and the
 * coverage judge (rightly) fails the objective — the KC-1 / DSP-1 class,
 * `feedback_trust-intent-over-hardcoded-caps`: a cap below an objective's
 * enumerable set is a bug.
 *
 * This is CODE, not a prompt, and it is deliberately narrow: a small K-2
 * vocabulary of symbol names, single letters, shape names and numeral ranges,
 * every element grounded in the objective text. What it does not recognise it
 * returns as `null`, and the plan falls back to two generic angles — the
 * residual is reported, never guessed. (The handoff described this as "the
 * DSP-1 helper generalised"; DSP-1's extraction is a model plan with a review
 * pass, so this lexical helper is new code, kept honest by being small.)
 */

export type NamedSetKind = 'symbol' | 'letter' | 'shape' | 'numeral';

export interface NamedSet {
  kind: NamedSetKind;
  /** Elements in text order, deduplicated. Symbols are the printed glyph
   *  ('−', '+', '='); letters are lower-case; shapes are singular names;
   *  numerals are decimal strings. */
  elements: string[];
  /** The objective text span(s) each element was grounded in. */
  source: string;
}

/** Symbol NAMES a K-2 objective uses → the printed glyph. Longest first. */
const SYMBOL_NAMES: Array<[RegExp, string]> = [
  [/\b(?:minus|subtraction|take[- ]?away)\s+(?:sign|symbol)\b/gi, '−'],
  [/\b(?:plus|addition)\s+(?:sign|symbol)\b/gi, '+'],
  [/\b(?:equals?|equal)\s+(?:sign|symbol)\b/gi, '='],
  [/\b(?:greater[- ]than)\s+(?:sign|symbol)\b/gi, '>'],
  [/\b(?:less[- ]than)\s+(?:sign|symbol)\b/gi, '<'],
  // Bare glyphs beside a "sign/symbol" word: "+ and = as math symbols". The
  // leading group swallows one non-word char (no lookbehind — es5 target).
  [/(?:^|[^\w])([+])(?![\w])/g, '+'],
  [/(?:^|[^\w])([−–])(?![\w])/g, '−'],
  [/(?:^|[^\w])(=)(?![\w])/g, '='],
];

const SHAPE_NAMES = ['circle', 'square', 'triangle', 'rectangle', 'hexagon', 'pentagon', 'oval', 'rhombus', 'trapezoid'];

const dedupe = (xs: string[]): string[] => Array.from(new Set(xs));

function symbolSet(text: string): NamedSet | null {
  const mentionsSign = /\b(sign|signs|symbol|symbols)\b/i.test(text);
  if (!mentionsSign) return null;
  const hits: Array<{ index: number; glyph: string; span: string }> = [];
  for (const [re, glyph] of SYMBOL_NAMES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // A bare glyph only counts when a sign/symbol word is in the text (checked above).
      hits.push({ index: m.index, glyph, span: (m[1] ?? m[0]).trim() });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.index - b.index);
  return {
    kind: 'symbol',
    elements: dedupe(hits.map((h) => h.glyph)),
    source: dedupe(hits.map((h) => h.span)).join(' | '),
  };
}

function letterSet(text: string): NamedSet | null {
  // "letters s, a, t, p, i, n" · "the letter m" · "letters p n i" · "letters a and t"
  const re = /\bletters?\s+((?:[a-z]\b[\s,/&]*(?:and\s+)?)+)/gi;
  const letters: string[] = [];
  const spans: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const found = m[1].match(/\b[a-z]\b/gi) ?? [];
    if (found.length === 0) continue;
    letters.push(...found.map((l) => l.toLowerCase()));
    spans.push(m[0].trim());
  }
  if (letters.length === 0) return null;
  return { kind: 'letter', elements: dedupe(letters), source: spans.join(' | ') };
}

function shapeSet(text: string): NamedSet | null {
  const re = new RegExp(`\\b(${SHAPE_NAMES.join('|')})s?\\b`, 'gi');
  const hits: string[] = [];
  const spans: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hits.push(m[1].toLowerCase());
    spans.push(m[0]);
  }
  if (hits.length === 0) return null;
  return { kind: 'shape', elements: dedupe(hits), source: spans.join(' | ') };
}

/** Enumerated numeral sets are capped at 10 elements — a range like "1 to
 *  100" is a scope, not a named set the check must touch once each. */
const MAX_NUMERAL_SET = 10;

function numeralSet(text: string): NamedSet | null {
  const m = /\b(?:numbers?|numerals?)\s+(\d{1,3})\s*(?:to|through|thru|-|–)\s*(\d{1,3})\b/i.exec(text);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) return null;
  if (hi - lo + 1 > MAX_NUMERAL_SET) return null;
  return {
    kind: 'numeral',
    elements: Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)),
    source: m[0],
  };
}

/**
 * The first named set found, in this precedence: symbols (they need a
 * "sign/symbol" word, so they are the most specific), letters, shapes,
 * numeral ranges. Returns null when the objective names nothing enumerable.
 */
export function namedSetFromObjective(text: string): NamedSet | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  return symbolSet(t) ?? letterSet(t) ?? shapeSet(t) ?? numeralSet(t);
}

/** Spoken name of a printed symbol glyph, for asks and affirmations. */
export const SYMBOL_SPOKEN: Record<string, { name: string; alternates: string[]; meaning: string }> = {
  '−': { name: 'minus', alternates: ['minus sign', 'take away', 'subtract'], meaning: 'take away' },
  '+': { name: 'plus', alternates: ['plus sign', 'add', 'put together'], meaning: 'put together' },
  '=': { name: 'equals', alternates: ['equal', 'equals sign', 'equal sign', 'is the same as'], meaning: 'is the same as' },
  '>': { name: 'greater than', alternates: ['more than', 'bigger than'], meaning: 'is bigger than' },
  '<': { name: 'less than', alternates: ['fewer than', 'smaller than'], meaning: 'is smaller than' },
};
