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
  positionHolds,
  enforceSingleDefensibleOption,
  placeAnswerSlot,
  SUPPORTED_POSITIONS,
  type SupportedPosition,
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

// ---------------------------------------------------------------------------
// Contract R12 — exactly one defensible option (conflict C3)
//
// `on` means "touching, directly above", so for an ADJACENT same-column pair both
// `on` and `above` are true. `identify`/`describe` judge a single position word, so
// an options list carrying both marks a correct answer wrong. Probe F (2026-08-05)
// measured this in 4 of 18 real generated challenges.
// ---------------------------------------------------------------------------

const K_LA_WINDOW: SupportedPosition[] = ['above', 'below', 'beside', 'next_to', 'on', 'under'];
const K_MATH_WINDOW: SupportedPosition[] = ['above', 'below', 'beside', 'next_to'];

describe('positionHolds — SUPPORTED_POSITION_SEMANTICS in executable form', () => {
  const ref = { row: 1, col: 1 };

  it('`on` is a STRICT SUBSET of `above` (the C3 mechanism)', () => {
    const touching = { row: 0, col: 1 };   // adjacent, same column
    expect(positionHolds('on', touching, ref)).toBe(true);
    expect(positionHolds('above', touching, ref)).toBe(true); // both defensible

    const lowRef = { row: 2, col: 1 };     // two rows apart — a gap
    expect(positionHolds('above', { row: 0, col: 1 }, lowRef)).toBe(true);
    expect(positionHolds('on', { row: 0, col: 1 }, lowRef)).toBe(false);
  });

  it('`under` is a STRICT SUBSET of `below`', () => {
    expect(positionHolds('under', { row: 2, col: 1 }, ref)).toBe(true);
    expect(positionHolds('below', { row: 2, col: 1 }, ref)).toBe(true);
    expect(positionHolds('under', { row: 2, col: 1 }, { row: 0, col: 1 })).toBe(false);
  });

  it('`beside` and `next_to` are exact synonyms, and `beside` implies right_of', () => {
    const right = { row: 1, col: 2 };
    expect(positionHolds('beside', right, ref)).toBe(true);
    expect(positionHolds('next_to', right, ref)).toBe(true);
    expect(positionHolds('right_of', right, ref)).toBe(true); // live at Grade 1
  });

  it('a word with no grid semantics is null — never silently false', () => {
    expect(positionHolds('between', { row: 0, col: 0 }, ref)).toBeNull();
    expect(positionHolds('in', { row: 0, col: 0 }, ref)).toBeNull();
  });
});

describe('enforceSingleDefensibleOption (R12)', () => {
  const ref = { row: 1, col: 1 };
  const touchingAbove = { row: 0, col: 1 };
  const touchingBelow = { row: 2, col: 1 };
  const rightOf = { row: 1, col: 2 };

  /** How many options survive as true — the property R12 asserts. */
  const trueCount = (opts: string[], t: { row: number; col: number }, r = ref) =>
    opts.filter((o) => positionHolds(o, t, r) === true).length;

  it('C3: key "on" no longer ships alongside "above"', () => {
    const out = enforceSingleDefensibleOption(
      'on', ['on', 'above', 'below', 'beside'], touchingAbove, ref, K_LA_WINDOW);
    expect(out.removed).toContain('above');
    expect(out.correctPosition).toBe('on');
    expect(trueCount(out.options, touchingAbove)).toBe(1);
  });

  it('C3 the other direction: key "above" no longer ships alongside "on"', () => {
    const out = enforceSingleDefensibleOption(
      'above', ['above', 'on', 'below', 'beside'], touchingAbove, ref, K_LA_WINDOW);
    expect(out.removed).toContain('on');
    expect(out.correctPosition).toBe('above');
    expect(trueCount(out.options, touchingAbove)).toBe(1);
  });

  it('C3: below/under', () => {
    const out = enforceSingleDefensibleOption(
      'below', ['below', 'above', 'under', 'on'], touchingBelow, ref, K_LA_WINDOW);
    expect(out.removed).toContain('under');
    expect(trueCount(out.options, touchingBelow)).toBe(1);
  });

  it('C3: the pre-existing beside/next_to synonym pair — live for MATH too', () => {
    const out = enforceSingleDefensibleOption(
      'beside', ['beside', 'above', 'under', 'next_to'], rightOf, ref, K_MATH_WINDOW);
    expect(out.removed).toContain('next_to');
    expect(trueCount(out.options, rightOf)).toBe(1);
  });

  it('the grid is ground truth: a key that is FALSE for the arrangement is repaired', () => {
    const out = enforceSingleDefensibleOption(
      'beside', ['beside', 'above', 'below', 'next_to'], touchingAbove, ref, K_LA_WINDOW);
    expect(out.repairedKey).toBe(true);
    expect(positionHolds(out.correctPosition, touchingAbove, ref)).toBe(true);
    expect(out.options).toContain(out.correctPosition);
  });

  it('R1 GUARD: a key that is true but OUTSIDE the window is repaired to an in-window word', () => {
    // A math K lesson never asked for `on`; it must not become the answer.
    const out = enforceSingleDefensibleOption(
      'on', ['on', 'below', 'beside', 'next_to'], touchingAbove, ref, K_MATH_WINDOW);
    expect(out.repairedKey).toBe(true);
    expect(out.correctPosition).toBe('above');
    expect(out.options).not.toContain('on');
    expect(out.outOfWindow).toContain('on');
  });

  it('never emits an out-of-window option, and never backfills a TRUE word', () => {
    const out = enforceSingleDefensibleOption(
      'above', ['above', 'on', 'between', 'in'], touchingAbove, ref, K_MATH_WINDOW);
    for (const o of out.options) expect(K_MATH_WINDOW).toContain(o as SupportedPosition);
    expect(out.options.length).toBeGreaterThanOrEqual(2); // contract R7
    expect(trueCount(out.options, touchingAbove)).toBe(1);
  });

  it('an arrangement no window word describes is flagged unjudgeable (caller drops it)', () => {
    const diagonal = { row: 0, col: 0 };
    const out = enforceSingleDefensibleOption(
      'above', ['above', 'below'], diagonal, ref, K_LA_WINDOW);
    expect(out.unjudgeable).toBe(true);
  });

  it('same cell for target and reference is unjudgeable, not silently "above"', () => {
    const out = enforceSingleDefensibleOption(
      'above', ['above', 'below'], { row: 1, col: 1 }, ref, K_LA_WINDOW);
    expect(out.unjudgeable).toBe(true);
  });

  it('a clean list is left alone', () => {
    const out = enforceSingleDefensibleOption(
      'above', ['above', 'below', 'beside', 'next_to'], { row: 0, col: 1 }, { row: 2, col: 1 },
      K_MATH_WINDOW);
    expect(out.removed).toEqual([]);
    expect(out.repairedKey).toBe(false);
    expect(new Set(out.options)).toEqual(new Set(['above', 'below', 'beside', 'next_to']));
  });
});

describe('placeAnswerSlot — the answer is not always the first button', () => {
  const opts = ['above', 'below', 'beside', 'next_to'];

  it('keeps every option exactly once', () => {
    const out = placeAnswerSlot(opts, 'above', 'identify:c1:above');
    expect(new Set(out)).toEqual(new Set(opts));
    expect(out.length).toBe(opts.length);
  });

  it('is deterministic for the same challenge', () => {
    expect(placeAnswerSlot(opts, 'above', 'identify:c2:above'))
      .toEqual(placeAnswerSlot(opts, 'above', 'identify:c2:above'));
  });

  it('does not park the answer at slot 0 for every challenge', () => {
    const slots = new Set(
      ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(
        (id) => placeAnswerSlot(opts, 'above', `identify:${id}:above`).indexOf('above')),
    );
    expect(slots.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the REAL generator — the shipped challenge, not the prompt
// ---------------------------------------------------------------------------

describe('spatial-scene generator — R12 end to end', () => {
  /** The scene payload puts the ball at (1,1) directly under the box at (0,1) —
   *  so `under` AND `below` are both true, and the mock offers both as options. */
  const oneTrueOption = (data: Awaited<ReturnType<typeof generateSpatialScene>>) =>
    data.challenges
      .filter((c) => c.type === 'identify' || c.type === 'describe')
      .map((c) => {
        const ref = c.sceneObjects.find((o) => o.name === c.referenceObjectName)?.position;
        const t = c.targetObject?.position;
        return (c.options ?? []).filter(
          (o) => ref && t && positionHolds(o, t, ref) === true).length;
      });

  it('an LA lesson (on/under in window) ships exactly ONE defensible option', async () => {
    resolverPayload = { requested: ['on', 'under'], unsupported: [] };
    const data = await generateSpatialScene(ctx({
      scope: CENSUS_SCOPE, raw: { targetEvalMode: 'identify' },
    }));
    const counts = oneTrueOption(data);
    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(n).toBe(1);
  });

  it('a math K lesson (no request) also ships exactly ONE, and stays in the K window', async () => {
    resolverPayload = { requested: [], unsupported: [] };
    const data = await generateSpatialScene(ctx({
      scope: {
        topic: 'Positions: above, below, beside',
        objectiveText: 'Describe the relative positions of objects using above, below, beside, and next to',
      },
      raw: { targetEvalMode: 'describe' },
    }));
    for (const n of oneTrueOption(data)) expect(n).toBe(1);
    for (const c of data.challenges) {
      expect(K_MATH_WINDOW).toContain(c.correctPosition as SupportedPosition);
      for (const o of c.options ?? []) expect(K_MATH_WINDOW).toContain(o as SupportedPosition);
    }
  });
});
