import { describe, expect, it } from 'vitest';
import { spokenSpanOf, validateJudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  affirmFor,
  askFor,
  correctionFor,
  isSayableName,
  isSharedBehavior,
  itemCue,
  itemsFromChallenges,
  moveOnCue,
  storyBridgePack,
  storyText,
  tapVerdictCue,
} from './storyBridgeScript';
import { FALLBACK_PAIR, challengesFromPair, validateStoryPair } from '../../../service/literacy/gemini-story-bridge';
import type { StoryBridgeChallenge, StoryBridgeStory } from './StoryBridge';

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
    expect(validateJudgedScriptPack(storyBridgePack(items))).toEqual([]);
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
});

describe('story-bridge cues', () => {
  const items = itemsFromChallenges(challenges, stories);
  const [first, second] = items;

  it('reads both stories in the opening ask and never again until tap-to-hear', () => {
    const opening = spokenSpanOf(itemCue(first, { opening: true }));
    expect(opening).toContain(storyText(stories[0]));
    expect(opening).toContain(storyText(stories[1]));
    expect(spokenSpanOf(itemCue(second))).not.toContain(storyText(stories[1]));
    expect(spokenSpanOf(storyBridgePack(items).pronounceCue!(second))).toContain(storyText(stories[0]));
  });

  it('names the anchor only before a verdict', () => {
    for (const item of items) {
      const ask = askFor(item);
      expect(ask).toContain(item.anchor.name);
      expect(ask).not.toContain(item.target.name);
      expect(ask).not.toContain(item.sharedBehavior);
      const correction = correctionFor(item);
      expect(correction).toMatch(/^My turn:/);
      expect(correction).not.toContain(item.target.name);
      expect(correction).toContain(item.sharedBehavior);
      const affirm = affirmFor(item);
      expect(affirm).toMatch(/^Yes!/);
      expect(affirm).toContain(item.target.name);
      expect(affirm).toContain(item.target.sentence);
    }
  });

  it('hands the tutor the matching verdict line for a tap', () => {
    const hit = tapVerdictCue(first, first.target);
    expect(hit).toContain('MATCHES');
    expect(hit).toContain(affirmFor(first));
    const miss = tapVerdictCue(first, first.options.find((c) => c.id !== first.target.id)!);
    expect(miss).toContain('does NOT match');
    expect(miss).toContain(correctionFor(first));
  });

  it('closes a capped item by naming the pair, then asks the next', () => {
    const cue = moveOnCue(first, second);
    expect(spokenSpanOf(cue)).toContain(`${first.anchor.name} and ${first.target.name} are alike`);
    expect(spokenSpanOf(cue)).toContain(askFor(second));
    expect(moveOnCue(items[2], null)).toContain('the activity is over');
  });

  it('records the tapped friend as correction evidence', () => {
    const pack = storyBridgePack(items, () => first.options[1]);
    expect(pack.diagnosisObservation!(first, { lastHeard: null })).toEqual({
      challenge: `Hear two stories, then: ${askFor(first)}`,
      expected: `${first.target.name} tapped — both ${first.sharedBehavior}.`,
      observed: `Tapped ${first.options[1].name}.`,
    });
  });
});

describe('story-bridge generator validation', () => {
  const flat = (pair = FALLBACK_PAIR): Record<string, string> => {
    const out: Record<string, string> = {
      aTitle: pair.a.title, aSceneEmoji: pair.a.sceneEmoji, aOpening: pair.a.opening, aClosing: pair.a.closing,
      bTitle: pair.b.title, bSceneEmoji: pair.b.sceneEmoji, bOpening: pair.b.opening, bClosing: pair.b.closing,
    };
    pair.shared.forEach((shared, i) => {
      out[`role${i}Shared`] = shared;
      out[`role${i}AName`] = pair.a.characters[i].name;
      out[`role${i}AEmoji`] = pair.a.characters[i].emoji;
      out[`role${i}ASentence`] = pair.a.characters[i].sentence;
      out[`role${i}BName`] = pair.b.characters[i].name;
      out[`role${i}BEmoji`] = pair.b.characters[i].emoji;
      out[`role${i}BSentence`] = pair.b.characters[i].sentence;
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
