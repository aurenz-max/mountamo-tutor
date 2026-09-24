import { afterEach, expect, it, vi } from 'vitest';
import { DialogueObserver } from './DialogueObserver';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { runtimePacket } from './runtimeTransport';
import type { RuntimeSnapshot } from './contract';
import type { DialogueDecision } from './dialogueContract';

const success: DialogueDecision = { verdict: 'correct', transition: 'advance', confidence: .99,
  grounded: 1, accepted: true, reason: 'supported', ms: 200 };
function setup(spoken = false) {
  const runtime = new LiveLessonRuntime('test');
  runtime.register({ instanceId: 'board', primitiveId: 'test', planItemId: 'p', objectiveId: 'o', evalMode: 'count',
    adapter: { getTutorState: () => ({ itemId: 'one', task: 'Count the blocks.', phase: spoken ? 'working' : 'checked', completed: false,
      demand: { requested: 3, ...(spoken ? { response: 'speech' } : {}) } as Record<string, string | number>, support: { level: 2, answerExposure: 'full' },
      evidence: { attemptNumber: 1, correctness: 'correct', recentResponses: [{ response: '3', source: spoken ? 'speech' : 'gesture', recognition: 'clear' }] },
      workspace: { progression: 'observer', objects: [{ id: 'a', label: 'block', selected: true }],
        ...(spoken ? { pendingResponse: { id: 'turn-1', text: 'three' }, expectedAnswer: '3' } : {}),
        demonstration: ['b'], lastResponse: spoken ? null : { response: '3', correct: true, assisted: true }, attempts: [] } }),
    getAffordances: () => [{ action: { type: 'advance' }, controller: 'observer', description: 'next', execute: () => true },
      ...(spoken ? [{ action: { type: 'workspace' as const, operation: 'apply_tutor_verdict', input: {} }, controller: 'observer' as const,
        description: 'record', execute: () => true }] : [])] } });
  let state = structuredClone(runtime.getSnapshot());
  const classify = vi.fn(async () => success), execute = vi.fn(async () => 'visible'), report = vi.fn();
  const observer = new DialogueObserver(() => state, classify, execute, report);
  const turn = () => { observer.learnerText('three', true); observer.output('Yes, three!'); observer.end(false); };
  return { observer, classify, execute, report, turn, state, replace: (next: RuntimeSnapshot) => { state = next; } };
}
afterEach(() => vi.useRealTimers());
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

it('waits for completed speech AND drained playback; passes assignment and separate student/tutor marks', async () => {
  const s = setup(); s.observer.learnerText('three', true); s.observer.output('Yes, three!');
  s.observer.audio(false); expect(s.classify).not.toHaveBeenCalled();
  s.observer.end(true); expect(s.classify).not.toHaveBeenCalled();
  s.observer.audio(false); await settle();
  expect(s.classify).toHaveBeenCalledWith(expect.objectContaining({ task: 'Count the blocks.',
    activity: expect.objectContaining({ responseSource: 'gesture', objects: [{ id: 'a', label: 'block', selected: true }],
      demonstration: ['b'], assistance: { level: 2, answerExposure: 'full' } }) }), expect.any(AbortSignal));
  expect(s.execute).toHaveBeenCalledOnce();
  s.observer.end(false); s.observer.audio(false); expect(s.execute).toHaveBeenCalledOnce();
  expect(runtimePacket(s.state).choices).toEqual([]);
});

it.each(['new learner', 'interruption', 'close', 'new output', 'stale revision', 'stale item', 'stopped'])('discards pending decisions after %s', async event => {
  const s = setup(); let resolve!: (decision: DialogueDecision) => void;
  s.classify.mockImplementation(() => new Promise(r => { resolve = r; })); s.turn();
  if (event === 'new learner') s.observer.learnerStart();
  if (event === 'interruption') s.observer.interrupt();
  if (event === 'close') s.observer.close();
  if (event === 'new output') s.observer.output('Wait, let us talk.');
  if (event === 'stale revision') s.replace({ ...s.state, revision: s.state.revision + 1 });
  if (event === 'stale item') s.replace({ ...s.state, task: { ...s.state.task!, itemId: 'other' } });
  if (event === 'stopped') s.replace({ ...s.state, status: 'stopped' });
  resolve(success); await settle(); expect(s.execute).not.toHaveBeenCalled();
});

it.each([
  { ...success, accepted: false }, { ...success, confidence: .7 }, { ...success, confidence: NaN },
  { ...success, transition: 'none' as const }, { ...success, verdict: 'incorrect' as const },
])('does not mutate on abstention or contradictory speech %#', async decision => {
  const s = setup(); s.classify.mockResolvedValue(decision); s.turn(); await settle();
  expect(s.execute).not.toHaveBeenCalled();
});

it('never promotes an incorrect learner answer because of tutor praise', async () => {
  const s = setup(); s.state.task!.workspace!.lastResponse!.correct = false;
  s.turn(); await settle(); expect(s.execute).not.toHaveBeenCalled();
});
it('does not observe a tutor turn transcribed as non-speech markup', () => {
  const s = setup(true); s.observer.learnerText('three', true); s.observer.output('<no speech>{pause}'); s.observer.end(false);
  expect(s.classify).not.toHaveBeenCalled();
  s.observer.learnerText('three', true); s.observer.output('Yes, three!'); s.observer.end(false);
  expect(s.classify).toHaveBeenCalledWith(expect.not.objectContaining({ priorTutor: expect.anything() }), expect.any(AbortSignal));
});
it('does not observe help before an actual answer', () => {
  const s = setup(); s.state.task!.workspace!.lastResponse = null;
  s.turn(); expect(s.classify).not.toHaveBeenCalled();
});
it('fails closed on unavailable service and timeout', async () => {
  const s = setup(); s.classify.mockRejectedValue(new Error('unavailable')); s.turn(); await settle();
  expect(s.execute).not.toHaveBeenCalled(); expect(s.observer.pending).toBe(false);
  vi.useFakeTimers(); let resolve!: (decision: DialogueDecision) => void;
  s.classify.mockImplementation(() => new Promise(r => { resolve = r; })); s.turn();
  await vi.advanceTimersByTimeAsync(4001); resolve(success); await settle();
  expect(s.execute).not.toHaveBeenCalled();
});

const cues = (report: ReturnType<typeof vi.fn>) =>
  report.mock.calls.map(c => c[0]).filter((m: Record<string, unknown>) => m.source === 'dialogue_open_assignment');

it('says the assignment is still open once per turn when a settled tutor turn records nothing', async () => {
  const s = setup(true);
  // The reproduced stall: the tutor finished its feedback, JEV would not certify
  // a verdict, and nothing was committed. Nobody held the conversation.
  s.classify.mockResolvedValue({ verdict: 'none', transition: 'none', confidence: 0, feedbackComplete: true,
    grounded: 0, accepted: false, reason: 'unsupported', ms: 200 });
  s.turn(); await settle();
  expect(s.execute).not.toHaveBeenCalled();
  expect(cues(s.report)).toHaveLength(1);
  expect(String(cues(s.report)[0].content)).not.toMatch(/correct|right|well done/i);
  // The tutor speaks again on the same learner turn; the cue does not repeat.
  s.observer.output('So, how many blocks did you count?'); s.observer.end(false); await settle();
  expect(cues(s.report)).toHaveLength(1);
});

it("asks once for a plain verdict, then follows the tutor's confirmation of that same answer (09-24)", async () => {
  const s = setup(true);
  s.classify.mockResolvedValueOnce({ verdict: 'none', transition: 'none', confidence: 0, verdictConfidence: 0, feedbackComplete: false,
    replyFinished: true, grounded: 0, accepted: false, reason: 'confirm_credit', ms: 200 });
  s.turn(); await settle();
  expect(s.execute).not.toHaveBeenCalled();
  expect(cues(s.report)).toHaveLength(1);
  expect((s.classify.mock.calls[0] as unknown[])[0]).not.toHaveProperty('confirming');
  // The host's note opens the next exchange; the tutor answers it plainly.
  s.classify.mockResolvedValueOnce({ verdict: 'correct', transition: 'advance', confidence: .62, verdictConfidence: .62,
    feedbackComplete: false, replyFinished: true, grounded: 1, accepted: true, reason: 'confirmed_by_tutor', resolution: 'confirmed_by_tutor', ms: 200 });
  s.observer.hostTurn(); s.observer.output('Yes, you solved it: there are three.'); s.observer.end(false); await settle();
  expect((s.classify.mock.calls[1] as unknown[])[0]).toMatchObject({ confirming: true, pendingResponse: { id: 'turn-1' } });
  expect(s.execute).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({
    operation: 'apply_tutor_verdict', input: { dialogue: expect.objectContaining({ verdict: 'correct', transition: 'advance' }) } }) }));
  // A confirmation resolution is never accepted for a reply that was not a confirmation.
  const plain = setup(true);
  plain.classify.mockResolvedValue({ verdict: 'correct', transition: 'advance', confidence: .62, verdictConfidence: .62,
    feedbackComplete: false, replyFinished: true, grounded: 1, accepted: true, reason: 'confirmed_by_tutor', resolution: 'confirmed_by_tutor', ms: 200 });
  plain.turn(); await settle();
  expect(plain.execute).not.toHaveBeenCalled();
});

it('stays silent when the turn is unfinished, committed, or out of scope', async () => {
  const unfinished = setup(true);
  unfinished.classify.mockResolvedValue({ verdict: 'none', transition: 'none', confidence: 0, feedbackComplete: false,
    grounded: 0, accepted: false, reason: 'unsupported', ms: 200 });
  unfinished.turn(); await settle();
  expect(cues(unfinished.report)).toHaveLength(0);

  const committed = setup(true);
  committed.classify.mockResolvedValue({ ...success, feedbackComplete: true, verdictConfidence: .99 });
  committed.turn(); await settle();
  expect(committed.execute).toHaveBeenCalledOnce();
  expect(cues(committed.report)).toHaveLength(0);

  // A service outage is an unrun observation, not a settled turn to comment on.
  const down = setup(true);
  down.classify.mockResolvedValue({ verdict: 'none', transition: 'none', confidence: 0, grounded: 0,
    accepted: false, reason: 'unavailable', ms: 0 });
  down.turn(); await settle();
  expect(cues(down.report)).toHaveLength(0);
});
