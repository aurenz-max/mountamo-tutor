// @vitest-environment jsdom
/**
 * story-ribbon's levers on the shared teaching workspace (handoff 22 L4). A pull marks the ribbon's SLOTS in the same
 * commit: the marks stay by place when cards are swapped, the next attempt carries the lever, and it resets per item.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { STORY_RIBBON_FALLBACKS } from '../../../service/literacy/gemini-story-ribbon';
import type { StoryRibbonChallengeType } from './StoryRibbon';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data = (type: StoryRibbonChallengeType, supportTier: string, count = 2) =>
  ({ title: 'Ribbons', description: '', gradeLevel: 'K', challengeType: type,
    challenges: STORY_RIBBON_FALLBACKS.slice(0, count).map(c => ({ ...c, type, supportTier, support: undefined,
      ...(type === 'tell_past_account' ? { timeCue: 'Yesterday' } : { timeCue: undefined }) })) }) as unknown as Record<string, unknown>;
const mount = (type: StoryRibbonChallengeType, tier: string) =>
  mountWorkspace({ primitiveId: 'story-ribbon', evalMode: type, data: data(type, tier) });
const all = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const cards = (h: WorkspaceHarness) => all(h, '[data-pip-object^="card-"]').map(el => el.getAttribute('data-pip-object')!);
const labelsBySlot = (h: WorkspaceHarness) => all(h, '[data-pip-object^="card-"]')
  .map(card => card.querySelector('[data-lever="sequence-label"]')?.textContent ?? '');

it('hard retell: labels and arrows mark the slots, stay by place after a swap, and the credit is assisted', () => {
  const h = mount('tell_past_account', 'hard');
  expect(h.state().task!.workspace!.levers?.map(l => l.id)).toEqual(['sequence_labels', 'flow_arrows']);
  expect(labelsBySlot(h)).toEqual(['', '', '']);
  h.say('ball, park, slide'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'sequence_labels' });
  expect(labelsBySlot(h)).toEqual(['First', 'Next', 'Last']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/places, not the pictures/);
  const [a, b] = cards(h);
  h.touch(a); h.touch(b);
  expect(cards(h).slice(0, 2)).toEqual([b, a]);
  expect(labelsBySlot(h)).toEqual(['First', 'Next', 'Last']);
  h.dispatch('pull_lever', { lever: 'flow_arrows' });
  expect(all(h, '[data-lever="flow-arrow"]')).toHaveLength(2);
  for (const e of STORY_RIBBON_FALLBACKS[0].events) expect(h.view.container.textContent).not.toContain(e.modelSentence);
  h.say('the whole story'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['sequence_labels', 'flow_arrows'] });
  h.close();
});

it('levers reset on the next item; a second pull is refused; the order self-check is never a lever', () => {
  const h = mount('tell_connected_account', 'hard');
  h.dispatch('pull_lever', { lever: 'sequence_labels' });
  expect(h.dispatch('pull_lever', { lever: 'sequence_labels' }).status).not.toBe('ok');
  expect(h.dispatch('pull_lever', { lever: 'self_check' }).status).not.toBe('ok');
  h.say('the whole story'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(labelsBySlot(h)).toEqual(['', '', '']);
  expect(h.state().task!.workspace!.levers?.every(l => !l.pulled)).toBe(true);
  h.close();
});

it('story_to_experience hard: the connection frame is its only lever; medium retell keeps labels and offers arrows', () => {
  const h = mount('story_to_experience', 'hard');
  expect(h.state().task!.workspace!.levers?.map(l => l.id)).toEqual(['connection_frame']);
  expect(all(h, '[data-lever="connection-frame"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: 'connection_frame' });
  expect(all(h, '[data-lever="connection-frame"]')).toHaveLength(1);
  h.close(); cleanup();
  const m = mount('tell_connected_account', 'medium');
  expect(m.state().task!.workspace!.levers?.map(l => l.id)).toEqual(['flow_arrows']);
  expect(labelsBySlot(m)).toEqual(['First', 'Next', 'Last']);
  m.close();
});
