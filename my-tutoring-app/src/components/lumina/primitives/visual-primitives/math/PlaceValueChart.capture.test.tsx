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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
  expect(diagnosisEvidence).toMatchObject({ challengeSummary: 'say the value of the 4 in 2345', observed: 'four' });
  await captureMisconception({ ...seam.identity, success, score, metrics, diagnosisEvidence, attemptId: 'synthetic-mounted' } as PrimitiveEvaluationResult, { sessionId: 'mounted', subskillId: 'NBT003-02-a' });
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({ skill_id: 'NBT003-02', subskill_id: 'NBT003-02-a', scope: 'skill' }));
});
