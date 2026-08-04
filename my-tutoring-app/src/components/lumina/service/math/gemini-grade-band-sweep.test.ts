/**
 * Grade-band resolution — 14m sweep wiring tests for shape-composer,
 * net-folder, and timeline-builder (canonical `ctx.grade` first, prose
 * fallback; same template as number-line `dcfaac7` / calendar `423c58f`).
 *
 * Defect shapes pinned here:
 *   • shape-composer: `gl.includes("k")` — a 'k' anywhere in the prose lands
 *     K (middle/high-school prose contains "thinking").
 *   • net-folder: `gl.includes('5')` — the elementary sentence "grades 1-5"
 *     contains a '5', so EVERY elementary lesson landed '4-5' and '3-4' was
 *     unreachable.
 *   • timeline-builder: `includes("1")` matches "grades 1-5" and `includes("k")`
 *     matches "thinking", so EVERY production lesson landed K-1; the
 *     2-3 / 4-5 / 6-8 rungs were unreachable.
 * Each generator's tests: mapper rungs + wiring (canonical beats prose, revert
 * fails) + the untouched no-grade prose fallback.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateShapeComposer, shapeComposerGradeBandFromGrade } from './gemini-shape-composer';
import { generateNetFolder, netFolderGradeBandFromGrade } from './gemini-net-folder';
import {
  generateTimelineBuilder,
  timelineBuilderGradeBandFromGrade,
} from '../calendar/gemini-timeline-builder';

const generateContent = vi.mocked(ai.models.generateContent);

// The literal prose production sends (geminiService.getGradeLevelContext).
const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';
const MIDDLE_SCHOOL_PROSE =
  'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.';

function contextFor(
  componentId: GenerationContext['componentId'],
  opts: { grade?: string; gradeContext?: string },
): GenerationContext {
  return {
    componentId,
    instanceId: `${componentId}-test`,
    topic: 'Test topic',
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
  // Empty content: every orchestrator here degrades to its hardcoded fallback
  // challenges without throwing, and the gradeBand stamp is code-owned.
  generateContent.mockResolvedValue({
    text: JSON.stringify({ title: 'T', description: 'D', challenges: [], events: [] }),
  } as never);
});

describe('shape-composer grade band (14m)', () => {
  it('mapper: K → K, 1+ clamps to the 1 rung, null without a grade', () => {
    expect(shapeComposerGradeBandFromGrade('K')).toBe('K');
    expect(shapeComposerGradeBandFromGrade('1')).toBe('1');
    expect(shapeComposerGradeBandFromGrade('2')).toBe('1');
    expect(shapeComposerGradeBandFromGrade('7')).toBe('1');
    expect(shapeComposerGradeBandFromGrade(undefined)).toBeNull();
    expect(shapeComposerGradeBandFromGrade('not-a-grade')).toBeNull();
  });

  it('canonical grade beats prose in both directions; no-grade keeps the prose path', async () => {
    // Non-vacuity: middle-school prose contains a 'k' ("thinking"), so without
    // the canonical threading this stamps 'K'.
    const g1 = await generateShapeComposer(
      contextFor('shape-composer', { grade: '1', gradeContext: MIDDLE_SCHOOL_PROSE }),
    );
    expect(g1.gradeBand).toBe('1');
    const k = await generateShapeComposer(contextFor('shape-composer', { grade: 'K' }));
    expect(k.gradeBand).toBe('K');
    // Fallback unchanged: elementary prose has no 'k' → '1'; middle prose → 'K'
    // (the documented limitation; canonical grade is the cure, not a prose fix).
    const noGrade = await generateShapeComposer(contextFor('shape-composer', {}));
    expect(noGrade.gradeBand).toBe('1');
    const middle = await generateShapeComposer(
      contextFor('shape-composer', { gradeContext: MIDDLE_SCHOOL_PROSE }),
    );
    expect(middle.gradeBand).toBe('K');
  });
});

describe('net-folder grade band (14m)', () => {
  it('mapper: ≤4 → 3-4 (floor clamp incl. K), 5+ → 4-5, null without a grade', () => {
    expect(netFolderGradeBandFromGrade('K')).toBe('3-4');
    expect(netFolderGradeBandFromGrade('3')).toBe('3-4');
    expect(netFolderGradeBandFromGrade('4')).toBe('3-4');
    expect(netFolderGradeBandFromGrade('5')).toBe('4-5');
    expect(netFolderGradeBandFromGrade('8')).toBe('4-5');
    expect(netFolderGradeBandFromGrade(undefined)).toBeNull();
    expect(netFolderGradeBandFromGrade('not-a-grade')).toBeNull();
  });

  it('a Grade-3 objective reaches 3-4 under elementary prose; no-grade keeps the legacy 4-5', async () => {
    // Non-vacuity: "grades 1-5" contains a '5', so without the canonical
    // threading a Grade-3 lesson stamps '4-5'.
    const g3 = await generateNetFolder(contextFor('net-folder', { grade: '3' }));
    expect(g3.gradeBand).toBe('3-4');
    expect(g3.net.gridOverlay).toBe(false);
    const g5 = await generateNetFolder(contextFor('net-folder', { grade: '5' }));
    expect(g5.gradeBand).toBe('4-5');
    const noGrade = await generateNetFolder(contextFor('net-folder', {}));
    expect(noGrade.gradeBand).toBe('4-5'); // legacy prose path, unchanged
  });
});

describe('timeline-builder grade band (14m)', () => {
  it('mapper: every rung is reachable and 9+ clamps to 6-8', () => {
    expect(timelineBuilderGradeBandFromGrade('K')).toBe('K-1');
    expect(timelineBuilderGradeBandFromGrade('1')).toBe('K-1');
    expect(timelineBuilderGradeBandFromGrade('2')).toBe('2-3');
    expect(timelineBuilderGradeBandFromGrade('3')).toBe('2-3');
    expect(timelineBuilderGradeBandFromGrade('4')).toBe('4-5');
    expect(timelineBuilderGradeBandFromGrade('5')).toBe('4-5');
    expect(timelineBuilderGradeBandFromGrade('6')).toBe('6-8');
    expect(timelineBuilderGradeBandFromGrade('9')).toBe('6-8');
    expect(timelineBuilderGradeBandFromGrade(undefined)).toBeNull();
    expect(timelineBuilderGradeBandFromGrade('not-a-grade')).toBeNull();
  });

  it('canonical grades reach the previously unreachable rungs; no-grade keeps K-1', async () => {
    // Non-vacuity: "grades 1-5" contains a '1', so without the canonical
    // threading every one of these stamps 'K-1'.
    const g4 = await generateTimelineBuilder(contextFor('timeline-builder', { grade: '4' }));
    expect(g4.gradeBand).toBe('4-5');
    const g2 = await generateTimelineBuilder(contextFor('timeline-builder', { grade: '2' }));
    expect(g2.gradeBand).toBe('2-3');
    const g7 = await generateTimelineBuilder(
      contextFor('timeline-builder', { grade: '7', gradeContext: MIDDLE_SCHOOL_PROSE }),
    );
    expect(g7.gradeBand).toBe('6-8');
    const noGrade = await generateTimelineBuilder(contextFor('timeline-builder', {}));
    expect(noGrade.gradeBand).toBe('K-1'); // legacy prose path, unchanged
  });
});
