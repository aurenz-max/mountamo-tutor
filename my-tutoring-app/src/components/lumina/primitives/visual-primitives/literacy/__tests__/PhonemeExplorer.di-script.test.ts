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
  leakExemptSpanFor,
  moveOnCue,
  phonemeExplorerHarnessAnswers,
  phonemeExplorerPackBase,
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

/**
 * The pack exactly as the component assembles it, from the EXPORTED surface —
 * not a hand-rolled literal. The literal that used to sit here was a second
 * source of truth for the tutor's side of the wire, which is the drift 19f found
 * on both sides of letter-spotter's. The component and the DI drive-plan
 * endpoint spread this same builder.
 */
const pack: JudgedScriptPack<PhonemeExplorerItem> = phonemeExplorerPackBase(ITEMS);

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

  it('c, q and x are LETTERS, not phonemes — a walk built on one is unaskable', () => {
    // Caught by probe: "cow" came back as ["c","o","w"] and "duck" as
    // ["d","u","c"], so the tutor was asking a child to blend /c/ … ooo … /w/
    // and expecting "cow". Each of these letters stands for a sound it does not
    // name (/k/ or /s/, /kw/, /ks/), so there is nothing a voice can say for it.
    expect(spokenPhonemeToken('c')).toBeNull();
    expect(spokenPhonemeToken('/c/')).toBeNull();
    expect(spokenPhonemeToken('q')).toBeNull();
    expect(spokenPhonemeToken('x')).toBeNull();
    // The real sounds those letters stand for are fine, and so are digraphs.
    expect(spokenPhonemeToken('k')).toBe('/k/');
    expect(spokenPhonemeToken('s')).toBe('/s/');
    expect(spokenPhonemeToken('ch')).toBe('/ch/');
    expect(itemFromChallenge({
      id: 'x', mode: 'blend', phonemeSequence: ['c', 'o', 'w'], word: 'cow', emoji: '🐮',
    })).toBeNull();
    // segment only DEGRADES — its ask speaks the word, so only the correction
    // wanted the walk, and it names the count without one.
    const seg = itemFromChallenge({
      id: 's', mode: 'segment', targetWord: 'duck', targetEmoji: '🦆', segments: ['d', 'u', 'c'],
    })!;
    expect(seg.segmentWalk).toBeNull();
    expect(itemCue(seg)).toContain('duck has three sounds');
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

  it('every rung of the scaffolding ladder routes through the scripted correction (18d)', () => {
    // The defect this bites: level1 said "Say the question once more, then wait
    // for them alone." and level2 "Say the sounds again, slowly and clearly."
    // A re-spoken ask opens with NEITHER sentinel, so the reducer records no
    // verdict and the correction counter freezes with the child waiting.
    // level3 was always correct — which is why a per-ENTRY grep reported this
    // entry clean. Assert per RUNG.
    const rungs = Object.values(entry.tutoring!.scaffoldingLevels!);
    expect(rungs).toHaveLength(3);
    for (const rung of rungs) {
      expect(rung.toLowerCase()).toContain('scripted correction line');
      expect(rung.toLowerCase()).not.toMatch(/say the (question|sounds) (once more|again)/);
    }
  });

  it('no commonStruggles response to an ATTEMPT offers a re-spoken ask (18d)', () => {
    // The census fingerprint cannot see this one at all. A letter name IS an
    // attempt, so a verdict is owed; "say the sound once more, then ask again"
    // owes none. The silence row is EXEMPT and deliberately so — silence is not
    // an attempt, so a re-spoken ask is the correct move there.
    for (const struggle of entry.tutoring!.commonStruggles!) {
      if (/goes quiet|says nothing|silent/i.test(struggle.pattern)) continue;
      expect(struggle.response.toLowerCase()).not.toMatch(
        /say the (sound|question|word) once more/,
      );
    }
  });
});

// ── 7. The judged-loop harness surface (19h-i-b port 5) ─────────────────────

describe('phoneme-explorer · DI harness surface', () => {
  it('states the two-branch law BEFORE the branches on every mode', () => {
    // 18d: the law has to arrive before "If the answer is right", or a model
    // reading top-down has already met both branches when it is told they are
    // the only two. Wording is byte-shared with the family so a grep finds it.
    for (const item of ITEMS) {
      const cue = itemCue(item);
      const law = cue.indexOf('Your whole reply to their attempt is ONE of the quoted lines below');
      expect(law).toBeGreaterThan(-1);
      expect(cue).toContain('no scaffolding line');
      expect(law).toBeLessThan(cue.indexOf('If the answer is right'));
    }
  });

  it('gives every cue the NEVER_PERFORM tail (item 21)', () => {
    // This port is four listening tasks, so the tutor holds long silences with
    // tiles animating under it — "announce that you are waiting" is exactly the
    // filler a model reaches for there, and it opens with neither sentinel.
    const cues = [
      itemCue(ISOLATE), itemCue(SEGMENT),
      moveOnCue(BLEND, MANIPULATE),
      pronounceCue(SEGMENT), hearWordCue('sheep'), hearSoundCue('a'),
    ];
    for (const cue of cues) {
      expect(cue).toContain('never announce the activity\'s state');
      expect(cue).toContain('never announce that you are waiting or listening');
    }
  });

  it('the surface the harness replays IS the one the component spreads', () => {
    const surface = phonemeExplorerPackBase(ITEMS);
    expect(surface.primitiveType).toBe('phoneme-explorer');
    expect(surface.items).toBe(ITEMS);
    expect(surface.itemCue(BLEND, { opening: true, howToPlay: true }))
      .toBe(itemCue(BLEND, { opening: true, howToPlay: true }));
    expect(surface.contextFor(SEGMENT)).toEqual({ challengeType: 'segment', stimulus: 'sheep' });
  });

  it('exempts ONLY the isolate menu clause from the leak oracle, and only when spoken', () => {
    // The four cards ARE the question — reading them aloud is the ask. Every
    // other mode's ask is answer-free, so the oracle stays flat there; emptying
    // leakTokens instead would switch the oracle off.
    expect(leakExemptSpanFor(ISOLATE)).toBe('The words are: moon, dog, fish, cake.');
    expect(ISOLATE.answer).toBe('moon');
    // ... and the exemption is a SPAN OF THE ASK, not a paraphrase of it.
    expect(itemCue(ISOLATE)).toContain(leakExemptSpanFor(ISOLATE)!);
    for (const item of [BLEND, SEGMENT, MANIPULATE]) {
      expect(leakExemptSpanFor(item)).toBeUndefined();
    }
    // Hard tier: the ask never reads the menu, so no exemption is issued.
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
    expect(leakExemptSpanFor(quiet)).toBeUndefined();
  });

  it('every signature wrong is the contract\'s OWN named miss, not a random word', () => {
    // The point of the drive: `wrongClauseFor` CLAIMS the judge refuses each of
    // these. If a claim changes here without changing there, the harness stops
    // testing the contract and starts testing a fiction.
    const isolate = phonemeExplorerHarnessAnswers(ISOLATE);
    expect(isolate.signatureWrong!.text).toBe('mouse');           // the tutor's own example
    expect(itemCue(ISOLATE)).toContain('is my example, not one of the cards');

    const blend = phonemeExplorerHarnessAnswers(BLEND);
    expect(blend.signatureWrong!.text).toBe('/k/ … aaa … /t/');   // sounds, no word
    expect(itemCue(BLEND)).toContain('separate sounds with NO word at the end');

    const segment = phonemeExplorerHarnessAnswers(SEGMENT);
    expect(segment.correct).toBe('three');
    expect(segment.signatureWrong!.text).toBe('one, two, three, four'); // one PAST
    expect(itemCue(SEGMENT)).toContain('ENDS on "three" counts');

    const manipulate = phonemeExplorerHarnessAnswers(MANIPULATE);
    expect(manipulate.signatureWrong!.text).toBe('cat');          // unchanged original
    expect(itemCue(MANIPULATE)).toContain('"cat" said back is NOT the answer');
  });

  it('a plain wrong is a real alternative, never the answer', () => {
    for (const item of ITEMS) {
      const answers = phonemeExplorerHarnessAnswers(item);
      expect(answers.correct).toBe(item.answer);
      expect(answers.plainWrong.toLowerCase()).not.toBe(item.answer.toLowerCase());
      expect(answers.leakTokens).toEqual([item.answer]);
    }
    // isolate's plain wrong is a card the stage actually renders.
    expect((ISOLATE.menu ?? []).map((c) => c.word))
      .toContain(phonemeExplorerHarnessAnswers(ISOLATE).plainWrong);
  });

  it('the isolate ask cannot hand over a card inside its own SOUND label', () => {
    // `phonemeSound` is free text from the model and it is the first thing the
    // ask says aloud. A model that writes the mnemonic instead of the sound
    // answers the item before the menu is even read.
    expect(itemFromChallenge({
      id: 'x', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm, as in moon',
      exampleWord: 'mouse', exampleEmoji: '🐭',
      choices: [
        { word: 'moon', emoji: '🌙', correct: true },
        { word: 'dog', emoji: '🐶', correct: false },
        { word: 'fish', emoji: '🐟', correct: false },
        { word: 'cake', emoji: '🍰', correct: false },
      ],
    })).toBeNull();
  });
});

// ── 8. The SESSION-level gate — a leak no single item can carry ─────────────

describe('phoneme-explorer pack · cross-item answer leaks', () => {
  it('drops a blend item whose word an earlier segment ask already spoke', () => {
    // The generator fans out ONE CALL PER MODE IN PARALLEL — four prompts that
    // never see each other's words, all handed the same topic and (at K) the
    // same worked list. "How many sounds in sheep?" followed by a blend item
    // answering "sheep" is not blending; it is recall. Neither item is wrong
    // alone, which is why this cannot be a per-item gate.
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'segment', targetWord: 'sheep', targetEmoji: '🐑', segments: ['sh', 'ee', 'p'] },
      { id: 'c2', mode: 'blend', phonemeSequence: ['sh', 'ee', 'p'], word: 'sheep', emoji: '🐑' },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1']);
  });

  it('drops a blend item whose word an earlier manipulate ask said aloud', () => {
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱',
        operation: 'substitute', operationDescription: "Change the /k/ in 'cat' to /b/",
        resultWord: 'bat', resultEmoji: '🦇' },
      { id: 'c2', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1']);
  });

  it('drops an item whose answer sat on an earlier isolate CARD', () => {
    // The cards are printed at every tier and read aloud at most of them.
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm',
        exampleWord: 'mouse', exampleEmoji: '🐭',
        choices: [
          { word: 'moon', emoji: '🌙', correct: true },
          { word: 'bat', emoji: '🦇', correct: false },
          { word: 'fish', emoji: '🐟', correct: false },
          { word: 'cake', emoji: '🍰', correct: false },
        ] },
      { id: 'c2', mode: 'manipulate', originalWord: 'cat', originalEmoji: '🐱',
        operation: 'substitute', operationDescription: "Change the /k/ in 'cat' to /b/",
        resultWord: 'bat', resultEmoji: '🦇' },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1']);
  });

  it('does NOT drop an isolate item just for reusing a heard word — it SELECTS', () => {
    // The distinction that keeps the gate honest. isolate's answer is picked
    // from four cards visible at the moment of the ask, so having met "duck"
    // before says nothing about which card starts with /d/. Gating it flatly
    // cost real items on the probe: a farm-animal draw reuses ten words across
    // five menus and twenty card slots, so overlap is the norm.
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'isolate', phoneme: 'K', phonemeSound: 'kuh',
        exampleWord: 'cow', exampleEmoji: '🐮',
        choices: [
          { word: 'cat', emoji: '🐱', correct: true },
          { word: 'duck', emoji: '🦆', correct: false },
          { word: 'pig', emoji: '🐷', correct: false },
          { word: 'hen', emoji: '🐔', correct: false },
        ] },
      { id: 'c2', mode: 'isolate', phoneme: 'D', phonemeSound: 'duh',
        exampleWord: 'dog', exampleEmoji: '🐶',
        choices: [
          { word: 'duck', emoji: '🦆', correct: true },
          { word: 'sheep', emoji: '🐑', correct: false },
          { word: 'horse', emoji: '🐴', correct: false },
          { word: 'goat', emoji: '🐐', correct: false },
        ] },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1', 'c2']);
  });

  it('never asks for the same WORD twice in one session', () => {
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' },
      { id: 'c2', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐱' },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1']);
  });

  it('a REPEATED COUNT is not a leak — segment answers are arithmetic, not words', () => {
    // REVERT-BITE, in the other direction: gating segment on its answer word
    // would delete every CVC item after the first, and at K the guidelines
    // specify CVC only. Three sounds twice is the curriculum, not a leak.
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'segment', targetWord: 'cat', targetEmoji: '🐱', segments: ['k', 'a', 't'] },
      { id: 'c2', mode: 'segment', targetWord: 'dog', targetEmoji: '🐶', segments: ['d', 'o', 'g'] },
      { id: 'c3', mode: 'segment', targetWord: 'sun', targetEmoji: '☀️', segments: ['s', 'u', 'n'] },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('an isolate item keeps its OWN answer on its OWN cards', () => {
    // The menu is the question there — the gate must check BEFORE it records.
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'isolate', phoneme: 'M', phonemeSound: 'mmm',
        exampleWord: 'mouse', exampleEmoji: '🐭',
        choices: [
          { word: 'moon', emoji: '🌙', correct: true },
          { word: 'dog', emoji: '🐶', correct: false },
          { word: 'fish', emoji: '🐟', correct: false },
          { word: 'cake', emoji: '🍰', correct: false },
        ] },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1']);
  });
});
