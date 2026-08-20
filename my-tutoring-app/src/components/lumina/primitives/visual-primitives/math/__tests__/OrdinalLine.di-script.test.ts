/**
 * ordinalLineScript — the pedagogy lives here, so this is where it is pinned.
 * Pure: no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates =
 *     validateJudgedScriptPack + performed-stage-directions + repeated-asks),
 *     on the fixture pack AND on the real session shape.
 *  2. THE FORK, in BOTH DIRECTIONS: identify speaks a NAME at Kindergarten and
 *     a PLACE at Grade 1, match / relative-position / sequence-story speak, and
 *     build-sequence keeps its hands. Changing a row here is a contract change,
 *     not an edit.
 *  3. BUILD GATES — every one a CONTENT fault the spoken ask exposed: a key that
 *     disagrees with its own target position, a key that disagrees with the
 *     line, a character name that STATES A POSITION, names the judge cannot
 *     separate by ear, a printed word and symbol that are different ordinals, a
 *     story that cannot be spoken verbatim, a story with no middle to ask about,
 *     a gappy arrangement, and more spoken clues than a child can hold. All
 *     DROPPED, none repaired.
 *  4. ANSWER-LEAK: the two identify directions are leak-clean BY CONSTRUCTION
 *     (each names the thing the other one wants), the story is the ONLY exempt
 *     span, and no ordinal word may appear in the greeting or the how-to-play —
 *     the frame collides with the answer on three of five modes.
 *  5. THE COUNTING WALK LIVES ONLY IN THE CORRECTION, and the cardinal contrast
 *     ("three tells how many, third tells which one") is taught there.
 *  6. Corrections open "My turn:", model then re-elicit; affirmations open
 *     "Yes,". The hands item carries a SILENCE contract; its verdict is
 *     code-computed and names WHICH fault happened.
 *  7. The catalog keeps its side: audio mode, contextKeys, template keys,
 *     sentinel scan — and its steering names the microphone instead of tapping.
 *  8. Harness answer material mirrors the discrimination clauses it drills.
 */
import { describe, it, expect } from 'vitest';
import {
  actionFor,
  answerKindFor,
  askFor,
  completeCue,
  directionFor,
  frontOf,
  howToPlayFor,
  isSpeakableStory,
  isSayablePosition,
  isUsableCharacterName,
  itemCue,
  itemsFromChallenge,
  itemsFromChallenges,
  leakExemptSpanFor,
  MAX_SPOKEN_CLUES,
  moveOnCue,
  ordinalLineHarnessAnswers,
  ordinalLinePackBase,
  ordinalWordFor,
  placeCueForPlaced,
  placementVerdictCue,
  positionOfSymbol,
  pronounceCue,
  responseClassFor,
  signatureIsWrongEnd,
  signatureWrongPosition,
  stimulusFor,
  usableLineNames,
  ORDINAL_WORDS,
  type OrdinalLineChallengeLike,
  type OrdinalLineItem,
} from '../ordinalLineScript';
import {
  findSentinelCollisions,
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../../service/manifest/catalog/math';

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

/** The pack's CUE SURFACE — the real one; the component and the DI drive-plan
 *  endpoint spread this same export, so this fixture tests the wire. */
const pack: JudgedScriptPack<OrdinalLineItem> = ordinalLinePackBase(ITEMS);

/**
 * ⚠️ THE REAL SESSION SHAPE (testkit warning): a one-item-per-mode pack is the
 * one shape `findRepeatedConsecutiveAsks` can never fire on, and every port's
 * fixture pack was exactly that. A real single-mode session runs same-action
 * items back to back — which is what makes "every line-reading ask names the
 * FRONT and its own place" a load-bearing design choice rather than a stylistic
 * one, and what makes `match`'s deliberately SHORT invariant ask legal.
 */
const IDENTIFY_SESSION = itemsFromChallenges([
  { ...ID_CH, id: 's1', targetPosition: 2, correctAnswer: '2' },
  { ...ID_CH, id: 's2', targetPosition: 4, correctAnswer: 4 },
  { ...ID_CH, id: 's3', targetPosition: 5, correctAnswer: '5' },
], CTX_K).items;

const MATCH_SESSION = itemsFromChallenges([MATCH_CH], CTX_K).items;

const catalogEntry = MATH_CATALOG.find((c) => c.id === 'ordinal-line')!;

const cuesOf = (item: OrdinalLineItem) => ({
  opening: itemCue(item, { opening: true, howToPlay: true }),
  plain: itemCue(item),
});

// ============================================================================

describe('ordinal-line · structural gates', () => {
  it('the pack passes every family gate', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('a REAL single-mode identify session passes them too (repeat-ask gate awake)', () => {
    expect(IDENTIFY_SESSION).toHaveLength(3);
    expect(checkPackGates(ordinalLinePackBase(IDENTIFY_SESSION))).toEqual([]);
  });

  it('a REAL match session passes them — its ask is invariant BY DESIGN', () => {
    // match may name nothing on screen (the symbol IS the answer), so its ask
    // repeats verbatim. That is the DI signal the gate deliberately permits
    // below 12 words, not the recitation it exists to refuse.
    expect(MATCH_SESSION.length).toBeGreaterThanOrEqual(3);
    expect(new Set(MATCH_SESSION.map((i) => i.action))).toEqual(new Set(['read-symbol']));
    expect(askFor(MATCH_SESSION[0])).toBe(askFor(MATCH_SESSION[1]));
    expect(askFor(MATCH).split(/\s+/)).toHaveLength(8);
    expect(checkPackGates(ordinalLinePackBase(MATCH_SESSION))).toEqual([]);
  });

  it('no cue the pack can emit opens a sentence with a verdict sentinel', () => {
    const cues = ITEMS.flatMap((item, i) => [
      { label: `ask:${item.id}`, text: itemCue(item, { opening: true, howToPlay: true }) },
      { label: `ask2:${item.id}`, text: itemCue(item) },
      { label: `move:${item.id}`, text: moveOnCue(item, ITEMS[i + 1] ?? null) },
      { label: `hear:${item.id}`, text: pronounceCue(item) },
    ]).concat(
      { label: 'complete', text: completeCue() },
      { label: 'place:right', text: placementVerdictCue(BUILD, BUILD.answerOrder) },
      { label: 'place:reversed', text: placementVerdictCue(BUILD, [...BUILD.answerOrder].reverse()) },
      { label: 'place:partial', text: placementVerdictCue(BUILD, [BUILD.answerOrder[0]]) },
      { label: 'place:none', text: placementVerdictCue(BUILD, []) },
    );
    expect(findSentinelCollisions(cues)).toEqual([]);
  });
});

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

  it('the two directions carry DIFFERENT actions, so the how-to-play re-speaks', () => {
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

  it('a SPOKEN item is never told the answer arrives with hands', () => {
    for (const item of [ID_K, ID_1, MATCH, REL, STORY]) {
      const { plain } = cuesOf(item);
      expect(plain).toContain('The correct answer is');
      expect(plain).toContain('If the answer is right, say exactly:');
      expect(plain).toContain('If it is wrong, say exactly:');
      expect(plain).not.toContain('with their HANDS');
    }
  });

  it('the HANDS item gets the silence contract and no spoken-verdict branches', () => {
    const { plain } = cuesOf(BUILD);
    expect(plain).toContain('with their HANDS');
    expect(plain).toContain('stay completely silent');
    expect(plain).not.toContain('If the answer is right');
    expect(plain).not.toContain('The correct answer is');
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

describe('ordinal-line · ANSWER-LEAK', () => {
  it('⭐ BOTH identify directions are leak-clean BY CONSTRUCTION', () => {
    // Each direction names the thing the OTHER one wants, so neither ask can
    // contain its own answer and neither needs an exempt span.
    const askK = spokenSpanOf(itemCue(ID_K, { opening: true, howToPlay: true }));
    expect(askK).toContain('third');
    expect(askK).not.toContain('Fox');
    expect(leakExemptSpanFor(ID_K)).toBeUndefined();

    const ask1 = spokenSpanOf(itemCue(ID_1, { opening: true, howToPlay: true }));
    expect(ask1).toContain('Fox');
    expect(ask1).not.toMatch(/\bthird\b/);
    expect(leakExemptSpanFor(ID_1)).toBeUndefined();
  });

  it('the match ask names nothing on screen at all', () => {
    const span = spokenSpanOf(itemCue(MATCH, { opening: true, howToPlay: true }));
    expect(span).not.toMatch(/\bthird\b/);
    expect(span).not.toContain('3rd');
    expect(leakExemptSpanFor(MATCH)).toBeUndefined();
  });

  it('the relative-position ask names the ANCHOR, never the neighbour', () => {
    const span = spokenSpanOf(itemCue(REL, { opening: true, howToPlay: true }));
    expect(span).toContain('third');
    expect(span).not.toContain('Bear');
    expect(leakExemptSpanFor(REL)).toBeUndefined();
  });

  it('the story is the ONLY exempt span, and the leak is outside it', () => {
    const span = spokenSpanOf(itemCue(STORY, { opening: true, howToPlay: true }));
    const exempt = leakExemptSpanFor(STORY)!;
    expect(exempt).toBe(STORY.storyText);
    expect(span).toContain(exempt);
    // Outside the story the place word never appears — a leak in the greeting,
    // the how-to-play or the hand-over is still a leak.
    expect(span.replace(exempt, ' ')).not.toContain(STORY.answerText);
  });

  it('⭐ no ordinal word may appear in the greeting or the how-to-play', () => {
    // The frame collides with the ANSWER on three of five modes, so a friendly
    // "let us find who is first, second and third!" would speak the answer
    // before the ask (word-builder's collidesWithSpokenFrame, in this pack's
    // vocabulary). Measured on the opener MINUS the ask.
    for (const item of [ID_1, MATCH, STORY]) {
      const opening = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
      const frame = opening.replace(askFor(item), ' ');
      for (const word of ORDINAL_WORDS) {
        expect(frame.toLowerCase()).not.toContain(word);
      }
    }
  });

  it('⭐ the counting walk lives ONLY in the correction, never in the ask', () => {
    // It is the scaffold the click era printed under every character. Earned,
    // not given.
    for (const item of [ID_K, ID_1, REL]) {
      expect(askFor(item)).not.toContain('first, second');
      expect(itemCue(item)).toContain('and count —');
    }
  });

  it('every line-reading ask NAMES WHICH END IS THE FRONT', () => {
    // "Third" is meaningless without it, the child cannot read the START label,
    // and counting from the wrong end is the #1 recorded misconception.
    expect(askFor(ID_K)).toContain(frontOf('race'));
    expect(askFor(ID_1)).toContain(frontOf('train'));
    expect(askFor(REL)).toContain(frontOf('race'));
    expect(frontOf('train')).toBe('the engine');
    expect(frontOf('bookshelf')).toBe('the left end of the shelf');
  });

  it('the context channel is answer-free by construction', () => {
    expect(stimulusFor(ID_K)).not.toContain('Fox');
    expect(stimulusFor(ID_1)).not.toContain('third');
    expect(stimulusFor(MATCH)).not.toContain('3rd');
    expect(stimulusFor(MATCH)).not.toContain('third');
    expect(stimulusFor(STORY)).not.toContain(STORY.answerText);
    expect(stimulusFor(STORY)).not.toContain('lined up for the race');
    expect(stimulusFor(REL)).not.toContain('Bear');
  });

  it('tap-to-hear re-speaks the QUESTION and nothing else', () => {
    expect(spokenSpanOf(pronounceCue(REL))).toBe(askFor(REL));
    expect(pronounceCue(REL)).toContain('never say the answer');
    // On the story mode this is what replaces re-reading a printed story.
    expect(spokenSpanOf(pronounceCue(STORY))).toContain(STORY.storyText);
  });

  it('every spoken line is words — no numerals reach the tutor\'s tongue', () => {
    for (const item of [...ITEMS, ID_1]) {
      expect(spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }))).not.toMatch(/\d/);
    }
  });
});

describe('ordinal-line · the DISTAR turn', () => {
  it('affirmations open "Yes," and the correction opens "My turn:"', () => {
    for (const item of [ID_K, ID_1, MATCH, REL, STORY]) {
      const cue = itemCue(item);
      expect(cue).toMatch(/If the answer is right, say exactly: "Yes,/);
      expect(cue).toMatch(/If it is wrong, say exactly: "My turn:/);
    }
  });

  it('the correction re-models THEN re-elicits, and is the same line every time', () => {
    const cue = itemCue(ID_K);
    expect(cue).toContain('My turn: I start at the starting line and count — first, second, third.');
    expect(cue).toContain('The Fox is third.');
    expect(cue).toContain('Your turn. Who is third?');
    expect(cue).toContain('the SAME line on every wrong answer');
  });

  it('⭐ the ordinal correction teaches the CARDINAL CONTRAST on a counted walk', () => {
    // "three tells how many, third tells which one" — the misconception this
    // mode exists to undo, said where it is earned.
    expect(itemCue(ID_1)).toContain('count — one, two, three.');
    expect(itemCue(ID_1)).toContain('Three tells how many; third tells which one.');
    expect(itemCue(MATCH)).toContain('Three tells how many; third tells which one.');
  });

  it('the story correction reads the story AGAIN — the child cannot re-read it', () => {
    expect(itemCue(STORY)).toContain(`My turn: listen again. ${STORY.storyText}`);
    expect(itemCue(STORY)).toContain(`Your turn. What place is the ${STORY.storyName} in?`);
  });

  it('the contract names the signature error per mode', () => {
    // Wrong-end: a line of 5, target 3 → the middle, where the mirror image IS
    // the answer, so the clause falls back to the off-by-one (a real error).
    expect(signatureWrongPosition(5, 2)).toBe(4);
    expect(signatureIsWrongEnd(5, 2)).toBe(true);
    expect(signatureWrongPosition(5, 3)).toBe(4);
    expect(signatureIsWrongEnd(5, 3)).toBe(false);

    const offEnd = one({ ...ID_CH, targetPosition: 2, correctAnswer: '2' }, CTX_K);
    expect(itemCue(offEnd)).toContain('"Bear" is the confident wrong answer here');
    expect(itemCue(offEnd)).toContain('counts from the finish line instead of the front');

    expect(itemCue(MATCH)).toContain('"three" — the counting number on its own');
    expect(itemCue(REL)).toContain('"Fox" is the confident wrong answer here');
    expect(itemCue(REL)).toContain('the one the question POINTS AT');
  });

  it('⭐ the cardinal is REFUSED, never leniently accepted', () => {
    for (const item of [ID_1, MATCH, STORY]) {
      expect(itemCue(item)).toContain('It is WRONG however close it sounds');
      expect(itemCue(item)).toContain('says how MANY, not which ONE');
    }
  });

  it('the accept clause names the right answer that does not look right', () => {
    expect(itemCue(ID_1)).toContain('"the third one", "third place", "he is third" are all the same answer');
    expect(itemCue(ID_K)).toContain('a different word for the same animal counts');
  });

  it('a pointing word gets a VERDICT, not a sentiment (18d on the accept side)', () => {
    // "ask once more for the name" would open with neither sentinel, so the
    // engine would see no verdict and a child who answered would stall.
    for (const item of [ID_K, REL]) {
      expect(itemCue(item)).toContain('treat it as wrong and give the correction');
    }
  });

  it('the two-branch law is stated BEFORE the branches', () => {
    // word-workout's finding: "the SAME correction on every wrong answer" reads
    // as a rule about REPEATS and leaves the first wrong answer apparently free.
    expect(itemCue(ID_K)).toContain('EVERY answer gets exactly one of the two replies below');
    expect(itemCue(ID_K).indexOf('EVERY answer gets exactly one'))
      .toBeLessThan(itemCue(ID_K).indexOf('If the answer is right'));
  });

  it('the verdict ends the turn (VERDICT_ENDS_THE_TURN)', () => {
    expect(itemCue(ID_K)).toContain('never carry on into another question');
  });

  it('the how-to-play is spoken on the opener and never per item', () => {
    const { opening, plain } = cuesOf(ID_K);
    expect(opening).toContain(howToPlayFor(ID_K));
    expect(plain).not.toContain(howToPlayFor(ID_K));
  });

  it('the move-on names NOTHING about the item it just left', () => {
    // Every item of a session shares one line, so a closing line that named the
    // answer would very often name the next item's answer too (word-sorter).
    const cue = moveOnCue(ID_K, null);
    expect(cue).not.toContain('Fox');
    expect(cue).not.toContain('third');
  });
});

describe('ordinal-line · the hands turn', () => {
  it('the arrangement verdict is code-computed and names WHICH fault happened', () => {
    expect(placementVerdictCue(BUILD, BUILD.answerOrder)).toContain('that MATCHES');
    expect(placementVerdictCue(BUILD, [...BUILD.answerOrder].reverse())).toContain('does NOT match');
    expect(placementVerdictCue(BUILD, [BUILD.answerOrder[0]])).toContain('touch all 3 of them');
    expect(placementVerdictCue(BUILD, [])).toContain('nothing');
  });

  it('⭐ a GAPPED line is reported as gapped, never compacted', () => {
    // A child who fills the first and THIRD place has left a hole. Compacting it
    // tells the tutor they filled the first and SECOND — a board that is not on
    // the screen, and the wrong error in the Tier-A evidence.
    const gapped = placementVerdictCue(BUILD, [BUILD.answerOrder[0], '', BUILD.answerOrder[2]]);
    expect(gapped).toContain(`${BUILD.answerOrder[0]}, an empty place, ${BUILD.answerOrder[2]}`);
    expect(gapped).toContain('does NOT match');
    expect(gapped).toContain('touch all 3 of them');
    // And a full line of the right pictures in the wrong PLACES fails
    // positionally rather than as a set.
    expect(placementVerdictCue(BUILD, [
      BUILD.answerOrder[1], BUILD.answerOrder[0], BUILD.answerOrder[2],
    ])).toContain('does NOT match');
  });

  it('the correction models the METHOD, never the arrangement', () => {
    const spoken = spokenSpanOf(placementVerdictCue(BUILD, [...BUILD.answerOrder].reverse()));
    for (const name of BUILD.answerOrder) expect(spoken).not.toContain(name);
    expect(spoken).toContain('I listen for the place word');
  });

  it('the harness encoding round-trips through the adapter shape', () => {
    expect(placeCueForPlaced(BUILD, 1)).toContain('that MATCHES');
    expect(placeCueForPlaced(BUILD, 0)).toContain('does NOT match');
  });
});

describe('ordinal-line · catalog', () => {
  it('the catalog keeps its side of the contract', () => {
    expect(checkDiCatalogEntry(catalogEntry, pack, ID_K)).toEqual([]);
  });

  it('steering names the microphone and no longer points at buttons', () => {
    const steering = `${catalogEntry.description} ${catalogEntry.constraints}`;
    expect(steering).toContain('microphone');
    expect(steering).toContain('DI modality');
    expect(steering).not.toMatch(/taps the character|multiple-choice with|drags each/i);
  });

  it('the band split is recorded where the manifest can route on it', () => {
    const identify = (catalogEntry.evalModes ?? []).find((m) => m.evalMode === 'identify')!;
    expect(identify.description).toContain('BAND-SPLIT');
    expect(identify.description).toContain('Kindergarten');
    expect(identify.description).toContain('Grade 1');
  });

  it('no scaffolding rung offers a speakable replacement line (18d)', () => {
    for (const rung of Object.values(catalogEntry.tutoring?.scaffoldingLevels ?? {})) {
      expect(rung).toMatch(/scripted|script/i);
      expect(rung).not.toMatch(/^\s*"/);
    }
  });

  it('the verdict-ends-the-turn clause is present (VERDICT_ENDS_THE_TURN)', () => {
    const titles = (catalogEntry.tutoring?.aiDirectives ?? []).map((d) => d.title);
    expect(titles).toContain('THE VERDICT ENDS THE TURN');
    expect(titles).toContain('NEVER COUNT THE LINE ALOUD');
  });

  it('every eval mode kept its identity; only the two that RESTRUCTURED moved β', () => {
    const modes = (catalogEntry.evalModes ?? []).map((m) => [m.evalMode, m.beta]);
    expect(modes).toEqual([
      ['identify', 1.5],          // held — a tap over the same visible set became speech
      ['match', 3.0],             // 2.5 → 3.0: the word column (and its elimination) deleted
      ['relative_position', 4.0], // 3.5 → 4.0: a 1-of-4 menu deleted outright
      ['sequence_story', 4.5],    // held — same tier, new channel
      ['build_sequence', 5.5],    // held — same hands surface
    ]);
  });
});

describe('ordinal-line · harness answer material', () => {
  it('mirrors the discrimination claims the contract makes', () => {
    const offEnd = one({ ...ID_CH, targetPosition: 2, correctAnswer: '2' }, CTX_K);
    const a = ordinalLineHarnessAnswers(offEnd);
    expect(a.correct).toBe('Turtle');
    expect(a.signatureWrong?.text).toBe('Bear');
    expect(a.signatureWrong?.why).toContain('wrong-end count');
    expect(itemCue(offEnd)).toContain(`"${a.signatureWrong!.text}" is the confident wrong answer`);

    const m = ordinalLineHarnessAnswers(MATCH);
    expect(m.correct).toBe('third');
    expect(m.signatureWrong?.text).toBe('three');
    expect(itemCue(MATCH)).toContain('"three" — the counting number on its own');

    const r = ordinalLineHarnessAnswers(REL);
    expect(r.correct).toBe('Bear');
    expect(r.signatureWrong?.text).toBe('Fox');
    expect(itemCue(REL)).toContain('"Fox" is the confident wrong answer here');
  });

  it('the story declares its exempt span; no other spoken mode does', () => {
    expect(ordinalLineHarnessAnswers(STORY).leakExemptSpan).toBe(STORY.storyText);
    for (const item of [ID_K, ID_1, MATCH, REL]) {
      expect(ordinalLineHarnessAnswers(item).leakExemptSpan).toBeUndefined();
    }
  });

  it('the hands item commits an arrangement, not a word', () => {
    const b = ordinalLineHarnessAnswers(BUILD);
    expect(b.placed).toEqual({ correct: 1, wrong: 0 });
    expect(b.leakTokens).toEqual([]);
  });
});
