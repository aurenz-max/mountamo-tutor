// @vitest-environment jsdom
/**
 * skip-counting-runner levers, mounted on the teaching workspace: a pull changes the screen and the scene fact in one
 * commit, a refused pull changes nothing, the next attempt records the lever, and the simpler count is ungraded with
 * the full item back blank after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { SkipCountingChallenge, SkipCountingRunnerData } from './SkipCountingRunner';
import { skipHarnessInputs, type SkipLine } from './skipCountingWorkspace';
import {
  ARRAY_ROWS, COUNT_TRAIL, HOP_DOTS, JUMP_MARKS, JUMP_SIZES, MODEL_COUNT, RING_GAPS, SIMPLER_LEVER, STEP_ARCS, practiceItem,
  practiceParent,
} from './skipCountingLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const LINE: SkipLine = { skipValue: 5, startFrom: 0, endAt: 30, direction: 'forward' };
const base = { id: 'c1', instruction: 'Do it.', hint: '', narration: '' };
const ITEMS: Record<SkipCountingChallenge['type'], SkipCountingChallenge> = {
  count_along: { ...base, type: 'count_along', startPosition: 0 },
  predict: { ...base, type: 'predict', startPosition: 15 },
  fill_missing: { ...base, type: 'fill_missing', startPosition: 0, hiddenPositions: [10, 20] },
  find_skip_value: { ...base, type: 'find_skip_value', startPosition: 0 },
  connect_multiplication: { ...base, type: 'connect_multiplication', startPosition: 20 },
};
/** Hard: every aid withdrawn, so every help starts released. */
const runner = (c: SkipCountingChallenge): SkipCountingRunnerData => ({
  title: 'Hops', ...LINE, character: { type: 'frog' }, challenges: [c], gradeBand: '2-3', supportTier: 'hard',
  showOptions: { showTrackLabels: false, showSequenceChips: false, showJumpArcs: false, showArray: false, showSkipValueBadge: false },
});
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);

/** The journey's inputs for the item on screen (a practice count is rebuilt from its parent, as the journey does). */
function perform(h: WorkspaceHarness, data: SkipCountingRunnerData, wrong: boolean) {
  const t = h.state().task!;
  const parent = practiceParent(t.itemId, data.challenges);
  const practice = parent ? practiceItem(parent, { challenges: data.challenges, line: LINE, showOptions: data.showOptions,
    supportTier: data.supportTier })! : null;
  const c = practice?.challenge ?? data.challenges.find(x => x.id === t.itemId)!;
  const filled = String(t.demand.filled ?? '').split(',').filter(s => s.trim()).map(Number);
  for (const input of skipHarnessInputs(c, practice?.line ?? LINE, wrong, { at: Number(t.demand.at), filled })) {
    if (input.type === 'touch') h.touch(input.target);
    else if (input.type === 'check') h.press('Check Answer');
    else act(() => { fireEvent.change(h.view.container.querySelector(`input[aria-label="${input.label}"]`)!, { target: { value: input.text } }); });
  }
}
const frozen = (h: WorkspaceHarness) => {
  const t = h.state().task!;
  return JSON.stringify({ demand: t.demand, levers: t.workspace!.levers, attempts: t.workspace!.attempts, html: h.view.container.innerHTML });
};

const MOUNTS = [
  ['count_along', COUNT_TRAIL, '[data-lever="count-trail"]', /written row of landings so far/],
  ['predict', JUMP_SIZES, '[data-lever="jump-sizes"]', /"\+5" written over each jump made so far; nothing is drawn past the frog/],
  ['fill_missing', STEP_ARCS, '[data-lever="step-arcs"]', /arc with "\+5" between every two neighbouring numbers/],
  ['fill_missing', RING_GAPS, '[data-lever="ring-gap"]', /A ring around each "\?" still to fill/],
  ['find_skip_value', HOP_DOTS, '[data-lever="hop-dots"] circle', /dot on each whole number passed over in the first three jumps/],
  ['find_skip_value', MODEL_COUNT, '[data-lever="model-count"]', /model number line beside the item counting by 10s/],
  ['connect_multiplication', JUMP_MARKS, '[data-lever="jump-marks"]', /its own arc, alternating colours; no numbers/],
  ['connect_multiplication', ARRAY_ROWS, '[data-lever="array-rows"]', /one row of 5 squares for each jump; the rows are not numbered/],
] as const;

describe.each(MOUNTS)('%s %s, mounted', (mode, help, drawn, fact) => {
  it('a wrong answer, then help: the picture and its fact in one commit; a refused pull changes nothing; the next try records it', () => {
    const data = runner(ITEMS[mode]);
    const h = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: mode, data: data as never });
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
    if (help === HOP_DOTS) expect(q(h, drawn)).toHaveLength(12);
    if (help === ARRAY_ROWS) expect(h.view.container.textContent).not.toMatch(/rows of|\b4\b/);
    const before = frozen(h);
    expect(h.dispatch('pull_lever', { lever: help }).status).toBe('blocked');
    expect(frozen(h)).toBe(before);
    h.dispatch('retry');
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: [help] });
    h.close();
  });
});

describe.each(['count_along', 'predict', 'fill_missing', 'find_skip_value', 'connect_multiplication'] as const)('%s simpler count', mode => {
  it('ungraded, its own id, the full item back blank after it and credited', () => {
    const data = runner(ITEMS[mode]);
    const h = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: mode, data: data as never });
    perform(h, data, true);
    const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
    expect(receipt.status).toBe('committed');
    expect(h.state().task).toMatchObject({ itemId: 'c1~simpler' });
    expect(h.state().task!.demand.practice).toBeTruthy();
    expect(q(h, '[data-practice]')).toHaveLength(1);
    expect(levers(h)).toEqual([]);
    perform(h, data, true);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: false });
    h.dispatch('retry');
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: true });
    h.dispatch('advance');
    expect(h.state().task).toMatchObject({ itemId: 'c1' });
    expect(q(h, '[data-practice]')).toHaveLength(0);
    // Blank: the character back at the item's start, nothing typed or filled.
    expect(h.state().task!.demand).toMatchObject({ at: ITEMS[mode].startPosition });
    expect(Array.from(q(h, 'input')).every(i => (i as HTMLInputElement).value === '')).toBe(true);
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'c1', correct: true });
    h.close();
  });
});
