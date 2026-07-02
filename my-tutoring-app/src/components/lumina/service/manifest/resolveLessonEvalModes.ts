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
 * SINGLE | BLEND | MIXED — the resolver does NOT collapse every slot to one
 * skill. Many primitives were DESIGNED for "auto" / mixed practice (they cycle
 * their skills with increasing difficulty); others want exactly one skill when
 * that is what the objective asks. So each slot's pick is a LIST of the slot's
 * candidate mode keys:
 *   - one key            → single skill   (config.targetEvalMode = "<key>")
 *   - a 2+ subset        → curated blend  (config.targetEvalMode = "a|b")
 *   - ALL candidate keys → broad mixed    (config.targetEvalMode = "mixed")
 * The downstream generator's resolveEvalModes() already honors all three via the
 * same targetEvalMode channel with NO extra LLM call ("mixed" / unknown → open
 * schema; "a|b" → union of those modes), so this needs zero generator edits.
 *
 * SIBLING CONTEXT — each slot is shown the OTHER components in its objective so
 * the model can divide labor across the objective's primitive set (anchor the
 * canonical skill on one, a contrasting model on another, reserve mixed for the
 * synthesis/summative slot) instead of independently picking the single best-fit
 * mode for each in isolation.
 *
 * It runs as ONE batched flash call (same tier as the manifest), AFTER the
 * manifest is parsed and BEFORE the layout is flattened, so the resolved pins
 * propagate to every consumer through config.targetEvalMode. It is strictly
 * NON-REGRESSING: any slot it cannot resolve (omitted, or all-invalid keys)
 * keeps the manifest's existing pin, and a failed call leaves the manifest
 * untouched.
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

const MODEL = 'gemini-flash-lite-latest'; // lighter/faster tier for this batched pick

// Hard ceiling on the single batched resolution call. This stage is strictly an
// ENHANCEMENT over the curator's inline pins, so a slow/stalled Gemini response
// must never hold the whole lesson hostage — on timeout we abort the request and
// fall through to the existing failure path (keep curator pins). Same contract as
// the studentContext fetches, which also cap their network calls.
const RESOLUTION_TIMEOUT_MS = 20000;

/** A component object we may mutate in place (its .config.targetEvalMode). */
interface MutableComponent {
  componentId: string;
  intent?: string;
  config?: Record<string, unknown>;
}

interface Sibling {
  componentId: string;
  intent: string;
}

interface Slot {
  slotId: string;
  component: MutableComponent; // live reference into the manifest — mutated in place
  objectiveText: string;
  objectiveVerb: string;
  intent: string;
  candidateKeys: string[];
  candidateModes: { key: string; label: string; description: string }[];
  siblings: Sibling[]; // other components under the SAME objective (for labor division)
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
    const blockComponents = block.components ?? [];
    for (const component of blockComponents) {
      const modes = getComponentById(component.componentId)?.evalModes ?? [];
      if (modes.length < 2) continue; // only multi-mode primitives have a choice to make
      // Siblings: every OTHER component under this objective, so the model can
      // see how the objective's primitive set already divides the skill.
      const siblings: Sibling[] = blockComponents
        .filter((c) => c !== component)
        .map((c) => ({ componentId: c.componentId, intent: (c.intent ?? '').slice(0, 120) }));
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
        siblings,
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
        siblings: [], // its objectiveText already spans the whole lesson
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
            chosenModes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "The subset of THIS slot's candidate mode keys whose SKILL the objective + intent needs. " +
                'ONE key = single skill. ALL of the slot\'s candidate keys = broad mixed / "auto" practice ' +
                '(use when the primitive should cycle its skills with no single one emphasized). ' +
                'A 2+ subset (fewer than all) = curated blend. Every entry MUST be one of the slot\'s candidate keys.',
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
    .map((s) => {
      const siblingText = s.siblings.length
        ? `\n  other components in this SAME objective (already covering part of it):\n${s.siblings
            .map((sib) => `    • ${sib.componentId}${sib.intent ? `: "${sib.intent}"` : ''}`)
            .join('\n')}`
        : '';
      return `SLOT ${s.slotId}\n  objective (${s.objectiveVerb}): "${s.objectiveText}"\n  component: ${s.component.componentId}\n  intent: "${s.intent}"\n  candidate modes (each a DISTINCT skill):\n${s.candidateModes
        .map((m) => `    - ${m.key} (${m.label}): ${m.description}`)
        .join('\n')}${siblingText}`;
    })
    .join('\n\n');

  return `You are selecting the eval mode(s) (the SKILL a component teaches) for each slot in ONE lesson on "${topic}" (${gradeLevel}).

Each eval mode is a DISTINCT skill — NOT a difficulty level. For each slot, return the LIST of candidate mode keys whose skill the objective + intent actually asks the student to do:
- ONE key when the objective points at a single skill and you want focused practice of it.
- ALL of the slot's candidate keys when the component is meant for broad / mixed practice — the primitive cycling through its skills with rising difficulty, with no single skill emphasized. Summative or "compare strategies / put it all together" intents usually want this.
- A subset of 2+ (but not all) when the intent genuinely spans a few specific skills.

Rules, in priority order:
1. Match by skill and content only. Never pick by lesson position, phase, or "introducing the tool".
2. For a SINGLE pick, do not over-reach: choose the simplest mode that fully covers the objective's skill — a higher-tier mode teaches a different, harder skill the objective did not ask for. Mixed is NOT a way to dodge this: only go mixed when no single skill is the point.
3. Use the sibling components to DIVIDE LABOR across the objective. If other components already anchor the core skill, this slot can take a contrasting skill or the mixed/synthesis role rather than duplicating them. Per-slot fit (rules 1-2) still wins over forced variety.

SLOTS:
${slotText}

Return exactly one pick per slot. Every key in chosenModes MUST be one of that slot's candidate mode keys.`;
}

export interface EvalModeResolutionSummary {
  slots: number;
  changed: number; // pins the dedicated call changed from the curator's
  kept: number; // pins left as the curator set them (unresolved / all-invalid)
  mixed: number; // slots resolved to broad mixed practice
  blend: number; // slots resolved to a curated 2+ blend
}

/**
 * Encode a validated key list into the config.targetEvalMode channel the
 * generators already read:
 *   - all candidate keys → 'mixed' (open schema, broad practice)
 *   - one key            → '<key>' (single skill)
 *   - a 2+ subset        → 'a|b'   (curated blend; resolveEvalModes splits on '|')
 * Catalog order is preserved for the blend case so the pin is deterministic.
 */
function encodePin(validKeys: string[], allKeys: string[]): { pin: string; kind: 'single' | 'blend' | 'mixed' } {
  if (validKeys.length >= allKeys.length) return { pin: 'mixed', kind: 'mixed' };
  if (validKeys.length === 1) return { pin: validKeys[0], kind: 'single' };
  const ordered = allKeys.filter((k) => validKeys.includes(k));
  return { pin: ordered.join('|'), kind: 'blend' };
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
  if (slots.length === 0) {
    console.log(`[resolveLessonEvalModes] no multi-mode slots for "${topic}" (${gradeLevel}) — nothing to resolve`);
    return { slots: 0, changed: 0, kept: 0, mixed: 0, blend: 0 };
  }

  console.log(
    `🎚️ [resolveLessonEvalModes] resolving ${slots.length} multi-mode slot(s) for "${topic}" (${gradeLevel}):\n` +
      slots
        .map(
          (s) =>
            `  ${s.slotId} · ${s.component.componentId} (${s.objectiveVerb}: "${s.objectiveText.slice(0, 80)}")\n` +
            `     curator pin: ${s.currentPin ?? '∅'}\n` +
            `     candidates: ${s.candidateKeys.join(', ')}` +
            (s.siblings.length ? `\n     siblings: ${s.siblings.map((sib) => sib.componentId).join(', ')}` : ''),
        )
        .join('\n'),
  );

  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(topic, gradeLevel, slots),
      config: {
        responseMimeType: 'application/json',
        responseSchema: buildSchema(),
        temperature: 0.3,
        abortSignal: abort.signal,
      },
    });
    // Cap the call: if Gemini stalls, abort it and reject so the catch below
    // restores the curator pins instead of blocking the lesson indefinitely.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new Error(`eval-mode resolution timed out after ${RESOLUTION_TIMEOUT_MS}ms`));
      }, RESOLUTION_TIMEOUT_MS);
    });
    const result = await Promise.race([request, timeout]);
    const parsed = result.text
      ? (JSON.parse(result.text) as {
          picks?: Array<{ slotId: string; chosenModes?: string[]; rationale?: string }>;
        })
      : null;
    const bySlot = new Map((parsed?.picks ?? []).map((p) => [p.slotId, p.chosenModes ?? []]));
    const rationaleBySlot = new Map((parsed?.picks ?? []).map((p) => [p.slotId, p.rationale ?? '']));

    if (!parsed?.picks?.length) {
      console.warn('[resolveLessonEvalModes] LLM returned no picks — all slots will keep curator pins');
    } else {
      console.log(
        `🎚️ [resolveLessonEvalModes] LLM picks:\n` +
          parsed.picks
            .map(
              (p) =>
                `  ${p.slotId} → [${(p.chosenModes ?? []).join(', ') || '∅'}]` +
                (p.rationale ? `  — ${p.rationale}` : ''),
            )
            .join('\n'),
      );
    }

    let changed = 0;
    let kept = 0;
    let mixed = 0;
    let blend = 0;
    for (const slot of slots) {
      const raw = bySlot.get(slot.slotId);
      // Post-validate against the catalog: keep only real modes for this primitive,
      // de-duped, in catalog order.
      const valid = raw
        ? slot.candidateKeys.filter((k) => raw.includes(k))
        : [];

      if (valid.length === 0) {
        kept++; // slot omitted or all-invalid → curator's pin stands (non-regressing)
        const reason = raw === undefined ? 'slot omitted by LLM' : `no valid keys in [${raw.join(', ')}]`;
        console.log(
          `  🎚️ ${slot.slotId} · ${slot.component.componentId}: KEPT curator pin "${slot.currentPin ?? '∅'}" (${reason})`,
        );
        continue;
      }

      const { pin, kind } = encodePin(valid, slot.candidateKeys);
      if (!slot.component.config) slot.component.config = {};
      slot.component.config.targetEvalMode = pin;
      if (kind === 'mixed') mixed++;
      else if (kind === 'blend') blend++;
      const didChange = pin !== slot.currentPin;
      if (didChange) changed++;
      else kept++;
      const rationale = rationaleBySlot.get(slot.slotId);
      console.log(
        `  🎚️ ${slot.slotId} · ${slot.component.componentId}: ` +
          `${didChange ? `CHANGED "${slot.currentPin ?? '∅'}" → "${pin}"` : `confirmed "${pin}"`} ` +
          `[${kind}]` +
          (rationale ? ` — ${rationale}` : ''),
      );
    }

    console.log(
      `[resolveLessonEvalModes] ${slots.length} multi-mode slot(s) → ${changed} changed, ${kept} kept ` +
        `(${mixed} mixed, ${blend} blend, ${slots.length - mixed - blend} single-or-kept)`,
    );
    return { slots: slots.length, changed, kept, mixed, blend };
  } catch (err) {
    console.warn('[resolveLessonEvalModes] resolution failed — keeping curator pins:', err);
    return { slots: slots.length, changed: 0, kept: slots.length, mixed: 0, blend: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
