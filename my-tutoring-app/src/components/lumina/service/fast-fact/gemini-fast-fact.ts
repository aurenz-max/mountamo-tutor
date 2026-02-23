/**
 * Fast Fact Generator - Dedicated service for timed fluency drill content
 *
 * Subject-agnostic: infers subject from the topic / learning objective.
 * Generates 8-12 challenges across 2-3 phases (recall, apply, speed-round, etc.)
 *
 * Uses a FLAT Gemini schema to avoid malformed nested JSON, then reconstructs
 * the nested FastFactChallenge structure during validation.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { FastFactData, FastFactChallenge } from '../../primitives/visual-primitives/core/FastFact';

// ============================================================================
// Grade-Level Context Helper
// ============================================================================

const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'Toddler': 'toddlers (ages 1-3) — very simple concepts, concrete examples, playful engagement.',
    'Preschool': 'preschool children (ages 3-5) — simple sentences, colorful examples, hands-on concepts.',
    'Kindergarten': 'kindergarten students (ages 5-6) — clear language, foundational skills, engaging visuals.',
    'Elementary': 'elementary students (grades 1-5) — age-appropriate vocabulary, concrete examples, interactive elements.',
    'Middle School': 'middle school students (grades 6-8) — more complex vocabulary, abstract concepts, real-world applications.',
    'High School': 'high school students (grades 9-12) — advanced vocabulary, sophisticated concepts, academic rigor.',
    'Undergraduate': 'undergraduate college students — academic language, theoretical frameworks, research-based content.',
    'Graduate': 'graduate students — specialized terminology, advanced theory, professional applications.',
    'PhD': 'doctoral students — expert-level terminology, cutting-edge research, scholarly discourse.',
  };
  return contexts[gradeLevel] || contexts['Elementary'];
};

// ============================================================================
// Flat Gemini Schema (avoids nested objects that cause malformed JSON)
// ============================================================================

const flatChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier, e.g. 'ff_1', 'ff_2'",
    },
    type: {
      type: Type.STRING,
      description: "Phase grouping key, e.g. 'recall', 'apply', 'speed-round'",
    },
    promptText: {
      type: Type.STRING,
      description: "Primary question or stimulus shown to the student",
    },
    promptSubtext: {
      type: Type.STRING,
      description: "Optional brief instruction above the question (empty string if none)",
    },
    visualType: {
      type: Type.STRING,
      enum: ["emoji", "text-large", "none"],
      description: "Type of visual to show: emoji, text-large, or none",
    },
    visualContent: {
      type: Type.STRING,
      description: "The emoji character or large text value. Empty string if visualType is 'none'",
    },
    visualAlt: {
      type: Type.STRING,
      description: "Accessibility alt text for the visual. Empty string if none",
    },
    correctAnswer: {
      type: Type.STRING,
      description: "The single correct answer (as a string)",
    },
    acceptableAnswers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Additional accepted answers besides correctAnswer (can be empty array)",
    },
    responseMode: {
      type: Type.STRING,
      enum: ["choice", "type"],
      description: "'choice' for multiple-choice buttons, 'type' for typed input",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Answer options for choice mode (3-4 items). Empty array for type mode",
    },
    timeLimit: {
      type: Type.NUMBER,
      description: "Seconds allowed for this challenge (3-15)",
    },
    explanation: {
      type: Type.STRING,
      description: "Brief explanation shown after the answer is revealed (1 sentence)",
    },
    difficulty: {
      type: Type.STRING,
      enum: ["easy", "medium", "hard"],
      description: "Challenge difficulty level",
    },
  },
  required: [
    "id", "type", "promptText", "promptSubtext", "visualType", "visualContent",
    "visualAlt", "correctAnswer", "acceptableAnswers", "responseMode", "options",
    "timeLimit", "explanation", "difficulty",
  ],
};

const phaseConfigItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    key: {
      type: Type.STRING,
      description: "Phase key matching challenge.type values, e.g. 'recall', 'apply'",
    },
    label: {
      type: Type.STRING,
      description: "Human-readable phase label, e.g. 'Quick Recall'",
    },
    icon: {
      type: Type.STRING,
      description: "Single emoji icon for the phase, e.g. a brain or lightning bolt",
    },
    accentColor: {
      type: Type.STRING,
      description: "Tailwind color class, e.g. 'blue', 'emerald', 'amber'",
    },
  },
  required: ["key", "label", "icon", "accentColor"],
};

const fastFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, engaging title for the drill (3-8 words)",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence description of the drill",
    },
    subject: {
      type: Type.STRING,
      description: "Inferred subject area (e.g. 'Math', 'Science', 'Language Arts', 'History')",
    },
    challenges: {
      type: Type.ARRAY,
      items: flatChallengeSchema,
      description: "Array of 8-12 fluency challenges across 2-3 phases",
    },
    phaseConfigItems: {
      type: Type.ARRAY,
      items: phaseConfigItemSchema,
      description: "Phase display config — one entry per unique challenge.type value used",
    },
    defaultTimeLimit: {
      type: Type.NUMBER,
      description: "Default seconds per challenge when challenge.timeLimit is absent (3-15)",
    },
    targetResponseTime: {
      type: Type.NUMBER,
      description: "Seconds — answers within this count as 'fast' (2-10)",
    },
    showStreakCounter: {
      type: Type.BOOLEAN,
      description: "Whether to show a streak counter. Usually true",
    },
    showAccuracy: {
      type: Type.BOOLEAN,
      description: "Whether to show accuracy percentage. Usually true",
    },
    maxAttemptsPerChallenge: {
      type: Type.NUMBER,
      description: "Max wrong answers before advancing (1 for speed-rounds, 2 normally)",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band label, e.g. 'K-2', '3-5', '6-8'",
    },
  },
  required: [
    "title", "description", "subject", "challenges", "phaseConfigItems",
    "defaultTimeLimit", "targetResponseTime", "showStreakCounter",
    "showAccuracy", "maxAttemptsPerChallenge", "gradeBand",
  ],
};

// ============================================================================
// Validation & Reconstruction
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Reconstruct a FastFactChallenge from the flat Gemini output.
 */
function reconstructChallenge(flat: any, index: number): FastFactChallenge {
  const id = flat.id || `ff_${index + 1}`;
  const hasOptions = Array.isArray(flat.options) && flat.options.length > 0;

  // Determine responseMode
  const responseMode: 'choice' | 'type' =
    flat.responseMode === 'type' ? 'type'
    : flat.responseMode === 'choice' ? 'choice'
    : hasOptions ? 'choice' : 'type';

  // Build options for choice mode
  let options = responseMode === 'choice' && hasOptions ? [...flat.options] : undefined;

  // Ensure correctAnswer is in options for choice mode
  if (responseMode === 'choice' && options) {
    const correctLower = String(flat.correctAnswer).trim().toLowerCase();
    const found = options.some((o: string) => String(o).trim().toLowerCase() === correctLower);
    if (!found) {
      // Insert correct answer at a random position
      const insertIdx = Math.floor(Math.random() * (options.length + 1));
      options.splice(insertIdx, 0, String(flat.correctAnswer));
    }
  }

  // Build visual (only if type is not 'none')
  let visual: FastFactChallenge['prompt']['visual'] | undefined;
  if (flat.visualType && flat.visualType !== 'none') {
    if (flat.visualType === 'emoji') {
      visual = {
        type: 'emoji',
        emoji: flat.visualContent || undefined,
        alt: flat.visualAlt || undefined,
      };
    } else if (flat.visualType === 'text-large') {
      visual = {
        type: 'text-large',
        largeText: flat.visualContent || undefined,
        alt: flat.visualAlt || undefined,
      };
    }
  }

  return {
    id,
    type: flat.type || 'recall',
    prompt: {
      text: flat.promptText || '',
      subtext: flat.promptSubtext || undefined,
      visual,
    },
    correctAnswer: String(flat.correctAnswer),
    acceptableAnswers: Array.isArray(flat.acceptableAnswers) && flat.acceptableAnswers.length > 0
      ? flat.acceptableAnswers.map(String)
      : undefined,
    responseMode,
    options,
    timeLimit: typeof flat.timeLimit === 'number' ? Math.max(3, Math.min(15, flat.timeLimit)) : undefined,
    explanation: flat.explanation || undefined,
    difficulty: ['easy', 'medium', 'hard'].includes(flat.difficulty) ? flat.difficulty : undefined,
  };
}

/**
 * Convert phaseConfigItems array to the Record<string, ...> expected by FastFactData.
 */
function buildPhaseConfig(items: any[]): Record<string, { label: string; icon: string; accentColor: string }> {
  const record: Record<string, { label: string; icon: string; accentColor: string }> = {};
  if (!Array.isArray(items)) return record;
  for (const item of items) {
    if (item.key) {
      record[item.key] = {
        label: item.label || item.key,
        icon: item.icon || '',
        accentColor: item.accentColor || 'blue',
      };
    }
  }
  return record;
}

/**
 * Clamp a numeric value to a range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and reconstruct the full FastFactData from raw Gemini output.
 */
function validateFastFactData(raw: any): FastFactData {
  const challenges: FastFactChallenge[] = Array.isArray(raw.challenges)
    ? raw.challenges.map((c: any, i: number) => reconstructChallenge(c, i))
    : [];

  const phaseConfig = buildPhaseConfig(raw.phaseConfigItems);

  // Ensure every challenge.type has a phaseConfig entry
  for (const ch of challenges) {
    if (ch.type && !phaseConfig[ch.type]) {
      phaseConfig[ch.type] = {
        label: ch.type.charAt(0).toUpperCase() + ch.type.slice(1).replace(/-/g, ' '),
        icon: '',
        accentColor: 'blue',
      };
    }
  }

  return {
    title: raw.title || 'Fast Fact Drill',
    description: raw.description || undefined,
    subject: raw.subject || 'General',
    challenges,
    defaultTimeLimit: typeof raw.defaultTimeLimit === 'number'
      ? clamp(raw.defaultTimeLimit, 3, 15) : 5,
    targetResponseTime: typeof raw.targetResponseTime === 'number'
      ? clamp(raw.targetResponseTime, 2, 10) : 3,
    phaseConfig,
    showStreakCounter: raw.showStreakCounter !== false,
    showAccuracy: raw.showAccuracy !== false,
    maxAttemptsPerChallenge: typeof raw.maxAttemptsPerChallenge === 'number'
      ? Math.max(1, Math.min(3, raw.maxAttemptsPerChallenge)) : 2,
    gradeBand: raw.gradeBand || undefined,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate a FastFact timed fluency drill for any subject.
 *
 * @param topic  - The topic or learning objective
 * @param gradeLevel - Grade level string (e.g. "Elementary", "Middle School")
 * @param config - Optional overrides
 */
export const generateFastFact = async (
  topic: string,
  gradeLevel: string,
  config?: Record<string, unknown>,
): Promise<FastFactData> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const challengeCount = (config?.challengeCount as number) || 10;

  const prompt = `You are a curriculum expert creating timed fluency drill challenges.

TOPIC / LEARNING OBJECTIVE: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${config?.context ? `ADDITIONAL CONTEXT: ${config.context}\n` : ''}
NUMBER OF CHALLENGES: ${challengeCount} (8-12 range)

## Your Mission:
Create a Fast Fact fluency drill for "${topic}". Infer the subject area from the topic (Math, Science, Language Arts, History, etc.).

## Phase Design:
- Generate challenges across 2-3 PHASES (e.g. 'recall', 'apply', 'speed-round').
- Each challenge has a \`type\` field that groups it into a phase.
- Early phases should be easier; later phases should be faster/harder.
- Distribute challenges roughly evenly across phases.

## Challenge Design:
- Each challenge must have a SINGLE clear correct answer.
- For CHOICE mode: provide 3-4 options with plausible distractors. The correct answer MUST be one of the options.
- For TYPE mode: keep answers short (1-2 words or a number).
- NEVER reveal answers in promptText, promptSubtext, or visual content.
- Use emojis (visualType: "emoji") or large text (visualType: "text-large") where pedagogically helpful (math expressions, symbols, etc.).
- Use visualType: "none" when no visual is needed.

## Time & Difficulty:
- Adjust difficulty and timeLimit for the grade level.
- Easy challenges: 5-8 seconds. Medium: 4-6 seconds. Hard: 3-5 seconds.
- targetResponseTime should be 3s for speed drills, 5-8s for harder recall tasks.
- defaultTimeLimit is the fallback when a challenge has no specific timeLimit.

## Critical Rules:
- promptText is the main question shown large — keep it concise and clear.
- promptSubtext is an optional instruction shown smaller above the question.
- correctAnswer must be an exact string match to one of the options (for choice mode).
- acceptableAnswers covers alternate spellings or equivalent forms.
- explanation is a 1-sentence reason shown after the answer is revealed.
- maxAttemptsPerChallenge: use 1 for speed-round phases, 2 otherwise.

Now generate the Fast Fact drill.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fastFactSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for fast-fact");

    const raw = JSON.parse(response.text);
    const data = validateFastFactData(raw);

    console.log('[Fast Fact] Generated from dedicated service:', {
      topic,
      gradeLevel,
      challengeCount: data.challenges.length,
      phases: Object.keys(data.phaseConfig),
      subject: data.subject,
    });

    return data;
  } catch (error) {
    console.error("[Fast Fact] Generation error:", error);
    throw error;
  }
};
