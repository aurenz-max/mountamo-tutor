// @vitest-environment jsdom
/**
 * The letter-spotter tap-mode levers on the shared teaching workspace (handoff 22 L1), mounted the way a
 * lesson mounts it. A pull changes the screen and the scene in the same commit and never marks the answer;
 * the practice item is ungraded and gives the full item back; only the full item's tap is credited.
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

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const FIND = { id: 'find', mode: 'find-it', targetLetter: 'b', targetCase: 'uppercase', letterGrid: 'DATINBSETINSARIN'.split('') };
const MATCH = { id: 'match', mode: 'match-it', targetLetter: 'd', targetCase: 'both', options: ['b', 'd', 'm', 't'] };
const data = { title: 'Letters', letterGroup: 3, cumulativeLetters: [], newLetters: [], gradeLevel: 'K', challenges: [FIND, MATCH] };
const mount = (mode: string, challenges: unknown[] = [FIND, MATCH]) =>
  mountWorkspace({ primitiveId: 'letter-spotter', evalMode: mode, data: { ...data, challenges } });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const cell = (h: WorkspaceHarness, letter: string) => act(() => {
  const cells = q(h, '[data-pip-object^="cell-"]') as HTMLElement[];
  fireEvent.click(cells.find(c => c.textContent === letter)!);
});
const tile = (h: WorkspaceHarness, letter: string) => act(() => {
  fireEvent.click(h.view.container.querySelector(`[data-pip-object="option-${letter}"]`) as HTMLElement);
});

it('find it, a look-alike tap: the observer pulls the lowercase reference, in the same commit', () => {
  const h = mount('find_it', [FIND]);
  expect(levers(h).map(l => l.id)).toEqual(['other_case_reference', 'row_scan', 'small_far_grid']);
  cell(h, 'D');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'same_shape_family' });
  expect(observerLever(h.state(), true)).toBe('other_case_reference');
  const receipt = h.dispatch('pull_lever', { lever: 'other_case_reference' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="other-case-reference"]').map(r => r.textContent)).toEqual(['b']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/small letter/);
  h.dispatch('retry');
  cell(h, 'B');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['other_case_reference'] });
  h.close();
});

it('find it, row scan: a highlight sweeps every row in turn and does not wait on the target\'s', () => {
  const h = mount('find_it', [FIND]);
  cell(h, 'A');
  expect(observerLever(h.state(), true)).toBe('row_scan');
  h.dispatch('pull_lever', { lever: 'row_scan' });
  // On screen from the pull, before Try again: the host says so at once (LB-16).
  expect(q(h, '[data-lever="row-scan"]')).toHaveLength(1);
  expect(q(h, '[data-scan-row="lit"]')).toHaveLength(4);
  h.dispatch('retry');
  const litRow = () => {
    const lit = q(h, '[data-scan-row="lit"]').map(c => (q(h, '[data-pip-object^="cell-"]') as Element[]).indexOf(c));
    expect(lit).toHaveLength(4);
    return Math.floor(lit[0] / 4);
  };
  const rows = [litRow()];
  for (let i = 0; i < 4; i++) { h.settle(900); rows.push(litRow()); }
  expect(rows).toEqual([0, 1, 2, 3, 0]);
  h.close();
});

it('match it: the partner lever exists only after a wrong tap, and shows only that tile\'s capital', () => {
  const h = mount('match_it', [MATCH]);
  expect(levers(h).map(l => l.id)).toEqual(['two_far_choices']);
  tile(h, 'b');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ miss: 'mirror_form' });
  expect(observerLever(h.state(), true)).toBe('wrong_choice_partner');
  h.dispatch('pull_lever', { lever: 'wrong_choice_partner' });
  expect(q(h, '[data-lever="partner-capital"]').map(p => p.textContent)).toEqual(['B']);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\bd\b|\bD\b/);
  h.dispatch('retry');
  // Try again keeps the partner; a second wrong tap adds its own.
  tile(h, 't');
  expect(q(h, '[data-lever="partner-capital"]').map(p => p.textContent).sort()).toEqual(['B', 'T']);
  h.close();
});

it('find it, the practice grid is ungraded, survives Try again, and gives the full grid back', () => {
  const h = mount('find_it', [FIND]);
  cell(h, 'D');
  h.dispatch('pull_lever', { lever: 'small_far_grid' });
  expect(h.state().task).toMatchObject({ itemId: 'find~simpler' });
  expect(h.state().task!.task).toMatch(/Find the letter A/i);
  expect(q(h, '[data-pip-object^="cell-"]').map(c => c.textContent).sort()).toEqual(['A', 'N', 'P', 'T']);
  cell(h, 'T');
  h.dispatch('retry');
  expect(h.state().task).toMatchObject({ itemId: 'find~simpler' });
  cell(h, 'A');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'find' });
  expect(q(h, '[data-pip-object^="cell-"]')).toHaveLength(16);
  cell(h, 'B');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['find', false, false], ['find~simpler', false, true], ['find~simpler', true, true], ['find', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['small_far_grid'] });
  h.close();
});

it('name_it: first_letter_model shows another word with its first letter lit, never a session target', () => {
  const NAME = [
    { id: 'n1', mode: 'name-it', targetLetter: 's', targetCase: 'lowercase', sentence: 'The ⭐un is bright.', targetWord: 'sun',
      options: [], emoji: '⭐', spokenSentence: 'The sun is bright.' },
    { id: 'n2', mode: 'name-it', targetLetter: 'm', targetCase: 'lowercase', sentence: 'I see a ⭐ap.', targetWord: 'map',
      options: [], emoji: '⭐', spokenSentence: 'I see a map.' }];
  const h = mount('name_it', NAME);
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([['first_letter_model', false]]);
  h.say('sun'); h.feedback('incorrect', 'retry');
  expect(q(h, '[data-lever="first-letter-model"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'first_letter_model' });
  expect(receipt.status).toBe('committed');
  const lit = q(h, '[data-lever="first-letter-model"] [data-lit]').map(e => e.textContent);
  expect(lit).toHaveLength(1);
  expect(['s', 'm']).not.toContain(lit[0]);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/another word/);
  h.say('s'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'n1', correct: true, assisted: true, levers: ['first_letter_model'] });
  h.close();
});
