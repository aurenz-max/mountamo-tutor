/**
 * knowledgeCheckPlan — the CODE-OWNED plan skeleton (KC redesign P3, 2026-09-05).
 *
 * WHY. Every knowledge check on disk was sized by a curator `count` (4 or 5)
 * over 2-3 objectives — 1.3–2.5 items per objective against a coverage judge
 * that needs ≥2 distinct items (`MIN_SUFFICIENT_ASSESSMENT_ITEMS`). The five
 * objectives whose only assessment surface was the KC failed 5/5. Within an
 * objective the plan was sized by a brief, so "the minus sign and the equals
 * sign" drew minus twice and equals never. Prompt pleas did not move it; the
 * structure belongs in code (`feedback_llm-window-code-builds-structure`).
 *
 * WHAT. Items = Σ over objectives of max(2, |named set|), one slot per named
 * element, capped by a per-band budget that drops GENERIC angles first and
 * never a named element. Each slot names its kind by the objective's VERB
 * (table below, not a prompt): the three pilot production kinds where a
 * K-capable stimulus exists, else a `legacy` slot the orchestrator briefs
 * (MC/TF at K). The manifest `count` becomes a hint the skeleton may exceed;
 * the delta is logged and returned.
 *
 * Bloom eval modes survive as difficulty WITHIN a kind, not as the kind.
 */

import type { ProductionKind } from '../../types';
import { namedSetFromObjective, type NamedSet, type NamedSetKind } from '../objectives/namedSet';

export interface KcPlanObjective {
  id: string;
  text: string;
  verb?: string;
  subskillId?: string;
  skillId?: string;
  grade?: string;
}

export type KcStimulusType = 'number-sentence' | 'arrangement' | 'glyph-card';

export interface KcProductionSlot {
  kind: 'production';
  objectiveId: string;
  productionKind: ProductionKind;
  stimulus: KcStimulusType;
  /** The named element this slot must touch ('−', 'm', 'triangle', '7'). */
  element?: string;
  elementKind?: NamedSetKind;
  /** Generic-angle ordinal within the objective (0-based). Named-element slots
   *  are angle 0 by construction — they are never dropped. */
  angle: number;
  /** Subtraction context: arrangement items show a take-away. */
  takeAway?: boolean;
  /** Addition context: arrangement items show two groups put together. */
  combine?: boolean;
}

export interface KcLegacySlot {
  kind: 'legacy';
  objectiveId: string;
  angle: number;
}

export type KcSlot = KcProductionSlot | KcLegacySlot;

export interface KcPlanSkeleton {
  slots: KcSlot[];
  /** The curator's `count` — kept as a hint, never as the size. */
  requestedCount: number;
  /** The band budget the skeleton was trimmed to (generic angles only). */
  budget: number;
  /** Generic angles dropped to fit the budget. */
  droppedGeneric: number;
  /** Objective ids that got neither a named set nor a production kind —
   *  the reported residual (never guessed). */
  legacyObjectiveIds: string[];
  namedSets: Record<string, NamedSet>;
}

export const MIN_ITEMS_PER_OBJECTIVE = 2;
export const K_ITEM_BUDGET = 8;
export const DEFAULT_ITEM_BUDGET = 10;

// ── Verb → kind (code table) ────────────────────────────────────────────────

const IDENTIFY_RE = /\b(identify|identifies|name|names|recogni[sz]e|recogni[sz]es|find|finds|show|shows|point|points|know|knows|read|reads)\b/i;
const COUNT_RE = /\b(count|counts|counting|how many|left|remain|remains|remaining|take away|taking away|takes away|taken away|subtract|subtracts|subtracting|subtraction|minus|add|adds|adding|addition|total|altogether|in all|more|fewer|less)\b/i;
const TAKE_AWAY_RE = /\b(take away|taking away|takes away|taken away|subtract|subtracts|subtracting|subtraction|minus|left|remain|remains|remaining|fewer)\b/i;
const DEMONSTRATE_RE = /\b(demonstrate|demonstrates|show|shows|act out|model|models|use|uses|build|builds|make|makes)\b/i;
const OBJECTS_RE = /\b(object|objects|group|groups|set|sets|counter|counters|block|blocks|item|items|thing|things|picture|pictures)\b/i;
const COMBINE_RE = /\b(combine|combines|combining|join|joins|joining|put together|putting together|add|adds|adding|addition|altogether|in all|total|sum|plus)\b/i;
const SOUND_RE = /\b(sound|sounds|phoneme|phonemes)\b/i;
/** EXPLAIN-class verbs have no production kind in the pilot (P4 `which_reason`);
 *  a count item would be off-target evidence for them (addition obj3, xr70). */
const EXPLAIN_RE = /\b(explain|explains|explaining|why|because|describe|describes|describing|reason|reasons|justify)\b/i;
/** Attribute-comparison objectives ("show which one is longer or shorter")
 *  trip the loose DEMONSTRATE_RE + OBJECTS_RE fallback below — "show" reads as
 *  demonstrate, "objects" as the noun — and get scored as `how_many` counting
 *  items with no relation to the comparison (kindergarten-compare…3rvk, obj1:
 *  final assessment drew unrelated fish/bear counting items). No production
 *  kind exists for comparison in the pilot; falling through to `null` lets the
 *  orchestrator brief a legacy MC/TF comparison item instead. */
const COMPARE_ATTRIBUTE_RE = /\b(compare|compares|comparing|comparison|longer|shorter|taller|heavier|lighter|bigger|smaller|larger|wider|narrower)\b/i;

export interface KindDecision {
  productionKind: ProductionKind;
  stimulus: KcStimulusType;
  takeAway?: boolean;
  combine?: boolean;
}

/**
 * What production kind, if any, honestly assesses this objective with the
 * pilot's stimuli. `null` → legacy slot (reported).
 */
export function kindForObjective(
  obj: KcPlanObjective,
  set: NamedSet | null,
  opts: { preReader: boolean },
): KindDecision | null {
  const text = obj.text;
  if (EXPLAIN_RE.test(text) || /^explain/i.test(obj.verb ?? '')) return null;
  if (set) {
    switch (set.kind) {
      case 'symbol':
        // K: the sign's NAME → its FORM in a printed sentence (point). G1+: the
        // sign's FORM → its NAME (say). Decision §10.2 of the handoff.
        return opts.preReader
          ? { productionKind: 'point_to', stimulus: 'number-sentence' }
          : { productionKind: 'say_it', stimulus: 'glyph-card' };
      case 'numeral':
        return { productionKind: 'say_it', stimulus: 'glyph-card' };
      case 'shape':
        return { productionKind: 'say_it', stimulus: 'glyph-card' };
      case 'letter':
        // Letter NAMES are askable (letter_name, build-ahead); letter SOUNDS
        // need the continuant/clipped judge contracts this pack does not carry
        // yet — legacy, and the residual says so.
        return SOUND_RE.test(text) ? null : { productionKind: 'say_it', stimulus: 'glyph-card' };
    }
  }
  if (!COMPARE_ATTRIBUTE_RE.test(text)
    && (COUNT_RE.test(text) || COMBINE_RE.test(text) || (DEMONSTRATE_RE.test(text) && OBJECTS_RE.test(text)))) {
    const takeAway = TAKE_AWAY_RE.test(text);
    const combine = !takeAway && COMBINE_RE.test(text);
    return { productionKind: 'how_many', stimulus: 'arrangement', ...(takeAway ? { takeAway } : {}), ...(combine ? { combine } : {}) };
  }
  // A shape/numeral/letter mention without a set fell through above; an
  // "identify" verb with no recognisable noun has no K stimulus in the pilot.
  void IDENTIFY_RE;
  return null;
}

// ── Sizing ──────────────────────────────────────────────────────────────────

export interface PlanOptions {
  preReader: boolean;
  /** The curator's count (hint). */
  count: number;
  budget?: number;
}

export function planKnowledgeCheckSlots(
  objectives: KcPlanObjective[],
  opts: PlanOptions,
): KcPlanSkeleton {
  const budget = opts.budget ?? (opts.preReader ? K_ITEM_BUDGET : DEFAULT_ITEM_BUDGET);
  const slots: KcSlot[] = [];
  const namedSets: Record<string, NamedSet> = {};
  const legacyObjectiveIds: string[] = [];

  for (const obj of objectives) {
    const set = namedSetFromObjective(obj.text);
    if (set) namedSets[obj.id] = set;
    const decision = kindForObjective(obj, set, opts);

    if (!decision) {
      legacyObjectiveIds.push(obj.id);
      for (let angle = 0; angle < MIN_ITEMS_PER_OBJECTIVE; angle++) {
        slots.push({ kind: 'legacy', objectiveId: obj.id, angle });
      }
      continue;
    }

    if (set && set.elements.length > 0) {
      // One slot per named element — never sampled.
      set.elements.forEach((element) => {
        slots.push({
          kind: 'production',
          objectiveId: obj.id,
          productionKind: decision.productionKind,
          stimulus: decision.stimulus,
          element,
          elementKind: set.kind,
          angle: 0,
          ...(decision.takeAway ? { takeAway: true } : {}),
          ...(decision.combine ? { combine: true } : {}),
        });
      });
      // A one-element set still needs two independent opportunities.
      for (let angle = set.elements.length; angle < MIN_ITEMS_PER_OBJECTIVE; angle++) {
        slots.push({
          kind: 'production',
          objectiveId: obj.id,
          productionKind: decision.productionKind,
          stimulus: decision.stimulus,
          element: set.elements[0],
          elementKind: set.kind,
          angle,
          ...(decision.takeAway ? { takeAway: true } : {}),
          ...(decision.combine ? { combine: true } : {}),
        });
      }
      continue;
    }

    for (let angle = 0; angle < MIN_ITEMS_PER_OBJECTIVE; angle++) {
      slots.push({
        kind: 'production',
        objectiveId: obj.id,
        productionKind: decision.productionKind,
        stimulus: decision.stimulus,
        angle,
        ...(decision.takeAway ? { takeAway: true } : {}),
        ...(decision.combine ? { combine: true } : {}),
      });
    }
  }

  // Trim to budget: drop GENERIC angles (angle > 0, or angle 0 with no
  // element beyond the first per objective) from the objectives with the most
  // generic slots first; never a named element. If named elements alone
  // exceed the budget the cap yields (feedback_trust-intent-over-hardcoded-caps).
  let droppedGeneric = 0;
  const isNamed = (s: KcSlot) => s.kind === 'production' && !!s.element && s.angle === 0;
  while (slots.length > budget) {
    const perObjective = new Map<string, number>();
    slots.forEach((s) => {
      if (isNamed(s)) return;
      perObjective.set(s.objectiveId, (perObjective.get(s.objectiveId) ?? 0) + 1);
    });
    if (perObjective.size === 0) break;
    // Every objective keeps ≥ 1 slot; among droppable ones take from the
    // objective with the most generic slots, its highest angle first.
    let victim = -1;
    let victimScore = -1;
    slots.forEach((s, i) => {
      if (isNamed(s)) return;
      const objTotal = slots.filter((x) => x.objectiveId === s.objectiveId).length;
      if (objTotal <= 1) return;
      const score = (perObjective.get(s.objectiveId) ?? 0) * 100 + s.angle;
      if (score > victimScore) { victimScore = score; victim = i; }
    });
    if (victim < 0) break;
    slots.splice(victim, 1);
    droppedGeneric++;
  }

  return { slots, requestedCount: opts.count, budget, droppedGeneric, legacyObjectiveIds, namedSets };
}
