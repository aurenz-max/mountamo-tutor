// @vitest-environment jsdom
/**
 * sound-swap's levers on the shared teaching workspace (handoff 22 L2), mounted the way a lesson mounts it. A pull
 * changes the screen in the same commit and never shows the new word; practice is ungraded and gives the item back.
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

const data = (...challenges: unknown[]) => ({ title: 'Swap', gradeLevel: '1', challenges }) as unknown as Record<string, unknown>;
const ADD = { id: 'a', operation: 'addition', originalWord: 'at', originalPhonemes: ['/æ/', '/t/'], originalImage: '', resultWord: 'cat',
  resultPhonemes: ['/k/', '/æ/', '/t/'], resultImage: '', addPhoneme: '/k/', addPosition: 'beginning' };
const DEL = { id: 'd', operation: 'deletion', originalWord: 'stop', originalPhonemes: ['/s/', '/t/', '/ɒ/', '/p/'], originalImage: '', resultWord: 'top',
  resultPhonemes: ['/t/', '/ɒ/', '/p/'], resultImage: '', deletePhoneme: '/s/', deletePosition: 'beginning' };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('addition: an empty tile appears before the sounds, with no letter; the model is on other words', () => {
  const h = mountWorkspace({ primitiveId: 'sound-swap', evalMode: 'addition', data: data(ADD) });
  h.say('at'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'mark_target_sound' });
  const blank = q(h, '[data-lever="blank-tile"]');
  expect(blank).toHaveLength(1);
  expect(blank[0].textContent).toBe('');
  expect(blank[0].nextElementSibling?.getAttribute('aria-label')).toBe('sound /æ/');
  const receipt = h.dispatch('pull_lever', { lever: 'swap_model' });
  expect(q(h, '[data-lever="swap-model"]')).toHaveLength(1);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/a model on other words: in, add \/p\/ at the beginning, makes pin/);
  expect(text(h)).not.toMatch(/\bcat\b/);
  h.say('cat'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['mark_target_sound', 'swap_model'] });
  h.close();
});

it('deletion: the tile to take away pulses; the practice item is ungraded and gives the item back', () => {
  const h = mountWorkspace({ primitiveId: 'sound-swap', evalMode: 'deletion', data: data(DEL) });
  h.dispatch('pull_lever', { lever: 'mark_target_sound' });
  expect(q(h, '[data-target="true"]').map(b => b.getAttribute('aria-label'))).toEqual(['sound /s/']);
  h.say('stop'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'easier_operation_item' });
  expect(h.state().task).toMatchObject({ itemId: 'd~simpler' });
  expect(text(h)).not.toMatch(/\bstop\b|\btop\b/);
  h.say('ox'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'd' });
  expect(text(h)).toMatch(/stop/);
  h.say('top'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct])).toEqual([['d', false], ['d~simpler', true], ['d', true]]);
  h.close();
});
