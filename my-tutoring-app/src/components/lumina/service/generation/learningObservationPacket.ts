import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { SignedLearningObservations } from '../studentContext/types';
import { normalizeObjectiveGrade } from './resolveGenerationContext';

/**
 * The learning-observation delivery packet.
 *
 * The backend signs it ONCE at lesson launch (inside the generation-context
 * response) and it travels with the generate request. This module defines the
 * format both sides agree on, verifies the signature, and does every per-task
 * step that used to be a backend call during generation: scope join, ordering,
 * the 10-observation delivery limit, the evidence budget and the delivered
 * shape. The backend's part is retrieval — the owner's deliverable records
 * with their stamped scope, the lineage-resolved skill, and the canonical
 * published scope of each lesson objective.
 *
 * Nothing here names a primitive or a subject.
 */

export const PACKET_VERSION = 1;
export const PACKET_SIGNATURE_PREFIX = 'lumina-learning-observations:v1\n';
export const DELIVERY_LIMIT = 10;
export const EVIDENCE_BUDGET = 7000;

export interface PublishedScope { subject: string; grade: string; skill_id: string; subskill_id: string; curriculum_version: string }
/** One lesson objective as requested, and what it resolves to in the live publication (null = not published). */
export interface PacketScope { subskillId: string; skillId?: string | null; published: PublishedScope | null }
export interface PacketEvidence {
  problem: string; evalMode: string;
  phases: Array<{ phase: string; challenge: string; expected: string; observed: string; support: string }>;
}
export interface PacketHypothesis {
  hypothesisId: string; revision?: number; primitiveType: string; summary: string;
  /** Stamped at capture, verbatim. */
  scope: PublishedScope;
  /** The stamped skill after lineage resolution — the join key for shared delivery. */
  skillId: string;
  lastDetectedAt: string;
  evidence?: PacketEvidence;
}
export interface LearningObservationPacket {
  v: typeof PACKET_VERSION; studentId: string; issuedAt: string; expiresAt: string;
  scopes: PacketScope[]; hypotheses: PacketHypothesis[];
}
/** What a generator receives in `ctx.learningObservations`. */
export interface DeliveredObservation { id: string; summary: string; evidence?: string }
/** The task's objective scope as the manifest flatten stamps it on config. */
export interface TaskScope { subject?: unknown; grade?: unknown; skillId?: unknown; subskillId?: unknown }

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const SCOPE_KEYS = ['subject', 'grade', 'skill_id', 'subskill_id', 'curriculum_version'] as const;
const isPublishedScope = (s: unknown): s is PublishedScope => !!s && typeof s === 'object' && SCOPE_KEYS.every(k => isText((s as PublishedScope)[k]));

/** Sign a packet the way the backend does (tests, harnesses, parity checks). Never runs on a client. */
export function signLearningObservations(packet: LearningObservationPacket, key: string): SignedLearningObservations {
  const payload = JSON.stringify(packet);
  return { payload, signature: createHmac('sha256', key).update(PACKET_SIGNATURE_PREFIX + payload).digest('hex') };
}

/**
 * Verify and open a signed packet. Null for anything but a fresh packet whose
 * signature matches this key: no key configured, a client-edited payload, an
 * expired lesson, another format version. Generation then runs unadapted.
 */
export function openLearningObservations(signed: unknown, key: string | undefined, now: number = Date.now()): LearningObservationPacket | null {
  if (!signed || typeof signed !== 'object' || !key || key.length < 32) return null;
  const { payload, signature } = signed as Partial<SignedLearningObservations>;
  if (!isText(payload) || typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return null;
  const expected = createHmac('sha256', key).update(PACKET_SIGNATURE_PREFIX + payload).digest('hex');
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) return null;
  let packet: LearningObservationPacket;
  try { packet = JSON.parse(payload); } catch { return null; }
  if (!packet || packet.v !== PACKET_VERSION || !isText(packet.studentId) || !isText(packet.expiresAt)
    || !Array.isArray(packet.scopes) || !Array.isArray(packet.hypotheses)) return null;
  const expires = Date.parse(packet.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return null;
  return {
    ...packet,
    scopes: packet.scopes.filter(s => s && isText(s.subskillId) && (s.published === null || isPublishedScope(s.published))),
    hypotheses: packet.hypotheses.filter(h => h && isText(h.hypothesisId) && isText(h.primitiveType) && isText(h.summary)
      && isText(h.skillId) && isPublishedScope(h.scope)),
  };
}

/** The canonical published scope of the task's objective, or null when the lesson did not resolve it. */
export function publishedScopeFor(packet: LearningObservationPacket, task: TaskScope): PublishedScope | null {
  if (!isText(task.subskillId) || !isText(task.subject)) return null;
  const entry = packet.scopes.find(s => s.subskillId === task.subskillId && (!isText(s.skillId) || !isText(task.skillId) || s.skillId === task.skillId));
  const published = entry?.published ?? null;
  if (!published || published.subject !== task.subject || published.grade !== normalizeObjectiveGrade(task.grade)) return null;
  return published;
}

/** Compact evidence JSON, dropping trailing phases until it fits the budget. */
export function boundedEvidence(evidence: PacketEvidence): string {
  const header = JSON.stringify({ problem: evidence.problem, evalMode: evidence.evalMode, phases: [] });
  const kept: string[] = [];
  let length = header.length;
  for (const phase of evidence.phases ?? []) {
    const encoded = JSON.stringify({ phase: phase.phase, challenge: phase.challenge, expected: phase.expected, observed: phase.observed, support: phase.support });
    length += encoded.length + (kept.length ? 1 : 0);
    if (length > EVIDENCE_BUDGET) break;
    kept.push(encoded);
  }
  return kept.length ? header.slice(0, -2) + kept.join(',') + ']}' : header;
}

/** Opaque, stable id plus the bounded summary and evidence a generator may see. No attempt ids, receipts or status. */
export function deliveredObservation(hypothesis: PacketHypothesis): DeliveredObservation {
  const identity = `${hypothesis.primitiveType}::${hypothesis.scope.skill_id}:${hypothesis.hypothesisId}`;
  return {
    id: 'observation-' + createHash('sha256').update(identity).digest('hex').slice(0, 16),
    summary: hypothesis.summary.slice(0, 4000),
    ...(hypothesis.evidence ? { evidence: boundedEvidence(hypothesis.evidence).slice(0, EVIDENCE_BUDGET) } : {}),
  };
}

/** Shared delivery: every source's hypotheses at the task's published subject, grade and skill, newest first. */
export function scopedObservations(packet: LearningObservationPacket, task: TaskScope): DeliveredObservation[] {
  const published = publishedScopeFor(packet, task);
  if (!published) return [];
  return packet.hypotheses
    .filter(h => h.skillId === published.skill_id && h.scope.subject === published.subject && h.scope.grade === published.grade)
    .sort((a, b) => (a.lastDetectedAt < b.lastDetectedAt ? 1 : a.lastDetectedAt > b.lastDetectedAt ? -1 : 0))
    .slice(0, DELIVERY_LIMIT)
    .map(deliveredObservation);
}

/** A retest consumer's OWN hypothesis at exactly the task's live published scope (same subskill and publication). */
export function retestHypothesis(packet: LearningObservationPacket, primitiveType: string, task: TaskScope)
  : { hypothesis_id: string; revision: number; focus: string; scope: PublishedScope } | null {
  const published = publishedScopeFor(packet, task);
  if (!published) return null;
  const own = packet.hypotheses.find(h => h.primitiveType === primitiveType && Number.isInteger(h.revision) && (h.revision as number) > 0
    && SCOPE_KEYS.every(k => h.scope[k] === published[k]));
  return own ? { hypothesis_id: own.hypothesisId, revision: own.revision as number, focus: own.summary, scope: published } : null;
}
