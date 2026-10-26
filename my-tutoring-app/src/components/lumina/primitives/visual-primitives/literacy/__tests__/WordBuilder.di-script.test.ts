/**
 * wordBuilderScript — the pedagogy lives here, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop.
 *
 * What this locks in (the scripted cues were retired when the family moved onto its boss, 2026-10-26):
 *  1. THE FORK: ALL-VOICE. The port was queued as a hybrid — tap to build, then
 *     speak — and the user overturned it: *"kind of disagree on tap, this feels
 *     like a pure spoken with cards on the board"*. Moving any mode back to a
 *     gesture is the regression this locks out.
 *  2. The ask states the clue and never the word; the key accepts the word built
 *     aloud part by part and names the root said back as wrong.
 *  3. Build gates DROP rather than repair: parts that do not spell the word,
 *     a one-letter morpheme with no spoken form, a clue holding its own answer.
 *  4. The catalog keeps its side: no tutoring block, wiring from the boss card,
 *     and no directive for the deleted drag-and-Check channel.
 */
import { describe, it, expect } from 'vitest';
import {
  answerKindFor,
  collidesWithSpokenFrame,
  itemFromTarget,
  itemsFromTargets,
  responseClassFor,
  rootPartOf,
  wordBuilderHarnessAnswers,
  type TargetWordLike,
  type WordBuilderComplexity,
  type WordBuilderItem,
  type WordPartLike,
} from '../wordBuilderScript';
import { asSpokenBuilder, hearClueRequest, wordBuilderAsk, wordBuilderKey } from '../wordBuilderWorkspace';
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

/** The key the tutor judges against, as the boss builds it. */
const keyOf = (item: WordBuilderItem) => wordBuilderKey(asSpokenBuilder(item))!;
const askOf = (item: WordBuilderItem) => wordBuilderAsk(asSpokenBuilder(item));

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

  it('never emits a gesture item: every word has a spoken key', () => {
    for (const item of ITEMS) {
      expect(item.answerKind).toBe('voice');
      expect(keyOf(item).answer).toBe(item.word);
    }
  });
});

// ── 3. The answer never leaks ───────────────────────────────────────────────

describe('word-builder pack · answer-leak rule', () => {
  it('the ask states the clue and never says the word', () => {
    for (const item of ITEMS) {
      expect(askOf(item)).toContain(item.clue);
      expect(askOf(item).toLowerCase()).not.toContain(item.word.toLowerCase());
    }
  });

  it('the key accepts the word built aloud part by part and names the root said back as wrong', () => {
    const key = keyOf(UNHELP);
    expect(key.acceptRule).toContain('un + help + ful');
    expect(key.acceptRule).toContain('part by part counts when the whole word arrives at the end');
    expect(key.signatureError).toContain(`"${rootPartOf(UNHELP).text}"`);
  });

  it('re-asks the QUESTION on tap-to-hear, never the answer', () => {
    const request = hearClueRequest(UNHELP);
    expect(request).toContain(UNHELP.clue);
    expect(request).toContain('Say the whole word.');
    expect(request.toLowerCase()).not.toContain('unhelpful');
    // The context sentence rides here too: a second route into the same clue.
    expect(request).toContain('The broken lift was hmm for anyone pushing a pram.');
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
    expect(hearClueRequest(noBlank)).toContain(noBlank.clue);

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

// ── 8. The journey harness ──────────────────────────────────────────────────

describe('word-builder · harness answers', () => {
  it('hands the harness the root said back as the signature wrong', () => {
    for (const item of ITEMS) expect(wordBuilderHarnessAnswers(item).signatureWrong.text).toBe(rootPartOf(item).text);
  });

  it('drives the ORDERING half of the skill with its plain wrong', () => {
    expect(wordBuilderHarnessAnswers(UNHELP).plainWrong).toBe('fulhelpun');
  });
});

// ── 9. The catalog keeps its side of the contract ───────────────────────────

describe('word-builder catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'word-builder')!;

  it('carries no tutoring block, and its wiring is the boss card (WB-5)', () => {
    // The runner-era block ordered [WB_ITEM] turns and "the scripted correction
    // line". The no-answer rule is the shared rotation doctrine, from the card.
    expect(entry.tutoring).toBeUndefined();
    expect(entry.teachingWorkspace?.card).toBeDefined();
    expect(entry.teachingWorkspace?.guidance).toBeUndefined();
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

  it('keeps every eval mode identity and moves β only for the structural change', () => {
    // build_affix (open build, 10-07) is the contract's stated fork: a new identity, not an edit of the spoken four.
    expect(entry.evalModes?.map((m) => m.evalMode)).toEqual([
      'build_affix', 'simple_affix', 'compound_affix', 'greek_latin', 'multi_morpheme',
    ]);
    // Unlimited drag-and-Check became one spoken attempt plus two judged
    // corrections. That is a structural change to what a correct response
    // costs, and it is the only thing that licenses moving a β.
    expect(entry.evalModes?.map((m) => m.beta)).toEqual([2.1, 2.0, 3.5, 5.5, 7.5]);
  });
});
