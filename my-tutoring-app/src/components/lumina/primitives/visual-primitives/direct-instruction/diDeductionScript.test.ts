/**
 * di-deduction — the item builder: a rule becomes one judged case per shape, rules the plan gates refuse are
 * dropped, and the catalog wiring comes from the boss card.
 */

import { describe, it, expect } from 'vitest';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { DEDUCTION_BENCH_RULES } from '../../../service/qa/di/deductionBench';
import {
  itemsFromRules,
  type DeductionRuleSpec,
  type DeductionSupportTier,
} from './diDeductionScript';

const entry = DI_CATALOG.find((c) => c.id === 'di-deduction')!;

/** The mixed session — three rules, each worked through its shapes. */
const SESSION: DeductionRuleSpec[] = DEDUCTION_BENCH_RULES;

const build = (specs: DeductionRuleSpec[] = SESSION, tier?: DeductionSupportTier) => itemsFromRules(specs, tier);

describe('catalog wiring', () => {
  // On its boss the catalog carries no tutoring block (bound sessions send `tutoring: null`); the microphone
  // comes from the card.
  it('is wired from its boss card: manual turns and no catalog tutoring block', () => {
    expect(entry.audioInput).toEqual({ manual_activity: true });
    expect(entry.tutoring).toBeUndefined();
  });
});

describe('a rule becomes cases', () => {
  it('works each rule through its shapes in the DI order, one judged item per case', () => {
    const { items } = build();
    expect(items.map((i) => i.id)).toEqual([
      'ddb-insects-c0-conclude', 'ddb-insects-c1-deny',
      'ddb-birds-c0-conclude', 'ddb-birds-c1-deny', 'ddb-birds-c2-cannot_tell',
      'ddb-fish-c0-conclude', 'ddb-fish-c1-deny', 'ddb-fish-c2-cannot_tell',
    ]);
    expect(items.every((i) => i.answerKind === 'voice' && i.responseClass === 'deduction' && i.action === 'deduce')).toBe(true);
    expect(items.every((i) => i.answerKind === i.actionContract?.answerKind)).toBe(true);
    expect(items[0].isFirstCase).toBe(true);
    expect(items[1].isLastCase).toBe(true);
  });

  it('DROPS a rule the gates refuse, and a rule that promises a shape it cannot build', () => {
    const { items, dropped } = itemsFromRules([
      { ...SESSION[1], id: 'bad', propertyNegated: 'lays eggs' },
      { ...SESSION[0], id: 'no-lookalike', shapes: ['cannot_tell'] },
      { ...SESSION[1], id: 'ok', shapes: ['conclude'] },
    ]);
    expect(dropped).toBe(2);
    expect(items.map((i) => i.ruleId)).toEqual(['ok', 'ok']);
  });
});

describe('the fixture rules', () => {
  it('build through the shipped gates with no drops, and no cannot_tell where no lookalike exists', () => {
    const { items, dropped } = itemsFromRules(DEDUCTION_BENCH_RULES);
    expect(dropped).toBe(0);
    expect(items.filter((i) => i.ruleId === 'ddb-insects').map((i) => i.shape)).toEqual(['conclude', 'deny']);
  });
});
