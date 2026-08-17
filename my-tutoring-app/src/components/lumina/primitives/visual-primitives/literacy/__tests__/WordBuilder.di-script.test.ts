/**
 * wordBuilderScript — the pedagogy lives here, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (benched response classes,
 *     sentinel discipline over every cue, no performed stage directions, no
 *     byte-identical consecutive ask).
 *  2. THE FORK: ALL-VOICE. The port was queued as a hybrid — tap to build, then
 *     speak — and the user overturned it: *"kind of disagree on tap, this feels
 *     like a pure spoken with cards on the board"*. Moving any mode back to a
 *     gesture is the regression this locks out, and the reason is testable
 *     rather than doctrinal: a spoken word CARRIES its morphemes, so the
 *     arrangement is not an answer without a spoken form.
 *  3. THE BOARD IS PRINT. Cards stay (they are what makes this construction
 *     rather than recall) and nothing about them is an answer surface.
 *  4. Build gates DROP rather than repair: parts that do not spell the word,
 *     a one-letter morpheme with no spoken form, a clue holding its own answer,
 *     and — the one only this port needs — a target word THIS PACK ALREADY SAYS
 *     in its own how-to-play.
 *  5. The correction re-models the ROUTE (meanings) and never the assembly
 *     (morphemes in order ARE the word); the cap closes the link.
 *  6. The catalog keeps its side: template keys resolve against exactly what
 *     the pack pushes, no prose sentence opens with a verdict sentinel, and no
 *     directive survives for the deleted drag-and-Check channel.
 */
import { describe, it, expect } from 'vitest';
import {
  answerKindFor,
  collidesWithSpokenFrame,
  completeCue,
  GREETING,
  howToPlayFor,
  itemCue,
  itemFromTarget,
  itemsFromTargets,
  moveOnCue,
  pronounceCue,
  responseClassFor,
  rootPartOf,
  stimulusFor,
  wordBuilderHarnessAnswers,
  wordBuilderPackBase,
  type TargetWordLike,
  type WordBuilderComplexity,
  type WordBuilderItem,
  type WordPartLike,
} from '../wordBuilderScript';
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

// ── Fixtures — a shared pool and a SESSION-SHAPED set of targets ────────────

const POOL: WordPartLike[] = [
  { id: 'pre-un', text: 'un', type: 'prefix', meaning: 'not' },
  { id: 'pre-re', text: 're', type: 'prefix', meaning: 'again' },
  { id: 'pre-tele', text: 'tele', type: 'prefix', meaning: 'far' },
  { id: 'pre-dis', text: 'dis', type: 'prefix', meaning: 'apart' },
  { id: 'root-help', text: 'help', type: 'root', meaning: 'to help' },
  { id: 'root-play', text: 'play', type: 'root', meaning: 'to play' },
  { id: 'root-scope', text: 'scope', type: 'root', meaning: 'to see' },
  { id: 'root-agree', text: 'agree', type: 'root', meaning: 'to say yes to' },
  { id: 'suf-ful', text: 'ful', type: 'suffix', meaning: 'full of' },
  { id: 'suf-able', text: 'able', type: 'suffix', meaning: 'able to be' },
  { id: 'suf-ment', text: 'ment', type: 'suffix', meaning: 'the state of' },
  // A one-letter part: legal morphology, no spoken form. Used by DROP tests.
  { id: 'suf-y', text: 'y', type: 'suffix', meaning: 'full of' },
];

const UNHELPFUL: TargetWordLike = {
  word: 'unhelpful',
  parts: ['pre-un', 'root-help', 'suf-ful'],
  hint: 'Describing someone who does not make things any easier',
  definition: 'Not giving any assistance.',
  sentenceContext: 'The broken lift was ___ for anyone pushing a pram.',
};

const REPLAYABLE: TargetWordLike = {
  word: 'replayable',
  parts: ['pre-re', 'root-play', 'suf-able'],
  hint: 'Able to be enjoyed over and over again',
  definition: 'Worth going through a second time.',
  sentenceContext: 'That old game is still ___ twenty years later.',
};

const TELESCOPE: TargetWordLike = {
  word: 'telescope',
  parts: ['pre-tele', 'root-scope'],
  hint: 'A tool for seeing things that are a very long way off',
  definition: 'An instrument that makes distant objects look nearer.',
  sentenceContext: 'She found Mars through the ___.',
};

const COMPLEXITIES: WordBuilderComplexity[] = [
  'simple_affix',
  'compound_affix',
  'greek_latin',
  'multi_morpheme',
];

const build = (
  target: TargetWordLike,
  complexity: WordBuilderComplexity = 'compound_affix',
) => itemFromTarget(target, POOL, complexity)!;

/**
 * ⚠️ THREE ITEMS OF THE SAME ACTION — the shape a real session has, and the
 * only shape `findRepeatedConsecutiveAsks` can act on. Every port before the
 * 19a sweep built one-item-per-mode fixtures, which is the one arrangement that
 * cannot trigger the gate at all. This port has ONE action by construction (the
 * four eval modes are difficulty tiers, not task identities), so the natural
 * fixture is also the correct one — but it is stated here so nobody "fixes" it
 * into a per-mode pack later.
 */
const ITEMS: WordBuilderItem[] = itemsFromTargets(
  [UNHELPFUL, REPLAYABLE, TELESCOPE],
  POOL,
  'compound_affix',
);

const [UNHELP, REPLAY, TELE] = ITEMS;

/** The pack exactly as the component assembles it — the EXPORTED surface, not
 *  a copy. A hand-rolled literal here is the drift 19f found on both sides of
 *  letter-spotter's wire. */
const pack: JudgedScriptPack<WordBuilderItem> = wordBuilderPackBase(ITEMS);

const spokenLine = spokenSpanOf;

const affirmLine = (cue: string): string =>
  cue.match(/If the answer is right, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';
const correctionLine = (cue: string): string =>
  cue.match(/If it is wrong, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';

/** Every line the tutor can SPEAK for one item, across its whole life. */
const everySpokenLine = (item: WordBuilderItem): string =>
  [
    spokenLine(itemCue(item, { opening: true, howToPlay: true })),
    spokenLine(itemCue(item)),
    correctionLine(itemCue(item)),
    spokenLine(pronounceCue(item)),
  ].join('\n');

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('word-builder pack · structural gates', () => {
  it('builds every fixture target — the gates are not paying for themselves', () => {
    expect(ITEMS).toHaveLength(3);
    expect(ITEMS.map((i) => i.word)).toEqual(['unhelpful', 'replayable', 'telescope']);
  });

  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('the clue varies every item, so three same-action asks in a row are distinct', () => {
    // This pack has ONE action, so consecutive items ALWAYS share it — the
    // repeat gate is live on every pair of a real session, not just on a
    // contrived fixture. The ask carries new information each round because the
    // clue does; there is nothing to shorten and nothing to recite.
    const asks = ITEMS.map((item) => spokenLine(itemCue(item)));
    expect(new Set(asks).size).toBe(asks.length);
    for (const ask of asks) expect(ask).toContain('Say the whole word.');
  });

  it('a byte-identical repeated ask WOULD be refused (the gate is awake)', () => {
    // The revert-bite for the assertion above: same action, same clue twice.
    const twin = { ...UNHELP, id: 'twin' };
    expect(checkPackGates({ ...pack, items: [UNHELP, twin] })).toEqual([
      expect.stringContaining('consecutive asks recite a byte-identical'),
    ]);
  });
});

// ── 2. The answer-material fork ─────────────────────────────────────────────

describe('word-builder pack · the fork is ALL-VOICE', () => {
  it('answers with the mouth at every complexity tier', () => {
    // USER RULING: the port was queued as "tap to build, then speak". A spoken
    // "unhelpful" CARRIES /ʌn/-/hɛlp/-/fəl/, so the arrangement is not an
    // answer without a spoken form — which is the only thing that licenses a
    // gesture mode. Re-introducing one is the regression.
    for (const complexity of COMPLEXITIES) {
      expect(answerKindFor(complexity)).toBe('voice');
      expect(responseClassFor(complexity)).toBe('short_spoken_word');
      const item = build(UNHELPFUL, complexity);
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('short_spoken_word');
      expect(item.action).toBe(complexity);
    }
  });

  it('never emits a gesture item, so no cue ever asks for silence', () => {
    for (const item of ITEMS) {
      expect(item.answerKind).toBe('voice');
      const cue = itemCue(item);
      expect(cue).not.toContain('answers by TAPPING');
      expect(cue).not.toContain('Do not judge anything you hear');
      // A spoken item gets the target, the accept clause and BOTH verdict lines.
      expect(cue).toContain('you then stay silent while the learner thinks');
      expect(affirmLine(cue)).not.toBe('');
      expect(correctionLine(cue)).not.toBe('');
    }
  });
});

// ── 3. The answer never leaks ───────────────────────────────────────────────

describe('word-builder pack · answer-leak rule', () => {
  it('no spoken line says the word, or its parts in order, before a verdict', () => {
    for (const item of ITEMS) {
      const spoken = everySpokenLine(item).toLowerCase();
      expect(spoken).not.toContain(item.word.toLowerCase());
      // The morphemes in order ARE the word said slowly — the correction
      // therefore walks MEANINGS, never the parts.
      for (const part of item.parts) {
        expect(spoken).not.toContain(`${part.text.toLowerCase()},`);
      }
    }
  });

  it('the ask STATES the clue aloud — the whole question side is spoken', () => {
    for (const item of ITEMS) {
      expect(spokenLine(itemCue(item))).toContain(item.clue);
    }
  });

  it('pushes only the answer-free question side through the context channel', () => {
    for (const item of ITEMS) {
      const stimulus = stimulusFor(item);
      expect(stimulus.toLowerCase()).not.toContain(item.word.toLowerCase());
      // Not the part COUNT either: two-part or three-part narrows the search a
      // long way, and the state block is the channel a tutor has been caught
      // narrating.
      for (const numberWord of ['two', 'three', 'four']) {
        expect(stimulus.toLowerCase()).not.toContain(numberWord);
      }
    }
    // Constant across a session, so the state signature never changes and
    // PrimitiveState.attach fires at most once per run.
    expect(new Set(ITEMS.map((i) => stimulusFor(i))).size).toBe(1);
  });

  it('re-speaks the QUESTION on tap-to-hear, never the answer', () => {
    const cue = pronounceCue(UNHELP);
    expect(spokenLine(cue)).toContain(UNHELP.clue);
    expect(spokenLine(cue)).toContain('Say the whole word.');
    expect(spokenLine(cue).toLowerCase()).not.toContain('unhelpful');
    // The context sentence rides here too — a second route into the same clue,
    // available without spending a correction.
    expect(spokenLine(cue)).toContain('The broken lift was hmm for anyone pushing a pram.');
  });
});

// ── 4. Build gates DROP, never repair ───────────────────────────────────────

describe('word-builder pack · build gates', () => {
  it('drops a target whose parts do not spell the word', () => {
    // The affirmation says the assembly out loud and the reveal prints it, so a
    // decomposition that is not true teaches a false one at the moment the
    // child is most likely to believe it. Orthographic-change words are the
    // real-world shape of this (happy+ly → happily).
    expect(itemFromTarget(
      { ...UNHELPFUL, word: 'unhelpfulness' },
      POOL,
      'compound_affix',
    )).toBeNull();
    expect(itemFromTarget(
      { ...UNHELPFUL, word: 'helpful', parts: ['root-help', 'suf-ful'] },
      POOL,
      'simple_affix',
    )).not.toBeNull();
  });

  it('drops a target carrying a one-letter morpheme (no spoken form)', () => {
    // bio+log+y is legal morphology and an unaskable item: the tutor says the
    // assembly aloud at the affirmation, and a bare "y" is read as a LETTER
    // NAME to a child being taught what the ending does.
    expect(itemFromTarget(
      { ...TELESCOPE, word: 'telescopey', parts: ['pre-tele', 'root-scope', 'suf-y'] },
      POOL,
      'greek_latin',
    )).toBeNull();
  });

  it('drops a target with fewer than two parts — a one-part build is not a build', () => {
    expect(itemFromTarget(
      { ...UNHELPFUL, word: 'help', parts: ['root-help'] },
      POOL,
      'simple_affix',
    )).toBeNull();
  });

  it('drops a target referencing a part the pool does not hold', () => {
    // The click-era generator console.warn'd about this and shipped it anyway,
    // because the Check button could still compare ids. A judged item cannot:
    // the cue has to name the meanings of parts that exist.
    expect(itemFromTarget(
      { ...UNHELPFUL, parts: ['pre-un', 'root-missing', 'suf-ful'] },
      POOL,
      'compound_affix',
    )).toBeNull();
  });

  it('drops a clue that contains its own answer', () => {
    expect(itemFromTarget(
      { ...UNHELPFUL, hint: 'Something unhelpful, in other words' },
      POOL,
      'compound_affix',
    )).toBeNull();
    // Inside a longer word too — the tutor still says it.
    expect(itemFromTarget(
      { ...UNHELPFUL, hint: 'Behaving unhelpfully towards other people' },
      POOL,
      'compound_affix',
    )).toBeNull();
  });

  it('drops model babble and unsayable prose in the fields that carry no enum', () => {
    const babble = `deliberating-about-the-hint ${'and going on about it '.repeat(12)}`;
    expect(itemFromTarget({ ...UNHELPFUL, hint: babble }, POOL, 'compound_affix')).toBeNull();
    // A double quote CLOSES the cue's spoken span early and turns the rest of
    // the line into judge-side prose.
    expect(itemFromTarget(
      { ...UNHELPFUL, hint: 'Describing a so-called "helper" who does nothing' },
      POOL,
      'compound_affix',
    )).toBeNull();
    expect(itemFromTarget(
      { ...UNHELPFUL, word: 'un helpful' },
      POOL,
      'compound_affix',
    )).toBeNull();
  });

  it('drops anything that would open a cue sentence with a verdict sentinel', () => {
    expect(itemFromTarget(
      { ...UNHELPFUL, hint: 'Not much use at all. Yes, that is the one' },
      POOL,
      'compound_affix',
    )).toBeNull();
    const yesPool: WordPartLike[] = POOL.map((p) =>
      p.id === 'suf-ful' ? { ...p, meaning: 'Yes, full of' } : p);
    expect(itemFromTarget(UNHELPFUL, yesPool, 'compound_affix')).toBeNull();
  });

  it('⭐ drops a target word THIS PACK ALREADY SAYS in its own frame', () => {
    // The leak only this port has. Every other port's answer is a letter, a
    // sound or a count; here it is ordinary English built by ordinary
    // affixation, and the invariant frame is ordinary English too. "build"+"ing"
    // is a legal simple_affix target, and the greeting first drafted for this
    // pack said "today we are building words" — the tutor would have spoken the
    // answer while explaining the game.
    expect(collidesWithSpokenFrame('building')).toBe(false); // reworded out
    expect(collidesWithSpokenFrame('together')).toBe(true);
    expect(collidesWithSpokenFrame('parts')).toBe(true);
    // Exact-word, so an affixed cousin of a frame word is still a fine target.
    expect(collidesWithSpokenFrame('disorder')).toBe(false);
    expect(collidesWithSpokenFrame('order')).toBe(true);

    const pool: WordPartLike[] = [
      ...POOL,
      { id: 'root-get', text: 'get', type: 'root', meaning: 'to get' },
      { id: 'suf-her', text: 'her', type: 'suffix', meaning: 'more' },
      { id: 'pre-to', text: 'to', type: 'prefix', meaning: 'toward' },
    ];
    expect(itemFromTarget(
      { ...UNHELPFUL, word: 'together', parts: ['pre-to', 'root-get', 'suf-her'] },
      pool,
      'simple_affix',
    )).toBeNull();
  });

  it('drops the context SENTENCE alone when it is unusable, and keeps the item', () => {
    // The sentence is support, not the ask — a broken one withdraws a channel
    // rather than deleting a word the lesson needs.
    const noBlank = build({ ...UNHELPFUL, sentenceContext: 'The lift was broken today.' });
    expect(noBlank).not.toBeNull();
    expect(noBlank.spokenSentence).toBeUndefined();
    expect(spokenLine(pronounceCue(noBlank))).toContain(noBlank.clue);

    const leaky = build({
      ...UNHELPFUL,
      sentenceContext: 'The unhelpful lift was ___ for anyone with a pram.',
    });
    expect(leaky.spokenSentence).toBeUndefined();

    // A usable one is voiced with the blank as "hmm" — never as underscores.
    expect(UNHELP.spokenSentence).toBe('The broken lift was hmm for anyone pushing a pram.');
  });
});

// ── 5. The session invariant — a leak no single target can commit ───────────

describe('word-builder pack · one word, answered once', () => {
  it('drops a second target that OVERLAPS an earlier word', () => {
    // Every item closes by saying its word aloud (the affirmation echoes it,
    // the capped move-on names it), so "helpful" after "unhelpful" is answered
    // from memory rather than from the parts. Neither target is wrong alone,
    // which is why no per-item gate can see it — and under the click-era Check
    // button nothing was said aloud, so it arrives WITH the modality.
    const kept = itemsFromTargets(
      [
        UNHELPFUL,
        { ...UNHELPFUL, word: 'helpful', parts: ['root-help', 'suf-ful'], hint: 'Giving good use' },
        TELESCOPE,
      ],
      POOL,
      'compound_affix',
    );
    expect(kept.map((i) => i.word)).toEqual(['unhelpful', 'telescope']);
  });

  it('drops a duplicate word', () => {
    const kept = itemsFromTargets([UNHELPFUL, { ...UNHELPFUL, hint: 'Of no use to anyone' }], POOL, 'compound_affix');
    expect(kept).toHaveLength(1);
  });

  it('drops a target whose word an earlier ITEM already spoke in its clue', () => {
    const kept = itemsFromTargets(
      [
        { ...TELESCOPE, hint: 'A tool you look through, a bit like a replayable film reel' },
        REPLAYABLE,
      ],
      POOL,
      'greek_latin',
    );
    expect(kept.map((i) => i.word)).toEqual(['telescope']);
  });

  it('keeps a clean session untouched (the revert-bite)', () => {
    expect(itemsFromTargets([UNHELPFUL, REPLAYABLE, TELESCOPE], POOL, 'compound_affix'))
      .toHaveLength(3);
  });
});

// ── 6. Corrections earn the answer ──────────────────────────────────────────

describe('word-builder pack · corrections', () => {
  it('opens "My turn:", walks the MEANINGS, and re-elicits', () => {
    const line = correctionLine(itemCue(UNHELP));
    expect(line.startsWith('My turn:')).toBe(true);
    expect(line).toContain('One part means not.');
    expect(line).toContain('One part means to help.');
    expect(line).toContain('One part means full of.');
    expect(line).toContain('say the whole word');
    // The route, never the answer: a retry that hands back what it is retrying
    // for is free (letter-spotter's name-it rule).
    expect(line.toLowerCase()).not.toContain('unhelpful');
  });

  it('uses the context sentence as a second route where the item has one', () => {
    expect(correctionLine(itemCue(UNHELP)))
      .toContain('Here it is in a sentence: The broken lift was hmm');
    const noSentence = build({ ...TELESCOPE, sentenceContext: undefined });
    expect(correctionLine(itemCue(noSentence))).not.toContain('in a sentence');
    expect(correctionLine(itemCue(noSentence))).toContain('My turn:');
  });

  it('names BOTH signature errors, and the accept clause is the second one\'s twin', () => {
    const cue = itemCue(UNHELP);
    // 1. The root said straight back: a real word, printed on the board, the
    //    carrier of the target's meaning, and the thing the correction itself
    //    says the meaning of.
    expect(rootPartOf(UNHELP).text).toBe('help');
    expect(cue).toContain('Saying only "help" is NOT an answer');
    // 2. The parts without the word — every phoneme of the answer, no answer.
    expect(cue).toContain('without ever joining them into a whole word is NOT an answer');
    // …and its twin: the same walk that LANDS on the word is how this is taught.
    expect(cue).toContain('built out loud part by part so long as the whole');
    expect(cue).toContain('A different real word built from only some of the parts is wrong.');
    expect(cue).toContain('The parts said in the wrong order are wrong.');
  });

  it('affirms with the canonical word and teaches the assembly', () => {
    expect(affirmLine(itemCue(UNHELP))).toBe('Yes, unhelpful — un, help, ful.');
    expect(affirmLine(itemCue(TELE))).toBe('Yes, telescope — tele, scope.');
  });

  it('closes the link at the cap — the corrections deliberately never did', () => {
    const line = spokenLine(moveOnCue(UNHELP, null, {}));
    expect(line).toContain('The word is unhelpful — un means not, help means to help, and ful means full of.');
    expect(moveOnCue(UNHELP, null, {})).toContain('Then stop');
    // With a next item the move-on carries its ask AND its contract.
    const withNext = moveOnCue(UNHELP, TELE, {});
    expect(spokenLine(withNext)).toContain(TELE.clue);
    expect(withNext).toContain('The correct answer is the word "telescope"');
  });
});

// ── 7. Session frame ────────────────────────────────────────────────────────

describe('word-builder pack · session frame', () => {
  it('the opening cue has ONE job: greeting + how-to-play + model + ask', () => {
    const opening = spokenLine(itemCue(UNHELP, { opening: true, howToPlay: true }));
    expect(opening).toContain(GREETING.trim());
    expect(opening).toContain(howToPlayFor().trim());
    expect(opening).toContain('Every part carries a piece of what the word means');
    expect(opening).toContain(UNHELP.clue);
    // The how-to-play asks for the same thing the ask does — a stale verb here
    // is how letter-spotter told a child to "tap" a mode that was spoken.
    expect(opening.toLowerCase()).not.toContain('tap');
    expect(opening.toLowerCase()).not.toContain('drag');
  });

  it('the model line is spoken ONCE per action, never on every ask', () => {
    const repeat = spokenLine(itemCue(UNHELP));
    expect(repeat).not.toContain('Every part carries a piece');
    expect(repeat).not.toContain('The board shows word parts');
    // The QUESTION is never withdrawn with it.
    expect(repeat).toContain(UNHELP.clue);
  });

  it('gives every cue the NEVER_PERFORM tail and states the wait as a FACT', () => {
    const tail = 'never announce that you are waiting or listening';
    for (const item of ITEMS) {
      expect(itemCue(item, { opening: true, howToPlay: true })).toContain(tail);
      expect(moveOnCue(item, TELE, { howToPlay: true })).toContain(tail);
      expect(pronounceCue(item)).toContain(tail);
      expect(itemCue(item)).not.toMatch(/Then WAIT|WAIT silently/i);
    }
  });

  it('states the TWO-BRANCH LAW before the branches (18d, script side)', () => {
    const cue = itemCue(UNHELP);
    expect(cue).toContain('A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all');
    expect(cue.indexOf('no scaffolding line')).toBeLessThan(cue.indexOf('If the answer is right'));
  });

  it('never opens a cue sentence with a verdict sentinel', () => {
    expect(findSentinelCollisions([
      { label: 'itemCue-opening', text: itemCue(UNHELP, { opening: true, howToPlay: true }) },
      { label: 'itemCue', text: itemCue(TELE) },
      { label: 'moveOnCue', text: moveOnCue(UNHELP, TELE, { howToPlay: true }) },
      { label: 'moveOnCue-last', text: moveOnCue(TELE, null, {}) },
      { label: 'pronounceCue', text: pronounceCue(UNHELP) },
      { label: 'completeCue', text: completeCue() },
    ])).toEqual([]);
  });

  it('the complete cue stops the tutor', () => {
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });
});

// ── 8. The wire: what the DI drive harness reads ────────────────────────────

describe('word-builder pack · the DI wire', () => {
  /** The harness's leak scan, byte for byte (run_tutor_live.py `_norm`). */
  const norm = (s: string) =>
    s.toLowerCase().replace(/[*_`]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
  const scanFinds = (spoken: string, token: string) =>
    new RegExp(`\\b${norm(token)}\\b`).test(norm(spoken));

  it('exposes ask / affirm / correction as the three spans the plan binds', () => {
    expect(spokenSpansOf(itemCue(UNHELP))).toHaveLength(3);
    expect(pack.primitiveType).toBe('word-builder');
    expect(pack.contextFor(UNHELP)).toEqual({
      challengeType: 'compound_affix',
      stimulus: 'a board of word parts with their meanings, and a spoken clue about what the word means',
    });
  });

  it('hands the harness the contract\'s OWN named miss as the signature wrong', () => {
    const answers = wordBuilderHarnessAnswers(UNHELP);
    expect(answers.correct).toBe('unhelpful');
    expect(answers.signatureWrong.text).toBe('help');
    // The claim and the contract have to be the same claim.
    expect(itemCue(UNHELP)).toContain('Saying only "help" is NOT an answer');
  });

  it('drives the ORDERING half of the skill with its plain wrong', () => {
    // Every other port's plain wrong is an unrelated token. Here it is the
    // parts in the wrong order — the one miss the printed board cannot help
    // with, because the cards say what each part MEANS and nothing about where
    // it goes.
    const answers = wordBuilderHarnessAnswers(UNHELP);
    expect(answers.plainWrong).toBe('fulhelpun');
    expect(answers.plainWrong).not.toBe(answers.correct);
    expect(wordBuilderHarnessAnswers(TELE).plainWrong).toBe('scopetele');
  });

  it('keeps a FLAT leak oracle — no exempt span anywhere', () => {
    for (const item of ITEMS) {
      const answers = wordBuilderHarnessAnswers(item);
      expect(answers.leakTokens).toEqual([item.word]);
      expect(answers).not.toHaveProperty('leakExemptSpan');
      const ask = spokenLine(itemCue(item, { opening: true, howToPlay: true }));
      expect(scanFinds(ask, item.word)).toBe(false);
    }
  });
});

// ── 9. The catalog keeps its side of the contract ───────────────────────────

describe('word-builder catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'word-builder')!;

  it('keeps its side: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, UNHELP)).toEqual([]);
  });

  it('carries no steering for the deleted drag-and-Check channel', () => {
    // Description and constraints are MANIFEST STEERING: "drag-and-drop"
    // routes this primitive to the wrong objectives forever.
    const prose = `${entry.description} ${entry.constraints}`.toLowerCase();
    for (const dead of ['drag-and-drop', 'drag and drop', 'drag', 'check button']) {
      expect(prose).not.toContain(dead);
    }
    expect(prose).toContain('microphone');
    expect(prose).toContain('says the whole word');
  });

  it('18d: no rung answers an ATTEMPT with a re-spoken ask', () => {
    const rungs = Object.values(entry.tutoring?.scaffoldingLevels ?? {});
    expect(rungs).toHaveLength(3);
    for (const rung of rungs) {
      expect(rung).toContain('scripted correction line');
      expect(rung.toLowerCase()).not.toMatch(/say the (question|clue) (once more|again)/);
    }
    // The "goes quiet" struggle is NOT this defect — silence is not an attempt,
    // so no verdict is owed and a re-spoken clue is the right move there.
    const quiet = (entry.tutoring?.commonStruggles ?? []).find((s) => /goes quiet/i.test(s.pattern));
    expect(quiet?.response).toContain('say the clue one more time');
  });

  it('every struggle response is a PERFORMABLE script move', () => {
    for (const struggle of entry.tutoring?.commonStruggles ?? []) {
      // Meta-commentary in this field gets recited verbatim to a child.
      expect(struggle.response.toLowerCase()).not.toContain('the student is');
      expect(struggle.response).toMatch(/scripted correction line|wait|clue/i);
    }
  });

  it('keeps every eval mode identity and moves β only for the structural change', () => {
    expect(entry.evalModes?.map((m) => m.evalMode)).toEqual([
      'simple_affix', 'compound_affix', 'greek_latin', 'multi_morpheme',
    ]);
    // Unlimited drag-and-Check became one spoken attempt plus two judged
    // corrections. That is a structural change to what a correct response
    // costs, and it is the only thing that licenses moving a β.
    expect(entry.evalModes?.map((m) => m.beta)).toEqual([2.0, 3.5, 5.5, 7.5]);
  });
});
