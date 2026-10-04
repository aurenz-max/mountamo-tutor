import { expect, it } from 'vitest';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { pictureVocabSpokenMisses } from './pictureVocabularyWorkspace';
import type { PictureVocabItem } from './pictureVocabularyScript';
import { youAndMeSpokenMisses } from './youAndMeWorkspace';
import type { YouAndMeChallenge } from './YouAndMe';
import { genreSpokenMisses } from './genreExplorerWorkspace';
import type { GenreExplorerItem } from './genreExplorerScript';
import { sentenceSpokenMisses } from './sentenceAnalyzerWorkspace';
import type { SentenceAnalyzerItem } from './sentenceAnalyzerScript';
import { textStructureSpokenMisses } from './textStructureAnalyzerWorkspace';
import type { TextStructureItem } from './textStructureAnalyzerScript';
import { wordBuilderSpokenMisses } from './wordBuilderWorkspace';
import type { WordBuilderItem } from './wordBuilderScript';
import { wordSorterSpokenMisses } from './wordSorterWorkspace';
import type { WordSorterItem } from './wordSorterScript';

// The spoken literacy families' known wrong answers (handoff 20 Part B): ids in precedence order, and no example is
// an accepted answer.
const vocab = (kind: PictureVocabItem['kind'], answerKind: PictureVocabItem['answerKind'] = 'voice') =>
  ({ id: 'v', kind, word: 'clock', emoji: '', answerKind }) as PictureVocabItem;
const pair = (actor: number, speaker: number) => ({ id: 'y', type: 'describe_action', action: 'washed the apple', actor, speaker,
  participants: [{ name: 'Mia', emoji: '👧' }, { name: 'Leo', emoji: '👦' }] }) as unknown as YouAndMeChallenge;
const genre = (extra: Partial<GenreExplorerItem>) => ({ id: 'g', excerptOrdinal: 'the first one', predicate: 'teach a lesson', choices: [], ...extra }) as GenreExplorerItem;
const sentence = (extra: Partial<SentenceAnalyzerItem>) => ({ id: 's', sentence: 'Three brown dogs barked.', targetWord: 'dogs',
  wallLabels: ['Noun', 'Verb', 'Adjective', 'Pronoun'], ...extra }) as SentenceAnalyzerItem;
const structure = (extra: Partial<TextStructureItem>) => ({ id: 't', choices: [], stimulusText: '', ...extra }) as TextStructureItem;
const built = (word: string, parts: Array<[string, 'prefix' | 'root' | 'suffix']>) =>
  ({ id: word, word, parts: parts.map(([text, type]) => ({ text, type, meaning: '' })) }) as WordBuilderItem;
const sorted = (word: string, answer: string, choices: string[]) => ({ id: 'w', mode: 'binary_sort', word, answer, choices, relation: 'group' }) as unknown as WordSorterItem;

it.each([
  ['naming', pictureVocabSpokenMisses(vocab('naming')), ['category_word', 'other_thing'], ['clock']],
  ['receptive tap', pictureVocabSpokenMisses(vocab('receptive_match', 'gesture')), [], []],
  ['opposite', pictureVocabSpokenMisses({ ...vocab('opposite'), word: 'small', baseWord: 'big' }), ['said_base_word', 'not_opposite'], ['small', 'little']],
  ['scale', pictureVocabSpokenMisses({ ...vocab('gradable_scale'), word: 'warm', scaleWords: ['cool', 'warm', 'hot'], scaleTargetIndex: 1 }),
    ['given_rung', 'off_scale'], ['warm']],
  ['I turn', youAndMeSpokenMisses(pair(1, 1)), ['swapped_pronoun', 'said_name', 'said_he_she'], ['I washed the apple.']],
  ['you turn', youAndMeSpokenMisses(pair(1, 0)), ['swapped_pronoun', 'said_name', 'said_he_she'], ['You washed the apple.']],
  ['check yes', genreSpokenMisses(genre({ action: 'check-feature', answer: 'yes' })), ['opposite_verdict', 'said_feature_back'], ['yes', 'yeah', 'it does']],
  ['pick', genreSpokenMisses(genre({ action: 'pick-excerpt', answer: 'the first one', choices: ['the first one', 'the second one'] })),
    ['other_text', 'said_both'], ['the first one', 'first']],
  ['genre with sibling', genreSpokenMisses(genre({ action: 'name-genre', answer: 'Myth', choices: ['Myth', 'Informational', 'Fable', 'Legend'] })),
    ['close_relative', 'other_genre'], ['Myth', 'a myth story']],
  ['genre binary', genreSpokenMisses(genre({ action: 'name-genre', answer: 'Poem', choices: ['Poem', 'Informational'] })), ['other_genre'], ['Poem']],
  ['pos', sentenceSpokenMisses(sentence({ action: 'name-pos', answer: 'Noun' })), ['confusable_label', 'other_label'], ['Noun', 'naming word']],
  ['role', sentenceSpokenMisses(sentence({ action: 'name-role', answer: 'Subject', wallLabels: ['Subject', 'Predicate'] })),
    ['part_of_speech', 'other_label'], ['Subject']],
  ['side', sentenceSpokenMisses(sentence({ action: 'name-side', answer: 'Subject' })), ['other_side'], ['subject']],
  ['signal', textStructureSpokenMisses(structure({ action: 'find-signal', answer: 'so', stimulusText: 'Rain fell, so the river rose.' })),
    ['content_word'], ['so']],
  ['structure', textStructureSpokenMisses(structure({ action: 'name-structure', answer: 'Time Order', choices: ['Time Order', 'Description'] })),
    ['other_structure'], ['Time Order']],
  ['place', textStructureSpokenMisses(structure({ action: 'place-idea', answer: 'Cause', choices: ['Cause', 'Effect'], stimulusText: 'Rain fell.' })),
    ['other_part', 'said_idea_back'], ['Cause']],
  ['three parts', wordBuilderSpokenMisses(built('unhelpful', [['un', 'prefix'], ['help', 'root'], ['ful', 'suffix']])),
    ['root_only', 'other_part_only', 'part_missing', 'parts_not_joined', 'parts_out_of_order', 'meaning_word'], ['unhelpful']],
  ['two parts', wordBuilderSpokenMisses(built('teacher', [['teach', 'root'], ['er', 'suffix']])),
    ['root_only', 'other_part_only', 'parts_not_joined', 'parts_out_of_order', 'meaning_word'], ['teacher']],
  ['swapped part (board)', wordBuilderSpokenMisses(built('teacher', [['teach', 'root'], ['er', 'suffix']]),
    [{ text: 'help', type: 'root' }, { text: 'ful', type: 'suffix' }]),
    ['root_only', 'other_part_only', 'parts_not_joined', 'parts_out_of_order', 'swapped_part', 'meaning_word'], ['teacher']],
  ['sort', wordSorterSpokenMisses(sorted('pig', 'Animals', ['Animals', 'Food'])), ['other_group', 'said_word_back'], ['Animals']],
  // "cat" said back sounds like the group "Cats".
  ['sort echo of the key', wordSorterSpokenMisses(sorted('cat', 'Cats', ['Cats', 'Dogs', 'Food'])), ['other_group'], ['Cats']],
] as const)('%s: spoken misses', (_name, misses: KnownMiss[], ids, accepted) => {
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});
