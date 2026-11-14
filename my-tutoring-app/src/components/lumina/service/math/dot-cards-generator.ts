/**
 * dot-cards' generator, code-only (Fork C): no model call. Every card is built here from the support tier and a seed:
 * two groups of dots in two colors, an arrangement, the dot positions and the total. The difficulty is the card's
 * structure (how big the groups are and how they are arranged), never a label.
 *
 *   easy   total 2-5, dice or two rows
 *   medium total 4-8, dice, two rows or a ten-frame
 *   hard   total 6-10, ten-frame, dice or scattered
 *
 * Each group stays at 1-5 dots, the size a young child can see at once; the total is what the child composes.
 */
import type { GenerationContext } from '../generation/generationContext';
import type {
  DotArrangement, DotCardDot, DotCardsChallenge, DotCardsData,
} from '../../primitives/visual-primitives/math/DotCards';

export type DotCardsTier = 'easy' | 'medium' | 'hard';

interface TierSpec { min: number; max: number; arrangements: DotArrangement[] }

export const DOT_CARD_TIERS: Record<DotCardsTier, TierSpec> = {
  easy: { min: 2, max: 5, arrangements: ['dice', 'rows'] },
  medium: { min: 4, max: 8, arrangements: ['dice', 'rows', 'frame'] },
  hard: { min: 6, max: 10, arrangements: ['frame', 'dice', 'scatter'] },
};

/** One look's length: long enough to see two small groups, too short to count a larger card one by one. */
export const LOOK_MS: Record<DotCardsTier, number> = { easy: 3000, medium: 2500, hard: 2000 };

export const DOT_CARD_COUNT = 5;
/** The card's drawing space; the component draws it with this viewBox. */
export const CARD_W = 200;
export const CARD_H = 120;

/** mulberry32: a small seeded generator, so a seed replays the same session. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
function shuffle<T>(r: Rand, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Dice pips on a 3x3 grid, (column, row). */
const DICE: Record<number, Array<[number, number]>> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
};

function diceDots(parts: [number, number]): DotCardDot[] {
  const size = 84;
  return parts.flatMap((n, part) => DICE[n].map(([c, rw]) => ({
    x: Math.round(part === 0 ? 10 : CARD_W - 10 - size) + size / 3 * (c + 0.5),
    y: (CARD_H - size) / 2 + size / 3 * (rw + 0.5),
    part: part as 0 | 1,
  })));
}

/** One row per group, left-aligned so the rows line up dot for dot. */
function rowDots(parts: [number, number]): DotCardDot[] {
  const step = 32;
  const width = (Math.max(...parts) - 1) * step;
  const x0 = (CARD_W - width) / 2;
  return parts.flatMap((n, part) => Array.from({ length: n }, (_, i) => ({
    x: x0 + i * step, y: part === 0 ? 38 : 82, part: part as 0 | 1,
  })));
}

/** A ten-frame filled left to right, top row first: the first group, then the second continuing on. */
export const FRAME = { x0: 25, y0: 30, cell: 30 };
function frameDots(parts: [number, number]): DotCardDot[] {
  return Array.from({ length: parts[0] + parts[1] }, (_, i) => ({
    x: FRAME.x0 + (i % 5) * FRAME.cell + FRAME.cell / 2,
    y: FRAME.y0 + Math.floor(i / 5) * FRAME.cell + FRAME.cell / 2,
    part: (i < parts[0] ? 0 : 1) as 0 | 1,
  }));
}

/** Scattered dots no closer than a dot's width apart; falls back to dice when the space will not fit them. */
function scatterDots(r: Rand, parts: [number, number]): DotCardDot[] {
  const minD = 26;
  for (let attempt = 0; attempt < 60; attempt++) {
    const pts: Array<{ x: number; y: number }> = [];
    for (let tries = 0; pts.length < parts[0] + parts[1] && tries < 500; tries++) {
      const p = { x: 14 + r() * (CARD_W - 28), y: 14 + r() * (CARD_H - 28) };
      if (pts.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= minD)) pts.push(p);
    }
    if (pts.length === parts[0] + parts[1]) {
      return pts.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), part: (i < parts[0] ? 0 : 1) as 0 | 1 }));
    }
  }
  return diceDots(parts);
}

export function layoutDots(r: Rand, arrangement: DotArrangement, parts: [number, number]): DotCardDot[] {
  if (arrangement === 'dice') return diceDots(parts);
  if (arrangement === 'rows') return rowDots(parts);
  if (arrangement === 'frame') return frameDots(parts);
  return scatterDots(r, parts);
}

/** Every split of a total in the tier into two groups of 1-5. */
function splits(spec: TierSpec): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) {
    if (a + b >= spec.min && a + b <= spec.max) out.push([a, b]);
  }
  return out;
}

export function normalizeTier(value: unknown): DotCardsTier {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

/** Build one session: N cards, every arrangement of the tier before any repeats, no repeated card, no total twice in a row. */
export function buildDotCards(tier: DotCardsTier, seed: number, count = DOT_CARD_COUNT): DotCardsChallenge[] {
  const r = rng(seed);
  const spec = DOT_CARD_TIERS[tier];
  const pool = shuffle(r, splits(spec));
  const arrangements = Array.from({ length: count }, (_, i) => spec.arrangements[i % spec.arrangements.length]);
  const order = shuffle(r, arrangements);
  const seen = new Set<string>();
  const cards: DotCardsChallenge[] = [];
  let lastTotal = -1;
  for (const arrangement of order) {
    const pick = pool.find(([a, b]) => !seen.has(`${a}+${b}`) && a + b !== lastTotal)
      ?? pool.find(([a, b]) => !seen.has(`${a}+${b}`)) ?? pool[int(r, 0, pool.length - 1)];
    seen.add(`${pick[0]}+${pick[1]}`);
    lastTotal = pick[0] + pick[1];
    cards.push({
      id: `dot-card-${cards.length + 1}`,
      type: 'quick_total',
      parts: [pick[0], pick[1]],
      total: pick[0] + pick[1],
      arrangement,
      dots: layoutDots(r, arrangement, [pick[0], pick[1]]),
      lookMs: LOOK_MS[tier],
    });
  }
  return cards;
}

export function generateDotCards(ctx: Pick<GenerationContext, 'supportTier' | 'raw'>): DotCardsData {
  const tier = normalizeTier(ctx.raw?.difficulty ?? ctx.supportTier);
  const rawSeed = Number(ctx.raw?.seed);
  const seed = Number.isFinite(rawSeed) ? rawSeed : Math.floor(Math.random() * 2 ** 31);
  return {
    title: 'Dot Cards',
    description: 'Flip a card and take a quick look. How many dots altogether?',
    challengeType: 'quick_total',
    supportTier: tier,
    challenges: buildDotCards(tier, seed),
  };
}
