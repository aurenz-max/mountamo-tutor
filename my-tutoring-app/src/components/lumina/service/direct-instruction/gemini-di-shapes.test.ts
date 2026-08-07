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
  generateDiShapes,
  isPolygon,
  parseNamedShapes,
  SHAPE_MENU,
} from './gemini-di-shapes';

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
