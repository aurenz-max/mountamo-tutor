// @vitest-environment jsdom
/**
 * The real VolcanoIsland on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The 3D table (WebGL) is replaced by a stub that records what it is
 * told to draw; the Live context, evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown,
  scene: { a: { marks: 0, erupted: false }, b: { marks: 0, erupted: false }, eruption: null as string | null } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'volcano',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('./VolcanoScene', () => ({
  default: function Stub(p: { a: { marks: number; erupted: boolean }; b: { marks: number; erupted: boolean }; eruption?: string | null }) {
    seam.scene = { a: p.a, b: p.b, eruption: p.eruption ?? null };
    return <div data-volcano-scene="stub" />;
  },
}));
import VolcanoIsland, { type VolcanoIslandData } from './VolcanoIsland';
import { makeKitchen, type VolcanoChallenge } from './volcanoModel';
import { magmaByKey, makeMagma } from './magmaModel';
import { makeLayers } from './layersModel';
import { fewestWalls, pickVillages } from './villageModel';
import { makeRock } from './rockModel';
import { seeded } from './buoyancyModel';

beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); });

function mount(challenges: VolcanoChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const data: VolcanoIslandData = { instanceId: 'volcano', title: 'Kitchen Volcanoes', description: 'Test it.',
    challengeType: 'kitchen_volcano', gradeBand: 'K-2', challenges };
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <VolcanoIsland data={data} runtimePlanItemId="plan-volcano" runtimeEvalMode="kitchen_volcano" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'volcano', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const demand = () => JSON.stringify(state().task!.demand);
  return { state, dispatch, click, demand };
}

it('binds as a gesture build; B starts as A; changing the vinegar too is a named miss; Try again keeps the mixes; a fair test passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([makeKitchen('kitchen-1', { soda: 1, vinegar: 3 }, 'soda', false)]);
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('volcano B');
  expect(screen.getByText('1 spoon of baking soda', { selector: 'span' })).toBeTruthy();
  // No eruption before a guess.
  expect(screen.getByRole('button', { name: 'Erupt volcano A' }).hasAttribute('disabled')).toBe(true);
  h.click('More baking soda');
  h.click('Less vinegar');
  h.click('Guess: volcano B');
  h.click('Erupt volcano A');
  h.click('Erupt volcano B');
  expect(seam.scene).toMatchObject({ a: { marks: 1, erupted: true }, b: { marks: 2, erupted: true } });
  h.click('Higher: volcano B');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/You changed the vinegar too/)).toBeTruthy();
  h.dispatch('retry');
  h.click('More vinegar');
  expect(seam.scene.a.erupted).toBe(false);
  h.click('Guess: volcano B');
  h.click('Erupt volcano A');
  h.click('Erupt volcano B');
  h.click('Higher: volcano B');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('hard: more of what is already enough leaves the foam the same; saying B went higher (the guess) is a named miss', () => {
  const h = mount([makeKitchen('kitchen-1', { soda: 3, vinegar: 1 }, 'soda', true)]);
  expect(screen.queryByRole('button', { name: 'More vinegar' })).toBeNull();
  h.click('More baking soda');
  h.click('Guess: volcano B');
  h.click('Erupt volcano A');
  h.click('Erupt volcano B');
  expect(seam.scene.a.marks).toBe(seam.scene.b.marks);
  h.click('Higher: volcano B');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/That was your guess/)).toBeTruthy();
  h.dispatch('retry');
  h.click('Higher: both the same height');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('runny or sticky: guesses erupt the tests on the island; a call that misses the thickness is a named miss; the right call erupts the new volcano', () => {
  seam.evaluationContext = { lesson: 'test' };
  const k = (x: string) => magmaByKey(x)!;
  const h = mount([makeMagma('magma-1', [k('kilauea'), k('st-helens')], k('pinatubo'), ['flows', 'explodes'])]);
  expect(h.demand()).toContain("Mount Pinatubo's magma (thick and sticky");
  expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  h.click('Guess Kīlauea in Hawaiʻi: lava flows far in rivers');
  expect(seam.scene.eruption).toBe('flows');
  h.click('Guess Mount St. Helens: lava flows far in rivers');
  expect(seam.scene.eruption).toBe('explodes');
  h.click('New volcano: lava flows far in rivers');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Is this one runny or thick/)).toBeTruthy();
  h.dispatch('retry');
  h.click('New volcano: it explodes with an ash cloud');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.eruption).toBe('explodes');
});

it('layers over time: the new layer appears only after the guess and eruption; top-down is a named miss; oldest first passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([makeLayers('layers-1', ['soil', 'lava'], 'ash', false)]);
  expect(screen.queryByRole('button', { name: 'Layer: new grey ash' })).toBeNull();
  h.click('Guess: the bottom');
  h.click('Erupt the volcano');
  expect(seam.scene.eruption).toBe('explodes');
  h.click('Layer: new grey ash'); h.click('Layer: dark lava rock'); h.click('Layer: soil with old roots');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Is the top layer old or new/)).toBeTruthy();
  h.dispatch('retry');
  h.click('Start over');
  h.click('Layer: soil with old roots'); h.click('Layer: dark lava rock'); h.click('Layer: new grey ash');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('save the village: no walls is a named miss; the walls that turn the lava aside pass', () => {
  seam.evaluationContext = { lesson: 'test' };
  const [c] = pickVillages(1, 'medium', seeded(4), 'village');
  const h = mount([c]);
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/Put a wall in its way/)).toBeTruthy();
  h.dispatch('retry');
  for (const w of fewestWalls(c)!) h.click(`Square row ${Math.floor(w / 9) + 1}, column ${(w % 9) + 1}`);
  expect(screen.getByText(`Walls: 2 of ${c.maxWalls}`)).toBeTruthy();
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(seam.scene.eruption).toBe('flows');
});

it('cool the rock: samples cool after a guess; a slow-fast swap is a named miss; the right place passes', () => {
  seam.evaluationContext = { lesson: 'test' };
  const t = [{ cooling: 'underground' as const, gassy: false }, { cooling: 'sea' as const, gassy: false }];
  const h = mount([makeRock('rock-1', t, t[0], ['underground', 'sea'])]);
  expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  h.click('Guess sample 1: big crystals you can see');
  h.click('Guess sample 2: big crystals you can see');
  expect(screen.getByText(/It made obsidian/)).toBeTruthy();
  h.click('Cooled in the sea (very fast)');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/time to grow big crystals/)).toBeTruthy();
  h.dispatch('retry');
  h.click('Cooled deep underground (very slowly)');
  h.click('Check');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});
