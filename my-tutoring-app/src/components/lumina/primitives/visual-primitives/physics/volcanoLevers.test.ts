import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { makeKitchen } from './volcanoModel';
import { CHANGES_LEVER, EASIER_LEVER, FIZZ_LEVER, VOLCANO_LEVERS, practiceItem } from './volcanoLevers';
import { buildVolcanoIsland } from '../../../service/physics/volcano-island-generator';
import { validateVolcanoIslandData } from './volcanoIsland.boss';

describe('volcano levers', () => {
  const c = makeKitchen('k', { soda: 3, vinegar: 1 }, 'soda', false);
  it('fizz pairs only once both have erupted; the change marks and the easier item always', () => {
    expect(VOLCANO_LEVERS.declare(c, { bothErupted: false }, []).map(l => l.id)).toEqual([CHANGES_LEVER, EASIER_LEVER]);
    expect(VOLCANO_LEVERS.declare(c, { bothErupted: true }, []).map(l => l.id)).toEqual([FIZZ_LEVER, CHANGES_LEVER, EASIER_LEVER]);
  });
  it.each([['kept_prediction', FIZZ_LEVER], ['misread_result', FIZZ_LEVER], ['changed_both', CHANGES_LEVER], ['no_change', CHANGES_LEVER]])(
    '%s -> %s, then the easier item', (miss, first) => {
      expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: true }, []), miss)).toBe(first);
      expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: true }, [first]), miss)).toBe(EASIER_LEVER);
    });
  it('the easier item is a valid locked test where more makes it higher; an easy item has none', () => {
    const p = practiceItem(c)!;
    expect(p).toMatchObject({ id: 'k~easier', lockOther: true, change: 'soda' });
    expect(() => validateVolcanoIslandData({ title: 'x', challenges: [{ ...p, id: 'p' }] })).not.toThrow();
    expect(practiceItem(makeKitchen('e', { soda: 1, vinegar: 3 }, 'soda', true))).toBeNull();
    expect(buildVolcanoIsland({ gradeLevel: 'Grade 1', supportTier: 'easy' }, 2).challenges.every(x => x.startLevers?.includes(FIZZ_LEVER))).toBe(true);
  });
});
