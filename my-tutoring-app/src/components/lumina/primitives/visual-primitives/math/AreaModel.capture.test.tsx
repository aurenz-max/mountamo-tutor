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
import AreaModel, { type AreaModelChallenge } from './AreaModel';
import { isDiagnosableFailure, type DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

afterEach(() => cleanup());
const challenge = (id: string, factor1Parts: number[], factor2Parts: number[]): AreaModelChallenge => ({ id, factor1Parts, factor2Parts,
  showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null, showCellEquations: true });
const click = async (el: Element) => act(async () => { fireEvent.click(el); });
const type = async (el: Element, value: string) => act(async () => { fireEvent.change(el, { target: { value } }); });
async function cell(label: string, ...entries: string[]) {
  await click(screen.getByText(label));
  for (const entry of entries) {
    await type(document.getElementById('cell-input')!, entry);
    await click(screen.getByRole('button', { name: 'Check' }));
  }
}
async function sum(value: string) {
  await type(screen.getByPlaceholderText('Enter sum'), value);
  await click(screen.getByRole('button', { name: 'Submit Final Answer' }));
}
const submission = () => seam.submissions[0] as [boolean, number, unknown, { studentWork: { responses: unknown[] } }, unknown, DiagnosisEvidence | undefined];

it('records a corrected place-value cell as factual evidence; the submitted score still reads 100', async () => {
  seam.submissions = [];
  render(<AreaModel data={{ title: 'Multiply', description: 'Area model', challengeType: 'find_area', supportTier: 'medium',
    challenges: [challenge('area-model-1', [30, 4], [40, 3]), challenge('area-model-2', [20, 5], [30, 6])] }} />);
  await cell('30 × 40', '120', '1200'); await cell('4 × 40', '160'); await cell('30 × 3', '90'); await cell('4 × 3', '12');
  await sum('1462');
  await click(screen.getByRole('button', { name: /Next Problem/ }));
  await cell('20 × 30', '60', '600'); await cell('5 × 30', '150'); await cell('20 × 6', '120'); await cell('5 × 6', '30');
  await sum('900');

  expect(seam.submissions).toHaveLength(1);
  const [success, score, , work, , evidence] = submission();
  // One wrong cell of four rounds away in the per-model score, so only the first-response score shows it.
  expect([success, score]).toEqual([true, 100]);
  expect(evidence?.firstResponseScore).toBe(0);
  expect(evidence?.observed).toBe('30 × 40 cell, try 1: 120; 20 × 30 cell, try 1: 60');
  expect(evidence?.phases?.map(p => [p.itemId, p.phase, p.expected, p.observed])).toContainEqual(['area-model-1', 'cell', '1200', 'Incorrect: entered 120']);
  expect(evidence?.phases?.find(p => p.observed === 'Incorrect: entered 60')).toMatchObject({
    challenge: 'Area model (20 + 5) × (30 + 6): the cell in column 20 and row 30.', support: 'Try 1; cell labelled "20 × 30"; 0 help panel opening(s) on this model; support tier medium.' });
  expect(evidence?.phases?.filter(p => p.phase === 'sum').map(p => p.challenge)).toEqual([
    'Area model (30 + 4) × (40 + 3): add the cell products 1200 + 160 + 90 + 12.', 'Area model (20 + 5) × (30 + 6): add the cell products 600 + 150 + 120 + 30.']);
  expect(work.studentWork.responses).toHaveLength(12);
  expect(isDiagnosableFailure({ success, score }, evidence)).toBe(true);
});

it('records perimeter entries with the on-screen side sum, and attaches nothing when every entry is right first time', async () => {
  seam.submissions = [];
  const rectangle = { ...challenge('area-model-1', [6], [8]), showPerimeterExpansion: false };
  const view = render(<AreaModel data={{ title: 'Perimeter', description: 'Around', challengeType: 'perimeter', supportTier: 'hard', challenges: [rectangle] }} />);
  for (const value of ['48', '28']) {
    await type(screen.getByPlaceholderText('Enter perimeter'), value);
    await click(screen.getByRole('button', { name: 'Submit' }));
  }
  const [, , , , , evidence] = submission();
  expect(evidence?.phases?.map(p => [p.phase, p.challenge, p.expected, p.observed, p.support])).toEqual([
    ['perimeter', 'Perimeter of a rectangle with sides 6 and 8.', '28', 'Incorrect: entered 48', 'Try 1; no side sum written out; 0 help panel opening(s) on this model; support tier hard.'],
    ['perimeter', 'Perimeter of a rectangle with sides 6 and 8.', '28', 'Correct: entered 28', 'Try 2; no side sum written out; 0 help panel opening(s) on this model; support tier hard.']]);
  view.unmount();

  seam.submissions = [];
  render(<AreaModel data={{ title: 'Perimeter', description: 'Around', challengeType: 'perimeter', challenges: [rectangle] }} />);
  await type(screen.getByPlaceholderText('Enter perimeter'), '28');
  await click(screen.getByRole('button', { name: 'Submit' }));
  expect(seam.submissions).toHaveLength(1);
  expect(submission()[5]).toBeUndefined();
});
