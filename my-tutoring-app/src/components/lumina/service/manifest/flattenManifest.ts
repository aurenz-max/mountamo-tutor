/**
 * Manifest flatten — pure, client-safe.
 *
 * Extracted from gemini-manifest.ts so code that only needs the flatten
 * (e.g. the code-built pulse-check manifest, imported from client-side
 * useExhibitSession) never drags the server-only Gemini client into a
 * client bundle. gemini-manifest re-exports these for back-compat.
 */

import { ExhibitManifest, ManifestItem } from "../../types";

/**
 * Convert objective-centric manifest to flat layout array for backward compatibility.
 * This allows the existing rendering pipeline to work with the new manifest format.
 *
 * Each component's config is stamped (code-side, never round-tripped through the
 * LLM) with its parent objective's id/text/Bloom verb. The Bloom verb surfaces in
 * generator prompts as the COGNITIVE LEVEL line (see scopeContext.ts).
 *
 * NOTE: this previously also stamped a numeric `studentTheta` for generators to
 * invert a 2PL against — that within-mode NUMERIC difficulty path was retired (it
 * changed which in-scope numbers got picked, not difficulty). Per-student
 * personalization will return as a Bloom-tier entry point, not a theta stamp.
 */
export const flattenManifestToLayout = (
  manifest: ExhibitManifest,
  objectives?: Array<{ id: string; text: string; verb: string; subskillId?: string; skillId?: string; grade?: string }>,
): ManifestItem[] => {
  const layout: ManifestItem[] = [];

  // Authoritative objective lookup. When the caller supplied the lesson
  // objectives, we LEFT JOIN each block onto them by objectiveId and let the
  // supplied text/verb WIN over whatever the curator echoed. The curator can
  // paraphrase the objective, and scopeContext binds generated content on
  // objectiveText — a drifted echo would silently shift the bound scope. No
  // match (or no objectives passed, e.g. the legacy topic-only path) → keep the
  // curator's values.
  const objectiveById = new Map((objectives ?? []).map(o => [o.id, o]));
  const resolveObjective = (block: { objectiveId: string; objectiveText: string; objectiveVerb: string }) => {
    const auth = objectiveById.get(block.objectiveId);
    return {
      objectiveText: auth?.text ?? block.objectiveText,
      objectiveVerb: auth?.verb ?? block.objectiveVerb,
      // Curriculum IDs resolved once at lesson start (generation-context /
      // preBuiltObjectives) — stamped so each component knows which subskill
      // its evidence belongs to.
      subskillId: auth?.subskillId,
      skillId: auth?.skillId,
      // Canonical curriculum grade ('K'|'1'..'12') — precise where the lesson's
      // gradeLevel is only a band. resolveGenerationContext normalizes it to
      // ctx.grade so generators never parse grade out of prose.
      grade: auth?.grade,
    };
  };

  // 1. Add curator brief first
  if (manifest.curatorBrief) {
    layout.push({
      componentId: 'curator-brief',
      instanceId: manifest.curatorBrief.instanceId,
      title: manifest.curatorBrief.title,
      intent: manifest.curatorBrief.intent,
      objectiveIds: manifest.objectiveBlocks?.map(b => b.objectiveId) || []
    });
  }

  // 2. Add all components from each objective block
  if (manifest.objectiveBlocks) {
    for (const block of manifest.objectiveBlocks) {
      const { objectiveText, objectiveVerb, subskillId, skillId, grade } = resolveObjective(block);
      for (const component of block.components) {
        layout.push({
          componentId: component.componentId,
          instanceId: component.instanceId,
          title: component.title,
          intent: component.intent,
          config: {
            ...component.config,
            // Inject objective context into config for content generators.
            // objectiveVerb is the Bloom verb — surfaced in prompts via scopeContext.
            // text/verb are the authoritative (joined) values, not the curator's echo.
            objectiveId: block.objectiveId,
            objectiveText,
            objectiveVerb,
            // Attribution keys — this component's evidence belongs to ITS
            // objective's subskill (undefined on unresolved/free-form lessons).
            subskillId,
            skillId,
            // Canonical grade for this objective → ctx.grade at the generator boundary.
            objectiveGrade: grade,
            // Belt-and-suspenders: also surface the component's intent INSIDE config
            // (it already rides at top-level item.intent). resolveGenerationContext
            // reads config.intent first, so this makes the documented scopeContext
            // contract true at the source. See PRD_GENERATION_CONTEXT_HARMONIZATION §6.1.
            intent: component.intent ?? (component.config as { intent?: string } | undefined)?.intent,
          },
          objectiveIds: [block.objectiveId]
        });
      }
    }
  }

  // 3. Add final assessment last. It spans ALL objectives, so it gets the
  // full list (with curriculum IDs) — the KC orchestrator tags each planned
  // problem with the objective it assesses, and each problem's evaluation
  // attributes to that objective's subskill.
  if (manifest.finalAssessment) {
    layout.push({
      componentId: manifest.finalAssessment.componentId,
      instanceId: manifest.finalAssessment.instanceId,
      title: manifest.finalAssessment.title,
      intent: manifest.finalAssessment.intent,
      config: {
        ...manifest.finalAssessment.config,
        lessonObjectives: (objectives ?? []).map(o => ({
          id: o.id,
          text: o.text,
          subskillId: o.subskillId,
          skillId: o.skillId,
          grade: o.grade,
        })),
      },
      objectiveIds: manifest.objectiveBlocks?.map(b => b.objectiveId) || []
    });
  }

  return layout;
};

/**
 * Enrich manifest with flattened layout for backward compatibility
 */
export const enrichManifestWithLayout = (
  manifest: ExhibitManifest,
  objectives?: Array<{ id: string; text: string; verb: string; subskillId?: string; skillId?: string; grade?: string }>,
): ExhibitManifest => {
  return {
    ...manifest,
    layout: flattenManifestToLayout(manifest, objectives)
  };
};
