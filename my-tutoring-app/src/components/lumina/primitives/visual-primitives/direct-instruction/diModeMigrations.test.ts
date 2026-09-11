import { describe, expect, it } from 'vitest';
import {
  DI_LETTER_SOUNDS_EVAL_MODES,
  DI_LETTER_SOUNDS_TYPE_DOCS,
  diLetterSoundModePlan,
} from './diLetterSoundsModes';
import {
  DI_MATH_FACTS_EVAL_MODES,
  DI_MATH_FACTS_TYPE_DOCS,
  diMathFactsModePlan,
} from './diMathFactsModes';
import {
  DI_SENTENCE_READING_EVAL_MODES,
  DI_SENTENCE_READING_TYPE_DOCS,
  diSentenceReadingModePlan,
} from './diSentenceReadingModes';
import {
  DI_SHAPES_EVAL_MODES,
  DI_SHAPES_TYPE_DOCS,
  diShapesModePlan,
} from './diShapesModes';
import {
  DI_WORD_PROBLEM_EVAL_MODES,
  DI_WORD_PROBLEM_TYPE_DOCS,
  HOW_TO_PLAY,
  STEPS_FOR_MODE,
  diWordProblemModePlan,
} from './diWordProblemModes';
import {
  DI_WORD_READING_EVAL_MODES,
  DI_WORD_READING_TYPE_DOCS,
  diWordReadingModePlan,
} from './diWordReadingModes';
import type { WordProblemPlan } from './diWordProblemPlan';

describe('migrated DI mode definitions', () => {
  it('project every shipped identity into catalog metadata and generator docs', () => {
    const projections = [
      [DI_LETTER_SOUNDS_EVAL_MODES, DI_LETTER_SOUNDS_TYPE_DOCS, 3],
      [DI_WORD_READING_EVAL_MODES, DI_WORD_READING_TYPE_DOCS, 4],
      [DI_MATH_FACTS_EVAL_MODES, DI_MATH_FACTS_TYPE_DOCS, 5],
      [DI_SHAPES_EVAL_MODES, DI_SHAPES_TYPE_DOCS, 5],
      [DI_SENTENCE_READING_EVAL_MODES, DI_SENTENCE_READING_TYPE_DOCS, 4],
      [DI_WORD_PROBLEM_EVAL_MODES, DI_WORD_PROBLEM_TYPE_DOCS, 3],
    ] as const;

    for (const [modes, docs, expectedCount] of projections) {
      expect(modes).toHaveLength(expectedCount);
      expect(Object.keys(docs)).toHaveLength(expectedCount);
      for (const mode of modes) {
        for (const challengeType of mode.challengeTypes) {
          expect(docs[challengeType]?.promptDoc).toBeTruthy();
        }
      }
    }
  });

  it('makes the visible instruction the same code-owned ask used by each spoken script', () => {
    expect(diLetterSoundModePlan({
      id: 'letter', challengeType: 'first_sound_in_word', keyword: 'moon', elicitation: 'isolated',
    }).answerStep.actionContract.instruction).toBe('Your turn. What is the first sound in moon?');
    expect(diWordReadingModePlan({ id: 'word', challengeType: 'cvc_reading' })
      .answerStep.actionContract.instruction).toBe('Your turn. What word?');
    expect(diMathFactsModePlan({
      id: 'fact', challengeType: 'answer_fact', problem: '2 plus 8', answerNumeral: 10,
    }).answerStep.actionContract.instruction).toBe('Your turn. What is 2 plus 8?');
    expect(diShapesModePlan({ id: 'shape', challengeType: 'count_corners' })
      .answerStep.actionContract.instruction).toBe('Your turn. How many corners does this shape have?');
    expect(diSentenceReadingModePlan({ id: 'sentence', challengeType: 'read_sentence' })
      .answerStep.actionContract.instruction).toBe('Your turn. Read it.');
  });

  it('defines the family builder as one complete gesture-to-voice step story', () => {
    const plan = { questionSpoken: 'How many marbles does Leo have now?' } as WordProblemPlan;
    const modePlan = diWordProblemModePlan({
      id: 'family-1', challengeType: 'build_family', plan, maxNumber: 20,
    });

    expect(STEPS_FOR_MODE.build_family).toEqual(['big_number', 'family', 'operation', 'solve']);
    expect(modePlan.steps.map((step) => step.key)).toEqual(STEPS_FOR_MODE.build_family);
    expect(modePlan.steps.map((step) => step.answerKind)).toEqual(['gesture', 'voice', 'voice', 'voice']);
    expect(modePlan.steps.map((step) => step.responseClass)).toEqual([
      'manipulation', 'equation_statement', 'closed_set_choice', 'number_word_to_20',
    ]);
    expect(modePlan.steps[0].actionContract.instruction)
      .toBe('Drag all three story-part cards into small plus small equals big.');
    expect(modePlan.answerStep.actionContract.instruction)
      .toBe('Solve it and say the answer aloud. How many marbles does Leo have now?');
    expect(HOW_TO_PLAY.build_family).toContain('First, listen');
    expect(HOW_TO_PLAY.build_family).toContain('Then read your number family');
  });
});
