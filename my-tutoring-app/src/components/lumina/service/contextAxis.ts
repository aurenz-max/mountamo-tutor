/**
 * contextAxis.ts — read what a lesson asked for along one content axis.
 *
 * Many generators keep a code-owned pool for content (themes, label pairs, object sets).
 * The pool is right for the skill the primitive was born for and wrong when the manifest
 * routes another skill to it: bar-model compared "Morning" with "Afternoon" for a lesson
 * about weather in two places. An axis lets the lesson supply that content while code
 * keeps owning correctness. Plan: docs/CONTEXT_AXES.md.
 *
 * CONTRACT (first proven by resolvePrepositionScope and resolveDeckRequest)
 * - One flash-lite call, temperature 0, schema-constrained. Never a regex over prose.
 * - Fires only when the scope carries objective or intent text; otherwise no call.
 * - The spec's validate() reports absence as absence, and the caller keeps its pool.
 * - Any failure returns null, so an outage is today's behavior.
 * - What the lesson asked for and the primitive cannot express is logged as an axis gap
 *   (qa/fit-gate/axis-gaps-*.jsonl), never faked. `scripts/axis-gap-report.mjs` ranks them.
 */

import type { Schema } from "@google/genai";
import { ai } from "./geminiClient";
import type { PedagogicalScope } from "./scopeContext";
import { appendAxisGap } from "./fitGate/fitLedger";

export interface AxisSpec<T> {
  /** `<primitive>.<axis>`, e.g. 'bar-model.dataset'. Keys the gap log. */
  id: string;
  /** Opens the prompt: "<activity> is being generated for a lesson." */
  activity: string;
  /** Label for the intent line. */
  intentLabel?: string;
  /** Field-by-field rules, appended after the lesson text. */
  instructions: string;
  schema: Schema;
  /** Parsed JSON to a value; null means the resolution failed. */
  validate(parsed: any): T | null;
  /** What the lesson asked for that this primitive cannot express. */
  gaps?(value: T): string[];
}

export async function resolveContextAxis<T>(
  spec: AxisSpec<T>,
  scope: PedagogicalScope,
  gradeLevel: string,
): Promise<T | null> {
  if (!scope.intent && !scope.objectiveText) return null;

  try {
    const prompt = `${spec.activity} is being generated for a lesson. Read what the lesson asked for.

TOPIC: "${scope.topic}"
${scope.objectiveText ? `LEARNING OBJECTIVE: "${scope.objectiveText}"\n` : ''}${scope.intent ? `${spec.intentLabel ?? "THIS ACTIVITY'S INTENT"}: "${scope.intent}"\n` : ''}GRADE: ${gradeLevel}

${spec.instructions}`;

    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { temperature: 0, responseMimeType: "application/json", responseSchema: spec.schema },
    });
    if (!result.text) return null;
    const value = spec.validate(JSON.parse(result.text));
    if (value === null) return null;

    const gaps = spec.gaps?.(value) ?? [];
    if (gaps.length) {
      console.log(`[contextAxis] ${spec.id} cannot express: ${gaps.join(', ')}`);
      appendAxisGap({ axis: spec.id, gaps, topic: scope.topic, objective: scope.objectiveText, grade: gradeLevel });
    }
    return value;
  } catch (e) {
    console.warn(`[contextAxis] ${spec.id} resolution failed:`, e);
    return null;
  }
}

/** Trim, drop empties and `exclude` members, dedupe case-insensitively, bound to `max`. */
export function cleanStringList(raw: unknown, max: number, exclude: readonly string[] = []): string[] {
  const seen = new Set<string>(exclude.map((w) => w.toLowerCase()));
  const out: string[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const s = typeof item === 'string' ? item.trim() : '';
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
