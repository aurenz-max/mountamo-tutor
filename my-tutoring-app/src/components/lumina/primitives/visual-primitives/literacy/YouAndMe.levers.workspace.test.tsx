// @vitest-environment jsdom
/**
 * you-and-me's levers on the shared teaching workspace (handoff 22 L4). A pull marks a role on screen in the same
 * commit, names no pronoun, and the next attempt carries it; a lever resets on the next item.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const scene = {
  sceneId: 'bag', participants: [{ name: 'Maya', emoji: '👧' }, { name: 'Leo', emoji: '👦' }],
  actor: 0, object: 'bag', objectEmoji: '🎒', action: 'packed the bag',
};
const data = (supportTier: string, type = 'describe_action') => ({
  title: 'Partners', description: 'Trade speaking roles', gradeLevel: 'K', challengeType: type,
  challenges: [{ ...scene, type, supportTier, id: 'a', speaker: 1 }, { ...scene, type, supportTier, id: 'b', speaker: 0 }],
}) as unknown as Record<string, unknown>;
const mount = (supportTier: string, type = 'describe_action') =>
  mountWorkspace({ primitiveId: 'you-and-me', evalMode: type, data: data(supportTier, type) });
const lit = (name: string) => screen.getByRole('img', { name }).parentElement!.className.includes('border-pink-300');
const marker = (h: WorkspaceHarness) => h.view.container.querySelector('[data-lever="actor-marker"]');

it('hard: both levers change the screen in the commit, name no pronoun, and the credit is assisted', () => {
  const h = mount('hard', 'describe_independent_action');
  expect(h.state().task!.workspace!.levers?.map(l => l.id)).toEqual(['speaker_highlight', 'actor_marker']);
  expect(lit('Leo')).toBe(false);
  expect(marker(h)).toBeNull();
  h.say('Maya packed the bag by herself.'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'speaker_highlight' });
  expect(lit('Leo')).toBe(true);
  expect(lit('Maya')).toBe(false);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/Leo's card is lit/);
  h.dispatch('pull_lever', { lever: 'actor_marker' });
  expect(screen.getByRole('img', { name: 'Maya' }).parentElement!.contains(marker(h))).toBe(true);
  expect(marker(h)!.textContent).not.toMatch(/\b(I|you|myself|yourself)\b/i);
  expect(String(h.state().task!.demand.levers_on_screen)).not.toMatch(/\b(I|you|myself|yourself)\b/i);
  h.say('You packed the bag by yourself.'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['speaker_highlight', 'actor_marker'] });
  h.close();
});

it('a pulled lever is gone on the next item; a second pull and an unknown lever are refused', () => {
  const h = mount('hard');
  h.dispatch('pull_lever', { lever: 'actor_marker' });
  expect(marker(h)).not.toBeNull();
  expect(h.dispatch('pull_lever', { lever: 'actor_marker' }).status).not.toBe('ok');
  h.say('You packed the bag.'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'b' });
  expect(marker(h)).toBeNull();
  expect(h.state().task!.workspace!.levers?.find(l => l.id === 'actor_marker')?.pulled).toBe(false);
  h.close();
});

it('medium keeps the speaker lit and offers only the actor marker; easy offers none', () => {
  const m = mount('medium');
  expect(m.state().task!.workspace!.levers?.map(l => l.id)).toEqual(['actor_marker']);
  expect(lit('Leo')).toBe(true);
  m.close(); cleanup();
  const e = mount('easy');
  expect(e.state().task!.workspace!.levers ?? []).toEqual([]);
  e.close();
});
