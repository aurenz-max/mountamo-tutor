import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildEmojiVisual,
  normalizeOptions,
  placeAnswerAtSlot,
  resolveLeakingVisual,
  stemLeaksAnswer,
  stemNeedsVisual,
  validateFastFactData,
  visualLeaksAnswer,
} from './gemini-fast-fact';

/**
 * Answer-contract tests for the fast-fact generator (FF-1 / FF-2).
 *
 * The end-to-end fixtures are the FLAT Gemini shape of drills the generator
 * really shipped on 2026-08-06 — the sight-word drill that leaked all ten items
 * and the state-capitals drill that did not. Neither is mutated. The oracle
 * measured 24 answer-leak violations in Language Arts, 15 in Science and 6 in
 * Math across five runs each, at 0% flakiness: reliable generation of broken
 * content.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const flat = (o: Record<string, unknown>) => ({
  promptSubtext: '',
  visualType: 'none',
  visualContent: '',
  visualAlt: '',
  acceptableAnswers: [],
  responseMode: 'choice',
  explanation: '',
  difficulty: 'easy',
  type: 'recall',
  ...o,
});

/** The real sight-word drill: 7 items show the answer, 3 more quote it. */
const litLeakyFlat = {
  title: 'Sight Word Sprint',
  subject: 'Language Arts',
  challenges: [
    flat({ id: 'sf_1', promptText: 'Which word is this?', promptSubtext: 'Look at the letters', visualType: 'text-large', visualContent: 'the', correctAnswer: 'the', options: ['the', 'and', 'big'] }),
    flat({ id: 'sf_2', promptText: 'Find the word:', promptSubtext: 'Read the sight word', visualType: 'text-large', visualContent: 'see', correctAnswer: 'see', options: ['cat', 'see', 'run'] }),
    flat({ id: 'sf_3', promptText: 'What word is shown here?', promptSubtext: 'Look carefully', visualType: 'text-large', visualContent: 'cat', correctAnswer: 'cat', options: ['dog', 'cat', 'rat'] }),
    flat({ id: 'sf_4', promptText: 'Can you spot the word?', promptSubtext: 'Identify the sight word', visualType: 'text-large', visualContent: 'is', correctAnswer: 'is', options: ['it', 'in', 'is'] }),
    flat({ id: 'sf_5', promptText: "Which option spells 'and'?", promptSubtext: 'Match the word', correctAnswer: 'and', options: ['and', 'dad', 'bad'] }),
    flat({ id: 'sf_6', promptText: "Choose the word 'you':", promptSubtext: 'Find the match', correctAnswer: 'you', options: ['yoy', 'you', 'your'] }),
    flat({ id: 'sf_7', promptText: "Which word is 'to'?", promptSubtext: 'Select the correct word', correctAnswer: 'to', options: ['do', 'go', 'to'] }),
    flat({ id: 'sf_8', promptText: 'What word is this?', promptSubtext: 'Fast check', visualType: 'text-large', visualContent: 'a', correctAnswer: 'a', options: ['a', 'i', 'o'] }),
    flat({ id: 'sf_9', promptText: 'Find the word:', promptSubtext: 'Fast check', visualType: 'text-large', visualContent: 'it', correctAnswer: 'it', options: ['in', 'it', 'at'] }),
    flat({ id: 'sf_10', promptText: 'Select the correct sight word:', promptSubtext: 'Fast check', visualType: 'text-large', visualContent: 'run', correctAnswer: 'run', options: ['fun', 'sun', 'run'] }),
  ],
  phaseConfigItems: [{ key: 'recall', label: 'Recall', icon: '👁️', accentColor: 'blue' }],
};

/** The real capitals drill: emoji are decorative, options are city names. */
const histCleanFlat = {
  title: 'Capital Quest',
  subject: 'History',
  challenges: [
    flat({ id: 'cap_1', promptText: 'What is the capital of Texas?', visualType: 'emoji', visualContent: '🤠', visualAlt: 'Cowboy hat emoji', correctAnswer: 'Austin', options: ['Houston', 'Austin', 'Dallas', 'San Antonio'] }),
    flat({ id: 'cap_2', promptText: 'What is the capital of California?', visualType: 'emoji', visualContent: '☀️', visualAlt: 'Sun emoji', correctAnswer: 'Sacramento', options: ['Los Angeles', 'San Francisco', 'Sacramento', 'San Diego'] }),
    flat({ id: 'cap_3', promptText: 'What is the capital of New York?', visualType: 'emoji', visualContent: '🗽', visualAlt: 'Statue of Liberty emoji', correctAnswer: 'Albany', options: ['New York City', 'Albany', 'Buffalo', 'Syracuse'] }),
    flat({ id: 'cap_4', promptText: 'What is the capital of Florida?', visualType: 'emoji', visualContent: '🌴', visualAlt: 'Palm tree emoji', correctAnswer: 'Tallahassee', options: ['Miami', 'Orlando', 'Tallahassee', 'Tampa'] }),
    flat({ id: 'cap_5', promptText: 'Which state has Salem as its capital?', visualType: 'emoji', visualContent: '🌲', visualAlt: 'Pine tree emoji', correctAnswer: 'Oregon', options: ['Washington', 'Oregon', 'Nevada', 'Idaho'] }),
    flat({ id: 'cap_6', promptText: 'Which state has Denver as its capital?', visualType: 'emoji', visualContent: '⛰️', visualAlt: 'Mountain emoji', correctAnswer: 'Colorado', options: ['Colorado', 'Utah', 'Wyoming', 'Montana'] }),
    flat({ id: 'cap_7', promptText: 'What is the capital of Illinois?', visualType: 'emoji', visualContent: '🌽', visualAlt: 'Corn ear emoji', correctAnswer: 'Springfield', options: ['Chicago', 'Springfield', 'Peoria', 'Rockford'] }),
    flat({ id: 'cap_8', promptText: 'What is the capital of Ohio?', visualType: 'emoji', visualContent: '🌰', visualAlt: 'Chestnut emoji', correctAnswer: 'Columbus', options: ['Cleveland', 'Cincinnati', 'Columbus', 'Dayton'] }),
    flat({ id: 'cap_9', promptText: 'What is the capital of Washington?', visualType: 'emoji', visualContent: '☕', visualAlt: 'Coffee cup emoji', correctAnswer: 'Olympia', options: ['Seattle', 'Olympia', 'Spokane', 'Tacoma'] }),
    flat({ id: 'cap_10', promptText: 'What is the capital of Massachusetts?', visualType: 'emoji', visualContent: '🦞', visualAlt: 'Lobster emoji', correctAnswer: 'Boston', options: ['Boston', 'Salem', 'Cambridge', 'Plymouth'] }),
  ],
  phaseConfigItems: [{ key: 'recall', label: 'Recall', icon: '🗺️', accentColor: 'blue' }],
};

// Rejections are logged, never silent — quieted here, asserted below.
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
beforeEach(() => { warn.mockClear(); });

// ---------------------------------------------------------------------------
// FF-1a — the visual IS the answer
// ---------------------------------------------------------------------------

describe('visualLeaksAnswer — representation shift', () => {
  it('flags the live numeral leak: text-large "7" with key 7', () => {
    expect(visualLeaksAnswer('7', '7', [])).toBe(true);
  });

  it('flags the live symbol and sight-word leaks', () => {
    expect(visualLeaksAnswer('Fe', 'Fe', [])).toBe(true);
    expect(visualLeaksAnswer('Hg', 'Hg', [])).toBe(true);
    expect(visualLeaksAnswer('the', 'the', [])).toBe(true);
  });

  it('passes the honored contract: symbol shown, name answered', () => {
    expect(visualLeaksAnswer('Fe', 'Iron', ['iron'])).toBe(false);
    expect(visualLeaksAnswer('🍎🍎🍎', '3', [])).toBe(false);
  });

  it('catches casing and spacing variants, and acceptableAnswers routes', () => {
    expect(visualLeaksAnswer(' Iron ', 'iron', [])).toBe(true);
    expect(visualLeaksAnswer('iron', 'Fe', ['iron'])).toBe(true);
  });
});

describe('resolveLeakingVisual — strip or reject', () => {
  it('always rejects a leaking text-large: the large text IS the stimulus', () => {
    expect(resolveLeakingVisual('text-large', 'What is the symbol for Iron?', '')).toBe('reject');
    expect(resolveLeakingVisual('text-large', 'Can you spot the word?', 'Identify the sight word')).toBe('reject');
  });

  it('strips a leaking emoji when the prompt stands on its own', () => {
    expect(resolveLeakingVisual('emoji', 'How many fingers are on one hand?', '')).toBe('strip');
  });

  it('rejects a leaking emoji when the stem points at it', () => {
    expect(resolveLeakingVisual('emoji', 'How many do you see here?', '')).toBe('reject');
  });
});

describe('stemNeedsVisual', () => {
  it('recognises deictic stems and colon lead-ins', () => {
    expect(stemNeedsVisual('Which word is this?', 'Look at the letters')).toBe(true);
    expect(stemNeedsVisual('What word is shown here?', 'Look carefully')).toBe(true);
    expect(stemNeedsVisual('Find the word:', 'Read the sight word')).toBe(true);
    expect(stemNeedsVisual('', '')).toBe(true);
  });

  it('leaves self-contained questions alone', () => {
    expect(stemNeedsVisual('What is the capital of Texas?', 'Choose the correct city.')).toBe(false);
    expect(stemNeedsVisual('What is the chemical symbol for Oxygen?', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FF-1b — the stem names the answer
// ---------------------------------------------------------------------------

describe('stemLeaksAnswer', () => {
  it('flags the live quoted leaks, at any answer length', () => {
    expect(stemLeaksAnswer("Which option spells 'and'?", 'Match the word', 'and', ['and', 'dad', 'bad'])).toBe(true);
    expect(stemLeaksAnswer("Choose the word 'you':", 'Find the match', 'you', ['yoy', 'you', 'your'])).toBe(true);
    expect(stemLeaksAnswer("Which word is 'to'?", 'Select the correct word', 'to', ['do', 'go', 'to'])).toBe(true);
  });

  it('flags the live bare numeric leak', () => {
    expect(stemLeaksAnswer('What is the final number when counting to 20?', '', '20', ['18', '19', '20'])).toBe(true);
  });

  it('exempts computation stems — the operands are the problem', () => {
    expect(stemLeaksAnswer('7 + 3 = ?', '', '10', ['9', '10', '11'])).toBe(false);
  });

  it('does not fire when a distractor is named too — that is the problem statement', () => {
    expect(stemLeaksAnswer('Is Austin or Houston the capital of Texas?', '', 'Austin', ['Austin', 'Houston'])).toBe(false);
  });

  it('ignores incidental short function words', () => {
    // "the" appears in "the sentence", but the cloze answer is not given away.
    expect(stemLeaksAnswer('Which word finishes the sentence?', 'I see ___ dog.', 'the', ['and', 'the', 'big'])).toBe(false);
  });

  it('leaves clean recall stems alone', () => {
    expect(stemLeaksAnswer('What is the capital of Texas?', 'Choose the correct city.', 'Austin', ['Houston', 'Austin', 'Dallas'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FF-2b — duplicate / doubly-correct options
// ---------------------------------------------------------------------------

describe('normalizeOptions', () => {
  it('collapses the live duplicate that made two buttons grade correct', () => {
    // Shipped in a capitals drill: also a React key={opt} collision.
    expect(normalizeOptions(['New Mexico', 'Nevada', 'Arizona', 'Arizona'], 'Arizona', []))
      .toEqual(['New Mexico', 'Nevada', 'Arizona']);
  });

  it('drops a distractor that acceptableAnswers silently promotes to correct', () => {
    expect(normalizeOptions(['5', 'four', 'five', 'six'], '5', ['five']))
      .toEqual(['5', 'four', 'six']);
  });

  it('collapses a duplicated DISTRACTOR — the React key={opt} collision', () => {
    expect(normalizeOptions(['Nevada', 'Nevada', 'Arizona'], 'Arizona', []))
      .toEqual(['Nevada', 'Arizona']);
  });

  it('collapses casing duplicates', () => {
    expect(normalizeOptions(['Iron', 'IRON', 'Neon'], 'Iron', [])).toEqual(['Iron', 'Neon']);
  });

  it('inserts the key when no option grades correct', () => {
    expect(normalizeOptions(['Houston', 'Dallas'], 'Austin', [])).toContain('Austin');
  });

  it('leaves a clean option list untouched', () => {
    expect(normalizeOptions(['Houston', 'Austin', 'Dallas'], 'Austin', []))
      .toEqual(['Houston', 'Austin', 'Dallas']);
  });
});

// ---------------------------------------------------------------------------
// FF-2a — position clustering
// ---------------------------------------------------------------------------

describe('placeAnswerAtSlot', () => {
  it('moves the answer to the requested slot, preserving distractor order', () => {
    expect(placeAnswerAtSlot(['A', 'B', 'C'], 0, 2)).toEqual(['B', 'C', 'A']);
    expect(placeAnswerAtSlot(['A', 'B', 'C'], 2, 0)).toEqual(['C', 'A', 'B']);
  });

  it('wraps slots beyond the option count', () => {
    expect(placeAnswerAtSlot(['A', 'B', 'C'], 0, 4)).toEqual(['B', 'A', 'C']);
  });

  it('is a no-op on degenerate input', () => {
    expect(placeAnswerAtSlot(['A'], 0, 1)).toEqual(['A']);
    expect(placeAnswerAtSlot(['A', 'B'], -1, 1)).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// FF-3 — emoji shown != numeric key (SP-8: the model cannot emit N glyphs)
// ---------------------------------------------------------------------------

describe('buildEmojiVisual', () => {
  it('draws exactly the requested count, whatever the model typed', () => {
    // Live post-fix failure: "Count the smiling faces." keyed 10 over 7 emoji.
    expect(buildEmojiVisual('😊😊😊😊😊😊😊', 10).length).toBe('😊'.repeat(10).length);
    expect(buildEmojiVisual('😊', 10)).toBe('😊'.repeat(10));
  });

  it('is idempotent when the model already got it right', () => {
    expect(buildEmojiVisual('🍎🍎🍎', 3)).toBe('🍎🍎🍎');
  });

  it('leaves decorative visuals alone (repeat 0/1/absent)', () => {
    expect(buildEmojiVisual('🤠', 1)).toBe('🤠');
    expect(buildEmojiVisual('🤠', 0)).toBe('🤠');
    expect(buildEmojiVisual('🖐️🖐️', undefined)).toBe('🖐️🖐️');
  });

  it('caps an absurd repeat instead of rendering hundreds of glyphs', () => {
    expect(buildEmojiVisual('⭐', 400)).toBe('⭐'.repeat(25));
  });

  it('handles ZWJ sequences as one glyph', () => {
    expect(buildEmojiVisual('👩‍🚀', 3)).toBe('👩‍🚀👩‍🚀👩‍🚀');
  });

  it('returns empty for an empty glyph', () => {
    expect(buildEmojiVisual('   ', 5)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// End to end, over unmutated real generations
// ---------------------------------------------------------------------------

describe('validateFastFactData — real 2026-08-06 generations', () => {
  it('refuses to ship the sight-word drill: every item leaked', () => {
    // 7 text-large visuals showing the answer + 3 stems quoting it. Failing
    // loudly beats rendering an empty card or a 0-item "drill".
    expect(() => validateFastFactData(litLeakyFlat)).toThrow(/answer contract/);
  });

  it('ships the capitals drill intact — decorative emoji are not a leak', () => {
    const data = validateFastFactData(histCleanFlat);
    expect(data.challenges).toHaveLength(10);
    expect(data.challenges.every((c) => c.prompt.visual?.type === 'emoji')).toBe(true);
  });

  it('spreads the correct button across slots instead of parking it', () => {
    // Live counting drills put the key in slot 1 in 8/10 and 9/10 challenges.
    const data = validateFastFactData(histCleanFlat);
    const slots = data.challenges.map((c) =>
      c.options.findIndex((o) => o.toLowerCase() === c.correctAnswer.toLowerCase()));
    const worst = Math.max(...[0, 1, 2, 3].map((s) => slots.filter((x) => x === s).length));
    expect(worst / slots.length).toBeLessThanOrEqual(0.7);
    expect(new Set(slots).size).toBeGreaterThan(1);
  });

  it('keeps every challenge answerable after placement', () => {
    const data = validateFastFactData(histCleanFlat);
    for (const c of data.challenges) {
      const correct = c.options.filter((o) => o.trim().toLowerCase() === c.correctAnswer.trim().toLowerCase());
      expect(correct).toHaveLength(1);
    }
  });

  it('drops the "???" sentinel item rather than shipping it unwinnable', () => {
    const raw = {
      ...histCleanFlat,
      challenges: [
        ...histCleanFlat.challenges.slice(0, 6),
        flat({ id: 'cap_x', promptText: 'What is the capital of Maine?', correctAnswer: '', options: ['Augusta', 'Portland', 'Bangor'] }),
      ],
    };
    const data = validateFastFactData(raw as any);
    expect(data.challenges.map((c) => c.id)).not.toContain('cap_x');
    expect(data.challenges).toHaveLength(6);
  });

  it('strips a leaking emoji rather than dropping a salvageable item', () => {
    const raw = {
      ...histCleanFlat,
      challenges: [
        ...histCleanFlat.challenges.slice(0, 6),
        flat({ id: 'cnt_1', promptText: 'How many fingers are on one hand?', visualType: 'emoji', visualContent: '5', visualAlt: 'The numeral five', correctAnswer: '5', options: ['4', '5', '6'] }),
      ],
    };
    const data = validateFastFactData(raw as any);
    const kept = data.challenges.find((c) => c.id === 'cnt_1');
    expect(kept).toBeDefined();
    expect(kept?.prompt.visual).toBeUndefined();
  });

  it('warns when the surviving drill is too short to measure automaticity', () => {
    const raw = { ...histCleanFlat, challenges: histCleanFlat.challenges.slice(0, 3) };
    validateFastFactData(raw as any);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('below the 6-item floor'));
  });
});
