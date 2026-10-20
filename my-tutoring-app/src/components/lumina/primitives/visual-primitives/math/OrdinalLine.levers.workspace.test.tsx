// @vitest-environment jsdom
/**
 * ordinal-line's levers on the real workspace: what each pulled lever draws, what the scene says while it is pulled,
 * and that an easier item is ungraded and hands back to the full one, which alone is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); seam.evaluationContext = null; });

const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const build = (h: WorkspaceHarness, ...names: string[]) => names.forEach((name, i) => { h.touch(`picture-${name}`); h.touch(`slot-${i + 1}`); });

const LINE = [{ name: 'Fox', emoji: '🦊' }, { name: 'Bear', emoji: '🐻' }, { name: 'Duck', emoji: '🦆' }, { name: 'Mole', emoji: '🐹' }];
const buildLine = () => mountWorkspace({ primitiveId: 'ordinal-line', evalMode: 'build_sequence', instanceId: 'line-up',
  data: { title: 'The line up', gradeBand: 'K', context: 'race', labelFormat: 'symbol', challenges: [{ id: 'c0', type: 'build-sequence',
    characters: LINE, clues: [{ character: 'Duck', position: 3 }, { character: 'Fox', position: 1 }, { character: 'Mole', position: 4 },
      { character: 'Bear', position: 2 }] }] } });

const cast = ['Rabbit', 'Turtle', 'Monkey', 'Penguin', 'Lion'].map((name, i) => ({ name, emoji: ['🐰', '🐢', '🐒', '🐧', '🦁'][i] }));
const parade = (mode: string, gradeBand: 'K' | '1', challenge: Record<string, unknown>) => mountWorkspace({ primitiveId: 'ordinal-line',
  evalMode: mode, instanceId: 'line', data: { title: 'Parade', gradeBand, context: 'parade', labelFormat: 'symbol', challenges: [challenge] } });

it('build_sequence: the flag and the dots place no picture and ride on the next attempt', () => {
  const h = buildLine();
  expect(h.state().task!.workspace!.levers!.map(l => [l.id, l.kind])).toEqual([['front_flag', 'help'], ['place_dots', 'help'], ['three_places', 'simplify']]);
  build(h, 'Mole', 'Duck', 'Bear', 'Fox'); h.settle();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  h.dispatch('pull_lever', { lever: 'front_flag' });
  expect(q(h, '[data-lever="front-flag"]')).toHaveLength(1);
  expect(q(h, '[data-lever="front-flag"]')[0].closest('[data-pip-object^="slot-"]')!.getAttribute('data-pip-object')).toBe('slot-1');
  h.dispatch('pull_lever', { lever: 'place_dots' });
  expect(q(h, '[data-lever="place-dots"]').map(d => d.children.length)).toEqual([1, 2, 3, 4]);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/flag marks the first place.*Dots under each place/);
  for (const n of ['Fox', 'Bear', 'Duck', 'Mole']) expect(String(h.state().task!.demand.onScreen)).not.toContain(n);
  h.dispatch('retry');
  build(h, 'Fox', 'Bear', 'Duck', 'Mole'); h.settle();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['front_flag', 'place_dots'] });
  h.close();
});

it('build_sequence: the easier line is three new pictures, ungraded, and returns to the full item, which alone is credited', () => {
  const h = buildLine();
  build(h, 'Bear', 'Fox', 'Duck', 'Mole'); h.settle();
  h.dispatch('pull_lever', { lever: 'three_places' });
  expect(h.state().task!.itemId).toBe('c0~simpler');
  expect(h.offer('pull_lever')).toBeUndefined();
  expect(q(h, '[data-pip-object^="slot-"]')).toHaveLength(3);
  expect(h.view.container.querySelector('[data-pip-object="picture-Cat"]')!.textContent).toBe('🐱');
  // Spoken second, third, first: Cat second, Frog third, Owl first.
  build(h, 'Owl', 'Cat', 'Frog'); h.settle();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('c0');
  build(h, 'Fox', 'Bear', 'Duck', 'Mole'); h.settle();
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['c0', false, false], ['c0~simpler', true, true], ['c0', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['three_places'], assisted: true });
  h.close();
});

it('identify: front_flag, tap_marks and word_model change the screen, not the line; the next try carries them', () => {
  const h = parade('identify', '1', { id: 'i1', type: 'identify', characters: cast, targetPosition: 4, correctAnswer: 4 });
  expect(levers(h)).toEqual(['front_flag', 'tap_marks', 'word_model', 'shorter_line']);
  h.say('four'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'front_flag' });
  expect(q(h, '[data-lever="front-flag"]')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'tap_marks' });
  const pictures = () => q(h, '[data-tap-mark]');
  expect(pictures()).toHaveLength(5);
  act(() => { fireEvent.click(pictures()[0]); fireEvent.click(pictures()[1]); });
  expect(pictures().map(p => p.getAttribute('data-ringed'))).toEqual(['true', 'true', 'false', 'false', 'false']);
  h.dispatch('pull_lever', { lever: 'word_model' });
  expect(q(h, '[data-lever="word-model"]')[0].textContent).toBe('🚩1st2nd3rd');
  const demand = JSON.stringify(h.state().task!.demand.onScreen);
  expect(demand).toMatch(/flag marks the front/);
  expect(demand).not.toMatch(/fourth|Penguin/);
  h.say('fourth'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['front_flag', 'tap_marks', 'word_model'] });
  h.close();
});

it('relative_position: side_model is a model of another line; shorter_line is ungraded, then the full line is credited', () => {
  const h = parade('relative_position', 'K', { id: 'r1', type: 'relative-position', characters: cast, targetPosition: 4,
    relativeQuery: 'before', correctAnswer: 'Monkey' });
  expect(levers(h)).toEqual(['front_flag', 'side_model', 'shorter_line']);
  // No tier pinned: medium, so the model comes after a miss.
  expect(String(h.state().task!.demand.support)).toMatch(/after a miss, model a different line of three plain circles with the side_model lever/);
  h.dispatch('pull_lever', { lever: 'side_model' });
  expect(q(h, '[data-lever="side-model"] [data-model-glow="true"]')).toHaveLength(1);
  const full = h.state().task!.itemId;
  h.say('Penguin'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'shorter_line' });
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  expect(task.workspace!.expectedAnswer).toMatch(/^"Cat"\./);
  expect(q(h, '[data-lever="side-model"]')).toHaveLength(0);
  h.say('Cat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('Monkey'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['side_model', 'shorter_line'] });
  h.close();
});

it('match: place_model counts plain circles up to the card, the last one ringed, with no words', () => {
  const h = parade('match', 'K', { id: 'm1', type: 'match', characters: cast, matchPairs: [{ word: 'third', symbol: '3rd' }] });
  h.dispatch('pull_lever', { lever: 'place_model' });
  const model = q(h, '[data-lever="place-model"]')[0];
  expect(model.getAttribute('data-count')).toBe('3');
  expect(model.textContent).toBe('🚩');
  expect(Array.from(model.querySelectorAll('[data-model-ringed="true"]'))).toHaveLength(1);
  h.close();
});
