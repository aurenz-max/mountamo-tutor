import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateVerifiedStep } from './content-review';
import { reviewPredictions, directPredictionDisclosure, predictionExposure } from './prediction-review';
import { consolidateRepeatedAlgebra } from './step-ownership';
import { parseDiagramVisual, numberLineLandings, numberLineFromTicks, numberLineLabel } from '../../primitives/annotated-example/diagramVisual';
import type { ChallengeAssignment, RichAnnotatedExampleData } from '../../primitives/annotated-example/types';
import type { StepGeneratorContext } from './generators/_shared';
const generateContent = vi.mocked(ai.models.generateContent);
const fixture = (grade: number, phase = 'before') => JSON.parse(readFileSync(`qa/annotated-example-presentation/grade-${grade}-${phase}.json`, 'utf8')).fullData as RichAnnotatedExampleData;
const ctx: StepGeneratorContext = { topic: 'Equal groups', gradeContext: 'grade 3', problemStatement: 'Three bags each hold four apples.', solutionStrategy: 'Count fours.', groundingProse: 'Each bag adds 4 apples. Totals are 4, 8, 12.', pedagogicalGoal: 'Track a running total.', priorStepSummaries: [], seedNotes: '' };
const response = (value: unknown) => ({ text: JSON.stringify(value) }) as never;
beforeEach(() => generateContent.mockReset());

describe('worked-example content integrity', () => {
  it('derives exact fractional distances instead of accumulating rounded ninths', () => {
    const v = numberLineFromTicks({ min: 0, max: 1, divisions: 9, startTick: 0, jumpTicks: [1,1,1,1,1,1] });
    if (v.kind !== 'number-line') throw new Error('Wrong kind');
    const end = numberLineLandings(v).at(-1)!;
    expect(end).toBeCloseTo(2 / 3, 14);
    expect(numberLineLabel(v, end)).toBe('6/9');
    expect(() => numberLineFromTicks({ min: 0, max: 1, divisions: 9, startTick: 0, jumpTicks: [0.111] })).toThrow();
  });
  it('rejects malformed or clipped visuals, while preserving negative jumps and zero groups', () => {
    expect(() => parseDiagramVisual({ kind: 'number-line', min: 0, max: 10, divisions: 10, start: 8, jumps: [4] })).toThrow();
    expect(() => parseDiagramVisual({ kind: 'fraction-bar', numerator: 9, denominator: 8 })).toThrow();
    expect(() => parseDiagramVisual({ kind: 'drawing', shapes: [{ kind: 'text', x: 20, y: 20, text: 'Imagine a triangle' }] })).toThrow();
    expect(parseDiagramVisual({ kind: 'groups', counts: [0, 4], itemLabel: 'apple' })).toMatchObject({ counts: [0, 4] });
    const visual = parseDiagramVisual({ kind: 'number-line', min: -5, max: 5, divisions: 10, start: 2, jumps: [-4, 1] });
    if (visual.kind !== 'number-line') throw new Error('Wrong kind');
    expect(numberLineLandings(visual)).toEqual([2, -2, -1]);
  });
  it('retries a rejected table with feedback and records both attempts', async () => {
    const bad = fixture(3).steps.find(s => s.content.type === 'table')!;
    const good = structuredClone(bad);
    if (good.content.type !== 'table') throw new Error('Fixture needs a table');
    good.content.rows[1][1] = '$4$';
    generateContent.mockResolvedValueOnce(response({ issues: ['Second bag adds 4, not 8.'] })).mockResolvedValueOnce(response({ issues: [] }));
    const generate = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(good);
    const result = await generateVerifiedStep(ctx, generate);
    expect(result.content).toEqual(good.content);
    expect(generate.mock.calls[1][0].repairFeedback).toContain('Second bag adds 4');
    expect(result.generationReview).toEqual({ attempts: 2, rejections: [['Second bag adds 4, not 8.']] });
  });
  it('refuses an invalid/unreviewed required step after two attempts', async () => {
    generateContent.mockResolvedValue(response({ issues: ['Incorrect row quantity.'] }));
    const generate = vi.fn().mockResolvedValue(fixture(3).steps.find(s => s.content.type === 'table'));
    await expect(generateVerifiedStep(ctx, generate)).rejects.toThrow('both validation attempts');
    expect(generate).toHaveBeenCalledTimes(2);
    generateContent.mockResolvedValue(response({ valid: true }));
    await expect(generateVerifiedStep(ctx, generate)).rejects.toThrow('Malformed content review');
  });
  it('catches recorded scalar and fractional answer labels before calling the reviewer', async () => {
    for (const grade of [2, 4, 5]) {
      const data = fixture(grade);
      const a = data.solverDebug!.challenger!.assignments.find(a => ['37', '\\frac{4}{8}', '0.7'].includes(a.acceptableAnswers[0]));
      // Grade 4's diagram prediction asks for 4 jumps: test its actual labeled answer as a transition candidate.
      const assignment = a ?? { kind: 'transition', stepIndex: 3, transitionIndex: 0, hide: 'to', acceptableAnswers: ['\\frac{4}{8}'], prompt: 'Which fraction?', distractors: [], rationale: '' } as ChallengeAssignment;
      const input = { problemStatement: data.problem.statement, problemInset: data.problem.inset, solutionStrategy: data.solutionStrategy || '', steps: data.steps };
      expect(directPredictionDisclosure(input, assignment)).toBe(true);
      expect((await reviewPredictions(input, [assignment])).safe).toHaveLength(0);
    }
    expect(generateContent).not.toHaveBeenCalled();
  });
  it('keeps independently approved novel questions; missing or contradictory reviews cannot approve', async () => {
    const input = { problemStatement: 'Solve 2x + 3 = 11.', solutionStrategy: '', steps: fixture(3, 'after').steps };
    const assignment: ChallengeAssignment = { kind: 'transition', stepIndex: 0, transitionIndex: 0, hide: 'to', prompt: 'What is left?', acceptableAnswers: ['2x=8'], distractors: [], rationale: 'Subtract three.' };
    generateContent.mockResolvedValueOnce(response({ reviews: [{ index: 0, safe: true, reason: 'Novel and solvable.' }] }));
    expect((await reviewPredictions(input, [assignment])).safe).toHaveLength(1);
    generateContent.mockResolvedValueOnce(response({ reviews: [{ index: 0, safe: true, reason: '' }, { index: 0, safe: false, reason: 'Leaked' }] }));
    expect((await reviewPredictions(input, [assignment])).safe).toHaveLength(0);
    expect(predictionExposure(input, assignment).currentFrom).toBeDefined();
  });
  it('consolidates the recorded repeated multiplication without losing grounding coverage', () => {
    const data = fixture(3, 'after');
    consolidateRepeatedAlgebra(data.steps, data.solverDebug!.planner);
    expect(data.steps).toHaveLength(2); // Existing challenged content must not be mutated.
    data.steps.forEach(s => { if (s.content.type === 'algebra') s.content.transitions.forEach(t => { delete t.challenge; }); });
    consolidateRepeatedAlgebra(data.steps, data.solverDebug!.planner);
    expect(data.steps).toHaveLength(1);
    expect(data.solverDebug!.planner.specs[0].groundingBlockIndices).toEqual([0, 1]);
  });
  it('preserves a different derivation that reaches the same answer', () => {
    const data = fixture(3, 'after');
    data.steps.forEach(s => { if (s.content.type === 'algebra') s.content.transitions.forEach(t => { delete t.challenge; }); });
    if (data.steps[1].content.type === 'algebra') data.steps[1].content.transitions[0].from.latex = '4+4+4';
    consolidateRepeatedAlgebra(data.steps, data.solverDebug!.planner);
    expect(data.steps).toHaveLength(2);
  });
});
