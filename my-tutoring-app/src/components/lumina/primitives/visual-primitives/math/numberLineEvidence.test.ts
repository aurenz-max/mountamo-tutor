import { describe, expect, it } from 'vitest';
import { buildJumpDiagnosisEvidence, jumpFirstResponseScore, jumpResponseFor } from './numberLineEvidence';
import { isSnappedPlacementExact } from './numberLineGrading';
import { classifyEvidenceTier, isDiagnosableFailure } from '../../../evaluation/diagnosis/types';
import { shouldDistill } from '../../../evaluation/diagnosis/distillMisconception';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../service/geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

const add = (startValue: number, changeValue: number) => ({ type: 'add' as const, startValue, changeValue, showJumpArc: false });
const sub = (startValue: number, changeValue: number) => ({ type: 'subtract' as const, startValue, changeValue, showJumpArc: false });
const range = { min: 0, max: 20 };

describe('jump landing grading', () => {
  it('rejects a landing one grid point short or past; accepts the exact snapped landing', () => {
    expect(isSnappedPlacementExact(10, 11, 1)).toBe(false);
    expect(isSnappedPlacementExact(12, 11, 1)).toBe(false);
    expect(isSnappedPlacementExact(11, 11, 1)).toBe(true);
    expect(isSnappedPlacementExact(0.31, 0.3, 0.01)).toBe(false);
    expect(isSnappedPlacementExact(0.1 + 0.2, 0.3, 0.01)).toBe(true);
    expect(isSnappedPlacementExact(0.5, 0.375, 0.125)).toBe(false);
  });
});

describe('jump response evidence', () => {
  // A session in which two first tries land one space short, then are corrected.
  const responses = [
    jumpResponseFor('show_jump-0', 1, [add(8, 3)], [10], 1),
    jumpResponseFor('show_jump-0', 2, [add(8, 3)], [11], 1),
    jumpResponseFor('show_jump-1', 1, [sub(15, 4)], [12], 1),
    jumpResponseFor('show_jump-1', 2, [sub(15, 4)], [11], 1),
    jumpResponseFor('show_jump-2', 1, [add(4, 2)], [6], 1),
    jumpResponseFor('show_jump-3', 1, [sub(9, 5)], [4], 1),
  ];

  it('records each try factually, keeping corrected tries', () => {
    expect(responses.map(r => r.correct)).toEqual([false, true, false, true, true, true]);
    const evidence = buildJumpDiagnosisEvidence(responses, range)!;
    expect(classifyEvidenceTier(evidence)).toBe('structured');
    expect(evidence.phases).toHaveLength(6);
    expect(evidence.phases![0]).toMatchObject({
      itemId: 'show_jump-0#try1', phase: 'single jump',
      challenge: 'Start at 8 and add 3 (3 spaces right)', expected: 'landing at 11',
      observed: 'Incorrect: landing placed at 10, 2 spaces right of 8',
      support: 'Start marked; no jump arc drawn; first try',
    });
    expect(evidence.phases![2].observed).toBe('Incorrect: landing placed at 12, 3 spaces left of 15');
    expect(evidence.phases![3].support).toContain('try 2, after "not quite" feedback');
    expect(evidence.observed).toBe('landing placed at 12, 3 spaces left of 15');
    expect(evidence.priorAttempts).toEqual([{ challenge: 'Start at 8 and add 3 (3 spaces right)', observed: 'landing placed at 10, 2 spaces right of 8' }]);
    // Facts, not a diagnosis: no error-type label is computed in code.
    expect(JSON.stringify(evidence)).not.toMatch(/off.by.one|miscount|counts the start|misconception/i);
  });

  it('reports chained landings separately and nothing when every try was right', () => {
    const chained = jumpResponseFor('show_jump-0', 1, [add(5, 3), sub(8, 2)], [8, 7], 1);
    expect(chained.correct).toBe(false);
    expect(buildJumpDiagnosisEvidence([chained], range)!.phases![0]).toMatchObject({
      phase: 'two chained jumps', expected: 'landing 1 at 8; landing 2 at 6',
      observed: 'Incorrect: landing 1 placed at 8, 3 spaces right of 5; landing 2 placed at 7, 1 space left of 8',
    });
    expect(buildJumpDiagnosisEvidence(responses.filter(r => r.correct), range)).toBeUndefined();
  });

  it('lets the shared gate see wrong first tries in a session that always ends solved', () => {
    const score = jumpFirstResponseScore(responses);
    expect(score).toBe(50);
    const evidence = { ...buildJumpDiagnosisEvidence(responses, range)!, firstResponseScore: score };
    const finished = { success: true, score: 100 };
    expect(isDiagnosableFailure(finished, evidence)).toBe(true);
    expect(shouldDistill(evidence, finished)).toBe('structured');
    // Without the opt-in field the gate is exactly the old rule.
    expect(isDiagnosableFailure(finished, { ...evidence, firstResponseScore: undefined })).toBe(false);
    expect(shouldDistill({ ...evidence, firstResponseScore: undefined }, finished)).toBe('none');
    expect(isDiagnosableFailure(finished, { ...evidence, firstResponseScore: 75 })).toBe(false);
    expect(isDiagnosableFailure({ success: false, score: 100 }, null)).toBe(true);
    expect(isDiagnosableFailure({ success: true, score: 40 }, undefined)).toBe(true);
  });
});
