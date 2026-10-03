// @vitest-environment jsdom
/**
 * The di-letter-sounds levers (DI family 4 of `/add-support-tiers`) on the shared teaching workspace, mounted the way
 * a lesson mounts it. The model is a different letter; the keyword picture is a lever on a letter item (R4) and its
 * demonstrate target exists only while it is drawn; the arrow and the boxes say no sound; the easy start is not a pull.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { DiLetterSoundChallenge } from './diLetterSoundsDomain';
import type { DiLetterSoundChallengeType } from './diLetterSoundsModes';
import { LETTER_SOUND_MENU } from './diLetterSoundsMenu';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const letter = (l: string, type: DiLetterSoundChallengeType, tier: 'easy' | 'medium' | 'hard', id: string): DiLetterSoundChallenge => {
  const m = LETTER_SOUND_MENU[l];
  return { id, challengeType: type, supportTier: tier, letter: m.letter, spoken: m.spoken, keyword: m.keyword, emoji: m.emoji,
    elicitation: m.elicitation, ...(m.articulation ? { articulation: m.articulation } : {}) };
};
const mount = (mode: DiLetterSoundChallengeType, ...challenges: DiLetterSoundChallenge[]) => mountWorkspace({ primitiveId: 'di-letter-sounds',
  evalMode: mode, instanceId: 'sounds', data: { title: 'Sounds', description: 'Say it.', challengeType: mode, challenges } });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const targets = (h: WorkspaceHarness) => h.state().task!.workspace!.objects.map(o => o.id);

it('hard letter_sound: no picture until the keyword_picture lever; the arrow says no sound; the next try carries the levers', () => {
  const h = mount('letter_sound', letter('m', 'letter_sound', 'hard', 'm1'));
  expect(levers(h)).toEqual([['model_sound', false], ['sound_arrow', false], ['keyword_picture', false]]);
  expect(q(h, '[data-sound-object="picture"]')).toHaveLength(0);
  expect(targets(h)).toEqual(['stimulus']);
  h.say('muh'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'sound_arrow' });
  expect(q(h, '[data-lever="sound_arrow"]')).toHaveLength(1);
  expect(q(h, '[data-lever="sound_arrow"]')[0].textContent).toBe('');
  h.dispatch('pull_lever', { lever: 'keyword_picture' });
  expect(q(h, '[data-sound-object="picture"]')).toHaveLength(1);
  expect(targets(h)).toEqual(['stimulus', 'picture']);
  h.say('mmm'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['sound_arrow', 'keyword_picture'] });
  h.close();
});

it('easy starts with a model of a different letter and the picture; a try under them records no lever', () => {
  const h = mount('letter_sound', letter('s', 'letter_sound', 'easy', 's1'), letter('f', 'letter_sound', 'easy', 'f1'));
  const model = q(h, '[data-lever="model_sound"]');
  expect(model).toHaveLength(1);
  expect(['s', 'z', 'f']).not.toContain(model[0].getAttribute('data-model-letter'));
  expect(q(h, '[data-sound-object="picture"]')).toHaveLength(1);
  expect(String(h.state().task!.demand.onScreen)).not.toContain('sss');
  h.say('sss'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('first_sound_in_word: the picture is always drawn; first_box lights only the first of the word\'s empty boxes', () => {
  const h = mount('first_sound_in_word', letter('f', 'first_sound_in_word', 'hard', 'w1'));
  expect(q(h, '[data-sound-object="picture"]')).toHaveLength(1);
  h.say('sh'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'first_box' });
  const boxes = q(h, '[data-sound-box]');
  expect(boxes).toHaveLength(3);
  expect(boxes.map(b => b.getAttribute('data-lit'))).toEqual(['true', 'false', 'false']);
  expect(boxes.map(b => b.textContent).join('')).toBe('');
  h.close();
});

it('a refused pull changes nothing: no arrow on a stop, no simplify anywhere', () => {
  const h = mount('letter_sound', letter('t', 'letter_sound', 'hard', 't1'));
  const before = h.view.container.innerHTML;
  h.dispatch('pull_lever', { lever: 'sound_arrow' });
  h.dispatch('pull_lever', { lever: 'first_box' });
  expect(h.view.container.innerHTML).toBe(before);
  h.close();
});
