import { describe, expect, it } from 'vitest';
import type { ExhibitManifest, IntroBriefingData } from '../../../types';
import { assembleExhibitFromContent } from '../../exhibitAssembly';
import {
  BLOCK_REASONS,
  LESSON_BENCH_CHECKS,
  LESSON_REASONS,
  LessonPackageError,
  buildLessonPackage,
  emptyHumanLabel,
  exhibitFromPackage,
  humanCheckSignals,
  isLabelTouched,
  packageFidelity,
  parseLessonPackage,
  type LessonPackage,
} from './lessonPackage';

const brief = {
  primitive: 'intro_briefing',
  topic: 'Counting to 10',
  subject: 'Mathematics',
  gradeLevel: 'Kindergarten',
  estimatedTime: '10 min',
  hook: { content: 'Look at all these bears!' },
  bigIdea: {},
  objectives: [{ id: 'obj1', text: 'count a group of objects', verb: 'apply', icon: '1' }],
  prerequisites: {},
  roadmap: [],
  connections: {},
  mindset: {},
} as unknown as IntroBriefingData;

const manifest = {
  topic: 'Counting to 10',
  gradeLevel: 'Kindergarten',
  themeColor: '#22d3ee',
  objectiveBlocks: [],
  layout: [
    { componentId: 'curator-brief', instanceId: 'brief-1', title: 'Welcome', intent: '' },
    { componentId: 'counting-board', instanceId: 'cb-1', title: 'Count the bears', intent: '', objectiveIds: ['obj1'] },
    { componentId: 'ten-frame', instanceId: 'tf-1', title: 'Ten frame', intent: '', objectiveIds: ['obj1'] },
  ],
} as unknown as ExhibitManifest;

const packageFixture = (): LessonPackage => {
  const built = buildLessonPackage({
    manifest,
    curatorBrief: brief,
    components: [
      { instanceId: 'cb-1', componentId: 'counting-board', data: { count: 7 } },
      { instanceId: 'tf-1', componentId: 'ten-frame', data: { filled: 4 } },
    ],
    source: 'test',
    id: 'k-counting-to-10-test',
  });
  if ('error' in built) throw new Error(built.error);
  return built;
};

describe('lessonPackage', () => {
  it('round-trips through JSON and replays in manifest layout order with __instanceId stamped', () => {
    const pkg = parseLessonPackage(JSON.parse(JSON.stringify(packageFixture())));
    const exhibit = exhibitFromPackage(pkg);
    expect(exhibit.orderedComponents?.map((c) => c.instanceId)).toEqual(['brief-1', 'cb-1', 'tf-1']);
    expect(exhibit.orderedComponents?.[0].data).toBe(pkg.curatorBrief);
    expect(exhibit.orderedComponents?.[1].data).toEqual({ count: 7, __instanceId: 'cb-1' });
    expect(exhibit.orderedComponents?.[1].objectiveIds).toEqual(['obj1']);
    expect(exhibit.intro.hook).toBe('Look at all these bears!');
    expect(exhibit.manifest).toBe(pkg.manifest);
  });

  it('drops layout blocks with no data on replay and reports them in fidelity', () => {
    const pkg = packageFixture();
    pkg.components = pkg.components.filter((c) => c.instanceId !== 'tf-1');
    expect(packageFidelity(pkg)).toEqual([
      { instanceId: 'cb-1', componentId: 'counting-board', title: 'Count the bears', present: true },
      { instanceId: 'tf-1', componentId: 'ten-frame', title: 'Ten frame', present: false },
    ]);
    expect(exhibitFromPackage(pkg).orderedComponents?.map((c) => c.instanceId)).toEqual(['brief-1', 'cb-1']);
  });

  it('rejects a package whose manifest lacks the flattened layout', () => {
    const raw = JSON.parse(JSON.stringify(packageFixture()));
    raw.manifest.layout = [];
    expect(() => parseLessonPackage(raw)).toThrow(LessonPackageError);
    expect(() => parseLessonPackage({ ...raw, benchVersion: 2 })).toThrow(/benchVersion/);
    expect(() => parseLessonPackage('nope')).toThrow(/JSON object/);
  });

  it('assembly skips failed content and matches the builder contract', () => {
    const map = new Map([
      ['cb-1', { instanceId: 'cb-1', data: { count: 3 } }],
      ['tf-1', { instanceId: 'tf-1', data: { filled: 1 }, _failed: true }],
    ]);
    const exhibit = assembleExhibitFromContent(manifest, brief, map);
    expect(exhibit.orderedComponents?.map((c) => c.componentId)).toEqual(['curator-brief', 'counting-board']);
    expect(exhibit.introBriefing).toBe(brief);
    expect(exhibit.topic).toBe('Counting to 10');
  });

  it('refuses to build a package without the curator brief', () => {
    const built = buildLessonPackage({ manifest, curatorBrief: null, components: [], source: 'test' });
    expect('error' in built).toBe(true);
  });

  it('every plain-language reason maps onto a real rubric check (or is an explicit human-only tag)', () => {
    const checkIds = new Set(LESSON_BENCH_CHECKS.map((c) => c.id));
    for (const r of [...BLOCK_REASONS, ...LESSON_REASONS]) {
      if (r.checkId) expect(checkIds.has(r.checkId), `${r.id} → ${r.checkId}`).toBe(true);
    }
    // Every check a judge can cite on a BLOCK has a block-level reason a human can pick.
    const blockCovered = new Set(BLOCK_REASONS.map((r) => r.checkId).filter(Boolean));
    for (const id of ['G1', 'G2', 'G3', 'G5', 'G6', 'Q2', 'Q3', 'Q6', 'Q8']) expect(blockCovered.has(id), id).toBe(true);
  });

  it('turns a teacher-shaped label into machine-shaped signals, block for block', () => {
    const label = emptyHumanLabel();
    expect(isLabelTouched(label)).toBe(false);
    label.holistic = 4;
    label.blocks['tf-1'] = { reaction: 'cut', reasons: ['does-not-belong', 'symbols-first'], note: '' };
    label.blocks['cb-1'] = { reaction: 'keep', reasons: [], note: '' };
    label.lessonReasons = ['wrong-opener'];
    expect(isLabelTouched(label)).toBe(true);
    expect(humanCheckSignals(label)).toEqual([
      { checkId: 'Q1', reason: 'wrong-opener' },
      { instanceId: 'tf-1', checkId: 'Q3', reason: 'symbols-first' },
    ]);
  });
});
