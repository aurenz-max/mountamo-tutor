/**
 * Objective-coverage eval — pipeline tests with the model mocked.
 *
 * These prove the machinery around the judge: the digest exposes what the
 * judge must see (item ids, generator-reported residuals, missing blocks),
 * the code-side rules hold whatever the model says (uncited credit withheld,
 * unassessed = CRITICAL, unknown ids discarded), failures never throw, the
 * kill switch works, and a row lands in evals.jsonl. The judge's own
 * calibration is `lessonCoverage.live.test.ts` (LIVE_GEMINI=1).
 */
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ai } from '../../geminiClient';
import { exhibitFromPackage, parseLessonPackage } from '../lessonBench/lessonPackage';
import { buildLessonDigest, renderDigest } from './digest';
import { assembleEval, buildCoveragePrompt, evaluateLessonCoverage, normalizeObjective, normalizeVerdict } from './evaluateLessonCoverage';
import { FIXTURES } from './fixtures';
import { isLessonCoverageEvalEnabled } from './config';
import { runLessonCoverageShadowEval } from './shadow';
import { coverageToLessonBenchSignals } from './toLessonBench';
import type { LessonCoverageEval } from './types';

vi.mock('../../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
const generateContent = vi.mocked(ai.models.generateContent);

const respond = (verdict: unknown) => generateContent.mockResolvedValueOnce({ text: JSON.stringify(verdict) } as never);
const metaStub = { evalModel: 'test', evalTimestamp: new Date(0).toISOString(), latencyMs: 0, usedSchemaFallback: false, source: 'test' };

const PHONICS_PACKAGE = join(process.cwd(), 'qa/lesson-bench/journeys/packages/kindergarten-phonics-1-letter-sound-group-1-s-a-t-i-p-n-20260905124353-ecrf.json');

beforeEach(() => {
  generateContent.mockReset();
  process.env.LUMINA_COVERAGE_EVAL = '1';
});

describe('digest', () => {
  it('joins objectives, enumerates citable item ids, and surfaces generator-reported residuals', () => {
    const d = buildLessonDigest(FIXTURES.guardInduced());
    expect(d.objectives.map((o) => o.id)).toEqual(['obj1', 'obj2']);
    expect(d.objectives[0].instanceIds).toEqual(['obj1-cards', 'obj1-di-sounds']);
    expect(d.objectives[1].instanceIds).toEqual(['obj2-sound-link']);
    expect(d.evidenceIds).toContain('obj1-di-sounds#challenges[3]');
    expect(d.evidenceIds).toContain('obj2-sound-link#challenges[1]');
    expect(d.evidenceIds).toContain('obj1-cards#cards[2]');
    const di = d.blocks.find((b) => b.instanceId === 'obj1-di-sounds')!;
    expect(di.generatorReported).toEqual([{ key: 'unaskableLetters', value: '["t"]' }]);
    expect(di.items[0].text).toContain('letter=s');
    expect(di.items[0].text).toContain('(id=dils-1-s)');
    // Catalog facts ride along: DI letter sounds is a spoken block.
    expect(di.answers).toContain('spoken');
    const text = renderDigest(d);
    expect(text).toContain('GENERATOR-REPORTED RESIDUAL: unaskableLetters=["t"]');
    expect(text).toContain('obj1-di-sounds#challenges[0]');
    expect(buildCoveragePrompt(d)).toContain('unaskableLetters=["t"]');
  });

  it('aliases each item content id to its citation pointer so a judge citing the item by its own id validates', () => {
    const d = buildLessonDigest(FIXTURES.guardInduced());
    // The di-letter-sounds items carry ids dils-1-s … the citation pointer is obj1-di-sounds#challenges[i].
    expect(d.evidenceAliases['dils-1-s']).toBe('obj1-di-sounds#challenges[0]');
    expect(d.evidenceAliases['dils-4-a']).toBe('obj1-di-sounds#challenges[3]');
    // An alias never shadows a real pointer, and reused content ids are dropped, not mis-credited.
    expect(Object.keys(d.evidenceAliases).every((k) => !d.evidenceIds.includes(k))).toBe(true);
  });

  it('lists blocks the manifest planned but generation dropped', () => {
    const d = buildLessonDigest(FIXTURES.missingObjective());
    expect(d.missingBlocks).toEqual([{ instanceId: 'obj2-spotter', componentId: 'letter-spotter', title: 'Spot the T', objectiveIds: ['obj2'] }]);
    expect(d.evidenceIds).not.toContain('obj2-spotter');
    expect(renderDigest(d)).toContain('MISSING BLOCKS');
  });

  it('skips visual noise, truncates long leaves, and never emits data: URIs', () => {
    const ex = FIXTURES.fullCoverage();
    const block = ex.orderedComponents!.find((c) => c.instanceId === 'obj1-cards')!;
    block.data.cards[0].visualPrompt = 'a very long prompt '.repeat(50);
    block.data.cards[0].image = `data:image/png;base64,${'A'.repeat(5000)}`;
    block.data.cards[0].definition = 'x'.repeat(400);
    const d = buildLessonDigest(ex);
    const card = d.blocks.find((b) => b.instanceId === 'obj1-cards')!.items[0].text;
    expect(card).not.toContain('visualPrompt');
    expect(card).not.toContain('base64');
    expect(card).toContain('definition=' + 'x'.repeat(160) + '…');
  });

  it.skipIf(!existsSync(PHONICS_PACKAGE))('digests a real Lesson Bench package the way the runtime would', () => {
    const pkg = parseLessonPackage(JSON.parse(readFileSync(PHONICS_PACKAGE, 'utf8')));
    const d = buildLessonDigest(exhibitFromPackage(pkg));
    expect(d.objectives).toHaveLength(2);
    expect(d.objectives[0].subskillId).toMatch(/^LANGUAGE_ARTS-/);
    expect(d.blocks.map((b) => b.componentId)).toEqual(['concept-card-grid', 'letter-spotter', 'di-letter-sounds', 'letter-sound-link', 'phoneme-explorer', 'knowledge-check']);
    const reported = d.blocks.flatMap((b) => b.generatorReported.map((r) => `${b.instanceId}:${r.key}=${r.value}`));
    expect(reported).toEqual(['obj1-di-sounds:unaskableLetters=["t","p"]', 'obj2-sound-link:unaskableLetters=["t","p"]']);
    // The final assessment spans both objectives and its problems are citable.
    expect(d.objectives.every((o) => o.instanceIds.includes('final-sound-check'))).toBe(true);
    expect(d.evidenceIds.some((id) => id.startsWith('final-sound-check#problems['))).toBe(true);
    expect(d.chars).toBeLessThan(60_000);
    expect(d.truncated).toBe(false);
  });
});

describe('code-side rules', () => {
  const d = buildLessonDigest(FIXTURES.fullCoverage());
  const ids = new Set(d.evidenceIds);
  const obj = d.objectives[0];

  it('credits an item cited by its own content id via the alias, deduping against the pointer form', () => {
    const g = buildLessonDigest(FIXTURES.guardInduced());
    const gids = new Set(g.evidenceIds);
    const gobj = g.objectives[0]; // obj1: obj1-di-sounds carries dils-N challenges
    const r = normalizeObjective(gobj, {
      objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true,
      // Judge cites the item content ids (as the live phonics run did) plus one pointer for the same item.
      assessmentEvidence: ['dils-1-s', 'dils-2-a', 'obj1-di-sounds#challenges[0]'],
      instructionEvidence: [], masteryInferenceSupported: true, severity: 'NONE', notes: '',
    }, gids, g.evidenceAliases);
    expect(r.category).toBe('ASSESSED_SUFFICIENTLY');
    expect(r.assessmentCount).toBe(2); // dils-1-s and its pointer collapse to one
    expect(r.assessmentEvidence).toEqual(['obj1-di-sounds#challenges[0]', 'obj1-di-sounds#challenges[1]']);
    expect(r.discardedEvidence).toBeUndefined();
  });

  it('discards evidence ids that do not exist and withholds an uncited credit', () => {
    const r = normalizeObjective(obj, { objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['problem_4', 'primitive_12.problem_2'], instructionEvidence: [], masteryInferenceSupported: true, severity: 'NONE', notes: '' }, ids);
    expect(r.category).toBe('ASSESSED_INSUFFICIENTLY');
    expect(r.assessmentCount).toBe(0);
    expect(r.discardedEvidence).toEqual(['problem_4', 'primitive_12.problem_2']);
    expect(r.severity).toBe('WARNING');
    expect(r.masteryInferenceSupported).toBe(false);
  });

  it('needs at least two distinct items before SUFFICIENT stands', () => {
    const one = normalizeObjective(obj, { objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-spotter#challenges[0]', 'obj1-spotter#challenges[0]'], instructionEvidence: [], masteryInferenceSupported: true, severity: 'NONE', notes: '' }, ids);
    expect(one.category).toBe('ASSESSED_INSUFFICIENTLY');
    expect(one.assessmentCount).toBe(1);
    const three = normalizeObjective(obj, { objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-spotter#challenges[0]', 'obj1-spotter#challenges[1]', 'obj1-spotter#challenges[2]'], instructionEvidence: ['obj1-cards#cards[0]'], masteryInferenceSupported: true, severity: 'WARNING', notes: 'fine' }, ids);
    expect(three.category).toBe('ASSESSED_SUFFICIENTLY');
    expect(three.assessmentCount).toBe(3);
    expect(three.severity).toBe('INFO'); // SUFFICIENT is capped at INFO whatever the model said
    expect(three.masteryInferenceSupported).toBe(true);
  });

  it('forces CRITICAL on an unassessed declared objective and INFO on a missing judgment', () => {
    const notTaught = normalizeObjective(obj, { objectiveId: 'obj1', category: 'NOT_TAUGHT', taught: true, assessed: false, assessmentEvidence: [], instructionEvidence: [], masteryInferenceSupported: false, severity: 'INFO', notes: '' }, ids);
    expect(notTaught).toMatchObject({ category: 'NOT_TAUGHT', taught: false, assessed: false, severity: 'CRITICAL' });
    const taughtOnly = normalizeObjective(obj, { objectiveId: 'obj1', category: 'TAUGHT_NOT_ASSESSED', taught: true, assessed: false, assessmentEvidence: ['obj1-spotter#challenges[0]'], instructionEvidence: [], masteryInferenceSupported: false, severity: 'NONE', notes: '' }, ids);
    expect(taughtOnly).toMatchObject({ category: 'TAUGHT_NOT_ASSESSED', taught: true, assessed: false, assessmentCount: 0, severity: 'CRITICAL' });
    const missing = normalizeObjective(obj, undefined, ids);
    expect(missing).toMatchObject({ category: 'NOT_EVALUATED', severity: 'INFO' });
  });

  it('assembles status, blocking flag, coverage score and failure categories', () => {
    const d5 = buildLessonDigest(FIXTURES.guardInduced());
    const ev = normalizeVerdict(d5, {
      objectives: [
        { objectiveId: 'OBJ1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-di-sounds#challenges[0]', 'obj1-di-sounds#challenges[1]', 'obj1-di-sounds#challenges[2]', 'obj1-di-sounds#challenges[3]'], instructionEvidence: ['obj1-cards#cards[0]'], masteryInferenceSupported: true, severity: 'NONE', notes: '' },
        { objectiveId: 'obj2', category: 'TAUGHT_NOT_ASSESSED', taught: true, assessed: false, assessmentEvidence: [], instructionEvidence: ['obj1-cards#cards[2]'], masteryInferenceSupported: false, severity: 'CRITICAL', notes: 't never appears in a production item.' },
      ],
      detectedConstraints: [
        { type: 'content_guard', description: 'unaskableLetters reports t', instanceId: 'obj1-di-sounds' },
        { type: 'bogus', description: 'unknown type with a fake block', instanceId: 'nope' },
        { type: 'other', description: '' },
      ],
      summary: 'One of two objectives has no assessment surface.',
    }, metaStub, 'lesson-1');
    expect(ev.status).toBe('fail');
    expect(ev.blockingFailure).toBe(true);
    expect(ev.overallObjectiveCoverage).toBe(0.5);
    expect(ev.objectives[0].category).toBe('ASSESSED_SUFFICIENTLY'); // case-insensitive id join
    expect(ev.objectives[1]).toMatchObject({ category: 'TAUGHT_NOT_ASSESSED', severity: 'CRITICAL' });
    expect(ev.detectedConstraints).toEqual([
      { type: 'content_guard', description: 'unaskableLetters reports t', instanceId: 'obj1-di-sounds' },
      { type: 'other', description: 'unknown type with a fake block', instanceId: null },
    ]);
    expect(ev.meta).toMatchObject({ objectiveCount: 2, objectivesFullyCovered: 1, objectivesUncovered: 1, subject: 'LANGUAGE_ARTS', grade: 'K' });
    expect(ev.meta.failureCategories).toEqual(['TAUGHT_NOT_ASSESSED', 'constraint:content_guard', 'constraint:other']);
    expect(ev.meta.primitiveTypes).toEqual(['concept-card-grid', 'di-letter-sounds', 'letter-sound-link']);
  });

  it('scores an all-NOT_EVALUATED lesson as 0 and an errored eval as status error', () => {
    const ev = assembleEval(d, [normalizeObjective(obj, undefined, ids)], [], 'x', { ...metaStub, error: 'boom' }, 'l');
    expect(ev.status).toBe('error');
    expect(ev.overallObjectiveCoverage).toBe(0);
    expect(ev.blockingFailure).toBe(false);
  });
});

describe('the five cases, model mocked with valid citations', () => {
  const run = async (exhibit: ReturnType<typeof FIXTURES.fullCoverage>, verdict: unknown): Promise<LessonCoverageEval> => {
    respond(verdict);
    return evaluateLessonCoverage(exhibit, { source: 'test', lessonId: 'fixture' });
  };

  it('1 full coverage → ASSESSED_SUFFICIENTLY, pass', async () => {
    const ev = await run(FIXTURES.fullCoverage(), {
      objectives: [{ objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-spotter#challenges[0]', 'obj1-spotter#challenges[1]', 'obj1-spotter#challenges[2]'], instructionEvidence: ['obj1-cards#cards[0]'], masteryInferenceSupported: true, severity: 'NONE', notes: '' }],
      detectedConstraints: [],
      summary: 'ok',
    });
    expect(ev.status).toBe('pass');
    expect(ev.objectives[0]).toMatchObject({ category: 'ASSESSED_SUFFICIENTLY', assessmentCount: 3, severity: 'NONE', masteryInferenceSupported: true });
    expect(ev.overallObjectiveCoverage).toBe(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
    const call = generateContent.mock.calls[0][0] as { model: string; config: { responseSchema?: unknown } };
    expect(call.model).toBe('gemini-flash-latest');
    expect(call.config.responseSchema).toBeDefined();
  });

  it('2 taught but not tested → TAUGHT_NOT_ASSESSED, CRITICAL, fail', async () => {
    const ev = await run(FIXTURES.taughtNotTested(), {
      objectives: [
        { objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-spotter#challenges[0]', 'obj1-spotter#challenges[1]', 'obj1-spotter#challenges[2]'], instructionEvidence: ['obj1-cards#cards[0]'], masteryInferenceSupported: true, severity: 'NONE', notes: '' },
        { objectiveId: 'obj2', category: 'TAUGHT_NOT_ASSESSED', taught: true, assessed: false, assessmentEvidence: [], instructionEvidence: ['obj2-cards#cards[0]'], masteryInferenceSupported: false, severity: 'CRITICAL', notes: 'Lowercase m appears in instruction but every item targets uppercase M.' },
      ],
      detectedConstraints: [],
      summary: 'lowercase m never assessed',
    });
    expect(ev.status).toBe('fail');
    expect(ev.blockingFailure).toBe(true);
    expect(ev.objectives[1]).toMatchObject({ category: 'TAUGHT_NOT_ASSESSED', severity: 'CRITICAL', taught: true, assessed: false, assessmentCount: 0 });
  });

  it('3 declared objective absent → NOT_TAUGHT, CRITICAL, generation_failure constraint', async () => {
    const ev = await run(FIXTURES.missingObjective(), {
      objectives: [
        { objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-spotter#challenges[0]', 'obj1-spotter#challenges[1]'], instructionEvidence: ['obj1-cards#cards[0]'], masteryInferenceSupported: true, severity: 'NONE', notes: '' },
        { objectiveId: 'obj2', category: 'NOT_TAUGHT', taught: false, assessed: false, assessmentEvidence: [], instructionEvidence: [], masteryInferenceSupported: false, severity: 'CRITICAL', notes: 'No block contains T.' },
      ],
      detectedConstraints: [{ type: 'generation_failure', description: 'obj2-spotter was planned but never generated.' }],
      summary: 'T missing',
    });
    expect(ev.objectives[1]).toMatchObject({ category: 'NOT_TAUGHT', severity: 'CRITICAL', taught: false });
    expect(ev.detectedConstraints[0].type).toBe('generation_failure');
    expect(ev.meta.objectivesUncovered).toBe(1);
  });

  it('4 indirect → ASSESSED_INDIRECTLY, WARNING, warn (never a mastery inference)', async () => {
    const ev = await run(FIXTURES.indirectAssessment(), {
      objectives: [{ objectiveId: 'obj1', category: 'ASSESSED_INDIRECTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-spotter#challenges[0]', 'obj1-spotter#challenges[1]', 'obj1-spotter#challenges[2]'], instructionEvidence: ['obj1-cards#cards[0]'], masteryInferenceSupported: false, severity: 'INFO', notes: 'Items tap the letter; the child never produces /m/.' }],
      detectedConstraints: [{ type: 'off_target_assessment', description: 'find-it measures letterform recognition, not sound production', instanceId: 'obj1-spotter' }],
      summary: 'indirect',
    });
    expect(ev.status).toBe('warn');
    expect(ev.blockingFailure).toBe(false);
    expect(ev.objectives[0]).toMatchObject({ category: 'ASSESSED_INDIRECTLY', severity: 'WARNING', masteryInferenceSupported: false, assessmentCount: 3 });
    expect(ev.overallObjectiveCoverage).toBe(0.5);
  });

  it('5 guard-induced → the /t/ objective has zero assessment and a content_guard constraint names the block', async () => {
    const ev = await run(FIXTURES.guardInduced(), {
      objectives: [
        { objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-di-sounds#challenges[0]', 'obj1-di-sounds#challenges[1]', 'obj1-di-sounds#challenges[2]', 'obj1-di-sounds#challenges[3]'], instructionEvidence: ['obj1-cards#cards[0]', 'obj1-cards#cards[1]'], masteryInferenceSupported: true, severity: 'NONE', notes: '' },
        { objectiveId: 'obj2', category: 'TAUGHT_NOT_ASSESSED', taught: true, assessed: false, assessmentEvidence: [], instructionEvidence: ['obj1-cards#cards[2]'], masteryInferenceSupported: false, severity: 'CRITICAL', notes: 't is introduced on a card but no production item contains t; both spoken blocks report unaskableLetters=["t"].' },
      ],
      detectedConstraints: [
        { type: 'content_guard', description: 'di-letter-sounds reports unaskableLetters=["t"]: the continuant menu excluded the stop consonant.', instanceId: 'obj1-di-sounds' },
        { type: 'content_guard', description: 'letter-sound-link also reports unaskableLetters=["t"].', instanceId: 'obj2-sound-link' },
      ],
      summary: 'guard kept t out of assessment',
    });
    expect(ev.status).toBe('fail');
    expect(ev.objectives[1]).toMatchObject({ category: 'TAUGHT_NOT_ASSESSED', severity: 'CRITICAL', assessmentCount: 0 });
    expect(ev.detectedConstraints.map((c) => [c.type, c.instanceId])).toEqual([['content_guard', 'obj1-di-sounds'], ['content_guard', 'obj2-sound-link']]);
    expect(ev.meta.failureCategories).toContain('constraint:content_guard');
  });
});

describe('failure handling', () => {
  it('never throws: two failed calls → status error, every objective NOT_EVALUATED', async () => {
    generateContent.mockRejectedValueOnce(new Error('schema rejected')).mockRejectedValueOnce(new Error('network'));
    const ev = await evaluateLessonCoverage(FIXTURES.fullCoverage(), { source: 'test', lessonId: 'err' });
    expect(ev.status).toBe('error');
    expect(ev.meta.error).toBe('network');
    expect(ev.objectives.every((o) => o.category === 'NOT_EVALUATED')).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('falls back to loose JSON once and records it', async () => {
    generateContent.mockRejectedValueOnce(new Error('schema rejected'));
    generateContent.mockResolvedValueOnce({ text: 'Sure:\n```json\n{"objectives":[{"objectiveId":"obj1","category":"ASSESSED_SUFFICIENTLY","taught":true,"assessed":true,"assessmentEvidence":["obj1-spotter#challenges[0]","obj1-spotter#challenges[1]"],"instructionEvidence":[],"masteryInferenceSupported":true,"severity":"NONE","notes":""}],"detectedConstraints":[],"summary":"ok"}\n```' } as never);
    const ev = await evaluateLessonCoverage(FIXTURES.fullCoverage(), { source: 'test', lessonId: 'fb' });
    expect(ev.status).toBe('pass');
    expect(ev.meta.usedSchemaFallback).toBe(true);
    expect(ev.meta.schemaError).toBe('schema rejected');
    const second = generateContent.mock.calls[1][0] as { config: { responseSchema?: unknown } };
    expect(second.config.responseSchema).toBeUndefined();
  });

  it('returns an error eval with no model call when the lesson declares no objectives', async () => {
    const ex = FIXTURES.fullCoverage();
    ex.introBriefing!.objectives = [];
    ex.manifest!.objectiveBlocks = [];
    const ev = await evaluateLessonCoverage(ex, { source: 'test', lessonId: 'empty' });
    expect(ev.status).toBe('error');
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe('shadow mode', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'lesson-coverage-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.LUMINA_COVERAGE_EVAL; delete process.env.LUMINA_COVERAGE_EVAL_DIR; });

  it('config: explicit on/off wins, default is off in every environment', () => {
    expect(isLessonCoverageEvalEnabled({ LUMINA_COVERAGE_EVAL: 'off', NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isLessonCoverageEvalEnabled({ LUMINA_COVERAGE_EVAL: '1', NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isLessonCoverageEvalEnabled({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isLessonCoverageEvalEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isLessonCoverageEvalEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('disabled → no model call, null', async () => {
    process.env.LUMINA_COVERAGE_EVAL = '0';
    expect(await runLessonCoverageShadowEval(FIXTURES.fullCoverage(), { source: 'test' })).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('enabled → evaluates, appends one JSON row, swallows nothing into the caller', async () => {
    process.env.LUMINA_COVERAGE_EVAL = '1';
    process.env.LUMINA_COVERAGE_EVAL_DIR = dir;
    respond({ objectives: [{ objectiveId: 'obj1', category: 'ASSESSED_SUFFICIENTLY', taught: true, assessed: true, assessmentEvidence: ['obj1-spotter#challenges[0]', 'obj1-spotter#challenges[1]'], instructionEvidence: [], masteryInferenceSupported: true, severity: 'NONE', notes: '' }], detectedConstraints: [], summary: 'ok' });
    const ev = await runLessonCoverageShadowEval(FIXTURES.fullCoverage(), { source: 'test', lessonId: 'row-1', persist: { console: false } });
    expect(ev?.status).toBe('pass');
    const rows = readFileSync(join(dir, 'evals.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: 1, lessonId: 'row-1', status: 'pass', meta: { source: 'test', objectiveCount: 1 } });
  });

  it('a model failure still yields (and persists) an error row rather than throwing', async () => {
    process.env.LUMINA_COVERAGE_EVAL = '1';
    process.env.LUMINA_COVERAGE_EVAL_DIR = dir;
    generateContent.mockRejectedValue(new Error('down'));
    const ev = await runLessonCoverageShadowEval(FIXTURES.fullCoverage(), { source: 'test', lessonId: 'row-err', persist: { console: false } });
    expect(ev?.status).toBe('error');
    expect(readFileSync(join(dir, 'evals.jsonl'), 'utf8')).toContain('"lessonId":"row-err"');
  });

  it('an empty or absent exhibit is ignored', async () => {
    expect(await runLessonCoverageShadowEval(null, { source: 'test' })).toBeNull();
    expect(await runLessonCoverageShadowEval({ orderedComponents: [] } as never, { source: 'test' })).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe('Lesson Bench adapter (Q4 Coverage)', () => {
  const firstBlock = (id: string) => (id === 'obj1' ? 'obj1-cards' : id === 'obj2' ? 'obj2-cards' : undefined);
  const base = (objectives: LessonCoverageEval['objectives'], status: LessonCoverageEval['status'] = 'fail'): LessonCoverageEval =>
    ({ version: 1, lessonId: 'x', status, overallObjectiveCoverage: 0, blockingFailure: false, objectives, detectedConstraints: [], summary: '', meta: { ...metaStub, topic: '', gradeLevel: '', skillIds: [], subskillIds: [], primitiveTypes: [], digestChars: 0, truncated: false, objectiveCount: objectives.length, objectivesFullyCovered: 0, objectivesUncovered: 0, failureCategories: [] } });
  const objective = (objectiveId: string, category: LessonCoverageEval['objectives'][number]['category']): LessonCoverageEval['objectives'][number] =>
    ({ objectiveId, objective: objectiveId, category, taught: true, assessed: false, assessmentCount: 0, assessmentEvidence: [], instructionEvidence: [], masteryInferenceSupported: false, severity: 'CRITICAL', notes: 'n' });

  it('cites the objective block for every non-sufficient objective and fails Q4', () => {
    const s = coverageToLessonBenchSignals(base([objective('obj1', 'ASSESSED_SUFFICIENTLY'), objective('obj2', 'TAUGHT_NOT_ASSESSED')]), firstBlock);
    expect(s.checks).toEqual({ Q4: 0 });
    expect(s.citations).toEqual([{ instanceId: 'obj2-cards', checkId: 'Q4', note: 'obj2 TAUGHT_NOT_ASSESSED: n' }]);
  });

  it('passes Q4 when everything is sufficient and reports an errored eval as unknown', () => {
    expect(coverageToLessonBenchSignals(base([objective('obj1', 'ASSESSED_SUFFICIENTLY')], 'pass'), firstBlock).checks).toEqual({ Q4: 1 });
    const err = coverageToLessonBenchSignals(base([], 'error'), firstBlock);
    expect(err.checks).toEqual({});
    expect(err.unknowns[0].checkId).toBe('Q4');
  });
});
