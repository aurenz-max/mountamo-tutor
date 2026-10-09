// @vitest-environment jsdom
/**
 * Story map on the teaching workspace (W1, plain shape): what is its own. Each phase of the one story is a checked
 * item; no answer (which names are characters, the setting, an event's part, the conflict) reaches the tutor; a
 * wrong check commits its named miss, stays closed, and Try again clears only that phase; the last right check
 * completes once. The generic W1 contract runs in `runtime/workspaceContract.test.tsx`.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { StoryMapData } from './StoryMap';
import { EMPTY_VIEW, arcLabels, characterChoices, eventBank, settingChoices, storyMapMiss } from './storyMapWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MOUNTAIN_EVENTS: StoryMapData['events'] = [
  { id: 'e1', text: 'Pip the puppy plays in the yard.', arcPosition: 'beginning', order: 0 },
  { id: 'e2', text: 'Pip chases a ball out of the gate.', arcPosition: 'rising-action', order: 1 },
  { id: 'e3', text: 'A storm starts and Pip is lost.', arcPosition: 'climax', order: 2 },
  { id: 'e4', text: 'Pip follows the smell of soup.', arcPosition: 'falling-action', order: 3 },
  { id: 'e5', text: 'Pip is home, warm and dry.', arcPosition: 'resolution', order: 4 },
];

const story = (structureType: StoryMapData['structureType'], gradeLevel: string, extra: Partial<StoryMapData> = {}): StoryMapData => ({
  title: 'Story Map: Pip Gets Lost', gradeLevel, structureType,
  passage: { title: 'Pip Gets Lost', text: 'Pip the puppy lives with Nora. One day Pip runs out of the gate. A storm comes. Pip smells soup and finds the way home to Nora.' },
  elements: {
    characters: [
      { name: 'Pip', description: 'a small brown puppy', role: 'protagonist' },
      { name: 'Nora', description: 'the girl who owns Pip', role: 'supporting' },
    ],
    setting: { place: 'A small town', time: 'One rainy afternoon', description: 'A quiet street.' },
    conflict: { type: 'person-vs-nature', description: 'Pip must find the way home through a storm.' },
  },
  events: structureType === 'bme'
    ? [{ id: 'b1', text: 'Pip runs out of the gate.', arcPosition: 'beginning', order: 0 },
      { id: 'b2', text: 'A storm comes and Pip is lost.', arcPosition: 'climax', order: 1 },
      { id: 'b3', text: 'Pip finds the way home.', arcPosition: 'resolution', order: 2 }]
    : MOUNTAIN_EVENTS,
  ...extra,
});

const BY_MODE: Record<string, StoryMapData> = {
  bme: story('bme', 'K'),
  story_mountain: story('story-mountain', '2'),
  plot_diagram: story('plot-diagram', '5', { distractorCharacters: ['Officer Higgins'] }),
  heros_journey: story('heros-journey', '6'),
};

const mount = (mode: string, data: StoryMapData) =>
  mountWorkspace({ primitiveId: 'story-map', evalMode: mode, instanceId: 'storymap', data: data as unknown as Record<string, unknown> });

const identify = (h: WorkspaceHarness, d: StoryMapData, names = d.elements.characters.map(c => c.name), settingId = 'correct') => {
  names.forEach(n => h.press(n));
  h.press(settingChoices(d).find(s => s.id === settingId)!.text);
  h.press('Check Answers');
};
const sequence = (h: WorkspaceHarness, d: StoryMapData, at: (e: StoryMapData['events'][number]) => string = e => e.arcPosition) => {
  eventBank(d).forEach(e => { h.press(e.text); h.touch(`zone-${at(e)}`); });
  h.press('Check Sequence');
};
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };

it.each(Object.keys(BY_MODE))('%s binds every phase with no scripted cue and no answer in the packet', mode => {
  const d = BY_MODE[mode];
  const h = mount(mode, d);
  const keyFree = () => {
    const demand = JSON.stringify(h.state().task!.demand);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(demand).not.toMatch(/protagonist|supporting|rising-action|falling-action|person-vs|Character vs\. Nature"/);
    expect(demand).not.toMatch(/inStory|isCorrect|arcPosition/);
  };
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.itemId).toBe('identify');
  keyFree();
  // Names print alone: no description or role marks which are in the story.
  expect(h.view.container.textContent).not.toMatch(/a small brown puppy|protagonist/);
  identify(h, d); advance(h);
  expect(h.state().task!.itemId).toBe('sequence');
  keyFree();
  expect(h.state().task!.task).toContain(arcLabels(d).map(z => z.label).join(', '));
  sequence(h, d); advance(h);
  if (mode === 'plot_diagram' || mode === 'heros_journey') {
    expect(h.state().task!.itemId).toBe('analyze');
    keyFree();
    h.press('Character vs. Nature'); h.press('Check Answer'); advance(h);
  }
  expect(h.state().status).toBe('completed');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/Continue to|Try Again/i);
  h.close();
});

it('identify prints the tier\'s distractor names among the characters, never one the story mentions', () => {
  const d = story('plot-diagram', '5', { distractorCharacters: ['Officer Higgins', 'Nora', 'Mr. Gray'] });
  d.passage.text += ' Mr. Gray waves.';
  expect(characterChoices(d).map(c => c.name).sort()).toEqual(['Nora', 'Officer Higgins', 'Pip']);
});

it('a wrong identify commits its miss, marks nothing, and Try again clears the picks; then a wrong analyze reopens without the answer', () => {
  seam.evaluationContext = { lesson: 'test' };
  const d = BY_MODE.plot_diagram;
  const h = mount('plot_diagram', d);
  identify(h, d, ['Pip', 'Officer Higgins']);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(JSON.stringify(h.state().task)).toContain('picked_not_in_story');
  // Closed until Try again: a tap changes nothing.
  h.press('Nora');
  expect(String(h.state().task!.demand.learnerWork)).toBe('Picked characters: Pip, Officer Higgins. Picked setting: "A small town - One rainy afternoon".'.replace('Pip, Officer Higgins', characterChoices(d).map(c => c.name).filter(n => n !== 'Nora').join(', ')));
  expect(h.view.container.textContent).not.toMatch(/a small brown puppy|protagonist|A quiet street/);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No character picked yet. No setting picked yet.' });
  identify(h, d); advance(h);
  sequence(h, d); advance(h);
  h.press('Character vs. Self'); h.press('Check Answer');
  expect(JSON.stringify(h.state().task)).toContain('inside_outside');
  expect(h.view.container.textContent).not.toMatch(/correct answer is/i);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No conflict type picked yet' });
  h.press('Character vs. Nature'); h.press('Check Answer'); advance(h);
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work, , evidence] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'story-map', charactersCorrect: true, allEventsCorrect: true, conflictTypeCorrect: true });
  expect(work.teachingAttempts).toHaveLength(5);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'identify', miss: 'picked_not_in_story' }),
    expect.objectContaining({ itemId: 'analyze', miss: 'inside_outside' })]);
  h.close();
});

it('a wrong sequence marks the cards, reaches the tutor as marks, and Try again takes every card off', () => {
  const d = BY_MODE.story_mountain;
  const h = mount('story_mountain', d);
  identify(h, d); advance(h);
  sequence(h, d, e => (e.id === 'e1' ? 'resolution' : e.id === 'e5' ? 'beginning' : e.arcPosition));
  expect(JSON.stringify(h.state().task)).toContain('reversed');
  expect(h.state().task!.demand).toMatchObject({ checkedMarks: expect.stringMatching(/3 of 5 cards right .* 2 wrong/) });
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No event card placed yet' });
  expect(h.state().task!.demand.checkedMarks).toBeUndefined();
  sequence(h, d);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('storyMapMiss names each phase\'s error', () => {
  const d = BY_MODE.plot_diagram;
  const v = { ...EMPTY_VIEW };
  const placed = (map: Record<string, string>) => ({ ...v, placed: Object.fromEntries(MOUNTAIN_EVENTS.map(e => [e.id, (map[e.id] ?? e.arcPosition) as never])) });
  expect(storyMapMiss({ id: 'identify' }, d, { ...v, selectedCharacters: ['Pip'], selectedSetting: 'correct' })).toBe('missed_character');
  expect(storyMapMiss({ id: 'identify' }, d, { ...v, selectedCharacters: ['Pip', 'Nora'], selectedSetting: 'distractor-1' })).toBe('wrong_setting');
  expect(storyMapMiss({ id: 'identify' }, d, { ...v, selectedCharacters: ['Pip', 'Nora'], selectedSetting: 'correct' })).toBeUndefined();
  expect(storyMapMiss({ id: 'sequence' }, d, placed({}))).toBeUndefined();
  expect(storyMapMiss({ id: 'sequence' }, d, placed({ e1: 'climax', e2: 'climax', e4: 'climax', e5: 'climax' }))).toBe('one_part');
  expect(storyMapMiss({ id: 'sequence' }, d, placed({ e2: 'climax', e3: 'rising-action' }))).toBe('next_part');
  expect(storyMapMiss({ id: 'sequence' }, d, placed({ e1: 'climax' }))).toBe('far_part');
  expect(storyMapMiss({ id: 'analyze' }, d, { ...v, selectedConflict: 'person-vs-person' })).toBe('other_outside');
  // Stable, and never the story's order.
  for (const t of ['a', 'b', 'c', 'd', 'e']) {
    const s = { ...d, passage: { ...d.passage, title: t } };
    expect(eventBank(s).map(e => e.id)).toEqual(eventBank(s).map(e => e.id));
    expect(eventBank(s).map(e => e.order)).not.toEqual([0, 1, 2, 3, 4]);
  }
});
