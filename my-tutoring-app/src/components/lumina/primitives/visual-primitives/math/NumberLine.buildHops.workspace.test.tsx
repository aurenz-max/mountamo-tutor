// @vitest-environment jsdom
/**
 * build_hops (open build) on the shared teaching workspace: the real NumberLine, TeachingSession and
 * LiveLessonRuntime. The line opens with only the start; the learner picks hops, presses "I'm done!", a miss keeps
 * the build through Try again, a right first way is kept and the line clears for a different second way, and only
 * the second right way is credited. Levers start bare; the scene publishes the made quantity as numbers.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { svgPicture } from '../../build-layer/buildLayer';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'line',
  conversation: [], sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true, isAudioPlaying: false, activePrimitiveId: 'line' }) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn(), elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
// The watcher's picture needs a canvas; the live line is checked by its own suite.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: () => '', svgPicture: vi.fn() }));
import NumberLine, { type NumberLineData } from './NumberLine';

beforeEach(() => { vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const build = (id: string, target: number, hopCount = 2) => ({ id, type: 'build_hops' as const,
  instruction: `Start at 0 and land on ${target} in ${hopCount === 2 ? 'two' : 'three'} hops.`, hint: 'Pick a hop.',
  targetValues: [target], startValue: 0, hopCount });

function mount(challenges = [build('b0', 12), build('b1', 9)]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'jump',
    challenges, instanceId: 'line' } as NumberLineData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberLine data={data} runtimePlanItemId="plan-line" runtimeEvalMode="build_hops" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const offered = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && (a.action as { operation: string }).operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offered(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'line',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const hop = (...sizes: number[]) => sizes.forEach(n => press(`Hop ${n}`));
  const done = () => press(/i'm done/i);
  const arcLabels = () => Array.from(view.container.querySelectorAll('[data-build-hop] > g > text')).map(t => t.textContent);
  const demand = () => state().task!.demand as Record<string, unknown>;
  const levers = () => state().task!.workspace!.levers ?? [];
  return { runtime, state, dispatch, offered, press, hop, done, arcLabels, demand, levers, view };
}

it('opens on an empty line with the start only, no Check, no landing labels, and bare levers', () => {
  const h = mount();
  expect(h.arcLabels()).toEqual([]);
  expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
  expect(screen.getByRole('button', { name: /i'm done/i })).toHaveProperty('disabled', true);
  expect(h.demand()).toMatchObject({ kind: 'build_hops', startsAt: 0, hopsAsked: 2, hopsMade: 0, landedAt: 0, way: 'first' });
  expect(h.levers().map(l => [l.id, l.pulled])).toEqual([['ways_model', false], ['simpler_jump', false]]);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
});

it('one over is a miss, Try again keeps the build, taking a hop off and a new hop passes the first way', () => {
  const h = mount();
  h.hop(5, 8);
  expect(h.arcLabels()).toEqual(['+5', '+8']);
  // The asked hops are on: every hop button is off.
  expect(screen.getByRole('button', { name: 'Hop 1' })).toHaveProperty('disabled', true);
  expect(h.demand()).toMatchObject({ hopsMade: 2, landedAt: 13 });
  h.done();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false });
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'b0', correct: false, miss: 'one_past' });
  expect(screen.getByText(/do not land on 12 yet/i)).toBeTruthy();
  // The verdict never says where the hops landed.
  expect(h.view.container.textContent).not.toMatch(/\b13\b/);

  h.dispatch('retry');
  expect(h.arcLabels()).toEqual(['+5', '+8']);
  expect(screen.getByText(/do not land on 12 yet/i)).toBeTruthy();
  // Tap the last landing to take that hop off, then a different hop.
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Take off hop 2' })); });
  expect(h.arcLabels()).toEqual(['+5']);
  h.hop(7);
  h.done();
  // A right first way is not a commit: it is kept, the line clears, the second way begins.
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  expect(screen.getByText(/now land on 12 a different way/i)).toBeTruthy();
  expect(h.view.container.querySelector('[data-first-way]')?.textContent).toMatch(/hop 5.*hop 7/);
  expect(h.arcLabels()).toEqual([]);
  expect(h.demand()).toMatchObject({ way: 'second', firstWay: 'hops of 5, 7, checked right', landedAt: 0 });
});

it('the same hops again are a miss on the second way; the ways lever answers it; a different way is credited', () => {
  const h = mount();
  h.hop(5, 7); h.done();
  h.hop(7, 5); h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'same_way_again' });
  expect(h.levers().map(l => l.id)).toEqual(['numbered_hops', 'ways_model', 'simpler_jump']);
  expect(h.dispatch('pull_lever', { lever: 'ways_model' }).status).toBe('committed');
  const model = h.view.container.querySelector('[data-lever="ways-model"]')?.textContent ?? '';
  expect(model).toMatch(/Two ways to land on 5/);
  expect(model).not.toMatch(/\b12\b/);
  h.dispatch('retry');
  h.press('Start over');
  expect(h.arcLabels()).toEqual([]);
  h.hop(6, 6); h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'b0', correct: true, levers: ['ways_model'] });
  expect(screen.getByText('Two ways to land on 12: 5 + 7 and 6 + 6!')).toBeTruthy();
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('b1');
  expect(h.arcLabels()).toEqual([]);
  expect(h.view.container.querySelector('[data-first-way]')).toBeNull();
});

it('numbered hops number the learner\'s own hops as an aid kept out of the picture', () => {
  const h = mount();
  h.hop(5, 6); h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ miss: 'one_short' });
  expect(h.dispatch('pull_lever', { lever: 'numbered_hops' }).status).toBe('committed');
  const numbered = h.view.container.querySelectorAll('[data-lever="learner-hops"]');
  expect(numbered).toHaveLength(2);
  numbered.forEach(g => expect(g.hasAttribute('data-aid')).toBe(true));
  expect(Array.from(numbered[1].querySelectorAll('text')).map(t => t.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
  expect(h.demand().onScreen).toMatch(/Numbered hops/);
  expect(svgPicture).not.toHaveBeenCalled();
});

it('the simplify lever opens an ungraded smaller build that returns to the full item', () => {
  const h = mount();
  const receipt = h.dispatch('pull_lever', { lever: 'simpler_jump' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'b0~simpler', task: 'Start at 0 and land on 6 in two hops.' });
  h.hop(3, 3); h.done();
  h.hop(4, 2); h.done();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'b0', task: 'Start at 0 and land on 12 in two hops.' });
  expect(h.arcLabels()).toEqual([]);
});

it('three hops at the hard tier: two hops that land are the wrong hop count', () => {
  const h = mount([build('b0', 9, 3)]);
  h.hop(4, 5); h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ miss: 'other_hop_count' });
  expect(screen.getByText(/make it in three hops/i)).toBeTruthy();
});
