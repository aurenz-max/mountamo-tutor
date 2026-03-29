import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  SoundWaveExplorerData,
  VibrationSource,
  SoundMedium,
  SoundDistance,
  SoundChallengeType,
  SoundLabTheme,
  VibrationObject,
  SoundChallenge,
} from '../../primitives/visual-primitives/physics/SoundWaveExplorer';

import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// Re-export for convenience
export type {
  SoundWaveExplorerData,
  VibrationSource,
  SoundMedium,
  SoundDistance,
  SoundChallengeType,
  SoundLabTheme,
  VibrationObject,
  SoundChallenge,
};

// ============================================================================
// CHALLENGE TYPE DOCUMENTATION REGISTRY
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Exploration + MC. Student taps different objects and observes what happens. `
      + `Questions like "Which object makes the lowest sound?" or "What happens when you pluck harder?" `
      + `Include 2-3 distractors. Easiest difficulty. Good for K-1.`,
    schemaDescription: "'observe' (exploration + multiple choice)",
  },
  predict: {
    promptDoc:
      `"predict": Interactive prediction. Given a vibration source and settings (force, speed, medium), `
      + `student predicts the resulting sound characteristics BEFORE hearing/seeing the result. `
      + `Include distractor options. Medium difficulty. Good for grades 1-2.`,
    schemaDescription: "'predict' (predict sound from vibration settings)",
  },
  classify: {
    promptDoc:
      `"classify": Categorization. Student classifies sounds or vibration sources by pitch (high/medium/low), `
      + `loudness (quiet/medium/loud), or medium (travels/doesn't travel). `
      + `Include distractors. Medium-high difficulty. Good for grades 2-3.`,
    schemaDescription: "'classify' (categorize sounds by properties)",
  },
  apply: {
    promptDoc:
      `"apply": Reverse reasoning. Given a description of a sound (e.g., "loud and high-pitched"), `
      + `student determines which object, force level, or speed level would produce it. `
      + `Requires understanding the full vibration-to-sound model. Highest difficulty. Good for grade 3.`,
    schemaDescription: "'apply' (determine settings from sound description)",
  },
};

// ============================================================================
// DETERMINISTIC OBJECTS — science facts, not creative content
// ============================================================================

const OBJECT_LIBRARY: Record<VibrationSource, VibrationObject> = {
  guitar_string: { type: 'guitar_string', label: 'Guitar String', basePitch: 'medium', baseLoudness: 'medium' },
  drum:          { type: 'drum',          label: 'Big Drum',      basePitch: 'low',    baseLoudness: 'loud' },
  tuning_fork:   { type: 'tuning_fork',  label: 'Tuning Fork',   basePitch: 'high',   baseLoudness: 'quiet' },
  rubber_band:   { type: 'rubber_band',  label: 'Rubber Band',   basePitch: 'medium', baseLoudness: 'quiet' },
  bell:          { type: 'bell',          label: 'Bell',          basePitch: 'high',   baseLoudness: 'medium' },
  whistle:       { type: 'whistle',       label: 'Whistle',       basePitch: 'high',   baseLoudness: 'loud' },
};

/** Pick contrasting objects by grade — low+high pitch pair, expanding set for higher grades */
function objectsForGrade(grade: string): VibrationObject[] {
  switch (grade) {
    case 'K':  return [OBJECT_LIBRARY.drum, OBJECT_LIBRARY.bell];
    case '1':  return [OBJECT_LIBRARY.drum, OBJECT_LIBRARY.tuning_fork];
    case '2':  return [OBJECT_LIBRARY.drum, OBJECT_LIBRARY.tuning_fork, OBJECT_LIBRARY.guitar_string];
    case '3':  return [OBJECT_LIBRARY.drum, OBJECT_LIBRARY.tuning_fork, OBJECT_LIBRARY.guitar_string, OBJECT_LIBRARY.whistle];
    default:   return [OBJECT_LIBRARY.drum, OBJECT_LIBRARY.tuning_fork];
  }
}

// ============================================================================
// SIMPLIFIED GEMINI SCHEMA — objects removed, challenges trimmed
// ============================================================================

const soundWaveExplorerResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging, age-appropriate title for the sound wave exploration activity',
    },
    description: {
      type: Type.STRING,
      description: 'Clear description explaining what students will learn about sound and vibrations',
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
            enum: ['observe', 'predict', 'classify', 'apply'],
            description: 'Challenge type',
          },
          instruction: {
            type: Type.STRING,
            description: 'Clear instruction text for the student. Do NOT reveal the answer.',
          },
          vibrationObject: {
            type: Type.STRING,
            enum: ['guitar_string', 'drum', 'tuning_fork', 'rubber_band', 'bell', 'whistle'],
            description: 'Which vibration source this challenge uses',
          },
          correctAnswer: {
            type: Type.STRING,
            description: 'The correct answer to the challenge question',
          },
          distractor0: {
            type: Type.STRING,
            description: 'First wrong answer option',
          },
          distractor1: {
            type: Type.STRING,
            description: 'Second wrong answer option',
          },
          hint: {
            type: Type.STRING,
            description: 'Pedagogical hint that guides without giving away the answer',
          },
        },
        required: ['id', 'type', 'instruction', 'vibrationObject', 'correctAnswer', 'distractor0', 'distractor1', 'hint'],
      },
      description: 'Array of challenges progressing in difficulty',
    },
  },
  required: ['title', 'description', 'challenges'],
};

// ============================================================================
// GRADE-APPROPRIATE CONFIGURATION
// ============================================================================

const GRADE_CONFIGURATIONS: Record<string, { theme: SoundLabTheme; numChallenges: number; guidance: string }> = {
  K: {
    theme: 'music_room',
    numChallenges: 4,
    guidance: 'Focus on observation. "Tap the drum! Can you feel it shake?" Simple cause-and-effect. Very simple vocabulary.',
  },
  '1': {
    theme: 'music_room',
    numChallenges: 4,
    guidance: 'Observation + simple predictions. "What happens when you pluck harder?" Compare loud vs quiet, high vs low pitch.',
  },
  '2': {
    theme: 'playground',
    numChallenges: 5,
    guidance: 'Prediction + classification. Compare different objects. Introduce the idea that vibrations make sound, faster vibrations = higher pitch.',
  },
  '3': {
    theme: 'science_lab',
    numChallenges: 6,
    guidance: 'Full range including apply. Sound travel through materials (air vs water vs solid vs vacuum). Distance affects volume. Reverse reasoning.',
  },
};

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export const generateSoundWaveExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
  },
): Promise<SoundWaveExplorerData> => {
  const resolvedGrade = (gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '1') as
    'K' | '1' | '2' | '3';
  const validGrades = ['K', '1', '2', '3'];
  const finalGrade = validGrades.includes(resolvedGrade) ? resolvedGrade : '1';
  const gradeConfig = GRADE_CONFIGURATIONS[finalGrade] || GRADE_CONFIGURATIONS['1'];

  // ── Deterministic objects (science facts, not LLM content) ──
  const objects = objectsForGrade(finalGrade);
  const objectNames = objects.map(o => o.type).join(', ');

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'sound-wave-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        soundWaveExplorerResponseSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : soundWaveExplorerResponseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a Sound Wave Exploration Lab activity for Grade ${finalGrade} students.

Topic: ${topic}
Grade Guidance: ${gradeConfig.guidance}

Available objects: ${objectNames}
Object properties:
${objects.map(o => `- ${o.type}: ${o.basePitch} pitch, ${o.baseLoudness} loudness`).join('\n')}

Core science:
- FORCE (1-5) = VOLUME. Harder hit = bigger vibrations = louder.
- SPEED (1-5) = PITCH. Faster vibrations = higher pitch.
- Medium: air (normal), water (muffled), solid_wall (very well), vacuum (no sound).
- Distance: close = loud, far = quiet.

${challengeTypeSection}

Generate ${gradeConfig.numChallenges} challenges. Each challenge must use one of: ${objectNames}.
Include 2 distractor answers and a pedagogical hint per challenge.
NEVER reveal the answer in the instruction text.
Use warm, age-appropriate language for Grade ${finalGrade}.
`;

  logEvalModeResolution('SoundWaveExplorer', config?.targetEvalMode, evalConstraint);

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

    // ── Post-process challenges ──
    const allowedTypes = evalConstraint?.allowedTypes;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challenges: SoundChallenge[] = (raw.challenges || []).map((c: any, i: number) => {
      let type = c.type as SoundChallengeType;

      // SP-9 safety net: force type to match eval constraint
      if (allowedTypes && !allowedTypes.includes(type)) {
        type = allowedTypes[0] as SoundChallengeType;
      }

      const challenge: SoundChallenge = {
        id: c.id || `c${i + 1}`,
        type,
        instruction: c.instruction || 'Explore the sound!',
        vibrationObject: c.vibrationObject as VibrationSource,
        correctAnswer: c.correctAnswer || '',
      };

      if (c.distractor0) challenge.distractor0 = c.distractor0;
      if (c.distractor1) challenge.distractor1 = c.distractor1;
      if (c.distractor2) challenge.distractor2 = c.distractor2;
      if (c.hint) challenge.hint = c.hint;

      return challenge;
    });

    return {
      title: raw.title || 'Sound Wave Explorer',
      description: raw.description || 'Explore how vibrations make sound!',
      theme: gradeConfig.theme,
      gradeLevel: finalGrade as 'K' | '1' | '2' | '3',
      objects,
      challenges,
    };
  } catch (error) {
    console.error('Error generating SoundWaveExplorer content:', error);

    // ── Fallback default ──
    return {
      title: 'Sound Wave Explorer',
      description: 'Explore how vibrations make sound!',
      theme: gradeConfig.theme,
      gradeLevel: finalGrade as 'K' | '1' | '2' | '3',
      objects,
      challenges: [
        {
          id: 'c1',
          type: 'observe',
          instruction: 'Tap the drum and the tuning fork. Which one makes a lower sound?',
          vibrationObject: 'drum',
          correctAnswer: 'The drum makes a lower sound',
          distractor0: 'The tuning fork makes a lower sound',
          distractor1: 'They sound the same',
          hint: 'Listen carefully to how deep or high each sound is.',
        },
        {
          id: 'c2',
          type: 'predict',
          instruction: 'If you hit the drum very gently, what will happen to the sound?',
          vibrationObject: 'drum',
          forceLevel: 1,
          correctAnswer: 'The sound will be quiet',
          distractor0: 'The sound will be loud',
          distractor1: 'The pitch will change',
          hint: 'Think about what happens when you tap something softly versus hard.',
        },
      ],
    };
  }
};
