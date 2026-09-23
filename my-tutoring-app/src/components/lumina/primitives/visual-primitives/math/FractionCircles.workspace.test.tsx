// @vitest-environment jsdom
/**
 * W1 minimal binding: the real FractionCircles on the shared teaching workspace, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. Two surfaces: the plain circle
 * (identify/build/compare/equivalent, its own Check) and the picture touch (touch_fraction); a
 * mixed pin chains both, one workspace session per mounted surface. Only microphone hardware,
 * evaluation writes, sound and the legacy AI-context hook are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ send: vi.fn(), legacy: vi.fn(), writes: [] as any[], locals: [] as any[],
  evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'circles',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
// The legacy context hook: records whether it was enabled, and every scripted cue sent through it.
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy('enabled');
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'circles' };
} }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => seam.evaluationContext, usePrimitiveEvaluation: (options: any) => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (success: boolean, score: number, metrics: any, studentWork: any) => {
        const result = { success, score, metrics, studentWork };
        (options.localOnly ? seam.locals : seam.writes).push(result);
        setSubmitted(true); options.onSubmit?.(result); return result;
      } };
  } };
});
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import FractionCircles, { type FractionCirclesChallenge, type FractionCirclesData } from './FractionCircles';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';
const live = LIVE_ADAPTERS['fraction-circles'];

beforeEach(() => { vi.clearAllMocks(); seam.writes = []; seam.locals = []; seam.evaluationContext = null; });
afterEach(() => { cleanup(); });

type Mode = FractionCirclesChallenge['type'];
const MODES: Mode[] = ['identify', 'build', 'compare', 'equivalent', 'touch_fraction'];

function challengeFor(type: Mode, id: string = type): FractionCirclesChallenge {
  const base = { id, type, instruction: `Do the ${type} task.`, hint: 'Count the slices.', narration: '', numerator: 3, denominator: 4 };
  if (type === 'compare') return { ...base, compareFraction: { numerator: 1, denominator: 2 } };
  if (type === 'equivalent') return { ...base, numerator: 1, denominator: 2, equivalentDenominator: 4 };
  return base;
}

function mount(evalMode: string, challenges: FractionCirclesChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data: FractionCirclesData = { instanceId: 'circles', title: 'Fractions', gradeBand: 'K-2', challenges };
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FractionCircles data={data} runtimePlanItemId="plan-circles" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    const commandId = crypto.randomUUID(); lastCommand = commandId;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: s.instanceId!,
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const click = (el: Element | null) => { expect(el).toBeTruthy(); act(() => { fireEvent.click(el!); }); };
  const shade = (n: number) => { for (let i = 0; i < n; i++) click(view.container.querySelector(`[data-pip-object="slice-${i}"]`)); };
  const check = () => click(screen.getByRole('button', { name: /check answer/i }));
  const type = (text: string) => act(() => { fireEvent.change(screen.getByLabelText('Fraction answer'), { target: { value: text } }); });
  const picture = (n: number, d: number) => view.container.querySelector(`[data-pip-object="picture-${n}-of-${d}"]`);
  const otherPicture = (n: number, d: number) => Array.from(view.container.querySelectorAll('[aria-label="Fraction pictures"] button'))
    .find(b => b.getAttribute('data-pip-object') !== `picture-${n}-of-${d}`)!;
  /** One complete answer per mode, right or wrong, through the real controls. */
  const answer = (c: FractionCirclesChallenge, right: boolean) => {
    switch (c.type) {
      case 'identify': type(right ? '3/4' : '2/4'); check(); break;
      case 'build': shade(right ? 3 : 2); check(); break;
      case 'equivalent': shade(right ? 2 : 3); check(); break;
      case 'compare': click(screen.getByRole('button', { name: right ? /Left .*is larger/ : /They are equal/ })); check(); break;
      case 'touch_fraction': click(right ? picture(3, 4) : otherPicture(3, 4)); break;
    }
  };
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, answer };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

it.each(MODES)('%s binds the workspace under tutor ownership: no scripted cue, no legacy context, no published key', mode => {
  const h = mount(mode, [challengeFor(mode)]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).not.toMatch(/Say exactly|\[FT_/);
  expect(tutorTools(h)).toEqual(['begin_help']);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/FT_|IDENTIFY_|BUILD_|COMPARE_|EQUIVALENT_|ACTIVITY_START/);
});

it('touch_fraction: the tutor is told the fraction to say, never which picture matches', () => {
  const h = mount('touch_fraction', [challengeFor('touch_fraction')]);
  expect(h.state().task!.task).toBe('Touch the picture showing three fourths.');
  const packet = JSON.stringify(h.state().task);
  expect(packet).not.toMatch(/picture-\d|correctChoice|Picture \d/);
  expect(h.view.container.querySelectorAll('[aria-label="Fraction pictures"] button')).toHaveLength(3);
  expect(screen.queryByText('Say that again')).toBeNull();
});

it('compare: with labels withdrawn the fraction values stay off the packet too', () => {
  const h = mount('compare', [{ ...challengeFor('compare'), showFractionLabels: false }]);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/3\/4|1\/2/);
});

it.each(MODES)('%s: a wrong answer is checked, Try again reopens a clean item, and a right one completes once', mode => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode, [challengeFor(mode)]);
  h.answer(challengeFor(mode), false);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toMatch(/Typed|Shaded|Chose|Touched/);
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  expect(h.view.container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  if (mode === 'identify') expect((screen.getByLabelText('Fraction answer') as HTMLInputElement).value).toBe('');
  h.answer(challengeFor(mode), true);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.writes).toHaveLength(1);
  expect(seam.writes[0].metrics).toMatchObject({ type: 'fraction-circles', totalChallenges: 1, correctCount: 1 });
  expect(seam.legacy).not.toHaveBeenCalled();
});

it('submits nothing without an evaluation provider (the live host)', () => {
  const h = mount('build', [challengeFor('build')]);
  h.answer(challengeFor('build'), true);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.writes).toHaveLength(0);
  expect(h.view.container.textContent).toContain('summary');
});

it('a mixed pin chains the touch block and the circle block, one session each, and submits one aggregate', () => {
  seam.evaluationContext = { lesson: 'test' };
  const touch = challengeFor('touch_fraction', 't1'), identify = challengeFor('identify', 'i1');
  const h = mount('mixed', [touch, identify]);
  expect(h.state().instanceId).toBe('circles');
  expect(h.state().task!.itemId).toBe('t1');
  h.answer(touch, true);
  h.dispatch('advance'); h.confirmVisible();
  // The touch session settled; the circle block mounted on its own session.
  expect(h.state().status).toBe('active');
  expect(h.state().instanceId).toBe('circles-block-1');
  expect(h.state().task!.itemId).toBe('i1');
  expect(seam.writes).toHaveLength(0);
  h.answer(identify, true);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.locals).toHaveLength(2);
  expect(seam.writes).toHaveLength(1);
  expect(seam.writes[0]).toMatchObject({ score: 100, metrics: { evalMode: 'mixed', totalChallenges: 2, touchFractionAccuracy: 100, identifyAccuracy: 100 } });
});

it('a mixed pin without an evaluation provider still moves on to the next block', () => {
  const touch = challengeFor('touch_fraction', 't1'), build = challengeFor('build', 'b1');
  const h = mount('touch_fraction|build', [touch, build]);
  h.answer(touch, true);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b1');
  h.answer(build, true);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.writes).toHaveLength(0);
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('build', [challengeFor('build')]);
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ itemId: 'build', attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  expect([...live.modes].sort()).toEqual((getComponentById('fraction-circles')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect([...live.modes].sort()).toEqual([...MODES].sort());
  expect(live).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(live.guidance.length).toBeLessThanOrEqual(2000);
  expect(live.guidance).not.toMatch(/say exactly/i);
  expect(() => live.validate({ title: 'x', challenges: MODES.map(m => challengeFor(m)) })).not.toThrow();
  expect(() => live.validate({ title: 'x', challenges: [{ ...challengeFor('equivalent'), equivalentDenominator: 3 }] })).toThrow();
});
