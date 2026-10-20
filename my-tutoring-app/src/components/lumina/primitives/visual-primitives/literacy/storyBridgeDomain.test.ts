import { describe, expect, it } from 'vitest';
import {
  askFor,
  evidenceFor,
  isSayableName,
  isSharedBehavior,
  itemsFromChallenges,
  storyBridgeKey,
  storyBridgeMiss,
  storyBridgeSpokenMisses,
  storyText,
  type StoryBridgeItem,
} from './storyBridgeDomain';
import {
  FALLBACK_PAIR,
  STORY_BRIDGE_CHALLENGE_TYPES,
  challengesFromPair,
  scheduleStoryBridgeTypes,
  validateStoryPair,
} from '../../../service/literacy/gemini-story-bridge';
import type { StoryBridgeChallenge, StoryBridgeStory } from './StoryBridge';
import { getComponentById } from '../../../service/manifest/catalog';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';

const stories: StoryBridgeStory[] = [FALLBACK_PAIR.a, FALLBACK_PAIR.b];
const challenges: StoryBridgeChallenge[] = challengesFromPair(FALLBACK_PAIR, 0, 0);

describe('story-bridge build gates', () => {
  it('builds three askable gesture items from the familiar pair', () => {
    const items = itemsFromChallenges(challenges, stories);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.answerKind === 'gesture' && i.responseClass === 'manipulation')).toBe(true);
    expect(items.map((i) => i.introducesStories)).toEqual([true, false, false]);
    // Anchor side alternates so the far shore is not always the same story.
    expect(items.map((i) => i.anchorStory.id)).toEqual([
      'story-bridge-pair-1-a', 'story-bridge-pair-1-b', 'story-bridge-pair-1-a',
    ]);
  });

  it('drops a pair whose partners share a picture', () => {
    const lookalike: StoryBridgeStory[] = [
      stories[0],
      { ...stories[1], characters: stories[1].characters.map((c, i) => (i === 0 ? { ...c, emoji: '🐱' } : c)) },
    ];
    expect(itemsFromChallenges(challenges, lookalike).map((i) => i.id)).toEqual(['story-bridge-1-2', 'story-bridge-1-3']);
  });

  it('drops a shared behavior that names a character', () => {
    const leaky = challenges.map((ch, i) => (i === 0 ? { ...ch, sharedBehavior: 'were lost like Bird' } : ch));
    expect(itemsFromChallenges(leaky, stories)).toHaveLength(2);
    expect(isSharedBehavior('were lost and felt scared', ['Kitten', 'Bird'])).toBe(true);
    expect(isSharedBehavior('Both were lost', ['Kitten'])).toBe(false);
    expect(isSharedBehavior('were lost.', ['Kitten'])).toBe(false);
  });

  it('drops a story whose title names one of its characters', () => {
    const leakyTitle: StoryBridgeStory[] = [stories[0], { ...stories[1], title: 'The Little Bird' }];
    expect(itemsFromChallenges(challenges, leakyTitle)).toHaveLength(0);
  });

  it('refuses describing-word names that carry the behavior', () => {
    expect(isSayableName('Sleepy Cat')).toBe(false);
    expect(isSayableName('Bouncing Bunny')).toBe(false);
    expect(isSayableName('Little Bird')).toBe(true);
    expect(isSayableName('Grandpa')).toBe(true);
    expect(isSayableName('Billy')).toBe(true);
  });

  it('drops a far shore with only one friend', () => {
    const thin: StoryBridgeStory[] = [stories[0], { ...stories[1], characters: [stories[1].characters[0]] }];
    expect(itemsFromChallenges(challenges, thin)).toHaveLength(0);
  });

  it('assembles the story body from the character sentences', () => {
    expect(storyText(stories[0])).toBe(
      'One rainy day, a kitten wandered too far from home. Kitten was lost and felt scared under a big porch. '
      + 'Mia heard a tiny meow and helped Kitten out. Grandpa dried Kitten with a warm towel and smiled. '
      + 'Kitten purred all the way home.',
    );
  });

  it('builds every comparison mode over the same two retained stories', () => {
    const allChallenges = challengesFromPair(FALLBACK_PAIR, 0, 0, STORY_BRIDGE_CHALLENGE_TYPES);
    const allItems = itemsFromChallenges(allChallenges, stories);
    expect(allItems.map((item) => item.mode)).toEqual(STORY_BRIDGE_CHALLENGE_TYPES);
    expect(new Set(allItems.flatMap((item) => [item.storyA.id, item.storyB.id]))).toEqual(
      new Set(['story-bridge-pair-1-a', 'story-bridge-pair-1-b']),
    );
    expect(allItems.filter((item) => item.answerKind === 'voice').map((item) => item.mode)).toEqual([
      'say_alike', 'say_different', 'main_idea_compare',
    ]);
  });

  it('gives the Venn mode one item for each region and sequence mode three ordered matches', () => {
    const venn = itemsFromChallenges(
      challengesFromPair(FALLBACK_PAIR, 0, 0, ['venn_place', 'venn_place', 'venn_place']),
      stories,
    );
    expect(venn.map((item) => item.correctChoiceId)).toEqual(['story_a', 'both', 'story_b']);
    const sequence = itemsFromChallenges(
      challengesFromPair(FALLBACK_PAIR, 0, 0, ['sequence_two', 'sequence_two', 'sequence_two']),
      stories,
    );
    expect(sequence.map((item) => item.eventIndex)).toEqual([0, 1, 2]);
    expect(sequence.every((item) => item.correctChoiceId === item.target.id)).toBe(true);
  });

  it('schedules a genuine seven-skill mixed session and natural single-mode counts', () => {
    expect(scheduleStoryBridgeTypes(null)).toEqual(STORY_BRIDGE_CHALLENGE_TYPES);
    const pinnedVenn = {
      allowedTypes: ['venn_place'],
      modes: [],
      promptDocs: '',
      source: 'explicit' as const,
    };
    expect(scheduleStoryBridgeTypes(pinnedVenn)).toEqual(['venn_place', 'venn_place', 'venn_place']);
  });

  it('publishes every challenge type as an ordered catalog eval mode', () => {
    const modes = getComponentById('story-bridge')?.evalModes ?? [];
    expect(modes.map((mode) => mode.evalMode)).toEqual([
      'match_character', 'match_setting', 'venn_place', 'say_alike',
      'sequence_two', 'say_different', 'main_idea_compare',
    ]);
    expect(modes.map((mode) => mode.beta)).toEqual([2, 2, 2.5, 3, 3, 3.5, 4]);
    expect(new Set(modes.flatMap((mode) => mode.challengeTypes))).toEqual(new Set(STORY_BRIDGE_CHALLENGE_TYPES));
  });
});

describe('story-bridge ask, key and misses', () => {
  const items = itemsFromChallenges(challenges, stories);
  const [, second] = items;

  it('names the anchor only before a verdict, never the friend it matches or what they share', () => {
    for (const item of items) {
      const ask = askFor(item);
      expect(ask).toContain(item.anchor.name);
      expect(ask).not.toContain(item.target.name);
      expect(ask).not.toContain(item.sharedBehavior);
      expect(storyBridgeKey(item)).toBeNull();
    }
  });

  it('keys a spoken comparison on meaning, with the reference and both evidence sentences', () => {
    const all = itemsFromChallenges(challengesFromPair(FALLBACK_PAIR, 0, 0, STORY_BRIDGE_CHALLENGE_TYPES), stories);
    for (const item of all.filter(i => i.answerKind === 'voice')) {
      const key = storyBridgeKey(item)!;
      expect(key.meaning, item.mode).toBeTruthy();
      expect(spokenKeyText(key)).toContain(item.comparisonSummary);
      if (item.mode !== 'main_idea_compare') {
        const evidence = evidenceFor(item);
        expect(key.acceptRule).toContain(evidence.storyA);
        expect(key.acceptRule).toContain(evidence.storyB);
      }
    }
  });

  it('keeps side-by-side evidence under the story it came from when the anchor shore alternates', () => {
    const evidence = evidenceFor(second);
    expect(second.anchorStory.id).toBe(stories[1].id);
    expect(evidence.storyA).toBe(second.target.sentence);
    expect(evidence.storyB).toBe(second.anchor.sentence);
  });

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
  ] as const)('a checked tap names its miss (%#)', (item, choice, miss) => {
    expect(storyBridgeMiss(item, choice)).toBe(miss);
  });

  const HILL = { id: 'a', title: 'Hill Day', mainIdea: 'Sharing makes friends.' };
  const LAKE = { id: 'b', title: 'Lake Day', mainIdea: 'Helping is kind.' };
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
  });
});

describe('story-bridge generator validation', () => {
  const flat = (pair = FALLBACK_PAIR): Record<string, string> => {
    const out: Record<string, string> = {
      challengeType: 'match_character',
      aTitle: pair.a.title, aSceneEmoji: pair.a.sceneEmoji, aSetting: pair.a.setting,
      aOpening: pair.a.opening, aClosing: pair.a.closing, aMainIdea: pair.a.mainIdea,
      bTitle: pair.b.title, bSceneEmoji: pair.b.sceneEmoji, bSetting: pair.b.setting,
      bOpening: pair.b.opening, bClosing: pair.b.closing, bMainIdea: pair.b.mainIdea,
      settingRelation: pair.settingRelation, settingComparison: pair.settingComparison,
      mainIdeaRelation: pair.mainIdeaRelation, mainIdeaComparison: pair.mainIdeaComparison,
    };
    pair.shared.forEach((shared, i) => {
      out[`role${i}Shared`] = shared;
      out[`role${i}AName`] = pair.a.characters[i].name;
      out[`role${i}AEmoji`] = pair.a.characters[i].emoji;
      out[`role${i}AEventEmoji`] = pair.a.characters[i].eventEmoji;
      out[`role${i}ASentence`] = pair.a.characters[i].sentence;
      out[`role${i}AUnique`] = pair.a.characters[i].uniqueDetail;
      out[`role${i}BName`] = pair.b.characters[i].name;
      out[`role${i}BEmoji`] = pair.b.characters[i].emoji;
      out[`role${i}BEventEmoji`] = pair.b.characters[i].eventEmoji;
      out[`role${i}BSentence`] = pair.b.characters[i].sentence;
      out[`role${i}BUnique`] = pair.b.characters[i].uniqueDetail;
    });
    return out;
  };

  it('accepts a well-formed flat pair and keys it by pair index', () => {
    const pair = validateStoryPair(flat(), 1);
    expect(pair).not.toBeNull();
    expect(pair!.a.id).toBe('story-bridge-pair-2-a');
    expect(pair!.b.characters[2].id).toBe('story-bridge-pair-2-b-3');
  });

  it('rejects a sentence that does not name its character, a text stimulus, and a duplicate name', () => {
    expect(validateStoryPair({ ...flat(), role0ASentence: 'It was lost and felt scared.' }, 0)).toBeNull();
    expect(validateStoryPair({ ...flat(), role1BEmoji: 'boy' }, 0)).toBeNull();
    expect(validateStoryPair({ ...flat(), role2BName: 'Mia' }, 0)).toBeNull();
    expect(validateStoryPair({ ...flat(), role0BEmoji: '🐱' }, 0)).toBeNull();
    expect(validateStoryPair({ ...flat(), role0Shared: 'Kitten and Bird were lost' }, 0)).toBeNull();
  });
});
