import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './volcanoModel';
import { buildMagma, kindOf, magmaByKey, magmaFair, magmaMiss, makeMagma, outcomeOf, pickMagmas } from './magmaModel';
import { buildVolcanoIsland } from '../../../service/physics/volcano-island-generator';
import { validateVolcanoIslandData } from './volcanoIsland.boss';
import { magmaScene } from './volcanoWorkspace';
import { VOLCANO_LEVERS, MAGMA_TAGS_LEVER, EASIER_LEVER, practiceItem } from './volcanoLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];
const m = (k: string) => magmaByKey(k)!;

describe('the magma model', () => {
  it('runny flows (even with gas); thick and gassy explodes; thick and calm makes a dome', () => {
    expect(outcomeOf(m('kilauea'))).toBe('flows');
    expect(outcomeOf(m('fagradalsfjall'))).toBe('flows');
    expect(outcomeOf(m('st-helens'))).toBe('explodes');
    expect(outcomeOf(m('lassen'))).toBe('dome');
  });
  it('names the miss by thickness, else gas', () => {
    const c = makeMagma('x', [m('kilauea'), m('st-helens'), m('soufriere')], m('lassen'), ['flows', 'explodes', 'dome']);
    expect(magmaMiss(c, 'flows')).toBe('missed_thickness');
    expect(magmaMiss(c, 'explodes')).toBe('missed_gas');
    expect(magmaMiss(c, 'dome')).toBeUndefined();
  });
});

describe('magma items', () => {
  it('every tier builds fair items; hard has three kinds; easy mysteries match a test exactly', () => {
    for (const t of TIERS) for (let s = 1; s <= 15; s++) {
      const c = buildMagma(t, seeded(s), 'x')!;
      expect(magmaFair(c)).toBe(true);
      expect(c.outcomes).toHaveLength(t === 'hard' ? 3 : 2);
      if (t === 'easy') expect(c.tested.some(x => x.thick === c.mystery.thick && x.gas === c.mystery.gas)).toBe(true);
      expect(c.tested.some(x => kindOf(x) === kindOf(c.mystery))).toBe(true);
    }
    for (const t of TIERS) expect(pickMagmas(4, t, seeded(2), 'm')).toHaveLength(4);
  });
  it('the generator builds valid magma and mixed sessions', () => {
    for (const t of TIERS) expect(() => validateVolcanoIslandData(buildVolcanoIsland({ gradeLevel: 'Grade 4', supportTier: t }, 3, ['runny_or_sticky']))).not.toThrow();
    const mixed = buildVolcanoIsland({ gradeLevel: 'Grade 2' }, 4, ['kitchen_volcano', 'runny_or_sticky']);
    expect(new Set(mixed.challenges.map(c => c.type))).toEqual(new Set(['kitchen_volcano', 'runny_or_sticky']));
    expect(() => validateVolcanoIslandData(mixed)).not.toThrow();
  });
  it('the scene never has the new volcano\'s eruption before a right check', () => {
    for (const c of pickMagmas(4, 'hard', seeded(5), 'h')) {
      const facts = JSON.stringify(magmaScene(c, { guesses: [], erupted: c.tested.map(() => true), call: null, revealed: false }).facts);
      expect(facts).toContain(`${c.mystery.name}'s magma`);
      expect(facts).not.toContain('erupted after the check');
    }
  });
  it('levers: magma tags first for both misses, then the easier item, which is valid and simpler', () => {
    const c = makeMagma('x', [m('kilauea'), m('st-helens'), m('soufriere')], m('lassen'), ['flows', 'explodes', 'dome']);
    for (const miss of ['missed_thickness', 'missed_gas']) {
      expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false }, []), miss)).toBe(MAGMA_TAGS_LEVER);
      expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false }, [MAGMA_TAGS_LEVER]), miss)).toBe(EASIER_LEVER);
    }
    const p = practiceItem(c)!;
    expect(() => validateVolcanoIslandData({ title: 'x', challenges: [{ ...p, id: 'p' }] })).not.toThrow();
    expect(practiceItem(p)).toBeNull();
  });
});
