/** PPA-G1: the grade comes from ctx.grade, then the normalized grade key, never gradeContext prose. */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

import { resolvePushPullGrade } from './gemini-push-pull-arena';

const K_PROSE = 'kindergarten students (ages 5-6) - Use clear language, relatable examples';

describe('resolvePushPullGrade', () => {
  it('serves K to a kindergarten objective (the prose regex served grade 1)', () => {
    expect(resolvePushPullGrade('K', 'kindergarten')).toBe('K');
    expect(resolvePushPullGrade(undefined, 'kindergarten')).toBe('K');
    expect(K_PROSE).not.toMatch(/grade\s*(\d|K)/i); // why the old parse fell to '1'
  });

  it('reads numeric grades and clamps to the configured range', () => {
    expect(resolvePushPullGrade('2', 'elementary')).toBe('2');
    expect(resolvePushPullGrade('8', 'middle-school')).toBe('5');
    expect(resolvePushPullGrade('0', '')).toBe('K');
  });

  it('defaults an unknown grade to 1', () => {
    expect(resolvePushPullGrade(undefined, 'elementary')).toBe('1');
  });
});
