/** NL-3: jump instructions and hints must not name a position the hops pass or land on. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('server-only', () => ({}));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateNumberLine, jumpTextNamesPosition } from './gemini-number-line';

const add = (startValue: number, changeValue: number) => ({ type: 'add' as const, startValue, changeValue, showJumpArc: false });
const sub = (startValue: number, changeValue: number) => ({ type: 'subtract' as const, startValue, changeValue, showJumpArc: false });

describe('jumpTextNamesPosition', () => {
  it('flags counted sequences and landings seen in real draws, in digits or words', () => {
    expect(jumpTextNamesPosition('Start at 16 and count backward one hop at a time: 15, then 14.', [sub(16, 2)])).toBe(true);
    expect(jumpTextNamesPosition('Try counting backward one hop at a time: 17, 16... keep going until you have made all 4 hops!', [sub(18, 4)])).toBe(true);
    expect(jumpTextNamesPosition('Try counting backward one hop at a time from 15: fourteen, thirteen...', [sub(15, 4)])).toBe(true);
    expect(jumpTextNamesPosition('Land on 8, then hop back 2.', [add(5, 3), sub(8, 2)])).toBe(true);
  });
  it('allows the start, the hop sizes, and "one by one" phrasing', () => {
    expect(jumpTextNamesPosition('Put your finger on 6, then count backward 3 hops to the left one step at a time.', [sub(6, 3)])).toBe(false);
    expect(jumpTextNamesPosition('Let us start right at zero and make a big jump forward by counting two steps!', [add(0, 2)])).toBe(false);
    expect(jumpTextNamesPosition('Count each hop one by one as you move forward.', [add(4, 2)])).toBe(false);
    expect(jumpTextNamesPosition('Start at 5. Make the first jump, then jump again.', [add(5, 3), sub(8, 2)])).toBe(false);
  });
});

it('replaces a leaking LLM hint with the code template in the generated challenge', async () => {
  vi.mocked(ai.models.generateContent).mockImplementation(async (args: { contents: unknown }) => {
    const prompt = String(args.contents);
    const start = Number(/Start position: (\d+)/.exec(prompt)![1]);
    const [, op, size] = /Operation: (add|subtract) (\d+)/.exec(prompt)!;
    const next = op === 'add' ? start + 1 : start - 1;
    return { text: JSON.stringify({ title: 'Hops', description: 'Jumps.', instruction: `Start at ${start} and hop ${op === 'add' ? 'forward' : 'back'} ${size}.`,
      hint: `Count out loud: ${next}, then keep going.` }) } as never;
  });
  const ctx = { componentId: 'number-line', instanceId: 'nl3', topic: 'Add within 20', gradeLevel: 'elementary', gradeContext: 'elementary',
    grade: '1', objective: {}, scope: {} as GenerationContext['scope'], targetEvalMode: 'jump', supportTier: 'medium',
    raw: { targetEvalMode: 'jump', difficulty: 'medium', numberRange: { min: 0, max: 20 } } } as GenerationContext;
  const data = await generateNumberLine(ctx);
  expect(data.challenges).toHaveLength(4);
  for (const c of data.challenges!) {
    const op = c.operations![0];
    const next = op.type === 'add' ? op.startValue + 1 : op.startValue - 1;
    // The first hop's position is named; it is allowed only when it equals the hop size (ambiguous, e.g. 5 - 4: "4").
    expect(c.hint).toBe(next === op.changeValue
      ? `Count out loud: ${next}, then keep going.`
      : `Count the hops one jump at a time, starting from ${op.startValue}.`);
    expect(c.instruction).toBe(`Start at ${op.startValue} and hop ${op.type === 'add' ? 'forward' : 'back'} ${op.changeValue}.`);
    expect(jumpTextNamesPosition(c.hint, c.operations!)).toBe(false);
  }
});

// Block body: a function returned from beforeEach runs as teardown.
beforeEach(() => { vi.mocked(ai.models.generateContent).mockReset(); });
