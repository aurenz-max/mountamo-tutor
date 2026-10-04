// @vitest-environment jsdom
/**
 * sentence-analyzer's levers on the shared teaching workspace (lever plan 2026-10-03 step 2), mounted the way a lesson
 * mounts it, on saved payloads. A model card is another sentence; nothing on the item's sentence is labelled; the
 * practice sentence is ungraded and gives the full item back; only the full item is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { itemsFromPayload } from './sentenceAnalyzerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const load = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf-8')).data;
const mount = (file: string, mode: string, patch: Record<string, unknown> = {}) =>
  mountWorkspace({ primitiveId: 'sentence-analyzer', evalMode: mode, data: { ...load(file), ...patch } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const ids = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);

it('identify_pos: the model card and the wall examples change the screen; the item sentence gets no label', () => {
  const file = 'sentence-analyzer.identify_pos-g3.json';
  const first = itemsFromPayload(load(file)).items[0];
  const h = mount(file, 'identify_pos');
  expect(ids(h)).toEqual(['model_sentence', 'wall_examples', 'short_sentence']);
  h.say('Conjunction'); h.feedback('incorrect', 'retry');
  expect(h.dispatch('pull_lever', { lever: 'model_sentence' }).status).toBe('committed');
  const card = q(h, '[data-lever="model-sentence"]')[0].textContent!;
  expect(card).toMatch(/Adjective/); expect(card).toMatch(/Adverb/);
  h.dispatch('pull_lever', { lever: 'wall_examples' });
  expect(q(h, '[data-lever="wall-example"]').length).toBe(first.wallLabels.length);
  expect(q(h, '.rounded-full').map(e => e.textContent)).not.toContain(first.answer);
  expect(String(h.state().task!.demand.levers_on_screen)).toMatch(/Models are other sentences/);
  h.say(first.answer); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['model_sentence', 'wall_examples'] });
  h.close();
});

it('short_sentence: an ungraded practice sentence, then the full item back; only it is credited', () => {
  const file = 'sentence-analyzer.identify_pos-g3.json';
  const first = itemsFromPayload(load(file)).items[0];
  const h = mount(file, 'identify_pos');
  h.say('Conjunction'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_sentence' });
  expect(h.state().task).toMatchObject({ itemId: `${first.id}~simpler` });
  const practiceSentence = String(h.state().task!.demand.sentence);
  expect(practiceSentence).not.toBe(first.sentence);
  expect(practiceSentence.split(' ').length).toBeLessThanOrEqual(4);
  const answer = h.state().task!.workspace!.expectedAnswer!.split(/[,.]/)[0];
  h.say(answer); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: first.id });
  expect(h.state().task!.demand.sentence).toBe(first.sentence);
  h.say(first.answer); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([[first.id, false], [`${first.id}~simpler`, true], [first.id, true]]);
  h.close();
});

it('identify_role: the two-row model; parse_structure: the split model on a side item', () => {
  const role = mount('sentence-analyzer.identify_role.json', 'identify_role');
  expect(ids(role)).toContain('two_row_model');
  role.dispatch('pull_lever', { lever: 'two_row_model' });
  expect(q(role, '[data-lever="two-row-model"]')[0].textContent).toMatch(/Subject.*Predicate/);
  role.close(); cleanup();
  const side = mount('sentence-analyzer.parse_structure.json', 'parse_structure');
  expect(ids(side)[0]).toBe('split_model');
  side.dispatch('pull_lever', { lever: 'split_model' });
  expect(q(side, '[data-lever="split-model"]')[0].textContent).toMatch(/subject.*predicate/);
  side.close();
});

it('easy: the wall examples start on screen and are not offered', () => {
  const h = mount('sentence-analyzer.identify_pos-g3.json', 'identify_pos', { supportTier: 'easy' });
  expect(q(h, '[data-lever="wall-example"]').length).toBeGreaterThan(0);
  expect(ids(h)).not.toContain('wall_examples');
  h.close();
});
