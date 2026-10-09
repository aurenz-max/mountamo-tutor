// @vitest-environment jsdom
/**
 * hundreds-chart levers (`hundredsChartLevers.ts`), mounted the way a lesson mounts it: a help picture changes the
 * screen and the scene fact in one commit and leaves the answer to the learner; a refused pull changes nothing; the
 * next try records the lever; the simpler chart is ungraded and gives the full item back blank, credited after.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { HundredsChartChallenge, HundredsChartData } from './HundredsChart';
import { hundredsChartHarnessInputs } from './hundredsChartWorkspace';
import {
  DOTS_LEVER, MODEL_LEVER, PATTERN_DESCRIPTIONS, SIMPLER_LEVER, TALLY_LEVER, hopDots, practiceItem, practiceParent,
} from './hundredsChartLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const seq = (sv: number, end: number) => Array.from({ length: Math.floor(end / sv) }, (_, i) => sv * (i + 1));
const base = { id: 'c1', instruction: 'Do it.', skipValue: 5, startNumber: 5, hint: 'Look again.', correctAnswer: '', options: [] as string[] };
const ITEMS: Record<HundredsChartChallenge['type'], HundredsChartChallenge> = {
  highlight_sequence: { ...base, type: 'highlight_sequence', givenCells: [], correctCells: seq(5, 30) },
  complete_sequence: { ...base, type: 'complete_sequence', givenCells: [5, 10, 15], correctCells: [20, 25, 30] },
  identify_pattern: { ...base, type: 'identify_pattern', givenCells: seq(5, 30), correctCells: seq(5, 30),
    correctAnswer: PATTERN_DESCRIPTIONS[5].correct, options: [PATTERN_DESCRIPTIONS[5].correct, ...PATTERN_DESCRIPTIONS[5].distractors] },
  find_skip_value: { ...base, type: 'find_skip_value', givenCells: [5, 10, 15, 20], correctCells: [5, 10, 15, 20], correctAnswer: '5',
    options: ['2', '3', '5', '10'] },
};
const chart = (c: HundredsChartChallenge): HundredsChartData => ({ title: 'Skip counting', gridMax: 30, gradeBand: '2', challenges: [c] });
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const selected = (h: WorkspaceHarness) => Array.from(q(h, '[data-cell]')).filter(el => /bg-blue-500/.test(el.className)).length;

/** The journey's inputs for the item on screen (a practice chart is rebuilt from its parent, as the journey does). */
function perform(h: WorkspaceHarness, data: HundredsChartData, wrong: boolean) {
  const id = h.state().task!.itemId;
  const parent = practiceParent(id, data.challenges);
  const c = parent ? practiceItem(parent, data)! : data.challenges.find(x => x.id === id)!;
  for (const input of hundredsChartHarnessInputs(c, wrong, data.gridMax)) {
    if (input.type === 'choose') h.press(input.label); else h.touch(input.target);
  }
}
const frozen = (h: WorkspaceHarness) => {
  const t = h.state().task!;
  return JSON.stringify({ demand: t.demand, levers: t.workspace!.levers, attempts: t.workspace!.attempts, html: h.view.container.innerHTML });
};

const MOUNTS = [
  ['highlight_sequence', DOTS_LEVER, '[data-lever="hop-dot"]', /dot on each cell passed over between one tapped number/],
  ['complete_sequence', TALLY_LEVER, '[data-lever="row-tally"] [data-tally-row]', /At the end of each row, one dot/],
  ['identify_pattern', MODEL_LEVER, '[data-lever="model-chart"]', /model chart of 1 to 30 beside the item, the count by 2s highlighted on it, captioned "Every other cell in each row" \(one of the choices\)/],
  ['find_skip_value', DOTS_LEVER, '[data-lever="hop-dot"]', /dot on each cell passed over between one highlighted number and the next; no numbers are written on the dots and nothing is marked past 20/],
] as const;

describe.each(MOUNTS)('%s, mounted', (mode, help, drawn, fact) => {
  it('a wrong answer, then help: the picture and its fact in one commit; a refused pull changes nothing; the next try records it', () => {
    const data = chart(ITEMS[mode]);
    const h = mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: mode, data: data as never });
    expect(levers(h).find(l => l.id === help)).toMatchObject({ kind: 'help', pulled: false });
    expect(levers(h).at(-1)).toMatchObject({ id: SIMPLER_LEVER, kind: 'simplify', pulled: false });
    expect(q(h, '[data-lever]')).toHaveLength(0);
    perform(h, data, true);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: false });
    expect(last(h)!.miss).toBeTruthy();
    const receipt = h.dispatch('pull_lever', { lever: help });
    expect(receipt.status).toBe('committed');
    expect(q(h, drawn).length).toBeGreaterThan(0);
    expect(String(receipt.state.task!.demand.onScreen)).toMatch(fact);
    // The learner's own wrong taps are still on screen: the dots run between them.
    if (mode === 'highlight_sequence') {
      const taps = Array.from(q(h, '[data-cell]')).filter(el => /bg-blue-500/.test(el.className)).map(el => Number(el.getAttribute('data-cell')));
      expect(q(h, drawn)).toHaveLength(hopDots(ITEMS[mode], taps)!.length);
    }
    if (mode === 'identify_pattern') {
      expect(q(h, '[data-model-caption]')[0].textContent).not.toBe(ITEMS[mode].correctAnswer);
      expect(q(h, '[data-model-cell][data-on]')).toHaveLength(15);
    }
    const before = frozen(h);
    expect(h.dispatch('pull_lever', { lever: help }).status).toBe('blocked');
    expect(frozen(h)).toBe(before);
    h.dispatch('retry');
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: [help] });
    h.close();
  });

  it('the simpler chart: ungraded, its own id, the full item back blank after it and credited', () => {
    const data = chart(ITEMS[mode]);
    const h = mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: mode, data: data as never });
    perform(h, data, true);
    h.dispatch('pull_lever', { lever: help });
    const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
    expect(receipt.status).toBe('committed');
    expect(h.state().task).toMatchObject({ itemId: 'c1~simpler' });
    expect(h.state().task!.demand.practice).toBeTruthy();
    expect(q(h, '[data-practice]')).toHaveLength(1);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    expect(levers(h)).toEqual([]);
    expect(selected(h)).toBe(0);
    perform(h, data, true);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: false });
    h.dispatch('retry');
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: true });
    h.dispatch('advance');
    expect(h.state().task).toMatchObject({ itemId: 'c1' });
    expect(q(h, '[data-practice]')).toHaveLength(0);
    expect(q(h, '[data-lever]').length).toBeGreaterThan(0);
    // Blank: nothing tapped or chosen, so Check waits for the learner.
    expect(selected(h)).toBe(0);
    expect(Array.from(q(h, 'button')).find(b => b.textContent === 'Check Answer')!.hasAttribute('disabled')).toBe(true);
    perform(h, data, false);
    const attempts = h.state().task!.workspace!.attempts;
    expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
      ['c1', false, false], ['c1~simpler', false, true], ['c1~simpler', true, true], ['c1', true, false]]);
    expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [help, SIMPLER_LEVER] });
    h.close();
  });
});

it('highlight with no taps: the dots run from 1 and stop before the first number of the count', () => {
  const data = chart(ITEMS.highlight_sequence);
  const h = mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: 'highlight_sequence', data: data as never });
  h.dispatch('pull_lever', { lever: DOTS_LEVER });
  expect(Array.from(q(h, '[data-lever="hop-dot"]')).map(el => el.closest('[data-cell]')!.getAttribute('data-cell'))).toEqual(['1', '2', '3', '4']);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/stopping before the count's first number/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\b5\b/);
  h.close();
});

it('easy starts with the dots shown, and that is not a pull', () => {
  const data = chart({ ...ITEMS.find_skip_value, supportTier: 'easy' });
  const h = mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: 'find_skip_value', data: data as never });
  expect(levers(h).find(l => l.id === DOTS_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-lever="hop-dot"]')).toHaveLength(12);
  perform(h, data, false);
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});
