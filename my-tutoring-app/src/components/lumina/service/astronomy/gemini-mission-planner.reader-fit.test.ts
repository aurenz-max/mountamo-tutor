/**
 * Reader-fit: mission-planner, re-based on the 2026-10-16 rebuild.
 *
 * Item 15A / S7 (2026-08) found the grade rung read from prose, compared as a string ('K' >= '2' is true) and never
 * stamped. Those rulings still hold, re-stated against the rebuilt planner:
 *   1. The grade rung comes from the canonical grade, never from prose; the resolved rung is stamped on the data.
 *   2. K and Grade 1 get the ungraded story whatever the pin (user ruling 10-16); grades 2-5 get code-built items.
 *   3. Gemini writes the title and overview only (the triage leaks: travel days, the optimal window and the
 *      multipliers were all Gemini's, and the window descriptions stated the answer).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: (...a: unknown[]) => generateContentMock(...a) } },
}));
vi.mock('../evalMode', async (orig) => ({ ...(await orig() as object), resolveEvalModes: vi.fn(async () => null) }));

import { generateMissionPlanner, missionPlannerGradeFromGrade, missionRungIndex } from './gemini-mission-planner';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';
import { defaultModes, isStoryGrade, validMissionItem } from '../../primitives/visual-primitives/astronomy/missionWorkspace';
import type { GenerationContext } from '../generation/generationContext';

const ctx = (over: Partial<GenerationContext>): GenerationContext =>
  ({ topic: 'Planning a trip to Mars', gradeContext: 'grade 4 students (ages 9-10)', raw: {}, ...over } as GenerationContext);

beforeEach(() => {
  generateContentMock.mockReset();
  generateContentMock.mockResolvedValue({ text: JSON.stringify({ title: 'Mission Control', overview: 'Plan your mission.' }) });
});

describe('mission-planner: grade resolution', () => {
  it('canonical grade, K below every numbered grade, 6+ tops out at 5', () => {
    for (const g of ['K', 'k', 'kindergarten']) expect(missionPlannerGradeFromGrade(g)).toBe('K');
    expect(missionPlannerGradeFromGrade('7')).toBe('5');
    expect(missionPlannerGradeFromGrade('')).toBeNull();
    expect(missionRungIndex('K')).toBe(0);
    expect(missionRungIndex('2')).toBe(2);
  });
  it('the story grades are K and 1 only', () => {
    expect(['K', '1', 'Kindergarten', 'Grade 1'].map(isStoryGrade)).toEqual([true, true, true, true]);
    expect(['2', 'Grade 3', '5'].map(isStoryGrade)).toEqual([false, false, false]);
  });
});

describe('mission-planner: the generator', () => {
  it('stamps the canonical rung (a grade 4 request is not served the grade 1 screen) and builds keyed items', async () => {
    const d = await generateMissionPlanner(ctx({ grade: '4', gradeContext: 'grade 1 students' }));
    expect(d.gradeLevel).toBe('4');
    expect(d.challengeTypes).toEqual(defaultModes('4'));
    expect(d.items!.length).toBe(8);
    for (const i of d.items!) expect(validMissionItem(i)).toBe(true);
  });
  it('K gets the story even with a pin: no items, no modes', async () => {
    const d = await generateMissionPlanner(ctx({ grade: 'K', targetEvalMode: 'pick_window' }));
    expect(d.gradeLevel).toBe('K');
    expect(d.items).toEqual([]);
    expect(d.challengeTypes).toEqual([]);
    expect(d.story!.places).toEqual(['moon', 'mars']);
  });
  it('asks Gemini for the title only: no destinations, windows, supplies or overview', async () => {
    await generateMissionPlanner(ctx({ grade: '3' }));
    const schema = generateContentMock.mock.calls[0][0].config.responseSchema;
    expect(Object.keys(schema.properties)).toEqual(['title']);
  });
  it('a failed framing call still yields a working lesson', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('down'));
    const d = await generateMissionPlanner(ctx({ grade: '2' }));
    expect(d.title).toBeTruthy();
    expect(d.challengeTypes).toEqual(['farther_closer', 'pick_window']);
  });
});

describe('mission-planner: catalog', () => {
  const entry = ASTRONOMY_CATALOG.find(c => c.id === 'mission-planner')!;
  it('the workspace binds grades 2-5 only; K-1 is described as an ungraded story', () => {
    expect(entry.teachingWorkspace!.grades).toEqual(['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']);
    expect(entry.constraints).toMatch(/Kindergarten and Grade 1 MAY be routed here only as an ungraded story/);
  });
  it('is taught on its boss (missionPlanner.card.ts): no scripted tutoring block', () => {
    expect(entry.tutoring).toBeUndefined();
  });
});
