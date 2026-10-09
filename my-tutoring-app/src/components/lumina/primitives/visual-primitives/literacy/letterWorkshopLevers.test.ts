import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { LetterWorkshopChallenge } from './LetterWorkshop';
import { getLetterTemplate, LETTER_TEMPLATES } from './letterWorkshopGeometry';
import { letterStructure, resolveSupportStructure } from './letterWorkshopDifficulty';
import {
  ARROWS_LEVER, COPY_PART_LEVER, DOTS_LEVER, FIRST_PART_LEVER, LINES_LEVER, MODEL_STROKES_LEVER, SIMPLER_LETTER_LEVER,
  TRACE_PART_LEVER, firstPart, firstPartLeaks, leverFacts, leverIdsFor, letterPart, letterWorkshopLevers, practiceItem,
  practiceLeaks, simplerLetter, startDots, startDotsLeak, startingLevers,
} from './letterWorkshopLevers';
import { GEOMETRY_MISSES, READING_MISSES, pathLength, templateOf } from './letterWorkshopWorkspace';

const item = (type: LetterWorkshopChallenge['type'], templateId: string, id = 'c1'): LetterWorkshopChallenge => ({ id, type, templateId });
const MODES = ['trace', 'copy', 'write'] as const;

describe('which levers an item declares', () => {
  it.each([
    [item('trace', 'lowercase-t'), [DOTS_LEVER, ARROWS_LEVER, LINES_LEVER, TRACE_PART_LEVER]],
    [item('copy', 'uppercase-B'), [MODEL_STROKES_LEVER, DOTS_LEVER, LINES_LEVER, COPY_PART_LEVER]],
    [item('write', 'lowercase-p'), [DOTS_LEVER, FIRST_PART_LEVER, LINES_LEVER, SIMPLER_LETTER_LEVER]],
  ])('%#', (ch, ids) => { expect(leverIdsFor(ch)).toEqual(ids); });

  it('starts the tier\'s guides as pulled: starts and arrows on trace only, the line labels in every mode', () => {
    for (const mode of MODES) for (const tier of [null, 'easy', 'medium', 'hard'] as const) {
      const s = resolveSupportStructure(mode, tier);
      expect(startingLevers(item(mode, 'lowercase-a'), s)).toEqual([
        ...(mode === 'trace' && s.showStarts ? [DOTS_LEVER] : []), ...(mode === 'trace' && s.showArrows ? [ARROWS_LEVER] : []),
        ...(s.showLineLabels ? [LINES_LEVER] : [])]);
    }
  });
});

describe('every checked miss has a help lever on every item, in every mode and tier (J12)', () => {
  const misses = (mode: string) => mode === 'trace' ? GEOMETRY_MISSES : [...READING_MISSES, ...GEOMETRY_MISSES];
  it.each(MODES.flatMap(mode => LETTER_TEMPLATES.map(t => [mode, t.id] as const)))('%s %s', (mode, id) => {
    const ch = item(mode, id);
    const levers = letterWorkshopLevers(ch, startingLevers(ch, resolveSupportStructure(mode, 'easy'))).filter(l => l.kind === 'help');
    for (const miss of misses(mode)) expect(levers.some(l => l.answers?.includes(miss)), miss).toBe(true);
  });
});

describe('next lever after a miss', () => {
  it.each([
    ['trace', 'start_or_order', [], DOTS_LEVER],
    ['trace', 'start_or_order', [DOTS_LEVER, ARROWS_LEVER], TRACE_PART_LEVER],
    ['trace', 'extra_ink', [DOTS_LEVER, ARROWS_LEVER], LINES_LEVER],
    ['copy', 'reversed', [], MODEL_STROKES_LEVER],
    ['copy', 'wrong_case', [], LINES_LEVER],
    ['write', 'other_letter', [], FIRST_PART_LEVER],
    ['write', 'stroke_count', [], DOTS_LEVER],
    ['write', 'wrong_case', [], LINES_LEVER],
    ['write', 'part_left_out', [FIRST_PART_LEVER, LINES_LEVER], SIMPLER_LETTER_LEVER],
  ] as const)('%s %s with %j pulled -> %s', (mode, miss, pulled, want) => {
    expect(nextLever(letterWorkshopLevers(item(mode, 'lowercase-b'), pulled), miss)).toBe(want);
  });
});

describe('leak rules', () => {
  it.each(LETTER_TEMPLATES.map(t => [t.id]))('%s: start dots are points only; the first part stays under a third of the letter', id => {
    const t = getLetterTemplate(id);
    expect(startDotsLeak(t, startDots(t))).toBe(false);
    expect(startDotsLeak(t, [...startDots(t), t.strokes[0][1] ?? t.strokes[0][0]])).toBe(true);
    const part = firstPart(t);
    expect(part.length).toBeGreaterThanOrEqual(2);
    expect(firstPartLeaks(t, part)).toBe(false);
    expect(firstPartLeaks(t, t.strokes[0])).toBe(true);
    expect(firstPartLeaks(t, part.map(p => ({ x: p.x + 20, y: p.y })))).toBe(true);
  });

  it('write facts never name the letter or its shape', () => {
    // The same words for every letter but the stroke count: nothing in them depends on which letter it is.
    const said = new Set(LETTER_TEMPLATES.map(t => { const ch = item('write', t.id);
      return (leverFacts(ch, leverIdsFor(ch)) ?? '').replace(/^A (numbered )?dot on the paper marks where (each of the \d+ strokes|the stroke) starts\./, 'DOTS.'); }));
    expect(said.size).toBe(1);
    expect(Array.from(said)[0]).not.toMatch(/curve|line down|bowl|circle|hump|tail|tall|short/i);
  });

  it('model_strokes is a copy lever only; first_part a write lever only', () => {
    expect(leverIdsFor(item('write', 'lowercase-a'))).not.toContain(MODEL_STROKES_LEVER);
    expect(leverIdsFor(item('trace', 'lowercase-a'))).not.toContain(FIRST_PART_LEVER);
    expect(leverIdsFor(item('copy', 'lowercase-a'))).not.toContain(FIRST_PART_LEVER);
  });
});

describe('simplify builders', () => {
  it.each(['trace', 'copy'] as const)('%s: the part keeps the mode, is a new item, and is less than the letter', mode => {
    for (const t of LETTER_TEMPLATES) {
      const ch = item(mode, t.id), p = letterPart(ch)!;
      expect(p).toMatchObject({ id: 'c1~simpler', type: mode, part: true, templateId: t.id });
      expect(practiceLeaks(ch, p)).toBe(false);
      const whole = t.strokes.reduce((n, s) => n + pathLength(s), 0), part = templateOf(p).strokes;
      expect(part.length).toBe(1);
      expect(pathLength(part[0])).toBeLessThan(whole);
      expect(practiceItem(p)).toBeNull();
    }
  });

  it('write: a different, simpler letter of the same case; never the letter, its mirror or another item\'s letter', () => {
    for (const t of LETTER_TEMPLATES) {
      const ch = item('write', t.id), others = [item('write', t.letterCase === 'lowercase' ? 'lowercase-l' : 'uppercase-L', 'c2')];
      const p = simplerLetter(ch, others);
      if (!p) {
        // Only when every simpler letter of the case is banned: this letter, its mirror, another item's letter.
        const mirror = ({ b: 'd', d: 'b', p: 'q', q: 'p' } as Record<string, string>)[t.letter];
        expect(LETTER_TEMPLATES.filter(c => c.letterCase === t.letterCase && !['l', t.letter.toLowerCase(), mirror].includes(c.letter.toLowerCase())
          && letterStructure(c.id).complexity < letterStructure(t.id).complexity)).toEqual([]);
        continue;
      }
      const u = getLetterTemplate(p.templateId);
      expect(p).toMatchObject({ id: 'c1~simpler', type: 'write' });
      expect(u.letterCase).toBe(t.letterCase);
      expect(letterStructure(u.id).complexity).toBeLessThan(letterStructure(t.id).complexity);
      expect(u.letter.toLowerCase()).not.toBe('l');
      expect(practiceLeaks(ch, p)).toBe(false);
    }
    expect(simplerLetter(item('write', 'lowercase-b'))?.templateId).not.toBe('lowercase-d');
  });
});
