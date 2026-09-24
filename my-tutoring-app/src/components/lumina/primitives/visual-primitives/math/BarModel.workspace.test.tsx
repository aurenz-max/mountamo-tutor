// @vitest-environment jsdom
/**
 * The real BarModel on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The graph's own check commits a
 * checked gesture; a spoken explanation is judged by the tutor against its code-derived facts; the
 * runtime owns progression. Only the Live context, evaluation writes and sound are substituted. An
 * unbound mount renders the "needs the tutor" card, never a scripted fallback.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'graph',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import BarModel, { type BarModelChallenge, type BarModelData, type BarModelEvalMode } from './BarModel';
import { validateBarModelData } from '../../../components/live-activity/adapters/barModelLive';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { classifyEvidenceTier } from '../../../evaluation/diagnosis/types';

beforeEach(() => { vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ROWS = [{ label: 'Apples', value: 4, emoji: '🍎' }, { label: 'Pears', value: 2, emoji: '🍐' }, { label: 'Plums', value: 3, emoji: '🟣' }];
const MODES = ['read_one_to_one', 'most_least', 'compare_bars', 'match_to_bar', 'build_one_to_one', 'say_what_it_shows',
  'compare_two_graphs', 'read_scale', 'picture_graph', 'scaled_bar_graph', 'graph_word_problem', 'build_graph'] as const;
const SPOKEN = new Set<BarModelEvalMode>(['say_what_it_shows', 'compare_two_graphs']);

/** One answerable challenge per mode, in the shape the generator emits. */
function challengeFor(mode: BarModelEvalMode, id: string = mode): BarModelChallenge {
  const base = { id, evalMode: mode, prompt: `Question for ${mode}.`, values: ROWS, graphStyle: 'picture' as const,
    scale: { step: 1, max: 6, iconValue: 1 }, showBarValues: false };
  switch (mode) {
    case 'read_one_to_one': case 'read_scale': case 'picture_graph': case 'scaled_bar_graph': case 'graph_word_problem':
      return { ...base, expectedValue: 3, options: [2, 3, 5, 7], targetBarIndex: 2,
        ...(mode === 'scaled_bar_graph' || mode === 'read_scale' ? { graphStyle: 'scaled_bar' as const } : {}) };
    case 'most_least': case 'compare_bars': case 'match_to_bar': return { ...base, targetBarIndex: 0 };
    case 'build_one_to_one': return { ...base, values: ROWS.map(r => ({ ...r, value: 0 })), expectedCounts: [4, 2, 3] };
    case 'build_graph': return { ...base, graphStyle: 'bar', values: ROWS.map(r => ({ ...r, value: 0 })),
      expectedDataset: ROWS.map(r => ({ label: r.label, value: r.value })), expectedScaleStep: 2, availableScaleSteps: [1, 2, 5] };
    case 'compare_two_graphs': return { ...base, graphLabel: 'Morning', secondGraphLabel: 'Afternoon',
      secondValues: ROWS.map((r, i) => ({ ...r, value: i === 0 ? 1 : r.value })), comparisonFocus: 'different' };
    default: return base;
  }
}

function mount(evalMode: string, challenges: BarModelChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { title: 'Our graph', description: '', instanceId: 'graph', challenges } as BarModelData;
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BarModel data={data} runtimePlanItemId="plan-graph" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'graph',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const choose = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is a true comparison.' : 'Not quite.' } });
  return { runtime, transport, sent, view, state, dispatch, confirmVisible, choose, say, feedback };
}

it.each(MODES)('%s mounts under tutor ownership with no scripted cue or Next button, and publishes only a spoken key', mode => {
  const c = challengeFor(mode);
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).not.toMatch(/Say exactly|\[GRAPH_/);
  const expected = h.state().task!.workspace!.expectedAnswer;
  if (SPOKEN.has(mode)) {
    expect(expected).toMatch(/true comparison/);
    expect(h.state().task!.demand).toMatchObject({ response: 'speech' });
  } else {
    expect(expected).toBeUndefined();
    const demand = JSON.stringify(h.state().task!.demand);
    // Row counts, the target row and the build keys never reach the tutor on a gesture item.
    expect(demand).not.toMatch(/Apples 4|Plums 3|expected|target/i);
  }
  expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/ACTIVITY_START|CHALLENGE_START|PHASE_COMPLETE|ALL_COMPLETE|GRAPH_/);
  expect(screen.queryByRole('button', { name: /next challenge|finish session/i })).toBeNull();
});

it('an unbound mount (no runtime, or a pin outside the catalog) renders the needs-the-tutor card', () => {
  const data = { title: 'Our graph', description: '', instanceId: 'graph', challenges: [challengeFor('read_one_to_one')] } as BarModelData;
  const { container } = render(<BarModel data={data} runtimeEvalMode="read_one_to_one" />);
  expect(container.querySelector('[data-workspace-unbound="bar-model"]')).not.toBeNull();
  expect(screen.getByText('Our graph')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '3' })).toBeNull();
  cleanup();
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const off = render(<LiveRuntimeContext.Provider value={runtime}><BarModel data={data} runtimeEvalMode="not_a_mode" /></LiveRuntimeContext.Provider>);
  expect(off.container.querySelector('[data-workspace-unbound="bar-model"]')).not.toBeNull();
});

it('a sticker build never prints placed totals, even from an older payload', () => {
  mount('build_one_to_one', [{ ...challengeFor('build_one_to_one'), showPlacedCount: true }]);
  expect(screen.queryByText(/placed/)).toBeNull();
});

it('two related surveys render as countable rows, with no numeric choices', () => {
  mount('compare_two_graphs', [challengeFor('compare_two_graphs')]);
  expect(screen.getByText('Morning')).toBeTruthy();
  expect(screen.getByText('Afternoon')).toBeTruthy();
  expect(screen.getAllByText('🍎')).toHaveLength(5);
  expect(screen.queryByRole('button', { name: '4' })).toBeNull();
});

it('picture_graph submits every tapped choice and a structured packet naming the icon count, key and total', () => {
  seam.evaluationContext = { lesson: 'test' };
  const graph = (id: string, target: number, options: number[]): BarModelChallenge => ({
    id, evalMode: 'picture_graph', graphStyle: 'picture', prompt: 'Each 🐶 stands for 5. How many dogs?',
    showTargetHighlight: true, showBarValues: false, supportTier: 'medium', targetBarIndex: 0, expectedValue: target, options,
    values: [{ label: 'Dogs', value: target }, { label: 'Cats', value: 10 }, { label: 'Birds', value: 20 }, { label: 'Fish', value: 15 }],
    scale: { step: 5, max: 25, iconEmoji: '🐶', iconValue: 5 },
  });
  const h = mount('picture_graph', [graph('g1', 25, [5, 20, 25, 30]), graph('g2', 5, [0, 1, 5, 10])]);
  h.choose('5'); h.dispatch('retry'); h.choose('25');
  h.dispatch('advance'); h.confirmVisible();
  h.choose('5');
  h.dispatch('advance'); h.confirmVisible();
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.studentWork.selections).toEqual([{ challengeId: 'g1', selectedOptions: [5, 25] }, { challengeId: 'g2', selectedOptions: [5] }]);
  expect(work.studentWork.challengeResults[0].selectedOptions).toEqual([5, 25]);
  expect(classifyEvidenceTier(evidence)).toBe('structured');
  expect(evidence.phases).toHaveLength(1);
  expect(evidence.phases[0]).toMatchObject({ itemId: 'g1', expected: '25', observed: 'Selections in order: 5, 25' });
  expect(evidence.phases[0].challenge).toContain('shows 5 icons');
  expect(evidence.firstResponseScore).toBe(50);
});

it('a wrong number is committed, input stays closed until Try again clears it, then a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('read_one_to_one', [challengeFor('read_one_to_one', 'r1'), challengeFor('read_one_to_one', 'r2')]);
  h.choose('5');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Chose 5');
  expect(screen.getByRole('button', { name: '3' })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No number chosen yet' });
  h.choose('3');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('r2');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.choose('3');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][0]).toBe(true);
});

it('a row is tapped by its name; a sticker chart is built row by row and checked', () => {
  const rows = mount('most_least', [challengeFor('most_least')]);
  rows.choose('Pears row');
  expect(rows.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('Tapped the Pears row');
  cleanup();
  const h = mount('build_one_to_one', [challengeFor('build_one_to_one')]);
  for (const [row, n] of [['Apples', 4], ['Pears', 2], ['Plums', 3]] as const)
    for (let k = 0; k < n; k++) h.choose(`${row} row`);
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  act(() => { fireEvent.click(screen.getByRole('button', { name: /check my chart/i })); });
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('build_graph: bars and a step are set, and a wrong step is checked wrong', () => {
  const h = mount('build_graph', [challengeFor('build_graph')]);
  for (const r of ROWS) for (let k = 0; k < r.value; k++) h.choose(`Increase ${r.label}`);
  h.choose('Step of 5'); h.choose('Submit graph');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('scale step 5');
  h.dispatch('retry');
  for (const r of ROWS) for (let k = 0; k < r.value; k++) h.choose(`Increase ${r.label}`);
  h.choose('Step of 2'); h.choose('Submit graph');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a spoken explanation is judged by the tutor, and its committed success is recorded once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('compare_two_graphs', [challengeFor('compare_two_graphs')]);
  expect(h.state().task!.workspace!.expectedAnswer).toContain('Morning has more Apples than Afternoon.');
  h.say('the afternoon has more apples'); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say('morning has more apples');
  h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][0]).toBe(true);
});

it('without an evaluation provider (the live host) nothing is submitted', () => {
  const h = mount('compare_bars', [challengeFor('compare_bars')]);
  h.choose('Apples row');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});

it('validation refuses a spoken graph with no comparison to judge, and a choice whose key is not offered', () => {
  const flat = { ...challengeFor('compare_two_graphs'), secondValues: undefined };
  expect(() => validateBarModelData({ title: 'x', challenges: [flat] })).toThrow();
  expect(() => validateBarModelData({ title: 'x', challenges: [{ ...challengeFor('read_scale'), options: [1, 2] }] })).toThrow();
  expect(validateBarModelData({ title: 'x', challenges: MODES.map(m => challengeFor(m)) }).challenges).toHaveLength(12);
});

it('its fixture list covers every catalog mode, and validation holds', () => {
  expect([...LIVE_ADAPTERS['bar-model'].modes].sort()).toEqual([...MODES].sort());
});
