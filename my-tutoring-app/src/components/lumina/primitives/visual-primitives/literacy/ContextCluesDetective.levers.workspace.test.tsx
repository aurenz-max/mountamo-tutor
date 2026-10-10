// @vitest-environment jsdom
/**
 * context-clues-detective levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact
 * in one commit and draws no answer; the next attempt records the lever; a refused pull changes nothing; the tier's
 * starting positions read as pulled and are not recorded as help.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ContextClueChallenge } from './ContextCluesDetective';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const timid: ContextClueChallenge = {
  id: 's', clueType: 'antonym', targetWord: 'timid', correctMeaning: 'Shy and easily scared', dictionaryDefinition: 'Shy.',
  passage: { sentences: [
    { id: 's_s1', text: 'The puppy was timid.', isClue: false },
    { id: 's_s2', text: 'Unlike his bold sister, he hid under the bed.', isClue: true },
    { id: 's_s3', text: 'He liked chewing socks.', isClue: false },
  ] },
  targetWordSentenceId: 's_s1', clueSentenceIds: ['s_s2'],
  meaningOptions: ['Very brave', 'Shy and easily scared', 'Sleepy', 'Fast'],
};
// A synonym word after it: the session mixes types, so each word has its classify step.
const huge: ContextClueChallenge = { ...timid, id: 'h', clueType: 'synonym', targetWord: 'huge', correctMeaning: 'Very big',
  passage: { sentences: [{ id: 'h_s1', text: 'The whale was huge, or very big.', isClue: true }, { id: 'h_s2', text: 'It swam.', isClue: false }] },
  targetWordSentenceId: 'h_s1', clueSentenceIds: ['h_s1'], meaningOptions: ['Very big', 'Tiny', 'Wet', 'Blue'] };
const mount = (extra: Partial<ContextClueChallenge> = {}) => mountWorkspace({ primitiveId: 'context-clues-detective',
  evalMode: 'synonym_antonym', data: { title: 'Clues', gradeLevel: '4', challenges: [{ ...timid, ...extra }, huge] } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

it('find: the sentence list and cross_out change the passage in the same commit, never mark the clue; the next attempt records them', () => {
  const h = mount();
  expect(levers(h)).toEqual([['sentence_list', false]]);
  h.press('sentence 3'); h.press('Check Clue');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'no_clue' });
  expect(levers(h)).toEqual([['sentence_list', false], ['cross_out', false]]);
  expect(nextLever(h.state().task!.workspace!.levers!, 'no_clue')).toBe('sentence_list');
  const receipt = h.dispatch('pull_lever', { lever: 'sentence_list' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/one sentence per line/);
  expect(q(h, '[data-lever="sentence-list"]')).toHaveLength(1);
  expect(h.view.container.textContent).toMatch(/has the word/);
  // A refused pull (already on screen): nothing changes.
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'sentence_list' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'cross_out' }).status).toBe('committed');
  // Only the checked non-clue sentence is greyed; the clue sentence is untouched.
  expect(q(h, '[data-lever="crossed"]').map(b => b.getAttribute('aria-label'))).toEqual(['sentence 3']);
  expect(onScreen(h)).toMatch(/no clue there: sentence 3\./);
  expect(onScreen(h)).not.toMatch(/sentence 2/);
  h.dispatch('retry');
  h.press('sentence 2'); h.press('Check Clue');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect(attempts(h).at(-1)!.levers).toEqual(expect.arrayContaining(['sentence_list', 'cross_out']));
});

it('classify: descriptions and signal words appear in the same commit and never name a type', () => {
  const h = mount({ showClueTypeDescriptions: false });
  h.press('sentence 2'); h.press('Check Clue'); advance(h);
  expect(levers(h)).toEqual([['type_descriptions', false], ['signal_words', false]]);
  expect(h.view.container.textContent).not.toMatch(/An opposite word shows the contrast/);
  h.press('Synonym'); h.press('Check Type');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'similar_opposite' });
  h.dispatch('pull_lever', { lever: 'type_descriptions' });
  expect(h.view.container.textContent).toMatch(/An opposite word shows the contrast/);
  h.dispatch('pull_lever', { lever: 'signal_words' });
  expect(q(h, '[data-lever="signal-word"]').map(e => e.textContent)).toEqual(['Unlike']);
  expect(onScreen(h)).toBe('Each clue-type button now shows its one-line description. Underlined in the green clue sentence: "unlike".');
  expect(onScreen(h)).not.toMatch(/antonym/i);
  h.dispatch('retry');
  h.press('Antonym'); h.press('Check Type');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
});

it('define: the strategy and the try-it sentence show only the learner\'s pick; a tier-shown strategy reads as pulled', () => {
  const h = mount();
  h.press('sentence 2'); h.press('Check Clue'); advance(h);
  h.press('Antonym'); h.press('Check Type'); advance(h);
  expect(levers(h)).toEqual([['strategy', false], ['try_in_place', false]]);
  h.press('Very brave'); h.press('Check Meaning');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'other_meaning' });
  h.dispatch('pull_lever', { lever: 'strategy' });
  expect(q(h, '[data-lever="strategy"]')[0]?.textContent).toMatch(/opposite word/);
  h.dispatch('pull_lever', { lever: 'try_in_place' });
  expect(q(h, '[data-lever="try-in-place"]')[0]?.textContent).toMatch(/The puppy was \[Very brave\]\./);
  h.dispatch('retry');
  expect(q(h, '[data-lever="try-in-place"]')[0]?.textContent).toMatch(/The puppy was ___\./);
  expect(h.view.container.textContent).not.toMatch(/Shy and easily scared\]/);
  expect(onScreen(h)).not.toContain('Shy and easily scared');

  cleanup();
  const tiered = mount({ strategyHint: 'Strategy: find the opposite word.', showClueHints: true });
  // The easy tier's list is on from the start, and is not recorded as help.
  expect(levers(tiered)).toEqual([['sentence_list', true]]);
  expect(q(tiered, '[data-lever="sentence-list"]')).toHaveLength(1);
  tiered.press('sentence 2'); tiered.press('Check Clue');
  expect(attempts(tiered).at(-1)!.levers ?? []).toEqual([]);
});
