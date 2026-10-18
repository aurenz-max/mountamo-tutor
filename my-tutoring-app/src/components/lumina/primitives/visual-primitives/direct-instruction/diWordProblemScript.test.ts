/**
 * di-word-problem-setup — the item builder: the mode is the step list, every step carries one action contract,
 * stories the plan gates refuse are dropped, and the catalog wiring comes from the boss card.
 */

import { describe, it, expect } from 'vitest';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { WORD_PROBLEM_BENCH_THEME } from '../../../service/qa/di/wordProblemBench';
import {
  itemsFromProblems,
  type WordProblemItem,
  type WordProblemProblemSpec,
} from './diWordProblemScript';

const entry = DI_CATALOG.find((c) => c.id === 'di-word-problem-setup')!;

const SESSION: WordProblemProblemSpec[] = [
  { id: 'p1', frameId: 'comparison:more_person', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 8, challengeType: 'build_family' },
  { id: 'p2', frameId: 'change:gain_change', theme: WORD_PROBLEM_BENCH_THEME, first: 9, second: 15, challengeType: 'build_family' },
  { id: 'p3', frameId: 'part_whole:part', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 7, challengeType: 'build_family' },
];

const build = (specs: WordProblemProblemSpec[] = SESSION) => itemsFromProblems(specs);

const byId = (items: WordProblemItem[], id: string): WordProblemItem => {
  const it = items.find((i) => i.id === id);
  if (!it) throw new Error(`no item ${id} — have ${items.map((i) => i.id).join(', ')}`);
  return it;
};

describe('catalog wiring', () => {
  // On its boss the catalog carries no tutoring block (bound sessions send `tutoring: null`); the microphone
  // comes from the card.
  it('is wired from its boss card: manual turns and no catalog tutoring block', () => {
    expect(entry.audioInput).toEqual({ manual_activity: true });
    expect(entry.tutoring).toBeUndefined();
  });
});

describe('the mode is the step list', () => {
  it('expands one story into its judged steps, hands first then voice', () => {
    const { items } = build([SESSION[0]]);
    expect(items.map((i) => i.kind)).toEqual(['big_number', 'family', 'operation', 'solve']);
    expect(items.map((i) => i.answerKind)).toEqual(['gesture', 'voice', 'voice', 'voice']);
    expect(items.map((i) => i.responseClass)).toEqual([
      'manipulation', 'equation_statement', 'closed_set_choice', 'number_word_to_20',
    ]);
    expect(items[0].isFirstStep).toBe(true);
    expect(items[3].isLastStep).toBe(true);
  });

  it('find_big_number is place + work; classify_and_build adds the kind first', () => {
    const find = build([{ ...SESSION[0], challengeType: 'find_big_number' }]).items;
    expect(find.map((i) => i.kind)).toEqual(['big_number', 'solve']);
    const classify = build([{ ...SESSION[1], challengeType: 'classify_and_build' }]).items;
    expect(classify.map((i) => i.kind)).toEqual(['classify', 'big_number', 'family', 'operation', 'solve']);
    expect(classify[0].responseClass).toBe('closed_set_choice');
  });

  it('gives every step one action contract for screen, speech, and modality', () => {
    const { items } = build([SESSION[0]]);
    for (const item of items) {
      expect(item.answerKind).toBe(item.actionContract.answerKind);
      expect(item.actionContract.instruction).not.toBe('');
      expect(item.actionContract.label).not.toBe('');
      expect(item.actionContract.checkingInstruction).not.toBe('');
    }

    const focused = build([{ ...SESSION[0], challengeType: 'find_big_number' }]).items[0];
    expect(focused.actionContract.instruction).toBe(
      'Drag the story part that names the big amount into the big amount box.',
    );
  });

  it('rides the build-ahead number class only past twenty', () => {
    // 30 + 12 = 42: "forty-two" shares no token with "thirty" or "twelve".
    const { items } = build([{ ...SESSION[0], first: 30, second: 12, maxNumber: 100 }]);
    expect(byId(items, 'p1-solve').responseClass).toBe('number_word_to_120');
  });

  it('DROPS a story the plan gates refuse, and counts it', () => {
    const { items, dropped } = itemsFromProblems([
      { ...SESSION[0], id: 'zero', frameId: 'comparison:difference', first: 12, second: 12 },
      { ...SESSION[0], id: 'ok' },
    ]);
    expect(dropped).toBe(1);
    expect(new Set(items.map((i) => i.problemId))).toEqual(new Set(['ok']));
  });
});
