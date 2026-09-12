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
 *  3. ⭐ THE ENUNCIATION LADDER, which is the whole port, and the fact that it
 *     INVERTS between the acts: on `count_parts` and `delete_compound` the ask
 *     says the word as one joined stream at EVERY tier and the parts are chanted
 *     ONLY in the correction, where they are earned; on `blend_syllables` the
 *     chant IS the ask and the joined word is what may never be said early.
 *  4. BUILD GATES drop what cannot be asked honestly — parts that do not spell
 *     their word, counts outside 1..5, unsayable words, and ⭐ words whose
 *     syllable count is not one number in English.
 *  5. Corrections re-model then re-elicit; affirmations carry the count and its
 *     unit, singular included.
 *  6. The support tier reaches the ASK and nothing else.
 *  6b. ⭐ THE THREE ACTS ARE THREE SKILLS: each has its own answer material, its
 *     own near-miss, and its own leak shape — and a legacy payload carrying a
 *     word-LENGTH band still plays, as the counting act it always was.
 *  7. The catalog keeps its side: template keys resolve against exactly what
 *     the pack pushes, no catalog sentence opens with a verdict sentinel, and
 *     every scaffolding rung routes through the scripted correction (18d).
 */
import { describe, it, expect } from 'vitest';
import {
  DIALECT_VARIABLE_WORDS,
  DELETION_MODEL_WORDS,
  MODEL_WORDS,
  affirmFor,
  askFor,
  chantOf,
  chantPart,
  completeCue,
  correctionFor,
  deletionShapeIsValid,
  endsWithSilentESyllable,
  hasStableSyllableCount,
  hearPartCue,
  isCompoundPartWord,
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
  taskOf,
  type SyllableClapperItem,
} from '../syllableClapperScript';
import { SYLLABLE_CLAPPER_EVAL_MODES } from '../syllableClapperModes';
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
    challengeType: 'count_parts',
    ...over,
  })!;

const BUTTERFLY = build();
const CAT = build({ id: 'c2', word: 'cat', syllables: ['cat'] });
const TIGER = build({ id: 'c3', word: 'tiger', syllables: ['ti', 'ger'] });
const WATERMELON = build({ id: 'c4', word: 'watermelon', syllables: ['wa', 'ter', 'mel', 'on'] });

const ITEMS: SyllableClapperItem[] = [CAT, TIGER, BUTTERFLY, WATERMELON];

/** The two acts added 2026-09-11. Blending reuses ordinary words; deletion is
 *  restricted to two-part compounds whose halves are both real words. */
const BLEND = build({ id: 'b1', challengeType: 'blend_syllables' });
const BLEND_TIGER = build({
  id: 'b2', word: 'tiger', syllables: ['ti', 'ger'], challengeType: 'blend_syllables',
});
const CUPCAKE = build({
  id: 'd1', word: 'cupcake', syllables: ['cup', 'cake'],
  challengeType: 'delete_compound', removePart: 'cup', residue: 'cake',
});
const STARFISH = build({
  id: 'd2', word: 'starfish', syllables: ['star', 'fish'],
  challengeType: 'delete_compound', removePart: 'fish', residue: 'star',
});

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

  it('every item is VOICE, and the response class follows the ACT', () => {
    for (const item of ITEMS) {
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('number_word_to_20');
    }
    // Blending and deleting both produce ONE spoken word, from a per-item closed
    // target — benched `short_spoken_word`, not the counting class.
    for (const item of [BLEND, CUPCAKE]) {
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('short_spoken_word');
    }
    expect(responseClassFor('count_parts')).toBe('number_word_to_20');
    expect(responseClassFor('blend_syllables')).toBe('short_spoken_word');
    expect(responseClassFor('delete_compound')).toBe('short_spoken_word');
    expect(CAT.answer).toBe('one');
    expect(TIGER.answer).toBe('two');
    expect(BUTTERFLY.answer).toBe('three');
    expect(WATERMELON.answer).toBe('four');
    // The benched class excludes zero; a syllable count can never be zero, and
    // the build gate floors at one regardless.
    expect(itemFromChallenge({ id: 'z', word: 'cat', syllables: [] })).toBeNull();
  });

  it('the ACT is the action — so a run of one act states the rule once', () => {
    for (const item of ITEMS) expect(item.action).toBe('count_parts');
    expect(BLEND.action).toBe('blend_syllables');
    expect(CUPCAKE.action).toBe('delete_compound');
    // A run that stays in one act speaks the how-to-play on the opening and
    // never again; the runner re-speaks it when `action` changes, which is
    // exactly when the child is being asked to do a different thing.
    expect(itemCue(BUTTERFLY, { opening: true, howToPlay: true })).toContain('Watch me first');
    expect(itemCue(BUTTERFLY)).not.toContain('Watch me first');
  });

  it('pushes the ACT as challengeType, and the QUESTION as the stimulus', () => {
    expect(pack.contextFor(CAT)).toEqual({ challengeType: 'count_parts', stimulus: 'cat' });
    expect(pack.contextFor(CUPCAKE))
      .toEqual({ challengeType: 'delete_compound', stimulus: 'cupcake' });
    // ⭐ ON BLENDING THE WORD IS THE ANSWER, so what crosses the context channel
    // is the CHANT. Pushing the word here would hand the answer to the tutor as
    // runtime state, outside every cue the leak oracle reads.
    expect(pack.contextFor(BLEND))
      .toEqual({ challengeType: 'blend_syllables', stimulus: 'but … ter … fly' });
  });

  it('a LEGACY word-band payload still plays, as the counting act it always was', () => {
    // The three eval modes used to be `easy`/`medium`/`hard`. Cached lessons and
    // hand-authored payloads carry them, and a band is not an act, so they
    // resolve to the only act they ever meant.
    for (const band of ['easy', 'medium', 'hard', undefined, 'nonsense']) {
      expect(taskOf(band)).toBe('count_parts');
    }
    const legacy = build({ id: 'legacy', challengeType: 'medium' });
    expect(legacy.task).toBe('count_parts');
    expect(legacy.answer).toBe('three');
  });

  it('the catalog eval modes ARE the mode contract — one declaration, no copies', () => {
    expect(SYLLABLE_CLAPPER_EVAL_MODES.map((m) => m.evalMode))
      .toEqual(['blend_syllables', 'count_parts', 'delete_compound']);
    // Ordered lowest β to highest, and no adjacent gap over 1.0 — blending is
    // genuinely the easier act and deletion genuinely the harder one.
    const betas = SYLLABLE_CLAPPER_EVAL_MODES.map((m) => m.beta);
    expect(betas).toEqual([...betas].sort((a, b) => a - b));
    for (let i = 1; i < betas.length; i++) expect(betas[i] - betas[i - 1]).toBeLessThanOrEqual(1);
  });
});

// ── 2. Answer-leak: the ask never contains a number ─────────────────────────

describe('syllable-clapper pack · answer-leak', () => {
  it('no COUNTING ask, at any tier, contains any number word', () => {
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

  it('each act demonstrates on its OWN pool, and a deletion demo obeys the deletion gate', () => {
    // A counting model ("umbrella") cannot demonstrate deletion — its parts are
    // not words — so deletion draws from its own compound pool. A demo that
    // could not itself be an item is a demo of a different game.
    expect(spokenLine(itemCue(BLEND, { opening: true, howToPlay: true })))
      .toContain('Watch me first: pen … cil. That is pencil.');
    expect(spokenLine(itemCue(CUPCAKE, { opening: true, howToPlay: true })))
      .toContain('Watch me first: sunhat without sun is hat.');
    for (const model of DELETION_MODEL_WORDS) {
      expect(model.parts).toHaveLength(2);
      expect(deletionShapeIsValid(model.parts, model.parts[0], model.parts[1])).toBe(true);
    }
    // ...and the demo is never THIS item's word.
    expect(spokenLine(itemCue(CUPCAKE, { opening: true, howToPlay: true })))
      .not.toContain('Watch me first: cupcake');
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

  it('the context push is question-side on every act', () => {
    expect(stimulusFor(BUTTERFLY)).toBe('butterfly');
    for (const item of ITEMS) expect(stimulusFor(item)).not.toMatch(NUMBER_WORDS);
    // Blending's stimulus is the chant; deletion's is the word, whose residue is
    // the answer — but the residue is not separately pushed anywhere.
    expect(stimulusFor(BLEND)).toBe('but … ter … fly');
    expect(stimulusFor(CUPCAKE)).toBe('cupcake');
  });

  it('⭐ a BLENDING ask never says the joined word — the word IS the answer', () => {
    // The mirror image of the counting leak rule, and the reason the rule is
    // about the ANSWER rather than about a form of words: the chant that would
    // hand the count over on `count_parts` is the legitimate question here, and
    // the joined word that is the harmless stimulus there is the answer here.
    for (const item of [BLEND, BLEND_TIGER]) {
      const ask = spokenLine(itemCue(item));
      expect(ask).toContain(chantOf(item.parts));
      expect(ask).not.toContain(item.word);
      expect(itemCue(item)).toContain('the joined word is the answer');
    }
    // The tier's second saying repeats the CHANT, never the word.
    const echoed = build({ challengeType: 'blend_syllables', echoWordSlowly: true });
    expect(spokenLine(itemCue(echoed))).toContain('Again: but … ter … fly.');
    expect(spokenLine(itemCue(echoed))).not.toContain('butterfly');
  });

  it('⭐ a DELETION ask says the word, which CONTAINS the residue — by design', () => {
    // "cupcake" contains "cake". That is not a leak, it is the task: the child
    // has to find the part and take it away. What the ask must not do is say the
    // residue on its OWN, which is what the affirmation and correction do.
    const ask = spokenLine(itemCue(CUPCAKE));
    expect(ask).toBe('Listen: cupcake. Again, slowly: cupcake. Your turn. Say cupcake without cup.');
    expect(ask).not.toMatch(/\bcake\b/);
    expect(spokenLine(itemCue(STARFISH))).not.toMatch(/\bstar\b/);
  });

  it('tap-to-hear replays the question and never the answer', () => {
    for (const item of ITEMS) {
      expect(spokenLine(pronounceCue(item))).toBe(askFor(item));
      expect(spokenLine(pronounceCue(item))).not.toMatch(NUMBER_WORDS);
      expect(pronounceCue(item)).toContain('never say the answer');
    }
    for (const item of [BLEND, CUPCAKE]) {
      expect(spokenLine(pronounceCue(item))).toBe(askFor(item));
    }
    // The per-part cue only exists behind the reveal, where the count is public.
    expect(hearPartCue('ter')).toContain('"ter"');
    expect(hearPartCue('ter')).toContain('do not say the whole word');
  });
});

// ── 3. ⭐ The enunciation ladder — the port's whole instrument ───────────────

describe('syllable-clapper pack · purposeful enunciation', () => {
  it('the COUNTING ask says the word as ONE JOINED STREAM at every tier', () => {
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
      // DELETION shares the rule: its word is one stream too.
      const deletion = build({
        ...tier, word: 'cupcake', syllables: ['cup', 'cake'],
        challengeType: 'delete_compound', removePart: 'cup', residue: 'cake',
      });
      expect(itemCue(deletion)).toContain('ONE JOINED STREAM');
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
      .toEqual({ challengeType: 'count_parts', stimulus: 'butterfly' });
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

  it('COUNTING issues NO leak exemption — its ask is answer-free, so the oracle stays FLAT', () => {
    // Every other port with a worked example or a spoken menu had to subtract a
    // span. Here `pickModelWord` keeps the example's count off the answer, so
    // the scan stays live over the greeting, the example, the ask and the
    // hand-over — and catches a model that substitutes its own practice word.
    for (const item of ITEMS) {
      expect(syllableClapperHarnessAnswers(item).leakExemptSpan).toBeUndefined();
    }
  });

  it('⭐ BLENDING\'s signature wrong is the parts said straight back, unjoined', () => {
    // The ask HANDS the child the answer's own pieces, so the fluent wrong
    // answer is made entirely of them. Nothing a judge can do by string overlap
    // separates it from the right answer; only whether they were JOINED does.
    const answers = syllableClapperHarnessAnswers(BLEND);
    expect(answers.correct).toBe('butterfly');
    expect(answers.signatureWrong!.text).toBe('but, ter, fly');
    expect(answers.plainWrong).not.toBe('butterfly');
    expect(itemCue(BLEND)).toContain('Saying the parts back one at a time, still separated, is NOT the answer');
    // The exemption subtracts the chant and nothing else, so the greeting, the
    // worked example, the question and the hand-over all stay governed.
    expect(answers.leakExemptSpan).toEqual(['but … ter … fly']);
    expect(answers.leakTokens).toEqual(['butterfly']);
  });

  it('⭐ DELETION\'s signature wrong is the stimulus echoed, which CONTAINS the answer', () => {
    const answers = syllableClapperHarnessAnswers(CUPCAKE);
    expect(answers.correct).toBe('cake');
    expect(answers.signatureWrong!.text).toBe('cupcake');
    expect(answers.signatureWrong!.text).toContain(answers.correct);
    // And the plain wrong is the part that was taken AWAY — named in the ask,
    // and the commonest real error a five-year-old makes on this task.
    expect(answers.plainWrong).toBe('cup');
    expect(itemCue(CUPCAKE)).toContain('Saying the whole word "cupcake" back is wrong');
    expect(itemCue(CUPCAKE)).toContain('Saying "cup", the part that was taken AWAY, is wrong');
    expect(answers.leakExemptSpan).toEqual(['cupcake']);
  });
});

// ── 8. The two new acts: contracts and build gates ─────────────────────────

describe('syllable-clapper · blending and deletion', () => {
  it('blending affirms and corrects on the WORD, and the chant is the model', () => {
    expect(affirmFor(BLEND)).toBe('Yes, butterfly.');
    expect(correctionFor(BLEND))
      .toBe('My turn: but … ter … fly. Butterfly. Your turn. Put the parts together. What word is that?');
    expect(spokenLine(itemCue(BLEND)))
      .toBe('Listen: but … ter … fly. Again: but … ter … fly. Your turn. Put the parts together. What word is that?');
  });

  it('deleting affirms and corrects on the RESIDUE, and states the deletion', () => {
    expect(affirmFor(CUPCAKE)).toBe('Yes, cake.');
    expect(correctionFor(CUPCAKE))
      .toBe('My turn: cupcake without cup is cake. Your turn. Say cupcake without cup.');
    expect(affirmFor(STARFISH)).toBe('Yes, star.');
    expect(correctionFor(STARFISH))
      .toBe('My turn: starfish without fish is star. Your turn. Say starfish without fish.');
  });

  it('⭐ drops a deletion whose residue is not a real word a child can SAY', () => {
    // The gate the act needed, and the whole reason deletion is restricted to
    // two-part compounds: "banana without ba" leaves "nana", which is not a word
    // a five-year-old can produce with confidence or a judge can honestly score.
    expect(itemFromChallenge({
      id: 'x', word: 'banana', syllables: ['ba', 'nan', 'a'],
      challengeType: 'delete_compound', removePart: 'ba', residue: 'nana',
    })).toBeNull();
    // Three parts is out regardless of what the residue claims to be.
    expect(itemFromChallenge({
      id: 'x', word: 'butterfly', syllables: ['but', 'ter', 'fly'],
      challengeType: 'delete_compound', removePart: 'but', residue: 'terfly',
    })).toBeNull();
    // A residue that is not one of the two parts at all. ⭐ THIS IS THE CASE
    // THE REVERT-BITE NEEDS: it is a legal TWO-part word, so the part window
    // waves it through and only the deletion gate refuses it. A run without
    // this case passes with the gate deleted.
    expect(deletionShapeIsValid(['cup', 'cake'], 'cup', 'pie')).toBe(false);
    expect(itemFromChallenge({
      id: 'x', word: 'cupcake', syllables: ['cup', 'cake'],
      challengeType: 'delete_compound', removePart: 'cup', residue: 'pie',
    })).toBeNull();
    // ...as is a deletion item that names no part to remove at all.
    expect(itemFromChallenge({
      id: 'x', word: 'cupcake', syllables: ['cup', 'cake'],
      challengeType: 'delete_compound',
    })).toBeNull();
    // The same part named on both sides.
    expect(deletionShapeIsValid(['cup', 'cake'], 'cup', 'cup')).toBe(false);
    // A one-letter part read aloud is a letter NAME, not a word.
    expect(deletionShapeIsValid(['a', 'go'], 'a', 'go')).toBe(false);
    // The honest shape survives, both directions.
    expect(deletionShapeIsValid(['cup', 'cake'], 'cup', 'cake')).toBe(true);
    expect(deletionShapeIsValid(['cup', 'cake'], 'cake', 'cup')).toBe(true);
  });

  it('⭐ FOUND BY THE LIVE PROBE: both halves must be WORDS, which only a list can decide', () => {
    // The first draw of this act returned `peanut → pe|anut`, removePart "pe",
    // residue "anut". Two parts, they spell the word, the residue is one of them
    // and it is sayable letters — every STRUCTURAL gate passed it, and the ask it
    // would have produced is "say peanut without pe", whose answer is a nonword.
    expect(isCompoundPartWord('anut')).toBe(false);
    expect(deletionShapeIsValid(['pe', 'anut'], 'pe', 'anut')).toBe(false);
    expect(itemFromChallenge({
      id: 'x', word: 'peanut', syllables: ['pe', 'anut'],
      challengeType: 'delete_compound', removePart: 'pe', residue: 'anut',
    })).toBeNull();
    // The same draw's "walnut → wal|nut": the RESIDUE is a word, the removed
    // part is not — and the tutor says the removed part out loud, so both halves
    // are gated, not just the answer.
    expect(isCompoundPartWord('wal')).toBe(false);
    expect(deletionShapeIsValid(['wal', 'nut'], 'wal', 'nut')).toBe(false);
    // ⭐ AND THE PARTS ARE WORDS, NOT SYLLABLES, which is why this mode is not
    // called syllable deletion: "dragon" is two beats and one word, and
    // "say dragonfly without dragon" is a real kindergarten task.
    expect(deletionShapeIsValid(['dragon', 'fly'], 'dragon', 'fly')).toBe(true);
    expect(build({
      id: 'x', word: 'dragonfly', syllables: ['dragon', 'fly'],
      challengeType: 'delete_compound', removePart: 'dragon', residue: 'fly',
    }).answer).toBe('fly');
  });

  it('blending refuses a ONE-part word — there is nothing to join', () => {
    expect(itemFromChallenge({
      id: 'x', word: 'cat', syllables: ['cat'], challengeType: 'blend_syllables',
    })).toBeNull();
    // ...while counting takes it happily: one part is a real count.
    expect(build({ id: 'x', word: 'cat', syllables: ['cat'] }).answer).toBe('one');
  });

  it('the shared word gate holds on every act — dialect words and bad splits still drop', () => {
    for (const type of ['blend_syllables', 'count_parts', 'delete_compound']) {
      expect(itemFromChallenge({
        id: 'x', word: 'flower', syllables: ['flow', 'er'],
        challengeType: type, removePart: 'flow', residue: 'er',
      })).toBeNull();
      expect(itemFromChallenge({
        id: 'x', word: 'cupcake', syllables: ['cup', 'kake'],
        challengeType: type, removePart: 'cup', residue: 'kake',
      })).toBeNull();
    }
  });

  it('a mixed-act run still passes the family gates', () => {
    expect(checkPackGates({ ...pack, items: [BLEND, BUTTERFLY, CUPCAKE, STARFISH] })).toEqual([]);
  });

  it('the word gate spans the ACTS — blending a word the session also counts is refused', () => {
    // The strongest version of the session gate, and the ladder is what makes it
    // load-bearing: a `blend_syllables` item CHANTS its word's parts, which is
    // the answer to that word's `count_parts` item, and the counting ask SAYS
    // the word, which is the answer to its blending item. Keying on the word
    // closes both directions in one rule.
    const kept = itemsFromChallenges([
      { id: 'a', word: 'tiger', syllables: ['ti', 'ger'], challengeType: 'count_parts' },
      { id: 'b', word: 'tiger', syllables: ['ti', 'ger'], challengeType: 'blend_syllables' },
      { id: 'c', word: 'rabbit', syllables: ['rab', 'bit'], challengeType: 'blend_syllables' },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['a', 'c']);
  });
});
