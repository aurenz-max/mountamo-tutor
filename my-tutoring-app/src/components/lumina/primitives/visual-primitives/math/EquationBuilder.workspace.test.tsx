// @vitest-environment jsdom
/**
 * Equation builder on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { EquationBuilderChallenge } from './EquationBuilder';
import { buildMatches, equationBuilderHarnessInputs } from './equationBuilderWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const build: EquationBuilderChallenge = { id: 'b1', type: 'build', instruction: 'Build an addition equation that equals 5.',
  targetEquation: '3 + 2 = 5', availableTiles: ['2', '+', '3', '=', '5', '4', '-'] };
const missingResult: EquationBuilderChallenge = { id: 'm1', type: 'missing-value', instruction: 'What number makes it true?',
  equation: '4 + 3 = ?', missingPosition: 4, correctValue: 7, options: [6, 7, 8] };
const missingOperand: EquationBuilderChallenge = { id: 'm2', type: 'missing-value', instruction: 'What number is missing?',
  equation: '4 + ? = 7', missingPosition: 2, correctValue: 3, options: [2, 3, 4] };
const truth: EquationBuilderChallenge = { id: 't1', type: 'true-false', instruction: 'Is this equation true or false?',
  displayEquation: '3 + 2 = 6', isTrue: false };
const balance: EquationBuilderChallenge = { id: 'bal', type: 'balance', instruction: 'Make both sides equal.',
  leftSide: '3 + 4', rightSide: '? + 2', correctAnswer: 5 };
const rewrite: EquationBuilderChallenge = { id: 'r1', type: 'rewrite', instruction: 'Write this equation another way.',
  originalEquation: '3 + 2 = 5', acceptedForms: ['2 + 3 = 5', '5 = 3 + 2'], availableTiles: ['3', '+', '2', '=', '5', '4'] };
const BANK = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), '+', '-'];
const makeTen: EquationBuilderChallenge = { id: 'mk1', type: 'make-n', instruction: 'Make a number sentence that equals 10.',
  target: 10, ways: 1, availableTiles: BANK };
const BY_MODE: Record<string, EquationBuilderChallenge> = {
  'build-simple': build, 'missing-result': missingResult, 'true-false': truth, 'missing-operand': missingOperand,
  'balance-both-sides': balance, rewrite, 'make-n': makeTen,
};
const builder = (challenges: EquationBuilderChallenge[]) => ({ title: 'Equations', challenges, maxNumber: 10, gradeBand: '1' });

type Mounted = ReturnType<typeof mountWorkspace>;
/** The journey's own inputs, performed through the builder's controls. */
function perform(h: Mounted, c: EquationBuilderChallenge, wrong: boolean) {
  for (const input of equationBuilderHarnessInputs(c, wrong)) {
    if (input.type === 'choose') h.press(input.label);
    else if (input.type === 'touch') h.touch(input.target);
    else act(() => { fireEvent.change(h.view.container.querySelector(`input[aria-label="${input.label}"]`)!, { target: { value: input.text } }); });
  }
}
const slotCount = (h: Mounted) => h.view.container.querySelectorAll('[data-pip-object^="slot-"]').length;

it('every catalog mode binds', () => {
  const modes = (getComponentById('equation-builder')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(BY_MODE).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'equation-builder', pin: mode, objectiveIds: ['o'],
      data: builder([BY_MODE[mode]]) }), mode).not.toBeNull();
  }
});

it.each(Object.entries(BY_MODE))('%s: a checked gesture that publishes no key; a wrong Check reopens on Try again, the right one completes once',
  async (mode, c) => {
    const open = c.type === 'make-n';
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: mode, data: builder([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    const published = JSON.stringify(task);
    for (const key of ['targetEquation', 'correctValue', 'isTrue', 'correctAnswer', 'acceptedForms']) expect(published).not.toContain(key);
    if (c.type === 'build') expect(published).not.toMatch(/3 \+ 2 = 5/);
    if (c.type === 'rewrite') expect(published).not.toMatch(/2 \+ 3 = 5|5 = 3 \+ 2/);

    perform(h, c, true);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    // Input is closed until Try again: no second Check on the same miss.
    const check = () => Array.from(h.view.container.querySelectorAll('button')).find(b => b.textContent === (open ? "I'm done!" : 'Check'))!;
    expect(check().disabled).toBe(true);
    h.dispatch('retry');
    // Try again clears the rejected work; an open build keeps it to revise.
    expect(slotCount(h)).toBe(open ? 1 : 0);
    // Check stays closed until new work: the tiles, choice or number are gone.
    expect(check().disabled).toBe(!open);

    perform(h, c, false);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('a build is the target in any order that keeps it true and equal to the same amount', () => {
  expect(buildMatches(['3', '+', '2', '=', '5'], '3 + 2 = 5')).toBe(true);
  expect(buildMatches(['2', '+', '3', '=', '5'], '3 + 2 = 5')).toBe(true);
  expect(buildMatches(['5', '=', '2', '+', '3'], '3 + 2 = 5')).toBe(true);
  expect(buildMatches(['5', '-', '3', '=', '2'], '5 - 2 = 3')).toBe(false);
  expect(buildMatches(['4', '+', '1', '=', '5'], '3 + 2 = 5')).toBe(false);
  expect(buildMatches(['3', '+', '2', '='], '3 + 2 = 5')).toBe(false);
});

it('the tutor is told what is drawn: the printed equation, the tiles and the choices', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'missing-operand', data: builder([missingOperand]) });
  expect(h.state().task!.demand).toMatchObject({ equation: '4 + ? = 7', choices: '2 | 3 | 4' });
  cleanup();
  const b = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'balance-both-sides', data: builder([balance]) });
  expect(b.state().task!.demand).toMatchObject({ equation: '3 + 4 = ? + 2' });
});

it('a missed build does not show the target', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'build-simple', data: builder([build]) });
  for (const t of ['5', '-', '3', '=', '2']) h.press(`Tile ${t}`);
  h.press('Check');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.view.container.textContent).not.toMatch(/3 \+ 2 = 5/);
});

it('the adapter refuses a challenge its controls cannot answer', () => {
  expect(() => LIVE_ADAPTERS['equation-builder'].validate(builder([{ ...missingOperand, options: [2, 4] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['equation-builder'].validate(builder([{ ...build, availableTiles: ['3', '+', '=', '5'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['equation-builder'].validate(builder([{ ...rewrite, availableTiles: ['3', '+', '2', '='] }]))).toThrow();
  expect(LIVE_ADAPTERS['equation-builder'].validate(builder([truth]))).toBeTruthy();
  expect(() => LIVE_ADAPTERS['equation-builder'].validate(builder([{ ...makeTen, availableTiles: ['10', '+'] }]))).toThrow();
  expect(LIVE_ADAPTERS['equation-builder'].validate(builder([makeTen]))).toBeTruthy();
});

// ── make-n (open build) ─────────────────────────────────────────────────────

const makeTwo: EquationBuilderChallenge = { ...makeTen, id: 'mk2', ways: 2, instruction: 'Make two different number sentences that equal 10.' };
const lastMiss = (h: Mounted) => h.state().task!.workspace!.attempts.at(-1)?.miss;
const tiles = (h: Mounted, ...t: string[]) => t.forEach(x => h.press(`Tile ${x}`));
const done = (h: Mounted) => h.press("I'm done!");

it('make-n: the scene counts the tiles placed and never says what the row makes; Try again keeps the build to revise', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'make-n', data: builder([makeTen]) });
  tiles(h, '4', '+', '5');
  const demand = h.state().task!.demand as Record<string, unknown>;
  expect(demand).toMatchObject({ kind: 'make-n', total: 10, row: '4 + 5', tilesPlaced: 3, numbersPlaced: 2 });
  // Nothing in the scene is the row's value (9), except the bank listing every tile.
  expect(Object.entries(demand).filter(([k, v]) => v === 9 || (typeof v === 'string' && k !== 'tileBank' && /\b9\b/.test(v)))).toEqual([]);
  done(h);
  expect(lastMiss(h)).toBe('one_short');
  h.dispatch('retry');
  expect(slotCount(h)).toBe(3);
  // The verdict's words stay until the next check, and name no value.
  expect(h.view.container.textContent).toMatch(/does not make 10/);
  h.touch('slot-2'); // take the 5 out
  expect(h.state().task!.demand).toMatchObject({ tilesPlaced: 2 });
  tiles(h, '6');
  done(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ response: 'Built 4 + 6 = 10', correct: true });
});

it('make-n: misses for one over, far off, a malformed row, and the total alone', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'make-n', data: builder([makeTen]) });
  const attempt = (row: string[], miss: string) => {
    h.press('Clear'); tiles(h, ...row); done(h);
    expect(lastMiss(h), row.join(' ')).toBe(miss);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.dispatch('retry');
  };
  attempt(['4', '+', '7'], 'one_over');
  attempt(['12', '-', '4'], 'short_by_more');
  attempt(['4', '+'], 'unfinished_sentence');
  attempt(['4', '6'], 'unfinished_sentence');
  attempt(['10'], 'bare_number');
  h.press('Clear'); tiles(h, '12', '-', '2'); done(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('make-n: a two-way item keeps the first way on screen and refuses the same numbers turned around', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'make-n', data: builder([makeTwo]) });
  tiles(h, '4', '+', '6'); done(h);
  // The first way is accepted on screen, not committed: the item is still open, the row is empty for the second.
  expect(h.state().task!.evidence.correctness).toBe('unknown');
  expect(slotCount(h)).toBe(0);
  expect(h.state().task!.demand).toMatchObject({ waysAsked: 2, waysMade: 1, madeBefore: '4 + 6', tilesPlaced: 0 });
  expect(h.view.container.textContent).toMatch(/Way 2 of 2/);
  tiles(h, '6', '+', '4'); done(h);
  expect(lastMiss(h)).toBe('same_way');
  h.dispatch('retry');
  h.press('Clear'); tiles(h, '5', '+', '5'); done(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.lastResponse?.response).toBe('Built 5 + 5 = 10, after making 4 + 6 = 10');
});

it('make-n: levers start bare; dots and the frame draw on the learner\'s row, the simplify opens a smaller + only practice item', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'make-n', data: builder([makeTen]) });
  const levers = () => h.state().task!.workspace!.levers ?? [];
  expect(levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['number_dots', 'help', false], ['sentence_frame', 'help', false], ['smaller_total', 'simplify', false]]);
  expect(h.view.container.querySelectorAll('[data-lever]')).toHaveLength(0);
  tiles(h, '4', '+', '5'); done(h);
  expect(h.dispatch('pull_lever', { lever: 'number_dots' }).status).toBe('committed');
  const dots = h.view.container.querySelectorAll('[data-lever="number-dots"]');
  expect(Array.from(dots).map(d => d.children.length)).toEqual([4, 5]);
  expect(h.state().task!.demand).toMatchObject({ onScreen: expect.stringMatching(/dots under it/) });
  expect(h.dispatch('pull_lever', { lever: 'sentence_frame' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="sentence-frame"]')).toHaveLength(1);
  expect(h.dispatch('pull_lever', { lever: 'smaller_total' }).status).toBe('committed');
  // The practice item: half the total, one way, only the + sign, an empty row.
  expect(h.view.container.textContent).toMatch(/equals 5\./);
  expect(slotCount(h)).toBe(0);
  expect(h.view.container.querySelector('[aria-label="Tile -"]')).toBeNull();
  expect(h.view.container.querySelector('[aria-label="Tile 6"]')).toBeNull();
  tiles(h, '2', '+', '3'); done(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
});
