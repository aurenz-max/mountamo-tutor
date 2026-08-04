/**
 * Grade-band resolution for sorting-station — canonical `ctx.grade` first,
 * prose fallback (systemic 14m sweep).
 *
 * The defect shape: `resolveGradeBand()` substring-matches `gradeContext` PROSE
 * with `/[kK]|kinder/i` — a 'k' ANYWHERE lands the K band, so middle-school
 * prose ("critical thinking") inverts to Kindergarten. Elementary prose happens
 * to contain no 'k', so K/G1 production landed correctly — the canonical mapper
 * makes that correctness intentional instead of accidental, and rescues the
 * out-of-band inversion. These tests pin:
 *   • the canonical mapper (K → 'K', 1+ → '1' ceiling clamp, null without a grade),
 *   • the WIRING — a canonical grade decides the stamped `gradeBand` even when
 *     the prose disagrees (reverting the threading fails those),
 *   • the legacy fallback — no canonical grade ⇒ prose path byte-compatible
 *     (14m template: never delete the fallback).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateSortingStation, sortingStationGradeBandFromGrade } from './gemini-sorting-station';

const generateContent = vi.mocked(ai.models.generateContent);

// The literal prose production sends (geminiService.getGradeLevelContext).
const KINDERGARTEN_PROSE =
  'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.';
const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';
const MIDDLE_SCHOOL_PROSE =
  'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.';

function contextFor(opts: { grade?: string; gradeContext?: string }): GenerationContext {
  return {
    componentId: 'sorting-station',
    instanceId: 'sorting-station-test',
    topic: 'Sorting objects',
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

/** One generic response every unpinned sub-generator can map without throwing. */
function mockAllSubGenerators() {
  generateContent.mockResolvedValue({
    text: JSON.stringify({
      title: 'Sorting Station',
      description: 'Sort the objects.',
      challenges: [
        {
          instruction: 'Sort them into groups.',
          sortingAttribute: 'type',
          objects: [
            { label: 'Apple', emoji: '🍎', type: 'fruit', size: 'small', category: 'food' },
            { label: 'Banana', emoji: '🍌', type: 'fruit', size: 'small', category: 'food' },
            { label: 'Truck', emoji: '🚚', type: 'vehicle', size: 'big', category: 'toy' },
            { label: 'Car', emoji: '🚗', type: 'vehicle', size: 'small', category: 'toy' },
          ],
          comparisonQuestion: 'Which group has more?',
          correctComparison: 'equal',
          oddOneOutIndex: 2,
          oddOneOutReason: 'It is not a fruit.',
        },
      ],
    }),
  } as never);
}

describe('sortingStationGradeBandFromGrade (canonical mapper)', () => {
  it('maps canonical grades onto the K/1 ladder, clamping 1+ to the ceiling rung', () => {
    expect(sortingStationGradeBandFromGrade('K')).toBe('K');
    expect(sortingStationGradeBandFromGrade('k')).toBe('K');
    expect(sortingStationGradeBandFromGrade('1')).toBe('1');
    expect(sortingStationGradeBandFromGrade('2')).toBe('1');
    expect(sortingStationGradeBandFromGrade('6')).toBe('1');
    expect(sortingStationGradeBandFromGrade(' 1 ')).toBe('1');
  });

  it('returns null when there is no canonical grade — the prose fallback must stay reachable', () => {
    expect(sortingStationGradeBandFromGrade(undefined)).toBeNull();
    expect(sortingStationGradeBandFromGrade('')).toBeNull();
    expect(sortingStationGradeBandFromGrade('not-a-grade')).toBeNull();
  });
});

describe('generateSortingStation grade-band wiring', () => {
  beforeEach(() => {
    generateContent.mockReset();
    mockAllSubGenerators();
  });

  it('a canonical K objective lands the K band even under elementary prose', async () => {
    // Non-vacuity: elementary prose has no 'k', so without the canonical
    // threading the prose parser returns '1' and this fails.
    const data = await generateSortingStation(contextFor({ grade: 'K' }));
    expect(data.gradeBand).toBe('K');
    expect(data.maxCategories).toBeLessThanOrEqual(3);
  });

  it('a canonical Grade-6 objective clamps to the 1 rung — rescuing the "thinking" k-inversion', async () => {
    const data = await generateSortingStation(
      contextFor({ grade: '6', gradeContext: MIDDLE_SCHOOL_PROSE }),
    );
    expect(data.gradeBand).toBe('1');
  });

  it('no canonical grade → the legacy prose path is unchanged (fallback kept)', async () => {
    const k = await generateSortingStation(contextFor({ gradeContext: KINDERGARTEN_PROSE }));
    expect(k.gradeBand).toBe('K');
    const elem = await generateSortingStation(contextFor({ gradeContext: ELEMENTARY_PROSE }));
    expect(elem.gradeBand).toBe('1');
    // Documents the fallback's KNOWN limitation ('k' in "thinking" lands K):
    // prose banding is fallback-only; canonical grade is the cure, not a prose fix.
    const middle = await generateSortingStation(contextFor({ gradeContext: MIDDLE_SCHOOL_PROSE }));
    expect(middle.gradeBand).toBe('K');
  });
});
