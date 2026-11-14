/**
 * Practice Studio's author (USER 2026-11-08): the first primitive of the general agent category. The manifest picks it
 * for an objective; the agent assembles every item from the kit's answer surfaces and displays, and the kit's item loop
 * (`agent-kit/itemLoop.ts`) runs each item the way a child meets it and sends it back until it holds up.
 *
 * This file owns only the lesson around the kit: the objective, grade, scope, remediation focus and tier plan.
 */
import { isPreReaderAudience } from '../gemini-deep-dive';
import { buildScopePromptSection } from '../../scopeContext';
import type { GenerationContext } from '../../generation/generationContext';
import { evidencePrompt, readEvidence, type EvidenceSpec } from '../../agent-kit/evidence';
import { surfacePrompt, runItemBench, runItemLoop, shipLevers, type ItemLoopResult, type ItemLoopSpec } from '../../agent-kit/itemLoop';
import type { Tier } from '../../agent-kit/surfaces';
import type { PracticeStudioData } from '../../../primitives/visual-primitives/core/practice-studio/PracticeStudio';
import { validatePracticeStudioData } from '../../../primitives/visual-primitives/core/practice-studio/practiceStudio.boss';
import { fillPlan } from './studioPlan';
import { studioPlan } from './plans';

const ITEMS = 4;

/** One tier per item: the requested tier throughout (the first one easier), else easy to hard. */
export function tierPlan(tier: Tier | undefined): Tier[] {
  if (!tier) return ['easy', 'medium', 'medium', 'hard'];
  const lower: Record<Tier, Tier> = { easy: 'easy', medium: 'easy', hard: 'medium' };
  return [lower[tier], ...Array.from({ length: ITEMS - 1 }, () => tier)];
}

const gradeWords = (g?: string) => (!g ? 'elementary' : g.toUpperCase() === 'K' ? 'Kindergarten' : /^\d+$/.test(g) ? `grade ${g}` : g);

export function lessonPrompt(gctx: GenerationContext, withoutDisplays: readonly string[] = [], evidence?: EvidenceSpec): string {
  return `${surfacePrompt(withoutDisplays)}

THE LESSON (from the curriculum and the lesson plan):
- Topic: ${gctx.topic}
- Grade: ${gradeWords(gctx.grade ?? gctx.gradeContext)}
${gctx.objective?.text ? `- Objective: ${gctx.objective.text}\n` : ''}${gctx.intent ? `- This item set's job: ${gctx.intent}\n` : ''}${gctx.remediationFocus ? `- A misconception this learner shows: ${gctx.remediationFocus}. Include a wrong option that tests it.\n` : ''}${buildScopePromptSection(gctx.scope)}
${evidence ? `${evidencePrompt(evidence)}\n` : ''}Every item practises this objective. Kindergarten and grade 1 children do not read yet: keep labels to a word or two, let pictures carry the item, and keep any text short enough to read aloud.`;
}

export async function generatePracticeStudio(gctx: GenerationContext): Promise<PracticeStudioData> {
  const raw = (gctx.raw ?? {}) as { seed?: number; reviewBench?: unknown; withoutDisplays?: unknown; evidence?: unknown; plan?: unknown; problem?: unknown };
  // Tester only (PROTOTYPE): a studio plan written offline, filled by code with no model call.
  if (typeof raw.plan === 'string') {
    const plan = studioPlan(raw.plan);
    if (!plan) throw new Error(`Practice studio: no studio plan "${raw.plan}"`);
    const problem = Number.isInteger(raw.problem) ? Number(raw.problem) : Math.floor(Math.random() * plan.problems.length);
    const filled = fillPlan(plan, problem, Number(raw.seed) || Math.floor(Math.random() * 2 ** 31));
    if (filled.problems.length) throw new Error(`Studio plan ${plan.id} problem ${problem + 1} fails its checks: ${filled.problems.join('; ')}`);
    return filled.data;
  }
  // The lesson's spec (written per objective by the curator brief, stamped by the manifest flatten) wins; a tester
  // still sends one on the item's config.
  const evidence = gctx.objective?.evidence ?? readEvidence(raw.evidence);
  const seed = Number(raw.seed) || Math.floor(Math.random() * 2 ** 31);
  const tiers = tierPlan(gctx.supportTier as Tier | undefined);
  // Tester only: hide displays from the author, to measure one against the agent drawing it by hand.
  // A passage is for reading, which a pre-reader cannot do yet.
  const withoutDisplays = [...(Array.isArray(raw.withoutDisplays) ? raw.withoutDisplays.map(String) : []), ...(isPreReaderAudience(`Grade ${gctx.grade ?? ''} ${gctx.gradeContext ?? ''}`) ? ['passage'] : [])];
  const spec: ItemLoopSpec = {
    tag: 'PracticeStudio', prompt: lessonPrompt(gctx, withoutDisplays, evidence), ...(evidence ? { evidence } : {}), grade: gradeWords(gctx.grade ?? gctx.gradeContext),
    // No spec from the lesson: the loop plans one from the objective, so the default is never "any surface".
    objective: [gctx.topic, gctx.objective?.text, gctx.intent].filter(Boolean).join('. '),
    tiers, minItems: 2, idPrefix: 'studio', seed, hiddenDisplays: withoutDisplays,
  };
  const build = (r: ItemLoopResult) => {
    console.log(`[PracticeStudio] ${r.items.length} items in ${r.debug.seconds}s: ${r.items.map(x => `${x.item.surface}/${x.item.tier}->${x.item.difficulty.band} r${x.rounds}`).join(', ')}`);
    return validatePracticeStudioData({
      title: r.title, description: r.idea,
      gradeBand: gradeWords(gctx.grade ?? gctx.gradeContext),
      challengeType: 'practice',
      challenges: r.items.map(x => {
        const levers = shipLevers(x.item, x.levers);
        return levers.length ? { ...x.item, levers } : x.item;
      }),
      agentDebug: { ...r.debug, tiers },
    });
  };
  // Tester only: every chosen review setting on one first draft. The data is the first that worked; the rest ride in debug.
  if (Array.isArray(raw.reviewBench) && raw.reviewBench.length) {
    const bench = (await runItemBench(spec, raw.reviewBench.map(String))).map(({ id, label, result, error }) => {
      if (!result) return { id, label, error };
      try { return { id, label, data: build(result) }; } catch (e) { return { id, label, error: e instanceof Error ? e.message : String(e) }; }
    });
    const first = bench.find(b => b.data)?.data;
    if (!first) throw new Error(`Practice studio bench: no setting produced a session (${bench.map(b => `${b.id}: ${b.error}`).join('; ')})`);
    return { ...first, agentDebug: { ...first.agentDebug, bench } };
  }
  return build(await runItemLoop(spec));
}
