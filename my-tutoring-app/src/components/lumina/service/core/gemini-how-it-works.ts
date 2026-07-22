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
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, gradeToBand, buildGradeLine } from "../scopeContext";
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
      `"explain": Ask "Why is Step X important?" or "Why does this step need to happen?" `
      + `Student selects from 4 options. Provide option0-option3 and correctIndex (0-3). `
      + `The correct option should explain the PURPOSE or CONSEQUENCE of the step. `
      + `Distractors should be plausible but incorrect reasons.`,
    schemaDescription: "'explain' (why a step matters — multiple choice)",
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

/**
 * Fallback band resolver — infers the band label from the grade-context PROSE
 * sentence when the canonical numeric grade is unavailable. Mirrors fast-fact's
 * inferGradeLevelFromContext so a missing ctx.grade still lands on a real map key
 * instead of silently defaulting to 'Elementary' for every objective.
 */
const inferGradeLevelFromContext = (gradeContext: string): string => {
  const c = (gradeContext || '').toLowerCase();
  if (c.includes('toddler')) return 'Toddler';
  if (c.includes('preschool')) return 'Preschool';
  if (c.includes('kindergarten')) return 'Kindergarten';
  if (c.includes('elementary') || c.includes('grades 1-5')) return 'Elementary';
  if (c.includes('middle') || c.includes('grades 6-8')) return 'Middle School';
  if (c.includes('high') || c.includes('grades 9-12')) return 'High School';
  return 'Elementary';
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
    imagePrompt: { type: Type.STRING, description: "Photorealistic image prompt — describe a real-world scene as a photographer would see it, with natural lighting, real materials, and a clear camera angle. No glowing effects, no cross-sections, no diagram overlays." },
    keyTermTerm: { type: Type.STRING, description: "Optional key vocabulary term introduced in this step" },
    keyTermDefinition: { type: Type.STRING, description: "Definition of the key term (required if keyTermTerm provided)" },
    funFact: { type: Type.STRING, description: "A surprising, fun fact related to this step — include a number or comparison" },
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
    correctAnswer: { type: Type.STRING, description: "The AUTHORITATIVE correct answer: copy the EXACT text of the correct option (must match one of option0-option3 verbatim). Do NOT use a number — write out the full option text. This must be consistent with the explanation." },
    correctIndex: { type: Type.NUMBER, description: "Index of correct option 0-3 — must point to the same option as correctAnswer" },
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

const quickFactsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    duration: { type: Type.STRING, description: "How long the process takes (e.g. 'About 2 hours', 'Over millions of years')" },
    whereItHappens: { type: Type.STRING, description: "Where this process occurs (e.g. 'Inside your stomach', 'In the clouds')" },
    inventedBy: { type: Type.STRING, description: "Who discovered/invented/first described it (if applicable)" },
    funComparison: { type: Type.STRING, description: "Kid-friendly size/speed/scale comparison (e.g. 'Faster than a cheetah!')" },
    energySource: { type: Type.STRING, description: "What powers or drives the process (e.g. 'Heat from the sun', 'Chemical reactions')" },
  },
};

const howItWorksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the process (e.g. 'How Recycling Works')" },
    subtitle: { type: Type.STRING, description: "Short subtitle expanding on the title" },
    overview: { type: Type.STRING, description: "1-2 sentence overview of the process" },
    category: {
      type: Type.STRING,
      enum: ["science", "engineering", "nature", "cooking", "technology", "body", "history"],
      description: "Process category for theming — pick the best match",
    },
    steps: {
      type: Type.ARRAY,
      items: stepSchema,
      description: "4-6 sequential steps of the process",
    },
    summary: summarySchema,
    quickFacts: quickFactsSchema,
    realWorldExamples: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-4 real-world examples where this process is seen (e.g. 'Your kitchen faucet', 'Car wash sprayers')",
    },
    relatedProcesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 related processes the student might explore next",
    },
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      description: "3-4 comprehension challenges about the process",
    },
  },
  required: ["title", "subtitle", "overview", "category", "steps", "summary", "challenges"],
};

// ---------------------------------------------------------------------------
// Pre-reader (K / PRE band) reduced schema
// ---------------------------------------------------------------------------
// Deliberately tiny (one shallow object + a 3-4 item array) so flash-lite emits
// clean JSON. NO magazine fields (quickFacts, glossary, whatsHappening, key
// terms), NO multiple-choice challenges, NO image prompts. The emoji IS the
// answer surface; the label is a caption; `spoken` is what the tutor reads aloud.
const preReaderStepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    emoji: { type: Type.STRING, description: "ONE emoji that concretely pictures this step (e.g. '🚗' for a broken-down car, '⛓️' for hooking up). Never a letter or number." },
    label: { type: Type.STRING, description: "A 1-3 word caption for the step (e.g. 'Hook the car'). Simple words a 5-year-old knows." },
    spoken: { type: Type.STRING, description: "ONE short spoken sentence the tutor reads aloud for this step (e.g. 'The truck hooks up the car.'). Plain, concrete, present tense." },
  },
  required: ["emoji", "label", "spoken"],
};

const preReaderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Very short title (e.g. 'How a Tow Truck Works')" },
    overview: { type: Type.STRING, description: "ONE short, warm spoken sentence introducing the process for a 5-year-old" },
    question: { type: Type.STRING, description: "The spoken ordering prompt, child-simple (e.g. 'Put the tow truck steps in order.')" },
    steps: {
      type: Type.ARRAY,
      items: preReaderStepSchema,
      description: "EXACTLY 3-4 steps, AUTHORED IN CORRECT ORDER (first step first). Each is one concrete, orderable action — no trap steps, no 'not part of the process' items.",
    },
  },
  required: ["title", "overview", "question", "steps"],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function validatePreReaderData(raw: any): HowItWorksData {
  const title = String(raw.title || 'How It Works');
  const overview = String(raw.overview || '');
  const question = String(raw.question || 'Put the steps in order.');

  const steps: NonNullable<HowItWorksData['preReader']>['steps'] = [];
  if (Array.isArray(raw.steps)) {
    for (const s of raw.steps.slice(0, 4)) {
      const emoji = String(s?.emoji || '').trim();
      const label = String(s?.label || '').trim();
      const spoken = String(s?.spoken || '').trim();
      if (emoji && label) {
        steps.push({ id: `p${steps.length}`, emoji, label, spoken: spoken || label });
      }
    }
  }
  // A pre-reader ordering task needs at least 3 real steps. Fewer is a real
  // generation failure — surface it rather than shipping a 1-2 card "order" that
  // isn't an ordering task.
  if (steps.length < 3) {
    throw new Error('[HowItWorks] Pre-reader generation produced fewer than 3 steps — refusing to ship a non-ordering task.');
  }

  return {
    title,
    subtitle: '',
    overview,
    category: undefined,
    steps: [],
    summary: { text: overview, keyTakeaway: overview },
    challenges: [],
    preReader: { question, steps },
  };
}

function validateHowItWorksData(raw: any): HowItWorksData {
  const title = raw.title || 'How It Works';
  const subtitle = raw.subtitle || '';
  const overview = raw.overview || '';

  // --- Category ---
  const validCategories = ['science', 'engineering', 'nature', 'cooking', 'technology', 'body', 'history'];
  const category = validCategories.includes(raw.category) ? raw.category : undefined;

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
  // NEVER pad steps with placeholder filler ("Details coming soon."). A filler
  // step teaches nothing and reads as broken. Keep only the real steps the model
  // produced. A fully empty step list is a real generation failure — surface it
  // (retry/error) rather than shipping an empty shell.
  if (steps.length === 0) {
    throw new Error('[HowItWorks] Generation produced no steps — refusing to ship an empty process.');
  }

  // --- Summary ---
  const summary: HowItWorksData['summary'] = {
    text: String(raw.summary?.text || 'Summary coming soon.'),
    keyTakeaway: String(raw.summary?.keyTakeaway || 'More to explore!'),
  };
  if (raw.summary?.totalTime) {
    summary.totalTime = String(raw.summary.totalTime);
  }

  // --- Quick Facts ---
  let quickFacts: HowItWorksData['quickFacts'] = undefined;
  if (raw.quickFacts && typeof raw.quickFacts === 'object') {
    const qf: NonNullable<HowItWorksData['quickFacts']> = {};
    if (raw.quickFacts.duration) qf.duration = String(raw.quickFacts.duration);
    if (raw.quickFacts.whereItHappens) qf.whereItHappens = String(raw.quickFacts.whereItHappens);
    if (raw.quickFacts.inventedBy) qf.inventedBy = String(raw.quickFacts.inventedBy);
    if (raw.quickFacts.funComparison) qf.funComparison = String(raw.quickFacts.funComparison);
    if (raw.quickFacts.energySource) qf.energySource = String(raw.quickFacts.energySource);
    if (Object.keys(qf).length > 0) quickFacts = qf;
  }

  // --- Real World Examples ---
  let realWorldExamples: string[] | undefined = undefined;
  if (Array.isArray(raw.realWorldExamples) && raw.realWorldExamples.length > 0) {
    realWorldExamples = raw.realWorldExamples.slice(0, 5).map(String);
  }

  // --- Related Processes ---
  let relatedProcesses: string[] | undefined = undefined;
  if (Array.isArray(raw.relatedProcesses) && raw.relatedProcesses.length > 0) {
    relatedProcesses = raw.relatedProcesses.slice(0, 4).map(String);
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

      if (type === 'identify' || type === 'predict' || type === 'explain') {
        // Reconstruct options array from flat fields
        const options = [
          String(c.option0 || c.options?.[0] || 'Option A'),
          String(c.option1 || c.options?.[1] || 'Option B'),
          String(c.option2 || c.options?.[2] || 'Option C'),
          String(c.option3 || c.options?.[3] || 'Option D'),
        ];
        // Authoritative answer is the TEXT the model wrote (flash-lite reliably
        // names the right answer but frequently miscounts the index). Derive the
        // index from that text; fall back to the numeric index only when the
        // text doesn't resolve to an option.
        let correctIndex = typeof c.correctIndex === 'number' ? c.correctIndex : 0;
        if (correctIndex < 0 || correctIndex > 3) correctIndex = 0;

        const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
        const answerText = typeof c.correctAnswer === 'string' ? c.correctAnswer : '';
        if (answerText) {
          const matchedIndex = options.findIndex(o => norm(o) === norm(answerText));
          if (matchedIndex >= 0) {
            if (matchedIndex !== correctIndex) {
              console.warn(
                `[HowItWorks] correctIndex/correctAnswer mismatch for "${base.question}": `
                + `index said option ${correctIndex} ("${options[correctIndex]}") but correctAnswer text `
                + `"${answerText}" resolves to option ${matchedIndex}. Trusting the answer text.`,
              );
            }
            correctIndex = matchedIndex;
          } else {
            console.warn(
              `[HowItWorks] correctAnswer "${answerText}" did not match any option for `
              + `"${base.question}"; falling back to correctIndex ${correctIndex}.`,
            );
          }
        }
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
        // --- Answer-key integrity guard ---
        // flash-lite frequently drops or garbles correctOrderCsv, yielding an
        // empty or partial key. An empty/mismatched key makes the sequence
        // UNWINNABLE (exact-array-equality never matches) — the challenge can
        // never be passed and the whole lesson soft-locks. Per the prompt
        // convention, items are AUTHORED in correct chronological order, so the
        // item IDs in their authored order ARE the canonical answer key.
        const itemIds = sequenceItems.map(i => i.id);
        const keyIsValid =
          correctOrder.length === itemIds.length &&
          new Set(correctOrder).size === itemIds.length &&
          correctOrder.every(id => itemIds.includes(id));
        if (!keyIsValid) {
          if (correctOrder.length > 0) {
            console.warn('[HowItWorks] Invalid sequence correctOrder — falling back to authored item order', { correctOrder, itemIds });
          }
          correctOrder = itemIds;
        }
        return { ...base, sequenceItems, correctOrder };
      }

      return base;
    });
  }
  // NEVER pad challenges. A placeholder challenge ("Which step involves the key
  // transformation?" / Step 1-4 / correctIndex 0) is unanswerable from any real
  // content and its answer key is arbitrary — shipping it violates rule #1
  // (pedagogically unsound → ship nothing). If the model underproduced, show
  // only the real challenges; zero challenges is a valid display-only exhibit
  // (the component auto-submits once all steps are explored).

  return {
    title,
    subtitle,
    overview,
    category,
    steps,
    summary,
    quickFacts,
    realWorldExamples,
    relatedProcesses,
    challenges,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type HowItWorksConfig = Partial<{ targetEvalMode?: string }>;

// Bands that get the pre-reader (picture-order) subset instead of the reading-
// heavy magazine + text quiz. These are the non-decoding audiences.
const PRE_READER_BANDS = new Set(['Toddler', 'Preschool', 'Kindergarten']);

/**
 * Generate the pre-reader (K / PRE) subset: a picture-primary "put the steps in
 * order" task. Same primitive, reduced schema — no magazine, no text quiz.
 */
const generatePreReaderHowItWorks = async (
  ctx: GenerationContext,
  gradeLevelContext: string,
): Promise<HowItWorksData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);

  const prompt = `You are an early-childhood teacher building a SIMPLE picture activity for a child who CANNOT READ.

TOPIC / PROCESS: ${topic}
${scopeSection}
TARGET AUDIENCE: ${gradeLevelContext}

## The activity
The child will see picture cards (one emoji each) and put them IN ORDER by tapping. There is NO reading — the tutor reads everything aloud. So:

1. Break "${topic}" into EXACTLY 3-4 simple, concrete steps a young child can picture.
2. AUTHOR THE STEPS IN CORRECT ORDER — step 1 happens first, the last step happens last. (The app shuffles the cards before showing them.)
3. For each step give:
   - emoji: ONE emoji that clearly pictures the step (never a letter or number).
   - label: a 1-3 word caption in words a 5-year-old knows.
   - spoken: ONE short, plain, present-tense sentence the tutor will read aloud.
4. question: the spoken ordering prompt, child-simple (e.g. "Put the tow truck steps in order.").
5. overview: ONE short, warm spoken sentence introducing the process.

## Rules
- EVERY step must be a REAL action that belongs in the sequence. NO trap/distractor steps, NO "not part of the process" items — the child only orders real steps.
- Keep vocabulary tiny and concrete. No jargon, no numbers, no key terms, no fun facts.
- The emoji carries the meaning; the label is just a short caption.

Now generate the picture-order activity for "${topic}".`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: preReaderSchema,
    },
  });

  if (!response.text) throw new Error("No content generated for how-it-works (pre-reader)");

  const raw = JSON.parse(response.text);
  const data = validatePreReaderData(raw);

  console.log('[HowItWorks] Generated (pre-reader):', {
    topic,
    title: data.title,
    steps: data.preReader?.steps.length ?? 0,
  });

  return data;
};

/**
 * Generate a HowItWorks step-by-step process breakdown.
 */
export const generateHowItWorks = async (
  ctx: GenerationContext,
): Promise<HowItWorksData> => {
  const { topic } = ctx;
  const config = ctx.raw as HowItWorksConfig;
  // Resolve the audience BAND from the canonical numeric grade first, prose
  // fallback second. Feeding a real map KEY (not the prose sentence) is what
  // fixes the always-'Elementary' bug: ctx.gradeContext is a full sentence and
  // never matched a getGradeLevelContext key.
  const bandKey = (ctx.grade && gradeToBand(ctx.grade)) || inferGradeLevelFromContext(ctx.gradeContext);
  const gradeLevel = bandKey;

  // ── Pre-reader (K / PRE) subset: the same primitive at a reduced complexity ──
  // A non-reader gets the picture-order task, not the magazine + text quiz.
  if (PRE_READER_BANDS.has(bandKey)) {
    try {
      return await generatePreReaderHowItWorks(ctx, getGradeLevelContext(bandKey));
    } catch (error) {
      console.error("[HowItWorks] Pre-reader generation error:", error);
      throw error;
    }
  }
  const gradeLevelContext = getGradeLevelContext(bandKey);
  // Surface the EXACT numeric grade so grade-2 ≠ grade-4 within a band.
  const gradeLine = buildGradeLine(ctx.grade);

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

  const scopeSection = buildScopePromptSection(ctx.scope);

  const prompt = `You are a curriculum expert creating an interactive step-by-step process breakdown.

TOPIC / PROCESS: ${topic}
${scopeSection}
TARGET AUDIENCE: ${gradeLevelContext}
${gradeLine ? gradeLine + '\n' : ''}
## Your Mission:
Create a clear, engaging "How It Works" explanation of "${topic}" that walks students through the sequential stages of the process. Make the content RICH and MAGAZINE-QUALITY — not a simple text slideshow.

${challengeTypeSection}

## Content Guidelines:

### Title & Overview
- Title should be clear and engaging (e.g. "How Recycling Works", "How Your Heart Pumps Blood")
- Subtitle adds context or scope
- Overview is a 1-2 sentence hook that makes students curious

### Category
- Pick the BEST category for theming: science, engineering, nature, cooking, technology, body, or history

### Steps (4-6 items)
- Each step represents a distinct stage in the process
- Steps must be in chronological/logical order
- stepNumber starts at 1
- title: 2-5 word label for the step
- description: 2-3 sentences explaining what happens — vivid, concrete language
- whatsHappening: Deeper explanation of the underlying mechanism (1-2 sentences) — ALWAYS provide this
- imagePrompt: Photorealistic image prompt describing a REAL-WORLD scene as a photographer would capture it. Describe the actual objects, materials, textures, natural lighting, and camera angle. NO glowing effects, NO cross-sections, NO cutaways, NO diagram overlays, NO magical/sci-fi styling. Think documentary photography, not textbook illustration. (e.g. "Close-up of a diesel engine compartment on a yellow Caterpillar excavator, showing the engine block, hydraulic hoses, and oil filter, photographed in natural daylight at a construction site")
- keyTermTerm + keyTermDefinition: Important vocabulary — aim for at least 2-3 key terms across all steps
- funFact: A SURPRISING, specific fact with a number or comparison — aim for at least 3 across all steps

### Quick Facts
Provide quick reference facts about the process:
- duration: How long the process takes in real life
- whereItHappens: Where this process occurs
- inventedBy: Who discovered or first described it (if applicable)
- funComparison: A kid-friendly "wow" comparison (e.g. "Your small intestine is as long as a school bus!")
- energySource: What powers or drives the process
Provide at least 3 of these 5 fields.

### Real World Examples (2-4 items)
Everyday places students can see this process: "Your kitchen faucet", "A car engine", "When you breathe"

### Related Processes (2-3 items)
What related processes might interest a student next: "Water Treatment", "Evaporation", "Cloud Formation"

### Summary
- text: 1-2 sentence wrap-up of the whole process
- totalTime: How long the process takes in real life
- keyTakeaway: The single most important insight

### Challenges (3-4 items)
- Comprehension challenges that test understanding of the process
- Each challenge has a type, question, explanation, and relatedStep (step number)

**Challenge type rules:**

For "identify" challenges:
- Provide option0, option1, option2, option3 (4 multiple choice options)
- Provide correctAnswer: copy the EXACT text of the correct option (the authoritative answer)
- Provide correctIndex (0-3) pointing to that same option
- Question should ask student to match a description to the correct step

For "sequence" challenges:
- Provide sequenceItem0Id, sequenceItem0Text through sequenceItem4Id, sequenceItem4Text (3-5 items)
- IDs should be "s0", "s1", etc.
- AUTHOR THE ITEMS IN CORRECT CHRONOLOGICAL ORDER: item0 = the step that happens FIRST, the last item = the step that happens LAST. (The app shuffles them before showing the student, so never pre-scramble them yourself.)
- Provide correctOrderCsv listing EVERY item ID in that same correct order (e.g. "s0,s1,s2,s3"). It MUST contain all item IDs, each exactly once — a missing or partial key makes the challenge impossible to pass.
- EVERY item must be a REAL step that belongs in the sequence. Do NOT include trap/distractor items or steps labelled "not part of the process" — a sequence challenge only reorders real steps.

For "predict" challenges:
- Provide option0, option1, option2, option3 (4 multiple choice options)
- Provide correctAnswer: copy the EXACT text of the correct option (the authoritative answer)
- Provide correctIndex (0-3) pointing to that same option
- Question should describe a point in the process and ask what happens next

For "explain" challenges:
- Provide option0, option1, option2, option3 (4 multiple choice options)
- Provide correctAnswer: copy the EXACT text of the correct option (the authoritative answer)
- Provide correctIndex (0-3) pointing to that same option
- Question should ask WHY a step is important or necessary (e.g. "Why is Step 3 important?")
- The correct option explains the PURPOSE or CONSEQUENCE of the step
- Distractors should be plausible but incorrect reasons

## Grade-Level Adaptation:
- For K-2: Simple vocabulary, 4 steps max, very concrete everyday processes, relatable comparisons, fun comparisons required
- For 3-5: More detail, introduce scientific terms with definitions, real-world processes, include inventor/history where relevant
- For 6-8: Complex processes, technical vocabulary, connections to broader systems, more quickFacts depth

## Critical Rules:
1. Steps MUST be in correct chronological/logical order
2. All content must be scientifically/factually accurate
3. NEVER reveal challenge answers in step titles or descriptions
4. Challenges must be answerable from the content provided
5. For MC challenges, correctAnswer (exact option text), correctIndex, AND the explanation must ALL agree on the same option. The explanation must justify the option named in correctAnswer.
6. For sequence challenges, correctOrderCsv must contain all provided item IDs
7. Mix challenge types for variety (unless constrained by eval mode)
8. Each challenge should reference a specific relatedStep number
9. EVERY step should have a vivid, detailed imagePrompt — PHOTOREALISTIC style only. Describe real objects in real settings with natural light. Never use glowing, translucent, cutaway, cross-section, or fantasy/sci-fi styling.
10. Include funFacts and keyTerms generously — these create the "magazine" feel

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
      category: data.category,
      quickFacts: data.quickFacts ? Object.keys(data.quickFacts).length : 0,
      realWorldExamples: data.realWorldExamples?.length ?? 0,
      relatedProcesses: data.relatedProcesses?.length ?? 0,
    });

    return data;
  } catch (error) {
    console.error("[HowItWorks] Generation error:", error);
    throw error;
  }
};
