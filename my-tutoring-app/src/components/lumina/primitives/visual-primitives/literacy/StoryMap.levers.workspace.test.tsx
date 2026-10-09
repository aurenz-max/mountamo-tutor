// @vitest-environment jsdom
/**
 * story-map levers mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one commit
 * and names no character, event or choice; the next attempt records the lever; a refused pull changes nothing; a
 * practice story is ungraded, shares nothing with the session's story, and the full phase comes back blank after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { StoryMapData } from './StoryMap';
import { practiceConflict, practiceStory } from './storyMapLevers';
import { CONFLICT_LABELS, eventBank, settingChoices } from './storyMapWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const STORY: StoryMapData = {
  title: 'Story Map: Pip Gets Lost', gradeLevel: '5', structureType: 'plot-diagram',
  passage: { title: 'Pip Gets Lost', text: 'Pip the puppy lives with Nora. One day Pip runs out of the gate. A storm comes. Pip smells soup and finds the way home to Nora.' },
  elements: {
    characters: [{ name: 'Pip', description: 'a small brown puppy', role: 'protagonist' }, { name: 'Nora', description: 'the girl who owns Pip', role: 'supporting' }],
    setting: { place: 'A small town', time: 'One rainy afternoon', description: 'A quiet street.' },
    conflict: { type: 'person-vs-nature', description: 'Pip must find the way home through a storm.' },
  },
  events: [
    { id: 'e1', text: 'Pip the puppy plays in the yard.', arcPosition: 'beginning', order: 0 },
    { id: 'e2', text: 'Pip chases a ball out of the gate.', arcPosition: 'rising-action', order: 1 },
    { id: 'e3', text: 'A storm starts and Pip is lost.', arcPosition: 'climax', order: 2 },
    { id: 'e4', text: 'Pip follows the smell of soup.', arcPosition: 'falling-action', order: 3 },
    { id: 'e5', text: 'Pip is home, warm and dry.', arcPosition: 'resolution', order: 4 },
  ],
  distractorCharacters: ['Officer Higgins'],
};

const mount = () => mountWorkspace({ primitiveId: 'story-map', evalMode: 'plot_diagram', instanceId: 'storymap',
  data: STORY as unknown as Record<string, unknown> });
const identify = (h: WorkspaceHarness, d: StoryMapData, names = d.elements.characters.map(c => c.name)) => {
  names.forEach(n => h.press(n));
  h.press(settingChoices(d).find(s => s.isCorrect)!.text);
  h.press('Check Answers');
};
const sequence = (h: WorkspaceHarness, d: StoryMapData, at: (e: StoryMapData['events'][number]) => string = e => e.arcPosition) => {
  eventBank(d).forEach(e => { h.press(e.text); h.touch(`zone-${at(e)}`); });
  h.press('Check Sequence');
};
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const named = (s: string) => [...STORY.events.map(e => e.text), 'Pip', 'Nora', 'Officer Higgins'].filter(w => s.includes(w));

it('identify: a missed character pulls the count in one commit, naming no one; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount();
  expect(levers(h)).toEqual([['character_count', false], ['easier_story', false]]);
  identify(h, STORY, ['Nora']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'missed_character' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'missed_character')).toBe('character_count');
  const receipt = h.dispatch('pull_lever', { lever: 'character_count' });
  expect(receipt.status).toBe('committed');
  const fact = String(receipt.state.task!.demand.onScreen);
  expect(fact).toMatch(/2 empty person spaces/);
  expect(named(fact)).toEqual([]);
  expect(q(h, '[data-lever="character-space"]')).toHaveLength(2);
  expect(named(q(h, '[data-lever="character-count"]')[0].textContent ?? '')).toEqual([]);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'character_count' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry');
  // Try again keeps the count, empty; it fills one per pick, whichever name.
  expect(q(h, '[data-lever="character-space"][data-filled="true"]')).toHaveLength(0);
  h.press('Officer Higgins');
  expect(q(h, '[data-lever="character-space"][data-filled="true"]')).toHaveLength(1);
  h.press('Officer Higgins');
  identify(h, STORY);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'identify', correct: true, levers: ['character_count'] });
  advance(h);
  // The next phase opens bare.
  expect(q(h, '[data-lever]')).toHaveLength(0);
  expect(levers(h)).toEqual([['part_pictures', false], ['arc_arrow', false], ['easier_story', false]]);
});

it('sequence: a reversed arc pulls the arrow, then the part pictures; neither draws an event, and the right arc still credits', () => {
  const h = mount();
  identify(h, STORY); advance(h);
  sequence(h, STORY, e => (e.id === 'e1' ? 'resolution' : e.id === 'e5' ? 'beginning' : e.arcPosition));
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'reversed' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'reversed')).toBe('arc_arrow');
  expect(h.dispatch('pull_lever', { lever: 'arc_arrow' }).status).toBe('committed');
  expect(q(h, '[data-lever="arc-arrow"]')).toHaveLength(1);
  expect(h.dispatch('pull_lever', { lever: 'part_pictures' }).status).toBe('committed');
  expect(q(h, '[data-lever="part-picture"]').map(x => x.textContent)).toEqual(['🏠who and where', '📈the problem grows',
    '⚡the biggest moment', '🛠️the problem gets fixed', '✅how it ends']);
  const fact = String(h.state().task!.demand.onScreen);
  expect(fact).toMatch(/Introduction 🏠 "who and where".*An arrow runs along the parts/);
  expect(named(fact)).toEqual([]);
  h.dispatch('retry');
  sequence(h, STORY);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'sequence', correct: true, levers: ['arc_arrow', 'part_pictures'] });
});

it('easier story: an ungraded practice story with none of the session\'s names or events; the full phase comes back blank and is credited after', () => {
  const h = mount();
  identify(h, STORY, ['Pip']);
  const receipt = h.dispatch('pull_lever', { lever: 'easier_story' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('identify~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'identify' });
  expect(receipt.state.task!.demand).toMatchObject({ practice: expect.any(String) });
  expect(receipt.state.task!.workspace!.levers ?? []).toEqual([]);
  expect(q(h, '[data-practice]')).toHaveLength(1);
  const p = practiceStory(STORY)!;
  expect(h.view.container.textContent).toContain(p.passage.text);
  // Every printed choice and the story are the practice story's (the card's own title stays the session's).
  const printed = q(h, 'button[aria-label]').map(b => b.getAttribute('aria-label')!).join(' | ');
  expect(named(printed)).toEqual([]);
  expect(named(q(h, '[data-practice]')[0].parentElement!.textContent!)).toEqual([]);
  // A wrong practice try reopens the practice story, not the session's.
  identify(h, p, [p.elements.characters[0].name]);
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('identify~simpler');
  identify(h, p);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('identify');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No character picked yet. No setting picked yet.' });
  expect(q(h, '[data-practice]')).toHaveLength(0);
  identify(h, STORY);
  expect(attempts(h).map(x => [x.itemId, x.correct, !!(x as { practice?: boolean }).practice])).toEqual([
    ['identify', false, false], ['identify~simpler', false, true], ['identify~simpler', true, true], ['identify', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['easier_story'] });
});

it('analyze: the conflict pictures go on every choice, the labels still answer; the practice conflict prints three choices', () => {
  const h = mount();
  identify(h, STORY); advance(h);
  sequence(h, STORY); advance(h);
  expect(h.state().task!.itemId).toBe('analyze');
  h.press('Character vs. Self'); h.press('Check Answer');
  expect(nextLever(h.state().task!.workspace!.levers!, 'inside_outside')).toBe('conflict_pictures');
  expect(h.dispatch('pull_lever', { lever: 'conflict_pictures' }).status).toBe('committed');
  expect(q(h, '[data-lever="conflict-picture"]')).toHaveLength(4);
  const fact = String(h.state().task!.demand.onScreen);
  for (const label of Object.values(CONFLICT_LABELS)) expect(fact).not.toContain(label);
  expect(h.dispatch('pull_lever', { lever: 'easier_conflict' }).status).toBe('committed');
  const p = practiceConflict(STORY)!;
  expect(h.state().task!.itemId).toBe('analyze~simpler');
  expect(q(h, 'button').map(b => b.getAttribute('aria-label') ?? b.textContent).filter(t => /^Character vs\./.test(t ?? ''))).toHaveLength(3);
  h.press(CONFLICT_LABELS[p.elements.conflict!.type]); h.press('Check Answer');
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('analyze');
  h.press('Character vs. Nature'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'analyze', correct: true, levers: ['conflict_pictures', 'easier_conflict'] });
});
