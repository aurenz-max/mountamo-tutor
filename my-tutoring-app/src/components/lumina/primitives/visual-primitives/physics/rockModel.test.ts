import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './volcanoModel';
import { buildRock, makeRock, pickRocks, rockFair, rockMiss, rockOf } from './rockModel';
import { buildVolcanoIsland } from '../../../service/physics/volcano-island-generator';
import { validateVolcanoIslandData } from './volcanoIsland.boss';
import { rockScene } from './volcanoWorkspace';
import { EASIER_LEVER, VOLCANO_LEVERS, ZOOM_LEVER, practiceItem } from './volcanoLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];

describe('the rock model', () => {
  it('slow makes big crystals, fast tiny, very fast glass; gassy and fast makes pumice', () => {
    expect(rockOf({ cooling: 'underground', gassy: false })).toBe('granite');
    expect(rockOf({ cooling: 'surface', gassy: false })).toBe('basalt');
    expect(rockOf({ cooling: 'sea', gassy: false })).toBe('obsidian');
    expect(rockOf({ cooling: 'surface', gassy: true })).toBe('pumice');
  });
  it('names the miss', () => {
    const t = [{ cooling: 'underground' as const, gassy: false }, { cooling: 'surface' as const, gassy: false }, { cooling: 'sea' as const, gassy: false }];
    const c = makeRock('r', t, t[1], ['underground', 'surface', 'sea']);
    expect(rockMiss(c, 'underground')).toBe('speed_swapped');
    expect(rockMiss(c, 'sea')).toBe('fast_mixup');
    expect(rockMiss(c, 'surface')).toBeUndefined();
    const p = makeRock('p', [...t, { cooling: 'surface', gassy: true }], { cooling: 'surface', gassy: true }, ['underground', 'surface', 'sea']);
    expect(rockMiss(p, 'sea')).toBe('missed_bubbles');
  });
});

describe('rock items', () => {
  it('every tier builds fair items; sessions vary the found rock; the generator is valid', () => {
    for (const t of TIERS) {
      for (let s = 1; s <= 10; s++) expect(rockFair(buildRock(t, seeded(s), 'x'))).toBe(true);
      const kinds = new Set(pickRocks(4, t, seeded(3), 'r').map(c => rockOf(c.mystery)));
      expect(kinds.size).toBeGreaterThan(1);
      expect(() => validateVolcanoIslandData(buildVolcanoIsland({ gradeLevel: 'Grade 5', supportTier: t }, 4, ['cool_the_rock']))).not.toThrow();
    }
  });
  it('the scene has no rock for a sample before it cools', () => {
    const c = buildRock('medium', seeded(2), 'r');
    const facts = JSON.stringify(rockScene(c, { guesses: [], cooled: c.tested.map(() => false), call: null }).facts);
    expect(facts).not.toContain('made rock');
  });
  it('levers: the crystal zoom first, then an easier test; easy has no easier one', () => {
    const c = buildRock('medium', seeded(2), 'r');
    expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false }, []), 'speed_swapped')).toBe(ZOOM_LEVER);
    expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false }, [ZOOM_LEVER]), 'speed_swapped')).toBe(EASIER_LEVER);
    expect(practiceItem(practiceItem(c)!)).toBeNull();
  });
});
