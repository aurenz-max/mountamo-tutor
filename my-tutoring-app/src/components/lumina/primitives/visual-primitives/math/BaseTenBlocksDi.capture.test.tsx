// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
const seam = vi.hoisted(() => ({ emit: null as ((e: LoopEmission) => void) | null, submit: vi.fn(), identity: {} as Record<string, unknown> }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ({ isConnected: true, isListening: true,
  isAudioPlaying: false, sessionMode: 'idle', activePrimitiveId: null, sessionResumeCount: 0, conversation: [],
  sendText: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), reconnect: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn() }) }));
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({ useJudgedSpeechLoop: (options: { onEmission: (e: LoopEmission) => void }) => {
  seam.emit = options.onEmission;
  return { queueCue: vi.fn(), sendCueNow: vi.fn(), submitGestureAttempt: vi.fn(), clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(), isAwaitingJudgment: () => false, voiceTurns: {}, config: {} };
} }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: (identity: Record<string, unknown>) => {
  seam.identity = identity; return { hasSubmitted: false, submitResult: seam.submit };
} }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/DiActionPanel', () => ({ default: ({ run }: { run: { start: () => void } }) => <button onClick={run.start}>Start test</button> }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn() } }));
import BaseTenBlocksDi from './BaseTenBlocksDi';
import { itemsFromChallenges, baseTenHarnessAnswers, type BaseTenItem } from './baseTenScript';
import { eligibleLearningResponses } from '../../../evaluation/learningResponseEvidence';
import { captureMisconception, resetMisconceptionCaptureLatch } from '../../../evaluation/diagnosis/captureMisconception';
import { authApi } from '@/lib/authApiClient';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';
import type { BtMode } from './baseTenModel';

const identity = { skillId: 'NBT004-01', subskillId: 'NBT004-01-b' };
beforeEach(() => { resetMisconceptionCaptureLatch(); seam.submit.mockReset(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function mount(numbers: number[], mode: BtMode = 'read_blocks') {
  const challenges = numbers.map(targetNumber => ({ type: mode, targetNumber, instruction: 'Read', hint: 'Look' }));
  const items = itemsFromChallenges(challenges, mode);
  render(<BaseTenBlocksDi data={{ ...identity, title: 'Blocks', description: 'Read', numberValue: numbers[0], gradeBand: '4-5', supportTier: 'medium', challenges }} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test')); });
  return { challenges, items };
}
/** Say the bare count for each listed worth step `times` times (3 = capped, unsolved); every other step is affirmed first try. */
async function drive(items: BaseTenItem[], wrong: BaseTenItem[], times = 3) {
  for (const item of items) {
    const answers = baseTenHarnessAnswers(item);
    const missed = wrong.includes(item);
    for (let n = 0; missed && n < times; n++) await act(async () => {
      seam.emit?.({ kind: 'attempt-open', attempt: { source: 'voice' } } as LoopEmission);
      seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text: answers.signatureWrong!.text } as LoopEmission);
      seam.emit?.({ kind: 'verdict', judgment: 'corrected', attempt: { source: 'voice', transcript: answers.signatureWrong!.text } } as LoopEmission);
      seam.emit?.({ kind: 'verdict-text', judgment: 'corrected', text: 'My turn: each rod is worth ten.' } as LoopEmission);
    });
    if (!missed || times < 3) await act(async () => {
      seam.emit?.({ kind: 'verdict', judgment: 'affirmed', attempt: { source: 'voice', transcript: answers.correct } } as LoopEmission);
    });
  }
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
  return { success, score, metrics, studentWork, diagnosisEvidence,
    result: { ...seam.identity, primitiveType: 'base-ten-blocks', success, score, metrics, diagnosisEvidence, studentWork,
      attemptId: 'blocks-attempt', instanceId: 'blocks', lessonContext: { gradeLevel: '4', curriculumSubject: 'MATHEMATICS' } } as unknown as PrimitiveEvaluationResult };
}

it('uses the real shared runner to preserve count/worth responses and support in normal student work', async () => {
  const { challenges, items } = await mount([2305, 5206]);
  const { studentWork } = await drive(items, []);
  expect(studentWork.problem.challenges).toEqual(challenges);
  expect(eligibleLearningResponses(studentWork.learningResponses)).toHaveLength(4);
  expect(studentWork.learningResponses.map((r: { observed: string }) => r.observed)).toEqual(items.map(i => baseTenHarnessAnswers(i).correct));
});

it('originates a skill-scoped observation from read_blocks corrections, with the factual answer word and the tutor correction', async () => {
  const { items } = await mount([2305, 5206]);
  const worth = items.find(i => i.step === 'worth')!;
  const { success, score, studentWork, diagnosisEvidence, result } = await drive(items, [worth]);
  expect(success).toBe(false);
  expect(score).toBe(50);
  expect(diagnosisEvidence.firstResponseScore).toBe(75);
  const said = baseTenHarnessAnswers(worth);
  expect(diagnosisEvidence).toMatchObject({ observed: said.signatureWrong!.text, expected: said.correct,
    judgeFeedback: 'My turn: each rod is worth ten.' });
  expect(diagnosisEvidence.phases).toHaveLength(3);
  expect(diagnosisEvidence.phases.every((p: { itemId: string; expected: string }) => p.itemId === worth.id && p.expected === said.correct)).toBe(true);
  expect(studentWork.diagnosisEvidence).toEqual(diagnosisEvidence);

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, confidence: 'high', evidenceTier: 'judge',
    misconceptionText: 'Synthetic hypothesis.', teachingImplication: 'Pair equal counts of different block sizes.', checkNext: 'Ask worth independently.' }) }));
  vi.mocked(authApi.post).mockResolvedValue({ stored: true });
  await captureMisconception(result, { sessionId: 's', subskillId: 'NBT004-01-b', gradeLevel: '4' });
  const distill = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
  expect(distill.params).toMatchObject({ evalMode: 'read_blocks', success: false, score: 50 });
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({
    primitive_type: 'base-ten-blocks', scope: 'skill', skill_id: 'NBT004-01', subskill_id: 'NBT004-01-b',
    learning_observation: expect.objectContaining({ evalMode: 'read_blocks', phases: expect.arrayContaining([
      expect.objectContaining({ itemId: worth.id, phase: expect.any(String), expected: said.correct, observed: said.signatureWrong!.text }),
    ]) }),
  }));
});

it('keeps correction evidence when one missed step in a passing run leaves first responses above the gate', async () => {
  const { items } = await mount([2305, 5206, 6708]);
  const { success, score, studentWork, diagnosisEvidence, result } = await drive(items, [items.find(i => i.step === 'worth')!]);
  expect([success, score, diagnosisEvidence.firstResponseScore]).toEqual([true, 67, 83]);
  expect(studentWork.diagnosisEvidence.phases).toHaveLength(3);
  vi.stubGlobal('fetch', vi.fn());
  const statuses: string[] = [];
  expect(await captureMisconception(result, { sessionId: 's', subskillId: 'NBT004-01-b', onStatus: s => statuses.push(s.stage) })).toBeNull();
  expect(diagnosisEvidence).toBeDefined();
  expect(statuses).toEqual(['skipped']);
  expect(fetch).not.toHaveBeenCalled();
});

it('diagnoses the bare count said on every worth step even when each was right after one correction', async () => {
  // Each mat scores 67 (one correction), so the average passes; only the first-try share shows the pattern.
  const { items } = await mount([2305, 5206]);
  const { success, score, diagnosisEvidence, result } = await drive(items, items.filter(i => i.step === 'worth'), 1);
  expect([success, score, diagnosisEvidence.firstResponseScore]).toEqual([true, 67, 50]);
  expect(diagnosisEvidence.phases.map((p: { observed: string }) => p.observed)).toEqual(
    items.filter(i => i.step === 'worth').map(i => baseTenHarnessAnswers(i).signatureWrong!.text));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, confidence: 'high', evidenceTier: 'judge',
    misconceptionText: 'Synthetic hypothesis.', teachingImplication: 'x', checkNext: 'y' }) }));
  vi.mocked(authApi.post).mockResolvedValue({ stored: true });
  await captureMisconception(result, { sessionId: 's', subskillId: 'NBT004-01-b', gradeLevel: '4' });
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body)).params.evidence.firstResponseScore).toBe(50);
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({ primitive_type: 'base-ten-blocks' }));
});

it('regroup supplies no correction evidence, so capture never calls the model', async () => {
  const { items } = await mount([2345, 5261], 'regroup');
  const predict = items.find(i => i.step === 'predict')!;
  for (const item of items) await act(async () => {
    if (item === predict) seam.emit?.({ kind: 'verdict', judgment: 'corrected', attempt: { source: 'voice', transcript: 'ten' } } as LoopEmission);
    seam.emit?.({ kind: 'verdict', judgment: 'affirmed', attempt: { source: item.answerKind === 'gesture' ? 'gesture' : 'voice', transcript: 'x' } } as LoopEmission);
  });
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
  expect(diagnosisEvidence).toBeUndefined();
  expect(studentWork.diagnosisEvidence).toBeUndefined();
  vi.stubGlobal('fetch', vi.fn());
  await captureMisconception({ ...seam.identity, primitiveType: 'base-ten-blocks', success: false, score, metrics, diagnosisEvidence, attemptId: 'r' } as unknown as PrimitiveEvaluationResult,
    { sessionId: 'r', subskillId: 'NBT004-01-b' });
  expect(success).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
