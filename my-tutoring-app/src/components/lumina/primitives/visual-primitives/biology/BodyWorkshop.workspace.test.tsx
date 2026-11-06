// @vitest-environment jsdom
/**
 * The real BodyWorkshop on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The Live context, evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'body',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import BodyWorkshop, { type BodyWorkshopData } from './BodyWorkshop';
import { assembleBodyWorkshop } from '../../../service/biology/body-workshop-generator';
import { atlasWords } from '../../../service/biology/body-author';
import { atlasAnimal } from './bodyAtlas';
import { seededRng, type BodyGoal, type BodyTask } from './bodyModel';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const session = (goal: BodyGoal, animals: string[], task: BodyTask = 'deliver_oxygen') => assembleBodyWorkshop(
  [{ task, authored: { calls: 0, picks: animals.map(id => ({ words: atlasWords(atlasAnimal(id)!, task, goal), source: 'atlas' as const, errors: [] })) } }],
  goal, 'hard', goal === 'to_muscle' ? 4 : 1, seededRng(1));

function mount(data: BodyWorkshopData) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BodyWorkshop data={{ ...data, instanceId: 'body' }} runtimePlanItemId="plan-body" runtimeEvalMode="deliver_oxygen" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'body', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action as NonNullable<typeof a>['action'] }); });
  };
  const click = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const add = (...parts: string[]) => parts.forEach(p => click(`Add ${p}`));
  const breathe = () => { click('Breathe'); act(() => { vi.advanceTimersByTime(10000); }); };
  const demand = () => JSON.stringify(state().task!.demand);
  return { state, dispatch, click, add, breathe, demand };
}

it('binds as a gesture with no key; the scene names the animal and habitat but not its medium or path', () => {
  const h = mount(session('into_body', ['whale']));
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('whale');
  expect(h.demand()).toContain('in the sea');
  expect(h.demand()).not.toMatch(/breathes air|blowhole → windpipe/);
  expect(screen.getByRole('button', { name: "I'm done!" }).hasAttribute('disabled')).toBe(true);
  h.add('mouth', 'gills');
  h.breathe();
  expect(screen.getByText(/Gills need water flowing over them, but air came in/)).toBeTruthy();
  expect(h.demand()).toContain('try 1: mouth → gills');
});

it('a wrong path commits its miss; Try again keeps the row; the real path completes and shows how it works', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(session('into_body', ['human']));
  h.add('nose', 'lungs');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/A part is missing from the path/)).toBeTruthy();
  h.dispatch('retry');
  expect(screen.getByRole('button', { name: 'Take out lungs' })).toBeTruthy();
  h.click('Take out lungs');
  h.add('windpipe', 'lungs');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(screen.getByText(/goes down the windpipe/)).toBeTruthy();
});

it('grades 4-5 need the heart: lungs alone stop short of the muscle', () => {
  const h = mount(session('to_muscle', ['dog']));
  h.add('nose', 'windpipe', 'lungs');
  h.breathe();
  expect(screen.getByText(/nothing moves that blood to the leg muscle/)).toBeTruthy();
  h.add('heart', 'blood tubes');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a path that works but is not this animal\'s says so', () => {
  const h = mount(session('into_body', ['grasshopper']));
  h.add('nose', 'windpipe', 'lungs');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/It works, but not for a real grasshopper/)).toBeTruthy();
});

it('fuel_the_body: the row starts at the food, Eat sends it along, a cow needs its four-part stomach', () => {
  const h = mount(session('into_body', ['cow'], 'fuel_the_body'));
  expect(h.demand()).toContain("the cow's food (grass)");
  h.add('mouth', 'intestines');
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Eat' })); vi.advanceTimersByTime(10000); });
  expect(screen.getByText(/still in big pieces/)).toBeTruthy();
  h.click('Take out intestines');
  h.add('stomach', 'intestines');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(screen.getByText(/It works, but not for a real cow/)).toBeTruthy();
  h.dispatch('retry');
  h.click('Take out stomach');
  h.click('Take out intestines');
  h.add('four-part stomach', 'intestines');
  h.click("I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});
