/**
 * story-map levers: leak rules per mode on every saved payload story, the practice builders (never the session's
 * story, its names or events; same structure; solvable), and "this wrong answer, then this lever" as code.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { StoryMapData } from './StoryMap';
import {
  ARROW_LEVER, CONFLICT_PICTURES, CONFLICT_PICTURES_LEVER, CONFLICT_STORY_LEVER, COUNT_LEVER, PARTS_LEVER, STORY_LEVER,
  countLeaks, helpLeaks, partPicture, practiceConflict, practiceLeaks, practiceStory, storyMapLeverFacts, storyMapLevers,
} from './storyMapLevers';
import {
  CONFLICT_LABELS, EMPTY_VIEW, FALLBACK_NAMES, arcLabels, characterChoices, conflictOptions, storyMapCorrect, storyMapItems, storyMapMiss,
  type StoryMapItem, type StoryMapMiss,
} from './storyMapWorkspace';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('story-map.')).map(f =>
  JSON.parse(readFileSync(join(DIR, f), 'utf-8')) as { evalMode: string; data: StoryMapData });
const ITEMS = PAYLOADS.flatMap(p => storyMapItems(p.data).map(item => [p.evalMode, item.id, item, p.data] as const));

const ALL_HELP = [COUNT_LEVER, PARTS_LEVER, ARROW_LEVER, CONFLICT_PICTURES_LEVER];
const said = (item: StoryMapItem, d: StoryMapData) => [
  ...storyMapLevers(item, d, []).map(l => `${l.when} ${l.does}`), storyMapLeverFacts(item, d, ALL_HELP),
  ...arcLabels(d).map(z => partPicture(d, z.key).words), ...Object.values(CONFLICT_PICTURES).map(p => p.words),
].join(' ');

describe('leak rules, per mode', () => {
  it('every mode has a saved payload', () => {
    expect(PAYLOADS.map(p => p.evalMode).sort()).toEqual(['bme', 'heros_journey', 'plot_diagram', 'story_mountain']);
  });
  it.each(ITEMS)('%s %s: no lever text, fact or picture names a character, a printed name, an event or the setting', (_m, _id, item, d) => {
    expect(helpLeaks(d, said(item, d))).toBe(false);
  });
  it.each(ITEMS.filter(([, id]) => id === 'analyze'))('%s analyze: the pictures fact never names a choice', (_m, _id, item, d) => {
    const fact = storyMapLeverFacts(item, d, [CONFLICT_PICTURES_LEVER]);
    for (const label of Object.values(CONFLICT_LABELS)) expect(fact).not.toContain(label);
    expect(fact).not.toMatch(/person-vs/);
  });
  it.each(PAYLOADS.map(p => [p.evalMode, p.data] as const))('%s: identify always prints a non-character, so the count is always offered', (_m, d) => {
    expect(characterChoices(d).some(c => !c.inStory)).toBe(true);
    expect(countLeaks(d)).toBe(false);
    expect(storyMapLevers({ id: 'identify' }, d, []).map(l => l.id)).toEqual([COUNT_LEVER, STORY_LEVER]);
    expect(storyMapLeverFacts({ id: 'identify' }, d, [COUNT_LEVER])).toMatch(/\d+ empty person spaces/);
  });
  it('a story with no generated distractor gets a pool name none of whose words the story uses', () => {
    const d = { ...PAYLOADS[0].data, distractorCharacters: undefined };
    const fake = characterChoices(d).filter(c => !c.inStory);
    expect(fake).toHaveLength(1);
    expect(FALLBACK_NAMES).toContain(fake[0].name);
    const story = { ...d, passage: { ...d.passage, text: `${d.passage.text} ${FALLBACK_NAMES.slice(0, -1).join('. ')}.` } };
    expect(characterChoices(story).filter(c => !c.inStory).map(c => c.name)).toEqual([FALLBACK_NAMES.at(-1)]);
  });
});

describe('practice builders', () => {
  it.each(PAYLOADS.map(p => [p.evalMode, p.data] as const))('%s: a shorter story, same arc, none of the session\'s names or events, solvable', (_m, d) => {
    const p = practiceStory(d)!;
    expect(p).not.toBeNull();
    expect(practiceLeaks(p, d)).toBe(false);
    expect(p.structureType).toBe(d.structureType);
    expect(p.events.map(e => e.arcPosition)).toEqual(arcLabels(d).map(z => z.key));
    expect(characterChoices(p).some(c => !c.inStory)).toBe(true);
    const sessionNames = characterChoices(d).map(c => c.name.toLowerCase());
    expect(characterChoices(p).some(c => sessionNames.includes(c.name.toLowerCase()))).toBe(false);
    expect(p.passage.text.length).toBeLessThan(d.passage.text.length + 1);
    const right = { ...EMPTY_VIEW, selectedCharacters: p.elements.characters.map(c => c.name), selectedSetting: 'correct',
      placed: Object.fromEntries(p.events.map(e => [e.id, e.arcPosition])) };
    expect(storyMapCorrect({ id: 'identify' }, p, right)).toBe(true);
    expect(storyMapCorrect({ id: 'sequence' }, p, right)).toBe(true);
  });
  it('a session story that uses a pool name gets another pool story', () => {
    const d = PAYLOADS[0].data;
    for (const name of ['Rosa', 'Ben', 'Kai']) {
      const s = { ...d, elements: { ...d.elements, characters: [...d.elements.characters, { name, description: 'x', role: 'supporting' as const }] } };
      const p = practiceStory(s)!;
      expect(p.passage.text).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
  it.each(PAYLOADS.filter(p => p.data.elements.conflict).map(p => [p.evalMode, p.data] as const))('%s: the practice conflict has three choices including its own and the crossed one', (_m, d) => {
    const p = practiceConflict(d)!;
    const type = p.elements.conflict!.type;
    expect(conflictOptions(p)).toHaveLength(3);
    expect(conflictOptions(p)).toContain(type);
    expect(conflictOptions(p)).toContain(type === 'person-vs-self' ? 'person-vs-nature' : 'person-vs-self');
    expect(p.passage.text).not.toBe(d.passage.text);
  });
});

describe('this wrong answer, then this lever', () => {
  const withNames = PAYLOADS.find(p => p.data.distractorCharacters?.length && p.data.elements.conflict)!.data;
  const at = (id: StoryMapItem['id']) => storyMapLevers({ id }, withNames, []);
  it.each([
    ['identify', 'picked_not_in_story', COUNT_LEVER], ['identify', 'missed_character', COUNT_LEVER], ['identify', 'wrong_setting', STORY_LEVER],
    ['sequence', 'one_part', PARTS_LEVER], ['sequence', 'next_part', PARTS_LEVER], ['sequence', 'far_part', PARTS_LEVER],
    ['sequence', 'reversed', ARROW_LEVER],
    ['analyze', 'inside_outside', CONFLICT_PICTURES_LEVER], ['analyze', 'other_outside', CONFLICT_PICTURES_LEVER],
  ] as const)('%s %s -> %s', (phase, miss, lever) => {
    expect(nextLever(at(phase), miss)).toBe(lever);
  });
  it('after the help is pulled, the same miss opens the practice story', () => {
    expect(nextLever(storyMapLevers({ id: 'sequence' }, withNames, [PARTS_LEVER, ARROW_LEVER]), 'next_part')).toBe(STORY_LEVER);
    expect(nextLever(storyMapLevers({ id: 'analyze' }, withNames, [CONFLICT_PICTURES_LEVER]), 'inside_outside')).toBe(CONFLICT_STORY_LEVER);
  });
  it.each(ITEMS)('%s %s: every miss the check can name is answered by a lever on the item', (_m, _id, item, d) => {
    const misses: Record<string, StoryMapMiss[]> = { identify: ['picked_not_in_story', 'missed_character', 'wrong_setting'],
      sequence: ['one_part', 'reversed', 'next_part', 'far_part'], analyze: ['inside_outside', 'other_outside'] };
    const levers = storyMapLevers(item, d, []);
    for (const miss of misses[item.id]) expect(levers.some(l => l.answers?.includes(miss)), miss).toBe(true);
    // The miss function and the table agree on a wrong placement of the first event.
    if (item.id === 'sequence') {
      const first = [...d.events].sort((a, b) => a.order - b.order)[0];
      const placed = Object.fromEntries(d.events.map(e => [e.id, e.id === first.id ? arcLabels(d).at(-1)!.key : e.arcPosition]));
      expect(storyMapMiss(item, d, { ...EMPTY_VIEW, placed })).toBe('reversed');
    }
  });
});
