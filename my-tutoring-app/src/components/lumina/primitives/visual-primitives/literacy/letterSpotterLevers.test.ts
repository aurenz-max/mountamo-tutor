/**
 * The letter-spotter tap-mode levers' leak rules, the practice builder, and "this wrong tap, then this lever"
 * (`/add-support-tiers`, handoff 22 L1).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LETTER_GROUPS } from '../../../service/literacy/letterGroups';
import type { LetterSpotterItem } from './letterSpotterScript';
import { letterSpotterMiss } from './letterSpotterWorkspace';
import { hasOtherCaseShape, letterSpotterLevers, partnerCapitals, practiceItem, practiceLeak, referenceLeaks } from './letterSpotterLevers';

const base = { answerKind: 'gesture', responseClass: 'manipulation', tier: 'medium' } as const;
const find = (id: string, target: string, grid: string): LetterSpotterItem => ({ ...base, id, mode: 'find-it', action: 'find-it',
  targetLetter: target, letterGrid: grid.split(''), options: [] }) as unknown as LetterSpotterItem;
const match = (id: string, target: string, options: string): LetterSpotterItem => ({ ...base, id, mode: 'match-it', action: 'match-it',
  targetLetter: target, options: options.split('') }) as unknown as LetterSpotterItem;
const GRID = 'DATINBSETINSARIN';

describe('the other-case reference', () => {
  it('is the lowercase of a capital grid, only where the cases differ in shape', () => {
    expect(referenceLeaks(find('f', 'b', GRID), 'b')).toBe(false);
    expect(referenceLeaks(find('f', 'b', GRID), 'B')).toBe(true);
    expect(hasOtherCaseShape('o')).toBe(false);
    expect(letterSpotterLevers(find('f', 'o', 'OATINBSETINSDRIN'), [], [], 3).map(l => l.id)).not.toContain('other_case_reference');
  });
});

describe('wrong-choice partners', () => {
  it('only the learner\'s own wrong taps, never the target', () => {
    const item = match('m', 'd', 'bdmt');
    expect(partnerCapitals(item, ['b', 'd', 'b', 'x'])).toEqual(['b']);
    expect(letterSpotterLevers(item, [], [item], 3).map(l => l.id)).toEqual(['two_far_choices']);
    expect(letterSpotterLevers(item, [], [item], 3, ['b']).map(l => l.id)).toEqual(['wrong_choice_partner', 'two_far_choices']);
  });
});

describe('the practice item', () => {
  it.each([1, 2, 3, 4])('group %i: a new letter the session never targets, among far letters', group => {
    const letters = LETTER_GROUPS[group].filter(l => l.length === 1);
    for (const t of letters) {
      const items = [find('f', t, GRID), match('m', letters[0], letters.slice(0, 3).join(''))];
      for (const item of items) {
        const practice = practiceItem(item, items, group);
        if (!practice) continue;
        expect(practiceLeak(practice, items)).toBe(false);
        expect(practice.id).toBe(`${item.id}~simpler`);
        expect(practice.mode).toBe(item.mode);
        const choices = practice.mode === 'find-it' ? practice.letterGrid! : practice.options;
        expect(choices).toHaveLength(practice.mode === 'find-it' ? 4 : 2);
        expect(choices.filter(c => c.toLowerCase() === practice.targetLetter)).toHaveLength(1);
        expect(choices.every(c => letters.includes(c.toLowerCase()))).toBe(true);
      }
    }
  });

  it('a group-3 session on b and d practises a among t, p, n', () => {
    const items = [find('f', 'b', GRID), match('m', 'd', 'bdmt')];
    expect(practiceItem(items[0], items, 3)).toMatchObject({ targetLetter: 'a' });
    expect(practiceItem(items[0], items, 3)!.letterGrid!.slice().sort()).toEqual(['A', 'N', 'P', 'T']);
    expect(practiceItem(items[1], items, 3)).toMatchObject({ targetLetter: 'a', options: ['a', 't'] });
  });
});

describe('levers and the miss they answer', () => {
  const items = [find('f', 'b', GRID), match('m', 'd', 'bdmt')];
  it.each([
    [items[0], 'D', 'same_shape_family', 'other_case_reference', []],
    [items[0], 'A', 'other_letter', 'row_scan', []],
    [items[1], 'b', 'mirror_form', 'wrong_choice_partner', ['b']],
    [items[1], 't', 'other_letter', 'wrong_choice_partner', ['t']],
  ] as const)('%#: %s is %s, then %s', (item, tapped, miss, lever, wrong) => {
    expect(letterSpotterMiss(item, tapped)).toBe(miss);
    expect(nextLever(letterSpotterLevers(item, [], items, 3, wrong), miss)).toBe(lever);
  });

  it('with the help pulled, the practice item is next', () => {
    expect(nextLever(letterSpotterLevers(items[1], ['wrong_choice_partner'], items, 3, ['b']), 'mirror_form')).toBe('two_far_choices');
    expect(nextLever(letterSpotterLevers(items[0], ['other_case_reference'], items, 3), 'same_shape_family')).toBe('small_far_grid');
  });
});
