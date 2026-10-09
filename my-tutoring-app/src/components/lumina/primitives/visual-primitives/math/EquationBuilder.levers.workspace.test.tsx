// @vitest-environment jsdom
/**
 * equation-builder levers on the six non-build-open modes (`equationBuilderLevers.ts`), mounted the way a lesson mounts
 * it. A help pull changes the screen and the scene fact in one commit and is recorded on the next attempt; a refused
 * pull changes nothing; the smaller-numbers practice item is ungraded, keeps itself on Try again, and gives the full
 * item back blank, credited with the levers recorded.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { EquationBuilderChallenge } from './EquationBuilder';
import { equationBuilderHarnessInputs } from './equationBuilderWorkspace';
import { DOTS_LEVER, EQ_FRAME_LEVER, MATCH_LEVER, PRINTED_DOTS_LEVER, REWRITE_MODEL_LEVER, SMALLER_NUMBERS_LEVER } from './equationBuilderLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const build: EquationBuilderChallenge = { id: 'b1', type: 'build', instruction: 'Build an addition equation that equals 8.',
  targetEquation: '5 + 3 = 8', availableTiles: ['+', '4', '5', '3', '2', '8', '='] };
const truth: EquationBuilderChallenge = { id: 't1', type: 'true-false', instruction: 'Is this equation true or false?',
  displayEquation: '7 = 5 + 3', isTrue: false };
const balance: EquationBuilderChallenge = { id: 'bal', type: 'balance', instruction: 'Make both sides equal.',
  leftSide: '3 + 4', rightSide: '? + 2', correctAnswer: 5 };
const rewrite: EquationBuilderChallenge = { id: 'r1', type: 'rewrite', instruction: 'Write this equation another way.',
  originalEquation: '3 + 4 = 7', acceptedForms: ['4 + 3 = 7', '7 = 3 + 4', '7 = 4 + 3'], availableTiles: ['2', '-', '7', '+', '3', '4', '1', '='] };
const lesson = (challenges: EquationBuilderChallenge[], supportTier?: 'easy') =>
  ({ title: 'Equations', challenges, maxNumber: 10, gradeBand: '1', ...(supportTier ? { supportTier } : {}) });

type H = WorkspaceHarness;
const q = (h: H, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: H) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: H) => h.state().task!.workspace!.attempts;
function perform(h: H, c: EquationBuilderChallenge, wrong: boolean) {
  for (const input of equationBuilderHarnessInputs(c, wrong)) {
    if (input.type === 'choose') h.press(input.label);
    else if (input.type === 'touch') h.touch(input.target);
    else act(() => { fireEvent.change(h.view.container.querySelector(`input[aria-label="${input.label}"]`)!, { target: { value: input.text } }); });
  }
}

it('true-false: dots under the printed numbers in the pull\'s own commit; a second pull is refused and changes nothing', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'true-false', data: lesson([truth]) as never });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([[PRINTED_DOTS_LEVER, 'help', false], [SMALLER_NUMBERS_LEVER, 'simplify', false]]);
  perform(h, truth, true);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'said_true' });
  expect(observerLever(h.state(), true)).toBe(PRINTED_DOTS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: PRINTED_DOTS_LEVER });
  expect(receipt.status).toBe('committed');
  // 7, 5 and 3 dots; none for =, + or a total.
  expect(Array.from(q(h, '[data-lever="printed-dots"]')).map(d => d.children.length)).toEqual([7, 5, 3]);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/dots under it/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: JSON.stringify(levers(h)), attempts: attempts(h).length,
    dots: q(h, '[data-lever]').length };
  expect(h.dispatch('pull_lever', { lever: PRINTED_DOTS_LEVER }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: JSON.stringify(levers(h)), attempts: attempts(h).length,
    dots: q(h, '[data-lever]').length }).toEqual(before);
  h.dispatch('retry');
  perform(h, truth, false);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 't1', correct: true, assisted: true, levers: [PRINTED_DOTS_LEVER] });
  h.close();
});

it('balance: dots on both sides, none under the ?', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'balance-both-sides', data: lesson([balance]) as never });
  expect(h.dispatch('pull_lever', { lever: PRINTED_DOTS_LEVER }).status).toBe('committed');
  expect(Array.from(q(h, '[data-lever="printed-dots"]')).map(d => d.children.length)).toEqual([3, 4, 2]);
  h.close();
});

it('build: the frame and the row dots draw on screen; smaller numbers opens an ungraded practice build, then the full item comes back blank', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'build-simple', data: lesson([build]) as never });
  expect(levers(h).map(l => l.id)).toEqual([DOTS_LEVER, EQ_FRAME_LEVER, SMALLER_NUMBERS_LEVER]);
  for (const t of ['5', '+', '3']) h.press(`Tile ${t}`);
  h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'unfinished_equation' });
  expect(h.dispatch('pull_lever', { lever: EQ_FRAME_LEVER }).status).toBe('committed');
  const frame = q(h, '[data-lever="equation-frame"]')[0];
  expect(frame.children).toHaveLength(5);
  expect(frame.textContent).toBe('=');
  expect(h.dispatch('pull_lever', { lever: DOTS_LEVER }).status).toBe('committed');
  expect(Array.from(q(h, '[data-lever="number-dots"]')).map(d => d.children.length)).toEqual([5, 3]);
  expect(h.dispatch('pull_lever', { lever: SMALLER_NUMBERS_LEVER }).status).toBe('committed');
  // The practice item: 2 + 2 = 4, its own tiles, an empty row, no levers offered.
  expect(h.state().task).toMatchObject({ itemId: 'b1~smaller' });
  expect(h.view.container.textContent).toMatch(/2 plus 2 equals 4/);
  expect(q(h, '[data-pip-object^="slot-"]')).toHaveLength(0);
  expect(q(h, '[aria-label="Tile 8"]')).toHaveLength(0);
  expect(levers(h)).toEqual([]);
  for (const t of ['2', '+', '2', '=', '5']) h.press(`Tile ${t}`);
  h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'b1~smaller', correct: false });
  h.dispatch('retry');
  // Try again reopens the practice item, its own pool.
  expect(h.state().task).toMatchObject({ itemId: 'b1~smaller' });
  expect(q(h, '[aria-label="Tile 4"]').length).toBeGreaterThan(0);
  expect(q(h, '[aria-label="Tile 8"]')).toHaveLength(0);
  for (const t of ['2', '+', '2', '=', '4']) h.press(`Tile ${t}`);
  h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'b1~smaller', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'b1' });
  expect(q(h, '[data-pip-object^="slot-"]')).toHaveLength(0);
  expect(q(h, '[aria-label="Tile 8"]').length).toBeGreaterThan(0);
  perform(h, build, false);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!a.practice])).toEqual([
    ['b1', false, false], ['b1~smaller', false, true], ['b1~smaller', true, true], ['b1', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ assisted: true, levers: [EQ_FRAME_LEVER, DOTS_LEVER, SMALLER_NUMBERS_LEVER] });
  h.close();
});

it('rewrite: the model is in other numbers and the marks ring the printed numbers only', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'rewrite', data: lesson([rewrite]) as never });
  expect(levers(h).map(l => l.id)).toEqual([REWRITE_MODEL_LEVER, DOTS_LEVER, MATCH_LEVER, SMALLER_NUMBERS_LEVER]);
  for (const t of ['3', '+', '4', '=', '7']) h.press(`Tile ${t}`);
  h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'same_as_printed' });
  const receipt = h.dispatch('pull_lever', { lever: REWRITE_MODEL_LEVER });
  expect(receipt.status).toBe('committed');
  const model = q(h, '[data-lever="rewrite-model"]')[0].textContent!;
  expect(model).toMatch(/Like this:/);
  expect(model.replace('Like this:', '')).not.toMatch(/[347]/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/written as/);
  // Try again empties the row, so the printed numbers are back in the pool to be ringed.
  h.dispatch('retry');
  expect(h.dispatch('pull_lever', { lever: MATCH_LEVER }).status).toBe('committed');
  expect(Array.from(q(h, '[data-lever="match-mark"]')).map(m => m.textContent).sort()).toEqual(['3', '4', '7']);
  h.close();
});

it('easy starts the printed dots shown, and that is not a pull', () => {
  const h = mountWorkspace({ primitiveId: 'equation-builder', evalMode: 'true-false', data: lesson([truth], 'easy') as never });
  expect(levers(h).find(l => l.id === PRINTED_DOTS_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-lever="printed-dots"]')).toHaveLength(3);
  perform(h, truth, false);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect(attempts(h).at(-1)!.levers).toBeUndefined();
  h.close();
});
