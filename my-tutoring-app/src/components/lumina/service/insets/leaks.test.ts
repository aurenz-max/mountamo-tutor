import { describe, expect, it } from 'vitest';
import { findInsetAnswerLeaks } from './leaks';
import { buildArrangement, buildGlyphCard, buildNumberSentence, MINUS, PLUS } from './build';
import { serializeInsetForPrompt } from './serialize';

/**
 * One SEEDED leak per stimulus type, and the clean form of each (P1 gate:
 * "leak rule catches a seeded leak per type"). The rules read the inset
 * STRUCTURE, which a string scan over the ask cannot see.
 */
describe('findInsetAnswerLeaks — number-sentence', () => {
  const sentence = buildNumberSentence({ a: 3, op: MINUS, b: 1 });

  it('clean: point_to names the sign (the task) but never prints the token', () => {
    expect(findInsetAnswerLeaks(sentence, {
      kind: 'point_to', ask: 'Touch the minus sign.', expectedAnswer: 'minus', targetTokenId: 't2',
    })).toEqual([]);
  });

  it('seeded: the ask prints the target token', () => {
    expect(findInsetAnswerLeaks(sentence, {
      kind: 'point_to', ask: 'Touch the − sign.', expectedAnswer: 'minus', targetTokenId: 't2',
    })).toEqual([expect.stringContaining('prints the target token')]);
  });

  it('seeded: a target id that is not a token', () => {
    expect(findInsetAnswerLeaks(sentence, {
      kind: 'point_to', ask: 'Touch the minus sign.', expectedAnswer: 'minus', targetTokenId: 't9',
    })).toEqual([expect.stringContaining('not a token')]);
  });

  it('seeded: a blank in a point_to item; and how_many needs exactly one blank', () => {
    const blanked = buildNumberSentence({ a: 3, op: PLUS, b: 1, blankResult: true });
    expect(findInsetAnswerLeaks(blanked, {
      kind: 'point_to', ask: 'Touch the plus sign.', expectedAnswer: 'plus', targetTokenId: 't2',
    })).toEqual([expect.stringContaining('blank token')]);
    expect(findInsetAnswerLeaks(sentence, {
      kind: 'how_many', ask: 'What number goes in the box?', expectedAnswer: 'two',
    })).toEqual([expect.stringContaining('exactly one blank')]);
    expect(findInsetAnswerLeaks(blanked, {
      kind: 'how_many', ask: 'What number goes in the box?', expectedAnswer: 'four', alternates: ['4'],
    })).toEqual([]);
  });

  it('seeded: the result is printed as a token while asked for', () => {
    const shown = buildNumberSentence({ a: 2, op: PLUS, b: 2 }); // 2 + 2 = 4, no blank
    const withBlankElsewhere = { ...shown, tokens: shown.tokens.map((t) => (t.id === 't3' ? { ...t, kind: 'blank' as const, text: '□' } : t)) };
    expect(findInsetAnswerLeaks(withBlankElsewhere, {
      kind: 'how_many', ask: 'What number is missing?', expectedAnswer: 'two', alternates: ['2'],
    })).toEqual([expect.stringContaining('printed as a token')]);
  });
});

describe('findInsetAnswerLeaks — arrangement', () => {
  it('clean: a take-away picture asked without any count', () => {
    const pic = buildArrangement({ emoji: '🍎', count: 5, removed: 2, objectName: 'apples' });
    expect(findInsetAnswerLeaks(pic, {
      kind: 'how_many', ask: 'Some apples are crossed out. How many are left?', expectedAnswer: 'three', alternates: ['3'],
    })).toEqual([]);
  });

  it('seeded: the ask states the count', () => {
    const pic = buildArrangement({ emoji: '🍎', count: 4 });
    expect(findInsetAnswerLeaks(pic, {
      kind: 'how_many', ask: 'Are there four apples? How many?', expectedAnswer: 'four', alternates: ['4'],
    })).toEqual(expect.arrayContaining([expect.stringContaining('names the answer')]));
  });

  it('seeded: both the start and the removed count are spoken (the picture is not needed)', () => {
    const pic = buildArrangement({ emoji: '🍎', count: 5, removed: 2 });
    expect(findInsetAnswerLeaks(pic, {
      kind: 'how_many', ask: 'There were five. Two are gone. How many are left?', expectedAnswer: 'three', alternates: ['3'],
    })).toEqual([expect.stringContaining('both the start count and the removed count')]);
  });

  it('groups: clean when the ask names no count; seeded when every addend is spoken', () => {
    const pic = buildArrangement({ emoji: '🍪', groups: [3, 2], objectName: 'cookies' });
    expect(pic).toMatchObject({ layout: 'groups', count: 5, groups: [3, 2] });
    expect(findInsetAnswerLeaks(pic, {
      kind: 'how_many', ask: 'Both groups are put together. How many altogether?', expectedAnswer: 'five', alternates: ['5'],
    })).toEqual([]);
    expect(findInsetAnswerLeaks(pic, {
      kind: 'how_many', ask: 'Three cookies and two cookies. How many altogether?', expectedAnswer: 'five', alternates: ['5'],
    })).toEqual([expect.stringContaining('every group count')]);
    expect(serializeInsetForPrompt(pic)).toBe('Picture: 3 cookies and 2 cookies, put together as two groups');
  });

  it('seeded: removed ≥ count is clamped by the builder, and a zero remainder is refused by the rule', () => {
    const pic = buildArrangement({ emoji: '⭐', count: 3, removed: 5 });
    expect(pic.removed).toBe(2);
    const zero = { ...pic, removed: 3 };
    expect(findInsetAnswerLeaks(zero, { kind: 'how_many', ask: 'How many are left?', expectedAnswer: 'zero' }))
      .toEqual(expect.arrayContaining([expect.stringContaining('remaining count is zero')]));
  });
});

describe('findInsetAnswerLeaks — glyph-card', () => {
  it('clean: a numeral card asked by "what number is this?"', () => {
    const card = buildGlyphCard({ glyphKind: 'numeral', glyph: '7' });
    expect(findInsetAnswerLeaks(card, { kind: 'say_it', ask: 'What number is this?', expectedAnswer: 'seven', alternates: ['7'] })).toEqual([]);
  });

  it('seeded: the ask names the answer', () => {
    const card = buildGlyphCard({ glyphKind: 'shape', sides: 3 });
    expect(findInsetAnswerLeaks(card, { kind: 'say_it', ask: 'Is this triangle a shape?', expectedAnswer: 'triangle' }))
      .toEqual([expect.stringContaining('names the answer')]);
  });

  it('seeded: the ask states the side count', () => {
    const card = buildGlyphCard({ glyphKind: 'shape', sides: 3 });
    expect(findInsetAnswerLeaks(card, { kind: 'say_it', ask: 'This has three sides. What shape?', expectedAnswer: 'triangle' }))
      .toEqual([expect.stringContaining('side count')]);
  });

  it('seeded: a card label that names the answer', () => {
    const card = { ...buildGlyphCard({ glyphKind: 'letter', glyph: 'm' }), label: 'the letter m' };
    expect(findInsetAnswerLeaks(card, { kind: 'say_it', ask: 'What letter is this?', expectedAnswer: 'm' }))
      .toEqual([expect.stringContaining('label names the answer')]);
  });

  it('a reading inset under a production kind is a routing defect', () => {
    expect(findInsetAnswerLeaks(
      { insetType: 'passage', text: 'x', format: 'prose' },
      { kind: 'say_it', ask: 'What is this?', expectedAnswer: 'x' },
    )).toEqual(expect.arrayContaining([expect.stringContaining('not a stimulus inset')]));
  });
});

describe('serializeInsetForPrompt — the blind tutor can SAY every stimulus', () => {
  it('reads a number sentence, an arrangement and a card', () => {
    expect(serializeInsetForPrompt(buildNumberSentence({ a: 3, op: MINUS, b: 1 })))
      .toBe('Printed number sentence: 3 − 1 = 2 (read: 3 minus 1 equals 2)');
    expect(serializeInsetForPrompt(buildArrangement({ emoji: '🍎', count: 5, removed: 2, layout: 'row', objectName: 'apples' })))
      .toBe('Picture: 5 apples in a row, 2 crossed out (taken away)');
    expect(serializeInsetForPrompt(buildGlyphCard({ glyphKind: 'shape', sides: 0 })))
      .toBe('a card showing a circle outline');
  });
});
