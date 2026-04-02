/**
 * Digital Skills Sim Generator - Teaches fundamental digital device skills
 * (mouse click, drag, keyboard) for K-1 students.
 *
 * Uses a FLAT Gemini schema to avoid malformed nested JSON.
 * Supports eval modes with click, drag, type challenge types.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { DigitalSkillsSimData } from '../../primitives/visual-primitives/core/DigitalSkillsSim';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  click: {
    promptDoc: 'Click Practice — student clicks a target that appears on screen. Provide targetLabel, targetEmoji.',
    schemaDescription: 'Click target challenge',
  },
  drag: {
    promptDoc: 'Drag Practice — student drags an item to a drop zone. Provide dragItemLabel, dragItemEmoji, dropZoneLabel.',
    schemaDescription: 'Drag and drop challenge',
  },
  type: {
    promptDoc: 'Type Practice — student presses a highlighted key on a virtual keyboard. Provide targetKey (single letter A-Z), keyHint.',
    schemaDescription: 'Keyboard typing challenge',
  },
};

// ---------------------------------------------------------------------------
// Flat Gemini Schema
// ---------------------------------------------------------------------------

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique challenge identifier (e.g. 'click-1', 'drag-2', 'type-3')",
    },
    type: {
      type: Type.STRING,
      enum: ['click', 'drag', 'type'],
      description: "Challenge type: click, drag, or type",
    },
    instruction: {
      type: Type.STRING,
      description: "Short instruction shown to the student (e.g. 'Click the star!')",
    },
    targetLabel: {
      type: Type.STRING,
      description: "Label for click target (used for click challenges)",
      nullable: true,
    },
    targetEmoji: {
      type: Type.STRING,
      description: "Emoji for click target (used for click challenges)",
      nullable: true,
    },
    dragItemLabel: {
      type: Type.STRING,
      description: "Label for the draggable item (used for drag challenges)",
      nullable: true,
    },
    dragItemEmoji: {
      type: Type.STRING,
      description: "Emoji for the draggable item (used for drag challenges)",
      nullable: true,
    },
    dropZoneLabel: {
      type: Type.STRING,
      description: "Label for the drop zone target (used for drag challenges)",
      nullable: true,
    },
    targetKey: {
      type: Type.STRING,
      description: "Single letter A-Z for the key to press (used for type challenges)",
      nullable: true,
    },
    keyHint: {
      type: Type.STRING,
      description: "Hint about where the key is or what it starts (used for type challenges)",
      nullable: true,
    },
  },
  required: ['id', 'type', 'instruction'],
};

const digitalSkillsSimSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (2-6 words)",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence description of the activity",
    },
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "Array of challenges mixing click, drag, and type tasks",
    },
  },
  required: ['title', 'description', 'challenges'],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

const VALID_TYPES = new Set(['click', 'drag', 'type']);

function validateDigitalSkillsSimData(raw: any): DigitalSkillsSimData {
  const title = raw.title || 'Digital Skills Practice';
  const description = raw.description || 'Practice clicking, dragging, and typing!';

  let challenges: DigitalSkillsSimData['challenges'] = [];
  if (Array.isArray(raw.challenges)) {
    challenges = raw.challenges
      .filter((c: any) => c && VALID_TYPES.has(c.type))
      .map((c: any, idx: number) => ({
        id: String(c.id || `${c.type}-${idx + 1}`),
        type: c.type as 'click' | 'drag' | 'type',
        instruction: String(c.instruction || 'Complete this challenge!'),
        targetLabel: c.targetLabel ?? undefined,
        targetEmoji: c.targetEmoji ?? undefined,
        dragItemLabel: c.dragItemLabel ?? undefined,
        dragItemEmoji: c.dragItemEmoji ?? undefined,
        dropZoneLabel: c.dropZoneLabel ?? undefined,
        targetKey: c.targetKey ? String(c.targetKey).charAt(0).toUpperCase() : undefined,
        keyHint: c.keyHint ?? undefined,
      }));
  }

  // Ensure at least one challenge exists
  if (challenges.length === 0) {
    challenges = [
      {
        id: 'click-1',
        type: 'click',
        instruction: 'Click the star!',
        targetLabel: 'Star',
        targetEmoji: '⭐',
        dragItemLabel: undefined,
        dragItemEmoji: undefined,
        dropZoneLabel: undefined,
        targetKey: undefined,
        keyHint: undefined,
      },
    ];
  }

  return { title, description, challenges };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a DigitalSkillsSim activity with click, drag, and type challenges.
 *
 * @param topic      - The topic or context for the activity
 * @param gradeLevel - Grade level string (e.g. "Kindergarten", "Elementary")
 * @param config     - Optional overrides including targetEvalMode
 */
export const generateDigitalSkillsSim = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<DigitalSkillsSimData> => {

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'digital-skills-sim',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        digitalSkillsSimSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { arrayName: 'challenges', fieldName: 'type' },
      )
    : digitalSkillsSimSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const isSingleMode = evalConstraint && evalConstraint.allowedTypes.length === 1;
  const challengeCount = isSingleMode ? 5 : 15;
  const countGuidance = isSingleMode
    ? `Generate exactly 5 challenges of the allowed type.`
    : `Generate 15 challenges total — 5 of each type (click, drag, type), interleaved.`;

  const prompt = `You are a curriculum expert creating a fun digital skills practice activity for young learners (K-1).

TOPIC / CONTEXT: ${topic}
TARGET AUDIENCE: ${gradeLevel} students (ages 5-7)

## Your Mission:
Create an engaging digital skills practice activity themed around "${topic}".
${countGuidance}

${challengeTypeSection}

## Challenge Type Guidelines:

### Click Challenges
- Student clicks a target that appears on screen
- Provide targetLabel (what to click) and targetEmoji (visual representation)
- Instructions should be clear and encouraging: "Click the ___!"
- Use fun, colorful targets kids enjoy (animals, stars, shapes, food)

### Drag Challenges
- Student drags an item to a drop zone
- Provide dragItemLabel, dragItemEmoji (what to drag), and dropZoneLabel (where to drop it)
- Instructions like "Drag the ___ to the ___!"
- Use matching/sorting themes (put the apple in the basket, move the letter to the mailbox)

### Type Challenges
- Student presses a highlighted key on a virtual keyboard
- Provide targetKey (single uppercase letter A-Z) and keyHint (what the letter starts or means)
- Instructions like "Press the letter ___!"
- Connect letters to topic-related words (A for Apple, C for Cat)

## Critical Rules:
1. Use simple, encouraging language appropriate for ages 5-7
2. Each challenge must have a unique id (e.g. "click-1", "drag-3", "type-5")
3. targetKey must be a single uppercase letter A-Z
4. Keep instructions under 10 words
5. Use common, recognizable emoji that render well
6. Theme all challenges around the given topic
7. NEVER reveal answers in instructions — keep them as action prompts

Now generate the digital skills activity.`;

  logEvalModeResolution('DigitalSkillsSim', config?.targetEvalMode, evalConstraint);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for digital-skills-sim");

    const raw = JSON.parse(response.text);
    const data = validateDigitalSkillsSimData(raw);

    console.log('[DigitalSkillsSim] Generated:', {
      topic,
      gradeLevel,
      title: data.title,
      challengeCount: data.challenges.length,
      types: {
        click: data.challenges.filter(c => c.type === 'click').length,
        drag: data.challenges.filter(c => c.type === 'drag').length,
        type: data.challenges.filter(c => c.type === 'type').length,
      },
    });

    return data;
  } catch (error) {
    console.error("[DigitalSkillsSim] Generation error:", error);
    throw error;
  }
};
