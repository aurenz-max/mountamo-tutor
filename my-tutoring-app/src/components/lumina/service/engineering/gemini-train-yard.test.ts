import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { assignTasks, cargoContradiction, generateTrainYard, selectJobs, trainYardBand } from './gemini-train-yard';
import { CAR_FOR_FORM, TRAIN_CARS, fewestCars, fewestEngines } from '../../primitives/visual-primitives/engineering/trainYardModel';

const generated = vi.mocked(ai.models.generateContent);

function ctx(grade = '4', targetEvalMode?: string): GenerationContext {
  return { componentId: 'train-yard', instanceId: 'test', topic: 'Passenger and freight trains', gradeLevel: 'elementary',
    targetEvalMode,
    gradeContext: `Grade ${grade}`, grade, intent: 'Build trains for freight and passenger jobs',
    objective: { text: 'Explain how freight and passenger trains move loads' }, scope: { topic: 'Trains' },
    raw: {} } as unknown as GenerationContext;
}

const job = (title: string, cargo: string, cargoForm: string) =>
  ({ title, cargo, cargoForm, from: 'Mill Town', to: 'Harbor City', hillName: 'Cedar Hill' });

const SIX = [
  job('Harvest Rush', 'grain', 'loose_bulk'),
  job('Fuel Run', 'heating oil', 'liquid'),
  job('Timber Haul', 'lumber', 'long_bundles'),
  job('Morning Commute', 'commuters', 'people'),
  job('Parts Express', 'car parts', 'boxed_goods'),
  job('Showroom Shipment', 'new cars', 'vehicles'),
];

const reply = (jobs: unknown[]) =>
  ({ text: JSON.stringify({ title: 'Train Yard: Rail Jobs', description: 'Build the right train for each job.', jobs }) }) as never;

const CAR_WORDS = /hopper|tank car|flatcar|boxcar|autorack|coach/i;

beforeEach(() => {
  generated.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('train-yard generator', () => {
  it('turns a valid 6-job reply into 4 numbered jobs with no car names in the ask', async () => {
    generated.mockResolvedValue(reply(SIX));
    const data = await generateTrainYard(ctx('4', 'build_train'));
    expect(generated).toHaveBeenCalledTimes(1); // a pin skips the intent micro-call
    expect(data.challenges.map(c => c.id)).toEqual(['ty-1', 'ty-2', 'ty-3', 'ty-4']);
    expect(new Set(data.challenges.map(c => c.cargoForm)).size).toBe(4);
    for (const c of data.challenges) {
      expect(c.instruction).not.toMatch(CAR_WORDS);
      expect(c.amount).toBeGreaterThan(0);
      expect(c.unit).toBe(TRAIN_CARS[CAR_FOR_FORM[c.cargoForm]].unit);
      expect(fewestCars(c)).toBeGreaterThan(0);
    }
    expect(data.challengeType).toBe('build_train');
    expect(data.gradeBand).toBe('3-5');
  });

  it('a pinned task gives every job that task, with no car names in its ask', async () => {
    for (const mode of ['match_car', 'enough_cars', 'enough_pull'] as const) {
      generated.mockResolvedValue(reply(SIX));
      const data = await generateTrainYard(ctx('2', mode));
      expect(data.challenges.every(c => c.type === mode)).toBe(true);
      expect(data.challengeType).toBe(mode);
      for (const c of data.challenges) expect(c.instruction).not.toMatch(CAR_WORDS);
    }
  });

  it('an engines-only session ships freight jobs that each need 2+ engines', async () => {
    for (const grade of ['1', '4']) for (let run = 0; run < 5; run++) {
      generated.mockResolvedValue(reply(SIX));
      const data = await generateTrainYard(ctx(grade, 'enough_pull'));
      expect(data.challenges.length).toBeGreaterThanOrEqual(3);
      for (const c of data.challenges) {
        expect(['people', 'vehicles']).not.toContain(c.cargoForm);
        expect(fewestEngines(c)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('an unresolved intent is mixed: one job of each task, easiest first', async () => {
    generated.mockResolvedValue(reply(SIX)); // the intent micro-call reads no modes from this reply -> mixed
    const data = await generateTrainYard(ctx());
    expect(generated).toHaveBeenCalledTimes(2);
    expect(new Set(data.challenges.map(c => c.type)).size).toBe(4);
    expect(data.challengeType).toBe('build_train');
  });

  it('rejects grain labelled liquid', async () => {
    generated.mockResolvedValue(reply([job('Bad Grain', 'grain', 'liquid'), ...SIX.slice(1)]));
    const data = await generateTrainYard(ctx());
    expect(data.challenges.some(c => c.cargo === 'grain')).toBe(false);
    expect(data.challenges).toHaveLength(4);
  });

  it('falls back to 4 jobs on an empty or garbage reply', async () => {
    generated.mockResolvedValue({ text: 'not json' } as never);
    const garbage = await generateTrainYard(ctx());
    expect(garbage.challenges).toHaveLength(4);
    expect(garbage.challenges.every(c => c.amount > 0)).toBe(true);

    generated.mockResolvedValue({ text: '' } as never);
    const empty = await generateTrainYard(ctx('1'));
    expect(empty.challenges.map(c => c.id)).toEqual(['ty-1', 'ty-2', 'ty-3', 'ty-4']);
    expect(empty.gradeBand).toBe('K-2');
  });

  it('keeps car parts boxed and new cars as vehicles', () => {
    expect(cargoContradiction('car parts', 'boxed_goods')).toBeNull();
    expect(cargoContradiction('new cars', 'vehicles')).toBeNull();
    expect(cargoContradiction('new cars', 'boxed_goods')).not.toBeNull();
    expect(cargoContradiction('furniture', 'boxed_goods')).toBeNull();
  });

  it('bands K, 1 and 2 as K-2 and unknown as 3-5', () => {
    expect(trainYardBand({ grade: 'K', gradeLevel: '', gradeContext: '' })).toBe('K-2');
    expect(trainYardBand({ grade: '2', gradeLevel: '', gradeContext: '' })).toBe('K-2');
    expect(trainYardBand({ grade: '3', gradeLevel: '', gradeContext: '' })).toBe('3-5');
    expect(trainYardBand({ grade: undefined, gradeLevel: 'kindergarten', gradeContext: '' })).toBe('K-2');
    expect(trainYardBand({ grade: undefined, gradeLevel: 'elementary', gradeContext: '' })).toBe('3-5');
  });
});

describe('assignTasks', () => {
  const s = (cargoForm: string) => job('J', `c-${cargoForm}`, cargoForm) as Parameters<typeof assignTasks>[0][number];
  it('never asks for engines on a light train when a freight job can take the task', () => {
    const stories = [s('loose_bulk'), s('liquid'), s('people'), s('boxed_goods')];
    const tasks = assignTasks(stories, ['match_car', 'enough_cars', 'enough_pull', 'build_train']);
    expect(tasks).toHaveLength(4);
    expect(new Set(tasks).size).toBe(4);
    expect(tasks[stories.findIndex(x => x.cargoForm === 'people')]).not.toBe('enough_pull');
  });
  it('a blend alternates its tasks, easiest first', () => {
    const stories = [s('loose_bulk'), s('liquid'), s('long_bundles'), s('boxed_goods')];
    expect(assignTasks(stories, ['enough_pull', 'match_car'])).toEqual(['match_car', 'match_car', 'enough_pull', 'enough_pull']);
  });
});

describe('selectJobs keeps the passenger job', () => {
  it('a people job the model wrote fifth still ships among the four', () => {
    const forms = ['loose_bulk', 'liquid', 'long_bundles', 'boxed_goods', 'people', 'vehicles'] as const;
    const stories = forms.map((cargoForm, i) => ({ title: `Job ${i}`, cargo: `cargo${i}`, cargoForm, from: 'A', to: 'B', hillName: 'H' }));
    const picked = selectJobs(stories, 4);
    expect(picked).toHaveLength(4);
    expect(picked.map(s => s.cargoForm)).toContain('people');
  });
});
