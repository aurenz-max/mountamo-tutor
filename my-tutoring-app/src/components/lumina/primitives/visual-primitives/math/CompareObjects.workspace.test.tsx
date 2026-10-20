// @vitest-environment jsdom
/**
 * compare-objects on its boss (spoken preset; the ordering checked by the board), mounted the way a lesson mounts it:
 * what is its own. The generic W1 contract (runtime/workspaceContract.test.tsx), boss.test.ts and the Pip contract cover
 * ownership, the packet and the wiring; the levers have CompareObjects.levers.workspace.test.tsx.
 *
 * Moved here when the scripted controller was deleted: no Check or Next control and no printed instruction; the unit
 * numbers wait for the credited count; adult chrome is hidden for a pre-reader.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); seam.evaluationContext = null; });

type Kind = 'compare_two' | 'identify_attribute' | 'order_three' | 'non_standard';
const obj = (name: string, size: number, value: number) => ({ name, visualSize: size, actualValue: value });
const PAIR = [obj('pencil', 120, 12), obj('crayon', 60, 6)];

/** One challenge per mode, each satisfying `itemFromChallenge`'s own gates. */
function challengeFor(kind: Kind, id = kind): Record<string, any> {
  const base = { id, type: kind, attribute: 'length', instruction: 'Tap the longer one.' };
  switch (kind) {
    case 'compare_two': return { ...base, comparisonWord: 'longer', correctAnswer: 'pencil', objects: PAIR };
    case 'identify_attribute': return { ...base, correctAttribute: 'length', attributeOptions: ['length', 'weight'], objects: PAIR };
    case 'order_three': return { ...base, comparisonWord: 'longer', correctAnswer: 'ruler,pencil,crayon',
      objects: [obj('pencil', 120, 12), obj('ruler', 200, 30), obj('crayon', 60, 6)] };
    default: return { ...base, unitName: 'cube', unitCount: 5, objects: [obj('pencil', 120, 12)] };
  }
}

const mount = (evalMode: string, challenges: Record<string, any>[], gradeBand: 'K' | '1' = '1') => mountWorkspace({
  primitiveId: 'compare-objects', evalMode, instanceId: 'measure', data: { title: 'Comparing things', gradeBand, challenges } });
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const touch = (h: WorkspaceHarness, ...names: string[]) => names.forEach(n => h.touch(`pick-${n}`));

it.each(['compare_two', 'identify_attribute', 'order_three', 'non_standard'] as const)(
  '%s binds under tutor ownership: no Check or Next control, no printed instruction, levers offered', kind => {
    const h = mount(kind, [challengeFor(kind)]);
    expect(h.state().owner).toBe('tutor');
    expect(h.tutorTools()).toEqual(['begin_help', 'pull_lever']);
    const buttons = Array.from(h.view.container.querySelectorAll('button')).map(b => b.textContent ?? '').join(' ');
    expect(buttons).not.toMatch(/check|next/i);
    expect(text(h)).not.toContain('Tap the longer one.');
    expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[CO_|Say exactly/);
    h.close();
  });

it.each([
  ['compare_two', /^"pencil"\. Any words that name only the pencil are that answer\. The crayon, the other object/],
  ['identify_attribute', /^"how long they are" \(also accept "long", "length"\)\./],
  ['non_standard', /^"five"\. Counting aloud and ending on five is that answer/],
] as const)('%s publishes its spoken key; the order key is never published', (kind, key) => {
  const h = mount(kind, [challengeFor(kind)]);
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(key);
  h.close(); cleanup();
  const o = mount('order_three', [challengeFor('order_three')]);
  expect(o.state().task!.workspace!.expectedAnswer).toBeUndefined();
  o.close();
});

it('order_three: the board checks a still arrangement, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('order_three', [challengeFor('order_three')]);
  touch(h, 'crayon', 'pencil', 'ruler');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('crayon, pencil, ruler');
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  expect(h.view.container.querySelectorAll('[data-pip-object^="pick-"] .absolute').length).toBe(0);
  touch(h, 'ruler', 'pencil', 'crayon'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(text(h)).toContain('ruler  →  pencil  →  crayon');
  h.dispatch('advance');
  expect(h.state().status).not.toBe('completed');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 67]);
  expect(seam.sound.playCorrect).toHaveBeenCalledOnce();
  h.close();
});

it('order_three: a partial arrangement commits on stillness and is checked wrong', () => {
  const h = mount('order_three', [challengeFor('order_three')]);
  touch(h, 'ruler'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'not_all_placed' });
  expect(seam.send.mock.calls.at(-1)![0]).toContain('Touched 1 of 3');
  h.close();
});

it('non_standard: the unit numbers stay hidden until the spoken count is credited', () => {
  const h = mount('non_standard', [challengeFor('non_standard')]);
  const numbered = () => h.view.container.querySelectorAll('.border-dashed span').length;
  expect(numbered()).toBe(0);
  h.say('six'); h.feedback('incorrect', 'retry');
  expect(numbered()).toBe(0);
  h.say('five');
  expect(h.state().task!.workspace!.pendingResponse).toMatchObject({ text: 'five' });
  h.feedback('correct');
  expect(numbered()).toBe(5);
  expect(text(h)).toContain('5 cubes');
  h.close();
});

it('a mixed pin binds, and each item keeps its own response channel across transitions', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('mixed', [challengeFor('compare_two'), challengeFor('order_three')]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"pencil"/);
  h.say('the pencil'); h.feedback('correct', 'advance');
  expect(h.state().task!.itemId).toBe('order_three');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  touch(h, 'ruler', 'pencil', 'crayon'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 100]);
  h.close();
});

it('the mode badges are adult chrome: hidden for a pre-reader, shown at Grade 1', () => {
  const k = mount('compare_two', [challengeFor('compare_two')], 'K');
  expect(text(k)).not.toContain('Compare');
  k.close(); cleanup();
  const g1 = mount('compare_two', [challengeFor('compare_two')], '1');
  expect(text(g1)).toContain('Compare');
  g1.close();
});
