// @vitest-environment jsdom
/**
 * The di-word-reading levers (DI family 5 of `/add-support-tiers`) on the shared teaching workspace, mounted the way a
 * lesson mounts it. The model is a different word; the print levers draw marks and no text; a two-letter word is
 * ungraded and gives the full word back; a sight word has only the model; the easy start is not a pull.
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
import type { DiWordReadingChallenge } from './diWordReadingDomain';
import type { DiWordReadingChallengeType } from './diWordReadingModes';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const cvc = (w: string, type: DiWordReadingChallengeType, tier: 'easy' | 'medium' | 'hard', id: string): DiWordReadingChallenge =>
  ({ id, challengeType: type, word: w, wordType: 'cvc', graphemes: w.split(''), supportTier: tier });
const mount = (mode: DiWordReadingChallengeType, ...challenges: DiWordReadingChallenge[]) => mountWorkspace({ primitiveId: 'di-word-reading',
  evalMode: mode, instanceId: 'words', data: { title: 'Words', description: 'Read it.', challengeType: mode, challenges } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('hard cvc_reading: dots under each letter and the arrow say nothing; the next try carries the levers', () => {
  const h = mount('cvc_reading', cvc('pan', 'cvc_reading', 'hard', 'p1'));
  expect(q(h, '[data-lever="model_word"]')).toHaveLength(0);
  h.say('pin'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  expect(q(h, '[data-sound-dot]')).toHaveLength(3);
  h.dispatch('pull_lever', { lever: 'tracking_arrow' });
  expect(q(h, '[data-lever="tracking_arrow"]')).toHaveLength(1);
  expect(q(h, '[data-lever]').map(e => e.textContent).join('')).toBe('');
  h.say('pan'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['sound_dots', 'tracking_arrow'] });
  h.close();
});

it('easy starts with a model of a different word (sharing no letter); a try under it records no lever', () => {
  const h = mount('read_word', cvc('cat', 'read_word', 'easy', 'c1'));
  const model = q(h, '[data-lever="model_word"]');
  expect(model).toHaveLength(1);
  expect(model[0].getAttribute('data-model-word')!.split('').some(l => 'cat'.includes(l))).toBe(false);
  h.say('cat'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('short_word: a two-letter word is ungraded, then the full word is credited', () => {
  const h = mount('cvc_reading', cvc('hen', 'cvc_reading', 'medium', 'h1'));
  const full = h.state().task!.itemId;
  h.say('h e n'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_word' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(q(h, '[data-word-letter]')).toHaveLength(2);
  expect(q(h, '[data-practice-item]')).toHaveLength(1);
  h.say('at'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('hen'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  h.close();
});

it('a sight word has only the model; a print lever is refused and changes nothing', () => {
  const h = mount('sight_word', { id: 's1', challengeType: 'sight_word', word: 'the', wordType: 'sight', supportTier: 'hard' });
  expect((h.state().task!.workspace!.levers ?? []).map(l => l.id)).toEqual(['model_word']);
  const before = h.view.container.innerHTML;
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  h.dispatch('pull_lever', { lever: 'short_word' });
  expect(h.view.container.innerHTML).toBe(before);
  h.close();
});
