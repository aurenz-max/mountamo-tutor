/**
 * scopeRangeResolver.ts — Tier-2 scope resolver for CLASS-3 generators.
 *
 * WHY THIS EXISTS
 * ---------------
 * `buildScopePromptSection` (scopeContext.ts) binds intent for generators where the
 * LLM authors the student-facing values (CLASS-1). But many generators pick their
 * values in CODE — from a per-mode range table or pool — to avoid Gemini's structured-
 * output mode-collapse (CLASS-3: array-grid dims, circle radius, factor-tree roots, …).
 * For those, a prompt block changes nothing: the code never sees the intent's scope.
 *
 * This is the generalized form of gemini-number-line's `resolveTopicNumberRange`: one
 * tiny schema-constrained flash-lite call that turns the pedagogical scope's topic +
 * intent + objective into the `{min,max}` the code-owned band-picker needs.
 *
 * CONTRACT
 * - ONE flash-lite call, temperature 0. Only fires when the caller decides to (gate on
 *   the manifest field being absent + scope carrying intent/objective).
 * - The grade/primitive CEILING is law: the result is hard-clamped to it, so the resolver
 *   can only ever NARROW the band, never widen it past what the grade allows (pedagogy #1).
 * - Returns null on any parse/validation failure OR when there is nothing to resolve, so
 *   the caller's existing grade-band default stays in place → no regression.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "./geminiClient";
import type { PedagogicalScope } from "./scopeContext";

const rangeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    min: { type: Type.NUMBER, description: "Smallest value the student works with (usually the floor)." },
    max: { type: Type.NUMBER, description: "Largest value the student works with." },
  },
  required: ["min", "max"],
};

/**
 * Resolve the numeric band for a code-picked quantity from the lesson scope.
 *
 * @param scope    The pedagogical scope (topic + objective + intent).
 * @param gradeLevel  Grade-appropriate prose string (the CEILING).
 * @param quantity Plain-language name of what the range bounds, e.g.
 *                 "the array dimensions (rows and columns)", "the circle's radius",
 *                 "the whole number being factored". Drives the prompt.
 * @param ceiling  The grade/primitive hard cap. The result is clamped into this and can
 *                 never exceed it; pass the band the generator uses today.
 * @returns {min,max} narrowed to the lesson, or null (→ keep the existing default).
 */
export async function resolveScopeRange(
  scope: PedagogicalScope,
  gradeLevel: string,
  quantity: string,
  ceiling: { min: number; max: number },
): Promise<{ min: number; max: number } | null> {
  // Nothing component-specific to bind → keep the grade-band default (no call, no cost).
  if (!scope.intent && !scope.objectiveText) return null;
  try {
    const prompt = `A math activity needs the numeric range for ${quantity} inferred from what it teaches.

TOPIC: "${scope.topic}"
${scope.objectiveText ? `OBJECTIVE: "${scope.objectiveText}"\n` : ''}${scope.intent ? `INTENT: "${scope.intent}"\n` : ''}GRADE: ${gradeLevel}

Return the integer range for ${quantity} the student actually works with in THIS lesson.
- Read the topic/intent/objective for an explicit bound ("facts through 5" → max 5; "to 100" → max 100; "multiplying by 2 and 3" → max 3).
- The grade CEILING for ${quantity} is ${ceiling.min}..${ceiling.max} — NEVER return a max above ${ceiling.max} or a min below ${ceiling.min}.
- If the topic/intent/objective give no narrower bound, return the ceiling ${ceiling.min}..${ceiling.max} unchanged.`;
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { temperature: 0, responseMimeType: "application/json", responseSchema: rangeSchema },
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    let min = Math.round(Number(parsed?.min));
    let max = Math.round(Number(parsed?.max));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    // The resolver is advisory; the ceiling is law. Hard-clamp so it can only narrow.
    min = Math.max(ceiling.min, min);
    max = Math.min(ceiling.max, max);
    if (max <= min) return null;
    return { min, max };
  } catch (e) {
    console.warn(`[scopeRangeResolver] resolution failed for "${quantity}":`, e);
    return null;
  }
}
