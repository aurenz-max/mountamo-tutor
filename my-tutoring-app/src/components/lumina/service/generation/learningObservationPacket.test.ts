import { expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  EVIDENCE_BUDGET, PACKET_SIGNATURE_PREFIX, boundedEvidence, openLearningObservations, publishedScopeFor,
  retestHypothesis, scopedObservations, signLearningObservations,
} from './learningObservationPacket';
import { TEST_SIGNING_KEY, hypothesisFixture, packetFixture, signedPacket } from './learningObservationPacket.fixtures';

const scope = { subject: 'MATHEMATICS', grade: '3', skillId: 'NF001-03', subskillId: 'NF001-03-b' };
const task = { subject: 'MATHEMATICS', grade: '3', skillId: 'NF001-03', subskillId: 'NF001-03-b' };
const evidence = { problem: 'Fraction bar build', evalMode: 'build',
  phases: [{ phase: 'numerator', challenge: '3/4 numerator?', expected: '3', observed: '4', support: 'Attempt 1' }] };
const bar = { primitiveType: 'fraction-bar', scope, summary: 'Swaps numerator and denominator roles.', evidence, hypothesisId: 'h1', revision: 2 };

it('opens only a fresh packet whose signature matches this key', () => {
  const { signed, packet } = signedPacket([bar]);
  expect(signed.signature).toBe(createHmac('sha256', TEST_SIGNING_KEY).update(PACKET_SIGNATURE_PREFIX + signed.payload).digest('hex'));
  expect(openLearningObservations(signed, TEST_SIGNING_KEY)).toEqual(packet);
  expect(openLearningObservations(signed, undefined)).toBeNull();
  expect(openLearningObservations(signed, 'short')).toBeNull();
  expect(openLearningObservations(signed, 'another-synthetic-secret-never-for-production')).toBeNull();
  expect(openLearningObservations({ ...signed, payload: signed.payload.replace('Swaps', 'Never swaps') }, TEST_SIGNING_KEY)).toBeNull();
  expect(openLearningObservations({ ...signed, signature: signed.signature.replace(/./, 'x') }, TEST_SIGNING_KEY)).toBeNull();
  expect(openLearningObservations(null, TEST_SIGNING_KEY)).toBeNull();
  expect(openLearningObservations('string', TEST_SIGNING_KEY)).toBeNull();
  const expired = signLearningObservations(packetFixture([scope], [], { expiresAt: '2026-09-14T00:00:00+00:00' }), TEST_SIGNING_KEY);
  expect(openLearningObservations(expired, TEST_SIGNING_KEY, Date.parse('2026-09-14T00:00:01+00:00'))).toBeNull();
  expect(openLearningObservations(expired, TEST_SIGNING_KEY, Date.parse('2026-09-13T23:59:59+00:00'))).not.toBeNull();
  const wrongVersion = signLearningObservations({ ...packetFixture([scope], []), v: 2 as never }, TEST_SIGNING_KEY);
  expect(openLearningObservations(wrongVersion, TEST_SIGNING_KEY)).toBeNull();
});

it('verifies a payload signed by the backend byte for byte, including non-ASCII text', () => {
  // The backend serializes with json.dumps(separators=(',', ':'), ensure_ascii=False) and signs that string.
  const payload = '{"v":1,"studentId":"42","issuedAt":"2026-09-14T12:00:00+00:00","expiresAt":"2999-01-01T00:00:00+00:00","scopes":[],'
    + '"hypotheses":[{"hypothesisId":"h1","primitiveType":"fraction-bar","summary":"café — rôles","scope":'
    + '{"subject":"MATHEMATICS","grade":"3","skill_id":"NF001-03","subskill_id":"NF001-03-b","curriculum_version":"v@1"},"skillId":"NF001-03","lastDetectedAt":"2026-09-13"}]}';
  const signature = createHmac('sha256', TEST_SIGNING_KEY).update(PACKET_SIGNATURE_PREFIX + payload, 'utf8').digest('hex');
  const packet = openLearningObservations({ payload, signature }, TEST_SIGNING_KEY);
  expect(packet?.hypotheses[0].summary).toBe('café — rôles');
});

it('resolves the task scope through the lesson entry and joins hypotheses on subject, grade and resolved skill', () => {
  const sibling = { ...bar, hypothesisId: 'h2', primitiveType: 'base-ten-blocks', scope: { ...scope, subskillId: 'NF001-03-a' },
    summary: 'Sibling subskill, same skill.', lastDetectedAt: '2026-09-14T08:00:00+00:00' };
  const otherGrade = { ...bar, hypothesisId: 'h3', scope: { ...scope, grade: '4' }, summary: 'Grade 4.' };
  const otherSkill = { ...bar, hypothesisId: 'h4', scope: { ...scope, skillId: 'NF001-04', subskillId: 'NF001-04-a' }, summary: 'Other skill.' };
  const { packet } = signedPacket([bar, sibling, otherGrade, otherSkill]);
  expect(publishedScopeFor(packet, task)).toEqual({ subject: 'MATHEMATICS', grade: '3', skill_id: 'NF001-03', subskill_id: 'NF001-03-b', curriculum_version: 'synthetic-v1' });
  expect(publishedScopeFor(packet, { ...task, grade: 'Grade 3' })).not.toBeNull();
  for (const patch of [{ grade: '4' }, { grade: 'elementary' }, { subject: 'SCIENCE' }, { subskillId: 'NF001-03-z' }, { skillId: 'NF001-09' }, { subskillId: undefined }]) {
    expect(publishedScopeFor(packet, { ...task, ...patch })).toBeNull();
  }
  const delivered = scopedObservations(packet, task);
  expect(delivered.map(o => o.summary)).toEqual(['Sibling subskill, same skill.', 'Swaps numerator and denominator roles.']);
  expect(delivered[1]).toEqual({ id: expect.stringMatching(/^observation-[0-9a-f]{16}$/), summary: bar.summary,
    evidence: '{"problem":"Fraction bar build","evalMode":"build","phases":[{"phase":"numerator","challenge":"3/4 numerator?","expected":"3","observed":"4","support":"Attempt 1"}]}' });
  expect(new Set(delivered.map(o => o.id)).size).toBe(2);
  expect(JSON.stringify(delivered)).not.toMatch(/h1|h2|fraction-bar|revision|synthetic-v1/);
  expect(scopedObservations(packet, { ...task, grade: '5' })).toEqual([]);
});

it('a lesson that did not resolve an objective delivers nothing for it, even with matching hypotheses', () => {
  const packet = { ...packetFixture([scope], [hypothesisFixture(bar)]), scopes: [{ subskillId: scope.subskillId, skillId: scope.skillId, published: null }] };
  expect(scopedObservations(packet, task)).toEqual([]);
  expect(retestHypothesis(packet, 'fraction-bar', task)).toBeNull();
});

it('follows lineage on the stamped skill and delivers the newest ten', () => {
  const renamed = Array.from({ length: 12 }, (_, i) => hypothesisFixture({ ...bar, hypothesisId: `r${i}`, lastDetectedAt: `2026-09-${String(i + 1).padStart(2, '0')}`,
    scope: { ...scope, skillId: 'OLD-03' }, evidence: { ...evidence, phases: Array(60).fill(evidence.phases[0]) } }));
  const packet = packetFixture([scope], renamed.map(h => ({ ...h, skillId: 'NF001-03' })));
  const delivered = scopedObservations(packet, task);
  expect(delivered).toHaveLength(10);
  expect(delivered.every(o => o.evidence!.length <= EVIDENCE_BUDGET)).toBe(true);
  expect(new Set(delivered.map(o => o.id)).size).toBe(10);
});

it('bounds evidence by dropping trailing phases whole', () => {
  const big = { ...evidence, phases: Array(80).fill({ ...evidence.phases[0], observed: 'x'.repeat(100) }) };
  const bounded = boundedEvidence(big);
  expect(bounded.length).toBeLessThanOrEqual(EVIDENCE_BUDGET);
  expect(JSON.parse(bounded).phases.length).toBeGreaterThan(30);
  expect(boundedEvidence({ ...evidence, phases: [] })).toBe('{"problem":"Fraction bar build","evalMode":"build","phases":[]}');
});

it('a retest consumer gets only its own hypothesis at exactly the live published scope', () => {
  const chart = { primitiveType: 'place-value-chart', scope: { subject: 'MATHEMATICS', grade: '4', skillId: 'NBT004-01', subskillId: 'NBT004-01-b' },
    summary: 'Bare digit for worth.', hypothesisId: 'h', revision: 4 };
  const chartTask = { subject: 'MATHEMATICS', grade: '4', skillId: 'NBT004-01', subskillId: 'NBT004-01-b' };
  const { packet } = signedPacket([chart, { ...chart, primitiveType: 'base-ten-blocks', hypothesisId: 'blocks', summary: 'Blocks origin.' }]);
  expect(retestHypothesis(packet, 'place-value-chart', chartTask)).toEqual({ hypothesis_id: 'h', revision: 4, focus: 'Bare digit for worth.',
    scope: { subject: 'MATHEMATICS', grade: '4', skill_id: 'NBT004-01', subskill_id: 'NBT004-01-b', curriculum_version: 'synthetic-v1' } });
  expect(retestHypothesis(packet, 'fraction-bar', chartTask)).toBeNull();
  // Stamped under an older publication, or without identity: no retest, though shared delivery still sees it.
  const stale = signedPacket([{ ...chart, scope: { ...chart.scope, curriculumVersion: 'older@0' } }]).packet;
  stale.scopes[0].published!.curriculum_version = 'synthetic-v1';
  expect(retestHypothesis(stale, 'place-value-chart', chartTask)).toBeNull();
  expect(scopedObservations(stale, chartTask)).toHaveLength(1);
  expect(retestHypothesis(signedPacket([{ ...chart, revision: undefined }]).packet, 'place-value-chart', chartTask)).toBeNull();
  expect(retestHypothesis(signedPacket([{ ...chart, scope: { ...chart.scope, subskillId: 'NBT004-01-a' } }]).packet, 'place-value-chart', chartTask)).toBeNull();
});
