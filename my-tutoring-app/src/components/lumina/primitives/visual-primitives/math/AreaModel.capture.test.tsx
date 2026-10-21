// @vitest-environment jsdom
/**
 * The evidence area-model hands the misconception loop (`areaModelEvidence.ts`, `service/math/areaModelRemediation.ts`):
 * every checked entry, corrected tries included, as factual phases, submitted with the scored session under a lesson's
 * evaluation provider. Mounted the way a lesson mounts it, on the shared teaching workspace.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { AreaModelChallenge, AreaModelChallengeType } from './AreaModel';
import { isDiagnosableFailure, type DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

beforeEach(() => { installRuntimeTimers(); seam.evaluationContext = { lesson: 'test' }; });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const challenge = (id: string, factor1Parts: number[], factor2Parts: number[]): AreaModelChallenge => ({ id, factor1Parts, factor2Parts,
  showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null, showCellEquations: true });
const mount = (mode: AreaModelChallengeType, challenges: AreaModelChallenge[], supportTier?: 'easy' | 'medium' | 'hard') =>
  mountWorkspace({ primitiveId: 'area-model', evalMode: mode, instanceId: 'area',
    data: { title: 'Area model', description: 'Use the area model', challengeType: mode, supportTier, challenges } });
const write = (h: WorkspaceHarness, label: string, text: string | number) => act(() => {
  fireEvent.change(h.view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value: String(text) } });
});
/** One cell's entries, the last one right: each wrong one is checked, then Try again. */
const cell = (h: WorkspaceHarness, row: number, col: number, ...entries: number[]) => entries.forEach((entry, i) => {
  h.press(`Cell row ${row + 1} column ${col + 1}`); write(h, 'Cell product', entry); h.press('Check');
  if (i < entries.length - 1) h.dispatch('retry');
});
const sum = (h: WorkspaceHarness, value: number) => { write(h, 'Sum of the cell products', value); h.press('Submit Final Answer'); };
const next = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };
type Submission = [boolean, number, unknown, { studentWork: { responses: unknown[] } }, unknown, DiagnosisEvidence | undefined];
const submission = () => seam.submit.mock.calls[0] as unknown as Submission;

it('records a corrected place-value cell as factual evidence beside the session score', () => {
  const h = mount('find_area', [challenge('area-model-1', [30, 4], [40, 3]), challenge('area-model-2', [20, 5], [30, 6])], 'medium');
  cell(h, 0, 0, 120, 1200); cell(h, 0, 1, 160); cell(h, 1, 0, 90); cell(h, 1, 1, 12);
  sum(h, 1462); next(h);
  cell(h, 0, 0, 60, 600); cell(h, 0, 1, 150); cell(h, 1, 0, 120); cell(h, 1, 1, 30);
  sum(h, 900); next(h);

  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, , work, , evidence] = submission();
  expect(evidence?.observed).toBe('30 × 40 cell, try 1: 120; 20 × 30 cell, try 1: 60');
  expect(evidence?.phases?.map(p => [p.itemId, p.phase, p.expected, p.observed])).toContainEqual(['area-model-1', 'cell', '1200', 'Incorrect: entered 120']);
  expect(evidence?.phases?.find(p => p.observed === 'Incorrect: entered 60')).toMatchObject({
    challenge: 'Area model (20 + 5) × (30 + 6): the cell in column 20 and row 30.', support: 'Try 1; cell labelled "20 × 30"; 0 help panel opening(s) on this model; support tier medium.' });
  expect(evidence?.phases?.filter(p => p.phase === 'sum').map(p => p.challenge)).toEqual([
    'Area model (30 + 4) × (40 + 3): add the cell products 1200 + 160 + 90 + 12.', 'Area model (20 + 5) × (30 + 6): add the cell products 600 + 150 + 120 + 30.']);
  expect(work.studentWork.responses).toHaveLength(12);
  expect(isDiagnosableFailure({ success, score }, evidence)).toBe(true);
  h.close();
});

it('records perimeter entries with the on-screen side sum, and attaches no entry record when every entry is right first time', () => {
  const rectangle = { ...challenge('area-model-1', [6], [8]), showPerimeterExpansion: false };
  const h = mount('perimeter', [rectangle], 'hard');
  write(h, 'Perimeter', 48); h.press('Submit'); h.dispatch('retry');
  write(h, 'Perimeter', 28); h.press('Submit'); next(h);
  const [, , , , , evidence] = submission();
  expect(evidence?.phases?.map(p => [p.phase, p.challenge, p.expected, p.observed, p.support])).toEqual([
    ['perimeter', 'Perimeter of a rectangle with sides 6 and 8.', '28', 'Incorrect: entered 48', 'Try 1; no side sum written out; 0 help panel opening(s) on this model; support tier hard.'],
    ['perimeter', 'Perimeter of a rectangle with sides 6 and 8.', '28', 'Correct: entered 28', 'Try 2; no side sum written out; 0 help panel opening(s) on this model; support tier hard.']]);
  h.close();
  cleanup();

  seam.submit.mockClear();
  const clean = mount('perimeter', [rectangle]);
  write(clean, 'Perimeter', 28); clean.press('Submit'); next(clean);
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(submission()[5]?.phases ?? []).not.toContainEqual(expect.objectContaining({ phase: 'perimeter' }));
  clean.close();
});
