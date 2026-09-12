import { describe, expect, it } from 'vitest';
import type { JudgedRunSummary } from '../../../../hooks/useJudgedScriptRunner';
import {
  bondEquationFaultOf,
  buildBondItems,
  factFamilyCanonicalKeys,
  factFamilyForms,
  familyFaultOf,
  parseBondEquation,
} from '../numberBondScript';
import {
  bondActionOf,
  countersForAction,
  countersForParts,
  expandNumberBondInteractions,
  familyEquationFaultOf,
  groupsForBond,
  modeActionVerdictCue,
  numberBondInteractionCue,
  numberBondInteractionSummary,
  relatedQuestion,
} from '../numberBondModes';

const source = (type: string, whole = 7, part1 = 3) => buildBondItems(
  [{ id: type, type, whole, part1, part2: whole - part1 }],
  { band: '1', maxNumber: 10 },
).items;

const rawSummary = (items: ReturnType<typeof expandNumberBondInteractions>): JudgedRunSummary => ({
  outcomes: items.map((item) => ({ id: item.id, solved: true, corrections: 0, score: 100, seconds: 1 })),
  solvedCount: items.length,
  firstTryCount: items.length,
  attemptsCount: items.length,
  accuracy: 100,
  passed: true,
  hearTaps: 0,
  observations: [],
});

describe('Number Bond remaining mode adapters', () => {
  it('keeps token group identity stable across both related-fact turns', () => {
    const runtime = expandNumberBondInteractions(source('related-fact'));
    expect(runtime.map((item) => item.interactionPhase)).toEqual([
      'related-join', 'related-say-addend', 'related-separate', 'related-say-remainder',
    ]);
    const firstGroups = groupsForBond(runtime[0]);
    const secondGroups = groupsForBond(runtime[2]);
    expect(firstGroups).toEqual(secondGroups);
    expect(firstGroups.filter((group) => group === 'left')).toHaveLength(3);
    expect(firstGroups.filter((group) => group === 'right')).toHaveLength(4);
  });

  it('derives both spoken targets from the committed model', () => {
    const runtime = expandNumberBondInteractions(source('related-fact'));
    const joined = countersForAction(runtime[1], 'join');
    expect(relatedQuestion(runtime[1], joined)).toMatchObject({ answer: 4, answerGroup: 'right' });
    const separated = countersForAction(runtime[3], 'separate-right');
    expect(relatedQuestion(runtime[3], separated)).toMatchObject({ answer: 3, answerGroup: 'left' });
    expect(numberBondInteractionCue(runtime[3], {}, separated)).toContain('Private expected number: 3');
  });

  it('recognizes complete group transformations and leaves partial motion uncommitted', () => {
    const item = source('build-equation')[0];
    const groups = groupsForBond(item);
    expect(bondActionOf(countersForAction(item, 'join'), groups)).toBe('join');
    expect(bondActionOf(countersForAction(item, 'separate-left'), groups)).toBe('separate-left');
    expect(bondActionOf(countersForAction(item, 'separate-right'), groups)).toBe('separate-right');
    expect(bondActionOf(countersForAction(item, 'swap'), groups)).toBe('swap');
    const partial = countersForParts(item);
    partial[0] = 'whole';
    expect(bondActionOf(partial, groups)).toBeNull();
  });

  it('limits the open Build Equation choice to its offered join and separation actions', () => {
    const item = expandNumberBondInteractions(source('build-equation'))[0];
    expect(modeActionVerdictCue(item, countersForAction(item, 'join')).matched).toBe(true);
    expect(modeActionVerdictCue(item, countersForAction(item, 'separate-left')).matched).toBe(true);
    expect(modeActionVerdictCue(item, countersForAction(item, 'swap')).matched).toBe(false);
  });

  it('separates equation arithmetic, bond-number, and action matching', () => {
    const item = source('build-equation')[0];
    expect(bondEquationFaultOf(item, ['3', '+', '4', '=', '7'], 'join')).toBe('match');
    expect(bondEquationFaultOf(item, ['7', '=', '4', '+', '3'], 'join')).toBe('match');
    expect(bondEquationFaultOf(item, ['7', '-', '4', '=', '3'], 'join')).toBe('action');
    expect(bondEquationFaultOf(item, ['7', '-', '4', '=', '3'], 'separate-right')).toBe('match');
    expect(bondEquationFaultOf(item, ['7', '-', '4', '=', '2'], 'separate-right')).toBe('arithmetic');
    expect(bondEquationFaultOf(item, ['8', '-', '4', '=', '4'], 'separate-right')).toBe('numbers');
  });

  it('requires four unequal family forms but only two equal-part forms', () => {
    expect(factFamilyForms(3, 4)).toHaveLength(4);
    expect(factFamilyCanonicalKeys(7, 3, 4)).toEqual(new Set(['3+4=7', '4+3=7', '7-3=4', '7-4=3']));
    expect(factFamilyForms(3, 3)).toEqual(['add-left', 'subtract-left']);
    expect(factFamilyCanonicalKeys(6, 3, 3)).toEqual(new Set(['3+3=6', '6-3=3']));
    const equal = source('fact-family', 6, 3)[0];
    expect(familyFaultOf(equal, ['3+3=6', '6-3=3']).fault).toBe('match');
  });

  it('treats reversed equality as the same required form, not extra coverage', () => {
    const item = expandNumberBondInteractions(source('fact-family'))
      .find((candidate) => candidate.familyForm === 'add-left' && candidate.interactionPhase === 'family-build')!;
    expect(parseBondEquation('7=3+4', 7, 3, 4)?.familyFormKey).toBe('3+4=7');
    expect(familyEquationFaultOf(item, '7=3+4')).toBe('match');
    expect(familyEquationFaultOf(item, '4+3=7')).toBe('form');
  });

  it('collapses activity phases into existing logical assessment units', () => {
    const items = expandNumberBondInteractions([
      ...source('related-fact'),
      ...source('build-equation'),
      ...source('fact-family'),
    ]);
    const summary = numberBondInteractionSummary(items, rawSummary(items));
    expect(summary.outcomes).toHaveLength(4); // two relations + one equation + one family
    expect(summary.outcomes.map((outcome) => outcome.id)).toEqual([
      'related-fact::f0', 'related-fact::f1', 'build-equation', 'fact-family',
    ]);
    expect(summary.passed).toBe(true);
    expect(summary.attemptsCount).toBe(4);
  });

  it('keeps partial family success inspectable without completing the family', () => {
    const items = expandNumberBondInteractions(source('fact-family'));
    const raw = rawSummary(items);
    const failed = items.find((item) => item.interactionPhase === 'family-build' && item.familyForm === 'subtract-right')!;
    raw.outcomes = raw.outcomes.map((outcome) => outcome.id === failed.id
      ? { ...outcome, solved: false, score: 0, corrections: 2 }
      : outcome);
    const summary = numberBondInteractionSummary(items, raw);
    expect(summary.outcomes).toHaveLength(1);
    expect(summary.outcomes[0]).toMatchObject({ solved: false, score: 75, corrections: 2 });
  });
});
