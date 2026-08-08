import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';

// Import types from the component - single source of truth
import type {
  SolarSystemExplorerData,
  CelestialBody,
  SolarChallenge,
  SolarChallengeType,
} from '../../primitives/visual-primitives/astronomy/SolarSystemExplorer';

// Re-export for convenience if needed elsewhere
export type { SolarSystemExplorerData, CelestialBody };

/**
 * Schema for Celestial Body
 */
const celestialBodySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier (lowercase, hyphenated). E.g., 'sun', 'mercury', 'earth', 'mars', 'jupiter'"
    },
    name: {
      type: Type.STRING,
      description: "Display name of the celestial body. E.g., 'Sun', 'Mercury', 'Earth', 'Mars'"
    },
    type: {
      type: Type.STRING,
      enum: ["star", "planet", "dwarf-planet"],
      description: "Type of celestial body. Sun is 'star', planets are 'planet', Pluto is 'dwarf-planet'."
    },
    color: {
      type: Type.STRING,
      description: "Hex color code representing the body. Sun: '#FDB813', Mercury: '#8C7853', Venus: '#FFC649', Earth: '#4A90E2', Mars: '#CD5C5C', Jupiter: '#C88B3A', Saturn: '#FAD5A5', Uranus: '#4FD0E0', Neptune: '#4169E1', Pluto: '#A0826D'"
    },
    radiusKm: {
      type: Type.NUMBER,
      description: "Radius in kilometers. Sun: 696000, Mercury: 2440, Venus: 6052, Earth: 6371, Mars: 3390, Jupiter: 69911, Saturn: 58232, Uranus: 25362, Neptune: 24622, Pluto: 1188"
    },
    distanceAu: {
      type: Type.NUMBER,
      description: "Average distance from Sun in AU (Astronomical Units). Sun: 0, Mercury: 0.39, Venus: 0.72, Earth: 1.0, Mars: 1.52, Jupiter: 5.2, Saturn: 9.54, Uranus: 19.19, Neptune: 30.07, Pluto: 39.48"
    },
    orbitalPeriodDays: {
      type: Type.NUMBER,
      description: "Time to orbit Sun in Earth days. Sun: 0, Mercury: 88, Venus: 225, Earth: 365.25, Mars: 687, Jupiter: 4333, Saturn: 10759, Uranus: 30687, Neptune: 60190, Pluto: 90560"
    },
    rotationPeriodHours: {
      type: Type.NUMBER,
      description: "Time for one rotation in hours. Sun: 609.12, Mercury: 1407.6, Venus: 5832.5, Earth: 24, Mars: 24.6, Jupiter: 9.9, Saturn: 10.7, Uranus: 17.2, Neptune: 16.1, Pluto: 153.3"
    },
    moons: {
      type: Type.NUMBER,
      description: "Number of known moons. Sun: 0, Mercury: 0, Venus: 0, Earth: 1, Mars: 2, Jupiter: 95, Saturn: 146, Uranus: 28, Neptune: 16, Pluto: 5"
    },
    description: {
      type: Type.STRING,
      description: "Age-appropriate description (2-3 sentences) explaining what makes this body special. Focus on observable features and fun facts."
    },
    textureGradient: {
      type: Type.STRING,
      description: "CSS gradient string for visual representation. E.g., 'radial-gradient(circle, #4A90E2 0%, #2E5C8A 100%)'"
    },
    temperatureC: {
      type: Type.NUMBER,
      description: "Average surface temperature in Celsius. Sun: 5500, Mercury: 167, Venus: 464, Earth: 15, Mars: -65, Jupiter: -110, Saturn: -140, Uranus: -195, Neptune: -200, Pluto: -225"
    },
    funFact: {
      type: Type.STRING,
      description: "Optional fun fact for kids (1 sentence). E.g., 'A day on Venus is longer than its year!'",
      nullable: true
    }
  },
  required: ["id", "name", "type", "color", "radiusKm", "distanceAu", "orbitalPeriodDays", "rotationPeriodHours", "moons", "description", "textureGradient", "temperatureC"]
};

/**
 * Schema for Solar System Explorer Data
 */
const solarSystemExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the solar system activity (e.g., 'Explore Our Solar System', 'Journey Through Space')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will explore. Use age-appropriate language."
    },
    bodies: {
      type: Type.ARRAY,
      items: celestialBodySchema,
      description: "Array of celestial bodies to display. Always include Sun. For K-2: Sun + 4 inner planets. For 3-5: All 8 planets + optional dwarf planets."
    },
    initialZoom: {
      type: Type.STRING,
      enum: ["system", "inner", "outer", "planet", "moon"],
      description: "Starting zoom level. K-1: 'inner' (easier to see), 2-3: 'system' (full view), 4-5: 'system' or 'inner'"
    },
    focusBody: {
      type: Type.STRING,
      description: "ID of body to initially highlight/select. Common: 'earth' for relatability, 'sun' for overview, null for no selection",
      nullable: true
    },
    timeScale: {
      type: Type.NUMBER,
      description: "Simulation speed multiplier (100-20000). K-2: 8000-10000 (faster, engaging), 3-5: 5000-8000 (observable patterns)"
    },
    showOrbits: {
      type: Type.BOOLEAN,
      description: "Display orbital paths. Default: true"
    },
    showLabels: {
      type: Type.BOOLEAN,
      description: "Display planet names. Default: true"
    },
    scaleMode: {
      type: Type.STRING,
      enum: ["size_accurate", "distance_accurate", "hybrid"],
      description: "Scaling mode. K-2: 'hybrid' (balanced), 3-4: 'size_accurate' (compare sizes), 5: 'distance_accurate' (teach scale)"
    },
    showHabitableZone: {
      type: Type.BOOLEAN,
      description: "Highlight the habitable 'Goldilocks Zone'. K-2: false (too advanced), 3-5: true (introduces astrobiology)"
    },
    dateTime: {
      type: Type.STRING,
      description: "ISO date string for initial planet positions. Default: current date. Use specific dates for special events (e.g., '2024-04-08' for eclipse)",
      nullable: true
    },
    showDistances: {
      type: Type.BOOLEAN,
      description: "Display distances in AU. K-2: false, 3-4: optional, 5: true (teaches astronomical units)"
    },
    compareMode: {
      type: Type.BOOLEAN,
      description: "Enable side-by-side planet comparison. K-2: false, 3-5: true (comparative analysis)"
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ["K", "1", "2", "3", "4", "5"],
      description: "Target grade level for content"
    }
  },
  required: ["title", "description", "bodies", "initialZoom", "timeScale", "showOrbits", "showLabels", "scaleMode", "showHabitableZone", "showDistances", "compareMode", "gradeLevel"]
};

/**
 * Generate Solar System Explorer data for visualization
 *
 * Creates interactive solar system models appropriate for K-5 astronomy education:
 * - K: Planet names, order from sun, "our Earth"
 * - 1: Inner vs outer planets, relative sizes
 * - 2: Orbital paths, day/year concepts
 * - 3: Moons, rings, asteroid belt
 * - 4: Orbital periods, distance in AU
 * - 5: Gravity effects, Kepler's insights
 *
 * @param topic - The astronomy topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns SolarSystemExplorerData with complete configuration
 */
export type SolarSystemGrade = 'K' | '1' | '2' | '3' | '4' | '5';

/**
 * Canonical grade → structural rung.
 *
 * This generator's prose-grade defect is narrower than its astronomy siblings
 * but sharper: `ctx.gradeContext` (PROSE) was passed straight into
 * `getDefaultBodies(gradeLevel)`, whose only branch is
 * `gradeLevel === 'K' || === '1' || === '2'`. Prose never equals 'K', so the
 * K-2 branch was UNREACHABLE and the fallback handed a Kindergartener all eight
 * planets instead of the inner four.
 *
 * It bites only on the DEGRADE path (Gemini returned no bodies) — which is
 * exactly when the lesson is already fragile and least able to absorb it. The
 * happy path was fine because the prompt carries the audience in prose, which
 * is the one place prose belongs.
 *
 * Returns null when there is no canonical grade, so the prose fallback stands.
 */
export const solarSystemGradeFromGrade = (grade?: string): SolarSystemGrade | null => {
  const g = (grade ?? '').toString().trim().toUpperCase();
  if (!g) return null;
  if (g === 'K' || g === 'KINDERGARTEN' || g === 'PRESCHOOL') return 'K';
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 0) return 'K';
  if (n >= 5) return '5';
  return String(n) as '1' | '2' | '3' | '4';
};

/** Type guard for a rung that arrived as untyped JSON (Gemini's own stamp). */
const isSolarSystemGrade = (v: unknown): v is SolarSystemGrade =>
  typeof v === 'string' && ['K', '1', '2', '3', '4', '5'].includes(v);

/** Legacy prose fallback — kept as the last resolver, never the first. */
const solarSystemGradeFromProse = (prose?: string): SolarSystemGrade => {
  const p = (prose ?? '').toLowerCase();
  if (/\b(kindergarten|preschool)\b/.test(p)) return 'K';
  if (/\b(grade 1|1st grade)\b/.test(p)) return '1';
  if (/\b(grade 2|2nd grade)\b/.test(p)) return '2';
  if (/\b(grade 3|3rd grade)\b/.test(p)) return '3';
  if (/\b(grade 4|4th grade)\b/.test(p)) return '4';
  if (/\b(grade 5|5th grade|middle|high school)\b/.test(p)) return '5';
  return '3';
};

// ============================================================================
// EVAL MODES — the five skills this model can actually measure
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      '"identify": the student is asked for a body BY NAME and taps it in the live model. '
      + 'Tests name↔body recognition — the Kindergarten objective.',
    schemaDescription: "'identify' (tap the named body)",
  },
  order_from_sun: {
    promptDoc:
      '"order_from_sun": the student taps a planet by its POSITION in the sequence out from the Sun '
      + '(closest, farthest, or the Nth). Tests solar-system order.',
    schemaDescription: "'order_from_sun' (tap by position from the Sun)",
  },
  classify: {
    promptDoc:
      '"classify": the student taps ANY member of a category — rocky planet, gas giant, dwarf planet. '
      + 'Tests the category rule rather than one memorised fact.',
    schemaDescription: "'classify' (tap any member of a category)",
  },
  compare_attribute: {
    promptDoc:
      '"compare_attribute": the student taps the extreme on one attribute — biggest, smallest, '
      + 'most moons, hottest. Requires comparing across bodies, not recalling one.',
    schemaDescription: "'compare_attribute' (tap the extreme on an attribute)",
  },
  orbital_reasoning: {
    promptDoc:
      '"orbital_reasoning": the student taps by ORBITAL PERIOD — longest year, fastest mover. '
      + 'Tests the distance↔period relationship (Kepler\'s third law, informally).',
    schemaDescription: "'orbital_reasoning' (tap by orbital period)",
  },
};

// ============================================================================
// CHALLENGE CONSTRUCTION — Fork A: code builds the items AND the answer key
// ============================================================================
// Gemini emits the MODEL (the bodies and their real data); code derives every
// question and every answer from that same array
// ([[feedback_llm-window-code-builds-structure]]). Two reasons that is not
// negotiable here:
//
//   1. Answer integrity. An LLM-written key can contradict the data on screen —
//      "Jupiter has the most moons" while the bodies array says Saturn 146.
//      A key computed FROM the array cannot disagree with the array.
//   2. Answer leak. There is no round trip in which a prompt string can name
//      its own answer, because the prompt is generated from the answer.
//
// This is the SP-21 Fork A shape, so the unconstrained ("mixed") path is built
// explicitly — by rotating every in-band kind — rather than letting one tier
// stand in for a mix.

const TIER_ORDER: SolarChallengeType[] = [
  'identify', 'order_from_sun', 'classify', 'compare_attribute', 'orbital_reasoning',
];

/**
 * Which kinds a MIXED session draws from, per rung. This is a band floor on the
 * unpinned path only — an explicit `targetEvalMode` is always honoured, because
 * a pin is a curriculum decision and a cap below lesson intent is a bug
 * ([[feedback_trust-intent-over-hardcoded-caps]]).
 */
const MIXED_POOL_BY_RUNG: Record<SolarSystemGrade, SolarChallengeType[]> = {
  K:   ['identify', 'order_from_sun', 'classify'],
  '1': ['identify', 'order_from_sun', 'classify'],
  '2': ['identify', 'order_from_sun', 'classify', 'compare_attribute'],
  '3': TIER_ORDER,
  '4': TIER_ORDER,
  '5': TIER_ORDER,
};

/** Enough items to measure, not just to demo ([[feedback_mastery-over-demo]]). */
const CHALLENGE_COUNT_BY_RUNG: Record<SolarSystemGrade, number> = {
  K: 4, '1': 5, '2': 5, '3': 6, '4': 6, '5': 6,
};

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];

/**
 * Colour-and-appearance cues for the `identify` items at K-1.
 *
 * A pre-reader cannot read the name labels under the planets, so "Tap Mars" has
 * no channel at all unless the body is also described by how it LOOKS. Cues are
 * deliberately colour-only: no "biggest", no "nearest the Sun", because those
 * would answer a compare_attribute or order_from_sun item elsewhere in the
 * same session.
 */
const APPEARANCE_CUE: Record<string, string> = {
  mercury: 'the small grey one',
  venus:   'the pale yellow one',
  earth:   'the blue one, our home',
  mars:    'the red one',
  jupiter: 'the one with orange stripes',
  saturn:  'the pale gold one with rings',
  uranus:  'the light blue-green one',
  neptune: 'the deep blue one',
  pluto:   'the small brown one',
};

interface ChallengeCandidate {
  type: SolarChallengeType;
  /** Canonical identity for de-duplication within a session. */
  key: string;
  prompt: string;
  answerBodyIds: string[];
  hint: string;
  explanation: string;
  /** In-kind ordering, easy → hard. */
  rank: number;
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The single body that wins on `value`, or null when the top two TIE.
 * A tie makes the item unanswerable — two defensible taps, one scored wrong —
 * so the variant is dropped rather than shipped as a coin flip.
 */
function strictExtreme(
  bodies: CelestialBody[],
  value: (b: CelestialBody) => number,
  dir: 'max' | 'min',
): CelestialBody | null {
  if (bodies.length < 2) return null;
  const sorted = [...bodies].sort((a, b) => (dir === 'max' ? value(b) - value(a) : value(a) - value(b)));
  if (value(sorted[0]) === value(sorted[1])) return null;
  return sorted[0];
}

function collectCandidates(
  bodies: CelestialBody[],
  rung: SolarSystemGrade,
): ChallengeCandidate[] {
  const isPreReader = rung === 'K' || rung === '1';
  // The six-cell stat grid is NOT RENDERED at K-1, so any item whose evidence
  // lives only in that grid (moon counts, temperatures) has no channel there.
  const statsHidden = isPreReader;

  const planets = bodies
    .filter((b) => b.type === 'planet')
    .sort((a, b) => a.distanceAu - b.distanceAu);
  const out: ChallengeCandidate[] = [];
  if (planets.length < 2) return out;

  // ── identify ───────────────────────────────────────────────────
  planets.forEach((p, i) => {
    const cue = isPreReader ? APPEARANCE_CUE[p.id] : undefined;
    out.push({
      type: 'identify',
      key: `identify:${p.id}`,
      prompt: cue ? `Tap ${p.name} — ${cue}.` : `Tap ${p.name}.`,
      answerBodyIds: [p.id],
      hint: isPreReader
        ? 'Look at the colours. Ask me to say it again if you need to.'
        : 'Each body has its name written just below it.',
      explanation: `That's ${p.name}.`,
      rank: i,
    });
  });

  // ── order_from_sun ─────────────────────────────────────────────
  const orderHint = 'Start at the Sun in the middle and move outwards, one ring at a time.';
  out.push({
    type: 'order_from_sun',
    key: 'order:closest',
    prompt: 'Tap the planet closest to the Sun.',
    answerBodyIds: [planets[0].id],
    hint: orderHint,
    explanation: `${planets[0].name} orbits closest to the Sun.`,
    rank: 0,
  });
  const outermost = planets[planets.length - 1];
  out.push({
    type: 'order_from_sun',
    key: 'order:farthest',
    prompt: 'Tap the planet farthest from the Sun.',
    answerBodyIds: [outermost.id],
    hint: orderHint,
    explanation: `${outermost.name} is the farthest planet from the Sun here.`,
    rank: 1,
  });
  // Ordinal positions ask the student to COUNT a sequence — not a K-1 move.
  if (!isPreReader) {
    planets.slice(1, -1).forEach((p, idx) => {
      const position = idx + 1; // slice starts at index 1
      out.push({
        type: 'order_from_sun',
        key: `order:${position}`,
        prompt: `Tap the ${ORDINALS[position]} planet from the Sun.`,
        answerBodyIds: [p.id],
        hint: orderHint,
        explanation: `${p.name} is the ${ORDINALS[position]} planet from the Sun.`,
        rank: 2 + idx,
      });
    });
  }

  // ── classify ───────────────────────────────────────────────────
  const classifyHint = 'Think about what the whole group has in common — how big they are and what they are made of.';
  const rocky = planets.filter((p) => p.radiusKm < 20000 && p.distanceAu < 3);
  const giants = planets.filter((p) => p.radiusKm >= 20000);
  const dwarfs = bodies.filter((b) => b.type === 'dwarf-planet');

  if (rocky.length > 0 && rocky.length < planets.length) {
    out.push({
      type: 'classify',
      key: 'classify:rocky',
      prompt: isPreReader || rung === '2'
        ? 'Tap a rocky planet. Rocky planets are the smaller ones made of rock.'
        : 'Tap one of the rocky planets.',
      answerBodyIds: rocky.map((p) => p.id),
      hint: classifyHint,
      explanation: `The rocky planets are ${rocky.map((p) => p.name).join(', ')}.`,
      rank: 0,
    });
  }
  if (giants.length > 0 && giants.length < planets.length) {
    out.push({
      type: 'classify',
      key: 'classify:giant',
      prompt: isPreReader || rung === '2'
        ? 'Tap a gas giant. Gas giants are the huge ones made of gas.'
        : 'Tap one of the gas giants.',
      answerBodyIds: giants.map((p) => p.id),
      hint: classifyHint,
      explanation: `The gas giants are ${giants.map((p) => p.name).join(', ')}.`,
      rank: 1,
    });
  }
  if (dwarfs.length > 0) {
    out.push({
      type: 'classify',
      key: 'classify:dwarf',
      prompt: 'Tap a dwarf planet.',
      answerBodyIds: dwarfs.map((b) => b.id),
      hint: 'A dwarf planet is much smaller than a planet, and it shares its orbit with other things.',
      explanation: `${dwarfs.map((b) => b.name).join(', ')} ${dwarfs.length > 1 ? 'are' : 'is a'} dwarf planet${dwarfs.length > 1 ? 's' : ''}.`,
      rank: 2,
    });
  }

  // ── compare_attribute ──────────────────────────────────────────
  const biggest = strictExtreme(planets, (b) => b.radiusKm, 'max');
  if (biggest) {
    out.push({
      type: 'compare_attribute',
      key: 'compare:biggest',
      prompt: 'Tap the biggest planet.',
      answerBodyIds: [biggest.id],
      hint: 'Look at how much room each circle takes up next to the others.',
      explanation: `${biggest.name} is the biggest planet here.`,
      rank: 0,
    });
  }
  const smallest = strictExtreme(planets, (b) => b.radiusKm, 'min');
  if (smallest) {
    out.push({
      type: 'compare_attribute',
      key: 'compare:smallest',
      prompt: 'Tap the smallest planet.',
      answerBodyIds: [smallest.id],
      hint: 'Look at how much room each circle takes up next to the others.',
      explanation: `${smallest.name} is the smallest planet here.`,
      rank: 1,
    });
  }
  if (!statsHidden) {
    const mostMoons = strictExtreme(planets, (b) => b.moons, 'max');
    if (mostMoons && mostMoons.moons > 0) {
      out.push({
        type: 'compare_attribute',
        key: 'compare:moons',
        prompt: 'Tap the planet with the most moons.',
        answerBodyIds: [mostMoons.id],
        hint: 'Tap the planets one at a time and read the moon count on each card.',
        explanation: `${mostMoons.name} has ${mostMoons.moons} known moons — more than any other planet here.`,
        rank: 2,
      });
    }
    const hottest = strictExtreme(planets, (b) => b.temperatureC, 'max');
    if (hottest) {
      out.push({
        type: 'compare_attribute',
        key: 'compare:hottest',
        prompt: 'Tap the hottest planet.',
        answerBodyIds: [hottest.id],
        // The trap is worth naming: the closest planet is NOT the hottest.
        hint: 'Check the temperature on each planet\'s card. It may not be the one you expect.',
        explanation: `${hottest.name} is the hottest planet at about ${hottest.temperatureC}°C.`,
        rank: 3,
      });
    }
  }

  // ── orbital_reasoning ──────────────────────────────────────────
  const orbitHint = 'Watch them move. The ones far out crawl around; the ones close in race.';
  const orbiting = planets.filter((p) => p.orbitalPeriodDays > 0);
  const slowest = strictExtreme(orbiting, (b) => b.orbitalPeriodDays, 'max');
  if (slowest) {
    out.push({
      type: 'orbital_reasoning',
      key: 'orbit:slowest',
      prompt: isPreReader
        ? 'Tap the planet that goes around the Sun the slowest.'
        : 'Tap the planet with the longest year — the one that takes longest to travel all the way around the Sun.',
      answerBodyIds: [slowest.id],
      hint: orbitHint,
      explanation: isPreReader
        ? `${slowest.name} is the slowest — it is very far away, so its trip round the Sun is huge.`
        : `${slowest.name} takes about ${Math.round(slowest.orbitalPeriodDays)} Earth days for one orbit. The farther out a planet is, the longer its year.`,
      rank: 0,
    });
  }
  const fastest = strictExtreme(orbiting, (b) => b.orbitalPeriodDays, 'min');
  if (fastest) {
    out.push({
      type: 'orbital_reasoning',
      key: 'orbit:fastest',
      prompt: isPreReader
        ? 'Tap the planet that races around the Sun the fastest.'
        : 'Tap the planet with the shortest year — the fastest one around the Sun.',
      answerBodyIds: [fastest.id],
      hint: orbitHint,
      explanation: isPreReader
        ? `${fastest.name} is the quickest — it is closest in, so it has the shortest way to go.`
        : `${fastest.name} completes an orbit in about ${Math.round(fastest.orbitalPeriodDays)} Earth days.`,
      rank: 1,
    });
  }

  return out;
}

/**
 * Build the session's items by rotating the allowed kinds, so a five-item
 * mixed session never collapses into five of the easiest thing. Ordered easy →
 * hard by tier, then by in-kind rank.
 */
export function buildSolarChallenges(
  bodies: CelestialBody[],
  rung: SolarSystemGrade,
  allowedKinds: SolarChallengeType[],
  count: number,
): SolarChallenge[] {
  const kinds = TIER_ORDER.filter((k) => allowedKinds.includes(k));
  if (kinds.length === 0) return [];

  const all = collectCandidates(bodies, rung);
  const pools = new Map<SolarChallengeType, ChallengeCandidate[]>(
    kinds.map((k) => [k, shuffled(all.filter((c) => c.type === k))]),
  );

  const picked: ChallengeCandidate[] = [];
  const seen = new Set<string>();
  let progressed = true;
  while (picked.length < count && progressed) {
    progressed = false;
    for (const k of kinds) {
      if (picked.length >= count) break;
      const next = pools.get(k)!.shift();
      if (!next) continue;
      progressed = true;
      if (seen.has(next.key)) continue;
      seen.add(next.key);
      picked.push(next);
    }
  }

  picked.sort(
    (a, b) => (TIER_ORDER.indexOf(a.type) - TIER_ORDER.indexOf(b.type)) || (a.rank - b.rank),
  );

  return picked.map((c, i) => ({
    id: `ssc-${i + 1}`,
    type: c.type,
    prompt: c.prompt,
    answerBodyIds: c.answerBodyIds,
    hint: c.hint,
    explanation: c.explanation,
  }));
}

export const generateSolarSystemExplorer = async (
  ctx: GenerationContext,
): Promise<SolarSystemExplorerData> => {
  const { topic } = ctx;
  // PROSE — correct for the prompt's audience voice, and used ONLY there.
  const gradeLevel = ctx.gradeContext;
  // Canonical rung — the value every structural decision must key off.
  const gradeRung: SolarSystemGrade =
    solarSystemGradeFromGrade(ctx.grade) ?? solarSystemGradeFromProse(ctx.gradeContext);
  const config = ctx.raw as Partial<SolarSystemExplorerData>;
  // Per-primitive intent: the specific objective the manifest assigned to THIS card.
  // The subject (topic) stays broad; intent foregrounds it in student-facing text.
  const intent = ctx.intent || "";
  const intentFocus = intent
    ? `

ACTIVITY FOCUS: The broad subject is "${topic}", but THIS activity must specifically target: "${intent}". Make the title, description, and each body's description/funFact foreground this objective. Do not reveal the answer to any challenge the student will be asked.`
    : "";

  // Which SKILL this card assesses. Resolved before the model call so the prose
  // can support the skill — the items themselves are built in code below.
  const resolution = await resolveEvalModes(
    'solar-system-explorer',
    {
      targetEvalMode: ctx.targetEvalMode,
      intent: ctx.intent,
      objectiveText: ctx.objective?.text,
    },
    CHALLENGE_TYPE_DOCS,
  );

  // The title and the top-level description are on screen from the first second,
  // before anything is answered. Per-body descriptions are NOT covered by this
  // rule — those sit behind a tap, which makes reading them research rather than
  // a leak, and researching across bodies is the compare_attribute skill itself.
  const skillFocus = `

ASSESSED SKILL FOCUS: after this model is built, the student will be asked to ${
    resolution
      ? resolution.modes.map((m) => m.description.toLowerCase()).join('; and to ')
      : 'name bodies, put them in order from the Sun, sort them into categories, compare them, and reason about their orbits'
  }.
ANSWER DISCIPLINE — the title and the top-level description must NOT say which body is the biggest, the smallest, the hottest, the closest, the farthest, the slowest, or has the most moons. Those are the questions.`;

  const prompt = `
Create an educational Solar System Explorer visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT - SOLAR SYSTEM ASTRONOMY:
The Solar System Explorer is a dynamic, interactive model showing:
1. THE SUN - Our star at the center (99.86% of solar system mass)
2. INNER PLANETS - Rocky, small, close to Sun (Mercury, Venus, Earth, Mars)
3. OUTER PLANETS - Gas/ice giants, huge, far from Sun (Jupiter, Saturn, Uranus, Neptune)
4. DWARF PLANETS - Small bodies like Pluto, Ceres, Eris (optional for advanced grades)
5. ORBITS - Elliptical paths planets follow around the Sun
6. ASTRONOMICAL UNIT (AU) - Distance from Earth to Sun (~150 million km)

KEY ASTRONOMICAL CONCEPTS:
- Planets orbit the Sun due to gravity
- Inner planets are rocky and small; outer planets are gas giants
- Orbital period increases with distance (Kepler's Third Law)
- The habitable zone is where liquid water can exist (around 1 AU for Sun-like stars)
- Day = one rotation, Year = one orbit
- Size vs. distance scale challenge (can't show both accurately at once)

GRADE-LEVEL LEARNING PROGRESSION:

KINDERGARTEN (ages 5-6):
- Focus: Planet names, order from Sun, "our Earth"
- Bodies: Sun, Mercury, Venus, Earth, Mars (inner planets only - simpler!)
- Description: "Let's visit the planets in our neighborhood! Can you find Earth, our home?"
- initialZoom: 'inner' (zoomed to inner planets for visibility)
- focusBody: 'earth' (highlight our home)
- timeScale: 10000 (fast, engaging movement)
- scaleMode: 'hybrid' (balanced, visible)
- showOrbits: true (see the paths)
- showLabels: true (always show names)
- showDistances: false (too abstract)
- showHabitableZone: false (too advanced)
- compareMode: false (keep it simple)
- Language: "Our Sun is like a big ball of fire! The planets go around and around it."

GRADE 1 (ages 6-7):
- Focus: Inner vs outer planets, relative sizes
- Bodies: Sun + all 8 planets (introduce full system)
- Description: "Discover the eight planets! Some are small and rocky. Some are HUGE and gassy!"
- initialZoom: 'system' (see all planets)
- focusBody: 'earth' (start with familiar)
- timeScale: 8000
- scaleMode: 'hybrid'
- showOrbits: true
- showLabels: true
- showDistances: false
- showHabitableZone: false
- compareMode: false
- Language: "The four inner planets are small and rocky. The four outer planets are giant balls of gas!"

GRADE 2 (ages 7-8):
- Focus: Orbital paths, day/year concepts
- Bodies: Sun + 8 planets
- Description: "Watch the planets orbit! See how they move at different speeds around the Sun."
- initialZoom: 'system'
- focusBody: null (let students explore)
- timeScale: 6000 (slower, observable patterns)
- scaleMode: 'hybrid'
- showOrbits: true (emphasize paths)
- showLabels: true
- showDistances: false
- showHabitableZone: false
- compareMode: false
- Language: "A year is how long it takes a planet to go around the Sun. Earth takes 365 days!"

GRADE 3 (ages 8-9):
- Focus: Moons, rings, asteroid belt concepts
- Bodies: Sun + 8 planets (+ optional Pluto as dwarf planet)
- Description: "Explore moons and rings! Many planets have their own smaller worlds orbiting them."
- initialZoom: 'system'
- focusBody: 'saturn' or 'jupiter' (moon-rich planets)
- timeScale: 5000
- scaleMode: 'size_accurate' (compare planet sizes)
- showOrbits: true
- showLabels: true
- showDistances: true (introduce AU concept)
- showHabitableZone: true (introduce "Goldilocks Zone")
- compareMode: true (enable comparisons)
- Language: "Jupiter has 95 moons! Saturn's beautiful rings are made of ice and rock."

GRADE 4 (ages 9-10):
- Focus: Orbital periods, distance in AU
- Bodies: Sun + 8 planets + Pluto
- Description: "Measure distances in space! Learn why planets farther from the Sun take longer to orbit."
- initialZoom: 'system'
- focusBody: null
- timeScale: 4000 (slower for observation)
- scaleMode: 'distance_accurate' (teach true scale)
- showOrbits: true
- showLabels: true
- showDistances: true (emphasize AU measurements)
- showHabitableZone: true
- compareMode: true
- Language: "Neptune is 30 AU from the Sun! That's 30 times farther than Earth. No wonder its year is 165 Earth years!"

GRADE 5 (ages 10-11):
- Focus: Gravity effects, Kepler's laws, astrobiology
- Bodies: Sun + 8 planets + dwarf planets (Pluto, Ceres, Eris)
- Description: "Uncover the laws of planetary motion! Explore how gravity shapes our solar system."
- initialZoom: 'system'
- focusBody: null
- timeScale: 3000 (precise observation)
- scaleMode: 'distance_accurate' (true scale understanding)
- showOrbits: true
- showLabels: true
- showDistances: true
- showHabitableZone: true (link to life potential)
- compareMode: true
- Language: "Kepler discovered that planets farther from the Sun move slower and take longer to orbit. Can you see the pattern?"

ACCURATE CELESTIAL DATA (Use these values):

SUN:
- id: 'sun', name: 'Sun', type: 'star'
- color: '#FDB813'
- radiusKm: 696000
- distanceAu: 0
- orbitalPeriodDays: 0
- rotationPeriodHours: 609.12
- moons: 0
- temperatureC: 5500
- description: "The Sun is our star! It's a giant ball of hot gas that gives us light and warmth."
- funFact: "The Sun is so big that over 1 million Earths could fit inside it!"

MERCURY:
- id: 'mercury', name: 'Mercury', type: 'planet'
- color: '#8C7853'
- radiusKm: 2440
- distanceAu: 0.39
- orbitalPeriodDays: 88
- rotationPeriodHours: 1407.6
- moons: 0
- temperatureC: 167
- description: "Mercury is the smallest planet and closest to the Sun. It's rocky and has lots of craters!"
- funFact: "Mercury is super fast! It zips around the Sun in just 88 days."

VENUS:
- id: 'venus', name: 'Venus', type: 'planet'
- color: '#FFC649'
- radiusKm: 6052
- distanceAu: 0.72
- orbitalPeriodDays: 225
- rotationPeriodHours: 5832.5
- moons: 0
- temperatureC: 464
- description: "Venus is Earth's 'sister planet' but it's covered in thick, poisonous clouds. It's the hottest planet!"
- funFact: "A day on Venus (243 Earth days) is longer than its year (225 Earth days)!"

EARTH:
- id: 'earth', name: 'Earth', type: 'planet'
- color: '#4A90E2'
- radiusKm: 6371
- distanceAu: 1.0
- orbitalPeriodDays: 365.25
- rotationPeriodHours: 24
- moons: 1
- temperatureC: 15
- description: "Earth is our home! It's the only planet we know with life, thanks to liquid water and a protective atmosphere."
- funFact: "Earth is the only planet not named after a god or goddess!"

MARS:
- id: 'mars', name: 'Mars', type: 'planet'
- color: '#CD5C5C'
- radiusKm: 3390
- distanceAu: 1.52
- orbitalPeriodDays: 687
- rotationPeriodHours: 24.6
- moons: 2
- temperatureC: -65
- description: "Mars is the red planet! It has the biggest volcano and canyon in the solar system."
- funFact: "Mars looks red because its soil contains rusty iron!"

JUPITER:
- id: 'jupiter', name: 'Jupiter', type: 'planet'
- color: '#C88B3A'
- radiusKm: 69911
- distanceAu: 5.2
- orbitalPeriodDays: 4333
- rotationPeriodHours: 9.9
- moons: 95
- temperatureC: -110
- description: "Jupiter is the biggest planet! It's a gas giant with a famous giant storm called the Great Red Spot."
- funFact: "Jupiter has 95 moons and counting! Its moon Ganymede is bigger than Mercury."

SATURN:
- id: 'saturn', name: 'Saturn', type: 'planet'
- color: '#FAD5A5'
- radiusKm: 58232
- distanceAu: 9.54
- orbitalPeriodDays: 10759
- rotationPeriodHours: 10.7
- moons: 146
- temperatureC: -140
- description: "Saturn is famous for its beautiful rings made of ice and rock! It's a gas giant with 146 moons."
- funFact: "Saturn is so light it could float in water (if you had a bathtub big enough)!"

URANUS:
- id: 'uranus', name: 'Uranus', type: 'planet'
- color: '#4FD0E0'
- radiusKm: 25362
- distanceAu: 19.19
- orbitalPeriodDays: 30687
- rotationPeriodHours: 17.2
- moons: 28
- temperatureC: -195
- description: "Uranus is an ice giant that spins on its side! It looks blue-green because of methane gas."
- funFact: "Uranus rolls around the Sun like a ball instead of spinning like a top!"

NEPTUNE:
- id: 'neptune', name: 'Neptune', type: 'planet'
- color: '#4169E1'
- radiusKm: 24622
- distanceAu: 30.07
- orbitalPeriodDays: 60190
- rotationPeriodHours: 16.1
- moons: 16
- temperatureC: -200
- description: "Neptune is the farthest planet from the Sun. It's a windy, icy blue world with supersonic storms!"
- funFact: "Neptune has the fastest winds in the solar system - up to 1,200 mph!"

PLUTO (optional for grades 3+):
- id: 'pluto', name: 'Pluto', type: 'dwarf-planet'
- color: '#A0826D'
- radiusKm: 1188
- distanceAu: 39.48
- orbitalPeriodDays: 90560
- rotationPeriodHours: 153.3
- moons: 5
- temperatureC: -225
- description: "Pluto used to be called the 9th planet, but now it's a dwarf planet. It's small, icy, and far away!"
- funFact: "Pluto has a heart-shaped glacier on its surface!"

CSS GRADIENT EXAMPLES:
- Sun: 'radial-gradient(circle, #FDB813 0%, #FD8813 50%, #FD6013 100%)'
- Earth: 'radial-gradient(circle, #4A90E2 0%, #2E5C8A 50%, #1E3A5A 100%)'
- Mars: 'radial-gradient(circle, #CD5C5C 0%, #A04040 50%, #803030 100%)'
- Jupiter: 'radial-gradient(circle, #E5B88A 0%, #C88B3A 50%, #A06020 100%)'
- Saturn: 'radial-gradient(circle, #FAD5A5 0%, #E5B88A 50%, #D0A070 100%)'

${config ? `
CONFIGURATION HINTS FROM MANIFEST:
${config.initialZoom ? `- Initial zoom: ${config.initialZoom}` : ''}
${config.focusBody ? `- Focus body: ${config.focusBody}` : ''}
${config.scaleMode ? `- Scale mode: ${config.scaleMode}` : ''}
${config.showHabitableZone !== undefined ? `- Show habitable zone: ${config.showHabitableZone}` : ''}
${config.showDistances !== undefined ? `- Show distances: ${config.showDistances}` : ''}
${config.compareMode !== undefined ? `- Compare mode: ${config.compareMode}` : ''}
` : ''}

VALIDATION REQUIREMENTS:
1. bodies array must always include the Sun (id: 'sun', distanceAu: 0)
2. K-2: Include at least inner planets (Mercury, Venus, Earth, Mars)
3. Grades 3+: Include all 8 planets
4. Grade 5: Can include dwarf planets (Pluto, Ceres, Eris)
5. Use accurate astronomical data from the reference above
6. Ensure textureGradient is a valid CSS gradient string
7. descriptions and funFacts must be age-appropriate and scientifically accurate
8. timeScale should be higher for younger grades (faster = more engaging)
${intentFocus}${skillFocus}

Return a complete Solar System Explorer configuration appropriate for the grade level and topic.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: solarSystemExplorerSchema
    },
  });

  // Debug logging to help diagnose the issue
  console.log('[Solar System Explorer] Gemini API Response:', {
    hasText: !!result.text,
    textType: typeof result.text,
    textLength: result.text?.length,
    textPreview: result.text?.substring(0, 200),
    resultKeys: Object.keys(result)
  });

  let data;
  try {
    if (!result.text) {
      throw new Error('No text property in Gemini response');
    }

    // Log the raw text before parsing
    console.log('[Solar System Explorer] Raw text to parse:', result.text.substring(0, 500));

    data = JSON.parse(result.text);
  } catch (parseError) {
    console.error('[Solar System Explorer] Parse Error Details:', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      textContent: result.text,
      textType: typeof result.text
    });
    throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response text: ${result.text?.substring(0, 200)}`);
  }

  if (!data) {
    throw new Error('No valid Solar System Explorer data returned from Gemini API');
  }

  // Validation: ensure bodies array exists and includes Sun
  if (!data.bodies || data.bodies.length === 0) {
    console.warn('No bodies provided. Setting default solar system.');
    // gradeRung, NOT the prose gradeLevel — see solarSystemGradeFromGrade.
    data.bodies = getDefaultBodies(gradeRung);
  }

  const hasSun = data.bodies.some((b: CelestialBody) => b.id === 'sun');
  if (!hasSun) {
    console.warn('Sun missing from bodies. Adding Sun.');
    data.bodies.unshift({
      id: 'sun',
      name: 'Sun',
      type: 'star',
      color: '#FDB813',
      radiusKm: 696000,
      distanceAu: 0,
      orbitalPeriodDays: 0,
      rotationPeriodHours: 609.12,
      moons: 0,
      description: "The Sun is our star! It's a giant ball of hot gas that gives us light and warmth.",
      textureGradient: 'radial-gradient(circle, #FDB813 0%, #FD8813 50%, #FD6013 100%)',
      temperatureC: 5500,
      funFact: "The Sun is so big that over 1 million Earths could fit inside it!"
    });
  }

  // Validation: ensure timeScale is reasonable
  if (!data.timeScale || data.timeScale < 100 || data.timeScale > 25000) {
    console.warn('Invalid timeScale. Setting default.');
    data.timeScale = 5000;
  }

  // Apply config overrides
  if (config) {
    if (config.bodies) data.bodies = config.bodies;
    if (config.initialZoom) data.initialZoom = config.initialZoom;
    if (config.focusBody !== undefined) data.focusBody = config.focusBody;
    if (config.timeScale !== undefined) data.timeScale = config.timeScale;
    if (config.showOrbits !== undefined) data.showOrbits = config.showOrbits;
    if (config.showLabels !== undefined) data.showLabels = config.showLabels;
    if (config.scaleMode) data.scaleMode = config.scaleMode;
    if (config.showHabitableZone !== undefined) data.showHabitableZone = config.showHabitableZone;
    if (config.dateTime !== undefined) data.dateTime = config.dateTime;
    if (config.showDistances !== undefined) data.showDistances = config.showDistances;
    if (config.compareMode !== undefined) data.compareMode = config.compareMode;
  }

  // Set sensible defaults
  // TODO: intent steers prompt text only; structural toggles remain grade-bound (Tier-2).
  if (data.showOrbits === undefined) data.showOrbits = true;
  if (data.showLabels === undefined) data.showLabels = true;
  if (data.scaleMode === undefined) data.scaleMode = 'hybrid';
  if (data.initialZoom === undefined) data.initialZoom = 'system';

  // ── Band rung ───────────────────────────────────────────────────
  // `data.gradeLevel` is what the COMPONENT reads to decide `isPreReader`, and
  // it is also what the item builder must band on — if the two disagree, a K
  // session gets K-banded questions on a screen still wearing adult chrome.
  // Resolver order matters: the canonical grade wins, but Gemini's own stamp is
  // the SECOND resolver, not the last. It read the same audience prose and at K
  // it is usually right; demoting it below the prose resolver would let that
  // resolver's literal `'3'` default switch the pre-reader gates OFF on
  // free-form lessons that currently have them on.
  const bandRung: SolarSystemGrade =
    solarSystemGradeFromGrade(ctx.grade)
    ?? (isSolarSystemGrade(data.gradeLevel) ? data.gradeLevel : null)
    ?? solarSystemGradeFromProse(ctx.gradeContext);
  data.gradeLevel = bandRung;

  // ── Build the graded items ──────────────────────────────────────
  // LAST, deliberately: `data.bodies` is only final here, after the Sun
  // backfill and the config overrides. Deriving the answer key any earlier
  // could key it to an array the student never sees.
  const allowedKinds: SolarChallengeType[] = resolution
    ? (resolution.allowedTypes as SolarChallengeType[])
    : MIXED_POOL_BY_RUNG[bandRung];
  data.challenges = buildSolarChallenges(
    data.bodies,
    bandRung,
    allowedKinds,
    CHALLENGE_COUNT_BY_RUNG[bandRung],
  );

  console.log(
    `[SolarSystemExplorer] modes: ${
      resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed'
    } → kinds [${allowedKinds.join(', ')}] → ${data.challenges.length} items @ rung ${bandRung}`,
  );

  return data;
};

/**
 * Helper: Get default celestial bodies based on grade level
 */
function getDefaultBodies(gradeLevel: string): CelestialBody[] {
  const sun: CelestialBody = {
    id: 'sun',
    name: 'Sun',
    type: 'star',
    color: '#FDB813',
    radiusKm: 696000,
    distanceAu: 0,
    orbitalPeriodDays: 0,
    rotationPeriodHours: 609.12,
    moons: 0,
    description: "The Sun is our star! It's a giant ball of hot gas that gives us light and warmth.",
    textureGradient: 'radial-gradient(circle, #FDB813 0%, #FD8813 50%, #FD6013 100%)',
    temperatureC: 5500,
    funFact: "The Sun is so big that over 1 million Earths could fit inside it!"
  };

  const innerPlanets: CelestialBody[] = [
    {
      id: 'mercury',
      name: 'Mercury',
      type: 'planet',
      color: '#8C7853',
      radiusKm: 2440,
      distanceAu: 0.39,
      orbitalPeriodDays: 88,
      rotationPeriodHours: 1407.6,
      moons: 0,
      description: "Mercury is the smallest planet and closest to the Sun. It's rocky and has lots of craters!",
      textureGradient: 'radial-gradient(circle, #A08863 0%, #8C7853 50%, #786543 100%)',
      temperatureC: 167,
      funFact: "Mercury is super fast! It zips around the Sun in just 88 days."
    },
    {
      id: 'venus',
      name: 'Venus',
      type: 'planet',
      color: '#FFC649',
      radiusKm: 6052,
      distanceAu: 0.72,
      orbitalPeriodDays: 225,
      rotationPeriodHours: 5832.5,
      moons: 0,
      description: "Venus is Earth's 'sister planet' but it's covered in thick, poisonous clouds. It's the hottest planet!",
      textureGradient: 'radial-gradient(circle, #FFD96A 0%, #FFC649 50%, #E5B030 100%)',
      temperatureC: 464,
      funFact: "A day on Venus is longer than its year!"
    },
    {
      id: 'earth',
      name: 'Earth',
      type: 'planet',
      color: '#4A90E2',
      radiusKm: 6371,
      distanceAu: 1.0,
      orbitalPeriodDays: 365.25,
      rotationPeriodHours: 24,
      moons: 1,
      description: "Earth is our home! It's the only planet we know with life, thanks to liquid water and a protective atmosphere.",
      textureGradient: 'radial-gradient(circle, #5AA0F2 0%, #4A90E2 50%, #3A70B2 100%)',
      temperatureC: 15,
      funFact: "Earth is the only planet not named after a god or goddess!"
    },
    {
      id: 'mars',
      name: 'Mars',
      type: 'planet',
      color: '#CD5C5C',
      radiusKm: 3390,
      distanceAu: 1.52,
      orbitalPeriodDays: 687,
      rotationPeriodHours: 24.6,
      moons: 2,
      description: "Mars is the red planet! It has the biggest volcano and canyon in the solar system.",
      textureGradient: 'radial-gradient(circle, #DD6C6C 0%, #CD5C5C 50%, #BD4C4C 100%)',
      temperatureC: -65,
      funFact: "Mars looks red because its soil contains rusty iron!"
    }
  ];

  const outerPlanets: CelestialBody[] = [
    {
      id: 'jupiter',
      name: 'Jupiter',
      type: 'planet',
      color: '#C88B3A',
      radiusKm: 69911,
      distanceAu: 5.2,
      orbitalPeriodDays: 4333,
      rotationPeriodHours: 9.9,
      moons: 95,
      description: "Jupiter is the biggest planet! It's a gas giant with a famous giant storm called the Great Red Spot.",
      textureGradient: 'radial-gradient(circle, #E5B88A 0%, #C88B3A 50%, #A06020 100%)',
      temperatureC: -110,
      funFact: "Jupiter has 95 moons! Its moon Ganymede is bigger than Mercury."
    },
    {
      id: 'saturn',
      name: 'Saturn',
      type: 'planet',
      color: '#FAD5A5',
      radiusKm: 58232,
      distanceAu: 9.54,
      orbitalPeriodDays: 10759,
      rotationPeriodHours: 10.7,
      moons: 146,
      description: "Saturn is famous for its beautiful rings made of ice and rock! It's a gas giant with 146 moons.",
      textureGradient: 'radial-gradient(circle, #FFE5C5 0%, #FAD5A5 50%, #E5C090 100%)',
      temperatureC: -140,
      funFact: "Saturn is so light it could float in water!"
    },
    {
      id: 'uranus',
      name: 'Uranus',
      type: 'planet',
      color: '#4FD0E0',
      radiusKm: 25362,
      distanceAu: 19.19,
      orbitalPeriodDays: 30687,
      rotationPeriodHours: 17.2,
      moons: 28,
      description: "Uranus is an ice giant that spins on its side! It looks blue-green because of methane gas.",
      textureGradient: 'radial-gradient(circle, #6FE0F0 0%, #4FD0E0 50%, #3FC0D0 100%)',
      temperatureC: -195,
      funFact: "Uranus rolls around the Sun like a ball!"
    },
    {
      id: 'neptune',
      name: 'Neptune',
      type: 'planet',
      color: '#4169E1',
      radiusKm: 24622,
      distanceAu: 30.07,
      orbitalPeriodDays: 60190,
      rotationPeriodHours: 16.1,
      moons: 16,
      description: "Neptune is the farthest planet from the Sun. It's a windy, icy blue world with supersonic storms!",
      textureGradient: 'radial-gradient(circle, #5179F1 0%, #4169E1 50%, #3159D1 100%)',
      temperatureC: -200,
      funFact: "Neptune has the fastest winds in the solar system!"
    }
  ];

  // K-2: Inner planets only
  if (gradeLevel === 'K' || gradeLevel === '1' || gradeLevel === '2') {
    return [sun, ...innerPlanets];
  }

  // 3+: All planets
  return [sun, ...innerPlanets, ...outerPlanets];
}
