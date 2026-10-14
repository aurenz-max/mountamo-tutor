/**
 * multiplication-explorer facts from an item space (service/itemSpace, skill /add-item-space).
 *
 * The explorer already draws its facts in code (selectFacts), uniformly over the grade band, so a
 * tier never changed which fact a learner got: easy and hard drew from the same pool. With a tier and
 * an objective the resolver fits to a strand, the space picks each challenge's fact at the tier's
 * beta band; the LLM still writes only the words, and the tier still sets the scaffolding.
 *
 * Which items the explorer can ask (contract R1-R3):
 *   - product modes (build, connect, commutative, distributive, fluency): product-unknown items.
 *   - missing_factor: a hidden factor1 or factor2, never a square (? × 6 = 36 prints its answer).
 *   - both factors inside the grade's FACT_BAND and the product under its ceiling.
 *   - a pinned factor (a times-table lesson) stays in its slot. A lesson that pins both factors is
 *     about one fact, so it keeps its own path.
 */
import type { MultDivItem } from '../itemSpace/multDivFacts';
import type { ItemSpaceId } from '../itemSpace';

export interface SpaceFact {
  factor1: number;
  factor2: number;
  /** The asked slot: the product, or the hidden factor on missing_factor. */
  hiddenValue: 'product' | 'factor1' | 'factor2';
  itemSpace: { space: string; structure: string; beta: number };
}

type Band = { min: number; max: number; maxProduct: number };

/** Each space the explorer can draw from, and how an item becomes a fact (null: not askable). */
const TO_FACT: Partial<Record<ItemSpaceId, (item: any, missingFactor: boolean) => Omit<SpaceFact, 'itemSpace'> | null>> = {
  'mult-div-facts': (it: MultDivItem, missingFactor: boolean) => {
    if (missingFactor) {
      if ((it.form !== 'factor1' && it.form !== 'factor2') || it.a === it.b) return null;
      return { factor1: it.a, factor2: it.b, hiddenValue: it.form };
    }
    return it.form === 'product' ? { factor1: it.a, factor2: it.b, hiddenValue: 'product' } : null;
  },
};

export const explorerSpaceSupported = (space: ItemSpaceId): boolean => !!TO_FACT[space];

/** The item as an explorer fact when the band and pins allow it, else null. */
export function itemAsFact(
  space: ItemSpaceId,
  item: unknown,
  opts: { band: Band; missingFactor: boolean; pinnedFactor1?: number; pinnedFactor2?: number },
): Omit<SpaceFact, 'itemSpace'> | null {
  const f = TO_FACT[space]?.(item, opts.missingFactor);
  if (!f) return null;
  const { min, max, maxProduct } = opts.band;
  if ([f.factor1, f.factor2].some((v) => v < min || v > max) || f.factor1 * f.factor2 > maxProduct) return null;
  if (opts.pinnedFactor1 !== undefined && f.factor1 !== opts.pinnedFactor1) return null;
  if (opts.pinnedFactor2 !== undefined && f.factor2 !== opts.pinnedFactor2) return null;
  return f;
}

/** `count` facts in the beta band, or empty (the caller keeps selectFacts). */
export function pickSpaceFacts(opts: {
  space: ItemSpaceId;
  pick: (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => { beta: number; structure: string }[];
  band: [number, number];
  count: number;
  factBand: Band;
  missingFactor: boolean;
  pinnedFactor1?: number;
  pinnedFactor2?: number;
  rand?: () => number;
}): SpaceFact[] {
  if (opts.pinnedFactor1 !== undefined && opts.pinnedFactor2 !== undefined) return [];
  const asFact = (it: unknown) => itemAsFact(opts.space, it, {
    band: opts.factBand, missingFactor: opts.missingFactor, pinnedFactor1: opts.pinnedFactor1, pinnedFactor2: opts.pinnedFactor2,
  });
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], opts.rand, (it) => asFact(it) !== null);
  if (items.length < opts.count) return [];
  return items.map((it) => ({
    ...asFact(it)!,
    itemSpace: { space: opts.space, structure: it.structure, beta: Number(it.beta.toFixed(2)) },
  }));
}
