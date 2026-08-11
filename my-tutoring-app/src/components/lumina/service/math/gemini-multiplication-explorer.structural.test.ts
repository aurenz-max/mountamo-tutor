import { describe, expect, it } from 'vitest';
import {
  FACT_BAND,
  selectFacts,
  assignRepresentations,
  buildFallbackChallenge,
} from './gemini-multiplication-explorer';

/**
 * Structural tests for the multiplication-explorer fact/modality redesign.
 *
 * WHAT REGRESSED BEFORE: the generator emitted ONE `fact` and pointed every
 * challenge at it, so a five-challenge session was "3 × 4" asked five ways. The
 * component compounded it — grading read the per-challenge fact while every
 * representation panel drew the shared one. These tests pin the contract that
 * replaced both: N challenges = N facts, each seen through its own modality.
 *
 * These exercise the REAL exported selection code, not a mirror of it.
 */

const TRIALS = 300;
const card = (f: { factor1: number; factor2: number }) => `${f.factor1}x${f.factor2}`;
const product = (f: { factor1: number; factor2: number }) => f.factor1 * f.factor2;

describe('selectFacts — a session is N different facts', () => {
  it('never repeats a fact across a full session, in either band', () => {
    for (const band of ['2-3', '3-4'] as const) {
      for (let t = 0; t < TRIALS; t++) {
        const facts = selectFacts(FACT_BAND[band], 5);
        expect(facts).toHaveLength(5);
        expect(new Set(facts.map(card)).size).toBe(5);
      }
    }
  });

  it('spreads the ANSWERS — the old failure was every challenge sharing one product', () => {
    for (let t = 0; t < TRIALS; t++) {
      const facts = selectFacts(FACT_BAND['3-4'], 5);
      // Tier 1 selects distinct products first, and both bands are large enough
      // to satisfy it outright, so all five answers must differ.
      expect(new Set(facts.map(product)).size).toBe(5);
    }
  });

  it('honors the grade band ceiling — no fact escapes its band', () => {
    for (const band of ['2-3', '3-4'] as const) {
      const { min, max, maxProduct } = FACT_BAND[band];
      for (let t = 0; t < 50; t++) {
        for (const f of selectFacts(FACT_BAND[band], 6)) {
          expect(f.factor1).toBeGreaterThanOrEqual(Math.max(2, min));
          expect(f.factor2).toBeGreaterThanOrEqual(Math.max(2, min));
          expect(f.factor1).toBeLessThanOrEqual(max);
          expect(f.factor2).toBeLessThanOrEqual(max);
          expect(product(f)).toBeLessThanOrEqual(maxProduct);
        }
      }
    }
  });

  it('never emits a trivial ×1 fact', () => {
    for (let t = 0; t < TRIALS; t++) {
      for (const f of selectFacts(FACT_BAND['2-3'], 6)) {
        expect(f.factor1).toBeGreaterThan(1);
        expect(f.factor2).toBeGreaterThan(1);
      }
    }
  });

  it('a ONE-factor pin means a times table — that factor is kept, the other varies', () => {
    for (let t = 0; t < 50; t++) {
      const facts = selectFacts(FACT_BAND['3-4'], 5, { pinnedFactor2: 4 });
      expect(facts).toHaveLength(5);
      expect(facts.every((f) => f.factor2 === 4)).toBe(true);
      expect(new Set(facts.map((f) => f.factor1)).size).toBe(5);
    }
  });

  it('a BOTH-factor pin is a genuine single-fact lesson — the session holds that fact', () => {
    // The one case where repeating a fact is correct: the manifest said "this
    // lesson is 3 × 4", so it is explored across modalities rather than varied.
    const facts = selectFacts(FACT_BAND['3-4'], 5, { pinnedFactor1: 3, pinnedFactor2: 4 });
    expect(facts).toHaveLength(5);
    expect(facts.every((f) => f.factor1 === 3 && f.factor2 === 4)).toBe(true);
  });

  it('shortens rather than repeats when the pool is genuinely smaller than the session', () => {
    // factor1 pinned to 2 with a product ceiling of 12 admits only 2×2..2×6.
    const facts = selectFacts({ min: 2, max: 12, maxProduct: 12 }, 6, { pinnedFactor1: 2 });
    expect(facts.length).toBeLessThanOrEqual(6);
    expect(new Set(facts.map(card)).size).toBe(facts.length); // no padding with duplicates
  });

  it('varies between sessions — two runs are not the same five facts', () => {
    const runs = new Set(
      Array.from({ length: 40 }, () =>
        selectFacts(FACT_BAND['3-4'], 5).map(card).join(','),
      ),
    );
    expect(runs.size).toBeGreaterThan(1);
  });
});

describe('assignRepresentations — one modality per challenge', () => {
  const ALL = ['groups', 'array', 'repeated_addition', 'number_line', 'area_model'] as const;

  it('covers every enabled modality across a single-mode session (the core ask)', () => {
    // Five `build` challenges must be seen five different ways, not five times in
    // the same panel. This is what makes a single-mode session teach modality.
    const reps = assignRepresentations(Array(5).fill('build'), [...ALL]);
    expect(new Set(reps).size).toBe(5);
  });

  it('connect always gets the side-by-side view — that mode IS the comparison', () => {
    const reps = assignRepresentations(
      ['build', 'connect', 'fluency', 'connect'],
      [...ALL],
    );
    expect(reps[1]).toBe('all');
    expect(reps[3]).toBe('all');
  });

  it('distributive is taught on the area model when it is enabled', () => {
    const reps = assignRepresentations(['distributive', 'distributive'], [...ALL]);
    expect(reps.every((r) => r === 'area_model')).toBe(true);
  });

  it('never assigns a DISABLED representation — the tab must exist', () => {
    // The support tier can strip panels; a challenge pinned to a stripped panel
    // would leave the student on a tab that no longer renders.
    const enabled = ['groups', 'array'] as const;
    const reps = assignRepresentations(
      ['build', 'fluency', 'missing_factor', 'distributive', 'commutative'],
      [...enabled],
    );
    for (const r of reps) expect(enabled).toContain(r as 'groups' | 'array');
  });

  it('degrades safely when no representation is enabled', () => {
    const reps = assignRepresentations(['build', 'fluency'], []);
    expect(reps.every((r) => r === 'array')).toBe(true);
  });
});

describe('buildFallbackChallenge — every prompt is answerable with one number', () => {
  const TYPES = ['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'] as const;

  it('never asks a yes/no question (the numeric keypad is the only input)', () => {
    // The shipped defect: "Do they show the same amount?" graded against the
    // product. A student answering the question as written could never be right.
    for (const type of TYPES) {
      const c = buildFallbackChallenge(type, { factor1: 3, factor2: 4 }, 0);
      const instruction = String(c.instruction);
      expect(instruction).not.toMatch(/^(is|are|do|does|can|will)\b/i);
    }
  });

  it('always declares which value is hidden, so grading is never a silent default', () => {
    for (const type of TYPES) {
      const c = buildFallbackChallenge(type, { factor1: 3, factor2: 4 }, 0);
      expect(['product', 'factor1', 'factor2']).toContain(c.hiddenValue);
    }
  });

  it('missing_factor hides a FACTOR, never the product', () => {
    const c = buildFallbackChallenge('missing_factor', { factor1: 6, factor2: 7 }, 0);
    expect(['factor1', 'factor2']).toContain(c.hiddenValue);
  });

  it('states a targetFact consistent with its own factors', () => {
    for (const type of TYPES) {
      const c = buildFallbackChallenge(type, { factor1: 6, factor2: 7 }, 2);
      expect(c.targetFact).toBe('6 × 7 = 42');
      expect(c.id).toBe('c3');
    }
  });
});
