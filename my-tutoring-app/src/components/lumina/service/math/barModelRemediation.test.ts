import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateBarModel, type BarModelChallenge } from './gemini-bar-model';
import {
  compiledIconCountContrast, eligibleBarModelTeaching, pictureGraphItems, pictureGraphOptions, selectIconCountContrast,
} from './barModelRemediation';

const summary = 'When a picture graph key says each icon stands for five, the learner reports the number of icons shown as the row total.';
const graph = (id: string, target: number, prompt = 'Each 🐶 stands for 5. How many dogs visited the park?'): BarModelChallenge => ({
  id, evalMode: 'picture_graph', graphStyle: 'picture', prompt, hint: 'Count the icons, then multiply by 5.',
  values: [{ label: 'Dogs', value: target }, { label: 'Cats', value: 10 }, { label: 'Birds', value: 40 }, { label: 'Fish', value: 15 }],
  scale: { step: 5, max: 40, iconEmoji: '🐶', iconValue: 5 }, targetBarIndex: 0, expectedValue: target,
  options: pictureGraphOptions(target, 5), showBarValues: false, showTargetHighlight: true, supportTier: 'medium',
});
const baseline = [graph('bm-1', 15), graph('bm-2', 30, 'Each 🐶 stands for 5. The row has 6 icons. How many dogs?'), graph('bm-3', 20), graph('bm-4', 35)];

it('always offers the bare icon count beside the unchanged answer', () => {
  expect(pictureGraphOptions(25, 5)).toEqual([5, 20, 25, 30]);
  expect(pictureGraphOptions(5, 5)).toEqual([0, 1, 5, 10]);
  expect(pictureGraphOptions(8, 2)).toEqual(expect.arrayContaining([4, 8]));
  for (let v = 5; v <= 40; v += 5) {
    const options = pictureGraphOptions(v, 5);
    expect(new Set(options).size).toBe(4);
    expect(options).toEqual(expect.arrayContaining([v, v / 5]));
  }
});

it('targets two rows so one row\'s icon count is the other row\'s total, recomputing every answer', () => {
  expect(compiledIconCountContrast(baseline).count).toBe(0);
  const selected = selectIconCountContrast(baseline, 'contrast_icon_count_and_row_value');
  expect(selected.status).toBe('targeted');
  expect(selected.count).toBe(2);
  const [a, b] = selected.challenges;
  expect([a.expectedValue, b.expectedValue]).toEqual([25, 5]);
  expect(a.values[0].value / 5).toBe(b.expectedValue);
  expect(a.options).toEqual(expect.arrayContaining([25, 5]));
  expect(b.options).toEqual(expect.arrayContaining([5, 1]));
  expect(b.prompt).toBe('Each 🐶 stands for 5. How many for Dogs?'); // stale "6 icons" replaced by the code template
  expect(a.prompt).toBe(baseline[0].prompt);
  expect(selected.challenges.slice(2)).toEqual(baseline.slice(2));
  expect(selected.challenges.map(c => [c.id, c.evalMode, c.targetBarIndex, c.scale?.iconValue, c.showTargetHighlight, c.supportTier, c.values.map(v => v.label)]))
    .toEqual(baseline.map(c => [c.id, c.evalMode, c.targetBarIndex, c.scale?.iconValue, c.showTargetHighlight, c.supportTier, c.values.map(v => v.label)]));
  expect(pictureGraphItems(selected.challenges)).toHaveLength(4);
  for (const c of selected.challenges) {
    expect(c.values.every(v => v.value > 0 && v.value % 5 === 0 && v.value <= 40)).toBe(true);
    expect(c.expectedValue).toBe(c.values[c.targetBarIndex!].value);
    expect(c.scale!.max).toBe(Math.max(...c.values.map(v => v.value)));
  }
  expect(selectIconCountContrast(baseline, null)).toMatchObject({ status: 'no-focus', challenges: baseline, count: 0 });
});

it('changes the fewest rows, reports existing contrasts, and never fabricates capacity', () => {
  const oneIcon = [graph('bm-1', 15), graph('bm-2', 30), graph('bm-3', 5), graph('bm-4', 35)];
  const minimal = selectIconCountContrast(oneIcon, 'contrast_icon_count_and_row_value');
  expect(minimal.challenges.map(c => c.expectedValue)).toEqual([15, 25, 5, 35]);
  const existing = [graph('bm-1', 5), graph('bm-2', 30), graph('bm-3', 25)];
  expect(selectIconCountContrast(existing, 'contrast_icon_count_and_row_value')).toMatchObject({ status: 'already-targeted', challenges: existing });
  expect(selectIconCountContrast([graph('bm-1', 15)], 'contrast_icon_count_and_row_value')).toMatchObject({ status: 'insufficient-capacity', count: 0 });
  const mixed = [graph('bm-1', 15), { ...graph('bm-2', 20), evalMode: 'read_scale' as const, graphStyle: 'scaled_bar' as const }];
  expect(selectIconCountContrast(mixed, 'contrast_icon_count_and_row_value').status).toBe('insufficient-capacity');
  // A compiled contrast needs the bare count to be a real choice on both items.
  const noDistractor = existing.map(c => ({ ...c, options: [c.expectedValue! - 5, c.expectedValue!, c.expectedValue! + 5, c.expectedValue! + 10] }));
  expect(compiledIconCountContrast(noDistractor).count).toBe(0);
});

it('gates executable task constraints, not observation meaning', () => {
  const task = { grade: '3', mode: 'picture_graph', tier: 'medium', topic: 'Favorite fruits picture graph' };
  expect(eligibleBarModelTeaching(task)).toBe(true);
  expect(eligibleBarModelTeaching({ ...task, grade: '2' })).toBe(true);
  for (const patch of [{ mode: 'read_scale' }, { tier: 'easy' }, { tier: 'hard' }, { grade: '4' }, { grade: undefined },
    { topic: 'Each star stands for 10' }, { intent: 'Picture graph where each icon is worth two' }])
    expect(eligibleBarModelTeaching({ ...task, ...patch })).toBe(false);
});

// ── Real generator path with the model mocked: the adapter must be causal. ──
const ctx: GenerationContext = { componentId: 'bar-model', instanceId: 'test', topic: 'Picture graphs of pets at the park',
  grade: '3', gradeLevel: 'Grade 3', gradeContext: 'Grade 3', objective: { text: 'Read scaled picture graphs' },
  scope: { topic: 'Picture graphs' }, raw: { targetEvalMode: 'picture_graph', difficulty: 'medium' } };
const isPlanner = (contents: unknown) => String(contents).startsWith('Select ONE');

async function generate(overrides: Partial<GenerationContext> = {}, move = 'contrast_icon_count_and_row_value') {
  let call = 0;
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(isPlanner(args.contents)
    ? { move, observationIds: [JSON.parse(String(args.contents).split('DATA ONLY:')[1]).observations[0].id] }
    : (() => {
      const target = [15, 30, 20, 35][call++ % 4];
      return { title: 'Pets at the park', description: 'Read the picture graph.', prompt: 'Each 🐶 stands for 5. How many dogs?',
        hint: 'Count the icons, then multiply by 5.', iconEmoji: '🐶', iconValue: 5, bar0Label: 'Dogs', bar0Value: target,
        bar1Label: 'Cats', bar1Value: 10, bar2Label: 'Birds', bar2Value: 40, bar3Label: 'Fish', bar3Value: 15,
        targetBarLabel: 'Dogs', expectedValue: target };
    })()) } as never));
  const data = await generateBarModel({ ...ctx, ...overrides, raw: { ...ctx.raw, ...overrides.raw } });
  const calls = vi.mocked(ai.models.generateContent).mock.calls.map(([a]) => a);
  vi.mocked(ai.models.generateContent).mockReset();
  return { data, planner: calls.filter(a => isPlanner(a.contents)), content: calls.filter(a => !isPlanner(a.contents)) };
}
afterEach(() => vi.restoreAllMocks());

it('a validated move changes the compiled content against the same baseline; private text stays in the planner call', async () => {
  const base = await generate();
  expect(base.planner).toHaveLength(0);
  expect(base.data.learningAdaptation).toBeUndefined();
  expect(compiledIconCountContrast(base.data.challenges).count).toBe(0);
  const adapted = await generate({ learningObservations: [{ id: 'bar-model::MEAS003-04', summary, evidence: 'Row shows 5 icons; chose 5; expected 25.' }] });
  expect(adapted.planner).toHaveLength(1);
  expect(String(adapted.planner[0].contents)).toContain(summary);
  expect(adapted.data.learningAdaptation).toEqual({ move: 'contrast_icon_count_and_row_value', status: 'targeted', comparisonCount: 2 });
  expect(compiledIconCountContrast(adapted.data.challenges).count).toBe(2);
  expect(adapted.data.challenges).not.toEqual(base.data.challenges);
  expect(adapted.data.challenges).toHaveLength(base.data.challenges.length);
  expect(adapted.data.challenges.map(c => [c.supportTier, c.showTargetHighlight, c.showBarValues, c.scale?.iconValue]))
    .toEqual(base.data.challenges.map(c => [c.supportTier, c.showTargetHighlight, c.showBarValues, c.scale?.iconValue]));
  expect(JSON.stringify(adapted.data)).not.toContain(summary);
  expect(JSON.stringify(adapted.content)).not.toContain(summary);
  expect(base.data.challenges.every(c => c.options!.includes(c.expectedValue! / 5))).toBe(true);
});

it('abstention, no observations and ineligible tasks leave generation byte-identical', async () => {
  const base = await generate();
  const abstained = await generate({ remediationFocus: 'The learner reverses numerator and denominator.' }, 'abstain');
  expect(abstained.planner).toHaveLength(1);
  expect(abstained.data).toEqual(base.data);
  for (const overrides of [{ raw: { difficulty: 'hard' } }, { raw: { targetEvalMode: 'read_scale' } }, { grade: '5' },
    { intent: 'Each icon stands for 10 books' }] as Partial<GenerationContext>[]) {
    const run = await generate({ ...overrides, remediationFocus: summary });
    expect(run.planner).toHaveLength(0);
    expect(run.data.learningAdaptation).toBeUndefined();
  }
});
