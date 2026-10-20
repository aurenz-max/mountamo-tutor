/**
 * ordinalLineDomain — what ordinal-line teaches, pinned: the answer-material fork, the build gates (drop, never
 * repair), the ask and the spoken key, the line's check of a build, the known spoken misses and the harness answers.
 * Moved from the scripted pack's suite (`__tests__/OrdinalLine.di-script.test.ts`) when the scripted cue protocol
 * was deleted (boss migration, 2026-10-20); the cue, correction and catalog-tutoring assertions went with it.
 */
import { describe, it, expect } from 'vitest';
import {
  actionFor,
  answerKindFor,
  askFor,
  describeLine,
  directionFor,
  frontOf,
  isSpeakableStory,
  isSayablePosition,
  isUsableCharacterName,
  itemsFromChallenge,
  itemsFromChallenges,
  lineMatches,
  lineMiss,
  MAX_SPOKEN_CLUES,
  ordinalKey,
  ordinalLineHarnessAnswers,
  ordinalSpokenMisses,
  ordinalWordFor,
  positionOfSymbol,
  responseClassFor,
  usableLineNames,
  ORDINAL_WORDS,
  type OrdinalLineChallengeLike,
  type OrdinalLineItem,
} from './ordinalLineDomain';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import { getComponentById } from '../../../service/manifest/catalog';

// ── Fixtures ────────────────────────────────────────────────────────────────

const CTX_K = { band: 'K', context: 'race' } as const;
const CTX_1 = { band: '1', context: 'train' } as const;

/** Five sayable, ear-separable, position-free names. */
const LINE = [
  { name: 'Rabbit', emoji: '🐰' },
  { name: 'Turtle', emoji: '🐢' },
  { name: 'Fox', emoji: '🦊' },
  { name: 'Bear', emoji: '🐻' },
  { name: 'Frog', emoji: '🐸' },
];

const ID_CH: OrdinalLineChallengeLike = {
  id: 'c1',
  type: 'identify',
  characters: LINE,
  targetPosition: 3,
  correctAnswer: '3',
};

const MATCH_CH: OrdinalLineChallengeLike = {
  id: 'c2',
  type: 'match',
  characters: LINE,
  correctAnswer: 'all_matched',
  matchPairs: [
    { word: 'first', symbol: '1st' },
    { word: 'third', symbol: '3rd' },
    { word: 'fifth', symbol: '5th' },
  ],
};

const REL_CH: OrdinalLineChallengeLike = {
  id: 'c3',
  type: 'relative-position',
  characters: LINE,
  targetPosition: 3,
  relativeQuery: 'after',
  correctAnswer: 'Bear',
  // The click era's option row. It is never rendered and never reaches an item.
  options: ['Bear', 'Fox', 'Frog'],
};

const STORY_CH: OrdinalLineChallengeLike = {
  id: 'c4',
  type: 'sequence-story',
  characters: LINE,
  correctAnswer: 'sequence_complete',
  storyText:
    'The animals lined up for the race. Fox went to the very front, then Bear, '
    + 'then Rabbit. Frog and Turtle came along at the end.',
  clues: [
    { character: 'Fox', position: 1 },
    { character: 'Bear', position: 2 },
    { character: 'Rabbit', position: 3 },
    { character: 'Frog', position: 4 },
    { character: 'Turtle', position: 5 },
  ],
};

const BUILD_CH: OrdinalLineChallengeLike = {
  id: 'c5',
  type: 'build-sequence',
  characters: LINE,
  correctAnswer: 'sequence_complete',
  clues: [
    { character: 'Turtle', position: 1 },
    { character: 'Fox', position: 2 },
    { character: 'Rabbit', position: 3 },
  ],
};

const one = (
  ch: OrdinalLineChallengeLike,
  ctx: typeof CTX_K | typeof CTX_1,
): OrdinalLineItem => itemsFromChallenge(ch, ctx)[0];

/** Direction A (Kindergarten): the ordinal is in the ASK, the answer is a NAME. */
const ID_K = one(ID_CH, CTX_K);
/** Direction B (Grade 1): the character is in the ASK, the answer is a PLACE. */
const ID_1 = one(ID_CH, CTX_1);
const MATCH_ITEMS = itemsFromChallenge(MATCH_CH, CTX_K);
const MATCH = MATCH_ITEMS[1]; // the 3rd card
const REL = one(REL_CH, CTX_K);
const STORY = one(STORY_CH, CTX_K);
const BUILD = one(BUILD_CH, CTX_1);

const ITEMS: OrdinalLineItem[] = [ID_K, MATCH, REL, STORY, BUILD];

describe('ordinal-line · THE ANSWER-MATERIAL FORK', () => {
  it.each([
    ['identify', 'name_character', 'voice', 'short_spoken_word'],
    ['identify', 'name_place', 'voice', 'ordinal_word'],
    ['match', 'name_character', 'voice', 'ordinal_word'],
    ['relative_position', 'name_character', 'voice', 'short_spoken_word'],
    ['sequence_story', 'name_character', 'voice', 'ordinal_word'],
    ['build_sequence', 'name_character', 'gesture', 'manipulation'],
  ] as const)('%s (%s) answers with %s (%s)', (kind, direction, answerKind, responseClass) => {
    expect(answerKindFor(kind)).toBe(answerKind);
    expect(responseClassFor(kind, direction)).toBe(responseClass);
  });

  it('⭐ identify FORKS BY BAND — a name at K, a place at Grade 1', () => {
    expect(directionFor('K')).toBe('name_character');
    expect(directionFor('1')).toBe('name_place');
    // Same challenge, same target position, two different answers.
    expect(ID_K.answerText).toBe('Fox');
    expect(ID_K.responseClass).toBe('short_spoken_word');
    expect(ID_1.answerText).toBe('third');
    expect(ID_1.responseClass).toBe('ordinal_word');
  });

  it('the two directions carry DIFFERENT actions', () => {
    expect(actionFor('identify', 'name_character')).toBe('name-character');
    expect(actionFor('identify', 'name_place')).toBe('name-place');
    expect(new Set(ITEMS.map((i) => i.action)).size).toBe(5);
  });

  it('every response class the pack uses is BENCHED — no new class, no #63', () => {
    // The whole point: `ordinal_word` was believed unbenched for three months
    // and is `status: benched` in code. Nothing here needs a bench sitting, and
    // the position ceiling keeps every spoken place word inside first..tenth.
    expect([...ITEMS, ID_1].map((i) => i.responseClass).sort()).toEqual([
      'manipulation', 'ordinal_word', 'ordinal_word', 'ordinal_word',
      'short_spoken_word', 'short_spoken_word',
    ]);
    for (const item of [...ITEMS, ID_1]) {
      expect(item.askPosition).toBeLessThanOrEqual(10);
      expect(item.lineNames.length).toBeLessThanOrEqual(10);
    }
  });

  it('the deleted menus cannot come back through a cached challenge', () => {
    // relative-position still ships `options` and match still ships a word
    // column; neither reaches an item, so a stale payload cannot re-render them.
    expect(REL_CH.options).toHaveLength(3);
    expect(Object.keys(REL)).not.toContain('options');
    expect(Object.keys(MATCH)).not.toContain('matchPairs');
  });
});

describe('ordinal-line · BUILD GATES (drop, never repair)', () => {
  it('drops an unknown type and a line the tutor cannot use', () => {
    expect(itemsFromChallenge({ ...ID_CH, type: 'mystery' }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ ...ID_CH, characters: LINE.slice(0, 2) }, CTX_K)).toEqual([]);
    expect(usableLineNames(LINE.slice(0, 2))).toBeNull();
  });

  it('⭐ drops a line whose character name STATES A POSITION', () => {
    // Defect class 11 in this pack's vocabulary. On the Grade 1 direction the
    // name IS the answer, verbatim; the cardinal form is refused too, because
    // "three" for "third" is one of this pack's two signature errors.
    expect(isUsableCharacterName('Rabbit')).toBe(true);
    expect(isUsableCharacterName('First-Place Freddie')).toBe(false);
    expect(isUsableCharacterName('Number Three')).toBe(false);
    expect(isUsableCharacterName('Three-Toed Sloth')).toBe(false);
    expect(isUsableCharacterName('Winner Wanda')).toBe(false);
    // Whole-word, never substring: an ordinal inside another word is fine.
    expect(isUsableCharacterName('Kitten')).toBe(true);
    expect(itemsFromChallenge({
      ...ID_CH,
      characters: [...LINE.slice(0, 4), { name: 'First-Place Freddie', emoji: '🐴' }],
    }, CTX_K)).toEqual([]);
  });

  it('drops names that cannot be told apart by ear', () => {
    expect(usableLineNames([
      { name: 'Fox' }, { name: 'Red Fox' }, { name: 'Bear' },
    ])).toBeNull();
    expect(usableLineNames([{ name: 'Ox' }, { name: 'Bear' }, { name: 'Frog' }])).toBeNull();
    expect(usableLineNames(LINE)).toEqual(['Rabbit', 'Turtle', 'Fox', 'Bear', 'Frog']);
  });

  it('⭐ drops an identify key that disagrees with its own target position', () => {
    // The click era graded against the key and drew the line from the target,
    // so the two could disagree and nothing noticed. Spoken, that is the tutor
    // refusing a child who counted correctly.
    expect(itemsFromChallenge({ ...ID_CH, correctAnswer: '4' }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ ...ID_CH, correctAnswer: 'Fox' }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ ...ID_CH, correctAnswer: 3 }, CTX_K)).toHaveLength(1);
  });

  it('drops a position off the line or outside the benched window', () => {
    expect(isSayablePosition(0)).toBe(false);
    expect(isSayablePosition(11)).toBe(false);
    expect(isSayablePosition(10)).toBe(true);
    expect(itemsFromChallenge({ ...ID_CH, targetPosition: 6, correctAnswer: '6' }, CTX_K)).toEqual([]);
    expect(itemsFromChallenge({ ...ID_CH, targetPosition: 0, correctAnswer: '0' }, CTX_K)).toEqual([]);
  });

  it('⭐ expands a match grid into ONE JUDGED ASK PER SYMBOL', () => {
    // One challenge is not one item (defect class 1) — and the expansion is also
    // what dissolves the elimination leak the two-column grid carried by
    // construction.
    expect(MATCH_ITEMS).toHaveLength(3);
    expect(MATCH_ITEMS.map((i) => i.id)).toEqual(['c2::p1', 'c2::p3', 'c2::p5']);
    expect(MATCH_ITEMS.map((i) => i.answerText)).toEqual(['first', 'third', 'fifth']);
    expect(MATCH_ITEMS.map((i) => i.symbol)).toEqual(['1st', '3rd', '5th']);
  });

  it('drops a pair whose printed word and printed symbol are different ordinals', () => {
    expect(positionOfSymbol('3rd')).toBe(3);
    expect(positionOfSymbol('11th')).toBe(0);
    expect(positionOfSymbol('third')).toBe(0);
    const items = itemsFromChallenge({
      ...MATCH_CH,
      matchPairs: [
        { word: 'third', symbol: '4th' },   // key disagrees with the print
        { word: 'second', symbol: 'two' },  // not an ordinal symbol at all
        { word: 'fifth', symbol: '5th' },   // the only askable one
      ],
    }, CTX_K);
    expect(items).toHaveLength(1);
    expect(items[0].answerText).toBe('fifth');
  });

  it('caps one grid so a single challenge cannot fill the session', () => {
    const wide = itemsFromChallenge({
      ...MATCH_CH,
      matchPairs: ORDINAL_WORDS.map((word, i) => ({
        word,
        symbol: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'][i],
      })),
    }, CTX_1);
    expect(wide).toHaveLength(4);
  });

  it('drops a relative-position key that disagrees with the LINE', () => {
    expect(itemsFromChallenge({ ...REL_CH, correctAnswer: 'Frog' }, CTX_K)).toEqual([]);
    // "before the first one" has no answer on the line.
    expect(itemsFromChallenge(
      { ...REL_CH, targetPosition: 1, relativeQuery: 'before', correctAnswer: 'Rabbit' },
      CTX_K,
    )).toEqual([]);
  });

  it('⭐ drops a story that cannot be spoken VERBATIM', () => {
    // The one generated string this pack reads out whole. A double quote closes
    // the `Say exactly: "…"` span; a sentinel opener is read as a verdict.
    expect(isSpeakableStory(STORY_CH.storyText)).toBe(true);
    expect(isSpeakableStory('Fox said "I am first!" and ran off.')).toBe(false);
    expect(isSpeakableStory('Yes, the animals lined up. Fox is first.')).toBe(false);
    expect(isSpeakableStory('My turn: the animals lined up.')).toBe(false);
    expect(isSpeakableStory(`The race began. ${'a lovely long day '.repeat(30)}`)).toBe(false);
    expect(itemsFromChallenge(
      { ...STORY_CH, storyText: 'Fox said "I am first!" and ran off.' },
      CTX_K,
    )).toEqual([]);
  });

  it('the story ASKS ABOUT A MIDDLE — primacy and recency are free', () => {
    // A child who heard only the beginning or only the end can answer about the
    // first or last character without tracking anything. The position is picked
    // by a hash of the item id, so this is asserted across MANY ids rather than
    // on one draw — a single fixture would pass by luck under a broken filter.
    const picked = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const item = one({ ...STORY_CH, id: `s${i}` }, CTX_K);
      expect(item.askPosition).toBeGreaterThan(1);
      expect(item.askPosition).toBeLessThan(5);
      expect(item.answerText).toBe(ordinalWordFor(item.askPosition));
      expect(item.storyName).toBe(
        STORY_CH.clues!.find((c) => c.position === item.askPosition)!.character,
      );
      picked.add(item.askPosition);
    }
    expect(picked).toEqual(new Set([2, 3, 4]));

    // A three-clue story has exactly one middle; a two-clue story has none, and
    // a story is dropped rather than asked about its own bookends.
    const three = one({
      ...STORY_CH,
      clues: STORY_CH.clues!.slice(0, 3),
    }, CTX_K);
    expect(three.askPosition).toBe(2);
    expect(itemsFromChallenge({
      ...STORY_CH,
      characters: LINE.slice(0, 2),
      clues: [{ character: 'Rabbit', position: 1 }, { character: 'Turtle', position: 2 }],
    }, CTX_K)).toEqual([]);
  });

  it('⭐ drops more spoken clues than a child can hold, and any gappy line', () => {
    expect(MAX_SPOKEN_CLUES).toBe(4);
    expect(itemsFromChallenge({
      ...BUILD_CH,
      clues: LINE.map((c, i) => ({ character: c.name, position: i + 1 })),
    }, CTX_1)).toEqual([]);
    // "second and fourth" leaves places nobody is told about — merely odd under
    // a Check button, unanswerable out loud.
    expect(itemsFromChallenge({
      ...BUILD_CH,
      clues: [{ character: 'Fox', position: 2 }, { character: 'Bear', position: 4 }],
    }, CTX_1)).toEqual([]);
    // One clue is not an arrangement.
    expect(itemsFromChallenge({
      ...BUILD_CH,
      clues: [{ character: 'Fox', position: 1 }],
    }, CTX_1)).toEqual([]);
    // A clue naming someone who is not on the line.
    expect(itemsFromChallenge({
      ...BUILD_CH,
      clues: [{ character: 'Badger', position: 1 }, { character: 'Fox', position: 2 }],
    }, CTX_1)).toEqual([]);
  });

  it('the spoken clue ORDER is the generator\'s, so `hard` scrambling survives', () => {
    const scrambled = one({
      ...BUILD_CH,
      clues: [
        { character: 'Rabbit', position: 3 },
        { character: 'Turtle', position: 1 },
        { character: 'Fox', position: 2 },
      ],
    }, CTX_1);
    expect(scrambled.clues.map((c) => c.name)).toEqual(['Rabbit', 'Turtle', 'Fox']);
    expect(scrambled.answerOrder).toEqual(['Turtle', 'Fox', 'Rabbit']);
    expect(askFor(scrambled).indexOf('Rabbit')).toBeLessThan(askFor(scrambled).indexOf('Turtle'));
  });

  it('dedups SESSION-WIDE on the position an ask is ABOUT', () => {
    // The `characters` array is the same across every challenge of a session, so
    // a second ask about the third place is recall of the first.
    const { items, droppedChallenges } = itemsFromChallenges(
      [ID_CH, { ...ID_CH, id: 'c1b' }],
      CTX_K,
    );
    expect(items).toHaveLength(1);
    expect(droppedChallenges).toBe(1);
  });

  it('⭐ an ANSWER may be spoken once — the position set does not cover it', () => {
    // Half two of defect class 2. `relative_position`'s answer sits at anchor ±
    // 1, so two asks about DIFFERENT places can share one answer: having heard
    // "Bear is fourth", the child gets "who is right after the third one?" free.
    const collide = itemsFromChallenges([
      { ...ID_CH, id: 'a1', targetPosition: 4, correctAnswer: '4' },      // answer: Bear
      { ...REL_CH, id: 'a2', targetPosition: 3, correctAnswer: 'Bear' },  // answer: Bear again
      { ...REL_CH, id: 'a3', targetPosition: 5, relativeQuery: 'before', correctAnswer: 'Bear' },
    ], CTX_K);
    expect(collide.items.map((i) => i.id)).toEqual(['a1']);

    // And the reverse: three DIFFERENT answers over three different places all
    // survive, so the gate is not just refusing everything after the first.
    const distinct = itemsFromChallenges([
      { ...ID_CH, id: 'b1', targetPosition: 1, correctAnswer: '1' },
      { ...REL_CH, id: 'b2', targetPosition: 2, correctAnswer: 'Fox' },
      { ...REL_CH, id: 'b3', targetPosition: 4, correctAnswer: 'Frog' },
    ], CTX_K);
    expect(distinct.items.map((i) => i.answerText)).toEqual(['Rabbit', 'Fox', 'Frog']);

    // The two answer sets are kept apart, and the reason they cannot currently
    // COLLIDE is a different gate: `isUsableCharacterName` refuses any name that
    // carries an ordinal or a counting word, so no character can ever be called
    // "Third". The separation is what keeps that true if the name gate ever
    // loosens — port 7 merged its two sets and ran the pool dry.
    const mixed = itemsFromChallenges([ID_CH, MATCH_CH], CTX_K);
    expect(mixed.items.map((i) => i.answerText)).toEqual(['Fox', 'first', 'fifth']);
  });
});

describe('ordinal-line · the ask and the key', () => {
  it('⭐ BOTH identify directions are leak-clean BY CONSTRUCTION', () => {
    // Each direction names the thing the OTHER one wants, so neither ask contains its own answer.
    expect(askFor(ID_K)).toContain('third');
    expect(askLeaks(askFor(ID_K), ordinalKey(ID_K)!)).toEqual([]);
    expect(askFor(ID_1)).toContain('Fox');
    expect(askLeaks(askFor(ID_1), ordinalKey(ID_1)!)).toEqual([]);
  });

  it('the match ask names nothing on screen; the relative ask names the anchor, never the neighbour', () => {
    expect(askFor(MATCH)).not.toMatch(/third|3rd/);
    expect(askFor(REL)).toContain('third');
    expect(askLeaks(askFor(REL), ordinalKey(REL)!)).toEqual([]);
  });

  it('the story may state the answer by design: it is the given span, and nothing outside it does', () => {
    expect(askLeaks(askFor(STORY), ordinalKey(STORY)!, [STORY.storyText])).toEqual([]);
    expect(askFor(STORY).replace(STORY.storyText, ' ')).not.toContain(STORY.answerText);
  });

  it('every line-reading ask NAMES WHICH END IS THE FRONT, in words, with no numerals', () => {
    expect(askFor(ID_K)).toContain(frontOf('race'));
    expect(askFor(ID_1)).toContain(frontOf('train'));
    expect(askFor(REL)).toContain(frontOf('race'));
    expect(frontOf('bookshelf')).toBe('the left end of the shelf');
    for (const item of [...ITEMS, ID_1]) expect(askFor(item)).not.toMatch(/\d/);
  });

  it('⭐ the counting walk is never in the ask', () => {
    for (const item of [ID_K, ID_1, REL]) expect(askFor(item)).not.toContain('first, second');
  });

  it('a place-word key refuses the counting number; a name key refuses a pointing word and the anchor; a build has none', () => {
    expect(ordinalKey(MATCH)).toMatchObject({ answer: 'third' });
    expect(ordinalKey(MATCH)!.signatureError).toContain('"three", the counting number said alone, is not the answer');
    expect(ordinalKey(ID_1)!.signatureError).toContain('"three"');
    expect(ordinalKey(ID_K)).toMatchObject({ answer: 'Fox' });
    expect(ordinalKey(ID_K)!.signatureError).toContain('"that one"');
    expect(ordinalKey(REL)!.signatureError).toContain('The Fox, the one the question names, is not the answer.');
    expect(ordinalKey(BUILD)).toBeNull();
  });
});

describe('ordinal-line · the line checks a build', () => {
  const characters = ['Rabbit', 'Bear', 'Turtle', 'Fox', 'Owl'].map(name => ({ name, emoji: '' }));
  const [build] = itemsFromChallenges([{ id: 'c1', type: 'build-sequence', characters,
    clues: [{ character: 'Owl', position: 1 }, { character: 'Turtle', position: 2 }, { character: 'Fox', position: 3 }] }],
  { band: 'K', context: 'race' }).items;

  it.each([
    [['Fox', 'Turtle', 'Owl'], 'reversed'], [['Turtle', 'Owl', 'Fox'], 'two_swapped'], [['Turtle', 'Fox', 'Owl'], 'other_order'],
    [['Owl', '', 'Fox'], 'place_left_empty'], [['Owl', 'Turtle'], 'place_left_empty'], [['Owl', 'Turtle', 'Fox'], undefined],
  ])('placed %j -> %s', (placed, miss) => {
    expect(build.answerOrder).toEqual(['Owl', 'Turtle', 'Fox']);
    expect(lineMiss(build, placed)).toBe(miss);
    expect(lineMatches(build, placed)).toBe(miss === undefined);
  });

  it('⭐ a GAPPED line is described as gapped, never compacted', () => {
    expect(describeLine(build, ['Owl', '', 'Fox'])).toBe('Placed 2 of 3, from the first place: Owl, empty, Fox');
    expect(describeLine(build, [])).toBe('Placed none of the pictures');
  });
});

describe('ordinal-line · known spoken misses', () => {
  const spoken = (kind: OrdinalLineItem['kind'], askPosition: number, extra: Partial<OrdinalLineItem>) =>
    ({ id: kind, kind, answerKind: 'voice', context: 'race', direction: 'name_place', relativeQuery: 'before', askPosition,
      lineNames: ['Rabbit', 'Bear', 'Turtle', 'Fox', 'Owl'], clues: [], symbol: '', storyText: '', storyName: '', ...extra }) as OrdinalLineItem;

  it.each([
    [spoken('identify', 2, { direction: 'name_character', answerText: 'Bear' }), ['wrong_end', 'next_to_place']],
    [spoken('identify', 2, { answerText: 'second' }), ['cardinal_for_ordinal', 'wrong_end', 'next_to_place']],
    [spoken('identify', 3, { answerText: 'third' }), ['cardinal_for_ordinal', 'next_to_place']],
    [spoken('match', 1, { symbol: '1st', answerText: 'first' }), ['cardinal_for_ordinal', 'next_to_place']],
    [spoken('relative_position', 3, { answerText: 'Bear' }), ['said_anchor', 'wrong_side']],
    [spoken('relative_position', 5, { answerText: 'Fox' }), ['said_anchor']],
  ] as const)('spoken %#: known misses in order, none of them the answer', (item, ids) => {
    const misses = ordinalSpokenMisses(item);
    expect(misses.map(m => m.id)).toEqual(ids);
    expect(misses.flatMap(m => m.examples ?? []).filter(e => e === item.answerText)).toEqual([]);
  });
});

describe('ordinal-line · harness answer material', () => {
  it('mirrors the misses the key names', () => {
    const offEnd = one({ ...ID_CH, targetPosition: 2, correctAnswer: '2' }, CTX_K);
    const a = ordinalLineHarnessAnswers(offEnd);
    expect(a.correct).toBe('Turtle');
    expect(a.signatureWrong?.text).toBe('Bear');
    expect(a.signatureWrong?.why).toContain('wrong-end count');
    expect(ordinalLineHarnessAnswers(MATCH)).toMatchObject({ correct: 'third', signatureWrong: { text: 'three' } });
    expect(ordinalLineHarnessAnswers(REL)).toMatchObject({ correct: 'Bear', signatureWrong: { text: 'Fox' } });
  });

  it('the hands item commits an arrangement, not a word', () => {
    expect(ordinalLineHarnessAnswers(BUILD)).toMatchObject({ placed: { correct: 1, wrong: 0 }, leakTokens: [] });
  });
});

describe('ordinal-line · catalog', () => {
  it('every eval mode kept its identity; only the two that RESTRUCTURED moved β', () => {
    const modes = (getComponentById('ordinal-line')!.evalModes ?? []).map((m) => [m.evalMode, m.beta]);
    expect(modes).toEqual([
      ['identify', 1.5],          // held — a tap over the same visible set became speech
      ['match', 3.0],             // 2.5 → 3.0: the word column (and its elimination) deleted
      ['relative_position', 4.0], // 3.5 → 4.0: a 1-of-4 menu deleted outright
      ['sequence_story', 4.5],    // held — same tier, new channel
      ['build_sequence', 5.5],    // held — same hands surface
    ]);
  });
});
