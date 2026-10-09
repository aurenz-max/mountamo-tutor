// @vitest-environment jsdom
/**
 * multiplication-explorer's levers on the real component and runtime: a pull changes the screen and the scene fact in
 * the same commit and never prints the answer; the next attempt records it; a repeated pull is refused; the smaller fact
 * is an ungraded item and the full item comes back blank.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { MultiplicationExplorerChallenge, MultiplicationExplorerData } from './MultiplicationExplorer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

type Mode = MultiplicationExplorerChallenge['type'];
const item = (id: string, type: Mode, a: number, b: number, hiddenValue: MultiplicationExplorerChallenge['hiddenValue'] = 'product'): MultiplicationExplorerChallenge => ({
  id, type, instruction: hiddenValue === 'factor1' ? `? × ${b} = ${a * b}. What is the missing number?` : `What is ${a} × ${b}?`,
  targetFact: `${a} × ${b} = ${a * b}`, fact: { factor1: a, factor2: b }, hiddenValue, timeLimit: null, hint: '', narration: '',
  representation: type === 'distributive' ? 'area_model' : 'array',
});
const data = (challenges: MultiplicationExplorerChallenge[]): MultiplicationExplorerData => ({
  title: 'Facts', description: 'Multiply', fact: { factor1: 9, factor2: 9, product: 81 },
  representations: { equalGroups: true, array: true, repeatedAddition: true, numberLine: true, areaModel: true },
  activeRepresentation: 'array', challenges, imagePrompt: null, gradeBand: '3-4',
  showOptions: { showProduct: false, showFactFamily: false, showCommutativeFlip: false, showDistributiveBreakdown: false },
});
const mount = (mode: Mode, challenges: MultiplicationExplorerChallenge[]) =>
  mountWorkspace({ primitiveId: 'multiplication-explorer', evalMode: mode, instanceId: 'multiply', data: data(challenges) as never });
const answer = (h: WorkspaceHarness, n: number) => {
  act(() => { fireEvent.change(h.view.container.querySelector('input[aria-label="Your answer"]')!, { target: { value: String(n) } }); });
  h.press('Check');
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts ?? [];
const words = (h: WorkspaceHarness) => {
  const walker = document.createTreeWalker(h.view.container, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n.textContent ?? '');
  return out.join(' ');
};
const shows = (text: string, n: number) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text);
const lever = (h: WorkspaceHarness, sel: string) => h.view.container.querySelector(`[data-lever="${sel}"]`);

it('skip_strip: boxes of the group size, totals up to the last group, a ? for the last; recorded on the next attempt', () => {
  const h = mount('build', [item('b', 'build', 3, 4)]);
  answer(h, 7);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'added_factors' });
  expect(h.dispatch('pull_lever', { lever: 'skip_strip' }).status).toBe('committed');
  expect(lever(h, 'skip-strip')!.textContent).toBe('44484?');
  expect(String(demand(h).onScreen)).toMatch(/3 boxes of 4/);
  expect(shows(words(h), 12)).toBe(false);
  expect(shows(JSON.stringify(demand(h)), 12)).toBe(false);
  expect(h.dispatch('pull_lever', { lever: 'skip_strip' }).status).toBe('blocked');
  h.dispatch('retry');
  answer(h, 12);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['skip_strip'] });
  h.close();
});

it('fluency show_model draws the array; distributive break_apart shows the parts and a ? for the sum', () => {
  const q = mount('fluency', [item('q', 'fluency', 6, 4)]);
  expect(q.view.container.textContent).not.toMatch(/rows ×/);
  answer(q, 10);
  expect(q.dispatch('pull_lever', { lever: 'show_model' }).status).toBe('committed');
  expect(q.view.container.textContent).toMatch(/6 rows × 4 columns/);
  expect(shows(words(q), 24)).toBe(false);
  q.close(); cleanup();
  const d = mount('distributive', [item('d', 'distributive', 7, 6)]);
  answer(d, 30);
  expect(attempts(d).at(-1)).toMatchObject({ miss: 'one_part_only' });
  expect(d.dispatch('pull_lever', { lever: 'break_apart' }).status).toBe('committed');
  expect(lever(d, 'break-apart')!.textContent).toMatch(/30\s*\+\s*12\s*=\s*\?/);
  expect(shows(words(d), 42)).toBe(false);
  d.close();
});

it('missing factor skip_line: jumps of the shown factor, only 0 and the product labelled', () => {
  const h = mount('missing_factor', [item('f', 'missing_factor', 5, 4, 'factor1')]);
  answer(h, 20);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'gave_product' });
  expect(h.dispatch('pull_lever', { lever: 'skip_line' }).status).toBe('committed');
  const line = lever(h, 'skip-line')!;
  expect(Array.from(line.querySelectorAll('text')).map(t => t.textContent)).toEqual(['0', '20']);
  expect(line.querySelectorAll('path')).toHaveLength(7);
  expect(shows(words(h), 5)).toBe(false);
  h.close();
});

it('smaller_fact opens an ungraded smaller fact, then the full item comes back blank', () => {
  const h = mount('build', [item('b', 'build', 6, 4), item('b2', 'build', 2, 5)]);
  answer(h, 10);
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_fact' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('b~smaller');
  expect(receipt.state.task!.task).toBe('Find 3 groups of 4. How many is that in total?');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'b' });
  expect((h.view.container.querySelector('input[aria-label="Your answer"]') as HTMLInputElement).value).toBe('');
  answer(h, 12);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b');
  expect(h.view.container.querySelector('[data-equation]')!.textContent).toBe('6 × 4 = ?');
  answer(h, 24);
  expect(attempts(h).map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['b', false, false], ['b~smaller', true, true], ['b', true, false]]);
  h.close();
});
