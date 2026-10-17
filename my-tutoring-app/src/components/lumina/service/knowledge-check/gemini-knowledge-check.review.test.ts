import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemData } from '../../types';
import type { ProblemReview } from './reviewKnowledgeCheck';

vi.mock('server-only', () => ({}));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
vi.mock('./reviewKnowledgeCheck', async (orig) => ({
  ...(await orig<typeof import('./reviewKnowledgeCheck')>()),
  reviewKnowledgeCheckSet: vi.fn(),
}));

import { reviewAndRedraw } from './gemini-knowledge-check';
import { reviewKnowledgeCheckSet } from './reviewKnowledgeCheck';

const review = vi.mocked(reviewKnowledgeCheckSet);
const lesson = { topic: 'Measuring length', grade: 'Kindergarten' };
const mc = (id: string): ProblemData => ({ type: 'multiple_choice', id, question: id, correctOptionId: 'a', difficulty: 'easy',
  gradeLevel: 'kindergarten', rationale: '', teachingNote: '', successCriteria: [], options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] });
const ok = { pass: true, notes: [], blocking: false } as unknown as ProblemReview;
const unsolvable = { pass: false, notes: ['The learner cannot work the answer out'], blocking: true } as unknown as ProblemReview;
const soft = { pass: false, notes: ['Every wrong choice is easy to rule out'], blocking: false } as unknown as ProblemReview;

describe('knowledge-check review: a problem with no single right answer', () => {
  beforeEach(() => review.mockReset());

  it('is dropped when its redraw still has no single right answer', async () => {
    review.mockResolvedValueOnce([ok, unsolvable]).mockResolvedValueOnce([ok, unsolvable]);
    const out = await reviewAndRedraw([mc('p0'), mc('p1')], lesson, async () => mc('p1-redraw'));
    expect(out.map((p) => p?.id ?? null)).toEqual(['p0', null]);
  });

  it('ships the redraw when the redraw fixes it', async () => {
    review.mockResolvedValueOnce([ok, unsolvable]).mockResolvedValueOnce([ok, ok]);
    const out = await reviewAndRedraw([mc('p0'), mc('p1')], lesson, async () => mc('p1-redraw'));
    expect(out.map((p) => p?.id)).toEqual(['p0', 'p1-redraw']);
  });

  it('still ships a problem whose only failure is a soft note', async () => {
    review.mockResolvedValueOnce([ok, soft]).mockResolvedValueOnce([ok, soft]);
    const out = await reviewAndRedraw([mc('p0'), mc('p1')], lesson, async () => mc('p1-redraw'));
    expect(out.map((p) => p?.id)).toEqual(['p0', 'p1-redraw']);
  });

  it('keeps the last problem of a set rather than return nothing', async () => {
    review.mockResolvedValueOnce([unsolvable]).mockResolvedValueOnce([unsolvable]);
    const out = await reviewAndRedraw([mc('p0')], lesson, async () => mc('p0-redraw'));
    expect(out.map((p) => p?.id)).toEqual(['p0-redraw']);
  });
});
