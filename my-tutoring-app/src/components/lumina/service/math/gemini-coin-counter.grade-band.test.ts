/**
 * Grade-band resolution for coin-counter — canonical `ctx.grade` first, prose
 * fallback (contract gap G2, closed via the systemic 14m sweep).
 *
 * The defect shape: `resolveGradeBand()` substring-matches `gradeContext`
 * PROSE — the elementary sentence ("grades 1-5") matches no digit test so
 * every G1-5 lesson landed '1' (the three authored G2 consumers
 * `MEAS002-05-a/-b/-c` never saw the half-dollar/dollar pool), and the
 * bare-"k" test inverts middle/high-school prose ("thinking") to K.
 * These tests pin:
 *   • the canonical mapper (K → K, 1 → 1, 2 → 2, 3+ → 3 ceiling clamp, null
 *     without a grade),
 *   • the WIRING — bands '2'/'3' are reachable for the first time on the ctx
 *     path, and the K/G1 fork bands still land exactly (contract R9),
 *   • the legacy fallback — no canonical grade ⇒ prose path byte-compatible.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateCoinCounter, coinCounterGradeBandFromGrade } from './gemini-coin-counter';

const generateContent = vi.mocked(ai.models.generateContent);

// The literal prose production sends (geminiService.getGradeLevelContext).
const KINDERGARTEN_PROSE =
  'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.';
const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';

function contextFor(opts: { grade?: string; gradeContext?: string }): GenerationContext {
  return {
    componentId: 'coin-counter',
    instanceId: 'coin-counter-test',
    topic: 'Counting money',
    gradeLevel: 'elementary',
    gradeContext: opts.gradeContext ?? ELEMENTARY_PROSE,
    grade: opts.grade,
    intent: undefined,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: undefined,
    raw: {},
  };
}

beforeEach(() => {
  generateContent.mockReset();
  // Empty challenges: sub-generators degrade and the orchestrator falls back;
  // the gradeBand stamp under test is code-owned either way.
  generateContent.mockResolvedValue({
    text: JSON.stringify({ title: 'T', description: 'D', challenges: [] }),
  } as never);
});

describe('coinCounterGradeBandFromGrade (canonical mapper)', () => {
  it('maps canonical grades onto the K/1/2/3 ladder, clamping 4+ to the ceiling', () => {
    expect(coinCounterGradeBandFromGrade('K')).toBe('K');
    expect(coinCounterGradeBandFromGrade('k')).toBe('K');
    expect(coinCounterGradeBandFromGrade('1')).toBe('1');
    expect(coinCounterGradeBandFromGrade('2')).toBe('2');
    expect(coinCounterGradeBandFromGrade('3')).toBe('3');
    expect(coinCounterGradeBandFromGrade('4')).toBe('3');
    expect(coinCounterGradeBandFromGrade('8')).toBe('3');
  });

  it('returns null when there is no canonical grade — the prose fallback must stay reachable', () => {
    expect(coinCounterGradeBandFromGrade(undefined)).toBeNull();
    expect(coinCounterGradeBandFromGrade('')).toBeNull();
    expect(coinCounterGradeBandFromGrade('not-a-grade')).toBeNull();
  });
});

describe('generateCoinCounter grade-band wiring', () => {
  it('a Grade-2 objective reaches band 2 — the authored MEAS002-05 consumers, previously stuck at 1', async () => {
    // Non-vacuity: elementary prose matches no digit test, so without the
    // canonical threading this stamps '1'.
    const data = await generateCoinCounter(contextFor({ grade: '2' }));
    expect(data.gradeBand).toBe('2');
  });

  it('a Grade-3 objective reaches band 3; Grade 4 clamps to it', async () => {
    const g3 = await generateCoinCounter(contextFor({ grade: '3' }));
    expect(g3.gradeBand).toBe('3');
    const g4 = await generateCoinCounter(contextFor({ grade: '4' }));
    expect(g4.gradeBand).toBe('3');
  });

  it('the K and G1 fork bands still land exactly (contract R9 preserved)', async () => {
    const k = await generateCoinCounter(contextFor({ grade: 'K' }));
    expect(k.gradeBand).toBe('K');
    const g1 = await generateCoinCounter(contextFor({ grade: '1' }));
    expect(g1.gradeBand).toBe('1');
  });

  it('no canonical grade → the legacy prose path is unchanged (fallback kept)', async () => {
    const elem = await generateCoinCounter(contextFor({}));
    expect(elem.gradeBand).toBe('1');
    const k = await generateCoinCounter(contextFor({ gradeContext: KINDERGARTEN_PROSE }));
    expect(k.gradeBand).toBe('K');
  });
});
