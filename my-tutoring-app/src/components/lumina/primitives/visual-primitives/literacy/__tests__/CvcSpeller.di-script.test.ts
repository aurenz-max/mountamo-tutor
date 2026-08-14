/**
 * cvcSpellerScript — the pedagogy lives here, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop (the loop itself cannot be driven
 * honestly in a test environment — see CvcSpeller.di.test.tsx's header).
 *
 * What this locks in:
 *  1. The hand-over is unambiguous, and the ask never contains the answer.
 *  2. The MIDDLE SOUND is letter-derived, not phoneme-derived — the one place
 *     a wrong reading would put the letter NAME in a five-year-old's ear.
 *  3. The judging contract names what looks like an answer and is not: the
 *     whole word back, the other sounds in it, and the NAME of a letter.
 *  4. `spell-word` carries a SILENCE contract instead of a judging contract —
 *     the tutor hears nothing, so anything it says is either noise or the
 *     answer.
 *  5. The correction FADES across the two allowed corrections rather than
 *     repeating itself.
 *  6. Sentinel discipline (standing gate 2) across every cue the pack emits.
 */
import { describe, it, expect } from 'vitest';
import {
  HOW_TO_PLAY,
  askLine,
  buildVerdictCue,
  completeCue,
  correctionLine,
  itemCue,
  judgingContract,
  moveOnCue,
  positionWord,
  pronounceCue,
  spokenSoundAt,
  spokenVowel,
  stretchedWord,
  vowelKeyword,
  type CvcItem,
} from '../cvcSpellerScript';
import {
  findPerformedStageDirections,
  findSentinelCollisions,
  spokenSpanOf,
} from '../../../../hooks/judgedScriptContract';

const CAT: CvcItem = {
  id: 'c1', task: 'fill-vowel', word: 'cat',
  letters: ['c', 'a', 't'], phonemes: ['/k/', '/æ/', '/t/'],
  vowelLetter: 'a', emoji: '🐱',
};
const SAT: CvcItem = {
  id: 'c2', task: 'spell-word', word: 'sat',
  letters: ['s', 'a', 't'], phonemes: ['/s/', '/æ/', '/t/'],
  vowelLetter: 'a', emoji: '🧘',
};
const HEN: CvcItem = {
  id: 'c3', task: 'word-sort', word: 'hen',
  letters: ['h', 'e', 'n'], phonemes: ['/h/', '/ɛ/', '/n/'],
  vowelLetter: 'e', emoji: '🐔',
};

/** The line the tutor actually SPEAKS — the shared parser, which knows this
 *  port's di-bench-era `Speak exactly:` anchor as well as the runner-era one.
 *  Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

/** Every cue this pack can emit, labelled for the shared gates. This port
 *  predates `useJudgedScriptRunner` and deliberately still hand-rolls its
 *  runner half (2026-08-10 extraction ruling: no retrofit), so there is no
 *  `JudgedScriptPack` to hand `checkPackGates` — its items carry no
 *  `answerKind`/`responseClass`, and inventing them here would assert a
 *  contract the production code does not keep. The cue-level gates take a cue
 *  list directly, so those run unchanged. */
const allCues = (): Array<{ label: string; text: string }> =>
  [CAT, SAT, HEN].flatMap((item) => [
    { label: `itemCue(${item.id}, opening)`, text: itemCue(item, { opening: true, howToPlay: true }) },
    { label: `itemCue(${item.id})`, text: itemCue(item, {}) },
    { label: `moveOnCue(${item.id})`, text: moveOnCue(item, null, {}) },
    { label: `pronounceCue(${item.id})`, text: pronounceCue(item.word) },
    {
      label: `buildVerdictCue(${item.id}, hit)`,
      text: buildVerdictCue(item, { placed: item.letters, correct: true }),
    },
    {
      label: `buildVerdictCue(${item.id}, miss)`,
      text: buildVerdictCue(item, { placed: [item.letters[0], null, null], correct: false, wrongIndex: 1 }),
    },
  ]).concat({ label: 'completeCue', text: completeCue() });

describe('cvc-speller script · the middle sound is LETTER-derived', () => {
  it('speaks di-letter-sounds own short-vowel spellings', () => {
    expect(spokenVowel(CAT)).toBe('aaa');
    expect(spokenVowel(HEN)).toBe('eee');
    expect(spokenVowel({ ...CAT, vowelLetter: 'i' })).toBe('iii');
    expect(spokenVowel({ ...CAT, vowelLetter: 'o' })).toBe('ooo');
    expect(spokenVowel({ ...CAT, vowelLetter: 'u' })).toBe('uuu');
  });

  it('ignores an ASCII phoneme the generator may have written instead of IPA', () => {
    // REVERT-BITE. `speakablePhoneme` passes ASCII through untouched by design
    // (`/k/` reads correctly, and rewriting `/j/` would be guessing). A
    // generation that wrote `/a/` for the short-a would therefore reach the
    // tutor as the LETTER NAME "ay" — the exact wrong sound, in the one line
    // the whole mode turns on. The letter is always known and always right.
    const asciiDraw: CvcItem = { ...CAT, phonemes: ['/k/', '/a/', '/t/'] };
    expect(spokenVowel(asciiDraw)).toBe('aaa');
    expect(spokenVowel(asciiDraw)).not.toContain('/');
  });

  it('routes the CONSONANT positions through phonemeVoice, and the middle through the vowel map', () => {
    expect(spokenSoundAt(CAT, 0)).toBe('/k/');
    expect(spokenSoundAt(CAT, 1)).toBe('aaa');
    expect(spokenSoundAt(CAT, 2)).toBe('/t/');
    // A non-Latin consonant glyph must never reach a spoken line raw.
    expect(spokenSoundAt({ ...CAT, phonemes: ['/ʃ/', '/æ/', '/t/'] }, 0)).toBe('shh');
  });

  it('holds the vowel for the easy tier without inventing notation', () => {
    expect(stretchedWord(CAT)).toBe('caaat');
    expect(stretchedWord(HEN)).toBe('heeen');
    expect(/^[a-z]+$/.test(stretchedWord(CAT))).toBe(true);
  });

  it('keeps the keyword anchor for the corrections that earn it', () => {
    expect(vowelKeyword('a')).toBe('apple');
    expect(vowelKeyword('e')).toBe('egg');
    expect(positionWord(0)).toBe('first');
    expect(positionWord(1)).toBe('middle');
    expect(positionWord(2)).toBe('last');
  });
});

describe('cvc-speller script · the ask', () => {
  it('hands over unambiguously — "Say the middle sound", never "What word?"', () => {
    // "What word?" after "Listen: cat" is answered honestly with "cat": the
    // child repeats the stimulus and is technically right. An ambiguous ask is
    // not a harder task, it is a broken one (word-flip's ruling, second use).
    for (const item of [CAT, HEN]) {
      expect(askLine(item)).toContain('Your turn. Say the middle sound.');
      expect(askLine(item)).not.toContain('What word?');
    }
  });

  it('never contains the answer', () => {
    expect(askLine(CAT)).toBe('Listen: cat. Your turn. Say the middle sound.');
    expect(askLine(CAT)).not.toContain(spokenVowel(CAT));
    expect(askLine(HEN)).not.toContain(spokenVowel(HEN));
    expect(askLine(CAT)).not.toContain('apple');
  });

  it('hands spell-word to the HANDS, and never spells the word out', () => {
    const ask = askLine(SAT);
    expect(ask).toBe('Listen: sat. Your turn. Put in the letters for sat.');
    expect(ask).not.toMatch(/s[\s-]a[\s-]t/);
  });

  it('the easy tier holds the vowel — the one surviving in-mode lever for fill-vowel', () => {
    expect(askLine(CAT, { stretch: true })).toBe('Listen: cat. caaat. Your turn. Say the middle sound.');
    expect(askLine(CAT, { stretch: false })).toBe(askLine(CAT));
  });

  it('has a how-to-play per ACTION, because one session can mix all three', () => {
    expect(HOW_TO_PLAY['fill-vowel']).toContain('middle sound');
    expect(HOW_TO_PLAY['word-sort']).toContain('changes from word to word');
    expect(HOW_TO_PLAY['spell-word']).toContain('letter in each box');
    // None of them names an answer.
    for (const line of Object.values(HOW_TO_PLAY)) {
      expect(line).not.toContain('aaa');
      expect(line).not.toContain('apple');
    }
  });
});

describe('cvc-speller script · the judging contract (spoken modes)', () => {
  it('affirms the target sound with the exact sentinel line', () => {
    expect(judgingContract(CAT)).toContain('say exactly "Yes, aaa." and stop');
    expect(judgingContract(HEN)).toContain('say exactly "Yes, eee." and stop');
  });

  it('accepts the sound clipped, held, or inside a phrase', () => {
    expect(judgingContract(CAT)).toContain('clipped, held, or inside a short phrase');
  });

  it('names the three things that look like answers and are not', () => {
    const contract = judgingContract(CAT);
    // 1. the signature error: the whole word said back
    expect(contract).toContain('saying the whole word "cat" back');
    // 2. the wrong position — the error this mode exists to fix
    expect(contract).toContain('making one of the other sounds in it (/k/ or /t/)');
    // 3. the letter NAME instead of the sound
    expect(contract).toContain('saying the NAME of a letter instead of a sound');
    expect(contract).toContain('The name of a letter is not the answer either');
  });

  it('carries the correction verbatim, so the tutor has one line and not a policy', () => {
    expect(judgingContract(CAT)).toContain(correctionLine(CAT, { correction: 1 }));
  });
});

describe('cvc-speller script · corrections FADE, and re-elicit every time', () => {
  it('spoken: correction 1 names the sound, correction 2 adds the keyword', () => {
    const first = correctionLine(CAT, { correction: 1 });
    const second = correctionLine(CAT, { correction: 2 });
    expect(first).toBe('My turn: cat. The middle sound is aaa. Listen: cat. Your turn. Say the middle sound.');
    expect(first).not.toContain('apple');
    expect(second).toContain('like in apple');
    expect(second).not.toBe(first);
  });

  it('spell-word: correction 1 WITHHOLDS the letter — the letter is the answer', () => {
    const first = correctionLine(SAT, { correction: 1, wrongIndex: 1 });
    expect(first).toBe('My turn: sat. Listen to the middle sound: aaa. Listen: sat. Your turn. Put in the letters for sat.');
    expect(first).not.toContain('letter is A');
  });

  it('spell-word: correction 2 gives the letter, because listening harder will not find it', () => {
    const second = correctionLine(SAT, { correction: 2, wrongIndex: 0 });
    expect(second).toContain('The first sound is /s/, and the first letter is S.');
  });

  it('every correction re-elicits (standing gate 3)', () => {
    for (const [item, n] of [[CAT, 1], [CAT, 2], [HEN, 1], [SAT, 1], [SAT, 2]] as const) {
      expect(correctionLine(item, { correction: n })).toContain(askLine(item));
    }
  });
});

describe('cvc-speller script · spell-word is SILENT, not judged', () => {
  it('its item cue carries no spoken-judging contract at all', () => {
    const cue = itemCue(SAT);
    expect(cue).not.toContain('Then wait for the learner to speak.');
    expect(cue).toContain('Then stop and wait.');
  });

  it('forbids the four things a helpful model would do with an open mic', () => {
    const cue = itemCue(SAT);
    expect(cue).toContain('say NOTHING at all until the application sends you the next message');
    expect(cue).toContain('do not name or sound out any letter of "sat"');
    expect(cue).toContain('do not spell it');
    expect(cue).toContain('do not comment on what the learner is doing');
  });

  it('the BUILD verdict is one exact line per branch', () => {
    const right = buildVerdictCue(SAT, { placed: ['s', 'a', 't'], correct: true });
    expect(spokenLine(right)).toBe('Yes, sat.');
    expect(right).toContain('[DI_CVC_BUILD]');

    const wrong = buildVerdictCue(SAT, { placed: ['s', 'e', 't'], correct: false, wrongIndex: 1, correction: 1 });
    expect(wrong).toContain('The learner put "s e t" in the boxes, and the word is "sat"');
    expect(spokenLine(wrong)).toBe(correctionLine(SAT, { correction: 1, wrongIndex: 1 }));
  });

  it('a blank box reads as a blank, never as a letter', () => {
    const cue = buildVerdictCue(SAT, { placed: ['s', null, 't'], correct: false, wrongIndex: 1 });
    expect(cue).toContain('"s _ t"');
  });
});

describe('cvc-speller script · the opening turn has ONE job (residual SWAP-1)', () => {
  const opening = itemCue(CAT, { opening: true, howToPlay: true });

  it('puts the how-to-play INSIDE the quoted line rather than asking for one', () => {
    expect(spokenLine(opening)).toBe(`${HOW_TO_PLAY['fill-vowel']} ${askLine(CAT)}`);
    expect(opening).not.toMatch(/greet the student/i);
    expect(opening).not.toMatch(/in kid words/i);
  });

  it('forbids speaking the bracket label it arrived under', () => {
    expect(opening).toContain('Never say, reproduce, or invent text inside square brackets');
    expect(opening).toContain('do not add your own');
  });

  it('a later item carries no opening frame — only the first turn is introduced', () => {
    expect(itemCue(HEN)).not.toContain('square brackets');
    expect(spokenLine(itemCue(HEN))).toBe(askLine(HEN));
  });

  it('a mid-session ACTION change still gets its how-to-play', () => {
    expect(spokenLine(itemCue(SAT, { howToPlay: true }))).toBe(`${HOW_TO_PLAY['spell-word']} ${askLine(SAT)}`);
  });
});

describe('cvc-speller script · tap-to-hear says the WORD and stops', () => {
  const cue = pronounceCue('cat');

  it('forbids the segmentation ladder it replaced', () => {
    // The control this replaces escalated on its third tap into isolating the
    // middle sound — which on two of three modes IS the answer, spoken on
    // demand, before the child had answered anything.
    expect(cue).toContain('Do NOT spell it');
    expect(cue).toContain('do NOT say its letters');
    expect(cue).toContain('do NOT break it into separate sounds');
    expect(cue).toContain('do not treat this as an attempt to judge');
  });

  it('carries the word in the body, not only in the tag', () => {
    expect(cue.replace('[SAY_WORD]', '')).toContain('"cat"');
  });
});

describe('cvc-speller script · DI sentinel discipline (standing gate 2)', () => {
  const everyCue = [
    itemCue(CAT, { opening: true, howToPlay: true }),
    itemCue(CAT),
    itemCue(CAT, { stretch: true }),
    itemCue(HEN),
    itemCue(SAT, { howToPlay: true }),
    moveOnCue(CAT, HEN),
    moveOnCue(CAT, SAT, { howToPlay: true }),
    moveOnCue(CAT, null),
    buildVerdictCue(SAT, { placed: ['s', 'e', 't'], correct: false, wrongIndex: 1 }),
    completeCue(),
  ];

  it('no spoken line opens with a sentinel — only the in-band verdict branches may', () => {
    const lines = everyCue.map(spokenLine);
    expect(lines.every(l => l.length > 0)).toBe(true);   // extraction really found them
    for (const line of lines) {
      const lower = line.trimStart().toLowerCase();
      // The affirmed BUILD verdict is a verdict branch and is allowed to.
      if (lower.startsWith('yes, ')) continue;
      expect(lower.startsWith('yes')).toBe(false);
      if (lower.startsWith('my turn:')) continue;
      expect(lower.startsWith('my turn')).toBe(false);
    }
  });

  it('hands the tutor no stage direction shaped like something to perform', () => {
    // The family gate, run over a cue list because this port has no pack (see
    // `allCues`). A model VOICED "[WAIT silently]" to a child after taking the
    // contract's imperative opener as one more thing on the list of things to
    // say; every judge-side instruction here has to be a FACT about the turn.
    expect(findPerformedStageDirections(allCues())).toEqual([]);
  });

  it('opens no cue SENTENCE with a verdict sentinel, per the shared scan', () => {
    // The sentence-scoped scan the engine itself uses — stricter than the
    // string-start check above, which cannot see a second-sentence "Yes,".
    // Verdict branches quote their sentinel lines INSIDE `Speak exactly:`,
    // which is what makes them legal; this reads the whole cue.
    const collisions = findSentinelCollisions(allCues())
      .filter((c) => !/buildVerdictCue/.test(c.cueLabel));
    expect(collisions).toEqual([]);
  });

  it("the ask opens with 'Listen' — classic DISTAR's 'My turn.' opener is forbidden here", () => {
    for (const item of [CAT, SAT, HEN]) {
      expect(askLine(item).startsWith('Listen')).toBe(true);
    }
  });

  it('every cue that still expects a response re-states the anti-collision rule', () => {
    // The terminal move-on and the completion line are excluded on purpose:
    // nothing is being judged after them, so there is no verdict to collide
    // with. Everything the learner can still answer carries the rule.
    for (const cue of everyCue.filter(c => !c.includes('end of our sounds game'))) {
      expect(cue).toContain('Never begin any other sentence with the word "Yes"');
    }
  });

  it('the final move-on has no next item and therefore nothing to wait on', () => {
    const cue = moveOnCue(CAT, null);
    expect(cue).toContain("That's the end of our sounds game.");
    expect(cue).not.toContain('Then wait for the learner to speak.');
    expect(cue).not.toContain('Then stop and wait.');
  });

  it('a move-on to a BUILD item carries the silence contract, not the judging one', () => {
    const cue = moveOnCue(CAT, SAT);
    expect(cue).toContain('Then stop and wait.');
    expect(cue).not.toContain('Then wait for the learner to speak.');
  });

  it('a move-on to a SPOKEN item carries the judging contract, so no attempt lands unjudged', () => {
    const cue = moveOnCue(SAT, HEN);
    expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
    expect(cue).toContain('say exactly "Yes, eee." and stop');
  });
});
