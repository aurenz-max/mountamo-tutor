/**
 * Knowledge Check Generator - Dedicated service for assessment problem generation
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 *
 * Supports 6 problem types:
 * - Multiple Choice
 * - True/False
 * - Fill in Blanks
 * - Categorization Activity
 * - Matching Activity
 * - Sequencing Activity
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  ProblemType,
  ProblemData,
  MultipleChoiceProblemData,
  TrueFalseProblemData,
  FillInBlanksProblemData,
  CategorizationActivityProblemData,
  MatchingActivityProblemData,
  SequencingActivityProblemData,
  InsetType,
  Inset,
  KnowledgeCheckPlan,
} from "../../types";
import { runKnowledgeCheckOrchestrator } from './gemini-knowledge-check-orchestrator';

// ============================================================================
// BLOOM'S TAXONOMY TIERS (IRT §6.8)
// ============================================================================

/**
 * Bloom's taxonomy-aligned cognitive tiers for adaptive difficulty.
 * Maps to IRT parameters: recall (β=1.5, a=1.6), apply (β=3.0, a=1.4),
 * analyze (β=4.5, a=1.6), evaluate (β=6.0, a=1.8).
 */
export type BloomsTier = 'recall' | 'apply' | 'analyze' | 'evaluate';

/**
 * Tier-specific prompt instructions injected into each generator.
 * Controls cognitive demand, distractor quality, and option count.
 */
const BLOOMS_TIER_PROMPTS: Record<BloomsTier, {
  label: string;
  questionGuidance: string;
  distractorGuidance: string;
  mcOptionCount: number;
}> = {
  recall: {
    label: 'Recall (Bloom\'s Tier 1, β=1.5)',
    questionGuidance:
      'Generate questions testing DIRECT RECALL of facts, definitions, or simple recognition. '
      + 'Questions should start with "What is...", "Which of the following is...", "Name the...", '
      + '"True or false: [simple factual statement]". '
      + 'Test whether the student can retrieve basic information from memory.',
    distractorGuidance:
      'Distractors should be CLEARLY WRONG to someone who studied the material. '
      + 'They may be related terms but should not require deep reasoning to eliminate. '
      + 'The correct answer should be unambiguous.',
    mcOptionCount: 4,
  },
  apply: {
    label: 'Apply (Bloom\'s Tier 2, β=3.0)',
    questionGuidance:
      'Generate questions that ask students to USE a concept, procedure, or rule to solve a concrete problem. '
      + 'Good patterns: "What happens when…", "Which step comes next if…", "A student measured X — what is Y?", '
      + '"Which example shows [concept] in action?". '
      + 'Ground questions in realistic, specific situations — not hypothetical thought experiments. '
      + 'Do NOT use phrases like "apply what you know" or "how would you use" — just pose the problem directly.',
    distractorGuidance:
      'Distractors should be PLAUSIBLE results of common procedural errors or misconceptions. '
      + 'Each wrong answer should represent a specific mistake a student might make '
      + '(e.g., forgetting a step, applying the wrong formula, confusing similar concepts).',
    mcOptionCount: 4,
  },
  analyze: {
    label: 'Analyze (Bloom\'s Tier 3, β=4.5)',
    questionGuidance:
      'Generate questions requiring ANALYSIS, comparison, or multi-step reasoning. '
      + 'Questions should start with "Why does...", "What would happen if...", "Compare...", '
      + '"What is the relationship between...", "Which factor most influences...". '
      + 'Test whether the student can break down concepts and identify relationships.',
    distractorGuidance:
      'ALL distractors must be HIGHLY PLAUSIBLE, representing common analytical errors. '
      + 'Each wrong answer should sound defensible at first glance but fail under careful analysis. '
      + 'Students who don\'t deeply understand should be drawn to specific distractors.',
    mcOptionCount: 5,
  },
  evaluate: {
    label: 'Evaluate (Bloom\'s Tier 4, β=6.0)',
    questionGuidance:
      'Generate questions requiring JUDGMENT between competing approaches or SYNTHESIS of multiple concepts. '
      + 'Questions should start with "Which approach is most effective for...", "Evaluate whether...", '
      + '"What is the strongest argument for...", "Given [complex scenario], which strategy would...". '
      + 'Test whether the student can make informed judgments based on deep understanding.',
    distractorGuidance:
      'Distractors must be GENUINELY DEFENSIBLE but ultimately inferior positions. '
      + 'Each wrong answer should represent a reasonable viewpoint that fails under expert scrutiny. '
      + 'The distinction between correct and incorrect should require nuanced understanding. '
      + 'Random guessing should be nearly impossible — students are drawn to plausible-looking answers.',
    mcOptionCount: 5,
  },
};

/**
 * Build the Bloom's tier prompt section for injection into any generator.
 * Returns empty string when no tier is specified (backward compatible).
 */
function buildBloomsTierPrompt(tier?: BloomsTier): string {
  if (!tier) return '';
  const t = BLOOMS_TIER_PROMPTS[tier];
  return `
## ADAPTIVE DIFFICULTY CONSTRAINT (IRT calibration)
**Cognitive Level: ${t.label}**

### QUESTION COGNITIVE DEMAND
${t.questionGuidance}

### DISTRACTOR / WRONG-ANSWER QUALITY
${t.distractorGuidance}

IMPORTANT: Every question in this batch MUST be at the ${tier.toUpperCase()} cognitive level. Do NOT mix tiers.
`;
}

/**
 * Get MC option letters for a given tier (4 or 5 options).
 */
function getMcOptionLabels(tier?: BloomsTier): string[] {
  const count = tier ? BLOOMS_TIER_PROMPTS[tier].mcOptionCount : 4;
  return count === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
}

// ============================================================================
// INSET SCHEMAS (Rich inline content generated atomically with problems)
// ============================================================================

/**
 * Build the Gemini schema fragment for a specific inset type.
 * Returns null when no inset is requested — backward compatible.
 */
function getInsetSchema(insetType?: InsetType): Schema | null {
  if (!insetType) return null;

  const baseProps: Record<string, Schema> = {
    insetType: { type: Type.STRING, description: `Must be "${insetType}"` },
    label: { type: Type.STRING, description: 'Display label, e.g. "Figure 1", "Table A", "Equation"' },
  };

  switch (insetType) {
    case 'katex':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          expression: { type: Type.STRING, description: 'LaTeX expression string (e.g. "\\\\frac{d}{dx}[x^3]")' },
          displayMode: { type: Type.STRING, enum: ['display', 'inline'], description: '"display" for centered block, "inline" for flow' },
          caption: { type: Type.STRING, description: 'Optional description below the expression' },
        },
        required: ['insetType', 'expression', 'displayMode'],
      };

    case 'data-table':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          headers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Column headers' },
          rows: {
            type: Type.ARRAY,
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: '2D array of cell values',
          },
          caption: { type: Type.STRING, description: 'Optional table caption' },
        },
        required: ['insetType', 'headers', 'rows'],
      };

    case 'passage':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          text: { type: Type.STRING, description: 'The passage text. Use \\n for line breaks in poetry.' },
          format: { type: Type.STRING, enum: ['prose', 'poem', 'quote', 'letter', 'source'], description: 'Typography style' },
          attribution: { type: Type.STRING, description: 'Author/source attribution' },
        },
        required: ['insetType', 'text', 'format'],
      };

    case 'chart':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie'], description: 'Chart visualization type' },
          title: { type: Type.STRING, description: 'Chart title' },
          xLabel: { type: Type.STRING, description: 'X-axis label' },
          yLabel: { type: Type.STRING, description: 'Y-axis label' },
          data: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.NUMBER },
              },
              required: ['label', 'value'],
            },
            description: 'Data points (3-8 items)',
          },
        },
        required: ['insetType', 'chartType', 'title', 'data'],
      };

    case 'code':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          code: { type: Type.STRING, description: 'Source code content' },
          language: { type: Type.STRING, description: 'Programming language (e.g. python, javascript, java)' },
        },
        required: ['insetType', 'code', 'language'],
      };

    case 'number-line':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          min: { type: Type.NUMBER, description: 'Left end of number line' },
          max: { type: Type.NUMBER, description: 'Right end of number line' },
          ticks: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: 'Tick mark positions' },
          points: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.NUMBER },
                label: { type: Type.STRING },
              },
              required: ['value', 'label'],
            },
            description: 'Named points on the line',
          },
        },
        required: ['insetType', 'min', 'max', 'ticks'],
      };

    case 'definition-box':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          term: { type: Type.STRING, description: 'The vocabulary term' },
          definition: { type: Type.STRING, description: 'The definition' },
          partOfSpeech: { type: Type.STRING, description: 'e.g. noun, verb, adjective' },
          exampleSentence: { type: Type.STRING, description: 'Example usage in a sentence' },
        },
        required: ['insetType', 'term', 'definition'],
      };

    case 'image':
      // Image insets require base64 — not practical for Gemini text generation.
      // Handled separately via image generation pipeline.
      return null;

    default:
      return null;
  }
}

/**
 * Build prompt instructions for inset generation.
 * Injected into any generator prompt when insetType is specified.
 */
function buildInsetPrompt(insetType?: InsetType): string {
  if (!insetType) return '';

  const guidance: Record<string, string> = {
    'katex': `
## INSET: Mathematical Expression (KaTeX)
Generate a LaTeX mathematical expression that is CENTRAL to the question.
The question MUST require reading/interpreting the expression to answer.
Use proper LaTeX notation (\\frac, \\sqrt, ^, _, \\sum, \\int, Greek letters, etc.).
The expression should be complex enough to be worth rendering — not just "x + 2".`,

    'data-table': `
## INSET: Data Table
Generate a data table with 3-6 columns and 3-8 rows of realistic data.
The question MUST require reading specific values from the table to answer.
Distractors should be plausible misreadings (wrong row, adjacent column, etc.).
Include meaningful headers and varied data that supports multiple question angles.`,

    'passage': `
## INSET: Text Passage
Generate a passage (2-4 paragraphs for prose, 8-16 lines for poetry, 1-3 paragraphs for quotes/letters/sources).
The question MUST require comprehending the passage to answer — not just surface recall.
For poetry: use \\n for line breaks. For prose: write continuous paragraphs.
Include an attribution if appropriate (author name, title, date).`,

    'chart': `
## INSET: Chart Data
Generate realistic data points (3-8 items) for a chart visualization.
The question MUST require interpreting the chart data to answer.
Include a descriptive title and axis labels where appropriate.
Make sure data values create clear patterns or comparisons the question can test.`,

    'code': `
## INSET: Code Block
Generate a code snippet (5-20 lines) in the specified or appropriate language.
The question MUST require reading/tracing the code to answer.
Include realistic variable names, proper indentation, and clear logic.
For "find the bug" questions: include exactly one subtle, realistic bug.`,

    'number-line': `
## INSET: Number Line
Generate a number line with appropriate range, tick marks, and labeled points.
The question MUST require interpreting positions or distances on the number line.
Use grade-appropriate numbers (integers for elementary, fractions/decimals for middle school).`,

    'definition-box': `
## INSET: Definition Box
Generate a vocabulary term with its definition, part of speech, and example sentence.
The question MUST require understanding the definition to answer — not just recognizing the word.
Choose terms with nuanced meanings that support analysis-level questions.`,
  };

  return (guidance[insetType] || '') + `

CRITICAL: The inset content and question MUST be internally consistent.
- The question is UNANSWERABLE without the inset.
- Distractors are derived from plausible misinterpretations of the inset.
- The inset and question are generated TOGETHER as one coherent unit.
`;
}

/**
 * Inject the inset schema property into a problem schema.
 * Mutates the schema's properties and required arrays.
 */
function injectInsetIntoSchema(
  problemSchema: Schema,
  insetType?: InsetType
): void {
  const insetSchema = getInsetSchema(insetType);
  if (!insetSchema || !problemSchema.properties) return;

  (problemSchema.properties as Record<string, Schema>)['inset'] = insetSchema;
  // Don't add to required — Gemini must produce it when instructed but schema flexibility helps
}

/**
 * Extract and type the inset from a raw Gemini response problem object.
 * Returns undefined if no inset data present.
 */
function extractInset(raw: any, insetType?: InsetType): Inset | undefined {
  if (!insetType || !raw.inset) return undefined;
  return {
    ...raw.inset,
    insetType: insetType, // Ensure type is set even if Gemini omits it
  } as Inset;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert grade level to descriptive educational context for prompts
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3) - Use very simple language, basic concepts, concrete examples, and playful engagement. Focus on sensory experiences and foundational learning.',
    'preschool': 'preschool children (ages 3-5) - Use simple sentences, colorful examples, storytelling, and hands-on concepts. Build curiosity and wonder.',
    'kindergarten': 'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.',
    'elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.',
    'middle-school': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.',
    'high-school': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, academic rigor, and college-prep content. Foster analytical and creative thinking.',
    'undergraduate': 'undergraduate college students - Use academic language, theoretical frameworks, research-based content, and interdisciplinary connections. Promote scholarly engagement.',
    'graduate': 'graduate students (Master\'s level) - Use specialized terminology, advanced theoretical concepts, research methodologies, and professional applications. Encourage critical scholarship.',
    'phd': 'doctoral students and researchers - Use expert-level terminology, cutting-edge research, theoretical depth, and scholarly discourse. Foster original thinking and research contributions.'
  };

  return contexts[gradeLevel] || contexts['elementary'];
};

// ============================================================================
// MULTIPLE CHOICE PROBLEMS
// ============================================================================

/**
 * Generate multiple choice problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateMultipleChoiceProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string,
  bloomsTier?: BloomsTier,
  insetType?: InsetType
): Promise<MultipleChoiceProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const optionLabels = getMcOptionLabels(bloomsTier);
  const optionCount = optionLabels.length;

  const multipleChoiceSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} multiple choice problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'mc_1', 'mc_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            question: {
              type: Type.STRING,
              description: "The multiple choice question"
            },
            options: {
              type: Type.ARRAY,
              description: `Array of ${optionCount} answer options`,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: `Option letter (${optionLabels.join(', ')})` },
                  text: { type: Type.STRING, description: "Option text" }
                },
                required: ["id", "text"]
              }
            },
            correctOptionId: {
              type: Type.STRING,
              description: `The correct option ID (${optionLabels.join(', ')})`
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the correct answer and why it's correct (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip or additional context for educators (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "question", "options", "correctOptionId", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  // Inject inset schema into each problem item when insetType is specified
  const itemSchema = (multipleChoiceSchema.properties as any).problems.items;
  injectInsetIntoSchema(itemSchema, insetType);

  // Add optionFormat to schema when katex inset (options may also be LaTeX)
  if (insetType === 'katex') {
    (itemSchema.properties as Record<string, Schema>)['optionFormat'] = {
      type: Type.STRING,
      enum: ['text', 'katex'],
      description: 'Set to "katex" if answer options contain LaTeX expressions, otherwise "text"',
    };
  }

  const bloomsPrompt = buildBloomsTierPrompt(bloomsTier);
  const insetPrompt = buildInsetPrompt(insetType);

  const prompt = `You are an expert educational assessment designer creating multiple choice questions for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}
${bloomsPrompt}${insetPrompt}
## Your Mission:
Create ${count} high-quality multiple choice question${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".${insetType ? `\nEach problem MUST include an "inset" object with rich inline content (type: "${insetType}") that the question directly references.` : ''}

## Quality Standards:

### 1. QUESTION DESIGN
- Write clear, unambiguous questions appropriate for the grade level
- Focus on conceptual understanding, not just memorization
- Use age-appropriate vocabulary and sentence structure
- Questions should test genuine comprehension, not trick students

### 2. ANSWER OPTIONS
- Provide exactly ${optionCount} options labeled ${optionLabels.join(', ')}
- Make all distractors (wrong answers) plausible
- Avoid "all of the above" or "none of the above" options
- Ensure options are parallel in structure and length
- Mix up the position of the correct answer (don't always make it B or C)

### 3. DIFFICULTY PROGRESSION
${count > 1 ? `- Start with easier questions, build to harder ones
- Balance difficulty: some easy, some medium, some hard` : '- Set appropriate difficulty for the topic and grade level'}

### 4. RATIONALE (Most Important!)
- Explain WHY the correct answer is right (not just repeating it)
- Connect to broader concepts or principles
- Address common misconceptions if relevant
- Use encouraging, educational language
- 2-3 sentences that genuinely teach

### 5. TEACHING NOTE
- Provide optional pedagogical context or teaching strategies
- Suggest connections to other concepts
- Highlight common student difficulties
- Can be empty if no special note needed

### 6. SUCCESS CRITERIA
- List 1-3 specific learning objectives this problem assesses
- Use action verbs (identify, explain, apply, analyze, etc.)
- Make criteria measurable and specific to the problem

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: multipleChoiceSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'multiple_choice' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      question: problem.question,
      options: problem.options,
      correctOptionId: problem.correctOptionId,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria,
      ...(extractInset(problem, insetType) ? { inset: extractInset(problem, insetType) } : {}),
      ...(problem.optionFormat === 'katex' ? { optionFormat: 'katex' as const } : {}),
    }));

    console.log('Multiple Choice Generated from dedicated service:', {
      topic,
      count: problems.length,
      hasInsets: problems.some((p: any) => p.inset),
    });

    return problems;
  } catch (error) {
    console.error("Multiple choice problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// TRUE/FALSE PROBLEMS
// ============================================================================

/**
 * Generate true/false problems for KnowledgeCheck component
 */
export const generateTrueFalseProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string,
  bloomsTier?: BloomsTier,
  insetType?: InsetType
): Promise<TrueFalseProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const trueFalseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} true/false problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'tf_1', 'tf_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            statement: {
              type: Type.STRING,
              description: "A clear declarative statement that is either true or false"
            },
            correct: {
              type: Type.BOOLEAN,
              description: "Whether the statement is true (true) or false (false)"
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of why the statement is true or false, addressing potential misconceptions (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, real-world connection, or common student misconception to address (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "statement", "correct", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  // Inject inset schema into each problem item
  const tfItemSchema = (trueFalseSchema.properties as any).problems.items;
  injectInsetIntoSchema(tfItemSchema, insetType);

  const bloomsPrompt = buildBloomsTierPrompt(bloomsTier);
  const insetPrompt = buildInsetPrompt(insetType);

  const prompt = `You are an expert educational assessment designer creating true/false questions for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}
${bloomsPrompt}${insetPrompt}
## Your Mission:
Create ${count} high-quality true/false statement${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".${insetType ? `\nEach problem MUST include an "inset" object with rich inline content (type: "${insetType}") that the statement directly references.` : ''}

## Quality Standards:

### 1. STATEMENT DESIGN
- Write clear, unambiguous declarative statements
- Each statement should be definitively true or false (no "sometimes" or "maybe")
- Focus on important concepts, not trivial facts
- Avoid trick questions or overly complex wording
- Use age-appropriate vocabulary and sentence structure
- Avoid absolute words like "always," "never," "all," "none" unless genuinely accurate

### 2. BALANCE TRUE AND FALSE
${count > 1 ? `- Mix true and false statements roughly equally
- Don't create patterns (e.g., T, F, T, F or all true)
- Randomize the distribution naturally` : '- Make it either true or false based on what best assesses understanding'}

### 3. MISCONCEPTION TARGETING
- Target common student misconceptions with false statements
- Use false statements that reflect plausible but incorrect thinking
- Avoid obscure or trick false statements
- True statements should reinforce key accurate understandings

### 4. RATIONALE (Most Important!)
- Explain WHY the statement is true or false
- For FALSE statements: explain what makes it false AND what the truth is
- For TRUE statements: explain what makes it accurate and important
- Address any misconceptions the statement targets
- Use clear, educational language
- 2-3 sentences that genuinely teach

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: trueFalseSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'true_false' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      statement: problem.statement,
      correct: problem.correct,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria,
      ...(extractInset(problem, insetType) ? { inset: extractInset(problem, insetType) } : {}),
    }));

    console.log('True/False Generated from dedicated service:', {
      topic,
      count: problems.length,
      hasInsets: problems.some((p: any) => p.inset),
    });

    return problems;
  } catch (error) {
    console.error("True/false problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// FILL IN BLANKS PROBLEMS
// ============================================================================

/**
 * Generate fill in blanks problems for KnowledgeCheck component
 */
export const generateFillInBlanksProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string,
  bloomsTier?: BloomsTier,
  insetType?: InsetType
): Promise<FillInBlanksProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const fillInBlanksSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} fill in blanks problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'fib_1', 'fib_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level - Easy: 1 blank, Medium: 2 blanks, Hard: 3 blanks"
            },
            textWithBlanks: {
              type: Type.STRING,
              description: "Complete sentence or passage with blanks marked as [blank_1], [blank_2], etc. The blanks should test key vocabulary or concepts."
            },
            blanks: {
              type: Type.ARRAY,
              description: "Array of blank definitions, one for each [blank_N] in the text. Easy should have 1 blank, Medium 2 blanks, Hard 3 blanks.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Blank identifier matching the text (e.g., 'blank_1', 'blank_2')"
                  },
                  correctAnswer: {
                    type: Type.STRING,
                    description: "The single correct answer for this blank (will be included in word bank)"
                  },
                  caseSensitive: {
                    type: Type.BOOLEAN,
                    description: "Whether answers should be case-sensitive (usually false)"
                  }
                },
                required: ["id", "correctAnswer", "caseSensitive"]
              }
            },
            wordBank: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Word bank containing all correct answers PLUS 2-3 plausible distractors. Distractors should be related to the topic but clearly incorrect for the given context."
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the correct answers and why they're important (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip about vocabulary usage, context clues, or common errors (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "textWithBlanks", "blanks", "wordBank", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  // Inject inset schema into each problem item when insetType is specified
  const fibItemSchema = (fillInBlanksSchema.properties as any).problems.items;
  injectInsetIntoSchema(fibItemSchema, insetType);

  const bloomsPrompt = buildBloomsTierPrompt(bloomsTier);
  const insetPrompt = buildInsetPrompt(insetType);

  const prompt = `You are an expert educational assessment designer creating fill-in-the-blank questions with drag-and-drop word banks.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}
${bloomsPrompt}${insetPrompt}
## Your Mission:
Create ${count} high-quality fill-in-the-blank problem${count > 1 ? 's' : ''} with word banks that effectively assess understanding of "${topic}".${insetType ? `\nEach problem MUST include an "inset" object with rich inline content (type: "${insetType}") that the question directly references.` : ''}

## Quality Standards:

### 1. TEXT DESIGN
- Create complete, meaningful sentences or short passages (1-3 sentences)
- Use age-appropriate vocabulary and complexity
- Make the context clear enough that students can use context clues
- Ensure the sentence makes sense with the blanks filled in
- Use natural, flowing language (not awkward or forced)

### 2. DIFFICULTY LEVELS (CRITICAL - FOLLOW EXACTLY)
- **EASY**: Exactly 1 blank per problem
- **MEDIUM**: Exactly 2 blanks per problem
- **HARD**: Exactly 3 blanks per problem
- Mark blanks using the format [blank_1], [blank_2], [blank_3], etc.

### 3. BLANK PLACEMENT
- Place blanks strategically at KEY TERMS or CONCEPTS (not trivial words)
- Don't blank out articles (a, an, the) or prepositions unless testing those specifically
- Space blanks out - don't put them right next to each other

### 4. WORD BANK DESIGN (CRITICAL)
- Include ALL correct answers in the word bank
- Add 2-3 PLAUSIBLE DISTRACTORS (wrong answers that seem related)
- Distractors should be:
  * Related to the same topic/subject area
  * Similar part of speech as the correct answers
  * Tempting but clearly incorrect in context
- Total word bank size: (number of blanks) + 2 or 3 distractors

### 5. CASE SENSITIVITY
- Usually set caseSensitive to false (most forgiving for students)
- Only use caseSensitive: true when testing proper nouns or when case genuinely matters

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fillInBlanksSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'fill_in_blanks' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      textWithBlanks: problem.textWithBlanks,
      blanks: problem.blanks,
      wordBank: problem.wordBank,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria,
      ...(extractInset(problem, insetType) ? { inset: extractInset(problem, insetType) } : {}),
    }));

    console.log('Fill in Blanks Generated from dedicated service:', {
      topic,
      count: problems.length,
      hasInsets: problems.some((p: any) => p.inset),
    });

    return problems;
  } catch (error) {
    console.error("Fill in blanks problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// CATEGORIZATION PROBLEMS
// ============================================================================

/**
 * Generate categorization activity problems for KnowledgeCheck component
 */
export const generateCategorizationProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string,
  bloomsTier?: BloomsTier,
  insetType?: InsetType
): Promise<CategorizationActivityProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const categorizationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} categorization activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'cat_1', 'cat_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            instruction: {
              type: Type.STRING,
              description: "Clear instruction telling students what to categorize and how (e.g., 'Sort these words by part of speech')"
            },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-4 category names that items will be sorted into"
            },
            categorizationItems: {
              type: Type.ARRAY,
              description: "6-12 items to be categorized (should be balanced across categories)",
              items: {
                type: Type.OBJECT,
                properties: {
                  itemText: {
                    type: Type.STRING,
                    description: "The text/word/concept to be categorized"
                  },
                  correctCategory: {
                    type: Type.STRING,
                    description: "The category this item belongs to (must match one of the categories exactly)"
                  }
                },
                required: ["itemText", "correctCategory"]
              }
            },
            rationale: {
              type: Type.STRING,
              description: "Educational explanation of the categorization logic, common patterns, and why items belong in their categories (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, common categorization errors to watch for, or scaffolding suggestions (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "instruction", "categories", "categorizationItems", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  // Inject inset schema into each problem item when insetType is specified
  const catItemSchema = (categorizationSchema.properties as any).problems.items;
  injectInsetIntoSchema(catItemSchema, insetType);

  const bloomsPrompt = buildBloomsTierPrompt(bloomsTier);
  const insetPrompt = buildInsetPrompt(insetType);

  const prompt = `You are an expert educational assessment designer creating categorization activities for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}
${bloomsPrompt}${insetPrompt}
## Your Mission:
Create ${count} high-quality categorization activit${count > 1 ? 'ies' : 'y'} that effectively assess understanding of "${topic}".${insetType ? `\nEach problem MUST include an "inset" object with rich inline content (type: "${insetType}") that the activity directly references.` : ''}

## Quality Standards:

### 1. INSTRUCTION DESIGN
- Write clear, concise instructions that explain the categorization task
- Be specific about what attribute/characteristic determines the categories
- Use age-appropriate language
- Make the task unambiguous (students should know exactly what to do)

### 2. CATEGORY SELECTION
- Choose 2-4 distinct, well-defined categories
- Categories should be mutually exclusive (no overlap)
- Categories should be collectively exhaustive for the given items
- Use clear, recognizable category labels
- Ensure categories are appropriate for the grade level

### 3. ITEM SELECTION (6-12 items per problem)
- Choose items that clearly belong to one category
- Distribute items relatively evenly across categories (avoid having all items in one category)
- Include some items that might be tempting to miscategorize (to assess deeper understanding)
- Use items that are familiar to students at the target grade level
- Vary complexity within items (some obvious, some requiring more thought)
- Ensure each item has exactly ONE correct category

### 4. BALANCED DISTRIBUTION
- Aim for roughly equal numbers of items per category
- For 2 categories: 3-6 items each (6-12 total)
- For 3 categories: 2-4 items each (6-12 total)
- For 4 categories: 2-3 items each (8-12 total)

### 5. RATIONALE (Most Important!)
- Explain the logic behind the categorization system
- Highlight key distinguishing features of each category
- Address common categorization errors students might make
- Explain why tricky items belong where they do
- Use clear, educational language
- 2-3 sentences that genuinely teach the categorization skill

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: categorizationSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'categorization_activity' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      instruction: problem.instruction,
      categories: problem.categories,
      categorizationItems: problem.categorizationItems,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria,
      ...(extractInset(problem, insetType) ? { inset: extractInset(problem, insetType) } : {}),
    }));

    console.log('Categorization Generated from dedicated service:', {
      topic,
      count: problems.length,
      hasInsets: problems.some((p: any) => p.inset),
    });

    return problems;
  } catch (error) {
    console.error("Categorization problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// MATCHING PROBLEMS
// ============================================================================

/**
 * Generate matching activity problems for KnowledgeCheck component
 */
export const generateMatchingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string,
  bloomsTier?: BloomsTier,
  insetType?: InsetType
): Promise<MatchingActivityProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const matchingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} matching activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'match_1', 'match_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level - Easy: 3-4 matches, Medium: 5-6 matches, Hard: 7-8 matches"
            },
            prompt: {
              type: Type.STRING,
              description: "Clear instruction for the matching task (e.g., 'Match each scientist to their discovery', 'Connect each country with its capital')"
            },
            leftItems: {
              type: Type.ARRAY,
              description: "Items in the left column (3-8 items depending on difficulty). These are what students will select first.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Unique identifier (e.g., 'L1', 'L2', 'L3')"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The text to display"
                  }
                },
                required: ["id", "text"]
              }
            },
            rightItems: {
              type: Type.ARRAY,
              description: "Items in the right column (same count as leftItems). These are the matching targets.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Unique identifier (e.g., 'R1', 'R2', 'R3')"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The text to display"
                  }
                },
                required: ["id", "text"]
              }
            },
            mappings: {
              type: Type.ARRAY,
              description: "Correct mappings from left items to right items. Each left item maps to exactly one right item (1:1 relationship).",
              items: {
                type: Type.OBJECT,
                properties: {
                  leftId: {
                    type: Type.STRING,
                    description: "ID of the left item"
                  },
                  rightIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Array containing exactly ONE right item ID (use array format for consistency, but only include one ID)"
                  }
                },
                required: ["leftId", "rightIds"]
              }
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the relationships and why they're important (2-4 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip about the relationships, common confusions, or mnemonic devices (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "prompt", "leftItems", "rightItems", "mappings", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  // Inject inset schema into each problem item when insetType is specified
  const matchItemSchema = (matchingSchema.properties as any).problems.items;
  injectInsetIntoSchema(matchItemSchema, insetType);

  const bloomsPrompt = buildBloomsTierPrompt(bloomsTier);
  const insetPrompt = buildInsetPrompt(insetType);

  const prompt = `You are an expert educational assessment designer creating matching activities for knowledge checks.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}
${bloomsPrompt}${insetPrompt}
## Your Mission:
Create ${count} high-quality matching activity problem${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".${insetType ? `\nEach problem MUST include an "inset" object with rich inline content (type: "${insetType}") that the activity directly references.` : ''}

## Quality Standards:

### 1. PROMPT DESIGN
- Write a clear, specific instruction (e.g., "Match each scientist to their discovery")
- Make it obvious what kind of relationship to look for
- Use age-appropriate language
- Be specific about what's being matched

### 2. DIFFICULTY LEVELS (CRITICAL - FOLLOW EXACTLY)
- **EASY**: Exactly 3-4 matching pairs
- **MEDIUM**: Exactly 5-6 matching pairs
- **HARD**: Exactly 7-8 matching pairs
- More pairs = harder because there are more options to choose from

### 3. ITEM DESIGN (Left Column)
- Use clear, concise labels
- Keep items parallel in structure (all nouns, all people, all concepts, etc.)
- Make items distinct from each other
- Avoid overly similar items that would cause confusion
- Left items are typically the "key" items (e.g., scientists, countries, terms)

### 4. ITEM DESIGN (Right Column)
- Should match the grammatical structure needed for the relationship
- Keep parallel structure across all right items
- Make each right item clearly distinct
- Right items are typically the "values" (e.g., discoveries, capitals, definitions)

### 5. RELATIONSHIP DESIGN
- Create ONE-TO-ONE relationships (each left item matches to exactly ONE right item)
- Even though rightIds is an array, ONLY include ONE ID per mapping
- Ensure all relationships are factually correct and unambiguous
- Test important, meaningful relationships (not trivial connections)
- All left items must have a match (no unmatched items)
- All right items must have a match (no extra distractors)

### 6. RATIONALE (Most Important!)
- Explain the nature of the relationships
- Highlight why these connections matter
- Connect to broader concepts or patterns
- Address any potentially confusing pairs
- Use clear, educational language
- 2-4 sentences that genuinely teach

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: matchingSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'matching_activity' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      prompt: problem.prompt,
      leftItems: problem.leftItems,
      rightItems: problem.rightItems,
      mappings: problem.mappings,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria,
      ...(extractInset(problem, insetType) ? { inset: extractInset(problem, insetType) } : {}),
    }));

    console.log('Matching Generated from dedicated service:', {
      topic,
      count: problems.length,
      hasInsets: problems.some((p: any) => p.inset),
    });

    return problems;
  } catch (error) {
    console.error("Matching activity problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// SEQUENCING PROBLEMS
// ============================================================================

/**
 * Generate sequencing activity problems for KnowledgeCheck component
 */
export const generateSequencingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string,
  bloomsTier?: BloomsTier,
  insetType?: InsetType
): Promise<SequencingActivityProblemData[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  const sequencingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} sequencing activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'seq_1', 'seq_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            instruction: {
              type: Type.STRING,
              description: "Clear instruction telling students what to sequence and how (e.g., 'Arrange the life cycle stages of a butterfly in order')"
            },
            items: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4-8 items in the CORRECT ORDER. These will be shuffled when presented to students. Each item should be a clear, concise step or stage."
            },
            rationale: {
              type: Type.STRING,
              description: "Educational explanation of why this is the correct sequence, the logic or principle that determines the order (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, common sequencing errors students make, or scaffolding suggestions (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "instruction", "items", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  // Inject inset schema into each problem item when insetType is specified
  const seqItemSchema = (sequencingSchema.properties as any).problems.items;
  injectInsetIntoSchema(seqItemSchema, insetType);

  const bloomsPrompt = buildBloomsTierPrompt(bloomsTier);
  const insetPrompt = buildInsetPrompt(insetType);

  const prompt = `You are an expert educational assessment designer creating sequencing activities for a knowledge check.

TOPIC: ${topic}
TARGET AUDIENCE: ${gradeLevelContext}
${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}
NUMBER OF PROBLEMS: ${count}
${bloomsPrompt}${insetPrompt}
## Your Mission:
Create ${count} high-quality sequencing activit${count > 1 ? 'ies' : 'y'} that effectively assess understanding of "${topic}".${insetType ? `\nEach problem MUST include an "inset" object with rich inline content (type: "${insetType}") that the activity directly references.` : ''}

## Quality Standards:

### 1. INSTRUCTION DESIGN
- Write clear, concise instructions that explain what needs to be sequenced
- Be specific about the ordering principle (chronological, procedural, logical, etc.)
- Use age-appropriate language
- Make the task unambiguous (students should know exactly what to do)

### 2. ITEM SELECTION (4-8 items per problem)
- Choose items that have a clear, logical sequence
- Each item should be distinct and necessary for the sequence
- Items should be concise (1-2 short sentences or a brief phrase)
- Use parallel structure (all items formatted similarly)
- Ensure the sequence has ONE correct order (not multiple valid orderings)
- Avoid items that could logically go in multiple positions

### 3. SEQUENCE TYPES TO CONSIDER
- **Chronological**: Events in time order (historical events, life cycles, timelines)
- **Procedural**: Steps in a process (scientific method, recipe, instructions)
- **Logical**: Progression of ideas (simple to complex, cause to effect)
- **Developmental**: Stages of growth or development (life cycles, skill progression)
- **Narrative**: Story sequence (plot events, problem-solving steps)

### 4. DIFFICULTY PROGRESSION
- Easy: Obvious sequences with distinct stages (4-5 items)
- Medium: Familiar sequences requiring some thought (5-6 items)
- Hard: Complex sequences with subtle distinctions (6-8 items)

### 5. RATIONALE (Most Important!)
- Explain WHY this is the correct sequence
- Describe the principle or logic that determines the order
- Highlight key transitions or turning points in the sequence
- Address why certain items must come before or after others
- Use clear, educational language
- 2-3 sentences that genuinely teach the sequencing logic

## Key Insight:
The ITEMS array you provide must be in the CORRECT ORDER. The frontend will shuffle them for display, and students will drag them to recreate your correct sequence.

Now generate ${count} problem${count > 1 ? 's' : ''}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sequencingSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    const problems = data.problems.map((problem: any) => ({
      type: 'sequencing_activity' as const,
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      instruction: problem.instruction,
      items: problem.items,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria,
      ...(extractInset(problem, insetType) ? { inset: extractInset(problem, insetType) } : {}),
    }));

    console.log('Sequencing Generated from dedicated service:', {
      topic,
      count: problems.length,
      hasInsets: problems.some((p: any) => p.inset),
    });

    return problems;
  } catch (error) {
    console.error("Sequencing problem generation error:", error);
    throw error;
  }
};

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

type GenFn = (topic: string, gradeLevel: string, count: number, context?: string, bloomsTier?: BloomsTier, insetType?: InsetType) => Promise<ProblemData[]>;

const GENERATOR_MAP: Record<string, GenFn> = {
  'multiple_choice': generateMultipleChoiceProblems,
  'true_false': generateTrueFalseProblems,
  'fill_in_blanks': generateFillInBlanksProblems,
  'matching_activity': generateMatchingProblems,
  'sequencing_activity': generateSequencingProblems,
  'categorization_activity': generateCategorizationProblems,
};

const VALID_GRADE_KEYS = new Set(['toddler', 'preschool', 'kindergarten', 'elementary', 'middle-school', 'high-school', 'undergraduate', 'graduate', 'phd']);

/**
 * Generate a single problem from an orchestrator plan item.
 * Each planned problem is dispatched to its per-type generator.
 */
async function generateFromPlan(
  plan: KnowledgeCheckPlan['problems'][0],
  topic: string,
  gradeLevel: string,
  bloomsTier?: BloomsTier,
): Promise<ProblemData | null> {
  const generator = GENERATOR_MAP[plan.problemType];
  if (!generator) {
    console.warn(`[KC Dispatch] No generator for type: ${plan.problemType}`);
    return null;
  }

  try {
    const results = await generator(
      topic,
      gradeLevel,
      1,
      plan.brief, // orchestrator brief becomes the context
      bloomsTier,
      plan.insetType || undefined,
    );
    return results[0] || null;
  } catch (err) {
    console.warn(`[KC Dispatch] Generator failed for ${plan.problemType}:`, err);
    return null;
  }
}

/**
 * Generate knowledge check problems — two modes:
 *
 * 1. **Orchestrated** (default): Orchestrator plans optimal problem type mix,
 *    insets, and difficulty progression. Parallel generators produce each problem.
 *    Triggered when `problemType` is omitted or `useOrchestrator` is true.
 *
 * 2. **Direct**: Caller specifies exact problemType — bypasses orchestrator.
 *    Used for backward compat (tester, legacy call sites).
 */
export const generateKnowledgeCheck = async (
  topic: string,
  gradeContext: string,
  config?: {
    problemType?: ProblemType;
    count?: number;
    difficulty?: string;
    context?: string;
    objectiveText?: string;
    bloomsTier?: BloomsTier;
    insetType?: InsetType;
    /** Force orchestrator even when problemType is set */
    useOrchestrator?: boolean;
  }
): Promise<ProblemData[]> => {
  const count = config?.count || 1;
  const context = config?.context || config?.objectiveText;
  const bloomsTier = config?.bloomsTier;
  const gradeLevel = VALID_GRADE_KEYS.has(gradeContext) ? gradeContext : 'elementary';

  // Orchestrated path: no explicit problemType, or caller opted in
  const useOrchestrator = config?.useOrchestrator || !config?.problemType;

  if (useOrchestrator) {
    console.log('[Knowledge Check] Orchestrated mode:', { topic, gradeLevel, count, bloomsTier });

    const plan = await runKnowledgeCheckOrchestrator(topic, gradeLevel, count, bloomsTier, context);

    // Stage 2: parallel generation from the plan
    const results = await Promise.all(
      plan.problems.map(p => generateFromPlan(p, topic, gradeLevel, bloomsTier))
    );

    const problems = results.filter((p): p is ProblemData => p !== null);

    if (problems.length === 0) {
      throw new Error('[Knowledge Check] All generators failed — no problems produced');
    }

    console.log(`[Knowledge Check] Orchestrated: ${problems.length}/${plan.problems.length} problems generated`);
    console.log(`  Arc: ${plan.assessmentArc}`);
    return problems;
  }

  // Direct path: caller specified exact problemType (backward compat)
  const problemType = config!.problemType!;
  const insetType = config?.insetType;

  console.log('[Knowledge Check] Direct mode:', { topic, gradeLevel, problemType, count, bloomsTier, insetType });

  const generator = GENERATOR_MAP[problemType];
  if (!generator) {
    throw new Error(`Unknown problem type: ${problemType}`);
  }

  const problems = await generator(topic, gradeLevel, count, context, bloomsTier, insetType);
  console.log(`[Knowledge Check] Direct: ${problems.length} ${problemType} problem(s) generated`);
  return problems;
};

// Export for backward compatibility (geminiService.ts may still reference these)
export {
  generateMultipleChoiceProblems as generateMultipleChoice,
  generateTrueFalseProblems as generateTrueFalse,
  generateFillInBlanksProblems as generateFillInBlanks,
  generateCategorizationProblems as generateCategorization,
  generateMatchingProblems as generateMatching,
  generateSequencingProblems as generateSequencing,
};
