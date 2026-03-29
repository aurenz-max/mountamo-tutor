import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  LightShadowLabData,
  ShadowChallenge,
  ShadowObject,
  SunPosition,
  ShadowDirection,
  RelativeLength,
  ChallengeType,
  LabTheme,
} from '../../primitives/visual-primitives/astronomy/LightShadowLab';

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
// Each entry provides:
//   promptDoc        — injected into the Gemini prompt (only for allowed types)
//   schemaDescription — concise label for the schema enum description

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Exploration + MC. Student drags the sun to different positions and answers `
      + `observation questions like "When is the shadow shortest?" or "Which direction does the shadow point at noon?" `
      + `Include 2-3 distractors. Easiest difficulty (β=1.5). Good for K-2.`,
    schemaDescription: "'observe' (exploration + multiple choice)",
  },
  predict: {
    promptDoc:
      `"predict": Interactive prediction. Given a sun position (altitude/azimuth), student predicts `
      + `the shadow direction and relative length BEFORE seeing the result. `
      + `Include distractor options for wrong predictions. Medium difficulty (β=3.0). Good for grades 1-3.`,
    schemaDescription: "'predict' (predict shadow from sun position)",
  },
  measure: {
    promptDoc:
      `"measure": Data recording. Student records shadow data (direction + length) at multiple time points `
      + `throughout the day. Emphasize the pattern: shadows are long in morning/evening, short at midday. `
      + `Higher difficulty (β=4.5). Good for grades 3-5.`,
    schemaDescription: "'measure' (record shadow data at multiple times)",
  },
  apply: {
    promptDoc:
      `"apply": Reverse reasoning. Given a shadow's direction and length, student determines the `
      + `approximate time of day or sun position. Requires understanding the full shadow model. `
      + `Highest difficulty (β=6.0). Good for grades 4-5.`,
    schemaDescription: "'apply' (determine time from shadow)",
  },
};

// ============================================================================
// DEFAULT OBJECTS PER THEME
// ============================================================================

const DEFAULT_OBJECTS_BY_THEME: Record<LabTheme, ShadowObject[]> = {
  playground: [
    { type: 'stick_figure', height: 4, label: 'You' },
  ],
  sundial: [
    { type: 'flagpole', height: 6, label: 'Sundial gnomon' },
  ],
  science_lab: [
    { type: 'stick_figure', height: 5, label: 'Test object' },
  ],
};

// ============================================================================
// GEMINI SCHEMA — flattened nested objects in challenges
// ============================================================================

const lightShadowLabResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the shadow lab activity',
    },
    description: {
      type: Type.STRING,
      description: 'Clear description explaining what students will learn about shadows and sunlight',
    },
    theme: {
      type: Type.STRING,
      enum: ['playground', 'sundial', 'science_lab'],
      description: 'Visual theme for the lab environment',
    },
    gradeLevel: {
      type: Type.STRING,
      enum: ['K', '1', '2', '3', '4', '5'],
      description: 'Target grade level for content complexity',
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ['stick_figure', 'tree', 'flagpole', 'building'],
            description: 'Type of object casting the shadow',
          },
          height: {
            type: Type.NUMBER,
            description: 'Height of the object in arbitrary units (1-10)',
          },
          label: {
            type: Type.STRING,
            description: 'Display label for the object',
            nullable: true,
          },
        },
        required: ['type', 'height'],
      },
      description: 'Objects in the scene that cast shadows. 1-3 objects.',
    },
    sunPositions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: {
            type: Type.STRING,
            description: 'Time label (e.g., "8:00 AM", "12:00 PM", "4:00 PM")',
          },
          altitude: {
            type: Type.NUMBER,
            description: 'Sun altitude in degrees (0=horizon, 90=directly overhead). Morning/evening: 15-30, midday: 50-75.',
          },
          azimuth: {
            type: Type.NUMBER,
            description: 'Sun azimuth in degrees along the east-to-west arc (0=east, 90=south/overhead, 180=west). Morning: 10-50, midday: 80-100, afternoon: 130-170.',
          },
        },
        required: ['time', 'altitude', 'azimuth'],
      },
      description: 'Sun positions used across the activity. Include morning, midday, and afternoon.',
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
            enum: ['observe', 'predict', 'measure', 'apply'],
            description: 'Challenge type: observe (explore + MC), predict (predict shadow), measure (record data), apply (reverse reasoning)',
          },
          instruction: {
            type: Type.STRING,
            description: 'Clear instruction text for the student. Do NOT reveal the answer.',
          },
          // Flattened sunPosition fields
          sunPositionTime: {
            type: Type.STRING,
            description: 'Time label for this challenge\'s sun position (e.g., "10:00 AM")',
          },
          sunPositionAltitude: {
            type: Type.NUMBER,
            description: 'Sun altitude in degrees for this challenge (0-90)',
          },
          sunPositionAzimuth: {
            type: Type.NUMBER,
            description: 'Sun azimuth in degrees along east-to-west arc (0=east, 90=south/overhead, 180=west). Range 0-180.',
          },
          // Flattened correctShadow fields
          correctShadowDirection: {
            type: Type.STRING,
            enum: ['E', 'W', 'N'],
            description: 'Correct shadow direction. Azimuth < 80 (sun in east half) → shadow "W"; azimuth > 100 (sun in west half) → shadow "E"; 80-100 (overhead) → "N".',
          },
          correctShadowRelativeLength: {
            type: Type.STRING,
            enum: ['short', 'medium', 'long'],
            description: 'Correct relative shadow length. Altitude > 60 → short; 30-60 → medium; < 30 → long.',
          },
          distractor0: {
            type: Type.STRING,
            description: 'First wrong answer option for MC challenges',
            nullable: true,
          },
          distractor1: {
            type: Type.STRING,
            description: 'Second wrong answer option for MC challenges',
            nullable: true,
          },
          distractor2: {
            type: Type.STRING,
            description: 'Third wrong answer option for MC challenges',
            nullable: true,
          },
          hint: {
            type: Type.STRING,
            description: 'Pedagogical hint that guides without giving away the answer',
            nullable: true,
          },
        },
        required: [
          'id',
          'type',
          'instruction',
          'sunPositionTime',
          'sunPositionAltitude',
          'sunPositionAzimuth',
          'correctShadowDirection',
          'correctShadowRelativeLength',
        ],
      },
      description: 'Array of 3-5 challenges progressing in difficulty',
    },
  },
  required: [
    'title',
    'description',
    'theme',
    'gradeLevel',
    'objects',
    'sunPositions',
    'challenges',
  ],
};

// ============================================================================
// GRADE-APPROPRIATE CONFIGURATION
// ============================================================================

const GRADE_CONFIGURATIONS: Record<string, { theme: LabTheme; numChallenges: number; guidance: string }> = {
  K: {
    theme: 'playground',
    numChallenges: 3,
    guidance: 'Focus on observation only. "Look! Your shadow is long in the morning!" Use playground theme. Simple vocabulary.',
  },
  '1': {
    theme: 'playground',
    numChallenges: 3,
    guidance: 'Observation + simple predictions. "Where will your shadow point?" Morning vs afternoon comparison.',
  },
  '2': {
    theme: 'playground',
    numChallenges: 4,
    guidance: 'Observation + prediction. Compare shadow at different times. Introduce direction vocabulary (east/west).',
  },
  '3': {
    theme: 'sundial',
    numChallenges: 4,
    guidance: 'Prediction + measurement. Record shadow changes throughout the day. Introduce the idea that sun position controls shadow.',
  },
  '4': {
    theme: 'science_lab',
    numChallenges: 5,
    guidance: 'Measurement + application. Record data, identify patterns. Reverse reasoning: given shadow, estimate time.',
  },
  '5': {
    theme: 'science_lab',
    numChallenges: 5,
    guidance: 'Full range including application. Students should reason about altitude/azimuth relationship to shadow properties.',
  },
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and correct shadow direction based on sun azimuth.
 * Azimuth < 80° (sun in east) → shadow points W
 * Azimuth > 100° (sun in west) → shadow points E
 * Azimuth 80-100° (sun roughly south) → shadow points N
 */
function validateShadowDirection(azimuth: number): ShadowDirection {
  if (azimuth < 80) return 'W';
  if (azimuth > 100) return 'E';
  return 'N';
}

/**
 * Validate and correct shadow relative length based on sun altitude.
 * Altitude < 30° → long shadow
 * Altitude 30-60° → medium shadow
 * Altitude > 60° → short shadow
 */
function validateShadowLength(altitude: number): RelativeLength {
  if (altitude < 30) return 'long';
  if (altitude <= 60) return 'medium';
  return 'short';
}

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export const generateLightShadowLab = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
  },
): Promise<LightShadowLabData> => {
  const resolvedGrade = (gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as
    'K' | '1' | '2' | '3' | '4' | '5';
  const gradeConfig = GRADE_CONFIGURATIONS[resolvedGrade] || GRADE_CONFIGURATIONS['3'];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'light-shadow-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        lightShadowLabResponseSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : lightShadowLabResponseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an interactive Light & Shadow Lab activity for ${gradeLevel} students.

**Topic:** ${topic}

**Grade Level:** ${resolvedGrade}
**Theme:** ${gradeConfig.theme}
**Grade Guidance:** ${gradeConfig.guidance}

**Core Science Concepts:**
- Shadows form on the opposite side of an object from the light source
- When the sun is LOW in the sky (morning/evening), shadows are LONG
- When the sun is HIGH in the sky (midday), shadows are SHORT
- Shadow direction depends on where the sun is: sun in east → shadow points west, sun in west → shadow points east
- Shadows change throughout the day as the sun moves across the sky

**Sun Position Convention (CRITICAL — use this scale, NOT compass bearings):**
Azimuth is on a 0-180° east-to-west arc:
  0° = east (sunrise side, LEFT in the scene)
  90° = south / directly overhead
  180° = west (sunset side, RIGHT in the scene)

Reference positions:
- Early morning (~7-8 AM): altitude 15-25°, azimuth 15-35° → LONG shadow pointing WEST (right)
- Mid-morning (~10 AM): altitude 35-45°, azimuth 55-75° → MEDIUM shadow pointing WEST (right)
- Midday (~12 PM): altitude 55-75°, azimuth 85-95° → SHORT shadow pointing NORTH (below)
- Mid-afternoon (~2 PM): altitude 35-45°, azimuth 110-130° → MEDIUM shadow pointing EAST (left)
- Late afternoon (~4-5 PM): altitude 15-25°, azimuth 145-165° → LONG shadow pointing EAST (left)

**Shadow Validation Rules (MUST follow):**
- correctShadowDirection: if azimuth < 80 → "W", if azimuth 80-100 → "N", if azimuth > 100 → "E"
- correctShadowRelativeLength: if altitude < 30 → "long", 30-60 → "medium", > 60 → "short"

${challengeTypeSection}

**Objects:** Include 1-2 objects appropriate for the theme.
- playground: stick_figure, tree
- sundial: flagpole
- science_lab: stick_figure, flagpole

**Sun Positions:** Include 3-5 sun positions spanning the day (morning, midday, afternoon at minimum).

**Challenges:** Generate ${gradeConfig.numChallenges} challenges that progress in difficulty.
- For observe/predict types: include 2-3 distractor answer options
- For all types: include a pedagogical hint
- Do NOT reveal answers in instruction text
- Use warm, encouraging language for younger grades

IMPORTANT — Flat challenge fields:
- Use sunPositionTime, sunPositionAltitude, sunPositionAzimuth (NOT nested sunPosition object)
- Use correctShadowDirection, correctShadowRelativeLength (NOT nested correctShadow object)

Generate a complete, educationally sound activity configuration.
`;

  logEvalModeResolution('LightShadowLab', config?.targetEvalMode, evalConstraint);

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

    // ── Reconstruct nested objects from flat Gemini fields ──
    const challenges: ShadowChallenge[] = (raw.challenges || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any, i: number) => {
        const altitude: number = c.sunPositionAltitude ?? 45;
        const azimuth: number = c.sunPositionAzimuth ?? 180;

        const challenge: ShadowChallenge = {
          id: c.id || `c${i + 1}`,
          type: c.type as ChallengeType,
          instruction: c.instruction || 'Observe the shadow.',
          sunPosition: {
            time: c.sunPositionTime || '12:00 PM',
            altitude,
            azimuth,
          },
          correctShadow: {
            direction: validateShadowDirection(azimuth),
            relativeLength: validateShadowLength(altitude),
          },
        };

        if (c.distractor0) challenge.distractor0 = c.distractor0;
        if (c.distractor1) challenge.distractor1 = c.distractor1;
        if (c.distractor2) challenge.distractor2 = c.distractor2;
        if (c.hint) challenge.hint = c.hint;

        return challenge;
      },
    );

    // ── Collect sun positions from challenges + any top-level ones ──
    const sunPositionMap = new Map<string, SunPosition>();
    // Add top-level sun positions
    if (Array.isArray(raw.sunPositions)) {
      for (const sp of raw.sunPositions) {
        if (sp.time) {
          sunPositionMap.set(sp.time, {
            time: sp.time,
            altitude: sp.altitude ?? 45,
            azimuth: sp.azimuth ?? 180,
          });
        }
      }
    }
    // Ensure challenge sun positions are included
    for (const ch of challenges) {
      if (!sunPositionMap.has(ch.sunPosition.time)) {
        sunPositionMap.set(ch.sunPosition.time, ch.sunPosition);
      }
    }
    const sunPositions: SunPosition[] = Array.from(sunPositionMap.values());

    // ── Default objects based on theme ──
    const theme: LabTheme = raw.theme || gradeConfig.theme;
    const objects: ShadowObject[] =
      Array.isArray(raw.objects) && raw.objects.length > 0
        ? raw.objects.map((o: { type?: string; height?: number; label?: string }) => ({
            type: o.type || 'stick_figure',
            height: o.height || 5,
            ...(o.label ? { label: o.label } : {}),
          }))
        : DEFAULT_OBJECTS_BY_THEME[theme] || DEFAULT_OBJECTS_BY_THEME['playground'];

    const finalData: LightShadowLabData = {
      title: raw.title || 'Light & Shadow Lab',
      description: raw.description || 'Explore how shadows change as the sun moves across the sky!',
      theme,
      gradeLevel: resolvedGrade,
      objects,
      sunPositions,
      challenges,
    };

    return finalData;
  } catch (error) {
    console.error('Error generating LightShadowLab content:', error);

    // ── Fallback default ──
    const theme = gradeConfig.theme;
    return {
      title: 'Light & Shadow Lab',
      description: 'Explore how shadows change as the sun moves across the sky!',
      theme,
      gradeLevel: resolvedGrade,
      objects: DEFAULT_OBJECTS_BY_THEME[theme],
      sunPositions: [
        { time: '8:00 AM', altitude: 20, azimuth: 25 },
        { time: '12:00 PM', altitude: 65, azimuth: 90 },
        { time: '4:00 PM', altitude: 20, azimuth: 155 },
      ],
      challenges: [
        {
          id: 'c1',
          type: 'observe',
          instruction: 'Drag the sun to each position. When is the shadow shortest?',
          sunPosition: { time: '12:00 PM', altitude: 65, azimuth: 90 },
          correctShadow: { direction: 'N', relativeLength: 'short' },
          distractor0: 'Morning',
          distractor1: 'Evening',
          hint: 'Think about when the sun is highest in the sky.',
        },
        {
          id: 'c2',
          type: 'predict',
          instruction: 'The sun is low in the east. Which direction will the shadow point?',
          sunPosition: { time: '8:00 AM', altitude: 20, azimuth: 25 },
          correctShadow: { direction: 'W', relativeLength: 'long' },
          distractor0: 'East',
          distractor1: 'Straight up',
          hint: 'Shadows always point away from the light source.',
        },
      ],
    };
  }
};
