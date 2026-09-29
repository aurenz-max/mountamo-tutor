// @vitest-environment jsdom
/**
 * picture-vocabulary's levers on the shared teaching workspace (handoff 22 L4), on a real generation: a wrong tap
 * records its miss, the clue card appears in the pull's commit, the two-card practice is ungraded and gives the full
 * item back, and the credit carries the levers.
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
import { itemsFromChallenges } from './pictureVocabularyScript';
import { practiceItemFor } from './pictureVocabularyLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const payload = (mode: string) => JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads', `picture-vocabulary.${mode}.levers.json`), 'utf8')).data;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const cards = (h: WorkspaceHarness) => q(h, '[data-pip-object^="card-"]').map(e => e.getAttribute('data-pip-object')!.slice(5));

it('receptive_match: miss named, clue card, two-card practice ungraded, full item credited as assisted', () => {
  const data = payload('receptive_match');
  const items = itemsFromChallenges(data.challenges);
  const [item] = items;
  const practice = practiceItemFor(item, items)!;
  const h = mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: 'receptive_match', data });
  const target = item.options!.find(o => o.word === item.word)!;
  const wrong = item.options!.find(o => o.word !== item.word)!;
  h.touch(`card-${wrong.word}`);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false,
    miss: wrong.category === target.category ? 'same_category' : 'other_category' });
  h.dispatch('retry'); h.confirmVisible();

  const receipt = h.dispatch('pull_lever', { lever: 'function_cue' });
  expect(q(h, '[data-lever="clue-card"]')[0].textContent).toContain(item.clue!);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toContain(item.clue!);
  expect(h.view.container.textContent).not.toMatch(new RegExp(`\\b${item.word}\\b`, 'i'));

  h.dispatch('pull_lever', { lever: 'two_cards_far' });
  expect(h.state().task).toMatchObject({ itemId: `${item.id}~simpler` });
  expect(cards(h).sort()).toEqual(practice.options!.map(o => o.word).sort());
  expect(q(h, '[data-lever="clue-card"]')).toHaveLength(0);
  h.touch(`card-${practice.word}`);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: item.id });
  expect(cards(h).sort()).toEqual(item.options!.map(o => o.word).sort());

  h.touch(`card-${item.word}`);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([[item.id, false], [`${item.id}~simpler`, true], [item.id, true]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['function_cue', 'two_cards_far'] });
  h.close();
});

it('naming: the clue card appears on the pull and the picture keeps its word hidden', () => {
  const data = payload('naming');
  const [item] = itemsFromChallenges(data.challenges);
  const h = mountWorkspace({ primitiveId: 'picture-vocabulary', evalMode: 'naming', data });
  expect(h.state().task!.workspace!.levers?.map(l => l.id)).toEqual(['function_cue']);
  h.say('a thing'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'function_cue' });
  expect(q(h, '[data-lever="clue-card"]')[0].textContent).toContain(item.clue!);
  expect(h.view.container.textContent).not.toMatch(new RegExp(`\\b${item.word}\\b`, 'i'));
  h.say(item.word); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['function_cue'] });
  h.close();
});
