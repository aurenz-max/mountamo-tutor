// @vitest-environment jsdom
/**
 * phonics-blender's levers on the shared teaching workspace (handoff 24), mounted the way a lesson mounts it. A pull
 * changes the screen and the scene in one commit and never puts the word in the tutor's voice; the practice word is
 * ungraded and gives the full word back; only the full word's answer is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const word = (id: string, targetWord: string, emoji?: string) => ({ id, targetWord, emoji,
  phonemes: targetWord.split('').map((letters, i) => ({ id: `${id}-${i}`, sound: `/${letters}/`, letters })) });
const data = (showBlendPreview?: string) => ({ title: 'Blend', gradeLevel: 'K', patternType: 'cvc', showBlendPreview,
  words: [word('w1', 'cat', '🐱'), word('w2', 'dog', '🐶')] }) as unknown as Record<string, unknown>;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);

it('split row: blend_slide and the arrow change the screen and send nothing to the tutor', () => {
  const h = mountWorkspace({ primitiveId: 'phonics-blender', evalMode: 'cvc', data: data() });
  expect(levers(h)).toEqual([['blend_slide', false], ['tracking_arrow', false], ['name_sound_model', false], ['short_word', false]]);
  h.say('k a t'); h.feedback('incorrect', 'retry');
  const sent = seam.send.mock.calls.length;
  const receipt = h.dispatch('pull_lever', { lever: 'blend_slide' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="blend-slide"]')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'tracking_arrow' });
  expect(q(h, '[data-lever="tracking-arrow"]')).toHaveLength(1);
  expect(seam.send.mock.calls.length).toBe(sent);
  expect(String(h.state().task!.demand.levers_on_screen)).not.toMatch(/\bcat\b/);
  h.say('cat'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'w1', correct: true, assisted: true,
    levers: ['blend_slide', 'tracking_arrow'] });
  h.close();
});

it('joined row (hard): sound_dots re-segments it, one dot per sound; the model letter is in no session word', () => {
  const h = mountWorkspace({ primitiveId: 'phonics-blender', evalMode: 'cvc', data: data('none') });
  expect(levers(h).map(([id]) => id)).toEqual(['sound_dots', 'tracking_arrow', 'name_sound_model', 'short_word']);
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  expect(q(h, '[data-lever="sound-dot"]')).toHaveLength(3);
  h.dispatch('pull_lever', { lever: 'name_sound_model' });
  const model = q(h, '[data-lever="name-sound-model"]')[0];
  const letter = model.firstElementChild!.textContent!;
  expect('catdog').not.toContain(letter);
  expect(String(h.state().task!.demand.levers_on_screen)).toMatch(new RegExp(`another letter, ${letter.toUpperCase()}`));
  h.close();
});

it('short_word: an ungraded two-letter practice word, then the full word back; only the full word is credited', () => {
  const h = mountWorkspace({ primitiveId: 'phonics-blender', evalMode: 'cvc', data: data() });
  h.say('cap'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_word' });
  expect(h.state().task).toMatchObject({ itemId: 'w1~simpler' });
  const practiceWord = h.state().task!.workspace!.expectedAnswer!;
  expect(practiceWord).toHaveLength(2);
  expect('cat'.endsWith(practiceWord)).toBe(false);
  h.say(practiceWord); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'w1' });
  h.say('cat'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([['w1', false], ['w1~simpler', true], ['w1', true]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['short_word'] });
  h.close();
});
