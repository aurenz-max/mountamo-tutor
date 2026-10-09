import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import sortP from '../../../components/live-activity/runtime/testing/w1-payloads/matter-explorer.sort.json';
import propertyP from '../../../components/live-activity/runtime/testing/w1-payloads/matter-explorer.property.json';
import changeP from '../../../components/live-activity/runtime/testing/w1-payloads/matter-explorer.change.json';
import mysteryP from '../../../components/live-activity/runtime/testing/w1-payloads/matter-explorer.mystery.json';
import { matterItems } from '../../../components/live-activity/adapters/matterExplorerLive';
import { matterAssignment, matterSpokenMisses } from './matterExplorerWorkspace';
import {
  changesFor, changesLeak, collides, leversOnScreen, matterLevers, matterLeverSession, MODEL_CHANGES, modelsFor, modelsLeak,
  practiceItem, practiceLeaks, practiceParent, PLAIN_THINGS, PLAIN_OBJECT_LEVER, THREE_MODELS_LEVER, TWO_CHANGES_LEVER,
} from './matterExplorerLevers';
import { changeFitsObject, nameCarriesAnswer, type MatterExplorerItem } from './matterExplorerScript';

const PAYLOADS: Record<string, any> = {
  sort: (sortP as any).data, property: (propertyP as any).data, change: (changeP as any).data, mystery: (mysteryP as any).data,
};
const tiers = ['easy', 'medium', 'hard'] as const;

describe.each(Object.keys(PAYLOADS))('%s payload', key => {
  const data = PAYLOADS[key];
  const s = matterLeverSession(data);
  const items = tiers.flatMap(t => matterItems({ ...data, supportTier: t }));
  it('has items', () => expect(items.length).toBeGreaterThan(0));

  it.each(items.map(i => [`${i.id}/${i.tier}`, i] as const))('%s: every checked miss has a lever on this item', (_id, item) => {
    const levers = matterLevers(item, s, []);
    for (const m of matterSpokenMisses(item)) expect(levers.some(l => l.answers?.includes(m.id)), `${item.id} ${m.id}`).toBe(true);
  });

  it.each(items.map(i => [`${i.id}/${i.tier}`, i] as const))('%s: the levers never draw the item or say its answer', (_id, item) => {
    const all = matterLevers(item, s, []).map(l => l.id);
    const fact = leversOnScreen(item, all, s) ?? '';
    // The fact locates the drawing by the item ("beside the rock") and names it nowhere else; a mystery fact never names it.
    const named = fact.toLowerCase().split(item.objectName.toLowerCase()).length - 1;
    expect(named).toBe(item.kind === 'mystery_state' || !fact ? 0 : 1);
    const models = modelsFor(item, s);
    if (models) expect(modelsLeak(models, item, s)).toBe(false);
    const pair = changesFor(item, s);
    if (pair) expect(changesLeak(pair, item, s)).toBe(false);
    for (const l of matterLevers(item, s, [])) expect(l.does.toLowerCase()).not.toContain(item.objectName.toLowerCase());
  });

  it.each(items.map(i => [`${i.id}/${i.tier}`, i] as const))('%s: a practice item is the same kind, a new plain thing, and clean', (_id, item) => {
    const p = practiceItem(item, s);
    if (item.kind === 'name_undo') { expect(p).toBeNull(); return; }
    if (!p) { expect(item.kind === 'name_state' && item.tier === 'easy').toBe(true); return; }
    expect(practiceLeaks(p, item, s)).toBe(false);
    expect(p.id).toBe(`${item.id}~simpler`);
    expect(practiceParent(p.id, items.filter(i => i.tier === item.tier))).toBe(item);
    expect(collides(p.objectName, s)).toBe(false);
    expect(p.tier).toBe('easy');
    expect(matterAssignment(p).task).not.toContain(item.objectName);
    if (p.kind === 'name_property') {
      expect(p.menu).toHaveLength(2);
      expect(p.menu).toContain(p.answerShape);
      expect(matterAssignment(p).task).toMatch(/, or /);
    }
    if (p.kind === 'mystery_state') expect(p.clues!.every(c => !nameCarriesAnswer(c))).toBe(true);
  });
});

const item = (extra: Partial<MatterExplorerItem>) => ({
  id: 'x', kind: 'name_state', challengeType: 'sort', tier: 'medium', objectName: 'pebble', objectId: 'o', answerState: 'solid',
  answerShape: 'keeps_shape', answerKind: 'voice', responseClass: 'short_spoken_word', action: 'name_state', ...extra,
}) as MatterExplorerItem;

it('models are one per state, skip every lesson object, and vanish when a state has none left', () => {
  const s = { objectNames: ['garden rock', 'milk', 'air', 'steam'] };
  const models = modelsFor(item({}), s)!;
  expect(models.map(m => m.state)).toEqual(['solid', 'liquid', 'gas']);
  expect(models.map(m => m.name)).not.toContain('rock');
  expect(models.find(m => m.state === 'gas')!.name).toBe('smoke');
  expect(modelsFor(item({}), { objectNames: PLAIN_THINGS.gas.map(g => g.name) })).toBeNull();
  expect(modelsLeak([...models.slice(0, 2), { name: 'air', icon: '', state: 'gas' }], item({}), s)).toBe(true);
  expect(modelsLeak([models[0], models[0], models[2]], item({}), s)).toBe(true);
});

it('change models: one of each kind, never the item\'s own change, each fitting its thing', () => {
  for (const change of ['melt', 'freeze', 'cook', 'bake', 'burn', 'tear', 'rust'] as const) {
    const it_ = item({ kind: 'name_undo', change, answerUndo: change === 'melt' || change === 'freeze' ? 'can_go_back' : 'changed_for_ever' });
    const pair = changesFor(it_, { objectNames: ['egg', 'chocolate'] })!;
    expect(pair.map(m => m.reversibility)).toEqual(['can_go_back', 'changed_for_ever']);
    expect(pair.some(m => m.change === change)).toBe(false);
    expect(pair.some(m => m.name === 'egg' || m.name === 'chocolate')).toBe(false);
  }
  for (const m of MODEL_CHANGES) {
    const state = m.change === 'freeze' ? 'liquid' : m.name === 'cake batter' ? 'liquid' : 'solid';
    expect(changeFitsObject(m.change, { id: m.name, name: m.name, state, canChangeState: m.reversibility === 'can_go_back' }), m.name).toBe(true);
  }
});

it('a plain sort item at the easy tier has no simplify; the same thing at medium does', () => {
  const s = { objectNames: ['rock'] };
  expect(practiceItem(item({ objectName: 'rock', tier: 'easy' }), s)).toBeNull();
  expect(practiceItem(item({ objectName: 'rock', tier: 'medium' }), s)).not.toBeNull();
  expect(matterLevers(item({ objectName: 'rock', tier: 'easy' }), s, []).map(l => l.id)).toEqual([THREE_MODELS_LEVER]);
});

it.each([
  ['name_state', 'other_state', THREE_MODELS_LEVER],
  ['name_state', 'said_object_back', THREE_MODELS_LEVER],
  ['mystery_state', 'other_state', THREE_MODELS_LEVER],
  ['name_property', 'other_shape', THREE_MODELS_LEVER],
  ['name_property', 'state_word', THREE_MODELS_LEVER],
  ['name_undo', 'other_way', TWO_CHANGES_LEVER],
  ['name_undo', 'said_change_back', TWO_CHANGES_LEVER],
  ['name_undo', 'state_word', TWO_CHANGES_LEVER],
] as const)('%s, miss %s: the next lever is %s, then simplify where there is one', (kind, miss, first) => {
  const it_ = item({ kind, ...(kind === 'name_undo' ? { change: 'melt', answerUndo: 'can_go_back' } : {}),
    ...(kind === 'mystery_state' ? { clues: ['it looks grey', 'it feels rough'] } : {}) });
  const s = { objectNames: ['pebble'] };
  expect(nextLever(matterLevers(it_, s, []), miss)).toBe(first);
  expect(nextLever(matterLevers(it_, s, [first]), miss)).toBe(kind === 'name_undo' ? null : PLAIN_OBJECT_LEVER);
});
