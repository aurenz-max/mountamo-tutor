// @vitest-environment jsdom
/**
 * Strategy picker on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { StrategyPickerChallenge } from './StrategyPicker';
import { CHECK_LABEL, strategyPickerHarnessInputs } from './strategyPickerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const problem = { equation: '3 + 4', operation: 'addition' as const, operand1: 3, operand2: 4, result: 7 };
const guided: StrategyPickerChallenge = { id: 'g1', type: 'guided-strategy', instruction: 'Solve it by counting on!', problem,
  assignedStrategy: 'counting-on', strategySteps: ['Start at the bigger number.', 'Count up the smaller number.'] };
const tryAnother: StrategyPickerChallenge = { id: 't1', type: 'try-another', instruction: 'Now try it with tally marks!', problem,
  assignedStrategy: 'tally-marks', strategySteps: ['Draw a mark for each.', 'Count them all.'] };
const match: StrategyPickerChallenge = { id: 'm1', type: 'match-strategy', instruction: 'Which strategy did they use?', problem,
  workedSolution: 'I started at 3 and hopped 4 times on the number line.',
  strategyOptions: ['doubles', 'counting-on', 'tally-marks'], correctStrategy: 'counting-on' };
const compare: StrategyPickerChallenge = { id: 'c1', type: 'compare', instruction: 'You solved it two ways!', problem,
  strategies: ['counting-on', 'tally-marks'], comparisonQuestion: 'Which way felt easier?' };
const choose: StrategyPickerChallenge = { id: 'ch1', type: 'choose-your-strategy', instruction: 'Pick any strategy you like!', problem,
  availableStrategies: ['counting-on', 'tally-marks'] };
const BY_MODE: Record<string, StrategyPickerChallenge> = { guided, match, try_another: tryAnother, compare, choose };
const GRADED = Object.entries(BY_MODE).filter(([mode]) => mode !== 'compare');

const picker = (challenges: StrategyPickerChallenge[]) => ({ title: 'Strategies', challenges, maxNumber: 10,
  operations: ['addition'] as const, strategiesIntroduced: ['counting-on', 'tally-marks', 'doubles'], gradeBand: '1' });

type Mounted = ReturnType<typeof mountWorkspace>;
/** The journey's own inputs, performed through the picker's controls. */
function perform(h: Mounted, c: StrategyPickerChallenge, wrong: boolean) {
  for (const input of strategyPickerHarnessInputs(c, wrong)) h.press(input.label);
}
const check = (h: Mounted) => Array.from(h.view.container.querySelectorAll('button')).find(b => b.textContent === CHECK_LABEL)!;

it('every catalog mode binds', () => {
  const modes = (getComponentById('strategy-picker')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(BY_MODE).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'strategy-picker', pin: mode, objectiveIds: ['o'],
      data: picker([BY_MODE[mode]]) }), mode).not.toBeNull();
  }
});

it.each(GRADED)('%s: a checked gesture that publishes no key; a wrong Check reopens clean on Try again, the right one completes once',
  async (mode, c) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: mode, data: picker([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    const published = JSON.stringify(task);
    for (const key of ['result', 'correctStrategy']) expect(published).not.toContain(key);
    if (c.type === 'match-strategy') {
      // The options are on screen; nothing else names the one the solution used.
      const { choices, ...rest } = task.demand as Record<string, unknown>;
      expect(choices).toBe('Doubles | Counting On | Tally Marks');
      expect(JSON.stringify({ ...task, demand: rest })).not.toMatch(/counting.on/i);
    } else {
      expect(published).not.toMatch(/\b7\b/);
    }

    perform(h, c, true);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    // Input is closed until Try again: no second Check on the same miss.
    expect(check(h).disabled).toBe(true);
    h.dispatch('retry');
    // Try again clears the rejected number or pick, so Check stays closed until new work.
    expect(check(h).disabled).toBe(true);
    if (c.type !== 'match-strategy') expect(h.view.container.textContent).toContain('Answer:−?+');

    // Choose keeps its menu pick through Try again: only the number was rejected.
    const picked = (h.state().task!.demand as Record<string, unknown>).chosen;
    if (c.type === 'choose-your-strategy') expect(picked).toBe('Counting On');
    for (const input of strategyPickerHarnessInputs(c, false, !!picked)) h.press(input.label);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('compare: a reflection with no wrong answer; any choice is credited and completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: 'compare', data: picker([compare]) });
  expect(h.state().task!.task).toBe('You solved it two ways! Which way felt easier?');
  expect(() => strategyPickerHarnessInputs(compare, true)).toThrow(/compare/);
  expect(check(h).disabled).toBe(true);
  h.press('Both the same');
  h.press(CHECK_LABEL);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('the tutor is told what is drawn: the problem, the strategy, its steps, the menu and the pick', () => {
  const g = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: 'guided', data: picker([guided]) });
  expect(g.state().task!.demand).toMatchObject({ problem: '3 + 4', strategy: 'Counting On',
    steps: '1. Start at the bigger number. 2. Count up the smaller number.' });
  cleanup();
  const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: 'choose', data: picker([choose]) });
  expect(h.state().task!.demand).toMatchObject({ menu: 'Counting On | Tally Marks', chosen: 'none yet' });
  h.press('Use Tally Marks');
  expect(h.state().task!.demand).toMatchObject({ chosen: 'Tally Marks', picture: 'tally marks for both numbers together' });
});

it('the support tier becomes a coaching fact; a match item never lets the tutor name the strategy', () => {
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: 'match', data: picker([{ ...match, supportTier: tier }]) });
    const demand = h.state().task!.demand as Record<string, string>;
    expect(demand.supportTier).toBe(tier);
    expect(demand.coaching).toMatch(/never name/i);
    cleanup();
  }
});

it('the adapter refuses a challenge its controls cannot answer', () => {
  expect(() => LIVE_ADAPTERS['strategy-picker'].validate(picker([{ ...match, strategyOptions: ['doubles', 'tally-marks'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['strategy-picker'].validate(picker([{ ...match, strategyOptions: ['counting-on'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['strategy-picker'].validate(picker([{ ...guided, problem: { ...problem, result: 8 } }]))).toThrow();
  expect(() => LIVE_ADAPTERS['strategy-picker'].validate(picker([{ ...compare, comparisonQuestion: '' }]))).toThrow();
  expect(LIVE_ADAPTERS['strategy-picker'].validate(picker([choose]))).toBeTruthy();
});
