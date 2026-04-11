/**
 * Knowledge Check Orchestrator — Stage 1 of the two-stage KC pipeline
 *
 * Like the DeepDive orchestrator, this lightweight Gemini call plans the
 * optimal assessment: which problem types to use, which get insets, difficulty
 * progression, and per-problem content briefs. Stage 2 (parallel generators)
 * then produces each problem concurrently.
 *
 * The manifest no longer decides problem types — the orchestrator owns that.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  KnowledgeCheckPlan,
  KnowledgeCheckProblemPlan,
  ProblemType,
  InsetType,
  ProblemDifficulty,
} from '../../types';
import type { BloomsTier } from './gemini-knowledge-check';

// ============================================================================
// Orchestrator Schema
// ============================================================================

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    assessmentArc: {
      type: Type.STRING,
      description: '1-2 sentence narrative of the cognitive journey (e.g. "Start with recall of key terms, build to applying formulas, finish with analyzing edge cases")',
    },
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.NUMBER, description: 'Ordinal position (0-based)' },
          problemType: {
            type: Type.STRING,
            description: 'One of: multiple_choice, true_false, fill_in_blanks, matching_activity, sequencing_activity, categorization_activity',
          },
          difficulty: {
            type: Type.STRING,
            description: 'One of: easy, medium, hard',
          },
          insetType: {
            type: Type.STRING,
            nullable: true,
            description: 'Inset to attach, or null for plain text. One of: katex, data-table, passage, chart, code, number-line, definition-box, or null',
          },
          brief: {
            type: Type.STRING,
            description: 'Detailed content brief for the generator. Specify: what concept to test, what angle/misconception to target, what the inset should show (if any). Must be self-contained — the generator sees only this brief.',
          },
          cognitiveNote: {
            type: Type.STRING,
            description: 'Why this problem type, difficulty, and inset were chosen for this position in the sequence',
          },
        },
        required: ['index', 'problemType', 'difficulty', 'insetType', 'brief', 'cognitiveNote'],
      },
    },
  },
  required: ['assessmentArc', 'problems'],
};

// ============================================================================
// Orchestrator Prompt
// ============================================================================

function buildOrchestratorPrompt(
  topic: string,
  gradeLevel: string,
  count: number,
  bloomsTier?: BloomsTier,
  context?: string,
): string {
  const tierGuidance = bloomsTier
    ? getTierGuidance(bloomsTier)
    : `No specific cognitive tier requested. Use your judgment to create a progression from easier to harder.`;

  return `You are an expert assessment designer. Plan a ${count}-problem knowledge check on "${topic}" for ${gradeLevel} students.

Your job is to decide the optimal MIX of problem types and rich inline content (insets) that will best assess this topic at this level. You are NOT generating the problems — you are planning them. A separate generator will produce each problem from your brief.

## Available Problem Types
- **multiple_choice**: 4-5 options, one correct. Best for: conceptual understanding, application, analysis. The workhorse — but don't over-rely on it.
- **true_false**: Declarative statement, student judges truth. Best for: testing misconceptions, verifying factual recall. Use sparingly (max 1-2 per set).
- **fill_in_blanks**: Sentence with blanked key terms + word bank. Best for: vocabulary, precise terminology, procedural steps. Good for recall-level assessment.
- **matching_activity**: Two columns, student matches pairs. Best for: definitions↔terms, cause↔effect, concept↔example. Great for showing breadth of knowledge.
- **sequencing_activity**: Items to arrange in correct order. Best for: processes, timelines, procedures, ranked lists. Tests structural understanding.
- **categorization_activity**: Items sorted into 2-3 categories. Best for: classification, grouping by property, distinguishing types. Tests organizational thinking.

## Available Inset Types (Rich Inline Content)
Insets are rendered ABOVE the problem and make the question richer. Only use when the topic genuinely benefits — not every problem needs one.

- **katex**: LaTeX mathematical expression. Use for: math, physics, chemistry equations, formulas, expressions. The question must require reading the expression.
- **data-table**: Structured table with headers and rows. Use for: statistics, comparisons, experimental data, reference tables. Question must require reading the table.
- **passage**: Text passage (prose, poem, quote, letter, source). Use for: reading comprehension, literary analysis, primary sources, historical documents.
- **chart**: Bar/line/pie chart visualization. Use for: data interpretation, trends, proportions, comparisons. Question must require interpreting the chart.
- **code**: Source code snippet. Use for: programming, algorithms, debugging, code tracing. Question must require reading the code.
- **number-line**: Visual number line with points. Use for: number sense, fractions, decimals, inequalities, ordering.
- **definition-box**: Vocabulary term with definition and example. Use for: vocabulary assessment, terminology, word meaning in context.
- **null**: No inset — plain text problem. Perfectly fine for many topics. Don't force insets where they don't add value.

## Cognitive Level
${tierGuidance}

${context ? `## Additional Context\n${context}\n` : ''}
## Rules
1. **Diversity**: Use at least 2 different problem types for sets of 3+, at least 3 different types for sets of 5+. Don't default to all multiple choice.
2. **Inset fit**: Only attach an inset when it genuinely enhances the problem. Math topics should get katex. Reading/history should get passages. Data topics should get tables or charts. Generic topics may not need any insets.
3. **Difficulty progression**: Sequence from easier to harder within the set. First problem should be accessible, last should challenge.
4. **Brief quality**: Each brief must be detailed enough that a separate AI can generate the problem without seeing the other problems. Include: what concept to test, what angle, what the inset should show, what misconceptions to target.
5. **Topic and grade in every brief**: Always mention "${topic}" and "${gradeLevel}" context in the brief so generators stay on-target.
6. **Inset-problem coherence**: When using an inset, the brief must describe both the inset content AND the question — they are generated together as one unit.

Plan the ${count} problems now.`;
}

function getTierGuidance(tier: BloomsTier): string {
  switch (tier) {
    case 'recall':
      return `**Cognitive Level: RECALL (Bloom's Tier 1)**
Problems should test direct recall of facts, definitions, and simple recognition.
Favor: fill_in_blanks, true_false, matching_activity, simple multiple_choice.
Insets: definition-box, simple katex, basic data-table.
Difficulty: mostly easy, some medium.`;
    case 'apply':
      return `**Cognitive Level: APPLY (Bloom's Tier 2)**
Problems should require USING a concept, rule, or procedure to solve a concrete problem.
Favor: multiple_choice with scenarios, fill_in_blanks with procedural steps, sequencing_activity.
Insets: katex (formulas to apply), data-table (data to interpret), code (to trace).
Difficulty: mostly medium, some easy warm-up.`;
    case 'analyze':
      return `**Cognitive Level: ANALYZE (Bloom's Tier 3)**
Problems should require analysis, comparison, or multi-step reasoning.
Favor: multiple_choice with plausible distractors, categorization_activity, matching_activity (cause↔effect).
Insets: passage (for literary/historical analysis), chart (for trend analysis), data-table (for cross-referencing).
Difficulty: mostly medium-hard, build from medium.`;
    case 'evaluate':
      return `**Cognitive Level: EVALUATE (Bloom's Tier 4)**
Problems should require judgment between competing approaches or synthesis of multiple concepts.
Favor: multiple_choice with 5 highly plausible options, scenario-based problems.
Insets: passage (competing arguments), chart (nuanced data), code (design trade-offs).
Difficulty: mostly hard, one medium warm-up.`;
    default:
      return '';
  }
}

// ============================================================================
// Run Orchestrator
// ============================================================================

const VALID_PROBLEM_TYPES = new Set<string>([
  'multiple_choice', 'true_false', 'fill_in_blanks',
  'matching_activity', 'sequencing_activity', 'categorization_activity',
]);

const VALID_INSET_TYPES = new Set<string>([
  'katex', 'data-table', 'passage', 'chart', 'code', 'number-line', 'definition-box',
]);

const VALID_DIFFICULTIES = new Set<string>(['easy', 'medium', 'hard']);

export async function runKnowledgeCheckOrchestrator(
  topic: string,
  gradeLevel: string,
  count: number,
  bloomsTier?: BloomsTier,
  context?: string,
): Promise<KnowledgeCheckPlan> {
  const prompt = buildOrchestratorPrompt(topic, gradeLevel, count, bloomsTier, context);

  console.log('[KC Orchestrator] Planning assessment:', { topic, gradeLevel, count, bloomsTier });

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: ORCHESTRATOR_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('[KC Orchestrator] Empty response');

  const raw = JSON.parse(text);

  // Validate and filter to known types
  const validProblems: KnowledgeCheckProblemPlan[] = [];
  for (const p of raw.problems || []) {
    if (!VALID_PROBLEM_TYPES.has(p.problemType)) {
      console.warn(`[KC Orchestrator] Skipping unknown problem type: ${p.problemType}`);
      continue;
    }
    if (!VALID_DIFFICULTIES.has(p.difficulty)) {
      p.difficulty = 'medium';
    }

    validProblems.push({
      index: validProblems.length,
      problemType: p.problemType as ProblemType,
      difficulty: p.difficulty as ProblemDifficulty,
      insetType: p.insetType && VALID_INSET_TYPES.has(p.insetType)
        ? (p.insetType as InsetType)
        : null,
      brief: p.brief || `Generate a ${p.problemType} problem about "${topic}" for ${gradeLevel} students.`,
      cognitiveNote: p.cognitiveNote || '',
    });
  }

  if (validProblems.length === 0) {
    throw new Error('[KC Orchestrator] Produced no valid problems');
  }

  // Warn if count mismatch but don't fail
  if (validProblems.length !== count) {
    console.warn(`[KC Orchestrator] Requested ${count} problems, got ${validProblems.length}`);
  }

  const plan: KnowledgeCheckPlan = {
    assessmentArc: raw.assessmentArc || '',
    problems: validProblems,
  };

  console.log('[KC Orchestrator] Plan:', {
    arc: plan.assessmentArc,
    problems: plan.problems.map(p => ({
      type: p.problemType,
      difficulty: p.difficulty,
      inset: p.insetType || 'none',
    })),
  });

  return plan;
}
