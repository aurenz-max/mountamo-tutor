/**
 * era-explorer — STRUCTURAL DIFFICULTY (config.difficulty, axis 2) — 2026-08-24
 *
 * L4 gate for `/add-structural-difficulty`. Axis 1 (`/add-support-tiers`) left
 * every statement byte-identical across tiers and only toggled help; this axis
 * makes the JUDGMENT subtler, so the thing to prove is that a tier actually
 * changes WHICH problems ship — and that it never crosses a floor while doing it.
 *
 * Because statements are prose, the enforcement mechanism is
 * OVER-GENERATE -> MEASURE -> SELECT rather than reconstruction. That makes the
 * selector, not an LLM, the thing under test: these are the offline builder
 * stress tests the skill's Phase 5 asks for, run over thousands of randomised
 * pools with a seeded PRNG so any failure reproduces exactly.
 *
 * What is asserted:
 *   1. The tier MOVES the shape — more subtle-bin answers / higher cross-lens
 *      reach at hard than at easy, over the same pool.
 *   2. The FLOOR holds — era_sort / era_compare always ship at least one subtle
 *      AND one plain answer whenever the pool has both, because the three-way
 *      judgment is the mode's identity and dropping a side changes the eval mode.
 *   3. It SATURATES HONESTLY — a thin pool ships what it has instead of
 *      inflating, and a two-distractor pool ignores the distance lever entirely.
 *   4. cause_of_change keeps exactly ONE right answer — a reworded copy of the
 *      real cause is never selected as a wrong one, at any tier.
 *   5. The NO-TIER path is unchanged (capWithVariety, un-widened schema).
 *
 * Non-vacuity: every assertion below fails if the lever is neutered. Flattening
 * SUBTLE_SHARE to a constant breaks (1); dropping the [1, slots-1] clamp in
 * `pickWithinType` breaks (2); removing the NEAR_DUPLICATE_OVERLAP filter breaks
 * (4); widening the schema unconditionally breaks (5).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveProblemShape,
  lensReachOf,
  isSubtleBin,
  causeOverlap,
  selectDistractorsByDistance,
  selectForShape,
  capWithVariety,
  widenSchemaForTier,
  SUBTLE_SHARE,
  type ShapeCandidate,
} from './gemini-era-explorer';
import type { EraChallengeType } from '../../primitives/visual-primitives/history/EraExplorer';

const TIERS = ['easy', 'medium', 'hard'] as const;
type Tier = (typeof TIERS)[number];
const MAX = 6;

/** Seeded LCG — deterministic, so a stress failure reproduces from its seed. */
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

let counter = 0;
const mk = (type: EraChallengeType, correctIndex: number, lensReach = 1): ShapeCandidate => ({
  challenge: {
    type,
    statement: `statement-${(counter += 1)}`,
    options: ['a', 'b', 'c'],
    correctIndex,
    explanation: 'why',
  },
  lensReach,
  subtle: isSubtleBin(type, correctIndex),
});

/** Mirror of `pickWithinType`'s subtle-bin target, for exact-hit assertions. */
const expectedSubtle = (slots: number, share: number, nSubtle: number, nPlain: number) => {
  const raw = Math.round(slots * share);
  return nSubtle && nPlain
    ? Math.min(Math.max(raw, 1), slots - 1, nSubtle)
    : Math.min(raw, nSubtle);
};

describe('era-explorer structural difficulty — the lever table', () => {
  it('gives every mode a lever at every tier, and never an empty prompt', () => {
    const modes: EraChallengeType[] = ['lens_id', 'era_sort', 'era_compare', 'cause_of_change'];
    for (const mode of modes) {
      for (const tier of TIERS) {
        const shape = resolveProblemShape(mode, tier);
        expect(shape.promptLines.length, `${mode}/${tier} prompt`).toBeGreaterThan(0);
        const levers = [shape.lensReach, shape.subtleShare, shape.distractorDistance]
          .filter((v) => v !== undefined).length;
        expect(levers, `${mode}/${tier} lever count`).toBe(1);
      }
    }
  });

  it('runs lens_id from "one lens owns it" to "two lenses read as plausible"', () => {
    expect(resolveProblemShape('lens_id', 'easy').lensReach).toEqual({ target: 1, direction: 'at_most' });
    expect(resolveProblemShape('lens_id', 'medium').lensReach).toEqual({ target: 2, direction: 'at_most' });
    expect(resolveProblemShape('lens_id', 'hard').lensReach).toEqual({ target: 2, direction: 'at_least' });
  });

  it('never zeroes the subtle bin at easy — the three-way judgment IS the mode', () => {
    for (const tier of TIERS) {
      expect(SUBTLE_SHARE[tier], `${tier} share`).toBeGreaterThan(0);
    }
    expect(SUBTLE_SHARE.easy).toBeLessThan(SUBTLE_SHARE.medium);
    expect(SUBTLE_SHARE.medium).toBeLessThan(SUBTLE_SHARE.hard);
  });

  it('runs cause_of_change distractors from far to near', () => {
    expect(resolveProblemShape('cause_of_change', 'easy').distractorDistance).toBe('far');
    expect(resolveProblemShape('cause_of_change', 'medium').distractorDistance).toBe('mid');
    expect(resolveProblemShape('cause_of_change', 'hard').distractorDistance).toBe('near');
  });
});

describe('lensReachOf — cross-lens reach is scale-free and directional', () => {
  const LENSES = [
    'Pioneer families lived in small log cabins they built themselves. Water came from a well and was carried home in buckets.',
    'There were no cars or electricity. People travelled in wagons pulled by oxen, and food was cooked over a fire.',
    'Children of many ages learned together in a one-room schoolhouse with a single teacher and slate boards.',
  ];

  it('scores a detail that only one lens talks about as reach 1', () => {
    expect(lensReachOf('Students write their letters on small slate boards.', LENSES)).toBe(1);
    expect(lensReachOf('A heavy wagon is pulled along by a team of oxen.', LENSES)).toBe(1);
  });

  it('scores a detail whose wording lands across lenses above 1', () => {
    // "children" + "water"/"carried" reach the school lens AND the cabin lens.
    expect(
      lensReachOf('Children carry water from the well before their teacher begins.', LENSES),
    ).toBeGreaterThanOrEqual(2);
  });

  it('treats a statement with no lexical anchor as maximally hard, not as reach 1', () => {
    expect(lensReachOf('Neighbours decide together who repairs the bridge.', LENSES)).toBe(LENSES.length);
  });

  it('is scale-free — padding a statement with function words does not change it', () => {
    const bare = 'Students write on slate boards.';
    const padded = 'It is that the students will then write upon their own slate boards.';
    expect(lensReachOf(padded, LENSES)).toBe(lensReachOf(bare, LENSES));
  });

  it('does not let ONE stray common word count as a lens touch', () => {
    // "small" appears only in the cabin lens; on its own that is noise, not a
    // second plausible source. Before the anchor floor this scored reach 2.
    expect(lensReachOf('Students write their letters on small slate boards.', LENSES)).toBe(1);
  });
});

describe('selectDistractorsByDistance — the cause_of_change lever', () => {
  const ANSWER = 'water pipes were built into ordinary houses';
  const POOL = [
    'railroads reached many more towns',                    // far
    'children stayed in school for more years',             // far
    'water wells were dug deeper near the town square',     // near (shares "water")
    'houses were built closer together in new towns',       // near (shares "houses"/"built")
  ];

  it('picks the two FARTHEST at easy and the two NEAREST at hard', () => {
    const far = selectDistractorsByDistance(ANSWER, POOL, 'far');
    const near = selectDistractorsByDistance(ANSWER, POOL, 'near');
    expect(far).toHaveLength(2);
    expect(near).toHaveLength(2);

    const worst = (set: string[]) => Math.max(...set.map((d) => causeOverlap(ANSWER, d)));
    const best = (set: string[]) => Math.min(...set.map((d) => causeOverlap(ANSWER, d)));
    expect(best(near)).toBeGreaterThan(worst(far));
  });

  it('NEVER ships a reworded copy of the real cause — one right answer, always', () => {
    const withCopy = [...POOL, ANSWER, 'ordinary houses were built with water pipes inside'];
    for (const distance of ['far', 'mid', 'near'] as const) {
      const picked = selectDistractorsByDistance(ANSWER, withCopy, distance);
      for (const d of picked) {
        expect(causeOverlap(ANSWER, d), `${distance}: "${d}"`).toBeLessThan(0.8);
      }
    }
  });

  it('saturates honestly on a two-cause pool — every tier ships the same two', () => {
    const thin = POOL.slice(0, 2);
    const results = (['far', 'mid', 'near'] as const).map((d) => selectDistractorsByDistance(ANSWER, thin, d));
    for (const r of results) expect(r).toEqual(thin);
  });

  it('is deterministic — the same pool always yields the same pick', () => {
    for (const distance of ['far', 'mid', 'near'] as const) {
      const a = selectDistractorsByDistance(ANSWER, POOL, distance);
      const b = selectDistractorsByDistance(ANSWER, POOL, distance);
      expect(a).toEqual(b);
    }
  });
});

describe('selectForShape — stress over randomised pools', () => {
  const BINNED: EraChallengeType[] = ['era_sort', 'era_compare'];

  it('ships min(max, pool) in model order, no duplicates, across 6000 random pools', () => {
    const next = rng(20260824);
    const modes: EraChallengeType[] = ['lens_id', 'era_sort', 'era_compare', 'cause_of_change'];
    let runs = 0;
    for (let i = 0; i < 500; i++) {
      for (const mode of modes) {
        for (const tier of TIERS) {
          const size = 3 + Math.floor(next() * 10);
          const pool = Array.from({ length: size }, () =>
            mk(mode, Math.floor(next() * 3), 1 + Math.floor(next() * 3)));
          const shipped = selectForShape(pool, MAX, tier);
          runs++;

          expect(shipped).toHaveLength(Math.min(MAX, pool.length));
          expect(new Set(shipped).size).toBe(shipped.length);
          const idx = shipped.map((c) => pool.indexOf(c));
          expect(idx.every((v) => v >= 0)).toBe(true);
          expect([...idx].sort((a, b) => a - b)).toEqual(idx);
        }
      }
    }
    expect(runs).toBe(6000);
  });

  it('HOLDS THE FLOOR — always at least one subtle AND one plain when the pool has both', () => {
    const next = rng(7);
    for (const mode of BINNED) {
      for (const tier of TIERS) {
        for (let i = 0; i < 400; i++) {
          const nSubtle = 1 + Math.floor(next() * 8);
          const nPlain = 1 + Math.floor(next() * 8);
          const pool = [
            ...Array.from({ length: nSubtle }, () => mk(mode, 2)),
            ...Array.from({ length: nPlain }, () => mk(mode, Math.floor(next() * 2))),
          ];
          const shipped = selectForShape(pool, MAX, tier);
          const subtle = shipped.filter((c) => c.subtle).length;
          expect(subtle, `${mode}/${tier} subtle`).toBeGreaterThanOrEqual(1);
          expect(shipped.length - subtle, `${mode}/${tier} plain`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('HOLDS THE FLOOR in a BLEND, where a binned type gets only a few slots', () => {
    // The floor's teeth. A pinned session has 6 slots, so even the easy share
    // rounds to 1 subtle on its own; a blended one hands era_sort ~3 slots,
    // where 3 x 0.15 rounds to ZERO. Without the [1, slots-1] clamp the student
    // gets an era_sort run with no continuity judgment in it at all — which is
    // not an easier era_sort, it is a different (two-way) task.
    const pool = [
      mk('era_sort', 2),                                        // the only subtle one
      ...Array.from({ length: 5 }, (_, i) => mk('era_sort', i % 2)),
      mk('lens_id', 0),
      mk('era_compare', 0),
      mk('cause_of_change', 1),
    ];
    for (const tier of TIERS) {
      const sorts = selectForShape(pool, MAX, tier).filter((c) => c.challenge.type === 'era_sort');
      expect(sorts.length, `${tier} era_sort slots`).toBeGreaterThanOrEqual(2);
      expect(sorts.filter((c) => c.subtle).length, `${tier} era_sort subtle`).toBeGreaterThanOrEqual(1);
    }
  });

  it('hits the subtle-bin target EXACTLY on a pool deep in both kinds', () => {
    for (const mode of BINNED) {
      const pool = [
        ...Array.from({ length: 8 }, () => mk(mode, 2)),
        ...Array.from({ length: 8 }, () => mk(mode, 0)),
        ...Array.from({ length: 8 }, () => mk(mode, 1)),
      ];
      for (const tier of TIERS) {
        const shipped = selectForShape(pool, MAX, tier);
        const subtle = shipped.filter((c) => c.subtle).length;
        expect(subtle, `${mode}/${tier}`).toBe(expectedSubtle(MAX, SUBTLE_SHARE[tier], 8, 16));
      }
    }
  });

  it('MOVES THE SHAPE — strictly more subtle answers at hard than at easy', () => {
    for (const mode of BINNED) {
      const pool = [
        ...Array.from({ length: 6 }, () => mk(mode, 2)),
        ...Array.from({ length: 6 }, () => mk(mode, 0)),
      ];
      const counts = TIERS.map((t) => selectForShape(pool, MAX, t).filter((c) => c.subtle).length);
      expect(counts[0], `${mode} easy<medium`).toBeLessThan(counts[1]);
      expect(counts[1], `${mode} medium<hard`).toBeLessThan(counts[2]);
    }
  });

  it('MOVES THE SHAPE — lens_id ships higher cross-lens reach at hard than at easy', () => {
    const next = rng(99);
    let hardWins = 0;
    for (let i = 0; i < 300; i++) {
      const pool = Array.from({ length: 8 }, () => mk('lens_id', Math.floor(next() * 3), 1 + Math.floor(next() * 3)));
      const reach = (t: Tier) =>
        selectForShape(pool, MAX, t).reduce((sum, c) => sum + c.lensReach, 0);
      expect(reach('hard')).toBeGreaterThanOrEqual(reach('easy'));
      if (reach('hard') > reach('easy')) hardWins++;
    }
    // Not every random pool can differ (a pool of identical reaches cannot), but
    // a flattened lever would make this zero.
    expect(hardWins).toBeGreaterThan(200);
  });

  it('never collapses a BLEND — every type present survives selection', () => {
    const next = rng(31337);
    const modes: EraChallengeType[] = ['lens_id', 'era_sort', 'era_compare', 'cause_of_change'];
    for (const tier of TIERS) {
      for (let i = 0; i < 200; i++) {
        const pool = modes.flatMap((m) =>
          Array.from({ length: 1 + Math.floor(next() * 4) }, () => mk(m, Math.floor(next() * 3))));
        const shipped = selectForShape(pool, MAX, tier);
        const types = new Set(shipped.map((c) => c.challenge.type));
        expect(types.size, `${tier} type coverage`).toBe(modes.length);
      }
    }
  });

  it('saturates honestly on a one-sided pool instead of inventing the other side', () => {
    for (const mode of BINNED) {
      const allSubtle = Array.from({ length: 6 }, () => mk(mode, 2));
      for (const tier of TIERS) {
        const shipped = selectForShape(allSubtle, MAX, tier);
        expect(shipped).toHaveLength(MAX);
        expect(shipped.every((c) => c.subtle)).toBe(true);
      }
    }
  });
});

describe('the no-tier path stays byte-identical', () => {
  it('capWithVariety returns the pool untouched when it already fits', () => {
    const pool = [mk('era_sort', 0), mk('era_sort', 2), mk('era_sort', 1)];
    expect(capWithVariety(pool, MAX)).toBe(pool);
  });

  it('capWithVariety spends its first picks on distinct types, then distinct answers', () => {
    const pool = [
      mk('era_sort', 0), mk('era_sort', 0), mk('era_sort', 0), mk('era_sort', 2),
      mk('lens_id', 1), mk('cause_of_change', 2), mk('era_compare', 0), mk('era_compare', 1),
    ];
    const kept = capWithVariety(pool, MAX);
    expect(kept).toHaveLength(MAX);
    expect(new Set(kept.map((c) => c.challenge.type)).size).toBe(4);
  });

  it('widenSchemaForTier deepens the pools WITHOUT mutating the shared base schema', () => {
    const base = {
      type: 'object',
      properties: {
        challenges: {
          type: 'array',
          minItems: '4',
          maxItems: '6',
          description: 'base',
          items: { type: 'object', properties: { distractors: { type: 'array', maxItems: '2', description: 'base' } } },
        },
      },
    } as unknown as Parameters<typeof widenSchemaForTier>[0];

    const widened = widenSchemaForTier(base) as unknown as Record<string, any>;
    const w = widened.properties.challenges;
    expect(w.minItems).toBe('6');
    expect(w.maxItems).toBe('9');
    expect(w.items.properties.distractors.maxItems).toBe('4');

    // the module-level schema every un-tiered call shares must be untouched
    const b = (base as unknown as Record<string, any>).properties.challenges;
    expect(b.minItems).toBe('4');
    expect(b.maxItems).toBe('6');
    expect(b.items.properties.distractors.maxItems).toBe('2');
  });
});
