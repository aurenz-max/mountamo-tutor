// @vitest-environment jsdom
/**
 * W1 minimal binding: the real BaseTenBlocks on the shared teaching workspace, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The family has two surfaces,
 * chosen by the payload: the judged mat (read_blocks, regroup; runner-era) and the click mat
 * (build_number, operate; plain shape). Both bind under tutor ownership, and neither runner nor
 * legacy cue may run beside the tutor. Only microphone hardware, evaluation writes, sound and the
 * legacy AI-context hook are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(), legacy: vi.fn(),
  evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'blocks',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
// The legacy context hook: records whether it was enabled or sent anything.
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy();
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'blocks' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  // Submitted once `submitResult` has run, as the real hook reports it.
  usePrimitiveEvaluation: () => ({ hasSubmitted: seam.submit.mock.calls.length > 0, submitResult: seam.submit, submittedResult: null, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
import BaseTenBlocks, { type BaseTenBlocksChallenge, type BaseTenBlocksData } from './BaseTenBlocks';
import { itemsFromChallenges } from './baseTenScript';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Mode = 'build_number' | 'read_blocks' | 'regroup' | 'operate';
const challenge = (type: BaseTenBlocksChallenge['type'], targetNumber: number, instruction: string): BaseTenBlocksChallenge =>
  ({ type, targetNumber, instruction, hint: 'Look at each column.' });
const DECKS: Record<Mode, BaseTenBlocksChallenge[]> = {
  build_number: [challenge('build_number', 12, 'Build the number 12 with blocks.')],
  read_blocks: [challenge('read_blocks', 47, 'unused: the pack owns every ask')],
  regroup: [challenge('regroup', 34, 'unused: the pack owns every ask')],
  operate: [challenge('add_with_blocks', 41, 'Add 23 and 18 with blocks.')],
};

function mount(mode: Mode) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data: BaseTenBlocksData = { instanceId: 'blocks', title: 'Blocks', description: 'Place value with blocks.',
    numberValue: DECKS[mode][0].targetNumber, maxPlace: 'hundreds', gradeBand: '2-3', challenges: DECKS[mode] };
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BaseTenBlocks data={data} runtimePlanItemId="plan-blocks" runtimeEvalMode={mode} />
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
    const commandId = crypto.randomUUID(); lastCommand = commandId;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'blocks',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getAllByRole('button', { name })[0]); });
  const settle = () => act(() => { vi.advanceTimersByTime(4000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  const advance = () => { dispatch('advance'); confirmVisible(); };
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, press, settle, say, feedback, advance };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(['build_number', 'read_blocks', 'regroup', 'operate'] as const)(
  '%s binds the workspace under tutor ownership, with no runner cue, legacy context or Next button', mode => {
    const h = mount(mode);
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).not.toMatch(/Say exactly|\[BT_|unused/);
    expect(tutorTools(h)).toEqual(['begin_help']);
    expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[BT_|Say exactly|\[ACTIVITY_START/);
    expect(seam.legacy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /next challenge|say that again/i })).toBeNull();
  });

it('a spoken step publishes the number it asks for; the trade, build and operate keys are never published', () => {
  const read = itemsFromChallenges(DECKS.read_blocks, 'read_blocks');
  let h = mount('read_blocks');
  expect(h.state().task!.task).toBe(read[0].actionContract.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBe('4');
  // The counts are the answers: the scene names the asked size and no count or total.
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/47|\b4\b|forty/);
  cleanup();
  h = mount('regroup');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('14');
  h.say('fourteen'); h.feedback('correct', 'advance');
  expect(h.state().task!.task).toBe('Now make that trade. Tap one ten-stick to break it apart.');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  for (const mode of ['build_number', 'operate'] as const) {
    cleanup();
    expect(mount(mode).state().task!.workspace!.expectedAnswer).toBeUndefined();
  }
});

it('read_blocks: a wrong count is retried, and the worth step is judged against the value, not the count', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('read_blocks');
  h.say('forty'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('4');
  h.say('four'); h.feedback('correct', 'advance');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('40');
  h.say('forty'); h.feedback('correct', 'advance');
  expect(h.state().status).not.toBe('completed');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(screen.getByText(/Nice work with the blocks!/)).toBeTruthy();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 67]);
});

it('regroup: a wrong trade commits on stillness, Try again puts the blocks back, a right trade completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('regroup');
  h.say('fourteen'); h.feedback('correct', 'advance');
  const tenStick = 'Trade one ten-stick for ten ones cubes';
  // Two tens broken: the value is kept, but it is not the one trade asked for.
  h.press(tenStick); h.press(tenStick);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('1 ten-stick, 24 ones cubes');
  // The checked mat is closed: no block offers a trade until Try again.
  expect(screen.queryAllByRole('button', { name: tenStick })).toHaveLength(0);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ matNow: '3 ten-sticks, 4 ones cubes' });
  h.press(tenStick); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.advance();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 67]);
});

it('build_number: Check My Blocks commits, the mat closes until Try again empties it, a standard build completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build_number');
  for (let i = 0; i < 12; i++) h.press('Add one to Ones');
  h.press(/check my blocks/i);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Checked the blocks: 12 ones');
  expect(screen.getByRole('button', { name: 'Add one to Tens' })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerBlocks: 'no blocks' });
  h.press('Add one to Tens'); h.press('Add one to Ones'); h.press('Add one to Ones');
  h.press(/check my blocks/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.advance();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][0]).toBe(true);
});

it('operate: the keypad result is checked by the activity and never published', () => {
  const h = mount('operate');
  h.press('4'); h.press('2'); h.press('✓');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('Typed 42');
  h.dispatch('retry');
  h.press('4'); h.press('1'); h.press('✓');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  // No evaluation provider in the live host: nothing is submitted.
  h.advance();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('read_blocks');
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  const live = LIVE_ADAPTERS['base-ten-blocks'];
  expect([...live.modes].sort()).toEqual((getComponentById('base-ten-blocks')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect([...live.modes].sort()).toEqual(['build_number', 'operate', 'read_blocks', 'regroup']);
  expect(live).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(live.guidance.length).toBeLessThanOrEqual(2000);
  expect(live.guidance).not.toMatch(/say exactly/i);
});
