// @vitest-environment jsdom
/**
 * habitat-diorama's observe and connect levers on the real teaching workspace (`habitatDioramaLevers.ts`): a pull
 * changes the screen and the scene fact in one commit, the next attempt records it, a refused pull changes nothing,
 * and a simplify pull opens an ungraded easier item, then the full item comes back and is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const ORGANISMS = [
  { id: 'oak', commonName: 'Oak Tree', role: 'producer', imagePrompt: 'oak', position: { x: '15%', y: '30%' }, description: 'Makes food.', adaptations: [] },
  { id: 'hare', commonName: 'Snowshoe Hare', role: 'primary-consumer', imagePrompt: 'hare', position: { x: '40%', y: '65%' }, description: 'Eats leaves.', adaptations: [] },
  { id: 'fox', commonName: 'Red Fox', role: 'secondary-consumer', imagePrompt: 'fox', position: { x: '68%', y: '55%' }, description: 'Hunts hare.', adaptations: [] },
  { id: 'fungus', commonName: 'Shelf Fungus', role: 'decomposer', imagePrompt: 'fungus', position: { x: '28%', y: '80%' }, description: 'Breaks down wood.', adaptations: [] },
];
const OBSERVE = { id: 'observe', type: 'observe', prompt: 'It makes its own food from sunlight.', explanation: 'Trees make food from sunlight.',
  focusOrganismId: 'oak', optionOrganismIds: ['oak', 'hare', 'fox'] };
const CONNECT = { id: 'connect', type: 'connect', prompt: 'Complete the hare feeding relationship.', explanation: 'The fox hunts the hare.', fromId: 'hare', toId: 'fox' };
const data = (...challenges: unknown[]): Record<string, unknown> => ({
  primitiveType: 'habitat-diorama', gradeBand: '3-5',
  habitat: { name: 'Forest Web', biome: 'forest', climate: 'cool', description: 'A connected forest.' },
  organisms: ORGANISMS,
  relationships: [{ fromId: 'hare', toId: 'fox', type: 'predation', description: 'Fox hunts hare.' },
    { fromId: 'oak', toId: 'hare', type: 'predation', description: 'Hare eats oak.' }],
  environmentalFeatures: [],
  challenges,
});

function mount(mode: 'observe' | 'connect') {
  const h = mountWorkspace({ primitiveId: 'habitat-diorama', evalMode: mode, data: data(mode === 'observe' ? OBSERVE : CONNECT), instanceId: 'habitat' });
  const levers = () => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
  const onScreen = () => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');
  const choices = () => Array.from(screen.getByLabelText('Answer choices').children).map(c => c.textContent);
  const attempts = () => h.state().task!.workspace!.attempts;
  return { ...h, levers, onScreen, choices, attempts };
}

it('observe: food_lines draws every relationship in one commit; the next answer records it; a second pull is refused', () => {
  const h = mount('observe');
  expect(h.levers()).toEqual([['food_lines', false], ['easier_clue', false]]);
  expect(h.view.container.querySelector('[data-lever="food-lines"]')).toBeNull();
  h.say('Red Fox'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'food_lines' });
  expect(receipt.status).toBe('committed');
  expect(String((receipt.state.task!.demand as Record<string, unknown>).onScreen)).toMatch(/Arrows now join/);
  expect(String((receipt.state.task!.demand as Record<string, unknown>).onScreen)).not.toMatch(/Oak/);
  expect(h.view.container.querySelectorAll('[data-lever="food-lines"] line')).toHaveLength(2);
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'food_lines' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  h.say('Oak Tree'); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'observe', correct: true, assisted: true, levers: ['food_lines'] });
});

it('observe: easier_clue opens a two-choice plain clue without the stuck answer, then the full item comes back and is credited', () => {
  const h = mount('observe');
  h.say('Red Fox'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'easier_clue' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('observe~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'observe' });
  expect(receipt.state.task!.task).toMatch(/eating other living things/);
  expect(h.choices()).toEqual(['Snowshoe Hare', 'Shelf Fungus']);
  h.say('Snowshoe Hare'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('observe');
  expect(h.choices()).toEqual(['Oak Tree', 'Snowshoe Hare', 'Red Fox', 'Shelf Fungus']);
  expect(screen.queryByText('Trees make food from sunlight.')).toBeNull();
  h.say('Oak Tree'); h.feedback('correct');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['observe', false, false], ['observe~simpler', true, true], ['observe', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['easier_clue'] });
});

it('connect: a reversed tap, then the direction model and the start lines; the right tap records both', () => {
  const h = mount('connect');
  expect(h.levers()).toEqual([['direction_model', false], ['start_lines', false], ['easier_link', false]]);
  h.press('Oak Tree');
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'leads_to_start' });
  h.dispatch('retry'); h.confirmVisible();
  const model = h.dispatch('pull_lever', { lever: 'direction_model' });
  expect(model.status).toBe('committed');
  const panel = h.view.container.querySelector('[data-lever="direction-model"]')!;
  expect(panel.textContent).toMatch(/🌾.*→.*🐄/);
  expect(panel.textContent).toMatch(/eaten to the one that eats it/);
  expect(String((model.state.task!.demand as Record<string, unknown>).onScreen)).toMatch(/model pair/);
  expect(h.dispatch('pull_lever', { lever: 'start_lines' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="start-lines"] line')).map(l => l.getAttribute('data-line')).sort())
    .toEqual(['fox', 'oak']);
  expect(h.onScreen()).not.toMatch(/Red Fox/);
  h.press('Red Fox');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'connect', correct: true, assisted: true, levers: ['direction_model', 'start_lines'] });
});

it('connect: easier_link opens a plainer link from another start, then the full item comes back and is credited', () => {
  const h = mount('connect');
  h.press('Shelf Fungus');
  expect(h.attempts().at(-1)).toMatchObject({ miss: 'unconnected' });
  h.dispatch('retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'easier_link' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('connect~simpler');
  expect(receipt.state.task!.task).toBe('Find Oak Tree. Connect it to the living thing that eats it.');
  h.press('Snowshoe Hare');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('connect');
  expect(h.state().task!.task).toMatch(/^Find Snowshoe Hare/);
  h.press('Red Fox');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['connect', false, false], ['connect~simpler', true, true], ['connect', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['easier_link'] });
});

// ── predict, restore, defend (2026-10-09): a second food chain gives the simpler items somewhere to come from ──

const WIDE = [
  ...ORGANISMS.map(o => o.id === 'hare' ? { ...o, adaptations: ['Big back feet for fast hopping', 'Long ears that hear danger', 'Lives on open land'] } : o),
  { id: 'grass', commonName: 'Meadow Grass', role: 'producer', imagePrompt: 'grass', position: { x: '80%', y: '85%' }, description: 'Grows.', adaptations: [] },
  { id: 'mouse', commonName: 'Field Mouse', role: 'primary-consumer', imagePrompt: 'mouse', position: { x: '85%', y: '70%' }, description: 'Eats seeds.', adaptations: [] },
  { id: 'owl', commonName: 'Barn Owl', role: 'secondary-consumer', imagePrompt: 'owl', position: { x: '85%', y: '20%' }, description: 'Hunts mice.', adaptations: [] },
];
const wideData = (challenge: unknown): Record<string, unknown> => ({
  ...data(challenge), organisms: WIDE,
  relationships: [{ fromId: 'hare', toId: 'fox', type: 'predation', description: 'Fox hunts hare.' },
    { fromId: 'oak', toId: 'hare', type: 'predation', description: 'Hare eats oak.' },
    { fromId: 'grass', toId: 'mouse', type: 'predation', description: 'Mouse eats grass.' },
    { fromId: 'mouse', toId: 'owl', type: 'predation', description: 'Owl hunts mice.' }],
});
const PREDICT = { id: 'predict', type: 'predict', prompt: 'Predict.', explanation: 'With no foxes, more hares survive.',
  disruptionEvent: 'A sickness takes every Red Fox', affectedOrganismId: 'hare', expectedTrend: 'increase' };
const RESTORE = { id: 'restore', type: 'restore', prompt: 'Put it back.', explanation: 'Hares live on open land.',
  restorationEntityId: 'hare', restorationZone: 'open-land' };
const DEFEND = { id: 'defend', type: 'defend', prompt: 'The Red Fox depends on the Snowshoe Hare.', explanation: 'A fox hunts hares.',
  evidenceChoices: [{ id: 'hunt', text: 'The fox hunts hares in the snow.' }, { id: 'den', text: 'The fox sleeps in a den.' },
    { id: 'leaf', text: 'Oak leaves fall in autumn.' }], correctEvidenceId: 'hunt' };

function mountWide(mode: 'predict' | 'restore' | 'defend', challenge: unknown) {
  const h = mountWorkspace({ primitiveId: 'habitat-diorama', evalMode: mode, data: wideData(challenge), instanceId: 'habitat' });
  const levers = () => h.state().task!.workspace!.levers?.map(l => [l.id, l.pulled]);
  const onScreen = () => String((h.state().task!.demand as Record<string, unknown>).onScreen ?? '');
  const attempts = () => h.state().task!.workspace!.attempts;
  const ringed = () => Array.from(h.view.container.querySelectorAll('[data-ring="true"]')).map(b => b.getAttribute('aria-label'));
  return { ...h, levers, onScreen, attempts, ringed };
}

it('predict: change_mark rings the living thing the change names in one commit; the answer is never ringed', () => {
  const h = mountWide('predict', PREDICT);
  expect(h.levers()).toEqual([['change_mark', false], ['food_lines', false], ['easier_change', false]]);
  expect(h.ringed()).toEqual([]);
  h.say('Barn Owl'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'change_mark' });
  expect(receipt.status).toBe('committed');
  expect(String((receipt.state.task!.demand as Record<string, unknown>).onScreen)).toMatch(/A ring now marks Red Fox/);
  expect(h.ringed()).toEqual(['Red Fox']);
  expect(h.onScreen()).not.toMatch(/Snowshoe Hare/);
  const before = h.view.container.innerHTML;
  const leversBefore = h.levers(), attemptsBefore = h.attempts().length;
  expect(h.dispatch('pull_lever', { lever: 'change_mark' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  expect(h.levers()).toEqual(leversBefore);
  expect(h.attempts()).toHaveLength(attemptsBefore);
  h.say('Snowshoe Hare'); h.feedback('correct');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'predict', correct: true, assisted: true, levers: ['change_mark'] });
});

it('predict: easier_change opens a one-step change with two choices, then the full item comes back blank and is credited', () => {
  const h = mountWide('predict', PREDICT);
  h.say('Barn Owl'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: 'easier_change' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('predict~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'predict' });
  expect(receipt.state.task!.task).toMatch(/Every Field Mouse leaves the habitat/);
  expect(Array.from(screen.getByLabelText('Answer choices').children).map(c => c.textContent)).toEqual(['Meadow Grass', 'Oak Tree']);
  h.say('Meadow Grass'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('predict');
  expect(screen.queryByText('With no foxes, more hares survive.')).toBeNull();
  expect(h.ringed()).toEqual([]);
  h.say('Snowshoe Hare'); h.feedback('correct');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['predict', false, false], ['predict~simpler', true, true], ['predict', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['easier_change'] });
});

it('restore: zone pictures, partner rings and body clues each change the screen and the fact; the right zone records them', () => {
  const h = mountWide('restore', RESTORE);
  expect(h.levers()).toEqual([['zone_pictures', false], ['its_partners', false], ['body_clues', false]]);
  h.press('Open water');
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'water_for_land' });
  h.dispatch('retry'); h.confirmVisible();
  expect(h.view.container.querySelectorAll('[data-zone-picture="true"]')).toHaveLength(0);
  const pics = h.dispatch('pull_lever', { lever: 'zone_pictures' });
  expect(pics.status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-zone-picture="true"]')).toHaveLength(6);
  expect(String((pics.state.task!.demand as Record<string, unknown>).onScreen)).toMatch(/Each zone button now has a picture/);
  // A second pull of the same lever is refused and changes nothing (restore has no simplify lever to refuse).
  const before = h.view.container.innerHTML, leversBefore = h.levers();
  expect(h.dispatch('pull_lever', { lever: 'zone_pictures' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  expect(h.levers()).toEqual(leversBefore);
  expect(h.dispatch('pull_lever', { lever: 'its_partners' }).status).toBe('committed');
  expect(h.ringed().sort()).toEqual(['Oak Tree', 'Red Fox']);
  const clues = h.dispatch('pull_lever', { lever: 'body_clues' });
  expect(clues.status).toBe('committed');
  // The adaptation that names the place is never shown.
  expect(h.view.container.querySelector('[data-lever="body-clues"]')!.textContent).toMatch(/Big back feet/);
  expect(h.view.container.querySelector('[data-lever="body-clues"]')!.textContent).not.toMatch(/open land/i);
  expect(h.onScreen()).not.toMatch(/open land/i);
  h.press('Open land');
  expect(h.attempts().at(-1)).toMatchObject({ itemId: 'restore', correct: true, assisted: true, levers: ['zone_pictures', 'its_partners', 'body_clues'] });
});

it('defend: card pictures in one commit, then easier_claim opens a two-card claim; the full item comes back and is credited', () => {
  const h = mountWide('defend', DEFEND);
  expect(h.levers()).toEqual([['card_pictures', false], ['food_lines', false], ['easier_claim', false]]);
  h.say('The fox sleeps in a den.'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(h.view.container.querySelectorAll('[data-lever="card-pictures"]')).toHaveLength(0);
  const pics = h.dispatch('pull_lever', { lever: 'card_pictures' });
  expect(pics.status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="card-pictures"]')).map(p => p.textContent)).toEqual(['🐇 🦊', '🦊']);
  expect(String((pics.state.task!.demand as Record<string, unknown>).onScreen)).toMatch(/No card is marked/);
  const receipt = h.dispatch('pull_lever', { lever: 'easier_claim' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('defend~simpler');
  expect(receipt.state.task!.task).toMatch(/The Field Mouse needs other living things for its food/);
  expect(h.view.container.querySelectorAll('[data-lever="card-pictures"]')).toHaveLength(0);
  h.say('The Field Mouse eats the Meadow Grass.'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('defend');
  h.say('The fox hunts hares in the snow.'); h.feedback('correct');
  expect(h.attempts().map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['defend', false, false], ['defend~simpler', true, true], ['defend', true, false]]);
  expect(h.attempts().at(-1)).toMatchObject({ assisted: true, levers: ['card_pictures', 'easier_claim'] });
});
