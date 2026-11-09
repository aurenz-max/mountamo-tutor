import { describe, expect, it } from 'vitest';
import { COVERAGE } from './lifeLab.fixtures';
import { lifeSay, lifeSpokenKey, lifeSpokenMisses, respondError, sayable } from './lifeLabSpoken';
import { LIFE_MODES } from './lifeLabWorld';

const SAID = ['part_for_the_job', 'spread_the_seeds', 'hide_from_the_hunter', 'survive_and_change'];

describe('how the child answers', () => {
  it('a world is sayable exactly when its answer is one named thing', () => {
    for (const m of LIFE_MODES) expect(sayable(COVERAGE[m].world), m).toBe(SAID.includes(m));
  });
  it('a part world is said by its look; the key, examples and misses come from code', () => {
    const c = COVERAGE.part_for_the_job;
    expect(lifeSpokenKey(c)).toMatchObject({ answer: 'thick short beak', alsoAccept: ['thick'] });
    expect(lifeSpokenMisses(c)[0]).toMatchObject({ id: 'wrong_part', examples: ['long thin beak', 'hooked beak', 'long pointed beak'] });
    expect(lifeSay(c)).toEqual({ correct: 'thick short beak', plainWrong: 'long thin beak' });
  });
  it('a seed world with two working shapes accepts both; a prediction names the color', () => {
    const wind = JSON.parse(JSON.stringify(COVERAGE.spread_the_seeds));
    wind.world.zones[0].cond.carrier = 'wind';
    expect(lifeSpokenKey(wind)).toMatchObject({ answer: 'paper wings', alsoAccept: ['fluffy top', 'wings', 'fluff'] });
    expect(lifeSpokenKey(COVERAGE.survive_and_change)).toMatchObject({ answer: 'more dark moths' });
    expect(lifeSpokenMisses(COVERAGE.survive_and_change)[0].id).toBe('wrong_prediction');
  });
  it('a production that does not fit is refused with the reason', () => {
    expect(respondError({ ...COVERAGE.where_it_lives, respond: 'say' })).toMatch(/cannot say: respond show/);
    expect(respondError({ ...COVERAGE.part_for_the_job, respond: 'show' })).toMatch(/respond say/);
    expect(lifeSpokenKey(COVERAGE.life_cycle)).toBeNull();
  });
});
