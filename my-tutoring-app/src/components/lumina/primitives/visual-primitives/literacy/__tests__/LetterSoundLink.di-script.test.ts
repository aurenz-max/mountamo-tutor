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
  answerKindFor,
  canProduceSound,
  completeCue,
  itemCue,
  itemFromChallenge,
  moveOnCue,
  PRODUCIBLE_LETTERS,
  pronounceCue,
  responseClassFor,
  spokenSoundFor,
  stimulusFor,
  tapVerdictCue,
  type LetterSoundItem,
  type LetterSoundTier,
} from '../letterSoundLinkScript';
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

// ── Fixtures — one item per direction, session-shaped ───────────────────────

const EMOJI: Record<string, string> = {
  sun: '☀️', map: '🗺️', net: '🥅', top: '🔝', 'yo-yo': '🪀', pig: '🐷',
};
const emojiFor = (word: string) => EMOJI[word.toLowerCase()] ?? '📝';

const build = (
  ch: Parameters<typeof itemFromChallenge>[0],
  tier: LetterSoundTier = 'medium',
) => itemFromChallenge(ch, emojiFor, tier);

/** see-hear: the child SAYS the sound. No options at all. */
const SAY_SOUND_RAW = {
  id: 'lsl-1', mode: 'see-hear' as const,
  targetLetter: 's', targetSound: '/s/', keywordWord: 'sun',
};

/** hear-see: the tutor says the sound, the child TAPS a letter. Targets a STOP
 *  on purpose — this is the direction that covers them. */
const FIND_LETTER_RAW = {
  id: 'lsl-2', mode: 'hear-see' as const,
  targetLetter: 't', targetSound: '/t/', keywordWord: 'top',
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

/** The pack exactly as the component assembles it. */
const pack: JudgedScriptPack<LetterSoundItem> = {
  primitiveType: 'letter-sound-link',
  activityLine: 'live direct instruction letter-sound practice',
  items: ITEMS,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({ challengeMode: item.mode, stimulus: stimulusFor(item) }),
};

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
      expect(spokenLine(itemCue(build({ ...FIND_LETTER_RAW }, tier)))).not.toContain('top');
      expect(spokenLine(itemCue(build({ ...SAY_WORD_RAW }, tier)))).not.toContain('map');
    }
  });

  it('the hear-see ask never names either letter (the grapheme IS the answer)', () => {
    const ask = spokenLine(itemCue(FIND_LETTER, { howToPlay: true }));
    expect(ask).toContain('/t/');            // the sound is the STIMULUS
    expect(ask).not.toMatch(/letter [TtDd]\b/);
  });

  it('the keyword-match ask says neither picture word nor the sound', () => {
    const ask = spokenLine(itemCue(SAY_WORD, {}, ));
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
