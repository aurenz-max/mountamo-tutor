/**
 * The literacy families' spoken miss lists (handoff 20 Part B): each item's ids in precedence order, and no listed
 * example is an answer the item accepts.
 */
import { describe, expect, it } from 'vitest';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { cvcSpokenMisses } from './cvcSpellerWorkspace';
import { letterSpotterSpokenMisses } from './letterSpotterWorkspace';
import { blendSpokenMisses } from './phonicsBlenderWorkspace';
import { phonemeSpokenMisses } from './phonemeExplorerWorkspace';
import { rhymeSpokenMisses } from './rhymeStudioWorkspace';
import { swapSpokenMisses } from './soundSwapWorkspace';
import { syllableSpokenMisses } from './syllableClapperWorkspace';
import { flipSpokenMisses } from './wordFlipWorkspace';
import { wordWorkoutSpokenMisses } from './wordWorkoutWorkspace';
import { decodableSpokenMisses } from './decodableReaderWorkspace';
import { interactiveBookSpokenMisses } from './interactiveBookWorkspace';
import { readAloudSpokenMisses } from './readAloudStudioWorkspace';

const as = <T>(v: unknown) => v as T;
type Case = [string, () => KnownMiss[], string[], string[]];

const CASES: Case[] = [
  ['cvc fill_vowel cat', () => cvcSpokenMisses(as({ id: 'c', taskType: 'fill-vowel', targetWord: 'cat', targetLetters: ['c', 'a', 't'] })),
    ['whole_word', 'letter_name', 'first_sound', 'last_sound', 'other_vowel'], ['aaa', 'ah']],
  ['cvc fill_vowel dog: short a is no example', () => cvcSpokenMisses(as({ id: 'c', taskType: 'fill-vowel', targetWord: 'dog', targetLetters: ['d', 'o', 'g'] })),
    ['whole_word', 'letter_name', 'first_sound', 'last_sound', 'other_vowel'], ['ooo', 'aw', 'ah']],
  ['cvc spell_word', () => cvcSpokenMisses(as({ id: 'c', taskType: 'spell-word', targetWord: 'cat' })), [], []],
  ['letter-spotter name_it sun', () => letterSpotterSpokenMisses(as({ id: 'l', mode: 'name-it', targetLetter: 's', targetWord: 'sun' })),
    ['said_the_word', 'later_letter', 'letter_not_in_word'], ['S', 's', 'ess', 'sss']],
  ['letter-spotter find_it', () => letterSpotterSpokenMisses(as({ id: 'l', mode: 'find-it', targetLetter: 's' })), [], []],
  ['phonics-blender cat', () => blendSpokenMisses({ id: 'w', targetWord: 'cat', phonemes: ['c', 'a', 't'].map(l => ({ id: l, sound: `/${l}/`, letters: l })) }),
    ['letter_name', 'sounds_no_word', 'first_sound_changed', 'middle_sound_changed', 'last_sound_changed'], ['cat']],
  ['phonics-blender top reads backwards', () => blendSpokenMisses({ id: 'w', targetWord: 'top', phonemes: ['t', 'o', 'p'].map(l => ({ id: l, sound: `/${l}/`, letters: l })) }),
    ['letter_name', 'sounds_no_word', 'read_backwards', 'first_sound_changed', 'middle_sound_changed', 'last_sound_changed'], ['top']],
  ['phoneme-explorer blend', () => phonemeSpokenMisses(as({ id: 'p', kind: 'blend', answer: 'dog', phonemeSequence: ['d', 'o', 'g'] })),
    ['sounds_no_word', 'near_word'], ['dog']],
  ['phoneme-explorer isolate', () => phonemeSpokenMisses(as({ id: 'p', kind: 'isolate', answer: 'Cup', phoneme: 'C', phonemeSound: 'kuh',
    exampleWord: 'Cat', voiceExample: true, menu: [{ word: 'Cup' }, { word: 'Sun' }] })), ['echo_stimulus', 'letter_name'], ['cup']],
  ['phoneme-explorer isolate, example withheld', () => phonemeSpokenMisses(as({ id: 'p', kind: 'isolate', answer: 'Cup', phoneme: 'C',
    exampleWord: 'Cat', voiceExample: false, menu: [{ word: 'Cup' }] })), ['letter_name'], ['cup']],
  ['rhyme recognition, rhymes', () => rhymeSpokenMisses(as({ id: 'r', mode: 'recognition', targetWord: 'cat', comparisonWord: 'hat', doesRhyme: true, choices: [] })),
    ['no_to_rhyme'], ['yes']],
  ['rhyme recognition, same start', () => rhymeSpokenMisses(as({ id: 'r', mode: 'recognition', targetWord: 'cat', comparisonWord: 'cup', doesRhyme: false, choices: [] })),
    ['yes_same_start'], ['no']],
  ['rhyme recognition, unrelated', () => rhymeSpokenMisses(as({ id: 'r', mode: 'recognition', targetWord: 'dog', comparisonWord: 'pig', doesRhyme: false, choices: [] })),
    ['yes_no_rhyme'], ['no']],
  ['rhyme identification with an onset foil', () => rhymeSpokenMisses(as({ id: 'r', mode: 'identification', targetWord: 'cat', answer: 'hat',
    choices: [{ word: 'hat' }, { word: 'can' }] })), ['onset_foil', 'echo_target', 'off_menu'], ['hat']],
  ['rhyme identification, plain foil', () => rhymeSpokenMisses(as({ id: 'r', mode: 'identification', targetWord: 'dog', answer: 'log',
    choices: [{ word: 'log' }, { word: 'sun' }] })), ['echo_target', 'off_menu'], ['log']],
  ['sound-swap addition', () => swapSpokenMisses(as({ id: 's', operation: 'addition', originalWord: 'at', resultWord: 'cat', addPhoneme: '/k/', addPosition: 'beginning' })),
    ['sounds_no_word', 'echo_start', 'other_position', 'nonword'], ['cat']],
  ['sound-swap deletion', () => swapSpokenMisses(as({ id: 's', operation: 'deletion', originalWord: 'cat', resultWord: 'at' })),
    ['sounds_no_word', 'echo_start', 'nonword'], ['at']],
  ['syllable blend', () => syllableSpokenMisses(as({ id: 'y', task: 'blend_syllables', word: 'zebra', parts: ['ze', 'bra'], partCount: 2 })),
    ['parts_back'], ['zebra']],
  ['syllable count, one-part cvc', () => syllableSpokenMisses(as({ id: 'y', task: 'count_parts', word: 'cat', parts: ['cat'], partCount: 1 })),
    ['word_for_count', 'counted_sounds', 'count_one_over'], ['one', '1']],
  ['syllable count, rabbit', () => syllableSpokenMisses(as({ id: 'y', task: 'count_parts', word: 'rabbit', parts: ['rab', 'bit'], partCount: 2 })),
    ['word_for_count', 'count_one_over'], ['two', '2']],
  ['word-flip plural_s', () => flipSpokenMisses(as({ id: 'f', type: 'plural_s', sourceWord: 'car', answer: 'cars', count: 2 })),
    ['unchanged', 'double_ending'], ['cars', 'two cars']],
  ['word-flip past_irregular', () => flipSpokenMisses(as({ id: 'f', type: 'past_irregular', sourceWord: 'run', answer: 'ran' })),
    ['regularized', 'unchanged'], ['ran']],
  ['word-workout real_vs_nonsense', () => wordWorkoutSpokenMisses(as({ id: 'w', kind: 'real_word', realWord: 'cat', nonsenseWord: 'zat' })),
    ['said_nonword'], ['cat']],
  ['word-workout chain word (not yet listed)', () => wordWorkoutSpokenMisses(as({ id: 'w', kind: 'chain_word' })), [], []],
  ['decodable read line', () => decodableSpokenMisses(as({ id: 'd', kind: 'read_line', text: 'Pat is a cat with a hat.' })),
    ['word_skip', 'word_swap'], ['Pat is a cat with a hat.']],
  ['decodable one-word answer', () => decodableSpokenMisses(as({ id: 'd', kind: 'answer_spoken', answerWord: 'mat', question: 'What did the cat sit on?',
    storyContentWords: ['pat', 'cat', 'hat', 'mat'], storyText: 'The fat cat sat on a mat. Pat had a hat.' })), ['retell', 'lifted_word'], ['mat', 'the mat']],
  ['decodable choice', () => decodableSpokenMisses(as({ id: 'd', kind: 'answer_choice' })), [], []],
  ['interactive-book read-focus-word', () => interactiveBookSpokenMisses(as({ id: 'b', mode: 'read-focus-word', targetText: 'barn', readLead: 'The tall red' })),
    ['said_lead_in', 'context_guess'], ['barn', 'the barn']],
  ['read-aloud accuracy', () => readAloudSpokenMisses(as({ id: 'a', kind: 'accuracy', text: 'Green frogs sit still upon large lily pads.' })),
    ['word_drop', 'word_swap'], ['Green frogs sit still upon large lily pads.']],
  ['read-aloud dialogue', () => readAloudSpokenMisses(as({ id: 'a', kind: 'dialogue', text: 'We will help him find his home.' })),
    ['word_drop', 'word_swap', 'paraphrase'], ['We will help him find his home.']],
  ['read-aloud phrase marking', () => readAloudSpokenMisses(as({ id: 'a', kind: 'expression', step: 'mark', text: 'A line.' })), [], []],
];

describe('literacy spoken misses', () => {
  it.each(CASES)('%s', (_name, misses, ids, correct) => {
    const list = misses();
    expect(list.map(m => m.id)).toEqual(ids);
    const said = new Set(correct.map(c => c.toLowerCase()));
    for (const m of list) for (const e of m.examples ?? []) expect(said.has(e.toLowerCase()), `${m.id} example "${e}"`).toBe(false);
  });
});
