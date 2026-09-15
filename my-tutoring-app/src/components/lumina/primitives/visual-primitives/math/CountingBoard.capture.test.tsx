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
import CountingBoard, { type CountingBoardChallenge } from './CountingBoard';
import { countingBoardHarnessAnswers, itemsFromChallenges, type CountingItem } from './countingBoardScript';
import { captureMisconception, resetMisconceptionCaptureLatch } from '../../../evaluation/diagnosis/captureMisconception';
import { authApi } from '@/lib/authApiClient';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';

const identity = { skillId: 'COUNT001-02', subskillId: 'COUNT001-02-E' };
beforeEach(() => { resetMisconceptionCaptureLatch(); seam.submit.mockReset(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const takeAway = (id: string, start: number, changeBy: number): CountingBoardChallenge => ({ id, type: 'take_away', count: start, changeBy,
  targetAnswer: start - changeBy, arrangement: 'line', instruction: 'Take some away.', hint: 'h', narration: 'n' });

async function mount(challenges: CountingBoardChallenge[]) {
  render(<CountingBoard data={{ ...identity, title: 'Take Away', objects: { type: 'bears' }, gradeBand: 'K', challenges }} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test')); });
  return itemsFromChallenges(challenges, { objectWord: 'bears' });
}
/** Each listed board first gets the count from before the change, is corrected, then answered right; the rest are right first time. */
async function drive(items: CountingItem[], wrong: CountingItem[]) {
  for (const item of items) {
    const answers = countingBoardHarnessAnswers(item);
    if (wrong.includes(item)) await act(async () => {
      seam.emit?.({ kind: 'attempt-open', attempt: { source: 'voice' } } as LoopEmission);
      seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text: answers.signatureWrong!.text } as LoopEmission);
      seam.emit?.({ kind: 'verdict', judgment: 'corrected', attempt: { source: 'voice', transcript: answers.signatureWrong!.text } } as LoopEmission);
      seam.emit?.({ kind: 'verdict-text', judgment: 'corrected', text: 'My turn: count what is left.' } as LoopEmission);
    });
    await act(async () => {
      seam.emit?.({ kind: 'attempt-open', attempt: { source: 'voice' } } as LoopEmission);
      seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text: answers.correct } as LoopEmission);
      seam.emit?.({ kind: 'verdict', judgment: 'affirmed', attempt: { source: 'voice', transcript: answers.correct } } as LoopEmission);
    });
  }
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
  return { success, score, metrics, studentWork, diagnosisEvidence,
    result: { ...seam.identity, primitiveType: 'counting-board', success, score, metrics, diagnosisEvidence, studentWork,
      attemptId: 'cb-attempt', instanceId: 'cb', lessonContext: { gradeLevel: 'K', curriculumSubject: 'MATHEMATICS' } } as unknown as PrimitiveEvaluationResult };
}
const boards = [takeAway('c1', 5, 1), takeAway('c2', 7, 3), takeAway('c3', 6, 2), takeAway('c4', 9, 2), takeAway('c5', 8, 1)];

it('records the pre-change count said on three boards as facts; the submitted outcome still passes and the gate fires', async () => {
  const items = await mount(boards);
  const wrong = items.slice(1, 4);
  const { success, score, metrics, studentWork, diagnosisEvidence, result } = await drive(items, wrong);
  expect([success, score, metrics.evalMode]).toEqual([true, 80, 'take_away']);
  expect(diagnosisEvidence.firstResponseScore).toBe(40);
  expect(diagnosisEvidence.phases.map((p: { itemId: string; challenge: string; expected: string; observed: string }) => [p.itemId, p.challenge, p.expected, p.observed])).toEqual([
    ['c2', '7 bears on the board; the tutor said to take away 3. Say how many are left.', 'four (4) left', 'Said "seven".'],
    ['c3', '6 bears on the board; the tutor said to take away 2. Say how many are left.', 'four (4) left', 'Said "six".'],
    ['c4', '9 bears on the board; the tutor said to take away 2. Say how many are left.', 'seven (7) left', 'Said "nine".'],
  ]);
  expect(diagnosisEvidence).toMatchObject({ judgeFeedback: 'My turn: count what is left.',
    expected: 'The number left on the board: the start minus the number taken away.' });
  expect(studentWork.diagnosisEvidence).toEqual(diagnosisEvidence);
  // Every judged attempt, right or wrong, is kept in student work.
  expect(studentWork.learningResponses.map((r: { observed: string; verdict: string }) => `${r.verdict}:${r.observed}`)).toEqual([
    'affirmed:Said "four".', 'corrected:Said "seven".', 'affirmed:Said "four".', 'corrected:Said "six".', 'affirmed:Said "four".',
    'corrected:Said "nine".', 'affirmed:Said "seven".', 'affirmed:Said "seven".',
  ]);

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, confidence: 'high', evidenceTier: 'judge',
    misconceptionText: 'Synthetic hypothesis.', teachingImplication: 'x', checkNext: 'y' }) }));
  vi.mocked(authApi.post).mockResolvedValue({ stored: true });
  await captureMisconception(result, { sessionId: 's', subskillId: 'COUNT001-02-E', gradeLevel: 'K' });
  const distill = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
  expect(distill.params).toMatchObject({ evalMode: 'take_away', success: true, score: 80 });
  expect(distill.params.evidence.firstResponseScore).toBe(40);
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({
    primitive_type: 'counting-board', scope: 'skill', skill_id: 'COUNT001-02', subskill_id: 'COUNT001-02-E' }));
});

it('one wrong board keeps its evidence but stays above the gate, so no model call', async () => {
  const items = await mount(boards);
  const { success, score, diagnosisEvidence, result } = await drive(items, [items[2]]);
  expect([success, score, diagnosisEvidence.firstResponseScore]).toEqual([true, 93, 80]);
  expect(diagnosisEvidence.phases).toHaveLength(1);
  vi.stubGlobal('fetch', vi.fn());
  expect(await captureMisconception(result, { sessionId: 's', subskillId: 'COUNT001-02-E' })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('all boards right first time attaches no evidence', async () => {
  const items = await mount(boards);
  const { success, score, studentWork, diagnosisEvidence } = await drive(items, []);
  expect([success, score, diagnosisEvidence, studentWork.diagnosisEvidence]).toEqual([true, 100, undefined, undefined]);
  expect(studentWork.learningResponses).toHaveLength(5);
});

const board = (id: string, type: CountingBoardChallenge['type'], count: number, patch: Partial<CountingBoardChallenge> = {}): CountingBoardChallenge =>
  ({ id, type, count, targetAnswer: count, arrangement: 'line', instruction: 'Count.', hint: 'h', narration: 'n', ...patch });

it('submits the catalog eval mode, not the challenge type: count_all → count, group_count → group (CNB-3)', async () => {
  let items = await mount([board('a1', 'count_all', 3), board('a2', 'count_all', 5), board('a3', 'count_all', 4)]);
  expect((await drive(items, [])).metrics.evalMode).toBe('count');
  cleanup(); seam.submit.mockReset();
  items = await mount([board('g1', 'group_count', 6, { arrangement: 'groups', groupSize: 2 }),
    board('g2', 'group_count', 12, { arrangement: 'groups', groupSize: 4 }), board('g3', 'group_count', 9, { arrangement: 'groups', groupSize: 3 })]);
  expect((await drive(items, [])).metrics.evalMode).toBe('group');
});

/** Object x positions and ring centres of the board on screen. */
async function drawnBoard(challenge: CountingBoardChallenge) {
  const { container } = render(<CountingBoard data={{ ...identity, title: 'Compare', objects: { type: 'bears' }, gradeBand: '1', challenges: [challenge],
    showOptions: { showGroupCircles: true } }} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test')); });
  const xs = Array.from(container.querySelectorAll('[data-pip-object] > text')).map((t) => Number(t.getAttribute('x')));
  const rings = Array.from(container.querySelectorAll('[data-group-ring]')).map((r) => Number(r.getAttribute('cx')));
  cleanup();
  return { xs, rings };
}

it('compare draws its two groups in board order, so the larger group can be on the right (CNB-2)', async () => {
  const compare = board('m1', 'compare', 10, { arrangement: 'groups', groupSize: 7, targetAnswer: 7 });
  const right = await drawnBoard({ ...compare, compareGroups: [3, 7] });
  expect(right.xs).toHaveLength(10);
  expect(right.rings).toHaveLength(2);
  expect(Math.max(...right.xs.slice(0, 3))).toBeLessThan(Math.min(...right.xs.slice(3)));
  // The rings sit over the groups they belong to.
  expect(right.rings[0]).toBeLessThan(right.rings[1]);
  expect(Math.abs(right.rings[0] - right.xs.slice(0, 3).reduce((s, x) => s + x, 0) / 3)).toBeLessThan(1);

  const left = await drawnBoard({ ...compare, compareGroups: [7, 3] });
  expect(Math.max(...left.xs.slice(0, 7))).toBeLessThan(Math.min(...left.xs.slice(7)));
  // A board saved before compareGroups still draws the larger group first.
  expect((await drawnBoard(compare)).xs).toEqual(left.xs);
});
