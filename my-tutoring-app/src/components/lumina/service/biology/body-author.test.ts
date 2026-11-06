import { describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
vi.mock('../evalMode', () => ({ resolveEvalModes: vi.fn(async () => null) }));
import { authorAnimals, authoredErrors, type AuthoredAnimal } from './body-author';
import { assembleBodyWorkshop, goalFor, gradeNumber } from './body-workshop-generator';
import { validateBodyWorkshopData } from '../../primitives/visual-primitives/biology/bodyWorkshop.boss';
import { BODY_TASKS, seededRng, type BodyGoal, type BodyTask } from '../../primitives/visual-primitives/biology/bodyModel';
import { animalsFor, newAt } from '../../primitives/visual-primitives/biology/bodyAtlas';

const FISH: AuthoredAnimal = {
  animal: 'fish', intro: 'A clownfish darts in and out of the coral reef.',
  principle: 'Water goes in and over the gills, and the gills pull the oxygen out of the water into the blood.',
  path: [{ part: 'mouth', job: 'Gulps water in.' }, { part: 'gills', job: 'Take the oxygen out of the water.' }],
};
const WHALE: AuthoredAnimal = {
  animal: 'whale', intro: 'A blue whale is the biggest animal in the sea.',
  principle: 'At the top of the water it breathes air into its lungs, which put the oxygen into its blood.',
  path: [{ part: 'blowhole', job: 'Opens to let air in.' }, { part: 'windpipe', job: 'Carries the air down.' }, { part: 'lungs', job: 'Pass oxygen into the blood.' }],
};
const BIRD: AuthoredAnimal = {
  animal: 'bird', intro: 'A sparrow hops on the ground looking for seeds.',
  principle: 'The seeds wait in a pouch, get ground up by tiny stones, and then the food soaks into the blood.',
  path: [{ part: 'mouth', job: 'Picks up seeds.' }, { part: 'crop', job: 'Holds the seeds.' },
    { part: 'gizzard', job: 'Grinds the seeds.' }, { part: 'intestines', job: 'Soak the food into the blood.' }],
};
const lesson = { topic: 'Ocean animals', gradeLevel: 'grade 2', grade: '2' };
const ids = (task: BodyTask) => animalsFor(task, 'medium').map(a => a.id);

describe('authoredErrors', () => {
  it('passes a real path in K-5 words, in both tasks', () => {
    expect(authoredErrors(FISH, 'deliver_oxygen', 'into_body', ids('deliver_oxygen'))).toEqual([]);
    expect(authoredErrors(WHALE, 'deliver_oxygen', 'into_body', ids('deliver_oxygen'))).toEqual([]);
    expect(authoredErrors(BIRD, 'fuel_the_body', 'into_body', ids('fuel_the_body'))).toEqual([]);
  });
  it('rejects a path that does not flow, is not the real animal\'s, or an animal outside the tier or task', () => {
    expect(authoredErrors({ ...WHALE, path: [{ part: 'mouth', job: 'x' }, { part: 'gills', job: 'y' }] }, 'deliver_oxygen', 'into_body', ids('deliver_oxygen')).join())
      .toMatch(/does not work: gills cannot take air/);
    expect(authoredErrors({ ...WHALE, path: WHALE.path.filter(p => p.part !== 'windpipe') }, 'deliver_oxygen', 'into_body', ids('deliver_oxygen')).join())
      .toMatch(/not the real animal/);
    expect(authoredErrors({ ...FISH, animal: 'grasshopper' }, 'deliver_oxygen', 'into_body', ids('deliver_oxygen')).join()).toMatch(/not an animal you may pick/);
    expect(authoredErrors({ ...BIRD, path: BIRD.path.filter(p => p.part !== 'gizzard') }, 'fuel_the_body', 'into_body', ids('fuel_the_body')).join())
      .toMatch(/does not work: intestines cannot take swallowed food/);
    expect(authoredErrors({ ...BIRD, animal: 'whale' }, 'fuel_the_body', 'into_body', ids('fuel_the_body')).join()).toMatch(/not an animal you may pick/);
  });
  it('rejects an intro that gives the path away and middle-school words', () => {
    expect(authoredErrors({ ...FISH, intro: 'A fish breathes with its gills.' }, 'deliver_oxygen', 'into_body', ids('deliver_oxygen')).join()).toMatch(/gives away the path/);
    expect(authoredErrors({ ...BIRD, intro: 'A bird grinds seeds in its gizzard.' }, 'fuel_the_body', 'into_body', ids('fuel_the_body')).join()).toMatch(/gives away the path/);
    expect(authoredErrors({ ...FISH, principle: 'Oxygen diffuses across the gill capillaries.' }, 'deliver_oxygen', 'into_body', ids('deliver_oxygen')).join()).toMatch(/too hard for grades K-5/);
    expect(authoredErrors({ ...BIRD, principle: 'It breathes.' }, 'fuel_the_body', 'into_body', ids('fuel_the_body')).join()).toMatch(/how the food gets there/);
  });
});

describe('authorAnimals', () => {
  it('repairs a failing animal with its errors, fills from the atlas, and keeps the tier contrast', async () => {
    const prompts: string[] = [];
    const bad = { ...WHALE, path: [{ part: 'mouth', job: 'x' }, { part: 'gills', job: 'y' }] };
    const call = vi.fn(async (p: string) => { prompts.push(p); return prompts.length === 1 ? [FISH, bad] : [WHALE]; });
    const r = await authorAnimals(lesson, 'deliver_oxygen', 'into_body', animalsFor('deliver_oxygen', 'medium'), newAt('deliver_oxygen', 'medium'), 3, seededRng(3), call);
    expect(r.calls).toBe(2);
    expect(prompts[1]).toMatch(/gills cannot take air/);
    expect(r.picks.slice(0, 2).map(p => `${p.words.animal}:${p.source}`)).toEqual(['fish:agent', 'whale:repaired']);
    expect(r.picks).toHaveLength(3);
  });
  it('falls back to the atlas when the agent fails, and still includes a tier-new animal', async () => {
    for (const task of BODY_TASKS) {
      const r = await authorAnimals(lesson, task, 'into_body', animalsFor(task, 'hard'), newAt(task, 'hard'), 3, seededRng(4), async () => { throw new Error('LUMINA_BUDGET: cap'); });
      expect(r.failure).toMatch(/LUMINA_BUDGET/);
      expect(r.picks.some(p => newAt(task, 'hard').some(a => a.id === p.words.animal))).toBe(true);
    }
  });
  it('a whole session validates on the boss for K-3 and 4-5 goals, in each task and mixed', async () => {
    for (const grade of ['K', '2', '4', '5']) {
      const n = gradeNumber(`grade ${grade}`, grade);
      const goal: BodyGoal = goalFor(n);
      const parts = await Promise.all(BODY_TASKS.map(async task => ({ task,
        authored: await authorAnimals(lesson, task, goal, animalsFor(task, 'hard'), newAt(task, 'hard'), 2, seededRng(5), async () => []) })));
      for (const set of [[parts[0]], [parts[1]], parts]) {
        const d = assembleBodyWorkshop(set, goal, 'hard', n, seededRng(9));
        expect(() => validateBodyWorkshopData(d)).not.toThrow();
        expect(d.gradeBand).toBe(n <= 2 ? 'K-2' : '3-5');
        expect(d.challenges.every(c => c.goal === (n <= 3 ? 'into_body' : 'to_muscle'))).toBe(true);
        expect(new Set(d.challenges.map(c => c.id)).size).toBe(d.challenges.length);
      }
      const mixed = assembleBodyWorkshop(parts, goal, 'hard', n, seededRng(9));
      expect(mixed.challenges.map(c => c.type)).toEqual(['deliver_oxygen', 'fuel_the_body', 'deliver_oxygen', 'fuel_the_body']);
      expect(mixed.challenges.filter(c => c.type === 'fuel_the_body').every(c => c.medium === 'outside_food' && !!c.food)).toBe(true);
    }
  });
});
