import { expect, it } from 'vitest';
import { areaModelDiagnosisEvidence, type AreaModelResponse } from './areaModelEvidence';

const entry = (challengeId: string, cell: [number, number], entered: string, expected: string, attempt: number): AreaModelResponse => ({
  challengeId, step: 'cell', attempt, cell, factor1Parts: [30, 4], factor2Parts: [40, 3], expected, entered, correct: entered === expected,
  scaffoldShown: true, hintsBefore: 0 });

it('keeps every wrong entry within the 12 phases the store accepts, then first tries, in the order they happened', () => {
  const ids = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const responses = ids.flatMap(id => [entry(id, [0, 0], '120', '1200', 1), entry(id, [0, 0], '1200', '1200', 2),
    entry(id, [0, 1], '160', '160', 1), entry(id, [1, 0], '90', '90', 1), entry(id, [1, 1], '12', '12', 1)]);
  const evidence = areaModelDiagnosisEvidence(ids, responses, 'find_area', 'medium')!;
  expect(evidence.phases).toHaveLength(12);
  expect(evidence.phases!.filter(p => p.observed === 'Incorrect: entered 120').map(p => p.itemId)).toEqual(ids);
  expect(evidence.phases!.filter(p => p.observed.startsWith('Correct') && p.support.startsWith('Try 2'))).toHaveLength(0);
  expect(evidence.phases!.map(p => p.itemId)).toEqual([...evidence.phases!.map(p => p.itemId)].sort());
  expect(evidence.firstResponseScore).toBe(0);
});
