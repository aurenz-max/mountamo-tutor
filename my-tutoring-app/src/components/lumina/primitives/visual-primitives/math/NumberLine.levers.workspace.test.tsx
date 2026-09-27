// @vitest-environment jsdom
/**
 * The number-line jump levers on the shared teaching workspace (`/add-support-tiers` pilot,
 * handoff 18): the real NumberLine, TeachingSession and LiveLessonRuntime. `pull_lever` must change
 * the line and the scene in the same commit, never draw the landing, record the lever on the next
 * attempt, and a simplify pull must open an ungraded easier jump that returns to the full item.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ send: vi.fn(), view: {} as Record<string, unknown> }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'line',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { primitiveData: Record<string, unknown> }) => {
  seam.view = o.primitiveData;
  return { sendText: vi.fn(), isConnected: true, isAudioPlaying: false, activePrimitiveId: 'line' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: vi.fn(), elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import NumberLine, { type NumberLineData } from './NumberLine';

beforeEach(() => { vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const jump = (id: string, start: number, back: number, arc = false) => ({ id, type: 'show_jump' as const,
  instruction: `Start at ${start} and hop back ${back}.`, hint: 'Count each hop.', targetValues: [start - back], startValue: start,
  operations: [{ type: 'subtract' as const, startValue: start, changeValue: back, showJumpArc: arc }] });

function mount(challenges = [jump('j0', 8, 3), jump('j1', 15, 4)]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'jump',
    supportTier: 'medium', challenges, instanceId: 'line' } as NumberLineData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberLine data={data} runtimePlanItemId="plan-line" runtimeEvalMode="jump" />
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
  const tap = (value: number) => {
    const svg = document.querySelector('svg[viewBox="0 0 760 240"]')!;
    const min = Number(seam.view.visibleMin), max = Number(seam.view.visibleMax);
    act(() => { fireEvent.click(svg, { clientX: 60 + ((value - min) / (max - min)) * 640 }); });
  };
  const check = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  const hopLabels = (kind: string) => Array.from(view.container.querySelectorAll(`[data-lever="${kind}"] text`)).map(t => t.textContent);
  return { runtime, state, offered, dispatch, tap, check, hopLabels, view };
}

const levers = (h: ReturnType<typeof mount>) => h.state().task!.workspace!.levers ?? [];

it('offers pull_lever on a jump with both levers declared, and states no landing', () => {
  const h = mount();
  expect(h.offered('pull_lever')?.assistance).toEqual({ level: 2, answerExposure: 'none' });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['numbered_hops', 'help', false], ['simpler_jump', 'simplify', false]]);
  expect(JSON.stringify(h.state().task)).not.toMatch(/\b5\b/);
});

it('numbers the learner\'s own wrong jump in the same commit, and records the lever on the next attempt', () => {
  const h = mount();
  h.tap(6); h.check();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false, assisted: false });
  const receipt = h.dispatch('pull_lever', { lever: 'numbered_hops' });
  expect(receipt.status).toBe('committed');
  // Before any visible receipt: the learner's two hops are numbered, and the scene says so without the landing.
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);
  expect(receipt.state.task!.demand.onScreen).toMatch(/Numbered hops/);
  expect(receipt.state.task!.demand.learnerWork).toMatch(/hops drawn: 2/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b5\b/);
  expect(levers(h).find(l => l.id === 'numbered_hops')!.pulled).toBe(true);

  // A second pull of the same lever is refused and changes nothing.
  const assistance = h.state().assistance.length;
  expect(h.dispatch('pull_lever', { lever: 'numbered_hops' }).status).toBe('blocked');
  expect(h.state().assistance).toHaveLength(assistance);
  expect(h.hopLabels('learner-hops')).toEqual(['1', '2']);

  h.dispatch('retry');
  // Blank line: only the model hop 1 from the start, which stops short of the landing.
  expect(h.hopLabels('learner-hops')).toEqual([]);
  expect(h.hopLabels('model-hop')).toEqual(['1']);
  h.tap(5); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'j0', correct: true, assisted: true, levers: ['numbered_hops'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('j1');
  expect(levers(h).every(l => !l.pulled)).toBe(true);
});

it('never draws a model hop for a jump of 1, and refuses a pull that would change nothing', () => {
  const h = mount([jump('j0', 8, 1)]);
  const receipt = h.dispatch('pull_lever', { lever: 'numbered_hops' });
  expect(receipt.status).not.toBe('committed');
  expect(receipt.reason).toMatch(/jump of 1/);
  expect(h.hopLabels('model-hop')).toEqual([]);
});

it('easy starts with the hops lever pulled: no worked arc to the landing, and not recorded as a pull', () => {
  const h = mount([jump('j0', 8, 3, true)]);
  expect(levers(h).find(l => l.id === 'numbered_hops')!.pulled).toBe(true);
  expect(h.hopLabels('model-hop')).toEqual(['1']);
  // The old worked arc drew a "-3" label and an arrowhead at 5; nothing labelled with the change is drawn now.
  expect(Array.from(h.view.container.querySelectorAll('svg text')).map(t => t.textContent)).not.toContain('-3');
  h.tap(5); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
});

it('a simplify pull opens an ungraded easier jump, then returns to the full item, which alone is credited', () => {
  const h = mount();
  const receipt = h.dispatch('pull_lever', { lever: 'simpler_jump' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'j0~simpler', task: 'Start at 9. Jump back 2.' });
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'j0' });
  expect(receipt.state.task!.demand.startsAt).toBe(9);
  // No levers during the easier jump, and no advance past the session item.
  expect(h.offered('pull_lever')).toBeUndefined();

  h.tap(6); h.check();
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('j0~simpler');
  h.tap(7); h.check();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'j0', task: 'Start at 8 and hop back 3.' });
  expect(h.state().task!.workspace!.practice).toBeUndefined();
  expect(levers(h).find(l => l.id === 'simpler_jump')!.pulled).toBe(true);

  h.tap(5); h.check();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['j0~simpler', false, true], ['j0~simpler', true, true], ['j0', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['simpler_jump'], assisted: true });
});
