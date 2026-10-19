/**
 * sentenceAnalyzerDomain: the build gates, the ask and the key, pinned. Pure, no jsdom.
 *
 *  1. Every action is SPOKEN and takes the benched `short_spoken_word`: a part of speech is a NAME, one target.
 *  2. ⭐ THE SUBJECT/PREDICATE KEY. The boundary is an explicit field, "The" and "clever" answer "Subject", and a
 *     sentence that cannot state its boundary DROPS its side asks rather than guessing one.
 *  3. ⭐ THE WALL IS GRADE-SCOPED, NEVER SESSION-SCOPED; off-wall labels drop; `Conjunction`/`Determiner` are not roles.
 *  4. One challenge becomes N judged items, capped and SELECTED (spread across labels); one ask per DISTINCT kind.
 *  5. Grammar-term sentences DROP, and no ask says an accepted answer (the side ask is a menu key and says both).
 *  6. The read-aloud fires at the band floor only, once per sentence; the spoken word sheds its punctuation.
 *  7. The key: the label first, its classroom name accepted, the confusable label and (on a job) a part of speech wrong.
 */
import { describe, it, expect } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import {
  ALL_ROLES,
  ALL_SENTENCE_TYPES,
  CONFUSABLE_WITH,
  MAX_ITEMS,
  MAX_LABEL_ALL_WORDS,
  MAX_SENTENCES,
  MAX_TARGETS_PER_SENTENCE,
  answerKindFor,
  askFor,
  canonicalPos,
  canonicalRole,
  canonicalSentenceType,
  gradeNumberOf,
  isBandFloor,
  isReadableAloud,
  itemsFromPayload,
  namesAGrammarTerm,
  posWallFor,
  questionFor,
  responseClassFor,
  roleWallFor,
  sentenceAnalyzerHarnessAnswers,
  sentenceKey,
  sentenceScene,
  speakableWord,
  speechSafe,
  type SentenceAnalyzerPayloadLike,
} from './sentenceAnalyzerDomain';

// ---------------------------------------------------------------------------
// Fixtures — "The clever fox jumped quickly." is the canonical sentence, because
// it is the one whose click-era key was wrong: "The" (Determiner) and "clever"
// (Modifier) both belong to the complete subject and were both keyed predicate.
// ---------------------------------------------------------------------------

const FOX_WORDS = [
  { id: 'w0', text: 'The', partOfSpeech: 'Determiner', grammaticalRole: 'Modifier' },
  { id: 'w1', text: 'clever', partOfSpeech: 'Adjective', grammaticalRole: 'Modifier' },
  { id: 'w2', text: 'fox', partOfSpeech: 'Noun', grammaticalRole: 'Subject' },
  { id: 'w3', text: 'jumped', partOfSpeech: 'Verb', grammaticalRole: 'Predicate' },
  { id: 'w4', text: 'quickly.', partOfSpeech: 'Adverb', grammaticalRole: 'Modifier' },
];

const BIRD_WORDS = [
  { id: 'w0', text: 'A', partOfSpeech: 'Determiner', grammaticalRole: 'Modifier' },
  { id: 'w1', text: 'small', partOfSpeech: 'Adjective', grammaticalRole: 'Modifier' },
  { id: 'w2', text: 'bird', partOfSpeech: 'Noun', grammaticalRole: 'Subject' },
  { id: 'w3', text: 'sang', partOfSpeech: 'Verb', grammaticalRole: 'Predicate' },
  { id: 'w4', text: 'sweetly.', partOfSpeech: 'Adverb', grammaticalRole: 'Modifier' },
];

const payload = (over: Partial<SentenceAnalyzerPayloadLike> = {}): SentenceAnalyzerPayloadLike => ({
  gradeLevel: '4',
  challenges: [
    { id: 'ch1', type: 'identify_pos', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS },
    { id: 'ch2', type: 'identify_pos', sentence: 'A small bird sang sweetly.', words: BIRD_WORDS },
  ],
  ...over,
});

const build = (over: Partial<SentenceAnalyzerPayloadLike> = {}) => itemsFromPayload(payload(over));

const labelAll = (over: Partial<SentenceAnalyzerPayloadLike> = {}) => itemsFromPayload({
  gradeLevel: '4',
  challenges: [
    { id: 'ch1', type: 'label_all', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS },
  ],
  ...over,
});

const parse = (over: Partial<SentenceAnalyzerPayloadLike> = {}) => itemsFromPayload({
  gradeLevel: '5',
  challenges: [
    {
      id: 'ch1',
      type: 'parse_structure',
      sentence: 'The clever fox jumped quickly.',
      words: FOX_WORDS,
      sentenceType: 'Declarative',
      subjectEndIndex: 2,
    },
  ],
  ...over,
});

// ---------------------------------------------------------------------------

describe('the answer-material fork', () => {
  /**
   * The roster priced all four modes `closed_set_choice` off this primitive's own
   * former description ("from multiple choice options"). A part of speech is a
   * NAME — one word, one target — which is the BENCHED class.
   */
  it('is ALL VOICE, on the benched short_spoken_word, in every action', () => {
    for (const action of ['name-pos', 'name-role', 'name-side', 'name-type'] as const) {
      expect(answerKindFor(action)).toBe('voice');
      expect(responseClassFor(action)).toBe('short_spoken_word');
    }
  });

  it('never builds a gesture item, in any mode', () => {
    const everything = [...build().items, ...labelAll().items, ...parse().items];
    expect(everything.length).toBeGreaterThan(0);
    expect(everything.every((i) => i.answerKind === 'voice')).toBe(true);
    expect(everything.every((i) => i.responseClass === 'short_spoken_word')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('⭐ the subject/predicate key the click era got wrong', () => {
  /**
   * `role.includes('subject') ? 'subject' : 'predicate'` keyed "The" (role
   * Determiner) and "clever" (role Modifier) to the PREDICATE. They are the
   * complete subject. Under a button that marked correct children wrong in
   * silence; under a judged loop the tutor refuses them out loud.
   */
  it('puts determiners and subject-side modifiers in the SUBJECT', () => {
    const sides = parse().items.filter((i) => i.action === 'name-side');
    // Whichever words the alternator kept, no subject-side word may be keyed to
    // the predicate — "The" and "clever" are the two the click era got wrong.
    for (const side of sides) {
      if (['The', 'clever', 'fox'].includes(side.targetWord)) expect(side.answer).toBe('Subject');
      if (['jumped', 'quickly.'].includes(side.targetWord)) expect(side.answer).toBe('Predicate');
    }
    expect(sides.length).toBeGreaterThanOrEqual(2);
  });

  it('drops the side asks when the boundary cannot be stated, keeping the kind ask', () => {
    // An imperative has no subject word at all, so the generator omits the field.
    const { items } = parse({
      challenges: [{
        id: 'ch1',
        type: 'parse_structure',
        sentence: 'Close the door.',
        words: [
          { id: 'w0', text: 'Close', partOfSpeech: 'Verb', grammaticalRole: 'Predicate' },
          { id: 'w1', text: 'the', partOfSpeech: 'Determiner', grammaticalRole: 'Modifier' },
          { id: 'w2', text: 'door.', partOfSpeech: 'Noun', grammaticalRole: 'Direct Object' },
        ],
        sentenceType: 'Imperative',
      }],
    });
    expect(items.some((i) => i.action === 'name-side')).toBe(false);
    expect(items.filter((i) => i.action === 'name-type')).toHaveLength(1);
  });

  it('refuses an out-of-range boundary rather than clamping it', () => {
    const { items } = parse({
      challenges: [{
        id: 'ch1',
        type: 'parse_structure',
        sentence: 'The clever fox jumped quickly.',
        words: FOX_WORDS,
        sentenceType: 'Declarative',
        // The last word cannot end the subject — the predicate would be empty.
        subjectEndIndex: 4,
      }],
    });
    expect(items.some((i) => i.action === 'name-side')).toBe(false);
  });

  it('alternates the sides so "Predicate" cannot answer them all', () => {
    const sides = parse().items.filter((i) => i.action === 'name-side');
    expect(new Set(sides.map((i) => i.answer)).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------

describe('⭐ the word wall is GRADE-scoped, never session-scoped', () => {
  /**
   * The click era's bank was `new Set(words.map(w => w.partOfSpeech))` — it
   * printed exactly the labels the sentence used, so it could be counted against
   * the words. Defect class 3 in a different surface.
   */
  it('prints labels the sentence does not use', () => {
    const { wall, sentences } = labelAll();
    const used = new Set(sentences[0].words.map((w) => w.pos).filter(Boolean));
    expect(wall.length).toBeGreaterThan(used.size);
    expect(wall).toEqual(posWallFor(4));
  });

  it('is identical on every item of a session', () => {
    const { items } = labelAll();
    const walls = new Set(items.map((i) => i.wallLabels.join('|')));
    expect(walls.size).toBe(1);
  });

  it('grows with the grade and never shrinks', () => {
    for (let g = 3; g <= 8; g++) {
      expect(posWallFor(g).length).toBeGreaterThanOrEqual(posWallFor(g - 1).length);
      expect(roleWallFor(g).length).toBeGreaterThanOrEqual(roleWallFor(g - 1).length);
    }
    expect(posWallFor(2)).not.toContain('Interjection');
    expect(posWallFor(8)).toContain('Interjection');
  });

  it('drops a word whose label is off the grade wall', () => {
    const { items } = itemsFromPayload({
      gradeLevel: '2',
      challenges: [{
        id: 'ch1',
        type: 'identify_pos',
        sentence: 'Wow the cat ran fast.',
        words: [
          { id: 'w0', text: 'Wow', partOfSpeech: 'Interjection', grammaticalRole: 'Modifier' },
          { id: 'w1', text: 'the', partOfSpeech: 'Determiner', grammaticalRole: 'Modifier' },
          { id: 'w2', text: 'cat', partOfSpeech: 'Noun', grammaticalRole: 'Subject' },
          { id: 'w3', text: 'ran', partOfSpeech: 'Verb', grammaticalRole: 'Predicate' },
        ],
      }],
    });
    // Interjection is not in scope at grade 2.
    expect(items.some((i) => i.answer === 'Interjection')).toBe(false);
    expect(items.length).toBeGreaterThan(0);
  });

  it('builds NOTHING rather than a role mode with no role vocabulary', () => {
    const { items } = itemsFromPayload({
      gradeLevel: '2',
      challenges: [{
        id: 'ch1', type: 'identify_role', sentence: 'The cat ran fast.', words: FOX_WORDS,
      }],
    });
    // Degrading a mode silently is worse than delivering nothing.
    expect(items).toHaveLength(0);
  });

  it('leaves Conjunction and Determiner out of the ROLE vocabulary', () => {
    expect(ALL_ROLES).not.toContain('Conjunction' as never);
    expect(ALL_ROLES).not.toContain('Determiner' as never);
    expect(canonicalRole('Determiner')).toBeNull();
    expect(canonicalRole('Conjunction')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('defect class 1 — one challenge is not one item', () => {
  it('expands label_all into one judged ask per word, capped', () => {
    const { items } = labelAll();
    expect(items.length).toBeGreaterThan(1);
    expect(items.length).toBeLessThanOrEqual(MAX_LABEL_ALL_WORDS);
    expect(new Set(items.map((i) => i.targetIndex)).size).toBe(items.length);
  });

  it('SELECTS a spread of labels rather than slicing the first N', () => {
    const { items } = labelAll();
    // A blind slice of "The clever fox jumped" would keep 4 distinct labels here
    // anyway; the pin that matters is that no label is asked twice while an
    // unasked one is available.
    const answers = items.map((i) => i.answer);
    expect(new Set(answers).size).toBe(answers.length);
  });

  it('asks two DIFFERENT labels per sentence in identify_pos', () => {
    const { items } = build();
    const first = items.filter((i) => i.sentenceIndex === 0);
    expect(first.length).toBe(MAX_TARGETS_PER_SENTENCE);
    expect(first[0].answer).not.toBe(first[1].answer);
  });

  it('caps the sitting', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `ch${i}`, type: 'label_all', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS,
    }));
    const { items, sentences } = itemsFromPayload({ gradeLevel: '4', challenges: many });
    expect(sentences.length).toBeLessThanOrEqual(MAX_SENTENCES);
    expect(items.length).toBeLessThanOrEqual(MAX_ITEMS);
  });
});

// ---------------------------------------------------------------------------

describe('defect class 2 — an answer is asked once per session', () => {
  it('asks ONE sentence-kind question per DISTINCT kind', () => {
    const { items } = itemsFromPayload({
      gradeLevel: '5',
      challenges: [
        {
          id: 'ch1', type: 'parse_structure', sentence: 'The clever fox jumped quickly.',
          words: FOX_WORDS, sentenceType: 'Declarative', subjectEndIndex: 2,
        },
        {
          id: 'ch2', type: 'parse_structure', sentence: 'A small bird sang sweetly.',
          words: BIRD_WORDS, sentenceType: 'Declarative', subjectEndIndex: 2,
        },
      ],
    });
    // After the tutor affirms "Declarative" once, saying it again wins the second
    // ask with no reading at all.
    expect(items.filter((i) => i.action === 'name-type')).toHaveLength(1);
  });

  it('keeps a second kind when the payload has one', () => {
    const { items } = itemsFromPayload({
      gradeLevel: '5',
      challenges: [
        {
          id: 'ch1', type: 'parse_structure', sentence: 'The clever fox jumped quickly.',
          words: FOX_WORDS, sentenceType: 'Declarative', subjectEndIndex: 2,
        },
        {
          id: 'ch2', type: 'parse_structure', sentence: 'A small bird sang sweetly.',
          words: BIRD_WORDS, sentenceType: 'Exclamatory', subjectEndIndex: 2,
        },
      ],
    });
    expect(items.filter((i) => i.action === 'name-type')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

describe('the leak gates', () => {
  it('drops a sentence containing any grammar word', () => {
    expect(namesAGrammarTerm('The verb ran quickly.')).toBe(true);
    expect(namesAGrammarTerm('She is the subject of the painting.')).toBe(true);
    expect(namesAGrammarTerm('Nouns are everywhere.')).toBe(true);
    expect(namesAGrammarTerm('The clever fox jumped quickly.')).toBe(false);

    const { items } = build({
      challenges: [{
        id: 'ch1', type: 'identify_pos', sentence: 'The verb ran quickly.', words: FOX_WORDS,
      }],
    });
    expect(items).toHaveLength(0);
  });

  it('drops a sentence that opens with a verdict sentinel', () => {
    const { items } = build({
      challenges: [{
        id: 'ch1', type: 'identify_pos', sentence: 'Yes the fox jumped quickly.', words: FOX_WORDS,
      }],
    });
    expect(items).toHaveLength(0);
  });

  it('never says an accepted answer inside the ask; the side ask says both sides (a menu key)', () => {
    const everything = [...build().items, ...labelAll().items, ...parse().items];
    for (const item of everything) expect(askLeaks(askFor(item), sentenceKey(item)), item.id).toEqual([]);
  });

  it('never prints a label on screen before it is earned — the ask names only the WORD', () => {
    for (const item of build().items) {
      expect(questionFor(item)).toContain(speakableWord(item.targetWord));
      expect(questionFor(item).toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------

describe('⭐ how the line SOUNDS (found by the judged drive, not by a gate)', () => {
  /**
   * The generator attaches sentence punctuation to the word it belongs to
   * ("melts.") so the PRINTED sentence is right. The ask interpolated it verbatim
   * and the drive transcript read back *"What part of speech is the word
   * melts.?"* — a full stop against a question mark, mid-question. Every string
   * gate in the family passed it, because none of them is about prosody.
   */
  it('strips attached punctuation from the SPOKEN word', () => {
    expect(speakableWord('melts.')).toBe('melts');
    expect(speakableWord('go!')).toBe('go');
    expect(speakableWord('fox')).toBe('fox');
    // An internal apostrophe is part of the word, not punctuation to shed.
    expect(speakableWord("dog's")).toBe("dog's");
  });

  it('never lets two sentence marks meet in an ask', () => {
    const everything = [...build().items, ...labelAll().items, ...parse().items];
    for (const item of everything) {
      expect(questionFor(item)).not.toMatch(/[.,!?;:][?.!]/);
      expect(askFor(item)).not.toMatch(/[.,!?;:][?.!]/);
    }
  });

  it('still PRINTS the punctuation — only the spoken form sheds it', () => {
    const { sentences } = labelAll();
    expect(sentences[0].words.some((w) => /[.!?]$/.test(w.text))).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('the read-aloud', () => {
  it('fires at the band floor only, once per sentence', () => {
    const floor = itemsFromPayload({
      gradeLevel: '2',
      challenges: [{ id: 'ch1', type: 'label_all', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS }],
    }).items;
    expect(floor[0].readAloud).toContain('The clever fox jumped quickly.');
    expect(floor.slice(1).every((i) => i.readAloud === '')).toBe(true);

    expect(build().items.every((i) => i.readAloud === '')).toBe(true);
  });

  it('is tolerant of the grade wrapper but not of prose', () => {
    expect(isBandFloor('2')).toBe(true);
    expect(isBandFloor('Grade 2')).toBe(true);
    expect(isBandFloor('2nd grade')).toBe(true);
    expect(isBandFloor('4')).toBe(false);
    expect(gradeNumberOf(undefined)).toBe(4);
    expect(gradeNumberOf('K')).toBe(2);
  });

  it('drops a band-floor sentence nobody can read aloud in one breath', () => {
    const long = `${'word '.repeat(20)}end.`;
    expect(isReadableAloud(long)).toBe(false);
    const { items } = itemsFromPayload({
      gradeLevel: '2',
      challenges: [{ id: 'ch1', type: 'identify_pos', sentence: long, words: FOX_WORDS }],
    });
    expect(items).toHaveLength(0);
  });

  it('keeps the sentence-final mark, which is the whole evidence for Interrogative', () => {
    expect(speechSafe('Where did the fox go?')).toBe('Where did the fox go?');
    expect(speechSafe('He said "run" loudly.')).toBe('He said run loudly.');
  });
});

// ---------------------------------------------------------------------------

describe('the canonical vocabulary', () => {
  it('normalises what a model actually writes', () => {
    expect(canonicalPos('nouns')).toBe('Noun');
    expect(canonicalPos('Article')).toBe('Determiner');
    expect(canonicalPos('Proper Noun')).toBe('Noun');
    expect(canonicalPos('gerund')).toBeNull();
    expect(canonicalRole('complete subject')).toBe('Subject');
    expect(canonicalSentenceType('question')).toBe('Interrogative');
    expect(canonicalSentenceType('rhetorical')).toBeNull();
  });

  it('keeps the sentence-type set closed at four', () => {
    expect(ALL_SENTENCE_TYPES).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

describe('the key', () => {
  it('starts with the label and accepts the classroom name where one is unambiguous', () => {
    const verb = labelAll().items.find((i) => i.answer === 'Verb')!;
    expect(spokenKeyText(sentenceKey(verb)).startsWith('"Verb"')).toBe(true);
    expect(sentenceKey(verb).alsoAccept).toContain('action word');
    // "describing word" fits BOTH adjective and adverb, so it is under neither.
    const adjective = labelAll().items.find((i) => i.answer === 'Adjective')!;
    expect(sentenceKey(adjective).alsoAccept).not.toContain('describing word');
  });

  it('names the confusable label on the wall as wrong', () => {
    const adjective = labelAll().items.find((i) => i.answer === 'Adjective')!;
    expect(sentenceKey(adjective).signatureError).toContain('"Adverb" is a different answer and wrong here');
    expect(CONFUSABLE_WITH.Noun).toContain('Pronoun');
  });

  it('refuses a part of speech where a JOB was asked for', () => {
    const role = itemsFromPayload({
      gradeLevel: '5',
      challenges: [{ id: 'ch1', type: 'identify_role', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS }],
    }).items[0];
    expect(sentenceKey(role).signatureError).toMatch(/part of speech .* is wrong/);
  });

  it('is a menu key on the side ask, keyed by the code, and the other side is wrong', () => {
    const side = parse().items.find((i) => i.action === 'name-side')!;
    const key = sentenceKey(side);
    expect(key.menu).toEqual(['subject', 'predicate']);
    expect(key.answer).toBe(side.answer.toLowerCase());
    expect(key.signatureError).toContain('belong to the complete subject');
  });

  it('stamps each item with the eval mode of its sentence', () => {
    expect(build().items.every((i) => i.mode === 'identify_pos')).toBe(true);
    expect(labelAll().items.every((i) => i.mode === 'label_all')).toBe(true);
    expect(parse().items.every((i) => i.mode === 'parse_structure')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('the scene', () => {
  it('prints the sentence, the highlighted word and the wall, and no label', () => {
    for (const item of build().items) {
      const { facts } = sentenceScene(item);
      expect(facts.sentence).toBe(item.sentence);
      expect(facts.highlighted).toContain(speakableWord(item.targetWord));
      expect(facts).not.toHaveProperty('support');
      expect(facts).not.toHaveProperty('onScreen');
    }
  });
});

// ---------------------------------------------------------------------------

describe('harness answers', () => {
  it('gives every item a correct answer and a different plain wrong', () => {
    for (const item of [...build().items, ...labelAll().items, ...parse().items]) {
      const answers = sentenceAnalyzerHarnessAnswers(item);
      expect(answers.correct).toBeTruthy();
      expect(answers.plainWrong.toLowerCase()).not.toBe(answers.correct.toLowerCase());
    }
  });
});
