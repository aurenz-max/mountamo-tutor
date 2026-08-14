/**
 * letterSpotterScript — the pedagogy lives here, so this is where it is pinned.
 * Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (validateJudgedScriptPack:
 *     benched response classes, sentinel discipline over every cue, cue
 *     builders that don't throw).
 *  2. THE SPLIT: name-it is SPOKEN (user ruling 2026-08-13 — "they dont need to
 *     click a button"), find-it and match-it TAP because their answers are a
 *     position and a letterform, neither of which has a spoken shape. Moving a
 *     mode the OTHER way — from voice back to a menu of tiles — is the
 *     regression this locks out: the tiles turned production into 1-in-4
 *     recognition and are why the mode was a tap at all.
 *  3. THE THREE REVEAL POLICIES, which differ because the ANSWER differs:
 *     name-it never names the letter (it is the answer) but does say the word
 *     (it is the stimulus); find-it names the letter (stimulus) but never its
 *     position (answer); match-it names nothing before a verdict.
 *  4. NO SHAPE DESCRIPTIONS, at any tier, in any cue. The click-era tutor
 *     volunteered one per item and it was the live session's largest leak.
 *  5. Build gates DROP unaskable items rather than repairing them into one: a
 *     word that doesn't lead with the target hides the wrong letter, a word
 *     appearing twice leaves the answer spelled out, and a find-it grid needs
 *     exactly one target because one tap is one commit.
 *  6. Corrections re-model then re-elicit, and a retry never hands over the
 *     answer it is retrying for.
 *  7. The catalog keeps its side of the contract: template keys resolve against
 *     exactly what the pack pushes, no sentence opens with a verdict sentinel,
 *     and no directive survives for a deleted channel.
 */
import { describe, it, expect } from 'vitest';
import {
  answerKindFor,
  completeCue,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  pronounceCue,
  responseClassFor,
  stimulusFor,
  tapVerdictCue,
  SPOTTER_EMOJI,
  type LetterSpotterItem,
  type LetterSpotterTier,
} from '../letterSpotterScript';
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

// ── Fixtures — one per direction, session-shaped ────────────────────────────

const SPOT_RAW = {
  id: 'lsp-1',
  mode: 'name-it' as const,
  targetLetter: 'a',
  targetWord: 'ant',
  spokenSentence: 'I see an ant walk away.',
  sentence: `I see an ${SPOTTER_EMOJI}nt walk away.`,
  options: ['a', 's', 't', 'n'],
};

/** find-it targets a STOP on purpose: the tutor names the letter here, so no
 *  continuant gate applies — the child never produces a sound. */
const FIND_RAW = {
  id: 'lsp-2',
  mode: 'find-it' as const,
  targetLetter: 'p',
  letterGrid: [
    'S', 'A', 'T', 'I',
    'N', 'P', 'S', 'A',
    'T', 'I', 'N', 'S',
    'A', 'T', 'I', 'N',
  ],
};

const MATCH_RAW = {
  id: 'lsp-3',
  mode: 'match-it' as const,
  targetLetter: 's',
  options: ['s', 'a', 'n', 't'],
};

const build = (
  ch: Parameters<typeof itemFromChallenge>[0],
  tier: LetterSpotterTier = 'medium',
) => itemFromChallenge(ch, tier)!;

/** A second name-it fixture whose letter does not collide with an English
 *  article, so "the ask never names the letter" can be asserted directly. */
const SPOT_N_RAW = {
  id: 'lsp-4',
  mode: 'name-it' as const,
  targetLetter: 'n',
  targetWord: 'net',
  spokenSentence: 'I can see the net.',
  sentence: `I can see the ${SPOTTER_EMOJI}et.`,
  options: ['n', 's', 'a', 't'],
};

const SPOT = build(SPOT_RAW);
const SPOT_N = build(SPOT_N_RAW);
const FIND = build(FIND_RAW);
const MATCH = build(MATCH_RAW);

const ITEMS: LetterSpotterItem[] = [SPOT, FIND, MATCH];

/** The pack exactly as the component assembles it. */
const pack: JudgedScriptPack<LetterSpotterItem> = {
  primitiveType: 'letter-spotter',
  activityLine: 'live direct instruction letter spotting practice',
  items: ITEMS,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({ challengeType: item.mode, stimulus: stimulusFor(item) }),
};

/** The line the tutor actually SPEAKS — the shared parser, which is anchored on
 *  every hand-over phrasing the family ships: `tapVerdictCue` quotes the tapped
 *  letter BEFORE its line, so a bare first-quote match would read the wrong
 *  span, and `pronounceCue` hands its line over with "then wait:". Everything
 *  else in a cue is judge-side instruction, and scanning that for leaks flags
 *  the contract FORBIDDING them. */
const spokenLine = spokenSpanOf;

/** The two lines a SPOKEN mode's judging contract hands over — the affirm and
 *  the correction both ride inside the item cue, since a voice answer is judged
 *  in-band and there is no second round-trip to carry them. */
const affirmLine = (cue: string): string =>
  cue.match(/If the answer is right, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';
const correctionLine = (cue: string): string =>
  cue.match(/If it is wrong, say exactly:\s*"([\s\S]*?)"/)?.[1] ?? '';

/** Every line the tutor can SPEAK for one item, across its whole life. Both
 *  answer surfaces are covered: a gesture item's verdict lines come back
 *  through `tapVerdictCue`, a spoken item's are embedded in its own cue. */
const everySpokenLine = (item: LetterSpotterItem): string =>
  [
    spokenLine(itemCue(item, { opening: true, howToPlay: true })),
    spokenLine(itemCue(item, { howToPlay: true })),
    affirmLine(itemCue(item)),
    correctionLine(itemCue(item)),
    spokenLine(tapVerdictCue(item, 'z')),
    spokenLine(tapVerdictCue(item, item.targetLetter)),
    spokenLine(moveOnCue(item, null, {})),
    spokenLine(pronounceCue(item)),
  ].join('\n');

/**
 * Does this text NAME a letter — i.e. say it the way a tutor says a letter
 * name, as an isolated token?
 *
 * Written as a helper rather than inlined because the naive `\b[Aa]\b` scan is
 * wrong for exactly one letter and it is the one the fixtures use most: the
 * English article "a" collides with the letter `a` in every sentence. The
 * reveal-policy tests below therefore probe with a non-colliding target too.
 */
const namesLetter = (text: string, letter: string): boolean =>
  new RegExp(`\\b${letter.toUpperCase()}\\b`).test(text)
  || new RegExp(`\\bletter ${letter}\\b`, 'i').test(text);

const TIERS: LetterSpotterTier[] = ['easy', 'medium', 'hard'];

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('letter-spotter pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask —
    // this pack's own match-it defect, ~14s of identical speech per round).
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('two match-it items in a row do not re-recite the frame — the port-11 defect', () => {
    // The pack above is one item per mode, which is the ONE shape that cannot
    // trigger the repeat gate: it compares consecutive items of the same
    // action. A real session runs several match-it items in a row, and match-it
    // is the mode with nothing sayable to vary — so this is where the defect
    // lived and where `askFor(item, repeat)` has to hold.
    const twice = [
      build({ ...MATCH_RAW, id: 'm1' }),
      build({ ...MATCH_RAW, id: 'm2', targetLetter: 'a', options: ['a', 's', 'n', 't'] }),
    ];
    expect(checkPackGates({ ...pack, items: twice })).toEqual([]);
  });

  it('easy tier KEEPS the full frame on a repeat, and the gate says so out loud', () => {
    // A deliberate exception, made on the same drive: for the tier that needs
    // the most support, hearing the frame again IS the support. It is pinned as
    // a NAMED finding rather than hidden, so the next author sees both the
    // choice and its cost (16 words re-spoken) instead of an unexplained pass.
    const twice = [
      build({ ...MATCH_RAW, id: 'm1' }, 'easy'),
      build({ ...MATCH_RAW, id: 'm2', targetLetter: 'a', options: ['a', 's', 'n', 't'] }, 'easy'),
    ];
    expect(checkPackGates({ ...pack, items: twice })).toEqual([
      expect.stringContaining('consecutive asks recite a byte-identical'),
    ]);
  });

  it('SAYS the letter in name-it, taps the two modes whose answers are unsayable', () => {
    // The 2026-08-13 ruling. A mode keeps its hands only when the answer has no
    // spoken form: find-it's answer is WHERE the letter is, match-it's is which
    // lowercase FORM matches (saying "S" would not demonstrate it).
    expect(answerKindFor('name-it')).toBe('voice');
    expect(responseClassFor('name-it')).toBe('letter_name');
    for (const mode of ['find-it', 'match-it'] as const) {
      expect(answerKindFor(mode)).toBe('gesture');
      expect(responseClassFor(mode)).toBe('manipulation');
    }
  });

  it('builds name-it with NO options — a menu would make it recognition', () => {
    // The tiles are the regression to guard: they floor a guess at 25% and turn
    // "say the letter" into "pick one of four". A stale cached challenge still
    // carrying `options` must not put them back on screen.
    const item = itemFromChallenge({ ...SPOT_RAW, options: ['a', 'm', 't', 's'] });
    expect(item?.options).toEqual([]);
  });

  it('still builds name-it when the generator sends no options at all', () => {
    const { options: _dropped, ...noOptions } = { ...SPOT_RAW, options: undefined };
    expect(itemFromChallenge(noOptions)).not.toBeNull();
  });

  it('stamps action per item so mixed sessions re-speak the how-to-play on change', () => {
    for (const item of ITEMS) expect(item.action).toBe(item.mode);
  });
});

// ── 2. The three reveal policies ────────────────────────────────────────────

describe('letter-spotter pack · reveal policy', () => {
  it('name-it says the WORD (stimulus) and never the letter (answer)', () => {
    for (const tier of TIERS) {
      // Probed on a target whose letter does not collide with an article, so
      // "never names the letter" is a real assertion rather than a regex fight.
      const line = spokenLine(itemCue(build(SPOT_N_RAW, tier), { howToPlay: true }));
      expect(line).toContain('net');
      expect(namesLetter(line, 'n')).toBe(false);
      // The `a` fixture still has to say its word at every tier.
      expect(spokenLine(itemCue(build(SPOT_RAW, tier), { howToPlay: true }))).toContain('ant');
    }
  });

  it('find-it names the LETTER (stimulus) and never where it is (answer)', () => {
    const cue = itemCue(FIND);
    expect(spokenLine(cue)).toContain('letter P');
    expect(cue).toContain('Never say where the letter is');
    // "look at one row at a time" is a SEARCH STRATEGY and stays; what may
    // never appear is the target's own position.
    for (const forbidden of ['second row', 'top left', 'corner', 'next to', 'third box']) {
      expect(everySpokenLine(FIND).toLowerCase()).not.toContain(forbidden);
    }
  });

  it('match-it names NEITHER case before a verdict', () => {
    for (const tier of TIERS) {
      const line = spokenLine(itemCue(build(MATCH_RAW, tier), { howToPlay: true }));
      expect(namesLetter(line, 's')).toBe(false);
    }
  });

  it('never describes what a letter LOOKS like, at any tier, in any spoken line', () => {
    // The click-era tutor did this on EVERY item ("a triangle with a line
    // across the middle", "a straight line with a little dot on top") because
    // Group 1's newLetters is the whole group. Shape IS the answer here.
    // Scanned over SPOKEN lines only: the judge-side contract mentions shape
    // precisely to forbid it, and flagging that would be scanning the lock.
    const SHAPE_WORDS = [
      'curvy', 'curve', 'snake', 'triangle', 'circle', 'stick', 'line across',
      'dot on top', 'crossbar', 'hump', 'tail', 'looks like', 'shaped like',
    ];
    for (const tier of TIERS) {
      for (const raw of [SPOT_RAW, SPOT_N_RAW, FIND_RAW, MATCH_RAW]) {
        const spoken = everySpokenLine(build(raw, tier)).toLowerCase();
        for (const word of SHAPE_WORDS) expect(spoken).not.toContain(word);
      }
    }
  });

  it('pushes only the answer-free question side through the context channel', () => {
    // name-it and match-it push NO letter: it is the answer in both.
    expect(namesLetter(stimulusFor(SPOT), 'a')).toBe(false);
    expect(stimulusFor(SPOT)).not.toContain('ant');
    expect(namesLetter(stimulusFor(MATCH), 's')).toBe(false);
    // find-it pushes it: there the letter is the question.
    expect(stimulusFor(FIND)).toContain('letter P');
  });

  it('re-speaks the QUESTION on tap-to-hear, never the answer', () => {
    // This channel is the direct fix for the live defect that made the
    // click-era item unanswerable: the sentence lived only in a tutor turn
    // running up to 16s behind the screen, with no way to hear it again.
    expect(spokenLine(pronounceCue(SPOT))).toContain('I see an ant walk away.');
    expect(namesLetter(spokenLine(pronounceCue(SPOT_N)), 'n')).toBe(false);
    expect(namesLetter(spokenLine(pronounceCue(MATCH)), 's')).toBe(false);
    expect(spokenLine(pronounceCue(FIND))).toContain('letter P');
  });
});

// ── 3. Build gates DROP, never repair ───────────────────────────────────────

describe('letter-spotter pack · build gates', () => {
  it('drops a name-it word that does not lead with the target letter', () => {
    // The marker hides the word's FIRST character, so 'fox' for 'x' hides the
    // wrong letter while the answer key still says x — unsolvable, and a real
    // live find.
    expect(itemFromChallenge({
      ...SPOT_RAW, targetLetter: 'x', options: ['x', 's', 'a', 't'],
    })).toBeNull();
  });

  it('drops model babble in the one field that cannot be enum-locked', () => {
    // LIVE FIND (probe, 2026-08-13): flash-lite returned targetWord as 400
    // characters of its own deliberation on four of eight drawn items. Every
    // SEMANTIC gate passed it — the string starts with the target letter and
    // occurs exactly once in a sentence built from it — so the tutor would have
    // read babble aloud. A field with no enum needs a SHAPE gate too.
    const babble = 'sheep-invalid-word-fix-start-with-s-no-dash-sheep-is-fine-wait-sheep';
    expect(itemFromChallenge({
      ...SPOT_RAW,
      targetLetter: 's',
      targetWord: babble,
      spokenSentence: `I can see the ${babble}.`,
      sentence: `I can see the ${SPOTTER_EMOJI}${babble.slice(1)}.`,
      options: ['s', 'a', 't', 'n'],
    })).toBeNull();

    // Underscored deliberation is the same defect wearing a different separator.
    expect(itemFromChallenge({
      ...SPOT_RAW, targetWord: 'ant',
      spokenSentence: 'I can see the ant_is_a_farm_word_yes_ant_is_fine_use_ant.',
    })).toBeNull();

    // A sentence too long to say in one breath goes the same way.
    expect(itemFromChallenge({
      ...SPOT_RAW,
      spokenSentence: `I see an ant ${'walking slowly around the barn '.repeat(5)}.`,
    })).toBeNull();
  });

  it('drops a name-it sentence holding the word twice (the answer stays spelled out)', () => {
    expect(itemFromChallenge({
      ...SPOT_RAW,
      spokenSentence: 'I see an ant and another ant.',
    })).toBeNull();
  });

  it('drops a name-it item whose word or sentence opens with a verdict sentinel', () => {
    expect(itemFromChallenge({
      ...SPOT_RAW, spokenSentence: 'Yes, I see an ant walk away.',
    })).toBeNull();
  });

  it('drops a find-it grid unless it holds EXACTLY one target', () => {
    const twice = [...FIND_RAW.letterGrid];
    twice[0] = 'P';
    expect(itemFromChallenge({ ...FIND_RAW, letterGrid: twice })).toBeNull();

    const none = FIND_RAW.letterGrid.map((c) => (c === 'P' ? 'S' : c));
    expect(itemFromChallenge({ ...FIND_RAW, letterGrid: none })).toBeNull();

    // One tap is one commit: two targets is one question with two right
    // answers, and the tutor's single verdict advances past both.
    expect(itemFromChallenge(FIND_RAW)).not.toBeNull();
  });

  it('drops an option item missing its answer or its distractors', () => {
    expect(itemFromChallenge({ ...MATCH_RAW, options: ['a', 'n', 't'] })).toBeNull();
    expect(itemFromChallenge({ ...MATCH_RAW, options: ['s'] })).toBeNull();
  });

  it('runs the whole session through the gate and keeps only askable items', () => {
    const kept = itemsFromChallenges([
      SPOT_RAW,
      { ...FIND_RAW, id: 'bad-1', letterGrid: [] },
      MATCH_RAW,
    ]);
    expect(kept.map((i) => i.id)).toEqual(['lsp-1', 'lsp-3']);
  });
});

// ── 4. Corrections earn the answer ──────────────────────────────────────────

describe('letter-spotter pack · corrections', () => {
  it('a name-it retry re-models the ROUTE and never names the letter', () => {
    // Spoken mode: the correction is handed to the tutor inside the item cue's
    // judging contract, not through tapVerdictCue.
    const line = correctionLine(itemCue(SPOT));
    expect(line).toContain('My turn:');
    expect(line).toContain('Aaa');                       // the held first sound
    expect(line).toContain('Say the letter that ant starts with');
    // A retry that gives the answer away is free, not a retry (hear-see's rule).
    // Sharper now the tiles are gone: with no menu on screen, a correction that
    // named the letter would be the ONLY place the answer could leak.
    expect(line.replace(/\bant\b/gi, '').replace(/Aaa/g, '')).not.toMatch(/\b[Aa]\b/);
  });

  it('the name-it contract names the SIGNATURE error — the word said back', () => {
    // The fluent wrong answer: a child who repeats "ant" has produced none of
    // the answer, and it is the one a loosely-listening judge affirms.
    const cue = itemCue(SPOT);
    expect(cue).toContain('Saying the WORD "ant" back is NOT an answer');
    expect(cue).toContain('Any other letter is wrong');
  });

  it('the name-it contract ACCEPTS the letter’s sound as well as its name', () => {
    // The `letter_name` build-ahead ruling made operational: a five-year-old
    // answers "A" or a held /aaa/, and a cluster mishear has to beat both.
    expect(itemCue(SPOT)).toContain('aaa counts exactly as much as "A"');
  });

  it('a name-it retry on a STOP degrades to word-emphasis, never a raw glyph', () => {
    // Our benched table spells continuants and short vowels only; an unmapped
    // glyph read aloud is the failure phonemeVoice exists to prevent.
    const stop = build({
      ...SPOT_RAW, id: 'lsp-t', targetLetter: 't', targetWord: 'top',
      spokenSentence: 'I see a top spin around.',
      sentence: `I see a ${SPOTTER_EMOJI}op spin around.`,
      options: ['t', 's', 'a', 'n'],
    });
    const line = spokenLine(tapVerdictCue(stop, 's'));
    expect(line).toContain('Listen right at the front of that word');
    expect(line).not.toContain('/t/');
  });

  it('a find-it retry re-says the letter (stimulus) and re-elicits', () => {
    const line = spokenLine(tapVerdictCue(FIND, 's'));
    expect(line).toContain('My turn: the letter we want is P.');
    expect(line).toContain('tap the letter P');
  });

  it('a match-it retry NAMES both cases — that pairing is the teaching move', () => {
    const line = spokenLine(tapVerdictCue(MATCH, 'a'));
    expect(line).toContain('big S and little s are the same letter');
    expect(line).toContain('Your turn.');
  });

  it('code-computes every verdict and affirms with the canonical line', () => {
    expect(tapVerdictCue(SPOT, 'a')).toContain('MATCHES');
    expect(spokenLine(tapVerdictCue(SPOT, 'a'))).toBe('Yes, ant starts with A.');
    expect(spokenLine(tapVerdictCue(FIND, 'p'))).toBe('Yes, that is the letter P.');
    expect(spokenLine(tapVerdictCue(MATCH, 's'))).toBe('Yes, big S and little s go together.');
  });

  it('name-it closes the link at the cap; the others already modelled theirs', () => {
    expect(spokenLine(moveOnCue(SPOT, null, {}))).toContain('The word ant starts with A.');
    expect(spokenLine(moveOnCue(MATCH, null, {}))).not.toContain('little s');
  });
});

// ── 5. The tier ladder is the DISTAR sequence ───────────────────────────────

describe('letter-spotter pack · support tier', () => {
  // Measured on the INTRODUCTION turn, which is the only place a lead-in is
  // spoken (see the repetition describe below).
  const line = (tier: LetterSpotterTier) =>
    spokenLine(itemCue(build(SPOT_RAW, tier), { howToPlay: true }));

  it('easy hands over model + guide, medium the model only, hard nothing', () => {
    expect(line('easy')).toContain('Listen for the sound at the very start of the word.');
    expect(line('easy')).toContain('I will say the word on its own after the sentence.');
    expect(line('medium')).toContain('Listen for the sound at the very start of the word.');
    expect(line('medium')).not.toContain('I will say the word on its own');
    expect(line('hard')).not.toContain('Listen for the sound at the very start');
  });

  it('easy keeps the promise its guide line makes', () => {
    expect(line('easy')).toContain('The word is ant.');
    expect(line('hard')).not.toContain('The word is ant.');
  });

  it('the lead-in is spoken ONCE per action, never on every item', () => {
    // Live drive de8a6a78d9db: six consecutive match-it items each opened with
    // the same model line, and because match-it's ask names nothing that varies
    // the whole utterance was byte-identical six times — ~14s of speech against
    // a ~13s answer. The lead-in belongs to the INTRODUCTION of an action.
    for (const tier of TIERS) {
      const repeat = spokenLine(itemCue(build(SPOT_RAW, tier)));
      expect(repeat).not.toContain('Listen for the sound at the very start');
      expect(repeat).not.toContain('I will say the word on its own');
      // The QUESTION is never withdrawn with it.
      expect(repeat).toContain('I see an ant walk away.');
    }
  });

  it('match-it — the one mode with nothing to vary — shortens on repeats', () => {
    const intro = (tier: LetterSpotterTier) =>
      spokenLine(itemCue(build(MATCH_RAW, tier), { howToPlay: true }));
    const again = (tier: LetterSpotterTier) => spokenLine(itemCue(build(MATCH_RAW, tier)));

    // Two consecutive items must not be the same utterance.
    expect(again('medium')).not.toBe(intro('medium'));
    expect(again('medium')).toBe('Your turn. Tap the little letter that is the same.');
    // easy keeps the full frame — for the tier that needs the most support,
    // hearing it again IS the support, and it is this mode's last per-item lever.
    expect(again('easy')).toContain('Look at the big letter.');
    // The action is still stated at every tier: a pre-reader cannot read the
    // screen, so an ask that says nothing is a broken ask, not a terser one.
    for (const tier of TIERS) expect(again(tier)).toContain('Tap the little letter');
  });

  it('the opening states its one instruction ONCE', () => {
    // The how-to-play used to end "Tap the little one that is the same letter!"
    // and the ask repeated the same imperative a sentence later.
    const opening = spokenLine(itemCue(MATCH, { opening: true, howToPlay: true }));
    expect(opening.match(/Tap the little/g) ?? []).toHaveLength(1);
  });

  it('never withdraws the question itself — the sentence is read at every tier', () => {
    for (const tier of TIERS) expect(line(tier)).toContain('I see an ant walk away.');
  });

  it('never withdraws the correction re-model (standing gate 3)', () => {
    for (const tier of TIERS) {
      expect(spokenLine(tapVerdictCue(build(SPOT_RAW, tier), 't'))).toContain('My turn:');
    }
  });
});

// ── 6. Session frame ────────────────────────────────────────────────────────

describe('letter-spotter pack · session frame', () => {
  it('the opening cue has ONE job: greeting + how-to-play + ask in the quoted line', () => {
    const opening = spokenLine(itemCue(SPOT, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time to go letter spotting!');
    expect(opening).toContain('is hiding the first letter of a word');
    expect(opening).toContain('Say the letter that ant starts with.');
    // The how-to-play must ask for the same thing the ask does. It told the
    // child to "tap the letter it is hiding" for a whole port while the answer
    // was a menu; a stale verb here re-opens exactly that gap.
    expect(opening).toContain('you tell me the letter it is hiding');
    expect(opening.toLowerCase()).not.toContain('tap');
  });

  it('every cue carries the contract its ANSWER KIND needs', () => {
    // The split made structural. A tap item asks the tutor for silence; a
    // spoken item hands it the target, the accept clause and the two verdict
    // lines. Getting these crossed is the defect the 2026-08-13 drive found —
    // a tap contract on a mode the child answers out loud.
    for (const item of ITEMS) {
      const cue = itemCue(item);
      // BOTH contracts state the wait as a FACT about the turn. The imperative
      // form ("Then WAIT silently…") is what the model performed as
      // "[WAIT silently]" and as a fabricated `[LSP_TAP]` — checkPackGates
      // above now refuses it, and this pins which contract each kind gets.
      expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
      if (item.answerKind === 'gesture') {
        expect(cue).toContain('the learner answers by TAPPING, not by speaking');
        expect(cue).toContain('Do not judge anything you hear through the microphone');
        expect(cue).not.toContain('If the answer is right');
      } else {
        expect(cue).toContain('you then stay silent while the learner thinks');
        expect(cue).toContain('The correct answer is the letter');
        expect(affirmLine(cue)).not.toBe('');
        expect(correctionLine(cue)).not.toBe('');
        // A spoken mode must never be told to ignore the microphone.
        expect(cue).not.toContain('Do not judge anything you hear');
      }
    }
  });

  it('a generated sentence never OPENS a cue sentence', () => {
    // A model-authored line beginning "Yes, …" would be read as a verdict by
    // the engine's sentence scan. Every cue introduces the sentence instead.
    for (const item of ITEMS) {
      expect(itemCue(item)).toMatch(/Say exactly: "[^"]*"/);
    }
    expect(itemCue(SPOT)).toContain('Listen: I see an ant walk away.');
    expect(findSentinelCollisions([
      { label: 'itemCue', text: itemCue(SPOT, { opening: true, howToPlay: true }) },
      { label: 'tapVerdictCue-hit', text: tapVerdictCue(SPOT, 'a') },
      { label: 'tapVerdictCue-miss', text: tapVerdictCue(SPOT, 't') },
      { label: 'moveOnCue', text: moveOnCue(SPOT, FIND, { howToPlay: true }) },
      { label: 'pronounceCue', text: pronounceCue(SPOT) },
    ])).toEqual([]);
  });

  it('the final move-on and the complete cue both stop the tutor', () => {
    expect(moveOnCue(MATCH, null, {})).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });

  it('uses ONE mystery marker for every item', () => {
    // The click-era generator rotated ten emoji by index, so the SPOKEN prompt
    // changed every item: "the ⭐", "the 🌟", "the crystal ball", "the diamond",
    // "the target" — five names for one slot inside two minutes.
    expect(SPOTTER_EMOJI).toBe('⭐');
    expect(spokenLine(itemCue(SPOT, { howToPlay: true }))).toContain('A star is hiding');
  });
});

// ── 7. The catalog keeps its side of the contract ───────────────────────────

describe('letter-spotter catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'letter-spotter')!;

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, SPOT)).toEqual([]);
  });

  it('carries no directive for a deleted channel', () => {
    const prose = [
      entry.tutoring?.taskDescription ?? '',
      ...(entry.tutoring?.aiDirectives ?? []).map((d) => d.instruction),
    ].join('\n');
    for (const tag of [
      '[SENTENCE_SPOTTER]', '[SAY_LETTER_NAME]', '[FIND_LETTER]',
      '[NEW_LETTER_INTRO]', '[ACTIVITY_START]', '[NEXT_CHALLENGE]',
      '[ANSWER_CORRECT]', '[ANSWER_INCORRECT]', '[ALL_COMPLETE]',
    ]) {
      expect(prose).not.toContain(tag);
    }
    // The re-read order that made one item play 2-4 times is gone with them.
    expect(prose.toLowerCase()).not.toContain('re-read the sentence');
  });

  it('keeps every eval mode identity through the port', () => {
    expect(entry.evalModes?.map((m) => m.evalMode)).toEqual(['name_it', 'find_it', 'match_it']);
    // name_it 1.5 → 2.0 on the 2026-08-13 conversion: a 1-of-4 menu became
    // unaided spoken production, which is a STRUCTURAL change and the only
    // thing that licenses moving a β. The other two are untouched.
    expect(entry.evalModes?.map((m) => m.beta)).toEqual([2.0, 2.5, 3.5]);
  });
});
