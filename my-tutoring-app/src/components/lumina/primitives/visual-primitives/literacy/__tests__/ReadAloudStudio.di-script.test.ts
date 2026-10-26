/**
 * readAloudStudioScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in (the scripted cues and judging contracts were retired when
 * the family moved onto its boss, 2026-10-26; their claims are pinned on the key):
 *  1. Every mode is one voice answer in the benched connected-text class.
 *  2. THE COLD READ: an `accuracy` ask never speaks the line.
 *  3. THE BENCHED WINDOW: 3-8 words comes from di-sentence-reading, not from a
 *     number typed here, and lines outside it are DROPPED rather than trimmed.
 *  4. THE SENTINEL GATE: a passage line whose own sentence opens with "Yes" or
 *     "My turn" is dropped, because interpolated into a correction it would
 *     silently flip the verdict.
 *  5. PROSODY IS TAUGHT, NOT GRADED: every key says how it sounds is never
 *     graded, and names its signature error.
 *  6. The catalog keeps its side: wiring from the boss card, no tutoring block.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  askFor,
  itemFromLine,
  itemsFromLines,
  opensWithSentinel,
  passageFrom,
  sanitizeLine,
  wordsIn,
  type ReadAloudItem,
} from '../readAloudStudioScript';
import {
  MAX_SENTENCE_WORDS as BENCH_MAX,
  MIN_SENTENCE_WORDS as BENCH_MIN,
} from '../../direct-instruction/diSentenceReadingDomain';
import { readAloudKey } from '../readAloudStudioWorkspace';
import type { StudioItem } from '../readAloudPhrasing';
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

/** The key the tutor judges against (the step fields a plain read does not use are irrelevant here). */
const keyOf = (item: ReadAloudItem) => readAloudKey(item as StudioItem)!;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('read-aloud-studio pack · structural gates', () => {
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
  });

  it('DROPS a dialogue line whose SPEAKER would open a sentinel', () => {
    expect(itemFromLine({ text: 'I will not go in there', speaker: 'Yes' }, 'dialogue', 0)).toBeNull();
  });
});

// ── 4. The cold read — the pack's whole answer-leak story ───────────────────

describe('read-aloud-studio pack · the cold read', () => {
  it('an accuracy ask never contains the line', () => {
    expect(askFor(ACCURACY)).toBe('Your turn. Read it.');
  });

  it('the modelled modes DO speak their line first — that is the mode', () => {
    expect(askFor(EXPRESSION)).toContain('Listen: Under the old stone bridge');
    expect(askFor(DIALOGUE)).toContain('Listen. Mia says: I will not go in there');
  });

  it('a stress word that is not in the line is NULLED, not fatal', () => {
    const item = itemFromLine({ text: 'Under the old stone bridge', stressWord: 'castle' }, 'expression', 0)!;
    expect(item).not.toBeNull();
    expect(item.stressWord).toBeUndefined();
  });
});

// ── 5. Prosody is taught, not graded ────────────────────────────────────────

describe('read-aloud-studio pack · the judge stays inside its bench', () => {
  it('every key judges the words and never how the reading sounded', () => {
    for (const item of ITEMS) {
      expect(keyOf(item).answer).toBe(item.text);
      expect(keyOf(item).acceptRule).toContain('How it sounds (phrasing, voice, speed) is never graded.');
      expect(keyOf(item).signatureError).toContain('A word skipped, added or read as a different word is wrong.');
    }
  });

  it('a dialogue line refuses the idea said in other words', () => {
    expect(keyOf(DIALOGUE).signatureError).toContain('Saying the idea in other words is not reading it.');
    expect(keyOf(ACCURACY).signatureError).not.toContain('idea');
  });
});

// ── 7. Dialogue arrives as spoken words, speaker in its own field ───────────

describe('read-aloud-studio pack · dialogue shape', () => {
  it('strips quotation marks — a stray quote would close the Say exactly span', () => {
    expect(sanitizeLine('“I will not go in there”')).toBe('I will not go in there');
    const item = itemFromLine({ text: '"I will not go"', speaker: 'Mia' }, 'dialogue', 0)!;
    expect(item.text).toBe('I will not go');
  });

  it('DROPS a dialogue line with no speaker — there is no character task', () => {
    expect(itemFromLine({ text: 'I will not go in there' }, 'dialogue', 0)).toBeNull();
  });

  it('the speaker rides the ask', () => {
    expect(askFor(DIALOGUE)).toContain('Say it like Mia.');
  });
});

// ── 8. Session frame + the catalog contract ─────────────────────────────────

describe('read-aloud-studio pack · session frame and catalog', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'read-aloud-studio')!;

  it('the passage is only assembled whole for the end-of-run view', () => {
    expect(passageFrom(ITEMS)).toBe(
      'The dog ran to the pond. Under the old stone bridge I will not go in there',
    );
  });

  it('its wiring is the boss card, and no tutoring block remains', () => {
    expect(entry.teachingWorkspace?.card).toBeDefined();
    expect(entry.tutoring).toBeUndefined();
    expect(entry.audioInput).toEqual({ manual_activity: true });
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
