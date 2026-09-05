import { describe, expect, it } from 'vitest';
import type { ExhibitManifest, IntroBriefingData } from '../types';
import { assembleExhibitFromContent, isCaregiverBlock, partitionCaregiverBlocks, type GeneratedContent } from './exhibitAssembly';

const brief = {
  hook: { content: 'Look at all these bears!' },
  objectives: [{ id: 'obj1', text: 'count a group of objects', verb: 'apply', icon: '1' }],
} as unknown as IntroBriefingData;

const layout = [
  { componentId: 'curator-brief', instanceId: 'brief', title: 'Welcome', intent: '' },
  { componentId: 'counting-board', instanceId: 'cb', title: 'Count', intent: '', objectiveIds: ['obj1'] },
  { componentId: 'take-home-activity', instanceId: 'home', title: 'At home', intent: '', objectiveIds: ['obj1'] },
  { componentId: 'ten-frame', instanceId: 'tf', title: 'Frame', intent: '', objectiveIds: ['obj1'] },
  { componentId: 'knowledge-check', instanceId: 'final', title: 'Check', intent: '', objectiveIds: ['obj1'] },
];

const manifest = {
  topic: 'Counting to 10',
  gradeLevel: 'kindergarten',
  themeColor: '#22d3ee',
  objectiveBlocks: [],
  finalAssessment: { componentId: 'knowledge-check', instanceId: 'final', title: 'Check', intent: '' },
  layout,
} as unknown as ExhibitManifest;

const content = (ids: string[]) =>
  new Map<string, GeneratedContent>(ids.map((id) => [id, { instanceId: id, data: { id } }]));
const ordered = (exhibit: { orderedComponents?: Array<{ instanceId: string; audience?: string; data?: unknown }> }) => exhibit.orderedComponents ?? [];

describe("caregiver blocks ride behind the child's path (item 12)", () => {
  it('reads the audience from the live catalog tag, not a hardcoded id', () => {
    expect(isCaregiverBlock('take-home-activity')).toBe(true);
    expect(isCaregiverBlock('counting-board')).toBe(false);
    expect(isCaregiverBlock('curator-brief')).toBe(false);
  });

  it('moves the caregiver block after the final assessment, stamped, never dropped', () => {
    const exhibit = assembleExhibitFromContent(manifest, brief, content(['cb', 'home', 'tf', 'final']));
    expect(ordered(exhibit).map((c) => c.instanceId)).toEqual(['brief', 'cb', 'tf', 'final', 'home']);
    const home = ordered(exhibit).find((c) => c.instanceId === 'home');
    expect(home?.audience).toBe('caregiver');
    expect(home?.data).toMatchObject({ id: 'home', __instanceId: 'home' });
    // Student blocks carry no audience field (absent = student) so older
    // consumers and replay fixtures stay byte-compatible.
    expect(ordered(exhibit).filter((c) => c.instanceId !== 'home').every((c) => c.audience === undefined)).toBe(true);
  });

  it('is byte-identical to layout order when no caregiver block is present', () => {
    const noHome = { ...manifest, layout: layout.filter((l) => l.instanceId !== 'home') } as ExhibitManifest;
    const exhibit = assembleExhibitFromContent(noHome, brief, content(['cb', 'tf', 'final']));
    expect(ordered(exhibit).map((c) => c.instanceId)).toEqual(['brief', 'cb', 'tf', 'final']);
  });

  it('still drops a block whose generation failed, caregiver or not', () => {
    const map = content(['cb', 'tf', 'final']);
    map.set('home', { instanceId: 'home', data: null, _failed: true });
    const exhibit = assembleExhibitFromContent(manifest, brief, map);
    expect(ordered(exhibit).some((c) => c.instanceId === 'home')).toBe(false);
  });

  it('partitions with an injected predicate and keeps relative order in both halves', () => {
    const items = [{ componentId: 'a' }, { componentId: 'p' }, { componentId: 'b' }, { componentId: 'p' }];
    const { stream, parentCards } = partitionCaregiverBlocks(items, (id) => id === 'p');
    expect(stream.map((i) => i.componentId)).toEqual(['a', 'b']);
    expect(parentCards).toHaveLength(2);
  });
});
