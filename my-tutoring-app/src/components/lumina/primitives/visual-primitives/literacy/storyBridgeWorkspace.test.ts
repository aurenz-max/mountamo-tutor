import { expect, it } from 'vitest';
import { storyBridgeAssignment, storyBridgeMiss, storyBridgeSpokenMisses } from './storyBridgeWorkspace';
import type { StoryBridgeItem } from './storyBridgeScript';

const friend = (id: string, emoji: string) => ({ id, name: id, emoji, eventEmoji: '', sentence: '', uniqueDetail: '' });
const tap = (mode: StoryBridgeItem['mode'], choiceIds: string[], correctChoiceId: string, extra: Partial<StoryBridgeItem> = {}) =>
  ({ id: 's', mode, answerKind: 'gesture', choiceIds, correctChoiceId, ...extra }) as StoryBridgeItem;
// Story one's fox shares; in story two the bear shares, and a second fox does not.
const match = tap('match_character', ['bear', 'fox2', 'owl'], 'bear',
  { anchor: friend('fox', '🦊'), targetStory: { characters: [friend('bear', '🐻'), friend('fox2', '🦊'), friend('owl', '🦉')] } as StoryBridgeItem['targetStory'] });
const sequence = tap('sequence_two', ['e0', 'e1', 'e2'], 'e1');

it.each([
  [match, 'bear', undefined], [match, 'fox2', 'same_look'], [match, 'owl', 'other_character'],
  [tap('match_setting', ['same', 'different'], 'different'), 'same', 'same_for_different'],
  [tap('match_setting', ['same', 'different'], 'same'), 'different', 'different_for_same'],
  [tap('venn_place', ['story_a', 'both', 'story_b'], 'story_a'), 'both', 'both_for_one'],
  [tap('venn_place', ['story_a', 'both', 'story_b'], 'both'), 'story_b', 'one_for_both'],
  [tap('venn_place', ['story_a', 'both', 'story_b'], 'story_a'), 'story_b', 'other_side'],
  [sequence, 'e0', 'earlier_event'], [sequence, 'e2', 'later_event'], [sequence, 'e1', undefined],
] as const)('%#', (item, choice, miss) => {
  expect(storyBridgeMiss(item, choice)).toBe(miss);
});

const HILL = { id: 'a', title: 'Hill Day', mainIdea: 'Sharing makes friends.' };
const LAKE = { id: 'b', title: 'Lake Day', mainIdea: 'Helping is kind.' };
// Spoken comparisons: the known wrong answers, in precedence order, and only on spoken items.
const spoken = (mode: StoryBridgeItem['mode']) => ({ id: 's', mode, answerKind: 'voice', sharedBehavior: mode === 'say_alike' ? 'shared a snack' : '',
  anchor: { ...friend('Fox', '🦊'), uniqueDetail: 'ran to the hill' }, target: { ...friend('Bear', '🐻'), uniqueDetail: 'swam in the lake' },
  storyA: HILL, storyB: LAKE, anchorStory: HILL, targetStory: LAKE, comparisonSummary: 'Fox ran but Bear swam.' }) as unknown as StoryBridgeItem;

it.each([
  ['say_alike', ['one_friend_only', 'told_difference']],
  ['say_different', ['one_friend_only', 'told_likeness']],
  ['main_idea_compare', ['one_story_only']],
] as const)('%s names its spoken misses in order', (mode, ids) => {
  const misses = storyBridgeSpokenMisses(spoken(mode));
  expect(misses.map(m => m.id)).toEqual(ids);
  for (const m of misses) expect(m.pattern).not.toMatch(/because|thinks|confus/i);
});

it('the one-friend miss names both friends and offers one-friend examples; a tap item has no spoken misses', () => {
  const [oneFriend] = storyBridgeSpokenMisses(spoken('say_alike'));
  expect(oneFriend.pattern).toContain('Fox');
  expect(oneFriend.pattern).toContain('Bear');
  expect(oneFriend.examples).toContain('Fox ran to the hill.');
  expect(storyBridgeSpokenMisses(match)).toEqual([]);
  expect(storyBridgeAssignment(spoken('say_different')).misses?.map(m => m.id)).toEqual(['one_friend_only', 'told_likeness']);
});
