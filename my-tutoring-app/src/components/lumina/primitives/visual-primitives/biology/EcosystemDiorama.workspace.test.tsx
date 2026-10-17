// @vitest-environment jsdom
/**
 * The real EcosystemDiorama on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The 3D tank (WebGL) is replaced by buttons for
 * the two things on test and one that moves the sun to a day position; the Live context, evaluation writes and
 * sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  scene: { sunP: 0, guess: null as string | null, picked: null as string | null, fills: { left: 0, right: 0 }, testKey: '' } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'tank',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./EcosystemScene', () => ({
  default: function Stub(p: { onTap: (s: string) => void; onSun: (p: number) => void; disabled: boolean; sunP: number;
    guess: string | null; picked: string | null; fills: { left: number; right: number }; testKey: string; sunActive: boolean }) {
    seam.scene = { sunP: p.sunP, guess: p.guess, picked: p.picked, fills: p.fills, testKey: p.testKey };
    return <div data-ecosystem-scene="stub">
      {['left', 'right'].map(s => <button key={s} type="button" onClick={() => { if (!p.disabled) p.onTap(s); }}>{`thing-${s}`}</button>)}
      <button type="button" onClick={() => { if (p.sunActive) p.onSun(0.5); }}>sun-midday</button>
      <button type="button" onClick={() => { if (p.sunActive) p.onSun(1); }}>sun-end</button>
    </div>;
  },
}));
import EcosystemDiorama, { type EcosystemDioramaData } from './EcosystemDiorama';
import { SUN_TEST_PAIRS, buildSunTest } from './ecosystemModel';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; });
afterEach(cleanup);

const pair = (key: string) => SUN_TEST_PAIRS.find(p => p.key === key)!;
// paper-colour unflipped: the black paper (warmer) on the left. sand-place flipped: the shade hut sand on the left.
const tests = () => [buildSunTest(pair('paper-colour'), false, 'eco-1'), buildSunTest(pair('sand-place'), true, 'eco-2')];

function mount() {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: EcosystemDioramaData = { instanceId: 'tank', title: 'The Sun Test', description: 'Test it.',
    challengeType: 'sun_test', gradeBand: 'K-2', islandName: 'Turtle Island', challenges: tests() };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <EcosystemDiorama data={data} runtimePlanItemId="plan-tank" runtimeEvalMode="sun_test" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'tank', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const click = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const tap = (s: 'left' | 'right') => click(`thing-${s}`);
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const demand = () => JSON.stringify(state().task!.demand);
  return { state, dispatch, tap, click, next, demand };
}

it('binds under tutor ownership as a gesture item; the key never reaches the tutor', () => {
  const h = mount();
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain('The black paper and the white paper');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.demand()).not.toMatch(/"warmer"|got warmer:|is warmer/);
  expect(h.demand()).toContain('both red lines sit at the bottom');
});

it('a tap before the sun moves is the guess; the sun moves only after a guess; a tap mid-day is not a reading', () => {
  const h = mount();
  h.click('sun-midday');
  expect(seam.scene.sunP).toBe(0);
  h.tap('right');
  expect(seam.scene.guess).toBe('right');
  h.tap('left'); // the guess can change until the sun moves
  expect(seam.scene.guess).toBe('left');
  h.click('sun-midday');
  expect(seam.scene.sunP).toBe(0.5);
  expect(seam.scene.fills.left).toBeGreaterThan(seam.scene.fills.right);
  h.tap('right');
  expect(seam.scene.guess).toBe('left');
  expect(h.state().task!.evidence.correctness).not.toBe('incorrect');
  expect(screen.getByText(/Keep the sun moving until the day is over/)).toBeTruthy();
  expect(h.demand()).toMatch(/red line by the black paper: up to mark \d of 5/);
});

it('reading the cooler one is a named miss; Try again keeps the day; reading the warmer one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  h.tap('right'); // guess the white paper
  h.click('sun-end');
  expect(screen.getByText(/The day is over/)).toBeTruthy();
  h.tap('right');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Look at the two thermometers again/)).toBeTruthy();
  // Input stays closed until the runtime reopens the item.
  h.tap('left');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry');
  expect(seam.scene.sunP).toBe(1);
  expect(seam.scene.guess).toBe('right');
  h.tap('left');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/Yes! The red line by the black paper went up higher\..*Your guess was different/)).toBeTruthy();
  h.tap('right'); // closed after a correct reading
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.next();
  expect(h.state().task!.itemId).toBe('eco-2');
  expect(seam.scene.sunP).toBe(0);
  expect(seam.scene.guess).toBeNull();
  expect(h.state().task!.task).toContain('The sand in the shade hut');
  // Second test: the sand in the sun (right) gets warmer.
  h.tap('right');
  h.click('sun-end');
  h.tap('right');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('unbound (no runtime) renders the needs-the-tutor card, never the tank', () => {
  const data: EcosystemDioramaData = { instanceId: 'tank', title: 'Tank', description: '', challengeType: 'sun_test',
    gradeBand: 'K-2', islandName: 'Turtle Island', challenges: tests() };
  const { container } = render(<EcosystemDiorama data={data} runtimeEvalMode="sun_test" />);
  expect(container.querySelector('[data-workspace-unbound="ecosystem-diorama"]')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'thing-left' })).toBeNull();
});
