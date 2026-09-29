// @vitest-environment jsdom
/**
 * syllable-clapper's levers on the shared teaching workspace (handoff 22 L2). A pull changes the screen in the same
 * commit and never prints the item's word or parts; practice is ungraded and gives the full item back.
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

const data = (...challenges: unknown[]) => ({ title: 'Parts', gradeLevel: 'K', challenges }) as unknown as Record<string, unknown>;
const COUNT = { id: 'c', word: 'tiger', syllables: ['ti', 'ger'], challengeType: 'count_parts' };
const BLEND = { id: 'b', word: 'tiger', syllables: ['ti', 'ger'], challengeType: 'blend_syllables' };
const DEL = { id: 'd', word: 'cowboy', syllables: ['cow', 'boy'], challengeType: 'delete_compound', removePart: 'cow', residue: 'boy' };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('count: the clap model is another word with another count; the item word is never printed', () => {
  const h = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'count_parts', data: data(COUNT) });
  h.say('five'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'clap_model' });
  expect(receipt.status).toBe('committed');
  const model = q(h, '[data-lever="clap-model"] [role="img"]')[0].getAttribute('aria-label');
  expect(model).toBe('umbrella');
  expect(q(h, '[data-lever="clap-model"] [data-clap]')).toHaveLength(3);
  expect(text(h)).not.toMatch(/tiger/);
  h.say('two'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['clap_model'] });
  h.close();
});

it('blend: part dots slide together and the word stays off screen; practice returns the full item', () => {
  const h = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'blend_syllables', data: data(BLEND) });
  h.dispatch('pull_lever', { lever: 'part_beats' });
  expect(q(h, '[data-lever="part-beats"] [data-beat]')).toHaveLength(2);
  expect(text(h)).not.toMatch(/\btiger\b|\bti\b|\bger\b/);
  h.dispatch('pull_lever', { lever: 'two_part_blend' });
  expect(h.state().task).toMatchObject({ itemId: 'b~simpler' });
  h.say('sunhat'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'b' });
  h.close();
});

it('delete: the model pictures another compound with its first part faded', () => {
  const h = mountWorkspace({ primitiveId: 'syllable-clapper', evalMode: 'delete_compound', data: data(DEL) });
  h.dispatch('pull_lever', { lever: 'delete_model' });
  expect(q(h, '[data-lever="delete-model"] [role="img"]').map(p => p.getAttribute('aria-label'))).toEqual(['sun', 'hat', 'hat left']);
  expect(String(h.state().task!.demand.levers_on_screen)).toMatch(/sunhat is sun and hat; sun fades, and hat is left/);
  expect(text(h)).not.toMatch(/cowboy|boy/);
  h.close();
});
