// @vitest-environment jsdom
/**
 * The di-sentence-reading levers (DI family 6 of `/add-support-tiers`) on the shared teaching workspace, mounted the
 * way a lesson mounts it. The model is a different sentence sharing no word; the underline and dots draw marks only,
 * dots only under CVC words; a shorter line is ungraded and gives the full sentence back; the easy start is not a pull.
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
import type { DiSentenceReadingChallenge } from './diSentenceReadingDomain';
import type { DiSentenceReadingChallengeType } from './diSentenceReadingModes';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const sentence = (text: string, type: DiSentenceReadingChallengeType, tier: 'easy' | 'medium' | 'hard', id: string): DiSentenceReadingChallenge =>
  ({ id, challengeType: type, text, wordCount: text.split(/\s+/).length, supportTier: tier });
const mount = (mode: DiSentenceReadingChallengeType, ...challenges: DiSentenceReadingChallenge[]) => mountWorkspace({
  primitiveId: 'di-sentence-reading', evalMode: mode, instanceId: 'sentences',
  data: { title: 'Sentences', description: 'Read it.', challengeType: mode, challenges } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const words = (t: string) => t.toLowerCase().split(/[^a-z]+/).filter(Boolean);

it('hard read_sentence: the underline and the dots (CVC words only) draw marks; the next try carries both', () => {
  const h = mount('read_sentence', sentence('The dog is in the sun.', 'read_sentence', 'hard', 's1'));
  h.say('The dog in the sun.'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'tracking_underline' });
  expect(q(h, '[data-track-segment]')).toHaveLength(6);
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  // "dog" and "sun" are CVC: six dots; none under the, is, in.
  expect(q(h, '[data-sound-dot]')).toHaveLength(6);
  // The print is unchanged: only the kit's arrow is added.
  expect(h.view.container.querySelector('[data-sentence-object="printed"]')!.textContent).toBe('Thedogisinthesun.→');
  h.say('The dog is in the sun.'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['tracking_underline', 'sound_dots'] });
  h.close();
});

it('easy starts with a model sentence sharing no word; a read under it records no lever', () => {
  const h = mount('decodable_sentence', sentence('The cat sat on a mat.', 'decodable_sentence', 'easy', 'c1'));
  const model = q(h, '[data-lever="model_sentence"]');
  expect(model).toHaveLength(1);
  const shown = model[0].getAttribute('data-model-sentence')!;
  expect(words(shown).some(w => words('The cat sat on a mat.').includes(w))).toBe(false);
  h.say('The cat sat on a mat.'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('short_line: a three-word line is ungraded, then the full sentence is credited', () => {
  const h = mount('read_sentence', sentence('The big pig had a red hat on.', 'read_sentence', 'medium', 'p1'));
  const full = h.state().task!.itemId;
  h.say('The big pig a red hat on.'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_line' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  const practice = h.view.container.querySelector('[data-sentence-object="printed"]')!.textContent!;
  expect(practice.split(/\s+/)).toHaveLength(3);
  h.say(practice); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('The big pig had a red hat on.'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  h.close();
});

it('a refused pull changes nothing: no simplify on a 3-word sentence, no dots on a sight sentence', () => {
  const h = mount('sight_phrase_sentence', sentence('Here it is.', 'sight_phrase_sentence', 'hard', 'r1'));
  const before = h.view.container.innerHTML;
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  h.dispatch('pull_lever', { lever: 'short_sight_line' });
  h.dispatch('pull_lever', { lever: 'short_line' });
  expect(h.view.container.innerHTML).toBe(before);
  h.close();
});
