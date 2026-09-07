/**
 * KnowledgeCheck.production.di-script — the three PRODUCTION kinds of the KC
 * redesign (P2, 2026-09-05): the child sees a stimulus that is NOT the answer
 * and produces — says a name / value (`say_it`), says a count (`how_many`),
 * or points at a sign in a printed sentence (`point_to`). Fixtures are the
 * shapes the code-owned generator emits for the K subtraction pilot.
 * Plumbing from the shared testkit, never re-typed.
 */
import { describe, it, expect } from 'vitest';
import { checkPackGates, checkDiCatalogEntry } from '../../hooks/judgedScriptContract.testkit';
import { spokenSpansOf } from '../../hooks/judgedScriptContract';
import { ASSESSMENT_CATALOG } from '../../service/manifest/catalog/assessment';
import { buildArrangement, buildGlyphCard, buildNumberSentence, MINUS } from '../../service/insets/build';
import type { ProblemData, ProductionProblemData, TrueFalseProblemData } from '../../types';
import {
  affirmLine,
  closeLineFor,
  correctionLine,
  itemCue,
  itemsFromProblems,
  knowledgeCheckHarnessAnswers,
  knowledgeCheckPackBase,
  stimulusFor,
  tapVerdictCue,
} from '../knowledgeCheckScript';

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

const catalogEntry = ASSESSMENT_CATALOG.find((c) => c.id === 'knowledge-check')!;

describe('production kinds — pack gates', () => {
  it('a mixed set with all three production kinds passes every structural gate and is judged-viable', () => {
    const { items, judgedViable } = itemsFromProblems(productionSet());
    expect(judgedViable).toBe(true);
    expect(items.map((i) => i.kind)).toEqual(['how_many', 'point_to', 'say_it', 'true_false']);
    expect(checkPackGates(knowledgeCheckPackBase(items))).toEqual([]);
    expect(checkDiCatalogEntry(catalogEntry, knowledgeCheckPackBase(items), items[0])).toEqual([]);
  });

  it('point_to is the honest gesture: manipulation class, tap contract, no verdict branches in the ask cue', () => {
    const [item] = itemsFromProblems([pointToProblem()]).items;
    expect(item.answerKind).toBe('gesture');
    expect(item.responseClass).toBe('manipulation');
    const cue = itemCue(item);
    expect(cue).toContain('answers with their hands');
    expect(cue).not.toContain('If the answer is right');
  });

  it('say_it narrows its response class per card: numeral → number word, letter → letter_name, shape → shape_name', () => {
    const items = itemsFromProblems([sayItProblem(), letterProblem(), shapeProblem()]).items;
    expect(items.map((i) => i.responseClass)).toEqual(['number_word_to_20', 'letter_name', 'shape_name']);
  });
});

describe('production kinds — cue contracts', () => {
  it('say_it and how_many tell the blind tutor what is on screen, carry the accepted forms, and never leak in the ask', () => {
    const items = itemsFromProblems([howManyProblem(), sayItProblem()]).items;
    const howMany = itemCue(items[0]);
    expect(howMany).toContain('The screen shows 5 apples in a row, 2 crossed out (taken away).');
    expect(howMany).toContain('The correct answer is "three" (3).');
    expect(howMany).toContain('Counting out loud — one, two, three — is thinking, not an answer');
    expect(spokenSpansOf(howMany)[0]).toContain('How many are left?');
    expect(spokenSpansOf(howMany)[0]).not.toContain('three');
    const sayIt = itemCue(items[1]);
    expect(sayIt).toContain('The screen shows a card showing the numeral 7.');
    expect(sayIt).toContain('The answer is "seven", "7".');
    expect(spokenSpansOf(sayIt)[0]).not.toMatch(/seven|\b7\b/);
  });

  it('a letter card accepts the SOUND as well as the name', () => {
    const [item] = itemsFromProblems([letterProblem()]).items;
    expect(itemCue(item)).toContain("The letter's SOUND, said on its own, is also correct");
  });

  it('affirmations open Yes and echo the answer; corrections open My turn; the cap close names it', () => {
    const items = itemsFromProblems(productionSet()).items;
    for (const item of items.filter((i) => i.kind !== 'true_false')) {
      expect(affirmLine(item)).toMatch(/^Yes/);
      expect(correctionLine(item)).toMatch(/^My turn:/);
      expect(closeLineFor(item).toLowerCase()).toContain(item.expectedAnswer!.toLowerCase());
    }
    // Spoken kinds never name the answer in the correction (it is earned at
    // the cap). point_to is the exemption: the sign's NAME is the question side
    // ("touch the minus sign"), so the re-ask necessarily carries it.
    for (const item of items.filter((i) => i.kind === 'say_it' || i.kind === 'how_many')) {
      expect(correctionLine(item).toLowerCase()).not.toContain(item.expectedAnswer!.toLowerCase());
    }
  });

  it('the point verdict cue is code-computed over TOKEN positions', () => {
    const [item] = itemsFromProblems([pointToProblem()]).items;
    expect(tapVerdictCue(item, 1)).toContain('That is the correct sign.');
    expect(tapVerdictCue(item, 1)).toContain('Yes! That is the minus sign.');
    expect(tapVerdictCue(item, 3)).toContain('That is not the correct sign.');
    expect(tapVerdictCue(item, 3)).toContain('touched the "="');
  });

  it('the context channel stays answer-free: the ask only, never the card or the count', () => {
    const items = itemsFromProblems(productionSet()).items;
    expect(stimulusFor(items[0])).toBe('Some apples are crossed out. How many are left?');
    expect(stimulusFor(items[2])).toBe('What number is this?');
  });
});

describe('legacy evidence reaches the judged surface', () => {
  it('a choice item carries its planned inset and the contract describes it to the blind tutor', () => {
    const numberLine = { insetType: 'number-line' as const, min: 0, max: 10, ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], points: [{ value: 5, label: 'start' }] };
    const [item] = itemsFromProblems([{
      ...base, type: 'multiple_choice', id: 'mc9', question: 'Hop two from the dot. What number do you land on?',
      inset: numberLine,
      options: [{ id: 'A', text: 'six', emoji: '6️⃣' }, { id: 'B', text: 'seven', emoji: '7️⃣' }, { id: 'C', text: 'eight', emoji: '8️⃣' }],
      correctOptionId: 'B',
    }]).items;
    expect(item.kind).toBe('choice');
    expect(item.inset).toEqual(numberLine);
    expect(itemCue(item)).toContain('The screen shows this evidence: Number line [0, 10]');
    expect(itemCue(item)).toContain('start@5');
  });

  it('a text-only choice item carries no evidence line', () => {
    const [item] = itemsFromProblems([{
      ...base, type: 'multiple_choice', id: 'mc10', question: 'Which animal says moo?',
      options: [{ id: 'A', text: 'cow', emoji: '🐄' }, { id: 'B', text: 'duck', emoji: '🦆' }],
      correctOptionId: 'A',
    }]).items;
    expect(item.inset).toBeUndefined();
    expect(itemCue(item)).not.toContain('The screen shows');
  });
});

describe('production kinds — build gates', () => {
  it('a point_to whose target is not a token drops, failing the set (all-or-nothing)', () => {
    const { judgedViable } = itemsFromProblems([pointToProblem({ targetTokenId: 't9', correctOptionId: 't9' }), tfProblem()]);
    expect(judgedViable).toBe(false);
  });

  it('an ask that names the answer drops (the inset leak rule is the runtime gate too)', () => {
    const { judgedViable } = itemsFromProblems([howManyProblem({ ask: 'Three apples are left. How many?' })]);
    expect(judgedViable).toBe(false);
  });

  it('a production item with no stimulus drops', () => {
    const { judgedViable } = itemsFromProblems([sayItProblem({ stimulus: undefined as never })]);
    expect(judgedViable).toBe(false);
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
