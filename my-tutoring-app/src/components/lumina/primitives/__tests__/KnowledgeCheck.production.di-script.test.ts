/**
 * KnowledgeCheck.production.di-script — the three PRODUCTION kinds of the KC
 * redesign (P2, 2026-09-05): the child sees a stimulus that is NOT the answer
 * and produces — says a name / value (`say_it`), says a count (`how_many`),
 * or points at a sign in a printed sentence (`point_to`). Fixtures are the
 * shapes the code-owned generator emits for the K subtraction pilot.
 * Plumbing from the shared testkit, never re-typed.
 */
import { describe, it, expect } from 'vitest';
import { buildArrangement, buildGlyphCard, buildNumberSentence, MINUS } from '../../service/insets/build';
import type { ProblemData, ProductionProblemData, TrueFalseProblemData } from '../../types';
import { itemsFromProblems, knowledgeCheckHarnessAnswers } from '../knowledgeCheckScript';
import { knowledgeCheckAsk, knowledgeCheckAssignment, knowledgeCheckKey, knowledgeCheckMiss, knowledgeCheckScene,
  knowledgeCheckStep } from '../knowledgeCheckWorkspace';

const shown = (item: Parameters<typeof knowledgeCheckScene>[0]) => Object.values(knowledgeCheckScene(item, false).facts).join(' ');

const base = {
  difficulty: 'easy' as const,
  gradeLevel: 'kindergarten',
  rationale: 'Because that is how it works.',
  teachingNote: '',
  successCriteria: [],
};

const tfProblem = (): TrueFalseProblemData => ({
  ...base, type: 'true_false', id: 'tf1', statement: 'A spider has eight legs', correct: true,
});

const pointToProblem = (over: Partial<ProductionProblemData> = {}): ProductionProblemData => {
  const stimulus = buildNumberSentence({ a: 3, op: MINUS, b: 1 });
  return {
    ...base, type: 'production', id: 'pr1', kind: 'point_to',
    ask: 'Touch the minus sign.', stimulus,
    expectedAnswer: 'minus', alternates: ['take away'], targetTokenId: 't2',
    options: stimulus.tokens.map((t) => ({ id: t.id, text: t.text })), correctOptionId: 't2',
    ...over,
  };
};

const howManyProblem = (over: Partial<ProductionProblemData> = {}): ProductionProblemData => ({
  ...base, type: 'production', id: 'pr2', kind: 'how_many',
  ask: 'Some apples are crossed out. How many are left?',
  stimulus: buildArrangement({ emoji: '🍎', count: 5, removed: 2, layout: 'row', objectName: 'apples' }),
  expectedAnswer: 'three', alternates: ['3'],
  options: [{ id: 'A', text: '2', emoji: '2️⃣' }, { id: 'B', text: '3', emoji: '3️⃣' }, { id: 'C', text: '5', emoji: '5️⃣' }],
  correctOptionId: 'B',
  ...over,
});

const sayItProblem = (over: Partial<ProductionProblemData> = {}): ProductionProblemData => ({
  ...base, type: 'production', id: 'pr3', kind: 'say_it',
  ask: 'What number is this?',
  stimulus: buildGlyphCard({ glyphKind: 'numeral', glyph: '7' }),
  expectedAnswer: 'seven', alternates: ['7'],
  options: [{ id: 'A', text: '6', emoji: '6️⃣' }, { id: 'B', text: '7', emoji: '7️⃣' }, { id: 'C', text: '8', emoji: '8️⃣' }],
  correctOptionId: 'B',
  ...over,
});

const letterProblem = (): ProductionProblemData => sayItProblem({
  id: 'pr4', stimulus: buildGlyphCard({ glyphKind: 'letter', glyph: 'm' }), ask: 'What letter is this?',
  expectedAnswer: 'm', alternates: ['M'],
  options: [{ id: 'A', text: 'M' }, { id: 'B', text: 'N' }, { id: 'C', text: 'W' }], correctOptionId: 'A',
});

const shapeProblem = (): ProductionProblemData => sayItProblem({
  id: 'pr5', stimulus: buildGlyphCard({ glyphKind: 'shape', sides: 3 }), ask: 'What shape is this?',
  expectedAnswer: 'triangle', alternates: [],
  options: [{ id: 'A', text: 'triangle' }, { id: 'B', text: 'circle' }, { id: 'C', text: 'square' }], correctOptionId: 'A',
});

const productionSet = (): ProblemData[] => [howManyProblem(), pointToProblem(), sayItProblem(), tfProblem()];

describe('production kinds — items', () => {
  it('a mixed set with all three production kinds is judged-viable, each item on its step', () => {
    const { items, judgedViable } = itemsFromProblems(productionSet());
    expect(judgedViable).toBe(true);
    expect(items.map((i) => i.kind)).toEqual(['how_many', 'point_to', 'say_it', 'true_false']);
    expect(items.map(knowledgeCheckStep)).toEqual(['said', 'touched', 'said', 'said']);
  });

  it('point_to is the honest gesture: manipulation class, no key, a gesture assignment', () => {
    const [item] = itemsFromProblems([pointToProblem()]).items;
    expect(item.answerKind).toBe('gesture');
    expect(item.responseClass).toBe('manipulation');
    expect(knowledgeCheckKey(item)).toBeNull();
    expect(knowledgeCheckAssignment(item).response).toBe('gesture');
  });

  it('say_it narrows its response class per card: numeral → number word, letter → letter_name, shape → shape_name', () => {
    const items = itemsFromProblems([sayItProblem(), letterProblem(), shapeProblem()]).items;
    expect(items.map((i) => i.responseClass)).toEqual(['number_word_to_20', 'letter_name', 'shape_name']);
  });
});

describe('production kinds — keys and scene', () => {
  it('say_it and how_many show the tutor what is on screen, carry the accepted forms, and never leak in the ask', () => {
    const items = itemsFromProblems([howManyProblem(), sayItProblem()]).items;
    expect(shown(items[0])).toContain('5 apples in a row, 2 crossed out (taken away)');
    expect(knowledgeCheckKey(items[0])).toMatchObject({ answer: 'three', alsoAccept: ['3'] });
    expect(knowledgeCheckKey(items[0])!.acceptRule).toContain('Counting aloud is thinking');
    expect(knowledgeCheckKey(items[0])!.signatureError).toContain('including 5, the count before any were taken away');
    expect(knowledgeCheckAsk(items[0])).toContain('How many are left?');
    expect(knowledgeCheckAsk(items[0])).not.toContain('three');
    expect(shown(items[1])).toContain('a card showing the numeral 7');
    expect(knowledgeCheckKey(items[1])).toMatchObject({ answer: 'seven', alsoAccept: ['7'] });
    expect(knowledgeCheckAsk(items[1])).not.toMatch(/seven|\b7\b/);
  });

  it('a letter card accepts the sound as well as the name', () => {
    const [item] = itemsFromProblems([letterProblem()]).items;
    expect(knowledgeCheckKey(item)!.acceptRule).toContain("The letter's sound counts too.");
  });

  it('the point check is code-computed over TOKEN positions', () => {
    const [item] = itemsFromProblems([pointToProblem()]).items;
    expect(knowledgeCheckMiss(item, 't2')).toBeUndefined();
    expect(knowledgeCheckMiss(item, 't4')).toBe('sign_token');
    expect(knowledgeCheckMiss(item, 't1')).toBe('other_number_token');
  });
});

describe('legacy evidence reaches the judged surface', () => {
  it('a choice item carries its planned inset and the scene describes it to the tutor', () => {
    const numberLine = { insetType: 'number-line' as const, min: 0, max: 10, ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], points: [{ value: 5, label: 'start' }] };
    const [item] = itemsFromProblems([{
      ...base, type: 'multiple_choice', id: 'mc9', question: 'Hop two from the dot. What number do you land on?',
      inset: numberLine,
      options: [{ id: 'A', text: 'six', emoji: '6️⃣' }, { id: 'B', text: 'seven', emoji: '7️⃣' }, { id: 'C', text: 'eight', emoji: '8️⃣' }],
      correctOptionId: 'B',
    }]).items;
    expect(item.kind).toBe('choice');
    expect(item.inset).toEqual(numberLine);
    expect(shown(item)).toContain('The screen shows this evidence: Number line [0, 10]');
    expect(shown(item)).toContain('start@5');
  });

  it('a text-only choice item carries no evidence line', () => {
    const [item] = itemsFromProblems([{
      ...base, type: 'multiple_choice', id: 'mc10', question: 'Which animal says moo?',
      options: [{ id: 'A', text: 'cow', emoji: '🐄' }, { id: 'B', text: 'duck', emoji: '🦆' }],
      correctOptionId: 'A',
    }]).items;
    expect(item.inset).toBeUndefined();
    expect(shown(item)).not.toContain('The screen shows');
  });
});

describe('production kinds — build gates', () => {
  it('a point_to whose target is not a token drops to on screen', () => {
    const { items } = itemsFromProblems([pointToProblem({ targetTokenId: 't9', correctOptionId: 't9' }), tfProblem()]);
    expect(items.map((i) => i.kind)).toEqual(['on_screen', 'true_false']);
  });

  it('an ask that names the answer drops (the inset leak rule is the runtime gate too)', () => {
    const { items } = itemsFromProblems([howManyProblem({ ask: 'Three apples are left. How many?' })]);
    expect(items.map((i) => i.kind)).toEqual(['on_screen']);
  });

  it('a production item with no stimulus drops', () => {
    const { items } = itemsFromProblems([sayItProblem({ stimulus: undefined as never })]);
    expect(items.map((i) => i.kind)).toEqual(['on_screen']);
  });

  it('two how_many items with the same count are BOTH kept (the stimulus is the key, not the word)', () => {
    const { items } = itemsFromProblems([
      howManyProblem(),
      howManyProblem({
        id: 'pr2b',
        stimulus: buildArrangement({ emoji: '⭐', count: 4, removed: 1, objectName: 'stars' }),
        ask: 'Some stars are crossed out. How many are left?',
      }),
    ]);
    expect(items).toHaveLength(2);
  });
});

describe('production kinds — harness answers', () => {
  it('point_to: placed indices are TOKEN positions and the signature wrong is the other sign', () => {
    const [item] = itemsFromProblems([pointToProblem()]).items;
    const answers = knowledgeCheckHarnessAnswers(item);
    expect(answers.placed).toEqual({ correct: 1, wrong: 3 });
    expect(answers.signatureWrong?.text).toBe('=');
    expect(answers.leakTokens).toEqual([]);
  });

  it('how_many on a take-away: the signature wrong is the START count; the answer is the leak token', () => {
    const [item] = itemsFromProblems([howManyProblem()]).items;
    const answers = knowledgeCheckHarnessAnswers(item);
    expect(answers.correct).toBe('three');
    expect(answers.signatureWrong?.text).toBe('5');
    expect(answers.leakTokens).toContain('three');
  });

  it('say_it numeral: the signature wrong is the NEXT numeral', () => {
    const [item] = itemsFromProblems([sayItProblem()]).items;
    expect(knowledgeCheckHarnessAnswers(item).signatureWrong?.text).toBe('8');
  });
});
