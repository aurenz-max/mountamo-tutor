// @vitest-environment jsdom
/**
 * propulsion-lab on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * predict and observe are code-keyed closed choices, tapped and checked or said aloud: the key is published only as
 * the spoken expectedAnswer, and the craft holds still until credit. experiment is two tests checked by code as a fair
 * test. A wrong answer names its miss, and every miss has a help lever first.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { PropulsionLabData } from './PropulsionLab';
import {
  askOf, buildPropulsionItems, emptyWork, fairTest, keyOf, MOTIONS, PROPULSION_MISSES, propulsionCorrect,
  propulsionHarnessAnswers, propulsionItems, propulsionMiss, pressesTo, seededRng, validPropulsionItem, works,
  workspaceAssignment, type ChoiceItem, type ExperimentItem, type ObserveItem, type PredictItem, type PropulsionItem,
  type PropulsionMode, type PropulsionTier,
} from './propulsionWorkspace';
import {
  AIR_MARKS_LEVER, BLAST_ARROWS_LEVER, CAN_PUSH_LEVER, COMPARE_TESTS_LEVER, HOW_IT_WORKS_LEVER, howLines,
  LABEL_STREAMS_LEVER, leverFact, motionLeak, ONE_STEP_LEVER, ONE_STREAM_LEVER, ONE_TEST_LEVER, possibleMisses,
  propulsionLevers, simplerItem, STREAM_UNITS_LEVER, unitLines,
} from './propulsionLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: PropulsionMode[] = ['predict', 'observe', 'experiment'];
const TIERS: PropulsionTier[] = ['easy', 'medium', 'hard'];

// Hand-built items: a propeller in space (key "Stays still"), a rocket fixed on facing forward (key "Moves left"), a
// jet blasting left (observe, "Moves right"), two opposite rocket streams 3 and 4 units ("Moves left"), a fair-test
// question on the jet with both tests starting on the propeller, and a throttle question starting in space.
const PROP_SPACE: PredictItem = { id: 'predict-1', mode: 'predict', place: 'space', thrusters: [{ engine: 'propeller', blast: 'left', size: 3 }], named: false };
const TURNED: PredictItem = { id: 'predict-2', mode: 'predict', place: 'air', thrusters: [{ engine: 'rocket', blast: 'right', size: 3 }], named: false };
const JET: ObserveItem = { id: 'observe-1', mode: 'observe', place: 'air', thrusters: [{ engine: 'jet', blast: 'left', size: 4 }] };
const TWO: ObserveItem = { id: 'observe-2', mode: 'observe', place: 'space', thrusters: [{ engine: 'rocket', blast: 'left', size: 3 }, { engine: 'rocket', blast: 'right', size: 4 }] };
const NEED_AIR: ExperimentItem = { id: 'experiment-1', mode: 'experiment', question: { vary: 'place', engine: 'jet' }, lockA: false,
  start: { a: { engine: 'propeller', place: 'air', throttle: 'low' }, b: { engine: 'propeller', place: 'air', throttle: 'low' } } };
const THROTTLE: ExperimentItem = { id: 'experiment-2', mode: 'experiment', question: { vary: 'throttle', engine: 'propeller' }, lockA: false,
  start: { a: { engine: 'propeller', place: 'space', throttle: 'low' }, b: { engine: 'propeller', place: 'space', throttle: 'high' } } };
const BY_MODE: Record<PropulsionMode, PropulsionItem[]> = { predict: [PROP_SPACE, TURNED], observe: [JET, TWO], experiment: [NEED_AIR, THROTTLE] };

const data = (mode: PropulsionMode, items = BY_MODE[mode]): PropulsionLabData =>
  ({ title: 'Push and Go Lab', overview: 'Try some engines.', challengeTypes: [mode], items, gradeBand: '3-5' });
const mount = (mode: PropulsionMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'propulsion-lab', evalMode: mode, instanceId: 'propulsion-lab', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const tap = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/Check Answer/); h.settle(); };
const run = (h: WorkspaceHarness, item: ExperimentItem, to: { a: ExperimentItem['start']['a']; b: ExperimentItem['start']['b'] }) => {
  for (const l of pressesTo(item.start, to)) h.press(l);
  h.press(/Run and check/); h.settle();
};
const current = (h: WorkspaceHarness, mode: PropulsionMode) => propulsionItems(data(mode)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('propulsion-lab')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  expect(JSON.stringify(demand(h))).not.toMatch(/have been run|has let go|ran the tests|\bcorrect\b/i);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(text(h)).not.toMatch(/Next →|Finish|NO THRUST|ACTION|REACTION|km\/h/);
  expect(h.view.container.querySelector('[aria-label="Read the question to me"]')).toBeNull();
  if (mode === 'experiment') {
    expect(demand(h).response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  } else {
    expect(demand(h).response).toBe('speech');
    const key = keyOf(item as ChoiceItem);
    expect(h.state().task!.workspace!.expectedAnswer).toMatch(new RegExp(`^"${key}"`));
    expect(String(demand(h).question)).not.toContain(key);
  }
  h.close();
});

it('predict: a wrong tap names its miss and closes the choices; Try again reopens; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('predict');
  expect(h.state().task!.itemId).toBe('predict-1');
  tap(h, 'Moves right');
  expect(last(h)).toMatchObject({ correct: false, miss: 'said_moves' });
  expect(demand(h).learnerWork).toBe('Chose "Moves right"');
  expect(demand(h).run).toBeUndefined();
  expect(h.view.container.querySelector('button[aria-label="Stays still"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  tap(h, 'Stays still');
  expect(last(h)).toMatchObject({ correct: true });
  expect(String(demand(h).run)).toMatch(/stays still/);
  expect(text(h)).toMatch(/In space the propeller has no air to push/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('predict-2');
  h.say('it moves left'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'propulsion-lab', challengesTotal: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'said_moves'], [true, null], [true, null]]);
  h.close();
});

it('predict: how_it_works, air_marks and blast_arrows change the screen and the scene in one commit; one_step turns the engine round', () => {
  const h = mount('predict');
  expect(levers(h)).toEqual([HOW_IT_WORKS_LEVER, AIR_MARKS_LEVER, BLAST_ARROWS_LEVER]);
  tap(h, 'Moves right');
  expect(nextLever(h.state().task!.workspace!.levers!, 'said_moves')).toBe(HOW_IT_WORKS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: HOW_IT_WORKS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="how-it-works"]')!.textContent).toMatch(/spins its blades to push air/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/spins its blades/);
  expect(h.dispatch('pull_lever', { lever: AIR_MARKS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="air-marks"]')!.textContent).toBe('No air here');
  expect(h.dispatch('pull_lever', { lever: BLAST_ARROWS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="blast-arrows"]')).not.toBeNull();
  expect(h.state().task!.workspace!.levers!.every(l => l.pulled)).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  tap(h, 'Stays still');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [HOW_IT_WORKS_LEVER, AIR_MARKS_LEVER, BLAST_ARROWS_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  expect(levers(h)).toEqual([HOW_IT_WORKS_LEVER, AIR_MARKS_LEVER, BLAST_ARROWS_LEVER, ONE_STEP_LEVER]);
  tap(h, 'Moves right');
  expect(last(h)!.miss).toBe('wrong_way');
  const step = h.dispatch('pull_lever', { lever: ONE_STEP_LEVER });
  expect(step.status).toBe('committed');
  expect(step.state.task).toMatchObject({ itemId: 'predict-2~simpler' });
  expect(h.view.container.querySelector('[data-practice="simpler"]')!.textContent).toMatch(/at its back, aimed to blast out to the left/);
  tap(h, 'Moves right');
  expect(last(h)).toMatchObject({ itemId: 'predict-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'predict-2' });
  tap(h, 'Moves left');
  expect(last(h)).toMatchObject({ itemId: 'predict-2', correct: true });
  h.close();
});

it('observe: the clamp holds until credit; label_streams and stream_units draw, one_stream keeps the smaller stream', () => {
  const h = mount('observe');
  expect(String(demand(h).shown)).toMatch(/blasts a stream 4 units long out to the left/);
  tap(h, 'Moves right');
  expect(last(h)).toMatchObject({ correct: true });
  expect(String(demand(h).run)).toMatch(/has let go/);
  h.dispatch('advance'); h.confirmVisible();
  tap(h, 'Stays still');
  expect(last(h)).toMatchObject({ correct: false, miss: 'said_still' });
  expect(levers(h)).toEqual([LABEL_STREAMS_LEVER, STREAM_UNITS_LEVER, ONE_STREAM_LEVER]);
  expect(h.dispatch('pull_lever', { lever: LABEL_STREAMS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="label-streams"]')!.textContent).toMatch(/its stream leaves to the left/);
  expect(h.dispatch('pull_lever', { lever: STREAM_UNITS_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/Left stream: 3 units, Right stream: 4 units/);
  const one = h.dispatch('pull_lever', { lever: ONE_STREAM_LEVER });
  expect(one.state.task).toMatchObject({ itemId: 'observe-2~simpler' });
  tap(h, 'Moves right');
  expect(last(h)).toMatchObject({ itemId: 'observe-2~simpler', correct: true });
  h.dispatch('advance');
  tap(h, 'Moves left');
  expect(last(h)).toMatchObject({ itemId: 'observe-2', correct: true });
  h.close();
});

it('experiment: a run is the check; two changes, cannot_show; compare_tests, can_push and one_test', () => {
  const h = mount('experiment');
  expect(levers(h)).toEqual([COMPARE_TESTS_LEVER, ONE_TEST_LEVER]);
  // The jet in both tests, but the throttle changed as well as the place.
  run(h, NEED_AIR, { a: { engine: 'jet', place: 'air', throttle: 'low' }, b: { engine: 'jet', place: 'space', throttle: 'high' } });
  expect(last(h)).toMatchObject({ correct: false, miss: 'changed_more_than_one' });
  expect(String(demand(h).run)).toMatch(/Test B \(jet engine, space, high throttle\): the craft stays still/);
  expect(h.view.container.querySelector('button[aria-label="Test B: Low"]')!.hasAttribute('disabled')).toBe(true);
  expect(h.dispatch('pull_lever', { lever: COMPARE_TESTS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="compare-tests"]')!.textContent).toMatch(/Throttle: different/);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).run).toBeUndefined();
  expect(String(demand(h).learnerWork)).toBe('Test A: propeller, air, low throttle. Test B: propeller, air, low throttle.');
  run(h, NEED_AIR, { a: { engine: 'jet', place: 'air', throttle: 'low' }, b: { engine: 'jet', place: 'space', throttle: 'low' } });
  expect(last(h)).toMatchObject({ correct: true, levers: [COMPARE_TESTS_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  expect(levers(h)).toEqual([COMPARE_TESTS_LEVER, CAN_PUSH_LEVER, ONE_TEST_LEVER]);
  h.press(/Run and check/); h.settle();
  expect(last(h)).toMatchObject({ correct: false, miss: 'cannot_show' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'cannot_show')).toBe(CAN_PUSH_LEVER);
  expect(h.dispatch('pull_lever', { lever: CAN_PUSH_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="can-push"]')!.textContent).toMatch(/has nothing to push here/);
  const one = h.dispatch('pull_lever', { lever: ONE_TEST_LEVER });
  expect(one.state.task).toMatchObject({ itemId: 'experiment-2~simpler' });
  expect(h.view.container.querySelector('button[aria-label="Test A: High"]')!.hasAttribute('disabled')).toBe(true);
  const practice = simplerItem(THROTTLE) as ExperimentItem;
  run(h, practice, propulsionHarnessAnswers(practice).correct);
  expect(last(h)).toMatchObject({ itemId: 'experiment-2~simpler', correct: true });
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: PropulsionMode) => TIERS.flatMap(tier => [1, 2, 3].flatMap(seed =>
    buildPropulsionItems({ modes: [mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds valid, keyed items at every tier', mode => {
    for (const { i, tier } of all(mode)) {
      expect(validPropulsionItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
      if (i.mode === 'experiment') expect(fairTest(i, i.start.a, i.start.b)).toBe(false);
      else expect(MOTIONS).toContain(keyOf(i));
    }
  });

  it('the tiers are structural', () => {
    for (const { i, tier } of all('predict')) {
      if (i.mode !== 'predict') continue;
      expect(i.named).toBe(tier === 'easy');
      expect(i.thrusters.length).toBe(tier === 'hard' ? 2 : 1);
      if (tier === 'easy') expect(i.thrusters[0].blast === 'left' || i.thrusters[0].engine === 'sail').toBe(true);
    }
    expect(all('predict').some(({ i, tier }) => tier === 'medium' && i.mode === 'predict' && i.thrusters[0].blast === 'right' && i.thrusters[0].engine !== 'sail')).toBe(true);
    expect(all('predict').some(({ i, tier }) => tier === 'hard' && i.mode === 'predict' && i.thrusters.some(t => !works(t.engine, i.place)))).toBe(true);
    for (const { i, tier } of all('observe')) {
      if (i.mode !== 'observe') continue;
      if (tier === 'easy') expect(i.thrusters.length).toBe(1);
      if (tier === 'hard') { expect(i.thrusters.length).toBe(2); expect(Math.abs(i.thrusters[0].size - i.thrusters[1].size)).toBeLessThanOrEqual(1); }
    }
    for (const { i, tier } of all('experiment')) {
      if (i.mode !== 'experiment') continue;
      expect(i.lockA).toBe(tier === 'easy');
      const d = ['engine', 'place', 'throttle'].filter(f => i.start.a[f as 'engine'] !== i.start.b[f as 'engine']).length;
      if (tier !== 'hard') expect(d).toBe(0);
      if (tier === 'hard' && i.question.vary !== 'throttle') expect(d).toBeGreaterThanOrEqual(2);
    }
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('propulsion-lab')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...PROPULSION_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = propulsionLevers(i, []);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(PROPULSION_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
      }
    }
    for (const mode of MODES) for (const { i } of all(mode)) {
      const a = propulsionHarnessAnswers(i);
      expect(propulsionCorrect(i, a.correct), i.id).toBe(true);
      expect(propulsionCorrect(i, a.plainWrong), i.id).toBe(false);
      expect(propulsionMiss(i, a.plainWrong), i.id).toBeDefined();
    }
  });

  it('no lever line or ask names where the craft goes', () => {
    for (const mode of ['predict', 'observe'] as PropulsionMode[]) for (const { i } of all(mode)) {
      if (i.mode === 'experiment') continue;
      const lines = [...(i.mode === 'predict' ? howLines(i) : unitLines(i)),
        leverFact(i, propulsionLevers(i, []).filter(l => l.kind === 'help').map(l => l.id))];
      for (const line of lines) expect(motionLeak(line), `${i.id}: ${line}`).toBe(false);
      expect(askOf(i), i.id).not.toContain(keyOf(i).toLowerCase());
      expect(askOf(i), i.id).not.toMatch(/\b(moves|stays still|goes)\b/i);
    }
  });

  it('the simpler item stays in the mode, never repeats the key, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) continue;
      expect(s.mode).toBe(mode);
      expect(simplerItem(s)).toBeNull();
      expect(propulsionLevers(s, [])).toEqual([]);
      if (s.mode !== 'experiment' && i.mode !== 'experiment') expect(keyOf(s)).not.toBe(keyOf(i));
      if (s.mode === 'experiment') { expect(s.lockA).toBe(true); expect(fairTest(s, s.start.a, s.start.b)).toBe(false); }
    }
    expect(simplerItem(PROP_SPACE)).toBeNull();
    expect(simplerItem(JET)).toBeNull();
  });

  it('a legacy lesson (model-written challenges) still builds code items in its modes', () => {
    const legacy = { title: 'Action and Reaction', challenges: [{ type: 'predict' }, { type: 'experiment' }] };
    const items = propulsionItems(legacy);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['predict', 'experiment']));
    expect(propulsionItems(legacy)).toEqual(items);
    expect(emptyWork(NEED_AIR).a).toEqual(NEED_AIR.start.a);
  });
});
