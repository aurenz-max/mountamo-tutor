import { describe, expect, it } from 'vitest';
import {
  BODY_TASKS, benchFor, flowErrors, judgeBuild, type BodyChallenge, type BodyGoal, type BodyPart, type BodyTask, type Tier,
} from './bodyModel';
import { BODY_ATLAS, animalsFor, fidelityErrors, jobFor, jobOf, newAt } from './bodyAtlas';

const item = (animal: string, goal: BodyGoal, task: BodyTask = 'deliver_oxygen', tier: Tier = 'hard'): BodyChallenge => {
  const a = BODY_ATLAS.find(x => x.id === animal)!;
  const j = jobOf(a, task)!;
  return { id: 'a', type: task, goal, animal, name: a.name, emoji: a.emoji, habitat: a.habitat,
    medium: task === 'fuel_the_body' ? 'outside_food' : a.medium, food: j.food, muscle: a.muscle, intro: a.intro,
    instruction: 'x', principle: j.principle[goal], jobs: j.jobs, bench: benchFor(task, goal, tier) };
};
const judge = (animal: string, goal: BodyGoal, build: BodyPart[], task: BodyTask = 'deliver_oxygen') =>
  judgeBuild(item(animal, goal, task), jobFor(animal, task)!, build);

describe('the atlas', () => {
  it('every real path flows, is the animal\'s, and can be built from its tier\'s bench, in both tasks', () => {
    for (const task of BODY_TASKS) for (const a of BODY_ATLAS) {
      const j = jobOf(a, task);
      if (!j) continue;
      const source = task === 'fuel_the_body' ? 'outside_food' : a.medium;
      for (const goal of ['into_body', 'to_muscle'] as const) for (const path of j.paths[goal]) {
        const at = `${task} ${a.id} ${goal}`;
        expect(flowErrors(task, goal, source, path), at).toEqual([]);
        expect(fidelityErrors(a, task, goal, path), at).toEqual([]);
        expect(path.every(p => benchFor(task, goal, j.tier).includes(p)), `${at} bench at ${j.tier}`).toBe(true);
        expect(judge(a.id, goal, [...path], task).correct, at).toBe(true);
      }
    }
  });
  it('K-3 paths are 1-4 parts; 4-5 paths reach a muscle in at most 6', () => {
    for (const task of BODY_TASKS) for (const a of BODY_ATLAS) {
      const j = jobOf(a, task);
      if (!j) continue;
      for (const p of j.paths.into_body) expect(p.length).toBeLessThanOrEqual(4);
      for (const p of j.paths.to_muscle) expect(p.length).toBeLessThanOrEqual(6);
    }
  });
  it('tiers grow with a contrast at each step', () => {
    expect(animalsFor('deliver_oxygen', 'easy').map(a => a.id)).toEqual(['human', 'dog', 'bird', 'fish']);
    expect(newAt('deliver_oxygen', 'medium').map(a => a.id)).toEqual(['whale', 'frog', 'tadpole']);
    expect(newAt('deliver_oxygen', 'hard').map(a => a.id)).toEqual(['grasshopper', 'earthworm']);
    expect(animalsFor('fuel_the_body', 'easy').map(a => a.id)).toEqual(['human', 'dog', 'fish']);
    expect(newAt('fuel_the_body', 'medium').map(a => a.id).sort()).toEqual(['bird', 'cow', 'frog']);
    expect(newAt('fuel_the_body', 'hard').map(a => a.id)).toEqual(['earthworm']);
    expect(benchFor('deliver_oxygen', 'into_body', 'easy')).toHaveLength(6);
    expect(benchFor('fuel_the_body', 'into_body', 'easy')).toHaveLength(6);
    expect(benchFor('fuel_the_body', 'to_muscle', 'hard')).toHaveLength(13);
  });
});

describe('judgeBuild names the miss and says what happened', () => {
  it('oxygen flow breaks', () => {
    expect(judge('human', 'into_body', ['nose', 'stomach'])).toMatchObject({ miss: 'food_path', at: 1 });
    expect(judge('human', 'into_body', ['lungs'])).toMatchObject({ miss: 'no_way_in', at: 0 });
    expect(judge('whale', 'into_body', ['mouth', 'gills'])).toMatchObject({ miss: 'wrong_breather' });
    expect(judge('fish', 'into_body', ['mouth', 'lungs'])).toMatchObject({ miss: 'wrong_breather' });
    expect(judge('fish', 'into_body', ['nose']).miss).toBe('wrong_breather');
    expect(judge('human', 'to_muscle', ['nose', 'windpipe', 'lungs', 'blood_tubes'])).toMatchObject({ miss: 'no_pump' });
    expect(judge('human', 'to_muscle', ['nose', 'windpipe', 'lungs'])).toMatchObject({ miss: 'no_pump', at: -1 });
    expect(judge('human', 'into_body', ['nose', 'windpipe'])).toMatchObject({ miss: 'stops_short', at: -1 });
  });
  it('food flow breaks', () => {
    const fuel = (animal: string, goal: BodyGoal, build: BodyPart[]) => judge(animal, goal, build, 'fuel_the_body');
    expect(fuel('human', 'into_body', ['nose', 'stomach'])).toMatchObject({ miss: 'breath_part', at: 0 });
    expect(fuel('human', 'into_body', ['mouth', 'lungs'])).toMatchObject({ miss: 'breath_part', at: 1 });
    expect(fuel('human', 'into_body', ['stomach'])).toMatchObject({ miss: 'no_way_in', at: 0 });
    expect(fuel('human', 'into_body', ['mouth', 'intestines'])).toMatchObject({ miss: 'not_mashed', at: 1 });
    expect(fuel('human', 'into_body', ['mouth', 'stomach']).why).toMatch(/still inside the belly/);
    expect(fuel('human', 'to_muscle', ['mouth', 'stomach', 'intestines'])).toMatchObject({ miss: 'no_pump', at: -1 });
    expect(fuel('human', 'to_muscle', ['mouth', 'stomach', 'intestines', 'blood_tubes'])).toMatchObject({ miss: 'no_pump' });
  });
  it('a path that flows but is not the real animal\'s', () => {
    const v = judge('grasshopper', 'into_body', ['nose', 'windpipe', 'lungs']);
    expect(v).toMatchObject({ miss: 'not_this_animal', at: 0 });
    expect(v.why).toMatch(/grasshopper has no nose/);
    expect(judge('frog', 'into_body', ['nose', 'windpipe', 'lungs']).why).toMatch(/almost no windpipe/);
    expect(judge('human', 'into_body', ['nose', 'lungs']).miss).toBe('skips_a_part');
    expect(judge('frog', 'into_body', ['wet_skin']).correct).toBe(true);
    // A cow's or a bird's food path built like a person's flows, but it is not theirs.
    expect(judge('cow', 'into_body', ['mouth', 'stomach', 'intestines'], 'fuel_the_body')).toMatchObject({ miss: 'not_this_animal' });
    expect(judge('bird', 'into_body', ['mouth', 'stomach', 'intestines'], 'fuel_the_body').why).toMatch(/no teeth/);
    expect(judge('bird', 'into_body', ['mouth', 'gizzard', 'intestines'], 'fuel_the_body').miss).toBe('skips_a_part');
    expect(judge('human', 'into_body', ['mouth', 'gizzard', 'intestines'], 'fuel_the_body').miss).toBe('not_this_animal');
  });
  it('no message names the part to use', () => {
    const bad: BodyPart[][] = [['stomach'], ['lungs'], ['mouth', 'gills'], ['nose', 'windpipe', 'lungs'], ['mouth', 'stomach', 'intestines'], ['mouth', 'intestines']];
    for (const task of BODY_TASKS) for (const a of BODY_ATLAS) {
      if (!jobOf(a, task)) continue;
      for (const b of bad) {
        const v = judge(a.id, 'into_body', b, task);
        if (v.correct) continue;
        expect(v.why).not.toMatch(/\b(use|try|needs? (the|a))\b.*\b(lungs|gills|blowhole|skin|air tubes|crop|gizzard|four-part)\b/i);
      }
    }
  });
});
