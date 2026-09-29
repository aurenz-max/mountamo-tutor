// @vitest-environment jsdom
/**
 * The find-feature levers on the shared teaching workspace (handoff 22 L1), mounted the way a lesson mounts it,
 * with the pure leak rules beside them. The model is never the book and never marks the book's own parts; the
 * practice page is ungraded and gives the book page back; only the book page's tap is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever, observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { InteractiveBookVolume } from './InteractiveBook';
import type { InteractiveBookItem } from './interactiveBookScript';
import { interactiveBookLevers, modelFor, modelLeak, practicePage } from './interactiveBookLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const page = (n: number, heading: string, caption: string, paragraph: string) => ({
  id: `p${n}`, pageNumber: n, heading, caption, paragraphs: [paragraph],
  imagePrompt: '', imageAlt: 'a picture', imageUrl: 'data:image/png;base64,', focusWords: [],
});
// Page 1's heading is the first model page's heading: the model must fall back to its second page.
const BOOK = { id: 'b1', bookTitle: 'Pond Neighbors', author: 'Mia Lee', coverColor: 'blue', coverImagePrompt: '', coverImageAlt: 'a pond',
  coverImageUrl: 'data:image/png;base64,',
  pages: [page(1, 'At the Pond', 'Frog Friends', 'The green frog can hop by the pond.'), page(2, 'Safe Nests', 'Nest Above', 'A bird sits in a nest.')] };
const FIND = { id: 'ib-f2', type: 'find-feature', prompt: '', hint: '', targetPageId: 'p2', targetFeature: 'caption',
  targetText: 'Nest Above', optionTexts: ['Safe Nests', 'Nest Above', 'Page 2'] };
const COVER = { id: 'ib-f1', type: 'find-feature', prompt: '', hint: '', targetPageId: 'cover', targetFeature: 'title',
  targetText: 'Pond Neighbors', optionTexts: ['Pond Neighbors', 'Mia Lee'] };
const mount = (...challenges: unknown[]) => mountWorkspace({ primitiveId: 'interactive-book', evalMode: 'find-feature', data: {
  title: 'Pond', description: '', gradeLevel: 'K', mode: 'mixed', challengeType: 'mixed', wordDifficulty: 'easy', books: [BOOK], challenges } });
const part = (h: WorkspaceHarness, text: string) => act(() => {
  const parts = Array.from(h.view.container.querySelectorAll('[data-pip-object^="part-"]')) as HTMLElement[];
  fireEvent.click(parts.find(p => p.textContent === text)!);
});
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const item = (feature: string, pageId: string) => ({ id: 'i', mode: 'find-feature', feature, targetPageId: pageId, targetText: '' }) as unknown as InteractiveBookItem;
const book = BOOK as unknown as InteractiveBookVolume;

it('the model never uses the book\'s text and lights exactly the asked kind', () => {
  for (const [feature, pageId] of [['title', 'cover'], ['author', 'cover'], ['heading', 'p1'], ['caption', 'p2'], ['page-number', 'p2']]) {
    const model = modelFor(item(feature, pageId), book)!;
    expect(modelLeak(model, book)).toBe(false);
    expect(model.parts.filter(p => p.lit).map(p => p.feature)).toEqual([feature]);
  }
  expect(modelFor(item('heading', 'p1'), book)!.parts[0].text).toBe('In the Snow');
});

it('the practice page: the asked kind against the far one, none of it the book\'s; none on the cover', () => {
  expect(practicePage(item('heading', 'p1'), book)!.parts.map(p => p.feature)).toEqual(['heading', 'caption']);
  expect(practicePage(item('page-number', 'p1'), book)!.parts.map(p => p.feature)).toEqual(['page-number', 'caption']);
  expect(practicePage(item('caption', 'p2'), book)!.parts.map(p => p.feature)).toEqual(['heading', 'caption']);
  expect(practicePage(item('title', 'cover'), book)).toBeNull();
  expect(interactiveBookLevers(item('title', 'cover'), [], book).map(l => l.id)).toEqual(['model_page']);
  expect(nextLever(interactiveBookLevers(item('caption', 'p2'), ['model_page'], book), 'tapped_heading')).toBe('two_part_page');
});

it('a wrong part: the observer pulls the model, beside the book, and the book\'s parts stay unmarked', () => {
  const h = mount(FIND);
  part(h, 'Safe Nests');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'tapped_heading' });
  expect(observerLever(h.state(), true)).toBe('model_page');
  const receipt = h.dispatch('pull_lever', { lever: 'model_page' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-model-lit]').map(p => p.textContent)).toEqual(['👉A fox in the snow']);
  expect(q(h, '[data-lever="model-page"] [data-pip-object]')).toHaveLength(0);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/model page/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/Nest Above/);
  h.dispatch('retry');
  part(h, 'Nest Above');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['model_page'] });
  h.close();
});

it('the practice page is ungraded, survives Try again, and gives the book page back', () => {
  const h = mount(FIND);
  part(h, 'Page 2');
  h.dispatch('pull_lever', { lever: 'two_part_page' });
  expect(h.state().task).toMatchObject({ itemId: 'ib-f2~simpler' });
  expect(String(h.state().task!.demand.shown)).toMatch(/practice page/);
  expect(q(h, '[data-pip-object^="part-"]').map(p => p.textContent)).toEqual(['The Big Ship', 'A ship on the sea']);
  part(h, 'The Big Ship');
  h.dispatch('retry');
  expect(h.state().task).toMatchObject({ itemId: 'ib-f2~simpler' });
  part(h, 'A ship on the sea');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'ib-f2' });
  expect(q(h, '[data-pip-object^="part-"]').map(p => p.textContent).sort()).toEqual(['Nest Above', 'Page 2', 'Safe Nests']);
  part(h, 'Nest Above');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['ib-f2', false, false], ['ib-f2~simpler', false, true], ['ib-f2~simpler', true, true], ['ib-f2', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['two_part_page'] });
  h.close();
});

it('a cover item offers the model cover only', () => {
  const h = mount(COVER);
  expect(h.state().task!.workspace!.levers!.map(l => l.id)).toEqual(['model_page']);
  part(h, 'Mia Lee');
  h.dispatch('pull_lever', { lever: 'model_page' });
  expect(q(h, '[data-model-lit]').map(p => p.textContent)).toEqual(['👉Big Bear']);
  h.close();
});

// ── L3: read-focus-word (handoff 22) ────────────────────────────────────────
const READ_OK = { id: 'ib-r1', type: 'read-focus-word', prompt: '', hint: '', targetPageId: 'p1', targetText: 'green',
  readLead: 'Look at the', readTail: 'frog.' };
const mountRead = (...challenges: unknown[]) => mountWorkspace({ primitiveId: 'interactive-book', evalMode: 'read-focus-word', data: {
  title: 'Pond', description: '', gradeLevel: 'K', mode: 'mixed', challengeType: 'mixed', wordDifficulty: 'easy', books: [BOOK], challenges } });

it('read-focus-word: dots under the glowing word only, nothing said; the practice sentence shares no book word', async () => {
  const { seam } = await import('../../../components/live-activity/runtime/testing/liveRuntimeSeams');
  const book = BOOK as unknown as InteractiveBookVolume;
  const { itemFromChallenge } = await import('./interactiveBookScript');
  const item = itemFromChallenge(READ_OK as never)!;
  expect(interactiveBookLevers(item, [], book).map(l => l.id)).toEqual(['sound_dots', 'cvc_focus']);
  expect(nextLever(interactiveBookLevers(item, [], book), 'context_guess')).toBe('sound_dots');
  const { cvcFocus, bookWords } = await import('./interactiveBookLevers');
  const practice = cvcFocus(item, book)!;
  expect(practice.line.toLowerCase().split(/[^a-z]+/).filter(Boolean).some(w => bookWords(book).has(w))).toBe(false);
  expect(practice.item.readLead!.split(' ').length).toBeGreaterThanOrEqual(2);
  expect(cvcFocus({ ...item, targetText: 'hop' }, book)).toBeNull();

  const h = mountRead(READ_OK);
  const sent = seam.send.mock.calls.length;
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  const glow = h.view.container.querySelector('[data-pip-object="glow"]')!;
  expect(glow.querySelectorAll('[data-sound-dot]')).toHaveLength(4); // g r ee n
  expect(glow.querySelector('[data-print-word]')!.textContent).toBe('green');
  expect(h.view.container.querySelectorAll('[data-sound-dot]')).toHaveLength(4);
  expect(seam.send.mock.calls.length).toBe(sent);
  h.say('big'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'cvc_focus' });
  expect(h.state().task).toMatchObject({ itemId: 'ib-r1~simpler' });
  const line = h.view.container.querySelector('[data-lever="practice-line"]')!;
  expect(line.textContent).not.toMatch(/green|frog|pond/);
  expect(h.view.container.querySelector('[data-pip-object="glow"]')!.textContent).toBe(practice.item.targetText);
  h.say(practice.item.targetText); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'ib-r1' });
  h.say('green'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct])).toEqual([
    ['ib-r1', false], ['ib-r1~simpler', true], ['ib-r1', true]]);
  h.close();
});
