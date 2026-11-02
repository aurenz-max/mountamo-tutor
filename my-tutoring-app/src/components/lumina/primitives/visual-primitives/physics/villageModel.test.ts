import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './volcanoModel';
import { fewestWalls, lavaPath, pickVillages, villageMatches, villageMiss, villageSafe } from './villageModel';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];

describe('save the village', () => {
  it('every tier builds maps where the lava reaches the village unblocked and exactly the tier\'s walls save it', () => {
    for (const t of TIERS) {
      const t0 = Date.now();
      const items = pickVillages(4, t, seeded(7), 'v');
      expect(items).toHaveLength(4);
      for (const c of items) {
        expect(villageSafe(c, [])).toBe(false);
        const fix = fewestWalls(c, 3)!;
        expect(fix).toHaveLength(t === 'easy' ? 1 : t === 'medium' ? 2 : 3);
        expect(villageMatches(c, fix)).toBe(true);
        expect(fix.length).toBeLessThanOrEqual(c.maxWalls);
      }
      expect(Date.now() - t0).toBeLessThan(4000);
    }
  });
  it('lava runs downhill from the crater and never through a wall; misses are named', () => {
    const [c] = pickVillages(1, 'easy', seeded(3), 'v');
    const path = lavaPath(c);
    expect(path[0]).toBe(c.crater);
    expect(path.length).toBeLessThanOrEqual(c.volume);
    const fix = fewestWalls(c)!;
    expect(lavaPath(c, fix)).not.toContain(fix[0]);
    expect(villageMiss(c, [])).toBe('walls_off_path');
    expect(villageMiss(c, fix)).toBeUndefined();
  });
});

import { buildVolcanoIsland } from '../../../service/physics/volcano-island-generator';
import { validateVolcanoIslandData } from './volcanoIsland.boss';
import { villageScene } from './volcanoWorkspace';
import { EASIER_LEVER, TRAIL_LEVER, VOLCANO_LEVERS, practiceItem } from './volcanoLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

describe('village sessions, scene and levers', () => {
  it('the generator builds valid sessions; the validator rejects a map no walls can save', () => {
    for (const t of TIERS) expect(() => validateVolcanoIslandData(buildVolcanoIsland({ gradeLevel: 'Grade 4', supportTier: t }, 9, ['save_the_village']))).not.toThrow();
    const d = buildVolcanoIsland({ gradeLevel: 'Grade 4' }, 2, ['save_the_village']);
    const c = d.challenges[0] as import('./villageModel').VillageChallenge;
    expect(() => validateVolcanoIslandData({ ...d, challenges: [{ ...c, maxWalls: 0 }] })).toThrow();
  });
  it('the scene names the map, walls and last test, never where a wall should go', () => {
    const [c] = pickVillages(1, 'medium', seeded(4), 'v');
    const fix = fewestWalls(c)!;
    const facts = JSON.stringify(villageScene(c, { walls: [], tests: 0, lastTestSafe: null }).facts);
    expect(facts).toContain('no test yet');
    for (const w of fix) expect(facts).not.toContain(`row ${Math.floor(w / 9) + 1}, column ${(w % 9) + 1}`);
  });
  it('levers: the lava trail after a test, then an easier map with one wall needed', () => {
    const [c] = pickVillages(1, 'hard', seeded(5), 'v');
    expect(VOLCANO_LEVERS.declare(c, { bothErupted: false, tested: false }, []).map(l => l.id)).toEqual([EASIER_LEVER]);
    expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false, tested: true }, []), 'walls_off_path')).toBe(TRAIL_LEVER);
    const p = practiceItem(c) as import('./villageModel').VillageChallenge;
    expect(fewestWalls(p)!).toHaveLength(1);
    expect(practiceItem(p)).toBeNull();
  });
});
