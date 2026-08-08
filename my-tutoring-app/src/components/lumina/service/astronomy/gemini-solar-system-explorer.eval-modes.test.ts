/**
 * Eval-mode surface for solar-system-explorer — L0→L1, 2026-08-08.
 *
 * This primitive had NO evaluation hook at all while advertising
 * `supportsEvaluation: true` (the portfolio decision WORKSTREAMS kept
 * re-raising). It now measures by DIRECT MANIPULATION — the student taps the
 * body that answers the question — and the items are built in CODE from the
 * same `bodies` array the component renders (Fork A, SP-21).
 *
 * What that buys, and what these tests hold to it:
 *   - the key CANNOT contradict the screen, because it is derived from it;
 *   - a prompt CANNOT name its own answer, because it is generated from it;
 *   - a tie is dropped rather than shipped as a coin flip;
 *   - K-1 never gets an item whose only evidence is a stat grid it cannot see.
 */
import { describe, it, expect } from 'vitest';
import { buildSolarChallenges } from './gemini-solar-system-explorer';
import type { CelestialBody } from '../../primitives/visual-primitives/astronomy/SolarSystemExplorer';
import { ASTRONOMY_CATALOG } from '../manifest/catalog/astronomy';

const b = (
  id: string, name: string, radiusKm: number, distanceAu: number,
  orbitalPeriodDays: number, moons: number, temperatureC: number,
  type: CelestialBody['type'] = 'planet',
): CelestialBody => ({
  id, name, type, color: '#888', radiusKm, distanceAu, orbitalPeriodDays,
  rotationPeriodHours: 24, moons, description: `${name} description.`,
  textureGradient: 'radial-gradient(circle, #888 0%, #444 100%)', temperatureC,
});

/** The canonical eight, with the real figures the generator's prompt ships. */
const SOLAR_SYSTEM: CelestialBody[] = [
  b('sun', 'Sun', 696000, 0, 0, 0, 5500, 'star'),
  b('mercury', 'Mercury', 2440, 0.39, 88, 0, 167),
  b('venus', 'Venus', 6052, 0.72, 225, 0, 464),
  b('earth', 'Earth', 6371, 1.0, 365.25, 1, 15),
  b('mars', 'Mars', 3390, 1.52, 687, 2, -65),
  b('jupiter', 'Jupiter', 69911, 5.2, 4333, 95, -110),
  b('saturn', 'Saturn', 58232, 9.54, 10759, 146, -140),
  b('uranus', 'Uranus', 25362, 19.19, 30687, 28, -195),
  b('neptune', 'Neptune', 24622, 30.07, 60190, 16, -200),
];

const ALL_KINDS = [
  'identify', 'order_from_sun', 'classify', 'compare_attribute', 'orbital_reasoning',
] as const;

/** Every item of one kind, unbounded — the full candidate space for that kind. */
const kindItems = (kind: (typeof ALL_KINDS)[number], rung: Parameters<typeof buildSolarChallenges>[1] = '5') =>
  buildSolarChallenges(SOLAR_SYSTEM, rung, [kind], 50);

describe('solar-system-explorer eval modes — the key is derived, not written', () => {
  it('gets the answers RIGHT against the real astronomical data', () => {
    const answerFor = (fragment: RegExp) => {
      const all = ALL_KINDS.flatMap((k) => kindItems(k));
      const item = all.find((c) => fragment.test(c.prompt));
      expect(item, `no item matched ${fragment}`).toBeDefined();
      return item!.answerBodyIds;
    };

    expect(answerFor(/closest to the Sun/i)).toEqual(['mercury']);
    expect(answerFor(/farthest from the Sun/i)).toEqual(['neptune']);
    expect(answerFor(/biggest planet/i)).toEqual(['jupiter']);
    expect(answerFor(/smallest planet/i)).toEqual(['mercury']);
    expect(answerFor(/most moons/i)).toEqual(['saturn']);
    // The trap that makes this mode worth measuring: the CLOSEST planet is not
    // the hottest. A hand-written key gets this wrong; a derived one cannot.
    expect(answerFor(/hottest planet/i)).toEqual(['venus']);
    expect(answerFor(/longest year/i)).toEqual(['neptune']);
    expect(answerFor(/shortest year/i)).toEqual(['mercury']);
  });

  it('never names the answer inside its own question', () => {
    for (const kind of ALL_KINDS) {
      for (const c of kindItems(kind)) {
        const names = c.answerBodyIds.map(
          (id) => SOLAR_SYSTEM.find((x) => x.id === id)!.name,
        );
        // `identify` is the one mode whose question IS the name — that is the
        // skill (name↔body recognition), not a leak.
        if (c.type === 'identify') continue;
        for (const n of names) {
          expect(c.prompt, `${c.type} leaks "${n}"`).not.toMatch(new RegExp(`\\b${n}\\b`, 'i'));
        }
      }
    }
  });

  it('never names the answer inside the pre-answer HINT either', () => {
    for (const kind of ALL_KINDS) {
      for (const c of kindItems(kind)) {
        const names = c.answerBodyIds.map((id) => SOLAR_SYSTEM.find((x) => x.id === id)!.name);
        for (const n of names) {
          expect(c.hint ?? '', `${c.type} hint leaks "${n}"`).not.toMatch(new RegExp(`\\b${n}\\b`, 'i'));
        }
      }
    }
  });

  it('drops a tie instead of scoring a defensible tap wrong', () => {
    const tied = [
      b('sun', 'Sun', 696000, 0, 0, 0, 5500, 'star'),
      b('a', 'Alpha', 5000, 1, 300, 3, 20),
      b('c', 'Gamma', 5000, 2, 600, 3, 20), // identical radius, moons, temp
    ];
    const items = buildSolarChallenges(tied, '5', ['compare_attribute'], 50);
    expect(items.map((c) => c.prompt).join(' ')).not.toMatch(/biggest|smallest|most moons|hottest/i);
  });

  it('classify accepts EVERY member of the category, not one blessed planet', () => {
    const giants = kindItems('classify').find((c) => /gas giant/i.test(c.prompt))!;
    expect(giants.answerBodyIds.sort()).toEqual(['jupiter', 'neptune', 'saturn', 'uranus']);
    const rocky = kindItems('classify').find((c) => /rocky/i.test(c.prompt))!;
    expect(rocky.answerBodyIds.sort()).toEqual(['earth', 'mars', 'mercury', 'venus']);
  });
});

describe('solar-system-explorer eval modes — band fit', () => {
  it('asks K nothing whose only evidence is the stat grid K cannot see', () => {
    // The six-cell grid (AU/km/days/hours/°C/moons) is NOT RENDERED at K-1, so
    // "most moons" and "hottest" have no channel there at all.
    for (const rung of ['K', '1'] as const) {
      const items = buildSolarChallenges(SOLAR_SYSTEM, rung, ['compare_attribute'], 50);
      const prompts = items.map((c) => c.prompt).join(' ');
      expect(prompts).not.toMatch(/moons|hottest|temperature/i);
      // Size is still fair game — it is visible in the picture.
      expect(prompts).toMatch(/biggest|smallest/i);
    }
  });

  it('gives a pre-reader a way to find a planet without reading its label', () => {
    const items = buildSolarChallenges(SOLAR_SYSTEM, 'K', ['identify'], 50);
    const mars = items.find((c) => c.answerBodyIds[0] === 'mars')!;
    expect(mars.prompt).toMatch(/the red one/i);
    // ...and the cue must not double as another mode's answer.
    for (const c of items) {
      expect(c.prompt).not.toMatch(/biggest|smallest|closest|farthest|nearest/i);
    }
  });

  it('holds ordinal counting back until it is a grade-2 move', () => {
    const k = buildSolarChallenges(SOLAR_SYSTEM, 'K', ['order_from_sun'], 50);
    expect(k.map((c) => c.prompt).join(' ')).not.toMatch(/third|fourth|fifth/i);
    const g4 = buildSolarChallenges(SOLAR_SYSTEM, '4', ['order_from_sun'], 50);
    expect(g4.map((c) => c.prompt).join(' ')).toMatch(/third|fourth|fifth/i);
  });
});

describe('solar-system-explorer eval modes — session shape', () => {
  it('a pinned mode yields ONLY that mode, with enough items to measure', () => {
    for (const kind of ALL_KINDS) {
      const items = buildSolarChallenges(SOLAR_SYSTEM, '4', [kind], 6);
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(new Set(items.map((c) => c.type))).toEqual(new Set([kind]));
      expect(new Set(items.map((c) => c.id)).size).toBe(items.length);
    }
  });

  it('the MIXED path actually mixes — it does not ship one tier N times (SP-21)', () => {
    const items = buildSolarChallenges(SOLAR_SYSTEM, '5', [...ALL_KINDS], 6);
    expect(items).toHaveLength(6);
    expect(new Set(items.map((c) => c.type)).size).toBeGreaterThanOrEqual(4);
  });

  it('orders a mixed session easy → hard', () => {
    const items = buildSolarChallenges(SOLAR_SYSTEM, '5', [...ALL_KINDS], 6);
    const rank = items.map((c) => ALL_KINDS.indexOf(c.type));
    expect(rank).toEqual([...rank].sort((x, y) => x - y));
  });

  it('degrades to zero items rather than to a broken one', () => {
    expect(buildSolarChallenges([SOLAR_SYSTEM[0]], '3', [...ALL_KINDS], 6)).toEqual([]);
    expect(buildSolarChallenges(SOLAR_SYSTEM, '3', [], 6)).toEqual([]);
  });
});

describe('solar-system-explorer eval modes — catalog contract', () => {
  const entry = ASTRONOMY_CATALOG.find((c) => c.id === 'solar-system-explorer')!;

  it('every catalog mode maps to challenge types the builder can actually build', () => {
    expect(entry.evalModes?.length).toBe(5);
    for (const m of entry.evalModes!) {
      for (const t of m.challengeTypes) {
        expect(ALL_KINDS as readonly string[]).toContain(t);
        expect(
          buildSolarChallenges(SOLAR_SYSTEM, '5', [t as (typeof ALL_KINDS)[number]], 4).length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('is ordered easiest β first, and every β is a distinct rung', () => {
    const betas = entry.evalModes!.map((m) => m.beta);
    expect(betas).toEqual([...betas].sort((a, z) => a - z));
    expect(new Set(betas).size).toBe(betas.length);
  });
});
