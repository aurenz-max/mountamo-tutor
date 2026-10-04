// @vitest-environment jsdom
/**
 * word-builder's levers on the shared teaching workspace (lever plan 2026-10-03 step 1), mounted the way a lesson
 * mounts it. A pull changes the screen and the scene in one commit and shows no part of the learner's word; the
 * practice word is ungraded, on its own small board, and gives the full word back; only the full word is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const part = (id: string, text: string, type: string, meaning: string) => ({ id, text, type, meaning });
const data = (supportTier?: string) => ({ title: 'Build', complexityLevel: 'compound_affix', gradeLevel: 'Grade 4', supportTier,
  availableParts: [part('pre-un', 'un', 'prefix', 'not'), part('root-help', 'help', 'root', 'assist'), part('suf-ful', 'ful', 'suffix', 'full of'),
    part('pre-re', 're', 'prefix', 'again'), part('root-play', 'play', 'root', 'have fun'), part('suf-able', 'able', 'suffix', 'able to be'),
    part('suf-less', 'less', 'suffix', 'without')],
  targets: [{ word: 'unhelpful', parts: ['pre-un', 'root-help', 'suf-ful'], hint: 'not giving any assistance', definition: 'not helpful' },
    { word: 'replayable', parts: ['pre-re', 'root-play', 'suf-able'], hint: 'can be enjoyed again and again', definition: 'able to be played again' }],
}) as unknown as Record<string, unknown>;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);

it('part_slots and model_word change the screen and the scene; neither shows a part of the word', () => {
  const h = mountWorkspace({ primitiveId: 'word-builder', evalMode: 'compound_affix', data: data() });
  expect(levers(h)).toEqual([['part_slots', false], ['model_word', false], ['small_board_word', false]]);
  h.say('help'); h.feedback('incorrect', 'retry');
  expect(h.dispatch('pull_lever', { lever: 'part_slots' }).status).toBe('committed');
  const frame = q(h, '[data-lever="part-slots"]')[0];
  expect(frame.textContent).toMatch(/prefix.*root.*suffix/);
  expect(frame.textContent).not.toMatch(/un|help|ful|not|assist/);
  h.dispatch('pull_lever', { lever: 'model_word' });
  const model = q(h, '[data-lever="model-word"]')[0].textContent!;
  for (const t of ['unhelpful', 'help', 'replayable', 'play']) expect(model).not.toContain(t);
  const fact = String(h.state().task!.demand.levers_on_screen);
  expect(fact).toMatch(/3 boxes labelled prefix, root, suffix/);
  expect(fact).not.toMatch(/unhelpful|\bhelp\b|\bful\b/);
  h.say('unhelpful'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'unhelpful', correct: true, assisted: true,
    levers: ['part_slots', 'model_word'] });
  h.close();
});

it('small_board_word: an ungraded practice word on a small board, then the full word back; only it is credited', () => {
  const h = mountWorkspace({ primitiveId: 'word-builder', evalMode: 'compound_affix', data: data() });
  h.say('help'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'small_board_word' });
  expect(h.state().task).toMatchObject({ itemId: 'unhelpful~simpler' });
  const practiceWord = h.state().task!.workspace!.expectedAnswer!.split(' ')[0];
  expect(['unhelpful', 'replayable']).not.toContain(practiceWord);
  // The small board: the practice word's parts and at most one foil per kind, none from the session.
  const cards = q(h, '.grid > div').map(c => c.querySelector('span')!.textContent);
  expect(cards.length).toBeLessThanOrEqual(6);
  for (const t of ['un', 'help', 'ful', 're', 'play', 'able']) expect(cards).not.toContain(t);
  h.say(practiceWord); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'unhelpful' });
  expect(q(h, '.grid > div').length).toBe(7);
  h.say('unhelpful'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([['unhelpful', false], ['unhelpful~simpler', true], ['unhelpful', true]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['small_board_word'] });
  h.close();
});

it('easy: the frame starts on screen, is not offered, and an unassisted answer is not assisted', () => {
  const h = mountWorkspace({ primitiveId: 'word-builder', evalMode: 'compound_affix', data: data('easy') });
  expect(q(h, '[data-lever="part-slots"]')).toHaveLength(1);
  expect(levers(h).map(([id]) => id)).toEqual(['model_word', 'small_board_word']);
  h.say('unhelpful'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: false });
  h.close();
});
