// @vitest-environment jsdom
/**
 * pattern-builder `create` as an open build (OB-9M): the ask names a shape, the learner makes it with any tokens,
 * "I'm done!" commits, the code names the miss, Try again keeps the row, and the made row reaches the tutor as numbers.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { PatternBuilderChallenge, PatternBuilderData } from './PatternBuilder';
import { createInstruction, makesShape, patternBuilderMiss, shapeOf, type PatternBuilderView } from './patternBuilderWorkspace';
import { createShapesFor } from '../../../service/math/gemini-pattern-builder';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const make = (id: string, shape: string): PatternBuilderChallenge => ({ id, type: 'create', instruction: createInstruction(shape),
  answer: [], hint: 'Make your first part, then make the same part again.', narration: '', createShape: shape,
  availableTokens: ['red', 'blue', 'yellow'] });
const lesson = (challenges: PatternBuilderChallenge[]): PatternBuilderData => ({ title: 'Patterns', patternType: 'repeating',
  gradeBand: 'K-1', sequence: { given: [], hidden: [], core: [], rule: null }, tokens: { available: ['red', 'blue', 'yellow'], type: 'colors' },
  challenges });
const tap = (h: WorkspaceHarness, tokens: string[]) => {
  const palette = ['red', 'blue', 'yellow'];
  for (const t of tokens) h.touch(`token-${palette.indexOf(t)}`);
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const row = (h: WorkspaceHarness) => h.view.container.querySelectorAll('[data-created-token]').length;

describe('the shape judge', () => {
  const view = (created: string[]): PatternBuilderView => ({ extension: [], coreIndices: [], created, translated: [] });
  const data = lesson([]);
  it('passes any tokens of the asked shape repeated twice, a trailing part included', () => {
    expect(shapeOf(['red', 'blue', 'blue'])).toBe('ABB');
    expect(makesShape(['star', 'moon', 'moon', 'star', 'moon', 'moon'], 'ABB')).toBe(true);
    expect(makesShape(['red', 'blue', 'blue', 'red', 'blue', 'blue', 'red'], 'ABB')).toBe(true);
    expect(makesShape(['red', 'blue', 'red', 'blue'], 'ABB')).toBe(false);
  });
  it('names the misses: too short, the other shape (one token over and over too), no repeat', () => {
    const c = make('c', 'ABB');
    expect(patternBuilderMiss(data, c, view(['red', 'blue', 'blue', 'red']))).toBe('too_short');
    expect(patternBuilderMiss(data, c, view(['red', 'blue', 'red', 'blue', 'red', 'blue']))).toBe('other_shape');
    expect(patternBuilderMiss(data, c, view(['red', 'red', 'red', 'red', 'red', 'red']))).toBe('other_shape');
    expect(patternBuilderMiss(data, c, view(['red', 'blue', 'blue', 'blue', 'red', 'red']))).toBe('no_repeat');
    expect(patternBuilderMiss(data, c, view(['red', 'blue', 'blue', 'red', 'blue', 'blue']))).toBeUndefined();
  });
  it('the generator asks the simplest shapes first and stays two-token at K-1', () => {
    expect(createShapesFor(5, 'K-1')).toEqual(['AB', 'ABB', 'AAB', 'ABB', 'AAB']);
    expect(createShapesFor(5, '2-3')).toEqual(['AB', 'ABB', 'AAB', 'ABC', 'AABB']);
  });
});

it('an empty row, the shape on screen, "I\'m done!" commits, Try again keeps the row; workHistory records the fix', () => {
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'create', data: lesson([make('c1', 'ABB')]) as never });
  expect(row(h)).toBe(0);
  expect(h.view.container.querySelector('[data-asked-shape]')!.getAttribute('aria-label')).toBe('Shape A B B');
  expect(h.view.container.querySelector('[data-asked-shape]')!.textContent).toMatch(/◯A△B△B/);
  expect(demand(h)).toMatchObject({ kind: 'create', askedShape: 'A B B', tokensInRow: 0 });
  expect(Array.from(h.view.container.querySelectorAll('button')).some(b => b.textContent === 'Check Answer')).toBe(false);
  tap(h, ['red', 'blue', 'red', 'blue', 'red', 'blue']);
  h.settle(5000);
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: false, miss: 'other_shape' });
  expect(h.view.container.textContent).toMatch(/not A B B yet/);
  expect(h.view.container.textContent).not.toMatch(/red, blue, blue/i);
  h.dispatch('retry');
  expect(row(h)).toBe(6);
  h.settle(2000);
  h.press('Start over');
  expect(row(h)).toBe(0);
  tap(h, ['yellow', 'red', 'red', 'yellow', 'red', 'red']);
  expect(String(demand(h).workHistory)).toMatch(/tokensInRow 0 → 6 → 0 → 6|tokensInRow 6 → 0 → 6/);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: true });
  h.close();
});

it('the last token taps off; too short is named', () => {
  const h = mountWorkspace({ primitiveId: 'pattern-builder', evalMode: 'create', data: lesson([make('c1', 'AB')]) as never });
  tap(h, ['red', 'blue', 'red', 'yellow']);
  expect(row(h)).toBe(4);
  h.touch('build');
  const lastToken = h.view.container.querySelector('[data-created-token="3"]')!;
  lastToken.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  h.settle(100);
  expect(row(h)).toBe(3);
  h.press("I'm done!");
  expect(last(h)).toMatchObject({ correct: false, miss: 'too_short' });
  h.close();
});
