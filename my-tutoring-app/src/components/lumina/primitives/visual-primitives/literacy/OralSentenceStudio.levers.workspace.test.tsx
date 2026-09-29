// @vitest-environment jsdom
/**
 * oral-sentence-studio's levers on the shared teaching workspace (handoff 22 L4), on a real generation: each pull
 * changes the screen in its commit, no example sentence appears before credit, and the credit carries the levers.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { itemsFromChallenges } from './oralSentenceStudioScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data = JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads/oral-sentence-studio.describe_scene.levers.json'), 'utf8')).data;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('strip and pictures change the screen in the commit; no example appears before credit; credit is assisted', () => {
  const [item, next] = itemsFromChallenges(data.challenges);
  const h = mountWorkspace({ primitiveId: 'oral-sentence-studio', evalMode: 'describe_scene', data });
  expect(h.state().task!.workspace!.levers?.map(l => l.id)).toEqual(['sentence_strip', 'word_pictures']);
  h.say(item.challenge.targetWords.join(' ')); h.feedback('incorrect', 'retry');

  const receipt = h.dispatch('pull_lever', { lever: 'sentence_strip' });
  const strip = q(h, '[data-lever="sentence-strip"]')[0];
  expect(strip.textContent).toContain('Who?');
  expect(strip.textContent).toContain('What happens?');
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/nothing is filled in/);

  h.dispatch('pull_lever', { lever: 'word_pictures' });
  expect(q(h, '[data-lever="word-picture"]').map(e => e.textContent)).toEqual(item.challenge.wordEmojis);
  for (const s of item.challenge.acceptedSentences) expect(h.view.container.textContent).not.toContain(s);

  h.say(item.challenge.acceptedSentences[0]); h.feedback('correct', 'advance'); h.confirmVisible();
  const credit = h.state().task!.workspace!.attempts.find(a => a.itemId === item.id && a.correct);
  expect(credit).toMatchObject({ assisted: true, levers: ['sentence_strip', 'word_pictures'] });
  expect(h.state().task).toMatchObject({ itemId: next.id });
  expect(q(h, '[data-lever="sentence-strip"], [data-lever="word-picture"]')).toHaveLength(0);
  h.close();
});
