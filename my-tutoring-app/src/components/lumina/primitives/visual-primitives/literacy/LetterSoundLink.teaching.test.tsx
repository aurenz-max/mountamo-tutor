// @vitest-environment jsdom
/**
 * Real LetterSoundLink, real TeachingSession, real LiveLessonRuntime, real
 * transport and rendering shell. Only microphone hardware, evaluation writes and
 * sound are substituted. Every case is the TEACHING_WORKSPACE behavioural matrix,
 * asked in this primitive's own domain.
 *
 * Four cases exist only here, because they are this binding's own risks — and
 * all four belong to `hear_see`, the first workspace mode whose answer the tutor
 * is never told:
 *
 *   - its item publishes NO `expectedAnswer`, anywhere in the packet;
 *   - its two letter cards share one group, so nothing in the scene marks the target;
 *   - it offers no `demonstrate`, because every object on its stage is an answer option;
 *   - its answer is a TAP, so the activity keeps grading authority and the host
 *     message announcing the tap is not a learner turn.
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
import type { LearnerIntentClassifier } from '../../../components/live-activity/runtime/LearnerObserver';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(),
  correct: vi.fn(), evaluationContext: null as unknown, voiceActive: false, close: null as (() => void) | null }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'links',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => seam.voiceActive,
    subscribe: (listener: { onTurnClose: () => void }) => { seam.close = listener.onTurnClose; return () => { seam.close = null; }; } },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { playCorrect: seam.correct, playPerfect: vi.fn(),
  playStreak: vi.fn(), tap: vi.fn(), snap: vi.fn(), invalid: vi.fn(), isEnabled: () => true, getVolume: () => 1 } }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import LetterSoundLink, { type LetterSoundLinkChallenge, type LetterSoundLinkData } from './LetterSoundLink';
import { LETTER_SOUND_LINK_WORKSPACE_MODES } from './letterSoundLinkDomain';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.voiceActive = false;
  seam.close = null; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type EvalMode = (typeof LETTER_SOUND_LINK_WORKSPACE_MODES)[number];

/** Two items per direction, in the shape the generator emits. The second
 *  see_hear item is a STOP, whose accept clause is wider than a continuant's. */
const CHALLENGES: Record<EvalMode, LetterSoundLinkChallenge[]> = {
  see_hear: [
    { id: 'm1', mode: 'see-hear', targetLetter: 'm', targetSound: '/m/', keywordWord: 'map', keywordImage: '🗺️' },
    { id: 't1', mode: 'see-hear', targetLetter: 't', targetSound: '/t/', keywordWord: 'tent', keywordImage: '⛺' }],
  hear_see: [
    { id: 'h1', mode: 'hear-see', targetLetter: 's', targetSound: '/s/', keywordWord: 'sun', keywordImage: '☀️',
      options: [{ letter: 's', isCorrect: true }, { letter: 'f', isCorrect: false }] },
    { id: 'h2', mode: 'hear-see', targetLetter: 'b', targetSound: '/b/', keywordWord: 'bat', keywordImage: '🦇',
      options: [{ letter: 'b', isCorrect: true }, { letter: 'd', isCorrect: false }] }],
  keyword_match: [
    { id: 'k1', mode: 'keyword-match', targetLetter: 's', targetSound: '/s/', keywordWord: 'sun', keywordImage: '☀️',
      options: [{ sound: 'sun', isCorrect: true }, { sound: 'net', isCorrect: false }] },
    { id: 'k2', mode: 'keyword-match', targetLetter: 'p', targetSound: '/p/', keywordWord: 'pig', keywordImage: '🐷',
      options: [{ sound: 'pig', isCorrect: true }, { sound: 'hat', isCorrect: false }] }],
};
const ALL_MODES = Object.keys(CHALLENGES) as EvalMode[];

function mount(mode: EvalMode = 'see_hear', classify?: DialogueClassifier, classifyLearner?: LearnerIntentClassifier) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m), classify, classifyLearner);
  // Production stamps every non-silent `sendText` as learner text on the wire, so
  // the gesture message the hook writes has to travel that channel here too —
  // otherwise the host-text registration this binding depends on is untested.
  seam.send.mockImplementation((text: string) => { transport.learnerText(text, true); });
  const data = { instanceId: 'links', title: 'Letter sounds', letterGroup: 1,
    cumulativeLetters: ['m', 's', 't', 'b', 'p'], challenges: CHALLENGES[mode] } as LetterSoundLinkData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <LetterSoundLink data={data} runtimePlanItemId="plan-links" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const command = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    return { sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'links', itemId: s.task!.itemId,
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
  /** The learner's own Try again / Next challenge, which lives in the shared
   *  shell and is the only progression a gesture mode has until the tutor's
   *  settled feedback is observed. It runs through the transport, so its visible
   *  receipt is the real one. */
  const progress = async (type: 'advance' | 'retry') => {
    let pending: Promise<void>;
    await act(async () => { pending = transport.learnerProgress(type); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    await pending!;
  };
  const tap = (letter: string) => act(() => {
    view.container.querySelector<HTMLButtonElement>(`[data-letter-option="${letter}"]`)!.click();
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none', responseId?: string) =>
    dispatch('apply_tutor_verdict', { dialogue: {
      responseId: responseId ?? state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'That is the one.' : 'That is a different one.' } });
  return { runtime, transport, sent, view, state, offer, command, dispatch, say, tap, progress, feedback };
}

// ── The advertised capability set, per direction ──

it.each(ALL_MODES)('%s publishes a factual ask with no scripted cue and no tutor progression tool', mode => {
  const h = mount(mode);
  expect(h.state().owner).toBe('tutor');
  const task = h.state().task!;
  expect(task.task).toBeTruthy();
  expect(task.task).not.toMatch(/\[LSL_|Say exactly|My turn|Listen:/);
  expect(JSON.stringify(task)).not.toMatch(/Say exactly|say exactly/i);
  expect(runtimePacket(h.state()).choices.some(a => ['retry', 'advance'].includes(a.action.type))).toBe(false);
  expect(task.evidence.attemptNumber).toBe(0);
  expect(task.support).toEqual({ level: 0, answerExposure: 'none' });
});

it.each(LETTER_SOUND_LINK_WORKSPACE_MODES)('%s is a mode the component actually binds to the workspace', mode => {
  expect(CHALLENGES[mode], `no fixture for ${mode}`).toBeTruthy();
  expect(mount(mode).state().owner).toBe('tutor');
});

it('offers demonstration where there is something to point at, and none where every object is an answer', () => {
  const operations = (mode: EvalMode) => mount(mode).state().affordances.filter(a => !a.controller)
    .map(a => (a.action as any).operation ?? a.action.type).sort();
  expect(operations('see_hear')).toEqual(['begin_help', 'demonstrate']); cleanup();
  expect(operations('keyword_match')).toEqual(['begin_help', 'demonstrate']); cleanup();
  // hear_see: the only objects are the two letters the child chooses between, and
  // marking either one answers for them. The scene refuses the action.
  expect(operations('hear_see')).toEqual(['begin_help']);
});

it('offers no letter-changing, writing or answering operation to the tutor', () => {
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

it('never states a learner response as a scene fact, and never marks the child as having answered', () => {
  for (const mode of ALL_MODES) {
    const h = mount(mode);
    const task = h.state().task!;
    expect(task.evidence.correctness).toBe('unknown');
    expect(task.workspace!.objects.every(o => !o.selected)).toBe(true);
    expect(task.workspace!.lastResponse).toBeFalsy();
    expect(JSON.stringify(task.demand)).not.toMatch(/"(said|answered|produced|tapped|heard)":/);
    cleanup();
  }
});

// ── This primitive's own pedagogy survives the sunset ──

it('names the letter NAME as the miss on a produced sound, and widens the accept clause for a stop', () => {
  const h = mount('see_hear');
  expect(h.state().task!.task).toBe('What sound does the letter "m" make?');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('mmm');
  // The exact sentence, because `scripts/tutor-verdict-probe.mjs` mirrors it by
  // hand: if this changes and the mirror does not, the probe stops replaying the
  // real model input.
  expect(h.state().task!.demand.assignment).toBe(
    'The learner must say the continuous sound mmm that this letter makes. '
    + 'A short try counts, and so does a little "uh" on the end.'
    + ` The letter's NAME — "em" — is not the answer, however confidently it is said.`);
  h.say('mmm'); h.feedback('correct', 'advance');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('/t/ or tent');
  expect(String(h.state().task!.demand.assignment)).toMatch(/A small "uh" after it counts/);
  expect(String(h.state().task!.demand.assignment)).toMatch(/"tent" or another word starting with that sound/);
});

it('names BOTH keyword-match misses: the other picture, and the letter sound said back', () => {
  const h = mount('keyword_match');
  const assignment = String(h.state().task!.demand.assignment);
  expect(h.state().task!.workspace!.expectedAnswer).toBe('sun');
  expect(assignment).toMatch(/The other picture's word, "net", is not the answer/);
  // The live drive's false affirm: "sss" is a sound, and this mode's question
  // names that sound on the way to the answer.
  expect(assignment).toMatch(/"sss" — is a sound and not the name of a picture/);
});

it('withholds the anchor word entirely on a produced-sound item, where it would hand over the sound', () => {
  const h = mount('see_hear');
  // Not a fact, not an object, not the expected answer: the keyword picture is
  // not drawn until the answer is committed, so the tutor cannot name it early.
  expect(JSON.stringify(runtimePacket(h.state()))).not.toMatch(/\bmap\b/);
  expect(h.view.container.querySelector('[data-letter-revealed]')).toBeNull();
});

// ── hear_see: the tutor is not told the answer ──

it('publishes no expected answer, and no target group, for the tapped direction', () => {
  const h = mount('hear_see');
  const task = h.state().task!;
  expect(task.task).toBe('Which letter makes the sound sss? Tap it.');
  expect(task.workspace!.expectedAnswer).toBeUndefined();
  expect(String(task.demand.soundToSay)).toBe('sss');
  // Both cards carry the same group. Nothing in the scene says which is right.
  expect(new Set(task.workspace!.objects.map(o => o.group)).size).toBe(1);
  expect(JSON.stringify(runtimePacket(h.state()))).not.toMatch(/assignment target|expectedAnswer/);
  expect(JSON.stringify(runtimePacket(h.state()))).not.toMatch(/"[Ss]"[,}]/);
});

it('checks the tap in the activity, records it as the learner’s own, and does not count the host message as a learner turn', async () => {
  const classifyLearner = vi.fn(async () => ({ asksForHelp: .02, wantsToStop: .01, attemptsAnswer: .9,
    accepted: true, reason: 'observed', ms: 150 }));
  const h = mount('hear_see', undefined, classifyLearner as never);
  h.tap('f');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.phase).toBe('checked');
  expect(h.offer('advance')).toBeUndefined(); // A wrong answer never advances.
  // The host wrote that message, so it is not the child speaking.
  expect(seam.send).toHaveBeenCalledOnce();
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(classifyLearner).not.toHaveBeenCalled();
  h.transport.publish();
  const packet = () => h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet().learner.signals).toMatchObject({ itemId: 'h1', learnerTurns: 0, attempts: 1, wrongAttempts: 1 });
  h.dispatch('retry');
  h.tap('s');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('keeps grading authority with the activity: tutor praise cannot record a tapped answer', () => {
  const h = mount('hear_see');
  h.say('is it this one');
  // No spoken response is pending on a gesture item, so there is nothing to affirm.
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
  expect(h.offer('apply_tutor_verdict')).toBeUndefined();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
});

// ── Help and demonstration are not learner work (TW-4, TW-8, TW-9) ──

it('marks a picture for a demonstration without answering, and keeps the assistance history', async () => {
  const h = mount('keyword_match');
  h.say('can you help me');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  const c = h.command('demonstrate', { targets: ['picture-net'] });
  let pending: Promise<void>;
  await act(async () => { pending = h.transport.command(c);
    expect(h.view.container.querySelector('[data-letter-object="picture-net"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); }); await pending!;
  expect(h.sent.filter(m => m.type === 'runtime_result').at(-1).status).toBe('visible');
  expect(h.state().task!.workspace!.demonstration).toEqual(['picture-net']);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.dispatch('demonstrate', { targets: [] });
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(2); // Clearing a mark does not erase the help.
});

it('refuses an unknown demonstration target without a partial mutation', () => {
  const h = mount('keyword_match');
  expect(h.dispatch('demonstrate', { targets: ['letter', 'keyword-card'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(0);
});

// ── Spoken evidence: the tutor's completed feedback owns the verdict (TW-3) ──

it('keeps speech as context until observed tutor feedback records a verdict', () => {
  const h = mount('see_hear');
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
  const h = mount('keyword_match');
  h.say('net');
  const stale = h.state().task!.workspace!.pendingResponse!.id;
  h.say('sun');
  expect(h.state().task!.workspace!.pendingResponse!.id).not.toBe(stale);
  expect(h.feedback('correct', 'none', stale).status).not.toBe('committed');
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('refuses a duplicate command and a stale retry after the item has moved on', () => {
  const h = mount('see_hear');
  h.say('mmm'); h.feedback('correct');
  const old = h.command('retry');
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 't1', evidence: { attemptNumber: 0 }, support: { level: 0 } });
  expect(h.runtime.dispatch(old).status).toBe('stale');
  const help = h.command('begin_help');
  let first: any, second: any;
  act(() => { first = h.runtime.dispatch(help); });
  act(() => { second = h.runtime.dispatch(help); });
  expect(first.status).toBe('committed');
  expect(second.status).toBe('duplicate');
});

// ── Learner signals ride the packet, and a tutor turn is not a learner turn ──

it('sends learner signals with the packet, and counts the tutor’s own turn separately', async () => {
  const classifyLearner = vi.fn(async (..._args: unknown[]) => ({ asksForHelp: .95, wantsToStop: .01,
    attemptsAnswer: .03, accepted: true, reason: 'observed', ms: 180 }));
  const h = mount('see_hear', undefined, classifyLearner as never);
  const packet = () => h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  h.transport.publish();
  expect(packet().learner.signals).toMatchObject({ itemId: 'm1', attempts: 0, learnerTurns: 0, helpRequests: 0 });
  act(() => { h.transport.beginTurn('Look at this letter.'); h.transport.endTurn(true); h.transport.audioChanged(false); });
  h.transport.publish();
  expect(packet().learner.signals).toMatchObject({ tutorTurns: 1, learnerTurns: 0 });
  await act(async () => { h.transport.learnerText('I do not know', true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  const request = classifyLearner.mock.calls[0][0] as Record<string, unknown>;
  // The learner kind never sees the expected answer: it must not become a second
  // speech grader on a pack whose answer is one held sound.
  expect(JSON.stringify(request)).not.toContain('mmm');
  expect(packet().learner.signals).toMatchObject({ learnerTurns: 1, helpRequests: 1, stopRequests: 0 });
  expect(packet().learner.observations)
    .toEqual([expect.objectContaining({ kind: 'learner_intent', helpRequested: true })]);
  // Advisory only: nothing about the item's record moved.
  expect(h.state().task).toMatchObject({ phase: 'working', evidence: { attemptNumber: 0 }, support: { level: 0 } });
  h.transport.close();
});

// ── Observation lifecycle, completion and the single submission ──

it('observes settled speech, advances visibly, and completes once after playback drains', async () => {
  const classify = vi.fn(async () => ({ verdict: 'correct' as const, transition: 'advance' as const,
    confidence: .99, verdictConfidence: .99, grounded: 1, accepted: true, reason: 'supported', ms: 200 }));
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('keyword_match', classify);
  // Nothing prints the answer word before it is committed.
  expect(h.view.container.querySelector('[data-letter-revealed]')).toBeNull();
  for (const answer of ['sun', 'pig']) {
    h.say(answer);
    act(() => { h.transport.beginTurn(`Yes, ${answer}.`); h.transport.endTurn(true); });
    await act(async () => { h.transport.audioChanged(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  }
  expect(classify).toHaveBeenCalledTimes(2);
  expect(h.state().status).toBe('completed');
  expect(h.sent.filter(m => m.type === 'runtime_result')).toHaveLength(0);
  expect(screen.getByText(/Letter-Sound Link Complete!/)).toBeTruthy();
  expect(seam.correct).toHaveBeenCalledTimes(2);
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, accuracy, metrics] = seam.submit.mock.calls[0];
  expect(passed).toBe(true);
  expect(accuracy).toBe(100);
  expect(metrics).toMatchObject({ type: 'letter-sound-link', letterGroup: 1, challengesCorrect: 2,
    challengesTotal: 2, attemptsCount: 2, phonemeToGraphemeAccuracy: 100, confusedSoundPairs: [] });
  h.transport.close();
});

it('records the confused letter pair a wrong tap reveals, and nothing else', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('hear_see');
  h.tap('f');
  await h.progress('retry');
  h.tap('s');
  await h.progress('advance');
  h.tap('b');
  await h.progress('advance');
  await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  expect(h.state().status).toBe('completed');
  const metrics = seam.submit.mock.calls[0]?.[2];
  expect(metrics).toMatchObject({ type: 'letter-sound-link', confusedSoundPairs: ['f↔s'],
    phonemeToGraphemeAccuracy: 100, graphemeToPhonemeAccuracy: 100 });
});

it('refuses every action after the learner stops', () => {
  const h = mount('hear_see');
  const stop = h.command('begin_help');
  act(() => { h.runtime.stop(); });
  expect(h.state().affordances).toEqual([]);
  expect(h.runtime.dispatch(stop).status).not.toBe('committed');
});

// ── The scripted drill is not what a live mode mounts ──

it('does not mount the scripted drill, its mic panel or its cue tags inside the runtime', () => {
  const h = mount('see_hear');
  expect(h.view.container.querySelector('[data-letter-stage]')).toBeTruthy();
  expect(h.view.container.textContent).not.toMatch(/Start the lesson|Listen, then say your answer out loud/);
  expect(JSON.stringify(runtimePacket(h.state()))).not.toMatch(/\[LSL_ITEM|\[LSL_TAP|\[LSL_MOVE|\[LSL_COMPLETE/);
});
