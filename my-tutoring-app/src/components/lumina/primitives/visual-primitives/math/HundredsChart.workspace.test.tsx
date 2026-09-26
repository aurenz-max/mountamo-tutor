// @vitest-environment jsdom
/**
 * Hundreds chart on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { HundredsChartChallenge } from './HundredsChart';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const base = { skipValue: 2, startNumber: 2, correctAnswer: '', options: [] as string[], hint: 'Look again.' };
const CHALLENGES: Record<HundredsChartChallenge['type'], HundredsChartChallenge> = {
  highlight_sequence: { ...base, id: 'h1', type: 'highlight_sequence', instruction: 'Tap every number in the skip-counting-by-2s pattern.',
    givenCells: [], correctCells: [2, 4, 6, 8, 10] },
  complete_sequence: { ...base, id: 'c1', type: 'complete_sequence', instruction: 'The first 2 numbers are highlighted. Tap the rest.',
    givenCells: [2, 4], correctCells: [6, 8, 10] },
  identify_pattern: { ...base, id: 'i1', type: 'identify_pattern', instruction: 'Which description matches the pattern?',
    givenCells: [2, 4, 6, 8, 10], correctCells: [2, 4, 6, 8, 10], correctAnswer: 'Every other cell in each row',
    options: ['A checkerboard pattern', 'Every other cell in each row', 'A single diagonal line'] },
  find_skip_value: { ...base, id: 'f1', type: 'find_skip_value', instruction: 'What is the skip value?',
    givenCells: [2, 4, 6], correctCells: [2, 4, 6], options: ['1', '2', '5'] },
};
const chart = (challenges: HundredsChartChallenge[]) => ({ title: 'Skip counting', gridMax: 10, gradeBand: '1', challenges });
/** The right work for a challenge, and one wrong version of it, through the chart's own controls. */
const work = (c: HundredsChartChallenge, wrong: boolean) => c.type === 'highlight_sequence' || c.type === 'complete_sequence'
  ? c.correctCells.filter(n => !c.givenCells.includes(n)).slice(0, wrong ? -1 : undefined).map(n => `cell-${n}`)
  : [`option-${wrong ? c.options.find(o => o !== (c.type === 'identify_pattern' ? c.correctAnswer : String(c.skipValue))) : (c.type === 'identify_pattern' ? c.correctAnswer : String(c.skipValue))}`];
const selected = (h: ReturnType<typeof mountWorkspace>) => Array.from(h.view.container.querySelectorAll('[data-cell]'))
  .filter(el => /bg-blue-500/.test(el.className)).length;

it('every catalog mode binds', () => {
  const modes = (getComponentById('hundreds-chart')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(CHALLENGES).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'hundreds-chart', pin: mode, objectiveIds: ['o'],
      data: chart([CHALLENGES[mode as HundredsChartChallenge['type']]]) }), mode).not.toBeNull();
  }
});

it.each(Object.values(CHALLENGES))('$type: a checked gesture that publishes no key; a wrong Check reopens clean on Try again, the right one completes once',
  async (c) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: c.type, data: chart([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    const published = JSON.stringify(task);
    if (c.type === 'identify_pattern') expect(published).not.toMatch(/correctAnswer/);
    if (c.type === 'highlight_sequence') expect(published).not.toMatch(/2, 4, 6/);

    for (const target of work(c, true)) h.touch(target);
    h.press('Check Answer');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    // Input is closed until Try again; Try again clears the rejected work.
    expect((h.view.container.querySelector(c.options.length ? 'button[data-pip-object^="option-"]' : 'button[data-cell="1"]') as HTMLButtonElement).disabled).toBe(true);
    h.dispatch('retry');
    expect(selected(h)).toBe(0);
    const check = Array.from(h.view.container.querySelectorAll('button')).find(b => b.textContent === 'Check Answer')!;
    expect(check.disabled).toBe(true);

    for (const target of work(c, false)) h.touch(target);
    h.press('Check Answer');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('a cell tap toggles once; given cells are not tappable', () => {
  const h = mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: 'complete_sequence', data: chart([CHALLENGES.complete_sequence]) });
  h.touch('cell-6'); h.touch('cell-8');
  expect(selected(h)).toBe(2);
  h.touch('cell-8');
  expect(selected(h)).toBe(1);
  h.touch('cell-2');
  expect(selected(h)).toBe(1);
});

it('the tutor is told what is drawn: the board, the highlighted numbers and the printed choices', () => {
  const h = mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: 'find_skip_value', data: chart([CHALLENGES.find_skip_value]) });
  expect(h.state().task!.demand).toMatchObject({ board: expect.stringContaining('1 to 10'), highlighted: '2, 4, 6', choices: '1 | 2 | 5' });
});

it('the adapter refuses a choice challenge whose choices lack the answer', () => {
  expect(() => LIVE_ADAPTERS['hundreds-chart'].validate(chart([{ ...CHALLENGES.find_skip_value, options: ['1', '5'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['hundreds-chart'].validate(chart([{ ...CHALLENGES.complete_sequence, correctCells: [2, 4] }]))).toThrow();
});
