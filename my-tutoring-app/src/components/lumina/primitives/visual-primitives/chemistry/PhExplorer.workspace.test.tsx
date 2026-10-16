// @vitest-environment jsdom
/**
 * ph-explorer on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every item is a code-keyed closed choice, tapped and checked or said aloud: the key is published only as the spoken
 * expectedAnswer, nothing on screen states it before credit, a wrong tap names its miss, and every miss has a lever.
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
import type { PhExplorerData, Substance } from './PhExplorer';
import {
  bandOf, cupsToNeutral, keyChoice, mixedPH, phHarnessAnswers, phItems, phMiss, PH_MISSES, testSubstances, workspaceAssignment,
  type PhItem, type PhMode,
} from './phExplorerWorkspace';
import { CHART_LEVER, FEWER_LEVER, fewerChoices, LITMUS_LEVER, METER_LEVER, phLevers, stepLines, stepsLeak, STEPS_LEVER } from './phExplorerLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const s = (id: string, name: string, pH: number): Substance => ({ id, name, pH, realWorldInfo: `${name} fact line.` });
const SUBS: Substance[] = [
  s('lemon', 'Lemon Juice', 2), s('vinegar', 'Vinegar', 3), s('water', 'Pure Water', 7), s('soda', 'Baking Soda Solution', 8.5),
  s('soap', 'Hand Soap', 10), s('milk', 'Milk', 6.5), s('hcl', 'Hydrochloric acid', 1),
];
const MODES: PhMode[] = ['test', 'indicator', 'neutralize'];
const data = (mode: PhMode, substances = SUBS): PhExplorerData =>
  ({ title: 'Kitchen pH Lab', description: 'Lemon juice is an acid!', substances, challengeTypes: [mode], gradeBand: '7-8' });
const mount = (mode: PhMode, substances = SUBS) => {
  const h = mountWorkspace({ primitiveId: 'ph-explorer', evalMode: mode, instanceId: 'ph-explorer', data: data(mode, substances) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const answer = (h: WorkspaceHarness, label: string, check = /Check Answer|Mix and check/) => { h.press(label); h.press(check); h.settle(); };
const current = (h: WorkspaceHarness, mode: PhMode, substances = SUBS) => phItems(data(mode, substances)).find(i => i.id === h.state().task!.itemId)!;
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds as a spoken-or-tapped choice whose key stays out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('ph-explorer')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  const ws = h.state().task!.workspace!;
  expect(demand(h).response).toBe('speech');
  expect(ws.expectedAnswer).toContain(item.mode === 'test' ? keyChoice(item).toLowerCase() : keyChoice(item));
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/fact line|answer is|correct/i);
  // No description, no real-world line, no Next, no meter before a mix.
  expect(text(h)).not.toMatch(/Lemon juice is an acid|fact line|Next →|Finish/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  if (item.mode === 'test') expect(text(h)).not.toMatch(new RegExp(`pH ${item.substance.pH}\\b`));
  if (item.mode === 'indicator') {
    // The sample is unnamed and no pH scale sits beside the cabbage tube.
    expect(facts).not.toContain(item.substance.name);
    expect(text(h)).not.toContain(item.substance.name);
    expect(text(h)).not.toMatch(/pH scale/);
  }
  h.close();
});

it('test: a wrong tap names its miss and closes the choices; Try again keeps the dip; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const subs = [s('lemon', 'Lemon Juice', 2), s('water', 'Pure Water', 7)];
  const h = mount('test', subs);
  expect(h.state().task!.itemId).toBe('test-lemon');
  expect(demand(h).papers).toMatch(/^Not dipped/);
  h.press('Dip the litmus papers'); h.settle();
  expect(demand(h).papers).toBe('Dipped: the blue paper is now red; the red paper is now red.');
  answer(h, 'Base');
  expect(last(h)).toMatchObject({ correct: false, miss: 'acid_base_swapped' });
  expect(demand(h).learnerWork).toBe('Chose "Base"');
  expect(text(h)).not.toMatch(/fact line|pH of 2/);
  expect(h.view.container.querySelector('button[aria-label="Acid"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  expect(demand(h).papers).toMatch(/^Dipped/);
  answer(h, 'Acid');
  expect(last(h)).toMatchObject({ correct: true });
  expect(text(h)).toContain('Lemon Juice has a pH of 2, so it is an acid. Lemon Juice fact line.');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('test-water');
  h.say('neutral'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'ph-explorer', sortingTotal: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'acid_base_swapped'], [true, null], [true, null]]);
  h.close();
});

it('test: litmus_key changes the screen and the scene fact in one commit, is then off offer, and rides the next attempt', () => {
  const h = mount('test');
  expect(levers(h)).toEqual([[LITMUS_LEVER, 'help', false]]);
  const wrong = phHarnessAnswers(current(h, 'test')).plainWrong;
  answer(h, wrong);
  expect(nextLever(h.state().task!.workspace!.levers!, last(h)!.miss!)).toBe(LITMUS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: LITMUS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="litmus-key"]')!.textContent).toMatch(/Neither paper changes: neutral/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/key card/);
  // Its only lever pulled, the item offers no pull_lever any more.
  expect(h.state().affordances.map(a => (a.action as { operation?: string }).operation)).not.toContain('pull_lever');
  h.dispatch('retry'); h.confirmVisible();
  answer(h, keyChoice(current(h, 'test')));
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [LITMUS_LEVER] });
  h.close();
});

it('indicator: color_chart draws the chart and names no band; fewer_choices opens a different sample with three ranges', () => {
  const h = mount('indicator');
  const item = current(h, 'indicator');
  expect(levers(h)).toEqual([[CHART_LEVER, 'help', false], [FEWER_LEVER, 'simplify', false]]);
  answer(h, phHarnessAnswers(item).plainWrong);
  expect(PH_MISSES.indicator).toContain(last(h)!.miss);
  expect(h.dispatch('pull_lever', { lever: CHART_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="color-chart"] span.rounded-full')).toHaveLength(6);
  const receipt = h.dispatch('pull_lever', { lever: FEWER_LEVER });
  expect(receipt.status).toBe('committed');
  const simpler = fewerChoices(item, SUBS, phItems(data('indicator')))!;
  expect(simpler.mode === 'indicator' && item.mode === 'indicator' && simpler.substance.id).not.toBe(item.mode === 'indicator' && item.substance.id);
  expect(receipt.state.task).toMatchObject({ itemId: `${item.id}~fewer` });
  expect(h.view.container.querySelectorAll('button[aria-label^="pH "]')).toHaveLength(3);
  expect(h.view.container.querySelector('[data-practice="fewer-choices"]')).not.toBeNull();
  answer(h, keyChoice(simpler));
  expect(last(h)).toMatchObject({ itemId: `${item.id}~fewer`, correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: item.id });
  expect(h.view.container.querySelectorAll('button[aria-label^="pH "]')).toHaveLength(6);
  answer(h, keyChoice(item));
  expect(last(h)).toMatchObject({ itemId: item.id, correct: true, levers: [CHART_LEVER, FEWER_LEVER] });
  h.close();
});

it('neutralize: the meter is refused before a mix, a wrong mix shows only its colour, then ph_meter reads it; steps never name an amount', () => {
  const h = mount('neutralize');
  const item = current(h, 'neutralize');
  expect(levers(h).map(([id]) => id)).toEqual([STEPS_LEVER, METER_LEVER, FEWER_LEVER]);
  expect(h.dispatch('pull_lever', { lever: METER_LEVER }).status).toBe('blocked');
  const wrong = phHarnessAnswers(item).plainWrong;
  answer(h, wrong);
  expect(PH_MISSES.neutralize).toContain(last(h)!.miss);
  expect(String(demand(h).mixed)).toMatch(/^The learner mixed in .*; the beaker turned \w+\.$/);
  expect(h.view.container.querySelector('[data-lever="ph-meter"]')).toBeNull();
  expect(h.dispatch('pull_lever', { lever: METER_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="ph-meter"]')!.textContent).toMatch(/^pH \d+\.\d$/);
  expect(h.dispatch('pull_lever', { lever: STEPS_LEVER }).status).toBe('committed');
  for (const line of stepLines(item)) expect(stepsLeak(line), line).toBe(false);
  h.dispatch('retry'); h.confirmVisible();
  // The meter keeps the last mix across Try again.
  expect(h.view.container.querySelector('[data-lever="ph-meter"]')).not.toBeNull();
  answer(h, keyChoice(item), /Mix and check/);
  expect(last(h)).toMatchObject({ correct: true, levers: [METER_LEVER, STEPS_LEVER] });
  expect(text(h)).toMatch(/pH 7\.0/);
  h.close();
});

describe('the pure rules', () => {
  const items = (mode: PhMode) => phItems(data(mode));

  it('test leaves out names that say acid or base and substances litmus reads weakly', () => {
    expect(testSubstances(SUBS).map(x => x.id)).toEqual(['soda', 'soap', 'lemon', 'water', 'vinegar']);
    expect(items('test').map(i => keyChoice(i))).toEqual(['Base', 'Base', 'Acid', 'Neutral', 'Acid']);
  });

  it('every wrong choice names a catalog miss, and every miss is answered by a help lever first', () => {
    const entry = getComponentById('ph-explorer')!;
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...PH_MISSES[mode]].sort());
      for (const item of items(mode)) {
        for (const c of item.choices) expect(!!phMiss(item, c), `${item.id} ${c}`).toBe(c !== keyChoice(item));
        const ls = phLevers(item, [], SUBS, items(mode));
        for (const miss of PH_MISSES[mode]) {
          expect(ls.find(l => l.id === nextLever(ls, miss))!.kind).toBe('help');
        }
        for (const l of ls) expect(`${l.when} ${l.does}`).not.toContain(keyChoice(item));
      }
    }
    expect(entry.teachingWorkspace!.levers).toBe(true);
  });

  it('indicator misses: the other side of purple, the next band, a far band', () => {
    const item = items('indicator').find(i => i.mode === 'indicator' && i.substance.id === 'lemon')! as PhItem;
    expect(['pH 3-4', 'pH 5-7', 'pH 8-9', 'pH 13-14'].map(c => phMiss(item, c))).toEqual(['next_band', 'far_band', 'other_side', 'other_side']);
    expect(bandOf(6.5)).toBe(2);
  });

  it('neutralize keys come from the two pH values, and the key mix reads 7', () => {
    for (const item of items('neutralize')) {
      if (item.mode !== 'neutralize') continue;
      const cups = cupsToNeutral(item.acid.pH, item.base.pH);
      expect(mixedPH(item.acid.pH, item.base.pH, cups)).toBe(7);
      expect(mixedPH(item.acid.pH, item.base.pH, cups / 10)).toBeLessThan(3);
      expect(mixedPH(item.acid.pH, item.base.pH, cups * 10)).toBeGreaterThan(11);
    }
    expect(items('neutralize').map(keyChoice)).toEqual(['1 cup', '10 cups', '1/10 cup']);
    const n = items('neutralize')[1];
    expect(['1 cup', '1/10 cup', '100 cups'].map(c => phMiss(n, c))).toEqual(['equal_amounts', 'too_little', 'too_much']);
  });

  it('the simpler item is the same mode with three choices, never the learner\'s own item, and never shrinks twice', () => {
    for (const mode of ['indicator', 'neutralize'] as const) {
      for (const item of items(mode)) {
        const simpler = fewerChoices(item, SUBS, items(mode))!;
        expect(simpler.mode).toBe(mode);
        expect(simpler.choices).toHaveLength(3);
        expect(simpler.choices).toContain(keyChoice(simpler));
        expect(JSON.stringify({ ...simpler, id: '' })).not.toBe(JSON.stringify({ ...item, id: '' }));
        expect(fewerChoices(simpler, SUBS, items(mode))).toBeNull();
        expect(phLevers(simpler, [], SUBS, items(mode))).toEqual([]);
      }
    }
    expect(fewerChoices(items('test')[0], SUBS)).toBeNull();
  });
});
