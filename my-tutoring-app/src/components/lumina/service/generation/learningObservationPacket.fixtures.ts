import {
  deliveredObservation, signLearningObservations,
  type DeliveredObservation, type LearningObservationPacket, type PacketEvidence, type PacketHypothesis, type PublishedScope,
} from './learningObservationPacket';
import type { SignedLearningObservations } from '../studentContext/types';

/**
 * Test and harness fixtures: build and sign a delivery packet the way the
 * backend does, with a throwaway key. No production code imports this module.
 */
export const TEST_SIGNING_KEY = 'synthetic-test-secret-never-for-production';

export interface FixtureScope { subject: string; grade: string; skillId: string; subskillId: string; curriculumVersion?: string }
export interface FixtureHypothesis {
  primitiveType: string; scope: FixtureScope; summary: string; evidence?: PacketEvidence;
  hypothesisId?: string; revision?: number; lastDetectedAt?: string;
}

export function publishedScope(scope: FixtureScope): PublishedScope {
  return { subject: scope.subject, grade: scope.grade, skill_id: scope.skillId, subskill_id: scope.subskillId,
    curriculum_version: scope.curriculumVersion ?? 'synthetic-v1' };
}

export function hypothesisFixture(h: FixtureHypothesis): PacketHypothesis {
  return { hypothesisId: h.hypothesisId ?? 'h1', ...(h.revision !== undefined ? { revision: h.revision } : {}),
    primitiveType: h.primitiveType, summary: h.summary, scope: publishedScope(h.scope), skillId: h.scope.skillId,
    lastDetectedAt: h.lastDetectedAt ?? '2026-09-13T08:00:00+00:00', ...(h.evidence ? { evidence: h.evidence } : {}) };
}

export function packetFixture(scopes: FixtureScope[], hypotheses: PacketHypothesis[],
  opts: { studentId?: string; issuedAt?: string; expiresAt?: string } = {}): LearningObservationPacket {
  return { v: 1, studentId: opts.studentId ?? '42', issuedAt: opts.issuedAt ?? new Date().toISOString(),
    expiresAt: opts.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    scopes: scopes.map(s => ({ subskillId: s.subskillId, skillId: s.skillId, published: publishedScope(s) })), hypotheses };
}

/** One signed packet holding the given hypotheses, with the lesson resolving each of their scopes. */
export function signedPacket(hypotheses: FixtureHypothesis[], key: string = TEST_SIGNING_KEY)
  : { signed: SignedLearningObservations; packet: LearningObservationPacket; delivered: DeliveredObservation[] } {
  const rows = hypotheses.map(hypothesisFixture);
  const scopes = hypotheses.map(h => h.scope).filter((s, i, all) => all.findIndex(o => o.subskillId === s.subskillId) === i);
  const packet = packetFixture(scopes, rows);
  return { signed: signLearningObservations(packet, key), packet, delivered: rows.map(deliveredObservation) };
}

/** The common case: one observation at one scope, as a generator will see it. */
export function signedObservation(h: FixtureHypothesis, key: string = TEST_SIGNING_KEY)
  : { signed: SignedLearningObservations; packet: LearningObservationPacket; delivered: DeliveredObservation } {
  const { signed, packet, delivered } = signedPacket([h], key);
  return { signed, packet, delivered: delivered[0] };
}
