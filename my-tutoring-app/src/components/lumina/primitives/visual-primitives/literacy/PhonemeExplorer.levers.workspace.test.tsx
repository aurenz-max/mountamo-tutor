// @vitest-environment jsdom
/**
 * phoneme-explorer's levers on the shared teaching workspace (handoff 22 L2), mounted the way a lesson mounts it.
 * A pull changes the screen in the same commit and never shows the answer or the asked sound on the item's words;
 * practice is ungraded, judged from speech, and gives the full item back.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data = (grade: string, ...challenges: unknown[]) => ({ title: 'Sounds', gradeLevel: grade, challenges }) as unknown as Record<string, unknown>;
const menu = (right: string, ...wrong: string[]) => [{ word: right, emoji: '⭐', correct: true }, ...wrong.map(w => ({ word: w, emoji: '⭐', correct: false }))];
const ISO = { id: 'i', mode: 'isolate', phoneme: 'm', phonemeSound: 'mmm', exampleWord: 'mouse', exampleEmoji: '🐭', showExampleWord: false,
  choices: menu('moon', 'dog', 'fish', 'cake') };
const SEG = { id: 's', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'] };
const BLEND = { id: 'b', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' };
const MAN = { id: 'x', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱', operationDescription: "Change the /k/ in 'cat' to /b/",
  resultWord: 'bat', resultEmoji: '🦇', showOperationDetail: false };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('isolate: the position model lights the first box of another word; the withdrawn example comes back on a pull', () => {
  const h = mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: 'isolate', data: data('1', ISO) });
  expect(h.state().task!.workspace!.levers!.map(l => l.id)).toEqual(['position_model', 'example_word', 'two_cards_far']);
  expect(text(h)).not.toMatch(/mouse/);
  h.say('dog'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'position_model' });
  expect(receipt.status).toBe('committed');
  const model = q(h, '[data-lever="position-model"]');
  expect(model).toHaveLength(1);
  expect(q(h, '[data-lever="position-model"] [data-lit]').map(b => b.getAttribute('data-box'))).toEqual(['0']);
  const word = model[0].querySelector('[role="img"]')!.getAttribute('aria-label')!;
  expect(word[0]).not.toBe('m');
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(new RegExp(`another word, ${word}`));
  h.dispatch('pull_lever', { lever: 'example_word' });
  expect(text(h)).toMatch(/mouse/);
  h.say('moon'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['position_model', 'example_word'] });
  h.close();
});

it('segment: the counter pad counts only the learner\'s pushes, and no box count is drawn ahead', () => {
  const h = mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: 'segment', data: data('K', SEG) });
  h.dispatch('pull_lever', { lever: 'push_tokens' });
  expect(q(h, '[data-token]')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Push a counter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Push a counter' }));
  expect(q(h, '[data-token]')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Clear the counters' }));
  expect(q(h, '[data-token]')).toHaveLength(0);
  expect(text(h)).not.toMatch(/sheep|three/);
  h.close();
});

it('blend: tiles slide together, the word stays hidden; the practice blend is ungraded and gives the item back', () => {
  const h = mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: 'blend', data: data('K', BLEND) });
  h.dispatch('pull_lever', { lever: 'slide_tiles' });
  expect(q(h, '[data-lever="slide-tiles"]')).toHaveLength(1);
  expect(text(h)).not.toMatch(/\bcat\b/);
  h.say('k a t'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_blend' });
  expect(h.state().task).toMatchObject({ itemId: 'b~simpler' });
  expect(h.state().task!.workspace!.expectedAnswer).not.toMatch(/\bcat\b/);
  h.say('man'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'b' });
  h.say('cat'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([['b', false], ['b~simpler', true], ['b', true]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['slide_tiles', 'short_blend'] });
  h.close();
});

it('manipulate: the changing box empties, the new sound is never shown; the withdrawn change prints on a pull', () => {
  const h = mountWorkspace({ primitiveId: 'phoneme-explorer', evalMode: 'manipulate', data: data('1', MAN) });
  expect(text(h)).toMatch(/Make a new word\./);
  h.dispatch('pull_lever', { lever: 'mark_position' });
  expect(q(h, '[data-lever="mark-position"] [data-box]').map(b => [b.getAttribute('data-box'), b.textContent, b.getAttribute('data-empty')]))
    .toEqual([['0', '', 'true'], ['1', 'a', null], ['2', 't', null]]);
  expect(text(h)).not.toMatch(/\bbat\b/);
  h.dispatch('pull_lever', { lever: 'operation_detail' });
  expect(text(h)).toMatch(/Change the \/k\/ in 'cat' to \/b\//);
  h.close();
});
