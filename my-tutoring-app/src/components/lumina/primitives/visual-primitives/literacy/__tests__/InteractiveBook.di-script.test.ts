/**
 * interactiveBookScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates: benched
 *     response classes, sentinel discipline over every cue, performed stage
 *     directions, byte-identical consecutive asks; cue builders that don't
 *     throw) — over the REAL session shape, including same-action items back
 *     to back, because a one-item-per-mode fixture is the one shape the
 *     repeat-ask gate cannot see.
 *  2. THE SPLIT (the table picture): read-focus-word is SPOKEN — shared
 *     reading is the most spoken thing a teacher and a five-year-old do —
 *     while find-feature TAPS because its answer is WHICH printed element on
 *     the page it is, a position, answered at a real table by pointing.
 *     Moving the reading mode back toward any tap path is the regression this
 *     locks out: tapping a glowing word completes an oral-reading task without
 *     reading anything.
 *  3. THE LEAK RULES, which differ per mode: the reading ask speaks the
 *     lead-in and NEVER the word (the print is the child's); the find ask
 *     names the PART and never the page's printed text (a child who hears the
 *     words can sound-match without knowing the book part).
 *  4. Build gates DROP unaskable items rather than repairing them: a one-word
 *     lead is a headless cloze, a verdict-shaped focus word hands the judge an
 *     affirmation, a page whose candidates duplicate the target is one
 *     question with two right answers.
 *  5. Corrections re-model then re-elicit (standing gate 3): the reading
 *     correction NAMES the word (model-lead-test is the DISTAR word-reading
 *     correction; the child re-reads with print in front of them); the find
 *     correction re-models the feature's JOB and never this page's text.
 *  6. The catalog keeps its side of the contract, and no directive survives
 *     for a deleted channel (the push-to-talk era's tags and prose).
 *
 * NO TIMED-STIMULUS RE-RENDER TEST, deliberately: this stage presents nothing
 * on a clock — the glow is static from item open and nothing flashes — so
 * there is no `tutorSpeaking`-gated stimulus to drive (the ten-frame class of
 * defect has no surface here).
 */
import { describe, it, expect } from 'vitest';
import {
  answerKindFor,
  challengeAskable,
  completeCue,
  fullSentenceOf,
  interactiveBookHarnessAnswers,
  interactiveBookPackBase,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  pronounceCue,
  responseClassFor,
  stimulusFor,
  tapVerdictCue,
  MIN_LEAD_WORDS,
  type InteractiveBookItem,
} from '../interactiveBookScript';
import {
  findSentinelCollisions,
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — one per direction, then session-shaped packs ─────────────────

const WORD_RAW = {
  id: 'ib-w1',
  type: 'read-focus-word',
  targetPageId: 'interactive-book-page-1',
  targetFeature: 'focus-word',
  targetText: 'frog',
  optionTexts: ['frog', 'pond'],
  readLead: 'The green',
  readTail: 'can hop by the pond.',
};

/** A second word on the same page — the real session shape runs word items
 *  back to back. Its word ends the sentence, so the tail is bare punctuation
 *  and `fullSentenceOf` must close straight onto the word. */
const WORD2_RAW = {
  id: 'ib-w2',
  type: 'read-focus-word',
  targetPageId: 'interactive-book-page-1',
  targetFeature: 'focus-word',
  targetText: 'pond',
  optionTexts: ['frog', 'pond'],
  readLead: 'The green frog can hop by the',
  readTail: '.',
};

const TITLE_RAW = {
  id: 'ib-f1',
  type: 'find-feature',
  targetPageId: 'cover',
  targetFeature: 'title',
  targetText: 'Pond Neighbors',
  optionTexts: ['Pond Neighbors', 'Mia Lee'],
};

const CAPTION_RAW = {
  id: 'ib-f2',
  type: 'find-feature',
  targetPageId: 'interactive-book-page-2',
  targetFeature: 'caption',
  targetText: 'Nest Above',
  optionTexts: ['Safe Nests', 'Nest Above', 'Page 2'],
};

const PAGE_NUMBER_RAW = {
  id: 'ib-f3',
  type: 'find-feature',
  targetPageId: 'interactive-book-page-3',
  targetFeature: 'page-number',
  targetText: 'Page 3',
  optionTexts: ['Busy Bees', 'Bee at Work', 'Page 3'],
};

const build = (ch: Parameters<typeof itemFromChallenge>[0]) => itemFromChallenge(ch)!;

const WORD = build(WORD_RAW);
const WORD2 = build(WORD2_RAW);
const TITLE = build(TITLE_RAW);
const CAPTION = build(CAPTION_RAW);
const PAGE_NUMBER = build(PAGE_NUMBER_RAW);

/** The real session shape: same-action items back to back in BOTH directions,
 *  so the repeat-ask gate is awake (testkit warning — a one-item-per-mode
 *  fixture is the one shape that cannot trigger it). */
const ITEMS: InteractiveBookItem[] = [TITLE, CAPTION, PAGE_NUMBER, WORD, WORD2];

/** The pack exactly as the component assembles it (the component spreads the
 *  same base, so this is one source, not a re-declaration). */
const pack: JudgedScriptPack<InteractiveBookItem> = {
  ...interactiveBookPackBase(ITEMS),
};

const spokenLine = spokenSpanOf;

/** The two lines a SPOKEN item's judging contract hands over — both ride
 *  inside the item cue, since a voice answer is judged in-band. */
const affirmLine = (cue: string): string =>
  cue.match(/If the answer is right, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';
const correctionLine = (cue: string): string =>
  cue.match(/If it is wrong, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';

/** Every line the tutor can SPEAK for one item, across its whole life. */
const everySpokenLine = (item: InteractiveBookItem): string =>
  [
    spokenLine(itemCue(item, { opening: true, howToPlay: true })),
    spokenLine(itemCue(item, { howToPlay: true })),
    spokenLine(itemCue(item)),
    affirmLine(itemCue(item)),
    correctionLine(itemCue(item)),
    spokenLine(moveOnCue(item, null, {})),
    spokenLine(pronounceCue(item)),
  ].join('\n');

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('interactive-book pack · structural gates', () => {
  it('passes the family gates over the session shape: validate + performed-directions + repeated-asks', () => {
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('two same-action items in a row never recite a byte-identical long ask', () => {
    // Both directions carry varying content in the ask (the sentence lead, the
    // feature name), and the one repeatable ask — two items on the same
    // feature — is a short DI signal under the gate's word limit by design.
    const twoWords = { ...pack, items: [WORD, WORD2] };
    expect(checkPackGates(twoWords)).toEqual([]);
    const twoCaptions = {
      ...pack,
      items: [CAPTION, build({ ...CAPTION_RAW, id: 'ib-f2b', targetPageId: 'interactive-book-page-3', targetText: 'Bee at Work', optionTexts: ['Busy Bees', 'Bee at Work', 'Page 3'] })],
    };
    expect(checkPackGates(twoCaptions)).toEqual([]);
  });

  it('READS the glowing word out loud, TAPS the book part whose answer is a position', () => {
    // The table picture: shared reading is spoken; "show me the title" is
    // answered by pointing at the page.
    expect(answerKindFor('read-focus-word')).toBe('voice');
    expect(responseClassFor('read-focus-word')).toBe('short_spoken_word');
    expect(answerKindFor('find-feature')).toBe('gesture');
    expect(responseClassFor('find-feature')).toBe('manipulation');
    for (const item of ITEMS) {
      expect(item.answerKind).toBe(answerKindFor(item.mode));
      expect(item.responseClass).toBe(responseClassFor(item.mode));
      expect(item.action).toBe(item.mode);
    }
  });

  it('every cue carries the contract its ANSWER KIND needs, never the other one', () => {
    for (const item of ITEMS) {
      const cue = itemCue(item);
      expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
      if (item.answerKind === 'gesture') {
        expect(cue).toContain('the learner answers by TAPPING');
        expect(cue).toContain('Do not judge anything you hear through the microphone');
        expect(cue).not.toContain('If the answer is right');
      } else {
        expect(cue).toContain('you then stay silent while the learner reads');
        expect(cue).toContain('The correct answer is the word');
        expect(affirmLine(cue)).not.toBe('');
        expect(correctionLine(cue)).not.toBe('');
        // A spoken mode must never be told to ignore the microphone.
        expect(cue).not.toContain('Do not judge anything you hear');
      }
    }
  });
});

// ── 2. The leak rules, which differ per mode ────────────────────────────────

describe('interactive-book pack · answer leaks', () => {
  it('the reading ask speaks the lead-in and NEVER the glowing word', () => {
    for (const item of [WORD, WORD2]) {
      for (const opts of [{ opening: true, howToPlay: true }, { howToPlay: true }, {}]) {
        const line = spokenLine(itemCue(item, opts));
        expect(line).toContain(item.readLead!);
        expect(line.toLowerCase()).not.toMatch(new RegExp(`\\b${item.targetText}\\b`));
      }
    }
  });

  it('the find ask names the PART and never the page\'s printed text', () => {
    for (const item of [TITLE, CAPTION, PAGE_NUMBER]) {
      for (const opts of [{ opening: true, howToPlay: true }, {}]) {
        const line = spokenLine(itemCue(item, opts)).toLowerCase();
        expect(line).not.toContain(item.targetText.toLowerCase());
      }
    }
    expect(spokenLine(itemCue(TITLE))).toContain('Find the title');
    expect(spokenLine(itemCue(CAPTION))).toContain('Find the picture caption');
    expect(spokenLine(itemCue(PAGE_NUMBER))).toContain('Find the page number');
  });

  it('a find correction re-models the JOB and still never says the text', () => {
    const line = spokenLine(tapVerdictCue(CAPTION, 'Safe Nests'));
    expect(line).toContain('My turn:');
    expect(line).toContain('caption');
    expect(line).not.toContain('Nest Above');
    expect(line).toContain('Your turn. Tap the picture caption.');
  });

  it('the affirm is the FIRST place printed text is spoken (reveal-on-affirm)', () => {
    expect(spokenLine(tapVerdictCue(TITLE, 'Pond Neighbors')))
      .toBe('Yes, that is the title — it says Pond Neighbors!');
    expect(spokenLine(tapVerdictCue(PAGE_NUMBER, 'Page 3')))
      .toContain('it says Page 3');
  });

  it('the reading affirm echoes the word and completes its sentence', () => {
    expect(affirmLine(itemCue(WORD))).toBe('Yes, frog! The green frog can hop by the pond.');
  });

  it('tap-to-hear re-speaks the QUESTION, never an answer', () => {
    expect(spokenLine(pronounceCue(WORD))).toContain('Listen: The green — hmm.');
    expect(spokenLine(pronounceCue(WORD)).toLowerCase()).not.toMatch(/\bfrog\b/);
    expect(spokenLine(pronounceCue(TITLE)).toLowerCase()).not.toContain('pond neighbors');
    expect(pronounceCue(WORD)).toContain('never say the answer');
  });

  it('pushes only the answer-free question side through the context channel', () => {
    expect(stimulusFor(TITLE).toLowerCase()).not.toContain('pond neighbors');
    expect(stimulusFor(TITLE)).toContain('title');
    expect(stimulusFor(WORD).toLowerCase()).not.toMatch(/\bfrog\b/);
  });
});

// ── 3. Build gates DROP, never repair ───────────────────────────────────────

describe('interactive-book pack · build gates', () => {
  it('drops a one-word lead — a headless cloze gives the child no context to hold', () => {
    expect(MIN_LEAD_WORDS).toBe(2);
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'The' })).toBeNull();
  });

  it('drops a verdict-shaped focus word — the child\'s answer would sound like a judgment', () => {
    for (const word of ['yes', 'no', 'Yes']) {
      expect(itemFromChallenge({ ...WORD_RAW, targetText: word })).toBeNull();
    }
  });

  it('drops model babble in the one field that cannot be enum-locked', () => {
    expect(itemFromChallenge({
      ...WORD_RAW,
      targetText: 'frog-is-fine-wait-frog-use-frog',
    })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, targetText: 'two words' })).toBeNull();
  });

  it('drops a lead the tutor cannot say in one breath, or that would break the spoken span', () => {
    expect(itemFromChallenge({
      ...WORD_RAW,
      readLead: `The very ${'green and slippery '.repeat(6)}little`,
    })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'The "green"' })).toBeNull();
  });

  it('drops an item whose word leaks into its own lead or tail — print-exactly-once, re-checked at the seam', () => {
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'The frog sees the' })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, readTail: 'and the frog hops.' })).toBeNull();
  });

  it('drops a sentinel-opening lead — the tutor would speak a verdict she never gave', () => {
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'Yes the green' })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'My turn to' })).toBeNull();
  });

  it('drops a find page whose candidates blur the question', () => {
    // Target absent, target duplicated, duplicate candidates, single candidate:
    // each is one question without exactly one right answer.
    expect(itemFromChallenge({ ...CAPTION_RAW, optionTexts: ['Safe Nests', 'Page 2'] })).toBeNull();
    expect(itemFromChallenge({ ...CAPTION_RAW, optionTexts: ['Nest Above', 'Nest Above', 'Page 2'] })).toBeNull();
    expect(itemFromChallenge({ ...CAPTION_RAW, optionTexts: ['Nest Above'] })).toBeNull();
  });

  it('drops an unknown feature — `focus-word` is the read mode\'s material, never a find target', () => {
    expect(itemFromChallenge({ ...CAPTION_RAW, targetFeature: 'focus-word' })).toBeNull();
  });

  it('runs the whole session through the gate and keeps only askable items', () => {
    const kept = itemsFromChallenges([
      WORD_RAW,
      { ...WORD2_RAW, id: 'bad-1', readLead: 'The' },
      CAPTION_RAW,
    ]);
    expect(kept.map((item) => item.id)).toEqual(['ib-w1', 'ib-f2']);
    expect(challengeAskable(WORD_RAW)).toBe(true);
    expect(challengeAskable({ ...WORD_RAW, readLead: 'The' })).toBe(false);
  });
});

// ── 4. Corrections earn their re-model (standing gate 3) ───────────────────

describe('interactive-book pack · corrections', () => {
  it('the reading correction NAMES the word — model-lead-test, with print in front of the child', () => {
    const line = correctionLine(itemCue(WORD));
    expect(line).toContain('My turn: that word is frog.');
    expect(line).toContain('The green frog can hop by the pond.');
    expect(line).toContain('Your turn. Read the glowing word.');
  });

  it('the reading contract names the SIGNATURE error — the fluent context guess', () => {
    const cue = itemCue(WORD);
    expect(cue).toContain('A different word that would fit the sentence is WRONG');
    expect(cue).toContain('guessing from the story instead of reading the print');
    expect(cue).toContain('A word that means nearly the same thing is wrong too');
  });

  it('the reading contract ACCEPTS the phrase form and slow sounding-out', () => {
    const cue = itemCue(WORD);
    expect(cue).toContain('said inside a short phrase');
    expect(cue).toContain('judge what they land on, never speed');
  });

  it('code-computes every find verdict against the printed match key', () => {
    expect(tapVerdictCue(TITLE, 'Pond Neighbors')).toContain('MATCHES');
    expect(tapVerdictCue(TITLE, 'Mia Lee')).toContain('does NOT match');
  });

  it('both move-on close lines name the answer — a capped item never ends with the link unmade', () => {
    expect(spokenLine(moveOnCue(WORD, null, {}))).toContain('That glowing word is frog.');
    expect(spokenLine(moveOnCue(CAPTION, null, {}))).toContain('The picture caption here says Nest Above.');
    expect(moveOnCue(WORD, null, {})).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });

  it('a move-on into the OTHER direction re-teaches the game and carries the right contract', () => {
    const cue = moveOnCue(PAGE_NUMBER, WORD, { howToPlay: true });
    expect(spokenLine(cue)).toContain('I read our book out loud');
    expect(cue).toContain('The correct answer is the word "frog"');
    expect(cue).not.toContain('Do not judge anything you hear');
  });
});

// ── 5. Session frame ────────────────────────────────────────────────────────

describe('interactive-book pack · session frame', () => {
  it('the opening cue has ONE job: greeting + how-to-play + ask in the quoted line', () => {
    const opening = spokenLine(itemCue(TITLE, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time to open our book!');
    expect(opening).toContain('you find it on the page and tap it');
    expect(opening).toContain('Find the title.');
  });

  it('the sentence is completed exactly as print joins it', () => {
    expect(fullSentenceOf(WORD)).toBe('The green frog can hop by the pond.');
    expect(fullSentenceOf(WORD2)).toBe('The green frog can hop by the pond.');
    expect(fullSentenceOf({ ...WORD, readTail: '' })).toBe('The green frog.');
  });

  it('no spoken sentence anywhere opens with a verdict sentinel', () => {
    expect(findSentinelCollisions([
      { label: 'opening', text: itemCue(TITLE, { opening: true, howToPlay: true }) },
      { label: 'word', text: itemCue(WORD, { howToPlay: true }) },
      { label: 'tap-hit', text: tapVerdictCue(TITLE, 'Pond Neighbors') },
      { label: 'tap-miss', text: tapVerdictCue(TITLE, 'Mia Lee') },
      { label: 'move', text: moveOnCue(WORD, CAPTION, { howToPlay: true }) },
      { label: 'hear', text: pronounceCue(WORD) },
      { label: 'complete', text: completeCue() },
    ])).toEqual([]);
  });

  it('hands the harness honest answer material, wrong answers included', () => {
    const wordAnswers = interactiveBookHarnessAnswers(WORD);
    expect(wordAnswers.correct).toBe('frog');
    expect(wordAnswers.plainWrong).not.toBe('frog');
    // The signature wrong is the machine-checkable claim the contract makes:
    // the lead-in said back is fluent, confident, and not an answer.
    expect(wordAnswers.signatureWrong?.text).toBe('The green');
    expect(wordAnswers.leakTokens).toEqual(['frog']);

    const tapAnswers = interactiveBookHarnessAnswers(TITLE, 'Mia Lee');
    expect(tapAnswers.tapped).toEqual({ correct: 'Pond Neighbors', wrong: 'Mia Lee' });
    expect(tapAnswers.leakTokens).toEqual(['pond neighbors']);
  });
});

// ── 6. The catalog keeps its side of the contract ───────────────────────────

describe('interactive-book catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'interactive-book')!;

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, WORD)).toEqual([]);
    expect(checkDiCatalogEntry(entry, pack, TITLE)).toEqual([]);
  });

  it('every rung of the scaffolding ladder routes through the scripted correction (18d)', () => {
    // This port SHIPPED (2026-08-14) carrying level1/level2 as "Say the question
    // once more, then wait for them alone." / "Say the question again slowly and
    // clearly, then wait." — a re-spoken ask opens with NEITHER sentinel, so the
    // reducer records no verdict, the correction counter freezes, and the child
    // waits on a tutor that has already spoken.
    //
    // It survived because level3 was always correct, so a per-ENTRY grep for
    // "scripted correction" reported the entry clean, and because the 19h-i-b
    // handoff censused only the ports still UNPORTED — this one had already
    // shipped. Found by the per-RUNG census during port 4. Gate it per rung.
    const rungs = Object.values(entry.tutoring!.scaffoldingLevels!);
    expect(rungs).toHaveLength(3);
    for (const rung of rungs) {
      expect(rung.toLowerCase()).toContain('scripted correction line');
      expect(rung.toLowerCase()).not.toMatch(/say the (question|instruction) (once more|again)/);
    }
  });

  it('carries no directive for a deleted channel', () => {
    const prose = [
      entry.description ?? '',
      entry.constraints ?? '',
      entry.tutoring?.taskDescription ?? '',
      ...(entry.tutoring?.commonStruggles ?? []).map((s) => `${s.pattern} ${s.response}`),
      ...(entry.tutoring?.aiDirectives ?? []).map((d) => `${d.title} ${d.instruction}`),
    ].join('\n');
    for (const tag of [
      '[ACTIVITY_START]', '[FOCUS_WORD_READY]', '[FOCUS_WORD_RETRY]',
      '[FOCUS_WORD_CONFIRMED]', '[CHALLENGE_INCORRECT]', '[HINT_REQUESTED]',
      '[FIRST_VOICE_SUCCESS]', '[ALL_COMPLETE]',
    ]) {
      expect(prose).not.toContain(tag);
    }
    // The push-to-talk era's mic prose and the tap fallback are gone with it.
    expect(prose.toLowerCase()).not.toContain('push-to-talk');
    expect(prose.toLowerCase()).not.toContain('tap path');
  });

  it('keeps every eval mode identity and β through the port', () => {
    // find-feature's task identity is unchanged (locate a printed part on the
    // page); read-focus-word was already priced as spoken production — the
    // deleted tap escape only ever earned partial credit, so no β moves.
    expect(entry.evalModes?.map((m) => m.evalMode)).toEqual(['find-feature', 'read-focus-word']);
    expect(entry.evalModes?.map((m) => m.beta)).toEqual([1.5, 2.5]);
  });

  it('steers the manifest to the mic and away from supplying book content', () => {
    expect(entry.description).toContain('microphone');
    expect(entry.constraints).toContain('The manifest must not provide book text');
  });
});
