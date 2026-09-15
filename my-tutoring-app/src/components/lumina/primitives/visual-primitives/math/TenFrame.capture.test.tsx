// @vitest-environment jsdom
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
} }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: ({ run }: { run: { start: () => void } }) => <button onClick={run.start}>Start test</button> }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn() } }));
import TenFrame, { type TenFrameChallenge, type TenFrameData } from './TenFrame';
import { itemsFromChallenges, tenFrameHarnessAnswers, type TenFrameItem } from './tenFrameScript';
import { captureMisconception, resetMisconceptionCaptureLatch } from '../../../evaluation/diagnosis/captureMisconception';
import { authApi } from '@/lib/authApiClient';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';

const identity = { skillId: 'OPS001-02', subskillId: 'OPS001-02-D' };
beforeEach(() => { resetMisconceptionCaptureLatch(); seam.submit.mockReset(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const sub = (id: string, start: number, removed: number): TenFrameChallenge =>
  ({ id, type: 'subtract', startCount: start, targetCount: start - removed, instruction: 'Take some away.', hint: 'h', narration: 'n' });
const frame = (challenges: TenFrameChallenge[], patch: Partial<TenFrameData> = {}): TenFrameData => ({ ...identity, title: 'Take away',
  mode: 'single', counters: { count: 0, color: 'red', positions: [] }, gradeBand: '1-2', showOptions: { showCount: false, showEquation: true }, challenges, ...patch });

async function mount(data: TenFrameData) {
  render(<TenFrame data={data} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test')); });
  return itemsFromChallenges(data.challenges, { capacity: 10, band: data.gradeBand ?? 'K' });
}
const voice = (judgment: 'affirmed' | 'corrected', text: string) => act(async () => {
  seam.emit?.({ kind: 'attempt-open', attempt: { source: 'voice' } } as LoopEmission);
  seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text } as LoopEmission);
  seam.emit?.({ kind: 'verdict', judgment, attempt: { source: 'voice', transcript: text } } as LoopEmission);
  if (judgment === 'corrected') seam.emit?.({ kind: 'verdict-text', judgment, text: 'My turn: seven take away three leaves four.' } as LoopEmission);
});
function submitted() {
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
  return { success, score, metrics, studentWork, diagnosisEvidence,
    result: { ...seam.identity, primitiveType: 'ten-frame', success, score, metrics, diagnosisEvidence, studentWork,
      attemptId: 'tf-attempt', instanceId: 'tf', lessonContext: { gradeLevel: '1', curriculumSubject: 'MATHEMATICS' } } as unknown as PrimitiveEvaluationResult };
}
/** Each listed item first gets the start said back, is corrected, then answered right; the rest are right first time. */
async function drive(items: TenFrameItem[], wrong: TenFrameItem[]) {
  for (const item of items) {
    const answers = tenFrameHarnessAnswers(item);
    if (wrong.includes(item)) await voice('corrected', answers.signatureWrong!.text);
    await voice('affirmed', answers.correct);
  }
  return submitted();
}
const takeAways = [sub('c1', 5, 1), sub('c2', 7, 3), sub('c3', 6, 2), sub('c4', 9, 2), sub('c5', 8, 1)];

it('records the start said back on three items as facts; the submitted outcome still passes, evalMode is the catalog mode, and the gate fires', async () => {
  const items = await mount(frame(takeAways));
  const { success, score, metrics, studentWork, diagnosisEvidence, result } = await drive(items, items.slice(1, 4));
  expect([success, score, metrics.evalMode]).toEqual([true, 80, 'operate']);
  expect(diagnosisEvidence.firstResponseScore).toBe(40);
  expect(diagnosisEvidence.phases.map((p: { itemId: string; challenge: string; expected: string; observed: string }) => [p.itemId, p.expected, p.observed])).toEqual([
    ['c2', 'four (4) left', 'Said "seven".'], ['c3', 'four (4) left', 'Said "six".'], ['c4', 'seven (7) left', 'Said "nine".'],
  ]);
  expect(diagnosisEvidence.phases[0].challenge).toBe('7 counters on a frame of 10; the tutor said to take away 3; the learner may take counters off, then says how many are left. "7 − 3 = ?" was printed on screen.');
  expect(diagnosisEvidence).toMatchObject({ judgeFeedback: 'My turn: seven take away three leaves four.', expected: 'The number left: the start minus the number taken away.' });
  expect(studentWork.diagnosisEvidence).toEqual(diagnosisEvidence);
  expect(studentWork.learningResponses.map((r: { observed: string; verdict: string }) => `${r.verdict}:${r.observed}`)).toEqual([
    'affirmed:Said "four".', 'corrected:Said "seven".', 'affirmed:Said "four".', 'corrected:Said "six".', 'affirmed:Said "four".',
    'corrected:Said "nine".', 'affirmed:Said "seven".', 'affirmed:Said "seven".',
  ]);

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, confidence: 'high', evidenceTier: 'judge',
    misconceptionText: 'Synthetic hypothesis.', teachingImplication: 'x', checkNext: 'y' }) }));
  vi.mocked(authApi.post).mockResolvedValue({ stored: true });
  await captureMisconception(result, { sessionId: 's', subskillId: 'OPS001-02-D', gradeLevel: '1' });
  const distill = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
  expect(distill.params).toMatchObject({ evalMode: 'operate', success: true, score: 80 });
  expect(distill.params.evidence.firstResponseScore).toBe(40);
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({
    primitive_type: 'ten-frame', scope: 'skill', delivery: 'server', skill_id: 'OPS001-02', subskill_id: 'OPS001-02-D' }));
});

it('one wrong item keeps its evidence but stays above the gate, so no model call', async () => {
  const items = await mount(frame(takeAways));
  const { success, score, diagnosisEvidence, result } = await drive(items, [items[2]]);
  expect([success, score, diagnosisEvidence.firstResponseScore]).toEqual([true, 93, 80]);
  expect(diagnosisEvidence.phases).toHaveLength(1);
  vi.stubGlobal('fetch', vi.fn());
  expect(await captureMisconception(result, { sessionId: 's', subskillId: 'OPS001-02-D' })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('all items right first time attaches no evidence', async () => {
  const items = await mount(frame(takeAways));
  const { success, score, studentWork, diagnosisEvidence } = await drive(items, []);
  expect([success, score, diagnosisEvidence, studentWork.diagnosisEvidence]).toEqual([true, 100, undefined, undefined]);
  expect(studentWork.learningResponses).toHaveLength(5);
});

it('a split committed on the frame is recorded from the committed board and the code verdict, before the retry clears it', async () => {
  vi.useFakeTimers();
  const splits: TenFrameChallenge[] = [3, 3].map((n, i) => ({ id: `s${i + 1}`, type: 'split', targetCount: n, instruction: '', hint: 'h', narration: 'n' }));
  const { container } = render(<TenFrame data={frame(splits, { gradeBand: 'K', skillId: 'OPS001-01', subskillId: 'OPS001-01-D' })} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test')); });
  const cell = (i: number) => container.querySelector(`[data-pip-object="cell-${i}"]`)!;
  const commit = async (cells: number[], judgment: 'affirmed' | 'corrected') => {
    for (const i of cells) fireEvent.click(cell(i));
    await act(async () => { vi.advanceTimersByTime(3100); });
    await act(async () => {
      seam.emit?.({ kind: 'attempt-open', attempt: { source: 'gesture' } } as LoopEmission);
      seam.emit?.({ kind: 'verdict', judgment, attempt: { source: 'gesture' } } as LoopEmission);
    });
  };
  await commit([0, 1, 2], 'corrected');   // all three yellow: one colour empty
  await commit([0], 'affirmed');          // 2 red + 1 yellow
  await commit([0], 'corrected');         // item 2: the same pair again
  await commit([0, 1], 'affirmed');       // 1 red + 2 yellow
  const { metrics, diagnosisEvidence, studentWork } = submitted();
  expect(metrics.evalMode).toBe('decompose');
  expect(diagnosisEvidence.phases.map((p: { observed: string }) => p.observed)).toEqual([
    'Left 0 red and turned 3 yellow, leaving one colour with no counters.',
    'Left 2 red and turned 1 yellow, a pair already shown for 3 this session.',
  ]);
  expect(studentWork.learningResponses.map((r: { observed: string }) => r.observed)).toEqual([
    'Left 0 red and turned 3 yellow, leaving one colour with no counters.', 'Left 2 red and turned 1 yellow.',
    'Left 2 red and turned 1 yellow, a pair already shown for 3 this session.', 'Left 1 red and turned 2 yellow.',
  ]);
});
