/**
 * Shared utilities for per-primitive step generators.
 *
 * Each primitive generator lives in its own file and registers via registry.ts.
 * This module owns the inputs every generator needs (problem context, prior
 * step summaries) and the annotation schema appended to every step's response.
 */

import { Type, Schema } from '@google/genai';
import type { StepAnnotations } from '../../../primitives/annotated-example/types';

// ── Generator input context ──────────────────────────────────────────

export interface StepGeneratorContext {
  topic: string;
  gradeContext: string;
  /** Full problem statement for context */
  problemStatement: string;
  /** Solution strategy for context */
  solutionStrategy: string;
  /** Summaries of prior completed steps */
  priorStepSummaries: string[];
  /** Planner-supplied: what this step teaches (drives annotation focus). */
  pedagogicalGoal: string;
  /** Planner-supplied: concrete instruction on what to extract or construct. */
  seedNotes: string;
  /**
   * Joined prose from the solver blocks that ground this step. Empty string
   * when the step is planner-injected (no solver block to back it). In the
   * injected case, the generator must build from seedNotes alone.
   */
  groundingProse: string;
}

export function buildStepContextPrefix(ctx: StepGeneratorContext): string {
  const parts: string[] = [];

  parts.push(`PROBLEM: ${ctx.problemStatement}`);
  parts.push(`STRATEGY: ${ctx.solutionStrategy}`);

  if (ctx.priorStepSummaries.length > 0) {
    parts.push(`PRIOR STEPS:\n${ctx.priorStepSummaries.map((s, i) => `  Step ${i}: ${s}`).join('\n')}`);
  }

  parts.push(`PEDAGOGICAL GOAL (what this step teaches): ${ctx.pedagogicalGoal}`);
  parts.push(`PLANNER SEED (what to extract/construct): ${ctx.seedNotes}`);

  if (ctx.groundingProse) {
    parts.push(`GROUNDING PROSE (from solver — your truth source for the math):\n${ctx.groundingProse}`);
  } else {
    parts.push(`GROUNDING PROSE: (none — this step was injected by the planner; build it from the seed notes and the problem statement)`);
  }

  return parts.join('\n\n');
}

// ── Shared annotations schema (appended to every step generator) ─────

export const ANNOTATIONS_SCHEMA_FIELDS: Record<string, Schema> = {
  annSteps: { type: Type.STRING, description: 'WHAT is happening procedurally — action, not reasoning' },
  annStrategy: { type: Type.STRING, description: 'WHY this choice — metacognitive, first person' },
  annMisconceptions: { type: Type.STRING, description: 'Specific common error at this step and why it is tempting' },
  annConnections: { type: Type.STRING, description: 'Link to broader concept, prior knowledge, or generalization' },
};

export const ANNOTATIONS_REQUIRED = ['annSteps', 'annStrategy', 'annMisconceptions', 'annConnections'];

export function annotationPromptSuffix(focus: string): string {
  return `

## Annotations (include all 4)
- annSteps: WHAT is happening (procedural, no "why")
- annStrategy: WHY this approach (metacognitive, first person, "I notice that...")
- annMisconceptions: A SPECIFIC common error here (not generic warnings)
- annConnections: How this links to a broader concept
Focus emphasis on: ${focus}`;
}

export function extractAnnotations(data: Record<string, unknown>): StepAnnotations {
  return {
    steps: (data.annSteps as string) || '',
    strategy: (data.annStrategy as string) || '',
    misconceptions: (data.annMisconceptions as string) || '',
    connections: (data.annConnections as string) || '',
  };
}

// ── PrimitiveDef — what each generator file exports ──────────────────

import type { StepContent, StepType } from '../../../primitives/annotated-example/types';

export interface GeneratedStep {
  content: StepContent;
  annotations: StepAnnotations;
  /** Optional explicit result expression (for types where it's not on the content itself). */
  result?: string;
}

export interface PrimitiveDef {
  id: StepType;
  /**
   * One-paragraph guidance fed into the planner prompt to decide when to pick
   * this primitive. Owned by the primitive — adding a new one just adds a
   * registry entry, no prompt edits elsewhere.
   */
  whenToUse: string;
  generate: (ctx: StepGeneratorContext) => Promise<GeneratedStep>;
  /** Extract the result expression from generated content (for dependency passing). */
  extractResult: (content: StepContent, explicitResult?: string) => string;
}
