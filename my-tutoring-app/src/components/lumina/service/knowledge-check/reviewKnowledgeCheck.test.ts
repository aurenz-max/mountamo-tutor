import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { decideReview, problemView, reviewQuestions } from './reviewKnowledgeCheck';
import type { ProblemData } from '../../types';

const base = { difficulty: 'easy' as const, gradeLevel: 'kindergarten', rationale: '', teachingNote: '', successCriteria: [] as string[] };
const mc = (question: string): ProblemData => ({ ...base, type: 'multiple_choice', id: 'mc', question, correctOptionId: 'a',
  options: [{ id: 'a', text: 'Green excavator' }, { id: 'b', text: 'Pink dump truck' }, { id: 'c', text: 'Sailboat' }] });
const views = [problemView(mc('Which machine digs?')), problemView(mc('Which machine scoops dirt?'))];
const clean = { gives_away: { noul: 0.3 }, evidence_agrees: { choice: 'no_evidence', probabilities: { no_evidence: 0.8 } },
  tempting_0: { noul: 0.75 }, tempting_1: { noul: 0.1 } };

describe('knowledge-check review decisions', () => {
  it('a choice problem asks one tempting question per wrong choice, and repeats only after the first problem', () => {
    expect(Object.keys(reviewQuestions(views[0], 0))).toEqual(['gives_away', 'evidence_agrees', 'tempting_0', 'tempting_1']);
    expect(Object.keys(reviewQuestions(views[1], 1))).toContain('repeats');
    expect(views[0].wrong_answers).toEqual(['Pink dump truck', 'Sailboat']);
  });

  it('passes a problem with one near-miss and no giveaway', () => {
    expect(decideReview(views[0], clean, views)).toMatchObject({ pass: true, temptingCount: 1, wrongTotal: 2 });
  });

  it('names each failure as a note the redraw can act on', () => {
    const review = decideReview(views[1], { ...clean, gives_away: { noul: 0.9 }, tempting_0: { noul: 0.2 },
      evidence_agrees: { choice: 'contradicts', probabilities: { contradicts: 0.7 } },
      repeats: { choice: 'same_as_1', probabilities: { same_as_1: 0.95 } } }, views);
    expect(review.pass).toBe(false);
    expect(review.repeats).toBe(1);
    expect(review.notes).toHaveLength(4);
    expect(review.notes[2]).toContain('"Which machine digs?"');
  });

  it('an uncertain repeat or contradiction does not fail the problem', () => {
    const review = decideReview(views[1], { ...clean, evidence_agrees: { choice: 'contradicts', probabilities: { contradicts: 0.4 } },
      repeats: { choice: 'same_as_1', probabilities: { same_as_1: 0.6 } } }, views);
    expect(review.pass).toBe(true);
  });
});
