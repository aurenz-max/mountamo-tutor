/**
 * sentenceAnalyzerScript — the pedagogy lives there, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (`checkPackGates` =
 *     validateJudgedScriptPack + the performed-stage-direction scan + the
 *     byte-identical-consecutive-ask gate), on a fixture AND on the real session
 *     shape — four `name-pos` items back to back over one sentence, which is the
 *     only shape the repeat-ask gate can fire on and is exactly what `label_all`
 *     runs.
 *  2. THE FORK, both directions: all four actions are SPOKEN and take the BENCHED
 *     `short_spoken_word`, NOT the roster's `closed_set_choice`. The regression
 *     this locks out is an action drifting back to a tap — every tap in this
 *     primitive was a costume, and `answerKind: 'gesture'` anywhere here would
 *     mean the fork was re-decided.
 *  3. ⭐ THE SUBJECT/PREDICATE KEY. The click era's
 *     `role.includes('subject') ? 'subject' : 'predicate'` put determiners and
 *     subject-side modifiers in the PREDICATE; the boundary is now an explicit
 *     field, "The" and "clever" answer "Subject", and a sentence that cannot
 *     state its boundary DROPS its side asks rather than guessing one.
 *  4. ⭐ THE WALL IS GRADE-SCOPED, NEVER SESSION-SCOPED — the click era's
 *     `label_all` chip bank printed exactly the labels the sentence used, which
 *     is defect class 3 with a different surface.
 *  5. ⭐ DEFECT CLASS 1: one click-era challenge becomes N judged items, capped
 *     and SELECTED (spread across labels) rather than sliced.
 *  6. ⭐ DEFECT CLASS 2 in genre-explorer's generalised form: one ask per
 *     DISTINCT sentence type.
 *  7. Off-wall labels DROP (grade fidelity), grammar-term sentences DROP, and
 *     `Conjunction`/`Determiner` are not grammatical roles.
 *  8. The read-aloud is safe because the answer is not in the sentence; it fires
 *     at the band floor only, once per sentence.
 *  9. Corrections open "My turn:", NAME the fact, and re-elicit the same item;
 *     affirmations open "Yes,"; the move-on carries no close line.
 * 10. ⭐ THE WALL IS SPOKEN ON THE INTRODUCTION, NEVER PER ITEM — otherwise
 *     `label_all` recites the vocabulary four times in four items.
 * 11. The catalog keeps its side of the contract, and no steering prose survives
 *     for the deleted multiple-choice surface.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_POS,
  ALL_ROLES,
  ALL_SENTENCE_TYPES,
  CONFUSABLE_WITH,
  MAX_ITEMS,
  MAX_LABEL_ALL_WORDS,
  MAX_SENTENCES,
  MAX_TARGETS_PER_SENTENCE,
  answerKindFor,
  askFor,
  askIsAnswerFree,
  canonicalPos,
  canonicalRole,
  canonicalSentenceType,
  completeCue,
  gradeNumberOf,
  isBandFloor,
  isReadableAloud,
  itemCue,
  itemsFromPayload,
  leakExemptSpanFor,
  moveOnCue,
  namesAGrammarTerm,
  posWallFor,
  pronounceCue,
  questionFor,
  responseClassFor,
  roleWallFor,
  sentenceAnalyzerHarnessAnswers,
  sentenceAnalyzerPackBase,
  speakableWord,
  speechSafe,
  stimulusFor,
  wallPhrase,
  type SentenceAnalyzerItem,
  type SentenceAnalyzerPayloadLike,
} from '../sentenceAnalyzerScript';
import {
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

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

const packOf = (items: SentenceAnalyzerItem[]): JudgedScriptPack<SentenceAnalyzerItem> =>
  sentenceAnalyzerPackBase(items) as JudgedScriptPack<SentenceAnalyzerItem>;

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

const catalogEntry = LITERACY_CATALOG.find((p) => p.id === 'sentence-analyzer')!;

// ---------------------------------------------------------------------------

describe('sentence-analyzer — the family gates', () => {
  it('passes checkPackGates on the fixture pack', () => {
    expect(checkPackGates(packOf(build().items))).toEqual([]);
  });

  /**
   * ⚠️ THE REPEAT-ASK GATE IS ASLEEP ON A ONE-ITEM-PER-MODE FIXTURE, so this is
   * the real session shape: four `name-pos` items back to back over one sentence,
   * which is literally what `label_all` runs.
   */
  it('passes checkPackGates on consecutive same-action items (label_all)', () => {
    const { items } = labelAll();
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(new Set(items.map((i) => i.action))).toEqual(new Set(['name-pos']));
    expect(checkPackGates(packOf(items))).toEqual([]);
  });

  it('passes checkPackGates on the interleaved parse_structure shape', () => {
    const { items } = parse();
    expect(new Set(items.map((i) => i.action))).toEqual(new Set(['name-side', 'name-type']));
    expect(checkPackGates(packOf(items))).toEqual([]);
  });

  it('keeps the catalog side of the contract', () => {
    const { items } = build();
    const pack = packOf(items);
    expect(checkDiCatalogEntry(catalogEntry, pack, items[0])).toEqual([]);
  });
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

  it('never says the answer inside the ask, on the three actions that can', () => {
    const everything = [...build().items, ...labelAll().items, ...parse().items];
    for (const item of everything.filter((i) => i.action !== 'name-side')) {
      expect(askIsAnswerFree(askFor(item), item.answer, leakExemptSpanFor(item))).toBe(true);
    }
  });

  /**
   * `name-side` is the one action whose answer MUST be in the ask — "is it in the
   * subject or in the predicate?" is not a question otherwise. Stated, not
   * softened: the harness ships it with no leak tokens and leans on the
   * discrimination oracle instead.
   */
  it('states the name-side oracle as inapplicable rather than softening it', () => {
    const side = parse().items.find((i) => i.action === 'name-side')!;
    expect(questionFor(side).toLowerCase()).toContain('subject');
    expect(questionFor(side).toLowerCase()).toContain('predicate');
    expect(sentenceAnalyzerHarnessAnswers(side).leakTokens).toEqual([]);
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
      expect(spokenSpanOf(itemCue(item))).not.toMatch(/[.,!?;:][?.!]/);
    }
  });

  it('says the same form in the ask, the affirmation and the correction', () => {
    const withPunct = labelAll().items.find((i) => /[.!?]$/.test(i.targetWord));
    if (withPunct) {
      const bare = speakableWord(withPunct.targetWord);
      const cue = itemCue(withPunct);
      expect(cue).toContain(`the word ${bare}?`);
      expect(cue).toContain(`My turn: ${bare} is`);
      expect(cue).toContain(`Yes, ${bare} is`);
    }
  });

  it('still PRINTS the punctuation — only the spoken form sheds it', () => {
    const { sentences } = labelAll();
    expect(sentences[0].words.some((w) => /[.!?]$/.test(w.text))).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('⭐ the wall is spoken on the introduction, never per item', () => {
  /**
   * `label_all` runs four `name-pos` asks in a row. Appending the vocabulary to
   * each is the recitation defect ruled twice on 2026-08-13, arriving through the
   * ORDERING rather than through the ask.
   */
  it('stamps introducesAction on the first item of each action only', () => {
    const { items } = parse();
    const firstSide = items.findIndex((i) => i.action === 'name-side');
    const firstType = items.findIndex((i) => i.action === 'name-type');
    expect(items[firstSide].introducesAction).toBe(true);
    expect(items[firstType].introducesAction).toBe(true);
    expect(items.filter((i) => i.introducesAction)).toHaveLength(2);
  });

  it('keeps the wall out of every non-introducing ask', () => {
    const { items } = labelAll({ supportTier: 'easy' });
    const later = items.slice(1);
    expect(later.length).toBeGreaterThan(0);
    for (const item of later) {
      const spoken = spokenSpanOf(itemCue(item, { opening: false, howToPlay: true }));
      expect(spoken).not.toContain('Your choices are');
    }
  });

  it('speaks the wall on the opening at easy and at the band floor, not at hard', () => {
    const easy = labelAll({ supportTier: 'easy' }).items[0];
    expect(spokenSpanOf(itemCue(easy, { opening: true, howToPlay: true }))).toContain('Your choices are');

    const hard = labelAll({ supportTier: 'hard' }).items[0];
    expect(spokenSpanOf(itemCue(hard, { opening: true, howToPlay: true }))).not.toContain('Your choices are');

    // A tier withdraws scaffolding; it never withdraws access at the band floor.
    const floorHard = itemsFromPayload({
      gradeLevel: '2', supportTier: 'hard',
      challenges: [{ id: 'ch1', type: 'label_all', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS }],
    }).items[0];
    expect(spokenSpanOf(itemCue(floorHard, { opening: true, howToPlay: true }))).toContain('Your choices are');
  });

  it('exempts the wall clause from the leak oracle only where it is spoken', () => {
    const { items } = labelAll({ supportTier: 'easy' });
    expect(leakExemptSpanFor(items[0])).toBe(wallPhrase(items[0]));
    expect(leakExemptSpanFor(items[1])).toBeUndefined();
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

  it('re-reads the sentence on tap-to-hear at the band floor, on EVERY item', () => {
    const floor = itemsFromPayload({
      gradeLevel: '2',
      challenges: [{ id: 'ch1', type: 'label_all', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS }],
    }).items;
    for (const item of floor) {
      expect(spokenSpanOf(pronounceCue(item))).toContain('The clever fox jumped quickly.');
    }
  });

  it('never says the answer on tap-to-hear', () => {
    for (const item of [...build().items, ...labelAll().items]) {
      const spoken = spokenSpanOf(pronounceCue(item));
      expect(spoken.toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------

describe('corrections, affirmations, and the move-on', () => {
  it('opens every correction with "My turn:" and NAMES the fact', () => {
    for (const item of [...build().items, ...parse().items]) {
      const cue = itemCue(item);
      expect(cue).toContain('My turn:');
      expect(cue).toContain(`If it is wrong, say exactly: "My turn:`);
    }
  });

  it('opens every affirmation with "Yes,"', () => {
    for (const item of [...build().items, ...parse().items]) {
      expect(itemCue(item)).toContain('If the answer is right, say exactly: "Yes,');
    }
  });

  it('re-elicits the SAME item after a correction', () => {
    const item = build().items[0];
    const cue = itemCue(item);
    // The correction ends with the same question it just failed.
    expect(cue).toContain(`My turn: ${item.targetWord} is`);
    expect(cue).toContain(`Your turn. ${questionFor(item)}`);
  });

  it('carries no close line on the move-on — the label was already named twice', () => {
    const { items } = build();
    const cue = moveOnCue(items[0], items[1], {});
    const spoken = spokenSpanOf(cue);
    expect(spoken).toContain('Good try! Here comes the next one.');
    expect(spoken).not.toContain(items[0].answer);
  });

  it('ends the run without naming anything', () => {
    expect(spokenSpanOf(completeCue())).not.toMatch(
      new RegExp(`\\b(${[...ALL_POS, ...ALL_SENTENCE_TYPES].join('|')})\\b`, 'i'),
    );
  });
});

// ---------------------------------------------------------------------------

describe('the judging contract', () => {
  it('names the confusable twin as WRONG, not as an acceptable near-miss', () => {
    const noun = build().items.find((i) => i.answer === 'Noun');
    if (noun) {
      const cue = itemCue(noun);
      expect(cue).toContain('Pronoun');
      expect(cue).toContain('DIFFERENT answers and are wrong here');
      expect(cue).toContain('Part of a label is not the label');
    }
    expect(CONFUSABLE_WITH.Noun).toContain('Pronoun');
    expect(CONFUSABLE_WITH.Adjective).toContain('Adverb');
  });

  it('tells the judge that small subject-side words count like big ones', () => {
    const side = parse().items.find((i) => i.action === 'name-side')!;
    expect(itemCue(side)).toContain('are part of the COMPLETE subject');
  });

  it('refuses a part of speech where a JOB was asked for', () => {
    const roleItems = itemsFromPayload({
      gradeLevel: '5',
      challenges: [{ id: 'ch1', type: 'identify_role', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS }],
    }).items;
    expect(roleItems.length).toBeGreaterThan(0);
    expect(itemCue(roleItems[0])).toContain('Naming a PART OF SPEECH instead of a job');
  });

  it('carries the two-branch law, the never-perform tail and the verdict-ends-the-turn clause', () => {
    const item = build().items[0];
    const cue = itemCue(item);
    expect(cue).toContain('Your whole reply to their attempt is ONE of the quoted lines below');
    expect(cue).toContain('never announce that you are waiting or listening');
    expect(cue).toContain('Your verdict line is the END of your turn');
    // The whole sentence is in the cue, so every word is a fabricable next ask.
    expect(cue).toContain('never ask about another word or another sentence');
  });

  it('accepts the everyday classroom name where one is unambiguous', () => {
    const verb = labelAll().items.find((i) => i.answer === 'Verb');
    if (verb) expect(itemCue(verb)).toContain('action word');
    // "describing word" fits BOTH adjective and adverb, so it is under neither.
    const adjective = labelAll().items.find((i) => i.answer === 'Adjective');
    if (adjective) expect(itemCue(adjective)).not.toContain('describing word');
  });
});

// ---------------------------------------------------------------------------

describe('the context channel', () => {
  it('pushes the ACTION, never the eval mode', () => {
    const surface = sentenceAnalyzerPackBase(parse().items);
    for (const item of parse().items) {
      const ctx = surface.contextFor(item);
      expect(ctx.challengeType).toBe(item.action);
      expect(ctx.challengeType).not.toBe('parse_structure');
    }
  });

  it('keeps the stimulus answer-free', () => {
    for (const item of [...build().items, ...parse().items]) {
      expect(stimulusFor(item).toLowerCase()).not.toContain(item.answer.toLowerCase());
    }
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

  it('gives every label an article that reads correctly aloud', () => {
    const cues = labelAll().items.map((i) => itemCue(i)).join(' ');
    expect(cues).not.toMatch(/\ba (Adjective|Adverb|Interjection)\b/);
    expect(cues).not.toMatch(/\ban (Noun|Verb|Pronoun|Preposition|Conjunction|Determiner)\b/);
  });

  it('keeps the sentence-type set closed at four', () => {
    expect(ALL_SENTENCE_TYPES).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------

describe('the harness answer material mirrors the contract', () => {
  it('gives every item a correct answer, a plain wrong and a signature wrong', () => {
    for (const item of [...build().items, ...labelAll().items, ...parse().items]) {
      const answers = sentenceAnalyzerHarnessAnswers(item);
      expect(answers.correct).toBeTruthy();
      expect(answers.plainWrong).toBeTruthy();
      expect(answers.signatureWrong.text).toBeTruthy();
      expect(answers.plainWrong).not.toBe(answers.correct);
      expect(answers.signatureWrong.text).not.toBe(answers.correct);
    }
  });

  it("draws name-pos's signature wrong from the SAME map the contract warns about", () => {
    const noun = build().items.find((i) => i.answer === 'Noun');
    if (noun) {
      expect(sentenceAnalyzerHarnessAnswers(noun).signatureWrong.text).toBe('Pronoun');
    }
  });

  it("makes name-role's signature wrong a part of speech", () => {
    const roleItem = itemsFromPayload({
      gradeLevel: '5',
      challenges: [{ id: 'ch1', type: 'identify_role', sentence: 'The clever fox jumped quickly.', words: FOX_WORDS }],
    }).items[0];
    expect(sentenceAnalyzerHarnessAnswers(roleItem).signatureWrong.text).toBe('noun');
  });
});

// ---------------------------------------------------------------------------

describe('the catalog no longer steers toward a tap surface', () => {
  /**
   * ⚠️ THE CHECK IS FOR AN AFFIRMATIVE PROMISE, NOT FOR THE WORDS.
   *
   * The first version of this test was a substring scan for "multiple-choice",
   * and it failed on the sentence *"there are no multiple-choice options
   * anywhere"* — a NEGATION, which is the single most useful line in the entry
   * for a manifest deciding whether this primitive fits an objective. A scan that
   * cannot tell a promise from its denial would push the entry toward saying
   * nothing, which is worse steering than saying the wrong thing.
   */
  it('makes no affirmative promise of a tap surface', () => {
    const prose = `${catalogEntry.description} ${catalogEntry.constraints} `
      + `${catalogEntry.evalModes?.map((m) => m.description).join(' ')}`;
    const lower = prose.toLowerCase();
    for (const promise of [
      'from multiple choice',
      'from multiple-choice',
      'select the',
      'choose from',
      'click a',
      'click the',
      'tap the',
      'drag',
    ]) {
      expect(lower).not.toContain(promise);
    }
  });

  it('says out loud that there is no menu and nothing to tap', () => {
    const lower = `${catalogEntry.description} ${catalogEntry.constraints}`.toLowerCase();
    expect(lower).toContain('no multiple-choice options');
    expect(lower).toContain('nothing is tapped');
  });

  it('declares the microphone and the spoken answer', () => {
    const prose = `${catalogEntry.description} ${catalogEntry.constraints}`;
    expect(prose.toLowerCase()).toContain('microphone');
    expect(prose.toLowerCase()).toContain('out loud');
  });

  it('moves the betas only where the structure moved, and says why', () => {
    const modes = Object.fromEntries((catalogEntry.evalModes ?? []).map((m) => [m.evalMode, m]));
    expect(modes.identify_pos.beta).toBeGreaterThan(1.5);
    expect(modes.identify_role.beta).toBeGreaterThan(3.0);
    expect(modes.label_all.beta).toBeGreaterThan(5.0);
    // parse_structure had no menu to delete — its key was simply wrong.
    expect(modes.parse_structure.beta).toBe(6.5);
    expect(modes.identify_pos.description.toLowerCase()).toContain('unaided');
  });
});
