/**
 * wordSorterScript — the pedagogy lives there, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (`checkPackGates` =
 *     validateJudgedScriptPack + the performed-stage-direction scan + the
 *     byte-identical-consecutive-ask gate), on a fixture AND on the real
 *     session shape — several items of ONE mode back to back, which is the only
 *     shape the repeat-ask gate can fire on.
 *  2. THE FORK, both directions: every mode is SPOKEN and every response class
 *     is `short_spoken_word`. The regression this locks out is a mode drifting
 *     back to a tap — the taps were costumes (a child who cannot categorise
 *     could still land a bucket at a 1-in-2 floor with instant feedback), and
 *     `answerKind: 'gesture'` anywhere here would mean the fork was re-decided.
 *  3. THE MENU IS THE QUESTION, and the leak oracle knows exactly how much of
 *     it is legitimate: a sort ask names its groups (an unnamed group is an
 *     unanswerable question) and exempts precisely that clause; at `hard` for a
 *     reader it names none and the exemption disappears; a match ask never
 *     speaks its printed bank at any tier.
 *  4. THE BANK DOES NOT SHRINK. Every item of a match challenge offers the same
 *     whole bank — the click era consumed it, so its last pair had one option
 *     left and needed no reading at all.
 *  5. Build gates DROP what cannot be asked: an unsayable or indistinguishable
 *     label, a word that is also a label, a kept set that lands in one group, a
 *     bank that is not ear-separable, anything opening with a verdict sentinel.
 *  6. Corrections open "My turn:", NAME the fact (a category is a fact, not a
 *     route — withholding it leaves the correction nothing to teach), and
 *     re-elicit the same item; the affirm echoes the canonical wording.
 *  7. The catalog keeps its side of the contract: the family audio mode,
 *     template keys resolving against exactly what the pack pushes, no sentence
 *     opening with a verdict sentinel, and no steering prose left over for a
 *     deleted tap surface.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_ITEMS_PER_CHALLENGE,
  MAX_ITEMS_PER_SESSION,
  answerKindFor,
  askFor,
  choicesPhrase,
  completeCue,
  isSayableLabel,
  isSayableWord,
  itemCue,
  itemsFromChallenge,
  itemsFromChallenges,
  leakExemptSpanFor,
  moveOnCue,
  normalizeRelation,
  optionsEarSeparable,
  pronounceCue,
  responseClassFor,
  stimulusFor,
  wordSorterHarnessAnswers,
  wordSorterPackBase,
  type WordSorterChallengeLike,
  type WordSorterItem,
} from '../wordSorterScript';
import {
  spokenSpanOf,
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures ────────────────────────────────────────────────────────────────

const BINARY_RAW: WordSorterChallengeLike = {
  id: 'ws-b1',
  type: 'binary_sort',
  bucketLabels: ['Animals', 'Food'],
  bucketEmojis: ['🐾', '🍎'],
  words: [
    { id: 'w0', word: 'dog', emoji: '🐕', correctBucket: 'Animals' },
    { id: 'w1', word: 'bread', emoji: '🍞', correctBucket: 'Food' },
    { id: 'w2', word: 'cat', emoji: '🐈', correctBucket: 'Animals' },
    { id: 'w3', word: 'apple', emoji: '🍏', correctBucket: 'Food' },
  ],
};

const TERNARY_RAW: WordSorterChallengeLike = {
  id: 'ws-t1',
  type: 'ternary_sort',
  bucketLabels: ['Animals', 'Food', 'Toys'],
  bucketEmojis: ['🐾', '🍎', '🧸'],
  words: [
    { id: 'w0', word: 'horse', correctBucket: 'Animals' },
    { id: 'w1', word: 'rice', correctBucket: 'Food' },
    { id: 'w2', word: 'ball', correctBucket: 'Toys' },
  ],
};

const MATCH_RAW: WordSorterChallengeLike = {
  id: 'ws-m1',
  type: 'match_pairs',
  relationLabel: 'opposite',
  pairs: [
    { id: 'p0', term: 'big', match: 'small' },
    { id: 'p1', term: 'hot', match: 'cold' },
    { id: 'p2', term: 'up', match: 'down' },
  ],
  distractorMatches: [{ id: 'd0', text: 'wet' }],
};

const build = (
  challenges: WordSorterChallengeLike[],
  opts: Parameters<typeof itemsFromChallenges>[1] = {},
) => itemsFromChallenges(challenges, opts);

const packOf = (items: WordSorterItem[]): JudgedScriptPack<WordSorterItem> => ({
  ...wordSorterPackBase(items),
});

const plainAsk = (item: WordSorterItem) =>
  spokenSpanOf(itemCue(item, { opening: false, howToPlay: false }));

const catalogEntry = LITERACY_CATALOG.find((c) => c.id === 'word-sorter')!;

// ── 1. The family's structural gates ────────────────────────────────────────

describe('word-sorter pack gates', () => {
  it('passes every structural gate on a mixed-mode pack', () => {
    const items = build([BINARY_RAW, TERNARY_RAW, MATCH_RAW]);
    expect(items.length).toBeGreaterThan(0);
    expect(checkPackGates(packOf(items))).toEqual([]);
  });

  /**
   * ⚠️ THE SHAPE THAT ACTUALLY ARMS THE REPEAT-ASK GATE. It compares consecutive
   * items of the SAME action, so a one-item-per-mode fixture can never trigger
   * it. A real word-sorter session is FOUR TO SIX asks of one mode in a row —
   * which this port gets for free, because one challenge expands to one item per
   * word — and that is the pack the gate exists for.
   */
  it('passes the gates on the real session shape (one mode, many items)', () => {
    const items = build([BINARY_RAW]);
    expect(items.length).toBeGreaterThan(2);
    expect(new Set(items.map((i) => i.action)).size).toBe(1);
    expect(checkPackGates(packOf(items))).toEqual([]);
  });

  it('never recites a byte-identical ask, because the stimulus varies every round', () => {
    const items = build([BINARY_RAW]);
    const asks = items.map(plainAsk);
    expect(new Set(asks).size).toBe(asks.length);
  });
});

// ── 2. The answer-material fork, both directions ────────────────────────────

describe('the answer-material fork', () => {
  it('answers every mode OUT LOUD — a group name and a partner word are both sayable', () => {
    expect(answerKindFor('binary_sort')).toBe('voice');
    expect(answerKindFor('ternary_sort')).toBe('voice');
    expect(answerKindFor('match_pairs')).toBe('voice');
  });

  it('files every mode under short_spoken_word — one word from a closed per-item set', () => {
    expect(responseClassFor('binary_sort')).toBe('short_spoken_word');
    expect(responseClassFor('ternary_sort')).toBe('short_spoken_word');
    expect(responseClassFor('match_pairs')).toBe('short_spoken_word');
  });

  it('builds NO gesture item from any challenge — the taps were costumes', () => {
    const items = build([BINARY_RAW, TERNARY_RAW, MATCH_RAW]);
    expect(items.every((i) => i.answerKind === 'voice')).toBe(true);
    expect(items.some((i) => i.responseClass === 'manipulation')).toBe(false);
  });

  it('gives every item the spoken judging contract — target, accept clause, both branches', () => {
    for (const item of build([BINARY_RAW, MATCH_RAW])) {
      const cue = itemCue(item, {});
      expect(cue).toContain('The correct answer is');
      expect(cue).toContain('If the answer is right, say exactly:');
      expect(cue).toContain('If it is wrong, say exactly:');
      // A spoken item is never told to ignore the microphone.
      expect(cue).not.toMatch(/do not judge anything you hear/i);
      expect(spokenSpansOf(cue)).toHaveLength(3);
    }
  });

  it('names the signature error — the stimulus word said straight back', () => {
    const [item] = build([BINARY_RAW]);
    expect(itemCue(item, {})).toContain(`Saying the word "${item.word}" back is NOT an answer`);
    const answers = wordSorterHarnessAnswers(item);
    expect(answers.signatureWrong.text).toBe(item.word);
    expect(answers.correct).toBe(item.answer);
    expect(answers.plainWrong).not.toBe(item.answer);
  });
});

// ── 3. The menu is the question, and the oracle knows how much is legitimate ─

describe('the spoken menu and the leak oracle', () => {
  it('a sort ask NAMES its groups — an unnamed group is an unanswerable question', () => {
    const [item] = build([BINARY_RAW]);
    expect(item.namesChoices).toBe(true);
    const ask = plainAsk(item);
    expect(ask).toContain(choicesPhrase(item));
    expect(ask).toContain('Animals, or Food?');
  });

  it('exempts exactly the menu clause — the rest of the ask stays governed', () => {
    const [item] = build([BINARY_RAW]);
    const exempt = leakExemptSpanFor(item)!;
    expect(exempt).toBe(choicesPhrase(item));
    // Outside that clause the answer never appears: the greeting, the
    // how-to-play, the DISTAR lead-in and the hand-over are all clean.
    const opening = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
    expect(opening.split(exempt).join(' ')).not.toContain(item.answer);
  });

  it('at hard for a reader the ask names NO group and the oracle goes flat', () => {
    const [item] = build(
      [{ ...BINARY_RAW, namesSortCriterion: false }],
      { tier: 'hard', isPreReader: false },
    );
    expect(item.namesChoices).toBe(false);
    expect(leakExemptSpanFor(item)).toBeUndefined();
    const ask = plainAsk(item);
    for (const label of item.choices) expect(ask).not.toContain(label);
    // An ask that says nothing is broken rather than terser: it still states
    // its own problem out loud.
    expect(ask).toContain('Which group does it belong with?');
  });

  it('K band floor beats the tier — a pre-reader cannot read a mat', () => {
    const [item] = build(
      [{ ...BINARY_RAW, namesSortCriterion: false }],
      { tier: 'hard', isPreReader: true },
    );
    expect(item.namesChoices).toBe(true);
    expect(plainAsk(item)).toContain(choicesPhrase(item));
  });

  it('a match ask never speaks its printed bank, at any tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const [item] = build([MATCH_RAW], { tier });
      expect(leakExemptSpanFor(item)).toBeUndefined();
      const opening = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
      for (const option of item.choices) expect(opening).not.toContain(option);
      expect(opening).toContain('Which word means the opposite of big?');
    }
  });

  it('pushes an answer-free stimulus — the context channel never carries the choices', () => {
    for (const item of build([BINARY_RAW, MATCH_RAW])) {
      const stimulus = stimulusFor(item);
      expect(stimulus).toContain(item.word);
      expect(stimulus).not.toContain(item.answer);
    }
  });

  it('tap-to-hear re-speaks the QUESTION and never the answer', () => {
    for (const item of build([BINARY_RAW, MATCH_RAW])) {
      const line = spokenSpanOf(pronounceCue(item));
      expect(line).toContain(item.word);
      const exempt = leakExemptSpanFor(item);
      expect(exempt ? line.split(exempt).join(' ') : line).not.toContain(item.answer);
    }
  });
});

// ── 4. The bank does not shrink ─────────────────────────────────────────────

describe('the word bank', () => {
  it('offers the SAME whole bank on every item — no answer is reachable by elimination', () => {
    const items = build([MATCH_RAW]);
    expect(items.length).toBe(3);
    const banks = items.map((i) => i.choices.join('|'));
    expect(new Set(banks).size).toBe(1);
    // Every partner plus the tier decoy, which is indistinguishable from them.
    expect(items[0].choices).toEqual(expect.arrayContaining(['small', 'cold', 'down', 'wet']));
  });

  it('keeps every item answerable from that bank', () => {
    for (const item of build([MATCH_RAW])) {
      expect(item.choices).toContain(item.answer);
      expect(item.choices.filter((c) => c === item.answer)).toHaveLength(1);
    }
  });

  it('reads the relation off the challenge and asks a real question with it', () => {
    expect(normalizeRelation('opposites')).toBe('opposite');
    expect(normalizeRelation('singular to plural')).toBe('plural');
    expect(normalizeRelation('rhyming words')).toBe('rhyme');
    // Unrecognised falls back to the askable generic — with the bank printed
    // there is still exactly one right answer, so the item is less SPECIFIC,
    // not broken.
    expect(normalizeRelation('mystery')).toBe('partner');
    const [plural] = build([{ ...MATCH_RAW, relationLabel: 'plural' }]);
    expect(askFor(plural)).toContain('Which word means more than one big?');
  });
});

// ── 5. Build gates — DROP, never repair ─────────────────────────────────────

describe('build gates', () => {
  it('drops a challenge whose labels are not sayable', () => {
    expect(isSayableLabel('Animals')).toBe(true);
    expect(isSayableLabel('Things that are alive and can move on their own')).toBe(false);
    expect(isSayableLabel('Nouns (naming words)')).toBe(false);
    expect(
      itemsFromChallenge({ ...BINARY_RAW, bucketLabels: ['Animals', 'Things you can eat quickly at noon'] }),
    ).toEqual([]);
  });

  it('drops a challenge whose labels cannot be told apart by ear', () => {
    expect(optionsEarSeparable(['Big', 'Small'])).toBe(true);
    expect(optionsEarSeparable(['Big', 'Big Things'])).toBe(false);
    expect(
      itemsFromChallenge({
        ...BINARY_RAW,
        bucketLabels: ['Big', 'Big Things'],
        words: [
          { id: 'w0', word: 'ant', correctBucket: 'Big' },
          { id: 'w1', word: 'bus', correctBucket: 'Big Things' },
        ],
      }),
    ).toEqual([]);
  });

  it('drops a word that is also a group label — the ask would be a riddle', () => {
    const items = itemsFromChallenge({
      ...BINARY_RAW,
      words: [
        ...(BINARY_RAW.words ?? []),
        { id: 'w9', word: 'Animals', correctBucket: 'Food' },
      ],
    });
    expect(items.map((i) => i.word)).not.toContain('Animals');
  });

  it('drops a sort whose surviving words all land in ONE group', () => {
    expect(
      itemsFromChallenge({
        ...BINARY_RAW,
        words: [
          { id: 'w0', word: 'dog', correctBucket: 'Animals' },
          { id: 'w1', word: 'cat', correctBucket: 'Animals' },
        ],
      }),
    ).toEqual([]);
  });

  it('refuses anything that opens with a verdict sentinel', () => {
    expect(isSayableWord('yes')).toBe(false);
    expect(isSayableLabel('Yes Words')).toBe(false);
    const items = itemsFromChallenge({
      ...MATCH_RAW,
      pairs: [
        { id: 'p0', term: 'big', match: 'small' },
        { id: 'p1', term: 'hot', match: 'cold' },
        { id: 'p2', term: 'yes', match: 'no' },
      ],
    });
    expect(items.map((i) => i.word)).not.toContain('yes');
  });

  it('drops a match challenge whose bank is not ear-separable', () => {
    // Every entry is individually sayable; the SET is the problem — a child who
    // says "ice" has answered two of them, so there is no honest verdict.
    expect(optionsEarSeparable(['ice cream', 'ice', 'down'])).toBe(false);
    expect(
      itemsFromChallenge({
        ...MATCH_RAW,
        distractorMatches: [],
        pairs: [
          { id: 'p0', term: 'cone', match: 'ice cream' },
          { id: 'p1', term: 'cube', match: 'ice' },
          { id: 'p2', term: 'up', match: 'down' },
        ],
      }),
    ).toEqual([]);
  });

  /**
   * The cap is a LENGTH bound, not a gate — but a cap applied blindly can strand
   * a whole mat, and on a binary sort that makes one label right every round.
   */
  it('caps a long challenge while still reaching every group', () => {
    const many: WordSorterChallengeLike = {
      ...TERNARY_RAW,
      words: [
        { id: 'w0', word: 'horse', correctBucket: 'Animals' },
        { id: 'w1', word: 'cow', correctBucket: 'Animals' },
        { id: 'w2', word: 'goat', correctBucket: 'Animals' },
        { id: 'w3', word: 'sheep', correctBucket: 'Animals' },
        { id: 'w4', word: 'rice', correctBucket: 'Food' },
        { id: 'w5', word: 'bread', correctBucket: 'Food' },
        { id: 'w6', word: 'ball', correctBucket: 'Toys' },
        { id: 'w7', word: 'kite', correctBucket: 'Toys' },
      ],
    };
    const items = itemsFromChallenge(many);
    expect(items).toHaveLength(MAX_ITEMS_PER_CHALLENGE);
    expect(new Set(items.map((i) => i.answer))).toEqual(new Set(['Animals', 'Food', 'Toys']));
  });

  it('caps the SESSION rather than asking thirty questions', () => {
    const items = build([BINARY_RAW, TERNARY_RAW, MATCH_RAW, BINARY_RAW, TERNARY_RAW]);
    expect(items.length).toBeLessThanOrEqual(MAX_ITEMS_PER_SESSION);
  });

  it('gives every item a unique id even when two challenges reuse word ids', () => {
    const items = build([BINARY_RAW, TERNARY_RAW]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
});

// ── 6. Corrections and affirmations ─────────────────────────────────────────

describe('corrections and affirmations', () => {
  it('opens the correction with "My turn:", names the fact, then re-elicits', () => {
    const [sortItem] = build([BINARY_RAW]);
    const [, , correction] = spokenSpansOf(itemCue(sortItem, {}));
    expect(correction.startsWith('My turn:')).toBe(true);
    expect(correction).toContain(`${sortItem.word} belongs with ${sortItem.answer}`);
    // The re-elicit is the SAME ask, so a correction inherits whatever the tier
    // decided about naming the groups.
    expect(correction).toContain(askFor(sortItem));
  });

  it('re-models a match correction as the relationship, not a bare word', () => {
    const [matchItem] = build([MATCH_RAW]);
    const [, , correction] = spokenSpansOf(itemCue(matchItem, {}));
    expect(correction).toContain('big and small are opposites');
  });

  it('opens every affirmation with "Yes," and echoes the canonical wording', () => {
    const [sortItem] = build([BINARY_RAW]);
    const [, sortAffirm] = spokenSpansOf(itemCue(sortItem, {}));
    expect(sortAffirm).toBe(`Yes, ${sortItem.word} belongs with ${sortItem.answer}.`);

    const [matchItem] = build([MATCH_RAW]);
    const [, matchAffirm] = spokenSpansOf(itemCue(matchItem, {}));
    expect(matchAffirm).toBe('Yes, the opposite of big is small.');
  });

  /**
   * The intent the click-era pin carried — "a capped item does not end with the
   * child still not knowing" — is served by the CORRECTION here, which names the
   * fact and runs twice before the cap. So the move-on carries no close line,
   * and that is what keeps a label out of the move-on utterance: every item of a
   * challenge shares one label set, so a close line would name a label that is
   * very often the NEXT item's answer too (CONFIRMED HIGH `di-answer-leak-in-ask`,
   * cap drill 2026-08-16).
   */
  it('resolves a capped item in the CORRECTION, and leaks no label into the move-on', () => {
    const items = build([BINARY_RAW]);
    const [, , correction] = spokenSpansOf(itemCue(items[0], {}));
    expect(correction).toContain(`${items[0].word} belongs with ${items[0].answer}`);

    const next = items[1];
    const line = spokenSpanOf(moveOnCue(items[0], next, {}));
    expect(line).not.toContain(items[0].answer.toLowerCase());
    // The next item's ask is carried, so the only labels in the utterance sit
    // inside the menu clause the leak oracle subtracts.
    const exempt = leakExemptSpanFor(next)!;
    expect(line.split(exempt).join(' ')).not.toContain(next.answer);

    const last = spokenSpanOf(moveOnCue(items[items.length - 1], null, {}));
    expect(last).toContain('Good try!');
    expect(last).not.toContain(items[items.length - 1].answer);
  });

  /**
   * ⭐ Eleven of twelve affirmations ran on into a FABRICATED next ask on the cap
   * drill — a real word from the challenge, chosen by the model, that was not
   * the item the runner was about to send. `TWO_BRANCH_LAW` says the reply is one
   * quoted line "and nothing else" and `NEVER_PERFORM` bans narrating the STATE;
   * neither names *continuing the lesson*, which is what was being done.
   */
  it('tells every cue that the verdict line ENDS the turn', () => {
    const items = build([BINARY_RAW, MATCH_RAW]);
    for (const item of items) {
      for (const cue of [itemCue(item, {}), itemCue(item, { opening: true, howToPlay: true })]) {
        expect(cue).toContain('Your verdict line is the END of your turn');
        expect(cue).toContain('never say the next word');
      }
    }
    expect(moveOnCue(items[0], items[1], {})).toContain('the END of your turn');
  });

  it('speaks the how-to-play and the lead-in only when the ACTION is introduced', () => {
    const [item] = build([BINARY_RAW], { tier: 'easy' });
    const opening = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
    expect(opening).toContain('I say a word — you tell me which group it belongs with.');
    expect(opening).toContain('Think about what the word means');
    expect(opening).toContain('Say the word quietly to yourself first');

    const repeat = plainAsk(item);
    expect(repeat).not.toContain('I say a word');
    expect(repeat).not.toContain('Think about what the word means');
  });

  it('fades the lead-in by tier without ever touching the ask', () => {
    const ask = (tier: 'easy' | 'medium' | 'hard') => {
      const [item] = build([BINARY_RAW], { tier });
      return spokenSpanOf(itemCue(item, { opening: false, howToPlay: true }));
    };
    expect(ask('easy')).toContain('Say the word quietly to yourself first');
    expect(ask('medium')).not.toContain('Say the word quietly to yourself first');
    expect(ask('medium')).toContain('Think about what the word means');
    expect(ask('hard')).not.toContain('Think about what the word means');
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      expect(ask(tier)).toContain('Your turn. Listen: dog. Animals, or Food?');
    }
  });

  it('ends the session without a verdict sentinel anywhere', () => {
    expect(spokenSpanOf(completeCue())).toContain('out loud');
  });
});

// ── 7. The catalog's side of the contract ───────────────────────────────────

describe('catalog steering', () => {
  it('keeps the family contract — audio mode, context keys, template keys, sentinels', () => {
    const items = build([BINARY_RAW, MATCH_RAW]);
    expect(checkDiCatalogEntry(catalogEntry, packOf(items), items[0])).toEqual([]);
  });

  it('declares the microphone requirement in the manifest-steering prose', () => {
    expect(`${catalogEntry.description} ${catalogEntry.constraints}`.toLowerCase())
      .toContain('microphone');
  });

  it('no longer routes itself as a drag-and-tap primitive', () => {
    const steering = `${catalogEntry.description} ${catalogEntry.constraints}`.toLowerCase();
    expect(steering).not.toMatch(/drag word cards/);
    expect(steering).toContain('spoken');
  });

  it('carries no directive for a channel the port deleted', () => {
    const prose = JSON.stringify(catalogEntry.tutoring);
    expect(prose).not.toContain('WORD_STAGED');
    expect(prose).not.toContain('WORD_TAP');
    expect(prose).not.toContain('ACTIVITY_START');
    expect(prose).not.toMatch(/tap the bucket/i);
  });
});
