import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { seeded, type Tier } from './buoyancyModel';
import { capacity } from './boatModel';
import {
  clayOf, describeShape, makeShapeChallenge, passingShapes, pickShapeChallenges, shapeCandidates, shapeFeedback, shapeMatches,
  shapeMiss, type ShapeChallenge,
} from './shapeModel';
import { buildBuoyancyHarbor } from '../../../service/physics/buoyancy-harbor-generator';
import { validateBuoyancyHarborData } from './buoyancyHarbor.boss';
import { shapeScene } from './buoyancyWorkspace';
import { EASIER_LEVER, HARBOR_LEVERS, XRAY_LEVER, easierShape, practiceLeaks } from './buoyancyLevers';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const items = (): ShapeChallenge[] =>
  TIERS.flatMap(t => Array.from({ length: 12 }, (_, s) => pickShapeChallenges(4, t, seeded(s + 1), `m${t}${s}`))).flat();

describe('the shape model', () => {
  it('the clay ball and the flat sheet sink; the same clay with sides floats, and taller sides carry more', () => {
    for (const size of ['small', 'big'] as const) {
      expect(capacity(clayOf({ size }, 'ball'))).toBe(-1);
      expect(capacity(clayOf({ size }, 'flat'))).toBe(-1);
      expect(capacity(clayOf({ size }, 'low_sides'))).toBeGreaterThanOrEqual(1);
      expect(capacity(clayOf({ size }, 'tall_sides'))).toBeGreaterThan(capacity(clayOf({ size }, 'low_sides')));
    }
  });

  it('names the miss for each shape that fails', () => {
    const c = makeShapeChallenge('m', 'small', capacity(clayOf({ size: 'small' }, 'low_sides')) + 1);
    expect(shapeMiss(c, 'ball')).toBe('kept_a_lump');
    expect(shapeMiss(c, 'flat')).toBe('flat_sinks');
    expect(shapeMiss(c, 'low_sides')).toBe('sides_too_low');
    expect(shapeMatches(c, 'tall_sides')).toBe(true);
    expect(shapeFeedback(c, 'tall_sides')).toContain('same clay');
    expect(describeShape('flat', 'floats')).toBe('shaped the clay into a flat sheet (guessed it would float)');
  });
});

describe('shape items by tier', () => {
  it('easy floats it empty; medium carries a load low sides take; hard needs tall sides', () => {
    for (const c of items()) {
      const ok = passingShapes(c);
      expect(ok).not.toContain('ball');
      expect(ok).not.toContain('flat');
      const tier = c.id.slice(1, c.id.indexOf('-')).replace(/\d+$/, '');
      if (tier === 'easy') expect(c.goal).toBe(0);
      if (tier === 'medium') { expect(c.goal).toBeGreaterThan(0); expect(ok).toContain('low_sides'); }
      if (tier === 'hard') expect(ok).toEqual(['tall_sides']);
    }
  });

  it('every tier has candidates, and a session rises in goal', () => {
    for (const t of TIERS) expect(shapeCandidates(t).length).toBeGreaterThan(0);
    const goals = pickShapeChallenges(4, 'hard', seeded(5), 'x').map(c => c.goal);
    expect([...goals].sort((a, b) => a - b)).toEqual(goals);
  });

  it('the generator builds valid shape sessions, alone and mixed', () => {
    for (const t of TIERS) {
      const d = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: t }, 11, ['make_it_float']);
      expect(d.challenges.every(c => c.type === 'make_it_float')).toBe(true);
      expect(() => validateBuoyancyHarborData(d)).not.toThrow();
    }
    const mixed = buildBuoyancyHarbor({ gradeLevel: 'Grade 2', supportTier: 'medium' }, 3, ['drop_test', 'make_it_float', 'build_boat']);
    expect(mixed.challenges.map(c => c.type)).toContain('make_it_float');
    expect(() => validateBuoyancyHarborData(mixed)).not.toThrow();
  });

  it('the validator rejects a load no shape carries and a stuff other than clay', () => {
    const base = buildBuoyancyHarbor({ gradeLevel: 'Grade 1', supportTier: 'medium' }, 1, ['make_it_float']);
    const tooMuch = { ...base, challenges: [makeShapeChallenge('m', 'small', capacity(clayOf({ size: 'small' }, 'tall_sides')) + 1)] };
    expect(() => validateBuoyancyHarborData(tooMuch)).toThrow();
    const foil = { ...base, challenges: [{ ...makeShapeChallenge('m', 'small', 0), materials: ['foil'] as unknown as ['clay'] }] };
    expect(() => validateBuoyancyHarborData(foil)).toThrow();
  });
});

describe('what the tutor sees', () => {
  it('the scene names the goal, the clay and its shape, never which shapes carry the load', () => {
    for (const c of items()) {
      const facts = JSON.stringify(shapeScene(c, { draft: { material: 'clay', size: c.size, shape: 'ball' }, launched: false, pennies: 0, tests: [], guess: null }).facts);
      expect(facts).toContain('a ball');
      expect(facts).not.toMatch(/tall sides|low sides|flat sheet/);
    }
  });
});

describe('shape levers', () => {
  const c = makeShapeChallenge('m1', 'small', 2);
  const inWater = { settledTests: 0, boatLaunched: true };
  it('x-ray once the clay is in the water, and the easier item', () => {
    expect(HARBOR_LEVERS.declare(c, { settledTests: 0, boatLaunched: false }, []).map(l => l.id)).toEqual([EASIER_LEVER]);
    expect(HARBOR_LEVERS.declare(c, inWater, []).map(l => l.id)).toEqual([XRAY_LEVER, EASIER_LEVER]);
  });
  it.each(['kept_a_lump', 'flat_sinks', 'sides_too_low'])('%s -> x-ray, then the easier item', miss => {
    expect(nextLever(HARBOR_LEVERS.declare(c, inWater, []), miss)).toBe(XRAY_LEVER);
    expect(nextLever(HARBOR_LEVERS.declare(c, inWater, [XRAY_LEVER]), miss)).toBe(EASIER_LEVER);
  });
  it('the easier item floats the same clay empty; an empty item has none', () => {
    for (const item of items()) {
      const p = easierShape(item);
      if (!item.goal) { expect(p).toBeNull(); continue; }
      expect(p!.goal).toBe(0);
      expect(practiceLeaks(item, p!)).toBe(false);
    }
  });
});
