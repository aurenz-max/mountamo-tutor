import { describe, expect, it } from 'vitest';
import { DI_CATALOG } from '../../service/manifest/catalog/di';
import {
  DI_TESTER_PRESENTATION,
  DI_TESTER_PRESETS,
  DI_TESTER_PRIMITIVE_IDS,
  DI_TESTER_PRIMITIVES,
} from './diTesterLibrary';

describe('Direct Instruction tester library', () => {
  it('exposes every DI primitive and every catalog evaluation mode exactly once', () => {
    const expected = DI_CATALOG.flatMap((primitive) =>
      (primitive.evalModes ?? []).map((mode) => `${primitive.id}:${mode.evalMode}`),
    );
    const actual = DI_TESTER_PRESETS.map((preset) => preset.id);

    expect(DI_TESTER_PRIMITIVES.map((primitive) => primitive.id)).toEqual(
      DI_CATALOG.map((primitive) => primitive.id),
    );
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
  });

  it('provides a deliberate example objective for every current eval mode', () => {
    for (const primitiveId of DI_TESTER_PRIMITIVE_IDS) {
      const catalogPrimitive = DI_CATALOG.find((primitive) => primitive.id === primitiveId);
      const exampleKeys = Object.keys(DI_TESTER_PRESENTATION[primitiveId].examples).sort();
      const catalogKeys = (catalogPrimitive?.evalModes ?? []).map((mode) => mode.evalMode).sort();

      expect(exampleKeys, primitiveId).toEqual(catalogKeys);
    }
    expect(DI_TESTER_PRESETS.every((preset) => preset.objective.trim().length > 0)).toBe(true);
  });
});
