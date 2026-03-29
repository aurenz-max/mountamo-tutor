import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  ConstellationBuilderData,
  ChallengeType,
  StarData,
  ConnectionLine,
  ConstellationChallenge,
} from '../../primitives/visual-primitives/astronomy/ConstellationBuilder';

import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// CHALLENGE TYPE DOCUMENTATION REGISTRY
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  guided_trace: {
    promptDoc:
      `"guided_trace": Numbered dots. Student taps stars in order to trace the constellation. `
      + `Easiest difficulty (β=1.5). Good for K-1. `
      + `IMPORTANT: For N stars in starOrder, generate exactly N-1 connections (consecutive pairs only). `
      + `Do NOT create a closing loop connection back to the first star.`,
    schemaDescription: "'guided_trace' (tap stars in numbered order)",
  },
  free_connect: {
    promptDoc:
      `"free_connect": No numbers. Student identifies and connects correct stars from the field. `
      + `Medium difficulty (β=3.0). Good for grades 1-3.`,
    schemaDescription: "'free_connect' (connect correct stars freely)",
  },
  identify: {
    promptDoc:
      `"identify": Constellation lines already drawn. Student selects correct name from options. `
      + `Reverse recognition (β=4.5). Good for grades 2-4.`,
    schemaDescription: "'identify' (select constellation name from options)",
  },
  seasonal: {
    promptDoc:
      `"seasonal": Student identifies which constellations are visible in a given season. `
      + `Applied knowledge (β=6.0). Good for grades 3-5. `
      + `CRITICAL RULES FOR SEASONAL INSTRUCTIONS:\n`
      + `1. Instructions MUST ONLY mention the season/time of year. Example: "Which constellation is best visible in winter evenings?"\n`
      + `2. NEVER mention the constellation's shape (no "W", "M", "cross", "dipper", "hunter", "lion", "bird", "swan", "bear").\n`
      + `3. NEVER mention mythology figures or what the constellation represents.\n`
      + `4. NEVER reference stars, star fields, or tracing — seasonal mode shows only buttons and a season label, no star SVG.\n`
      + `5. The ONLY clue should be the season. The student must know constellation-season associations to answer.`,
    schemaDescription: "'seasonal' (identify constellations by season)",
  },
};

// ============================================================================
// GEMINI SCHEMA — flattened nested arrays in challenges
// ============================================================================

const constellationBuilderResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the constellation activity',
    },
    description: {
      type: Type.STRING,
      description: 'Clear description explaining what students will learn about constellations',
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ['K', '1', '2', '3', '4', '5'],
      description: 'Target grade level for content complexity',
    },
    stars: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Unique star identifier (e.g., "s1", "s2")',
          },
          x: {
            type: Type.NUMBER,
            description: 'X position in 0-100 coordinate space',
          },
          y: {
            type: Type.NUMBER,
            description: 'Y position in 0-100 coordinate space',
          },
          magnitude: {
            type: Type.NUMBER,
            description: 'Star brightness 1-6 (1=brightest, 6=dimmest). Constellation stars should be 1-3, background stars 4-6.',
          },
          isPartOfConstellation: {
            type: Type.BOOLEAN,
            description: 'True if this star belongs to the target constellation',
          },
        },
        required: ['id', 'x', 'y', 'magnitude', 'isPartOfConstellation'],
      },
      description: 'Star field with 15-25 stars. Mix of constellation stars (bright) and background/distractor stars (dim).',
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Unique challenge identifier (e.g., "c1", "c2")',
          },
          type: {
            type: Type.STRING,
            enum: ['guided_trace', 'free_connect', 'identify', 'seasonal'],
            description: 'Challenge type',
          },
          constellationName: {
            type: Type.STRING,
            description: 'Name of the constellation (e.g., "Big Dipper", "Orion")',
          },
          instruction: {
            type: Type.STRING,
            description: 'Clear instruction for the student. Do NOT reveal the answer.',
          },
          // Flattened starOrder array → CSV string
          starOrderCsv: {
            type: Type.STRING,
            description: 'Comma-separated star IDs in correct tracing order (e.g., "s1,s3,s5,s7"). Used for guided_trace.',
          },
          // Flattened correctConnections array → pairs of from/to fields
          correctConn0From: { type: Type.STRING, description: 'Connection 0: from star ID', nullable: true },
          correctConn0To: { type: Type.STRING, description: 'Connection 0: to star ID', nullable: true },
          correctConn1From: { type: Type.STRING, description: 'Connection 1: from star ID', nullable: true },
          correctConn1To: { type: Type.STRING, description: 'Connection 1: to star ID', nullable: true },
          correctConn2From: { type: Type.STRING, description: 'Connection 2: from star ID', nullable: true },
          correctConn2To: { type: Type.STRING, description: 'Connection 2: to star ID', nullable: true },
          correctConn3From: { type: Type.STRING, description: 'Connection 3: from star ID', nullable: true },
          correctConn3To: { type: Type.STRING, description: 'Connection 3: to star ID', nullable: true },
          correctConn4From: { type: Type.STRING, description: 'Connection 4: from star ID', nullable: true },
          correctConn4To: { type: Type.STRING, description: 'Connection 4: to star ID', nullable: true },
          correctConn5From: { type: Type.STRING, description: 'Connection 5: from star ID', nullable: true },
          correctConn5To: { type: Type.STRING, description: 'Connection 5: to star ID', nullable: true },
          correctConn6From: { type: Type.STRING, description: 'Connection 6: from star ID', nullable: true },
          correctConn6To: { type: Type.STRING, description: 'Connection 6: to star ID', nullable: true },
          correctConn7From: { type: Type.STRING, description: 'Connection 7: from star ID', nullable: true },
          correctConn7To: { type: Type.STRING, description: 'Connection 7: to star ID', nullable: true },
          mythologyFact: {
            type: Type.STRING,
            description: 'Fun mythology or science fact about this constellation',
          },
          season: {
            type: Type.STRING,
            description: 'Best viewing season (e.g., "winter", "summer", "spring", "fall", "year-round")',
          },
          distractorName0: {
            type: Type.STRING,
            description: 'First wrong constellation name option (for identify type)',
            nullable: true,
          },
          distractorName1: {
            type: Type.STRING,
            description: 'Second wrong constellation name option',
            nullable: true,
          },
          distractorName2: {
            type: Type.STRING,
            description: 'Third wrong constellation name option',
            nullable: true,
          },
        },
        required: [
          'id',
          'type',
          'constellationName',
          'instruction',
          'starOrderCsv',
          'mythologyFact',
          'season',
        ],
      },
      description: 'Array of 3-5 challenges progressing in difficulty',
    },
  },
  required: ['title', 'description', 'gradeLevel', 'stars', 'challenges'],
};

// ============================================================================
// GRADE-APPROPRIATE CONFIGURATION
// ============================================================================

const GRADE_CONFIGURATIONS: Record<string, { numChallenges: number; guidance: string }> = {
  K: {
    numChallenges: 3,
    guidance: 'Focus on guided tracing only. Simple constellations (Big Dipper). Warm, encouraging language.',
  },
  '1': {
    numChallenges: 3,
    guidance: 'Guided tracing + simple free connect. Big Dipper, Orion. Simple vocabulary.',
  },
  '2': {
    numChallenges: 4,
    guidance: 'Mix of guided trace, free connect, and identification. Introduce constellation names and mythology.',
  },
  '3': {
    numChallenges: 4,
    guidance: 'Free connect, identify, and introduce seasonal. Include mythology facts. More constellations.',
  },
  '4': {
    numChallenges: 5,
    guidance: 'All challenge types. Students reason about seasonal visibility. Include multiple constellations.',
  },
  '5': {
    numChallenges: 5,
    guidance: 'Full range including seasonal reasoning. Students connect constellation visibility to Earth\'s orbit.',
  },
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Parse flattened correctConn*From/To fields back into ConnectionLine[].
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseConnections(raw: any): ConnectionLine[] {
  const connections: ConnectionLine[] = [];
  for (let i = 0; i < 8; i++) {
    const from = raw[`correctConn${i}From`];
    const to = raw[`correctConn${i}To`];
    if (from && to) {
      connections.push({ fromStarId: from, toStarId: to });
    }
  }
  return connections;
}

/**
 * Parse comma-separated star order string back into string[].
 */
function parseStarOrder(csv: string | undefined): string[] {
  if (!csv || csv.trim() === '') return [];
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * CB-2/CB-3: Sanitize seasonal instructions — remove shape/figure descriptions that leak the answer.
 * If the instruction contains shape hints, replace with a generic season-only question.
 */
const SHAPE_LEAK_PATTERNS = /\b(hunter|lion|bear|swan|bird|cross|dipper|spoon|W|M|queen|king|scorpion|crab|fish|twins|archer|water.?bearer|ram|bull|scales|virgin|goat)\b/i;

function sanitizeSeasonalInstruction(instruction: string, season: string): string {
  if (SHAPE_LEAK_PATTERNS.test(instruction)) {
    return `Which constellation is best visible during ${season} evenings? Select your answer from the options below.`;
  }
  return instruction;
}

/**
 * For guided_trace: derive correctConnections from starOrder as N-1 consecutive pairs.
 * Removes any closing loop the LLM may have added (CB-1).
 */
function deriveGuidedTraceConnections(starOrder: string[]): ConnectionLine[] {
  const connections: ConnectionLine[] = [];
  for (let i = 0; i < starOrder.length - 1; i++) {
    connections.push({ fromStarId: starOrder[i], toStarId: starOrder[i + 1] });
  }
  return connections;
}

/**
 * Validate that all star IDs referenced in challenges exist in the star field.
 */
function validateStarReferences(
  stars: StarData[],
  connections: ConnectionLine[],
  starOrder: string[],
): boolean {
  const starIds = new Set(stars.map((s) => s.id));
  for (const conn of connections) {
    if (!starIds.has(conn.fromStarId) || !starIds.has(conn.toStarId)) return false;
  }
  for (const id of starOrder) {
    if (!starIds.has(id)) return false;
  }
  return true;
}

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export const generateConstellationBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
  },
): Promise<ConstellationBuilderData> => {
  const resolvedGrade = (gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as
    'K' | '1' | '2' | '3' | '4' | '5';
  const gradeConfig = GRADE_CONFIGURATIONS[resolvedGrade] || GRADE_CONFIGURATIONS['3'];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'constellation-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        constellationBuilderResponseSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : constellationBuilderResponseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an interactive Constellation Builder activity for ${gradeLevel} students.

**Topic:** ${topic}

**Grade Level:** ${resolvedGrade}
**Grade Guidance:** ${gradeConfig.guidance}

**Core Concepts:**
- Constellations are patterns of stars that ancient cultures named after animals, heroes, and objects
- Stars have different brightnesses (magnitudes: 1=brightest, 6=dimmest)
- Different constellations are visible in different seasons due to Earth's orbit
- Constellation stars are typically brighter than surrounding background stars

**Star Field Requirements:**
- Generate 15-25 stars in a 0-100 coordinate space (x and y both 0-100)
- Include constellation stars (magnitude 1-3, isPartOfConstellation=true) AND background distractor stars (magnitude 4-6, isPartOfConstellation=false)
- Use REAL constellation data with accurate relative star positions:
  - Big Dipper: 7 stars forming the iconic dipper shape
  - Orion: belt stars roughly in a line, with shoulders and knees
  - Cassiopeia: W-shaped pattern of 5 stars
  - Leo: sickle/hook shape with triangle body
  - Cygnus: cross/swan shape
  - Other real constellations are welcome

**Connection Format (IMPORTANT — flat fields, NOT nested arrays):**
- Use correctConn0From/correctConn0To, correctConn1From/correctConn1To, ... up to correctConn7From/correctConn7To
- Each pair represents one line segment connecting two stars
- Star IDs must match IDs in the stars array
- starOrderCsv: comma-separated star IDs in correct tracing order (e.g., "s1,s3,s5")

${challengeTypeSection}

**Challenges:** Generate ${gradeConfig.numChallenges} challenges that progress in difficulty.
- For identify types: include 2-3 distractorName options (real constellation names, not made-up)
- Each challenge must include a mythology/science fact and best viewing season
- Do NOT reveal answers in instruction text
- Use warm, encouraging language for younger grades

Generate a complete, educationally sound activity configuration with real constellation data.
`;

  logEvalModeResolution('ConstellationBuilder', config?.targetEvalMode, evalConstraint);

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
      },
    });

    const raw = JSON.parse(result.text || '{}');

    // ── Parse stars ──
    const stars: StarData[] = (raw.stars || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any, i: number) => ({
        id: s.id || `s${i + 1}`,
        x: Math.max(0, Math.min(100, s.x ?? 50)),
        y: Math.max(0, Math.min(100, s.y ?? 50)),
        magnitude: Math.max(1, Math.min(6, s.magnitude ?? 3)),
        isPartOfConstellation: s.isPartOfConstellation ?? false,
      }),
    );

    // ── Reconstruct challenges from flat Gemini fields ──
    const challenges: ConstellationChallenge[] = (raw.challenges || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any, i: number) => {
        const rawConnections = parseConnections(c);
        const starOrder = parseStarOrder(c.starOrderCsv);

        // CB-1: For guided_trace, derive connections from starOrder (N-1 consecutive pairs, no loop)
        const connections = (c.type === 'guided_trace' && starOrder.length > 1)
          ? deriveGuidedTraceConnections(starOrder)
          : rawConnections;

        // Validate star references; if invalid, filter to valid ones
        if (!validateStarReferences(stars, connections, starOrder)) {
          const starIds = new Set(stars.map((s) => s.id));
          const validConnections = connections.filter(
            (conn) => starIds.has(conn.fromStarId) && starIds.has(conn.toStarId),
          );
          const validStarOrder = starOrder.filter((id) => starIds.has(id));

          const instruction = c.instruction || 'Connect the stars to form the constellation.';
          const season = c.season || 'year-round';
          const challenge: ConstellationChallenge = {
            id: c.id || `c${i + 1}`,
            type: c.type as ChallengeType,
            constellationName: c.constellationName || 'Big Dipper',
            // CB-2/CB-3: sanitize seasonal instructions to remove shape leaks
            instruction: c.type === 'seasonal' ? sanitizeSeasonalInstruction(instruction, season) : instruction,
            starOrder: validStarOrder,
            correctConnections: validConnections,
            mythologyFact: c.mythologyFact || 'Ancient people used constellations to navigate.',
            season,
          };

          if (c.distractorName0) challenge.distractorName0 = c.distractorName0;
          if (c.distractorName1) challenge.distractorName1 = c.distractorName1;
          if (c.distractorName2) challenge.distractorName2 = c.distractorName2;

          return challenge;
        }

        const instruction = c.instruction || 'Connect the stars to form the constellation.';
        const season = c.season || 'year-round';
        const challenge: ConstellationChallenge = {
          id: c.id || `c${i + 1}`,
          type: c.type as ChallengeType,
          constellationName: c.constellationName || 'Big Dipper',
          // CB-2/CB-3: sanitize seasonal instructions to remove shape leaks
          instruction: c.type === 'seasonal' ? sanitizeSeasonalInstruction(instruction, season) : instruction,
          starOrder,
          correctConnections: connections,
          mythologyFact: c.mythologyFact || 'Ancient people used constellations to navigate.',
          season,
        };

        if (c.distractorName0) challenge.distractorName0 = c.distractorName0;
        if (c.distractorName1) challenge.distractorName1 = c.distractorName1;
        if (c.distractorName2) challenge.distractorName2 = c.distractorName2;

        return challenge;
      },
    );

    const finalData: ConstellationBuilderData = {
      title: raw.title || 'Constellation Builder',
      description: raw.description || 'Connect stars to discover constellations in the night sky!',
      gradeLevel: resolvedGrade,
      stars,
      challenges,
    };

    return finalData;
  } catch (error) {
    console.error('Error generating ConstellationBuilder content:', error);

    // ── Fallback default: Big Dipper ──
    return {
      title: 'Constellation Builder',
      description: 'Connect stars to discover constellations in the night sky!',
      gradeLevel: resolvedGrade,
      stars: [
        { id: 's1', x: 25, y: 30, magnitude: 2, isPartOfConstellation: true },
        { id: 's2', x: 30, y: 28, magnitude: 2, isPartOfConstellation: true },
        { id: 's3', x: 35, y: 32, magnitude: 2, isPartOfConstellation: true },
        { id: 's4', x: 40, y: 35, magnitude: 2, isPartOfConstellation: true },
        { id: 's5', x: 45, y: 38, magnitude: 2, isPartOfConstellation: true },
        { id: 's6', x: 50, y: 35, magnitude: 2, isPartOfConstellation: true },
        { id: 's7', x: 50, y: 28, magnitude: 2, isPartOfConstellation: true },
        { id: 's8', x: 15, y: 20, magnitude: 5, isPartOfConstellation: false },
        { id: 's9', x: 60, y: 50, magnitude: 4, isPartOfConstellation: false },
        { id: 's10', x: 70, y: 15, magnitude: 5, isPartOfConstellation: false },
        { id: 's11', x: 80, y: 60, magnitude: 6, isPartOfConstellation: false },
        { id: 's12', x: 10, y: 70, magnitude: 5, isPartOfConstellation: false },
        { id: 's13', x: 55, y: 75, magnitude: 4, isPartOfConstellation: false },
        { id: 's14', x: 90, y: 40, magnitude: 6, isPartOfConstellation: false },
        { id: 's15', x: 35, y: 65, magnitude: 5, isPartOfConstellation: false },
      ],
      challenges: [
        {
          id: 'c1',
          type: 'guided_trace',
          constellationName: 'Big Dipper',
          instruction: 'Follow the numbered stars to trace the Big Dipper!',
          starOrder: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'],
          correctConnections: [
            { fromStarId: 's1', toStarId: 's2' },
            { fromStarId: 's2', toStarId: 's3' },
            { fromStarId: 's3', toStarId: 's4' },
            { fromStarId: 's4', toStarId: 's5' },
            { fromStarId: 's5', toStarId: 's6' },
            { fromStarId: 's6', toStarId: 's7' },
          ],
          mythologyFact: 'The Big Dipper is part of the constellation Ursa Major, the Great Bear. Ancient Greeks said it was a bear placed in the sky by Zeus.',
          season: 'year-round',
        },
        {
          id: 'c2',
          type: 'free_connect',
          constellationName: 'Big Dipper',
          instruction: 'Can you connect the bright stars to form the Big Dipper without the numbers?',
          starOrder: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'],
          correctConnections: [
            { fromStarId: 's1', toStarId: 's2' },
            { fromStarId: 's2', toStarId: 's3' },
            { fromStarId: 's3', toStarId: 's4' },
            { fromStarId: 's4', toStarId: 's5' },
            { fromStarId: 's5', toStarId: 's6' },
            { fromStarId: 's6', toStarId: 's7' },
          ],
          mythologyFact: 'The two stars at the end of the Big Dipper\'s bowl point toward Polaris, the North Star!',
          season: 'year-round',
        },
      ],
    };
  }
};
