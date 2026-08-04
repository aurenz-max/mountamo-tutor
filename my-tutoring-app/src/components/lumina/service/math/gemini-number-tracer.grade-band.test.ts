/**
 * Grade-band resolution for number-tracer — canonical `ctx.grade` first, after
 * the explicit config pin, before the prose fallback (systemic 14m sweep).
 *
 * The defect shape: the resolver's prose test only matches 'kinder', so the K/1
 * split was an accident of the prose wording, and a bare-key caller passing 'K'
 * inverted to the '1' band. The band drives the digit ceiling (K ≤9 / G1 ≤20)
 * and the stamped `gradeBand`. These tests pin:
 *   • the canonical mapper (K → 'K', 1+ → '1' ceiling clamp, null without a grade),
 *   • the WIRING — a canonical grade decides the band + digit clamp even when
 *     the prose disagrees, in BOTH directions (reverting the threading fails those),
 *   • precedence — an explicit `config.gradeBand` pin still outranks canonical,
 *   • the legacy fallback — no canonical grade ⇒ prose path byte-compatible.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateNumberTracer, numberTracerGradeBandFromGrade } from './gemini-number-tracer';

const generateContent = vi.mocked(ai.models.generateContent);

// The literal prose production sends (geminiService.getGradeLevelContext).
const KINDERGARTEN_PROSE =
  'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.';
const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';

function contextFor(opts: {
  grade?: string;
  gradeContext?: string;
  gradeBand?: 'K' | '1';
}): GenerationContext {
  return {
    componentId: 'number-tracer',
    instanceId: 'number-tracer-test',
    topic: 'Writing numbers',
    gradeLevel: 'elementary',
    gradeContext: opts.gradeContext ?? ELEMENTARY_PROSE,
    grade: opts.grade,
    intent: undefined,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'trace',
    raw: {
      targetEvalMode: 'trace',
      ...(opts.gradeBand ? { gradeBand: opts.gradeBand } : {}),
    },
  };
}

/** Handwriting response with digit 15 — above the K ceiling (9), legal at G1 (20),
 *  so the band decides whether the clamp bites. */
function mockHandwriting() {
  generateContent.mockResolvedValue({
    text: JSON.stringify({
      title: 'Number Writing',
      description: 'Practice writing numbers.',
      gradeBand: '1',
      challenges: [
        { id: 'c1', type: 'trace', digit: 15, hint: 'Start at the top!' },
      ],
    }),
  } as never);
}

describe('numberTracerGradeBandFromGrade (canonical mapper)', () => {
  it('maps canonical grades onto the K/1 ladder, clamping 1+ to the ceiling rung', () => {
    expect(numberTracerGradeBandFromGrade('K')).toBe('K');
    expect(numberTracerGradeBandFromGrade('k')).toBe('K');
    expect(numberTracerGradeBandFromGrade('1')).toBe('1');
    expect(numberTracerGradeBandFromGrade('2')).toBe('1');
    expect(numberTracerGradeBandFromGrade('6')).toBe('1');
  });

  it('returns null when there is no canonical grade — the fallback ladder must stay reachable', () => {
    expect(numberTracerGradeBandFromGrade(undefined)).toBeNull();
    expect(numberTracerGradeBandFromGrade('')).toBeNull();
    expect(numberTracerGradeBandFromGrade('not-a-grade')).toBeNull();
  });
});

describe('generateNumberTracer grade-band wiring', () => {
  beforeEach(() => {
    generateContent.mockReset();
    mockHandwriting();
  });

  it('a canonical K objective lands the K band + digit ceiling under elementary prose', async () => {
    // Non-vacuity: elementary prose has no 'kinder', so without the canonical
    // threading the prose parser returns '1' and both assertions fail.
    const data = await generateNumberTracer(contextFor({ grade: 'K' }));
    expect(data.gradeBand).toBe('K');
    expect(data.challenges[0]?.digit).toBe(9); // 15 clamped to the K ceiling
  });

  it('a canonical Grade-1 objective lands the 1 band even under kindergarten prose', async () => {
    const data = await generateNumberTracer(
      contextFor({ grade: '1', gradeContext: KINDERGARTEN_PROSE }),
    );
    expect(data.gradeBand).toBe('1');
    expect(data.challenges[0]?.digit).toBe(15); // no clamp at G1
  });

  it('an explicit config.gradeBand pin still outranks the canonical grade', async () => {
    const data = await generateNumberTracer(contextFor({ grade: '1', gradeBand: 'K' }));
    expect(data.gradeBand).toBe('K');
  });

  it('no canonical grade → the legacy prose path is unchanged (fallback kept)', async () => {
    const k = await generateNumberTracer(contextFor({ gradeContext: KINDERGARTEN_PROSE }));
    expect(k.gradeBand).toBe('K');
    const elem = await generateNumberTracer(contextFor({ gradeContext: ELEMENTARY_PROSE }));
    expect(elem.gradeBand).toBe('1');
  });
});
