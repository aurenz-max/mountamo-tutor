import { createHash } from 'node:crypto';
import type { LearningObservationConsumer, LearningObservationRetest } from '../../types';
import { backend, currentLessonId, deliveredLearningObservations } from './generationRequest';
import { retestHypothesis, scopedObservations, type DeliveredObservation, type PublishedScope } from './learningObservationPacket';

type RetestContext = { hypothesis_id: string; revision: number; focus: string; scope: PublishedScope };
type Adapted = {
  learningAdaptation?: { move?: unknown; source?: string };
  misconceptionOpportunity?: { id: string; lessonId: string; grade: string; curriculumVersion: string };
};

/**
 * Catalog-declared delivery of saved learning observations to a generator.
 * The consumer declaration (`ComponentDefinition.learningObservations`) says
 * when a task is eligible; the objective's published scope — subject, grade,
 * skill, subskill — comes from the manifest config. The observations come
 * from the packet the backend signed at lesson launch, verified once per
 * request: no backend call happens here. This module names no primitive and
 * assumes no subject.
 *
 * Shared delivery is exposure only: no receipt, no resolution, no observation
 * text in the returned content. A consumer that declares a `retest` reads its
 * own hypothesis from the same packet and binds the compiled item plan to that
 * revision in a signed receipt — the one write that still reaches the backend.
 */
export async function generateWithLearningObservations<T extends { data: Adapted } | null>(
  item: { componentId: string; instanceId: string; config?: Record<string, unknown>; topic?: string; intent?: string },
  consumer: LearningObservationConsumer,
  generate: (config: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  // Only the verified packet produces observations or a focus; never trust them from a manifest or client config.
  const { learningObservations: _untrusted, remediationFocus: _forged, ...config } = item.config ?? {};
  const task = { subject: config.objectiveSubject, grade: config.objectiveGrade, skillId: config.skillId, subskillId: config.subskillId };
  let observations: DeliveredObservation[] = [];
  let retest: RetestContext | null = null;
  const packet = consumer.eligible(config) ? deliveredLearningObservations() : null;
  if (packet) {
    if (consumer.retest) {
      retest = retestHypothesis(packet, item.componentId, task);
      if (retest) observations = [{ id: retest.hypothesis_id, summary: retest.focus }];
    } else {
      observations = scopedObservations(packet, task);
    }
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
