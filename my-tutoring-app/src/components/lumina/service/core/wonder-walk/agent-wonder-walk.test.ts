/**
 * The author loop against a scripted model (free): plan, write, read the code checks, fix a blocked stop, finish,
 * get sent back once by the reviewer, fix, ship. Proves the loop's control flow and that what ships passes the boss.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const turns: Array<Array<{ name: string; args: Record<string, unknown> }>> = [];
const reviews: unknown[] = [];
const seen: { authorCalls: number; reviewCalls: number; lastToolResults: unknown[] } = { authorCalls: 0, reviewCalls: 0, lastToolResults: [] as unknown[] };

vi.mock('../../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn(async (req: { config?: { responseMimeType?: string }; contents: unknown }) => {
    if (req.config?.responseMimeType === 'application/json') {
      seen.reviewCalls++;
      return { text: JSON.stringify(reviews.shift() ?? { stops: [] }) };
    }
    seen.authorCalls++;
    const contents = req.contents as Array<{ role: string; parts: Array<{ functionResponse?: { response: { output: unknown } } }> }>;
    seen.lastToolResults.push(...(contents.at(-1)?.parts.filter(p => p.functionResponse).map(p => p.functionResponse!.response.output) ?? []));
    const calls = turns.shift() ?? [{ name: 'finish', args: {} }];
    return {
      candidates: [{ content: { role: 'model', parts: calls.map(c => ({ functionCall: c })) } }],
      functionCalls: calls.map((c, i) => ({ id: `c${i}`, ...c })),
    };
  }) } },
}));
vi.mock('../gemini-deep-dive', () => ({ generateImage: vi.fn(async () => 'data:image/png;base64,AAAA') }));
vi.mock('../../scopeContext', () => ({ buildScopePromptSection: () => '' }));

import { generateWonderWalk, toolsFor } from './agent-wonder-walk';

const stop = (o: Record<string, unknown>) => ({ name: 'write_stop', args: {
  ideaIndex: 0, narration: 'A puppy eats and grows into a dog. It is alive!', sceneWords: ['puppy'],
  imagePrompt: 'a puppy eating in a garden', ask: 'Which one is alive too?', correctWord: 'frog',
  wrongWords: [{ word: 'rock', trap: 'other' }, { word: 'car', trap: 'looks_like' }],
  why: 'Living things eat and grow.', ...o } });

// Pinned, so the mode resolver makes no model call; the how-many test pins its own mode.
const ctx = { topic: 'Living and nonliving things', intent: 'Tell living from nonliving things', scope: {}, raw: { seed: 7 }, targetEvalMode: 'which-one', objective: {} } as never;

beforeEach(() => { turns.length = 0; reviews.length = 0; seen.authorCalls = 0; seen.reviewCalls = 0; seen.lastToolResults = []; });

describe('generateWonderWalk', () => {
  it('fixes a blocked stop, takes one review round, and ships a walk the boss accepts', async () => {
    turns.push(
      [
        { name: 'plan_walk', args: { title: 'Alive or Not?', bigIdea: 'Living things eat, drink and grow.', domain: 'science',
          ideas: ['Living things eat and grow.', 'Nonliving things do not eat or grow.'] } },
        stop({}),
        // Leaks: the ask names the right picture.
        stop({ ideaIndex: 1, narration: 'A rock does not eat. It does not grow.', sceneWords: ['rock'], imagePrompt: 'a grey rock',
          ask: 'Is the ball alive?', correctWord: 'ball', wrongWords: [{ word: 'cat', trap: 'other' }], why: 'Things that are not alive do not grow.' }),
        stop({ correctWord: 'bird', wrongWords: [{ word: 'shoe', trap: 'other' }] }),
        { name: 'finish', args: {} },
      ],
      [stop({ replaceIndex: 1, ideaIndex: 1, narration: 'A rock does not eat. It does not grow.', sceneWords: ['rock'], imagePrompt: 'a grey rock',
        ask: 'Which one is not alive?', correctWord: 'ball', wrongWords: [{ word: 'cat', trap: 'other' }], why: 'Things that are not alive do not grow.' }),
      { name: 'finish', args: {} }],
      // After the review sends stop 2 back: swap a picture, finish.
      [stop({ replaceIndex: 2, correctWord: 'bird', wrongWords: [{ word: 'shoe', trap: 'other' }, { word: 'kite', trap: 'looks_like' }] }), { name: 'finish', args: {} }],
    );
    reviews.push({ stops: [
      { stop: 0, pick: 'frog', alsoFits: [], note: '' },
      { stop: 1, pick: 'ball', alsoFits: [], note: '' },
      { stop: 2, pick: 'bird', alsoFits: ['shoe'], note: 'odd' },
    ] });

    const walk = await generateWonderWalk(ctx);
    expect(seen.authorCalls).toBe(3);
    expect(seen.reviewCalls).toBe(1);
    expect(walk.challenges).toHaveLength(3);
    expect(walk.challenges.map(s => s.options.find(o => o.id === s.correctOptionId)!.word)).toEqual(['frog', 'ball', 'bird']);
    expect(walk.challenges[1].ask).toBe('Which one is not alive?');
    expect(walk.challenges[2].options.map(o => o.word).sort()).toEqual(['bird', 'kite', 'shoe']);
    expect(walk.challenges.every(s => s.sceneImage === 'data:image/png;base64,AAAA')).toBe(true);
    expect(walk).toMatchObject({ gradeBand: 'K', challengeType: 'which-one', domain: 'science' });
  });

  it('reports the code checks on every write', async () => {
    turns.push([
      { name: 'plan_walk', args: { title: 'T', bigIdea: 'B', domain: 'science', ideas: ['a', 'b'] } },
      stop({ correctWord: 'amoeba' }),
    ], [{ name: 'remove_stop', args: { index: 0 } }]);
    await expect(generateWonderWalk(ctx)).rejects.toThrow(/without a valid walk/);
    // The write's result carried its blocking checks back to the author.
    expect(JSON.stringify(seen.lastToolResults)).toContain('no picture for \\"amoeba\\"');
  });

  it('declines a topic one-thing pictures cannot teach, in one turn', async () => {
    turns.push([{ name: 'decline', args: { reason: 'counting needs groups of things, not one picture' } }]);
    await expect(generateWonderWalk({ ...(ctx as object), topic: 'Counting to five' } as never)).rejects.toThrow(/declined "Counting to five": counting needs groups/);
    expect(seen.authorCalls).toBe(1);
  });

  it('salvages the passing stops when the budget runs out short of a full walk', async () => {
    turns.push([
      { name: 'plan_walk', args: { title: 'Alive or Not?', bigIdea: 'Living things eat and grow.', domain: 'science',
        ideas: ['Living things eat and grow.', 'Nonliving things do not grow.', 'Plants are alive too.'] } },
      stop({}),
      stop({ ideaIndex: 1, narration: 'A rock does not eat. It does not grow.', sceneWords: ['rock'], imagePrompt: 'a grey rock',
        ask: 'Which one is not alive?', correctWord: 'ball', wrongWords: [{ word: 'cat', trap: 'other' }], why: 'Things that are not alive do not grow.' }),
      stop({ ideaIndex: 2, correctWord: 'amoeba' }), // blocked: no picture
    ]);
    // Every later turn is a refused finish (2 passing stops, idea 2 untaught) until the turn cap.
    const walk = await generateWonderWalk(ctx);
    expect(walk.challenges.map(s => s.options.find(o => o.id === s.correctOptionId)!.word)).toEqual(['frog', 'ball']);
    expect(walk.challenges.map(s => s.idea)).toEqual(['Living things eat and grow.', 'Nonliving things do not grow.']);
    expect((walk.agentDebug as { advisories: string[] }).advisories[0]).toMatch(/^salvaged: shipped 2 passing stop.s.*dropped 1/);
    expect(seen.reviewCalls).toBe(0);
  });

  it('a math walk: the author builds worlds; code names each skill, blocks a shortcut and a tier miss, derives keys, ships', async () => {
    expect(toolsFor(['add-take', 'count-out']).map(t => t.name)).toEqual(['plan_walk', 'write_math_stop', 'remove_stop', 'finish', 'decline']);
    const w = (o: Record<string, unknown>) => ({ name: 'write_math_stop', args: { ideaIndex: 0, why: 'Touch each one as you count. The last number tells how many.', ...o } });
    const pond = (start: number, join: number, o: Record<string, unknown> = {}) => w({
      places: [{ id: 'pond', kind: 'group', arrangement: 'scattered', contents: [{ word: 'duck', count: start }] }],
      events: [{ kind: 'join', place: 'pond', word: 'duck', count: join }], answer: { kind: 'number', countPlaces: ['pond'] },
      narration: `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][start]} ducks swim. More ducks come!`, ask: 'How many ducks now?', ...o });
    turns.push(
      [
        { name: 'plan_walk', args: { title: 'Ducks Come and Go', bigIdea: 'When some join, there are more.', domain: 'math', ideas: ['Some join: count them all.', 'Count out just enough.'] } },
        // Leak: the narration says the total.
        pond(4, 3, { narration: 'Four ducks swim. Three more come. Now there are seven!' }),
        // Off the hard tier: 2 + 1 in rows is easy.
        w({ places: [{ id: 'p', kind: 'group', arrangement: 'rows', contents: [{ word: 'frog', count: 2 }] }], events: [{ kind: 'join', place: 'p', word: 'frog', count: 1 }],
          answer: { kind: 'number', countPlaces: ['p'] }, narration: 'Two frogs sit. One more hops in!', ask: 'How many frogs now?' }),
        w({ ideaIndex: 1, places: [{ id: 'pile', kind: 'pile', arrangement: 'scattered', contents: [{ word: 'apple', count: 10 }] }, { id: 'bk', kind: 'basket', arrangement: 'rows', contents: [] }],
          answer: { kind: 'move', goal: [{ places: ['bk'], count: 6 }] }, narration: 'So many apples!', ask: 'Can you put six apples in the basket?' }),
        { name: 'finish', args: {} },
      ],
      [pond(4, 3, { replaceIndex: 0 }), pond(5, 3, { replaceIndex: 1 }), { name: 'finish', args: {} }],
    );
    const walk = await generateWonderWalk({ ...(ctx as object), topic: 'Adding within 10', targetEvalMode: 'add-take|count-out', supportTier: 'hard' } as never);
    const results = JSON.stringify(seen.lastToolResults);
    expect(results).toContain('the narration says 7, the answer');
    expect(results).toMatch(/math stop 1 is (easy|medium).*this walk is hard/);
    expect(results).toContain('add-take (K.OA.A.1-2)');
    expect(seen.reviewCalls).toBe(0);
    expect(walk.domain).toBe('math');
    expect(walk.challenges.map(s => s.challengeType)).toEqual(['add-take', 'add-take', 'count-out']);
    expect(walk.challenges.map(s => s.correctOptionId)).toEqual(['num-7', 'num-8', '']);
    expect(walk.challenges.every(s => s.difficulty?.band === 'hard' && s.sceneImage === null && s.world)).toBe(true);
  });

  it('a language walk: the author builds word worlds; code fills the sounds, blocks a meaning shortcut, names the skills, ships', async () => {
    expect(toolsFor(['rhyme', 'first-sound']).map(t => t.name)).toEqual(['plan_walk', 'write_word_stop', 'remove_stop', 'finish', 'decline']);
    const w = (o: Record<string, unknown>) => ({ name: 'write_word_stop', args: { ideaIndex: 0, why: 'Say each word slowly and listen.', ...o } });
    const rhyme = (ref: string, things: string[], o: Record<string, unknown> = {}) => w({ refs: [{ id: 'r', word: ref }], things: things.map((x, i) => ({ id: `t${i}`, word: x })),
      answer: { kind: 'tap', rule: { type: 'rhymes', ref: 'r' } }, narration: `Here is a ${ref}. Rhyming words end the same.`, ask: `Which one rhymes with ${ref}?`, ...o });
    turns.push(
      [
        { name: 'plan_walk', args: { title: 'Sound Safari', bigIdea: 'Words are made of sounds we can hear.', domain: 'language', ideas: ['Rhyming words end the same.', 'Words start with a sound.'] } },
        // Shortcut: rat is the only animal like the cat.
        rhyme('cat', ['rat', 'cup', 'sun']),
        rhyme('goat', ['boat', 'dog', 'sun']),
        w({ ideaIndex: 1, things: [{ id: 'a', word: 'sock' }, { id: 'b', word: 'map' }, { id: 'c', word: 'dog' }],
          answer: { kind: 'tap', rule: { type: 'sound', at: 'first', sound: 's' } }, narration: 'Listen to the start of each word.', ask: 'Which one starts with [sound]?' }),
        { name: 'finish', args: {} },
      ],
      // The fix also answers the walk rule that the child makes a word once: the first rhyme becomes say-any.
      [rhyme('cat', ['hat', 'dog', 'sun'], { replaceIndex: 0, respond: 'say-any', ask: 'Can you think of a word that rhymes with cat?' }), { name: 'finish', args: {} }],
    );
    const walk = await generateWonderWalk({ ...(ctx as object), topic: 'Rhymes and beginning sounds', targetEvalMode: 'rhyme|first-sound' } as never);
    const results = JSON.stringify(seen.lastToolResults);
    expect(results).toContain('only animal like the cat');
    expect(results).toContain('rhyme (RF.K.2a)');
    expect(results).toContain('Which one starts with sss?');
    expect(results).toContain('no stop asks the child to make a word');
    expect(seen.reviewCalls).toBe(0);
    expect(walk.challenges.map(s => s.respond)).toEqual(['say-any', undefined, undefined]);
    expect(walk.challenges[0].sayAny!.length).toBeGreaterThanOrEqual(3);
    expect(walk.domain).toBe('language');
    expect(walk.challenges.map(s => s.challengeType)).toEqual(['rhyme', 'rhyme', 'first-sound']);
    expect(walk.challenges[2].ask).toBe('Which one starts with sss?');
    const right = walk.challenges.map(s => s.words!.things.find(t => `thing-${t.id}` === s.correctOptionId)!.word);
    expect(right).toEqual(['hat', 'boat', 'sock']);
  });
});
