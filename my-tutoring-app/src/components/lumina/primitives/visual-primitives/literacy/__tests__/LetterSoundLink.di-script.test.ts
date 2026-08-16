/**
 * letterSoundLinkScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (validateJudgedScriptPack:
 *     benched response classes, sentinel discipline over every cue, cue
 *     builders that don't throw).
 *  2. THE CONTINUANT GATE. `see-hear` asks a five-year-old to produce a sound
 *     alone, so it may only target sounds that can be HELD. Every stop,
 *     affricate, glide and cluster is refused — that is standing gate 1, and
 *     flipping it needs a bench sitting, not an edit.
 *  3. THE SPLIT: hear-see taps because `letter_name` is a BLOCKED class; the
 *     other two speak. Same rule, three different answers.
 *  4. ANSWER-LEAK, per mode and per tier: the keyword is never spoken before a
 *     verdict anywhere; the hear-see ask never names a letter; the
 *     keyword-match ask never says either picture word or the sound; and at
 *     `hard` the see-hear ask does not contain the sound at all.
 *  5. Corrections re-model then re-elicit, and they are the FIRST place the
 *     answer is spoken. A hear-see retry never names the letter — a retry that
 *     gives the answer away is free, not a retry.
 *  6. The tier ladder is the DISTAR sequence (model + guide / model / nothing),
 *     not on-card text a pre-reader could never read.
 *  7. The catalog entry keeps its side of the contract: template keys resolve
 *     against exactly what the pack pushes, and no catalog sentence opens with
 *     a verdict sentinel.
 */
import { describe, it, expect } from 'vitest';
import {
  anchorWordNamesItsPicture,
  answerKindFor,
  canProduceSound,
  completeCue,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  keywordNamesItsPicture,
  leakExemptSpanFor,
  letterSoundLinkHarnessAnswers,
  letterSoundLinkPackBase,
  LETTER_KEYWORDS,
  maxCorrectionsFor,
  moveOnCue,
  PRODUCIBLE_LETTERS,
  pronounceCue,
  responseClassFor,
  spokenSoundFor,
  stimulusFor,
  tapVerdictCue,
  type LetterSoundChallengeLike,
  type LetterSoundItem,
  type LetterSoundTier,
} from '../letterSoundLinkScript';
import {
  findSentinelCollisions,
  spokenSpanOf,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — one item per direction, session-shaped ───────────────────────

const build = (
  ch: LetterSoundChallengeLike,
  tier: LetterSoundTier = 'medium',
) => itemFromChallenge(ch, tier);

/** see-hear: the child SAYS the sound. No options at all. */
const SAY_SOUND_RAW = {
  id: 'lsl-1', mode: 'see-hear' as const,
  targetLetter: 's', targetSound: '/s/', keywordWord: 'sun',
};

/** hear-see: the tutor says the sound, the child TAPS a letter. Targets a STOP
 *  on purpose — this is the direction that covers them. */
const FIND_LETTER_RAW = {
  id: 'lsl-2', mode: 'hear-see' as const,
  targetLetter: 't', targetSound: '/t/', keywordWord: 'tent',
  options: [{ letter: 't', isCorrect: true }, { letter: 'd', isCorrect: false }],
};

/** keyword-match: the child SAYS the picture word. */
const SAY_WORD_RAW = {
  id: 'lsl-3', mode: 'keyword-match' as const,
  targetLetter: 'm', targetSound: '/m/', keywordWord: 'map',
  options: [{ sound: 'map', isCorrect: true }, { sound: 'net', isCorrect: false }],
};

const SAY_SOUND = build(SAY_SOUND_RAW);
const FIND_LETTER = build(FIND_LETTER_RAW);
const SAY_WORD = build(SAY_WORD_RAW);

const ITEMS: LetterSoundItem[] = [SAY_SOUND, FIND_LETTER, SAY_WORD];

/**
 * The pack EXACTLY as the component assembles it — the exported surface, not a
 * literal beside it. The suite carried a hand-rolled copy since birth, which is
 * the drift `JudgedCueSurface` exists to stop: a harness (or a test) that
 * re-types these cues tests a fiction.
 */
const pack = letterSoundLinkPackBase(ITEMS);

/** The line the tutor actually SPEAKS — the shared parser, so every port reads
 *  the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('letter-sound-link pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('two items in the SAME direction do not recite the ask twice', () => {
    // One item per direction is the ONE pack shape that cannot trigger the
    // repeat gate — it compares consecutive items of the same action, and a
    // real session runs several see-hear items in a row.
    const twice = [
      build({ ...SAY_SOUND_RAW, id: 'lsl-a' }),
      build({ ...SAY_SOUND_RAW, id: 'lsl-b', targetLetter: 'm', targetSound: '/m/', keywordWord: 'map' }),
    ];
    expect(checkPackGates({ ...pack, items: twice })).toEqual([]);
  });

  it('maps each direction to the ruled answer material and benched class', () => {
    // hear-see TAPS because naming a letter aloud is `letter_name`, a BLOCKED
    // class — this mapping is the ruling; changing it needs a bench, not an edit.
    expect(answerKindFor('hear-see')).toBe('gesture');
    expect(responseClassFor('hear-see')).toBe('manipulation');
    expect(answerKindFor('see-hear')).toBe('voice');
    expect(responseClassFor('see-hear')).toBe('continuant_sound');
    expect(answerKindFor('keyword-match')).toBe('voice');
    expect(responseClassFor('keyword-match')).toBe('short_spoken_word');
  });

  it('stamps action per item so mixed sessions re-speak the how-to-play on change', () => {
    for (const item of ITEMS) expect(item.action).toBe(item.mode);
  });

  it('a pack that targets a stop in see-hear is REFUSED by the gate, not judged', () => {
    // The generator retargets these; if one ever slipped through, the class
    // check is what stops a child being asked for an unbenched sound. `/t/` is
    // the sound this fixture would demand.
    expect(canProduceSound('t')).toBe(false);
  });
});

// ── 2. The continuant gate (standing gate 1, as content) ────────────────────

describe('letter-sound-link pack · the continuant gate', () => {
  it('admits exactly the held sounds and the short vowels', () => {
    expect([...PRODUCIBLE_LETTERS].sort()).toEqual(
      ['a', 'e', 'f', 'i', 'l', 'm', 'n', 'o', 'r', 's', 'u', 'v', 'z'].sort(),
    );
  });

  it('refuses every stop, affricate, glide and cluster', () => {
    for (const letter of ['t', 'p', 'c', 'k', 'd', 'g', 'b', 'j', 'w', 'y', 'h', 'x', 'qu']) {
      expect(canProduceSound(letter)).toBe(false);
    }
  });

  it('stretches held sounds for the voice and never hands it a bare glyph', () => {
    expect(spokenSoundFor('s', '/s/')).toBe('sss');
    expect(spokenSoundFor('m', '/m/')).toBe('mmm');
    // Short vowels: the generator writes breve notation, which no voice can read.
    expect(spokenSoundFor('a', '/ă/')).toBe('aaa');
    expect(spokenSoundFor('i', '/ĭ/')).toBe('iii');
    // Non-producible letters still need a SAYABLE stimulus for hear-see.
    expect(spokenSoundFor('t', '/t/')).toBe('/t/');
  });
});

// ── 3. Answer-leak, per mode and per tier ───────────────────────────────────

describe('letter-sound-link pack · answer-leak', () => {
  it('never speaks the keyword before a verdict, in any direction or tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as LetterSoundTier[]) {
      expect(spokenLine(itemCue(build({ ...SAY_SOUND_RAW }, tier)))).not.toContain('sun');
      expect(spokenLine(itemCue(build({ ...FIND_LETTER_RAW }, tier)))).not.toContain('tent');
      expect(spokenLine(itemCue(build({ ...SAY_WORD_RAW }, tier)))).not.toContain('map');
    }
  });

  it('the hear-see ask never names either letter (the grapheme IS the answer)', () => {
    const ask = spokenLine(itemCue(FIND_LETTER, { howToPlay: true }));
    expect(ask).toContain('/t/');            // the sound is the STIMULUS
    expect(ask).not.toMatch(/letter [TtDd]\b/);
  });

  it('the keyword-match ask says neither picture word nor the sound', () => {
    const ask = spokenLine(itemCue(SAY_WORD, {}));
    expect(ask).not.toContain('map');
    expect(ask).not.toContain('net');
    // At medium the model bridges with the sound; the WORDS never appear.
    expect(spokenLine(itemCue(build({ ...SAY_WORD_RAW }, 'hard')))).not.toContain('mmm');
  });

  it('at hard the see-hear ask contains no sound at all — a real retrieval probe', () => {
    const hard = build({ ...SAY_SOUND_RAW }, 'hard');
    expect(spokenLine(itemCue(hard))).not.toContain('sss');
    expect(itemCue(hard)).toContain('answering this one cold');
  });

  it('re-speaks the QUESTION on tap-to-hear, never the answer', () => {
    expect(pronounceCue(SAY_SOUND)).not.toContain('sss');
    expect(pronounceCue(SAY_SOUND)).not.toContain('sun');
    expect(pronounceCue(SAY_WORD)).not.toContain('map');
    expect(pronounceCue(SAY_WORD)).not.toContain('mmm');
    // hear-see's sound IS the question, so it is repeated in full.
    expect(pronounceCue(FIND_LETTER)).toContain('/t/');
  });

  it('pushes only the answer-free question side through the context channel', () => {
    // see-hear pushes NO letter: the letter determines the sound that IS the
    // answer (di-math-facts rule, picture-vocabulary's `naming` precedent).
    expect(stimulusFor(SAY_SOUND)).not.toMatch(/\bs\b/);
    expect(stimulusFor(FIND_LETTER)).toContain('/t/');
    expect(stimulusFor(SAY_WORD)).not.toContain('map');
  });
});

// ── 4. Corrections earn the answer ──────────────────────────────────────────

describe('letter-sound-link pack · corrections', () => {
  it('the see-hear correction re-models the sound then re-elicits', () => {
    const cue = itemCue(SAY_SOUND);
    expect(cue).toContain('My turn: this letter says sss.');
    expect(cue).toContain('Your turn. What sound does this letter make?');
  });

  it('keyword-match names BOTH misses — the other picture AND the sound said back', () => {
    // The live signature drive affirmed "tuh" and "puh" 2/2: the contract named
    // only the other picture's word, and its accept clause told the judge to be
    // generous about naming, so a schwa'd sound read as a mumbled "tent".
    // see-hear's rule is the opposite (a clipped try WITH an "uh" is correct
    // there), so nothing carried over.
    const stop = build({
      id: 'lsl-kw-t', mode: 'keyword-match', targetLetter: 't', targetSound: '/t/',
      keywordWord: 'tent',
      options: [{ sound: 'tent', isCorrect: true }, { sound: 'pig', isCorrect: false }],
    });
    const cue = itemCue(stop);
    expect(cue).toContain('The other picture\'s word — "pig" —');
    expect(cue).toContain('"tuh" is a sound, not the name of a picture');
    expect(cue).toContain('a sound with a little "uh" on the end is still a sound and still wrong here');
    // The drive says the same utterance the contract refuses — one builder.
    expect(letterSoundLinkHarnessAnswers(stop).signatureWrong?.text).toBe('tuh');
    // A held sound keeps its stretched rendering in both places.
    expect(itemCue(SAY_WORD)).toContain('"mmm" is a sound');
    // see-hear is untouched: an "uh" on the end is still correct there.
    expect(itemCue(SAY_SOUND)).toContain('so does a little "uh" on the end');
  });

  it('the keyword-match correction is the first place the word is spoken', () => {
    const cue = itemCue(SAY_WORD);
    expect(spokenLine(cue)).not.toContain('map');
    expect(cue).toContain('the word map starts with mmm');
    // Never at the head of a sentence — a keyword there could be read as a
    // verdict by the sentinel scan (the `yes`/`yo-yo` hazard).
    expect(cue).not.toMatch(/[.!?]\s+map\b/i);
  });

  it('a hear-see retry NEVER names the letter', () => {
    const miss = tapVerdictCue(FIND_LETTER, 'd');
    expect(miss).toContain('does NOT match');
    const line = spokenLine(miss);
    expect(line).toContain('/t/');                    // re-model the SOUND
    // With the sound removed, nothing naming either grapheme may remain — the
    // target rides in the instruction (judge's eyes) but never in the retry.
    expect(line.split('/t/').join('')).not.toMatch(/\b[TtDd]\b/);
  });

  it('a hear-see hit is code-computed and affirms with the sound', () => {
    const hit = tapVerdictCue(FIND_LETTER, 't');
    expect(hit).toContain('MATCHES');
    expect(spokenLine(hit)).toBe('Yes, /t/.');
  });

  it('hear-see closes its loop at move-on by naming the letter', () => {
    // Its corrections never did, and a capped item must not end with the link
    // still unmade. The spoken directions modeled their answer twice already.
    expect(spokenLine(moveOnCue(FIND_LETTER, SAY_WORD, { howToPlay: true })))
      .toContain('comes from the letter T');
    expect(spokenLine(moveOnCue(SAY_SOUND, SAY_WORD, {}))).not.toContain('sun');
  });
});

// ── 5. The tier ladder is the DISTAR sequence ───────────────────────────────

describe('letter-sound-link pack · support tier', () => {
  const line = (tier: LetterSoundTier) => spokenLine(itemCue(build({ ...SAY_SOUND_RAW }, tier)));

  it('easy hands over model + guide, medium the model only, hard nothing', () => {
    expect(line('easy')).toContain('This letter says sss.');
    expect(line('easy')).toContain('Together: sss.');
    expect(line('medium')).toContain('This letter says sss.');
    expect(line('medium')).not.toContain('Together: sss.');
    expect(line('hard')).not.toContain('sss');
  });

  it('never withdraws the hear-see stimulus — that would delete the question', () => {
    const hard = build({ ...FIND_LETTER_RAW }, 'hard');
    expect(spokenLine(itemCue(hard))).toContain('/t/');
    expect(itemCue(hard)).not.toContain('answering this one cold');
  });

  it('hear-see never says the same imperative twice, and its ladder is TWO rungs', () => {
    // The probe drew "Listen closely: sss. Listen: sss." — a model line in
    // front of an ask that already presents the sound. The stimulus cannot be
    // withdrawn here, so there is no third rung to have; `easy` folds a
    // say-it-with-me INTO the ask instead, after something to say.
    const askAt = (tier: LetterSoundTier) =>
      spokenLine(itemCue(build({ ...FIND_LETTER_RAW }, tier)));
    for (const tier of ['easy', 'medium', 'hard'] as LetterSoundTier[]) {
      expect(askAt(tier)).not.toContain('Listen closely');
      expect(askAt(tier).match(/Listen/g) ?? []).toHaveLength(1);
    }
    expect(askAt('easy')).toContain('Listen: /t/. Say it with me: /t/. Your turn.');
    expect(askAt('medium')).toContain('Listen: /t/. Your turn.');
    expect(askAt('medium')).toBe(askAt('hard'));
  });

  it('never withdraws the correction re-model (standing gate 3)', () => {
    expect(itemCue(build({ ...SAY_SOUND_RAW }, 'hard'))).toContain('My turn: this letter says sss.');
  });
});

// ── 6. Session frame ────────────────────────────────────────────────────────

describe('letter-sound-link pack · session frame', () => {
  it('the opening cue has ONE job: greeting + how-to-play + ask inside the quoted line', () => {
    const opening = spokenLine(itemCue(SAY_SOUND, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time to play with letter sounds!');
    expect(opening).toContain('you say the sound it makes');
    expect(opening).toContain('Your turn. What sound does this letter make?');
  });

  it('the hear-see cue carries the SILENCE contract', () => {
    const cue = itemCue(FIND_LETTER);
    // The wait is stated as a FACT about the turn, never as an order: the
    // imperative form is what a model performed as "[WAIT silently]", and
    // checkPackGates above now refuses it.
    expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
    expect(cue).toContain('the learner answers by TAPPING a letter, not by speaking');
    expect(cue).toContain('never name or spell either letter');
  });

  it('the final move-on and the complete cue both stop the tutor', () => {
    expect(moveOnCue(SAY_WORD, null, {})).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });

  it('a "yo-yo" keyword never opens a sentence with the affirm sentinel', () => {
    // The letter y used to carry the keyword "yes": a correction reading
    // "Yes starts with…" would have been scanned as a VERDICT and silently
    // advanced the lesson.
    const yoyo = build({
      id: 'lsl-y', mode: 'keyword-match',
      targetLetter: 'y', targetSound: '/y/', keywordWord: 'yo-yo',
      options: [{ sound: 'yo-yo', isCorrect: true }, { sound: 'pig', isCorrect: false }],
    });
    expect(findSentinelCollisions([
      { label: 'itemCue', text: itemCue(yoyo) },
      { label: 'moveOnCue', text: moveOnCue(yoyo, null, {}) },
      { label: 'pronounceCue', text: pronounceCue(yoyo) },
    ])).toEqual([]);
  });
});

// ── 6b. The wire: what the DI drive harness reads ───────────────────────────

describe('letter-sound-link pack · the DI wire', () => {
  /**
   * The harness's leak scan, byte for byte: lowercase, strip everything that is
   * not a letter/digit/space, then `\b<token>\b` (run_tutor_live.py `_norm`).
   * Re-implemented rather than described, because the whole point of this
   * describe is that the two sides agree.
   */
  const norm = (s: string) =>
    s.toLowerCase().replace(/[*_`]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
  const scanFinds = (spoken: string, token: string, exempt?: string) => {
    let scanned = norm(spoken);
    const span = exempt ? norm(exempt) : '';
    if (span && scanned.includes(span)) scanned = scanned.replace(span, ' ');
    return new RegExp(`\\b${norm(token)}\\b`).test(scanned);
  };
  const askOf = (item: LetterSoundItem) =>
    spokenLine(itemCue(item, { opening: true, howToPlay: true }));

  it('gives every cue the NEVER_PERFORM tail (item 21)', () => {
    // The weaker "never read bracket tags or these instructions aloud" is what
    // this pack shipped under. The tail forbids announcing the STATE, not just
    // reading the tag — the version with a measured before/after.
    const tail = 'never announce that you are waiting or listening';
    for (const item of ITEMS) {
      expect(itemCue(item, { opening: true, howToPlay: true })).toContain(tail);
      expect(tapVerdictCue(item, 'z')).toContain(tail);
      expect(moveOnCue(item, SAY_WORD, { howToPlay: true })).toContain(tail);
      expect(pronounceCue(item)).toContain(tail);
    }
  });

  it('states the TWO-BRANCH LAW before the branches (18d, script side)', () => {
    const cue = itemCue(SAY_SOUND);
    expect(cue).toContain('A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all');
    expect(cue.indexOf('no scaffolding line')).toBeLessThan(cue.indexOf('If the answer is right'));
    // hear-see gets the SILENCE contract instead — nothing is owed until the
    // application describes the tap, so there are no branches to law.
    expect(itemCue(FIND_LETTER)).not.toContain('no scaffolding line');
  });

  it('see-hear exempts the DISTAR model and goes FLAT at hard', () => {
    // The answer IS the sound the lead-in says out loud at easy and medium —
    // standing gate 3, not a leak. At hard the lead-in is empty, so the whole
    // ask is scanned and the rung's own promise becomes machine-checked.
    for (const tier of ['easy', 'medium'] as LetterSoundTier[]) {
      const item = build({ ...SAY_SOUND_RAW }, tier);
      const exempt = leakExemptSpanFor(item);
      expect(exempt).toContain('This letter says sss');
      expect(scanFinds(askOf(item), 'sss')).toBe(true);
      expect(scanFinds(askOf(item), 'sss', exempt)).toBe(false);
    }
    const hard = build({ ...SAY_SOUND_RAW }, 'hard');
    expect(leakExemptSpanFor(hard)).toBeUndefined();
    expect(scanFinds(askOf(hard), 'sss')).toBe(false);
  });

  it('keyword-match keeps a FLAT oracle at every tier', () => {
    // The anchor word is spoken for the first time in a correction or an
    // affirmation, so no tier owes it an exemption.
    for (const tier of ['easy', 'medium', 'hard'] as LetterSoundTier[]) {
      const item = build({ ...SAY_WORD_RAW }, tier);
      expect(letterSoundLinkHarnessAnswers(item).leakExemptSpan).toBeUndefined();
      expect(scanFinds(askOf(item), 'map')).toBe(false);
    }
  });

  it('hear-see scans the letter where the notation does not collide with it', () => {
    // ⭐ The sweep's second one-character answer, and this time the collision is
    // with OUR OWN NOTATION: `_norm` strips punctuation, so the stimulus "/t/"
    // becomes the bare token "t" — which is the answer.
    const stop = build({ ...FIND_LETTER_RAW });
    expect(scanFinds(askOf(stop), 't')).toBe(true);           // the notation, not a leak
    expect(letterSoundLinkHarnessAnswers(stop).leakTokens).toEqual([]);

    // A held sound is spoken stretched, so the token is clean and the oracle is
    // exact: this ask does NOT trip, and a tutor naming the letter would.
    const held = build({
      id: 'lsl-hs-s', mode: 'hear-see', targetLetter: 's', targetSound: '/s/',
      keywordWord: 'sun',
      options: [{ letter: 's', isCorrect: true }, { letter: 'n', isCorrect: false }],
    });
    expect(letterSoundLinkHarnessAnswers(held).leakTokens).toEqual(['s']);
    expect(scanFinds(askOf(held), 's')).toBe(false);
    expect(scanFinds(`${askOf(held)} Tap the letter S.`, 's')).toBe(true);
  });

  it('keeps hear-see FLAT for a and i — our own prose was reworded, not exempted', () => {
    // The blended drive fired here: "I say a sound — you tap the letter…"
    // carried the pronoun AND the article, and the how-to-play is re-spoken
    // whenever the ACTION changes, so a pinned session never showed it. An
    // exemption would have switched the oracle off over the prose we write.
    for (const letter of ['i', 'a']) {
      const item = build({
        id: `lsl-hs-${letter}`, mode: 'hear-see', targetLetter: letter,
        targetSound: letter === 'i' ? '/ĭ/' : '/ă/', keywordWord: 'itch',
        options: [{ letter, isCorrect: true }, { letter: 'n', isCorrect: false }],
      }, 'easy');
      expect(letterSoundLinkHarnessAnswers(item).leakTokens).toEqual([letter]);
      // Opening turn = greeting + how-to-play + ask, the widest surface there is.
      expect(scanFinds(askOf(item), letter)).toBe(false);
      // And the oracle is still live: a tutor that names the letter trips it.
      expect(scanFinds(`${askOf(item)} Tap the letter ${letter.toUpperCase()}.`, letter)).toBe(true);
    }
  });

  it('names the signature wrong each direction actually invites', () => {
    // see-hear: the letter NAME, written out — over the DI wire the child's
    // turn crosses as TEXT, and a lone "S" is not decidably the name.
    expect(letterSoundLinkHarnessAnswers(SAY_SOUND).signatureWrong?.text).toBe('ess');
    expect(letterSoundLinkHarnessAnswers(SAY_SOUND).correct).toBe('sss');
    // keyword-match: the SOUND said back — the tutor's own modelled word,
    // on-topic and naming no picture at all.
    expect(letterSoundLinkHarnessAnswers(SAY_WORD).signatureWrong?.text).toBe('mmm');
    expect(letterSoundLinkHarnessAnswers(SAY_WORD).plainWrong).toBe('net');
    // hear-see answers with the hands: material is `tapped`, verdict is
    // code-computed, and there is no signature wrong to name.
    const tap = letterSoundLinkHarnessAnswers(FIND_LETTER);
    expect(tap.tapped).toEqual({ correct: 't', wrong: 'd' });
    expect(tap.signatureWrong).toBeUndefined();
  });

  it('caps corrections where production caps them', () => {
    // maxAttempts counts ELICITATIONS, the runner counts CORRECTIONS. The
    // component computed this and the drive plan defaulted to 2, so a `hard`
    // session (maxAttempts 2) capped at 1 on screen and 2 on the wire.
    expect(maxCorrectionsFor(undefined)).toBe(2);
    expect(maxCorrectionsFor(2)).toBe(1);
    expect(letterSoundLinkPackBase(ITEMS, 2).maxCorrections).toBe(1);
    expect(letterSoundLinkPackBase(ITEMS).maxCorrections).toBe(2);
  });
});

// ── 6c. The session invariant: one letter, one answer ───────────────────────

describe('letter-sound-link pack · the session build gate', () => {
  const raw = (over: Partial<LetterSoundChallengeLike> & { id: string }) => ({
    mode: 'keyword-match' as const, targetLetter: 's', targetSound: '/s/',
    keywordWord: 'sun',
    options: [{ sound: 'sun', isCorrect: true }, { sound: 'net', isCorrect: false }],
    ...over,
  });

  it('drops a second item on a letter an earlier item already answered', () => {
    // At easy and medium the DISTAR model re-hands the answer over anyway, so
    // the repeat measures nothing; at hard it is pure recall.
    const items = itemsFromChallenges([
      raw({ id: 'a', mode: 'see-hear', options: [] }),
      raw({ id: 'b', mode: 'see-hear', options: [] }),
    ]);
    expect(items.map((i) => i.id)).toEqual(['a']);
  });

  it('drops a letter the tutor answered even when it comes back in another direction', () => {
    const items = itemsFromChallenges([
      raw({ id: 'a', mode: 'see-hear', options: [] }),
      raw({
        id: 'b', mode: 'hear-see',
        options: [{ letter: 's', isCorrect: true }, { letter: 'n', isCorrect: false }],
      }),
    ]);
    expect(items.map((i) => i.id)).toEqual(['a']);
  });

  it('drops an item whose DISTRACTOR the tutor already named — the elimination leak', () => {
    // The probe drew exactly this: ch1 "sun vs net" → "Yes, sun.", then ch6
    // "net vs sun". Neither item is wrong alone, which is why no per-item gate
    // can see it.
    const items = itemsFromChallenges([
      raw({ id: 'sun' }),
      raw({
        id: 'net', targetLetter: 'n', targetSound: '/n/', keywordWord: 'net',
        options: [{ sound: 'net', isCorrect: true }, { sound: 'sun', isCorrect: false }],
      }),
    ]);
    expect(items.map((i) => i.id)).toEqual(['sun']);
  });

  it('keeps a distractor that has only been SHOWN, never named', () => {
    // "net" was on screen in item 1 as the wrong picture and nobody said what
    // it was, so answering it in item 2 is still a real discrimination.
    const items = itemsFromChallenges([
      raw({ id: 'sun' }),
      raw({
        id: 'net', targetLetter: 'n', targetSound: '/n/', keywordWord: 'net',
        options: [{ sound: 'net', isCorrect: true }, { sound: 'map', isCorrect: false }],
      }),
    ]);
    expect(items.map((i) => i.id)).toEqual(['sun', 'net']);
  });

  it('hear-see never spends its anchor — it is the one direction that never says it', () => {
    const items = itemsFromChallenges([
      raw({
        id: 'tap-s', mode: 'hear-see',
        options: [{ letter: 's', isCorrect: true }, { letter: 'n', isCorrect: false }],
      }),
      // "sun" is still unheard, so the keyword-match item on `n` survives.
      raw({
        id: 'say-n', targetLetter: 'n', targetSound: '/n/', keywordWord: 'net',
        options: [{ sound: 'net', isCorrect: true }, { sound: 'sun', isCorrect: false }],
      }),
    ]);
    expect(items.map((i) => i.id)).toEqual(['tap-s', 'say-n']);
  });

  it('refuses a keyword-match item whose picture does not name its word', () => {
    // The probe drew `i` → "itch" → 🤏 and `g` → "go" → 🟢. The ask is "say the
    // picture word"; there is no answer a five-year-old can give.
    expect(keywordNamesItsPicture('i')).toBe(false);
    expect(keywordNamesItsPicture('x')).toBe(false);
    const items = itemsFromChallenges([
      raw({
        id: 'itch', targetLetter: 'i', targetSound: '/ĭ/', keywordWord: 'itch',
        options: [{ sound: 'itch', isCorrect: true }, { sound: 'apple', isCorrect: false }],
      }),
    ]);
    expect(items).toEqual([]);
    // The same letter is fully askable in the two directions whose answer is a
    // held sound or a tap.
    expect(itemsFromChallenges([raw({
      id: 'i-sound', mode: 'see-hear', targetLetter: 'i', targetSound: '/ĭ/',
      keywordWord: 'itch', options: [],
    })])).toHaveLength(1);
  });

  it('refuses a keyword-match item whose DISTRACTOR picture cannot be named', () => {
    // Gating only the target was not enough: the re-probe drew "sun vs 🤏"
    // twice. A child who cannot name the wrong picture answers by picking the
    // one they can, which is picture recognition rather than a sound match.
    expect(anchorWordNamesItsPicture('itch')).toBe(false);
    expect(anchorWordNamesItsPicture('sun')).toBe(true);
    expect(itemsFromChallenges([raw({
      id: 'sun-vs-itch',
      options: [{ sound: 'sun', isCorrect: true }, { sound: 'itch', isCorrect: false }],
    })])).toEqual([]);
    // hear-see is exempt — its options are letters and the child taps.
    expect(itemsFromChallenges([raw({
      id: 'tap-s-vs-i', mode: 'hear-see',
      options: [{ letter: 's', isCorrect: true }, { letter: 'i', isCorrect: false }],
    })])).toHaveLength(1);
  });

  it('the anchor word and its picture live in ONE map, and every anchor has one', () => {
    // They used to be two half-maps in two files; a pair that disagreed
    // rendered 📝 in the mode whose ask is "say the picture word".
    for (const [letter, anchor] of Object.entries(LETTER_KEYWORDS)) {
      expect(anchor.emoji, `${letter} → ${anchor.word}`).not.toBe('📝');
      expect(anchor.word.length).toBeGreaterThan(0);
    }
    // The item derives BOTH from the map, so a cached payload carrying a
    // retired anchor still renders the picture the pack believes in.
    const stale = build({
      id: 'stale', mode: 'see-hear', targetLetter: 'j', targetSound: '/j/',
      keywordWord: 'jam',
    });
    expect(stale.keyword).toBe('juice');
    expect(stale.keywordEmoji).toBe(LETTER_KEYWORDS.j.emoji);
  });

  it('a gated session still passes the family gates', () => {
    const items = itemsFromChallenges([
      raw({ id: 'a', mode: 'see-hear', options: [] }),
      raw({ id: 'dupe', mode: 'see-hear', options: [] }),
      raw({
        id: 'b', targetLetter: 'm', targetSound: '/m/', keywordWord: 'map',
        options: [{ sound: 'map', isCorrect: true }, { sound: 'net', isCorrect: false }],
      }),
    ]);
    expect(items).toHaveLength(2);
    expect(checkPackGates(letterSoundLinkPackBase(items))).toEqual([]);
  });
});

// ── 7. The catalog keeps its side of the contract ───────────────────────────

describe('letter-sound-link catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'letter-sound-link')!;

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, SAY_SOUND)).toEqual([]);
  });

  it('carries no directive for a deleted channel', () => {
    const prose = (entry.tutoring?.aiDirectives ?? []).map((d) => d.instruction).join('\n');
    for (const tag of ['[SAY_KEYWORD]', '[TAP_OPTION]', '[ACTIVITY_START]', '[NEXT_CHALLENGE]']) {
      expect(prose).not.toContain(tag);
    }
  });
});
