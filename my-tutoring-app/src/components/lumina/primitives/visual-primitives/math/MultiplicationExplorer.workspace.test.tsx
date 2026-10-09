// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real MultiplicationExplorer on the shared teaching workspace, mounted the way a
 * lesson mounts it. Every mode is one typed number checked by the activity, committed with its named miss; Try again
 * clears it; the runtime owns progression; the open item never shows or publishes its answer.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MultiplicationExplorerChallenge, MultiplicationExplorerData } from './MultiplicationExplorer';
import { askFor, hintFor, missesFor, multiplicationMiss, numbersIn, resolveChallengeFact } from './multiplicationExplorerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

type Mode = MultiplicationExplorerChallenge['type'];
const item = (id: string, type: Mode, factor1: number, factor2: number, extra: Partial<MultiplicationExplorerChallenge> = {}): MultiplicationExplorerChallenge => ({
  id, type, instruction: type === 'missing_factor' ? `? × ${factor2} = ${factor1 * factor2}. What is the missing number?` : `How many in ${factor1} groups of ${factor2}?`,
  targetFact: `${factor1} × ${factor2} = ${factor1 * factor2}`, fact: { factor1, factor2 },
  hiddenValue: type === 'missing_factor' ? 'factor1' : 'product', timeLimit: null, hint: 'Look at the groups.', narration: '',
  representation: type === 'connect' ? 'all' : type === 'distributive' ? 'area_model' : 'number_line', ...extra,
});
const ITEMS: Record<Mode, MultiplicationExplorerChallenge> = {
  build: item('b', 'build', 3, 4),
  connect: item('c', 'connect', 3, 4),
  commutative: item('m', 'commutative', 3, 4),
  distributive: item('d', 'distributive', 7, 6),
  missing_factor: item('f', 'missing_factor', 5, 4),
  fluency: item('q', 'fluency', 3, 4),
};
const KEY: Record<Mode, number> = { build: 12, connect: 12, commutative: 12, distributive: 42, missing_factor: 5, fluency: 12 };

/** Every scaffold the session can switch on, so the test sees what each one shows while the item is open. */
const data = (challenges: MultiplicationExplorerChallenge[]): MultiplicationExplorerData => ({
  title: 'Sticker Packs', description: 'Multiply', fact: { factor1: 9, factor2: 9, product: 81 },
  representations: { equalGroups: true, array: true, repeatedAddition: true, numberLine: true, areaModel: true },
  activeRepresentation: 'groups', challenges, imagePrompt: null, gradeBand: '3-4',
  showOptions: { showProduct: true, showFactFamily: true, showCommutativeFlip: true, showDistributiveBreakdown: true },
});
const mount = (mode: Mode, challenges: MultiplicationExplorerChallenge[]) =>
  mountWorkspace({ primitiveId: 'multiplication-explorer', evalMode: mode, instanceId: 'multiply', data: data(challenges) as never });
const type = (h: WorkspaceHarness, text: string | number) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="Your answer"]')!, { target: { value: String(text) } });
});
const answer = (h: WorkspaceHarness, text: string | number) => { type(h, text); h.press('Check'); };
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts ?? [];
const input = (h: WorkspaceHarness) => h.view.container.querySelector('input[aria-label="Your answer"]') as HTMLInputElement;
/** Visible text, one node per word (textContent runs "4" and "8" together). */
const words = (h: WorkspaceHarness) => {
  const walker = document.createTreeWalker(h.view.container, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n.textContent ?? '');
  return out.join(' ');
};
const shows = (text: string, n: number) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text);

it.each(Object.keys(ITEMS) as Mode[])('%s mounts under tutor ownership; the open item neither shows nor publishes its answer', mode => {
  const c = ITEMS[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(askFor(c, resolveChallengeFact(c, { factor1: 9, factor2: 9, product: 81 })));
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(shows(JSON.stringify(demand(h)) + h.state().task!.task, KEY[mode])).toBe(false);
  // With the product readout, fact family and break-apart all on, the screen still does not print the answer.
  h.press('4. Strategy');
  if (mode === 'distributive') h.press(/Break It Up/);
  expect(shows(words(h), KEY[mode])).toBe(false);
  expect(h.view.container.querySelector('[data-equation]')!.textContent).toContain('?');
  // A picture that would show the answer is not drawn: a factor's groups, a fluency fact's array.
  expect(String(demand(h).picture)).toMatch(mode === 'missing_factor' || mode === 'fluency' ? /^none/ : /\d/);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Next Challenge|Submit Results/);
  answer(h, KEY[mode]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(attempts(h)).toHaveLength(1);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('a wrong answer names its miss and closes the input; Try again clears it; a right one completes and submits once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build', [ITEMS.build, item('b2', 'build', 2, 5)]);
  answer(h, 7);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'added_factors', response: 'Typed 7 as the answer' });
  expect(demand(h).learnerWork).toBe('Typed 7 as the answer, marked wrong');
  expect(input(h).disabled).toBe(true);
  type(h, 12);
  expect(input(h).value).toBe('7');
  h.dispatch('retry');
  expect(input(h).value).toBe('');
  expect(demand(h).learnerWork).toBe('No answer typed yet');
  answer(h, 12);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  // Solved: the product may now be shown.
  expect(shows(words(h), 12)).toBe(true);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b2');
  expect(input(h).value).toBe('');
  expect(shows(words(h), 10)).toBe(false);
  answer(h, 10);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , metrics, work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(metrics).toMatchObject({ type: 'multiplication-explorer', factsCorrect: 2 });
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toContainEqual(expect.objectContaining({ itemId: 'b', miss: 'added_factors' }));
  h.close();
});

it('missing factor: the equation shows ? for the factor, no picture is drawn, and the product typed back is gave_product', () => {
  const h = mount('missing_factor', [ITEMS.missing_factor]);
  expect(h.view.container.querySelector('[data-equation]')!.textContent).toBe('? × 4 = 20');
  expect(h.view.container.textContent).not.toMatch(/groups? of|rows ×|Skip count by|Flip:/);
  answer(h, 20);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'gave_product', response: 'Typed 20 as the missing factor' });
  h.close();
});

it('a hint that names the answer, in digits or words, is not shown', () => {
  const c = item('b', 'build', 3, 4, { hint: 'Count up: 4, 8, 12.' });
  const f = resolveChallengeFact(c, { factor1: 0, factor2: 0, product: 0 });
  expect(hintFor(c, f)).toBe('Not quite. Try again!');
  const mf = item('f', 'missing_factor', 7, 3, { hiddenValue: 'factor2', hint: 'How many groups of three make twenty-one?' });
  expect(hintFor(mf, resolveChallengeFact(mf, f))).toBe('Not quite. Try again!');
  expect(hintFor(item('x', 'build', 3, 4, { hint: 'Count by fours.' }), { factor1: 3, factor2: 4, product: 12 })).toBe('Not quite. Count by fours.');
  expect(numbersIn('sevens, twenty-one, 14 and twenties')).toEqual([14, 7, 21, 20]);
  const h = mount('build', [c]);
  answer(h, 11);
  expect(words(h)).toContain('Not quite. Try again!');
  expect(shows(words(h), 12)).toBe(false);
  h.close();
});

it('multiplicationMiss names each mode\'s signature errors, and the catalog lists them', () => {
  const f = (c: MultiplicationExplorerChallenge) => resolveChallengeFact(c, { factor1: 0, factor2: 0, product: 0 });
  const p = (n: number, c = ITEMS.build) => multiplicationMiss(c, f(c), String(n));
  expect([p(7), p(8), p(9), p(15), p(16), p(13), p(20), p(12)]).toEqual(
    ['added_factors', 'one_group_short', 'one_group_short', 'one_group_over', 'one_group_over', 'off_by_one', 'other_product', undefined]);
  // 7 × 6 breaks into 5 × 6 + 2 × 6.
  expect([p(30, ITEMS.distributive), p(12, ITEMS.distributive), p(13, ITEMS.distributive)]).toEqual(['one_part_only', 'one_part_only', 'added_factors']);
  const m = (n: number) => p(n, ITEMS.missing_factor);
  expect([m(20), m(4), m(16), m(6), m(9), m(5)]).toEqual(['gave_product', 'gave_known_factor', 'subtracted', 'one_jump_off', 'other_factor', undefined]);
  const misses = getComponentById('multiplication-explorer')!.teachingWorkspace!.misses!;
  for (const mode of Object.keys(ITEMS) as Mode[]) expect(misses[mode]).toEqual([...missesFor(mode)]);
});
