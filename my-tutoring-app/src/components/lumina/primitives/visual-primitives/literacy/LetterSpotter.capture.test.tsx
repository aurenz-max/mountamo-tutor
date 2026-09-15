// @vitest-environment jsdom
/**
 * A declared judged source that never carried its own evidence builder: does the
 * runner-owned evidence (slice 1 of the judged-evidence handoff) reach the shared
 * capture layer and fire the gate on the wrong-first, right-after-one-correction
 * pattern? Before the runner owned `firstResponseScore`, this run submitted
 * `passed: true, 80` and capture skipped it.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
const seam = vi.hoisted(() => ({ emit: null as ((e: LoopEmission) => void) | null, submit: vi.fn(), identity: {} as Record<string, unknown> }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({ isConnected: true, isListening: true,
  isAudioPlaying: false, sessionMode: 'idle', activePrimitiveId: null, sessionResumeCount: 0, conversation: [],
  sendText: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), reconnect: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn() }) }));
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({ useJudgedSpeechLoop: (options: { onEmission: (e: LoopEmission) => void }) => {
  seam.emit = options.onEmission;
  return { queueCue: vi.fn(), sendCueNow: vi.fn(), submitGestureAttempt: vi.fn(), clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(), isAwaitingJudgment: () => false, voiceTurns: {}, config: {} };
} }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: (identity: Record<string, unknown>) => {
  seam.identity = identity; return { hasSubmitted: false, submitResult: seam.submit, submittedResult: null, elapsedMs: 0 };
}, useEvaluationContext: () => null }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: ({ run }: { run: { start: () => void } }) => <button onClick={run.start}>Start test</button> }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn() } }));
import LetterSpotter, { type LetterSpotterChallenge, type LetterSpotterData } from './LetterSpotter';
import { itemsFromChallenges, letterSpotterHarnessAnswers, type LetterSpotterItem } from './letterSpotterScript';
import { captureMisconception, resetMisconceptionCaptureLatch } from '../../../evaluation/diagnosis/captureMisconception';
import { isDiagnosableFailure } from '../../../evaluation/diagnosis/types';
import { authApi } from '@/lib/authApiClient';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';

beforeEach(() => { resetMisconceptionCaptureLatch(); seam.submit.mockReset(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const nameIt = (id: string, letter: string, word: string, sentence: string): LetterSpotterChallenge =>
  ({ id, mode: 'name-it', targetLetter: letter, targetCase: 'lowercase', targetWord: word, sentence, spokenSentence: sentence });
const challenges = [
  nameIt('c1', 'm', 'mat', 'The mat is red.'), nameIt('c2', 's', 'sun', 'The sun is hot.'), nameIt('c3', 't', 'top', 'The top spins.'),
  nameIt('c4', 'p', 'pig', 'The pig is pink.'), nameIt('c5', 'n', 'net', 'The net is wet.'),
];
const data: LetterSpotterData = { title: 'Letters', letterGroup: 1, cumulativeLetters: ['m', 's', 't', 'p', 'n'], newLetters: ['m', 's'],
  gradeLevel: 'K', challenges, instanceId: 'ls', skillId: 'LA-K-PHON-01', subskillId: 'LA-K-PHON-01-A' };

async function mount() {
  render(<LetterSpotter data={data} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test')); });
  return itemsFromChallenges(challenges, 'medium');
}
const voice = (judgment: 'affirmed' | 'corrected', text: string) => act(async () => {
  seam.emit?.({ kind: 'attempt-open', attempt: { source: 'voice' } } as LoopEmission);
  seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text } as LoopEmission);
  seam.emit?.({ kind: 'verdict', judgment, attempt: { source: 'voice', transcript: text } } as LoopEmission);
  if (judgment === 'corrected') seam.emit?.({ kind: 'verdict-text', judgment, text: 'My turn: mat starts with m.' } as LoopEmission);
});
/** Each listed item first gets the word said straight back (the pack's signature miss), is corrected, then answered right. */
async function drive(items: LetterSpotterItem[], wrong: LetterSpotterItem[]) {
  for (const item of items) {
    const answers = letterSpotterHarnessAnswers(item);
    if (wrong.includes(item)) await voice('corrected', answers.signatureWrong!.text);
    await voice('affirmed', answers.correct);
  }
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
  return { success, score, metrics, studentWork, diagnosisEvidence,
    result: { ...seam.identity, primitiveType: 'letter-spotter', success, score, metrics, diagnosisEvidence, studentWork,
      attemptId: 'ls-attempt', instanceId: 'ls', lessonContext: { gradeLevel: 'K', curriculumSubject: 'LANGUAGE_ARTS' } } as unknown as PrimitiveEvaluationResult };
}

it('three words said straight back, each corrected once: the run passes on the average, the runner evidence fails the first-response gate, and capture calls the distiller', async () => {
  const items = await mount();
  expect(items).toHaveLength(5);
  const { success, score, diagnosisEvidence, result } = await drive(items, items.slice(1, 4));
  expect([success, score]).toEqual([true, 80]);
  expect(diagnosisEvidence.firstResponseScore).toBe(40);
  expect(diagnosisEvidence.phases.map((p: { itemId: string; expected: string; observed: string }) => [p.itemId, p.expected, p.observed])).toEqual([
    ['c2', 'The letter "S".', 'Said "sun".'], ['c3', 'The letter "T".', 'Said "top".'], ['c4', 'The letter "P".', 'Said "pig".'],
  ]);
  expect(diagnosisEvidence.judgeFeedback).toBe('My turn: mat starts with m.');
  expect(diagnosisEvidence.challengeSummary).toContain('2 of 5 items were answered right the first time');
  expect(isDiagnosableFailure({ success, score }, diagnosisEvidence)).toBe(true);

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, confidence: 'high', evidenceTier: 'judge',
    misconceptionText: 'Synthetic hypothesis.', teachingImplication: 'x', checkNext: 'y' }) }));
  vi.mocked(authApi.post).mockResolvedValue({ stored: true });
  await captureMisconception(result, { sessionId: 's', subskillId: 'LA-K-PHON-01-A', gradeLevel: 'K' });
  const distill = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
  expect(distill.params).toMatchObject({ success: true, score: 80 });
  expect(distill.params.evidence.firstResponseScore).toBe(40);
  expect(distill.params.evidence.phases).toHaveLength(3);
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({ primitive_type: 'letter-spotter', scope: 'primitive' }));
});

it('one word said back stays above the gate: evidence attached, no model call', async () => {
  const items = await mount();
  const { success, score, diagnosisEvidence, result } = await drive(items, [items[2]]);
  expect([success, score, diagnosisEvidence.firstResponseScore]).toEqual([true, 93, 80]);
  vi.stubGlobal('fetch', vi.fn());
  expect(await captureMisconception(result, { sessionId: 's', subskillId: 'LA-K-PHON-01-A' })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
