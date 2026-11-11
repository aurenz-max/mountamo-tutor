// @vitest-environment jsdom
/**
 * The real LifeLab on the shared teaching workspace, its only teaching path, with the real TeachingSession,
 * LiveLessonRuntime, transport and rendering shell. The Live context, evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'life-lab',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import LifeLab, { type LifeLabData } from './LifeLab';
import { __test } from '../../../../service/biology/life-lab/agent-life-lab';
import { COVERAGE } from './lifeLab.fixtures';
import { worldChecks, type LifeLabMode } from './lifeLabWorld';
import { lifeLabBoss } from './lifeLab.boss';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** A session of the coverage worlds, assembled the way the author's finish does. */
export function coverageSession(modes: LifeLabMode[], seed = 1): LifeLabData {
  const entries = modes.map(m => {
    const c = COVERAGE[m], k = worldChecks(c.world, c.ask, c.why);
    return { draft: { world: c.world, ask: c.ask, why: c.why }, mode: k.mode, key: k.key, band: k.difficulty?.band, blocking: [] };
  });
  return __test.assembleLifeLab({ plan: { title: 'Living things', idea: 'Living things need the right place' }, entries, ctx: {} }, seed, 2, {});
}

function mount(data: LifeLabData, mode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <LifeLab data={{ ...data, instanceId: 'life-lab' }} runtimePlanItemId="plan-life" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const dispatch = (name: string) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'life-lab', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action as NonNullable<typeof a>['action'] }); });
  };
  const tap = (pip: string) => act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="${pip}"]`)!); });
  const done = () => act(() => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
  const runIt = (name: RegExp) => { act(() => { fireEvent.click(screen.getByRole('button', { name })); }); act(() => { vi.advanceTimersByTime(10000); }); };
  const demand = () => JSON.stringify(state().task!.demand);
  return { state, dispatch, tap, done, runIt, demand };
}

it('binds as a gesture with no key; the scene names the places and animals but never the right homes', () => {
  const h = mount(coverageSession(['where_it_lives', 'part_for_the_job']), 'world');
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  expect(h.demand()).toContain('Icy sea');
  expect(h.demand()).toContain('polar bear');
  expect(h.demand()).not.toMatch(/polar bear → Icy sea/);
  h.runIt(/Grow 3 days/);
  expect(screen.getAllByText(/Struggling: hot is wrong for it/).length).toBeGreaterThan(0);
  expect(h.demand()).toContain('try 1:');
});

it('a wrong home commits its miss; Try again reopens the start; moving every animal home completes the world', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(coverageSession(['where_it_lives', 'part_for_the_job']), 'world');
  h.done();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)!.miss).toBe('wrong_home');
  h.dispatch('retry');
  for (const [b, z] of [['bear', 'ice'], ['camel', 'desert'], ['frog', 'pond']]) { h.tap(`being-${b}`); h.tap(`zone-${z}`); }
  h.done();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a part: published as speech that also takes the tap; the long beak fails with a reason; the thick beak eats', () => {
  const h = mount(coverageSession(['part_for_the_job', 'where_it_lives']), 'world');
  expect(h.state().task!.demand).toMatchObject({ response: 'speech' });
  expect(lifeLabBoss.assignment(coverageSession(['part_for_the_job', 'where_it_lives']).challenges[0])).toMatchObject({ response: 'speech', acceptsGesture: true });
  expect(lifeLabBoss.assignment(coverageSession(['where_it_lives', 'part_for_the_job']).challenges[0])).toMatchObject({ response: 'gesture' });
  expect(h.demand()).not.toContain('thick short beak"');
  h.runIt(/Try it/);
  expect(screen.getByText(/long thin beak cannot get at the hard seeds/)).toBeTruthy();
  h.tap('opt-thick');
  h.done();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a prediction is committed before the families play; the run then shows what happened', () => {
  const h = mount(coverageSession(['survive_and_change', 'life_cycle']), 'world');
  expect(screen.queryByRole('button', { name: /Let the hunter look/ })).toBeNull();
  h.tap('predict-light');
  h.done();
  act(() => { vi.advanceTimersByTime(10000); });
  expect(h.state().task!.workspace!.attempts.at(-1)!.miss).toBe('wrong_prediction');
  expect(screen.getByText(/Not what you predicted/)).toBeTruthy();
});

it('a life cycle on a shuffled bench: a foreign stage is named; the real order completes', () => {
  const h = mount(coverageSession(['life_cycle', 'whose_baby']), 'world');
  for (const s of ['egg', 'tadpole', 'chrysalis', 'butterfly']) h.tap(`item-${s}`);
  h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)!.miss).toBe('not_in_cycle');
  h.dispatch('retry');
  h.tap('clear-order');
  for (const s of ['egg', 'caterpillar', 'chrysalis', 'butterfly']) h.tap(`item-${s}`);
  h.done();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('Learn more sits on its own question, opens on a tap, and the tutor can read the words', () => {
  const c = COVERAGE.where_it_lives, k = worldChecks(c.world, c.ask, c.why);
  const world = { draft: { world: c.world, ask: c.ask, why: c.why }, mode: k.mode, key: k.key, band: k.difficulty?.band, blocking: [] };
  const data = __test.assembleLifeLab({ plan: { title: 'Homes', idea: 'i' }, ctx: {},
    entries: [{ ...world, terms: [{ term: 'Habitat', means: 'The place where a living thing makes its home.' }] }, world] }, 1, 3, {});
  const h = mount(data, 'world');
  const drawer = screen.getByRole('button', { name: 'Learn more' });
  expect(drawer.getAttribute('aria-expanded')).toBe('false');
  act(() => { fireEvent.click(drawer); });
  expect(drawer.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText(/makes its home/)).toBeTruthy();
  expect(h.demand()).toContain('Habitat: The place where a living thing makes its home.');
});

it('teach frames open first; then a kit item is picked on the board, a wrong card names its miss, and the right one completes', () => {
  const cell = (beans: number) => ({ kind: 'cell', cell: 'animal', parts: [{ shape: 'round' }, { shape: 'bean', count: beans }] });
  const written = __test.readItem({ plan: { title: 't', idea: 'i' }, entries: [], ctx: {} } as never, {
    surface: 'choose', prompt: 'Which cell comes from a muscle that works all day?',
    options: [{ id: 'many', display: cell(9) }, { id: 'few', display: cell(3) }], answer: 'many',
    misconceptions: [{ id: 'few', idea: 'Think about how much work this muscle does.' }],
    teach: [{ says: 'Muscles need energy.', show: [{ kind: 'zoom', levels: [{ label: 'Runner', icon: '🏃' }, { label: 'Muscle', icon: '💪' }] }] },
      { says: 'Tiny parts in the cell make it.', show: [{ kind: 'cell', parts: [{ shape: 'bean', count: 4, label: 'energy parts' }] }] }],
  });
  if ('error' in written) throw new Error(written.error);
  expect(written.item.blocking).toEqual([]);
  const c = COVERAGE.where_it_lives, k = worldChecks(c.world, c.ask, c.why);
  const data = __test.assembleLifeLab({ plan: { title: 'Cells', idea: 'The idea is not shown to the child' }, ctx: {},
    entries: [written.item, { draft: { world: c.world, ask: c.ask, why: c.why }, mode: k.mode, key: k.key, band: k.difficulty?.band, blocking: [] }] }, 1, 3, {});
  const h = mount(data, 'world');
  expect(screen.queryByText(/The idea is not shown/)).toBeNull();
  expect(screen.getByText('Muscles need energy.')).toBeTruthy();
  expect(document.querySelector('[data-pip-object="card-many"]')).toBeNull();
  expect(h.demand()).toContain('Muscles need energy.');
  h.tap('teach-next');
  expect(screen.getByText('Tiny parts in the cell make it.')).toBeTruthy();
  h.tap('teach-next');
  expect(screen.queryByText('Tiny parts in the cell make it.')).toBeNull();
  expect(h.state().task!.demand).toMatchObject({ response: 'gesture' });
  h.tap('card-few');
  h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)!.miss).toBe('wrong_choice');
  expect(screen.getByText(/how much work this muscle does/)).toBeTruthy();
  h.dispatch('retry');
  expect(document.querySelector('[data-teach-panel]')).toBeNull();
  h.tap('card-many');
  h.done();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a fair test: changing one pot\'s light only passes', () => {
  const h = mount(coverageSession(['fair_test', 'what_it_needs']), 'world');
  h.tap('cond-pot2-light-down'); h.tap('cond-pot2-light-down');
  h.done();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});
