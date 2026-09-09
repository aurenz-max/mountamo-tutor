import { describe, expect, it } from 'vitest';
import {
  applyStoryRibbonDifficulty,
  applyStoryRibbonSupport,
  buildStoryRibbonShapeFallback,
  buildStoryRibbonShapeValidationReminder,
  buildStoryRibbonTierPromptSection,
  countStoryRibbonShape,
  fillWithStoryRibbonFallbacks,
  scheduleStoryRibbonTypes,
  STORY_RIBBON_FALLBACKS,
  STORY_RIBBON_CHALLENGE_TYPES,
  validateStoryRibbonPayload,
} from './gemini-story-ribbon';
import { challengeAskable } from '../../primitives/visual-primitives/literacy/storyRibbonScript';
import { resolveProblemShape } from '../../primitives/visual-primitives/literacy/storyRibbonSupport';

const validRaw = {
  challengeType: 'tell_connected_account',
  timeCue: 'none',
  storyTitle: 'A Tiny Garden',
  characterName: 'Mina',
  characterEmoji: '👧',
  setting: 'the garden',
  event0PictureKey: 'seeds',
  event0PictureLabel: 'Seeds and soil',
  event0ModelSentence: 'Mina planted three seeds in soft soil.',
  event1PictureKey: 'watering',
  event1PictureLabel: 'Watering can',
  event1ModelSentence: 'Mina watered the seeds every morning.',
  event2PictureKey: 'plant',
  event2PictureLabel: 'Green sprout',
  event2ModelSentence: 'A green sprout pushed through the soil.',
};

describe('gemini-story-ribbon output gates', () => {
  it('reconstructs the flat schema into one askable challenge', () => {
    const challenge = validateStoryRibbonPayload(validRaw, 2);
    expect(challenge?.id).toBe('story-ribbon-3');
    expect(challenge?.events).toHaveLength(3);
    expect(challenge?.events.map((event) => event.order)).toEqual([0, 1, 2]);
    expect(challenge && challengeAskable(challenge)).toBe(true);
  });

  it('rejects missing fields, duplicate pictures, scripted labels, and malformed sentences', () => {
    expect(validateStoryRibbonPayload({ ...validRaw, event1ModelSentence: '' }, 0)).toBeNull();
    expect(validateStoryRibbonPayload({ ...validRaw, event1PictureKey: 'seeds' }, 0)).toBeNull();
    expect(validateStoryRibbonPayload({ ...validRaw, event0PictureLabel: 'First plant the seeds.' }, 0)).toBeNull();
    expect(validateStoryRibbonPayload({ ...validRaw, event2ModelSentence: 'Sprout.' }, 0)).toBeNull();
  });

  it('enforces each mode type, time cue, and future-tense model contract', () => {
    const future = {
      ...validRaw,
      challengeType: 'tell_future_account',
      timeCue: 'Tomorrow',
      event0ModelSentence: 'Mina will plant three seeds in soft soil.',
      event1ModelSentence: 'Mina will use water to help the seeds.',
      event2ModelSentence: 'A green sprout will push through the soil.',
    };
    expect(validateStoryRibbonPayload(future, 0, 'tell_future_account')?.timeCue).toBe('Tomorrow');
    expect(validateStoryRibbonPayload({ ...future, timeCue: 'Today' }, 0)).toBeNull();
    expect(validateStoryRibbonPayload({ ...future, event1ModelSentence: 'Mina watered the seeds.' }, 0)).toBeNull();
    expect(validateStoryRibbonPayload(future, 0, 'tell_past_account')).toBeNull();
  });

  it('schedules every task identity in a five-challenge mixed session', () => {
    expect(scheduleStoryRibbonTypes(null, 5)).toEqual(STORY_RIBBON_CHALLENGE_TYPES);
  });

  it('rejects a visible cue whose anchor is absent from the hidden judged meaning', () => {
    expect(validateStoryRibbonPayload({
      ...validRaw,
      event2PictureKey: 'puppy',
      event2PictureLabel: 'Happy puppy reunion',
      event2ModelSentence: 'Mina returned the little bear to its owner.',
    }, 0)).toBeNull();
  });

  it('fills a rejected early slot without colliding with later generated IDs', () => {
    const second = validateStoryRibbonPayload({ ...validRaw, storyTitle: 'Garden Two' }, 1);
    const third = validateStoryRibbonPayload({ ...validRaw, storyTitle: 'Garden Three' }, 2);
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();

    const result = fillWithStoryRibbonFallbacks(
      [second!, third!],
      3,
      ['tell_future_account', 'tell_connected_account', 'tell_connected_account'],
    );
    expect(result.fallbackCount).toBe(1);
    expect(new Set(result.challenges.map((challenge) => challenge.id)).size).toBe(3);
    expect(result.challenges.map((challenge) => challenge.id)).toContain('story-ribbon-1');
    expect(result.challenges.find((challenge) => challenge.id === 'story-ribbon-1')?.type).toBe('tell_future_account');
  });

  it('keeps every explicit fallback fully valid and answer-derivable', () => {
    expect(STORY_RIBBON_FALLBACKS).toHaveLength(4);
    for (const challenge of STORY_RIBBON_FALLBACKS) {
      expect(challengeAskable(challenge)).toBe(true);
      expect(challenge.events.map((event) => event.order)).toEqual([0, 1, 2]);
      expect(new Set(challenge.events.map((event) => event.pictureLabel)).size).toBe(3);
    }
  });

  it('stamps support per challenge without changing story or answer-bearing content', () => {
    const source = [
      STORY_RIBBON_FALLBACKS[0],
      { ...STORY_RIBBON_FALLBACKS[1], type: 'story_to_experience' as const },
    ];
    const storyContent = source.map(({ supportTier: _tier, support: _support, ...challenge }) => challenge);
    const easy = applyStoryRibbonSupport(source, 'easy');
    const hard = applyStoryRibbonSupport(source, 'hard');

    expect(easy.every((challenge) => challenge.supportTier === 'easy')).toBe(true);
    expect(hard.every((challenge) => challenge.supportTier === 'hard')).toBe(true);
    expect(easy[0].support).toMatchObject({ showSequenceLabels: true, showFlowArrows: true, showSelfCheck: true });
    expect(hard[0].support).toMatchObject({ showSequenceLabels: false, showFlowArrows: false, showSelfCheck: false });
    expect(easy[1].support?.showConnectionFrame).toBe(true);
    expect(hard[1].support?.showConnectionFrame).toBe(false);

    for (const supported of [easy, hard]) {
      expect(supported.map(({ supportTier: _tier, support: _support, ...challenge }) => challenge)).toEqual(storyContent);
    }
    expect(applyStoryRibbonSupport(source, null)).toBe(source);
  });

  it('keeps the untiered structural path byte-identical', () => {
    const source = [STORY_RIBBON_FALLBACKS[0], STORY_RIBBON_FALLBACKS[1]];
    expect(applyStoryRibbonDifficulty(source, null)).toBe(source);
    expect(buildStoryRibbonTierPromptSection('tell_connected_account', null)).toBe('');
  });

  it('merges support and narrative shape from the same tier key', () => {
    const hard = buildStoryRibbonTierPromptSection('tell_past_account', 'hard');
    expect(hard).toContain('WITHIN-MODE DIFFICULTY (hard)');
    expect(hard).toContain('sequence labels withdrawn');
    expect(hard).toContain('failed attempt or setback');
    expect(hard).toContain('never the event count');

    const saturated = buildStoryRibbonTierPromptSection('story_to_experience', 'hard');
    expect(saturated).toContain('structurally saturated');
    expect(saturated).toContain('privacy-safe connection');
    expect(buildStoryRibbonShapeValidationReminder('tell_connected_account', 'medium')).toContain('event0ModelSentence MUST');
    expect(buildStoryRibbonShapeValidationReminder('tell_future_account', 'hard')).toContain('event1ModelSentence MUST');
    expect(buildStoryRibbonShapeValidationReminder('story_to_experience', 'hard')).toBe('');
  });

  it('constructs exact, askable tier shapes across every retell mode and fallback slot', () => {
    const modes = [
      'tell_connected_account',
      'tell_present_account',
      'tell_future_account',
      'tell_past_account',
    ] as const;
    const tiers = ['easy', 'medium', 'hard'] as const;
    for (let run = 0; run < 1000; run++) {
      const mode = modes[run % modes.length];
      const tier = tiers[Math.floor(run / modes.length) % tiers.length];
      const spec = resolveProblemShape(mode, tier);
      const slot = Math.floor(run / (modes.length * tiers.length)) % STORY_RIBBON_FALLBACKS.length;
      const challenge = buildStoryRibbonShapeFallback(slot, mode, spec.storyShape);
      expect(challengeAskable(challenge)).toBe(true);
      expect(challenge.type).toBe(mode);
      expect(challenge.events).toHaveLength(3);
      expect(challenge.events.map((event) => event.order)).toEqual([0, 1, 2]);
      expect(countStoryRibbonShape(challenge)).toEqual({
        problemCount: spec.problemTarget,
        setbackCount: spec.setbackTarget,
        adaptationCount: spec.adaptationTarget,
      });
      if (mode === 'tell_future_account') {
        expect(challenge.events.every((event) => /\bwill\b/i.test(event.modelSentence))).toBe(true);
      }
      expect(challenge.events.some((event) => /\bseeds was\b/i.test(event.modelSentence))).toBe(false);
    }
  });

  it('keeps five-slot deterministic reconstructions title-distinct', () => {
    const challenges = Array.from({ length: 5 }, (_, index) =>
      buildStoryRibbonShapeFallback(index, 'tell_connected_account', 'adapted_solution'));
    expect(new Set(challenges.map((challenge) => challenge.title)).size).toBe(5);
  });

  it('honors an exact shape and reconstructs a miss without changing mode or three-event floor', () => {
    const exact = buildStoryRibbonShapeFallback(0, 'tell_past_account', 'adapted_solution');
    const honored = applyStoryRibbonDifficulty([exact], 'hard')[0];
    expect(honored.events).toEqual(exact.events);
    expect(honored.problemShape).toBe('adapted_solution');
    expect(honored.problemShapeSource).toBe('generated');

    const miss = { ...STORY_RIBBON_FALLBACKS[0], type: 'tell_future_account' as const, timeCue: 'Tomorrow' as const };
    const rebuilt = applyStoryRibbonDifficulty([miss], 'hard')[0];
    expect(rebuilt.type).toBe('tell_future_account');
    expect(rebuilt.timeCue).toBe('Tomorrow');
    expect(rebuilt.events).toHaveLength(3);
    expect(rebuilt.problemShape).toBe('adapted_solution');
    expect(rebuilt.problemShapeSource).toBe('fallback');
    expect(countStoryRibbonShape(rebuilt)).toEqual({ problemCount: 0, setbackCount: 1, adaptationCount: 1 });
    expect(rebuilt.events.every((event) => /\bwill\b/i.test(event.modelSentence))).toBe(true);
    expect(challengeAskable(rebuilt)).toBe(true);
  });

  it('leaves experience content intact and records honest structural saturation', () => {
    const source = { ...STORY_RIBBON_FALLBACKS[0], type: 'story_to_experience' as const };
    const result = applyStoryRibbonDifficulty([source], 'hard')[0];
    expect(result.problemShape).toBe('connection_saturated');
    expect(result.problemShapeSource).toBe('saturated');
    expect(result.events).toEqual(source.events);
    expect(result.type).toBe('story_to_experience');
  });
});
