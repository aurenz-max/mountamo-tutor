import { describe, expect, it } from 'vitest';
import {
  normalizeSupportTier,
  resolveProblemShape,
  resolveSupportStructure,
  storyRibbonPromptFor,
  tutorRevealPolicy,
} from './storyRibbonSupport';

describe('story-ribbon support ladder', () => {
  it('normalizes only the manifest support-tier vocabulary', () => {
    expect(normalizeSupportTier(' EASY ')).toBe('easy');
    expect(normalizeSupportTier('medium')).toBe('medium');
    expect(normalizeSupportTier('hard')).toBe('hard');
    expect(normalizeSupportTier('advanced')).toBeNull();
    expect(normalizeSupportTier(undefined)).toBeNull();
  });

  it('withdraws retell planning aids monotonically without changing the task', () => {
    expect(resolveSupportStructure('tell_connected_account', 'easy')).toMatchObject({
      showSequenceLabels: true,
      showFlowArrows: true,
      showSelfCheck: true,
      showConnectionFrame: false,
      instructionLevel: 'guided',
    });
    expect(resolveSupportStructure('tell_connected_account', 'medium')).toMatchObject({
      showSequenceLabels: true,
      showFlowArrows: false,
      showSelfCheck: false,
      showConnectionFrame: false,
      instructionLevel: 'concise',
    });
    expect(resolveSupportStructure('tell_connected_account', 'hard')).toMatchObject({
      showSequenceLabels: false,
      showFlowArrows: false,
      showSelfCheck: false,
      showConnectionFrame: false,
      instructionLevel: 'minimal',
    });
  });

  it('withdraws the experience frame but never withdraws privacy-safe task wording', () => {
    const easy = resolveSupportStructure('story_to_experience', 'easy');
    const medium = resolveSupportStructure('story_to_experience', 'medium');
    const hard = resolveSupportStructure('story_to_experience', 'hard');
    expect(easy.showConnectionFrame).toBe(true);
    expect(medium.showConnectionFrame).toBe(false);
    expect(hard.showConnectionFrame).toBe(false);
    expect(storyRibbonPromptFor('story_to_experience', undefined, hard)).toContain('explain its connection');
    expect(tutorRevealPolicy('story_to_experience', 'hard')).toContain('privacy');
  });

  it('keeps the tense condition at every instruction level', () => {
    const modes = [
      ['tell_present_account', 'Today', 'present time'],
      ['tell_future_account', 'Tomorrow', 'future time'],
      ['tell_past_account', 'Yesterday', 'past time'],
    ] as const;
    for (const [mode, cue, phrase] of modes) {
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        const prompt = storyRibbonPromptFor(mode, cue, resolveSupportStructure(mode, tier));
        expect(prompt).toContain(phrase);
      }
    }
  });

  it('preserves the pre-tier visual defaults when difficulty is absent', () => {
    expect(resolveSupportStructure('story_to_experience', null)).toMatchObject({
      showSequenceLabels: true,
      showFlowArrows: true,
      showSelfCheck: true,
      showConnectionFrame: true,
      instructionLevel: 'guided',
    });
  });

  it('maps retell tiers to a monotonic narrative arc while saturating experience honestly', () => {
    expect(resolveProblemShape('tell_connected_account', 'easy')).toMatchObject({
      storyShape: 'routine_sequence',
      problemTarget: 0,
      setbackTarget: 0,
      adaptationTarget: 0,
      structurallySaturated: false,
    });
    expect(resolveProblemShape('tell_present_account', 'medium')).toMatchObject({
      storyShape: 'problem_solution',
      problemTarget: 1,
      setbackTarget: 0,
      adaptationTarget: 0,
      structurallySaturated: false,
    });
    expect(resolveProblemShape('tell_future_account', 'hard')).toMatchObject({
      storyShape: 'adapted_solution',
      problemTarget: 0,
      setbackTarget: 1,
      adaptationTarget: 1,
      structurallySaturated: false,
    });
    expect(resolveProblemShape('story_to_experience', 'hard')).toMatchObject({
      storyShape: 'connection_saturated',
      structurallySaturated: true,
    });
  });
});
