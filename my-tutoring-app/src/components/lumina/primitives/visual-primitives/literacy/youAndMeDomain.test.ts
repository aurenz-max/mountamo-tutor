import { describe, expect, it } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import type { YouAndMeChallenge } from './YouAndMe';
import { youAndMeBoss } from './youAndMe.boss';
import { expectedPronoun, expectedReflexive, hearSceneRequest, modelSentence, sceneStatement, youAndMeAsk, youAndMeKey } from './youAndMeDomain';

const scene: YouAndMeChallenge = {
  id: 'scene-1-a', sceneId: 'scene-1', type: 'describe_action',
  participants: [{ name: 'Mina', emoji: '👧' }, { name: 'Leo', emoji: '👦' }],
  actor: 0, speaker: 0, object: 'bag', objectEmoji: '🎒', action: 'packed the bag',
};

describe('You & Me speaking contract', () => {
  it.each([0, 1] as const)('binds the self form to the actor when speaker is %s', speaker => {
    const item: YouAndMeChallenge = { ...scene, type: 'describe_independent_action', speaker };
    expect(expectedReflexive(item)).toBe(speaker === 0 ? 'myself' : 'yourself');
    expect(modelSentence(item)).toBe(speaker === 0 ? 'I packed the bag by myself.' : 'You packed the bag by yourself.');
    expect(sceneStatement(item)).toBe('Mina packed the bag without any help.');
    expect(youAndMeAsk(item)).not.toMatch(/myself|yourself/);
    expect(youAndMeAsk(item)).toContain('Use a self word');
    const key = spokenKeyText(youAndMeKey(item));
    expect(key).toContain(`"${expectedReflexive(item)}" for that same person`);
    expect(key).toContain('with no self word');
  });

  it.each([0, 1] as const)('changes referent when the speaker changes, actor %s', actor => {
    const first = { ...scene, actor, speaker: actor };
    const second = { ...first, speaker: (1 - actor) as 0 | 1 };
    expect(expectedPronoun(first)).toBe('I');
    expect(expectedPronoun(second)).toBe('you');
    expect(modelSentence(first)).toBe('I packed the bag.');
    expect(modelSentence(second)).toBe('You packed the bag.');
    expect(spokenKeyText(youAndMeKey(second))).toContain('"you" as the subject');
  });

  it('never says a model sentence in the ask or the scene replay', () => {
    for (const type of ['describe_action', 'describe_independent_action'] as const) {
      for (const speaker of [0, 1] as const) {
        const item = { ...scene, type, speaker };
        for (const text of [youAndMeAsk(item), hearSceneRequest(item)]) {
          expect(text).toContain('Mina packed the bag');
          expect(text).not.toMatch(/\b(?:I|you) packed\b/i);
        }
        expect(askLeaks(youAndMeAsk(item), youAndMeKey(item))).toEqual([]);
      }
    }
  });

  it('the boss assignment carries the ask, the key text and the named misses', () => {
    const item = { ...scene, speaker: 1 as const };
    expect(youAndMeBoss.assignment(item)).toMatchObject({ id: item.id, task: 'Mina packed the bag. Play Leo. Tell Mina what happened.',
      response: 'speech', expectedAnswer: spokenKeyText(youAndMeKey(item)) });
    expect(youAndMeBoss.assignment(item).misses?.map(m => m.id)).toEqual(['swapped_pronoun', 'said_name', 'said_he_she']);
  });
});
