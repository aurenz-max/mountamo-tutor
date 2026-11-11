import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasPool, findCanvas, gradesFor, type CanvasOffer } from './canvasCandidates';
import { CANVAS_LIBRARY } from './library';
import { CANVAS_PILOT } from './library/pilot';
import { UNIVERSAL_CATALOG, applyCanvasPicks, withCanvasOffers } from '../../manifest/gemini-manifest';
import type { ExhibitManifest } from '../../../types';

vi.mock('./pilotVotes', async (orig) => ({ ...(await orig<typeof import('./pilotVotes')>()), heldCanvasIds: () => held }));
let held = new Set<string>();
afterEach(() => { held = new Set(); });

describe('canvas pool', () => {
  it('offers pilot canvases only to the pilot student, never a held one or a promoted one', () => {
    expect(CANVAS_PILOT.length).toBeGreaterThan(0);
    const lib = canvasPool('2001');
    expect(lib.every(p => !p.pilot)).toBe(true);
    expect(lib.length).toBe(CANVAS_LIBRARY.length);
    const pilot = canvasPool('1004');
    expect(pilot.filter(p => p.pilot).length).toBe(CANVAS_PILOT.filter(c => !CANVAS_LIBRARY.some(l => l.id === c.id)).length);
    held = new Set([CANVAS_PILOT[0].id]);
    expect(canvasPool('1004').some(p => p.entry.id === CANVAS_PILOT[0].id)).toBe(false);
  });

  it('reads grades from the objective first, then the lesson band', () => {
    expect(gradesFor('K')).toEqual(['K']);
    expect(gradesFor('Grade 04')).toEqual(['4']);
    expect(gradesFor(undefined, 'middle-school')).toEqual(['6', '7', '8']);
    expect(gradesFor(undefined, 'undergraduate')).toBeNull();
  });
});

describe('canvas entries in the manifest', () => {
  const entry = CANVAS_PILOT[0];
  const offers: CanvasOffer[] = [{ entry, pilot: true, objectiveIds: ['obj2'] }];

  it('replaces the generic host with one entry per offered canvas, and shows no canvas without offers', () => {
    const none = withCanvasOffers(UNIVERSAL_CATALOG, []);
    expect(none.some(c => c.id === 'agent-canvas' || c.id.startsWith('canvas:'))).toBe(false);
    const shown = withCanvasOffers(UNIVERSAL_CATALOG, offers, [{ id: 'obj1' }, { id: 'obj2' }]);
    const line = shown.find(c => c.id === `canvas:${entry.id}`);
    expect(line?.description).toContain(entry.summary);
    expect(line?.description).toContain('Matched to objective 2.');
    expect(shown.some(c => c.id === 'agent-canvas')).toBe(false);
  });

  it('maps a canvas pick back to the host with its id, and the pilot student with a pilot canvas', () => {
    const manifest = { objectiveBlocks: [{ objectiveId: 'obj1', components: [
      { componentId: `canvas:${entry.id}`, instanceId: 'a', title: 't', intent: 'i', config: { difficulty: 'easy' } },
      { componentId: 'canvas:not-a-canvas', instanceId: 'b', title: 't', intent: 'i' },
      { componentId: 'practice-studio', instanceId: 'c', title: 't', intent: 'i' },
    ] }] } as unknown as ExhibitManifest;
    expect(applyCanvasPicks(manifest, '1004')).toEqual([entry.id]);
    const [a, b, c] = manifest.objectiveBlocks![0].components;
    expect(a.componentId).toBe('agent-canvas');
    expect(a.config).toMatchObject({ difficulty: 'easy', canvasId: entry.id, pilotStudentId: '1004' });
    expect(b.componentId).toBe('agent-canvas');
    expect(b.config?.canvasId).toBeUndefined();
    expect(c.componentId).toBe('practice-studio');
    expect(findCanvas(entry.id)?.pilot).toBe(true);
  });
});
