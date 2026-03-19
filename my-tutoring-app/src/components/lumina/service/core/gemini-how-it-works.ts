/**
 * How It Works Generator - Interactive step-by-step process breakdown.
 *
 * Students explore sequential stages of how something works (garbage collection,
 * water cycle, digestion, etc.), then answer comprehension challenges.
 *
 * Uses moderately structured Gemini schema with flat challenge fields to avoid
 * malformed nested JSON.
 * Supports eval modes with identify, sequence, predict, explain challenge types.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { HowItWorksData } from '../../primitives/visual-primitives/core/HowItWorks';
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
  identify: {
    promptDoc:
      `"identify": Match a description to the correct step. `
      + `Student selects from 4 options. Question should reference a detail from the process steps.`,
    schemaDescription: "'identify' (match description to step)",
  },
  sequence: {
    promptDoc:
      `"sequence": Reorder shuffled steps into correct chronological order. `
      + `Provide 3-5 items that represent process steps. Student drags them into the right order.`,
    schemaDescription: "'sequence' (reorder steps chronologically)",
  },
  predict: {
    promptDoc:
      `"predict": Given context, predict what happens next. `
      + `Student selects from 4 options. Question describes a point in the process and asks what follows.`,
    schemaDescription: "'predict' (predict next step from context)",
  },
  explain: {
    promptDoc:
      `"explain": Student explains why a step is necessary. `
      + `Provide 2-3 key points that a good explanation should mention. `
      + `Used for open-ended comprehension checking.`,
    schemaDescription: "'explain' (explain why a step matters)",
  },
};

// ---------------------------------------------------------------------------
// Grade-Level Context Helper
// ---------------------------------------------------------------------------

const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'Toddler': 'toddlers (ages 1-3) — very simple concepts, concrete examples.',
    'Preschool': 'preschool children (ages 3-5) — simple sentences, colorful examples.',
    'Kindergarten': 'kindergarten students (ages 5-6) — clear language, foundational concepts.',
    'Elementary': 'elementary students (grades 1-5) — age-appropriate vocabulary, concrete examples.',
    'Middle School': 'middle school students (grades 6-8) — more complex vocabulary, real-world applications.',
    'High School': 'high school students (grades 9-12) — advanced vocabulary, sophisticated concepts.',
  };
  return contexts[gradeLevel] || contexts['Elementary'];
};

// ---------------------------------------------------------------------------
// Gemini Schema
// ---------------------------------------------------------------------------

const stepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    stepNumber: { type: Type.NUMBER, description: "Step number (1-based)" },
    title: { type: Type.STRING, description: "Short title for this step (2-5 words)" },
    description: { type: Type.STRING, description: "2-3 sentence description of what happens in this step" },
    whatsHappening: { type: Type.STRING, description: "Optional deeper explanation of the underlying mechanism (1-2 sentences)" },
    imagePrompt: { type: Type.STRING, description: "Detailed prompt for AI image generation depicting this step" },
    keyTermTerm: { type: Type.STRING, description: "Optional key vocabulary term introduced in this step" },
    keyTermDefinition: { type: Type.STRING, description: "Definition of the key term (required if keyTermTerm provided)" },
    funFact: { type: Type.STRING, description: "Optional fun fact related to this step" },
  },
  required: ["stepNumber", "title", "description", "imagePrompt"],
};

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["identify", "sequence", "predict", "explain"],
      description: "Challenge type",
    },
    question: { type: Type.STRING, description: "The challenge question" },
    // For identify/predict (multiple choice)
    option0: { type: Type.STRING, description: "First answer option (for identify/predict)" },
    option1: { type: Type.STRING, description: "Second answer option (for identify/predict)" },
    option2: { type: Type.STRING, description: "Third answer option (for identify/predict)" },
    option3: { type: Type.STRING, description: "Fourth answer option (for identify/predict)" },
    correctIndex: { type: Type.NUMBER, description: "Index of correct option 0-3 (for identify/predict)" },
    // For sequence (flat fields for up to 5 items)
    sequenceItem0Id: { type: Type.STRING, description: "ID for sequence item 0 (e.g. 's0')" },
    sequenceItem0Text: { type: Type.STRING, description: "Text for sequence item 0" },
    sequenceItem1Id: { type: Type.STRING, description: "ID for sequence item 1 (e.g. 's1')" },
    sequenceItem1Text: { type: Type.STRING, description: "Text for sequence item 1" },
    sequenceItem2Id: { type: Type.STRING, description: "ID for sequence item 2 (e.g. 's2')" },
    sequenceItem2Text: { type: Type.STRING, description: "Text for sequence item 2" },
    sequenceItem3Id: { type: Type.STRING, description: "ID for sequence item 3 (e.g. 's3')" },
    sequenceItem3Text: { type: Type.STRING, description: "Text for sequence item 3" },
    sequenceItem4Id: { type: Type.STRING, description: "ID for sequence item 4 (e.g. 's4')" },
    sequenceItem4Text: { type: Type.STRING, description: "Text for sequence item 4" },
    correctOrderCsv: { type: Type.STRING, description: "Comma-separated correct order of IDs (e.g. 's0,s1,s2,s3')" },
    // For explain (key points)
    keyPoint0: { type: Type.STRING, description: "First key point for explain challenge" },
    keyPoint1: { type: Type.STRING, description: "Second key point for explain challenge" },
    keyPoint2: { type: Type.STRING, description: "Third key point for explain challenge" },
    // Common
    explanation: { type: Type.STRING, description: "Explanation shown after answering (1-2 sentences)" },
    relatedStep: { type: Type.NUMBER, description: "Step number this challenge relates to (1-based)" },
  },
  required: ["type", "question", "explanation", "relatedStep"],
};

const summarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "1-2 sentence summary of the whole process" },
    totalTime: { type: Type.STRING, description: "Optional total time the process takes (e.g. '2-3 hours', '3 days')" },
    keyTakeaway: { type: Type.STRING, description: "One key insight students should remember" },
  },
  required: ["text", "keyTakeaway"],
};

const howItWorksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the process (e.g. 'How Recycling Works')" },
    subtitle: { type: Type.STRING, description: "Short subtitle expanding on the title" },
    overview: { type: Type.STRING, description: "1-2 sentence overview of the process" },
    steps: {
      type: Type.ARRAY,
      items: stepSchema,
      description: "4-6 sequential steps of the process",
    },
    summary: summarySchema,
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "3-4 comprehension challenges about the process",
    },
  },
  required: ["title", "subtitle", "overview", "steps", "summary", "challenges"],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function validateHowItWorksData(raw: any): HowItWorksData {
  const title = raw.title || 'How It Works';
  const subtitle = raw.subtitle || '';
  const overview = raw.overview || '';

  // --- Steps (4-6) ---
  let steps: HowItWorksData['steps'] = [];
  if (Array.isArray(raw.steps)) {
    steps = raw.steps.slice(0, 6).map((s: any, i: number) => {
      const step: HowItWorksData['steps'][0] = {
        stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : i + 1,
        title: String(s.title || `Step ${i + 1}`),
        description: String(s.description || ''),
        imagePrompt: String(s.imagePrompt || `Step ${i + 1} of ${title}`),
      };
      if (s.whatsHappening) step.whatsHappening = String(s.whatsHappening);
      if (s.keyTermTerm && s.keyTermDefinition) {
        step.keyTerm = {
          term: String(s.keyTermTerm),
          definition: String(s.keyTermDefinition),
        };
      }
      if (s.funFact) step.funFact = String(s.funFact);
      return step;
    });
  }
  // Pad to minimum 4 steps
  while (steps.length < 4) {
    const n = steps.length + 1;
    steps.push({
      stepNumber: n,
      title: `Step ${n}`,
      description: 'Details coming soon.',
      imagePrompt: `Step ${n} of ${title}`,
    });
  }

  // --- Summary ---
  const summary: HowItWorksData['summary'] = {
    text: String(raw.summary?.text || 'Summary coming soon.'),
    keyTakeaway: String(raw.summary?.keyTakeaway || 'More to explore!'),
  };
  if (raw.summary?.totalTime) {
    summary.totalTime = String(raw.summary.totalTime);
  }

  // --- Challenges (3-4) ---
  let challenges: NonNullable<HowItWorksData['challenges']> = [];
  if (Array.isArray(raw.challenges)) {
    challenges = raw.challenges.slice(0, 4).map((c: any) => {
      const validTypes = ['identify', 'sequence', 'predict', 'explain'];
      const type = validTypes.includes(c.type) ? c.type : 'identify';

      const base = {
        type: type as 'identify' | 'sequence' | 'predict' | 'explain',
        question: String(c.question || 'Question'),
        explanation: String(c.explanation || ''),
        relatedStep: typeof c.relatedStep === 'number' ? c.relatedStep : 1,
      };

      if (type === 'identify' || type === 'predict') {
        // Reconstruct options array from flat fields
        const options = [
          String(c.option0 || c.options?.[0] || 'Option A'),
          String(c.option1 || c.options?.[1] || 'Option B'),
          String(c.option2 || c.options?.[2] || 'Option C'),
          String(c.option3 || c.options?.[3] || 'Option D'),
        ];
        let correctIndex = typeof c.correctIndex === 'number' ? c.correctIndex : 0;
        if (correctIndex < 0 || correctIndex > 3) correctIndex = 0;
        return { ...base, options, correctIndex };
      }

      if (type === 'sequence') {
        // Reconstruct sequenceItems from flat fields
        const sequenceItems: Array<{ id: string; text: string }> = [];
        for (let i = 0; i < 5; i++) {
          const id = c[`sequenceItem${i}Id`];
          const text = c[`sequenceItem${i}Text`];
          if (id && text) {
            sequenceItems.push({ id: String(id), text: String(text) });
          }
        }
        // Fallback: check if sequenceItems array exists
        if (sequenceItems.length === 0 && Array.isArray(c.sequenceItems)) {
          for (const item of c.sequenceItems.slice(0, 5)) {
            if (item.id && item.text) {
              sequenceItems.push({ id: String(item.id), text: String(item.text) });
            }
          }
        }
        // Parse correctOrder from CSV or array
        let correctOrder: string[] = [];
        if (typeof c.correctOrderCsv === 'string') {
          correctOrder = c.correctOrderCsv.split(',').map((s: string) => s.trim()).filter(Boolean);
        } else if (Array.isArray(c.correctOrder)) {
          correctOrder = c.correctOrder.map(String);
        }
        return { ...base, sequenceItems, correctOrder };
      }

      if (type === 'explain') {
        // Reconstruct keyPoints from flat fields
        const keyPoints: string[] = [];
        for (let i = 0; i < 3; i++) {
          const kp = c[`keyPoint${i}`];
          if (kp) keyPoints.push(String(kp));
        }
        // Fallback: check if keyPoints array exists
        if (keyPoints.length === 0 && Array.isArray(c.keyPoints)) {
          for (const kp of c.keyPoints.slice(0, 3)) {
            keyPoints.push(String(kp));
          }
        }
        return { ...base, keyPoints };
      }

      return base;
    });
  }
  // Pad to minimum 3 challenges
  while (challenges.length < 3) {
    challenges.push({
      type: 'identify',
      question: 'Which step involves the key transformation?',
      options: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
      correctIndex: 0,
      explanation: 'Review the process steps for the answer.',
      relatedStep: 1,
    });
  }

  return {
    title,
    subtitle,
    overview,
    steps,
    summary,
    challenges,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a HowItWorks step-by-step process breakdown.
 *
 * @param topic      - The topic or process to explain
 * @param gradeLevel - Grade level string (e.g. "Elementary", "Middle School")
 * @param config     - Optional overrides including targetEvalMode
 */
export const generateHowItWorks = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<HowItWorksData> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'how-it-works',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        howItWorksSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { arrayName: 'challenges', fieldName: 'type' },
      )
    : howItWorksSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `You are a curriculum expert creating an interactive step-by-step process breakdown.

TOPIC / PROCESS: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}

## Your Mission:
Create a clear, engaging "How It Works" explanation of "${topic}" that walks students through the sequential stages of the process.

${challengeTypeSection}

## Content Guidelines:

### Title & Overview
- Title should be clear and engaging (e.g. "How Recycling Works", "How Your Heart Pumps Blood")
- Subtitle adds context or scope
- Overview is a 1-2 sentence hook

### Steps (4-6 items)
- Each step represents a distinct stage in the process
- Steps must be in chronological/logical order
- stepNumber starts at 1
- title: 2-5 word label for the step
- description: 2-3 sentences explaining what happens
- whatsHappening (optional): Deeper explanation of the underlying mechanism
- imagePrompt: Detailed description for AI image generation showing this step visually
- keyTermTerm + keyTermDefinition (optional): Important vocabulary introduced at this step
- funFact (optional): Interesting tidbit related to this step

### Summary
- text: 1-2 sentence wrap-up of the whole process
- totalTime (optional): How long the process takes in real life
- keyTakeaway: The single most important insight

### Challenges (3-4 items)
- Comprehension challenges that test understanding of the process
- Each challenge has a type, question, explanation, and relatedStep (step number)

**Challenge type rules:**

For "identify" challenges:
- Provide option0, option1, option2, option3 (4 multiple choice options)
- Provide correctIndex (0-3)
- Question should ask student to match a description to the correct step

For "sequence" challenges:
- Provide sequenceItem0Id, sequenceItem0Text through sequenceItem4Id, sequenceItem4Text (3-5 items)
- IDs should be "s0", "s1", etc.
- Provide correctOrderCsv as comma-separated IDs in correct order (e.g. "s0,s1,s2,s3")
- Items describe process steps that need reordering

For "predict" challenges:
- Provide option0, option1, option2, option3 (4 multiple choice options)
- Provide correctIndex (0-3)
- Question should describe a point in the process and ask what happens next

For "explain" challenges:
- Provide keyPoint0, keyPoint1, keyPoint2 (2-3 key points a good answer should mention)
- Question asks student to explain why a step is important or necessary

## Grade-Level Adaptation:
- For K-2: Simple vocabulary, 4 steps max, very concrete everyday processes, relatable comparisons
- For 3-5: More detail, introduce scientific terms with definitions, real-world processes
- For 6-8: Complex processes, technical vocabulary, connections to broader systems

## Critical Rules:
1. Steps MUST be in correct chronological/logical order
2. All content must be scientifically/factually accurate
3. NEVER reveal challenge answers in step titles or descriptions
4. Challenges must be answerable from the content provided
5. correctIndex must be 0, 1, 2, or 3 — matching the correct option position
6. For sequence challenges, correctOrderCsv must contain all provided item IDs
7. Mix challenge types for variety (unless constrained by eval mode)
8. Each challenge should reference a specific relatedStep number

Now generate the How It Works content.`;

  logEvalModeResolution('HowItWorks', config?.targetEvalMode, evalConstraint);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for how-it-works");

    const raw = JSON.parse(response.text);
    const data = validateHowItWorksData(raw);

    console.log('[HowItWorks] Generated:', {
      topic,
      gradeLevel,
      title: data.title,
      steps: data.steps.length,
      challenges: data.challenges?.length ?? 0,
    });

    return data;
  } catch (error) {
    console.error("[HowItWorks] Generation error:", error);
    throw error;
  }
};
