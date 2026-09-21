// @vitest-environment jsdom
/**
 * Real DiWordReading, real TeachingSession, real LiveLessonRuntime, real transport
 * and rendering shell. Only microphone hardware, evaluation writes and sound are
 * substituted. Every case is the TEACHING_WORKSPACE behavioural matrix, asked in
 * this pack's own domain: a child reading one printed word out loud, with the
 * tutor as the only judge of the audio.
 *
 * Three cases exist only here, because they are this primitive's own risks:
 * the ask must never contain the word, the reward picture must not reach the
 * screen or the tutor before a committed read, and an irregular sight word must
 * publish no letter to sound out.
 */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport, runtimePacket } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import type { DialogueClassifier } from '../../../components/live-activity/runtime/DialogueObserver';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(),
  correct: vi.fn(), evaluationContext: null as unknown, voiceActive: false, close: null as (() => void) | null }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'words',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => seam.voiceActive,
    subscribe: (listener: { onTurnClose: () => void }) => { seam.close = listener.onTurnClose; return () => { seam.close = null; }; } },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../../components/DiActionPanel', () => ({ default: () => null }));
import DiWordReading, { type DiWordReadingData } from './DiWordReading';
import { DI_WORD_READING_WORKSPACE_MODES, buildWordReadingItems, workspaceAssignment, workspaceScene,
  type DiWordReadingChallenge, type DiWordReadingChallengeType } from './diWordReadingDomain';
import { diWordReadingLive, validateDiWordReadingData } from '../../../components/live-activity/adapters/diWordReadingLive';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.voiceActive = false;
  seam.close = null; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Two items per mode, drawn from the generator's own word menu — including the
 *  near neighbours it deliberately keeps (mat/matt, sun/son, see/sea). */
const CHALLENGES: Record<DiWordReadingChallengeType, DiWordReadingChallenge[]> = {
  cvc_reading: [
    { id: 'c1', challengeType: 'cvc_reading', word: 'sam', wordType: 'cvc', graphemes: ['s', 'a', 'm'], asrAliases: ['sam'] },
    { id: 'c2', challengeType: 'cvc_reading', word: 'mat', wordType: 'cvc', graphemes: ['m', 'a', 't'], asrAliases: ['mat', 'matt'] }],
  read_word: [
    { id: 'r1', challengeType: 'read_word', word: 'cat', wordType: 'cvc', graphemes: ['c', 'a', 't'], emoji: '🐱' },
    { id: 'r2', challengeType: 'read_word', word: 'the', wordType: 'sight', asrAliases: ['the', 'thee'] }],
  sight_word: [
    { id: 's1', challengeType: 'sight_word', word: 'see', wordType: 'sight', asrAliases: ['see', 'sea'] },
    { id: 's2', challengeType: 'sight_word', word: 'my', wordType: 'sight' }],
  word_reading_review: [
    { id: 'v1', challengeType: 'word_reading_review', word: 'sun', wordType: 'cvc', graphemes: ['s', 'u', 'n'], emoji: '☀️', asrAliases: ['sun', 'son'] },
    { id: 'v2', challengeType: 'word_reading_review', word: 'we', wordType: 'sight', asrAliases: ['we', 'wee'] }],
};
const ALL_MODES = Object.keys(CHALLENGES) as DiWordReadingChallengeType[];

function mount(mode: DiWordReadingChallengeType = 'cvc_reading', classify?: DialogueClassifier) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m), classify);
  const data = { instanceId: 'words', title: 'Word reading', description: 'Read each word.',
    challengeType: mode, challenges: CHALLENGES[mode] } as DiWordReadingData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <DiWordReading data={data} runtimePlanItemId="plan-words" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const command = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    return { sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'words', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } };
  };
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const c = command(name, input); let result: any;
    act(() => { result = runtime.dispatch(c); });
    return result;
  };
  const say = (text: string, role: 'user' | 'assistant' = 'user') => act(() => {
    seam.conversation = [...seam.conversation, { role, content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none', responseId?: string) =>
    dispatch('apply_tutor_verdict', { dialogue: {
      responseId: responseId ?? state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'You read it.' : 'That is a different word.' } });
  return { runtime, transport, sent, view, state, offer, command, dispatch, say, feedback };
}

// ── The advertised capability set, per mode ──

it.each(ALL_MODES)('%s publishes a factual ask with no scripted cue and no tutor progression tool', mode => {
  const h = mount(mode);
  expect(h.state().owner).toBe('tutor');
  const task = h.state().task!;
  expect(task.demand.kind).toBe(mode);
  expect(task.task).toBeTruthy();
  expect(task.task).not.toMatch(/\[DI_|Speak exactly|My turn|Your turn/);
  expect(JSON.stringify(task)).not.toMatch(/Speak exactly|say exactly/i);
  // The model sees help and demonstration. Recording and progression are observer-only.
  expect(h.state().affordances.filter(a => !a.controller).map(a => (a.action as any).operation ?? a.action.type).sort())
    .toEqual(['begin_help', 'demonstrate']);
  expect(runtimePacket(h.state()).choices.some(a => ['retry', 'advance'].includes(a.action.type))).toBe(false);
  expect(task.evidence.attemptNumber).toBe(0);
  expect(task.support).toEqual({ level: 0, answerExposure: 'none' });
});

it.each(DI_WORD_READING_WORKSPACE_MODES)('%s is a mode the component actually binds to the workspace', mode => {
  expect(CHALLENGES[mode as DiWordReadingChallengeType], `no fixture for ${mode}`).toBeTruthy();
  expect(mount(mode as DiWordReadingChallengeType).state().owner).toBe('tutor');
});

// ── The answer IS the stimulus, so the ask must not carry it ──

it('never names the word in the task a tutor might read aloud, on any item of any mode', () => {
  for (const mode of ALL_MODES) {
    for (const item of buildWordReadingItems(CHALLENGES[mode])) {
      expect(item.ask.toLowerCase(), `${mode}/${item.id} leaked its word into the ask`)
        .not.toContain(item.word.toLowerCase());
    }
    const h = mount(mode);
    expect(h.state().task!.task.toLowerCase()).not.toContain(CHALLENGES[mode][0].word);
    cleanup();
  }
});

it('never states a learner response as a scene fact, and never marks the child as having read', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    const task = h.state().task!;
    expect(task.evidence.correctness).toBe('unknown');
    expect(task.workspace!.objects.every(o => !o.selected)).toBe(true);
    expect(task.workspace!.lastResponse).toBeFalsy();
    // Nothing in the facts can read as "the learner read nothing" — that
    // contradicts a tutor affirming a read the application never hears.
    expect(JSON.stringify(task.demand)).not.toMatch(/"(said|read|produced|counted|heard)":/);
    cleanup();
  }
});

// ── Two word types, one act: the scene enforces the difference ──

it('publishes the printed letters and the blend for a decodable word', () => {
  const h = mount('cvc_reading');
  expect(h.state().task!.workspace!.objects.map(o => o.id)).toEqual(['word', 'letter-0', 'letter-1', 'letter-2']);
  expect(h.state().task!.demand.soundOut).toBe('sss-aaa-mmm');
  expect(String(h.state().task!.demand.wordType)).toMatch(/decodable/);
  expect(h.view.container.querySelectorAll('[data-word-letter]')).toHaveLength(3);
});

it('publishes no letter and no blend for an irregular sight word, and refuses sounding one out', () => {
  const h = mount('sight_word');
  expect(h.state().task!.workspace!.objects.map(o => o.id)).toEqual(['word']);
  expect(h.state().task!.demand.soundOut).toBeUndefined();
  expect(String(h.state().task!.demand.wordType)).toMatch(/recalled whole, never sounded out/);
  expect(String(h.state().task!.demand.assignment))
    .toMatch(/sounding it out letter by letter is not how it is read/);
  // The teaching error is refused by the scene, not by a sentence of guidance.
  expect(h.dispatch('demonstrate', { targets: ['letter-0'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(0);
});

it('carries the strict near-neighbour success condition into every mode', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    expect(String(h.state().task!.demand.assignment), mode)
      .toMatch(/A different word is not a correct read, however close it sounds\./);
    cleanup();
  }
});

// ── The reward picture follows the committed read (handoff 09 decision) ──

it('keeps the reward picture off the screen and out of the tutor’s scene until a read is committed', () => {
  const h = mount('read_word');
  expect(h.view.container.querySelector('[data-word-read]')).toBeNull();
  expect(h.view.container.textContent).not.toContain('🐱');
  // Not a workspace object: a tutor that could see it could name it aloud.
  expect(JSON.stringify(runtimePacket(h.state()))).not.toContain('🐱');
  h.say('cat');
  expect(h.view.container.querySelector('[data-word-read]')).toBeNull();
  h.feedback('correct'); // Success held on the item, no advance.
  expect(h.view.container.querySelector('[data-word-read="cat"]')).toBeTruthy();
  expect(h.view.container.textContent).toContain('🐱');
  expect(JSON.stringify(runtimePacket(h.state()))).not.toContain('🐱');
  // A sight word with no picture still gets a receipt for the word it read.
  h.dispatch('advance');
  h.say('the'); h.feedback('correct');
  expect(h.view.container.querySelector('[data-word-read="the"]')).toBeTruthy();
});

// ── Help and demonstration are not learner work (TW-4, TW-8, TW-9) ──

it('marks the whole word for a demonstration without answering, and keeps the assistance history', async () => {
  const h = mount();
  h.say('can you help me');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(seam.send).not.toHaveBeenCalled();
  const c = h.command('demonstrate', { targets: ['word'] });
  let pending: Promise<void>;
  await act(async () => { pending = h.transport.command(c);
    expect(h.view.container.querySelector('[data-word-object="printed"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); }); await pending!;
  expect(h.sent.filter(m => m.type === 'runtime_result').at(-1).status).toBe('visible');
  expect(h.state().task!.workspace!.demonstration).toEqual(['word']);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.dispatch('demonstrate', { targets: ['letter-1'] });
  expect(h.view.container.querySelector('[data-word-letter="1"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
  h.dispatch('demonstrate', { targets: [] });
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(2); // Clearing a mark does not erase the help.
});

it('refuses an unknown demonstration target without a partial mutation', () => {
  const h = mount();
  expect(h.dispatch('demonstrate', { targets: ['word', 'letter-9'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(0);
});

it('offers no word-changing, writing or answering operation to the tutor', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    const operations = h.state().affordances.filter(a => !a.controller)
      .map(a => (a.action as any).operation ?? a.action.type);
    for (const forbidden of ['present', 'replay', 'record_response', 'write', 'speak', 'play_sound']) {
      expect(operations, `${mode} offered ${forbidden}`).not.toContain(forbidden);
    }
    cleanup();
  }
});

// ── Spoken evidence: the tutor's completed feedback owns the verdict (TW-3) ──

it('keeps speech as context until observed tutor feedback records a verdict', () => {
  const h = mount();
  h.say('can you help me with this one?');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('Look at the first letter.', 'assistant');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('sat'); h.feedback('incorrect');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  h.say('sam'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.itemId).toBe('c1'); // Success without advancing off the item.
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('refuses a verdict carrying a stale response id, and re-opens on the child’s new words', () => {
  const h = mount();
  h.say('sat');
  const stale = h.state().task!.workspace!.pendingResponse!.id;
  h.say('sam');
  expect(h.state().task!.workspace!.pendingResponse!.id).not.toBe(stale);
  expect(h.feedback('correct', 'none', stale).status).not.toBe('committed');
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('refuses a duplicate command and a stale retry after the item has moved on', () => {
  const h = mount();
  h.say('sam'); h.feedback('correct');
  const old = h.command('retry');
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'c2', evidence: { attemptNumber: 0 }, support: { level: 0 } });
  expect(h.runtime.dispatch(old).status).toBe('stale');
  const help = h.command('begin_help');
  let first: any, second: any;
  act(() => { first = h.runtime.dispatch(help); });
  act(() => { second = h.runtime.dispatch(help); });
  expect(first.status).toBe('committed');
  expect(second.status).toBe('duplicate');
});

// ── Observation lifecycle, completion and the single submission ──

it('observes settled speech, advances visibly, and completes once after playback drains', async () => {
  const classify = vi.fn(async () => ({ verdict: 'correct' as const, transition: 'advance' as const,
    confidence: .99, verdictConfidence: .99, grounded: 1, accepted: true, reason: 'supported', ms: 200 }));
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('cvc_reading', classify);
  for (const answer of ['sam', 'mat']) {
    h.say(answer);
    act(() => { h.transport.beginTurn(`You read ${answer}.`); h.transport.endTurn(true); });
    await act(async () => { h.transport.audioChanged(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  }
  expect(classify).toHaveBeenCalledTimes(2);
  expect(h.state().status).toBe('completed');
  expect(h.sent.filter(m => m.type === 'runtime_result')).toHaveLength(0);
  expect(screen.getByText(/Great reading today!/)).toBeTruthy();
  expect(seam.correct).toHaveBeenCalledTimes(2);
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, accuracy, metrics] = seam.submit.mock.calls[0];
  expect(passed).toBe(true);
  expect(accuracy).toBe(100);
  expect(metrics).toMatchObject({ type: 'di-word-reading', evalMode: 'cvc_reading',
    challengeType: 'cvc_reading', totalChallenges: 2, correctCount: 2, attemptsCount: 2, firstTryCount: 2 });
  h.transport.close();
});

it('refuses every action after the learner stops', () => {
  const h = mount();
  const stop = h.command('begin_help');
  act(() => { h.runtime.stop(); });
  expect(h.state().affordances).toEqual([]);
  expect(h.runtime.dispatch(stop).status).not.toBe('committed');
});

// ── The scripted drill is not what a live mode mounts ──

it('does not mount the scripted drill, its mic panel or its cue tags inside the runtime', () => {
  const h = mount();
  expect(h.view.container.querySelector('[data-word-object="printed"]')).toBeTruthy();
  expect(h.view.container.textContent).not.toMatch(/Start the lesson|Your turn. What word/);
  expect(JSON.stringify(runtimePacket(h.state()))).not.toMatch(/\[DI_ITEM|\[DI_MOVE_ON|\[DI_COMPLETE/);
});

// ── The registry row: what the route accepts and what the model is told ──

it('advertises exactly the four workspace modes under tutor ownership', () => {
  expect(diWordReadingLive.modes).toEqual(['cvc_reading', 'read_word', 'sight_word', 'word_reading_review']);
  expect(diWordReadingLive.teachingOwner).toBe('tutor');
  expect(diWordReadingLive.canAdvance).toBe(false);
  expect(diWordReadingLive.tutoring).toBeNull();
  expect(diWordReadingLive.copy.lessons.map(([mode]) => mode)).toEqual(diWordReadingLive.modes);
});

it('keeps guidance inside the backend offer cap, with no sentence for the tutor to recite', () => {
  // `live_activity_tools.parse_activity_spec` rejects an offer above 2000
  // characters and closes the socket with `Invalid activity offer`, which does
  // not read as a length problem from the frontend.
  expect(diWordReadingLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(diWordReadingLive.guidance).not.toMatch(/say exactly|Speak exactly|"[A-Z][^"]{12,}"/);
});

it('publishes exactly the domain assignment and scene that the verdict probe replays', () => {
  // `scripts/tutor-verdict-probe.mjs` builds its model input from `workspaceAssignment`
  // and `workspaceScene`. It replays the lesson only while the mounted stage publishes
  // those and nothing else.
  const h = mount('cvc_reading');
  const item = buildWordReadingItems(CHALLENGES.cvc_reading)[0];
  const { task, expectedAnswer, response } = workspaceAssignment(item), scene = workspaceScene(item);
  expect(h.state().task!.task).toBe(task);
  expect(h.state().task!.demand).toEqual({ ...scene.facts, response, presentation: 'ready' });
  expect(h.state().task!.workspace).toMatchObject({ objects: scene.objects, expectedAnswer });
});

it('rejects a pool whose items cannot be asked, and one whose blend does not spell its word', () => {
  const ok = { title: 'Words', description: 'Read them.', challengeType: 'cvc_reading',
    challenges: CHALLENGES.cvc_reading } as DiWordReadingData;
  expect(validateDiWordReadingData(ok)).toBe(ok);
  const broken = (challenges: DiWordReadingChallenge[]) => () =>
    validateDiWordReadingData({ ...ok, challenges });
  expect(broken([{ ...CHALLENGES.cvc_reading[0], graphemes: ['s', 'a', 't'] }])).toThrow();
  expect(broken([{ ...CHALLENGES.sight_word[0], graphemes: ['s', 'e', 'e'] }])).toThrow();
  expect(broken([{ ...CHALLENGES.cvc_reading[0], word: 'Sam' }])).toThrow();
  expect(broken([{ ...CHALLENGES.cvc_reading[0], challengeType: 'letter_sound' as any }])).toThrow();
});
