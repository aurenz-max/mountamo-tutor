// @vitest-environment jsdom
/**
 * fraction-circles `build_equal` (open build) on the real component, TeachingSession and LiveLessonRuntime: the
 * learner cuts and shades their own circle, "I'm done!" commits it, the circle's check names the miss, Try again
 * keeps the build, and the scene carries the made pieces as numbers so the work history shows a revision.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'circles',
  conversation: [], sendText: vi.fn(),
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

const item = (over: Partial<FractionCirclesChallenge> = {}): FractionCirclesChallenge => ({ id: 'q0', type: 'build_equal',
  numerator: 3, denominator: 4, hint: 'Cut every piece the same way.',
  instruction: 'Make a fraction equal to 3/4 your own way: cut the circle into equal pieces, but not 4, then shade some.',
  narration: '', ...over });

function mount(challenges: FractionCirclesChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FractionCircles data={{ instanceId: 'circles', title: 'Fractions', gradeBand: '3-5', challenges }}
      runtimePlanItemId="plan-circles" runtimeEvalMode="build_equal" />
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
  const cut = (n: number) => click(screen.getByRole('button', { name: `Cut into ${n} equal pieces` }));
  const knife = () => click(screen.getByRole('button', { name: /cut a piece in half/i }));
  const piece = (i: number) => click(view.container.querySelector(`[data-build-scene] [data-pip-object="slice-${i}"]`));
  const shade = (...indices: number[]) => indices.forEach(piece);
  const done = () => click(screen.getByRole('button', { name: /i'm done/i }));
  const pieces = () => view.container.querySelectorAll('[data-build-scene] [data-pip-object^="slice-"]');
  const shaded = () => Array.from(pieces()).filter(p => p.getAttribute('fill') === '#ec4899').length;
  const attempts = () => state().task!.workspace!.attempts;
  return { runtime, view, state, dispatch, cut, knife, piece, shade, done, pieces, shaded, attempts };
}

it('builds a gesture item: whole circle, no Check button, I\'m done waits for a cut and a shaded piece', () => {
  const h = mount([item()]);
  expect(h.state().task).toMatchObject({ itemId: 'q0' });
  expect(h.state().task!.demand.response).toBe('gesture');
  expect(h.pieces()).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /check answer/i })).toBeNull();
  expect((screen.getByRole('button', { name: /i'm done/i }) as HTMLButtonElement).disabled).toBe(true);
  h.cut(8);
  expect(h.pieces()).toHaveLength(8);
  expect(h.state().task!.demand).toMatchObject({ kind: 'build_equal', piecesCut: 8, piecesShaded: 0, printedTarget: '3/4' });
  // Bare start: no lever is on, so nothing on screen counts the pieces or the shading.
  expect(h.state().task!.workspace!.levers!.every(l => !l.pulled)).toBe(true);
  expect(screen.queryByText(/shaded$/)).toBeNull();
});

it('one too many is one_off; Try again keeps the build and the verdict; one fewer passes; the history shows the turn', () => {
  const h = mount([item()]);
  h.cut(8); h.shade(0, 1, 2, 3, 4, 5, 6);
  // Before the commit the screen states no verdict and no equal fraction.
  expect(h.view.container.textContent).not.toMatch(/same amount|6\/8|not the same/i);
  h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'one_off', response: 'Cut the circle into 8 equal pieces and shaded 7' });
  expect(screen.getByText(/not the same amount yet/i)).toBeTruthy();
  h.dispatch('retry');
  expect(h.pieces()).toHaveLength(8);
  expect(h.shaded()).toBe(7);
  expect(screen.getByText(/not the same amount yet/i)).toBeTruthy();
  // A change within 1.5 s of the host's own commit (the retry) is read as the host's; the learner's comes later.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + 2000);
  h.piece(6);
  vi.useRealTimers();
  expect(h.state().task!.demand.workHistory).toMatch(/piecesShaded 0 → 7 → 6/);
  h.done();
  expect(h.attempts().map(a => [a.correct, a.miss])).toEqual([[false, 'one_off'], [true, undefined]]);
  expect(screen.getByText(/6\/8 is the same amount as 3\/4/)).toBeTruthy();
});

it('the target\'s own cut is same_pieces; the complement is shaded_the_rest; a halved piece is unequal_pieces', () => {
  const h = mount([item()]);
  h.cut(4); h.shade(0, 1, 2); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'same_pieces' });
  h.dispatch('retry');
  h.cut(8); h.shade(0, 1); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'shaded_the_rest' });
  h.dispatch('retry');
  // Fourths with one fourth cut in half: five pieces, not all the same size.
  h.cut(4); h.knife(); h.piece(0); h.knife();
  expect(h.pieces()).toHaveLength(5);
  expect(h.state().task!.demand).toMatchObject({ piecesCut: 5, pieceSizes: 'not all the same size' });
  h.shade(0, 1, 2, 3); h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'unequal_pieces' });
  expect(screen.getByText(/not all the same size/i)).toBeTruthy();
  h.dispatch('retry');
  // Halving every fourth makes eighths: an equal fraction reached with the knife.
  h.cut(4); h.shade(0, 1, 2); h.knife(); for (const i of [0, 2, 4, 6]) h.piece(i); h.knife();
  expect(h.shaded()).toBe(6);
  h.done();
  expect(h.attempts().at(-1)).toMatchObject({ correct: true });
});

it('levers: show_reference draws the target beside the circle; smaller_target opens halves on a whole circle', () => {
  const h = mount([item()]);
  h.cut(6); h.shade(0, 1, 2, 3); h.done();
  h.dispatch('retry');
  const ref = h.dispatch('pull_lever', { lever: 'show_reference' });
  expect(ref.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="show_reference"] svg')).toBeTruthy();
  expect(h.pieces()).toHaveLength(6);
  expect(String(ref.state.task!.demand.onScreen)).toMatch(/reference circle/);
  expect(h.dispatch('pull_lever', { lever: 'running_count' }).status).toBe('committed');
  expect(screen.getByText('6 pieces, 4 shaded')).toBeTruthy();
  const easier = h.dispatch('pull_lever', { lever: 'smaller_target' });
  expect(easier.state.task).toMatchObject({ itemId: 'q0~smaller' });
  expect(easier.state.task!.task).toMatch(/equal to 1\/2/);
  expect(h.pieces()).toHaveLength(1);
});
