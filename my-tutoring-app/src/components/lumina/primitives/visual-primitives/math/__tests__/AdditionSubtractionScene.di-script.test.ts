/**
 * additionSubtractionSceneScript — the pedagogy lives there, so this is where it
 * is pinned. Pure: no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (`checkPackGates`: benched
 *     response classes, sentinel discipline over every cue, no performed stage
 *     directions, no byte-identical consecutive asks) — in the fixture shape AND
 *     in the real session shape, which is the only one the repeat-ask gate can
 *     see.
 *  2. THE FORK: which modes speak and which keep their hands, including the
 *     act-out band split contract R3 requires. Changing a row here is a contract
 *     change, not an edit.
 *  3. THE DROP CONDITIONS. This primitive's stories are GENERATED PROSE that the
 *     tutor now reads aloud, so the gates are unusually load-bearing: a spoken
 *     answer of zero, an answer above the bench ceiling, arithmetic that does
 *     not model its own operation, a story that opens a sentence with a verdict
 *     sentinel, and — the one writing the spoken ask found — a story that STATES
 *     the number the child is supposed to produce. Nothing is backfilled.
 *  4. ANSWER-LEAK: no spoken ask, hear-again line or context push ever contains
 *     the answer; the asks DO state their problem aloud, because a K-1 child
 *     cannot read the screen and every correction re-ask inherits the ask.
 *  5. Corrections re-model then re-elicit, and they are the FIRST place the
 *     answer is spoken. Each names its signature error and its accept clause.
 *  6. Hand items carry a SILENCE contract and never a spoken judging contract;
 *     the verdict is code-computed, including WHICH of three faults an equation
 *     has.
 *  7. The catalog keeps its side: contextKeys equal exactly what the pack
 *     pushes, every template key resolves, no catalog sentence opens with a
 *     verdict sentinel, and the steering prose no longer sells this primitive as
 *     a typing surface.
 */
import { describe, it, expect } from 'vitest';
import {
  actionFor,
  addSubHarnessAnswers,
  additionSubtractionScenePackBase,
  answerKindFor,
  completeCue,
  equationFaultOf,
  equationVerdictCue,
  isSayableAnswer,
  itemCue,
  itemFromChallenge,
  moveOnCue,
  parseEquationTiles,
  pronounceCue,
  publicValuesFor,
  responseClassFor,
  sceneVerdictCue,
  situationOf,
  stimulusFor,
  storyLeaksAnswer,
  targetValueFor,
  type AddSubChallengeLike,
  type AddSubSceneItem,
} from '../additionSubtractionSceneScript';
import {
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../../service/manifest/catalog/math';
import { fallbackFor } from '../../../../service/math/gemini-addition-subtraction-scene';
import { DI_PORTS } from '../../../../service/qa/di/diDrivePlan';
import { numberWordFor } from '../countingBoardScript';

// ── Fixtures — one item per mode × band, session-shaped ─────────────────────

const K = { band: 'K' } as const;
const G1 = { band: '1' } as const;

const ACT_OUT_ADD: AddSubChallengeLike = {
  id: 'as-1',
  type: 'act-out',
  storyText: '2 ducks are swimming in the pond. 1 more duck joins them.',
  scene: 'pond',
  objectType: 'ducks',
  operation: 'addition',
  startCount: 2,
  changeCount: 1,
  resultCount: 3,
  equation: '2 + 1 = 3',
};

const ACT_OUT_SUB: AddSubChallengeLike = {
  id: 'as-2',
  type: 'act-out',
  storyText: '6 frogs sit on a log. 2 frogs hop away.',
  scene: 'farm',
  objectType: 'frogs',
  operation: 'subtraction',
  startCount: 6,
  changeCount: 2,
  resultCount: 4,
  equation: '6 - 2 = 4',
};

const SOLVE_RESULT: AddSubChallengeLike = {
  id: 'as-3',
  type: 'solve-story',
  storyText: '5 flowers are in the garden. 2 flowers are picked.',
  scene: 'garden',
  objectType: 'flowers',
  operation: 'subtraction',
  startCount: 5,
  changeCount: 2,
  resultCount: 3,
  unknownPosition: 'result',
  equation: '5 - 2 = 3',
};

const SOLVE_CHANGE: AddSubChallengeLike = {
  id: 'as-4',
  type: 'solve-story',
  storyText: '3 birds sit on a branch. Some more birds fly in. Now there are 7 birds.',
  scene: 'garden',
  objectType: 'birds',
  operation: 'addition',
  startCount: 3,
  changeCount: 4,
  resultCount: 7,
  unknownPosition: 'change',
  equation: '3 + 4 = 7',
};

const SOLVE_START: AddSubChallengeLike = {
  id: 'as-5',
  type: 'solve-story',
  storyText: 'Some fish are in the pond. 2 fish swim away. Now there are 5 fish.',
  scene: 'pond',
  objectType: 'fish',
  operation: 'subtraction',
  startCount: 7,
  changeCount: 2,
  resultCount: 5,
  unknownPosition: 'start',
  equation: '7 - 2 = 5',
};

const BUILD_EQ: AddSubChallengeLike = {
  id: 'as-6',
  type: 'build-equation',
  storyText: '4 apples are on the table. 2 more apples are placed on the table.',
  scene: 'kitchen',
  objectType: 'apples',
  operation: 'addition',
  startCount: 4,
  changeCount: 2,
  resultCount: 6,
  equation: '4 + 2 = 6',
};

const CREATE: AddSubChallengeLike = {
  id: 'as-7',
  type: 'create-story',
  storyText: '',
  scene: 'farm',
  objectType: 'birds',
  operation: 'addition',
  startCount: 3,
  changeCount: 2,
  resultCount: 5,
  equation: '3 + 2 = 5',
};

const build = (ch: AddSubChallengeLike, ctx: { band: 'K' | '1' }) => itemFromChallenge(ch, ctx)!;

const ACT_OUT_K = build(ACT_OUT_ADD, K);
// Same challenge, other band — the fork is the point, so it needs its own id to
// sit in one pack beside the Kindergarten build of it.
const ACT_OUT_G1 = build({ ...ACT_OUT_ADD, id: 'as-1b' }, G1);
const ACT_OUT_SUB_G1 = build(ACT_OUT_SUB, G1);
const SOLVE_K = build(SOLVE_RESULT, K);
const SOLVE_CHANGE_G1 = build(SOLVE_CHANGE, G1);
const SOLVE_START_G1 = build(SOLVE_START, G1);
const EQUATION = build(BUILD_EQ, G1);
const CREATE_STORY = build(CREATE, K);

const ITEMS: AddSubSceneItem[] = [
  ACT_OUT_K, ACT_OUT_G1, ACT_OUT_SUB_G1, SOLVE_K,
  SOLVE_CHANGE_G1, SOLVE_START_G1, EQUATION, CREATE_STORY,
];

/** The pack exactly as the component assembles it (minus component closures). */
/**
 * THE PACK UNDER TEST IS THE EXPORTED SURFACE, not a retyped copy of it (19h-i-b
 * port 2). This was a hand-rolled literal, i.e. a second source of truth for the
 * cues and context keys the pedagogy lives in — it could have gone green while
 * the component and the DI harness sent something else.
 */
const packOf = (items: AddSubSceneItem[]): JudgedScriptPack<AddSubSceneItem> =>
  additionSubtractionScenePackBase(items) as JudgedScriptPack<AddSubSceneItem>;

const pack = packOf(ITEMS);

/** The line the tutor actually SPEAKS — the shared parser, so every port reads
 *  the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

const CATALOG_ENTRY = MATH_CATALOG.find((p) => p.id === 'addition-subtraction-scene')!;

// ── 1. The family's structural gates ────────────────────────────────────────

describe('pack gates', () => {
  it('passes every structural gate the family runs', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  // ⚠️ The fixture above is one-item-per-mode, which is the ONE shape
  // `findRepeatedConsecutiveAsks` can never fire on — it compares CONSECUTIVE
  // items of the SAME action. A real session runs several solve-story items back
  // to back, so that is the pack the gate actually exists for.
  it('passes them in the real session shape — several items of one mode in a row', () => {
    const sessionPack = packOf([
      build({ ...SOLVE_RESULT, id: 's-1' }, G1),
      build({ ...SOLVE_CHANGE, id: 's-2' }, G1),
      build({ ...SOLVE_START, id: 's-3' }, G1),
    ]);
    expect(checkPackGates(sessionPack)).toEqual([]);
  });

  it('passes them for a back-to-back hands run too', () => {
    const handsPack = packOf([
      build({ ...ACT_OUT_ADD, id: 'h-1' }, K),
      build({ ...ACT_OUT_SUB, id: 'h-2' }, K),
    ]);
    expect(checkPackGates(handsPack)).toEqual([]);
  });
});

// ── 2. THE FORK — the answer-material split, both directions ────────────────

describe('the answer-material fork', () => {
  it.each([
    ['solve-story', 'K', 'voice', 'number_word_to_20'],
    ['solve-story', '1', 'voice', 'number_word_to_20'],
    ['act-out', '1', 'voice', 'number_word_to_20'],
    ['act-out', 'K', 'gesture', 'manipulation'],
    ['build-equation', 'K', 'gesture', 'manipulation'],
    ['build-equation', '1', 'gesture', 'manipulation'],
    ['create-story', 'K', 'gesture', 'manipulation'],
    ['create-story', '1', 'gesture', 'manipulation'],
  ] as const)('%s @ %s answers by %s (%s)', (kind, band, answerKind, responseClass) => {
    expect(answerKindFor(kind, band)).toBe(answerKind);
    expect(responseClassFor(kind, band)).toBe(responseClass);
  });

  // Contract R3 item 11: at Kindergarten act-out IS direct manipulation and the
  // enacted scene count is the answer. An earlier version asked for a proxy
  // NUMBER and reader-fit deleted it; converting this mode to speech would
  // reintroduce exactly that proxy one layer up.
  it('keeps Kindergarten act-out enacted (contract R3) while Grade 1 speaks its count', () => {
    expect(ACT_OUT_K.answerKind).toBe('gesture');
    expect(ACT_OUT_G1.answerKind).toBe('voice');
    expect(ACT_OUT_K.action).toBe('enact');
    expect(ACT_OUT_G1.action).toBe('count');
  });

  it('gives every mode its own action so the how-to-play re-speaks on a switch', () => {
    expect(new Set(ITEMS.map((i) => i.action)).size).toBe(5);
    expect(actionFor('solve-story', 'K')).toBe('solve');
    expect(actionFor('build-equation', '1')).toBe('write');
    expect(actionFor('create-story', 'K')).toBe('make');
  });

  it('asks solve-story for the value its unknownPosition names', () => {
    expect(SOLVE_K.answer).toBe(3);              // result
    expect(SOLVE_CHANGE_G1.answer).toBe(4);      // change
    expect(SOLVE_START_G1.answer).toBe(7);       // start
    expect(targetValueFor(ACT_OUT_G1)).toBe(3);  // always the result elsewhere
  });
});

// ── 3. THE DROP CONDITIONS — keep or drop, never backfill ───────────────────

describe('build gates', () => {
  it('drops a spoken answer of ZERO — "zero" is an unbenched spoken answer', () => {
    const toNothing: AddSubChallengeLike = {
      ...SOLVE_RESULT, id: 'z-1', startCount: 3, changeCount: 3, resultCount: 0,
      storyText: '3 fish are in the pond. 3 fish swim away.',
    };
    expect(itemFromChallenge(toNothing, G1)).toBeNull();
  });

  // The same zero is FINE with hands on it: the ceiling belongs to the tutor's
  // ear, not to the arithmetic, and a child can legitimately empty a scene.
  it('keeps a gesture answer of zero — the bench binds the ear, not the hands', () => {
    const emptied: AddSubChallengeLike = {
      ...CREATE, id: 'z-2', operation: 'subtraction', startCount: 3, changeCount: 3, resultCount: 0,
      equation: '3 - 3 = 0',
    };
    expect(itemFromChallenge(emptied, K)).not.toBeNull();
  });

  it('drops a spoken answer above the benched ceiling', () => {
    expect(isSayableAnswer(20)).toBe(true);
    expect(isSayableAnswer(21)).toBe(false);
    expect(isSayableAnswer(0)).toBe(false);
    const tooBig: AddSubChallengeLike = {
      ...SOLVE_RESULT, id: 'c-1', startCount: 19, changeCount: 5, resultCount: 24,
      operation: 'addition', storyText: '19 stars are out. 5 more stars appear.',
    };
    expect(itemFromChallenge(tooBig, G1)).toBeNull();
  });

  it('drops arithmetic that does not model its own operation', () => {
    const incoherent: AddSubChallengeLike = { ...SOLVE_RESULT, id: 'i-1', resultCount: 9 };
    expect(itemFromChallenge(incoherent, G1)).toBeNull();
  });

  it('drops a story where nothing happens', () => {
    const still: AddSubChallengeLike = {
      ...ACT_OUT_ADD, id: 'n-1', changeCount: 0, resultCount: 2,
    };
    expect(itemFromChallenge(still, K)).toBeNull();
  });

  // The tutor READS the story, and the engine's verdict scan reads her output:
  // a story sentence opening with an affirm sentinel is scored as a judgment and
  // the lesson advances on nothing (read-aloud-studio's finding).
  it('drops a story whose sentence opens with a verdict sentinel', () => {
    const sentinel: AddSubChallengeLike = {
      ...SOLVE_RESULT, id: 'v-1',
      storyText: '5 flowers are in the garden. Yes, 2 flowers are picked.',
    };
    expect(itemFromChallenge(sentinel, G1)).toBeNull();
  });

  // ⭐ The gate writing the spoken ask produced. Under a Check button the story
  // could say anything; spoken, a story that states the answer hands it over in
  // the tutor's own voice.
  it('drops a story that STATES the number the child must produce', () => {
    const leaksNumeral: AddSubChallengeLike = {
      ...SOLVE_RESULT, id: 'l-1',
      storyText: '5 flowers are in the garden. 2 flowers are picked, leaving 3.',
    };
    const leaksWord: AddSubChallengeLike = {
      ...SOLVE_RESULT, id: 'l-2',
      storyText: '5 flowers are in the garden. 2 flowers are picked, so three are left.',
    };
    expect(itemFromChallenge(leaksNumeral, G1)).toBeNull();
    expect(itemFromChallenge(leaksWord, G1)).toBeNull();
  });

  // …and it must not convict a story for saying a number it is SUPPOSED to say.
  // 4 − 2 = 2 legitimately prints "2" as the change.
  it('does not drop a story for repeating a publicly stated operand', () => {
    const shared: AddSubChallengeLike = {
      ...SOLVE_RESULT, id: 'l-3', startCount: 4, changeCount: 2, resultCount: 2,
      storyText: '4 cookies are on the plate. 2 cookies are eaten.',
    };
    expect(itemFromChallenge(shared, G1)).not.toBeNull();
    expect(storyLeaksAnswer('4 cookies are on the plate. 2 cookies are eaten.', 2, [4, 2])).toBe(false);
  });

  it('knows which numbers each unknown position lets the story say out loud', () => {
    expect(publicValuesFor(SOLVE_K)).toEqual([5, 2]);            // result hidden
    expect(publicValuesFor(SOLVE_CHANGE_G1)).toEqual([3, 7]);    // change hidden
    expect(publicValuesFor(SOLVE_START_G1)).toEqual([2, 5]);     // start hidden
  });

  it('strips the generated question so the pack asks its own', () => {
    expect(situationOf('2 ducks swim. 1 more joins. How many ducks are there now?'))
      .toBe('2 ducks swim. 1 more joins.');
    expect(situationOf('How many ducks are there?')).toBe('');
  });

  it('drops an item whose story is nothing but its own question', () => {
    const questionOnly: AddSubChallengeLike = {
      ...SOLVE_RESULT, id: 'q-1', storyText: 'How many flowers are left?',
    };
    expect(itemFromChallenge(questionOnly, G1)).toBeNull();
  });

  // create-story has no story to gate — the equation IS the prompt, so every
  // number in it is public by design.
  it('does not require a story for create-story', () => {
    expect(itemFromChallenge(CREATE, K)).not.toBeNull();
  });

  // The generator's own last-resort content has to survive the gate it runs, or
  // an empty model response ships a lesson with no items at all.
  it.each(['act-out', 'build-equation', 'solve-story', 'create-story'])(
    'keeps the generator fallback for %s at both bands',
    (type) => {
      expect(itemFromChallenge(fallbackFor(type) as AddSubChallengeLike, K)).not.toBeNull();
      expect(itemFromChallenge(fallbackFor(type) as AddSubChallengeLike, G1)).not.toBeNull();
    },
  );
});

// ── 4. ANSWER LEAK + the stated problem ─────────────────────────────────────

describe('answer leak', () => {
  const voiceItems = ITEMS.filter((i) => i.answerKind === 'voice');

  it('never puts the answer inside a spoken ask', () => {
    for (const item of voiceItems) {
      const spoken = spokenLine(itemCue(item, { opening: false, howToPlay: false }));
      expect(spoken).not.toMatch(new RegExp(`(?<![0-9])${item.answer}(?![0-9])`));
    }
  });

  it('never puts the answer inside a hear-again line', () => {
    for (const item of voiceItems) {
      const spoken = spokenLine(pronounceCue(item));
      expect(spoken).not.toMatch(new RegExp(`(?<![0-9])${item.answer}(?![0-9])`));
    }
  });

  it('pushes an answer-free stimulus on the context channel', () => {
    for (const item of ITEMS) {
      const stimulus = stimulusFor(item);
      expect(stimulus).not.toMatch(/[0-9]/);
    }
  });

  // A pre-reader cannot read the screen, and EVERY correction re-ask inherits
  // the ask — so the situation has to be inside the quoted line, not on it.
  it('states the whole problem aloud in every ask that has a story', () => {
    for (const item of ITEMS.filter((i) => i.situation)) {
      const spoken = spokenLine(itemCue(item, { opening: false, howToPlay: false }));
      expect(spoken).toContain(item.situation);
    }
  });

  it('states the number sentence aloud on create-story, which has no story', () => {
    const spoken = spokenLine(itemCue(CREATE_STORY, { opening: false, howToPlay: false }));
    expect(spoken).toContain('three plus two equals five');
  });

  it('speaks number WORDS, never numerals, in every line the tutor says', () => {
    for (const item of ITEMS) {
      for (const opts of [{ opening: true, howToPlay: true }, { opening: false, howToPlay: false }]) {
        const spoken = spokenLine(itemCue(item, opts));
        // The situation is generated prose and legitimately prints numerals; the
        // pack's OWN words must not.
        const packWords = spoken.split(item.situation).join(' ');
        expect(packWords).not.toMatch(/[0-9]/);
      }
    }
  });
});

// ── 5. Corrections: re-model, then re-elicit ────────────────────────────────

describe('corrections and affirmations', () => {
  it('opens every correction with the correct sentinel and re-elicits', () => {
    for (const item of ITEMS.filter((i) => i.answerKind === 'voice')) {
      const cue = itemCue(item, { opening: false, howToPlay: false });
      expect(cue).toContain('If it is wrong, say exactly: "My turn:');
      expect(cue).toContain('Your turn.');
    }
  });

  it('opens every affirmation with the affirm sentinel and echoes the answer', () => {
    const cue = itemCue(SOLVE_K, { opening: false, howToPlay: false });
    expect(cue).toContain('If the answer is right, say exactly: "Yes, three flowers left."');
  });

  it('earns the answer in the correction — the first place it is ever spoken', () => {
    const cue = itemCue(SOLVE_K, { opening: false, howToPlay: false });
    expect(cue).toContain('My turn: five take away two. Watch me count. One, two, three. Three. Your turn.');
  });

  // The signature error here is echoing a number the story already gave.
  it('names the signature error — a publicly stated operand said back', () => {
    const cue = itemCue(SOLVE_K, { opening: false, howToPlay: false });
    expect(cue).toContain('The story already says "five" and "two" out loud');
    expect(cue).toContain('NOT the answer');
  });

  it('carries the accept clause — counting aloud that LANDS on the answer', () => {
    const cue = itemCue(SOLVE_CHANGE_G1, { opening: false, howToPlay: false });
    expect(cue).toContain('Counting aloud that ENDS on "four" counts as that answer');
  });

  it('models working BACKWARDS when the unknown is not the result', () => {
    expect(itemCue(SOLVE_START_G1, { opening: false, howToPlay: false }))
      .toContain('My turn: work backwards from five');
    expect(itemCue(SOLVE_CHANGE_G1, { opening: false, howToPlay: false }))
      .toContain('My turn: it went from three to seven, so four came.');
  });

  // A hands correction models the story→action mapping, which IS the skill
  // there, and leaves the total to the child's hands.
  it('never says the total in an enacted correction', () => {
    const cue = sceneVerdictCue(ACT_OUT_K, 2);
    const spoken = spokenLine(cue);
    expect(spoken).toContain('My turn: the story says one more come');
    expect(spoken).not.toContain('three');
  });
});

// ── 6. Hand items: silence contract + code-computed verdicts ────────────────

describe('gesture items', () => {
  it('gives every hands item a silence contract and no spoken judging contract', () => {
    for (const item of ITEMS.filter((i) => i.answerKind === 'gesture')) {
      const cue = itemCue(item, { opening: false, howToPlay: false });
      expect(cue).toContain('answers with their HANDS');
      expect(cue).toContain('you then stay completely silent');
      expect(cue).not.toContain('If the answer is right');
    }
  });

  it('never tells a spoken item to ignore the microphone', () => {
    for (const item of ITEMS.filter((i) => i.answerKind === 'voice')) {
      const cue = itemCue(item, { opening: false, howToPlay: false });
      expect(cue).not.toContain('answers with their HANDS');
      expect(cue).toContain('The correct answer is');
    }
  });

  // The wait is a FACT about the turn, never an order — an imperative aimed at
  // the tutor gets performed (ten-frame drive 2 heard "[WAIT silently]" spoken
  // to a child). `findPerformedStageDirections` keeps this structural; this pins
  // the positive form.
  it('states the wait as a fact and names the failure', () => {
    for (const item of ITEMS) {
      const cue = itemCue(item, { opening: false, howToPlay: false });
      expect(cue).toContain('is the ONLY thing you say on this turn');
      expect(cue).toContain('never announce that you are waiting or listening — simply stop speaking');
    }
  });

  it('computes the scene verdict in code, never asking the tutor to count', () => {
    expect(sceneVerdictCue(ACT_OUT_K, 3)).toContain('that MATCHES');
    expect(sceneVerdictCue(ACT_OUT_K, 2)).toContain('does NOT match');
  });

  it('names WHICH of the three equation faults happened', () => {
    expect(equationFaultOf(EQUATION, ['4', '+', '2', '=', '6'])).toBe('match');
    expect(equationFaultOf(EQUATION, ['4', '+', '2', '=', '7'])).toBe('arithmetic');
    expect(equationFaultOf(EQUATION, ['6', '-', '2', '=', '4'])).toBe('operator');
    expect(equationFaultOf(EQUATION, ['3', '+', '2', '=', '5'])).toBe('numbers');
    expect(equationFaultOf(EQUATION, ['4', '+'])).toBe('incomplete');
  });

  it('tells the child what went wrong, not just that it is wrong', () => {
    expect(spokenLine(equationVerdictCue(EQUATION, ['6', '-', '2', '=', '4'])))
      .toContain('come together, so we need a plus');
    expect(spokenLine(equationVerdictCue(EQUATION, ['4', '+'])))
      .toContain('a number sentence needs two numbers');
  });

  // The structural close is a SHAPE check, never a correctness check: a finished
  // sentence that is wrong commits exactly as readily as one that is right —
  // which is the property a Check button used to fake.
  it('parses a finished sentence whether or not it is correct', () => {
    expect(parseEquationTiles(['4', '+', '2', '=', '6'])).not.toBeNull();
    expect(parseEquationTiles(['4', '+', '2', '=', '9'])).not.toBeNull();
    expect(parseEquationTiles(['4', '+', '2'])).toBeNull();
  });
});

// ── 7. The catalog's side of the contract ───────────────────────────────────

describe('catalog entry', () => {
  it('matches the pack — audio mode, contextKeys, template keys, sentinels', () => {
    expect(checkDiCatalogEntry(CATALOG_ENTRY, pack, SOLVE_K)).toEqual([]);
  });

  // Steering regression: "students act out stories by tapping" routed this
  // primitive as a click surface forever. The description now has to say the
  // child SPEAKS, and the constraints have to name the microphone.
  it('steers the manifest at a spoken primitive, not a typing one', () => {
    expect(CATALOG_ENTRY.description).toMatch(/SAY the number OUT LOUD/);
    expect(CATALOG_ENTRY.constraints).toMatch(/Requires a microphone/);
    expect(CATALOG_ENTRY.constraints).toMatch(/no typed answer and no numeral menu/);
  });

  // A MIXED pack must say what counts as an answer PER DIRECTION —
  // letter-spotter's block claimed "every answer is a touch" while one of its
  // modes was spoken.
  it('describes both answer surfaces, keyed to the challenge type', () => {
    const answersBlock = CATALOG_ENTRY.tutoring?.aiDirectives
      ?.find((d) => d.title.startsWith('WHAT COUNTS AS AN ANSWER'));
    expect(answersBlock).toBeDefined();
    expect(answersBlock!.instruction).toContain('{{challengeType}}');
    expect(answersBlock!.instruction).toMatch(/On a SPOKEN item/);
    expect(answersBlock!.instruction).toMatch(/On a HANDS item/);
  });

  it('keeps R1 alive — the story is read aloud, now as the scripted line', () => {
    const storyBlock = CATALOG_ENTRY.tutoring?.aiDirectives
      ?.find((d) => d.title.includes('THE STORY IS INSIDE THE SCRIPTED LINE'));
    expect(storyBlock).toBeDefined();
    expect(storyBlock!.instruction).toMatch(/never summarise it/i);
  });

  it('holds every beta — the modality changed, the production demand did not', () => {
    const betas = Object.fromEntries(
      (CATALOG_ENTRY.evalModes ?? []).map((m) => [m.evalMode, m.beta]),
    );
    expect(betas).toEqual({
      act_out: 1.5,
      build_equation: 2.5,
      solve_story: 3.5,
      create_story: 4.5,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 19h-i-b — the DI adapter wire (port 2)
// ══════════════════════════════════════════════════════════════════════════

describe('harness answers mirror the judging contract', () => {
  it('VOICE: the signature wrong is an operand THE STORY SAID ALOUD', () => {
    // `discriminationFor`'s echo clause is the claim; this is the claim made
    // testable. A judge that only checks arithmetic affirms it.
    for (const item of ITEMS.filter((i) => i.answerKind === 'voice')) {
      const answers = addSubHarnessAnswers(item);
      const sig = answers.signatureWrong!;
      expect(answers.correct).toBe(numberWordFor(item.answer));
      const echoed = publicValuesFor(item).find((v) => v !== item.answer);
      if (echoed !== undefined) {
        expect(sig.text).toBe(numberWordFor(echoed));
        // …and the contract has to actually make that claim.
        expect(itemCue(item, {})).toContain(`"${numberWordFor(echoed)}"`);
        // The clause agrees in number with how many operands the story states.
        expect(itemCue(item, {})).toMatch(/(is|are) NOT the answer/);
      }
    }
  });

  it('BUILD-EQUATION: the wrong sentence is arithmetically VALID, direction reversed', () => {
    // The one fault of the three that is a misconception about the STORY
    // rather than a slip — and the only one a judge that never read the story
    // cannot catch. `equationFaultOf` must classify it `operator`.
    const eq = ITEMS.find((i) => i.kind === 'build-equation')!;
    const answers = addSubHarnessAnswers(eq);
    const wrongTiles = answers.tapped!.wrong.split(' ');
    expect(equationFaultOf(eq, answers.tapped!.correct.split(' '))).toBe('match');
    expect(equationFaultOf(eq, wrongTiles)).toBe('operator');
    // Arithmetically valid on its own terms — that is what makes it sharp.
    const parsed = parseEquationTiles(wrongTiles)!;
    expect(parsed).not.toBeNull();
    expect(parsed.op === '+' ? parsed.left + parsed.right : parsed.left - parsed.right)
      .toBe(parsed.result);
  });

  it('SCENE gestures commit a COUNT, and the wrong count is reachable', () => {
    for (const item of ITEMS.filter((i) => i.answerKind === 'gesture' && i.kind !== 'build-equation')) {
      const placed = addSubHarnessAnswers(item).placed!;
      expect(placed.correct).toBe(item.answer);
      expect(placed.wrong).not.toBe(placed.correct);
      expect(placed.wrong).toBeGreaterThanOrEqual(0);
    }
  });

  it('the STORY is exempt from the leak scan, but nothing else is', () => {
    // A story legitimately states its public operands; the greeting,
    // how-to-play, question and hand-over stay governed (story-talk's
    // mechanism, second use).
    const solve = ITEMS.find((i) => i.kind === 'solve-story')!;
    const answers = addSubHarnessAnswers(solve);
    expect(answers.leakExemptSpan).toBe(solve.situation);
    expect(answers.leakTokens).toEqual([numberWordFor(solve.answer)]);
    // The ask outside the story never names the answer.
    const ask = spokenLine(itemCue(solve, {}));
    const outsideStory = ask.replace(solve.situation, ' ');
    expect(outsideStory.toLowerCase()).not.toContain(numberWordFor(solve.answer));
  });
});

describe('the registered DI adapter', () => {
  const adapter = DI_PORTS['addition-subtraction-scene'];

  it('is registered, so `--di` can drive this port', () => {
    expect(adapter).toBeDefined();
  });

  it('rebuilds the SAME items the component builds, through the same drop gates', () => {
    const data = {
      gradeBand: '1',
      challenges: [
        {
          id: 'ok', type: 'solve-story', operation: 'addition',
          startCount: 3, changeCount: 2, resultCount: 5, unknownPosition: 'result',
          storyText: 'Three ducks were in the pond. Two more swam over.',
          scene: 'pond', objectType: 'ducks', equation: '3 + 2 = 5',
        },
        {
          // Inconsistent arithmetic — dropped, never repaired into an ask.
          id: 'bad', type: 'solve-story', operation: 'addition',
          startCount: 3, changeCount: 2, resultCount: 9, unknownPosition: 'result',
          storyText: 'Three ducks were in the pond. Two more swam over.',
          scene: 'pond', objectType: 'ducks', equation: '3 + 2 = 9',
        },
      ],
    } as unknown as Record<string, unknown>;
    const built = adapter.build(data);
    expect(built.items.map((i) => i.id)).toEqual(['ok']);
    expect(built.dropped).toBe(1);
    expect(built.surface.primitiveType).toBe('addition-subtraction-scene');
    expect(built.surface.itemCue(built.items[0], { opening: false, howToPlay: false }))
      .toBe(itemCue(built.items[0] as AddSubSceneItem, { opening: false, howToPlay: false }));
  });

  it('routes BOTH gesture commit shapes — a count and a tile list — off one wire', () => {
    const scene = ITEMS.find((i) => i.answerKind === 'gesture' && i.kind !== 'build-equation')!;
    const eq = ITEMS.find((i) => i.kind === 'build-equation')!;
    expect(adapter.gestureVerdictCue!(scene, scene.answer)).toContain('MATCHES');
    expect(adapter.gestureVerdictCue!(scene, scene.answer + 1)).toContain('does NOT match');
    const eqAnswers = addSubHarnessAnswers(eq);
    expect(adapter.gestureVerdictCue!(eq, eqAnswers.tapped!.correct)).toContain('MATCHES');
    expect(adapter.gestureVerdictCue!(eq, eqAnswers.tapped!.wrong)).toContain('does NOT match');
  });
});

describe('the two-branch law (cap-drill finding, 2026-08-15 — 19h-i-f, 2nd port)', () => {
  it('every voice contract states the law BEFORE its branches', () => {
    for (const item of ITEMS.filter((i) => i.answerKind === 'voice')) {
      const cue = itemCue(item, {});
      expect(cue).toContain('Your whole reply to their attempt is ONE of the quoted lines below');
      expect(cue).toContain('no scaffolding line');
      expect(cue.indexOf('Your whole reply')).toBeLessThan(cue.indexOf('If the answer is right'));
    }
  });

  it('THE CATALOG SCAFFOLD RUNGS CARRY A SENTINEL — a bare rung stalls the loop', () => {
    // The cap drill caught the model speaking level 2 and level 3 verbatim on
    // corrections 2 and 3 ("…think about what happened in the story", "Take
    // your time. Look at the picture. Then tell me."), neither opening with a
    // sentinel, so the loop recorded di-no-verdict twice and the counter froze.
    const levels = Object.values(CATALOG_ENTRY.tutoring!.scaffoldingLevels ?? {}) as string[];
    expect(levels).toHaveLength(3);
    for (const level of levels) {
      expect(level).toMatch(/scripted correction|say nothing further/i);
    }
    const prose = JSON.stringify(CATALOG_ENTRY.tutoring);
    expect(prose).not.toContain('Take your time. Look at the picture.');
    expect(prose).not.toContain('Think about what happened in the story"');
  });
});
