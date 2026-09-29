// @vitest-environment jsdom
/**
 * rhyme-studio's levers on the shared teaching workspace (handoff 22 L2), mounted the way a lesson mounts it.
 * A pull changes the screen and the scene in the same commit and never touches the item's own words; the
 * practice item is ungraded, judged from speech like the full item, and gives the full item back; only the
 * full item's answer is credited, as assisted.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const data = (gradeLevel: string, ...challenges: unknown[]) => ({ title: 'Rhymes', gradeLevel, challenges }) as unknown as Record<string, unknown>;
const REC = { id: 'rec', mode: 'recognition', targetWord: 'cat', targetWordEmoji: '🐱', targetWordImage: '', rhymeFamily: '-at',
  comparisonWord: 'cap', comparisonWordEmoji: '🧢', doesRhyme: false };
const IDF = { id: 'idf', mode: 'identification', targetWord: 'sun', targetWordImage: '', rhymeFamily: '-un', tutorNamesOptions: false,
  options: [{ word: 'bun', image: '', isCorrect: true }, { word: 'sock', image: '', isCorrect: false }] };
const PRO = { id: 'pro', mode: 'production', targetWord: 'bed', targetWordImage: '', rhymeFamily: '-ed' };
const COL = { id: 'col', mode: 'collection', targetWord: 'hat', targetWordImage: '', rhymeFamily: '-at' };
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('recognition: a wrong answer, the observer pulls the contrast model on other words; the item\'s cards are unchanged', () => {
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'recognition', data: data('K', REC) });
  expect(levers(h)).toEqual([['contrast_model', false], ['far_pair', false]]);
  const pair = q(h, '[data-pip-object="pair"]')[0].innerHTML;
  h.say('yes'); h.feedback('incorrect', 'retry');
  expect(observerLever(h.state(), true)).toBe('contrast_model');
  const receipt = h.dispatch('pull_lever', { lever: 'contrast_model' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="contrast-model"] [role="img"]').map(p => p.getAttribute('aria-label'))).toEqual(['bee', 'tree', 'bee', 'bus']);
  expect(q(h, '[data-pip-object="pair"]')[0].innerHTML).toBe(pair);
  const fact = String(receipt.state.task!.demand.levers_on_screen);
  expect(fact).toMatch(/bee and tree.*bee and bus/);
  expect(fact).not.toMatch(/\bcat\b|\bcap\b/);
  h.say('no'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'rec', correct: true, assisted: true, levers: ['contrast_model'] });
  h.close();
});

it('recognition: the practice pair is ungraded, judged from speech, and gives the full item back', () => {
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'recognition', data: data('K', REC) });
  h.say('yes'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'far_pair' });
  const task = h.state().task!;
  expect(task).toMatchObject({ itemId: 'rec~simpler' });
  expect(task.workspace!.practice).toEqual({ returnsTo: 'rec' });
  expect(task.task).not.toMatch(/\bcat\b|\bcap\b/);
  expect(text(h)).not.toMatch(/\bcat\b/);
  h.say('hmm'); h.feedback('incorrect', 'retry');
  expect(h.state().task).toMatchObject({ itemId: 'rec~simpler' });
  h.say('I know'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'rec' });
  expect(text(h)).toMatch(/cat/);
  expect(levers(h)).toEqual([['contrast_model', false], ['far_pair', true]]);
  h.say('no'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['rec', false, false], ['rec~simpler', false, true], ['rec~simpler', true, true], ['rec', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['far_pair'] });
  h.close();
});

it('identification at a reader grade with the read-aloud withdrawn: name_choices marks every card alike', () => {
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'identification', data: data('1', IDF) });
  expect(levers(h)).toEqual([['contrast_model', false], ['name_choices', false], ['far_foil_item', false]]);
  expect(h.state().task!.demand.namingChoices).toMatch(/do not read them aloud/);
  h.dispatch('pull_lever', { lever: 'name_choices' });
  expect(q(h, '[data-lever="name-choice"]')).toHaveLength(2);
  expect(h.state().task!.demand.namingChoices).toMatch(/Read every choice aloud/);
  expect(q(h, '.ring-emerald-400\\/40')).toHaveLength(0);
  h.close();
});

it('identification: the practice item is a new target with two choices, none of the session\'s words', () => {
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'identification', data: data('1', IDF) });
  h.dispatch('pull_lever', { lever: 'far_foil_item' });
  const task = h.state().task!;
  expect(task.itemId).toBe('idf~simpler');
  expect(task.workspace!.expectedAnswer).not.toMatch(/\bsun\b|\bbun\b|\bsock\b/);
  expect(text(h)).not.toMatch(/\bsun\b|\bbun\b|\bsock\b/);
  h.close();
});

it('production: the swap model and the onset strip act on other words; the target keeps its card', () => {
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'production', data: data('1', PRO) });
  expect(levers(h)).toEqual([['onset_swap_model', false], ['onset_strip', false], ['dense_family_item', false]]);
  h.dispatch('pull_lever', { lever: 'onset_swap_model' });
  expect(q(h, '[data-lever="swap-model"] [role="img"]').map(p => p.getAttribute('aria-label'))).toEqual(['sock', 'rock', 'lock']);
  h.dispatch('pull_lever', { lever: 'onset_strip' });
  const sounds = q(h, '[data-onset]').map(c => c.getAttribute('data-onset'));
  expect(sounds).toHaveLength(6);
  expect(sounds).not.toContain('b');
  const fact = String(h.state().task!.demand.levers_on_screen);
  expect(fact).toMatch(/never put one together with the ending yourself/);
  expect(fact).not.toMatch(/\bbed\b|\b-?ed\b/);
  h.close();
});

it('collection: the strip greys first sounds already collected; practice is one open production word', () => {
  const h = mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: 'collection', data: data('1', COL) });
  h.say('mat'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.dispatch('pull_lever', { lever: 'onset_strip' });
  expect(q(h, '[data-onset][data-used]').map(c => c.getAttribute('data-onset'))).toEqual(['m']);
  h.dispatch('pull_lever', { lever: 'dense_family_item' });
  const task = h.state().task!;
  expect(task.itemId).toBe('col-slot-2~simpler');
  expect(task.workspace!.expectedAnswer).toMatch(/^Any real word that rhymes with (?!hat)/);
  expect(q(h, '[aria-label="Your rhyme family"]')).toHaveLength(0);
  h.say('big'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('col-slot-2');
  expect(q(h, '[aria-label="Rhyme 1: mat"]')).toHaveLength(1);
  h.close();
});
