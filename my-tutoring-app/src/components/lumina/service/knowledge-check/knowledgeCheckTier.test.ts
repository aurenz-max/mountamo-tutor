import { describe, it, expect } from 'vitest';
import { buildKcTierPrompt, checkTierShape, tierShape } from './knowledgeCheckTier';
import { uniqueOptionIds } from './gemini-knowledge-check';

describe('knowledge-check requested tier', () => {
  it('ramps countable shape within the grade, and Grade 1 keeps its bounds', () => {
    expect(['easy', 'medium', 'hard'].map((t) => tierShape(t as any, 'fill_in_blanks', 'elementary', '3').blanks)).toEqual([1, 2, 3]);
    expect(['easy', 'medium', 'hard'].map((t) => tierShape(t as any, 'fill_in_blanks', 'elementary', '1').blanks)).toEqual([1, 1, 1]);
    expect(tierShape('hard', 'matching_activity', 'elementary', '1').pairs).toBe(3);
    expect(tierShape('hard', 'sequencing_activity', 'elementary', '1').steps).toBe(4);
  });

  it('keeps one far option at every tier once there are two wrong options (drop_far_choice)', () => {
    const near = tierShape('hard', 'multiple_choice', 'elementary', '3').near!;
    expect(near(3)).toEqual([2, 2]);
    expect(near(2)).toEqual([1, 1]);
  });

  it('names only the subject ladder it was given', () => {
    const p = buildKcTierPrompt({ difficulty: 'hard', subject: 'SCIENCE' }, 'multiple_choice', 'elementary', '2', 4);
    expect(p).toContain('Science at HARD');
    expect(p).not.toContain('Reading and language');
    expect(buildKcTierPrompt(undefined, 'multiple_choice', 'elementary')).toBe('');
  });

  it('reports a shape that missed the tier', () => {
    const problem = { type: 'fill_in_blanks', blanks: [{}], textWithBlanks: 'x' } as any;
    expect(checkTierShape(problem, 'hard', 'elementary', '4')).toEqual(['blanks 1, want 3']);
    expect(checkTierShape(problem, 'hard', 'elementary', '1')).toEqual([]);
  });

  it('re-letters duplicate option ids and keeps the key on the tagged option', () => {
    const r = uniqueOptionIds([
      { id: 'A', distance: 'key' }, { id: 'A', distance: 'far' }, { id: 'C', distance: 'near' },
    ], 'A', ['A', 'B', 'C']);
    expect(r.options.map((o) => o.id)).toEqual(['A', 'B', 'C']);
    expect(r.correctOptionId).toBe('A');
    const moved = uniqueOptionIds([{ id: 'B', distance: 'far' }, { id: 'B', distance: 'key' }], 'B', ['A', 'B']);
    expect(moved.correctOptionId).toBe('B');
    expect(moved.options[1].id).toBe('B');
  });
});
