/**
 * gemini-di-shapes — Fork A menu-scope contract (deterministic; geminiClient
 * mocked so the wrapper falls back to defaults and the CODE-owned half is
 * what's under test — the same keepable-oracle shape as the sibling packs).
 *
 * The mock also covers `resolveEvalModes`, which shares the same client: it
 * returns no text, so an UNPINNED call resolves to mixed with no live call.
 * Pinned modes short-circuit before any call at all, so every mode assertion
 * below is deterministic.
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import {
  buildShapeSequence,
  countConfusableAdjacencies,
  generateDiShapes,
  isPolygon,
  parseNamedShapes,
  SHAPE_MENU,
} from './gemini-di-shapes';
import {
  hasVariantDrawing,
  SAFE_ROTATION_DEG,
} from '../../primitives/visual-primitives/direct-instruction/diShapesGeometry';

describe('parseNamedShapes — objective text wins', () => {
  it('reads singular, plural, and the K "diamond" word', () => {
    expect(parseNamedShapes('name triangles and circles')).toEqual(['triangle', 'circle']);
    expect(parseNamedShapes('identify a square')).toEqual(['square']);
    expect(parseNamedShapes('sort diamonds and ovals')).toEqual(['rhombus', 'oval']);
    expect(parseNamedShapes('count to 120')).toEqual([]);
  });
});

describe('generateDiShapes — code-enforced scope', () => {
  it('serves the shapes the objective names, and only those', async () => {
    const data = await generateDiShapes('naming triangles and circles', 'kindergarten', {
      intent: 'Correctly name triangles and circles regardless of orientation',
      challengeCount: 6,
    });
    expect(data.challenges).toHaveLength(6);
    const shapes = new Set(data.challenges.map((c) => c.shape));
    expect(Array.from(shapes).sort()).toEqual(['circle', 'triangle']);
  });

  it('falls back to the K.G.2 core five for a generic K objective', async () => {
    const data = await generateDiShapes('naming basic shapes', 'kindergarten', {});
    for (const c of data.challenges) {
      expect(SHAPE_MENU[c.shape].core).toBe(true);
    }
  });

  it('derives every spoken field in code — article, sides, aliases, rotation cap', async () => {
    const data = await generateDiShapes('naming ovals and squares', 'first grade', {
      targetEvalMode: 'name_shape',
      challengeCount: 6,
    });
    for (const c of data.challenges) {
      const spec = SHAPE_MENU[c.shape];
      expect(c.shapeWord).toBe(spec.word);
      expect(c.article).toBe(spec.article);
      expect(c.sides).toBe(spec.sides);
      expect(Math.abs(c.rotationDeg)).toBeLessThanOrEqual(spec.maxRotationDeg);
      expect(c.asrAliases).toEqual(spec.asrAliases);
      if (c.shape === 'oval') expect(c.article).toBe('an');
    }
  });

  it('attaches the "diamond" alternate to rhombus only', async () => {
    const data = await generateDiShapes('naming diamonds', 'first grade', {
      targetEvalMode: 'name_shape',
      challengeCount: 3,
    });
    for (const c of data.challenges) {
      expect(c.shape).toBe('rhombus');
      expect(c.spokenAlternates).toEqual(['diamond']);
    }
  });

  it('wrapper defaults never leak a shape name (answer-leak guard path)', async () => {
    // The mocked model returned no wrapper, so defaults ship — and the guard
    // must hold for them too.
    const data = await generateDiShapes('naming basic shapes', 'kindergarten', {});
    const chrome = `${data.title} ${data.description}`.toLowerCase();
    for (const shape of Object.keys(SHAPE_MENU)) {
      expect(chrome).not.toContain(shape);
    }
    expect(chrome).not.toContain('diamond');
  });
});

describe('generateDiShapes — L1 eval modes', () => {
  it('a pinned mode builds only that identity', async () => {
    for (const mode of ['name_shape', 'shape_review', 'count_sides', 'count_corners'] as const) {
      const data = await generateDiShapes('shapes', 'first grade', {
        targetEvalMode: mode,
        challengeCount: 6,
      });
      expect(data.challenges).toHaveLength(6);
      for (const c of data.challenges) expect(c.challengeType).toBe(mode);
      // Session identity mirrors what was actually built.
      expect(data.challengeType).toBe(mode);
    }
  });

  it('counting items carry the count derived from the menu, as a number word', async () => {
    const sides = await generateDiShapes('how many sides', 'first grade', {
      targetEvalMode: 'count_sides',
      challengeCount: 6,
    });
    const WORDS: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six' };
    for (const c of sides.challenges) {
      expect(c.countNumeral).toBe(SHAPE_MENU[c.shape].sides);
      expect(c.countWord).toBe(WORDS[c.countNumeral!]);
      // The ANSWER is the count, so the passive aliases must track the count —
      // a shape name is not an answer under this mode.
      expect(c.asrAliases).toEqual([c.countWord, String(c.countNumeral)]);
      expect(c.spokenAlternates).toBeUndefined();
    }

    const corners = await generateDiShapes('how many corners', 'first grade', {
      targetEvalMode: 'count_corners',
      challengeCount: 6,
    });
    for (const c of corners.challenges) {
      expect(c.countNumeral).toBe(SHAPE_MENU[c.shape].corners);
    }
  });

  it('RULE #1 — a counting item is NEVER built on a curved shape', async () => {
    // "how many sides does a circle have?" has two arguable answers for a young
    // child (0 straight sides, or 1 curved edge), so the pool is polygon-only.
    for (const mode of ['count_sides', 'count_corners'] as const) {
      const data = await generateDiShapes('shapes', 'first grade', {
        targetEvalMode: mode,
        challengeCount: 6,
      });
      for (const c of data.challenges) {
        expect(isPolygon(c.shape), `${c.shape} is curved`).toBe(true);
        expect(c.countNumeral).not.toBeNull();
      }
    }
  });

  it('a curves-ONLY objective widens rather than emitting an unanswerable item', async () => {
    // The objective names only curved shapes, which win outright for NAMING…
    const naming = await generateDiShapes('naming circles and ovals', 'first grade', {
      targetEvalMode: 'name_shape',
      challengeCount: 4,
    });
    expect(new Set(naming.challenges.map((c) => c.shape))).toEqual(new Set(['circle', 'oval']));

    // …but a counting session cannot honour that scope, so it falls back to the
    // grade's polygons instead of asking how many sides a circle has.
    const counting = await generateDiShapes('counting sides of circles and ovals', 'first grade', {
      targetEvalMode: 'count_sides',
      challengeCount: 4,
    });
    expect(counting.challenges).toHaveLength(4);
    for (const c of counting.challenges) {
      expect(isPolygon(c.shape)).toBe(true);
      expect(typeof c.countWord).toBe('string');
    }
  });

  it('when the counting pool widens, the wrapper reverts to neutral chrome', async () => {
    // Caught by a live probe: an objective about circles produced the title
    // "Curve Safari!" over five polygons. The wrapper is written before the
    // pools are built, so a widened counting session must drop it.
    mocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Curve Safari!',
        description: 'Look at some smooth outlines and count them out loud!',
        targetShapes: ['circle', 'oval'],
      }),
    });
    const widened = await generateDiShapes('circles and ovals', 'kindergarten', {
      targetEvalMode: 'count_sides',
      challengeCount: 4,
    });
    expect(widened.title).toBe('Shape Time');
    expect(widened.description).not.toContain('smooth outlines');
    for (const c of widened.challenges) expect(isPolygon(c.shape)).toBe(true);

    // Control: the SAME wrapper survives when the scope did NOT have to widen,
    // so this guard is scoped to the widen path and is not a blanket reset.
    mocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Curve Safari!',
        description: 'Look at some smooth outlines and count them out loud!',
        targetShapes: ['triangle', 'hexagon'],
      }),
    });
    const kept = await generateDiShapes('counting sides of triangles and hexagons', 'first grade', {
      targetEvalMode: 'count_sides',
      challengeCount: 4,
    });
    expect(kept.title).toBe('Curve Safari!');
  });

  it('shape_review widens the DEFAULT pool but never overrides shapes the objective named', async () => {
    // Nothing named → the wide grade draw (the cumulative-review point).
    const wide = await generateDiShapes('review the shapes we know', 'first grade', {
      targetEvalMode: 'shape_review',
      challengeCount: 6,
    });
    expect(new Set(wide.challenges.map((c) => c.shape)).size).toBeGreaterThan(1);

    // Named → those win outright, review or not (trust-intent / scope doctrine).
    const scoped = await generateDiShapes('review triangles and hexagons', 'first grade', {
      targetEvalMode: 'shape_review',
      challengeCount: 6,
    });
    expect(new Set(scoped.challenges.map((c) => c.shape))).toEqual(
      new Set(['triangle', 'hexagon']),
    );
  });

  it('a curated BLEND builds exactly the pinned identities', async () => {
    const data = await generateDiShapes('shapes', 'first grade', {
      targetEvalMode: 'name_shape|count_sides',
      challengeCount: 6,
    });
    const types = new Set(data.challenges.map((c) => c.challengeType));
    expect(Array.from(types).sort()).toEqual(['count_sides', 'name_shape']);
  });

  it('SP-21 — the MIXED path spreads across all four identities, not one', async () => {
    // No pin and no resolvable intent → mixed. A Fork A pack must build the
    // spread itself; "mixed" that emits one identity is a lie in the label.
    const data = await generateDiShapes('shapes', 'first grade', {
      targetEvalMode: 'mixed',
      challengeCount: 6,
    });
    const types = new Set(data.challenges.map((c) => c.challengeType));
    expect(Array.from(types).sort()).toEqual([
      'count_corners', 'count_sides', 'name_shape', 'shape_review',
    ]);
  });

  it('the wrapper never leaks a COUNT either (answer-leak rule, counting modes)', async () => {
    const data = await generateDiShapes('how many sides', 'first grade', {
      targetEvalMode: 'count_sides',
      challengeCount: 6,
    });
    const chrome = `${data.title} ${data.description}`.toLowerCase();
    for (const c of data.challenges) {
      expect(chrome).not.toContain(c.countWord!);
      expect(chrome).not.toContain(String(c.countNumeral));
    }
  });
});

describe('generateDiShapes — L3 support tier', () => {
  it('stamps the tier on every challenge, whatever the mode', async () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const data = await generateDiShapes('naming basic shapes', 'kindergarten', {
        targetEvalMode: 'name_shape',
        challengeCount: 5,
        difficulty: tier,
      });
      expect(data.challenges).toHaveLength(5);
      for (const c of data.challenges) expect(c.supportTier).toBe(tier);
    }
  });

  it('a BLENDED session gets the tier too — difficulty is a STUDENT property', async () => {
    // The no-op this layer exists to kill: gating application on a single
    // pinned mode silently drops difficulty for every blended/mixed session.
    const data = await generateDiShapes('shapes', 'first grade', {
      targetEvalMode: 'mixed',
      challengeCount: 6,
      difficulty: 'hard',
    });
    expect(new Set(data.challenges.map((c) => c.challengeType)).size).toBeGreaterThan(1);
    for (const c of data.challenges) expect(c.supportTier).toBe('hard');
  });

  it('an absent or unknown difficulty applies NO tier (the L0/L1 shape stands)', async () => {
    for (const difficulty of [undefined, '', 'medium-hard', 'level 3', '2']) {
      const data = await generateDiShapes('naming basic shapes', 'kindergarten', {
        targetEvalMode: 'name_shape',
        challengeCount: 4,
        ...(difficulty === undefined ? {} : { difficulty }),
      });
      for (const c of data.challenges) expect(c.supportTier).toBeUndefined();
    }
  });

  it('the tier changes SUPPORT, never which shapes or what they answer', async () => {
    // The L3 guardrail, restated truthfully now that L4 exists: a tier may not
    // re-select shapes, change the item count, or change an answer. It MAY
    // re-draw a shape (rotation/exemplar/scale) — that is the L4 axis, and its
    // own bound (the rule-#1 safe ceiling) is asserted in the L4 block below.
    // This test originally pinned rotation to the menu cap; L4 makes that
    // deliberately false, so pinning it here would forbid the next rung.
    const of = async (difficulty?: string) => generateDiShapes('counting sides of triangles and squares', 'first grade', {
      targetEvalMode: 'count_sides',
      challengeCount: 6,
      ...(difficulty ? { difficulty } : {}),
    });
    const base = await of();
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const tiered = await of(tier);
      expect(tiered.challenges).toHaveLength(base.challenges.length);
      expect(new Set(tiered.challenges.map((c) => c.shape)))
        .toEqual(new Set(base.challenges.map((c) => c.shape)));
      for (const c of tiered.challenges) {
        expect(c.countNumeral).toBe(SHAPE_MENU[c.shape].sides);
        expect(Math.abs(c.rotationDeg)).toBeLessThanOrEqual(SAFE_ROTATION_DEG[c.shape]);
      }
    }
  });

  it('a tiered counting session still refuses curved shapes (rule #1 survives L3)', async () => {
    const data = await generateDiShapes('circles and ovals', 'kindergarten', {
      targetEvalMode: 'count_corners',
      challengeCount: 5,
      difficulty: 'hard',
    });
    for (const c of data.challenges) {
      expect(isPolygon(c.shape)).toBe(true);
      expect(c.supportTier).toBe('hard');
    }
  });
});

describe('generateDiShapes — L4 structural difficulty', () => {
  const naming = (difficulty?: string, count = 6) => generateDiShapes(
    'naming triangles rectangles hexagons and pentagons', 'first grade',
    { targetEvalMode: 'name_shape', challengeCount: count, ...(difficulty ? { difficulty } : {}) },
  );

  it('hard draws NON-PROTOTYPICAL exemplars; easy and medium draw the textbook one', async () => {
    // The headline lever, and the G1 curriculum skill itself: defining vs
    // non-defining attributes. A child who learned the picture fails the variant.
    for (const tier of ['easy', 'medium'] as const) {
      const d = await naming(tier);
      for (const c of d.challenges) expect(c.exemplar).toBe('prototype');
    }
    const hard = await naming('hard');
    for (const c of hard.challenges) {
      // circle/square saturate to the prototype — they have no variant drawing.
      expect(c.exemplar).toBe(hasVariantDrawing(c.shape) ? 'variant' : 'prototype');
    }
    expect(hard.challenges.some((c) => c.exemplar === 'variant')).toBe(true);
  });

  it('rotation climbs toward the SAFE ceiling with the tier, and never past it', async () => {
    const maxOf = async (tier: string) => {
      let worst = 0;
      for (let run = 0; run < 8; run++) {
        const d = await naming(tier);
        for (const c of d.challenges) {
          // The invariant: never past this shape's rule-#1 ceiling, ever.
          expect(Math.abs(c.rotationDeg), `${c.shape} past its safe ceiling at ${tier}`)
            .toBeLessThanOrEqual(SAFE_ROTATION_DEG[c.shape]);
          // In ABSOLUTE degrees, not as a share of the ceiling. A share is what
          // the first version asserted and it hid a real defect: 25% of the
          // triangle's 180° ceiling is ±45°, so `easy` passed this test while a
          // live probe drew a K child a triangle at −36° and `medium` one at
          // −91°. What a five-year-old experiences is degrees, not fractions.
          worst = Math.max(worst, Math.abs(c.rotationDeg));
        }
      }
      return worst;
    };
    // The ladder interpolates between the two ceilings the pack already has:
    // half the untiered default → the untiered default → the rule-#1 ceiling.
    // `medium` therefore reproduces exactly what shipped before L4.
    const MENU_SHAPES = Object.keys(SHAPE_MENU) as Array<keyof typeof SHAPE_MENU>;
    const gentlest = Math.min(...MENU_SHAPES.map((s) => SHAPE_MENU[s].maxRotationDeg));
    expect(gentlest).toBeGreaterThanOrEqual(0); // menu sanity

    // Easy is near-upright for EVERY shape, in absolute terms — the whole point.
    expect(await maxOf('easy')).toBeLessThanOrEqual(
      Math.max(...MENU_SHAPES.map((s) => Math.round(SHAPE_MENU[s].maxRotationDeg / 2))),
    );
    expect(await maxOf('easy')).toBeLessThanOrEqual(13);
    // Medium never exceeds the untiered default (the pre-L4 feel).
    expect(await maxOf('medium')).toBeLessThanOrEqual(
      Math.max(...MENU_SHAPES.map((s) => SHAPE_MENU[s].maxRotationDeg)),
    );
    // Hard genuinely climbs past what medium can reach.
    expect(await maxOf('hard')).toBeGreaterThan(
      Math.max(...MENU_SHAPES.map((s) => SHAPE_MENU[s].maxRotationDeg)),
    );
  });

  it('a hard triangle can actually reach point-down (the K.G.2 item that did not exist)', async () => {
    // Pre-L4 the triangle was capped at the menu's gentle 25°, so "regardless
    // of orientation" was never once exercised. This is the rung existing.
    let steepest = 0;
    for (let run = 0; run < 12; run++) {
      const d = await generateDiShapes('naming triangles', 'kindergarten', {
        targetEvalMode: 'name_shape', challengeCount: 6, difficulty: 'hard',
      });
      for (const c of d.challenges) {
        if (c.shape === 'triangle') steepest = Math.max(steepest, Math.abs(c.rotationDeg));
      }
    }
    expect(steepest, 'no hard triangle ever rotated far').toBeGreaterThan(90);
  });

  it('size varies at hard and is left canonical at easy ("regardless of size")', async () => {
    const easy = await naming('easy');
    for (const c of easy.challenges) expect(c.scalePct).toBe(100);
    const sizes = new Set<number>();
    for (let run = 0; run < 6; run++) {
      for (const c of (await naming('hard')).challenges) {
        sizes.add(c.scalePct!);
        expect(c.scalePct!).toBeGreaterThanOrEqual(62);
        expect(c.scalePct!).toBeLessThanOrEqual(100);
      }
    }
    expect(sizes.size, 'hard never varied the size').toBeGreaterThan(3);
  });

  it('hard places CONFUSABLE NAMES side by side; easy keeps them apart', async () => {
    // The near-distractor made real for a pack with no multiple choice: the
    // three pairs the catalog itself names as the error class.
    //
    // THRESHOLDS ARE MEASURED, NOT GUESSED. Over 300 sessions on this pool:
    //   easy   mean 0.42  min 0  hist {0:226, 1:36, 2:23, 3:15}
    //   medium mean 0.85  min 0  (natural order — no reordering at all)
    //   hard   mean 1.46  min 1  hist {1:210, 2:43, 3:47}
    // The first version of this test asserted `easyRate < 0.5` on 10 samples —
    // sitting exactly on easy's own mean, so it failed about a third of the
    // time. A flaky gate is worse than no gate: it trains the next session to
    // re-run until green. The assertions below are ≥3σ on 60 samples.
    const RUNS = 60;
    const sample = async (tier: string) => {
      const counts: number[] = [];
      for (let run = 0; run < RUNS; run++) {
        counts.push(countConfusableAdjacencies((await naming(tier)).challenges));
      }
      return {
        mean: counts.reduce((a, b) => a + b, 0) / counts.length,
        withPair: counts.filter((c) => c >= 1).length,
      };
    };
    const easy = await sample('easy');
    const hard = await sample('hard');

    // The separation is the claim: ~1.0 apart, σ of the difference ≈ 0.145.
    expect(hard.mean - easy.mean, `hard ${hard.mean} vs easy ${easy.mean}`)
      .toBeGreaterThan(0.5);
    // And a hard session essentially always lands at least one pair, where an
    // easy session usually lands none. (Pool-conditional: it holds because both
    // hexagon and pentagon are drawn here. A pool with no confusable pair at all
    // saturates at zero, which applyAdjacency handles rather than forcing.)
    expect(hard.withPair, 'hard sessions with ≥1 confusable pair')
      .toBeGreaterThanOrEqual(Math.floor(RUNS * 0.95));
    expect(easy.withPair, 'easy sessions with ≥1 confusable pair')
      .toBeLessThan(Math.floor(RUNS * 0.5));
  });

  it('hard places ADJACENT COUNTS together under a counting mode', async () => {
    // The counting analog: an off-by-one is the error side/corner counting
    // exists to correct, so hard makes five-then-six a real risk.
    let total = 0;
    for (let run = 0; run < 10; run++) {
      const d = await generateDiShapes('counting sides of triangles squares pentagons and hexagons', 'first grade', {
        targetEvalMode: 'count_sides', challengeCount: 6, difficulty: 'hard',
      });
      total += countConfusableAdjacencies(d.challenges);
    }
    expect(total / 10, 'hard counting sessions never paired adjacent counts').toBeGreaterThan(1);
  });

  it('THE GUARDRAIL — the tier never changes which shapes, how many, or the counts', async () => {
    // Structure moves; magnitude and identity do not. Compare the DISTINCT set
    // rather than the multiset: buildShapeSequence shuffles, so when the item
    // count exceeds the pool size WHICH shapes repeat differs per generation —
    // that is pre-existing variance, not something the tier introduced.
    const set = (d: Awaited<ReturnType<typeof naming>>) =>
      Array.from(new Set(d.challenges.map((c) => c.shape))).sort().join(',');
    const base = await naming(undefined);
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const t = await naming(tier);
      expect(t.challenges).toHaveLength(base.challenges.length);
      expect(set(t), `${tier} drew a different set of shapes`).toBe(set(base));
      for (const c of t.challenges) expect(c.challengeType).toBe('name_shape');
    }
    // And a counting session's answers stay derived from the menu at every tier.
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const d = await generateDiShapes('counting sides', 'first grade', {
        targetEvalMode: 'count_sides', challengeCount: 6, difficulty: tier,
      });
      for (const c of d.challenges) {
        expect(c.countNumeral).toBe(SHAPE_MENU[c.shape].sides);
        expect(isPolygon(c.shape)).toBe(true);
      }
    }
  });

  it('the NO-TIER path is untouched — no structural field is stamped', async () => {
    const d = await naming(undefined);
    for (const c of d.challenges) {
      expect(c.exemplar).toBeUndefined();
      expect(c.scalePct).toBeUndefined();
      expect(c.supportTier).toBeUndefined();
      // The untiered rotation still comes from the menu's gentle default.
      expect(Math.abs(c.rotationDeg)).toBeLessThanOrEqual(SHAPE_MENU[c.shape].maxRotationDeg);
    }
  });

  it('adjacency never breaks the variance rule (no shape back-to-back)', async () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let run = 0; run < 10; run++) {
        const d = await naming(tier);
        for (let i = 1; i < d.challenges.length; i++) {
          expect(d.challenges[i].shape, `back-to-back at ${tier}`)
            .not.toBe(d.challenges[i - 1].shape);
        }
      }
    }
  });
});

describe('buildShapeSequence — variance', () => {
  it('shows every selected shape before any repeat and never runs one back-to-back', () => {
    for (let run = 0; run < 25; run++) {
      const seq = buildShapeSequence(['circle', 'triangle', 'square'], 6);
      expect(seq).toHaveLength(6);
      expect(new Set(seq.slice(0, 3)).size).toBe(3);
      for (let i = 1; i < seq.length; i++) {
        expect(seq[i], `back-to-back at ${i} in ${seq.join(',')}`).not.toBe(seq[i - 1]);
      }
    }
  });

  it('a single-shape session tolerates repeats (nothing else to alternate to)', () => {
    expect(buildShapeSequence(['hexagon'], 3)).toEqual(['hexagon', 'hexagon', 'hexagon']);
  });
});
