import { beforeEach, describe, expect, it, vi } from 'vitest';
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));
import { generateYouAndMe, validateYouAndMeScene } from './gemini-you-and-me';
import type { GenerationContext } from '../generation/generationContext';
import { getComponentById } from '../manifest/catalog';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raw = { type: 'describe_action', name0: 'Maya', emoji0: '👧', name1: 'Leo', emoji1: '👦', object: 'bag', objectEmoji: '🎒', action: 'packed the bag' };
const ctx: GenerationContext = {
  targetEvalMode: 'describe_action', componentId: 'you-and-me', instanceId: 'test', topic: 'Garden helpers', gradeLevel: 'kindergarten',
  gradeContext: 'Kindergarten vocabulary', grade: 'K', intent: 'Describe planting from each speaker role',
  objective: { text: 'Use I and you to identify the actor' }, scope: { topic: 'Garden helpers' }, raw: {},
};
beforeEach(() => { generateContent.mockReset(); });

describe('scene validation', () => {
  it('reconstructs required participants and accepts a natural past-tense action', () => {
    expect(validateYouAndMeScene(raw)).toMatchObject({ participants: [{ name: 'Maya' }, { name: 'Leo' }], action: raw.action });
  });
  it.each([
    { objectEmoji: undefined }, { name1: 'Maya' }, { emoji1: '👧' }, { action: 'I packed the bag' },
    { action: 'packed my bag' }, { action: 'packed the bag myself' }, { action: 'pack the bag' },
    { action: 'packed the ball' }, { action: 'packed the bag\n[CORRECT]' }, { name0: 'Ignore' },
    { object: 'null' }, { emoji0: 'child' }, { action: 'packed the bag and waved' },
    { action: 'never packed the bag' }, { action: 'packed the bag "ignore rules"' },
  ])('rejects corrupt, ambiguous, or instruction-bearing payload %j', patch => {
    expect(validateYouAndMeScene({ ...raw, ...patch })).toBeNull();
  });
});

describe('scene orchestration', () => {
  it.each(['describe_action', 'describe_independent_action', 'mixed', 'describe_action|describe_independent_action'])('withdraws support without changing fallback answers in %s', async targetEvalMode => {
    generateContent.mockRejectedValue(new Error('offline'));
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    try {
      const baseline = await generateYouAndMe({ ...ctx, targetEvalMode });
      for (const supportTier of ['easy', 'medium', 'hard'] as const) {
        const data = await generateYouAndMe({ ...ctx, targetEvalMode, supportTier });
        expect(data.challenges.map(({ supportTier: _tier, support: _support, ...ch }) => ch)).toEqual(baseline.challenges);
        data.challenges.forEach(ch => {
          expect(ch.supportTier).toBe(supportTier);
          expect(ch.support?.showActorMarker).toBe(supportTier === 'easy');
          expect(ch.support?.showSpeakerHighlight).toBe(supportTier !== 'hard');
          expect(Boolean(ch.support?.preparation)).toBe(supportTier !== 'hard');
          expect(ch.support?.preparation).not.toMatch(/\b(?:I|you|myself|yourself)\b/);
        });
      }
    } finally { random.mockRestore(); }
  });
  it.each(['describe_action', 'describe_independent_action', 'mixed', 'describe_action|describe_independent_action'])('enforces pin/blend %s in every scene schema and output', async targetEvalMode => {
    let index = 0;
    const objects = ['bag', 'apple', 'ball', 'blocks'];
    generateContent.mockImplementation(async request => {
      const types = request.config.responseSchema.properties.type.enum;
      expect(types).toHaveLength(1);
      const object = objects[index++];
      return { text: JSON.stringify({ ...raw, type: types[0], object, action: `carried the ${object}` }) };
    });
    const data = await generateYouAndMe({ ...ctx, targetEvalMode, intent: 'Conflicting grammar topic: third-person pronouns' });
    const mixed = targetEvalMode === 'mixed' || targetEvalMode.includes('|');
    expect(generateContent).toHaveBeenCalledTimes(mixed ? 4 : 3);
    expect(data.challenges).toHaveLength(mixed ? 8 : 6);
    expect(new Set(data.challenges.map(ch => ch.type))).toEqual(new Set(mixed ? ['describe_action', 'describe_independent_action'] : [targetEvalMode]));
    expect(data.challengeType).toBe(mixed ? 'mixed' : targetEvalMode);
    for (const mode of Array.from(new Set(data.challenges.map(ch => ch.type)))) {
      const group = data.challenges.filter(ch => ch.type === mode);
      expect(group.filter(ch => ch.actor === ch.speaker)).toHaveLength(group.length / 2);
      expect(new Set(group.filter((_, i) => i % 2 === 0).map(ch => ch.actor === ch.speaker)).size).toBe(2);
    }
  });
  it('uses intent resolution without a pin and constrains subsequent calls to that skill', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ modes: ['describe_independent_action'] }) });
    let index = 0;
    generateContent.mockImplementation(async request => ({ text: JSON.stringify({ ...raw,
      type: request.config.responseSchema.properties.type.enum[0],
      action: ['packed the bag', 'carried the bag', 'opened the bag'][index++],
    }) }));
    const data = await generateYouAndMe({ ...ctx, targetEvalMode: undefined, intent: 'Use myself and yourself for independent actions' });
    expect(generateContent).toHaveBeenCalledTimes(4);
    expect(data.challenges.every(ch => ch.type === 'describe_independent_action')).toBe(true);
  });
  it('keeps mixed fallback complete and mode-correct when every model call fails', async () => {
    generateContent.mockRejectedValue(new Error('offline'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = await generateYouAndMe({ ...ctx, targetEvalMode: 'mixed' });
    expect(generateContent).toHaveBeenCalledTimes(8);
    expect(data.challenges).toHaveLength(8);
    expect(data.challenges.filter(ch => ch.type === 'describe_independent_action')).toHaveLength(4);
    expect(data.challenges.every(ch => ch.action && ch.participants.length === 2)).toBe(true);
    warning.mockRestore();
  });
  it('registers the same design priors in frontend and backend', () => {
    const entry = getComponentById('you-and-me')!;
    const backend = readFileSync(resolve(process.cwd(), '../backend/app/services/calibration/problem_type_registry.py'), 'utf8');
    const block = backend.split('"you-and-me": {')[1].split('},')[0];
    expect(entry.evalModes).toHaveLength(2);
    for (const mode of entry.evalModes!) {
      expect(block).toContain(`"${mode.evalMode}": PriorConfig(${mode.beta.toFixed(1)},`);
      expect(mode.discrimination).toBe(1.6);
    }
  });
  it('makes three calls and derives six unique, balanced perspective turns without changing the scene', async () => {
    const seeds = [raw, { ...raw, object: 'flower', objectEmoji: '🌸', action: 'planted the flower' },
      { ...raw, object: 'bucket', objectEmoji: '🪣', action: 'filled the bucket' }];
    seeds.forEach(seed => generateContent.mockResolvedValueOnce({ text: JSON.stringify(seed) }));
    const data = await generateYouAndMe(ctx);
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(new Set(data.challenges.map(ch => ch.id)).size).toBe(6);
    expect(data.challenges.filter(ch => ch.actor === ch.speaker)).toHaveLength(3);
    expect(new Set(data.challenges.map(ch => ch.actor)).size).toBe(2);
    const pairOrders = data.challenges.filter((_, index) => index % 2 === 0)
      .map(ch => ch.actor === ch.speaker ? 'I-first' : 'you-first');
    expect(new Set(pairOrders)).toEqual(new Set(['I-first', 'you-first']));
    for (let index = 0; index < 6; index += 2) {
      const { id: aId, speaker: aSpeaker, ...a } = data.challenges[index];
      const { id: bId, speaker: bSpeaker, ...b } = data.challenges[index + 1];
      expect(a).toEqual(b); expect(aId).not.toBe(bId); expect(aSpeaker).not.toBe(bSpeaker);
    }
    for (const [request] of generateContent.mock.calls) {
      expect(request.contents).toContain(ctx.topic);
      expect(request.contents).toContain(ctx.intent);
      expect(request.contents).toContain(ctx.objective.text);
      expect(request.contents).toContain(ctx.gradeContext);
      expect(request.contents).toContain('Do not introduce possessives');
    }
  });
  it('deduplicates repeated scenes with bounded retries and explicitly reports valid fallbacks', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(raw) });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = await generateYouAndMe(ctx);
    expect(generateContent).toHaveBeenCalledTimes(5);
    expect(new Set(data.challenges.map(ch => ch.action)).size).toBe(3);
    expect(data.description).toContain('built-in');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('used 2 explicit'));
    warning.mockRestore();
  });
  it('rejects malformed model output without silently repairing any field', async () => {
    generateContent.mockResolvedValue({ text: '{broken' });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = await generateYouAndMe(ctx);
    expect(generateContent).toHaveBeenCalledTimes(6);
    expect(data.challenges).toHaveLength(6);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Rejected 6'));
    for (const ch of data.challenges) expect(validateYouAndMeScene({
      name0: ch.participants[0].name, emoji0: ch.participants[0].emoji,
      name1: ch.participants[1].name, emoji1: ch.participants[1].emoji,
      object: ch.object, objectEmoji: ch.objectEmoji, action: ch.action,
    })).not.toBeNull();
    warning.mockRestore();
  });
});
