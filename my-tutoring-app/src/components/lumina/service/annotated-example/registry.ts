/**
 * Primitive Registry — single source of truth for the annotated-example
 * primitive catalog.
 *
 * To add a new primitive:
 *   1. Add the type to `StepContent` in primitives/annotated-example/types.ts
 *   2. Add a new file under `generators/<type>.ts` exporting a `PrimitiveDef`
 *   3. Register it here
 *
 * The planner reads `whenToUse` from this registry rather than hardcoding
 * descriptions in its prompt. The orchestrator looks up `generate` and
 * `extractResult` here at render time.
 */

import type { StepType, StepContent } from '../../primitives/annotated-example/types';
import type { PrimitiveDef, GeneratedStep, StepGeneratorContext } from './generators/_shared';
import { algebraPrimitive } from './generators/algebra';
import { tablePrimitive } from './generators/table';
import { diagramPrimitive } from './generators/diagram';
import { graphSketchPrimitive } from './generators/graph-sketch';
import { caseSplitPrimitive } from './generators/case-split';

export const PRIMITIVE_REGISTRY: Record<StepType, PrimitiveDef> = {
  algebra: algebraPrimitive,
  table: tablePrimitive,
  diagram: diagramPrimitive,
  'graph-sketch': graphSketchPrimitive,
  'case-split': caseSplitPrimitive,
};

/** All registered step types, in catalog order. */
export const REGISTERED_STEP_TYPES: StepType[] = Object.keys(PRIMITIVE_REGISTRY) as StepType[];

/**
 * Catalog formatted for prompt injection — one bullet per primitive with its
 * `whenToUse` description. Use in the planner prompt so adding a new
 * primitive only touches the registry.
 */
export function formatCatalogForPrompt(): string {
  return REGISTERED_STEP_TYPES.map((id) => `- **${id}** — ${PRIMITIVE_REGISTRY[id].whenToUse}`).join('\n');
}

/**
 * Run a primitive's generator. Falls back to `algebra` if the requested type is
 * not registered (defensive — shouldn't happen given registry-driven prompts).
 */
export async function generateStep(
  stepType: StepType,
  ctx: StepGeneratorContext,
): Promise<GeneratedStep | null> {
  const def = PRIMITIVE_REGISTRY[stepType] ?? PRIMITIVE_REGISTRY.algebra;
  if (!PRIMITIVE_REGISTRY[stepType]) {
    console.warn(`[AnnotatedExample] Unknown step type: ${stepType}, falling back to algebra`);
  }
  try {
    return await def.generate(ctx);
  } catch (error) {
    console.error(`[AnnotatedExample] Failed to generate ${stepType} step:`, error);
    return null;
  }
}

export function extractStepResult(stepType: StepType, content: StepContent, explicitResult?: string): string {
  const def = PRIMITIVE_REGISTRY[stepType] ?? PRIMITIVE_REGISTRY.algebra;
  return def.extractResult(content, explicitResult);
}
