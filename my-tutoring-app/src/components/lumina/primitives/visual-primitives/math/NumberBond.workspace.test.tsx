// @vitest-environment jsdom
/**
 * number-bond on the shared teaching workspace, mounted the way a lesson mounts it: the board behaviour each mode's
 * contract pins (R5 split, R7 covered part, R8 related groups, R9 action-matched equation, R10 family record, R11 no
 * answer before the check). Ported from the scripted-runner suite when the family moved onto its boss (2026-10-20).
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const bond = (mode: string, gradeBand: 'K' | '1', challenge: object) => mountWorkspace({ primitiveId: 'number-bond', evalMode: mode,
  instanceId: 'bond', data: { title: 'Bonds', gradeBand, maxNumber: 10, showCounters: true, showEquation: true,
    challenges: [{ instruction: 'Bond.', ...challenge }] } });
const task = (h: WorkspaceHarness) => h.state().task!;
const last = (h: WorkspaceHarness) => task(h).workspace!.attempts.at(-1);
const counters = (h: WorkspaceHarness, tray: string) =>
  h.view.container.querySelectorAll(`[aria-label="${tray} counter tray"] button[aria-label^="Counter"]`).length;
const type = (h: WorkspaceHarness, equation: string) => {
  const entry = h.view.container.querySelector('input[aria-label="Equation keyboard entry"]') as HTMLInputElement;
  act(() => { fireEvent.change(entry, { target: { value: equation } }); });
  h.settle();
};
const next = (h: WorkspaceHarness) => { h.dispatch('advance'); h.settle(); };

it('a split commits only once every counter is in a part; the say step freezes it and shows no part count first (R5, R11)', () => {
  const h = bond('decompose', 'K', { id: 'd', type: 'decompose', whole: 5 });
  h.settle();
  h.press('Move counter to left'); h.press('Move counter to left');
  h.settle(8000);
  expect(task(h).workspace!.attempts).toHaveLength(0);
  for (let i = 0; i < 3; i++) h.press('Move counter to right');
  h.settle();
  expect(last(h)).toMatchObject({ correct: true });
  expect(h.view.container.textContent).not.toContain('2 + 3');
  next(h);
  expect(h.view.container.querySelector('[aria-label="right counter tray"]')!.textContent).toContain('How many here?');
  expect((h.view.container.querySelector('button[aria-label="Counter 1"]') as HTMLButtonElement).disabled).toBe(true);
  expect(h.view.container.textContent).not.toContain('2 + 3');
  h.say('three'); h.feedback('correct');
  expect(last(h)).toMatchObject({ correct: true });
  expect(h.view.container.textContent).toContain('2 + 3 = 5');
  h.close();
});

it('missing_part keeps the covered part hidden, and shows it only on a correction (R7)', () => {
  const h = bond('missing_part', '1', { id: 'm', type: 'missing-part', whole: 7, part1: 3 });
  h.settle();
  expect(h.view.container.querySelector('[aria-label="Covered part, quantity hidden"]')).toBeTruthy();
  expect(task(h).task).toBe('Seven is the whole. One part is three. What is the other part?');
  h.say('seven'); h.feedback('incorrect', 'retry'); h.settle();
  expect(h.view.container.querySelector('[aria-label="4 covered counters revealed"]')).toBeTruthy();
  expect(h.view.container.querySelector('[aria-label="Covered part, quantity hidden"]')).toBeNull();
  h.close();
});

it('related_fact keeps the coloured groups across join, say, take away, say (R8)', () => {
  const h = bond('related_fact', 'K', { id: 'r', type: 'related-fact', whole: 5, part1: 2 });
  h.settle();
  h.press('Join the groups'); h.settle();
  expect(last(h)).toMatchObject({ correct: true });
  next(h);
  expect(counters(h, 'whole')).toBe(5);
  expect(task(h).task).toBe('two and how many make five?');
  expect(task(h).workspace!.expectedAnswer).toMatch(/^"three"/);
  h.say('three'); h.feedback('correct');
  next(h);
  h.press('Move blue group away'); h.settle();
  expect(last(h)).toMatchObject({ correct: true });
  next(h);
  expect([counters(h, 'whole'), counters(h, 'right')]).toEqual([2, 3]);
  expect(task(h).task).toBe('five take away three leaves how many?');
  expect(task(h).workspace!.expectedAnswer).toMatch(/^"two"/);
  h.close();
});

it('build_equation wants the equation for the move the learner chose (R9)', () => {
  const h = bond('build_equation', '1', { id: 'b', type: 'build-equation', whole: 7, part1: 3 });
  h.settle();
  h.press('Take away blue'); h.settle();
  expect(last(h)).toMatchObject({ correct: true });
  next(h);
  type(h, '3+4=7');
  expect(last(h)).toMatchObject({ correct: false, miss: 'other_fact' });
  h.dispatch('retry'); h.settle();
  type(h, '7-4=3');
  expect(last(h)).toMatchObject({ correct: true });
  h.close();
});

it('fact_family records one equation at a time and keeps it through the next move (R10)', () => {
  const h = bond('fact_family', '1', { id: 'f', type: 'fact-family', whole: 7, part1: 3 });
  h.settle();
  h.press('Join the groups'); h.settle();
  next(h);
  type(h, '7=3+4');
  expect(last(h)).toMatchObject({ correct: true });
  next(h);
  expect(h.view.container.textContent).toContain('Family record: 1 of 4');
  expect(Array.from(h.view.container.querySelectorAll('button')).some(b => b.textContent === 'Swap the groups')).toBe(true);
  expect(h.view.container.querySelector('input[aria-label="Equation keyboard entry"]')).toBeNull();
  h.close();
});
