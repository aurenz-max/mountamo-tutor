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
import { CURRICULUM_SUBJECT_IDS } from '../../types';
import type {
  KnowledgeCheckPlan,
  KnowledgeCheckProblemPlan,
  ProblemType,
  InsetType,
  ProblemDifficulty,
  KnowledgeCheckVisualType,
} from '../../types';
import type { BloomsTier } from './gemini-knowledge-check';

// ============================================================================
// Orchestrator Schema
// ============================================================================

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: {
      type: Type.STRING,
      enum: [...CURRICULUM_SUBJECT_IDS],
      description: 'The single closest curriculum subject this assessment tests. Judge from the actual question content, not the primitive type. Pick the best fit even when the topic is cross-cutting.',
    },
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
          visualType: {
            type: Type.STRING,
            nullable: true,
            description: 'Picture evidence rendered above the problem, or null. Use object-collection for map symbols/coins/picture keys; comparison-panel for before/after or side-by-side pictures. Visual problems MUST use multiple_choice.',
          },
          brief: {
            type: Type.STRING,
            description: 'Detailed content brief for the generator. Specify: what concept to test, what angle/misconception to target, and what the inset or visual should show (if any). Must be self-contained — the generator sees only this brief.',
          },
          cognitiveNote: {
            type: Type.STRING,
            description: 'Why this problem type, difficulty, and inset were chosen for this position in the sequence',
          },
          objectiveId: {
            type: Type.STRING,
            nullable: true,
            description: 'The id of the SINGLE lesson objective this problem primarily assesses (from the Lesson Objectives list), or null if no objectives were provided',
          },
        },
        required: ['index', 'problemType', 'difficulty', 'insetType', 'visualType', 'brief', 'cognitiveNote', 'objectiveId'],
      },
    },
  },
  required: ['subject', 'assessmentArc', 'problems'],
};

// ============================================================================
// Orchestrator Prompt
// ============================================================================

/** Lesson objective the KC can attribute problems to. */
export interface KcLessonObjective {
  id: string;
  text: string;
  subskillId?: string;
  skillId?: string;
  grade?: string;
}

const VISUAL_TASK_RE = /\b(map|symbol|legend|picture|image|visual|coin|shape|color|diagram|invention|before[- /]?after|look at|shown)\b/i;

function combinedTaskText(
  topic: string,
  context?: string,
  objectives?: KcLessonObjective[],
): string {
  return [topic, context, ...(objectives ?? []).map((o) => o.text)]
    .filter(Boolean)
    .join(' ');
}

/** A visual gate needs evidence from the objective/intent, never a topic-specific
 *  hardcode. This catches the two census shapes (map symbols; promised pictures)
 *  and the same modality class for coins/shapes/diagrams. */
export function requiresVisualSupport(
  topic: string,
  context?: string,
  objectives?: KcLessonObjective[],
): boolean {
  return VISUAL_TASK_RE.test(combinedTaskText(topic, context, objectives));
}

function preferredVisualType(taskText: string): KnowledgeCheckVisualType {
  return /\b(before|after|change|compare|difference|invention)\b/i.test(taskText)
    ? 'comparison-panel'
    : 'object-collection';
}

/** Enforce schema-backed picture evidence per visual problem. Nonvisual siblings
 *  keep their planned types, preserving mixed-set diversity. */
export function applyVisualTaskPolicy(
  problems: KnowledgeCheckProblemPlan[],
  options: { required: boolean; taskText: string },
): void {
  if (options.required) {
    for (const problem of problems) {
      // A text-column match is the exact failure shape for Grade-1 map symbols
      // and picture-supported before/after tasks. Give that individual item
      // visible evidence even when another sibling already has a visual.
      if (problem.problemType === 'matching_activity' && !problem.visualType) {
        problem.visualType = preferredVisualType(options.taskText);
        problem.brief = `${problem.brief} Replace the text-column match with one picture-based choice about the visibly rendered evidence.`;
      }
    }
  }

  for (const problem of problems) {
    if (!problem.visualType) continue;
    // Only MCQ currently has the bounded visual response schema. Coerce the
    // individual problem, never the whole set.
    problem.problemType = 'multiple_choice';
    problem.insetType = null;
  }

  if (!options.required || problems.some((p) => p.visualType)) return;

  const target = problems.find((p) => p.problemType === 'multiple_choice') ?? problems[0];
  if (!target) return;
  target.problemType = 'multiple_choice';
  target.insetType = null;
  target.visualType = preferredVisualType(options.taskText);
  target.brief = `${target.brief} Render the picture evidence itself using a ${target.visualType}; ask about what is visibly shown, never a prose description of the picture.`;
}

function audienceLabel(gradeLevel: string, preciseGrade?: string): string {
  if (preciseGrade === 'K') return 'kindergarten';
  if (preciseGrade && /^\d{1,2}$/.test(preciseGrade)) return `Grade ${preciseGrade}`;
  return gradeLevel;
}

function buildOrchestratorPrompt(
  topic: string,
  gradeLevel: string,
  count: number,
  bloomsTier?: BloomsTier,
  context?: string,
  objectives?: KcLessonObjective[],
  preciseGrade?: string,
): string {
  const audience = audienceLabel(gradeLevel, preciseGrade);
  const gradeOne = preciseGrade === '1';
  const visualRequired = gradeOne && requiresVisualSupport(topic, context, objectives);
  const tierGuidance = bloomsTier
    ? getTierGuidance(bloomsTier)
    : `No specific cognitive tier requested. Use your judgment to create a progression from easier to harder.`;

  return `You are an expert assessment designer. Plan a ${count}-problem knowledge check on "${topic}" for ${audience} students.

Your job is to decide the optimal MIX of problem types and rich inline content (insets) that will best assess this topic at this level. You are NOT generating the problems — you are planning them. A separate generator will produce each problem from your brief.

## GRADE-LEVEL FIT (HARD CONSTRAINT — overrides the cognitive tier below)
Every problem must be readable and doable by a ${audience} student. This governs BOTH:
- **Reading level**: vocabulary, sentence length, and phrasing must match ${audience}. Do NOT use adult or technical words a student at this grade would not know.
- **Structural + cognitive load**: scenario complexity, number of concepts per problem, and options-per-problem must fit ${audience}. For early grades (toddler/preschool/kindergarten/elementary): concrete, familiar contexts; ONE concept per problem; short sentences; 3–4 options maximum.
When the requested cognitive tier and the grade band conflict, the GRADE WINS — express the tier's thinking with grade-appropriate words and a context a student at this grade can actually reason about (a "which is better?" judgment a young child can make), never by raising the reading level.
${gradeOne ? `
### PRECISE GRADE 1 / EMERGING READER PROFILE
The broad band is elementary, but the exact learner is Grade 1. Plan for an emerging reader:
- one short sentence or instruction at a time; no multi-clause scenario;
- one concept and one reasoning move per problem;
- MCQ/true-false stem at most 16 words; option/distractor text at most 5 words;
- matching: exactly 3 pairs with 1-3 words per side;
- categorization: 2 categories and 4-6 short items;
- sequencing: 3-4 brief steps; fill-in: one blank and a 3-4 word bank.
Keep analyze/evaluate as the KIND of thinking (compare a visible before/after, choose the better reason), not longer reading.
` : ''}

First, set "subject" to the single closest curriculum subject this assessment tests — one of MATHEMATICS, LANGUAGE_ARTS, SCIENCE, SOCIAL_STUDIES. Judge from the actual content being assessed, not the assessment format. Pick the best fit even when the topic is cross-cutting.

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

## Available Visual Types (Picture Evidence)
Visuals render ABOVE the question using existing component renderers. They are NOT prose prompts:
- **object-collection**: exactly 3 visible emoji objects/groups. Use for map symbols and keys, coins, shapes, or picture identification.
- **comparison-panel**: exactly 2 labeled emoji scenes. Use for before/after, change over time, or side-by-side comparison.
- **null**: the task does not require picture evidence.
A visual problem MUST use multiple_choice, set insetType to null, and describe the exact visible objects/scenes in its brief. The question must require inspecting the rendered visual.
${visualRequired ? `
### VISUAL EVIDENCE REQUIRED FOR THIS GRADE-1 TASK
The objective/intent explicitly depends on pictures or visual symbols. At least ONE planned problem MUST set visualType to object-collection or comparison-panel. Do not turn the picture into text such as "a green tree icon". Render the symbol/picture and ask about IT.
` : ''}

## Cognitive Level
${tierGuidance}

The cognitive tier sets the KIND of thinking, expressed WITHIN the ${audience} band — "hard" means hard FOR THIS GRADE, never adult-level vocabulary or scenarios. The GRADE-LEVEL FIT constraint above overrides the tier whenever they conflict.

${context ? `## Additional Context\n${context}\n` : ''}
${objectives && objectives.length > 0 ? `## Lesson Objectives (tag every problem)
This assessment covers these lesson objectives:
${objectives.map(o => `- ${o.id}: "${o.text}"`).join('\n')}
Set each problem's "objectiveId" to the id of the SINGLE objective it primarily assesses. Spread coverage — every objective should be assessed at least once when the problem count allows.
` : ''}
## Rules
1. **Diversity**: Use at least 2 different problem types for sets of 3+, at least 3 different types for sets of 5+. Don't default to all multiple choice.
2. **Evidence fit**: Use visualType when the assessed evidence is a picture/symbol/coin/shape/before-after scene. Use insetType for equations, passages, tables, charts, code, or number lines. Never set both on one problem. Generic topics may need neither.
3. **Difficulty progression**: Sequence from easier to harder within the set. First problem should be accessible, last should challenge.
4. **Brief quality**: Each brief must be detailed enough that a separate AI can generate the problem without seeing the other problems. Include: what concept to test, what angle, what the inset/visual should show, what misconceptions to target.
5. **Topic and grade in every brief**: Always mention "${topic}" and "${audience}" context in the brief, AND state the grade-appropriate reading level and option count (3–4 for early grades) so generators stay on-target and in-band.
6. **Evidence-problem coherence**: When using an inset or visual, the brief must describe both the evidence content AND the question — they are generated together as one unit.

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

const VALID_VISUAL_TYPES = new Set<string>(['object-collection', 'comparison-panel']);

const VALID_DIFFICULTIES = new Set<string>(['easy', 'medium', 'hard']);

const VALID_SUBJECTS = new Set<string>(CURRICULUM_SUBJECT_IDS);

export async function runKnowledgeCheckOrchestrator(
  topic: string,
  gradeLevel: string,
  count: number,
  bloomsTier?: BloomsTier,
  context?: string,
  objectives?: KcLessonObjective[],
  preciseGrade?: string,
): Promise<KnowledgeCheckPlan> {
  const prompt = buildOrchestratorPrompt(
    topic, gradeLevel, count, bloomsTier, context, objectives, preciseGrade,
  );

  console.log('[KC Orchestrator] Planning assessment:', {
    topic, gradeLevel, preciseGrade, count, bloomsTier,
  });

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
  const providedObjectiveIds = new Set((objectives ?? []).map(o => o.id));
  const validProblems: KnowledgeCheckProblemPlan[] = [];
  for (const p of raw.problems || []) {
    if (!VALID_PROBLEM_TYPES.has(p.problemType)) {
      console.warn(`[KC Orchestrator] Skipping unknown problem type: ${p.problemType}`);
      continue;
    }
    if (!VALID_DIFFICULTIES.has(p.difficulty)) {
      p.difficulty = 'medium';
    }

    // Keep the objectiveId only when it names a provided objective — a
    // hallucinated id must not attribute evidence to the wrong subskill.
    validProblems.push({
      index: validProblems.length,
      problemType: p.problemType as ProblemType,
      difficulty: p.difficulty as ProblemDifficulty,
      insetType: p.insetType && VALID_INSET_TYPES.has(p.insetType)
        ? (p.insetType as InsetType)
        : null,
      // 14f is a precise Grade-1 fork. Other bands retain their existing
      // inset/text planning until their own consumer evidence asks for visuals.
      visualType: preciseGrade === '1' && p.visualType && VALID_VISUAL_TYPES.has(p.visualType)
        ? (p.visualType as KnowledgeCheckVisualType)
        : null,
      brief: p.brief || `Generate a ${p.problemType} problem about "${topic}" for ${gradeLevel} students.`,
      cognitiveNote: p.cognitiveNote || '',
      objectiveId:
        typeof p.objectiveId === 'string' && providedObjectiveIds.has(p.objectiveId)
          ? p.objectiveId
          : null,
    });
  }

  if (validProblems.length === 0) {
    throw new Error('[KC Orchestrator] Produced no valid problems');
  }

  const taskText = combinedTaskText(topic, context, objectives);
  applyVisualTaskPolicy(validProblems, {
    required: preciseGrade === '1' && requiresVisualSupport(topic, context, objectives),
    taskText,
  });

  // Warn if count mismatch but don't fail
  if (validProblems.length !== count) {
    console.warn(`[KC Orchestrator] Requested ${count} problems, got ${validProblems.length}`);
  }

  // Subject is the KC's own content guess (primitive-level signal). Keep only a valid
  // subject_id; drop anything off-enum so attribution falls back to the manifest subject.
  const subject = typeof raw.subject === 'string' && VALID_SUBJECTS.has(raw.subject)
    ? raw.subject
    : undefined;

  const plan: KnowledgeCheckPlan = {
    assessmentArc: raw.assessmentArc || '',
    problems: validProblems,
    subject,
  };

  console.log('[KC Orchestrator] Plan:', {
    arc: plan.assessmentArc,
    problems: plan.problems.map(p => ({
      type: p.problemType,
      difficulty: p.difficulty,
      inset: p.insetType || 'none',
      visual: p.visualType || 'none',
      objective: p.objectiveId || 'untagged',
    })),
  });

  return plan;
}
