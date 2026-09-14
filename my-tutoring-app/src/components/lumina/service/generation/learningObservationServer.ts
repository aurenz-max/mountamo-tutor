import { createHash } from 'node:crypto';
import type { LearningObservationConsumer, LearningObservationRetest } from '../../types';
import { backend, currentLessonId } from './generationRequest';

type Observation = { id: string; summary: string; evidence?: string };
type RetestContext = { hypothesis_id: string; revision: number; focus: string; scope: Record<string, string> };
type Adapted = {
  learningAdaptation?: { move?: unknown; source?: string };
  misconceptionOpportunity?: { id: string; lessonId: string; grade: string; curriculumVersion: string };
};
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObservation = (o: unknown): o is Observation => !!o && typeof o === 'object'
  && isText((o as Observation).id) && isText((o as Observation).summary)
  && ['string', 'undefined'].includes(typeof (o as Observation).evidence);

/**
 * Catalog-declared delivery of saved learning observations to a generator.
 * The consumer declaration (`ComponentDefinition.learningObservations`) says
 * when a task is eligible; the objective's published scope — subject, grade,
 * skill, subskill — comes from the manifest config. This module names no
 * primitive and assumes no subject.
 *
 * Shared delivery is exposure only: no receipt, no resolution, no observation
 * text in the returned content. A consumer that declares a `retest` reads its
 * own hypothesis through the primitive-keyed opportunity context instead and
 * binds the compiled item plan to that revision in a signed receipt.
 */
export async function generateWithLearningObservations<T extends { data: Adapted } | null>(
  item: { componentId: string; instanceId: string; config?: Record<string, unknown>; topic?: string; intent?: string },
  consumer: LearningObservationConsumer,
  generate: (config: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  // Only this server produces observations or a focus; never trust them from a manifest or client.
  const { learningObservations: _untrusted, remediationFocus: _forged, ...config } = item.config ?? {};
  const scope = { subject: config.objectiveSubject, grade: config.objectiveGrade, skill_id: config.skillId, subskill_id: config.subskillId };
  let observations: Observation[] = [];
  let retest: RetestContext | null = null;
  if (consumer.eligible(config) && Object.values(scope).every(isText)) {
    try {
      if (consumer.retest) {
        const context = await backend('/api/student-profile/misconception-opportunity-context', { primitive_type: item.componentId, scope });
        if (context?.available && isText(context.hypothesis_id) && isText(context.focus)) {
          retest = context;
          observations = [{ id: context.hypothesis_id, summary: context.focus }];
        }
      } else {
        const context = await backend('/api/student-profile/learning-observation-context', { scope });
        if (context?.available && Array.isArray(context.observations)) observations = context.observations.filter(isObservation).slice(0, 10)
          .map(({ id, summary, evidence }: Observation) => ({ id, summary, ...(evidence ? { evidence } : {}) }));
      }
    } catch { /* ordinary generation remains available */ }
  }
  const generated = await generate(observations.length ? { ...config, learningObservations: observations } : config);
  if (!generated) return generated;
  // Never accept a receipt or an origin stamped by a generator, a config or cached data.
  delete generated.data.misconceptionOpportunity;
  if (generated.data.learningAdaptation) {
    delete generated.data.learningAdaptation.source;
    if (observations.length) generated.data.learningAdaptation.source = 'saved-observation';
  }
  if (consumer.retest && retest) await certifyRetest(item, config, consumer.retest, retest, generated.data);
  return generated;
}

/** Bind the compiled item plan to the hypothesis revision it retests. No plan, no receipt; an outage invents no credit. */
async function certifyRetest(
  item: { componentId: string; instanceId: string; topic?: string; intent?: string },
  config: Record<string, unknown>, retest: LearningObservationRetest, context: RetestContext, data: Adapted,
): Promise<void> {
  try {
    const plan = retest.certify(data, { focus: context.focus, grade: context.scope.grade, topic: item.topic,
      intent: (config.intent ?? item.intent) as string | undefined, objectiveText: config.objectiveText as string | undefined });
    const lessonId = currentLessonId();
    if (!plan || !lessonId) return;
    const result = await backend('/api/student-profile/misconception-opportunities', {
      primitive_type: item.componentId, hypothesis_id: context.hypothesis_id, revision: context.revision, scope: context.scope,
      capability_id: retest.capabilityId, capability_version: retest.capabilityVersion,
      policy_version: retest.policyVersion, compiler_version: retest.compilerVersion,
      content_hash: createHash('sha256').update(plan.contentIdentity).digest('hex'), items: plan.items,
      instance_id: item.instanceId, lesson_id: lessonId, mode: plan.mode, tier: plan.tier,
    });
    if (result?.opportunity_set_id) data.misconceptionOpportunity = { id: result.opportunity_set_id, lessonId,
      grade: context.scope.grade, curriculumVersion: context.scope.curriculum_version };
  } catch { /* no invented credit; generation stays usable */ }
}
