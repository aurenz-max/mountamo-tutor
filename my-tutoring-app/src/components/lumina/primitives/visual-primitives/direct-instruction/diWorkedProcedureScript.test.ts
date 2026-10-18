/**
 * di-worked-procedure — the item builder: a problem becomes one judged item per step, problems the plan gates
 * refuse are dropped, and the catalog wiring comes from the boss card.
 */

import { describe, it, expect } from 'vitest';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import {
  itemsFromProblems,
  type WorkedProblemSpec,
} from './diWorkedProcedureScript';

const entry = DI_CATALOG.find((c) => c.id === 'di-worked-procedure')!;

const SESSION: WorkedProblemSpec[] = [
  { id: 'p1', minuend: 52, subtrahend: 28, challengeType: 'subtract_regroup' },
  { id: 'p2', minuend: 342, subtrahend: 168, challengeType: 'subtract_regroup' },
  { id: 'p3', minuend: 75, subtrahend: 32, challengeType: 'subtract_no_regroup' },
];

describe('catalog wiring', () => {
  // On its boss the catalog carries no tutoring block (bound sessions send `tutoring: null`); the microphone
  // comes from the card.
  it('is wired from its boss card: manual turns and no catalog tutoring block', () => {
    expect(entry.audioInput).toEqual({ manual_activity: true });
    expect(entry.tutoring).toBeUndefined();
  });
});

describe('the step chain becomes items', () => {
  it('expands one problem into one judged item per step, in working order', () => {
    const { items } = itemsFromProblems([SESSION[0]]);
    expect(items.map((i) => `${i.place}:${i.kind}`)).toEqual([
      'ones:decide', 'ones:subtract', 'tens:decide',
    ]);
    expect(items.map((i) => i.responseClass)).toEqual([
      'procedure_step', 'number_word_to_20', 'procedure_step',
    ]);
    expect(items.every((i) => i.answerKind === 'voice' && i.action === 'talk_through')).toBe(true);
    expect(items.every((i) => i.answerKind === i.actionContract?.answerKind)).toBe(true);
    expect(items[0].isFirstStep).toBe(true);
    expect(items[2].isLastStep).toBe(true);
  });

  it('DROPS a problem the plan gates refuse, and one that contradicts its mode', () => {
    const { items, dropped } = itemsFromProblems([
      { id: 'flip', minuend: 53, subtrahend: 28, challengeType: 'subtract_regroup' },
      { id: 'lie', minuend: 75, subtrahend: 32, challengeType: 'subtract_regroup' },
      { id: 'ok', minuend: 75, subtrahend: 32, challengeType: 'subtract_no_regroup' },
    ]);
    expect(dropped).toBe(2);
    expect(items.map((i) => i.problemId)).toEqual(['ok', 'ok']);
  });
});
