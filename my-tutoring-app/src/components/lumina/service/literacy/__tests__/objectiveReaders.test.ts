/**
 * Objective-text readers — the generator reads the objective the manifest
 * passed; nothing here is a field the curator has to remember.
 */
import { describe, expect, it } from 'vitest';
import {
  asksIndependentProduction,
  letterGroupFromText,
  lettersNamedIn,
  resolveObjectiveLetterGroup,
} from '../letterGroups';

const GROUP_1 = `Letter-Sound Group 1: s, a, t, i, p, n

**New Sounds Introduced:**
/s/, /ă/, /t/, /ĭ/, /p/, /n/

**Full Practice Set (Cumulative):**
s, a, t, i, p, n

**Focus:** Produce the correct, most common sound for each letter in the set when shown the grapheme (the letter shape). For example, when shown 'a', the student says /ă/ (as in 'apple'). It is crucial to teach clean sounds (e.g., a crisp /t/ sound, not "tuh").`;

const GROUP_2 = `Letter-Sound Group 2: c, k, e, h, r, m, d

**Full Practice Set (Cumulative):**
s, a, t, i, p, n, c, k, e, h, r, m, d`;

describe('lettersNamedIn', () => {
  it('reads a comma list as the set, in order, deduped', () => {
    expect(lettersNamedIn(GROUP_1)).toEqual(['s', 'a', 't', 'i', 'p', 'n']);
  });
  it('never treats the article "a" or prose letters as members', () => {
    expect(lettersNamedIn('Say a crisp sound. I can hear it. Not "tuh".')).toEqual([]);
  });
  it('expands "Group N" and keeps quoted letters', () => {
    expect(lettersNamedIn('Practice Group 1 with the letter \'m\'')).toEqual(['s', 'a', 't', 'i', 'p', 'n', 'm']);
  });
});

describe('letterGroupFromText / resolveObjectiveLetterGroup', () => {
  it('finds the smallest group containing every named letter', () => {
    expect(letterGroupFromText(GROUP_1)).toBe(1);
    expect(letterGroupFromText(GROUP_2)).toBe(2);
    expect(letterGroupFromText('short o words: hop, top')).toBeNull();
    expect(letterGroupFromText('the letters o, u, l')).toBe(3);
  });
  it('honors an explicit manifest group and lets the objective only raise it', () => {
    expect(resolveObjectiveLetterGroup(undefined, [GROUP_2])).toEqual({ group: 2, source: 'objective' });
    expect(resolveObjectiveLetterGroup(3, [GROUP_2])).toEqual({ group: 3, source: 'config' });
    expect(resolveObjectiveLetterGroup(1, [GROUP_2])).toEqual({ group: 2, source: 'objective' });
    expect(resolveObjectiveLetterGroup(undefined, ['letter sounds', undefined])).toEqual({ group: 1, source: 'default' });
  });
});

describe('asksIndependentProduction', () => {
  it('reads the assess-cold objective and not the teaching one', () => {
    expect(asksIndependentProduction('Independently produce the most common sound for each letter. Assess without first saying its sound.')).toBe(true);
    expect(asksIndependentProduction('Assess without saying its sound')).toBe(true);
    expect(asksIndependentProduction(GROUP_1)).toBe(false);
    expect(asksIndependentProduction(undefined)).toBe(false);
  });
});
