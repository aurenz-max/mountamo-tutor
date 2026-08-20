/**
 * rhymeStudioScript — the DI pack's standing gates, asserted.
 *
 * Two of these are the reason this port could ship at all and neither is a
 * style check:
 *  - THE SPLIT is standing-gate-1 arithmetic. `open_set_word` is BLOCKED, so
 *    every spoken item must draw its answer from a closed, code-enumerable set,
 *    and the item that cannot (a yes/no verdict) must be a gesture.
 *  - NO SENTENCE OPENS WITH A GENERATED WORD. Every word in every line here is
 *    model-generated, and a generated word in a sentence-opener slot can be
 *    read by the engine's verdict scan as a judgment. The pre-DI component
 *    shipped a distractor pool containing the literal word "yes"; this is the
 *    structural defence behind `isSentinelSafeWord`.
 */
import { describe, expect, it } from 'vitest';
import {
  spokenSpanOf,
  spokenSpansOf,
  validateJudgedScriptPack,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';
import { DI_SENTINELS } from '../../../../hooks/judgedLoopModel';
import {
  completeCue,
  isSentinelSafeWord,
  itemCue,
  itemFromChallenge,
  moveOnCue,
  pickModelRhymePair,
  pronounceCue,
  rimeOf,
  stimulusFor,
  type RhymeChallengeLike,
  type RhymeItem,
  type RhymeTier,
} from '../rhymeStudioScript';

// ── Fixtures ────────────────────────────────────────────────────────────────

const recognitionCh = (over: Partial<RhymeChallengeLike> = {}): RhymeChallengeLike => ({
  id: 'r1',
  mode: 'recognition',
  targetWord: 'cat',
  targetWordEmoji: '🐱',
  rhymeFamily: '-at',
  comparisonWord: 'hat',
  comparisonWordEmoji: '🎩',
  doesRhyme: true,
  ...over,
});

const identificationCh = (over: Partial<RhymeChallengeLike> = {}): RhymeChallengeLike => ({
  id: 'i1',
  mode: 'identification',
  targetWord: 'pig',
  rhymeFamily: '-ig',
  options: [
    { word: 'pan', image: '🍳', isCorrect: false },   // onset-sharing distractor
    { word: 'wig', image: '💇', isCorrect: true },
  ],
  ...over,
});

/** Production is OPEN: it reads a target and a rime and nothing else.
 *  `acceptableAnswers` is accepted and deliberately IGNORED, which is itself
 *  asserted below — the word bank was deleted on 2026-08-19. */
const productionCh = (over: Partial<RhymeChallengeLike> = {}): RhymeChallengeLike => ({
  id: 'p1',
  mode: 'production',
  targetWord: 'hat',
  rhymeFamily: '-at',
  ...over,
});

const items = (tier: RhymeTier = 'medium'): RhymeItem[] =>
  [recognitionCh(), identificationCh(), productionCh()].map((c) => itemFromChallenge(c, tier));

const packFor = (list: RhymeItem[]): JudgedScriptPack<RhymeItem> => {
  const modelPair = pickModelRhymePair(list);
  return {
    primitiveType: 'rhyme-studio',
    activityLine: 'live direct instruction rhyming practice',
    items: list,
    itemCue: (item, opts) => itemCue(item, opts, { modelPair }),
    moveOnCue: (item, next, opts) => moveOnCue(item, next, opts, { modelPair }),
    completeCue,
    pronounceCue,
    contextFor: (item) => ({ challengeMode: item.mode, stimulus: stimulusFor(item) }),
  };
};

/** Every line the pack can emit, for a given tier. */
const allCues = (tier: RhymeTier = 'medium'): string[] => {
  const list = items(tier);
  const modelPair = pickModelRhymePair(list);
  const out: string[] = [completeCue()];
  list.forEach((item, i) => {
    const next = list[i + 1] ?? null;
    out.push(itemCue(item, { opening: true, howToPlay: true }, { modelPair }));
    out.push(itemCue(item, {}, { modelPair }));
    out.push(moveOnCue(item, next, { howToPlay: true }, { modelPair }));
    out.push(pronounceCue(item));
  });
  return out;
};

/** The portion of a cue the tutor is told to SAY, without the instructions —
 *  the shared parser, so every port reads the same span. (The local fork this
 *  replaces THREW on a cue with no speak anchor rather than returning "".) */
const spokenLine = spokenSpanOf;

const sentencesOf = (text: string): string[][] =>
  text
    .split(/[.!?]+/)
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean))
    .filter((tokens) => tokens.length > 0);

// ── Standing gates 1 + 2, via the shared validator ──────────────────────────

describe('the family gates', () => {
  it.each(['easy', 'medium', 'hard'] as const)('reports no issues at the %s tier', (tier) => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed:
    // the performed "[WAIT silently]", and the byte-identical consecutive ask
    // — THIS pack's own port-8 defect, where the per-item lead-in repeated.
    expect(checkPackGates(packFor(items(tier)))).toEqual([]);
  });

  it('two items in the SAME mode do not repeat the ask byte-for-byte', () => {
    // The pack above is one item per mode, which is the ONE shape that cannot
    // trigger findRepeatedConsecutiveAsks — it compares consecutive items of
    // the same action. A real session runs several recognition items in a row,
    // and that is where this pack's port-8 defect lived: the per-item lead-in
    // was invariant, so the child heard the identical sentence every round.
    const pair = [
      recognitionCh(),
      recognitionCh({ id: 'r2', targetWord: 'pig', comparisonWord: 'wig', rhymeFamily: '-ig' }),
    ].map((c) => itemFromChallenge(c, 'medium'));
    expect(checkPackGates(packFor(pair))).toEqual([]);
  });

  /**
   * ⭐ THIS TEST USED TO ASSERT THE BLOCK, AND IT STILL DOES — from the other
   * side of the fork.
   *
   * Its old form built a production item, hand-stamped `open_set_word` onto it,
   * and checked that the validator refused it. `open_production` now produces
   * that item honestly, so the assertion is made against the REAL mode rather
   * than a synthetic one: the class is under bench (item 24) and the validator
   * must keep refusing it until a recorded sitting clears it.
   *
   * WHEN THE BENCH PASSES, this expectation inverts — `toEqual([])` — and the
   * guards below are what stay. Do not delete it in either direction: a mode
   * that can be built but not validated is exactly the state a bench needs, and
   * an unasserted one drifts into a lesson.
   */
  /**
   * ⭐ THIS TEST HAS NOW ASSERTED THE BLOCK FROM BOTH SIDES, AND THIS IS THE
   * THIRD SHAPE — the one that says the class CLEARED.
   *
   * v1 stamped `open_set_word` onto a production item and checked the validator
   * refused it. v2 built the refusal honestly from `open_production` while the
   * bench ran. v3 is this: the bench passed (2026-08-19, 72 probes over 6 rimes,
   * zero false affirmations), the class is `benched`, and the mode must now
   * validate CLEAN. Keep it — a class that can be built but not validated, or
   * validated but never asserted, is how a blocked shape drifts into a lesson.
   */
  it('an open_production item now VALIDATES — open_set_word is benched', () => {
    expect(checkPackGates(packFor([itemFromChallenge(productionCh())]))).toEqual([]);
  });

  it('two open items in a row do not recite a byte-identical ask', () => {
    // The ask names its own stimulus, so this holds by construction — but the
    // mode's ask is the shortest in the pack and the repeat gate is calibrated
    // at 12 words, so it is worth pinning.
    const pair = [
      productionCh(),
      productionCh({ id: 'o2', targetWord: 'cake', rhymeFamily: '-ake' }),
    ].map((c) => itemFromChallenge(c, 'medium'));
    expect(checkPackGates(packFor(pair))).toEqual([]);
  });
});

// ── The open-set contract — the four guards, asserted ───────────────────────

/**
 * The bench (`service/qa/di/openSetWordBench.ts`) scores the judge's BEHAVIOUR
 * against these clauses. These tests assert the clauses are actually IN the
 * contract the judge receives — a bench run against a contract missing its
 * nonword guard would score a false affirmation as the judge's fault when it
 * was ours. Machine gate first, Live session second.
 */
describe('open_production — the rule, and the four guards', () => {
  const cueFor = (over: Partial<RhymeChallengeLike> = {}) =>
    itemCue(itemFromChallenge(productionCh(over)), {});

  it('hands the judge a RULE, not a list of acceptable answers', () => {
    const item = itemFromChallenge(productionCh());
    // The mode's defining property: nothing is enumerated.
    expect(item.acceptedWords).toEqual([]);
    expect(item.choices).toEqual([]);
    expect(item.responseClass).toBe('open_set_word');
    expect(item.answerKind).toBe('voice');

    const cue = cueFor();
    expect(cue).toContain('has to say a REAL word that ends with the same sound as hat');
    // …and explicitly authorises what the judge did not think of, which is the
    // difference between an open set and a closed one the judge is holding.
    expect(cue).toContain('including one you did not think of yourself');
    // Sound, not spelling — otherwise the judge refuses "ache" for "cake".
    expect(cue).toContain('Judge the SOUND you heard, not the spelling');
  });

  it('carries the ECHO guard — the stimulus said back is refused', () => {
    expect(cueFor()).toContain('The word hat said back is NOT correct');
  });

  it('carries the NONWORD guard — the failure the word bank made impossible', () => {
    expect(cueFor()).toContain('A made-up word is NOT correct');
  });

  it('the NONWORD guard does not sweep up names — "Bill" rhymes with "hill"', () => {
    // The first bench run blocked this class on "zell" for "bell", filed as a
    // nonword. Zell is a surname; the judge was defensible and the key was
    // wrong. Following that through changed the CONTRACT: a child who answers
    // with a name has done the skill, and the guard belongs on strings that are
    // not words at all.
    expect(cueFor()).toContain("A person's NAME is a real word here and counts");
    expect(cueFor()).toContain('Refuse invented nonsense, never a name.');
  });

  it('carries the ONSET guard — rhyme is not alliteration', () => {
    expect(cueFor()).toContain('only STARTS like hat is NOT correct');
  });

  it('carries the OFF-TASK guard — a non-answer is not an answer', () => {
    expect(cueFor()).toContain('the learner says they do not know, that is not an answer');
  });

  /**
   * ⭐ THE INVARIANT THAT MAKES THIS MODE SAFE TO SPEAK AT ALL.
   *
   * Every other mode reads generated words aloud — the choices, the bank, the
   * comparison word — and defends that with `isSentinelSafeWord`. This one
   * cannot rely on generated content at all: the live probe put "NAKE" in an
   * acceptable-answer list for the target `cake`, and there is no filter that
   * catches a well-formed invented word. So the mode simply never speaks one.
   */
  it('speaks NO generated word except the stimulus — not in the ask, correction or affirm', () => {
    const ch = productionCh({
      // Everything a generator could hand us, including the observed nonword.
      acceptableAnswers: ['bake', 'lake', 'nake'],
    });
    const item = itemFromChallenge(ch);
    const spokenEverywhere = [
      itemCue(item, { opening: true, howToPlay: true }),
      itemCue(item, {}),
      moveOnCue(item, null, {}),
      pronounceCue(item),
    ].flatMap((cue) => spokenSpansOf(cue)).join(' ').toLowerCase();

    for (const word of ['bake', 'lake', 'nake']) {
      expect(spokenEverywhere).not.toContain(word);
    }
    // The stimulus and the rime are the only content words, and both are the
    // question rather than the answer.
    expect(spokenEverywhere).toContain('hat');
  });

  it('corrects by re-modelling the RIME, never a word', () => {
    const cue = cueFor();
    expect(cue).toContain('My turn: listen to the end of hat — at.');
    expect(cue).toContain('Your turn. Tell me a word that ends with at.');
  });

  it('affirms with a byte-fixed line — no template, so the exact-line oracles hold', () => {
    // The child's word is unknown before they speak, so the affirmation uses
    // deixis rather than echoing it. Two different items differ only by their
    // own stimulus, never by anything the child said.
    expect(cueFor()).toContain('Yes, that rhymes with hat — both end with at.');
    expect(cueFor({ targetWord: 'cake', rhymeFamily: '-ake' }))
      .toContain('Yes, that rhymes with cake — both end with ake.');
  });

  it('the ask cannot leak an answer, because it does not know one', () => {
    const ask = spokenSpanOf(cueFor());
    expect(ask).toBe('Listen to this word: hat. Your turn. Tell me a word that rhymes with hat.');
    // No menu, no card, no screen — naming a surface the child cannot answer
    // from is how a tutor starts telling them to pick from nothing.
    expect(ask.toLowerCase()).not.toMatch(/card|choice|screen|option/);
  });
});

// ── The split ───────────────────────────────────────────────────────────────

describe('the split — what the answer is MADE of', () => {
  /**
   * REGRESSION, and the reason recognition may never quietly become a tap again.
   * It shipped with a 👍/👎 for one day. The user's first drive
   * (`backend/logs/lumina-sessions/2026-08-13-023253-…jsonl`) shows the child
   * answering the spoken question "Do cat and hat rhyme?" with "Yes." — and the
   * silence contract had no line for a spoken answer, so the tutor invented the
   * tag names it had only seen described, spoke them aloud, invented a whole
   * next item ("cake, chair"), and said "Correct!" instead of the sentinel, so
   * the engine read no verdict and the run wedged.
   */
  it('recognition is SPOKEN — a spoken question must have a spoken answer', () => {
    const item = itemFromChallenge(recognitionCh());
    expect(item.answerKind).toBe('voice');
    expect(item.responseClass).toBe('yes_no');
    // Nothing in this pack is answered with the hands.
    expect(items().every((i) => i.answerKind === 'voice')).toBe(true);
  });

  it('every recognition cue hands the tutor an exact line for a spoken answer', () => {
    for (const doesRhyme of [true, false]) {
      const item = itemFromChallenge(recognitionCh({ doesRhyme }));
      const cue = itemCue(item);
      // The failure mode was a contract that told the tutor to stay silent and
      // wait to be told what was tapped. Both branches must now be scripted.
      expect(cue).toContain('If the answer is right, say exactly:');
      expect(cue).toContain('If it is wrong, say exactly:');
      expect(cue).not.toMatch(/WAIT in complete silence|TAPPING|thumbs/i);
      // The affirmation opens with the sentinel even when it affirms a NO.
      expect(cue).toMatch(/say exactly: "Yes, cat and (hat|dog)/);
    }
  });

  it('recognition accepts what a five-year-old actually says, not just the bare word', () => {
    const yes = itemCue(itemFromChallenge(recognitionCh({ doesRhyme: true })));
    expect(yes).toContain('The correct answer is YES');
    expect(yes).toMatch(/"yeah", "uh huh", "they do"/);
    const no = itemCue(itemFromChallenge(recognitionCh({ doesRhyme: false, comparisonWord: 'dog' })));
    expect(no).toContain('The correct answer is NO');
    expect(no).toMatch(/"nope", "uh uh"/);
  });

  it('identification speaks a word from a CLOSED set', () => {
    const item = itemFromChallenge(identificationCh());
    expect(item.answerKind).toBe('voice');
    expect(item.responseClass).toBe('short_spoken_word');
    expect(item.acceptedWords.length).toBeGreaterThan(0);
  });

  it('production speaks a word from NO set — open_set_word', () => {
    // Inverted 2026-08-19. `production` shared the closed-set assertion above
    // for as long as the word bank existed — the bank was what made the mode a
    // closed class. The bench cleared `open_set_word`, the bank is deleted, and
    // the mode is now what it always should have been.
    const item = itemFromChallenge(productionCh());
    expect(item.answerKind).toBe('voice');
    expect(item.responseClass).toBe('open_set_word');
    expect(item.acceptedWords).toEqual([]);
    expect(item.choices).toEqual([]);
  });

  it('production accepts NOTHING by name — the generated list is ignored entirely', () => {
    // This test used to assert the opposite: that the accepted set was exactly
    // the four on-screen bank tiles, because an off-screen word was one nothing
    // had verified. Deleting the bank makes the honest set EMPTY — the judge is
    // handed the rule and no candidates at all, and the generator's list (which
    // has demonstrably contained the nonword "NAKE") reaches nothing.
    const item = itemFromChallenge(productionCh({
      acceptableAnswers: ['bun', 'run', 'nun'],
    }));
    expect(item.choices).toEqual([]);
    expect(item.acceptedWords).toEqual([]);
    expect(item.answer).toBe('');
  });

  it('identification accepts only the correct option (its set is what is on screen)', () => {
    const item = itemFromChallenge(identificationCh());
    expect(item.acceptedWords).toEqual(['wig']);
  });
});

// ── The sentinel defence, structural ────────────────────────────────────────

describe('sentinel safety', () => {
  it('isSentinelSafeWord rejects every verdict opener', () => {
    for (const bad of ['yes', 'Yes', ' YES ', 'my', 'turn']) {
      expect(isSentinelSafeWord(bad)).toBe(false);
    }
    for (const good of ['cat', 'hat', 'sun', 'bun']) {
      expect(isSentinelSafeWord(good)).toBe(true);
    }
  });

  it('the old hardcoded distractor pool contained a colliding word', () => {
    // Regression anchor: 'yes' shipped in RhymeStudio's DISTRACTOR_POOL for
    // months. Silent under a tap surface; a verdict under a spoken one.
    expect(isSentinelSafeWord('yes')).toBe(false);
  });

  it.each(['easy', 'medium', 'hard'] as const)(
    'no sentence in any %s-tier cue opens with a generated content word',
    (tier) => {
      const contentWords = new Set(
        items(tier).flatMap((i) => [
          i.targetWord.toLowerCase(),
          (i.comparisonWord ?? '').toLowerCase(),
          ...i.choices.map((c) => c.word.toLowerCase()),
          ...i.acceptedWords.map((w) => w.toLowerCase()),
        ]),
      );
      for (const cue of allCues(tier)) {
        for (const tokens of sentencesOf(cue)) {
          expect({ cue: cue.slice(0, 70), opener: tokens[0] })
            .toEqual({ cue: cue.slice(0, 70), opener: expect.not.stringMatching(
              new RegExp(`^(${Array.from(contentWords).filter(Boolean).join('|')})$`),
            ) });
        }
      }
    },
  );

  it('each scripted verdict line opens with exactly one sentinel, and the right one', () => {
    // The engine classifies a verdict by which sentinel OPENS a sentence — the
    // live failure was a tutor saying "Correct!", which opens with neither, so
    // no verdict fired and the run went deaf.
    const opensWith = (line: string, opener: string[]) =>
      sentencesOf(line).filter((t) => opener.every((w, i) => t[i] === w)).length;

    // Parsed with the SHARED span parser rather than by splitting on the
    // contract's prose. The old form split on the literal 'If it is wrong, say
    // exactly: "' and broke the moment open production added a second
    // correction branch ('…for any other reason') — a gate that fails when a
    // pack gains a line is a gate that discourages adding one. Spans also cover
    // EVERY branch, which is what actually matters: the echo correction was
    // added because an unscripted refusal carries no sentinel and stalls the loop.
    for (const item of items()) {
      const [ask, affirm, ...corrections] = spokenSpansOf(itemCue(item));
      expect(ask).toBeTruthy();
      expect(opensWith(affirm, DI_SENTINELS.affirm[0])).toBe(1);
      expect(opensWith(affirm, DI_SENTINELS.correct[0])).toBe(0);
      // Open production scripts TWO corrections (echo, then general); the
      // closed modes script one. Every one of them must be classifiable.
      expect(corrections.length).toBeGreaterThanOrEqual(1);
      for (const correction of corrections) {
        expect(opensWith(correction, DI_SENTINELS.correct[0])).toBe(1);
        expect(opensWith(correction, DI_SENTINELS.affirm[0])).toBe(0);
      }
    }
  });

  it('open production scripts a DEDICATED echo correction — the stall the pilot drive found', () => {
    // 5 of 9 items in the first pilot drive: the child said the target back,
    // the generic "listen to the end of dog — og" was a non-sequitur, the tutor
    // improvised something correct but sentinel-less, and the loop went deaf.
    const cue = itemCue(itemFromChallenge(productionCh()));
    expect(cue).toContain('If the learner said "hat" back to you, say exactly:');
    expect(cue).toContain('My turn: a word cannot rhyme with itself.');
    expect(cue).toContain('Tell me a different word that ends with at.');
    // The specific branch must come BEFORE the catch-all, or the model answers
    // "is it wrong?" first and never reaches it.
    expect(cue.indexOf('back to you')).toBeLessThan(cue.indexOf('for any other reason'));
    expect(spokenSpansOf(cue)).toHaveLength(4);
  });

  it('no ITEM ask opens a sentence with a verdict sentinel — an ask is not a judgment', () => {
    for (const item of items()) {
      for (const tokens of sentencesOf(spokenLine(itemCue(item, { opening: true, howToPlay: true })))) {
        expect(tokens[0]).not.toBe(DI_SENTINELS.affirm[0][0]);
        expect(tokens.slice(0, 2).join(' ')).not.toBe(DI_SENTINELS.correct[0].join(' '));
      }
    }
  });
});

// ── Answer-leak ─────────────────────────────────────────────────────────────

describe('answer leak', () => {
  it('the context channel pushes the words but never the RELATION between them', () => {
    for (const item of items()) {
      // The words themselves end in the rime — they ARE the stimulus. What must
      // never be pushed is the relation: which family, or that one is shared.
      expect(stimulusFor(item)).not.toMatch(/rhyme|end(s|ing)? with|family/i);
    }
  });

  it('a recognition ASK never says whether the words rhyme', () => {
    const item = itemFromChallenge(recognitionCh({ doesRhyme: true }));
    const spoken = spokenLine(itemCue(item, { opening: true, howToPlay: true }));
    // The rime names the family both words share — saying it IS the answer here.
    expect(spoken).not.toMatch(/both end with at/);
    expect(spoken).toMatch(/Do cat and hat rhyme\? Say yes or no\./);
  });

  it('a recognition CORRECTION re-directs without resolving the pair', () => {
    const item = itemFromChallenge(recognitionCh({ doesRhyme: true }));
    const correction = itemCue(item).split('If it is wrong, say exactly: "')[1].split('"')[0];
    expect(correction).toMatch(/listen again to the end of each word/);
    // Saying the answer here would end the retry before it starts.
    expect(correction).not.toMatch(/both end with at|do not rhyme/);
    // The truth is finally stated at the correction cap, not before it.
    expect(moveOnCue(item, null)).toMatch(/cat and hat do rhyme/);
  });

  it('a spoken IDENTIFICATION ask offers the whole set without singling out the answer', () => {
    // Scoped to identification 2026-08-19: it is the only mode left with a set
    // to offer. Production names nothing but its stimulus — asserted in the
    // open-set suite, where the point is that it CANNOT leak an answer because
    // it does not know one.
    const item = itemFromChallenge(identificationCh());
    const spoken = spokenLine(itemCue(item));
    // Enumerating the closed set IS the ask — it is what keeps the response
    // class benched — so every choice is spoken, correct and wrong alike.
    for (const choice of item.choices) expect(spoken).toContain(choice.word);
    // What must never be spoken pre-verdict is the RELATION that names one.
    expect(spoken).not.toContain(`${item.answer} rhymes with`);
    expect(spoken).not.toContain(`end with ${item.rime}`);
    // The answer is earned in the correction, and only there.
    expect(itemCue(item)).toContain(`My turn: ${item.answer} rhymes with ${item.targetWord}`);
  });

  it('tap-to-hear re-speaks the question and never the answer', () => {
    for (const item of items()) {
      const cue = pronounceCue(item);
      expect(cue).toMatch(/never say which words rhyme/);
      if (item.mode !== 'recognition') expect(cue).not.toMatch(/both end with/);
    }
  });
});

// ── The tier ladder ─────────────────────────────────────────────────────────

describe('support tier — the DISTAR lead-in ladder', () => {
  const modelLine = /Words rhyme when they end the same way/;
  const guide = /Listen hard to the end of each word/;
  /** The teaching moment: the tier's full lead-in is only ever spoken here. */
  const opening = { opening: true, howToPlay: true };

  it('easy models the rule and guides', () => {
    const cue = itemCue(itemFromChallenge(identificationCh(), 'easy'), opening);
    expect(cue).toMatch(modelLine);
    expect(cue).toMatch(guide);
  });

  it('medium models the rule only', () => {
    const cue = itemCue(itemFromChallenge(identificationCh(), 'medium'), opening);
    expect(cue).toMatch(modelLine);
    expect(cue).not.toMatch(guide);
  });

  it('hard withdraws the model even at the opening, AND closes the tutor’s second channel', () => {
    const cue = itemCue(itemFromChallenge(identificationCh(), 'hard'), opening);
    expect(cue).not.toMatch(modelLine);
    expect(cue).toMatch(/answering this one cold on purpose/);
  });

  it('the tier never touches the ask, the judging, or the correction', () => {
    const tiers = ['easy', 'medium', 'hard'] as const;
    const cues = tiers.map((t) => itemCue(itemFromChallenge(identificationCh(), t), opening));
    // The ask: everything the tutor says from the hand-over onward.
    const asks = cues.map((c) => {
      const spoken = spokenLine(c);
      return spoken.slice(spoken.indexOf('Your turn.'));
    });
    expect(new Set(asks).size).toBe(1);
    // The judging contract, which carries the correction, is tier-invariant too.
    const contracts = cues.map((c) => c.slice(c.indexOf('Then WAIT')));
    expect(new Set(contracts).size).toBe(1);
  });

  it('the hard tier withdraws the tutor’s enumeration, and the set stays on screen', () => {
    const item = itemFromChallenge(identificationCh({ tutorNamesOptions: false }), 'hard');
    const cue = itemCue(item);
    expect(cue).toMatch(/Which choice on the screen rhymes with pig/);
    expect(cue).not.toMatch(/pig — wig, pan/);
    expect(item.choices).toHaveLength(2);   // still displayed — it is the answer set
  });
});

// ── The fade ────────────────────────────────────────────────────────────────
// User ruling 2026-08-13, from session log …f76f154cd898: the rule model was
// spoken verbatim on all eight items of a run. It is a GENERIC rule on a
// code-owned pair, so it is established once — not recited per item.

describe('the rule model is established, not recited', () => {
  const modelLine = /Words rhyme when they end the same way/;
  const guide = /Listen hard to the end of each word/;
  const at = (tier: RhymeTier) => itemFromChallenge(recognitionCh(), tier);

  it('models on the opening ask and on no ordinary ask after it', () => {
    expect(itemCue(at('medium'), { opening: true, howToPlay: true })).toMatch(modelLine);
    expect(itemCue(at('medium'), { opening: false, howToPlay: false })).not.toMatch(modelLine);
  });

  it('re-establishes when the task identity changes', () => {
    expect(itemCue(at('medium'), { howToPlay: true })).toMatch(modelLine);
  });

  it('easy keeps the one-line listening guide once the model is spent', () => {
    const steady = itemCue(at('easy'), {});
    expect(steady).not.toMatch(modelLine);
    expect(steady).toMatch(guide);
  });

  it('restores the full model on the ask after a CAPPED miss', () => {
    const list = items('medium');
    const cue = moveOnCue(list[0], list[1], {}, { modelPair: pickModelRhymePair(list) });
    expect(cue).toMatch(modelLine);
  });

  it('fades the lead-in only — the ask itself is byte-identical', () => {
    const ask = (cue: string) => {
      const spoken = spokenLine(cue);
      return spoken.slice(spoken.indexOf('Your turn.'));
    };
    expect(ask(itemCue(at('medium'), {})))
      .toBe(ask(itemCue(at('medium'), { opening: true, howToPlay: true })));
  });
});

// ── The rule-model pair ─────────────────────────────────────────────────────

describe('pickModelRhymePair', () => {
  it('never models on a session WORD', () => {
    const list = [itemFromChallenge(recognitionCh({ targetWord: 'sock', comparisonWord: 'rock', rhymeFamily: '-ock' }))];
    expect(pickModelRhymePair(list).pair).not.toEqual(['sock', 'rock']);
  });

  it('never models on a session FAMILY — a shared rime gives the item away', () => {
    // -ee shares no letters with "knee"/"free", but the rime is the answer.
    const list = [itemFromChallenge(identificationCh({
      targetWord: 'knee',
      rhymeFamily: '-ee',
      options: [{ word: 'free', isCorrect: true }, { word: 'knob', isCorrect: false }],
    }))];
    expect(pickModelRhymePair(list).rime).not.toBe('ee');
  });
});

// ⛔ `describe('buildProductionBank')` LIVED HERE — four tests for tile counts,
// distractor filtering and render determinism. The bank was deleted on
// 2026-08-19 when `open_set_word` cleared its bench, so they are gone rather
// than skipped. What replaced them is the open-set contract suite above: the
// four guards, and the assertion that production speaks no generated word.

// ── The catalog entry ───────────────────────────────────────────────────────

describe('the catalog block', () => {
  const entry = LITERACY_CATALOG.find((c) => c.id === 'rhyme-studio')!;
  const tutoring = entry.tutoring!;
  /** Every string the assembled prompt can interpolate or the tutor can read. */
  const prose = [
    tutoring.taskDescription,
    ...Object.values(tutoring.scaffoldingLevels ?? {}),
    ...(tutoring.commonStruggles ?? []).flatMap((s) => [s.pattern, s.response]),
    ...(tutoring.aiDirectives ?? []).flatMap((d) => [d.title, d.instruction]),
  ].filter(Boolean) as string[];

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    // An unresolved key renders the literal "(not set)" and gets read aloud.
    expect(checkDiCatalogEntry(entry, packFor(items()), items()[0])).toEqual([]);
  });

  it('states every struggle response as a MOVE, never as session meta-commentary', () => {
    // Live regression (log …f76f154cd898): the silence row opened "Think time
    // is unbounded — wait", and the tutor spoke it to a child. A response that
    // cannot be performed can only be recited.
    for (const struggle of tutoring.commonStruggles ?? []) {
      expect(struggle.response).not.toMatch(/think time|unbounded/i);
    }
  });

  it('steers the manifest to the spoken modality, not to tapping tiles', () => {
    const steering = `${entry.description} ${entry.constraints}`;
    expect(steering).toMatch(/microphone/i);
    expect(steering).toMatch(/spoken|say/i);
  });
});

describe('rimeOf', () => {
  it('strips the spelling hyphen a voice would read aloud', () => {
    expect(rimeOf('-at')).toBe('at');
    expect(rimeOf('at')).toBe('at');
  });
});
