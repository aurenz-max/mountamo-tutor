import { describe, expect, it } from 'vitest';
import {
  DI_SPOKEN_PRACTICE_CHALLENGE_TYPES,
  DI_SPOKEN_PRACTICE_EVAL_MODES,
  DI_SPOKEN_PRACTICE_TYPE_DOCS,
  HOW_TO_PLAY,
  MODE_SHAPE,
  diSpokenPracticeModePlan,
} from './diSpokenPracticeModes';

describe('DI Spoken Practice mode definitions', () => {
  it('projects an ordered catalog ladder, generator docs, and presentation facts', () => {
    expect(DI_SPOKEN_PRACTICE_EVAL_MODES.map((mode) => [mode.evalMode, mode.beta])).toEqual([
      ['count_and_say', 1.5],
      ['compare_choice', 2.0],
      ['read_aloud', 2.5],
      ['say_answer', 3.0],
      ['explain_concept', 4.0],
    ]);
    expect(Object.keys(DI_SPOKEN_PRACTICE_TYPE_DOCS)).toEqual(
      DI_SPOKEN_PRACTICE_CHALLENGE_TYPES,
    );
    expect(MODE_SHAPE.read_aloud).toEqual({
      stimulusKind: 'text', answerSource: 'decode', label: 'Read It Aloud',
    });
    expect(HOW_TO_PLAY.count_and_say).toContain('Count the pictures');
  });

  it.each([
    ['count_and_say', 'number_word_to_20'],
    ['compare_choice', 'closed_set_choice'],
    ['read_aloud', 'short_spoken_word'],
    ['say_answer', 'short_spoken_word'],
    ['explain_concept', 'concept_statement'],
  ] as const)('builds the %s voice action from the generated ask', (mode, responseClass) => {
    const ask = `Ask for ${mode}.`;
    const plan = diSpokenPracticeModePlan({ id: `item-${mode}`, mode, ask, responseClass });
    expect(plan.evalMode).toBe(mode);
    expect(plan.groupingKey).toBe(mode);
    expect(plan.responseClass).toBe(responseClass);
    expect(plan.steps).toHaveLength(1);
    expect(plan.answerStep.answerKind).toBe('voice');
    expect(plan.answerStep.actionContract).toMatchObject({ id: mode, instruction: ask });
  });
});

