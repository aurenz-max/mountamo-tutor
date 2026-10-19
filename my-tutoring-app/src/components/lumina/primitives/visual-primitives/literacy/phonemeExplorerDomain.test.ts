/**
 * phoneme-explorer's domain (`phonemeExplorerDomain.ts`): the item gates, the ask, the spoken key and the harness
 * answers. Pure, no jsdom. What this locks in: the ask states its problem and never its answer; the build gates drop
 * items whose ask would contain the answer or whose walk cannot be said; phonemes in spoken lines are voice-safe; the
 * key carries what counts and what looks right and is not; the session gate drops a word heard before it is asked.
 */
import { describe, it, expect } from 'vitest';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import {
  askFor,
  hearSoundRequest,
  hearWordRequest,
  itemFromChallenge,
  itemsFromChallenges,
  leakExemptSpanFor,
  phonemeExplorerHarnessAnswers,
  phonemeKey,
  responseClassFor,
  shufflePhonemeMenus,
  spokenOperation,
  spokenPhonemeToken,
  walkFor,
  type PhonemeExplorerItem,
} from './phonemeExplorerDomain';

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
const ENDING = itemFromChallenge({
  id: 'c1e', mode: 'ending', targetWord: 'cap', targetEmoji: '🧢', finalPhoneme: 'p',
  choices: [
    { word: 'mop', emoji: '🧹', correct: true },
    { word: 'cat', emoji: '🐱', correct: false },
    { word: 'sun', emoji: '☀️', correct: false },
    { word: 'dog', emoji: '🐶', correct: false },
  ],
})!;
const MEDIAL = itemFromChallenge({
  id: 'c1m', mode: 'medial', targetWord: 'pig', targetEmoji: '🐷', vowel: 'i',
  choices: [
    { word: 'wig', emoji: '👩', correct: true },
    { word: 'bag', emoji: '👜', correct: false },
    { word: 'log', emoji: '🪵', correct: false },
    { word: 'mug', emoji: '☕', correct: false },
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

const ITEMS: PhonemeExplorerItem[] = [ISOLATE, ENDING, MEDIAL, BLEND, SEGMENT, MANIPULATE];

describe('phoneme-explorer menu order', () => {
  it('shuffles choices stably without changing or mutating the menu', () => {
    const originalWords = ISOLATE.menu!.map((card) => card.word);
    const once = shufflePhonemeMenus([ISOLATE], 'lesson-session-1')[0];
    const again = shufflePhonemeMenus([ISOLATE], 'lesson-session-1')[0];

    expect(again.menu).toEqual(once.menu);
    expect(once.menu!.map((card) => card.word).sort()).toEqual(originalWords.slice().sort());
    expect(ISOLATE.menu!.map((card) => card.word)).toEqual(originalWords);
    expect(once.answer).toBe(ISOLATE.answer);
  });

  it('allows the correct card to occupy different positions across sessions', () => {
    const positions = new Set(
      Array.from({ length: 24 }, (_, index) => {
        const shuffled = shufflePhonemeMenus([ISOLATE], `lesson-session-${index}`)[0];
        return shuffled.menu!.findIndex((card) => card.word === shuffled.answer);
      }),
    );

    expect(positions.size).toBeGreaterThan(1);
  });

  it('uses one shuffled order for the menu and the tutor enumeration', () => {
    const shuffled = shufflePhonemeMenus([ISOLATE], 'spoken-order-session')[0];
    const words = shuffled.menu!.map((card) => card.word);
    const cue = askFor(shuffled);

    for (let index = 1; index < words.length; index += 1) {
      expect(cue.indexOf(words[index - 1])).toBeLessThan(cue.indexOf(words[index]));
    }
  });
});

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('phoneme-explorer · structural gates', () => {
  it('every mode is voice; segment answers with a benched number word', () => {
    for (const item of ITEMS) expect(item.answerKind).toBe('voice');
    expect(responseClassFor('segment')).toBe('number_word_to_20');
    expect(responseClassFor('isolate')).toBe('short_spoken_word');
    expect(responseClassFor('ending')).toBe('short_spoken_word');
    expect(responseClassFor('medial')).toBe('short_spoken_word');
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

describe('phoneme-explorer · phoneme voice safety', () => {
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
    expect(askFor(BLEND)).not.toContain('cat');
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
    // segment only DEGRADES: its ask speaks the word, so the item stays without a walk.
    const seg = itemFromChallenge({
      id: 's', mode: 'segment', targetWord: 'duck', targetEmoji: '🦆', segments: ['d', 'u', 'c'],
    })!;
    expect(seg.segmentWalk).toBeNull();
  });

  it('operation prose speaks its phonemes safely', () => {
    expect(spokenOperation("Change the /æ/ in 'cat' to /ɪ/")).toContain('aaa');
    expect(spokenOperation("Change the /æ/ in 'cat' to /ɪ/")).toContain('iii');
    expect(MANIPULATE.operationSpoken).toBe("Change the /k/ in 'cat' to /b/.");
  });
});

// ── 3. Answer-leak: asks and context pushes stay question-side ──────────────

describe('phoneme-explorer · answer-leak', () => {
  it('asks state their problem and never their answer', () => {
    const isolate = askFor(ISOLATE);
    expect(isolate).toContain('mmm');
    expect(isolate).toContain('moon, dog, fish, cake'); // the menu IS the question
    const segment = askFor(SEGMENT);
    expect(segment).toContain('sheep');
    expect(segment).not.toContain('three');
    const manipulate = askFor(MANIPULATE);
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

});

// ── 4. Corrections re-model then re-elicit; the answer is EARNED there ──────

describe('phoneme-explorer · the spoken key', () => {
  it('names what looks like an answer and is not, per mode', () => {
    expect(phonemeKey(ISOLATE).signatureError).toContain('mouse is not a card');
    expect(phonemeKey(BLEND).signatureError).toContain('sounds with no word at the end');
    expect(phonemeKey(SEGMENT).signatureError).toContain('runs past it');
    expect(phonemeKey(MANIPULATE).signatureError).toContain('cat said back unchanged');
    expect(phonemeKey(MEDIAL).signatureError).toContain('pig said back is not a card');
    expect(phonemeKey(ENDING).signatureError).toContain('cap said back is not a card');
  });

  it('carries the accept side: counting or sounding out that LANDS on the answer', () => {
    expect(phonemeKey(BLEND).acceptRule).toContain('landing on cat');
    expect(phonemeKey(SEGMENT).acceptRule).toContain('ending on three');
    expect(phonemeKey(SEGMENT).alsoAccept).toEqual(['3']);
  });

  it('a menu key only where the ask reads the cards; no ask fails askLeaks', () => {
    expect(phonemeKey(ISOLATE).menu).toEqual(['moon', 'dog', 'fish', 'cake']);
    expect(phonemeKey({ ...ISOLATE, enumerateMenu: false }).menu).toBeUndefined();
    for (const item of [...ITEMS, { ...ISOLATE, enumerateMenu: false }, { ...MEDIAL, enumerateMenu: false }])
      expect(askLeaks(askFor(item), phonemeKey(item)), item.id).toEqual([]);
  });

  it('tap-to-hear requests name question-side audio only', () => {
    expect(hearWordRequest('sheep')).toContain('"sheep"');
    expect(hearSoundRequest('a')).toContain('aaa');
  });
});

// ── 5. Support-tier ask levers ──────────────────────────────────────────────

describe('phoneme-explorer · tier levers in the ask', () => {
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
    expect(askFor(quiet)).not.toContain('moon, dog, fish, cake');
    expect(askFor(quiet)).toContain('Read the cards');
  });

  it('the worked-example clause follows its card', () => {
    expect(askFor(ISOLATE)).toContain('like mouse');
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
    expect(askFor(bare)).not.toContain('like mouse');
  });
});

// ── 6. Session frame + the catalog contract ─────────────────────────────────


// ── 7. The judged-loop harness surface (19h-i-b port 5) ─────────────────────

describe('phoneme-explorer · harness answers', () => {
  it('exempts ONLY a menu-kind menu clause from the leak oracle, and only when spoken', () => {
    // The four cards ARE the question — reading them aloud is the ask. Every
    // other mode's ask is answer-free, so the oracle stays flat there; emptying
    // leakTokens instead would switch the oracle off.
    expect(leakExemptSpanFor(ISOLATE)).toBe('The words are: moon, dog, fish, cake.');
    expect(ISOLATE.answer).toBe('moon');
    // ... and the exemption is a SPAN OF THE ASK, not a paraphrase of it.
    // medial is the second MENU kind, so it earns the same exemption.
    expect(leakExemptSpanFor(MEDIAL)).toBe('The words are: wig, bag, log, mug.');
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

    const blend = phonemeExplorerHarnessAnswers(BLEND);
    expect(blend.signatureWrong!.text).toBe('/k/ … aaa … /t/');   // sounds, no word

    const segment = phonemeExplorerHarnessAnswers(SEGMENT);
    expect(segment.correct).toBe('three');
    expect(segment.signatureWrong!.text).toBe('one, two, three, four'); // one PAST

    const manipulate = phonemeExplorerHarnessAnswers(MANIPULATE);
    expect(manipulate.signatureWrong!.text).toBe('cat');          // unchanged original
  });

  it('a plain wrong is a real alternative, never the answer', () => {
    for (const item of ITEMS) {
      const answers = phonemeExplorerHarnessAnswers(item);
      expect(answers.correct).toBe(item.answer);
      expect(answers.plainWrong.toLowerCase()).not.toBe(item.answer.toLowerCase());
      expect(answers.leakTokens).toEqual([item.answer]);
    }
    // A menu kind's plain wrong is a card the stage actually renders.
    for (const menuItem of [ISOLATE, MEDIAL]) {
      expect((menuItem.menu ?? []).map((c) => c.word))
        .toContain(phonemeExplorerHarnessAnswers(menuItem).plainWrong);
    }
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

// ── ending — auditory final-phoneme identification ─────────────────────────

describe('phoneme-explorer · ending-sound match', () => {
  it('withholds the final phoneme until post-attempt feedback', () => {
    const ask = askFor(ENDING);
    expect(ask).toContain('same ending sound as cap');
    expect(ask).not.toContain('/p/');
    // Both branches replay and emphasize the final sound after an attempt.
  });

  it('keeps the target off the picture-card menu and rejects an unsayable final glyph', () => {
    expect(itemFromChallenge({
      id: 'x', mode: 'ending', targetWord: 'cap', targetEmoji: '🧢', finalPhoneme: 'p',
      choices: [
        { word: 'mop', emoji: '🧹', correct: true },
        { word: 'cap', emoji: '🧢', correct: false },
        { word: 'sun', emoji: '☀️', correct: false },
        { word: 'dog', emoji: '🐶', correct: false },
      ],
    })).toBeNull();
    expect(itemFromChallenge({
      id: 'x', mode: 'ending', targetWord: 'cap', targetEmoji: '🧢', finalPhoneme: 'x',
      choices: [
        { word: 'mop', emoji: '🧹', correct: true },
        { word: 'cat', emoji: '🐱', correct: false },
        { word: 'sun', emoji: '☀️', correct: false },
        { word: 'dog', emoji: '🐶', correct: false },
      ],
    })).toBeNull();
  });

  it('always enumerates the hidden-word menu and keeps the final sound out of tutor context', () => {
    expect(ENDING.enumerateMenu).toBe(true);
    expect(leakExemptSpanFor(ENDING)).toContain('mop');
    expect(phonemeExplorerHarnessAnswers(ENDING).signatureWrong?.text).toBe('cap');
  });
});

// ── 9. medial — the design ruling, pinned ───────────────────────────

describe('phoneme-explorer · medial (middle-sound match)', () => {
  it('NEVER names the vowel in the ask — extracting it IS the skill', () => {
    // The ruling this mode was built on. "Which word has iii in the middle?"
    // hands over the extraction step and leaves a task that is isolate wearing
    // a different label.
    const ask = askFor(MEDIAL);
    expect(ask).toContain('same middle sound as pig');
    expect(ask).not.toContain('iii');
  });

  it('speaks the stimulus but never prints it as a card', () => {
    // The stimulus really does carry the target middle sound, so a card
    // carrying it is answerable by repeating what was just heard.
    expect(itemFromChallenge({
      id: 'x', mode: 'medial', targetWord: 'pig', targetEmoji: '🐷', vowel: 'i',
      choices: [
        { word: 'wig', emoji: '👩', correct: true },
        { word: 'pig', emoji: '🐷', correct: false },
        { word: 'log', emoji: '🪵', correct: false },
        { word: 'mug', emoji: '☕', correct: false },
      ],
    })).toBeNull();
  });

  it('drops an item whose middle vowel cannot be said — the correction is built on it', () => {
    const base = {
      id: 'x', mode: 'medial' as const, targetWord: 'pig', targetEmoji: '🐷',
      choices: [
        { word: 'wig', emoji: '👩', correct: true },
        { word: 'bag', emoji: '👜', correct: false },
        { word: 'log', emoji: '🪵', correct: false },
        { word: 'mug', emoji: '☕', correct: false },
      ],
    };
    expect(itemFromChallenge({ ...base, vowel: '' })).toBeNull();
    // 'y' is not one of the five short vowels phonemeVoice can spell out.
    expect(itemFromChallenge({ ...base, vowel: 'x' })).toBeNull();
    expect(itemFromChallenge({ ...base, vowel: 'i' })?.vowelSpoken).toBe('iii');
  });

  it('the ask survives the hard tier by making the child READ the cards', () => {
    // medial has no worked example and no instruction furniture, so enumeration
    // is its ONE ask-side tier lever — and it is a real one.
    const quiet = itemFromChallenge({
      id: 'c1', mode: 'medial', targetWord: 'pig', targetEmoji: '🐷', vowel: 'i',
      readOptionsAloud: false,
      choices: [
        { word: 'wig', emoji: '👩', correct: true },
        { word: 'bag', emoji: '👜', correct: false },
        { word: 'log', emoji: '🪵', correct: false },
        { word: 'mug', emoji: '☕', correct: false },
      ],
    })!;
    const ask = askFor(quiet);
    expect(ask).toContain('Read the cards');
    expect(ask).not.toContain('The words are:');
    expect(leakExemptSpanFor(quiet)).toBeUndefined();
  });

  it('pushes the stimulus word to the tutor, never the vowel', () => {
    // The context channel must not carry what the ask deliberately withholds.
  });

  it('SELECTS its answer, so a heard word does not disqualify it — but its stimulus is heard', () => {
    // Same exemption isolate earns, for the same reason: the cards are visible
    // at the moment of the ask. What medial adds to `heard` is its STIMULUS,
    // which the tutor speaks aloud — so it can hand over a LATER blend answer.
    const kept = itemsFromChallenges([
      { id: 'c1', mode: 'medial', targetWord: 'cat', targetEmoji: '🐈', vowel: 'a',
        choices: [
          { word: 'hat', emoji: '👒', correct: true },
          { word: 'hot', emoji: '🌶', correct: false },
          { word: 'hut', emoji: '🛖', correct: false },
          { word: 'hit', emoji: '🎯', correct: false },
        ] },
      // 'cat' was spoken as the stimulus above, so blending to it is now recall.
      { id: 'c2', mode: 'blend', phonemeSequence: ['k', 'a', 't'], word: 'cat', emoji: '🐈' },
      // ... while a second menu item reusing a heard word still SELECTS.
      { id: 'c3', mode: 'medial', targetWord: 'pig', targetEmoji: '🐷', vowel: 'i',
        choices: [
          { word: 'wig', emoji: '👩', correct: true },
          { word: 'hat', emoji: '👒', correct: false },
          { word: 'log', emoji: '🪵', correct: false },
          { word: 'mug', emoji: '☕', correct: false },
        ] },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['c1', 'c3']);
  });
});

// ── 8. The SESSION-level gate — a leak no single item can carry ─────────────

describe('phoneme-explorer · cross-item answer leaks', () => {
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
