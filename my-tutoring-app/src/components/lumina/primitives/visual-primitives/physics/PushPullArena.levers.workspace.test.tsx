// @vitest-environment jsdom
/**
 * push-pull-arena's levers on the shared teaching workspace, mounted the way a lesson mounts it. A pull changes the
 * arena and its scene fact in one commit and never says the answer; the easier item is ungraded and gives the full
 * item back.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => {
  installRuntimeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const OBSERVE = (id: string, pushDirection: 'push' | 'pull') => ({ id, type: 'observe', instruction: 'Tap Go and watch.', objectName: 'Backpack',
  objectWeight: 5, objectEmoji: '🎒', surface: 'carpet', pushStrength: 7, pushDirection });
const PREDICT = { id: 'p1', type: 'predict', instruction: 'Will it move?', objectName: 'Rock', objectWeight: 9, objectEmoji: '🪨',
  surface: 'grass', pushStrength: 2, pushDirection: 'push' };
const COMPARE = { id: 'c1', type: 'compare', instruction: 'Which slides farther?', objectName: 'Tennis Ball', objectWeight: 1, objectEmoji: '🎾',
  object2Name: 'Book', object2Weight: 3, object2Emoji: '📕', surface: 'wood', pushStrength: 5, pushDirection: 'push' };
const data = (...challenges: unknown[]) => ({ title: 'Forces', description: 'Pushes and pulls', theme: 'toys', challenges }) as Record<string, unknown>;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const frozen = (h: WorkspaceHarness) => JSON.stringify({ html: h.view.container.innerHTML, levers: levers(h),
  attempts: h.state().task!.workspace!.attempts, demand: h.state().task!.demand });

it('observe: the hand is drawn in the same commit as its fact, the same on a push and a pull item; a refused pull changes nothing', () => {
  const h = mountWorkspace({ primitiveId: 'push-pull-arena', evalMode: 'observe', data: data(OBSERVE('o1', 'pull'), OBSERVE('o2', 'push')) });
  expect(levers(h).map(l => [l.id, l.kind])).toEqual([['mark_the_hand', 'help'], ['push_pull_model', 'help']]);
  fireEvent.click(screen.getByRole('button', { name: 'Go!' }));
  h.say('push'); h.feedback('incorrect', 'retry');
  expect(q(h, '[data-lever]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'mark_the_hand' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="hand"]')).toHaveLength(1);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/a hand at the left edge/);
  expect(String(receipt.state.task!.demand.levers_on_screen)).not.toMatch(/\bpull|\bpush/);
  const pullHand = q(h, '[data-lever="hand"]')[0].outerHTML;
  const before = frozen(h);
  expect(h.dispatch('pull_lever', { lever: 'mark_the_hand' }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: 'easier_item' }).status).toBe('blocked');
  expect(frozen(h)).toBe(before);
  h.say('pull'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'o1', correct: true, assisted: true, levers: ['mark_the_hand'] });
  // The next item starts with nothing pulled; the hand on a push item is the same picture.
  expect(h.state().task).toMatchObject({ itemId: 'o2' });
  expect(q(h, '[data-lever]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'mark_the_hand' });
  expect(q(h, '[data-lever="hand"]')[0].outerHTML).toBe(pullHand);
  // The model shows both words together, on a cart and a sled.
  h.dispatch('pull_lever', { lever: 'push_pull_model' });
  const model = q(h, '[data-lever="force-model"]')[0].textContent ?? '';
  expect(model).toMatch(/push/); expect(model).toMatch(/pull/); expect(model).not.toMatch(/🎒/);
  h.close();
});

it('compare: the weight blocks under both objects, then the same-push model on other things', () => {
  const h = mountWorkspace({ primitiveId: 'push-pull-arena', evalMode: 'compare', data: data(COMPARE) });
  h.say('the book'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'show_the_setup' });
  expect(q(h, '[data-lever="weight-blocks"]').map(b => b.getAttribute('data-count'))).toEqual(['1', '3']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toBe('under the Tennis Ball, 1 weight block; under the Book, 3 weight blocks');
  h.dispatch('pull_lever', { lever: 'same_push_model' });
  expect(q(h, '[data-lever="same-push-model"] [data-track]')).toHaveLength(2);
  expect(q(h, '[data-lever="same-push-model"]')[0].textContent).not.toMatch(/🎾|📕/);
  h.say('the tennis ball'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['show_the_setup', 'same_push_model'] });
  h.close();
});

it('predict: the easier item is ungraded, on other things; the full item comes back and is credited after it', () => {
  const h = mountWorkspace({ primitiveId: 'push-pull-arena', evalMode: 'predict', data: data(PREDICT) });
  h.say('moves'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'show_the_setup' });
  expect(q(h, '[data-lever="push-marks"]')[0].getAttribute('data-count')).toBe('2');
  expect(q(h, '[data-lever="grip"]')[0].getAttribute('data-bumps')).toBe('4');
  const receipt = h.dispatch('pull_lever', { lever: 'easier_item' });
  expect(receipt.status).toBe('committed');
  expect(h.state().task).toMatchObject({ itemId: 'p1~simpler' });
  expect(h.state().task!.demand.practice).toBeTruthy();
  expect(String(h.state().task!.demand.shown)).toMatch(/Feather on the ice/);
  expect(levers(h)).toEqual([]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  expect(h.view.container.textContent).toMatch(/Feather/);
  expect(h.view.container.textContent).not.toMatch(/Rock|🪨/);
  h.say('stays'); h.feedback('incorrect', 'retry');
  h.say('moves'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'p1' });
  expect(String(h.state().task!.demand.shown)).toMatch(/Rock on the grass/);
  expect(h.view.container.textContent).toMatch(/🪨/);
  expect(h.view.container.textContent).not.toMatch(/Feather/);
  h.say('stays'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['p1', false, false], ['p1~simpler', false, true], ['p1~simpler', true, true], ['p1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['show_the_setup', 'easier_item'] });
  h.close();
});
