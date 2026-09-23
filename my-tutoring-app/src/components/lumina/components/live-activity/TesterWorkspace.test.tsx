// @vitest-environment jsdom
/**
 * A tester preview of a workspace-bound family renders what a lesson renders: the registry
 * component on the teaching workspace with its own Live lesson session, never the retired scripted
 * runner. Real host, runtime, observer wiring and BarModel; the Live socket and sound are substituted.
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveRuntimeContext } from './runtime/LiveRuntimeContext';

const seam = vi.hoisted(() => ({ runtime: null as any, runner: vi.fn(), mount: vi.fn(),
  ai: { connectLesson: vi.fn(async () => {}), disconnect: vi.fn(), sendActivityMessage: vi.fn(), sendText: vi.fn(),
    switchPrimitive: vi.fn(), isConnected: true, isListening: true, isAudioPlaying: false, activePrimitiveId: '',
    sessionMode: 'lesson', sessionResumeCount: 0, startListening: vi.fn(), stopListening: vi.fn(), conversation: [] as any[],
    sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} } } }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => seam.ai,
  LuminaAIProvider: ({ children, liveLessonRuntime }: any) => {
    if (liveLessonRuntime) seam.runtime = liveLessonRuntime;
    return <LiveRuntimeContext.Provider value={liveLessonRuntime ?? null}>{children}</LiveRuntimeContext.Provider>;
  } }));
vi.mock('../../hooks/useJudgedScriptRunner', () => ({ useJudgedScriptRunner: () => { seam.runner(); return { hearStimulus: vi.fn() }; } }));
vi.mock('../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true, isAudioPlaying: false, activePrimitiveId: '' }) }));
vi.mock('../JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../CuratorCompanion', () => ({ CuratorCompanion: () => <div data-testid="tutor-face" /> }));
vi.mock('../PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
vi.mock('../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: vi.fn(), elapsedMs: 0 }) }));
vi.mock('../../config/primitiveRegistry', async () => {
  const BarModel = (await import('../../primitives/visual-primitives/math/BarModel')).default;
  const recording = (props: any) => { seam.mount(props); return <BarModel {...props} />; };
  return { getPrimitive: (id: string) => (id === 'bar-model' ? { component: recording } : undefined) };
});
import { TesterWorkspace } from './TesterWorkspace';

beforeEach(() => { vi.clearAllMocks(); seam.runtime = null; });
afterEach(cleanup);

const ROWS = [{ label: 'Apples', value: 2, emoji: '🍎' }, { label: 'Crackers', value: 8, emoji: '🍘' }, { label: 'Bananas', value: 5, emoji: '🍌' }];
const graph = { title: 'Tell Me About Our Graph', description: 'Each picture stands for one choice.', challenges: [{
  id: 'g1', evalMode: 'say_what_it_shows', prompt: 'Tell me one thing this graph shows: compare two groups, in your own words.',
  values: ROWS, graphStyle: 'picture', scale: { step: 1, max: 10, iconValue: 1 }, showBarValues: false }] };

const mount = (evalMode: string | null, primitiveId = 'bar-model') => render(
  <TesterWorkspace primitiveId={primitiveId} instanceId="math-helper-bar-model-1" evalMode={evalMode} data={graph}
    topic="Picture graphs" gradeLevel="kindergarten">
    <div>scripted tester render</div>
  </TesterWorkspace>);

it.each(['say_what_it_shows', null])('a bound family (pin %s) mounts on the workspace with its own lesson session, never the runner', evalMode => {
  mount(evalMode);
  expect(screen.queryByText('scripted tester render')).toBeNull();
  expect(seam.ai.connectLesson).toHaveBeenCalledTimes(1);
  expect(seam.runner).not.toHaveBeenCalled();
  expect(seam.mount).toHaveBeenCalledWith(expect.objectContaining({
    runtimeEvalMode: evalMode ?? 'mixed', runtimePlanItemId: 'math-helper-bar-model-1' }));
  const task = seam.runtime.getSnapshot().task;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace.expectedAnswer).toMatch(/true comparison/);
});

it('a family the catalog does not bind keeps the tester render and opens no session', () => {
  mount('say_what_it_shows', 'hundreds-chart');
  expect(screen.getByText('scripted tester render')).toBeTruthy();
  expect(seam.ai.connectLesson).not.toHaveBeenCalled();
});
