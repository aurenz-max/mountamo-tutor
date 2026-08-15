/**
 * wordWorkoutScript — the pedagogy lives here, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates) over the
 *     REAL session shape — same-action items back to back, because a
 *     one-item-per-mode fixture is the one shape the repeat-ask gate cannot see.
 *  2. THE FORK: four of five item kinds are SPOKEN and exactly one is a tap.
 *     `real_word` is the correction the queue needed — it predicted a tap held
 *     back by a sentinel collision on "yes", and the challenge never carried a
 *     yes/no question at all. `picture_tap` stays hands because naming the
 *     picture would only echo the printed word.
 *  3. ONE CHALLENGE IS NOT ONE ITEM: a chain is a judged read per word and a
 *     sentence is a read plus a spoken question. Pinned by count, because the
 *     click era scored a whole chain 100 for one button press.
 *  4. THE COLD READ, which is this port's whole leak rule. Everything printed
 *     is the stimulus AND the target, so the rule bites on the tutor's mouth:
 *     no ask, repeat, or context push may contain the print.
 *  5. Build gates DROP unaskable items — headed by the one that decided the
 *     fork: a real/nonsense pair that cannot be told apart BY EAR.
 *  6. The surviving support-tier lever reaches the SPOKEN channel: at
 *     chainCueLevel 'none' the correction stops naming what changed, because
 *     noticing it is the task at that tier.
 *  7. The catalog keeps its side of the contract and no click-era steering
 *     survives to route this primitive as a tap activity.
 *
 * NO TIMED-STIMULUS RE-RENDER TEST, deliberately: this stage presents nothing on
 * a clock. Every stimulus is print that is already there, so the ten-frame class
 * of defect (a flash keyed to a wall clock) has no surface here.
 */
import { describe, it, expect } from 'vitest';
import {
  affirmFor,
  answerKindFor,
  askFor,
  challengeAskable,
  chainWordOf,
  completeCueFor,
  containsWord,
  correctionFor,
  itemCue,
  isRealCvcWord,
  itemsFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  pairEarSeparable,
  pictureVerdictCue,
  pronounceCue,
  responseClassFor,
  stimulusFor,
  wordWorkoutHarnessAnswers,
  wordWorkoutPackBase,
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  type WordWorkoutChallengeLike,
  type WordWorkoutItem,
} from '../wordWorkoutScript';
import {
  findSentinelCollisions,
  spokenSpanOf,
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — the real session shape ───────────────────────────────────────

const RN1: WordWorkoutChallengeLike = {
  id: 'c1', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat',
};
const RN2: WordWorkoutChallengeLike = {
  id: 'c2', mode: 'real-vs-nonsense', realWord: 'bed', nonsenseWord: 'zeb',
};
const PM: WordWorkoutChallengeLike = {
  id: 'c3',
  mode: 'picture-match',
  targetWord: 'pig',
  targetImage: '🐷',
  distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }],
};
const CHAIN: WordWorkoutChallengeLike = {
  id: 'c4', mode: 'word-chains', chain: ['cat', 'hat', 'hot', 'hop'], changedPositions: [0, 1, 2],
};
const SR1: WordWorkoutChallengeLike = {
  id: 'c5',
  mode: 'sentence-reading',
  sentence: 'The cat sat on the mat.',
  cvcWords: ['cat', 'sat', 'mat'],
  sightWords: ['the', 'on'],
  comprehensionQuestion: 'Where did the cat sit?',
  comprehensionAnswer: 'mat',
};
const SR2: WordWorkoutChallengeLike = {
  id: 'c6',
  mode: 'sentence-reading',
  sentence: 'The pup dug in the mud.',
  cvcWords: ['pup', 'dug', 'mud'],
  sightWords: ['the', 'in'],
  comprehensionQuestion: 'Where did the pup dig?',
  comprehensionAnswer: 'mud',
};

const ITEMS: WordWorkoutItem[] = itemsFromChallenges([RN1, RN2, PM, CHAIN, SR1, SR2]);

const byKind = (kind: WordWorkoutItem['kind']) => ITEMS.filter((i) => i.kind === kind);
const first = (kind: WordWorkoutItem['kind']) => byKind(kind)[0];

/** The pack exactly as the component assembles it (the component spreads the
 *  same base, so this is one source, not a re-declaration). */
const pack: JudgedScriptPack<WordWorkoutItem> = { ...wordWorkoutPackBase(ITEMS) };

/** The line the contract owes on a CORRECT answer. Read positionally — the
 *  family writes its contract in one order (ask, then right, then wrong) and
 *  the drive plan extracts it exactly this way, so this pins that too. */
const affirmLineOf = (cue: string): string => spokenSpansOf(cue)[1] ?? '';

/** Every line the tutor can SPEAK for one item, across its whole life. */
const everySpokenLine = (item: WordWorkoutItem): string =>
  [
    spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })),
    spokenSpanOf(itemCue(item, { howToPlay: true })),
    spokenSpanOf(itemCue(item)),
    spokenSpanOf(moveOnCue(item, null, {})),
    spokenSpanOf(pronounceCue(item)),
  ].join('\n');

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('word-workout pack · structural gates', () => {
  it('passes the family gates over the session shape: validate + performed-directions + repeated-asks', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('runs same-action items back to back, so the repeat-ask gate is awake', () => {
    // Two real_word challenges in a row, and four chain words in a row — the
    // shapes a one-item-per-mode fixture can never produce.
    expect(byKind('real_word')).toHaveLength(2);
    expect(byKind('chain_word')).toHaveLength(4);
    for (const pair of [byKind('real_word'), byKind('chain_word').slice(1, 3)]) {
      expect(checkPackGates({ ...pack, items: pair })).toEqual([]);
    }
  });

  it('a repeated ask stays a SHORT DI signal, never a recitation', () => {
    // The rulings of 2026-08-13: an invariant ask is the method, an invariant
    // PARAGRAPH is the defect. These asks carry no content, so they repeat —
    // and every one is short enough that repeating it is a signal.
    for (const item of ITEMS) {
      expect(wordCount(askFor(item))).toBeLessThanOrEqual(12);
    }
    expect(askFor(first('chain_word'))).toBe('Your turn. Read it.');
  });

  it('the how-to-play speaks on the opening and on an action change, never per item', () => {
    const chain = byKind('chain_word');
    expect(spokenSpanOf(itemCue(chain[0], { howToPlay: true }))).toContain('change by just one letter');
    expect(spokenSpanOf(itemCue(chain[1]))).not.toContain('change by just one letter');
    // …and a new chain still announces itself, so the child knows the row moved.
    expect(spokenSpanOf(itemCue(chain[0]))).toContain('Here comes a new chain.');
    expect(spokenSpanOf(itemCue(chain[1]))).not.toContain('Here comes a new chain.');
  });
});

// ── 2. The answer-material fork ─────────────────────────────────────────────

describe('word-workout pack · the fork', () => {
  it('pins every kind, both directions', () => {
    const expected: Array<[WordWorkoutItem['kind'], 'voice' | 'gesture', string]> = [
      ['real_word', 'voice', 'short_spoken_word'],
      ['picture_tap', 'gesture', 'manipulation'],
      ['chain_word', 'voice', 'short_spoken_word'],
      ['read_sentence', 'voice', 'sentence_read_aloud'],
      ['answer_question', 'voice', 'short_spoken_word'],
    ];
    for (const [kind, answerKind, responseClass] of expected) {
      expect(answerKindFor(kind)).toBe(answerKind);
      expect(responseClassFor(kind)).toBe(responseClass);
    }
    for (const item of ITEMS) {
      expect(item.answerKind).toBe(answerKindFor(item.kind));
      expect(item.responseClass).toBe(responseClassFor(item.kind));
      expect(item.action).toBe(item.kind);
    }
  });

  it('real_word is SPOKEN — the queue predicted a tap and the challenge refutes it', () => {
    // The predicted blocker was a sentinel collision on "yes". The challenge
    // carries realWord + nonsenseWord, so the natural answer is the WORD, and
    // saying it forces decoding both rather than pointing at one. Pinned as a
    // regression: an item arriving as a gesture means someone re-added tiles.
    for (const item of byKind('real_word')) {
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('short_spoken_word');
    }
  });

  it('picture_tap is the ONLY gesture, and it commits the tapped word', () => {
    expect(ITEMS.filter((i) => i.answerKind === 'gesture').map((i) => i.kind)).toEqual(['picture_tap']);
    const item = first('picture_tap');
    expect(pictureVerdictCue(item, 'pig')).toContain('MATCHES');
    expect(pictureVerdictCue(item, 'pin')).toContain('does NOT match');
    // The match is CODE-computed and the tutor is handed its exact line.
    expect(pictureVerdictCue(item, 'pig')).toContain(affirmFor(item));
    expect(pictureVerdictCue(item, 'pin')).toContain(correctionFor(item));
  });

  it('one challenge is not one item: a chain is a read per word, a sentence is a read plus a question', () => {
    expect(itemsFromChallenge(CHAIN).map((i) => i.id))
      .toEqual(['c4-w1', 'c4-w2', 'c4-w3', 'c4-w4']);
    expect(itemsFromChallenge(SR1).map((i) => i.kind))
      .toEqual(['read_sentence', 'answer_question']);
    expect(itemsFromChallenge(RN1)).toHaveLength(1);
  });
});

// ── 3. The cold read — this port's leak rule ────────────────────────────────

describe('word-workout pack · the print is never spoken', () => {
  it('no ask contains the print it is asking the child to read', () => {
    for (const item of byKind('real_word')) {
      const ask = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
      expect(containsWord(ask, item.realWord!)).toBe(false);
      expect(containsWord(ask, item.nonsenseWord!)).toBe(false);
    }
    for (const item of byKind('chain_word')) {
      expect(containsWord(spokenSpanOf(itemCue(item, { howToPlay: true })), chainWordOf(item))).toBe(false);
    }
    for (const item of byKind('read_sentence')) {
      const ask = spokenSpanOf(itemCue(item, { howToPlay: true }));
      expect(ask).not.toContain(item.sentence);
      for (const word of item.cvcWords ?? []) expect(containsWord(ask, word)).toBe(false);
    }
    const tap = first('picture_tap');
    expect(containsWord(spokenSpanOf(itemCue(tap, { howToPlay: true })), tap.targetWord!)).toBe(false);
  });

  it('the comprehension ask never contains its answer, and never re-reads the sentence', () => {
    for (const item of byKind('answer_question')) {
      const ask = spokenSpanOf(itemCue(item, { howToPlay: true }));
      expect(containsWord(ask, item.answerWord!)).toBe(false);
      expect(ask).not.toContain(item.sentence);
      expect(containsWord(item.question!, item.answerWord!)).toBe(false);
    }
  });

  it('tap-to-hear repeats the QUESTION side only — never a word of the print', () => {
    for (const item of ITEMS) {
      const heard = spokenSpanOf(pronounceCue(item));
      // Byte-identical to the plain ask: the repeat carries no more help than
      // the first one did (cvc-speller's [ISOLATE_VOWEL] was a leak on demand).
      expect(heard).toBe(askFor(item));
      expect(pronounceCue(item)).toContain('never say the answer');
    }
    // …and on a reading turn it is the instruction ALONE.
    expect(spokenSpanOf(pronounceCue(first('read_sentence')))).not.toContain(first('read_sentence').sentence);
  });

  it('carries a cold-read guard on every printed kind, and not on the question', () => {
    for (const kind of ['real_word', 'picture_tap', 'chain_word', 'read_sentence'] as const) {
      expect(itemCue(first(kind))).toMatch(/do not (say|read) (it|the line|either word)|before they/i);
    }
    expect(itemCue(first('answer_question'))).not.toMatch(/read cold on purpose/);
  });

  it('the context channel describes the stimulus rather than pushing it', () => {
    // A state block the model decides to narrate is exactly how item 21 leaked
    // an answer in production — so the print never enters runtime state.
    for (const item of ITEMS) {
      const stimulus = stimulusFor(item);
      expect(pack.contextFor(item)).toEqual({ challengeType: item.kind, stimulus });
    }
    expect(stimulusFor(first('real_word'))).not.toContain('cat');
    expect(stimulusFor(first('picture_tap'))).not.toContain('pig');
    expect(stimulusFor(first('chain_word'))).not.toContain('cat');
    expect(stimulusFor(first('read_sentence'))).not.toContain('The cat sat');
    // The question IS answer-free by build gate, so it is the one safe push.
    const q = first('answer_question');
    expect(stimulusFor(q)).toBe(q.question);
    expect(containsWord(stimulusFor(q), q.answerWord!)).toBe(false);
  });

  it('the tap item is told to stay silent, and no spoken item is told to ignore the microphone', () => {
    expect(itemCue(first('picture_tap'))).toContain('stay completely silent');
    expect(itemCue(first('picture_tap'))).not.toContain('If the answer is right');
    for (const kind of ['real_word', 'chain_word', 'answer_question'] as const) {
      expect(itemCue(first(kind))).not.toContain('do not judge anything you hear');
    }
  });
});

// ── 4. Build gates ──────────────────────────────────────────────────────────

describe('word-workout pack · build gates', () => {
  it('DROPS a real/nonsense pair that cannot be told apart BY EAR', () => {
    // THE gate that decided the fork. The child says one of these aloud and the
    // judge scores it from audio, so a pair differing only in its final stop has
    // no honest verdict. Leniency is not the alternative — the ask is.
    expect(pairEarSeparable('cat', 'zat')).toBe(true);
    expect(pairEarSeparable('cat', 'cak')).toBe(false);
    expect(pairEarSeparable('cat', 'zats')).toBe(false);
    expect(itemsFromChallenge({ ...RN1, id: 'x', nonsenseWord: 'cak' })).toEqual([]);
    expect(challengeAskable({ ...RN1, id: 'x', nonsenseWord: 'cak' })).toBe(false);
  });

  it('DROPS a pair whose "nonsense" word is a REAL word — the live probe\'s finding', () => {
    // The 2026-08-14 probe drew "ran"/"pan" and "bag"/"fag": two real words, so
    // the ask "which one is a real word?" had two right answers. An ambiguous
    // ask is not a harder task, it is a broken one.
    expect(isRealCvcWord('pan')).toBe(true);
    expect(isRealCvcWord('zat')).toBe(false);
    expect(itemsFromChallenge({ ...RN1, id: 'x', realWord: 'ran', nonsenseWord: 'pan' })).toEqual([]);
    // …and the honest pair still builds, so the gate is not "always drop".
    expect(itemsFromChallenge({ ...RN1, id: 'y', realWord: 'ran', nonsenseWord: 'zan' })).toHaveLength(1);
  });

  it('DROPS anything on the blocklist, real word or not, everywhere it can appear', () => {
    // The same probe drew "fag" as a nonsense word. A K-2 surface needs this
    // gate whether or not the string is a real word, and a prompt is advisory.
    expect(itemsFromChallenge({ ...RN1, id: 'x', realWord: 'bag', nonsenseWord: 'fag' })).toEqual([]);
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['bag', 'sag', 'sex'] })).toEqual([]);
    expect(itemsFromChallenge({ ...PM, id: 'x', distractorImages: [{ word: 'tit', image: '🐦' }] })).toEqual([]);
    expect(itemsFromChallenge({ ...SR1, id: 'x', sentence: 'The cat bit the ass.' })).toEqual([]);
  });

  it('DROPS a verdict-shaped word — "yes" is CVC and a short-e pool can draw it', () => {
    expect(itemsFromChallenge({ ...RN1, id: 'x', realWord: 'yes', nonsenseWord: 'zes' })).toEqual([]);
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['yes', 'yet', 'net'] })).toEqual([]);
  });

  it('DROPS a sentence outside the BENCHED read-aloud window, at both ends', () => {
    expect(MIN_SENTENCE_WORDS).toBe(3);
    expect(MAX_SENTENCE_WORDS).toBe(8);
    expect(itemsFromChallenge({ ...SR1, id: 'x', sentence: 'The cat sat.'.replace('The cat sat.', 'Sit.') })).toEqual([]);
    expect(itemsFromChallenge({
      ...SR1,
      id: 'x',
      sentence: 'The big cat sat on the red mat in the sun.',
    })).toEqual([]);
  });

  it('DROPS a broken QUESTION without dropping the read — the sentence is still a real read', () => {
    // The two halves fail independently: a sentence with no askable question is
    // still a decodable line the child can read aloud.
    const answerInQuestion = { ...SR1, id: 'x', comprehensionQuestion: 'What did the cat sit on, the mat?' };
    expect(itemsFromChallenge(answerInQuestion).map((i) => i.kind)).toEqual(['read_sentence']);
    const answerAbsent = { ...SR1, id: 'y', comprehensionAnswer: 'rug' };
    expect(itemsFromChallenge(answerAbsent).map((i) => i.kind)).toEqual(['read_sentence']);
  });

  it('DROPS a chain whose step is not a one-letter substitution', () => {
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['cat', 'hop'] })).toEqual([]);
    expect(itemsFromChallenge({ ...CHAIN, id: 'x', chain: ['cat', 'cats'] })).toEqual([]);
  });

  it('DROPS a picture-match with nothing to choose between', () => {
    expect(itemsFromChallenge({ ...PM, id: 'x', distractorImages: [] })).toEqual([]);
    expect(itemsFromChallenge({ ...PM, id: 'x', targetImage: '' })).toEqual([]);
    // A distractor repeating the target is not a distractor.
    expect(itemsFromChallenge({ ...PM, id: 'x', distractorImages: [{ word: 'pig', image: '🐖' }] })).toEqual([]);
  });

  it('DROPS generated text that would open a spoken sentence with a verdict sentinel', () => {
    expect(itemsFromChallenge({
      ...SR1,
      id: 'x',
      sentence: 'Yes the cat sat on the mat.',
    })).toEqual([]);
  });

  it('drops without backfilling — a broken challenge shortens the session, never fills it', () => {
    const items = itemsFromChallenges([RN1, { ...RN1, id: 'broken', nonsenseWord: 'cak' }, RN2]);
    expect(items.map((i) => i.id)).toEqual(['c1', 'c2']);
  });
});

// ── 5. Corrections and affirmations ─────────────────────────────────────────

describe('word-workout pack · corrections', () => {
  it('affirms with the sentinel and echoes the target', () => {
    for (const item of ITEMS) {
      const affirm = affirmFor(item);
      expect(affirm.startsWith('Yes')).toBe(true);
      if (item.answerKind === 'voice') expect(affirmLineOf(itemCue(item))).toBe(affirm);
    }
    expect(affirmFor(first('real_word'))).toContain('cat');
    expect(affirmFor(first('answer_question'))).toContain('mat');
  });

  it('corrects with My turn, re-models, and re-elicits', () => {
    for (const item of ITEMS) {
      const correction = correctionFor(item);
      expect(correction.startsWith('My turn:')).toBe(true);
      expect(correction).toContain('Your turn.');
    }
  });

  it('gives each kind its own teaching move, not one generic re-model', () => {
    // real_word contrasts the PAIR — modelling only the right word teaches half
    // of a discrimination.
    const rn = first('real_word');
    expect(correctionFor(rn)).toContain('cat is a real word');
    expect(correctionFor(rn)).toContain('Zat is just silly sounds');
    // answer_question re-reads the sentence the answer came from — the
    // looking-back move, not just the word (decodable-reader's evidence line).
    const q = first('answer_question');
    expect(correctionFor(q)).toContain(q.sentence);
    expect(correctionFor(q)).toContain(q.question);
  });

  it('THE SURVIVING TIER LEVER reaches the spoken channel, both directions', () => {
    // chainCueLevel drives the amber highlight AND whether the correction names
    // what changed. At 'none' noticing the change IS the task, so a tutor that
    // named it would hand back exactly the scaffold the tier removed.
    // chain[2] is "hot": cat → hat changed the FIRST letter, hat → hot the
    // middle one, so the label is derived from the chain rather than fixed.
    const full = itemsFromChallenge({ ...CHAIN, id: 'f', chainCueLevel: 'full' })[2];
    const none = itemsFromChallenge({ ...CHAIN, id: 'n', chainCueLevel: 'none' })[2];
    expect(correctionFor(full)).toBe('My turn: hat, hot. Only the middle letter changed. Your turn. Read it.');
    expect(correctionFor(none)).not.toContain('changed');
    expect(correctionFor(none)).toBe('My turn: hot. Your turn. Read it.');
    expect(correctionFor(itemsFromChallenge({ ...CHAIN, id: 'f3' })[1]))
      .toContain('Only the first letter changed.');
    // The FIRST word of a chain has nothing to contrast against at any tier.
    const firstWord = itemsFromChallenge({ ...CHAIN, id: 'f2', chainCueLevel: 'full' })[0];
    expect(correctionFor(firstWord)).toBe('My turn: cat. Your turn. Read it.');
  });

  it('commands a FIXED correction line across attempts — a third wording is a no-verdict stall', () => {
    // number-bond's cap drill, authored in rather than rediscovered.
    expect(itemCue(first('real_word'))).toContain('Say the SAME correction line on every wrong answer');
    expect(itemCue(first('real_word'))).toContain('reaches the activity as no verdict at all');
  });

  it('the reading contract keeps the CONTRASTIVE branch, which beat the plain re-model live', () => {
    const cue = itemCue(first('read_sentence'));
    expect(cue).toContain('not ⟨what they said⟩');
    expect(cue).toContain('Never speak the ⟨ ⟩ marks');
    // A mid-line pause is part of one reading, not the end of it — the finding
    // that also set this port's silenceCloseMs.
    expect(cue).toContain('a pause is part of one reading');
    // …and the single-word reads keep their own accuracy-over-speed clause.
    expect(itemCue(first('chain_word'))).toContain('judge accuracy, never speed');
  });

  it('names what the print said when the cap is reached, so a capped item never ends unresolved', () => {
    expect(spokenSpanOf(moveOnCue(first('real_word'), null, {}))).toContain('The real word was cat.');
    expect(spokenSpanOf(moveOnCue(first('picture_tap'), null, {}))).toContain('That word says pig.');
    expect(spokenSpanOf(moveOnCue(first('answer_question'), null, {}))).toContain('The answer was mat.');
    // …and it carries the NEXT ask, so the lesson moves without a gap.
    expect(spokenSpanOf(moveOnCue(ITEMS[0], ITEMS[1], {}))).toContain(askFor(ITEMS[1]));
  });
});

// ── 6. The session frame ────────────────────────────────────────────────────

describe('word-workout pack · session frame', () => {
  it('the opening cue carries greeting, how-to-play and the first ask in ONE quoted line', () => {
    const opening = spokenSpanOf(itemCue(ITEMS[0], { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time for a word workout!');
    expect(opening).toContain('one is just silly sounds');
    expect(opening).toContain(askFor(ITEMS[0]));
  });

  it('the closing line is honest about what the run was made of', () => {
    expect(completeCueFor(ITEMS)).toContain('read every word out loud');
    // A picture-match-only run never read anything aloud (letter-sound-link's
    // finding, 19d) — the praise has to be true.
    expect(completeCueFor(byKind('picture_tap'))).toContain('found every picture');
    expect(completeCueFor(byKind('picture_tap'))).not.toContain('out loud');
  });

  it('no spoken line anywhere opens a sentence with a verdict sentinel except the verdicts', () => {
    const cues = ITEMS.flatMap((item) => [
      { label: `ask-${item.id}`, text: spokenSpanOf(itemCue(item, { opening: true, howToPlay: true })) },
      { label: `move-${item.id}`, text: spokenSpanOf(moveOnCue(item, null, {})) },
      { label: `hear-${item.id}`, text: spokenSpanOf(pronounceCue(item)) },
    ]);
    cues.push({ label: 'complete', text: spokenSpanOf(completeCueFor(ITEMS)) });
    expect(findSentinelCollisions(cues)).toEqual([]);
  });

  it('the harness drives each kind signature wrong, and the leak tokens are the print', () => {
    // real_word's signature wrong is the PSEUDOWORD — the one answer material
    // in the family that is not a word at all, and the acoustic question this
    // port owes a mic run.
    const rn = wordWorkoutHarnessAnswers(first('real_word'));
    expect(rn.correct).toBe('cat');
    expect(rn.signatureWrong?.text).toBe('zat');
    expect(rn.leakTokens).toEqual(['cat', 'zat']);

    // chain_word's is the PREVIOUS word — what a child reading the row from
    // memory says, and it sounds fluent.
    const chain = wordWorkoutHarnessAnswers(byKind('chain_word')[1]);
    expect(chain.correct).toBe('hat');
    expect(chain.signatureWrong?.text).toBe('cat');
    expect(wordWorkoutHarnessAnswers(byKind('chain_word')[0]).signatureWrong).toBeUndefined();

    // answer_question's is a word lifted out of the sentence that does not
    // answer the question.
    const q = wordWorkoutHarnessAnswers(first('answer_question'));
    expect(q.correct).toBe('mat');
    expect(q.signatureWrong?.text).toBe('cat');
    expect(q.leakTokens).toEqual(['mat']);
    // Nothing is exempt here: the sentence is PRINTED, never read aloud, so any
    // mention of the answer before the verdict is a leak (unlike story-talk).
    expect(q.leakExemptSpan).toBeUndefined();

    // The gesture item hands the harness a real tapped candidate.
    const tap = wordWorkoutHarnessAnswers(first('picture_tap'));
    expect(tap.tapped?.correct).toBe('pig');
    expect(['pin', 'bin']).toContain(tap.tapped?.wrong);

    // A plain wrong must not be a word the tutor has just been shown.
    for (const item of ITEMS) {
      const plain = wordWorkoutHarnessAnswers(item).plainWrong;
      expect(everySpokenLine(item)).not.toContain(plain);
    }
  });
});

// ── 7. The catalog side ─────────────────────────────────────────────────────

describe('word-workout catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'word-workout')!;

  it('keeps the catalog half of the contract: audio mode, contextKeys, template keys, sentinels', () => {
    expect(checkDiCatalogEntry(entry, pack, ITEMS[0])).toEqual([]);
  });

  it('steers as a SPOKEN decoding activity — no click-era prose survives to route it wrong', () => {
    const steering = `${entry.description} ${entry.constraints}`;
    expect(steering).toMatch(/microphone/i);
    expect(steering).toMatch(/aloud|SAYS/);
    // The click era promised "Tap the one that is a REAL word" and "Tap any
    // word to hear it" forever. A manifest reading that routes this primitive
    // as a tap activity for the rest of its life.
    expect(steering).not.toMatch(/tap the one|tap any word|hides its chrome/i);
    // …and the pre-reader claim goes with the speaker buttons: nothing reads
    // the print to the child now, so a non-decoder has nothing to work from.
    expect(steering).toMatch(/pre-reader who cannot yet sound out/i);
  });

  it('raises β exactly where the STRUCTURE changed, and nowhere else', () => {
    const betas = Object.fromEntries(
      (entry.evalModes ?? []).map((mode) => [mode.evalMode, mode.beta]),
    );
    expect(betas.real_vs_nonsense).toBe(2.5);   // 1-of-2 tap → spoken production
    expect(betas.word_chains).toBe(4.0);        // unmeasured tap-through → judged reads
    expect(betas.sentence_reading).toBe(5.5);   // "I Read It!" → judged read + spoken answer
    expect(betas.picture_match).toBe(2.5);      // still a tap of the same size
  });

  it('offers no quoted replacement line in the scaffolding ladder', () => {
    for (const level of Object.values(entry.tutoring?.scaffoldingLevels ?? {})) {
      expect(level).toMatch(/scripted correction|wording is fixed/i);
      expect(level).not.toMatch(/["“”]/);
    }
  });

  it('tells the tutor the answer surface differs BY TURN, so it cannot invite the wrong one', () => {
    // letter-spotter's block claimed "every answer is a touch" while one of its
    // modes was spoken. This pack is mixed and says so, keyed on the same
    // {{challengeType}} the pack pushes.
    const directives = (entry.tutoring?.aiDirectives ?? [])
      .map((d) => `${d.title}. ${d.instruction}`)
      .join('\n');
    expect(directives).toMatch(/\{\{challengeType\}\} tells you which kind/i);
    expect(directives).toMatch(/Never invite a tap on a spoken turn/i);
    expect(directives).toMatch(/\[WW_HEAR\]/);
    // The cold read is a catalog-level law too — the scaffolding channel could
    // otherwise read the print aloud (di-sentence-reading's tier gotcha).
    expect(directives).toMatch(/never read it first, never sound it out/i);
  });
});
