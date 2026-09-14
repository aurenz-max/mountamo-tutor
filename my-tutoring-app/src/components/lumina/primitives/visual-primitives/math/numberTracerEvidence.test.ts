import { expect, it } from 'vitest';
import { numberTracerDiagnosisEvidence, type NumberTracerResponse } from './numberTracerEvidence';

const response = (challengeId: string, start: number, writtenAs: string | null, attempt: number, score = 95): NumberTracerResponse => ({
  challengeId, type: 'sequence', attempt, target: start + 2, sequenceNumbers: [start, start + 1, start + 2, start + 3], missingIndex: 2,
  writtenAs, score, correct: writtenAs === String(start + 2) && score >= 50, guideShown: false, modelShown: false, hintShown: attempt > 2, supportTier: 'hard' });

it('keeps every drawing read as another number within the 12 phases, in the order they happened', () => {
  const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
  // Each item: the number after the run, then an illegible right number, then accepted.
  const responses = ids.flatMap((id, i) => [response(id, i, String(i + 4), 1, 10), response(id, i, String(i + 2), 2, 30), response(id, i, String(i + 2), 3)]);
  const evidence = numberTracerDiagnosisEvidence(ids, responses)!;
  expect(evidence.phases).toHaveLength(12);
  expect(evidence.phases!.filter(p => p.observed.startsWith('Incorrect: the judge read the drawing as')).map(p => p.itemId)).toEqual(ids);
  expect(evidence.phases!.filter(p => p.observed.startsWith('Correct'))).toHaveLength(0);
  expect(evidence.phases!.map(p => p.itemId)).toEqual([...evidence.phases!.map(p => p.itemId)].sort());
  expect(evidence.phases![0]).toEqual({ itemId: 'c1', phase: 'sequence', challenge: 'Counting run 0, 1, ?, 3: write the hidden number.', expected: '2',
    observed: 'Incorrect: the judge read the drawing as 4 (score 10)', support: 'Try 1; no tracing guide; hint not shown; support tier hard.' });
  expect(evidence.firstResponseScore).toBe(0);
  expect(evidence.observed).toMatch(/^run 0, 1, \?, 3, try 1: wrote 4; .*; 7 other rejected drawing\(s\) were not read as a different number$/);
});

it('attaches nothing when rejections were legibility only, or nothing was wrong', () => {
  const ids = ['c1', 'c2'];
  expect(numberTracerDiagnosisEvidence(ids, [response('c1', 0, '2', 1, 30), response('c1', 0, '2', 2), response('c2', 3, '?', 1, 0), response('c2', 3, null, 2, 96)])).toBeUndefined();
  expect(numberTracerDiagnosisEvidence(ids, [response('c1', 0, '2', 1), response('c2', 3, '5', 1)])).toBeUndefined();
});
