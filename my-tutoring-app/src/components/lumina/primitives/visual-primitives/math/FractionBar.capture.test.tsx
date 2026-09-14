// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const seam = vi.hoisted(() => ({ submissions: [] as unknown[][] }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }) }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  submitResult: (...args: unknown[]) => seam.submissions.push(args) }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import FractionBar from './FractionBar';
import { isDiagnosableFailure, type DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const fraction = (id: string, n: number, d: number) => ({ id, numerator: n, denominator: d,
  numeratorChoices: [n, d, n - 1, d + 1], denominatorChoices: [d, n, d + 1, d + 2] });

it('records swapped first responses as factual evidence without changing the submitted score or success', async () => {
  vi.useFakeTimers();
  seam.submissions = [];
  render(<FractionBar data={{ title: 'Build', description: 'Shade', challengeType: 'build', supportTier: 'medium', showPartitionNumerals: false,
    challenges: [fraction('fraction-bar-1', 3, 4), fraction('fraction-bar-2', 4, 5), fraction('fraction-bar-3', 2, 6)] }} />);
  const click = async (name: string | RegExp) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
  const answer = async (value: number) => { await click(String(value)); await click('Check Answer'); };
  const settle = async () => act(async () => { vi.advanceTimersByTime(1600); });
  const shade = async (count: number) => { for (let i = 1; i <= count; i++) await click(`Shade part ${i}`); await click('Submit Fraction'); };
  const unshadeTo = async (count: number, from: number) => { for (let i = from; i > count; i--) await click(`Unshade part ${i}`); await click('Submit Fraction'); };

  await answer(4); await answer(3); await settle(); await answer(4); await settle(); await shade(3); // numerator swap
  await click(/Next Problem/);
  await answer(5); await answer(4); await settle(); await answer(5); await settle(); await shade(4); // numerator swap
  await click(/Next Problem/);
  await answer(2); await settle(); await answer(6); await settle(); await shade(6); await unshadeTo(2, 6); // shaded the denominator

  expect(seam.submissions).toHaveLength(1);
  const [success, score, , work, , evidence] = seam.submissions[0] as [boolean, number, unknown, { studentWork: { responses: unknown[] } }, unknown, DiagnosisEvidence];
  expect(success).toBe(true);
  expect(score).toBeGreaterThanOrEqual(60);
  expect(evidence.firstResponseScore).toBe(0);
  expect(evidence.phases?.map(p => [p.itemId, p.phase, p.expected, p.observed])).toEqual([
    ['fraction-bar-1', 'numerator', '3', '4'], ['fraction-bar-2', 'numerator', '4', '5'],
    ['fraction-bar-3', 'build', 'shaded 2 of 6 parts', 'shaded 6 of 6 parts']]);
  expect(evidence.phases?.[0].support).toMatch(/Attempt 1 .*support tier medium/);
  expect(work.studentWork.responses).toHaveLength(12);
  expect(isDiagnosableFailure({ success, score }, evidence)).toBe(true);
});

it('attaches no evidence when every response was correct first time', async () => {
  vi.useFakeTimers();
  seam.submissions = [];
  render(<FractionBar data={{ title: 'Build', description: 'Shade', challengeType: 'build', showPartitionNumerals: false,
    challenges: [fraction('fraction-bar-1', 2, 3)] }} />);
  const click = async (name: string) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
  await click('2'); await click('Check Answer'); await act(async () => { vi.advanceTimersByTime(1600); });
  await click('3'); await click('Check Answer'); await act(async () => { vi.advanceTimersByTime(1600); });
  await click('Shade part 1'); await click('Shade part 2'); await click('Submit Fraction');
  expect(seam.submissions).toHaveLength(1);
  expect(seam.submissions[0][5]).toBeUndefined();
});
