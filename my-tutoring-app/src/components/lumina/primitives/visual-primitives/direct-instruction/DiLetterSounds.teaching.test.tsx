// @vitest-environment jsdom
/**
 * Real DiLetterSounds, real TeachingSession, real LiveLessonRuntime, real transport
 * and rendering shell. Only microphone hardware, evaluation writes and sound are
 * substituted. Every case is the TEACHING_WORKSPACE behavioural matrix, asked in
 * this pack's own domain: a child producing a sound out loud, with the tutor as
 * the only judge of the audio.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'sounds',
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
import DiLetterSounds, { type DiLetterSoundsData } from './DiLetterSounds';
import { DI_LETTER_SOUNDS_WORKSPACE_MODES, type DiLetterSoundChallenge, type DiLetterSoundChallengeType }
  from './diLetterSoundsDomain';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.voiceActive = false;
  seam.close = null; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Two items per mode, drawn from the generator's own menu entries. */
const CHALLENGES: Record<DiLetterSoundChallengeType, DiLetterSoundChallenge[]> = {
  letter_sound: [
    { id: 'm1', challengeType: 'letter_sound', letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated' },
    { id: 'a1', challengeType: 'letter_sound', letter: 'a', spoken: 'aaa', keyword: 'apple', emoji: '🍎', elicitation: 'keyword' }],
  letter_sound_review: [
    { id: 's1', challengeType: 'letter_sound_review', letter: 's', spoken: 'sss', keyword: 'sun', emoji: '☀️', elicitation: 'isolated' },
    { id: 't1', challengeType: 'letter_sound_review', letter: 't', spoken: '/t/', keyword: 'tent', emoji: '⛺', elicitation: 'isolated', articulation: 'clipped' }],
  first_sound_in_word: [
    { id: 'w1', challengeType: 'first_sound_in_word', letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated' },
    { id: 'w2', challengeType: 'first_sound_in_word', letter: 'f', spoken: 'fff', keyword: 'fish', emoji: '🐟', elicitation: 'isolated' }],
};
const ALL_MODES = Object.keys(CHALLENGES) as DiLetterSoundChallengeType[];

function mount(mode: DiLetterSoundChallengeType = 'letter_sound', classify?: DialogueClassifier) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m), classify);
  const data = { instanceId: 'sounds', title: 'Letter sounds', description: 'Say each sound.',
    challengeType: mode, challenges: CHALLENGES[mode] } as DiLetterSoundsData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <DiLetterSounds data={data} runtimePlanItemId="plan-sounds" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const command = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    return { sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'sounds', itemId: s.task!.itemId,
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
      tutor: verdict === 'correct' ? 'That is the sound.' : 'That is a different sound.' } });
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

it.each(DI_LETTER_SOUNDS_WORKSPACE_MODES)('%s is a mode the component actually binds to the workspace', mode => {
  expect(CHALLENGES[mode as DiLetterSoundChallengeType], `no fixture for ${mode}`).toBeTruthy();
  expect(mount(mode as DiLetterSoundChallengeType).state().owner).toBe('tutor');
});

it('never states a learner response as a scene fact, and never marks the child as having answered', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    const task = h.state().task!;
    expect(task.evidence.correctness).toBe('unknown');
    expect(task.workspace!.objects.every(o => !o.selected)).toBe(true);
    expect(task.workspace!.lastResponse).toBeFalsy();
    // Nothing in the facts can read as "the learner produced nothing" — that
    // contradicts a tutor affirming a sound the application never hears.
    expect(JSON.stringify(task.demand)).not.toMatch(/"(said|produced|counted|heard)":/);
    cleanup();
  }
});

// ── The task's own pedagogy survives the sunset ──

it('elicits a short vowel through its keyword, and accepts a stop as clipped or as its keyword', () => {
  const vowel = mount('letter_sound');
  vowel.say('mmm'); vowel.feedback('correct', 'advance');
  expect(vowel.state().task!.task).toBe('Say the word "apple".');
  expect(vowel.state().task!.workspace!.expectedAnswer).toBe('apple');
  expect(String(vowel.state().task!.demand.assignment)).toMatch(/the whole answer for this short vowel/);
  cleanup();
  const stop = mount('letter_sound_review');
  stop.say('sss'); stop.feedback('correct', 'advance');
  expect(stop.state().task!.workspace!.expectedAnswer).toBe('/t/ or tent');
  expect(String(stop.state().task!.demand.assignment)).toMatch(/A small "uh" after it counts/);
});

it('draws the WORD and never the lone grapheme on an onset-isolation item', () => {
  const h = mount('first_sound_in_word');
  const stimulus = h.view.container.querySelector('[data-sound-object="stimulus"]')!;
  expect(stimulus.textContent).toBe('moon');
  expect(h.state().task!.task).toBe('What is the first sound in "moon"?');
  expect(JSON.stringify(h.state().task!.workspace!.objects)).not.toMatch(/the letter "m"/);
});

it('blocks the letter name as the answer on a grapheme item', () => {
  const h = mount('letter_sound');
  expect(String(h.state().task!.demand.assignment)).toMatch(/name is not the answer/);
  expect(String(h.state().task!.demand.assignment)).toMatch(/naming the picture "moon" is a step/);
});

// ── Help and demonstration are not learner work (TW-4, TW-8, TW-9) ──

it('marks the keyword picture for a demonstration without answering, and keeps the assistance history', async () => {
  const h = mount();
  h.say('can you help me');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(seam.send).not.toHaveBeenCalled();
  const c = h.command('demonstrate', { targets: ['picture'] });
  let pending: Promise<void>;
  await act(async () => { pending = h.transport.command(c);
    expect(h.view.container.querySelector('[data-sound-object="picture"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); }); await pending!;
  expect(h.sent.filter(m => m.type === 'runtime_result').at(-1).status).toBe('visible');
  expect(h.state().task!.workspace!.demonstration).toEqual(['picture']);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.dispatch('demonstrate', { targets: [] });
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(2); // Clearing a mark does not erase the help.
});

it('refuses an unknown demonstration target without a partial mutation', () => {
  const h = mount();
  expect(h.dispatch('demonstrate', { targets: ['stimulus', 'flashcard'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(0);
});

it('offers no sound-changing, writing or answering operation to the tutor', () => {
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
  h.say('Look at the letter on the card.', 'assistant');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('em'); h.feedback('incorrect');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  h.say('mmm'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.itemId).toBe('m1'); // Success without advancing off the item.
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('refuses a verdict carrying a stale response id, and re-opens on the child’s new words', () => {
  const h = mount();
  h.say('nnn');
  const stale = h.state().task!.workspace!.pendingResponse!.id;
  h.say('mmm');
  expect(h.state().task!.workspace!.pendingResponse!.id).not.toBe(stale);
  expect(h.feedback('correct', 'none', stale).status).not.toBe('committed');
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('refuses a duplicate command and a stale retry after the item has moved on', () => {
  const h = mount();
  h.say('mmm'); h.feedback('correct');
  const old = h.command('retry');
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'a1', evidence: { attemptNumber: 0 }, support: { level: 0 } });
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
  const h = mount('letter_sound', classify);
  for (const answer of ['mmm', 'apple']) {
    h.say(answer);
    act(() => { h.transport.beginTurn(`Yes, ${answer}.`); h.transport.endTurn(true); });
    await act(async () => { h.transport.audioChanged(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  }
  expect(classify).toHaveBeenCalledTimes(2);
  expect(h.state().status).toBe('completed');
  expect(h.sent.filter(m => m.type === 'runtime_result')).toHaveLength(0);
  expect(screen.getByText(/Great work today!/)).toBeTruthy();
  expect(seam.correct).toHaveBeenCalledTimes(2);
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, accuracy, metrics] = seam.submit.mock.calls[0];
  expect(passed).toBe(true);
  expect(accuracy).toBe(100);
  expect(metrics).toMatchObject({ type: 'di-letter-sounds', evalMode: 'letter_sound',
    challengeType: 'letter_sound', totalChallenges: 2, correctCount: 2, attemptsCount: 2, firstTryCount: 2 });
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
  expect(h.view.container.querySelector('[data-sound-object="stimulus"]')).toBeTruthy();
  expect(h.view.container.textContent).not.toMatch(/Start the lesson|Listen, then say the sound/);
  expect(JSON.stringify(runtimePacket(h.state()))).not.toMatch(/\[DI_ITEM|\[DI_MOVE_ON|\[DI_COMPLETE/);
});
