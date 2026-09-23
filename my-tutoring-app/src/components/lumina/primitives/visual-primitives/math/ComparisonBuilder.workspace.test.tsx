// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real ComparisonBuilder on the shared teaching workspace, with
 * the real TeachingSession, LiveLessonRuntime, transport and rendering shell. The builder's own
 * check commits a checked gesture; the runtime owns progression. Only microphone hardware,
 * evaluation writes, sound and the legacy AI-context hook are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), legacy: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'compare',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
// The legacy context hook: records whether it was enabled, and every scripted cue sent through it.
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy('enabled');
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'compare' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import ComparisonBuilder, { type ComparisonBuilderChallenge, type ComparisonBuilderData } from './ComparisonBuilder';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { getComponentById } from '../../../service/manifest/catalog';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); seam.evaluationContext = null; });

type Kind = ComparisonBuilderChallenge['type'];
const MODE_KIND: Record<string, Kind> = { compare_groups: 'compare-groups', compare_numbers: 'compare-numbers',
  order: 'order', one_more_less: 'one-more-one-less' };

function challengeFor(kind: Kind, id: string = kind): ComparisonBuilderChallenge {
  const base = { id, type: kind, instruction: `Solve the ${kind} challenge.` };
  switch (kind) {
    case 'compare-groups': return { ...base, leftGroup: { count: 5, objectType: 'apples' },
      rightGroup: { count: 3, objectType: 'stars' }, correctAnswer: 'more' };
    case 'compare-numbers': return { ...base, leftNumber: 7, rightNumber: 4, correctSymbol: '>' };
    case 'order': return { ...base, numbers: [5, 2, 8], direction: 'ascending' };
    default: return { ...base, targetNumber: 6, askFor: 'one-more' };
  }
}

function mount(evalMode: string, challenges: ComparisonBuilderChallenge[], gradeBand: 'K' | '1' = '1') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { title: 'Comparing', gradeBand, instanceId: 'compare', showCorrespondenceLines: true,
    useAlligatorMnemonic: false, challenges } as ComparisonBuilderData;
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ComparisonBuilder data={data} runtimePlanItemId="plan-compare" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name)!;
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'compare',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const choose = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const check = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  return { runtime, transport, sent, state, dispatch, confirmVisible, choose, check };
}

it.each(Object.keys(MODE_KIND))('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = challengeFor(MODE_KIND[mode]);
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const demand = JSON.stringify(h.state().task!.demand);
  // The gesture key never reaches the tutor: no symbol, no sorted order, no target + 1.
  expect(demand).not.toMatch(/correct|">"|2, 5, 8|: ?7[,}]/);
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /next challenge/i })).toBeNull();
});

it('Kindergarten counts stay off the packet, and the Read-me button (a legacy tutor cue) is hidden', () => {
  const h = mount('compare_groups', [challengeFor('compare-groups')], 'K');
  expect(h.state().task!.demand).not.toHaveProperty('countsOnScreen');
  expect(screen.queryByRole('button', { name: /read/i })).toBeNull();
});

it('Check commits a wrong answer, input stays closed until Try again clears it, then a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('compare_numbers', [challengeFor('compare-numbers', 'n1'),
    { ...challengeFor('compare-numbers', 'n2'), leftNumber: 3, rightNumber: 9, correctSymbol: '<' }]);
  h.choose('<'); h.check();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Chose: 7 < 4');
  expect(screen.getByRole('button', { name: /check/i })).toHaveProperty('disabled', true);
  h.choose('>');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Chose: 7 < 4' });
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No symbol chosen yet' });
  h.choose('>'); h.check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('n2');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.choose('<'); h.check();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 100]);
  expect(seam.legacy).not.toHaveBeenCalled();
});

it('without an evaluation provider (the live host) nothing is submitted', () => {
  const h = mount('order', [challengeFor('order')]);
  h.choose('2'); h.choose('5'); h.choose('8'); h.check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the packet carries learner signals for the current item', () => {
  const h = mount('compare_groups', [challengeFor('compare-groups')]);
  act(() => h.transport.publish());
  const packet = h.sent.filter(m => m.type === 'runtime_state').at(-1).state;
  expect(packet.learner.signals).toMatchObject({ attempts: 0, learnerTurns: 0, helpRequests: 0 });
  h.transport.close();
});

it('advertises every catalog mode under tutor ownership, inside the guidance cap', () => {
  const live = LIVE_ADAPTERS['comparison-builder'];
  expect([...live.modes].sort()).toEqual((getComponentById('comparison-builder')?.evalModes ?? []).map(m => m.evalMode).sort());
  expect(live).toMatchObject({ teachingOwner: 'tutor', canAdvance: false, tutoring: null, bindsTeachingWorkspace: true });
  expect(live.guidance.length).toBeLessThanOrEqual(2000);
});
