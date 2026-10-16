/**
 * How It Works Generator - a process told in 4-6 steps (or 3-4 picture steps for a pre-reader).
 *
 * Gemini writes the process only: the steps (title, description, what each step makes possible), the magazine
 * extras and, for a pre-reader, the picture steps. It writes no question and picks no answer. Every question is
 * built and keyed by code from the steps and their order (`howItWorksWorkspace.ts`, `buildHowItems`) per eval mode:
 * guided (which step does this blanked description tell of, the step list on screen), sequence (put the steps in
 * order, then identify with no list), predict (what happens next, and why a step matters). The old schema had the
 * model write each multiple-choice question and its key; `config.difficulty` now picks the structural band (how many
 * cards, whether the wrong choices sit next to the right one, whether both wrong choices come later).
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, gradeToBand, buildGradeLine } from "../scopeContext";
import { HowItWorksData } from '../../primitives/visual-primitives/core/HowItWorks';
import {
  buildHowItems, HOW_MODES, processSteps, type HowMode, type HowTier,
} from '../../primitives/visual-primitives/core/howItWorksWorkspace';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';

// The catalog's challenge types per mode, documented for the eval-mode resolver (code builds every item).
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: { promptDoc: 'which step a description tells of', schemaDescription: 'identify a step' },
  sequence: { promptDoc: 'put the steps in order', schemaDescription: 'order the steps' },
  predict: { promptDoc: 'what happens next', schemaDescription: 'predict the next step' },
  explain: { promptDoc: 'why a step matters', schemaDescription: 'why a step matters' },
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
    whatsHappening: { type: Type.STRING, description: "Optional deeper mechanism note — 1-2 SHORT sentences, under 40 words total. Omit when the description already covers it." },
    imagePrompt: { type: Type.STRING, description: "Photorealistic image prompt — describe a real-world scene as a photographer would see it, with natural lighting, real materials, and a clear camera angle. No glowing effects, no cross-sections, no diagram overlays." },
    keyTermTerm: { type: Type.STRING, description: "Optional key vocabulary term introduced in this step" },
    keyTermDefinition: { type: Type.STRING, description: "Definition of the key term (required if keyTermTerm provided)" },
    funFact: { type: Type.STRING, description: "A surprising, fun fact related to this step — include a number or comparison" },
    purpose: { type: Type.STRING, description: "ONE plain sentence (10-18 words) saying what this step does for the whole process, in everyday words a teacher would use, claiming nothing the description does not say. The app blanks this step's title words out of it." },
  },
  required: ["stepNumber", "title", "description", "imagePrompt", "purpose"],
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
    whereItHappens: { type: Type.STRING, description: "Where this process occurs, as ONE short phrase under 15 words (e.g. 'Inside your stomach', 'In the clouds')" },
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
      minItems: '4',
      maxItems: '6',
      description: "4-6 sequential steps of the process",
    },
    summary: summarySchema,
    quickFacts: quickFactsSchema,
    realWorldExamples: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: '4',
      description: "2-4 real-world examples where this process is seen (e.g. 'Your kitchen faucet', 'Car wash sprayers')",
    },
    relatedProcesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: '3',
      description: "2-3 related processes the student might explore next",
    },
  },
  required: ["title", "subtitle", "overview", "category", "steps", "summary"],
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
    preReader: { question, steps },
  };
}

// HW-5: length clamps. A *parsed* runaway (a repetition loop that still closed
// its quotes) previously flowed unclamped into the Quick Facts card — 337 KB in
// one rendered string. No legitimate value approaches these ceilings, so a
// clamp can only bound degenerate output, never damage real content.
const clampStr = (v: unknown, max: number): string => {
  const s = String(v);
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
};

function validateHowItWorksData(raw: any): HowItWorksData {
  const title = clampStr(raw.title || 'How It Works', 120);
  const subtitle = clampStr(raw.subtitle || '', 200);
  const overview = clampStr(raw.overview || '', 600);

  // --- Category ---
  const validCategories = ['science', 'engineering', 'nature', 'cooking', 'technology', 'body', 'history'];
  const category = validCategories.includes(raw.category) ? raw.category : undefined;

  // --- Steps (4-6) ---
  let steps: HowItWorksData['steps'] = [];
  if (Array.isArray(raw.steps)) {
    steps = raw.steps.slice(0, 6).map((s: any, i: number) => {
      const step: HowItWorksData['steps'][0] = {
        stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : i + 1,
        title: clampStr(s.title || `Step ${i + 1}`, 80),
        description: clampStr(s.description || '', 400),
        imagePrompt: clampStr(s.imagePrompt || `Step ${i + 1} of ${title}`, 600),
      };
      if (s.whatsHappening) step.whatsHappening = clampStr(s.whatsHappening, 300);
      if (s.keyTermTerm && s.keyTermDefinition) {
        step.keyTerm = {
          term: clampStr(s.keyTermTerm, 60),
          definition: clampStr(s.keyTermDefinition, 200),
        };
      }
      if (s.funFact) step.funFact = clampStr(s.funFact, 300);
      if (s.purpose) step.purpose = clampStr(s.purpose, 200);
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
    text: clampStr(raw.summary?.text || 'Summary coming soon.', 500),
    keyTakeaway: clampStr(raw.summary?.keyTakeaway || 'More to explore!', 250),
  };
  if (raw.summary?.totalTime) {
    summary.totalTime = clampStr(raw.summary.totalTime, 60);
  }

  // --- Quick Facts --- (120-char clamp: HW-5's 337 KB runaway landed here)
  let quickFacts: HowItWorksData['quickFacts'] = undefined;
  if (raw.quickFacts && typeof raw.quickFacts === 'object') {
    const qf: NonNullable<HowItWorksData['quickFacts']> = {};
    if (raw.quickFacts.duration) qf.duration = clampStr(raw.quickFacts.duration, 120);
    if (raw.quickFacts.whereItHappens) qf.whereItHappens = clampStr(raw.quickFacts.whereItHappens, 120);
    if (raw.quickFacts.inventedBy) qf.inventedBy = clampStr(raw.quickFacts.inventedBy, 120);
    if (raw.quickFacts.funComparison) qf.funComparison = clampStr(raw.quickFacts.funComparison, 120);
    if (raw.quickFacts.energySource) qf.energySource = clampStr(raw.quickFacts.energySource, 120);
    if (Object.keys(qf).length > 0) quickFacts = qf;
  }

  // --- Real World Examples ---
  let realWorldExamples: string[] | undefined = undefined;
  if (Array.isArray(raw.realWorldExamples) && raw.realWorldExamples.length > 0) {
    realWorldExamples = raw.realWorldExamples.slice(0, 5).map((x: unknown) => clampStr(x, 150));
  }

  // --- Related Processes ---
  let relatedProcesses: string[] | undefined = undefined;
  if (Array.isArray(raw.relatedProcesses) && raw.relatedProcesses.length > 0) {
    relatedProcesses = raw.relatedProcesses.slice(0, 4).map((x: unknown) => clampStr(x, 150));
  }

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
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type HowItWorksConfig = Partial<{ targetEvalMode?: string; difficulty?: string }>;

// Bands that get the pre-reader (picture) subset instead of the reading-
// heavy magazine + text questions. These are the non-decoding audiences.
const PRE_READER_BANDS = new Set(['Toddler', 'Preschool', 'Kindergarten']);

const normalizeTier = (d?: string): HowTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** The questions, built and keyed by code from the steps, for the pinned mode (none pinned: one of each kind). */
function withItems(data: HowItWorksData, mode: HowMode | null, tier: HowTier): HowItWorksData {
  const modes = mode ? [mode] : null;
  const items = buildHowItems({ steps: processSteps(data), modes, tier, pictures: !!data.preReader, rng: Math.random });
  return { ...data, ...(modes ? { modes } : {}), difficulty: tier, items };
}

/**
 * Generate the pre-reader (K / PRE) subset: the process as 3-4 picture steps the tutor reads aloud. Same primitive,
 * reduced schema — no magazine, no text questions. Code builds the picture questions from these steps.
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
The child will see picture cards (one emoji each), hear the story of the process, then answer picture questions about it by tapping: find the picture the tutor describes, put the pictures in order, pick what happens next. There is NO reading — the tutor reads everything aloud. So:

1. Break "${topic}" into EXACTLY 3-4 simple, concrete steps a young child can picture.
2. AUTHOR THE STEPS IN CORRECT ORDER — step 1 happens first, the last step happens last. (The app shuffles the cards before showing them.)
3. For each step give:
   - emoji: ONE emoji that clearly pictures the step (never a letter or number).
   - label: a 1-3 word caption in words a 5-year-old knows.
   - spoken: ONE short, plain, present-tense sentence the tutor will read aloud. It describes what its picture shows, so a child can find the picture from the sentence.
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
  const config = (ctx.raw ?? {}) as HowItWorksConfig;
  // Resolve the audience BAND from the canonical numeric grade first, prose
  // fallback second. Feeding a real map KEY (not the prose sentence) is what
  // fixes the always-'Elementary' bug: ctx.gradeContext is a full sentence and
  // never matched a getGradeLevelContext key.
  const bandKey = (ctx.grade && gradeToBand(ctx.grade)) || inferGradeLevelFromContext(ctx.gradeContext);
  const gradeLevel = bandKey;

  // ── The eval mode (catalog, single source of truth) and the structural band ──
  const evalConstraint = resolveEvalModeConstraint('how-it-works', ctx.targetEvalMode ?? config.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('HowItWorks', ctx.targetEvalMode ?? config.targetEvalMode, evalConstraint);
  const pinned = evalConstraint?.definition.evalMode;
  const mode: HowMode | null = (HOW_MODES as string[]).includes(pinned ?? '') ? pinned as HowMode : null;
  const tier = normalizeTier(config.difficulty);

  // ── Pre-reader (K / PRE) subset: the same primitive at a reduced complexity ──
  if (PRE_READER_BANDS.has(bandKey)) {
    try {
      return withItems(await generatePreReaderHowItWorks(ctx, getGradeLevelContext(bandKey)), mode, tier);
    } catch (error) {
      console.error("[HowItWorks] Pre-reader generation error:", error);
      throw error;
    }
  }
  const gradeLevelContext = getGradeLevelContext(bandKey);
  // Surface the EXACT numeric grade so grade-2 ≠ grade-4 within a band.
  const gradeLine = buildGradeLine(ctx.grade);

  const scopeSection = buildScopePromptSection(ctx.scope);

  const prompt = `You are a curriculum expert creating an interactive step-by-step process breakdown.

TOPIC / PROCESS: ${topic}
${scopeSection}
TARGET AUDIENCE: ${gradeLevelContext}
${gradeLine ? gradeLine + '\n' : ''}
## Your Mission:
Create a clear, engaging "How It Works" explanation of "${topic}" that walks students through the sequential stages of the process. Make the content RICH and MAGAZINE-QUALITY — not a simple text slideshow.

After reading, the student answers questions the app builds from your steps: which step a description tells of (with the step's own title words blanked out of it), putting the steps in order, what happens next, and why a step matters. So each step must be distinct, and its description and purpose must make sense on their own.

## Content Guidelines:

### Title & Overview
- Title should be clear and engaging (e.g. "How Recycling Works", "How Your Heart Pumps Blood")
- Subtitle adds context or scope
- Overview is a 1-2 sentence hook that makes students curious

### Category
- Pick the BEST category for theming: science, engineering, nature, cooking, technology, body, or history

### Steps (4-6 items)
- Each step represents a distinct stage in the process, and no two steps share a title word
- Steps must be in chronological/logical order
- stepNumber starts at 1
- title: 2-5 word label for the step
- description: 2-3 sentences explaining what happens — vivid, concrete language. Describe the action in other words than the title's (a reader should recognise the step from the description without its title)
- purpose: ONE plain sentence (10-18 words) saying what this step does for the whole process (e.g. for "Pushing the Pedals": "It starts the turning motion that the rest of the bicycle passes along to the wheel."). The app blanks the step's title words out of it, so it must still make sense without them; name the parts plainly anyway. Use the everyday words a teacher would use: a toilet's bowl is "the bowl", not "the porcelain basin"; blood is "blood", not "the fluid". Claim nothing the step's description does not say, and no science the description does not explain.
- whatsHappening: OPTIONAL deeper mechanism note — include only when there is a real mechanism to add, in 1-2 SHORT sentences (under 40 words). Never pad; omit it when the description already says it
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
Each field is ONE short phrase, under 15 words. Include only the fields where you have something real and specific to say — one or two is fine, and omitting quickFacts entirely is fine. Never elaborate or repeat to fill a field.

### Real World Examples (2-4 items)
Everyday places students can see this process: "Your kitchen faucet", "A car engine", "When you breathe"

### Related Processes (2-3 items)
What related processes might interest a student next: "Water Treatment", "Evaporation", "Cloud Formation"

### Summary
- text: 1-2 sentence wrap-up of the whole process
- totalTime: How long the process takes in real life
- keyTakeaway: The single most important insight

## Grade-Level Adaptation:
- For K-2: Simple vocabulary, 4 steps max, very concrete everyday processes, relatable comparisons, fun comparisons required
- For 3-5: More detail, introduce scientific terms with definitions, real-world processes, include inventor/history where relevant
- For 6-8: Complex processes, technical vocabulary, connections to broader systems, more quickFacts depth

## Critical Rules:
1. Steps MUST be in correct chronological/logical order
2. All content must be scientifically/factually accurate
3. EVERY step should have a vivid, detailed imagePrompt — PHOTOREALISTIC style only. Describe real objects in real settings with natural light. Never use glowing, translucent, cutaway, cross-section, or fantasy/sci-fi styling.
4. Include funFacts and keyTerms generously — these create the "magazine" feel

Now generate the How It Works content.`;

  // HW-4: bounded retry + hard output cap. flash-lite intermittently falls into
  // single-string repetition (observed live: "surface crust" ×~1,700 inside
  // quickFacts.whereItHappens) and runs to the model's 65K output ceiling —
  // unbounded, that is a 340 KB payload or an unterminated-JSON crash, and this
  // generator runs under Promise.all so a throw costs the whole exhibit.
  // maxOutputTokens turns the runaway into a fast truncation (a clean payload is
  // ~2K tokens, so 8192 is 4× headroom), the parse guard turns the truncation
  // into a retry, and only a double failure still throws — the no-filler rule in
  // validateHowItWorksData (empty steps refuse to ship) makes a skeleton
  // degrade dishonest for this primitive, unlike vocabulary-explorer's.
  const MAX_ATTEMPTS = 2;
  let raw: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: howItWorksSchema,
        maxOutputTokens: 8192,
      },
    });

    if (!response.text) {
      console.warn(`[HowItWorks] Empty response on attempt ${attempt}/${MAX_ATTEMPTS}.`);
      continue;
    }
    try {
      raw = JSON.parse(response.text);
      break;
    } catch (err) {
      console.warn(
        `[HowItWorks] JSON parse failed on attempt ${attempt}/${MAX_ATTEMPTS} `
        + `(${response.text.length} chars; finishReason=${response.candidates?.[0]?.finishReason ?? 'unknown'}). `
        + `${err instanceof Error ? err.message : err}`,
      );
    }
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('[HowItWorks] Generation failed after bounded retries — no parseable payload.');
  }

  const data = withItems(validateHowItWorksData(raw), mode, tier);

  console.log('[HowItWorks] Generated:', {
    topic,
    gradeLevel,
    title: data.title,
    steps: data.steps.length,
    mode,
    tier,
    items: data.items?.map(i => i.id) ?? [],
    category: data.category,
    quickFacts: data.quickFacts ? Object.keys(data.quickFacts).length : 0,
  });

  return data;
};
