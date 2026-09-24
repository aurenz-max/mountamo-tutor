// @vitest-environment jsdom
/**
 * The real FractionCircles on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. Two surfaces: the plain circle
 * (identify/build/compare/equivalent, its own Check) and the picture touch (touch_fraction); a
 * mixed pin chains both, one workspace session per mounted surface. Only the Live context,
 * microphone hardware, evaluation writes and sound are substituted. An unbound mount renders the
 * "needs the tutor" card, never a scripted fallback.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ send: vi.fn(), writes: [] as any[], locals: [] as any[],
  evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'circles',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => seam.evaluationContext, usePrimitiveEvaluation: (options: any) => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (success: boolean, score: number, metrics: any, studentWork: any, _partial: unknown, diagnosisEvidence: any) => {
        const result = { success, score, metrics, studentWork, diagnosisEvidence };
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
import { isDiagnosableFailure } from '../../../evaluation/diagnosis/types';
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

it.each(MODES)('%s binds the workspace under tutor ownership: no scripted cue, no Next button, no published key', mode => {
  const h = mount(mode, [challengeFor(mode)]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).not.toMatch(/Say exactly|\[FT_/);
  expect(tutorTools(h)).toEqual(['begin_help']);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/FT_|IDENTIFY_|BUILD_|COMPARE_|EQUIVALENT_|ACTIVITY_START|ALL_COMPLETE|PHASE_TRANSITION/);
  expect(screen.queryByRole('button', { name: /next challenge|say that again/i })).toBeNull();
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

it.each([
  ['plain', [challengeFor('build')]],
  ['touch', [challengeFor('touch_fraction')]],
  ['mixed', [challengeFor('touch_fraction', 't1'), challengeFor('identify', 'i1')]],
] as const)('%s: an unbound mount (no runtime, or a pin outside the catalog) renders the needs-the-tutor card', (_route, challenges) => {
  const data: FractionCirclesData = { instanceId: 'circles', title: 'Our fractions', challenges: [...challenges] };
  const { container } = render(<FractionCircles data={data} runtimeEvalMode="mixed" />);
  expect(container.querySelector('[data-workspace-unbound="fraction-circles"]')).not.toBeNull();
  expect(screen.getByText('Our fractions')).toBeTruthy();
  expect(container.querySelector('[data-pip-object^="slice-"], [aria-label="Fraction pictures"]')).toBeNull();
  cleanup();
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const off = render(<LiveRuntimeContext.Provider value={runtime}><FractionCircles data={data} runtimeEvalMode="not_a_mode" /></LiveRuntimeContext.Provider>);
  expect(off.container.querySelector('[data-workspace-unbound="fraction-circles"]')).not.toBeNull();
  expect(seam.writes).toHaveLength(0);
});

it('touch_fraction shows three unlabelled pictures and no Next or Check control', () => {
  const h = mount('touch_fraction', [challengeFor('touch_fraction')]);
  const choices = screen.getAllByRole('button', { name: /Picture/ });
  expect(choices).toHaveLength(3);
  expect(choices.every(c => c.textContent === '')).toBe(true);
  expect(screen.queryByRole('button', { name: /Next|Check/ })).toBeNull();
  expect(h.state().owner).toBe('tutor');
});

it('touch_fraction submits its touch metrics, every tap and the committed attempts, wrong first included', () => {
  seam.evaluationContext = { lesson: 'test' };
  const c = challengeFor('touch_fraction');
  const h = mount('touch_fraction', [c]);
  h.answer(c, false); h.dispatch('retry'); h.answer(c, true);
  h.dispatch('advance'); h.confirmVisible();
  expect(seam.writes).toHaveLength(1);
  const [write] = seam.writes;
  expect(write.success).toBe(true);
  expect(write.metrics).toMatchObject({ evalMode: 'touch_fraction', totalChallenges: 1, correctCount: 1, attemptsCount: 2,
    touchFractionAccuracy: write.score });
  expect(write.studentWork.taps[c.id]).toHaveLength(2);
  expect(write.studentWork.pictures[0].choices).toHaveLength(3);
  expect(write.studentWork.assistanceProvenance).toBe('explicit-actions-only');
  expect(write.studentWork.learningResponses.map((r: any) => r.verdict)).toEqual(['corrected', 'affirmed']);
  expect(write.studentWork.learningResponses[0].observed).toMatch(/^Touched picture \d, which shows \d of \d equal parts shaded$/);
  expect(write.diagnosisEvidence.firstResponseScore).toBe(0);
});

describe('compare evidence', () => {
  const compare = (id: string, a: [number, number], b: [number, number]): FractionCirclesChallenge => ({
    id, type: 'compare', numerator: a[0], denominator: a[1], compareFraction: { numerator: b[0], denominator: b[1] },
    instruction: `Compare ${a.join('/')} and ${b.join('/')}.`, hint: 'Look', narration: '', showFractionLabels: false, supportTier: 'medium',
  });
  const choose = (choice: RegExp) => {
    act(() => { fireEvent.click(screen.getByRole('button', { name: choice })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /check answer/i })); });
  };

  it('records every compare response and opts into the first-response gate when the session still ends at 100%', () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount('compare', [compare('a', [1, 4], [1, 8]), compare('b', [2, 6], [2, 3]), compare('c', [3, 4], [1, 2])]);
    const next = () => { h.dispatch('advance'); h.confirmVisible(); };
    choose(/right is larger/i); h.dispatch('retry'); choose(/left is larger/i); next();
    choose(/left is larger/i); h.dispatch('retry'); choose(/equal/i); h.dispatch('retry'); choose(/right is larger/i); next();
    choose(/left is larger/i);
    expect(seam.writes).toHaveLength(1);
    const [write] = seam.writes;
    expect(write).toMatchObject({ success: true, score: 100 });
    expect(write.studentWork.compareResponses.map((r: any) => [r.itemId, r.chosen, r.attempt])).toEqual([
      ['a', 'right', 1], ['a', 'left', 2], ['b', 'left', 1], ['b', 'equal', 2], ['b', 'right', 3], ['c', 'left', 1]]);
    const evidence = write.diagnosisEvidence;
    expect(evidence.firstResponseScore).toBe(33);
    expect(evidence.phases.map((p: any) => [p.itemId, p.expected, p.observed])).toEqual([
      ['a', '1/4 (left circle) is larger', '1/8 (right circle) is larger'],
      ['b', '2/3 (right circle) is larger', '2/6 (left circle) is larger'],
      ['c', '3/4 (left circle) is larger', '3/4 (left circle) is larger']]);
    expect(evidence.observed).toBe('Chose: 2/6 (left circle) is larger.');
    expect(evidence.priorAttempts.map((p: any) => p.observed)).toEqual([
      'Chose: 1/8 (right circle) is larger (response 1)', 'Chose: They are equal (response 2)']);
    expect(evidence.phases.every((p: any) => p.support.includes('labels hidden'))).toBe(true);
    expect(JSON.stringify(evidence)).not.toMatch(/misconception|denominator/i);
    expect(isDiagnosableFailure(write, evidence)).toBe(true);
  });

  it('attaches no evidence when every compare response is correct', () => {
    seam.evaluationContext = { lesson: 'test' };
    mount('compare', [compare('a', [1, 4], [1, 8])]);
    choose(/left is larger/i);
    expect(seam.writes[0].diagnosisEvidence).toBeUndefined();
    expect(isDiagnosableFailure(seam.writes[0], seam.writes[0].diagnosisEvidence)).toBe(false);
  });
});

it('a mixed chain weights each block by its challenges and keeps the touch score and attempts in the one aggregate', () => {
  seam.evaluationContext = { lesson: 'test' };
  const touch = challengeFor('touch_fraction', 't1'), identify = challengeFor('identify', 'i1');
  const h = mount('mixed', [touch, identify]);
  h.answer(touch, false); h.dispatch('retry'); h.answer(touch, true);
  h.dispatch('advance'); h.confirmVisible();
  h.answer(identify, true);
  h.dispatch('advance'); h.confirmVisible();
  expect(seam.locals).toHaveLength(2);
  const touchScore = seam.locals[0].score;
  expect(touchScore).toBeLessThan(100);
  expect(seam.writes).toHaveLength(1);
  expect(seam.writes[0]).toMatchObject({ score: (touchScore + 100) / 2, metrics: { evalMode: 'mixed', totalChallenges: 2,
    attemptsCount: 3, touchFractionAccuracy: touchScore, identifyAccuracy: 100 } });
  expect(seam.writes[0].studentWork.blocks).toHaveLength(2);
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
