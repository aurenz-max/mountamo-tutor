/**
 * readAloudStudioScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (validateJudgedScriptPack).
 *  2. THE COLD READ: an `accuracy` cue never speaks the line, in the ask, in
 *     the tap-to-hear, or anywhere else before the child reads it — and the
 *     per-item cold-read guard says so out loud, because the catalog's
 *     scaffolding channel could otherwise re-read it.
 *  3. THE BENCHED WINDOW: 3-8 words comes from di-sentence-reading, not from a
 *     number typed here, and lines outside it are DROPPED rather than trimmed.
 *  4. THE SENTINEL GATE: a passage line whose own sentence opens with "Yes" or
 *     "My turn" is dropped, because interpolated into a correction it would
 *     silently flip the verdict.
 *  5. PROSODY IS TAUGHT, NOT GRADED: both modelled modes carry the clause that
 *     forbids the judge refusing a flat reading — an unbenched judgment wearing
 *     a benched one's clothes.
 *  6. Corrections re-model then re-elicit, contrastive branch preferred.
 *  7. The catalog keeps its side: template keys resolve against exactly what
 *     the pack pushes, and no catalog sentence opens with a verdict sentinel.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  affirmLine,
  askFor,
  completeCue,
  contrastCorrectionLine,
  correctionLine,
  itemCue,
  itemFromLine,
  itemsFromLines,
  moveOnCue,
  opensWithSentinel,
  passageFrom,
  pronounceCue,
  sanitizeLine,
  stimulusFor,
  wordsIn,
  type ReadAloudItem,
} from '../readAloudStudioScript';
import {
  MAX_SENTENCE_WORDS as BENCH_MAX,
  MIN_SENTENCE_WORDS as BENCH_MIN,
} from '../../direct-instruction/diSentenceReadingScript';
import {
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — one item per mode, session-shaped ────────────────────────────

const ACCURACY = itemFromLine({ text: 'The dog ran to the pond.' }, 'accuracy', 0)!;
const EXPRESSION = itemFromLine(
  { text: 'Under the old stone bridge', stressWord: 'stone' },
  'expression',
  1,
)!;
const DIALOGUE = itemFromLine(
  { text: 'I will not go in there', speaker: 'Mia' },
  'dialogue',
  2,
)!;

const ITEMS: ReadAloudItem[] = [ACCURACY, EXPRESSION, DIALOGUE];

/** The pack exactly as the component assembles it (minus component closures). */
const pack: JudgedScriptPack<ReadAloudItem> = {
  primitiveType: 'read-aloud-studio',
  activityLine: 'live direct instruction read-aloud fluency practice',
  items: ITEMS,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({ challengeType: item.kind, stimulus: stimulusFor(item) }),
};

/** The line the tutor actually SPEAKS — the shared parser, so every port reads
 *  the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('read-aloud-studio pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('a REAL run — consecutive lines in one mode — recites no ask twice', () => {
    // The pack above is one item per mode, the ONE shape that cannot trigger
    // the repeat gate (it compares consecutive items of the same action). A
    // passage is read line after line in the SAME mode, so this is the normal
    // case, and an invariant lead-in here is the port-8/port-11 defect.
    const lines = [
      itemFromLine({ text: 'The dog ran to the pond.' }, 'accuracy', 0)!,
      itemFromLine({ text: 'He came back wet.' }, 'accuracy', 1)!,
    ];
    expect(checkPackGates({ ...pack, items: lines })).toEqual([]);
  });

  it('every mode is one voice answer in the benched connected-text class', () => {
    for (const item of ITEMS) {
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe('sentence_read_aloud');
    }
  });

  it('stamps action per item so a mixed session re-speaks the how-to-play', () => {
    for (const item of ITEMS) expect(item.action).toBe(item.kind);
  });

  it('counts words in CODE, never from the model', () => {
    expect(ACCURACY.wordCount).toBe(6);
    expect(wordsIn('The dog ran to the pond.')).toBe(6);
  });
});

// ── 2. The benched window is IMPORTED, and it drops rather than trims ───────

describe('read-aloud-studio pack · the benched word window', () => {
  it('reads the window from the pack that benched it', () => {
    // REVERT-BITE: re-declaring 3/8 here would let this pack drift away from
    // the sitting silently the day a new sitting moves the ceiling.
    expect(MIN_SENTENCE_WORDS).toBe(BENCH_MIN);
    expect(MAX_SENTENCE_WORDS).toBe(BENCH_MAX);
    expect(MAX_SENTENCE_WORDS).toBe(8);
  });

  it('DROPS a line past the ceiling instead of trimming it', () => {
    // A trimmed line is a different sentence, and the child is looking at the
    // printed original — so an over-long line ships nothing.
    const long = 'The very small brown dog ran quickly to the little pond today';
    expect(wordsIn(long)).toBeGreaterThan(MAX_SENTENCE_WORDS);
    expect(itemFromLine({ text: long }, 'accuracy', 0)).toBeNull();
  });

  it('DROPS a line below the floor — two words is a phrase, not a line', () => {
    expect(itemFromLine({ text: 'The dog' }, 'accuracy', 0)).toBeNull();
  });

  it('keeps ids on the ORIGINAL index so a drop never renumbers survivors', () => {
    const built = itemsFromLines(
      [
        { text: 'The dog ran to the pond.' },
        { text: 'No' },
        { text: 'It was a warm day.' },
      ],
      'accuracy',
    );
    expect(built.map((i) => i.id)).toEqual(['line-1', 'line-3']);
  });
});

// ── 3. The sentinel gate on generated passage text ──────────────────────────

describe('read-aloud-studio pack · sentinel gate', () => {
  it('DROPS a line whose own sentence opens with a verdict sentinel', () => {
    // REVERT-BITE: this line interpolated into a correction reads
    // "My turn: I was tired. Yes, very tired. Your turn..." — the second
    // sentence opens with the AFFIRM sentinel, so the engine would score the
    // tutor's correction as an affirmation and advance on a misread.
    expect(opensWithSentinel('I was tired. Yes, very tired.')).toBe(true);
    expect(itemFromLine({ text: 'I was tired. Yes, very tired.' }, 'accuracy', 0)).toBeNull();
    expect(itemFromLine({ text: 'My turn to feed the cat.' }, 'accuracy', 0)).toBeNull();
  });

  it('a mid-line mention is fine — only sentence OPENERS classify', () => {
    const item = itemFromLine({ text: 'She said yes to the plan.' }, 'accuracy', 0);
    expect(item).not.toBeNull();
    expect(checkPackGates({ ...pack, items: [item!] })).toEqual([]);
  });

  it('DROPS a dialogue line whose SPEAKER would open a sentinel', () => {
    expect(itemFromLine({ text: 'I will not go in there', speaker: 'Yes' }, 'dialogue', 0)).toBeNull();
  });
});

// ── 4. The cold read — the pack's whole answer-leak story ───────────────────

describe('read-aloud-studio pack · the cold read', () => {
  it('an accuracy ask never contains the line', () => {
    expect(askFor(ACCURACY)).toBe('Your turn. Read it.');
    expect(spokenLine(itemCue(ACCURACY))).not.toContain('The dog ran');
  });

  it('the accuracy cue forbids reading the line out loud, per item', () => {
    // The omitted model already withholds it; the guard makes it explicit,
    // because the catalog's scaffolding levels are a second channel.
    expect(itemCue(ACCURACY)).toContain('do NOT read the line, or any part of it, before they do');
  });

  it('tap-to-hear on accuracy re-speaks the instruction, never the line', () => {
    const heard = pronounceCue(ACCURACY);
    expect(heard).toContain('Your turn. Read it.');
    expect(heard).not.toContain('The dog ran to the pond');
    expect(heard).toContain('do NOT read the line');
  });

  it('the modelled modes DO speak their line first — that is the mode', () => {
    // A prosody you have never heard cannot be imitated, so expression and
    // dialogue quote a "Listen:" model. They carry no cold-read guard.
    expect(spokenLine(itemCue(EXPRESSION))).toContain('Listen: Under the old stone bridge');
    expect(spokenLine(itemCue(DIALOGUE))).toContain('Listen. Mia says: I will not go in there');
    expect(itemCue(EXPRESSION)).not.toContain('do NOT read the line');
    expect(itemCue(DIALOGUE)).not.toContain('do NOT read the line');
  });

  it('the delivery note shapes the model and is never words for the child', () => {
    const cue = itemCue(EXPRESSION);
    expect(cue).toContain('ONE smooth phrase');
    expect(cue).toContain('lean on the word "stone"');
    // Outside the quoted span the tutor speaks.
    expect(spokenLine(cue)).not.toContain('smooth phrase');
  });

  it('a stress word that is not in the line is NULLED, not fatal', () => {
    // The stress is a detail of the tutor's delivery, not the ask — so the
    // phrase still reads, it just loses the lean.
    const item = itemFromLine(
      { text: 'Under the old stone bridge', stressWord: 'castle' },
      'expression',
      0,
    )!;
    expect(item).not.toBeNull();
    expect(item.stressWord).toBeUndefined();
    expect(itemCue(item)).not.toContain('lean on the word');
  });
});

// ── 5. Prosody is taught, not graded ────────────────────────────────────────

describe('read-aloud-studio pack · the judge stays inside its bench', () => {
  it('both modelled modes forbid grading how the reading SOUNDED', () => {
    // REVERT-BITE: without this clause the tutor invents a prosody refusal off
    // the back of "say it just like that" — a judgment nothing has benched,
    // arriving with all the confidence of the word-accuracy one that has been.
    expect(itemCue(EXPRESSION)).toContain('A flat or plain reading that gets every word right is CORRECT');
    expect(itemCue(EXPRESSION)).toContain('you never grade how it sounded');
    expect(itemCue(DIALOGUE)).toContain('own ordinary voice that gets every word right is CORRECT');
    expect(itemCue(DIALOGUE)).toContain('you never grade how it sounded');
  });

  it('accuracy has no such clause — there is no delivery to excuse', () => {
    expect(itemCue(ACCURACY)).not.toContain('you never grade how it sounded');
  });

  it('every mode refuses to judge speed', () => {
    for (const item of ITEMS) {
      expect(itemCue(item)).toContain('judge accuracy, never speed');
    }
  });

  it('every mode names its signature error', () => {
    expect(itemCue(ACCURACY)).toContain('small word swapped for another small word');
    expect(itemCue(EXPRESSION)).toContain('can hide a DROPPED word');
    expect(itemCue(DIALOGUE)).toContain('IDEA in different words is not reading it');
  });

  it('a mid-line pause is part of ONE reading, not the end of it', () => {
    for (const item of ITEMS) {
      expect(itemCue(item)).toContain('wait for them to finish the whole line before judging it');
    }
  });
});

// ── 6. Verdict lines ────────────────────────────────────────────────────────

describe('read-aloud-studio pack · verdicts', () => {
  it('affirmations open with the affirm sentinel and restate the line', () => {
    expect(affirmLine(ACCURACY)).toBe('Yes, that says The dog ran to the pond.');
    for (const item of ITEMS) expect(affirmLine(item).startsWith('Yes,')).toBe(true);
  });

  it('the contrastive correction is preferred and names what they said', () => {
    expect(contrastCorrectionLine(ACCURACY))
      .toBe('My turn: not ⟨what they said⟩ — The dog ran to the pond. Your turn. Read it again.');
    expect(itemCue(ACCURACY)).toContain('do not fall back to the plain re-model');
  });

  it('the plain re-model survives for the miss with nothing to contrast', () => {
    expect(correctionLine(ACCURACY)).toBe('My turn: The dog ran to the pond. Your turn. Read it again.');
    expect(itemCue(ACCURACY)).toContain('silence, an unintelligible attempt');
  });

  it('every correction re-models then re-elicits (standing gate 3)', () => {
    for (const item of ITEMS) {
      expect(correctionLine(item).startsWith('My turn:')).toBe(true);
      expect(correctionLine(item)).toContain('Your turn. Read it again.');
    }
  });
});

// ── 7. Dialogue arrives as spoken words, speaker in its own field ───────────

describe('read-aloud-studio pack · dialogue shape', () => {
  it('strips quotation marks — a stray quote would close the Say exactly span', () => {
    expect(sanitizeLine('“I will not go in there”')).toBe('I will not go in there');
    const item = itemFromLine({ text: '"I will not go"', speaker: 'Mia' }, 'dialogue', 0)!;
    expect(item.text).toBe('I will not go');
    expect(itemCue(item)).not.toContain('""');
  });

  it('DROPS a dialogue line with no speaker — there is no character task', () => {
    expect(itemFromLine({ text: 'I will not go in there' }, 'dialogue', 0)).toBeNull();
  });

  it('the speaker rides the ask, the model and the context push', () => {
    expect(askFor(DIALOGUE)).toContain('Say it like Mia.');
    expect(itemCue(DIALOGUE)).toContain("in Mia's voice");
    expect(stimulusFor(DIALOGUE)).toBe('Mia says: I will not go in there');
  });
});

// ── 8. Session frame + the catalog contract ─────────────────────────────────

describe('read-aloud-studio pack · session frame and catalog', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'read-aloud-studio')!;

  it('the opening cue has ONE job; the final cues stop the tutor', () => {
    const opening = spokenLine(itemCue(ACCURACY, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time to read out loud!');
    expect(opening).toContain('You read it out loud, all by yourself!');
    // The opening still must not read the line for them.
    expect(opening).not.toContain('The dog ran to the pond');
    expect(moveOnCue(DIALOGUE, null)).toContain('Then stop — the activity is over.');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });

  it('the passage is only assembled whole for the end-of-run view', () => {
    expect(passageFrom(ITEMS)).toBe(
      'The dog ran to the pond. Under the old stone bridge I will not go in there',
    );
  });

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, ACCURACY)).toEqual([]);
  });

  it('the catalog no longer advertises the costume it shipped for a year', () => {
    // "Student self-assessment only, no AI speech grading" was true and was the
    // reason di-sentence-reading forked. Both halves of that sentence are now
    // false, and manifest steering that still said it would route this
    // primitive as an ungraded activity forever.
    const steering = `${entry.description} ${entry.constraints}`;
    expect(steering).not.toMatch(/self-assessment/i);
    expect(steering).not.toMatch(/WPM|words per minute/i);
    expect(steering).not.toMatch(/no AI grading|no AI speech grading/i);
    expect(steering).toMatch(/microphone/i);
  });
});
