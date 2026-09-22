// @vitest-environment jsdom
/**
 * Real DiMathFacts, real TeachingSession, real LiveLessonRuntime, real transport
 * and rendering shell. Only microphone hardware, evaluation writes and sound are
 * substituted. Every case is the TEACHING_WORKSPACE behavioural matrix, asked in
 * this pack's own domain: a child answering one printed fact out loud, with the
 * tutor as the only judge of the audio.
 *
 * Four cases exist only here, because they are this primitive's own risks:
 * the answer must reach the tutor without reaching the stage, the completed
 * equation must not appear before a committed answer, a bare numeral must
 * publish no term to point at, and the answer WORD and the answer NUMERAL must
 * be the same number — the tutor judges one and the evaluation records the other.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'facts',
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
import DiMathFacts, { type DiMathFactsData } from './DiMathFacts';
import { DI_MATH_FACTS_WORKSPACE_MODES, buildMathFactItems, workspaceAssignment, workspaceScene,
  type DiMathFactsChallenge, type DiMathFactsChallengeType } from './diMathFactsDomain';
import { diMathFactsLive, validateDiMathFactsData } from '../../../components/live-activity/adapters/diMathFactsLive';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.voiceActive = false;
  seam.close = null; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Two items per mode, built the way the scoped pool builds them: the printed
 *  form carries no answer, the solved form carries it, and the counting mode
 *  reaches past twelve so the teen/decade discrimination is on a real item. */
const CHALLENGES: Record<DiMathFactsChallengeType, DiMathFactsChallenge[]> = {
  name_numeral: [
    { id: 'n1', challengeType: 'name_numeral', a: 7, b: 0, display: '7', problem: 'this number',
      answerWord: 'seven', answerNumeral: 7, solvedDisplay: '7 = seven' },
    { id: 'n2', challengeType: 'name_numeral', a: 4, b: 0, display: '4', problem: 'this number',
      answerWord: 'four', answerNumeral: 4, solvedDisplay: '4 = four', asrAliases: ['for', 'fore'] }],
  counting_next: [
    { id: 'c1', challengeType: 'counting_next', a: 5, b: 1, display: '5 →', problem: 'the number after five',
      answerWord: 'six', answerNumeral: 6, solvedDisplay: '5 → 6' },
    { id: 'c2', challengeType: 'counting_next', a: 12, b: 1, display: '12 →', problem: 'the number after twelve',
      answerWord: 'thirteen', answerNumeral: 13, solvedDisplay: '12 → 13' }],
  answer_fact: [
    { id: 'a1', challengeType: 'answer_fact', a: 2, b: 1, display: '2 + 1', problem: 'two plus one',
      answerWord: 'three', answerNumeral: 3, solvedDisplay: '2 + 1 = 3' },
    { id: 'a2', challengeType: 'answer_fact', a: 3, b: 1, display: '3 + 1', problem: 'three plus one',
      answerWord: 'four', answerNumeral: 4, solvedDisplay: '3 + 1 = 4', asrAliases: ['for'] }],
  fact_review: [
    { id: 'f1', challengeType: 'fact_review', a: 4, b: 2, display: '4 + 2', problem: 'four plus two',
      answerWord: 'six', answerNumeral: 6, solvedDisplay: '4 + 2 = 6' },
    { id: 'f2', challengeType: 'fact_review', a: 5, b: 5, display: '5 + 5', problem: 'five plus five',
      answerWord: 'ten', answerNumeral: 10, solvedDisplay: '5 + 5 = 10' }],
  subtraction_fact: [
    { id: 's1', challengeType: 'subtraction_fact', a: 3, b: 1, display: '3 - 1', problem: 'three minus one',
      answerWord: 'two', answerNumeral: 2, solvedDisplay: '3 - 1 = 2', asrAliases: ['too', 'to'] },
    { id: 's2', challengeType: 'subtraction_fact', a: 5, b: 2, display: '5 - 2', problem: 'five minus two',
      answerWord: 'three', answerNumeral: 3, solvedDisplay: '5 - 2 = 3' }],
};
const ALL_MODES = Object.keys(CHALLENGES) as DiMathFactsChallengeType[];

function mount(mode: DiMathFactsChallengeType = 'answer_fact', classify?: DialogueClassifier,
    classifyLearner?: LearnerIntentClassifier, pin: string = mode) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m), classify, classifyLearner);
  const data = { instanceId: 'facts', title: 'Math facts', description: 'Say each answer.',
    challengeType: mode, challenges: CHALLENGES[mode] } as DiMathFactsData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <DiMathFacts data={data} runtimePlanItemId="plan-facts" runtimeEvalMode={pin} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const command = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    return { sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'facts', itemId: s.task!.itemId,
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
      tutor: verdict === 'correct' ? 'That is right.' : 'That is a different number.' } });
  return { runtime, transport, sent, view, state, offer, command, dispatch, say, feedback };
}

// ── The advertised capability set, per mode ──

it.each(ALL_MODES)('%s publishes a factual ask with no scripted cue and no tutor progression tool', mode => {
  const h = mount(mode);
  expect(h.state().owner).toBe('tutor');
  const task = h.state().task!;
  expect(task.demand.kind).toBe(mode);
  expect(task.task).toBeTruthy();
  expect(task.task).not.toMatch(/\[DI_|Speak exactly|My turn|Your turn|Listen:|Together:/);
  expect(JSON.stringify(task)).not.toMatch(/Speak exactly|say exactly/i);
  // The model sees help and demonstration. Recording and progression are observer-only.
  expect(h.state().affordances.filter(a => !a.controller).map(a => (a.action as any).operation ?? a.action.type).sort())
    .toEqual(['begin_help', 'demonstrate']);
  expect(runtimePacket(h.state()).choices.some(a => ['retry', 'advance'].includes(a.action.type))).toBe(false);
  expect(task.evidence.attemptNumber).toBe(0);
  expect(task.support).toEqual({ level: 0, answerExposure: 'none' });
});

it.each(DI_MATH_FACTS_WORKSPACE_MODES)('%s is a mode the component actually binds to the workspace', mode => {
  expect(CHALLENGES[mode as DiMathFactsChallengeType], `no fixture for ${mode}`).toBeTruthy();
  expect(mount(mode as DiMathFactsChallengeType).state().owner).toBe('tutor');
});

// ── The answer is NOT the stimulus: it reaches the tutor, never the stage ──

it('never draws the answer, and never puts it in a task a tutor might read aloud', () => {
  for (const mode of ALL_MODES) {
    for (const item of buildMathFactItems(CHALLENGES[mode])) {
      expect(item.ask.toLowerCase(), `${mode}/${item.id} leaked its answer into the ask`)
        .not.toContain(item.answerWord);
      // `name_numeral` is the one mode whose stimulus IS the answer, so its
      // printed form legitimately shows the numeral the child must name.
      if (mode !== 'name_numeral') {
        expect(item.display, `${mode}/${item.id} drew its own answer`).not.toContain(String(item.answerNumeral));
        expect(item.display).not.toContain('=');
      }
    }
    const h = mount(mode);
    const stage = h.view.container.querySelector('[data-fact-object="problem"]')!.textContent!;
    if (mode !== 'name_numeral') expect(stage, mode).not.toContain(String(buildMathFactItems(CHALLENGES[mode])[0].answerNumeral));
    // The tutor DOES get it — it cannot judge otherwise — and that is exactly
    // why the guidance, not the scene, is what stops it being spoken first.
    expect(String(h.state().task!.demand.assignment)).toContain(buildMathFactItems(CHALLENGES[mode])[0].answerWord);
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
    // Nothing in the facts can read as "the learner answered zero" — that
    // contradicts a tutor affirming an answer the application never hears.
    expect(JSON.stringify(task.demand)).not.toMatch(/"(said|answered|produced|counted|heard)":/);
    cleanup();
  }
});

// ── The counting route is a property of the skill, not of the wording ──

it('licenses counting up for addition, counting back for take-away, and neither for naming a numeral', () => {
  const route = (mode: DiMathFactsChallengeType) => String(mount(mode).state().task!.demand.countingRoute);
  expect(route('answer_fact')).toMatch(/counting up/); cleanup();
  expect(route('counting_next')).toMatch(/counting up/); cleanup();
  expect(route('subtraction_fact')).toMatch(/counting back/); cleanup();
  const naming = route('name_numeral');
  expect(naming).toMatch(/none/);
  expect(String(mount('name_numeral').state().task!.demand.assignment))
    .toMatch(/Reciting the counting sequence up to it/);
});

it('adds the teen/decade and whole-compound discriminations only where the answer needs them', () => {
  const h = mount('counting_next');
  expect(String(h.state().task!.demand.assignment)).not.toMatch(/thirteen is not thirty/); // answer six
  h.say('six'); h.feedback('correct'); h.dispatch('advance');
  expect(String(h.state().task!.demand.assignment)).toMatch(/thirteen is not thirty/); // answer thirteen
  expect(String(h.state().task!.demand.assignment)).toMatch(/must arrive whole/);
});

it('carries the strict different-quantity success condition into every computed mode', () => {
  for (const mode of ALL_MODES) {
    if (mode === 'name_numeral') continue;
    const h = mount(mode);
    expect(String(h.state().task!.demand.assignment), mode)
      .toMatch(/A different number is not the answer, however close it is\./);
    cleanup();
  }
});

// ── One printed problem, and only its real parts are markable ──

it('publishes each printed term of a computed fact as its own demonstration target', () => {
  const h = mount('answer_fact');
  expect(h.state().task!.workspace!.objects.map(o => o.id)).toEqual(['problem', 'term-0', 'term-1', 'term-2']);
  expect(h.state().task!.workspace!.objects[2].label).toMatch(/the "\+" sign/);
  expect(h.view.container.querySelectorAll('[data-fact-term]')).toHaveLength(3);
});

it('publishes no term inside a bare numeral, and refuses pointing at one', () => {
  const h = mount('name_numeral');
  expect(h.state().task!.workspace!.objects.map(o => o.id)).toEqual(['problem']);
  expect(h.view.container.querySelectorAll('[data-fact-term]')).toHaveLength(0);
  expect(h.dispatch('demonstrate', { targets: ['term-0'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(0);
});

// ── The completed equation follows the committed answer ──

it('keeps the solved form off the screen and out of the tutor’s scene until an answer is committed', () => {
  const h = mount('answer_fact');
  expect(h.view.container.querySelector('[data-fact-solved]')).toBeNull();
  expect(h.view.container.textContent).not.toContain('2 + 1 = 3');
  // Not a workspace object: a tutor that could see it could say it aloud.
  expect(JSON.stringify(runtimePacket(h.state()))).not.toContain('2 + 1 = 3');
  h.say('three');
  expect(h.view.container.querySelector('[data-fact-solved]')).toBeNull();
  h.feedback('correct'); // Success held on the item, no advance.
  expect(h.view.container.querySelector('[data-fact-solved="3"]')).toBeTruthy();
  expect(h.view.container.textContent).toContain('2 + 1 = 3');
  expect(JSON.stringify(runtimePacket(h.state()))).not.toContain('2 + 1 = 3');
});

it('recaps each answered fact by its solved form, including one that took a correction', async () => {
  // Wrong on the second fact, then right: the recap must still show its solved
  // form, and its score must fall because a correction happened.
  const decisions = [['correct', 'advance'], ['incorrect', 'retry'], ['correct', 'advance']] as const;
  let call = 0;
  const classify = vi.fn(async () => {
    const [verdict, transition] = decisions[call++];
    return { verdict, transition, confidence: .99, verdictConfidence: .99, grounded: 1,
      accepted: true, reason: 'supported', ms: 200 };
  });
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('answer_fact', classify as never);
  for (const [answer, reply] of [['three', 'That is right, three.'], ['nine', 'Not nine — try again.'],
    ['four', 'That is right, four.']] as const) {
    h.say(answer);
    act(() => { h.transport.beginTurn(reply); h.transport.endTurn(true); });
    await act(async () => { h.transport.audioChanged(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  }
  expect(h.state().status).toBe('completed');
  expect(screen.getByText('2 + 1 = 3')).toBeTruthy();
  expect(screen.getByText('3 + 1 = 4')).toBeTruthy();
  const [, accuracy] = seam.submit.mock.calls[0];
  expect(accuracy).toBeLessThan(100);
  h.transport.close();
});

it('runs a blended pin on the workspace and records it under the session challenge type, as the scripted drill did', async () => {
  // The evaluation boundary accepts only a single-mode pin, so a blend keeps the reported
  // mode. Reporting the blend itself would open a new IRT item key; per-mode recording is
  // a separate student-data slice.
  const classify = vi.fn(async () => ({ verdict: 'correct' as const, transition: 'advance' as const, confidence: .99,
    verdictConfidence: .99, grounded: 1, accepted: true, reason: 'supported', ms: 200 }));
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('answer_fact', classify as never, undefined, 'answer_fact|fact_review');
  expect(h.state().task?.itemId).toBeTruthy();
  for (const answer of ['three', 'four']) {
    h.say(answer);
    act(() => { h.transport.beginTurn(`That is right, ${answer}.`); h.transport.endTurn(true); });
    await act(async () => { h.transport.audioChanged(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
  }
  expect(h.state().status).toBe('completed');
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ evalMode: 'answer_fact', challengeType: 'answer_fact' });
  h.transport.close();
});

it('never recaps an answer the child did not produce', () => {
  // The recap's unsolved branch prints the PROBLEM, never the solved form. It is
  // unreachable on this path today — `advance` is offered only after a correct
  // response, so a completed session has every fact solved — and it stays as the
  // guard for the lesson-shell navigation the census still lists as missing.
  // What IS reachable is asserted directly: before any commit, nothing on the
  // stage or in the packet carries a solved form.
  const h = mount('answer_fact');
  for (const solved of ['2 + 1 = 3', '3 + 1 = 4']) {
    expect(h.view.container.textContent).not.toContain(solved);
    expect(JSON.stringify(runtimePacket(h.state()))).not.toContain(solved);
  }
  h.say('nine'); h.feedback('incorrect');
  expect(h.view.container.querySelector('[data-fact-solved]')).toBeNull();
  expect(h.view.container.textContent).not.toContain('2 + 1 = 3');
});

// ── Help and demonstration are not learner work (TW-4, TW-8, TW-9) ──

it('marks the whole problem for a demonstration without answering, and keeps the assistance history', async () => {
  const h = mount();
  h.say('can you help me');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(seam.send).not.toHaveBeenCalled();
  const c = h.command('demonstrate', { targets: ['problem'] });
  let pending: Promise<void>;
  await act(async () => { pending = h.transport.command(c);
    expect(h.view.container.querySelector('[data-fact-object="problem"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); }); await pending!;
  expect(h.sent.filter(m => m.type === 'runtime_result').at(-1).status).toBe('visible');
  expect(h.state().task!.workspace!.demonstration).toEqual(['problem']);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.dispatch('demonstrate', { targets: ['term-0'] });
  expect(h.view.container.querySelector('[data-fact-term="0"]')?.getAttribute('data-tutor-demonstration')).toBe('true');
  h.dispatch('demonstrate', { targets: [] });
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(2); // Clearing a mark does not erase the help.
});

it('refuses an unknown demonstration target without a partial mutation', () => {
  const h = mount();
  expect(h.dispatch('demonstrate', { targets: ['problem', 'term-9'] }).status).not.toBe('committed');
  expect(h.state().task!.workspace!.demonstration).toEqual([]);
  expect(h.state().task!.support.level).toBe(0);
});

it('offers no problem-changing, writing or answering operation to the tutor', () => {
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
  h.say('Look at the first number.', 'assistant');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.say('two'); h.feedback('incorrect');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  h.say('three'); h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.itemId).toBe('a1'); // Success without advancing off the item.
  expect(h.state().task!.workspace!.attempts).toHaveLength(2);
  expect(seam.correct).toHaveBeenCalledOnce();
});

it('refuses a verdict carrying a stale response id, and re-opens on the child’s new words', () => {
  const h = mount();
  h.say('two');
  const stale = h.state().task!.workspace!.pendingResponse!.id;
  h.say('three');
  expect(h.state().task!.workspace!.pendingResponse!.id).not.toBe(stale);
  expect(h.feedback('correct', 'none', stale).status).not.toBe('committed');
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  h.feedback('correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('refuses a duplicate command and a stale retry after the item has moved on', () => {
  const h = mount();
  h.say('three'); h.feedback('correct');
  const old = h.command('retry');
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'a2', evidence: { attemptNumber: 0 }, support: { level: 0 } });
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
  const h = mount('answer_fact', undefined, classifyLearner as never);
  const packet = () => h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  h.transport.publish();
  expect(packet().learner.signals).toMatchObject({ itemId: 'a1', attempts: 0, learnerTurns: 0, helpRequests: 0 });
  act(() => { h.transport.beginTurn('Look at the two.'); h.transport.endTurn(true); h.transport.audioChanged(false); });
  h.transport.publish();
  expect(packet().learner.signals).toMatchObject({ tutorTurns: 1, learnerTurns: 0 });
  await act(async () => { h.transport.learnerText('I do not know', true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  const request = classifyLearner.mock.calls[0][0] as Record<string, unknown>;
  // The learner kind never sees the expected answer: it must not become a
  // second speech grader on a pack whose whole answer is one number word.
  expect(JSON.stringify(request)).not.toContain('three');
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
  const h = mount('answer_fact', classify);
  for (const answer of ['three', 'four']) {
    h.say(answer);
    act(() => { h.transport.beginTurn(`That is right, ${answer}.`); h.transport.endTurn(true); });
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
  expect(metrics).toMatchObject({ type: 'di-math-facts', evalMode: 'answer_fact',
    challengeType: 'answer_fact', totalChallenges: 2, correctCount: 2, attemptsCount: 2, firstTryCount: 2,
    // The workspace does not take the standalone drill's audio-fall timing, and
    // reporting a number this path never measured would make it quietly wrong.
    meanResponseMs: null });
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
  expect(h.view.container.querySelector('[data-fact-object="problem"]')).toBeTruthy();
  expect(h.view.container.textContent).not.toMatch(/Start the lesson|Your turn. What is/);
  expect(JSON.stringify(runtimePacket(h.state()))).not.toMatch(/\[DI_ITEM|\[DI_MOVE_ON|\[DI_COMPLETE/);
});

// ── The registry row: what the route accepts and what the model is told ──

it('advertises exactly the five workspace modes under tutor ownership', () => {
  expect(diMathFactsLive.modes)
    .toEqual(['name_numeral', 'counting_next', 'answer_fact', 'fact_review', 'subtraction_fact']);
  expect(diMathFactsLive.teachingOwner).toBe('tutor');
  expect(diMathFactsLive.canAdvance).toBe(false);
  expect(diMathFactsLive.tutoring).toBeNull();
  expect(diMathFactsLive.copy.lessons.map(([mode]) => mode)).toEqual(diMathFactsLive.modes);
});

it('keeps guidance inside the backend offer cap, with no sentence for the tutor to recite', () => {
  // `live_activity_tools.parse_activity_spec` rejects an offer above 2000
  // characters and closes the socket with `Invalid activity offer`, which does
  // not read as a length problem from the frontend.
  expect(diMathFactsLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(diMathFactsLive.guidance).not.toMatch(/say exactly|Speak exactly|"[A-Z][^"]{12,}"/);
});

it('publishes exactly the domain assignment and scene that the verdict probe replays', () => {
  // `scripts/tutor-verdict-probe.mjs` builds its model input from `workspaceAssignment`
  // and `workspaceScene`. It replays the lesson only while the mounted stage publishes
  // those and nothing else.
  const h = mount('answer_fact');
  const item = buildMathFactItems(CHALLENGES.answer_fact)[0];
  const { task, expectedAnswer, response } = workspaceAssignment(item), scene = workspaceScene(item);
  expect(h.state().task).toMatchObject({ task, demand: { ...scene.facts, response, presentation: 'ready' } });
  expect(h.state().task!.demand).toEqual({ ...scene.facts, response, presentation: 'ready' });
  expect(h.state().task!.workspace).toMatchObject({ objects: scene.objects, expectedAnswer });
});

// ── The pool gates: what cannot be asked is dropped, not repaired ──

it('rejects a desynced answer key, a stimulus carrying its own answer, and an unaskable numeral item', () => {
  const ok = { title: 'Facts', description: 'Say them.', challengeType: 'answer_fact',
    challenges: CHALLENGES.answer_fact } as DiMathFactsData;
  expect(validateDiMathFactsData(ok)).toBe(ok);
  const broken = (challenges: DiMathFactsChallenge[]) => () =>
    validateDiMathFactsData({ ...ok, challenges });
  // The tutor judges the WORD and the evaluation records the NUMERAL.
  expect(broken([{ ...CHALLENGES.answer_fact[0], answerWord: 'four' }])).toThrow();
  expect(broken([{ ...CHALLENGES.answer_fact[0], display: '2 + 1 = 3' }])).toThrow();
  expect(broken([{ ...CHALLENGES.answer_fact[0], display: '3' }])).toThrow();
  expect(broken([{ ...CHALLENGES.name_numeral[0], display: '7 + 0' }])).toThrow();
  expect(broken([{ ...CHALLENGES.answer_fact[0], answerNumeral: 300, answerWord: 'three hundred' }])).toThrow();
  expect(broken([{ ...CHALLENGES.answer_fact[0], challengeType: 'letter_sound' as any }])).toThrow();
});
