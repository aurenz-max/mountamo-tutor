// @vitest-environment jsdom
/**
 * Fraction-circles levers (`fractionCirclesLevers.ts`, handoff 18 B2) on the real component, TeachingSession
 * and LiveLessonRuntime. `pull_lever` must change the circle and the scene fact in the same commit, never
 * state the answer, and be recorded on the next attempt; a simplify pull opens an ungraded easier item of
 * the same mode and returns to the full item, which alone is credited.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'circles',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => null, usePrimitiveEvaluation: () => {
    const [hasSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null, submitResult: () => null };
  } };
});
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import FractionCircles, { type FractionCirclesChallenge } from './FractionCircles';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

const base = { instruction: 'Do it.', hint: 'Count.', narration: '' };
const identify = (over: Partial<FractionCirclesChallenge> = {}): FractionCirclesChallenge =>
  ({ ...base, id: 'i0', type: 'identify', numerator: 3, denominator: 8, instruction: 'What fraction of the circle is shaded?', ...over });

function mount(challenges: FractionCirclesChallenge[], evalMode = challenges[0].type) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FractionCircles data={{ instanceId: 'circles', title: 'Fractions', gradeBand: '3-5', challenges }}
      runtimePlanItemId="plan-circles" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const offered = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offered(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let receipt!: ReturnType<typeof runtime.dispatch>;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: s.instanceId!,
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt;
  };
  const click = (el: Element | null) => { expect(el).toBeTruthy(); act(() => { fireEvent.click(el!); }); };
  const check = () => click(screen.getByRole('button', { name: /check answer/i }));
  const type = (text: string) => act(() => { fireEvent.change(screen.getByLabelText('Fraction answer'), { target: { value: text } }); });
  const shade = (n: number) => { for (let i = 0; i < n; i++) click(view.container.querySelector(`[data-pip-object="slice-${i}"]`)); };
  const marks = (lever: string) => view.container.querySelectorAll(`[data-lever="${lever}"]`).length;
  const levers = () => state().task!.workspace!.levers ?? [];
  return { runtime, view, state, offered, dispatch, check, type, shade, marks, levers };
}

it('identify: mark_pieces marks every piece in the commit, states no count, and is recorded on the next attempt', () => {
  const h = mount([identify()]);
  h.type('2/8'); h.check();
  const receipt = h.dispatch('pull_lever', { lever: 'mark_pieces' });
  expect(receipt.status).toBe('committed');
  // Before any visible receipt: one dot in each of the 8 pieces, shaded or not; the fact says so without a digit.
  expect(h.view.container.querySelectorAll('[data-lever="mark-pieces"] circle')).toHaveLength(8);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/every piece, shaded or not, has one dot/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/\b3\b|shaded: ?3/);
  // A second pull is refused and changes nothing.
  const assistance = h.state().assistance.length;
  expect(h.dispatch('pull_lever', { lever: 'mark_pieces' }).status).toBe('blocked');
  expect(h.state().assistance).toHaveLength(assistance);
  h.dispatch('retry');
  h.type('3/8'); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, levers: ['mark_pieces'], assisted: true });
});

it('identify: the part-whole frame is pictures only', () => {
  const h = mount([identify()]);
  expect(h.dispatch('pull_lever', { lever: 'part_whole' }).status).toBe('committed');
  const frame = h.view.container.querySelector('[data-lever="part-whole"]')!;
  expect(frame).toBeTruthy();
  expect(frame.textContent).toBe('');
});

it('identify easy starts with every piece marked, and that start is not a pull', () => {
  const h = mount([identify({ startLevers: ['mark_pieces'] })]);
  expect(h.levers().find(l => l.id === 'mark_pieces')!.pulled).toBe(true);
  expect(h.marks('mark-pieces')).toBe(1);
  h.type('3/8'); h.check();
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
});

it('identify: fewer_pieces opens an ungraded easier circle, then the full item, which alone is credited', () => {
  const h = mount([identify(), identify({ id: 'i1', numerator: 1, denominator: 4 })]);
  const receipt = h.dispatch('pull_lever', { lever: 'fewer_pieces' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('i0~fewer');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'i0' });
  expect(h.offered('pull_lever')).toBeUndefined();
  // The easier circle has 4 pieces, 1 shaded: a wrong try, Try again keeps it, then right.
  expect(h.view.container.querySelectorAll('svg path[d^="M 70"]').length).toBe(4);
  h.type('2/4'); h.check();
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('i0~fewer');
  h.type('1/4'); h.check();
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('i0');
  expect(h.state().task!.workspace!.practice).toBeUndefined();
  h.type('3/8'); h.check();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['i0~fewer', false, true], ['i0~fewer', true, true], ['i0', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['fewer_pieces'], assisted: true });
});

it('build: the running count is marked when pulled at runtime, and unit_build opens one slice of the same circle', () => {
  const build: FractionCirclesChallenge = { ...base, id: 'b0', type: 'build', numerator: 3, denominator: 6,
    instruction: 'Shade the circle to show 3/6.', showWorkingCount: false };
  const h = mount([build]);
  expect(h.levers().map(l => [l.id, l.pulled])).toEqual([['running_count', false], ['part_whole', false], ['unit_build', false]]);
  h.shade(2);
  expect(h.dispatch('pull_lever', { lever: 'running_count' }).status).toBe('committed');
  expect(screen.getByText(/2\/6 shaded/)).toBeTruthy();
  expect(h.marks('running_count')).toBe(1);
  expect(h.state().task!.demand.learnerWork).toBe('Shaded 2 of 6 slices');
  const receipt = h.dispatch('pull_lever', { lever: 'unit_build' });
  expect(receipt.state.task).toMatchObject({ itemId: 'b0~unit', task: 'Shade the circle to show 1/6.' });
});

it('equivalent: split_reference cuts the reference slices with lines only', () => {
  const eq: FractionCirclesChallenge = { ...base, id: 'e0', type: 'equivalent', numerator: 1, denominator: 3, equivalentDenominator: 6 };
  const h = mount([eq]);
  expect(h.dispatch('pull_lever', { lever: 'split_reference' }).status).toBe('committed');
  const split = h.view.container.querySelector('[data-lever="split-reference"]')!;
  expect(split.querySelectorAll('line')).toHaveLength(3);
  expect(split.textContent).toBe('');
  expect(String(h.state().task!.demand.onScreen)).toMatch(/reference circle is cut by lines/);
});

it('compare: overlay outlines the left amount on the right circle and names no side', () => {
  const cmp: FractionCirclesChallenge = { ...base, id: 'c0', type: 'compare', numerator: 3, denominator: 5,
    compareFraction: { numerator: 5, denominator: 8 }, showFractionLabels: false };
  const h = mount([cmp]);
  const receipt = h.dispatch('pull_lever', { lever: 'overlay' });
  expect(receipt.status).toBe('committed');
  expect(h.marks('overlay')).toBe(1);
  // Labels are withdrawn, so the packet still carries no fraction value.
  expect(JSON.stringify(receipt.state.task)).not.toMatch(/3\/5|5\/8/);
  const easier = h.dispatch('pull_lever', { lever: 'far_pair' });
  expect(easier.state.task!.itemId).toBe('c0~far');
});

it('touch_fraction: two_pictures opens another fraction with two pictures, then the full three', () => {
  const touch: FractionCirclesChallenge = { ...base, id: 't0', type: 'touch_fraction', numerator: 3, denominator: 4 };
  const h = mount([touch], 'touch_fraction');
  const pictures = () => h.view.container.querySelectorAll('[aria-label="Fraction pictures"] button');
  expect(pictures()).toHaveLength(3);
  const receipt = h.dispatch('pull_lever', { lever: 'two_pictures' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 't0~two', task: 'Touch the picture showing one half.' });
  expect(pictures()).toHaveLength(2);
  expect(JSON.stringify(receipt.state.task)).not.toMatch(/picture-\d|correctChoice/);
  act(() => { fireEvent.click(h.view.container.querySelector('[data-pip-object="picture-1-of-2"]')!); });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('t0');
  expect(pictures()).toHaveLength(3);
  act(() => { fireEvent.click(h.view.container.querySelector('[data-pip-object="picture-3-of-4"]')!); });
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 't0', correct: true, levers: ['two_pictures'] });
});
