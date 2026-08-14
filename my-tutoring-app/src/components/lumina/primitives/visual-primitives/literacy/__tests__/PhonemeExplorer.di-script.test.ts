/**
 * phonemeExplorerScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (validateJudgedScriptPack).
 *  2. ANSWER-LEAK: blend's ask never contains the word, segment's ask never
 *     contains the count, manipulate's ask never contains the result — and the
 *     BUILD GATES drop items that would break those rules (answer inside the
 *     operation prose, example word in the menu, unsayable blend walk).
 *  3. Phonemes in spoken lines are voice-safe: bare vowels get letter-derived
 *     spellings (a bare 'a' left raw reads as the letter NAME), IPA maps, and
 *     an unsayable blend walk drops the ITEM (the walk IS the ask).
 *  4. Corrections re-model then re-elicit; the answer is EARNED there.
 *  5. The support-tier ask levers hold: enumeration off drops the menu from
 *     the spoken ask; the worked-example clause follows its card.
 *  6. The catalog keeps its side: template keys resolve against exactly what
 *     the pack pushes, and no catalog sentence opens with a verdict sentinel.
 */
import { describe, it, expect } from 'vitest';
import {
  completeCue,
  hearSoundCue,
  hearWordCue,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  pronounceCue,
  responseClassFor,
  spokenOperation,
  spokenPhonemeToken,
  stimulusFor,
  walkFor,
  type PhonemeExplorerItem,
} from '../phonemeExplorerScript';
import {
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — one item per mode, session-shaped ────────────────────────────

const ISOLATE = itemFromChallenge({
  id: 'c1', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm',
  exampleWord: 'mouse', exampleEmoji: '🐭',
  choices: [
    { word: 'moon', emoji: '🌙', correct: true },
    { word: 'dog', emoji: '🐶', correct: false },
    { word: 'fish', emoji: '🐟', correct: false },
    { word: 'cake', emoji: '🍰', correct: false },
  ],
})!;
const BLEND = itemFromChallenge({
  id: 'c2', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱',
})!;
const SEGMENT = itemFromChallenge({
  id: 'c3', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'],
})!;
const MANIPULATE = itemFromChallenge({
  id: 'c4', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱',
  operation: 'substitute', operationDescription: "Change the /k/ in 'cat' to /b/",
  resultWord: 'bat', resultEmoji: '🦇',
})!;

const ITEMS: PhonemeExplorerItem[] = [ISOLATE, BLEND, SEGMENT, MANIPULATE];

/** The pack exactly as the component assembles it (minus component closures). */
const pack: JudgedScriptPack<PhonemeExplorerItem> = {
  primitiveType: 'phoneme-explorer',
  activityLine: 'live direct instruction phoneme awareness practice',
  items: ITEMS,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({ challengeType: item.kind, stimulus: stimulusFor(item) }),
};

/** The line the tutor actually SPEAKS — the shared parser, so every port reads
 *  the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('phoneme-explorer pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('two items in the SAME mode do not recite the ask twice', () => {
    // One item per mode is the ONE pack shape that cannot trigger the repeat
    // gate — it compares consecutive items of the same action, and a real
    // session runs several blend items in a row.
    const twice = [
      itemFromChallenge({ id: 'b1', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' })!,
      itemFromChallenge({ id: 'b2', mode: 'blend', phonemeSequence: ['p', 'i', 'g'], word: 'pig', emoji: '🐷' })!,
    ];
    expect(checkPackGates({ ...pack, items: twice })).toEqual([]);
  });

  it('every mode is voice; segment answers with a benched number word', () => {
    for (const item of ITEMS) expect(item.answerKind).toBe('voice');
    expect(responseClassFor('segment')).toBe('number_word_to_20');
    expect(responseClassFor('isolate')).toBe('short_spoken_word');
    expect(responseClassFor('blend')).toBe('short_spoken_word');
    expect(responseClassFor('manipulate')).toBe('short_spoken_word');
    expect(SEGMENT.answer).toBe('three');
    expect(SEGMENT.soundCount).toBe(3);
  });

  it('stamps action per item so mixed sessions re-speak the how-to-play on mode change', () => {
    for (const item of ITEMS) expect(item.action).toBe(item.kind);
  });
});

// ── 2. Phonemes in spoken lines are voice-safe ──────────────────────────────

describe('phoneme-explorer pack · phoneme voice safety', () => {
  it('bare vowels get letter-derived spellings; consonants keep slashed ASCII', () => {
    // REVERT-BITE: a bare 'a' left raw in a spoken line reads as the letter
    // NAME "ay" — the exact wrong sound (cvc-speller's finding).
    expect(spokenPhonemeToken('a')).toBe('aaa');
    expect(spokenPhonemeToken('k')).toBe('/k/');
    expect(spokenPhonemeToken('/æ/')).toBe('aaa');
    expect(spokenPhonemeToken('sh')).toBe('/sh/');
  });

  it("the blend walk paces the sounds and never contains the answer", () => {
    expect(BLEND.walk).toBe('/k/ … aaa … /t/');
    expect(spokenLine(itemCue(BLEND))).not.toContain('cat');
  });

  it('an unsayable walk DROPS the blend item — the walk IS the ask', () => {
    expect(walkFor(['k', '⁇', 't'])).toBeNull();
    expect(itemFromChallenge({
      id: 'x', mode: 'blend', phonemeSequence: ['k', '⁇', 't'], word: 'cat', emoji: '🐱',
    })).toBeNull();
  });

  it('operation prose speaks its phonemes safely', () => {
    expect(spokenOperation("Change the /æ/ in 'cat' to /ɪ/")).toContain('aaa');
    expect(spokenOperation("Change the /æ/ in 'cat' to /ɪ/")).toContain('iii');
    expect(MANIPULATE.operationSpoken).toBe("Change the /k/ in 'cat' to /b/.");
  });
});

// ── 3. Answer-leak: asks and context pushes stay question-side ──────────────

describe('phoneme-explorer pack · answer-leak', () => {
  it('asks state their problem and never their answer', () => {
    const isolate = spokenLine(itemCue(ISOLATE));
    expect(isolate).toContain('mmm');
    expect(isolate).toContain('moon, dog, fish, cake'); // the menu IS the question
    const segment = spokenLine(itemCue(SEGMENT));
    expect(segment).toContain('sheep');
    expect(segment).not.toContain('three');
    const manipulate = spokenLine(itemCue(MANIPULATE));
    expect(manipulate).toContain('cat');
    expect(manipulate).not.toContain('bat');
  });

  it('build gates drop items whose ask would contain the answer', () => {
    // The operation prose says the result — an ask that answers itself.
    expect(itemFromChallenge({
      id: 'x', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱',
      operation: 'substitute', operationDescription: "Change cat to bat",
      resultWord: 'bat', resultEmoji: '🦇',
    })).toBeNull();
    // The example word in the menu is a second right answer.
    expect(itemFromChallenge({
      id: 'x', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm',
      exampleWord: 'moon', exampleEmoji: '🌙',
      choices: [
        { word: 'moon', emoji: '🌙', correct: true },
        { word: 'dog', emoji: '🐶', correct: false },
        { word: 'fish', emoji: '🐟', correct: false },
        { word: 'cake', emoji: '🍰', correct: false },
      ],
    })).toBeNull();
    // A count outside the benched range has no honest spoken answer.
    expect(itemFromChallenge({
      id: 'x', mode: 'segment', targetWord: 'a', targetEmoji: '🅰️', segments: ['a'],
    })).toBeNull();
    expect(itemsFromChallenges([
      { id: 'ok', mode: 'blend', phonemeSequence: ['s', 'u', 'n'], word: 'sun', emoji: '☀️' },
      { id: 'bad', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱', operation: 'substitute', operationDescription: 'Say bat', resultWord: 'bat', resultEmoji: '🦇' },
    ])).toHaveLength(1);
  });

  it('context pushes are question-side only', () => {
    expect(stimulusFor(BLEND)).toBe('/k/ … aaa … /t/');
    expect(stimulusFor(BLEND)).not.toContain('cat');
    expect(stimulusFor(SEGMENT)).toBe('sheep');
    expect(stimulusFor(MANIPULATE)).not.toContain('bat');
  });

  it('tap-to-hear cues speak question-side audio only', () => {
    expect(hearWordCue('sheep')).toContain('"sheep"');
    expect(hearSoundCue('a')).toContain('"aaa"');
    expect(pronounceCue(SEGMENT)).not.toContain('three');
    expect(pronounceCue(MANIPULATE)).not.toContain('bat');
  });
});

// ── 4. Corrections re-model then re-elicit; the answer is EARNED there ──────

describe('phoneme-explorer pack · corrections and contracts', () => {
  it('every correction opens with the correct sentinel, names the answer, and re-elicits', () => {
    expect(itemCue(ISOLATE)).toContain('If it is wrong, say exactly: "My turn:');
    expect(itemCue(ISOLATE)).toContain('moon starts with mmm');
    expect(itemCue(BLEND)).toContain('/k/ … aaa … /t/ … cat');
    expect(itemCue(SEGMENT)).toContain('Three sounds');
    expect(itemCue(MANIPULATE)).toContain('cat becomes bat');
  });

  it('names what looks like an answer and is not, per mode', () => {
    expect(itemCue(ISOLATE)).toContain('is my example, not one of the cards');
    expect(itemCue(BLEND)).toContain('separate sounds with NO word at the end');
    expect(itemCue(SEGMENT)).toContain('Saying the word "sheep" back is not an answer');
    expect(itemCue(MANIPULATE)).toContain('"cat" said back is NOT the answer');
  });

  it('carries the accept side — counting or sounding out that LANDS on the answer', () => {
    expect(itemCue(BLEND)).toContain('LANDING on "cat" counts');
    expect(itemCue(SEGMENT)).toContain('ENDS on "three" counts');
  });

  it('segment affirms with the count and its unit', () => {
    expect(itemCue(SEGMENT)).toContain('"Yes, three sounds."');
  });
});

// ── 5. Support-tier ask levers ──────────────────────────────────────────────

describe('phoneme-explorer pack · tier levers in the ask', () => {
  it('enumeration off drops the menu from the spoken ask (readers read the cards)', () => {
    const quiet = itemFromChallenge({
      id: 'c1', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm',
      exampleWord: 'mouse', exampleEmoji: '🐭', readOptionsAloud: false,
      choices: [
        { word: 'moon', emoji: '🌙', correct: true },
        { word: 'dog', emoji: '🐶', correct: false },
        { word: 'fish', emoji: '🐟', correct: false },
        { word: 'cake', emoji: '🍰', correct: false },
      ],
    })!;
    expect(spokenLine(itemCue(quiet))).not.toContain('moon, dog, fish, cake');
    expect(spokenLine(itemCue(quiet))).toContain('Read the cards');
  });

  it('the worked-example clause follows its card', () => {
    expect(spokenLine(itemCue(ISOLATE))).toContain('like mouse');
    const bare = itemFromChallenge({
      id: 'c1', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm',
      exampleWord: 'mouse', exampleEmoji: '🐭', showExampleWord: false,
      choices: [
        { word: 'moon', emoji: '🌙', correct: true },
        { word: 'dog', emoji: '🐶', correct: false },
        { word: 'fish', emoji: '🐟', correct: false },
        { word: 'cake', emoji: '🍰', correct: false },
      ],
    })!;
    expect(spokenLine(itemCue(bare))).not.toContain('like mouse');
  });
});

// ── 6. Session frame + the catalog contract ─────────────────────────────────

describe('phoneme-explorer pack · session frame and catalog', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'phoneme-explorer')!;

  it('the opening cue has ONE job; the final cues stop the tutor', () => {
    const opening = spokenLine(itemCue(ISOLATE, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time to play with sounds!');
    expect(opening).toContain('the word that starts with my sound');
    expect(moveOnCue(MANIPULATE, null)).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, BLEND)).toEqual([]);
  });
});
