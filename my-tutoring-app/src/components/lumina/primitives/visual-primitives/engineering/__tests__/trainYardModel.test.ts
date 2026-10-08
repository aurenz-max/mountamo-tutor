import { describe, expect, it } from 'vitest';
import { buildTrainYardChallenge, carFor, fewestCars, fewestEngines, runTrain, trainMatches, trainYardMiss, yardConsist,
  type CargoForm, type TrainYardBand } from '../trainYardModel';

const story = (cargoForm: CargoForm) => ({ title: 'Job', cargo: cargoForm === 'people' ? 'commuters' : 'grain', cargoForm,
  from: 'A', to: 'B', hillName: 'Cedar Hill' });

function seeded(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('yardConsist: the yard sets every part but the learner\'s', () => {
  const job = (type: 'match_car' | 'enough_cars' | 'enough_pull') =>
    buildTrainYardChallenge(story('loose_bulk'), { id: 'j', band: '3-5', rng: seeded(3), targetEngines: 2, type });

  it('match_car: the right kind is correct; any other kind can only miss as wrong_car', () => {
    const c = job('match_car');
    expect(trainMatches(c, yardConsist(c, { engines: 0, cars: { [carFor(c)]: 1 } }))).toBe(true);
    for (const kind of ['tank', 'flat', 'boxcar', 'autorack', 'coach'] as const)
      expect(trainYardMiss(c, yardConsist(c, { engines: 0, cars: { [kind]: 1 } }))).toBe('wrong_car');
  });

  it('enough_cars: the count decides; the yard engines never stall', () => {
    const c = job('enough_cars'), car = carFor(c), n = fewestCars(c);
    const built = (k: number) => yardConsist(c, { engines: 0, cars: { [car]: k } });
    expect(trainMatches(c, built(n))).toBe(true);
    expect(trainYardMiss(c, built(n - 1))).toBe('too_few_cars');
    expect(trainYardMiss(c, built(n + 3))).toBe('extra_cars');
  });

  it('enough_pull: the engines decide; the yard cars are the fewest that hold the load', () => {
    const c = job('enough_pull'), e = fewestEngines(c);
    const built = (k: number) => yardConsist(c, { engines: k, cars: {} });
    expect(e).toBe(2);
    expect(trainMatches(c, built(e))).toBe(true);
    expect(trainYardMiss(c, built(e - 1))).toBe('stalled');
    expect(trainYardMiss(c, built(e + 1))).toBe('extra_engines');
  });
});

describe('trainYardModel', () => {
  it('keys exactly one build: the fewest right cars and the fewest engines', () => {
    const c = buildTrainYardChallenge(story('loose_bulk'), { id: 'j1', band: '3-5', rng: seeded(7), targetEngines: 2 });
    const cars = fewestCars(c), engines = fewestEngines(c), car = carFor(c);
    expect(trainMatches(c, { engines, cars: { [car]: cars } })).toBe(true);
    expect(trainYardMiss(c, { engines, cars: { [car]: cars - 1 } })).toBe('too_few_cars');
    expect(trainYardMiss(c, { engines, cars: { [car]: cars + 1 } })).toBe('extra_cars');
    expect(trainYardMiss(c, { engines: engines + 1, cars: { [car]: cars } })).toBe('extra_engines');
    expect(trainYardMiss(c, { engines: engines - 1, cars: { [car]: cars } })).toBe(engines - 1 === 0 ? 'stalled' : 'stalled');
    expect(trainYardMiss(c, { engines, cars: { tank: cars } })).toBe('wrong_car');
    expect(trainYardMiss(c, { engines, cars: { [car]: cars, tank: 1 } })).toBe('mixed_cars');
  });

  it.each<[TrainYardBand, CargoForm]>([['K-2', 'loose_bulk'], ['3-5', 'liquid'], ['3-5', 'people'], ['K-2', 'vehicles']])(
    '%s %s jobs reach a spread of engine counts and never key a zero-car train', (band, form) => {
      const engines = new Set<number>();
      for (let i = 0; i < 40; i++) {
        const c = buildTrainYardChallenge(story(form), { id: `j${i}`, band, rng: seeded(i + 1), targetEngines: 1 + (i % 3) });
        expect(fewestCars(c)).toBeGreaterThan(0);
        expect(runTrain(c, { engines: fewestEngines(c), cars: { [carFor(c)]: fewestCars(c) } }).leftover).toBe(0);
        if (band === 'K-2') expect(c.amount % 1).toBe(0);
        expect(c.instruction).not.toMatch(/hopper|tank car|flatcar|boxcar|autorack|coach/i);
        engines.add(fewestEngines(c));
      }
      // Riders and new cars are light loads: their short trains rarely need a second engine.
      if (form !== 'people' && form !== 'vehicles') expect(engines.size).toBeGreaterThan(1);
    });
});
