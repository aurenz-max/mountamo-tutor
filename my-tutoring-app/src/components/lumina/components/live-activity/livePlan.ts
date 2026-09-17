/**
 * Live lesson plan (LIVE_LESSON_ROADMAP LA-02): one prepared lesson, projected
 * into the short ordered route a live session can run.
 *
 * The source is a Lesson Bench package: curator brief → manifest → dedicated
 * eval-mode resolution → real generators, saved byte-for-byte. Nothing here
 * generates or re-selects. Each item keeps the objective it serves, the mode
 * the lesson resolver pinned, and where its content came from. A component the
 * live session cannot run is listed as unavailable with the reason, never
 * silently dropped or substituted.
 */
import type { LessonPackage } from '../../service/qa/lessonBench/lessonPackage';
import { getComponentById } from '../../service/manifest/catalog';
import { normalizeObjectiveGrade } from '../../service/generation/resolveGenerationContext';
import { LIVE_ADAPTERS, isLivePrimitive, type LivePrimitiveId, type LiveActivityData } from './activityContract';

export interface LivePlanItem {
  /** Opaque id the tutor uses; never a manifest or primitive identifier. */
  itemId: string;
  primitiveId: LivePrimitiveId;
  title: string;
  intent: string;
  /** The manifest's resolved `config.targetEvalMode`, verbatim (single, `a|b` blend, or `mixed`). */
  evalMode: string;
  objective: { id: string; text: string; verb: string };
  data: LiveActivityData;
  provenance: {
    packageId: string;
    source: string;
    generatedAt: string;
    manifestInstanceId: string;
    modeSource: 'manifest-resolved';
  };
}

export interface UnavailablePlanComponent {
  manifestInstanceId: string;
  componentId: string;
  objectiveId: string;
  reason: string;
}

export interface LiveSessionPlan {
  planId: string;
  topic: string;
  /** Display grade ('Kindergarten' | 'Grade N'), or the manifest's own string when it is not a single grade. */
  gradeLevel: string;
  objectives: Array<{ id: string; text: string; verb: string }>;
  items: LivePlanItem[];
  unavailable: UnavailablePlanComponent[];
}

/** What a completed item reports. Runtime design labels, not storage enums. */
export interface PlanItemOutcome {
  itemId: string;
  disposition: 'completed';
  allCorrect: boolean;
  score: number;
}

export class LivePlanError extends Error {}

/** Catalog challenge types the pinned mode(s) allow, or an error describing the pin. */
function allowedChallengeTypes(primitiveId: string, pin: string): Set<string> | string {
  const modes = getComponentById(primitiveId)?.evalModes ?? [];
  if (!pin) return 'no resolved eval mode';
  const keys = pin === 'mixed' ? modes.map(m => m.evalMode) : pin.split('|');
  const picked = keys.map(key => modes.find(m => m.evalMode === key));
  if (!keys.length || picked.some(m => !m)) return `eval mode "${pin}" is not in the ${primitiveId} catalog`;
  return new Set(picked.flatMap(m => m!.challengeTypes));
}

function gradeLabel(raw: string): string {
  const grade = normalizeObjectiveGrade(raw);
  return grade === 'K' ? 'Kindergarten' : grade ? `Grade ${grade}` : raw;
}

/**
 * Project a package's objective blocks (all, or the listed ones, in manifest
 * order) into a live plan. Throws only when nothing can run.
 */
export function projectLessonPlan(pkg: LessonPackage, options: { objectiveIds?: string[] } = {}): LiveSessionPlan {
  const blocks = (pkg.manifest.objectiveBlocks ?? [])
    .filter(block => !options.objectiveIds || options.objectiveIds.includes(block.objectiveId));
  if (!blocks.length) throw new LivePlanError('The package has no matching objective blocks.');
  const dataById = new Map(pkg.components.map(c => [c.instanceId, c.data]));
  const items: LivePlanItem[] = [];
  const unavailable: UnavailablePlanComponent[] = [];

  for (const block of blocks) {
    for (const component of block.components ?? []) {
      const skip = (reason: string) => unavailable.push({ manifestInstanceId: component.instanceId,
        componentId: component.componentId, objectiveId: block.objectiveId, reason });
      if (!isLivePrimitive(component.componentId)) { skip('no live adapter'); continue; }
      const raw = dataById.get(component.instanceId);
      if (raw === null || raw === undefined) { skip('no prepared content in the package'); continue; }
      const pin = typeof component.config?.targetEvalMode === 'string' ? component.config.targetEvalMode.trim() : '';
      const allowed = allowedChallengeTypes(component.componentId, pin);
      if (typeof allowed === 'string') { skip(allowed); continue; }
      let data: LiveActivityData;
      try {
        data = LIVE_ADAPTERS[component.componentId].validate(raw);
      } catch (error) {
        skip(error instanceof Error ? error.message : 'invalid prepared content'); continue;
      }
      const offMode = ((data.challenges ?? []) as Array<{ type: string }>).map(c => c.type).filter(type => !allowed.has(type));
      if (offMode.length) { skip(`content has ${Array.from(new Set(offMode)).join(', ')} challenges outside mode "${pin}"`); continue; }
      items.push({
        itemId: `item-${items.length + 1}`,
        primitiveId: component.componentId,
        title: component.title,
        intent: component.intent,
        evalMode: pin,
        objective: { id: block.objectiveId, text: block.objectiveText, verb: block.objectiveVerb },
        data,
        provenance: { packageId: pkg.id, source: pkg.provenance.source, generatedAt: pkg.provenance.generatedAt,
          manifestInstanceId: component.instanceId, modeSource: 'manifest-resolved' },
      });
    }
  }
  if (!items.length) throw new LivePlanError('No component in the selected objectives can run live yet.');
  return {
    planId: pkg.id,
    topic: pkg.manifest.topic,
    gradeLevel: gradeLabel(pkg.manifest.gradeLevel),
    objectives: blocks.map(b => ({ id: b.objectiveId, text: b.objectiveText, verb: b.objectiveVerb })),
    items,
    unavailable,
  };
}

/** The next item in plan order that has no outcome yet. */
export function nextPlanItem(plan: LiveSessionPlan, outcomes: Record<string, PlanItemOutcome>): LivePlanItem | null {
  return plan.items.find(item => !outcomes[item.itemId]) ?? null;
}

/** What the tutor is told about the plan: identities and purpose, never content or answers. */
export function planForTutor(plan: LiveSessionPlan) {
  return plan.items.map(item => ({ itemId: item.itemId, primitiveId: item.primitiveId, title: item.title,
    evalMode: item.evalMode, objective: item.objective.text }));
}
