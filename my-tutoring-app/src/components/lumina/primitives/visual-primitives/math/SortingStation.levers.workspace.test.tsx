// @vitest-environment jsdom
/**
 * sorting-station's in-item levers on the shared teaching workspace, mounted the way a lesson mounts it. A pull changes
 * the screen and the scene fact in one commit; the next spoken attempt carries the lever; a refused pull changes
 * nothing; a simplify lever opens an ungraded easier item with new pictures, then the full item comes back and is
 * credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const obj = (id: string, label: string, emoji: string, attributes: Record<string, string>) => ({ id, label, emoji, attributes });
const data = (...challenges: Record<string, unknown>[]) => ({ title: 'Sorting', gradeBand: 'K', maxCategories: 3, showCounts: false,
  showTallyChart: false, challenges });
const COMPARE = { id: 'c1', type: 'count-and-compare', sortingAttribute: 'category',
  categories: [{ label: 'Animal', rule: { category: 'animal' }, bucketEmoji: '🐾' }, { label: 'Fruit', rule: { category: 'fruit' }, bucketEmoji: '🥗' }],
  objects: [obj('o1', 'Dog', '🐶', { category: 'animal' }), obj('o2', 'Cat', '🐱', { category: 'animal' }),
    obj('o3', 'Bunny', '🐰', { category: 'animal' }), obj('o4', 'Apple', '🍎', { category: 'fruit' }), obj('o5', 'Banana', '🍌', { category: 'fruit' })] };
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const onScreen = (h: WorkspaceHarness) => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');
const next = (h: WorkspaceHarness, answer: string) => { h.say(answer); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); };

it('count: focus_tray and tap_marks change the trays and the scene in one commit; a refused pull changes nothing', () => {
  const h = mountWorkspace({ primitiveId: 'sorting-station', evalMode: 'count_compare', instanceId: 'station', data: data(COMPARE) });
  expect(h.state().task!.itemId).toBe('c1::count::animal');
  expect(levers(h)).toEqual(['focus_tray', 'tap_marks']);
  h.say('two'); h.feedback('incorrect', 'retry');
  expect(q(h, '[data-dimmed="true"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'focus_tray' });
  expect(q(h, '[data-dimmed="true"]').map(e => e.getAttribute('data-pip-object'))).toEqual(['tray-fruit']);
  expect(onScreen(h)).toMatch(/Every tray but the tray asked about is dimmed/);
  // Refused: already pulled. Screen, levers and attempts stay as they were (the revision may still move).
  const before = { html: h.view.container.innerHTML, levers: JSON.stringify(h.state().task!.workspace!.levers),
    attempts: JSON.stringify(h.state().task!.workspace!.attempts) };
  h.dispatch('pull_lever', { lever: 'focus_tray' });
  expect(h.view.container.innerHTML).toBe(before.html);
  expect(JSON.stringify(h.state().task!.workspace!.levers)).toBe(before.levers);
  expect(JSON.stringify(h.state().task!.workspace!.attempts)).toBe(before.attempts);
  h.dispatch('pull_lever', { lever: 'tap_marks' });
  const pictures = () => q(h, '[data-tap-mark]');
  expect(pictures()).toHaveLength(3);
  act(() => { fireEvent.click(pictures()[0]); });
  expect(pictures().map(p => p.getAttribute('data-ringed'))).toEqual(['true', 'false', 'false']);
  expect(onScreen(h)).not.toMatch(/three|\b3\b/);
  h.say('three'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['focus_tray', 'tap_marks'] });
  h.close();
});

it('compare: line_up, then far_compare opens an ungraded easier compare, and the full item comes back blank and is credited', () => {
  const h = mountWorkspace({ primitiveId: 'sorting-station', evalMode: 'count_compare', instanceId: 'station', data: data(COMPARE) });
  next(h, 'three'); next(h, 'two');
  const full = h.state().task!.itemId;
  expect(full).toBe('c1::compare');
  expect(levers(h)).toEqual(['line_up', 'far_compare']);
  h.say('Fruit'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'line_up' });
  const rows = q(h, '[data-lever="line-up"] [data-line-row]');
  expect(rows.map(r => r.querySelectorAll('[data-line-cell]').length)).toEqual([3, 2]);
  expect(onScreen(h)).toMatch(/a picture per column/);
  h.say('the same'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'far_compare' });
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  const easier = task.workspace!.expectedAnswer;
  expect(['Animal', 'Fruit']).not.toContain(easier);
  // The easier page: new pictures, no help drawn from the full item.
  expect(q(h, '[data-lever="line-up"]')).toHaveLength(0);
  expect(h.view.container.textContent).not.toMatch(/🐶|🍎/);
  expect(levers(h)).toEqual([]);
  h.say(easier!); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle();
  expect(h.state().task!.itemId).toBe(full);
  expect(q(h, '[data-lever="line-up"]')).toHaveLength(1);
  h.say('Animal'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts.filter(a => a.itemId.startsWith(full));
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['line_up', 'far_compare'] });
  h.close();
});

it('odd one out: odd_model draws a fixed model beside the cards; three_cards practises on three new cards', () => {
  const h = mountWorkspace({ primitiveId: 'sorting-station', evalMode: 'odd_one_out', instanceId: 'station', data: data({ id: 'c1',
    type: 'odd-one-out', oddOneOut: 'o4', objects: [obj('o1', 'Dog', '🐶', { category: 'animal' }), obj('o2', 'Cat', '🐱', { category: 'animal' }),
      obj('o3', 'Cow', '🐮', { category: 'animal' }), obj('o4', 'Ball', '⚽', { category: 'toy' })] }) });
  const full = h.state().task!.itemId;
  expect(levers(h)).toEqual(['odd_model', 'three_cards']);
  h.dispatch('pull_lever', { lever: 'odd_model' });
  expect(q(h, '[data-lever="odd-model"] [data-model-shape]').map(e => e.getAttribute('data-model-shape'))).toEqual(['circle', 'circle', 'circle', 'square']);
  expect(onScreen(h)).toMatch(/It is not these cards/);
  h.dispatch('pull_lever', { lever: 'three_cards' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  const cards = q(h, '[data-pip-object="cards"] > div');
  expect(cards).toHaveLength(3);
  expect(h.view.container.textContent).not.toMatch(/Ball|Dog/);
  h.say(h.state().task!.workspace!.expectedAnswer!); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle();
  expect(h.state().task!.itemId).toBe(full);
  expect(q(h, '[data-pip-object="cards"] > div')).toHaveLength(4);
  h.say('Ball'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: full, correct: true, levers: ['odd_model', 'three_cards'] });
  h.close();
});

it('sort: try_each puts the card on every tray; tray_examples shows a card credited in an earlier round', () => {
  const cats = [{ label: 'Living', rule: { category: 'living' }, bucketEmoji: '🌱' }, { label: 'Non-living', rule: { category: 'non-living' }, bucketEmoji: '🧱' }];
  const h = mountWorkspace({ primitiveId: 'sorting-station', evalMode: 'sort_one', instanceId: 'station', data: data(
    { id: 'c1', type: 'sort-by-one', sortingAttribute: 'category', categories: cats,
      objects: [obj('o1', 'Puppy', '🐶', { category: 'living' }), obj('o2', 'Rock', '🪨', { category: 'non-living' })] },
    { id: 'c2', type: 'sort-by-one', sortingAttribute: 'category', categories: cats,
      objects: [obj('o1', 'Kitty', '🐱', { category: 'living' }), obj('o2', 'Car', '🚗', { category: 'non-living' })] }) });
  expect(levers(h)).toEqual(['try_each']);
  h.say('Puppy'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'try_each' });
  expect(q(h, '[data-lever="try-each"]')).toHaveLength(2);
  expect(onScreen(h)).toMatch(/No tray is marked/);
  h.say('Living'); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ levers: ['try_each'], assisted: true });
  next(h, 'Non-living');
  expect(h.state().task!.itemId).toBe('c2::o1');
  expect(levers(h)).toEqual(['tray_examples', 'try_each']);
  h.dispatch('pull_lever', { lever: 'tray_examples' });
  expect(q(h, '[data-lever="tray-example"]').map(e => e.textContent)).toEqual(['🐶', '🪨']);
  h.close();
});

it('two attributes: check_boxes start empty and only the learner\'s taps fill them', () => {
  const h = mountWorkspace({ primitiveId: 'sorting-station', evalMode: 'two_attributes', instanceId: 'station', data: data({ id: 'c1',
    type: 'two-attributes', sortingAttribute: 'category', targetCategory: 'need', secondaryAttribute: 'type', secondaryValue: 'food',
    objects: [obj('o1', 'Apple', '🍎', { category: 'need', type: 'food' }), obj('o2', 'Coat', '🧥', { category: 'need', type: 'clothing' }),
      obj('o3', 'Candy', '🍬', { category: 'want', type: 'food' })] }) });
  expect(levers(h)).toEqual(['check_boxes']);
  h.dispatch('pull_lever', { lever: 'check_boxes' });
  const boxes = () => q(h, '[data-lever="check-box"]');
  expect(boxes().map(b => b.getAttribute('data-value'))).toEqual(['', '']);
  act(() => { fireEvent.click(boxes()[0]); });
  act(() => { fireEvent.click(boxes()[1]); fireEvent.click(boxes()[1]); });
  expect(boxes().map(b => b.getAttribute('data-value'))).toEqual(['yes', 'no']);
  h.close();
});
