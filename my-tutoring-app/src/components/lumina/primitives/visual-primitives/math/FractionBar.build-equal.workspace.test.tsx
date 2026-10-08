// @vitest-environment jsdom
/**
 * fraction-bar `build_equal` (open build) on the real component, TeachingSession and LiveLessonRuntime: the learner
 * splits and shades their own bar, "I'm done!" commits it, the bar's check names the miss, Try again keeps the build,
 * and the scene carries the made parts as numbers so the work history shows a revision. Pure rules at the end.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'bar',
  conversation: [], sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true,
  isAudioPlaying: false, activePrimitiveId: null }) }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => null, usePrimitiveEvaluation: () => {
    const [hasSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null, submitResult: () => null };
  } };
});
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import FractionBar, { type FractionBarChallenge } from './FractionBar';
import { barLevers, equalBarInstruction, smallerBarTarget, workspaceAssignment } from './fractionBarWorkspace';
import { equalWays } from './fractionEqualBuild';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

const item = (over: Partial<FractionBarChallenge> = {}): FractionBarChallenge => ({ id: 'q0', numerator: 3, denominator: 4,
  numeratorChoices: [], denominatorChoices: [], instruction: equalBarInstruction(3, 4), ...over });

function mount(challenges: FractionBarChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FractionBar data={{ instanceId: 'bar', title: 'Fractions', description: 'Your way', challengeType: 'build_equal',
      gradeBand: '3-5', challenges }} runtimePlanItemId="plan-bar" runtimeEvalMode="build_equal" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && x.action.operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    let receipt!: ReturnType<typeof runtime.dispatch>;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: s.instanceId!,
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt;
  };
  const click = (el: Element | null) => { expect(el).toBeTruthy(); act(() => { fireEvent.click(el!); }); };
  const split = (n: number) => click(screen.getByRole('button', { name: `Split into ${n} equal parts` }));
  const knife = () => click(screen.getByRole('button', { name: /cut a part in half/i }));
  const part = (i: number) => click(view.container.querySelector(`[data-build-scene] [data-pip-object="part-${i}"]`));
  const shade = (...indices: number[]) => indices.forEach(part);
  const done = () => click(screen.getByRole('button', { name: /i'm done/i }));
  const parts = () => view.container.querySelectorAll('[data-build-scene] [data-pip-object^="part-"]');
  const shaded = () => Array.from(parts()).filter(p => p.getAttribute('fill') === '#a855f7').length;
  const attempts = () => state().task!.workspace!.attempts;
  return { runtime, view, state, dispatch, split, knife, part, shade, done, parts, shaded, attempts };
}

it("builds a gesture item: a whole bar, no Check, no numerator steps, I'm done waits for a split and a shaded part", () => {
  const h = mount([item()]);
  expect(h.state().task).toMatchObject({ itemId: 'q0' });
  expect(h.state().task!.task).toBe(equalBarInstruction(3, 4));
  expect(h.state().task!.demand.response).toBe('gesture');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.parts()).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /check answer|submit fraction/i })).toBeNull();
  expect(screen.queryByText(/Identify the Numerator/)).toBeNull();
  expect((screen.getByRole('button', { name: /i'm done/i }) as HTMLButtonElement).disabled).toBe(true);
  h.split(8);
  expect(h.parts()).toHaveLength(8);
  expect(h.state().task!.demand).toMatchObject({ kind: 'build_equal', partsCut: 8, partsShaded: 0, printedFraction: '3/4' });
  // Bare start: no lever is on, so nothing on screen counts the parts or the shading, and no decimal is shown.
  expect(h.state().task!.workspace!.levers!.every(l => !l.pulled)).toBe(true);
  expect(screen.queryByText(/shaded$/)).toBeNull();
  expect(h.view.container.textContent).not.toMatch(/0\.750|≈/);
});

it('one too many is one_off; Try again keeps the build and the verdict; one fewer passes; the history shows the turn', () => {
  // A second item keeps the bar on screen after the first passes (the last one opens the summary).
  const h = mount([item(), item({ id: 'q1', numerator: 1, denominator: 3, instruction: equalBarInstruction(1, 3) })]);
  h.split(8); h.shade(0, 1, 2, 3, 4, 5, 6);
  // Before the commit the screen states no verdict and no equal fraction, and the scene no verdict either.
  expect(h.view.container.textContent).not.toMatch(/same amount|6\/8|not the same/i);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/equal to the target|correct|not the same amount/i);
  expect(h.state().task!.demand).toMatchObject({ partsCut: 8, partsShaded: 7 });
  h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'one_off', response: 'Split the bar into 8 equal parts and shaded 7' });
  expect(screen.getByText(/not the same amount yet/i)).toBeTruthy();
  h.dispatch('retry');
  expect(h.parts()).toHaveLength(8);
  expect(h.shaded()).toBe(7);
  expect(screen.getByText(/not the same amount yet/i)).toBeTruthy();
  // A change within 1.5 s of the host's own commit (the retry) is read as the host's; the learner's comes later.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + 2000);
  h.part(6);
  vi.useRealTimers();
  expect(h.state().task!.demand.workHistory).toMatch(/partsShaded 0 → 7 → 6/);
  h.done();
  expect(h.attempts().map(a => [a.correct, a.miss])).toEqual([[false, 'one_off'], [true, undefined]]);
  expect(screen.getByText(/6\/8 is the same amount as 3\/4/)).toBeTruthy();
});

it("the target's own split is same_pieces; the complement is shaded_the_rest; a halved part is unequal_pieces; halving every part passes", () => {
  const h = mount([item()]);
  h.split(4); h.shade(0, 1, 2); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'same_pieces' });
  h.dispatch('retry');
  h.split(8); h.shade(0, 1); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'shaded_the_rest' });
  h.dispatch('retry');
  h.split(6); h.shade(0, 1, 2, 3); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'cut_cannot_make' });
  h.dispatch('retry');
  // Fourths with one fourth cut in half: five parts, not all the same size.
  h.split(4); h.knife(); h.part(0); h.knife();
  expect(h.parts()).toHaveLength(5);
  expect(h.state().task!.demand).toMatchObject({ partsCut: 5, partSizes: 'not all the same size' });
  h.shade(0, 1, 2, 3); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'unequal_pieces' });
  expect(screen.getByText(/not all the same size/i)).toBeTruthy();
  h.dispatch('retry');
  // Halving every fourth makes eighths: an equal fraction reached with the knife.
  h.split(4); h.shade(0, 1, 2); h.knife(); for (const i of [0, 2, 4, 6]) h.part(i); h.knife();
  expect(h.shaded()).toBe(6);
  h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: true });
});

it('levers: show_reference draws the target under the bar; running_count counts; smaller_target opens halves on a whole bar', () => {
  const h = mount([item()]);
  h.split(6); h.shade(0, 1, 2, 3); h.done();
  h.dispatch('retry');
  const ref = h.dispatch('pull_lever', { lever: 'show_reference' });
  expect(ref.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="show_reference"] svg')).toBeTruthy();
  expect(h.parts()).toHaveLength(6);
  expect(String(ref.state.task!.demand.onScreen)).toMatch(/reference bar/);
  expect(h.dispatch('pull_lever', { lever: 'running_count' }).status).toBe('committed');
  expect(screen.getByText('6 parts, 4 shaded')).toBeTruthy();
  const easier = h.dispatch('pull_lever', { lever: 'smaller_target' });
  expect(easier.state.task).toMatchObject({ itemId: 'q0~smaller' });
  expect(easier.state.task!.task).toMatch(/equal to 1\/2/);
  expect(h.parts()).toHaveLength(1);
  // The practice item is ungraded: making it passes and the full item comes back whole.
  h.split(4); h.shade(0, 1); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'q0~smaller', correct: true });
});

describe('pure rules', () => {
  it('levers start bare, name the build, and every build_equal miss has a lever', () => {
    const levers = barLevers('build_equal', item(), [], '3-5');
    expect(levers.map(l => [l.id, l.kind, l.pulled])).toEqual([['running_count', 'help', false], ['show_reference', 'help', false],
      ['smaller_target', 'simplify', false]]);
    const answered = new Set(levers.flatMap(l => l.answers ?? []));
    for (const miss of ['unequal_pieces', 'same_pieces', 'shaded_the_rest', 'cut_cannot_make', 'one_off', 'off_by_more'])
      expect(answered.has(miss), miss).toBe(true);
    for (const l of levers) expect(l.does).not.toMatch(/\d/);
    expect(barLevers('build', item(), [], '3-5')).toEqual([]);
  });

  it('smaller_target: fewer parts, never the same value, another way to make it, none for halves', () => {
    for (const [n, d] of [[3, 4], [2, 3], [5, 10], [8, 12], [1, 3]]) {
      const easier = smallerBarTarget(item({ numerator: n, denominator: d }), '3-5')!;
      expect(easier.denominator).toBeLessThan(d);
      expect(easier.numerator * d).not.toBe(n * easier.denominator);
      expect(equalWays(easier.numerator, easier.denominator, '3-5').length).toBeGreaterThan(0);
      expect(workspaceAssignment(easier, 'build_equal').task).toBe(equalBarInstruction(easier.numerator, easier.denominator));
    }
    expect(smallerBarTarget(item({ numerator: 1, denominator: 2 }), '3-5')).toBeNull();
  });
});
