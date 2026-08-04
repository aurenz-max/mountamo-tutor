/**
 * Grade-band resolution for hundreds-chart — canonical `ctx.grade` first,
 * legacy '2' default as the fallback (reader-fit 14i, systemic 14m).
 *
 * The defect: `config?.gradeBand ?? '2'` — a hard default that never read
 * `ctx.grade`, so every production lesson ran band '2' (the manifest never
 * emits `gradeBand`): a Grade-1 lesson stamped "Grade 2" toward the live tutor
 * and bands '3'/'4' with their richer skip pools were unreachable.
 * These tests pin:
 *   • the canonical mapper (K/1 → '1', 2 → '2', 3 → '3', 4+ → '4', null
 *     without a grade),
 *   • the WIRING — with a canonical grade the emitted `gradeBand` AND the
 *     sanitizer's skip-value pool come from it (reverting the threading fails
 *     the Grade-4 tests),
 *   • the legacy fallback — no canonical grade ⇒ band '2' byte-compatible
 *     (14m template: never delete the fallback), and
 *   • precedence — an explicit `config.gradeBand` pin still outranks the
 *     canonical grade.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateHundredsChart, hundredsChartGradeBandFromGrade } from './gemini-hundreds-chart';

const generateContent = vi.mocked(ai.models.generateContent);

// The literal prose production sends for grades 1-5 (geminiService.getGradeLevelContext).
const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';

function contextFor(opts: {
  grade?: string;
  gradeBand?: '1' | '2' | '3' | '4';
}): GenerationContext {
  return {
    componentId: 'hundreds-chart',
    instanceId: 'hundreds-chart-test',
    topic: 'Skip counting patterns',
    gradeLevel: 'elementary',
    gradeContext: ELEMENTARY_PROSE,
    grade: opts.grade,
    intent: undefined,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: undefined,
    raw: opts.gradeBand ? { gradeBand: opts.gradeBand } : {},
  };
}

/** Gemini mock: one challenge with an INVALID skipValue (0) so the sanitizer's
 *  grade-pool fallback path runs — that path is where the band bites hardest. */
function mockGeminiChallenges(skipValues: number[]) {
  generateContent.mockResolvedValue({
    text: JSON.stringify({
      title: 'Skip-Count Safari',
      description: 'Explore skip-counting patterns.',
      challenges: skipValues.map((sv) => ({
        type: 'highlight_sequence',
        skipValue: sv,
        hint: 'Look at the ones digits.',
      })),
    }),
  } as never);
}

describe('hundredsChartGradeBandFromGrade (canonical mapper)', () => {
  it('maps canonical grades onto the chart bands, clamping at both rungs', () => {
    expect(hundredsChartGradeBandFromGrade('K')).toBe('1');
    expect(hundredsChartGradeBandFromGrade('k')).toBe('1');
    expect(hundredsChartGradeBandFromGrade('1')).toBe('1');
    expect(hundredsChartGradeBandFromGrade('2')).toBe('2');
    expect(hundredsChartGradeBandFromGrade('3')).toBe('3');
    expect(hundredsChartGradeBandFromGrade('4')).toBe('4');
    expect(hundredsChartGradeBandFromGrade('7')).toBe('4');
    expect(hundredsChartGradeBandFromGrade(' 2 ')).toBe('2');
  });

  it('returns null when there is no canonical grade — the legacy default must stand', () => {
    expect(hundredsChartGradeBandFromGrade(undefined)).toBeNull();
    expect(hundredsChartGradeBandFromGrade('')).toBeNull();
    expect(hundredsChartGradeBandFromGrade('not-a-grade')).toBeNull();
  });
});

describe('generateHundredsChart grade-band wiring', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('a Grade-1 objective stamps band 1, not the hard "2" default', async () => {
    // Non-vacuity: reverting the ctx.grade threading restores `?? '2'` and this fails.
    mockGeminiChallenges([2]);
    const data = await generateHundredsChart(contextFor({ grade: '1' }));
    expect(data.gradeBand).toBe('1');
  });

  it('a Grade-4 objective reaches band 4 and its skip pool (previously unreachable)', async () => {
    // skipValue 0 is invalid → the sanitizer falls back to the grade pool, whose
    // first entry is 3 for band 4 ([3,4,6,7,8,9]) vs 2 for the legacy band 2.
    mockGeminiChallenges([0]);
    const data = await generateHundredsChart(contextFor({ grade: '4' }));
    expect(data.gradeBand).toBe('4');
    expect(data.challenges[0]?.skipValue).toBe(3);
  });

  it('K clamps to the floor rung (band 1)', async () => {
    mockGeminiChallenges([5]);
    const data = await generateHundredsChart(contextFor({ grade: 'K' }));
    expect(data.gradeBand).toBe('1');
  });

  it('no canonical grade → the legacy band-2 default is unchanged (fallback kept)', async () => {
    mockGeminiChallenges([0]);
    const data = await generateHundredsChart(contextFor({}));
    expect(data.gradeBand).toBe('2');
    // Band-2 pool [2,5,10] → sanitizer fallback for an invalid skipValue is 2.
    expect(data.challenges[0]?.skipValue).toBe(2);
  });

  it('an explicit config.gradeBand pin still outranks the canonical grade', async () => {
    mockGeminiChallenges([2]);
    const data = await generateHundredsChart(contextFor({ grade: '1', gradeBand: '3' }));
    expect(data.gradeBand).toBe('3');
  });
});
