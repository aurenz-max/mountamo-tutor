import { describe, expect, it } from 'vitest';
import { normalizeGradeLevel } from './geminiService';

describe('normalizeGradeLevel numeric curriculum grades', () => {
  it.each([
    ['Grade 1', 'elementary'],
    ['1', 'elementary'],
    ['Grade 6', 'middle-school'],
    ['8', 'middle-school'],
    ['Grade 9', 'high-school'],
    ['12', 'high-school'],
    ['K', 'kindergarten'],
  ])('maps %s to the existing %s band', (input, expected) => {
    expect(normalizeGradeLevel(input)).toBe(expected);
  });
});
