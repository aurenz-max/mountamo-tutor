import { describe, expect, it } from 'vitest';
import { seeded } from './buoyancyModel';
import type { Tier } from './volcanoModel';
import { DIKE_ID, NEW_ID, buildLayers, correctOrder, describeLayers, layersMiss, makeLayers } from './layersModel';
import { buildVolcanoIsland } from '../../../service/physics/volcano-island-generator';
import { validateVolcanoIslandData } from './volcanoIsland.boss';
import { layersScene } from './volcanoWorkspace';
import { CRACK_LEVER, EASIER_LEVER, NEW_LAYER_LEVER, VOLCANO_LEVERS, practiceItem } from './volcanoLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';

const TIERS: Tier[] = ['easy', 'medium', 'hard'];

describe('the layers model', () => {
  it('oldest first: the old layers bottom up, then the crack, then the new layer on top', () => {
    const c = makeLayers('x', ['soil', 'lava', 'ash'], 'pumice', true);
    expect(correctOrder(c)).toEqual(['L1', 'L2', 'L3', DIKE_ID, NEW_ID]);
  });
  it('names the miss: read top-down, the crack too early, or another slip', () => {
    const c = makeLayers('x', ['soil', 'lava', 'ash'], 'pumice', true);
    expect(layersMiss(c, [NEW_ID, 'L3', 'L2', 'L1', DIKE_ID])).toBe('top_is_oldest');
    expect(layersMiss(c, ['L1', DIKE_ID, 'L2', 'L3', NEW_ID])).toBe('crack_too_early');
    expect(layersMiss(c, ['L2', 'L1', 'L3', DIKE_ID, NEW_ID])).toBe('order_slip');
    expect(layersMiss(c, correctOrder(c))).toBeUndefined();
    expect(describeLayers(c, ['L1'])).toBe('put the layers in this order, oldest first: the soil with old roots layer');
  });
});

describe('layers items', () => {
  it('easy two old layers, medium three, hard three and a crack; old layers all differ; the new one is erupted rock', () => {
    for (const t of TIERS) for (let s = 1; s <= 15; s++) {
      const c = buildLayers(t, seeded(s), 'x');
      expect(c.layers).toHaveLength(t === 'easy' ? 2 : 3);
      expect(c.dike).toBe(t === 'hard');
      expect(new Set(c.layers.map(l => l.kind)).size).toBe(c.layers.length);
      expect(c.newKind).not.toBe('soil');
      expect(c.newKind).not.toBe(c.layers[c.layers.length - 1].kind);
    }
    for (const t of TIERS) expect(() => validateVolcanoIslandData(buildVolcanoIsland({ gradeLevel: 'Grade 4', supportTier: t }, 6, ['layers_over_time']))).not.toThrow();
  });
  it('the scene lists the layers bottom to top and the new one only once erupted', () => {
    const c = makeLayers('x', ['soil', 'lava'], 'ash', false);
    expect(JSON.stringify(layersScene(c, { guess: null, erupted: false, order: [] }).facts)).not.toContain('new layer of');
    expect(JSON.stringify(layersScene(c, { guess: 'top', erupted: true, order: [] }).facts)).toContain('new layer of grey ash');
  });
  it('levers: the new layer marked for top-down reading, the crack marked, then the easier cutaway', () => {
    const c = makeLayers('x', ['soil', 'lava', 'ash'], 'pumice', true);
    expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false, newLayer: true }, []), 'top_is_oldest')).toBe(NEW_LAYER_LEVER);
    expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false, newLayer: true }, []), 'crack_too_early')).toBe(CRACK_LEVER);
    expect(nextLever(VOLCANO_LEVERS.declare(c, { bothErupted: false, newLayer: true }, []), 'order_slip')).toBe(EASIER_LEVER);
    const p = practiceItem(c)!;
    expect(p).toMatchObject({ dike: false });
    expect(practiceItem(p)).toBeNull();
  });
});
