// @vitest-environment jsdom
/**
 * matter-explorer's levers on the real teaching workspace (`matterExplorerLevers.ts`): a pull changes the screen and
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
import { matterItems } from '../../../components/live-activity/adapters/matterExplorerLive';
import { matterLeverSession, practiceItem } from './matterExplorerLevers';
import { PROPERTY_OPTIONS } from './matterExplorerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const OBJECTS = [
  { id: 'rock', name: 'rock', state: 'solid', canChangeState: false,
    properties: { color: 'grey', texture: 'rough', transparency: 'opaque', flexibility: 'rigid', shape: 'keeps_shape', weight: 'heavy' } },
  { id: 'honey', name: 'honey', state: 'liquid', canChangeState: false,
    properties: { color: 'golden', texture: 'smooth', transparency: 'translucent', flexibility: 'flows', shape: 'takes_container', weight: 'heavy' } },
  { id: 'egg', name: 'egg', state: 'solid', canChangeState: false, everydayChange: 'cook',
    properties: { color: 'brown', texture: 'smooth', transparency: 'opaque', flexibility: 'rigid', shape: 'keeps_shape', weight: 'light' } },
];
const CHALLENGES: Record<string, unknown> = {
  sort: { id: 'sort-rock', type: 'sort', instruction: 'Say the state.', objectId: 'rock' },
  property: { id: 'property-honey', type: 'property', instruction: 'In a cup?', objectId: 'honey' },
  change: { id: 'change-egg', type: 'change', instruction: 'Can it go back?', objectId: 'egg' },
};
const dataFor = (mode: string, tier = 'medium'): Record<string, unknown> =>
  ({ title: 'Matter', objects: OBJECTS, challenges: [CHALLENGES[mode]], gradeBand: 'K-1', supportTier: tier });

function mount(mode: string, tier?: string) {
  const data = dataFor(mode, tier);
  const h = mountWorkspace({ primitiveId: 'matter-explorer', evalMode: mode, data, instanceId: 'matter' });
  const levers = () => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
  const onScreen = () => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');
  const attempts = () => h.state().task!.workspace!.attempts;
  const lever = (name: string) => h.view.container.querySelector(`[data-lever="${name}"]`);
  const stage = () => h.view.container.querySelector('[data-pip-object="stimulus"]')?.textContent ?? '';
  const item = matterItems(data as never)[0];
  return { ...h, levers, onScreen, attempts, lever, stage, item, easier: practiceItem(item, matterLeverSession(data)) };
}

it('sort: three_models draws three tagged model cups in one commit; a second pull changes nothing; the next attempt records it', () => {
  const h = mount('sort');
  expect(h.levers()).toEqual([['three_models', false], ['plain_object', false]]);
  h.say('gas'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.lever('three-models')).toBeNull();
  const receipt = h.dispatch('pull_lever', { lever: 'three_models' });
  expect(receipt.status).toBe('committed');
  expect(String((receipt.state.task!.demand as Record<string, unknown>).onScreen))
    .toMatch(/^beside the rock, three model things that are not this item, each drawn in a cup and tagged: .*\(a solid: .*\(a liquid: .*\(a gas: .*Nothing marks which one the item is like$/);
  const cups = h.lever('three-models')!;
  expect(cups.children).toHaveLength(3);
  expect(cups.textContent).not.toMatch(/\brock\b/);
  expect(h.levers()).toEqual([['three_models', true], ['plain_object', false]]);
  // A second pull of the same lever is refused and changes nothing (the runtime revision may still move).
  const before = { html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length, item: h.state().task!.itemId };
  expect(h.dispatch('pull_lever', { lever: 'three_models' }).status).toBe('blocked');
  expect({ html: h.view.container.innerHTML, levers: h.levers(), attempts: h.attempts().length, item: h.state().task!.itemId }).toEqual(before);
  h.say('solid'); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'sort-rock', correct: true, assisted: true, levers: ['three_models'] });
});

it('sort: plain_object opens a practice item on a plain thing with the three states named, then the full item comes back and is credited', () => {
  const h = mount('sort');
  const easier = h.easier!;
  h.say('gas'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'plain_object' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('sort-rock~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'sort-rock' });
  expect(receipt.state.task!.task).toMatch(/solid, liquid, or gas\?$/);
  expect(String((receipt.state.task!.demand as Record<string, unknown>).practice)).toMatch(/plain everyday thing/);
  expect(h.stage()).toContain(easier.objectName);
  expect(h.stage()).not.toContain('rock');
  expect(h.view.container.querySelector('[data-practice]')).not.toBeNull();
  const wrong = easier.answerState === 'gas' ? 'solid' : 'gas';
  h.say(wrong); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('sort-rock~simpler');
  expect(h.stage()).toContain(easier.objectName);
  h.say(easier.answerState); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('sort-rock');
  expect(h.stage()).toContain('rock');
  expect(h.stage()).not.toMatch(/Solid/);
  expect(h.view.container.querySelector('[data-practice]')).toBeNull();
  h.say('solid'); h.feedback('correct');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['sort-rock', false, false], ['sort-rock~simpler', false, true], ['sort-rock~simpler', true, true], ['sort-rock', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['plain_object'] });
});

it('property: the practice item asks with two options, its answer and the far one', () => {
  const h = mount('property');
  const easier = h.easier!;
  h.say('own shape'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'plain_object' });
  expect(receipt.status).toBe('committed');
  expect(easier.menu).toHaveLength(2);
  expect(receipt.state.task!.task).toMatch(/— does it [^,]+, or does it [^,]+\?$/);
  expect(receipt.state.task!.workspace!.expectedAnswer).toContain(PROPERTY_OPTIONS[easier.answerShape].phrase);
});

it('change: two_changes draws one model change of each kind, never the egg being cooked; there is no simplify', () => {
  const h = mount('change');
  expect(h.levers()).toEqual([['two_changes', false]]);
  h.say('go back'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.dispatch('pull_lever', { lever: 'two_changes' }).status).toBe('committed');
  const panel = h.lever('two-changes')!;
  expect(panel.textContent).toMatch(/it can go back the way it was/);
  expect(panel.textContent).toMatch(/it is changed for ever/);
  expect(panel.textContent).not.toMatch(/\begg\b|cooked/);
  expect(h.onScreen()).toMatch(/^under the egg, two model changes that are not this item/);
  expect(h.levers()).toEqual([['two_changes', true]]);
  h.say('for ever'); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'change-egg', correct: true, assisted: true, levers: ['two_changes'] });
});

it('a plain thing at the easy tier offers help only', () => {
  const h = mount('sort', 'easy');
  expect(h.levers()).toEqual([['three_models', false]]);
});
