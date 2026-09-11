import { describe, expect, it } from 'vitest';
import {
  itemCue as letterCue,
  withLetterSoundAction,
  type DiLetterSoundChallenge,
} from './diLetterSoundsScript';
import {
  itemCue as wordCue,
  withWordReadingAction,
  type DiWordReadingChallenge,
} from './diWordReadingScript';
import {
  itemCue as factCue,
  withMathFactsAction,
  type DiMathFactsChallenge,
} from './diMathFactsScript';
import {
  itemCue as shapeCue,
  withShapesAction,
  type DiShapesChallenge,
} from './diShapesScript';
import {
  itemCue as sentenceCue,
  withSentenceReadingAction,
  type DiSentenceReadingChallenge,
} from './diSentenceReadingScript';
import {
  diceRollGestureAction,
  itemCue as diceCue,
  studentPrompt,
  withDiceRollAction,
  type DiDiceRollChallenge,
} from './diDiceRollScript';

const letter: DiLetterSoundChallenge = {
  id: 'letter-m', challengeType: 'letter_sound', letter: 'm', spoken: 'mmm',
  keyword: 'moon', emoji: '🌙', elicitation: 'isolated',
};
const word: DiWordReadingChallenge = {
  id: 'word-sam', challengeType: 'cvc_reading', word: 'sam', wordType: 'cvc',
  graphemes: ['s', 'a', 'm'],
};
const fact: DiMathFactsChallenge = {
  id: 'fact-2-plus-1', challengeType: 'answer_fact', a: 2, b: 1,
  display: '2 + 1', problem: 'two plus one', answerWord: 'three',
  answerNumeral: 3, solvedDisplay: '2 + 1 = 3',
};
const shape: DiShapesChallenge = {
  id: 'shape-triangle', challengeType: 'name_shape', shape: 'triangle',
  shapeWord: 'triangle', article: 'a', sides: 3, corners: 3,
  rotationDeg: 0, asrAliases: ['triangle'],
};
const sentence: DiSentenceReadingChallenge = {
  id: 'sentence-hen', challengeType: 'read_sentence', text: 'The red hen ran.',
  wordCount: 4,
};
const dice: DiDiceRollChallenge = {
  id: 'dice-four', challengeType: 'count_pips', action: 'count_pips',
  answerKind: 'voice', responseClass: 'number_word_to_20', sides: 6, value: 4,
  spokenAnswer: 'four', asrAliases: ['four', '4'],
};

describe('legacy DI action-contract migration', () => {
  it.each([
    ['letter sounds', withLetterSoundAction(letter), letterCue(letter, true)],
    ['word reading', withWordReadingAction(word), wordCue(word, true)],
    ['math facts', withMathFactsAction(fact), factCue(fact, true)],
    ['shapes', withShapesAction(shape), shapeCue(shape, true)],
    ['sentence reading', withSentenceReadingAction(sentence), sentenceCue(sentence, true)],
  ])('%s exposes the exact spoken ask as its visible voice action', (_name, item, cue) => {
    expect(item.answerKind).toBe('voice');
    expect(item.actionContract.answerKind).toBe('voice');
    expect(item.actionContract.instruction.trim()).not.toBe('');
    expect(cue).toContain(item.actionContract.instruction);
  });

  it('dice exposes its hands step and voice step in the same code-owned story', () => {
    const roll = diceRollGestureAction(dice);
    const answer = withDiceRollAction(dice).actionContract;
    const prompt = studentPrompt(dice);
    const cue = diceCue(dice, { opening: true, howToPlay: true });

    expect(roll.answerKind).toBe('gesture');
    expect(answer.answerKind).toBe('voice');
    expect(prompt).toContain(roll.instruction);
    expect(prompt).toContain(answer.instruction);
    expect(cue).toContain(roll.instruction);
    expect(cue).toContain(answer.instruction);
  });
});
