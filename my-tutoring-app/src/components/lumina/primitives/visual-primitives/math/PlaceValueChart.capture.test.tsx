// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
const seam = vi.hoisted(() => ({ emit: null as ((e: LoopEmission) => void) | null, identity: {} as Record<string, unknown>, submissions: [] as unknown[][] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({ isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'idle', activePrimitiveId: null, sessionResumeCount: 0, conversation: [], sendText: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), reconnect: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn() }) }));
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({ useJudgedSpeechLoop: (options: { onEmission: (e: LoopEmission) => void }) => {
  seam.emit = options.onEmission;
  return { queueCue: vi.fn(), sendCueNow: vi.fn(), submitGestureAttempt: vi.fn(), clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(), isAwaitingJudgment: () => false, voiceTurns: {}, config: {} };
} }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: (identity: Record<string, unknown>) => { seam.identity = identity; return { hasSubmitted: false, submitResult: (...args: unknown[]) => seam.submissions.push(args) }; } }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: ({ run }: { run: { start: () => void } }) => <button onClick={run.start}>Start test session</button> }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn().mockResolvedValue({}) } }));
import PlaceValueChart from './PlaceValueChart';
import { captureMisconception, resetMisconceptionCaptureLatch } from '../../../evaluation/diagnosis/captureMisconception';
import { authApi } from '@/lib/authApiClient';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';
import { webcrypto } from 'node:crypto';
import { itemsFromChallenges } from './placeValueScript';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('retains actual successful responses and correction history without substituting stale or absent transcripts', async () => {
  seam.submissions = [];
  const challenges = [2258, 3997, 9027].map((targetNumber, index) => ({ id: `success-${index}`,
    targetNumber, highlightedDigitPlace: index === 0 ? 2 : 1, minPlace: 0, maxPlace: 3,
    placeNameChoices: [], digitValueChoices: [] }));
  const items = itemsFromChallenges(challenges, { mode: 'compare', tier: 'medium' }).items;
  render(<PlaceValueChart data={{ instanceId: 'success-evidence', title: 'Place value', description: 'Say it',
    challengeType: 'compare', supportTier: 'medium', challenges }} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test session')); });
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (index === 1) await act(async () => {
      const attempt = { source: 'voice', transcript: 'wrong recorded response' };
      seam.emit?.({ kind: 'verdict', judgment: 'corrected', attempt } as LoopEmission);
    });
    await act(async () => {
      // lastHeard is deliberately misleading; evidence must use the judged attempt.
      seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text: 'stale transcript' } as LoopEmission);
      const attempt = { source: 'voice', transcript: index === 2 ? null : item.answerText };
      seam.emit?.({ kind: 'verdict', judgment: 'affirmed', attempt } as LoopEmission);
    });
  }
  expect(seam.submissions).toHaveLength(1);
  const work = seam.submissions[0][3] as { learningResponses: import('../../../evaluation/learningResponseEvidence').LearningResponseEvidence[] };
  expect(work.learningResponses).toHaveLength(items.length);
  expect(work.learningResponses.some(r => r.observed === 'stale transcript')).toBe(false);
  expect(work.learningResponses.some(r => r.itemId === items[2].id)).toBe(false);
  expect(work.learningResponses.filter(r => r.itemId === items[1].id)).toMatchObject([
    { verdict: 'corrected', observed: 'wrong recorded response', priorCorrections: 0 },
    { verdict: 'affirmed', observed: items[1].answerText, priorCorrections: 1 },
  ]);
});
it('retains phase evidence when 67 percent passes the runner threshold but an unsolved phase fails the activity', async () => {
  seam.submissions = [];
  resetMisconceptionCaptureLatch();
  vi.mocked(authApi.post).mockResolvedValue({ stored: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false,
    misconceptionText: 'Possible place-name confusion.', confidence: 'medium', evidenceTier: 'structured' }) }));
  const challenges = [2258, 3997, 9027].map((targetNumber, index) => ({ id: `regression-${index}`,
    targetNumber, highlightedDigitPlace: index === 0 ? 2 : 1, minPlace: 0, maxPlace: 3,
    placeNameChoices: [], digitValueChoices: [] }));
  const items = itemsFromChallenges(challenges, { mode: 'compare', tier: 'medium' }).items;
  expect(items).toHaveLength(5);
  render(<PlaceValueChart data={{ instanceId: 'regression-67', skillId: 'NBT004-01', subskillId: 'NBT004-01-b',
    title: 'Place value', description: 'Say it', challengeType: 'compare', supportTier: 'medium', challenges }} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test session')); });
  const corrections = [1, 0, 1, 3, 0];
  for (let index = 0; index < items.length; index++) {
    for (let correction = 0; correction < corrections[index]; correction++) {
      await act(async () => {
        seam.emit?.({ kind: 'attempt-open', attempt: {} } as LoopEmission);
        seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text: 'two hundred' } as LoopEmission);
        seam.emit?.({ kind: 'verdict', judgment: 'corrected', attempt: {} } as LoopEmission);
      });
    }
    if (corrections[index] < 3) await act(async () => {
      seam.emit?.({ kind: 'verdict', judgment: 'affirmed', attempt: {} } as LoopEmission);
    });
  }
  expect(seam.submissions).toHaveLength(1);
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submissions[0];
  expect(success).toBe(false);
  expect(score).toBe(67);
  expect(studentWork).toMatchObject({ problem: { challenges }, diagnosisEvidence });
  expect(diagnosisEvidence).toMatchObject({ phases: expect.arrayContaining([
    expect.objectContaining({ itemId: items[3].id, observed: 'two hundred' }),
  ]) });
  await captureMisconception({ ...seam.identity, success, score, metrics, diagnosisEvidence,
    attemptId: 'regression-67', lessonContext: { gradeLevel: '4', curriculumSubject: 'MATHEMATICS' } } as PrimitiveEvaluationResult,
    { sessionId: 'regression-67', subskillId: 'NBT004-01-b' });
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({
    learning_observation: expect.objectContaining({ phases: expect.any(Array) }),
  }));
});
it('mounts the component, caps real runner worth attempts, and transports its emitted evidence and IDs to capture', async () => {
  seam.submissions = [];
  resetMisconceptionCaptureLatch();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, misconceptionText: 'The student gives bare digit worth.', confidence: 'high', evidenceTier: 'judge' }) }));
  render(<PlaceValueChart data={{ skillId: 'NBT003-02', subskillId: 'NBT003-02-a', title: 'Place value', description: 'Say it', challengeType: 'compare', supportTier: 'medium', challenges: [{ id: 'p', targetNumber: 2345, highlightedDigitPlace: 1, minPlace: 0, maxPlace: 3, placeNameChoices: [], digitValueChoices: [] }] }} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test session')); });
  const emit = (e: unknown) => act(() => seam.emit?.(e as LoopEmission));
  emit({ kind: 'verdict', judgment: 'affirmed', attempt: {}, misses: 0 });
  for (let n = 0; n < 3; n++) {
    emit({ kind: 'attempt-open', attempt: {} });
    emit({ kind: 'attempt-transcript', attempt: {}, text: 'four', responseMs: 900, commitLagMs: 400 });
    emit({ kind: 'verdict', judgment: 'corrected', attempt: {}, misses: n });
    emit({ kind: 'verdict-text', judgment: 'corrected', text: 'My turn: I say the digit, then its place — four, tens: forty.' });
  }
  expect(seam.submissions).toHaveLength(1);
  const [success, score, metrics, , , diagnosisEvidence] = seam.submissions[0];
  expect(success).toBe(false);
  expect(score).toBeLessThan(60);
  // The runner owns the evidence shape: the pack's activity line plus the run's first-time share, every
  // correction as a phase, and `observed` joining them.
  const evidence = diagnosisEvidence as { firstResponseScore?: number; challengeSummary: string; phases?: Array<{ challenge: string; observed: string }> };
  expect(evidence.firstResponseScore).toBe(50);
  expect(evidence.phases?.map((p) => [p.challenge, p.observed]))
    .toEqual([['say the value of the 4 in 2345', 'four'], ['say the value of the 4 in 2345', 'four'], ['say the value of the 4 in 2345', 'four']]);
  expect(evidence.challengeSummary).toContain('1 of 2 items were answered right the first time');
  await captureMisconception({ ...seam.identity, success, score, metrics, diagnosisEvidence, attemptId: 'synthetic-mounted' } as PrimitiveEvaluationResult, { sessionId: 'mounted', subskillId: 'NBT003-02-a' });
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({ skill_id: 'NBT003-02', subskill_id: 'NBT003-02-a', scope: 'skill' }));
});

it('records presented items, first transcripts, corrections and completion through the real mounted runner', async () => {
  seam.submissions = [];
  vi.stubGlobal('crypto', webcrypto);
  const challenges = [2258, 3997, 9027].map((n, index) => ({ id: `pvc-${index + 1}`, targetNumber: n,
    highlightedDigitPlace: index === 0 ? 2 : 1, minPlace: 0, maxPlace: 3, placeNameChoices: [], digitValueChoices: [] }));
  const items = itemsFromChallenges(challenges, { mode: 'compare', tier: 'medium' }).items;
  render(<PlaceValueChart data={{ instanceId: 'instance', title: 'Place value', description: 'Say it',
    challengeType: 'compare', supportTier: 'medium', challenges,
    misconceptionOpportunity: { id: 'opaque', lessonId: 'lesson', grade: '3', curriculumVersion: 'synthetic-v1' } }} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test session')); });
  for (const item of items) {
    await act(async () => {
      const attempt = { source: item.answerKind === 'gesture' ? 'gesture' : 'voice',
        turn: { openedAt: performance.now(), closedAt: performance.now() + 1, duringTutorAudio: false } };
      seam.emit?.({ kind: 'attempt-open', attempt } as LoopEmission);
      seam.emit?.({ kind: 'attempt-transcript', attempt, text: item.answerText } as LoopEmission);
      if (item.id === 'pvc-1::value') {
        seam.emit?.({ kind: 'verdict', judgment: 'corrected', attempt } as LoopEmission);
        seam.emit?.({ kind: 'attempt-open', attempt } as LoopEmission);
        seam.emit?.({ kind: 'attempt-transcript', attempt, text: item.answerText } as LoopEmission);
      }
      seam.emit?.({ kind: 'verdict', judgment: 'affirmed', attempt } as LoopEmission);
    });
  }
  await vi.waitFor(() => expect(seam.submissions).toHaveLength(1));
  const work = seam.submissions[0][3] as { misconception_opportunity: { content_hash: string; completed: boolean; events: { item_id: string; kind: string; seq: number }[] } };
  const evidence = work.misconception_opportunity;
  expect(evidence.content_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(evidence.completed).toBe(true);
  expect(evidence.events.filter(e => e.kind === 'presented').map(e => e.item_id)).toEqual(items.map(i => i.id));
  expect(evidence.events.map(e => e.seq)).toEqual(evidence.events.map((_, i) => i));
  expect(evidence.events.filter(e => e.item_id === 'pvc-1::value').map(e => e.kind)).toEqual([
    'presented', 'response', 'transcript', 'corrected', 'response', 'transcript', 'affirmed', 'completed',
  ]);
});
