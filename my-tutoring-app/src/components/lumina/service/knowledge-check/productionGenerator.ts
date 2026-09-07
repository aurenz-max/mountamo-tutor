/**
 * productionGenerator — code-built PRODUCTION items for the knowledge check
 * (KC redesign P2/P3, 2026-09-05). No model call: the plan skeleton names the
 * kind, the stimulus and the element; this module builds the stimulus, the
 * ask, the expected answer and the tap-surface fallback menu, and runs the
 * per-type leak rule before returning. A slot that cannot be built honestly
 * returns null and the caller reports it.
 *
 * The LLM's job in the redesign is SCOPE (which objects fit the topic); the
 * pilot ships with a small code-owned object pool and no scope call at all —
 * a topic-fit pass is the next lever, not a prerequisite.
 */

import type {
  ArrangementInset,
  GlyphCardInset,
  Inset,
  MultipleChoiceOption,
  NumberSentenceInset,
  ProductionKind,
  ProductionProblemData,
} from '../../types';
import {
  buildArrangement,
  buildGlyphCard,
  buildNumberSentence,
  findInsetAnswerLeaks,
  MINUS,
  PLUS,
  remainingOf,
  tokenIdForSymbol,
  type Operator,
} from '../insets';
import { SYMBOL_SPOKEN } from '../objectives/namedSet';
import type { KcProductionSlot } from './knowledgeCheckPlan';

// ── Small K vocabularies ───────────────────────────────────────────────────

export const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

const KEYCAP: Record<number, string> = {
  0: '0️⃣', 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣', 6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 10: '🔟',
};

/** Countable K objects. Neutral across subjects; a topic-fit pass may swap. */
export const OBJECT_POOL: Array<{ emoji: string; name: string }> = [
  { emoji: '🍎', name: 'apples' }, { emoji: '⭐', name: 'stars' }, { emoji: '🐟', name: 'fish' },
  { emoji: '🎈', name: 'balloons' }, { emoji: '🍪', name: 'cookies' }, { emoji: '🐸', name: 'frogs' },
  { emoji: '🌼', name: 'flowers' }, { emoji: '🚗', name: 'cars' }, { emoji: '🧸', name: 'bears' },
];

export const SHAPE_SIDES: Record<string, number> = {
  circle: 0, oval: 0, triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6, rhombus: 4, trapezoid: 4,
};
const SHAPE_EMOJI: Record<string, string> = {
  circle: '⚪', oval: '🥚', triangle: '🔺', square: '🟦', rectangle: '▬', pentagon: '⬠', hexagon: '⬡', rhombus: '🔷', trapezoid: '⏢',
};
/** Shapes with a code-owned drawing (`diShapesGeometry.SHAPE_GEOMETRY`); the
 *  renderer draws the named exemplar, so a rectangle is never a squarish
 *  regular polygon (rule #1 — one drawing, one defensible name). */
const OUTLINE_SHAPES = ['circle', 'oval', 'triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'rhombus', 'trapezoid'];
/** Menu distractors that stay visually and verbally distinct from the target. */
const SHAPE_DISTRACTORS: Record<string, string[]> = {
  circle: ['triangle', 'square', 'oval'],
  oval: ['circle', 'rectangle', 'triangle'],
  triangle: ['square', 'circle', 'rectangle'],
  square: ['rectangle', 'triangle', 'circle'],
  rectangle: ['square', 'triangle', 'oval'],
  pentagon: ['hexagon', 'triangle', 'square'],
  hexagon: ['pentagon', 'square', 'circle'],
  rhombus: ['square', 'triangle', 'rectangle'],
  trapezoid: ['rectangle', 'triangle', 'square'],
};

// ── Options (tap-surface fallback menu) ────────────────────────────────────

const shuffle = <T,>(xs: T[], rnd: () => number): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Three-card menu: the correct card plus the first two distractors in the
 *  order the CALLER ranked them (near misses first), then shuffled. */
function menuFor(
  correct: MultipleChoiceOption,
  distractors: MultipleChoiceOption[],
  rnd: () => number,
): { options: MultipleChoiceOption[]; correctOptionId: string } {
  const picked = distractors.slice(0, 2);
  const ordered = shuffle([correct, ...picked], rnd).map((o, i) => ({ ...o, id: String.fromCharCode(65 + i) }));
  const correctOptionId = ordered.find((o) => o.text === correct.text)!.id;
  return { options: ordered, correctOptionId };
}

const numeralOption = (n: number): MultipleChoiceOption => ({ id: String(n), text: String(n), ...(KEYCAP[n] ? { emoji: KEYCAP[n] } : {}) });

function numeralMenu(answer: number, ceiling: number, rnd: () => number) {
  const pool = Array.from({ length: ceiling }, (_, i) => i + 1).filter((n) => n !== answer);
  // Near misses first (±1, ±2), then anything.
  const near = pool.filter((n) => Math.abs(n - answer) <= 2);
  const rest = pool.filter((n) => Math.abs(n - answer) > 2);
  return menuFor(numeralOption(answer), [...shuffle(near, rnd), ...shuffle(rest, rnd)].map(numeralOption), rnd);
}

// ── Builders per kind ──────────────────────────────────────────────────────

export interface ProductionBuildContext {
  gradeLevel: string;
  preReader: boolean;
  /** Canonical grade ('K' | '1'..). Drives the number ceiling. */
  grade?: string;
  /** Lesson topic / objective text — used to pick the operator for '='. */
  objectiveText: string;
  rnd?: () => number;
  /** Cross-slot memory so two how_many slots never show the same count. */
  used?: Set<string>;
}

const ceilingFor = (ctx: ProductionBuildContext): number =>
  ctx.preReader || ctx.grade === 'K' ? 5 : 10;

const randInt = (rnd: () => number, lo: number, hi: number): number =>
  lo + Math.floor(rnd() * (hi - lo + 1));

function pickFact(op: Operator, ceiling: number, rnd: () => number, used: Set<string>): { a: number; b: number } {
  for (let attempt = 0; attempt < 24; attempt++) {
    let a: number; let b: number;
    if (op === MINUS) {
      a = randInt(rnd, 2, ceiling);
      b = randInt(rnd, 1, a - 1);
    } else {
      a = randInt(rnd, 1, ceiling - 1);
      b = randInt(rnd, 1, ceiling - a);
    }
    const key = `${a}${op}${b}`;
    if (!used.has(key)) { used.add(key); return { a, b }; }
  }
  return op === MINUS ? { a: ceiling, b: 1 } : { a: 1, b: 1 };
}

const operatorFor = (symbol: string, objectiveText: string): Operator => {
  if (symbol === MINUS) return MINUS;
  if (symbol === PLUS) return PLUS;
  return /\b(take[- ]?away|subtract|minus|left|fewer)\b/i.test(objectiveText) ? MINUS : PLUS;
};

function buildPointTo(slot: KcProductionSlot, ctx: ProductionBuildContext, rnd: () => number, used: Set<string>): ProductionProblemData | null {
  const symbol = slot.element ?? MINUS;
  const spoken = SYMBOL_SPOKEN[symbol];
  if (!spoken) return null;
  const op = operatorFor(symbol, ctx.objectiveText);
  const { a, b } = pickFact(op, ceilingFor(ctx), rnd, used);
  const stimulus: NumberSentenceInset = buildNumberSentence({ a, op, b });
  const targetTokenId = tokenIdForSymbol(stimulus, symbol);
  if (!targetTokenId) return null;
  // Two asks per symbol so a repeated element is a fresh angle: by NAME, or by MEANING.
  const ask = slot.angle % 2 === 0
    ? `Touch the ${spoken.name} sign.`
    : `Touch the sign that means ${spoken.meaning}.`;
  const options: MultipleChoiceOption[] = stimulus.tokens.map((t) => ({ id: t.id, text: t.text }));
  return finish({
    kind: 'point_to',
    ask,
    stimulus,
    expectedAnswer: spoken.name,
    alternates: spoken.alternates,
    targetTokenId,
    options,
    correctOptionId: targetTokenId,
  }, slot, ctx);
}

function buildHowMany(slot: KcProductionSlot, ctx: ProductionBuildContext, rnd: () => number, used: Set<string>): ProductionProblemData | null {
  const ceiling = ceilingFor(ctx);
  const object = OBJECT_POOL[randInt(rnd, 0, OBJECT_POOL.length - 1)];
  let count = 0; let removed = 0; let groups: number[] | undefined;
  for (let attempt = 0; attempt < 24; attempt++) {
    if (slot.combine) {
      // Two groups put together: a ≥ 1, b ≥ 1, a + b ≤ ceiling (K: within 5).
      const a = randInt(rnd, 1, Math.max(1, ceiling - 1));
      const b = randInt(rnd, 1, Math.max(1, ceiling - a));
      groups = [a, b];
      count = a + b;
      removed = 0;
    } else {
      count = randInt(rnd, slot.takeAway ? 2 : 1, ceiling);
      removed = slot.takeAway ? randInt(rnd, 1, count - 1) : 0;
    }
    const key = groups ? `arr:${groups.join('+')}` : `arr:${count}-${removed}`;
    if (!used.has(key)) { used.add(key); break; }
  }
  const stimulus: ArrangementInset = buildArrangement({
    emoji: object.emoji,
    count,
    removed,
    groups,
    layout: count > 5 ? 'ten-frame' : slot.takeAway ? 'before-after' : slot.angle % 2 === 0 ? 'row' : 'scattered',
    objectName: object.name,
  });
  const remaining = remainingOf(stimulus);
  // SHORT asks on purpose: DI runs on invariant signals, and the pack's
  // repeat-ask gate flags a long byte-identical line re-recited item after
  // item (≥ ~14 words) while a short one (≤ 10) is the signal it should be.
  // The picture carries the framing (two groups; crossed-out objects), and
  // the how-to-play line explains the cross-outs once on action change.
  const ask = groups
    ? 'How many altogether?'
    : removed > 0
      ? 'How many are left?'
      : `How many ${object.name} are there?`;
  const menu = numeralMenu(remaining, Math.max(ceiling, 5), rnd);
  return finish({
    kind: 'how_many',
    ask,
    stimulus,
    expectedAnswer: numberWord(remaining),
    alternates: [String(remaining)],
    ...menu,
  }, slot, ctx);
}

function buildSayIt(slot: KcProductionSlot, ctx: ProductionBuildContext, rnd: () => number): ProductionProblemData | null {
  const element = slot.element;
  if (!element) return null;
  switch (slot.elementKind) {
    case 'numeral': {
      const n = Number(element);
      if (!Number.isInteger(n) || n < 0 || n > 20) return null;
      const stimulus: GlyphCardInset = buildGlyphCard({ glyphKind: 'numeral', glyph: String(n) });
      const menu = numeralMenu(n, Math.max(10, Math.min(20, n + 3)), rnd);
      return finish({
        kind: 'say_it', ask: 'What number is this?', stimulus,
        expectedAnswer: numberWord(n), alternates: [String(n)], ...menu,
      }, slot, ctx);
    }
    case 'letter': {
      const letter = element.toLowerCase();
      if (!/^[a-z]$/.test(letter)) return null;
      const upper = slot.angle % 2 === 1;
      const stimulus: GlyphCardInset = buildGlyphCard({ glyphKind: 'letter', glyph: upper ? letter.toUpperCase() : letter });
      const others = shuffle(LETTERS.split('').filter((l) => l !== letter), rnd);
      const menu = menuFor(
        { id: letter, text: letter.toUpperCase() },
        others.map((l) => ({ id: l, text: l.toUpperCase() })),
        rnd,
      );
      return finish({
        kind: 'say_it', ask: 'What letter is this?', stimulus,
        expectedAnswer: letter, alternates: [letter.toUpperCase()], ...menu,
      }, slot, ctx);
    }
    case 'shape': {
      const shape = element.toLowerCase();
      if (!OUTLINE_SHAPES.includes(shape)) return null;
      const stimulus: GlyphCardInset = buildGlyphCard({ glyphKind: 'shape', sides: SHAPE_SIDES[shape], shapeName: shape });
      const others = SHAPE_DISTRACTORS[shape] ?? shuffle(OUTLINE_SHAPES.filter((s) => s !== shape), rnd);
      const menu = menuFor(
        { id: shape, text: shape, emoji: SHAPE_EMOJI[shape] },
        others.map((s) => ({ id: s, text: s, emoji: SHAPE_EMOJI[s] })),
        rnd,
      );
      return finish({
        kind: 'say_it', ask: 'What shape is this?', stimulus,
        expectedAnswer: shape, alternates: [], ...menu,
      }, slot, ctx);
    }
    case 'symbol': {
      const spoken = SYMBOL_SPOKEN[element];
      if (!spoken) return null;
      const stimulus: GlyphCardInset = buildGlyphCard({ glyphKind: 'operator', glyph: element });
      const others = shuffle(Object.keys(SYMBOL_SPOKEN).filter((s) => s !== element), rnd);
      const menu = menuFor(
        { id: element, text: spoken.name },
        others.map((s) => ({ id: s, text: SYMBOL_SPOKEN[s].name })),
        rnd,
      );
      return finish({
        kind: 'say_it', ask: 'What is this sign called?', stimulus,
        expectedAnswer: spoken.name, alternates: spoken.alternates, ...menu,
      }, slot, ctx);
    }
    default:
      return null;
  }
}

interface Draft {
  kind: ProductionKind;
  ask: string;
  stimulus: Inset;
  expectedAnswer: string;
  alternates: string[];
  targetTokenId?: string;
  options: MultipleChoiceOption[];
  correctOptionId: string;
}

let serial = 0;

function finish(draft: Draft, slot: KcProductionSlot, ctx: ProductionBuildContext): ProductionProblemData | null {
  const leaks = findInsetAnswerLeaks(draft.stimulus, {
    kind: draft.kind,
    ask: draft.ask,
    expectedAnswer: draft.expectedAnswer,
    alternates: draft.alternates,
    targetTokenId: draft.targetTokenId,
  });
  if (leaks.length > 0) {
    console.warn(`[KC production] dropped ${draft.kind}/${slot.stimulus} for ${slot.objectiveId}: ${leaks.join('; ')}`);
    return null;
  }
  if (!draft.options.some((o) => o.id === draft.correctOptionId)) return null;
  serial += 1;
  return {
    type: 'production',
    id: `prod_${slot.productionKind}_${serial}`,
    difficulty: slot.angle === 0 ? 'easy' : 'medium',
    gradeLevel: ctx.gradeLevel,
    rationale: rationaleFor(draft),
    teachingNote: '',
    successCriteria: [ctx.objectiveText],
    kind: draft.kind,
    ask: draft.ask,
    stimulus: draft.stimulus,
    expectedAnswer: draft.expectedAnswer,
    alternates: draft.alternates,
    ...(draft.targetTokenId ? { targetTokenId: draft.targetTokenId } : {}),
    options: draft.options,
    correctOptionId: draft.correctOptionId,
    objectiveId: slot.objectiveId,
  };
}

const rationaleFor = (d: Draft): string => {
  switch (d.kind) {
    case 'point_to': return `The ${d.expectedAnswer} sign is the one you touch.`;
    case 'how_many': return `Counting what is shown gives ${d.expectedAnswer}.`;
    case 'say_it': return `This one is called ${d.expectedAnswer}.`;
  }
};

/** Build one production item for a slot, or null (reported by the caller). */
export function buildProductionProblem(
  slot: KcProductionSlot,
  ctx: ProductionBuildContext,
): ProductionProblemData | null {
  const rnd = ctx.rnd ?? Math.random;
  const used = ctx.used ?? new Set<string>();
  switch (slot.productionKind) {
    case 'point_to': return buildPointTo(slot, ctx, rnd, used);
    case 'how_many': return buildHowMany(slot, ctx, rnd, used);
    case 'say_it': return buildSayIt(slot, ctx, rnd);
  }
}
