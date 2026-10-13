/**
 * Pulse eval-mode handoff (WORKSTREAMS 7.5) — the engine's difficulty reaches
 * the primitive the manifest chose, without the engine naming a primitive.
 *
 * Two layers, two owners:
 *   1. WHICH modes fit (LLM): for each visual item, one batched call returns
 *      every mode of the manifest's chosen primitive whose skill the subskill
 *      asks for. Modes are task identities, not difficulty steps.
 *   2. HOW hard (code): among the fitting modes, pin the one whose catalog β is
 *      nearest the engine's target_beta. A gap over MISMATCH_BETA is logged;
 *      the fitting mode is still served, never swapped for a non-fitting one.
 *
 * Failure-safe: an item the call cannot resolve stays unpinned, so its
 * generator self-resolves by content. There is no fallback that picks by β
 * across all modes — that is the defect this stage exists to prevent.
 */

import { Type, Schema, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import { getComponentById } from './catalog';
import type { PracticeManifest } from '../../types';

// Flash, not flash-lite: lite accepted neighbouring skills as fits (build a
// number for "add 43 + 5"), which is the defect this stage exists to stop.
const MODEL = 'gemini-flash-latest';
const RESOLUTION_TIMEOUT_MS = 20000;
/** Same 1.0-β step the densify skill holds adjacent modes to. */
export const MISMATCH_BETA = 1.0;

export interface PulseModeItemInput {
  item_id: string;
  description: string;
  target_beta: number;
}

export interface PulseModePick {
  instanceId: string;
  componentId: string;
  fitting: string[];
  pin: string | null;
  pinBeta: number | null;
  targetBeta: number;
  /** pinBeta − targetBeta; null when unpinned. */
  deltaBeta: number | null;
  /** no-fit: the call answered and no mode of this component fits the subskill. */
  source: 'single-mode' | 'resolved' | 'unresolved' | 'no-fit';
  mismatch: boolean;
}

/** Among the fitting modes, the one whose β is nearest the target (ties → lower β). */
export function pickNearestBeta(
  modes: ReadonlyArray<{ evalMode: string; beta: number }>,
  fitting: readonly string[],
  targetBeta: number,
): { key: string; beta: number } | null {
  let best: { key: string; beta: number } | null = null;
  for (const m of modes) {
    if (!fitting.includes(m.evalMode)) continue;
    const d = Math.abs(m.beta - targetBeta);
    if (!best || d < Math.abs(best.beta - targetBeta) || (d === Math.abs(best.beta - targetBeta) && m.beta < best.beta)) {
      best = { key: m.evalMode, beta: m.beta };
    }
  }
  return best;
}

interface Slot {
  slotId: string;
  index: number;
  componentId: string;
  subskill: string;
  intent: string;
  modes: { evalMode: string; label: string; description?: string; beta: number }[];
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    picks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slotId: { type: Type.STRING },
          fittingModes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "EVERY candidate mode key whose skill the subskill asks the student to do. Each MUST be one of the slot's candidate keys.",
          },
        },
        required: ['slotId', 'fittingModes'],
      },
    },
  },
  required: ['picks'],
};

function buildPrompt(gradeLevel: string, slots: Slot[]): string {
  const slotText = slots
    .map((s) => `SLOT ${s.slotId}\n  subskill: "${s.subskill}"\n  component: ${s.componentId}\n  intent: "${s.intent}"\n  candidate modes (each a DISTINCT skill):\n${s.modes
      .map((m) => `    - ${m.evalMode} (${m.label}): ${(m.description ?? '').slice(0, 160)}`)
      .join('\n')}`)
    .join('\n\n');
  return `Each slot is one practice item (${gradeLevel}) for one curriculum subskill, on a component already chosen.
Each eval mode is a DISTINCT skill, not a difficulty level. For each slot, return EVERY candidate mode whose task IS the subskill: a student doing that mode's task is doing exactly what the subskill names.
- Judge by skill and content only. Difficulty is chosen afterwards by code, so do not narrow by how hard a mode is.
- Leave out modes that practise a neighbouring skill, a prerequisite, or one part of it: building or counting a number does not fit a subskill about adding, and counting on does not fit a subskill about finding a group of ten.
- Leave out a mode when this component cannot show the numbers the subskill names (objects to count cannot show 43 + 5), or when the mode contradicts a constraint the subskill states (a mode built on regrouping does not fit "without regrouping").
- If no mode fits, return an empty list.

SLOTS:
${slotText}

Return exactly one pick per slot.`;
}

/**
 * Pin config.targetEvalMode on each visual item (in place) and return one pick
 * per visual item for logging and QA.
 */
export async function resolvePulseEvalModes(
  manifest: PracticeManifest,
  items: PulseModeItemInput[],
  gradeLevel: string,
): Promise<PulseModePick[]> {
  const picks: PulseModePick[] = [];
  const slots: Slot[] = [];

  const finish = (index: number, componentId: string, fitting: string[], source: PulseModePick['source']) => {
    const visual = manifest.items[index].visualPrimitive!;
    const modes = getComponentById(componentId)?.evalModes ?? [];
    const target = items[index].target_beta;
    const best = source === 'unresolved' ? null : pickNearestBeta(modes, fitting, target);
    if (best) visual.targetEvalMode = best.key;
    else delete visual.targetEvalMode;
    const delta = best ? best.beta - target : null;
    picks.push({
      instanceId: manifest.items[index].instanceId,
      componentId,
      fitting,
      pin: best?.key ?? null,
      pinBeta: best?.beta ?? null,
      targetBeta: target,
      deltaBeta: delta,
      source: best ? source : source === 'no-fit' ? 'no-fit' : 'unresolved',
      mismatch: delta !== null && Math.abs(delta) > MISMATCH_BETA,
    });
  };

  manifest.items.forEach((mi, index) => {
    const visual = mi.visualPrimitive;
    if (!visual || index >= items.length) return;
    const modes = getComponentById(visual.componentId)?.evalModes ?? [];
    if (modes.length === 0) return; // primitive has no modes: nothing to pin
    if (modes.length === 1) {
      finish(index, visual.componentId, [modes[0].evalMode], 'single-mode');
      return;
    }
    slots.push({
      slotId: `s${slots.length}`,
      index,
      componentId: visual.componentId,
      subskill: items[index].description,
      intent: visual.intent ?? '',
      modes,
    });
  });

  if (slots.length > 0) {
    let bySlot = new Map<string, string[]>();
    let answered = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = ai.models.generateContent({
        model: MODEL,
        contents: buildPrompt(gradeLevel, slots),
        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2, abortSignal: abort.signal,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
      });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { abort.abort(); reject(new Error(`timed out after ${RESOLUTION_TIMEOUT_MS}ms`)); }, RESOLUTION_TIMEOUT_MS);
      });
      const result = await Promise.race([request, timeout]);
      const parsed = result.text ? (JSON.parse(result.text) as { picks?: Array<{ slotId: string; fittingModes?: string[] }> }) : null;
      bySlot = new Map((parsed?.picks ?? []).map((p) => [p.slotId, p.fittingModes ?? []]));
      answered = !!parsed?.picks;
    } catch (err) {
      console.warn('[resolvePulseEvalModes] fit call failed — items stay unpinned (generator self-resolves):', err);
    } finally {
      if (timer) clearTimeout(timer);
    }
    for (const slot of slots) {
      const raw = bySlot.get(slot.slotId) ?? [];
      const fitting = slot.modes.map((m) => m.evalMode).filter((k) => raw.includes(k));
      finish(slot.index, slot.componentId, fitting,
        fitting.length ? 'resolved' : answered && bySlot.has(slot.slotId) ? 'no-fit' : 'unresolved');
    }
  }

  for (const p of picks) {
    const d = p.deltaBeta === null ? '' : ` Δβ=${p.deltaBeta >= 0 ? '+' : ''}${p.deltaBeta.toFixed(1)}`;
    const line = `[Pulse] mode ${p.instanceId} ${p.componentId}: fitting [${p.fitting.join(', ') || '∅'}] → ${p.pin ?? 'unpinned'} (target β ${p.targetBeta.toFixed(1)}${d}, ${p.source})`;
    if (p.mismatch) console.warn(`${line} MISMATCH: no fitting mode within ${MISMATCH_BETA} β`);
    else console.log(line);
  }
  return picks;
}
