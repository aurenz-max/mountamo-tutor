/**
 * syllableClapperScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates), and does
 *     so in the REAL session shape — several same-band items back to back.
 *  2. ANSWER-LEAK: the ask never contains a number. Not the count, not the
 *     worked example's count (`pickModelWord` guarantees a different one), not
 *     the tap-to-hear replay.
 *  3. ⭐ THE ENUNCIATION LADDER, which is the whole port: the ask says the word
 *     as one joined stream at EVERY tier, and the parts are chanted ONLY in the
 *     correction, where they are earned.
 *  4. BUILD GATES drop what cannot be asked honestly — parts that do not spell
 *     their word, counts outside 1..5, unsayable words, and ⭐ words whose
 *     syllable count is not one number in English.
 *  5. Corrections re-model then re-elicit; affirmations carry the count and its
 *     unit, singular included.
 *  6. The support tier reaches the ASK and nothing else.
 *  7. The catalog keeps its side: template keys resolve against exactly what
 *     the pack pushes, no catalog sentence opens with a verdict sentinel, and
 *     every scaffolding rung routes through the scripted correction (18d).
 */
import { describe, it, expect } from 'vitest';
import {
  DIALECT_VARIABLE_WORDS,
  MODEL_WORDS,
  SYLLABLE_ACTION,
  affirmFor,
  askFor,
  chantOf,
  chantPart,
  completeCue,
  correctionFor,
  endsWithSilentESyllable,
  hasStableSyllableCount,
  hearPartCue,
  isSayableSyllableWord,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  pickModelWord,
  pronounceCue,
  responseClassFor,
  stimulusFor,
  syllableClapperHarnessAnswers,
  syllableClapperPackBase,
  syllablesJoinToWord,
  type SyllableClapperItem,
} from '../syllableClapperScript';
import {
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures ────────────────────────────────────────────────────────────────

const build = (
  over: Partial<Parameters<typeof itemFromChallenge>[0]> = {},
): SyllableClapperItem =>
  itemFromChallenge({
    id: 'c1',
    word: 'butterfly',
    syllables: ['but', 'ter', 'fly'],
    syllableCount: 3,
    imageDescription: 'a colorful butterfly',
    challengeType: 'medium',
    ...over,
  })!;

const BUTTERFLY = build();
const CAT = build({ id: 'c2', word: 'cat', syllables: ['cat'], challengeType: 'easy' });
const TIGER = build({ id: 'c3', word: 'tiger', syllables: ['ti', 'ger'], challengeType: 'easy' });
const WATERMELON = build({
  id: 'c4', word: 'watermelon', syllables: ['wa', 'ter', 'mel', 'on'], challengeType: 'hard',
});

const ITEMS: SyllableClapperItem[] = [CAT, TIGER, BUTTERFLY, WATERMELON];

/**
 * The pack exactly as the component assembles it, from the EXPORTED surface —
 * not a hand-rolled literal, which would be a second source of truth for the
 * tutor's side of the wire (the drift 19f found on both sides of
 * letter-spotter's).
 */
const pack: JudgedScriptPack<SyllableClapperItem> = syllableClapperPackBase(ITEMS);

/** The line the tutor actually SPEAKS — the shared parser, so every port reads
 *  the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

const NUMBER_WORDS = /\b(one|two|three|four|five|six)\b/i;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('syllable-clapper pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('four items of the SAME band do not recite the ask — the real session shape', () => {
    // A one-item-per-mode fixture is the ONE pack shape that cannot trigger the
    // repeat gate, and this pack has ONE action, so EVERY session is the shape
    // the gate is for. The ask carries its own word, and the session gate below
    // forbids the same word twice, so a byte-identical repeat is unreachable.
    const run = [
      build({ id: 'a', word: 'apple', syllables: ['ap', 'ple'] }),
      build({ id: 'b', word: 'tiger', syllables: ['ti', 'ger'] }),
      build({ id: 'c', word: 'rabbit', syllables: ['rab', 'bit'] }),
      build({ id: 'd', word: 'basket', syllables: ['bas', 'ket'] }),
    ];
    expect(checkPackGates({ ...pack, items: run })).toEqual([]);
  });

  it('every item is VOICE and answers with a benched number word', () => {
    for (const item of ITEMS) {
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('number_word_to_20');
    }
    expect(responseClassFor()).toBe('number_word_to_20');
    expect(CAT.answer).toBe('one');
    expect(TIGER.answer).toBe('two');
    expect(BUTTERFLY.answer).toBe('three');
    expect(WATERMELON.answer).toBe('four');
    // The benched class excludes zero; a syllable count can never be zero, and
    // the build gate floors at one regardless.
    expect(itemFromChallenge({ id: 'z', word: 'cat', syllables: [] })).toBeNull();
  });

  it('is SINGLE-ACTION — the band changes the word, not what the child does', () => {
    for (const item of ITEMS) expect(item.action).toBe(SYLLABLE_ACTION);
    // ...so the how-to-play speaks on the opening and never again.
    expect(itemCue(BUTTERFLY, { opening: true, howToPlay: true })).toContain('Watch me first');
    expect(itemCue(BUTTERFLY)).not.toContain('Watch me first');
  });

  it('pushes the BAND as challengeType — the eval mode, not the support tier', () => {
    expect(pack.contextFor(CAT)).toEqual({ challengeType: 'easy', stimulus: 'cat' });
    expect(pack.contextFor(WATERMELON)).toEqual({ challengeType: 'hard', stimulus: 'watermelon' });
  });
});

// ── 2. Answer-leak: the ask never contains a number ─────────────────────────

describe('syllable-clapper pack · answer-leak', () => {
  it('no ask, at any tier, contains any number word', () => {
    for (const item of ITEMS) {
      expect(spokenLine(itemCue(item))).not.toMatch(NUMBER_WORDS);
    }
    const supported = build({ echoWordSlowly: true, inviteClap: true });
    const bare = build({ echoWordSlowly: false, inviteClap: false });
    expect(spokenLine(itemCue(supported))).not.toMatch(NUMBER_WORDS);
    expect(spokenLine(itemCue(bare))).not.toMatch(NUMBER_WORDS);
  });

  it("the worked example's count is NEVER the item's own", () => {
    // "Watch me first: pencil. Pen … cil. That is two parts." before a two-part
    // item would hand the answer over in the opening line itself.
    for (const item of ITEMS) {
      const opening = spokenLine(itemCue(item, { opening: true, howToPlay: true }));
      expect(opening).toContain('Watch me first');
      expect(opening).not.toContain(` ${item.answer} `);
      expect(item.model!.parts.length).not.toBe(item.partCount);
    }
    // And the picker is total across the whole pedagogic range.
    for (let n = 1; n <= 5; n++) {
      expect(pickModelWord(n)!.parts.length).not.toBe(n);
    }
  });

  it('a model word that is also a SESSION word is refused — it would leak that item', () => {
    const sessionWords = new Set(MODEL_WORDS.map((m) => m.word));
    expect(pickModelWord(3, sessionWords)).toBeNull();
    // ...and the how-to-play then states the rule with no worked example, which
    // drops a SCAFFOLD rather than degrading an ask.
    const item = itemFromChallenge(
      { id: 'x', word: 'butterfly', syllables: ['but', 'ter', 'fly'] },
      sessionWords,
    )!;
    expect(item.model).toBeNull();
    const opening = spokenLine(itemCue(item, { opening: true, howToPlay: true }));
    expect(opening).not.toContain('Watch me first');
    expect(opening).toContain('Words are made of parts');
    expect(opening).toContain('how many parts in butterfly');
  });

  it('the context push is question-side — the word, never the count', () => {
    expect(stimulusFor(BUTTERFLY)).toBe('butterfly');
    for (const item of ITEMS) expect(stimulusFor(item)).not.toMatch(NUMBER_WORDS);
  });

  it('tap-to-hear replays the question and never the count', () => {
    for (const item of ITEMS) {
      expect(spokenLine(pronounceCue(item))).toBe(askFor(item));
      expect(spokenLine(pronounceCue(item))).not.toMatch(NUMBER_WORDS);
      expect(pronounceCue(item)).toContain('never say how many parts it has');
    }
    // The per-part cue only exists behind the reveal, where the count is public.
    expect(hearPartCue('ter')).toContain('"ter"');
    expect(hearPartCue('ter')).toContain('do not say the whole word');
  });
});

// ── 3. ⭐ The enunciation ladder — the port's whole instrument ───────────────

describe('syllable-clapper pack · purposeful enunciation', () => {
  it('the ASK says the word as ONE JOINED STREAM at every tier', () => {
    // REVERT-BITE: the click era told the easy tier to say the word "broken into
    // its parts with clear pauses" AS THE SCAFFOLD, one clause after telling the
    // tutor never to state the number of parts. Three beats IS three.
    for (const tier of [
      { echoWordSlowly: true, inviteClap: true },
      { echoWordSlowly: false, inviteClap: true },
      { echoWordSlowly: false, inviteClap: false },
    ]) {
      const item = build(tier);
      const ask = spokenLine(itemCue(item));
      expect(ask).not.toContain('but … ter … fly');
      expect(itemCue(item)).toContain('ONE JOINED STREAM');
      expect(itemCue(item)).toContain('never broken into parts — the parts are the answer');
    }
  });

  it('the PARTS are chanted only in the correction, where they are earned', () => {
    const cue = itemCue(BUTTERFLY);
    const ask = spokenLine(cue);
    expect(ask).not.toContain('…');
    expect(correctionFor(BUTTERFLY)).toContain('But … ter … fly');
    expect(cue).toContain('If it is wrong, say exactly: "My turn: butterfly. But … ter … fly.');
    // The chant survives at the LEAST supported tier too: the click era withheld
    // it at hard, which left a child who had already missed with nothing to
    // learn from. What that rule protected — never hand the count over before
    // the child tries — the judged loop enforces structurally.
    expect(correctionFor(build({ echoWordSlowly: false, inviteClap: false })))
      .toContain('But … ter … fly');
  });

  it('the second saying is a slower JOINED repeat, and only at the top tier', () => {
    const supported = build({ echoWordSlowly: true });
    expect(spokenLine(itemCue(supported))).toContain('Again, slowly: butterfly.');
    expect(itemCue(supported)).toContain('slower and more drawn out than the first, still one unbroken stream');
    const plain = build({ echoWordSlowly: false });
    expect(spokenLine(itemCue(plain))).not.toContain('Again, slowly');
    expect(itemCue(plain)).not.toContain('slower and more drawn out');
  });

  it('the clap invitation is the tier lever that hard withdraws', () => {
    expect(spokenLine(itemCue(build({ inviteClap: true }))))
      .toContain('Clap the parts with your hands, then tell me how many parts in butterfly.');
    const noHands = spokenLine(itemCue(build({ inviteClap: false })));
    expect(noHands).not.toContain('Clap the parts');
    // Withdrawing the motor scaffold must never withdraw the ASK.
    expect(noHands).toContain('How many parts in butterfly?');
    // ...nor the stimulus, at any tier: this is a listening task.
    expect(noHands).toContain('Listen: butterfly.');
  });
});

// ── 4. Build gates — ship nothing over a broken ask ─────────────────────────

describe('syllable-clapper pack · build gates', () => {
  it('drops a split that does not spell its word — the correction would chant another word', () => {
    expect(syllablesJoinToWord('butterfly', ['but', 'ter', 'fly'])).toBe(true);
    expect(syllablesJoinToWord('butterfly', ['but', 'ter', 'flies'])).toBe(false);
    expect(itemFromChallenge({
      id: 'x', word: 'butterfly', syllables: ['but', 'ter', 'flies'],
    })).toBeNull();
    // Case and an internal hyphen are not a mismatch.
    expect(syllablesJoinToWord('T-shirt', ['T', 'shirt'])).toBe(true);
  });

  it('⭐ drops a word whose syllable count is not ONE number in English', () => {
    // The click era's `hard` band ASKED for these ("comfortable", "interesting")
    // as though ambiguity were difficulty. Under a judged loop the tutor refuses
    // a child who was right and then models a dialect at them as a fact.
    for (const word of ['squirrel', 'fire', 'flower', 'every', 'chocolate', 'comfortable', 'interesting']) {
      expect(hasStableSyllableCount(word)).toBe(false);
      expect(DIALECT_VARIABLE_WORDS.has(word)).toBe(true);
    }
    expect(itemFromChallenge({ id: 'x', word: 'squirrel', syllables: ['squir', 'rel'] })).toBeNull();
    expect(itemFromChallenge({ id: 'x', word: 'Squirrel', syllables: ['Squir', 'rel'] })).toBeNull();
    // Ordinary long words are untouched — length is difficulty, ambiguity is not.
    for (const word of ['caterpillar', 'watermelon', 'alligator', 'butterfly', 'kindergarten']) {
      expect(hasStableSyllableCount(word)).toBe(true);
    }
  });

  it('⭐ drops a split that spells its word and still counts the beats WRONG', () => {
    // FOUND BY THE LIVE PROBE: `centipede → ["cen","ti","pe","de"]`. Those four
    // parts join to "centipede" letter for letter, so the join gate passed it —
    // and the answer key says FOUR for a word English claps in THREE. The tutor
    // would refuse the child who said "three" and chant "cen … ti … pe … de" at
    // them as the model.
    expect(endsWithSilentESyllable(['cen', 'ti', 'pe', 'de'])).toBe(true);
    expect(itemFromChallenge({
      id: 'x', word: 'centipede', syllables: ['cen', 'ti', 'pe', 'de'],
    })).toBeNull();
    // The correct split of the same word survives.
    expect(itemFromChallenge({
      id: 'x', word: 'centipede', syllables: ['cen', 'ti', 'pede'],
    })!.answer).toBe('three');
    // "-le" is a REAL syllable and is three characters, so it never matches —
    // this is what keeps the syllabic-l words the gate would otherwise eat.
    for (const parts of [['ap', 'ple'], ['ta', 'ble'], ['un', 'cle'], ['can', 'dle']]) {
      expect(endsWithSilentESyllable(parts)).toBe(false);
    }
    // A one-part word is never a silent-e split ("ape", "toe").
    expect(endsWithSilentESyllable(['ape'])).toBe(false);
  });

  it('⭐ chants a lone vowel part as the schwa it is, not as the letter NAME', () => {
    // Also from the probe: `thermometer → ["ther","mom","e","ter"]` (a CORRECT
    // split) and `banana → ["ba","nan","a"]`. A Live model saying a bare "e"
    // alone reads the letter name "ee" — the same defect `phonemeVoice` fixes
    // for phonemes, one level up. An interior or final lone vowel in English is
    // a schwa essentially without exception.
    expect(chantPart('e')).toBe('uh');
    expect(chantPart('a')).toBe('uh');
    expect(chantPart('ter')).toBe('ter');
    expect(chantOf(['ther', 'mom', 'e', 'ter'])).toBe('ther … mom … uh … ter');
    const thermometer = build({
      id: 'x', word: 'thermometer', syllables: ['ther', 'mom', 'e', 'ter'], challengeType: 'hard',
    });
    expect(correctionFor(thermometer)).toContain('Ther … mom … uh … ter');
    expect(correctionFor(thermometer)).toContain('Four parts');
  });

  it('drops what cannot be SAID: phrases, digits, deliberation, a bare "yes"', () => {
    expect(isSayableSyllableWord('butterfly')).toBe(true);
    expect(isSayableSyllableWord('ice cream')).toBe(false);
    expect(isSayableSyllableWord('yes')).toBe(false);
    expect(isSayableSyllableWord('c3po')).toBe(false);
    // letter-spotter's probe caught a `targetWord` arriving as 400 characters of
    // model deliberation that every SEMANTIC gate passed — a field that cannot
    // be enum-locked needs a SHAPE gate too.
    expect(isSayableSyllableWord('Okay, thinking about this, a good word here would be'.repeat(8)))
      .toBe(false);
    // ...and a word that would open a sentence with a verdict sentinel.
    expect(isSayableSyllableWord('Yes')).toBe(false);
  });

  it('drops counts outside the pedagogic range, and an unsayable part', () => {
    expect(itemFromChallenge({
      id: 'x', word: 'antidisestablishmentarianism',
      syllables: ['an', 'ti', 'dis', 'es', 'tab', 'lish'],
    })).toBeNull();
    expect(itemFromChallenge({ id: 'x', word: 'a1b2', syllables: ['a1', 'b2'] })).toBeNull();
    // Five is admitted: the shipped `hard` prompt names "refrigerator".
    expect(itemFromChallenge({
      id: 'x', word: 'refrigerator', syllables: ['re', 'frig', 'er', 'a', 'tor'],
    })!.answer).toBe('five');
  });

  it('IGNORES a model-supplied syllableCount that disagrees with its own split', () => {
    const item = build({ syllables: ['but', 'ter', 'fly'], syllableCount: 99 });
    expect(item.partCount).toBe(3);
    expect(item.answer).toBe('three');
  });

  it('asks about a word ONCE per session; a repeated COUNT is not a leak', () => {
    // A second ask about the same word is recall — the first ask named it and
    // the close named its count.
    expect(itemsFromChallenges([
      { id: 'c1', word: 'tiger', syllables: ['ti', 'ger'] },
      { id: 'c2', word: 'Tiger', syllables: ['Ti', 'ger'] },
    ]).map((i) => i.id)).toEqual(['c1']);
    // REVERT-BITE in the other direction: gating on the ANSWER would delete
    // every two-part word after the first, and at K that is most of the band.
    expect(itemsFromChallenges([
      { id: 'c1', word: 'tiger', syllables: ['ti', 'ger'] },
      { id: 'c2', word: 'apple', syllables: ['ap', 'ple'] },
      { id: 'c3', word: 'rabbit', syllables: ['rab', 'bit'] },
    ]).map((i) => i.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('keeps the good items when a bad one sits beside them', () => {
    const kept = itemsFromChallenges([
      { id: 'ok', word: 'butterfly', syllables: ['but', 'ter', 'fly'] },
      { id: 'variable', word: 'squirrel', syllables: ['squir', 'rel'] },
      { id: 'badsplit', word: 'apple', syllables: ['ap', 'pel'] },
      { id: 'ok2', word: 'tiger', syllables: ['ti', 'ger'] },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['ok', 'ok2']);
  });
});

// ── 5. Corrections and affirmations ────────────────────────────────────────

describe('syllable-clapper pack · corrections and contracts', () => {
  it('the correction re-models then re-elicits, and opens with the sentinel', () => {
    expect(correctionFor(BUTTERFLY))
      .toBe('My turn: butterfly. But … ter … fly. Three parts. Your turn. How many parts in butterfly?');
    expect(correctionFor(CAT))
      .toBe('My turn: cat. Cat. One part. Your turn. How many parts in cat?');
  });

  it('the affirmation echoes the count with the right unit, singular included', () => {
    expect(affirmFor(BUTTERFLY)).toBe('Yes, three parts.');
    expect(affirmFor(CAT)).toBe('Yes, one part.');
  });

  it('names the accept side — a count aloud that LANDS on the answer', () => {
    const cue = itemCue(BUTTERFLY);
    expect(cue).toContain('LANDING on "three" counts');
    expect(cue).toContain('The number alone counts');
  });

  it('names the hole that accept clause opens, which is the signature miss', () => {
    const cue = itemCue(BUTTERFLY);
    expect(cue).toContain('A count that runs PAST "three" is WRONG');
    expect(cue).toContain('only the number they land on is their answer');
    // ...and the other two fluent non-answers.
    expect(cue).toContain('Saying the word "butterfly" back, or saying its parts without a number');
  });

  it('states the two-branch law BEFORE the branches (18d)', () => {
    // A model reading top-down has already met both branches when it is told
    // they are the only two. Wording is byte-shared with the family.
    const cue = itemCue(BUTTERFLY);
    const law = cue.indexOf('Your whole reply to their attempt is ONE of the quoted lines below');
    expect(law).toBeGreaterThan(-1);
    expect(cue).toContain('no scaffolding line');
    expect(law).toBeLessThan(cue.indexOf('If the answer is right'));
  });

  it('gives every cue the NEVER_PERFORM tail (item 21)', () => {
    // This is a listening task with a near-empty screen, so the tutor holds long
    // silences with nothing to narrate — exactly where a model reaches for
    // filler that opens with neither sentinel.
    for (const cue of [
      itemCue(BUTTERFLY), itemCue(CAT, { opening: true, howToPlay: true }),
      moveOnCue(BUTTERFLY, WATERMELON), pronounceCue(CAT), hearPartCue('ter'),
    ]) {
      expect(cue).toContain('never announce the activity\'s state');
      expect(cue).toContain('never announce that you are waiting or listening');
    }
  });
});

// ── 6. Session frame + the catalog contract ────────────────────────────────

describe('syllable-clapper pack · session frame and catalog', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'syllable-clapper')!;

  it('the opening cue has ONE job; the final cues stop the tutor', () => {
    const opening = spokenLine(itemCue(CAT, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Words are made of parts, and we can hear them!');
    // The greeting, the rule, the worked example, the word and the question all
    // ride INSIDE one quoted line (SWAP-1) — there is no second turn to add.
    expect(opening).toContain('Watch me first: pencil. Pen … cil. That is two parts.');
    expect(opening).toContain('Listen: cat.');
    expect(opening).toContain('how many parts in cat');
    expect(moveOnCue(WATERMELON, null)).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, BUTTERFLY)).toEqual([]);
  });

  it('declares misconceptionScope, or the Tier-A packets are dropped before the distiller', () => {
    expect(entry.misconceptionScope).toBe('primitive');
  });

  it('every rung of the scaffolding ladder routes through the scripted correction (18d)', () => {
    const rungs = Object.values(entry.tutoring!.scaffoldingLevels!);
    expect(rungs).toHaveLength(3);
    for (const rung of rungs) {
      expect(rung.toLowerCase()).toContain('scripted correction line');
      expect(rung.toLowerCase()).not.toMatch(/say the (question|word) (once more|again)/);
    }
  });

  it('no commonStruggles response to an ATTEMPT offers a re-spoken ask (18d)', () => {
    // The silence row is EXEMPT and deliberately so — silence is not an attempt,
    // so a re-spoken ask is the correct move there.
    for (const struggle of entry.tutoring!.commonStruggles!) {
      if (/goes quiet|says nothing|silent/i.test(struggle.pattern)) continue;
      expect(struggle.response.toLowerCase()).not.toMatch(
        /say the (word|question|number) once more/,
      );
    }
  });

  it('CATALOG STEERING REGRESSION: no click-era prose survives to route this wrong', () => {
    // "tap/clap to count its syllables" in the description routed the manifest to
    // a button surface forever. The whole entry now says the answer is spoken.
    const prose = `${entry.description} ${entry.constraints}`;
    expect(prose).not.toMatch(/tap\/clap|clap to count|visual bar splits/i);
    expect(prose).toMatch(/microphone/i);
    expect(entry.audioInput).toEqual({ manual_activity: true });
    // And the tier reveal-policy directive is gone with the improvised turns it
    // governed — its {{supportTier}} key is no longer pushed by anything.
    expect(entry.tutoring!.contextKeys).toEqual(['challengeType', 'stimulus']);
  });
});

// ── 7. The judged-loop harness surface ─────────────────────────────────────

describe('syllable-clapper · DI harness surface', () => {
  it('the surface the harness replays IS the one the component spreads', () => {
    const surface = syllableClapperPackBase(ITEMS);
    expect(surface.primitiveType).toBe('syllable-clapper');
    expect(surface.items).toBe(ITEMS);
    expect(surface.itemCue(BUTTERFLY, { opening: true, howToPlay: true }))
      .toBe(itemCue(BUTTERFLY, { opening: true, howToPlay: true }));
    expect(surface.contextFor(BUTTERFLY))
      .toEqual({ challengeType: 'medium', stimulus: 'butterfly' });
  });

  it('the signature wrong is the hole the accept clause opens — a count ONE PAST', () => {
    // The sharpest in the family, because the accept clause MANUFACTURES it: a
    // five-year-old counts out loud, so "one, two, three" must be accepted for a
    // three-part word — which makes "one, two, three, four" an utterance that
    // contains the correct answer, fluently, in a natural counting rhythm, and
    // is wrong. Only reading the LANDING separates them.
    const answers = syllableClapperHarnessAnswers(BUTTERFLY);
    expect(answers.correct).toBe('three');
    expect(answers.signatureWrong!.text).toBe('one, two, three, four');
    expect(answers.signatureWrong!.text).toContain(answers.correct);
    expect(itemCue(BUTTERFLY)).toContain('A count that runs PAST "three" is WRONG');
    // It exists on a one-part word too, which is where over-counting starts.
    expect(syllableClapperHarnessAnswers(CAT).signatureWrong!.text).toBe('one, two');
  });

  it('a plain wrong is a real alternative count, never the answer', () => {
    for (const item of ITEMS) {
      const answers = syllableClapperHarnessAnswers(item);
      expect(answers.correct).toBe(item.answer);
      expect(answers.plainWrong).not.toBe(item.answer);
      expect(answers.leakTokens).toEqual([item.answer]);
    }
  });

  it('issues NO leak exemption — the ask is answer-free, so the oracle stays FLAT', () => {
    // Every other port with a worked example or a spoken menu had to subtract a
    // span. Here `pickModelWord` keeps the example's count off the answer, so
    // the scan stays live over the greeting, the example, the ask and the
    // hand-over — and catches a model that substitutes its own practice word.
    for (const item of ITEMS) {
      expect(syllableClapperHarnessAnswers(item).leakExemptSpan).toBeUndefined();
    }
  });
});
