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
  buildProductionBank,
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

const productionCh = (over: Partial<RhymeChallengeLike> = {}): RhymeChallengeLike => ({
  id: 'p1',
  mode: 'production',
  targetWord: 'sun',
  rhymeFamily: '-un',
  acceptableAnswers: ['bun', 'run', 'fun'],
  bankDistractors: ['dog', 'book', 'milk'],
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

  it('would REFUSE a free-production item — open_set_word is still blocked', () => {
    const blocked = { ...itemFromChallenge(productionCh()), responseClass: 'open_set_word' as const };
    const issues = validateJudgedScriptPack(packFor([blocked]));
    expect(issues.join(' ')).toMatch(/open_set_word.*BLOCKED/);
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

  it.each(['identification', 'production'] as const)('%s speaks a word from a closed set', (mode) => {
    const item = itemFromChallenge(mode === 'identification' ? identificationCh() : productionCh());
    expect(item.answerKind).toBe('voice');
    expect(item.responseClass).toBe('short_spoken_word');
    expect(item.acceptedWords.length).toBeGreaterThan(0);
  });

  it('the accepted set is EXACTLY what is on screen, never the wider word list', () => {
    // The live probe's finding: for the target "cake" the model produced
    // "bake, lake, rake, NAKE, take". An off-screen word is one nothing
    // verified, and widening the set would read it into the judge's accept
    // clause. On-screen words survive the bank's checks; that is the set.
    const item = itemFromChallenge(productionCh({
      productionCorrectCount: 2,
      acceptableAnswers: ['bun', 'run', 'nun'],
    }));
    expect(item.choices.filter((c) => c.isCorrect)).toHaveLength(2);
    expect(item.acceptedWords).toEqual(['bun', 'run']);
    expect(item.acceptedWords).not.toContain('nun');
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

  it('drops a colliding word from the production bank rather than speaking it', () => {
    const bank = buildProductionBank(productionCh({ bankDistractors: ['yes', 'dog', 'book'] }));
    expect(bank.map((c) => c.word)).not.toContain('yes');
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

    for (const item of items()) {
      const cue = itemCue(item);
      const affirm = cue.split('If the answer is right, say exactly: "')[1].split('"')[0];
      const correction = cue.split('If it is wrong, say exactly: "')[1].split('"')[0];
      expect(opensWith(affirm, DI_SENTINELS.affirm[0])).toBe(1);
      expect(opensWith(affirm, DI_SENTINELS.correct[0])).toBe(0);
      expect(opensWith(correction, DI_SENTINELS.correct[0])).toBe(1);
      expect(opensWith(correction, DI_SENTINELS.affirm[0])).toBe(0);
    }
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

  it('a spoken ask offers the whole set without singling out the answer', () => {
    for (const ch of [identificationCh(), productionCh()]) {
      const item = itemFromChallenge(ch);
      const spoken = spokenLine(itemCue(item));
      // Enumerating the closed set IS the ask — it is what keeps the response
      // class benched — so every choice is spoken, correct and wrong alike.
      for (const choice of item.choices) expect(spoken).toContain(choice.word);
      // What must never be spoken pre-verdict is the RELATION that names one.
      expect(spoken).not.toContain(`${item.answer} rhymes with`);
      expect(spoken).not.toContain(`end with ${item.rime}`);
      // The answer is earned in the correction, and only there.
      expect(itemCue(item)).toContain(`My turn: ${item.answer} rhymes with ${item.targetWord}`);
    }
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

// ── The production bank ─────────────────────────────────────────────────────

describe('buildProductionBank', () => {
  it('fills four tiles with the tier’s correct count, and never clusters them first', () => {
    const bank = buildProductionBank(productionCh({ productionCorrectCount: 2 }));
    expect(bank).toHaveLength(4);
    expect(bank.filter((c) => c.isCorrect)).toHaveLength(2);
    expect(bank[0].isCorrect).toBe(false);
  });

  it('hard thins the bank to one correct tile — and it is ALWAYS present', () => {
    const bank = buildProductionBank(productionCh({ productionCorrectCount: 1 }));
    expect(bank).toHaveLength(4);
    expect(bank.filter((c) => c.isCorrect)).toHaveLength(1);
  });

  it('refuses a "distractor" equal to the target', () => {
    const bank = buildProductionBank(productionCh({ bankDistractors: ['sun', 'dog', 'book'] }));
    expect(bank.map((c) => c.word)).not.toContain('sun');
  });

  it('is deterministic — a re-render must not desync the tutor’s enumerated ask', () => {
    const a = buildProductionBank(productionCh()).map((c) => c.word);
    const b = buildProductionBank(productionCh()).map((c) => c.word);
    expect(a).toEqual(b);
  });
});

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
