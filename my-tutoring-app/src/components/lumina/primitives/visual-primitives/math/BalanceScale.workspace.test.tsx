// @vitest-environment jsdom
/**
 * The real BalanceScale family (all three surfaces the default export routes to) on the shared
 * teaching workspace, its only teaching path, with the real TeachingSession, LiveLessonRuntime,
 * transport and rendering shell. Only the Live context, microphone hardware, evaluation writes and
 * sound are substituted. An unbound mount renders the "needs the tutor" card on every route, never
 * a scripted fallback.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'scale',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import BalanceScale, { type BalanceScaleChallenge, type BalanceScaleData } from './BalanceScale';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';
/** The submission waits for the scoring pass (a fetch that rejects in jsdom, so every spoken attempt keeps its flow verdict). */
const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const balanceLive = LIVE_ADAPTERS['balance-scale'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const x = (parcels = 1) => ({ value: parcels, isVariable: true });
const ch = (type: BalanceScaleChallenge['type'], leftSide: any[], rightSide: any[], variableValue: number): BalanceScaleChallenge =>
  ({ type, leftSide, rightSide, variableValue, instruction: `Solve ${type}.`, hint: 'Keep it balanced.' });
/** One valid challenge per catalog mode, each satisfying its surface's own builder. */
const CHALLENGE: Record<string, BalanceScaleChallenge> = {
  equality: ch('equality', [x()], [{ value: 5 }], 5),
  equality_hard: ch('equality_hard', [x()], [{ value: 4 }], 4),
  one_step: ch('one_step', [x(), { value: 3 }], [{ value: 8 }], 5),
  one_step_hard: ch('one_step_hard', [x(2)], [{ value: 6 }], 3),
  two_step_intro: ch('two_step_intro', [x(2), { value: 1 }], [{ value: 7 }], 3),
  two_step: ch('two_step', [x(2), { value: 1 }], [{ value: 7 }], 3),
};

function mount(evalMode: string, challenges: BalanceScaleChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'scale', title: 'Balance', description: 'Balance it.', gradeBand: 'K-2', leftSide: [], rightSide: [],
    variableValue: 0, challenges } as BalanceScaleData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BalanceScale data={data} runtimePlanItemId="plan-scale" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'scale',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const settle = () => act(() => { vi.advanceTimersByTime(2000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  /** Advance a solved item and show its receipt, as the shell does. */
  const next = () => { dispatch('advance'); confirmVisible(); };
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, press, settle, say, feedback, next };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(Object.keys(CHALLENGE))('%s binds the workspace under tutor ownership; its hands key is never published', mode => {
  const h = mount(mode, [CHALLENGE[mode]]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).not.toMatch(/Say exactly|\[B[EW]_/);
  expect(tutorTools(h)).toEqual(['begin_help']);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  // The scene names what is drawn; the weight being found is never one of its facts.
  expect(String(h.state().task!.demand!.scale)).not.toMatch(new RegExp(`(weighs|weight|target|x =) ${CHALLENGE[mode].variableValue}\\b`));
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[B[EW]_|Say exactly|ACTIVITY_START|STEP_TAKEN|ANSWER_/);
  expect(screen.queryByRole('button', { name: /Next Equation|Show Answer|Say that again/ })).toBeNull();
});

it('equality: exploration never commits, a balanced load does, and the spoken steps publish their key', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('equality', [CHALLENGE.equality]);
  h.press('Add 3 weight'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.press('Add 2 weight'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.send.mock.calls.at(-1)![1]).toMatchObject({ author: 'host' });
  h.next();
  expect(h.state().task!.itemId).toBe('balance-1-total');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('5');
  h.say('six'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.phase).toBe('working');
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('balance-1-infer');
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ evalMode: 'equality', totalChallenges: 1, correctCount: 1 });
});

it('one_step (workshop): the completed load commits, then the added weight is spoken', () => {
  const h = mount('one_step', [CHALLENGE.one_step]);
  h.press('Add 5 weight'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.itemId).toBe('workshop-1-added');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('5');
  expect(screen.queryByText('Say that again')).toBeNull();
});

it('two_step (workshop): separate and share commit through the real controls; the explanation is spoken', () => {
  const h = mount('two_step', [CHALLENGE.two_step]);
  h.press('Set aside known 1 weight'); h.press('Unit 1'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.workspace!.expectedAnswer).toBe('6');
  h.say('six'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('workshop-1-share');
  h.press('Place unit in group 1'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  for (let i = 0; i < 2; i++) h.press('Place unit in group 1');
  for (let i = 0; i < 3; i++) h.press('Place unit in group 2');
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  for (const said of ['three', 'three']) { h.say(said); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().task!.itemId).toBe('workshop-1-explain');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/one equal group per parcel/);
});

it('the plain solver (mixed session): a wrong typed x is checked, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('mixed', [ch('one_step', [x(), { value: 3 }], [{ value: 5 }, { value: 3 }], 5), CHALLENGE.equality]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.itemId).toBe('bs-1');
  expect(screen.queryByText(/Show Answer/)).toBeNull();
  h.press('Start Solving');
  act(() => { fireEvent.click(screen.getAllByTitle('Click to remove 3 from both sides')[0]); });
  const typed = () => screen.getByRole('spinbutton', { name: 'Value of x' }) as HTMLInputElement;
  act(() => { fireEvent.change(typed(), { target: { value: '4' } }); });
  h.press(/^check$/i);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(typed().disabled).toBe(true);
  h.dispatch('retry');
  expect(typed().value).toBe('');
  act(() => { fireEvent.change(typed(), { target: { value: '5' } }); });
  h.press(/^check$/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.queryByRole('button', { name: /Next Equation/ })).toBeNull();
  h.next();
  expect(h.state().task!.itemId).toBe('bs-2');
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('equality', [CHALLENGE.equality]);
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ itemId: 'balance-1-build', attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  expect([...balanceLive.modes].sort()).toEqual((getComponentById('balance-scale')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect(balanceLive).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(balanceLive.guidance.length).toBeLessThanOrEqual(2000);
  expect(balanceLive.guidance).not.toMatch(/say exactly/i);
});

// ── Unbound mounts ──────────────────────────────────────────────────────────

it.each([['equality', CHALLENGE.equality], ['workshop', CHALLENGE.one_step], ['plain', null]] as const)(
  'the %s route, unbound (no runtime, or a pin outside the catalog), renders the needs-the-tutor card', (_route, challenge) => {
    const challenges = challenge ? [challenge] : [CHALLENGE.one_step, CHALLENGE.equality];
    const data = { instanceId: 'scale', title: 'Our scale', description: '', leftSide: [], rightSide: [], variableValue: 0, challenges } as BalanceScaleData;
    const { container } = render(<BalanceScale data={data} runtimeEvalMode={challenge?.type ?? 'mixed'} />);
    expect(container.querySelector('[data-workspace-unbound="balance-scale"]')).not.toBeNull();
    expect(screen.getByText('Our scale')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add \d weight|Start Solving|Check/ })).toBeNull();
    cleanup();
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const off = render(<LiveRuntimeContext.Provider value={runtime}><BalanceScale data={data} runtimeEvalMode="not_a_mode" /></LiveRuntimeContext.Provider>);
    expect(off.container.querySelector('[data-workspace-unbound="balance-scale"]')).not.toBeNull();
  });

// ── Match and add (`equality`): the scale's own behaviour ───────────────────

const pan = (side: string) => within(screen.getByRole('region', { name: `${side} pan` }));
const eq = (target: number) => ch('equality', [x()], [{ value: target }], target);
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it('equality: the left block is drawn to scale with its number hidden; the right pan starts empty', () => {
  mount('equality', [eq(5)]);
  expect(screen.getByLabelText('Left weight; number hidden').style.height).toBe('40px');
  expect(pan('right').getByText('Place weights here')).toBeTruthy();
  expect(screen.queryByRole('spinbutton')).toBeNull();
});

it('equality: only a settled exact match commits, once; a transient match and an overshoot do not', () => {
  const h = mount('equality', [eq(5)]);
  h.press('Add 3 weight'); h.press('Add 2 weight'); wait(400);
  h.press('Add 1 weight'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(screen.getByText('Right side is heavier')).toBeTruthy();
  h.press('Remove 1 weight, block 2'); wait(900);
  expect(h.state().task!.evidence).toMatchObject({ correctness: 'correct', attemptNumber: 1 });
  h.settle(); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(1);
});

it('equality: undo and clear cancel a pending match', () => {
  const h = mount('equality', [eq(5)]);
  h.press('Add 5 weight'); h.press('Undo'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(pan('right').getByText('Place weights here')).toBeTruthy();
  h.press('Add 3 weight'); h.press('Clear weights');
  expect(pan('right').queryByRole('button')).toBeNull();
});

it('equality: the chosen blocks are gathered into an addition with no total, then the next problem starts clean', () => {
  const h = mount('equality', [eq(5), eq(4)]);
  h.press('Add 3 weight'); h.press('Add 2 weight'); wait(900);
  h.next();
  const row = () => within(screen.getByRole('region', { name: 'Add your right-side weights' }));
  expect(row().getByText('3')).toBeTruthy();
  expect(row().getByText('2')).toBeTruthy();
  expect(row().queryByText('5')).toBeNull();
  expect(pan('right').queryByRole('button')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add 1 weight' })).toBeNull();
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('balance-1-infer');
  expect(row().getByText('5')).toBeTruthy();
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('balance-2-build');
  expect(pan('right').getByText('Place weights here')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Add your right-side weights' })).toBeNull();
});

// The workspace never leaves a spoken item unsolved (Next is offered only after a success), so a
// weak sum shows as corrections, not as a failed item.
it('equality: a twice-corrected sum is kept apart from a first-try inference in the submitted record', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('equality', [eq(5)]);
  h.press('Add 5 weight'); wait(900); h.next();
  for (const wrong of ['six', 'seven']) { h.say(wrong); h.feedback('incorrect', 'retry'); }
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('balance-1-infer');
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, score, metrics, work] = seam.submit.mock.calls[0];
  expect(passed).toBe(false); expect(score).toBe(33);
  expect(metrics).toMatchObject({ correctCount: 1, firstTryCount: 0 });
  expect(work.explorationIsUngraded).toBe(true);
  expect(work.results[0].inference).toMatchObject({ solved: true, score: 100 });
  expect(work.results[0].total).toMatchObject({ solved: true, score: 33, corrections: 2 });
});

it('equality: without an evaluation provider (the live host) nothing is submitted', () => {
  const h = mount('equality', [eq(5)]);
  h.press('Add 5 weight'); wait(900); h.next();
  for (let i = 0; i < 2; i++) { h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});

// ── Weight workshop (the other five modes): the scale's own behaviour ───────

const shop = (type: BalanceScaleChallenge['type'], target: number, known: number, parcels: number) =>
  ch(type, [...Array.from({ length: parcels }, () => x()), ...(known ? [{ value: known }] : [])], [{ value: target * parcels + known }], target);
const group = (n: number) => within(screen.getByRole('region', { name: `Parcel group ${n}` }));

it('workshop share: uneven groups stay exploration, units can go back, and only equal groups commit', () => {
  const h = mount('one_step_hard', [shop('one_step_hard', 2, 0, 2), shop('one_step_hard', 2, 0, 2)]);
  expect(screen.queryByRole('spinbutton')).toBeNull();
  const add = (n: number) => h.press(`Place unit in group ${n}`);
  add(1); add(1); add(1); add(2); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  expect(group(1).getAllByRole('button', { name: /^Unit/ })).toHaveLength(3);
  h.press('Unit 3'); add(2); wait(900);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.itemId).toBe('workshop-1-each');
  expect((screen.getByRole('button', { name: 'Unit 1' }) as HTMLButtonElement).disabled).toBe(true);
});

it('workshop share: a selected or dragged unit lands in its group; a forged drop value is ignored', () => {
  mount('one_step_hard', [shop('one_step_hard', 2, 0, 2)]);
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Unit 4' })); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Place unit in group 2' })); });
  expect(group(2).getByRole('button', { name: 'Unit 4' })).toBeTruthy();
  act(() => { fireEvent.drop(screen.getByRole('region', { name: 'Parcel group 1' }), { dataTransfer: { getData: () => '0' } }); });
  expect(group(1).getByRole('button', { name: 'Unit 1' })).toBeTruthy();
  act(() => { fireEvent.drop(screen.getByRole('region', { name: 'Parcel group 1' }), { dataTransfer: { getData: () => '900' } }); });
  expect(group(1).getAllByRole('button', { name: /^Unit/ })).toHaveLength(1);
});

it('workshop separate: the known weight moves on its own, balance returns, and set-aside units stay out of sharing', () => {
  const h = mount('two_step_intro', [shop('two_step_intro', 2, 1, 2)]);
  h.press('Set aside known 1 weight');
  expect(screen.getByText('Right side is heavier')).toBeTruthy();
  h.press('Unit 1'); wait(900);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(screen.getByRole('button', { name: 'Unit 1, set aside' })).toBeTruthy();
  h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('workshop-1-share');
  expect((screen.getByRole('button', { name: 'Unit 1, set aside' }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(screen.getByRole('region', { name: 'Unshared weight units' })).getAllByRole('button')).toHaveLength(4);
});

it('workshop: undo and reset cancel a pending completed load', () => {
  const h = mount('one_step', [shop('one_step', 2, 5, 1)]);
  h.press('Add 2 weight'); h.press('Undo'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.press('Add 2 weight'); h.press('Reset this step'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
});

it('workshop one_step: the added weights are gathered apart from the known load', () => {
  const h = mount('one_step', [shop('one_step', 7, 5, 1)]);
  h.press('Add 5 weight'); h.press('Add 2 weight'); wait(900);
  h.next();
  const row = within(screen.getByRole('region', { name: 'Chosen weights addition' }));
  expect(row.getByText('5')).toBeTruthy(); expect(row.getByText('2')).toBeTruthy(); expect(row.queryByText('7')).toBeNull();
  expect(pan('left').getByLabelText('Known left weight 5')).toBeTruthy();
});

it('workshop equality_hard: the first combination is kept, and a reordered copy does not count as another', () => {
  const h = mount('equality_hard', [shop('equality_hard', 5, 0, 1)]);
  h.press('Add 3 weight'); h.press('Add 2 weight'); wait(900);
  h.next();
  h.say('five'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('workshop-1-recompose');
  expect(screen.getByText('3 + 2')).toBeTruthy();
  h.press('Add 2 weight'); h.press('Add 3 weight'); h.settle();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.press('Reset this step'); h.press('Add 5 weight'); wait(900);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('workshop two_step: equation lines follow the actions, and x is withheld until its own turn', () => {
  const h = mount('two_step', [shop('two_step', 2, 1, 2)]);
  const notebook = () => within(screen.getByLabelText('Equation notebook'));
  expect(notebook().getByText('2x + 1 = 5')).toBeTruthy();
  expect(notebook().queryByText('2x = 4')).toBeNull();
  h.press('Set aside known 1 weight'); h.press('Unit 1');
  expect(notebook().getByText('2x = 4')).toBeTruthy();
  wait(900); h.next();
  h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
  for (const n of [1, 1, 2, 2]) h.press(`Place unit in group ${n}`);
  expect(notebook().getByText('x = one group')).toBeTruthy();
  expect(notebook().queryByText('x = 2')).toBeNull();
  wait(900); h.next();
  expect(h.state().task!.itemId).toBe('workshop-1-each');
  expect(notebook().queryByText('x = 2')).toBeNull();
  h.say('two'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('workshop-1-infer');
  expect(notebook().getByText('x = 2')).toBeTruthy();
});

it('workshop two_step: the score is the weakest spoken number; a corrected explanation does not lower it', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('two_step', [shop('two_step', 2, 1, 2)]);
  const step = (o: { step: string }[], name: string) => o.find(x => x.step === name) as Record<string, unknown>;
  h.press('Set aside known 1 weight'); h.press('Unit 1'); wait(900); h.next();
  h.say('five'); h.feedback('incorrect', 'retry');
  h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('workshop-1-share');
  for (const n of [1, 1, 2, 2]) h.press(`Place unit in group ${n}`);
  wait(900); h.next();
  for (const said of ['two', 'two']) { h.say(said); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().task!.itemId).toBe('workshop-1-explain');
  for (const wrong of ['Because it is two.', 'I do not know.']) { h.say(wrong); h.feedback('incorrect', 'retry'); }
  h.say('Each parcel gets one equal group, so one group is x.'); h.feedback('correct', 'advance'); h.confirmVisible();
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, score, metrics, work] = seam.submit.mock.calls[0];
  expect(passed).toBe(true); expect(score).toBe(67); expect(metrics.evalMode).toBe('two_step');
  expect(work.explanationIsCoaching).toBe(true);
  expect(step(work.results[0].outcomes, 'remaining')).toMatchObject({ solved: true, score: 67 });
  expect(step(work.results[0].outcomes, 'explain')).toMatchObject({ solved: true, score: 33 });
});
