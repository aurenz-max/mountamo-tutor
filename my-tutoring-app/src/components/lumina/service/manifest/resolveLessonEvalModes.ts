/**
 * Dedicated eval-mode resolution stage (post-manifest, pre-hydration).
 *
 * WHY THIS EXISTS — replaces the manifest's INLINE per-component eval-mode pick
 * as the authoritative selector. An ablation (qa/topic-traces/evalmode-pin-
 * health-2026-06-13.md + the eval-mode ablation study) showed the manifest pins
 * a *valid* mode ~95-98% of the time, but a dedicated call that sees the whole
 * lesson at once and carries a focused instruction picks a *better* mode on ~25%
 * of slots (judged better on ~80% of disagreements, 7:2 at the lesson level).
 * One batched call also closes the validity tail (it post-validates and never
 * emits an absent/hallucinated mode) and relieves the manifest of eval-mode
 * cognitive load.
 *
 * It runs as ONE batched flash call (same tier as the manifest), AFTER the
 * manifest is parsed and BEFORE the layout is flattened, so the resolved pins
 * propagate to every consumer through config.targetEvalMode. It is strictly
 * NON-REGRESSING: any slot it cannot improve keeps the manifest's existing pin,
 * and a failed call leaves the manifest untouched.
 *
 * NOTE: the manifest still emits an inline config.targetEvalMode; that is now a
 * FALLBACK, not the source of truth. Stripping the eval-mode prose from the
 * manifest prompt (to reclaim its cognitive-load budget) is a measured Phase 2 —
 * see the ablation report's "study (ii)".
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { getComponentById } from './catalog';
import type { ExhibitManifest } from '../../types';

const MODEL = 'gemini-3-flash-preview'; // same tier as the manifest

/** A component object we may mutate in place (its .config.targetEvalMode). */
interface MutableComponent {
  componentId: string;
  intent?: string;
  config?: Record<string, unknown>;
}

interface Slot {
  slotId: string;
  component: MutableComponent; // live reference into the manifest — mutated in place
  objectiveText: string;
  objectiveVerb: string;
  intent: string;
  candidateKeys: string[];
  candidateModes: { key: string; label: string; description: string }[];
  currentPin: string | null;
}

function collectSlots(
  manifest: ExhibitManifest,
  objectives?: Array<{ id: string; text: string; verb: string }>,
): Slot[] {
  const objById = new Map((objectives ?? []).map((o) => [o.id, o]));
  const slots: Slot[] = [];
  let n = 0;

  const blocks = (manifest.objectiveBlocks ?? []) as unknown as Array<{
    objectiveId: string;
    objectiveText: string;
    objectiveVerb: string;
    components: MutableComponent[];
  }>;

  for (const block of blocks) {
    const auth = objById.get(block.objectiveId);
    const objectiveText = auth?.text ?? block.objectiveText;
    const objectiveVerb = auth?.verb ?? block.objectiveVerb;
    for (const component of block.components ?? []) {
      const modes = getComponentById(component.componentId)?.evalModes ?? [];
      if (modes.length < 2) continue; // only multi-mode primitives have a choice to make
      slots.push({
        slotId: `s${n++}`,
        component,
        objectiveText,
        objectiveVerb,
        intent: component.intent ?? '',
        candidateKeys: modes.map((m) => m.evalMode),
        candidateModes: modes.map((m) => ({
          key: m.evalMode,
          label: m.label,
          description: (m.description ?? '').slice(0, 160),
        })),
        currentPin: (component.config?.targetEvalMode as string | undefined) ?? null,
      });
    }
  }

  // Final assessment spans the whole lesson — resolve it too if it's multi-mode.
  const fa = manifest.finalAssessment as unknown as MutableComponent | undefined;
  if (fa) {
    const modes = getComponentById(fa.componentId)?.evalModes ?? [];
    if (modes.length >= 2) {
      const lessonObjective = blocks.map((b) => b.objectiveText).filter(Boolean).join('; ');
      slots.push({
        slotId: `s${n++}`,
        component: fa,
        objectiveText: `Summative assessment across the lesson's objectives: ${lessonObjective}`,
        objectiveVerb: 'evaluate',
        intent: fa.intent ?? '',
        candidateKeys: modes.map((m) => m.evalMode),
        candidateModes: modes.map((m) => ({
          key: m.evalMode,
          label: m.label,
          description: (m.description ?? '').slice(0, 160),
        })),
        currentPin: (fa.config?.targetEvalMode as string | undefined) ?? null,
      });
    }
  }

  return slots;
}

function buildSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      picks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            slotId: { type: Type.STRING },
            chosenMode: { type: Type.STRING, description: "Exactly one mode key from that slot's candidate list." },
            rationale: { type: Type.STRING },
          },
          required: ['slotId', 'chosenMode'],
        },
      },
    },
    required: ['picks'],
  };
}

function buildPrompt(topic: string, gradeLevel: string, slots: Slot[]): string {
  const slotText = slots
    .map(
      (s) =>
        `SLOT ${s.slotId}\n  objective (${s.objectiveVerb}): "${s.objectiveText}"\n  component: ${s.component.componentId}\n  intent: "${s.intent}"\n  candidate modes (each a DISTINCT skill):\n${s.candidateModes
          .map((m) => `    - ${m.key} (${m.label}): ${m.description}`)
          .join('\n')}`,
    )
    .join('\n\n');

  return `You are selecting the single best eval mode (the SKILL a component teaches) for each slot in ONE lesson on "${topic}" (${gradeLevel}).

Each eval mode is a DISTINCT skill — NOT a difficulty level. For each slot, choose the ONE mode whose skill the objective + intent actually asks the student to do. Rules, in priority order:
1. Match by skill and content only. Never pick by lesson position, phase, or "introducing the tool".
2. Do NOT over-reach. Pick the mode that matches what the objective asks — never a more advanced one. The SIMPLEST mode that fully covers the objective's skill is correct; a higher-tier mode teaches a different, harder skill the objective did not ask for.
3. Seeing the whole lesson at once, prefer a coherent VARIETY of modes across slots where the objectives genuinely differ — but per-slot fit (rules 1-2) ALWAYS wins over variety.

SLOTS:
${slotText}

Return exactly one pick per slot. chosenMode MUST be one of that slot's candidate mode keys.`;
}

export interface EvalModeResolutionSummary {
  slots: number;
  changed: number; // pins the dedicated call improved over the curator's
  kept: number; // pins left as the curator set them (agreement or unresolved)
}

/**
 * Resolve eval modes for every multi-mode component in the manifest and write
 * the result into each component's config.targetEvalMode (in place). Returns a
 * summary. Non-regressing and failure-safe: unresolved/invalid slots and any
 * error leave the curator's inline pin intact.
 */
export async function resolveLessonEvalModes(
  manifest: ExhibitManifest,
  topic: string,
  gradeLevel: string,
  objectives?: Array<{ id: string; text: string; verb: string }>,
): Promise<EvalModeResolutionSummary> {
  const slots = collectSlots(manifest, objectives);
  if (slots.length === 0) return { slots: 0, changed: 0, kept: 0 };

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(topic, gradeLevel, slots),
      config: { responseMimeType: 'application/json', responseSchema: buildSchema(), temperature: 0.3 },
    });
    const parsed = result.text
      ? (JSON.parse(result.text) as { picks?: Array<{ slotId: string; chosenMode: string }> })
      : null;
    const bySlot = new Map((parsed?.picks ?? []).map((p) => [p.slotId, p.chosenMode]));

    let changed = 0;
    let kept = 0;
    for (const slot of slots) {
      const pick = bySlot.get(slot.slotId);
      // Post-validate against the catalog: only accept a real mode for this primitive.
      if (pick && slot.candidateKeys.includes(pick)) {
        if (!slot.component.config) slot.component.config = {};
        slot.component.config.targetEvalMode = pick;
        if (pick !== slot.currentPin) changed++;
        else kept++;
      } else {
        kept++; // unresolved/invalid → curator's pin stands (non-regressing)
      }
    }

    console.log(
      `[resolveLessonEvalModes] ${slots.length} multi-mode slot(s) → ${changed} improved, ${kept} kept (curator pin)`,
    );
    return { slots: slots.length, changed, kept };
  } catch (err) {
    console.warn('[resolveLessonEvalModes] resolution failed — keeping curator pins:', err);
    return { slots: slots.length, changed: 0, kept: slots.length };
  }
}
