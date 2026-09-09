import type { StoryRibbonChallengeType, StoryRibbonTimeCue } from './StoryRibbon';

export type SupportTier = 'easy' | 'medium' | 'hard';

export type StoryRibbonProblemShape =
  | 'routine_sequence'
  | 'problem_solution'
  | 'adapted_solution'
  | 'connection_saturated';

export interface StoryRibbonProblemShapeSpec {
  storyShape: StoryRibbonProblemShape;
  problemTarget: 0 | 1;
  setbackTarget: 0 | 1;
  adaptationTarget: 0 | 1;
  structurallySaturated: boolean;
  promptLines: string[];
}

export interface StoryRibbonSupportOptions {
  showSequenceLabels: boolean;
  showFlowArrows: boolean;
  showSelfCheck: boolean;
  showConnectionFrame: boolean;
  instructionLevel: 'guided' | 'concise' | 'minimal';
}

export interface StoryRibbonSupportScaffold extends StoryRibbonSupportOptions {
  promptLines: string[];
}

export function normalizeSupportTier(value: unknown): SupportTier | null {
  const tier = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return tier === 'easy' || tier === 'medium' || tier === 'hard' ? tier : null;
}

/**
 * Support-only ladder. The story, event meanings, canonical order, time
 * condition, response contract, and number of events are invariant.
 *
 * `null` preserves the pre-tier Story Ribbon surface byte-for-byte: labels,
 * arrows, live order feedback, and the fuller connection reminder remain on.
 */
export function resolveSupportStructure(
  mode: StoryRibbonChallengeType,
  tier: SupportTier | null,
): StoryRibbonSupportScaffold {
  const experience = mode === 'story_to_experience';
  const legacy = tier === null;
  const effectiveTier = tier ?? 'easy';
  const showSequenceLabels = legacy || effectiveTier === 'easy' || (!experience && effectiveTier === 'medium');
  const showFlowArrows = legacy || effectiveTier === 'easy';
  const showSelfCheck = legacy || effectiveTier === 'easy';
  const showConnectionFrame = experience && (legacy || effectiveTier === 'easy');
  const instructionLevel = legacy || effectiveTier === 'easy'
    ? 'guided'
    : effectiveTier === 'medium'
      ? 'concise'
      : 'minimal';

  return {
    showSequenceLabels,
    showFlowArrows,
    showSelfCheck,
    showConnectionFrame,
    instructionLevel,
    promptLines: [
      'The SUPPORT axis changes only visible planning and instructional help. It never changes the event count, canonical order, time condition, response contract, or task identity.',
      experience
        ? `${effectiveTier} story-to-experience support: ${showConnectionFrame ? 'show the three-part connection frame' : 'withdraw the connection frame'}; privacy-safe alternatives remain visible at every tier.`
        : `${effectiveTier} retell support: sequence labels ${showSequenceLabels ? 'shown' : 'withdrawn'}, flow arrows ${showFlowArrows ? 'shown' : 'withdrawn'}, and live order self-check ${showSelfCheck ? 'shown' : 'withdrawn'}.`,
      `Instruction detail is ${instructionLevel}; keep the title and generated story neutral and never mention a support tier to the child.`,
    ],
  };
}

/**
 * Narrative shape ladder for the four retell modes. The three-event ceiling,
 * task identity, time contract, vocabulary ceiling, and response contract stay
 * fixed. story_to_experience intentionally saturates: its current contract lets
 * the child connect to any one event, so a harder source arc would not honestly
 * make the measured response harder.
 */
export function resolveProblemShape(
  mode: StoryRibbonChallengeType,
  tier: SupportTier,
): StoryRibbonProblemShapeSpec {
  if (mode === 'story_to_experience') {
    return {
      storyShape: 'connection_saturated',
      problemTarget: 0,
      setbackTarget: 0,
      adaptationTarget: 0,
      structurallySaturated: true,
      promptLines: [
        'Story-to-experience is structurally saturated under its current response contract: preserve one selectable story event plus one explained, privacy-safe connection.',
        'Do not make this mode harder by requiring a full retell, a private memory, multiple similarities, or a difference statement.',
      ],
    };
  }

  if (tier === 'easy') {
    return {
      storyShape: 'routine_sequence',
      problemTarget: 0,
      setbackTarget: 0,
      adaptationTarget: 0,
      structurallySaturated: false,
      promptLines: [
        'Use a familiar three-step routine: setup, ordinary action, direct result.',
        'Do not include a problem, failed attempt, setback, or change of plan.',
      ],
    };
  }
  if (tier === 'medium') {
    return {
      storyShape: 'problem_solution',
      problemTarget: 1,
      setbackTarget: 0,
      adaptationTarget: 0,
      structurallySaturated: false,
      promptLines: [
        'Use a direct problem-solution arc: event 1 introduces one small concrete need or problem, event 2 is the response, and event 3 is the result.',
        'Do not include a failed attempt or change of plan; one response must solve the problem directly.',
      ],
    };
  }
  return {
    storyShape: 'adapted_solution',
    problemTarget: 0,
    setbackTarget: 1,
    adaptationTarget: 1,
    structurallySaturated: false,
    promptLines: [
      'Use an adapted-solution arc: event 1 establishes the goal, event 2 is one failed attempt or setback, and event 3 changes the plan and resolves it.',
      'Make the setback explicit with child-friendly failure language such as "but ... did not/could not", and make the changed plan explicit with "instead", "again", "another way", or an equally clear adaptation word.',
    ],
  };
}

export function storyRibbonPromptFor(
  mode: StoryRibbonChallengeType,
  timeCue: StoryRibbonTimeCue | undefined,
  support: StoryRibbonSupportOptions,
): string {
  if (mode === 'story_to_experience') {
    if (support.instructionLevel === 'guided') {
      return 'Choose one story moment. Tell what happened, share another experience, then explain what is alike.';
    }
    if (support.instructionLevel === 'concise') {
      return 'Tell one story moment and explain how it connects to another experience.';
    }
    return 'Choose a story moment and explain its connection.';
  }

  const timeDirection = timeCue === 'Today'
    ? ' Keep every event in present time, as if it is happening today.'
    : timeCue === 'Tomorrow'
      ? ' Keep every event in future time, as if it will happen tomorrow.'
      : timeCue === 'Yesterday'
        ? ' Keep every event in past time, as if it happened yesterday.'
        : '';
  if (support.instructionLevel === 'guided') {
    return `Tap one picture, then another, to trade their places. Tell the whole story when your ribbon is ready.${timeDirection}`;
  }
  if (support.instructionLevel === 'concise') {
    return `Put the pictures in story order. Then tell the whole story.${timeDirection}`;
  }
  return `Plan with the picture ribbon. Tell the story from beginning to end.${timeDirection}`;
}

export function tutorRevealPolicy(
  mode: StoryRibbonChallengeType,
  tier: SupportTier | null,
): string {
  if (tier === 'hard') {
    return mode === 'story_to_experience'
      ? 'Keep privacy choices available, but do not restore the hidden three-part connection frame through speech.'
      : 'Do not restore sequence labels, flow arrows, live order feedback, or extra step-by-step directions through speech.';
  }
  if (tier === 'medium') {
    return mode === 'story_to_experience'
      ? 'Keep the task concise and preserve privacy alternatives; do not supply a model connection before a verdict.'
      : 'You may refer to the visible position labels, but do not restore arrows, live order feedback, or hidden event meanings.';
  }
  return 'Use only the exact guided item cue and visible supports; never reveal hidden event meanings before a verdict.';
}
