// @vitest-environment jsdom
/**
 * The hear-see levers on the shared teaching workspace (handoff 22 L1), mounted the way a lesson mounts it.
 * A pull changes the cards and the scene in the same commit and never marks which card is the answer; the
 * practice pair is ungraded and gives the full item back; only the full item's tap is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import groupOne from '../../../components/live-activity/runtime/testing/w1-payloads/letter-sound-link.hear_see.json';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const hear = (id: string, target: string, foil: string) => ({ id, mode: 'hear-see', targetLetter: target, targetSound: `/${target}/`,
  keywordWord: '', keywordImage: '', options: [{ letter: target, isCorrect: true }, { letter: foil, isCorrect: false }] });
const data = { title: 'Letter sounds', letterGroup: 3, gradeLevel: 'K', supportTier: 'medium',
  challenges: [hear('h1', 's', 'f'), hear('h2', 'd', 't')] };
const mount = () => mountWorkspace({ primitiveId: 'letter-sound-link', evalMode: 'hear_see', data });
const tap = (letter: string) => fireEvent.click(screen.getByRole('button', { name: `Tap the letter ${letter}` }));
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('a wrong tap: the observer pulls keyword pictures, under both cards alike, and the scene names neither', () => {
  const h = mount();
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([['keyword_under_both', false], ['pair_model', false], ['far_letter_pair', false]]);
  tap('F');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'other_letter' });
  expect(observerLever(h.state(), true)).toBe('keyword_under_both');
  const receipt = h.dispatch('pull_lever', { lever: 'keyword_under_both' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="card-keyword"]').map(k => k.getAttribute('aria-label')).sort()).toEqual(['fish', 'sun']);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/under each of the two letter cards/);
  expect(JSON.stringify(receipt.state.task)).not.toMatch(/\bsun\b|\bfish\b/);
  h.dispatch('retry');
  tap('S');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'h1', correct: true, assisted: true, levers: ['keyword_under_both'] });
  h.close();
});

it('a voicing-partner tap: the observer pulls the voice model, on pictures of another pair and no letters', () => {
  const h = mount();
  tap('S');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('h2');
  expect(levers(h).map(l => l.id)).toEqual(['keyword_under_both', 'pair_model', 'voice_feel_model', 'far_letter_pair']);
  tap('T');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ miss: 'voicing_partner' });
  expect(observerLever(h.state(), true)).toBe('voice_feel_model');
  h.dispatch('pull_lever', { lever: 'voice_feel_model' });
  const model = q(h, '[data-lever="voice-model"]');
  expect(model).toHaveLength(1);
  expect(q(h, '[data-voice-model] [role="img"]').map(p => p.getAttribute('aria-label'))).toEqual(['snake', 'bee']);
  expect(model[0].textContent).not.toMatch(/[a-z]/i);
  expect(String(h.state().task!.demand.levers_on_screen)).toMatch(/snake \(sss\).*bee \(zzz\)/);
  h.close();
});

it('the practice pair is ungraded, survives Try again, and gives the full item back', () => {
  const h = mount();
  tap('F');
  h.dispatch('pull_lever', { lever: 'far_letter_pair' });
  expect(h.state().task).toMatchObject({ itemId: 'h1~simpler' });
  expect(h.state().task!.workspace!.practice).toEqual({ returnsTo: 'h1' });
  expect(h.state().task!.demand.soundToSay).toBe('mmm');
  expect(screen.getAllByRole('button', { name: /^Tap the letter/ }).map(b => b.textContent)).toEqual(['A', 'M']);
  tap('A');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false });
  h.dispatch('retry');
  expect(h.state().task).toMatchObject({ itemId: 'h1~simpler' });
  tap('M');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'h1' });
  expect(screen.getAllByRole('button', { name: /^Tap the letter/ }).map(b => b.textContent)).toEqual(['S', 'F']);
  tap('S');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['h1', false, false], ['h1~simpler', false, true], ['h1~simpler', true, true], ['h1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['far_letter_pair'] });
  h.close();
});

it('group 1, every letter used (J12): the observer pulls the pair model; a refused pull changes nothing', () => {
  const h = mountWorkspace({ primitiveId: 'letter-sound-link', evalMode: 'hear_see', data: { ...groupOne.data, supportTier: 'medium' } });
  expect(levers(h).map(l => l.id)).toEqual(['pair_model']);
  tap('N');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'ch1', correct: false, miss: 'other_letter' });
  // A refused pull: no such lever on this item. Screen, levers and attempts unchanged.
  const before = { html: h.view.container.innerHTML, levers: JSON.stringify(levers(h)), attempts: h.state().task!.workspace!.attempts.length };
  expect(h.dispatch('pull_lever', { lever: 'far_letter_pair' }).status).not.toBe('committed');
  expect(h.view.container.innerHTML).toBe(before.html);
  expect(JSON.stringify(levers(h))).toBe(before.levers);
  expect(h.state().task!.workspace!.attempts).toHaveLength(before.attempts);

  expect(observerLever(h.state(), true)).toBe('pair_model');
  const receipt = h.dispatch('pull_lever', { lever: 'pair_model' });
  expect(receipt.status).toBe('committed');
  const model = q(h, '[data-pair-model]').map(e => e.getAttribute('data-pair-model'));
  expect(model).toHaveLength(2);
  for (const l of model) expect(['s', 'a', 't', 'i', 'p', 'n']).not.toContain(l);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/model pair beside the cards.*not this item's letters/);
  // The option cards are unchanged and carry no picture.
  expect(q(h, '[data-lever="card-keyword"]')).toHaveLength(0);
  expect(screen.getAllByRole('button', { name: /^Tap the letter/ }).map(b => b.textContent)).toEqual(['S', 'N']);
  h.dispatch('retry');
  tap('S');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'ch1', correct: true, assisted: true, levers: ['pair_model'] });
  h.close();
});
