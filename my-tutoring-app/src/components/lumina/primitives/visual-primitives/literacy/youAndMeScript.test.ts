import { describe, expect, it } from 'vitest';
import { spokenSpanOf, validateJudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { expectedPronoun, expectedReflexive, modelSentence, sceneStatement, youAndMeItemCue, youAndMePack, type YouAndMeItem } from './youAndMeScript';

const scene: YouAndMeItem = {
  id: 'scene-1-a', sceneId: 'scene-1', type: 'describe_action',
  participants: [{ name: 'Mina', emoji: '👧' }, { name: 'Leo', emoji: '👦' }],
  actor: 0, speaker: 0, object: 'bag', objectEmoji: '🎒', action: 'packed the bag',
  answerKind: 'voice', responseClass: 'concept_statement',
};

describe('You & Me speaking contract', () => {
  it.each([0, 1] as const)('binds the self form to the actor when speaker is %s', speaker => {
    const item: YouAndMeItem = { ...scene, type: 'describe_independent_action', speaker };
    expect(expectedReflexive(item)).toBe(speaker === 0 ? 'myself' : 'yourself');
    expect(modelSentence(item)).toBe(speaker === 0 ? 'I packed the bag by myself.' : 'You packed the bag by yourself.');
    expect(sceneStatement(item)).toBe('Mina packed the bag without any help.');
    expect(spokenSpanOf(youAndMeItemCue(item))).not.toMatch(/myself|yourself/);
    expect(spokenSpanOf(youAndMeItemCue(item))).toContain('Use a self word');
    expect(youAndMeItemCue(item)).toContain('omits the self word');
    expect(validateJudgedScriptPack(youAndMePack([scene, item]))).toEqual(expect.arrayContaining([expect.stringContaining('duplicate item id')]));
    expect(validateJudgedScriptPack(youAndMePack([scene, { ...item, id: 'independent' }]))).toEqual([]);
  });
  it.each([0, 1] as const)('changes referent when the speaker changes, actor %s', actor => {
    const first = { ...scene, actor, speaker: actor };
    const second = { ...first, speaker: (1 - actor) as 0 | 1 };
    expect(expectedPronoun(first)).toBe('I');
    expect(expectedPronoun(second)).toBe('you');
    expect(modelSentence(first)).toBe('I packed the bag.');
    expect(modelSentence(second)).toBe('You packed the bag.');
  });
  it('does not speak a model sentence in the ask or scene replay', () => {
    for (const speaker of [0, 1] as const) {
      const item = { ...scene, speaker };
      const pack = youAndMePack([item]);
      for (const cue of [youAndMeItemCue(item, true), pack.pronounceCue!(item)]) {
        expect(spokenSpanOf(cue)).toContain('Mina packed the bag.');
        expect(spokenSpanOf(cue)).not.toMatch(/\b(?:I|you) packed\b/i);
      }
    }
  });
  it('passes runner validation for a role swap, replay, move-on and completion', () => {
    expect(validateJudgedScriptPack(youAndMePack([
      scene, { ...scene, id: 'scene-1-b', speaker: 1 },
    ]))).toEqual([]);
  });
  it('retains actor and speaker in correction evidence', () => {
    const item = { ...scene, speaker: 1 as const };
    const evidence = youAndMePack([item]).diagnosisObservation!(item, { lastHeard: 'I packed the bag' });
    expect(evidence).toEqual({ challenge: 'Mina packed the bag. Play Leo. Tell Mina what happened.',
      expected: 'You packed the bag.', observed: 'I packed the bag' });
  });
});
