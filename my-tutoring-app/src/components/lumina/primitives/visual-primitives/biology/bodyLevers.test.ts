import { describe, expect, it } from 'vitest';
import { containsPhrase } from '../../../components/live-activity/spokenKey';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import {
  BODY_TASKS, PART_NAMES, benchFor, judgeBuild, offJobParts, type BodyChallenge, type BodyGoal, type BodyPart, type BodyTask, type Tier,
} from './bodyModel';
import { BODY_ATLAS, jobFor, jobOf } from './bodyAtlas';
import {
  BODY_LEVERS, NO_BREATH_LEVER, NO_FOOD_LEVER, benchShown, partsCount, pathParts, practiceBody, practiceLeaks,
} from './bodyLevers';
import { bodyWorkshopCard } from './bodyWorkshop.card';

const item = (animal: string, goal: BodyGoal, task: BodyTask = 'deliver_oxygen', tier: Tier = 'hard'): BodyChallenge => {
  const a = BODY_ATLAS.find(x => x.id === animal)!;
  const j = jobOf(a, task)!;
  return { id: 'animal-1', type: task, goal, animal, name: a.name, emoji: a.emoji, habitat: a.habitat,
    medium: task === 'fuel_the_body' ? 'outside_food' : a.medium, food: j.food, muscle: a.muscle, intro: a.intro,
    instruction: `Build the path that gets oxygen to the ${a.name}'s ${a.muscle}.`, principle: j.principle[goal], jobs: j.jobs,
    bench: benchFor(task, goal, tier) };
};
const ALL = BODY_TASKS.flatMap(task => BODY_ATLAS.filter(a => jobOf(a, task))
  .flatMap(a => (['into_body', 'to_muscle'] as const).map(g => item(a.id, g, task))));

describe('leak rules', () => {
  it('every clue is offered and never names a part of the item\'s real path', () => {
    for (const c of ALL) {
      const ids = BODY_LEVERS.declare(c, { build: [] }, []).map(l => l.id);
      const clue = c.type === 'deliver_oxygen' ? 'where_it_breathes' : 'how_it_eats';
      expect(ids, `${c.type} ${c.animal} ${c.goal}`).toEqual(expect.arrayContaining([clue, 'animal_fact', 'count_parts', 'show_flow']));
      const j = jobFor(c.animal, c.type)!;
      for (const words of [j.clue, j.hasNo])
        for (const p of pathParts(c)) expect(containsPhrase(words, PART_NAMES[p]), `${c.animal}: "${words}" names ${p}`).toBe(false);
    }
  });
  it('count_parts gives how many, never which: the nearest real path\'s length', () => {
    expect(partsCount(item('human', 'into_body'), [])).toBe(3);
    expect(partsCount(item('frog', 'into_body'), ['wet_skin'])).toBe(1);
    expect(partsCount(item('frog', 'into_body'), ['nose'])).toBe(2);
    expect(partsCount(item('dog', 'to_muscle'), ['nose'])).toBe(5);
    expect(partsCount(item('bird', 'into_body', 'fuel_the_body'), [])).toBe(4);
  });
  it('the off-job lever removes only the other job\'s parts, the same for every animal', () => {
    for (const c of ALL) {
      const lever = c.type === 'deliver_oxygen' ? NO_FOOD_LEVER : NO_BREATH_LEVER;
      expect(benchShown(c, [lever])).toEqual(c.bench.filter(p => !offJobParts(c.type).includes(p)));
      for (const p of pathParts(c)) expect(offJobParts(c.type)).not.toContain(p);
    }
  });
});

describe('easier_animal', () => {
  it('every animal, task and goal gets a practice animal: familiar, solvable from its own bench, never the item\'s path', () => {
    for (const c of ALL) {
      const p = practiceBody(c);
      const at = `${c.type} ${c.animal} ${c.goal}`;
      const easyShareItsPath = BODY_ATLAS.filter(a => a.id !== c.animal && jobOf(a, c.type)?.tier === 'easy')
        .every(a => jobOf(a, c.type)!.paths[c.goal].some(ep => jobFor(c.animal, c.type)!.paths[c.goal].some(cp => ep.join() === cp.join())));
      if (easyShareItsPath) { expect(p, at).toBeNull(); continue; }
      expect(p, at).not.toBeNull();
      expect(practiceLeaks(p!, c), at).toBe(false);
      const pj = jobFor(p!.animal, c.type)!;
      expect(pj.tier, at).toBe('easy');
      expect(p!.goal).toBe(c.goal);
      expect(p!.bench.length).toBeLessThan(c.bench.length);
      const path = pj.paths[c.goal][0];
      expect(path.every(x => p!.bench.includes(x)), at).toBe(true);
      expect(judgeBuild(p!, pj, [...path]).correct, at).toBe(true);
      expect(practiceBody(p)).toBeNull();
    }
  });
  it('prefers an animal that breathes the same thing', () => {
    expect(practiceBody(item('whale', 'into_body'))!.medium).toBe('outside_air');
    expect(practiceBody(item('tadpole', 'into_body'))!.animal).not.toBe('fish'); // the same path as a tadpole's
  });
  it('food: a bird, cow or earthworm practises on a plain stomach; a plain-stomach animal gets no practice animal', () => {
    for (const id of ['bird', 'cow', 'earthworm']) expect(practiceBody(item(id, 'into_body', 'fuel_the_body'))).not.toBeNull();
    for (const id of ['human', 'frog']) expect(practiceBody(item(id, 'into_body', 'fuel_the_body'))).toBeNull();
    expect(BODY_LEVERS.declare(item('frog', 'into_body', 'fuel_the_body'), { build: [] }, []).map(l => l.id)).not.toContain('easier_animal');
  });
});

describe('a miss, then a lever', () => {
  it('every miss of each mode has a lever that answers it', () => {
    for (const task of BODY_TASKS) {
      const levers = BODY_LEVERS.declare(item('human', 'into_body', task), { build: [] }, []);
      for (const m of bodyWorkshopCard.modes[task].misses) expect(nextLever(levers, m), `${task} ${m}`).not.toBeNull();
    }
  });
  it.each([
    ['deliver_oxygen', 'whale', ['mouth', 'gills'], 'wrong_breather', 'where_it_breathes'],
    ['deliver_oxygen', 'grasshopper', ['nose', 'windpipe', 'lungs'], 'not_this_animal', 'animal_fact'],
    ['deliver_oxygen', 'human', ['nose', 'stomach'], 'food_path', 'no_food_parts'],
    ['deliver_oxygen', 'human', ['nose', 'lungs'], 'skips_a_part', 'count_parts'],
    ['deliver_oxygen', 'human', ['lungs'], 'no_way_in', 'show_flow'],
    ['fuel_the_body', 'human', ['nose', 'lungs'], 'breath_part', 'no_breath_parts'],
    ['fuel_the_body', 'bird', ['mouth', 'intestines'], 'not_mashed', 'how_it_eats'],
    ['fuel_the_body', 'cow', ['mouth', 'stomach', 'intestines'], 'not_this_animal', 'how_it_eats'],
    ['fuel_the_body', 'human', ['mouth', 'stomach'], 'stops_short', 'count_parts'],
  ] as const)('%s %s %j → %s → %s', (task, animal, build, miss, lever) => {
    const c = item(animal, 'into_body', task);
    expect(judgeBuild(c, jobFor(animal, task)!, build as unknown as BodyPart[]).miss).toBe(miss);
    expect(nextLever(BODY_LEVERS.declare(c, { build: build as unknown as BodyPart[] }, []), miss)).toBe(lever);
  });
  it('a pulled lever is passed over for the next one that answers the miss', () => {
    const c = item('whale', 'into_body');
    expect(nextLever(BODY_LEVERS.declare(c, { build: [] }, ['where_it_breathes']), 'wrong_breather')).toBe('show_flow');
    expect(nextLever(BODY_LEVERS.declare(c, { build: [] }, ['animal_fact']), 'not_this_animal')).toBe('easier_animal');
    expect(BODY_LEVERS.declare(c, { build: [] }, []).find(l => l.id === 'show_flow')!.answers).not.toContain('not_this_animal');
    expect(BODY_LEVERS.declare(item('human', 'into_body', 'fuel_the_body'), { build: [] }, []).find(l => l.id === 'show_flow')!.answers)
      .toEqual(['breath_part', 'no_way_in', 'not_mashed', 'no_pump', 'stops_short', 'blocked']);
    const cow = item('cow', 'into_body', 'fuel_the_body');
    expect(nextLever(BODY_LEVERS.declare(cow, { build: [] }, ['how_it_eats']), 'not_this_animal')).toBe('animal_fact');
  });
});
