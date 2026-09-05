/**
 * LIVE calibration of the objective-coverage judge — skipped unless LIVE_GEMINI=1.
 *
 * The mocked suite proves the machinery; this proves the JUDGE reads the
 * digest the way the five fixtures demand. Each run appends its rows to
 * qa/lesson-coverage/evals.jsonl with source `live-test`, so the model's
 * drift over time is queryable with `scripts/lesson-coverage.mjs report`.
 *
 * Run:  GEMINI_API_KEY=... LIVE_GEMINI=1 npx vitest run lessonCoverage.live
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exhibitFromPackage, parseLessonPackage } from '../lessonBench/lessonPackage';
import { evaluateLessonCoverage } from './evaluateLessonCoverage';
import { FIXTURES } from './fixtures';
import { coverageLogLine, persistLessonCoverageEval } from './sink';
import type { LessonCoverageEval } from './types';

const LIVE = process.env.LIVE_GEMINI === '1';
const TIMEOUT = 120_000;
const PHONICS_PACKAGE = join(process.cwd(), 'qa/lesson-bench/journeys/packages/kindergarten-phonics-1-letter-sound-group-1-s-a-t-i-p-n-20260905124353-ecrf.json');

async function judge(name: keyof typeof FIXTURES): Promise<LessonCoverageEval> {
  const ev = await evaluateLessonCoverage(FIXTURES[name](), { source: 'live-test', lessonId: `fixture-${name}` });
  await persistLessonCoverageEval(ev, { console: false });
  console.log(coverageLogLine(ev));
  expect(ev.status).not.toBe('error');
  return ev;
}

describe.skipIf(!LIVE)('coverage judge — live fixtures', () => {
  it('1 full coverage → ASSESSED_SUFFICIENTLY with three cited find-it items', async () => {
    const ev = await judge('fullCoverage');
    expect(ev.objectives[0].category).toBe('ASSESSED_SUFFICIENTLY');
    expect(ev.objectives[0].assessmentCount).toBeGreaterThanOrEqual(2);
    expect(ev.objectives[0].assessmentEvidence.every((id) => id.startsWith('obj1-spotter#challenges['))).toBe(true);
    expect(ev.blockingFailure).toBe(false);
  }, TIMEOUT);

  it('2 taught but not tested → lowercase m is TAUGHT_NOT_ASSESSED · CRITICAL', async () => {
    const ev = await judge('taughtNotTested');
    const m = ev.objectives.find((o) => o.objectiveId === 'obj2')!;
    expect(m.category).toBe('TAUGHT_NOT_ASSESSED');
    expect(m.severity).toBe('CRITICAL');
    expect(m.taught).toBe(true);
    expect(ev.blockingFailure).toBe(true);
  }, TIMEOUT);

  it('3 declared objective absent → NOT_TAUGHT · CRITICAL, generation failure detected', async () => {
    const ev = await judge('missingObjective');
    const t = ev.objectives.find((o) => o.objectiveId === 'obj2')!;
    expect(t.category).toBe('NOT_TAUGHT');
    expect(t.severity).toBe('CRITICAL');
    expect(ev.detectedConstraints.some((c) => c.type === 'generation_failure')).toBe(true);
  }, TIMEOUT);

  it('4 indirect → tapping the letter is not producing its sound', async () => {
    const ev = await judge('indirectAssessment');
    expect(['ASSESSED_INDIRECTLY', 'ASSESSED_INSUFFICIENTLY']).toContain(ev.objectives[0].category);
    expect(ev.objectives[0].masteryInferenceSupported).toBe(false);
  }, TIMEOUT);

  it('5 guard-induced → /t/ objective has zero assessment; content_guard cites the reporting block', async () => {
    const ev = await judge('guardInduced');
    const t = ev.objectives.find((o) => o.objectiveId === 'obj2')!;
    expect(t.assessmentCount).toBe(0);
    expect(['TAUGHT_NOT_ASSESSED', 'NOT_TAUGHT']).toContain(t.category);
    expect(t.severity).toBe('CRITICAL');
    const guard = ev.detectedConstraints.find((c) => c.type === 'content_guard');
    expect(guard).toBeDefined();
    expect(['obj1-di-sounds', 'obj2-sound-link']).toContain(guard!.instanceId);
  }, TIMEOUT);

  it.skipIf(!existsSync(PHONICS_PACKAGE))('the real phonics-1 package: the six-letter set is not SUFFICIENT while t and p are unaskable', async () => {
    const pkg = parseLessonPackage(JSON.parse(readFileSync(PHONICS_PACKAGE, 'utf8')));
    const ev = await evaluateLessonCoverage(exhibitFromPackage(pkg), { source: 'live-test', lessonId: pkg.id });
    await persistLessonCoverageEval(ev, { console: false });
    console.log(coverageLogLine(ev));
    console.log(JSON.stringify({ summary: ev.summary, constraints: ev.detectedConstraints }, null, 2));
    expect(ev.status).not.toBe('error');
    const production = ev.objectives.find((o) => o.objectiveId === 'obj2')!;
    expect(production.category).not.toBe('ASSESSED_SUFFICIENTLY');
    expect(ev.detectedConstraints.some((c) => c.type === 'content_guard')).toBe(true);
  }, TIMEOUT);
});
