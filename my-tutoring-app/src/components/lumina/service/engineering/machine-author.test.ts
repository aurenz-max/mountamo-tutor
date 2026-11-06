import { describe, expect, it, vi } from 'vitest';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { authorMachines, authoredErrors, type AuthoredMachine } from './machine-author';
import { assembleMachineWorkshop } from './machine-workshop-generator';
import { validateMachineWorkshopData } from '../../primitives/visual-primitives/engineering/machineWorkshop.boss';
import { seededRng } from '../../primitives/visual-primitives/engineering/machineModel';

const JACK: AuthoredMachine = {
  machine: 'pump_jack', intro: 'A pump jack nods all day to lift oil out of the ground.', doesWord: 'pumps oil up from underground',
  principle: 'The crank goes round and round, and the rod turns that into a push and pull that rocks the beam up and down.',
  stages: [
    { part: 'motor', job: 'Spins fast.' }, { part: 'belt', job: 'Carries the spin.' }, { part: 'gearbox', job: 'Slows it down, makes it strong.' },
    { part: 'crank_rod', job: 'Turns the spin into a push and pull.' }, { part: 'walking_beam', job: 'Rocks like a seesaw.' },
    { part: 'pump', job: 'Lifts oil from the well.' },
  ],
};
const MILL: AuthoredMachine = {
  machine: 'stamp_mill', intro: 'A river works a stamp mill that crushes rock for gold.', doesWord: 'crushes the rock',
  principle: 'As the wheel turns, a bump lifts the stamp up and then lets it drop down on the rock.',
  stages: [{ part: 'water_wheel', job: 'The river turns it.' }, { part: 'cam_follower', job: 'Lifts and drops.' }, { part: 'stamp', job: 'Crushes rock.' }],
};
const lesson = { topic: 'Oil and energy', gradeLevel: 'grade 4', grade: '4' };

describe('authoredErrors', () => {
  it('passes a real, assembling machine', () => {
    expect(authoredErrors(JACK)).toEqual([]);
    expect(authoredErrors(MILL)).toEqual([]);
  });
  it('rejects a chain that does not assemble or is not the real machine', () => {
    const noGear = { ...JACK, stages: JACK.stages.filter(s => s.part !== 'gearbox') };
    expect(authoredErrors(noGear).join()).toMatch(/not the real machine: .*has a gearbox/);
    const camJack = { ...JACK, stages: JACK.stages.map(s => (s.part === 'crank_rod' ? { ...s, part: 'cam_follower' } : s)) };
    expect(authoredErrors(camJack).join()).toMatch(/crank and rod, not a cam and follower/);
    const backwards = { ...MILL, stages: [...MILL.stages].reverse() };
    expect(authoredErrors(backwards).join()).toMatch(/does not assemble/);
  });
  it('rejects words that name the part the child builds, and a principle with no motion change', () => {
    const leaky = { ...JACK, stages: JACK.stages.map(s => (s.part === 'gearbox' ? { ...s, job: 'Slows the spin for the crank.' } : s)) };
    expect(authoredErrors(leaky).join()).toMatch(/names the part the child must build \("crank"\)/);
    expect(authoredErrors({ ...MILL, intro: 'A cam crushes rock.' }).join()).toMatch(/intro names/);
    expect(authoredErrors({ ...MILL, principle: 'It is a very old machine.' }).join()).toMatch(/round-and-round motion becomes/);
  });
});

describe('authorMachines', () => {
  it('keeps the agent\'s passing machines, repairs a failing one with its errors, and fills from the atlas', async () => {
    const prompts: string[] = [];
    const bad = { ...JACK, stages: JACK.stages.filter(s => s.part !== 'walking_beam') };
    const call = vi.fn(async (p: string) => { prompts.push(p); return prompts.length === 1 ? [MILL, bad] : [JACK]; });
    const r = await authorMachines(lesson, 3, seededRng(3), call);
    expect(r.calls).toBe(2);
    expect(prompts[1]).toMatch(/has a walking beam/);
    expect(r.picks.map(p => `${p.words.machine}:${p.source}`).slice(0, 2)).toEqual(['stamp_mill:agent', 'pump_jack:repaired']);
    expect(r.picks).toHaveLength(3);
    expect(r.picks[2].source).toBe('atlas');
    expect(new Set(r.picks.map(p => p.words.machine)).size).toBe(3);
  });
  it('falls back to the atlas, ranked by the lesson, when the agent fails or stays wrong', async () => {
    const r = await authorMachines(lesson, 3, seededRng(4), async () => { throw new Error('LUMINA_BUDGET: cap'); });
    expect(r.failure).toMatch(/LUMINA_BUDGET/);
    expect(r.picks[0].words.machine).toBe('pump_jack');
    const wrong = { ...JACK, stages: JACK.stages.slice(1) };
    const r2 = await authorMachines(lesson, 1, seededRng(4), async () => [wrong]);
    expect(r2.picks[0]).toMatchObject({ source: 'atlas' });
    expect(r2.picks[0].errors.length).toBeGreaterThan(0);
  });
  it('a whole session from authored machines validates on the boss at every tier', async () => {
    const r = await authorMachines(lesson, 3, seededRng(5), async () => [JACK, MILL]);
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const d = assembleMachineWorkshop(r, tier, '3-5', seededRng(9));
      expect(d.challenges).toHaveLength(3);
      expect(() => validateMachineWorkshopData(d)).not.toThrow();
      expect(d.authoring?.sources.slice(0, 2)).toEqual(['pump_jack:agent', 'stamp_mill:agent']);
    }
  });
});
