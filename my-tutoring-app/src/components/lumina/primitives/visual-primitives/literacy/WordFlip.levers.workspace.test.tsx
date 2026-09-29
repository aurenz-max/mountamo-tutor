// @vitest-environment jsdom
/**
 * word-flip's levers on the shared teaching workspace (handoff 22 L2). A pull changes the screen in the same commit
 * and never shows the item's answer; practice is ungraded and gives the full item back.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data = (challengeType: string, ...challenges: unknown[]) =>
  ({ title: 'Flip', gradeLevel: '1', challengeType, challenges }) as unknown as Record<string, unknown>;
const DOG = { id: 'd', type: 'plural_s', sourceWord: 'dog', answer: 'dogs', emoji: '🐶', count: 3 };
const FOOT = { id: 'f', type: 'irregulars', sourceWord: 'foot', answer: 'feet', emoji: '🦶', count: 2 };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('plural_s: the rule model is another word, before and after; the item stays a blank', () => {
  const h = mountWorkspace({ primitiveId: 'word-flip', evalMode: 'plural_s', data: data('plural_s', DOG) });
  h.say('dog'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'rule_model_cards' });
  expect(q(h, '[data-lever="rule-model"] [role="img"]').map(p => p.getAttribute('aria-label'))).toEqual(['hat', 'hats']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/one hat, two hats/);
  expect(text(h)).not.toMatch(/\bdogs\b/);
  h.say('dogs'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['rule_model_cards'] });
  h.close();
});

it('irregulars: the model changes another way; practice is ungraded and gives the item back', () => {
  const h = mountWorkspace({ primitiveId: 'word-flip', evalMode: 'irregulars', data: data('irregulars', FOOT) });
  h.dispatch('pull_lever', { lever: 'irregular_model' });
  expect(q(h, '[data-lever="rule-model"] [role="img"]').map(p => p.getAttribute('aria-label'))).toEqual(['mouse', 'mice']);
  h.dispatch('pull_lever', { lever: 'common_irregular' });
  expect(h.state().task).toMatchObject({ itemId: 'f~simpler' });
  expect(text(h)).toMatch(/child/);
  expect(text(h)).not.toMatch(/\bfeet\b/);
  h.say('children'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'f' });
  h.say('feet'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct])).toEqual([['f~simpler', true], ['f', true]]);
  h.close();
});
