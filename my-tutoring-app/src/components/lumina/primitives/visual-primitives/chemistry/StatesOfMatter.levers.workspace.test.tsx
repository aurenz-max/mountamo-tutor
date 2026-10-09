// @vitest-environment jsdom
/**
 * states-of-matter's levers on the real teaching workspace (`statesOfMatterLevers.ts`): a pull changes the screen and
 * the scene fact in one commit, the next attempt records it, a refused pull changes nothing, and a simplify pull opens
 * an ungraded practice item, then the full item comes back blank and is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { statesItems } from '../../../components/live-activity/adapters/statesOfMatterLive';
import { practiceItem, statesLeverSession } from './statesOfMatterLevers';

beforeEach(() => {
  installRuntimeTimers();
  // jsdom has no canvas; the particle views draw nothing and the tests read the DOM and the workspace.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const CHALLENGES: Record<string, unknown> = {
  observe: { id: 'o1', challengeType: 'observe', substanceKey: 'water', startTemp: 50 },
  predict: { id: 'p1', challengeType: 'predict', kind: 'predict_state', substanceKey: 'wax', startTemp: 20, targetTemp: 200 },
  onePoint: { id: 'p2', challengeType: 'predict', kind: 'predict_state', substanceKey: 'chocolate', startTemp: 14, targetTemp: 55 },
  compare: { id: 'c1', challengeType: 'compare', kind: 'melt_first', pairKeys: ['coconutOil', 'butter'], startTemp: 4 },
};
const MODE: Record<string, string> = { observe: 'observe', predict: 'predict', onePoint: 'predict', compare: 'compare' };

function mount(name: string) {
  const data = { title: 'Heat and matter', gradeBand: '3-5', challenges: [CHALLENGES[name]] };
  const h = mountWorkspace({ primitiveId: 'states-of-matter', evalMode: MODE[name], data, instanceId: 'states' });
  const levers = () => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
  const onScreen = () => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');
  const attempts = () => h.state().task!.workspace!.attempts;
  const lever = (id: string) => h.view.container.querySelector(`[data-lever="${id}"]`);
  const stage = () => h.view.container.querySelector('[data-pip-object="stimulus"]')?.textContent ?? '';
  const items = statesItems(data as never);
  return { ...h, levers, onScreen, attempts, lever, stage, easier: practiceItem(items[0], statesLeverSession(items, '3-5')) };
}

it('observe: particle_models draws three model boxes in one commit; a second pull changes nothing; the next attempt records it', () => {
  const h = mount('observe');
  expect(h.levers()).toEqual([['particle_models', false], ['three_named', false]]);
  h.say('gas'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.lever('particle-models')).toBeNull();
  const receipt = h.dispatch('pull_lever', { lever: 'particle_models' });
  expect(receipt.status).toBe('committed');
  expect(String((receipt.state.task!.demand as Record<string, unknown>).onScreen))
    .toMatch(/^beside the beaker, three model particle boxes that are not the Water, .*Nothing marks which box the beaker's particles move like$/);
  const boxes = h.lever('particle-models')!;
  expect(boxes.children).toHaveLength(3);
  expect(boxes.textContent).not.toMatch(/Water/);
  expect(h.levers()).toEqual([['particle_models', true], ['three_named', false]]);
  // A refused pull changes nothing (the runtime revision may still move).
  const before = { html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length, item: h.state().task!.itemId };
  expect(h.dispatch('pull_lever', { lever: 'particle_models' }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: 'temperature_strip' }).status).toBe('blocked');
  expect({ html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length, item: h.state().task!.itemId }).toEqual(before);
  h.say('liquid'); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'o1', correct: true, assisted: true, levers: ['particle_models'] });
});

it('observe: three_named opens a practice item on another substance with the states named, then the full item comes back blank and is credited', () => {
  const h = mount('observe');
  const easier = h.easier!;
  h.say('gas'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'three_named' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('o1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'o1' });
  expect(receipt.state.task!.task).toMatch(/solid, liquid, or gas\?$/);
  expect(String((receipt.state.task!.demand as Record<string, unknown>).practice)).toMatch(/another substance/);
  expect(h.stage()).toContain(easier.substance!.name);
  expect(h.stage()).not.toContain('Water');
  expect(h.view.container.querySelector('[data-practice]')).not.toBeNull();
  const wrong = easier.answerState === 'gas' ? 'solid' : 'gas';
  h.say(wrong); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('o1~simpler');
  expect(h.stage()).toContain(easier.substance!.name);
  h.say(easier.answerState!); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('o1');
  expect(h.stage()).toContain('Water');
  expect(h.stage()).not.toMatch(/°C|Liquid/);
  expect(h.view.container.querySelector('[data-practice]')).toBeNull();
  h.say('liquid'); h.feedback('correct');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['o1', false, false], ['o1~simpler', false, true], ['o1~simpler', true, true], ['o1', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['three_named'] });
});

it('predict: temperature_strip marks both points and "now", never the temperature it is going to', () => {
  const h = mount('predict');
  expect(h.levers()).toEqual([['temperature_strip', false], ['one_point', false]]);
  h.say('solid'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.dispatch('pull_lever', { lever: 'temperature_strip' }).status).toBe('committed');
  const strip = h.lever('temperature-strip')!;
  expect(strip.textContent).toMatch(/60°C/);
  expect(strip.textContent).toMatch(/370°C/);
  expect(strip.textContent).toMatch(/now 20°C/);
  expect(strip.textContent).not.toMatch(/200/);
  expect(h.onScreen()).toMatch(/^beside the beaker, a temperature strip for the Wax: .*The temperature it is going to is not marked$/);
  h.say('liquid'); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'p1', correct: true, assisted: true, levers: ['temperature_strip'] });
});

it('predict: one_point opens the same question on a substance that does not boil', () => {
  const h = mount('predict');
  h.say('solid'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'one_point' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('p1~simpler');
  expect(receipt.state.task!.task).toMatch(/^\w[\w ]* melts at \d+ degrees\. Right now/);
  expect(receipt.state.task!.task).not.toMatch(/boils|Wax/);
});

it('predict on a substance with one point offers help only, and a simplify pull is refused', () => {
  const h = mount('onePoint');
  expect(h.levers()).toEqual([['temperature_strip', false]]);
  const before = { html: h.view.container.innerHTML, levers: h.levers(), item: h.state().task!.itemId };
  expect(h.dispatch('pull_lever', { lever: 'one_point' }).status).toBe('blocked');
  expect({ html: h.view.container.innerHTML, levers: h.levers(), item: h.state().task!.itemId }).toEqual(before);
});

it('compare: model_pair shows two other substances heated to one temperature; far_pair opens a pair far apart', () => {
  const h = mount('compare');
  expect(h.levers()).toEqual([['model_pair', false], ['far_pair', false]]);
  h.say('butter'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.dispatch('pull_lever', { lever: 'model_pair' }).status).toBe('committed');
  const panel = h.lever('model-pair')!;
  expect(panel.textContent).toMatch(/still solid/);
  expect(panel.textContent).toMatch(/melted/);
  expect(panel.textContent).not.toMatch(/Coconut|Butter/);
  expect(h.onScreen()).toMatch(/^under the two beakers, a model pair that is not this item/);
  const receipt = h.dispatch('pull_lever', { lever: 'far_pair' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('c1~simpler');
  expect(receipt.state.task!.task).toMatch(/which one melts first/);
  expect(receipt.state.task!.task).not.toMatch(/Coconut|Butter/);
  expect(h.lever('model-pair')).toBeNull();
});
