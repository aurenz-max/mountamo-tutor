import { describe, expect, it } from 'vitest';
import type { ComponentDefinition, ExhibitManifest, IntroBriefingData, ManifestItem } from '../../../types';
import { buildLessonPackage, emptyHumanLabel, type LessonPackage } from './lessonPackage';
import {
  DI_QUEUE,
  LENGTH_CAP_MINUTES,
  LESSON_BENCH_QUEUE,
  LESSON_SCOPE,
  blocksOf,
  machineVsHuman,
  resolveLessonBand,
  scoreLessonPackage,
  triageLabel,
} from './lessonBenchScorer';

// A synthetic catalog: every axis the scorer reads, nothing it does not.
const id = (s: string) => s as ComponentDefinition['id'];
const mode = (evalMode: string) => ({ evalMode, label: evalMode, beta: 1, scaffoldingMode: 1, challengeTypes: [], description: '' });
const CATALOG: ComponentDefinition[] = [
  { id: id('concrete-thing'), description: '', supportsEvaluation: true, evalModes: [mode('count')],
    affordances: { representation: 'concrete', reader: 'none', answers: ['spoken', 'build'], role: 'apply', minutes: 5 } },
  { id: id('symbol-grid'), description: '', supportsEvaluation: true, evalModes: [mode('highlight')],
    affordances: { representation: 'symbolic', answers: ['tap'], role: ['visualize', 'apply'], minutes: 5 } },
  { id: id('reader-block'), description: '',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['tap'], role: 'introduce', minutes: 3 } },
  { id: id('home-card'), description: '',
    affordances: { audience: 'caregiver', representation: 'concrete', answers: ['manipulate'], role: 'apply', minutes: 10, maxPerLesson: 1 } },
  { id: id('untagged'), description: '' },
  { id: id('checker'), description: '', supportsEvaluation: true, evalModes: [mode('recall'), mode('apply')],
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'tap'], role: 'assess', minutes: 4, maxPerLesson: 1 } },
];

const brief = {
  hook: { content: 'hook' },
  objectives: [{ id: 'obj1', text: 'o1', verb: 'apply', icon: '1' }, { id: 'obj2', text: 'o2', verb: 'apply', icon: '2' }],
} as unknown as IntroBriefingData;

type Block = [componentId: string, instanceId: string, objective: string, pin?: string];

function pkgWith(blocks: Block[], opts: { gradeLevel?: string; subject?: string; final?: Block } = {}): LessonPackage {
  const gradeLevel = opts.gradeLevel ?? 'kindergarten';
  const item = ([componentId, instanceId, objective, pin]: Block): ManifestItem => ({
    componentId, instanceId, title: instanceId, intent: '',
    config: { objectiveGrade: gradeLevel, ...(pin ? { targetEvalMode: pin } : {}) },
    objectiveIds: [objective],
  } as unknown as ManifestItem);
  const layout: ManifestItem[] = [
    { componentId: 'curator-brief', instanceId: 'brief', title: 'brief', intent: '' } as unknown as ManifestItem,
    ...blocks.map(item),
    ...(opts.final ? [item(opts.final)] : []),
  ];
  const manifest = {
    topic: 'Counting to 10', gradeLevel, subject: opts.subject ?? 'MATHEMATICS', themeColor: '#fff', objectiveBlocks: [], layout,
    ...(opts.final ? { finalAssessment: { componentId: opts.final[0], instanceId: opts.final[1], title: 'final', intent: '' } } : {}),
  } as unknown as ExhibitManifest;
  const built = buildLessonPackage({ manifest, curatorBrief: brief, components: [], source: 'test', id: 'test-pkg' });
  if ('error' in built) throw new Error(built.error);
  return built;
}

const score = (pkg: LessonPackage) => scoreLessonPackage(pkg, CATALOG, { now: new Date(0) });
const cites = (s: ReturnType<typeof score>, checkId: string) => (s.citations ?? []).filter((c) => c.checkId === checkId);

describe('band resolution', () => {
  it('reads the canonical grade off the stamped objectiveGrade, then the band string', () => {
    expect(resolveLessonBand(pkgWith([['concrete-thing', 'a', 'obj1']]))).toMatchObject({ grade: 'K', preReader: true, k2: true });
    expect(resolveLessonBand(pkgWith([['concrete-thing', 'a', 'obj1']], { gradeLevel: 'Grade 2' }))).toMatchObject({ grade: '2', preReader: false, k2: true });
    expect(resolveLessonBand(pkgWith([['concrete-thing', 'a', 'obj1']], { gradeLevel: 'elementary (grades 1-5)' }))).toMatchObject({ grade: undefined, preReader: false, k2: false });
  });
});

describe('Tier A scorer', () => {
  it('passes a clean K lesson and reports what it could not decide', () => {
    const s = score(pkgWith([['concrete-thing', 'ct', 'obj1', 'count'], ['symbol-grid', 'sg', 'obj1', 'highlight']], { final: ['checker', 'kc', 'obj1', 'recall|apply'] }));
    expect(s.bucket).toBe('RUNNABLE');
    expect(s.gates).toEqual({ G1: 1, G4: 1, G6: 1 });
    expect(s.checks).toEqual({ Q8: 1, Q3: 1, Q6: 1, Q7: 1, Q9: 1 });
    expect(s.holistic).toEqual([]);
    // symbol-grid has no reader verdict → unknown on Q8, never a fail
    expect((s.unknowns ?? []).some((u) => u.checkId === 'Q8' && u.instanceId === 'sg')).toBe(true);
    expect(s.evidence).toMatchObject({ minutes: 14, knownMinuteBlocks: 3, streamBlocks: 3, tapOnlyProduction: ['symbol-grid[highlight]'] });
  });

  it('Q3: a symbolic-only opener fails; an untagged block ahead of it makes the order unknown', () => {
    const fail = score(pkgWith([['symbol-grid', 'sg', 'obj1'], ['concrete-thing', 'ct', 'obj1']]));
    expect(fail.checks.Q3).toBe(0);
    expect(cites(fail, 'Q3')).toEqual([{ instanceId: 'sg', checkId: 'Q3', note: expect.stringContaining('opens obj1 on symbols') }]);

    const unknown = score(pkgWith([['untagged', 'u', 'obj1'], ['symbol-grid', 'sg', 'obj1']]));
    expect(unknown.checks.Q3).toBe(1);
    expect((unknown.unknowns ?? []).some((u) => u.checkId === 'Q3' && u.instanceId === 'sg')).toBe(true);

    // per objective: a symbolic block after a concrete one in ANOTHER objective still needs its own opener
    const perObjective = score(pkgWith([['concrete-thing', 'ct', 'obj1'], ['symbol-grid', 'sg', 'obj2']]));
    expect(perObjective.checks.Q3).toBe(0);
  });

  it('G1 + Q8: a block the child must read fails the pre-reader band and is fine at grade 3', () => {
    const k = score(pkgWith([['reader-block', 'rb', 'obj1'], ['concrete-thing', 'ct', 'obj1']]));
    expect(k.gates.G1).toBe(0);
    expect(k.checks.Q8).toBe(0);
    expect(k.bucket).toBe('BROKEN');
    expect(cites(k, 'G1')[0]).toMatchObject({ instanceId: 'rb' });
    const g3 = score(pkgWith([['reader-block', 'rb', 'obj1'], ['concrete-thing', 'ct', 'obj1']], { gradeLevel: 'Grade 3' }));
    expect(g3.gates.G1).toBe(1);
    expect(g3.checks.Q8).toBe(1);
  });

  it('caregiver blocks leave the stream: excluded from Q8/Q9, listed as parent cards, capped by maxPerLesson', () => {
    const pkg = pkgWith([['concrete-thing', 'ct', 'obj1'], ['home-card', 'home', 'obj1'], ['symbol-grid', 'sg', 'obj1']]);
    const { stream, parentCards } = blocksOf(pkg, CATALOG);
    expect(stream.map((b) => b.instanceId)).toEqual(['ct', 'sg']);
    expect(parentCards.map((b) => b.instanceId)).toEqual(['home']);
    const s = score(pkg);
    expect(s.evidence).toMatchObject({ parentCards: ['home'], parentCardMinutes: 10, minutes: 10 });
    expect((s.unknowns ?? []).some((u) => u.instanceId === 'home')).toBe(false);

    const twice = score(pkgWith([['concrete-thing', 'ct', 'obj1'], ['home-card', 'h1', 'obj1'], ['symbol-grid', 'sg', 'obj2'], ['home-card', 'h2', 'obj2']]));
    expect(twice.checks.Q6).toBe(0);
    expect(cites(twice, 'Q6')).toEqual([{ instanceId: 'h2', checkId: 'Q6', note: expect.stringContaining('max 1/lesson') }]);
  });

  it('Q3: an objective whose target IS notation may open on symbols — unknown, with the objective quoted', () => {
    const pkg = pkgWith([['symbol-grid', 'sg', 'obj1'], ['concrete-thing', 'ct', 'obj1']]);
    pkg.manifest.layout!.forEach((i) => {
      if (i.objectiveIds?.[0] === 'obj1') (i.config as Record<string, unknown>).objectiveText = 'Match written numerals 1-10 to groups of objects';
    });
    const s = score(pkg);
    expect(s.checks.Q3).toBe(1);
    expect((s.unknowns ?? []).find((u) => u.checkId === 'Q3')?.note).toContain('targets notation');
    expect(s.evidence?.notationObjectives).toEqual(['obj1']);
  });

  it('Q6: back-to-back same primitive+mode fails; a different mode does not; one primitive alone fails', () => {
    expect(score(pkgWith([['concrete-thing', 'a', 'obj1', 'count'], ['concrete-thing', 'b', 'obj1', 'count'], ['symbol-grid', 'c', 'obj1']])).checks.Q6).toBe(0);
    expect(score(pkgWith([['checker', 'a', 'obj1', 'recall'], ['checker', 'b', 'obj1', 'apply']])).checks.Q6).toBe(0); // maxPerLesson 1
    expect(score(pkgWith([['concrete-thing', 'a', 'obj1', 'count'], ['symbol-grid', 'b', 'obj1'], ['concrete-thing', 'c', 'obj1', 'count']])).checks.Q6).toBe(1);
    const lonely = score(pkgWith([['concrete-thing', 'a', 'obj1', 'count']]));
    expect(lonely.checks.Q6).toBe(0);
    expect(cites(lonely, 'Q6')[0].instanceId).toBe(LESSON_SCOPE);
  });

  it('G4: a pinned mode the catalog lacks is a gate failure; mixed and a|b pins resolve', () => {
    const bad = score(pkgWith([['concrete-thing', 'a', 'obj1', 'nope'], ['symbol-grid', 'b', 'obj1']]));
    expect(bad.gates.G4).toBe(0);
    expect(bad.bucket).toBe('BROKEN');
    expect(score(pkgWith([['checker', 'a', 'obj1', 'mixed'], ['concrete-thing', 'b', 'obj1']])).gates.G4).toBe(1);
    expect(score(pkgWith([['checker', 'a', 'obj1', 'recall|apply'], ['concrete-thing', 'b', 'obj1']])).gates.G4).toBe(1);
    expect(score(pkgWith([['ghost', 'a', 'obj1'], ['concrete-thing', 'b', 'obj1']])).gates.G4).toBe(0);
  });

  it('Q7: no evaluable block means nothing feeds IRT', () => {
    const s = score(pkgWith([['reader-block', 'a', 'obj1'], ['untagged', 'b', 'obj1']], { gradeLevel: 'Grade 3' }));
    expect(s.checks.Q7).toBe(0);
    expect(cites(s, 'Q7')[0].instanceId).toBe(LESSON_SCOPE);
  });

  it('Q9: known minutes over the band cap is too-long, with the cap in the note', () => {
    const many: Block[] = Array.from({ length: 8 }, (_, i) => ['concrete-thing', `c${i}`, 'obj1', 'count'] as Block);
    const s = score(pkgWith(many.flatMap((b, i) => (i % 2 ? [b] : [b, ['symbol-grid', `s${i}`, 'obj1']]))));
    expect(s.evidence?.minutes).toBeGreaterThan(LENGTH_CAP_MINUTES.preReader);
    expect(s.checks.Q9).toBe(0);
    expect(cites(s, 'Q9')[0].note).toContain(`cap of ${LENGTH_CAP_MINUTES.preReader}`);
  });

  it('G6: tap-only production fails a K-2 LITERACY lesson; a math lesson records it as evidence only', () => {
    const la = score(pkgWith([['concrete-thing', 'ct', 'obj1'], ['symbol-grid', 'sg', 'obj1']], { subject: 'LANGUAGE_ARTS' }));
    expect(la.gates.G6).toBe(0);
    expect(cites(la, 'G6')[0].instanceId).toBe('sg');
    const math = score(pkgWith([['concrete-thing', 'ct', 'obj1'], ['symbol-grid', 'sg', 'obj1']]));
    expect(math.gates.G6).toBe(1);
    expect(math.evidence?.tapOnlyProduction).toEqual(['symbol-grid']);
    const older = score(pkgWith([['concrete-thing', 'ct', 'obj1'], ['symbol-grid', 'sg', 'obj1']], { subject: 'LANGUAGE_ARTS', gradeLevel: 'Grade 4' }));
    expect(older.gates.G6).toBe(1);
  });
});

describe('machine vs human', () => {
  it('compares per check, cites blocks on both sides, and separates unrouted and parent-card labels', () => {
    const pkg = pkgWith([['symbol-grid', 'sg', 'obj1'], ['concrete-thing', 'ct', 'obj1'], ['home-card', 'home', 'obj1']], { final: ['checker', 'kc', 'obj1', 'recall'] });
    const s = score(pkg);
    const human = { ...emptyHumanLabel(), holistic: 4, blocks: {
      sg: { reaction: 'fix' as const, reasons: ['symbols-first'], note: '' },
      home: { reaction: 'cut' as const, reasons: ['too-much-reading'], note: '' },
      kc: { reaction: 'fix' as const, reasons: [], note: 'says the answer, then has to click too' },
    } };
    const a = machineVsHuman(s, human, new Set(s.evidence?.parentCards as string[]));
    const q3 = a.rows.find((r) => r.checkId === 'Q3')!;
    expect(q3).toMatchObject({ machine: 0, human: 'fail', agree: true, humanBlocks: ['sg'], machineBlocks: ['sg'] });
    // the human's Q8 on the parent card: the machine no longer scores that block in the child's stream
    const q8 = a.rows.find((r) => r.checkId === 'Q8')!;
    expect(q8).toMatchObject({ machine: 1, human: 'fail', agree: false, humanBlocks: ['home'] });
    expect(a.parentCardLabels).toEqual([{ instanceId: 'home', reaction: 'cut', reasons: ['too-much-reading'] }]);
    expect(a.unrouted).toEqual([{ instanceId: 'kc', reaction: 'fix', note: 'says the answer, then has to click too' }]);
    expect(a.rows.find((r) => r.checkId === 'Q1')!.agree).toBeNull(); // Tier B check
    expect(a.scored).toBe(8);
    expect(a.agreed).toBe(7);
    expect(a.holistic).toBe(4);
  });
});

describe('triage', () => {
  it('routes every fix/cut and lesson reason to a layer, an executor and a queue', () => {
    const pkg = pkgWith([['symbol-grid', 'sg', 'obj1'], ['concrete-thing', 'ct', 'obj1', 'count'], ['home-card', 'home', 'obj1'], ['checker', 'kc', 'obj2', 'recall|apply']]);
    pkg.human = { ...emptyHumanLabel(), holistic: 3, lessonReasons: ['too-long'], blocks: {
      sg: { reaction: 'fix', reasons: ['symbols-first'], note: '' },
      home: { reaction: 'cut', reasons: ['too-much-reading'], note: '' },
      kc: { reaction: 'fix', reasons: [], note: 'pre-reader, the student says the answer, but then they need to click on the answer too?' },
      ct: { reaction: 'fix', reasons: ['should-be-spoken', 'too-few-problems'], note: '' },
    } };
    const entries = triageLabel(pkg, CATALOG);
    const by = (instanceId: string | undefined, reason: string | null) => entries.find((e) => e.instanceId === instanceId && e.reason === reason)!;
    expect(by(undefined, 'too-long')).toMatchObject({ scope: 'lesson', checkId: 'Q9', layer: 'SELECTION', queue: LESSON_BENCH_QUEUE });
    expect(by('sg', 'symbols-first')).toMatchObject({ layer: 'SELECTION', executor: expect.stringContaining('/add-affordances symbol-grid'), checkId: 'Q3' });
    expect(by('home', 'too-much-reading')).toMatchObject({ layer: 'ASSEMBLY', checkId: 'Q8' });
    expect(by('kc', null)).toMatchObject({ layer: 'TUTOR', queue: DI_QUEUE, executor: expect.stringContaining('/add-di-loop checker') });
    expect(by('ct', 'should-be-spoken')).toMatchObject({ layer: 'COMPONENT', queue: DI_QUEUE });
    expect(by('ct', 'too-few-problems')).toMatchObject({ layer: 'CONTENT', executor: '/eval-fix concrete-thing' });
    expect(entries).toHaveLength(6);
  });

  it('a fix with no reason and no routable note stays UNROUTED rather than guessed', () => {
    const pkg = pkgWith([['concrete-thing', 'ct', 'obj1']]);
    pkg.human = { ...emptyHumanLabel(), blocks: { ct: { reaction: 'fix', reasons: [], note: 'meh' } } };
    expect(triageLabel(pkg, CATALOG)[0]).toMatchObject({ layer: 'UNROUTED' });
  });
});
