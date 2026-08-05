/**
 * LA K-2 grammar density — spatial-scene preposition window (2026-08-05).
 *
 * Census failure (`qa/la-k2-grammar/census-2026-08-05.md`): the published Kindergarten
 * LA curriculum routes LA004-05-B ("Follow single-step instructions using common
 * prepositions… 'Put the pencil in the box'") to `spatial-scene`, and the manifest
 * curator's own intent said *"Put the ball UNDER the table"*. The generator returned
 * above / below / beside — its hardcoded K window ("ONLY above, below, beside,
 * next_to", the math K.G.1 vocabulary) silently overrode lesson intent
 * ([[trust-intent-over-hardcoded-caps]]).
 *
 * These tests drive the REAL resolver through the REAL generator. Both the resolver and
 * the scene sub-generators call `gemini-flash-lite-latest`, so the mock dispatches on a
 * prompt SIGNATURE rather than a model id.
 *
 * Contract: `docs/contracts/spatial-scene.md` — R1 (band window) is the guarded
 * requirement; C1 is the conflict this slice resolves.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../../geminiClient';
import { generateSpatialScene } from '../gemini-spatial-scene';
import {
  resolvePrepositionScope,
  composePositionWindow,
  bandDefaultPositions,
  SUPPORTED_POSITIONS,
} from './resolvePrepositionScope';
import type { GenerationContext } from '../../generation/generationContext';

const generateContent = vi.mocked(ai.models.generateContent);

/** Text unique to the resolver prompt — the dispatch key. */
const RESOLVER_SIGNATURE = 'Report ONLY the position words';

/** What the resolver returns; 'THROW' simulates a resolver outage. */
let resolverPayload: unknown = null;
/** Every scene-generator prompt seen this run. */
let scenePrompts: string[] = [];

/** A minimal but schema-valid scene payload, reused for every mode. */
const SCENE_PAYLOAD = {
  challenges: [
    {
      id: 'c1',
      instruction: 'Put the ball under the box.',
      hint: 'Under means right beneath and touching.',
      sceneObj0Name: 'box', sceneObj0Image: '📦', sceneObj0Row: 0, sceneObj0Col: 1,
      sceneObj1Name: 'tree', sceneObj1Image: '🌳', sceneObj1Row: 1, sceneObj1Col: 0,
      sceneObj2Name: 'cat', sceneObj2Image: '🐱', sceneObj2Row: 2, sceneObj2Col: 2,
      sceneObj3Name: 'star', sceneObj3Image: '⭐', sceneObj3Row: 0, sceneObj3Col: 0,
      targetName: 'ball', targetImage: '⚽', targetRow: 1, targetCol: 1,
      correctPosition: 'under', referenceObjectName: 'box',
      option0: 'under', option1: 'above', option2: 'beside', option3: 'below',
      correctCellRow: 1, correctCellCol: 1,
      step0Instruction: 'Put the cat under the box', step0TargetName: 'cat',
      step0TargetImage: '🐱', step0CorrectRow: 1, step0CorrectCol: 1,
      step1Instruction: 'Put the dog beside the box', step1TargetName: 'dog',
      step1TargetImage: '🐕', step1CorrectRow: 0, step1CorrectCol: 2,
    },
  ],
};

function wire() {
  scenePrompts = [];
  generateContent.mockImplementation((async (args: any) => {
    const prompt = String(args?.contents ?? '');
    if (prompt.includes(RESOLVER_SIGNATURE)) {
      if (resolverPayload === 'THROW') throw new Error('resolver down');
      return { text: JSON.stringify(resolverPayload) };
    }
    scenePrompts.push(prompt);
    return { text: JSON.stringify(SCENE_PAYLOAD) };
  }) as never);
}

function ctx(over: Partial<GenerationContext> = {}): GenerationContext {
  const topic = over.topic ?? 'Where things are';
  return {
    componentId: 'spatial-scene' as GenerationContext['componentId'],
    instanceId: 'eval-test-spatial-scene',
    topic,
    gradeLevel: 'kindergarten',
    gradeContext: 'kindergarten students',
    objective: {},
    scope: { topic },
    raw: {},
    ...over,
  } as GenerationContext;
}

/** The exact census scope: K LA004-05-B, single-step preposition instructions. */
const CENSUS_SCOPE = {
  topic: 'Prepositions: where things are',
  objectiveText:
    'Follow single-step instructions using common prepositions in classroom activities '
    + '(e.g., "Put the pencil in the box")',
  intent:
    'Provide an interactive grid of a kindergarten classroom. Ask students to place items '
    + "like a ball, a block, and a crayon in specific spots (e.g., 'Put the ball under the table').",
};

/** Concatenation of every scene prompt — the window/semantics assertions read this. */
const allScenePrompts = () => scenePrompts.join('\n---\n');

beforeEach(() => {
  vi.clearAllMocks();
  resolverPayload = { requested: [], unsupported: [] };
  wire();
});

// ---------------------------------------------------------------------------
// Pure window composition
// ---------------------------------------------------------------------------

describe('composePositionWindow', () => {
  it('K band default is exactly the shipped math K.G.1 vocabulary', () => {
    expect(bandDefaultPositions('K')).toEqual(['above', 'below', 'beside', 'next_to']);
  });

  it('Grade 1 band default adds the lateral pair', () => {
    expect(bandDefaultPositions('1')).toEqual([
      'above', 'below', 'beside', 'next_to', 'left_of', 'right_of',
    ]);
  });

  it('no lesson request leaves the band window untouched', () => {
    expect(composePositionWindow('K', { requested: [], unsupported: [] }))
      .toEqual(['above', 'below', 'beside', 'next_to']);
    expect(composePositionWindow('K', null))
      .toEqual(['above', 'below', 'beside', 'next_to']);
  });

  it('WIDENS only — a request adds words and never removes band words', () => {
    const w = composePositionWindow('K', { requested: ['on', 'under'], unsupported: [] });
    expect(w).toContain('on');
    expect(w).toContain('under');
    for (const base of bandDefaultPositions('K')) expect(w).toContain(base);
  });

  it('emits canonical order and dedupes an already-in-band request', () => {
    const w = composePositionWindow('K', { requested: ['above', 'under'], unsupported: [] });
    expect(w).toEqual(Array.from(new Set(w)));
    expect(w).toEqual(SUPPORTED_POSITIONS.filter((p) => w.includes(p)));
  });
});

// ---------------------------------------------------------------------------
// Resolver behavior
// ---------------------------------------------------------------------------

describe('resolvePrepositionScope', () => {
  it('makes NO call when the scope carries no intent or objective', async () => {
    const out = await resolvePrepositionScope({ topic: 'Shapes' }, 'kindergarten');
    expect(out).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('keeps only genuinely supported words in `requested`', async () => {
    resolverPayload = { requested: ['under', 'on', 'in', 'between'], unsupported: [] };
    const out = await resolvePrepositionScope(CENSUS_SCOPE, 'kindergarten');
    expect(out?.requested).toEqual(['on', 'under']);
  });

  it('reports unsupported words honestly and dedupes them', async () => {
    resolverPayload = { requested: ['under'], unsupported: ['in', 'In', 'between', 'under'] };
    const out = await resolvePrepositionScope(CENSUS_SCOPE, 'kindergarten');
    expect(out?.unsupported).toEqual(['in', 'between']); // dedup + supported word stripped
  });

  it('degrades to null on a resolver outage — caller keeps its band default', async () => {
    resolverPayload = 'THROW';
    const out = await resolvePrepositionScope(CENSUS_SCOPE, 'kindergarten');
    expect(out).toBeNull();
    expect(composePositionWindow('K', out)).toEqual(bandDefaultPositions('K'));
  });

  it('runs at temperature 0 with a schema (never a regex over prose)', async () => {
    resolverPayload = { requested: ['under'], unsupported: [] };
    await resolvePrepositionScope(CENSUS_SCOPE, 'kindergarten');
    const call: any = generateContent.mock.calls[0][0];
    expect(call.config.temperature).toBe(0);
    expect(call.config.responseSchema).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the real generator — the census failure and its guard
// ---------------------------------------------------------------------------

describe('spatial-scene generator — position window', () => {
  it('CENSUS FIX: a K lesson asking for under/on may use them', async () => {
    resolverPayload = { requested: ['on', 'under'], unsupported: ['in'] };
    await generateSpatialScene(ctx({ scope: CENSUS_SCOPE, raw: { targetEvalMode: 'place' } }));

    const prompts = allScenePrompts();
    expect(prompts).toContain('under');
    expect(prompts).toContain('on');
    // …and the grid semantics that make them judgeable are stated.
    expect(prompts).toContain('TOUCHING');
  });

  it('REGRESSION GUARD (contract R1): a K math lesson with no request keeps the shipped window', async () => {
    resolverPayload = { requested: [], unsupported: [] };
    await generateSpatialScene(ctx({
      topic: 'Positions: above, below, beside',
      scope: {
        topic: 'Positions: above, below, beside',
        objectiveText: 'Describe the relative positions of objects using above, below, beside, and next to',
      },
      raw: { targetEvalMode: 'identify' },
    }));

    const prompts = allScenePrompts();
    expect(prompts).toContain('ONLY above, below, beside, next_to');
    // The words this slice added must NOT leak into an unrequested math lesson.
    expect(prompts).not.toContain('TOUCHING');
  });

  it('states semantics ONLY for words inside the window', async () => {
    resolverPayload = { requested: [], unsupported: [] };
    await generateSpatialScene(ctx({
      scope: { topic: 'Positions', objectiveText: 'Describe positions above and below' },
      raw: { targetEvalMode: 'identify' },
    }));

    const prompts = allScenePrompts();
    // left_of/right_of are Grade-1 band words — out of a K window, so unexplained.
    expect(prompts).not.toContain('"left_of" =');
    expect(prompts).toContain('"above" =');
  });

  it('a resolver outage degrades to the band window, not to an empty one', async () => {
    resolverPayload = 'THROW';
    await generateSpatialScene(ctx({ scope: CENSUS_SCOPE, raw: { targetEvalMode: 'place' } }));

    const prompts = allScenePrompts();
    expect(prompts).toContain('ONLY above, below, beside, next_to');
    expect(scenePrompts.length).toBeGreaterThan(0); // generation still happened
  });

  it('Grade 1 with no request keeps the lateral pair', async () => {
    resolverPayload = { requested: [], unsupported: [] };
    await generateSpatialScene(ctx({
      gradeLevel: 'first grade',
      gradeContext: 'first grade students',
      scope: { topic: 'Positions', objectiveText: 'Describe positions left and right' },
      raw: { targetEvalMode: 'identify' },
    }));

    expect(allScenePrompts()).toContain('left_of');
  });
});
