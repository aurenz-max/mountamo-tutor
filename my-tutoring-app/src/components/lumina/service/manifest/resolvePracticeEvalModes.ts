/**
 * Dedicated eval-mode resolution stage for the PRACTICE path (post-manifest,
 * pre-hydration). The practice-mode sibling of resolveLessonEvalModes.
 *
 * WHY THIS EXISTS — testing showed the same quality loss the lesson path hit:
 * when ONE call picks the visual primitive AND encodes its eval mode (the task
 * type baked into the free-text intent), the mode signal is corrupted by the
 * primitive-selection pressure. Worse, the practice generators then re-derived
 * the mode per-item, in isolation (resolveEvalModes step 3), with no whole-
 * session view. This stage replaces that with ONE batched call that sees every
 * visual item at once, so it can pick the right task type per problem AND keep
 * the session's task types varied.
 *
 * WHAT IT DOES — for each item whose visual primitive is MULTI-MODE, it pins
 * item.visualPrimitive.targetEvalMode using the same single | 'a|b' | 'mixed'
 * encoding the generators already read via config.targetEvalMode. The hydrator
 * forwards that pin, so the generator short-circuits with NO per-item LLM call
 * (resolveEvalModes step 1). Net: N per-item micro-calls → 1 batched call.
 *
 * PRACTICE BIAS — each item is ONE problem the student solves once, so the
 * default is a SINGLE mode. 'mixed' is reserved for a primitive deliberately
 * cycling its task types within one activity; it is rarely right here.
 *
 * NON-REGRESSING — any item it cannot resolve (omitted, all-invalid keys) is
 * left unpinned, and a failed call leaves the manifest untouched; in both cases
 * the generator falls back to its own intent-based resolution (legacy behavior).
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { getComponentById } from './catalog';
import type { PracticeManifest } from '../../types';

const MODEL = 'gemini-3-flash-preview'; // same tier as the manifest

interface Slot {
  slotId: string;
  index: number; // index into manifest.items — the live reference we mutate
  componentId: string;
  problemText: string;
  intent: string;
  candidateKeys: string[];
  candidateModes: { key: string; label: string; description: string }[];
  currentPin: string | null;
}

function collectSlots(manifest: PracticeManifest): Slot[] {
  const slots: Slot[] = [];
  let n = 0;
  for (let i = 0; i < manifest.items.length; i++) {
    const item = manifest.items[i];
    const vp = item.visualPrimitive;
    if (!vp) continue; // standard problems carry their own Bloom-tier evalMode
    const modes = getComponentById(vp.componentId)?.evalModes ?? [];
    if (modes.length < 2) continue; // single-mode primitives have no choice to make
    slots.push({
      slotId: `p${n++}`,
      index: i,
      componentId: vp.componentId,
      problemText: item.problemText,
      intent: vp.intent ?? '',
      candidateKeys: modes.map((m) => m.evalMode),
      candidateModes: modes.map((m) => ({
        key: m.evalMode,
        label: m.label,
        description: (m.description ?? '').slice(0, 160),
      })),
      currentPin: vp.targetEvalMode ?? null,
    });
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
            chosenModes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "The subset of THIS slot's candidate mode keys whose SKILL this single problem requires. " +
                'Normally exactly ONE key (one problem tests one task type). Return 2+ keys only when the ' +
                "problem genuinely requires more than one task type. Every entry MUST be one of the slot's candidate keys.",
            },
            rationale: { type: Type.STRING },
          },
          required: ['slotId', 'chosenModes'],
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
        `SLOT ${s.slotId}\n  problem: "${s.problemText}"\n  primitive: ${s.componentId}\n  intent: "${s.intent}"\n  candidate modes (each a DISTINCT skill / task type):\n${s.candidateModes
          .map((m) => `    - ${m.key} (${m.label}): ${m.description}`)
          .join('\n')}`,
    )
    .join('\n\n');

  return `You are selecting the eval mode (the SKILL / task type a visual primitive evaluates) for each item in ONE practice session on "${topic}" (${gradeLevel}).

Each eval mode is a DISTINCT skill, NOT a difficulty level. Each item below is ONE problem the student solves once.

For each slot, return the candidate mode key(s) whose skill THIS problem actually asks the student to do:
- Normally exactly ONE key — a single problem tests a single task type. This is the default.
- Return 2+ keys ONLY when the problem genuinely requires more than one task type in sequence.

Rules, in priority order:
1. Match by skill and content only — what the problem makes the student DO. Never pick by difficulty or by item position.
2. Choose the simplest mode that fully covers the problem's task. A higher-tier mode is a different, harder skill the problem did not ask for.
3. Across the session, prefer VARIETY where it fits: if two problems could each take the same mode, but one fits a different mode equally well, diversify so the student practices distinct task types. Per-item fit (rules 1-2) still wins over forced variety.

SLOTS:
${slotText}

Return exactly one pick per slot. Every key in chosenModes MUST be one of that slot's candidate mode keys.`;
}

export interface PracticeEvalModeSummary {
  slots: number;
  changed: number;
  kept: number;
  blend: number;
}

/**
 * all candidate keys → 'mixed' (open schema); one key → '<key>'; 2+ subset →
 * 'a|b' (generators split on '|'). Catalog order preserved for determinism.
 */
function encodePin(validKeys: string[], allKeys: string[]): { pin: string; kind: 'single' | 'blend' | 'mixed' } {
  if (validKeys.length >= allKeys.length) return { pin: 'mixed', kind: 'mixed' };
  if (validKeys.length === 1) return { pin: validKeys[0], kind: 'single' };
  const ordered = allKeys.filter((k) => validKeys.includes(k));
  return { pin: ordered.join('|'), kind: 'blend' };
}

/**
 * Resolve eval modes for every multi-mode visual primitive in a practice
 * manifest and write the result into item.visualPrimitive.targetEvalMode (in
 * place). Non-regressing and failure-safe.
 */
export async function resolvePracticeEvalModes(
  manifest: PracticeManifest,
  topic: string,
  gradeLevel: string,
): Promise<PracticeEvalModeSummary> {
  const slots = collectSlots(manifest);
  if (slots.length === 0) return { slots: 0, changed: 0, kept: 0, blend: 0 };

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(topic, gradeLevel, slots),
      config: { responseMimeType: 'application/json', responseSchema: buildSchema(), temperature: 0.3 },
    });
    const parsed = result.text
      ? (JSON.parse(result.text) as { picks?: Array<{ slotId: string; chosenModes?: string[] }> })
      : null;
    const bySlot = new Map((parsed?.picks ?? []).map((p) => [p.slotId, p.chosenModes ?? []]));

    let changed = 0;
    let kept = 0;
    let blend = 0;
    for (const slot of slots) {
      const raw = bySlot.get(slot.slotId);
      // Post-validate against the catalog: keep only real modes for this primitive.
      const valid = raw ? slot.candidateKeys.filter((k) => raw.includes(k)) : [];
      if (valid.length === 0) {
        kept++; // omitted or all-invalid → left unpinned (generator resolves its own)
        continue;
      }
      const { pin, kind } = encodePin(valid, slot.candidateKeys);
      const vp = manifest.items[slot.index].visualPrimitive;
      if (!vp) continue; // defensive: item changed out from under us
      vp.targetEvalMode = pin;
      if (kind === 'blend') blend++;
      if (pin !== slot.currentPin) changed++;
      else kept++;
    }

    console.log(
      `[resolvePracticeEvalModes] ${slots.length} multi-mode visual(s) → ${changed} pinned, ${kept} kept (${blend} blend)`,
    );
    return { slots: slots.length, changed, kept, blend };
  } catch (err) {
    console.warn('[resolvePracticeEvalModes] resolution failed — leaving visuals unpinned:', err);
    return { slots: slots.length, changed: 0, kept: slots.length, blend: 0 };
  }
}
