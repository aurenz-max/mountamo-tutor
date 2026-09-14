// @vitest-environment jsdom
import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { isDiagnosableFailure } from '../../../evaluation/diagnosis/types';
const state = vi.hoisted(() => ({ writes: [] as any[] }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <p>Done</p> }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: vi.fn(), playIncorrect: vi.fn(), select: vi.fn(), navigate: vi.fn(), toggle: vi.fn() } }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => null, usePrimitiveEvaluation: () => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (success: boolean, score: number, metrics: any, studentWork: any, _partial: unknown, diagnosisEvidence: any) => {
        const result = { success, score, metrics, studentWork, diagnosisEvidence };
        state.writes.push(result); setSubmitted(true); return result;
      } };
  } };
});
import FractionCircles, { type FractionCirclesChallenge } from './FractionCircles';

const compare = (id: string, a: [number, number], b: [number, number]): FractionCirclesChallenge => ({
  id, type: 'compare', numerator: a[0], denominator: a[1], compareFraction: { numerator: b[0], denominator: b[1] },
  instruction: `Compare ${a.join('/')} and ${b.join('/')}.`, hint: 'Look', narration: '', showFractionLabels: false, supportTier: 'medium',
});
const answer = (choice: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: choice }));
  fireEvent.click(screen.getByRole('button', { name: /check/i }));
};
const next = () => fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
beforeEach(() => { state.writes = []; });

it('records first compare responses and opts into the first-response gate when the session still ends at 100%', () => {
  render(<FractionCircles data={{ title: 'Compare', instanceId: 'fc', challenges: [
    compare('a', [1, 4], [1, 8]), compare('b', [2, 6], [2, 3]), compare('c', [3, 4], [1, 2])] }} />);
  answer(/right is larger/i); answer(/left is larger/i); next();
  answer(/left is larger/i); answer(/equal/i); answer(/right is larger/i); next();
  answer(/left is larger/i);
  expect(state.writes).toHaveLength(1);
  const [write] = state.writes;
  expect(write).toMatchObject({ success: true, score: 100 });
  expect(write.studentWork.compareResponses.map((r: any) => [r.itemId, r.chosen, r.attempt])).toEqual([
    ['a', 'right', 1], ['a', 'left', 2], ['b', 'left', 1], ['b', 'equal', 2], ['b', 'right', 3], ['c', 'left', 1]]);
  const evidence = write.diagnosisEvidence;
  expect(evidence.firstResponseScore).toBe(33);
  expect(evidence.phases.map((p: any) => [p.itemId, p.expected, p.observed])).toEqual([
    ['a', '1/4 (left circle) is larger', '1/8 (right circle) is larger'],
    ['b', '2/3 (right circle) is larger', '2/6 (left circle) is larger'],
    ['c', '3/4 (left circle) is larger', '3/4 (left circle) is larger']]);
  expect(evidence.observed).toBe('Chose: 2/6 (left circle) is larger.');
  expect(evidence.priorAttempts.map((p: any) => p.observed)).toEqual([
    'Chose: 1/8 (right circle) is larger (response 1)', 'Chose: They are equal (response 2)']);
  expect(evidence.phases.every((p: any) => p.support.includes('labels hidden'))).toBe(true);
  expect(JSON.stringify(evidence)).not.toMatch(/misconception|denominator/i);
  expect(isDiagnosableFailure(write, evidence)).toBe(true);
});

it('attaches no evidence when every compare response is correct', () => {
  render(<FractionCircles data={{ title: 'Compare', instanceId: 'fc2', challenges: [compare('a', [1, 4], [1, 8])] }} />);
  answer(/left is larger/i);
  expect(state.writes[0].diagnosisEvidence).toBeUndefined();
  expect(isDiagnosableFailure(state.writes[0], state.writes[0].diagnosisEvidence)).toBe(false);
});
