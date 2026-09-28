import { expect, it } from 'vitest';
import { storyBridgeMiss } from './storyBridgeWorkspace';
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
