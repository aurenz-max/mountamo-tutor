// @vitest-environment jsdom
/**
 * construction-sequence-planner on its boss (three plan boards and a SAY_OR_SHOW total on the spoken preset) and its
 * lever set: what is its own. The generic W1 contract (runtime/workspaceContract.test.tsx) and boss.test.ts cover
 * ownership, the packet and the wiring.
 * sequence, dependency_chain and parallel are plans checked by code (no key reaches the tutor); critical_path is a
 * total said aloud or tapped, keyed only as the spoken key (`cspKey`). A wrong plan names its miss, is built on screen
 * up to where it stops, and every miss has a help lever first.
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
import type { ConstructionSequencePlannerData } from './ConstructionSequencePlanner';
import {
  askOf, buildCspItems, buildOrder, chainsOf, criticalOptions, criticalWeeks, CSP_MISSES, CSP_MODES, cspCorrect, cspHarnessAnswers,
  cspItems, cspKey, cspMiss, cspTaps, emptyWork, fewestWeeks, PROJECT_IDS, seededRng, SIZE, validCspItem,
  type CspItem, type CspMode, type CspTier, type Job,
} from './constructionSequenceWorkspace';
import {
  chainLines, CHECK_AS_YOU_GO_LEVER, CSP_LEVERS, FEWER_JOBS_LEVER, leverLeak, possibleMisses, SAME_NEEDS_LEVER,
  sameNeedsTags, simplerItem, TICK_NEEDS_LEVER, TRACE_CHAINS_LEVER, WEEK_BLOCKS_LEVER,
} from './constructionSequenceLevers';
import { constructionSequencePlannerBoss } from './constructionSequencePlanner.boss';

const cspLevers = (i: CspItem, pulled: string[] = []) => CSP_LEVERS.declare(i, emptyWork(), pulled);
const leverFact = (i: CspItem, pulled: string[]) => CSP_LEVERS.onScreen(i, emptyWork(), pulled);

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const TIERS: CspTier[] = ['easy', 'medium', 'hard'];
const J = (id: string, name: string, needs: string[] = [], weeks = 1): Job => ({ id, name, icon: '🔨', weeks, needs });

// Hand-built items: a 4-job house chain shown in a broken order and a 3-job playground chain (sequence); a bridge with
// beams needing piers and ends, and a road with paving needing gravel and drains (dependency_chain); a house where three
// jobs need the frame, free and with two crews (parallel); a house whose roof chain is longest (critical_path).
const SEQ: CspItem = { id: 'sequence-1', mode: 'sequence', project: 'house', jobs: [
  J('frame', 'Frame the walls', ['foundation']), J('dig', 'Dig the base'), J('roof', 'Put on the roof', ['frame']), J('foundation', 'Pour the foundation', ['dig'])] };
const SEQ_B: CspItem = { id: 'sequence-2', mode: 'sequence', project: 'playground', jobs: [
  J('posts', 'Set the posts in concrete', ['holes']), J('bars', 'Bolt on the top bars', ['posts']), J('holes', 'Dig the post holes')] };
const DEP: CspItem = { id: 'dependency_chain-1', mode: 'dependency_chain', project: 'bridge', jobs: [
  J('beams', 'Lift the beams into place', ['piers', 'ends']), J('piers', 'Build the piers', ['footings']), J('ends', 'Build the end supports'), J('footings', 'Dig the footing holes')] };
const DEP_B: CspItem = { id: 'dependency_chain-2', mode: 'dependency_chain', project: 'road', jobs: [
  J('pave', 'Pave with asphalt', ['gravel', 'drains']), J('gravel', 'Spread the gravel', ['level']), J('level', 'Level the ground'), J('drains', 'Lay the drain pipes', ['level'])] };
const parJobs = () => [J('wires', 'Run the electric wires', ['frame']), J('roof', 'Put on the roof', ['frame']), J('foundation', 'Pour the foundation'),
  J('windows', 'Put in the windows', ['frame']), J('frame', 'Frame the walls', ['foundation'])];
const PAR: CspItem = { id: 'parallel-1', mode: 'parallel', project: 'house', jobs: parJobs(), deadline: 3 };
const PAR_CREWS: CspItem = { id: 'parallel-2', mode: 'parallel', project: 'house', jobs: parJobs(), crews: 2, deadline: 4 };
const critJobs = [J('foundation', 'Pour the foundation', [], 1), J('frame', 'Frame the walls', ['foundation'], 4), J('roof', 'Put on the roof', ['frame'], 4),
  J('pipes', 'Run the water pipes', ['frame'], 1), J('wires', 'Run the electric wires', ['frame'], 1)];
const CRIT: CspItem = { id: 'critical_path-1', mode: 'critical_path', project: 'house', jobs: critJobs, options: criticalOptions({ id: '', mode: 'critical_path', project: 'house', jobs: critJobs }) };
const BY_MODE: Record<CspMode, CspItem[]> = { sequence: [SEQ, SEQ_B], dependency_chain: [DEP, DEP_B], parallel: [PAR, PAR_CREWS], critical_path: [CRIT] };

const data = (mode: CspMode, items = BY_MODE[mode]): ConstructionSequencePlannerData =>
  ({ title: 'Build It Right', description: 'Plan a build.', challengeTypes: [mode], items, gradeLevel: '3' });
const mount = (mode: CspMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'construction-sequence-planner', evalMode: mode, instanceId: 'construction-sequence-planner', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const enter = (h: WorkspaceHarness, item: CspItem, work: ReturnType<typeof cspHarnessAnswers>['correct']) => {
  for (const l of cspTaps(item, work)) h.press(l);
  h.press(/Check/); h.settle();
};
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(CSP_MODES)('%s binds with its key only in the spoken key, out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('construction-sequence-planner')!.evalModes!.map(m => m.evalMode)).toEqual(CSP_MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(constructionSequencePlannerBoss.assignment(item).task);
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/build ran|stopped at|timeline is drawn/i);
  expect(h.view.container.querySelector('[data-lever], [data-build-run], [data-timeline]')).toBeNull();
  expect(text(h)).not.toMatch(/Next →|Finish|Critical Path|Hint/);
  // Taught only on the workspace: no read-the-task button, Next or reveal of its own.
  expect(h.view.container.querySelector('[aria-label="Read the task to me"]')).toBeNull();
  if (mode === 'critical_path') {
    expect(constructionSequencePlannerBoss.assignment(item)).toMatchObject({ response: 'speech', acceptsGesture: true });
    expect(demand(h).response).toBe('speech');
    expect(cspKey(item)).toMatchObject({ answer: '9 weeks', alsoAccept: ['9', 'nine'] });
    expect(h.state().task!.workspace!.expectedAnswer).toContain('"9"');
    expect(String(demand(h).question)).not.toMatch(/\d/);
  } else {
    expect(cspKey(item)).toBeNull();
    expect(demand(h).response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  }
  // sequence hides what each job needs, on screen and in the scene; the other modes show it.
  if (mode === 'sequence') { expect(facts).not.toMatch(/\(needs|needs nothing/); expect(text(h)).not.toMatch(/Needs/); }
  else expect(text(h)).toMatch(/Needs/);
  h.close();
});

it('the harness says the critical_path total, and plays every plan through its cards and the check', () => {
  const play = (right: boolean, item: CspItem) => constructionSequencePlannerBoss.drive.play(right, item, {} as never);
  expect(play(true, CRIT).at(-1)).toEqual({ type: 'answer', text: '9 weeks' });
  expect(play(false, CRIT).at(-1)).not.toEqual({ type: 'answer', text: '9 weeks' });
  for (const item of [SEQ, DEP, PAR]) {
    const a = cspHarnessAnswers(item);
    expect(play(true, item)).toEqual([...cspTaps(item, a.correct).map(label => ({ type: 'choose', label })), { type: 'check' }]);
    expect(play(false, item)).toEqual([...cspTaps(item, a.plainWrong).map(label => ({ type: 'choose', label })), { type: 'check' }]);
  }
});

it('sequence: a wrong plan names its miss and stops the build there; check_as_you_go marks; fewer_jobs opens a simpler chain', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('sequence');
  expect(levers(h)).toEqual([[CHECK_AS_YOU_GO_LEVER, 'help', false], [FEWER_JOBS_LEVER, 'simplify', false]]);
  const a = cspHarnessAnswers(SEQ);
  enter(h, SEQ, a.plainWrong);
  expect(last(h)).toMatchObject({ correct: false, miss: 'swapped_neighbors' });
  expect(String(demand(h).run)).toBe('The build ran the plan and stopped at job 3, "Put on the roof": a job it needs had not been done yet.');
  expect(h.view.container.querySelector('[data-block="stopped"]')!.textContent).toMatch(/Put on the roof/);
  expect(h.view.container.querySelector('button[aria-label="Take out Put on the roof"]')!.hasAttribute('disabled')).toBe(true);
  expect(nextLever(h.state().task!.workspace!.levers!, 'swapped_neighbors')).toBe(CHECK_AS_YOU_GO_LEVER);
  expect(h.dispatch('pull_lever', { lever: CHECK_AS_YOU_GO_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/Marked now: "Put on the roof"/);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'The plan is empty' });
  expect(demand(h).run).toBeUndefined();
  // A job placed before what it needs is marked on screen as the learner builds.
  h.press('Put on the roof');
  expect(h.view.container.querySelector('[data-lever="check-as-you-go"]')).not.toBeNull();
  h.press('Take out Put on the roof');
  enter(h, SEQ, a.correct);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [CHECK_AS_YOU_GO_LEVER] });
  expect(String(demand(h).run)).toMatch(/every job had what it needs/);
  // fewer_jobs on the 4-job chain: a 3-job chain on another project, then this item back.
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('sequence-2');
  expect(levers(h).map(([id]) => id)).toEqual([CHECK_AS_YOU_GO_LEVER]);
  enter(h, SEQ_B, cspHarnessAnswers(SEQ_B).correct);
  h.dispatch('advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'construction-sequence-planner', totalTasks: 2, correctlyOrderedTasks: 2 });
  expect(work.teachingAttempts.map((t: { correct: boolean; miss?: string }) => [t.correct, t.miss ?? null]))
    .toEqual([[false, 'swapped_neighbors'], [true, null], [true, null]]);
  h.close();
});

it('sequence: fewer_jobs opens a chain from another project and the full item comes back', () => {
  const h = mount('sequence');
  enter(h, SEQ, cspHarnessAnswers(SEQ).plainWrong);
  const step = h.dispatch('pull_lever', { lever: FEWER_JOBS_LEVER });
  expect(step.status).toBe('committed');
  expect(step.state.task).toMatchObject({ itemId: 'sequence-1~simpler' });
  const practice = simplerItem(SEQ)!;
  expect(practice.jobs).toHaveLength(3);
  expect(practice.project).not.toBe('house');
  expect(h.view.container.querySelector('[data-practice="simpler"]')).not.toBeNull();
  enter(h, practice, cspHarnessAnswers(practice).correct);
  expect(last(h)).toMatchObject({ itemId: 'sequence-1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'sequence-1' });
  enter(h, SEQ, cspHarnessAnswers(SEQ).correct);
  expect(last(h)).toMatchObject({ itemId: 'sequence-1', correct: true });
  h.close();
});

it('dependency_chain: a join placed after one need is missed_second_need; tick_needs ticks the placed needs', () => {
  const h = mount('dependency_chain');
  expect(levers(h).map(([id]) => id)).toEqual([CHECK_AS_YOU_GO_LEVER, TICK_NEEDS_LEVER, FEWER_JOBS_LEVER]);
  enter(h, DEP, cspHarnessAnswers(DEP).plainWrong);
  expect(last(h)).toMatchObject({ correct: false, miss: 'missed_second_need' });
  expect(String(demand(h).run)).toMatch(/stopped at job \d, "Lift the beams into place"/);
  expect(h.dispatch('pull_lever', { lever: TICK_NEEDS_LEVER }).status).toBe('committed');
  h.dispatch('retry'); h.confirmVisible();
  h.press('Dig the footing holes');
  // The card for the piers now ticks its need.
  expect(h.view.container.querySelector('button[aria-label="Build the piers"]')!.textContent).toMatch(/Dig the footing holes ✓/);
  h.press('Take out Dig the footing holes');
  enter(h, DEP, cspHarnessAnswers(DEP).correct);
  expect(last(h)).toMatchObject({ correct: true, levers: [TICK_NEEDS_LEVER] });
  h.close();
});

it('parallel: a job in its need\'s week is need_same_week; same_needs tags; crews over the limit are crew_over', () => {
  const h = mount('parallel');
  expect(levers(h).map(([id]) => id)).toEqual([CHECK_AS_YOU_GO_LEVER, SAME_NEEDS_LEVER, FEWER_JOBS_LEVER]);
  enter(h, PAR, cspHarnessAnswers(PAR).plainWrong);
  expect(last(h)).toMatchObject({ correct: false, miss: 'need_same_week' });
  expect(String(demand(h).run)).toMatch(/stopped in week \d at/);
  expect(h.dispatch('pull_lever', { lever: SAME_NEEDS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="same-needs"]').length).toBe(3);
  expect(String(demand(h).onScreen)).toMatch(/A: Run the electric wires, Put on the roof, Put in the windows/);
  h.dispatch('retry'); h.confirmVisible();
  // One job a week: every need is met, but it runs past the goal.
  const slow = { ...cspHarnessAnswers(PAR).correct, week: Object.fromEntries(buildOrder(PAR).map((id, i) => [id, Math.min(i + 1, 5)])) };
  enter(h, PAR, slow);
  expect(last(h)).toMatchObject({ correct: false, miss: 'too_many_weeks' });
  expect(String(demand(h).run)).toMatch(/takes 5 weeks, not 3/);
  h.dispatch('retry'); h.confirmVisible();
  enter(h, PAR, cspHarnessAnswers(PAR).correct);
  expect(last(h)).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('parallel-2');
  const crowded = { ...cspHarnessAnswers(PAR_CREWS).correct, week: { foundation: 1, frame: 2, roof: 3, wires: 3, windows: 3 } };
  enter(h, PAR_CREWS, crowded);
  expect(last(h)).toMatchObject({ correct: false, miss: 'crew_over' });
  h.close();
});

it('critical_path: adding every job is added_all; trace_chains and week_blocks draw; a spoken total is credited', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('critical_path');
  expect(levers(h).map(([id]) => id)).toEqual([TRACE_CHAINS_LEVER, WEEK_BLOCKS_LEVER, FEWER_JOBS_LEVER]);
  h.press('11 weeks'); h.press(/Check Answer/); h.settle();
  expect(last(h)).toMatchObject({ correct: false, miss: 'added_all' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'added_all')).toBe(TRACE_CHAINS_LEVER);
  expect(h.dispatch('pull_lever', { lever: TRACE_CHAINS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="trace-chains"]')!.textContent).toMatch(/Pour the foundation → Frame the walls → Put on the roof/);
  expect(h.dispatch('pull_lever', { lever: WEEK_BLOCKS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="week-blocks"]').length).toBe(5);
  expect(h.view.container.querySelector('[data-timeline]')).toBeNull();
  h.dispatch('retry'); h.confirmVisible();
  h.say('nine weeks'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: CspMode) => TIERS.flatMap(tier => PROJECT_IDS.flatMap(project =>
    buildCspItems({ modes: [mode], tier, project, rng: seededRng(`${mode}${tier}${project}`) }).map(i => ({ i, tier }))));

  it.each(CSP_MODES)('%s builds valid, keyed items at every tier and project', mode => {
    for (const { i, tier } of all(mode)) {
      expect(validCspItem(i), `${mode} ${tier} ${i.id}`).toBe(true);
      expect(i.jobs).toHaveLength(SIZE[mode][tier]);
      expect(buildOrder(i)).toHaveLength(i.jobs.length);
    }
    for (const tier of TIERS) for (const project of PROJECT_IDS) {
      expect(buildCspItems({ modes: [mode], tier, project, rng: seededRng(`${tier}${project}`) }).length, `${mode} ${tier} ${project}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('the tiers are structural', () => {
    for (const { i } of all('dependency_chain')) expect(i.jobs.some(j => j.needs.length >= 2)).toBe(true);
    for (const { i, tier } of all('parallel')) {
      expect(!!i.crews).toBe(tier === 'hard');
      expect(i.deadline).toBe(fewestWeeks(i, i.crews));
      expect(i.deadline!).toBeLessThan(i.jobs.length);
      if (tier === 'hard') expect(fewestWeeks(i, 2)).toBeGreaterThan(fewestWeeks(i));
    }
    for (const { i, tier } of all('critical_path')) {
      const chains = chainsOf(i), most = Math.max(...chains.map(c => c.length));
      const trap = !chains.filter(c => c.length === most).some(c => c.reduce((s, id) => s + i.jobs.find(j => j.id === id)!.weeks, 0) === criticalWeeks(i));
      expect(trap, i.id).toBe(tier === 'hard');
      expect(i.options).toHaveLength(4);
    }
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('construction-sequence-planner')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of CSP_MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...CSP_MISSES[mode]].sort());
      for (const { i } of all(mode)) {
        const ls = cspLevers(i, []);
        const misses = possibleMisses(i);
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(CSP_MISSES[mode]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
        const a = cspHarnessAnswers(i);
        expect(cspCorrect(i, a.correct), i.id).toBe(true);
        expect(cspCorrect(i, a.plainWrong), i.id).toBe(false);
        expect(cspMiss(i, a.plainWrong), i.id).toBeDefined();
      }
    }
  });

  it('no lever line, ask or scene before a check gives the order, a week or the total', () => {
    for (const mode of CSP_MODES) for (const { i } of all(mode)) {
      if (i.mode === 'critical_path') {
        for (const l of chainLines(i)) expect(leverLeak(l), l).toBe(false);
        expect(askOf(i)).not.toMatch(/\d/);
      }
      if (i.mode === 'parallel') for (const t of Object.values(sameNeedsTags(i))) expect(t).toMatch(/^[A-Z]$/);
      const fact = leverFact(i, cspLevers(i, []).filter(l => l.kind === 'help').map(l => l.id));
      if (i.mode === 'critical_path') expect(fact).not.toMatch(new RegExp(`\\b${criticalWeeks(i)}\\b`));
      // The cards are never shown in an order that already works.
      if (i.mode !== 'critical_path') expect(buildOrder(i)).not.toEqual(i.jobs.map(j => j.id));
    }
  });

  it('the simpler item stays in the mode, uses another project, never repeats a job or the total, and never shrinks twice', () => {
    for (const mode of CSP_MODES) for (const { i } of all(mode)) {
      const s = simplerItem(i);
      if (!s) { expect(i.jobs.length).toBe(SIZE[mode].easy); continue; }
      expect(s.mode).toBe(mode);
      expect(s.jobs.length).toBe(i.jobs.length - 1);
      expect(s.project).not.toBe(i.project);
      expect(s.jobs.some(j => i.jobs.some(k => k.name === j.name))).toBe(false);
      if (mode === 'critical_path') expect(criticalWeeks(s)).not.toBe(criticalWeeks(i));
      expect(simplerItem(s)).toBeNull();
    }
  });

  it('a legacy lesson (model-written tasks) still builds code items in its modes', () => {
    const legacy = { title: 'Build a Cozy House!', projectType: 'house', gradeLevel: '3',
      tasks: [{ id: 'x', name: 'X', dependencies: [] }], challenges: [{ type: 'sequence' }, { type: 'deadline' }] };
    const items = cspItems(legacy as never);
    expect(new Set(items.map(i => i.mode))).toEqual(new Set(['sequence', 'parallel']));
    expect(cspItems(legacy as never)).toEqual(items);
  });
});
