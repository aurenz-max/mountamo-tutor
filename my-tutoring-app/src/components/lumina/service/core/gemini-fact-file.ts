/**
 * Fact File Generator - Magazine-style profile card with key stats,
 * quick facts, deep dive sections, records, and "did you know" callouts.
 *
 * Uses a FLAT Gemini schema to avoid malformed nested JSON.
 * Supports eval modes with recall_easy, recall_medium, recall_hard challenge types.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { FactFileData } from '../../primitives/visual-primitives/core/FactFile';
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
  recall_easy: {
    promptDoc:
      `"recall_easy": Basic recall questions about explicitly stated facts. `
      + `Questions should reference information directly visible in quickFacts or keyStats. `
      + `Use simple, direct wording. Only one plausible distractor needed among 4 options.`,
    schemaDescription: "'recall_easy' (basic fact recall)",
  },
  recall_medium: {
    promptDoc:
      `"recall_medium": Moderate recall questions that may require connecting two facts, `
      + `or recalling details from deepDive or records sections. `
      + `Distractors should be plausible but clearly distinguishable. `
      + `May ask "which section" or "according to the records" style questions.`,
    schemaDescription: "'recall_medium' (moderate fact recall)",
  },
  recall_hard: {
    promptDoc:
      `"recall_hard": Advanced recall requiring inference or synthesis across sections. `
      + `Questions may combine information from multiple sections or require understanding `
      + `relationships between facts. All 4 options should be plausible. `
      + `May reference didYouKnow details or require comparing records with quickFacts.`,
    schemaDescription: "'recall_hard' (advanced inference recall)",
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
// Flat Gemini Schema
// ---------------------------------------------------------------------------

const selfCheckSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "The self-check question text",
    },
    option0: {
      type: Type.STRING,
      description: "First answer option",
    },
    option1: {
      type: Type.STRING,
      description: "Second answer option",
    },
    option2: {
      type: Type.STRING,
      description: "Third answer option",
    },
    option3: {
      type: Type.STRING,
      description: "Fourth answer option",
    },
    correctIndex: {
      type: Type.NUMBER,
      description: "Index of correct option (0-3)",
    },
    explanation: {
      type: Type.STRING,
      description: "Brief explanation shown after answering (1-2 sentences)",
    },
    difficulty: {
      type: Type.STRING,
      enum: ["easy", "medium", "hard"],
      description: "Question difficulty level",
    },
    relatedSection: {
      type: Type.STRING,
      enum: ["quickFacts", "deepDive", "records", "didYouKnow"],
      description: "Which section the question relates to",
    },
  },
  required: [
    "question", "option0", "option1", "option2", "option3",
    "correctIndex", "explanation", "difficulty", "relatedSection",
  ],
};

const keyStatSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.STRING, description: "The stat value (e.g. '4,500', '93%')" },
    unit: { type: Type.STRING, description: "Unit or qualifier (e.g. 'miles', 'species', 'years old')" },
    label: { type: Type.STRING, description: "Short label for the stat (e.g. 'Length', 'Population')" },
  },
  required: ["value", "unit", "label"],
};

const quickFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fact: { type: Type.STRING, description: "A single interesting fact (1-2 sentences)" },
    icon: { type: Type.STRING, description: "A single emoji icon for this fact" },
  },
  required: ["fact", "icon"],
};

const deepDiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    heading: { type: Type.STRING, description: "Section heading" },
    body: { type: Type.STRING, description: "Main body text (2-4 sentences)" },
    detail: { type: Type.STRING, description: "Optional extra detail or fun aside (1 sentence)" },
  },
  required: ["heading", "body"],
};

const recordSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING, description: "Record category (e.g. 'Fastest', 'Largest')" },
    value: { type: Type.STRING, description: "The record value or description" },
  },
  required: ["label", "value"],
};

const didYouKnowSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "Surprising or fascinating fact (1-2 sentences)" },
    source: { type: Type.STRING, description: "Optional source attribution" },
  },
  required: ["text"],
};

const factFileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the fact file (2-5 words, the subject name)",
    },
    category: {
      type: Type.STRING,
      description: "Category label (e.g. 'Animal', 'Planet', 'Historical Figure', 'Landmark')",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence introduction to the subject",
    },
    keyStats: {
      type: Type.ARRAY,
      items: keyStatSchema,
      description: "3-5 headline stats shown prominently at the top",
    },
    quickFacts: {
      type: Type.ARRAY,
      items: quickFactSchema,
      description: "4-6 bullet-point essential facts",
    },
    deepDive: {
      type: Type.ARRAY,
      items: deepDiveSchema,
      description: "2-4 expandable detail sections",
    },
    records: {
      type: Type.ARRAY,
      items: recordSchema,
      description: "2-3 records or superlatives",
    },
    didYouKnow: {
      type: Type.ARRAY,
      items: didYouKnowSchema,
      description: "2-3 surprising 'did you know?' callouts",
    },
    selfChecks: {
      type: Type.ARRAY,
      items: selfCheckSchema,
      description: "3-4 self-check multiple-choice questions about the content",
    },
  },
  required: [
    "title", "category", "description", "keyStats", "quickFacts",
    "deepDive", "records", "didYouKnow", "selfChecks",
  ],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function validateFactFileData(raw: any): FactFileData {
  // --- Basic fields ---
  const title = raw.title || 'Fact File';
  const category = raw.category || 'General';
  const description = raw.description || '';

  // --- keyStats (3-5) ---
  let keyStats: FactFileData['keyStats'] = [];
  if (Array.isArray(raw.keyStats)) {
    keyStats = raw.keyStats.slice(0, 5).map((s: any) => ({
      value: String(s.value || '?'),
      unit: String(s.unit || ''),
      label: String(s.label || ''),
    }));
  }
  if (keyStats.length < 3) {
    while (keyStats.length < 3) {
      keyStats.push({ value: '?', unit: '', label: `Stat ${keyStats.length + 1}` });
    }
  }

  // --- quickFacts (4-6) ---
  let quickFacts: FactFileData['quickFacts'] = [];
  if (Array.isArray(raw.quickFacts)) {
    quickFacts = raw.quickFacts.slice(0, 6).map((f: any) => ({
      fact: String(f.fact || ''),
      icon: f.icon || undefined,
    }));
  }
  if (quickFacts.length < 4) {
    while (quickFacts.length < 4) {
      quickFacts.push({ fact: 'Interesting fact coming soon.', icon: undefined });
    }
  }

  // --- deepDive (2-4) ---
  let deepDive: FactFileData['deepDive'] = [];
  if (Array.isArray(raw.deepDive)) {
    deepDive = raw.deepDive.slice(0, 4).map((d: any) => ({
      heading: String(d.heading || 'Section'),
      body: String(d.body || ''),
      detail: d.detail || undefined,
    }));
  }
  if (deepDive.length < 2) {
    while (deepDive.length < 2) {
      deepDive.push({ heading: 'More Info', body: 'Details coming soon.' });
    }
  }

  // --- records (2-3) ---
  let records: FactFileData['records'] = [];
  if (Array.isArray(raw.records)) {
    records = raw.records.slice(0, 3).map((r: any) => ({
      label: String(r.label || 'Record'),
      value: String(r.value || ''),
    }));
  }
  if (records.length < 2) {
    while (records.length < 2) {
      records.push({ label: 'Notable', value: 'Record details coming soon.' });
    }
  }

  // --- didYouKnow (2-3) ---
  let didYouKnow: FactFileData['didYouKnow'] = [];
  if (Array.isArray(raw.didYouKnow)) {
    didYouKnow = raw.didYouKnow.slice(0, 3).map((d: any) => ({
      text: String(d.text || ''),
      source: d.source || undefined,
    }));
  }
  if (didYouKnow.length < 2) {
    while (didYouKnow.length < 2) {
      didYouKnow.push({ text: 'Fun fact coming soon.' });
    }
  }

  // --- selfChecks (3-4) ---
  let selfChecks: NonNullable<FactFileData['selfChecks']> = [];
  if (Array.isArray(raw.selfChecks)) {
    selfChecks = raw.selfChecks.slice(0, 4).map((c: any) => {
      // Reconstruct options from flat option0-option3 fields
      const options = [
        String(c.option0 || c.options?.[0] || 'Option A'),
        String(c.option1 || c.options?.[1] || 'Option B'),
        String(c.option2 || c.options?.[2] || 'Option C'),
        String(c.option3 || c.options?.[3] || 'Option D'),
      ];

      let correctIndex = typeof c.correctIndex === 'number' ? c.correctIndex : 0;
      if (correctIndex < 0 || correctIndex > 3) correctIndex = 0;

      const validDifficulties = ['easy', 'medium', 'hard'];
      const difficulty = validDifficulties.includes(c.difficulty) ? c.difficulty : 'medium';

      const validSections = ['quickFacts', 'deepDive', 'records', 'didYouKnow'];
      const relatedSection = validSections.includes(c.relatedSection) ? c.relatedSection : 'quickFacts';

      return {
        question: String(c.question || 'Question'),
        options,
        correctIndex,
        explanation: String(c.explanation || ''),
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        relatedSection: relatedSection as 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow',
      };
    });
  }
  if (selfChecks.length < 3) {
    while (selfChecks.length < 3) {
      selfChecks.push({
        question: 'What is one key fact from this profile?',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 0,
        explanation: 'Review the quick facts section for the answer.',
        difficulty: 'easy',
        relatedSection: 'quickFacts',
      });
    }
  }

  return {
    title,
    category,
    description,
    keyStats,
    quickFacts,
    deepDive,
    records,
    didYouKnow,
    selfChecks,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a FactFile magazine-style profile card.
 *
 * @param topic      - The topic or subject for the fact file
 * @param gradeLevel - Grade level string (e.g. "Elementary", "Middle School")
 * @param config     - Optional overrides including targetEvalMode
 */
export const generateFactFile = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<FactFileData> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'fact-file',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(
        factFileSchema,
        evalConstraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
        { arrayName: 'selfChecks', fieldName: 'difficulty' },
      )
    : factFileSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `You are a curriculum expert creating an engaging magazine-style Fact File profile card.

TOPIC / SUBJECT: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}

## Your Mission:
Create a rich, informative Fact File about "${topic}" that reads like a page from a children's encyclopedia or magazine.

${challengeTypeSection}

## Content Guidelines:

### Key Stats (3-5 items)
- Choose the most impressive or memorable numeric facts
- Use rounded, memorable numbers (e.g., "4,500" not "4,487")
- Include units that help students understand scale
- Examples: Speed, Size, Age, Population, Distance

### Quick Facts (4-6 items)
- Bullet-point essentials — one interesting fact per item
- Each fact should be self-contained and memorable
- Include an emoji icon that matches the fact
- Keep each to 1-2 sentences

### Deep Dive (2-4 sections)
- Expandable sections with more detail
- Each has a heading, body (2-4 sentences), and optional extra detail
- Cover different aspects: habitat, history, abilities, behavior, etc.

### Records (2-3 items)
- Superlatives and record-holders related to the topic
- "Fastest", "Largest", "Oldest", etc.
- Concrete values where possible

### Did You Know? (2-3 items)
- Surprising, counterintuitive, or fascinating facts
- The kind of facts students would want to share with friends
- Optional source attribution

### Self-Check Questions (3-4 items)
- Multiple-choice questions that test recall of the content above
- Each question has exactly 4 options with one correct answer
- NEVER reveal answers in the question text
- Vary difficulty: include easy, medium, and hard questions
- Each question should reference a specific section (quickFacts, deepDive, records, or didYouKnow)
- Distractors should be plausible but clearly wrong
- Explanation should reinforce the correct answer without just restating it

## Grade-Level Adaptation:
- For K-2: Simple vocabulary, shorter facts, very concrete examples, relatable comparisons (e.g., "as tall as a school bus")
- For 3-5: More detailed facts, introduce some technical terms with explanations
- For 6-8: Richer vocabulary, more nuance, connections to broader concepts

## Critical Rules:
1. All facts must be accurate and age-appropriate
2. Self-check questions must be answerable from the content provided — do not ask about information not in the fact file
3. correctIndex must be 0, 1, 2, or 3 — matching the position of the correct option
4. Every self-check must have exactly 4 distinct options
5. Do not repeat the same information across sections

Now generate the Fact File.`;

  logEvalModeResolution('FactFile', config?.targetEvalMode, evalConstraint);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
      },
    });

    if (!response.text) throw new Error("No content generated for fact-file");

    const raw = JSON.parse(response.text);
    const data = validateFactFileData(raw);

    console.log('[FactFile] Generated:', {
      topic,
      gradeLevel,
      title: data.title,
      category: data.category,
      keyStats: data.keyStats.length,
      quickFacts: data.quickFacts.length,
      deepDive: data.deepDive.length,
      records: data.records.length,
      didYouKnow: data.didYouKnow.length,
      selfChecks: data.selfChecks?.length ?? 0,
    });

    return data;
  } catch (error) {
    console.error("[FactFile] Generation error:", error);
    throw error;
  }
};
