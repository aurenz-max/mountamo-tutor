// @vitest-environment jsdom
/**
 * genre-explorer's levers on the shared teaching workspace (lever plan 2026-10-03 step 3), mounted the way a lesson
 * mounts it, on saved payloads. Help changes the screen and never marks evidence in the learner's text; models are
 * other texts; the practice text is named from two far kinds, ungraded, and the full item comes back.
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
import { itemsFromPayload } from './genreExplorerScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const load = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf-8')).data;
const mount = (file: string, mode: string, patch: Record<string, unknown> = {}) =>
  mountWorkspace({ primitiveId: 'genre-explorer', evalMode: mode, data: { ...load(file), ...patch } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const ids = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => l.id);
const items = (file: string) => itemsFromPayload(load(file)).items;

it('check-feature at the band floor: read_again, sentence rows and a text model; nothing marks a row', () => {
  const file = 'genre-explorer.identify_basic-g1.json';
  const first = items(file)[0];
  expect(first.action).toBe('check-feature');
  const h = mount(file, 'identify_basic');
  expect(ids(h)).toEqual(['read_again', 'sentence_rows', 'text_model']);
  h.say(first.answer === 'yes' ? 'no' : 'yes'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'read_again' });
  expect(q(h, '[data-lever="read-again"]')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'sentence_rows' });
  const rows = q(h, '[data-lever="sentence-rows"] li');
  expect(rows.length).toBeGreaterThan(1);
  expect(new Set(rows.map(r => r.className)).size).toBe(1);
  h.dispatch('pull_lever', { lever: 'text_model' });
  expect(q(h, '[data-lever="text-model"] u')).toHaveLength(1);
  expect(String(h.state().task!.demand.levers_on_screen)).toMatch(/It is not the learner text/);
  h.say(first.answer); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['read_again', 'sentence_rows', 'text_model'] });
  h.close();
});

it('name-genre on a sibling menu: the kind pair names only kinds off the menu; two_far_kinds practises, then the full item', () => {
  const file = 'genre-explorer.classify_genre-hard.json';
  const data = load(file), list = itemsFromPayload(data);
  const genre = list.items.find(i => i.action === 'name-genre')!;
  // Answer the items before the first genre ask.
  const h = mount(file, 'classify_genre');
  for (const item of list.items.slice(0, list.items.indexOf(genre))) { h.say(item.answer); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().task!.itemId).toBe(genre.id);
  expect(ids(h)).toEqual(expect.arrayContaining(['read_glosses', 'two_far_kinds']));
  if (ids(h).includes('kind_pair_model')) {
    h.dispatch('pull_lever', { lever: 'kind_pair_model' });
    const card = q(h, '[data-lever="kind-pair-model"]')[0].textContent!;
    for (const label of list.menu) expect(card).not.toContain(label);
  }
  h.dispatch('pull_lever', { lever: 'read_glosses' });
  expect(q(h, '[data-lever="read-glosses"]')).toHaveLength(list.menu.length);
  h.dispatch('pull_lever', { lever: 'two_far_kinds' });
  expect(h.state().task).toMatchObject({ itemId: `${genre.id}~simpler` });
  const practiceMenu = String(h.state().task!.demand.menu);
  for (const label of list.menu) expect(practiceMenu).not.toContain(label);
  const answer = h.state().task!.workspace!.expectedAnswer!.split('.')[0];
  h.say(answer); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: genre.id });
  h.say(genre.answer); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.filter(a => a.itemId === genre.id).at(-1)).toMatchObject({ correct: true, assisted: true });
  expect(attempts.some(a => a.itemId === `${genre.id}~simpler`)).toBe(true);
  h.close();
});

it('pick-excerpt: two empty checks, then a pair model of two other texts', () => {
  const file = 'genre-explorer.compare_genres.json';
  const h = mount(file, 'compare_genres');
  expect(ids(h)[0]).toBe('two_checks');
  h.dispatch('pull_lever', { lever: 'two_checks' });
  expect(q(h, '[data-lever="two-checks"]')).toHaveLength(2);
  expect(q(h, '[data-lever="two-checks"]').every(e => e.textContent!.startsWith('☐'))).toBe(true);
  h.dispatch('pull_lever', { lever: 'pair_model' });
  expect(q(h, '[data-lever="pair-model"] u')).toHaveLength(1);
  h.close();
});

it('easy: the rows start drawn on a feature item and are not offered', () => {
  const h = mount('genre-explorer.identify_basic.json', 'identify_basic', { supportTier: 'easy' });
  expect(q(h, '[data-lever="sentence-rows"]').length).toBeGreaterThan(0);
  expect(ids(h)).not.toContain('sentence_rows');
  h.close();
});
