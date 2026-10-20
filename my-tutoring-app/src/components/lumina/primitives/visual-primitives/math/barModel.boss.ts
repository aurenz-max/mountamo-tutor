/**
 * bar-model's boss, on the spoken preset (`components/live-activity/boss.ts`): say_what_it_shows and
 * compare_two_graphs are said and the tutor judges the comparison against `barModelKey`; every other item has no key,
 * the graph checks it (a number or a row tapped, a sticker chart, a built or made graph), and it plays through `show`.
 * The card is `barModel.card.ts`; this file holds the content check, the items, the ask and key, the levers and the
 * harness play.
 */
import type { BarModelChallenge, BarModelData, BarModelEvalMode } from './BarModel';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { barModelCard, type BarModelMiss, type SpokenGraphMiss } from './barModel.card';
import { BAR_LEVERS, simplerGraph, simplerParent } from './barModelLevers';
import { GRAPH_MAX, twoBarPractice } from './barModelBuild';
import {
  OPTION_MODES, ROW_TAP_MODES, barModelHarnessAnswers, barModelKey, barModelSpokenMisses, graphComparisonFacts,
  graphExplanationAsk, isSpokenGraph,
} from './barModelWorkspace';

const MODES: ReadonlySet<BarModelEvalMode> = new Set<BarModelEvalMode>(Object.keys(barModelCard.modes) as BarModelEvalMode[]);
const count = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Can this challenge be answered as generated, by the check its mode uses? */
function answerable(c: BarModelChallenge): boolean {
  const rows = c.values.length;
  if (OPTION_MODES.has(c.evalMode)) return Array.isArray(c.options) && c.options.includes(c.expectedValue as number);
  if (ROW_TAP_MODES.has(c.evalMode)) return Number.isInteger(c.targetBarIndex) && c.targetBarIndex! >= 0 && c.targetBarIndex! < rows;
  if (c.evalMode === 'build_one_to_one') return Array.isArray(c.expectedCounts) && c.expectedCounts.length === rows
    && c.expectedCounts.every(count);
  if (c.evalMode === 'build_graph') return Array.isArray(c.expectedDataset) && c.expectedDataset.length === rows
    && c.expectedDataset.every(e => c.values.some(v => v.label === e.label) && count(e.value))
    && (c.availableScaleSteps ?? [1, 2, 5, 10]).includes(c.expectedScaleStep as number);
  // An open build has no key: the rule must name rows on the graph, and the graph must start empty.
  if (c.evalMode === 'make_graph') {
    const r = c.graphRule, row = (i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < rows;
    return !!r && row(r.a) && c.values.every(v => v.value === 0) && (r.kind === 'most' || r.kind === 'fewest' ? rows >= 2
      : row(r.b) && r.b !== r.a && (r.kind === 'same' || r.kind === 'more_than' && Number.isInteger(r.by) && r.by! >= 1 && r.by! <= GRAPH_MAX));
  }
  // A spoken explanation is judged against the comparisons its rows support; none means nothing to judge.
  return isSpokenGraph(c) && graphComparisonFacts(c).length > 0;
}

/** Reject a graph session whose challenges cannot be attempted. */
export function validateBarModelData(value: unknown): BarModelData {
  const d = value as BarModelData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !MODES.has(c.evalMode)
        || typeof c.prompt !== 'string' || !c.prompt.trim()
        || !Array.isArray(c.values) || !c.values.length
        || c.values.some(v => !v || typeof v.label !== 'string' || !count(v.value))))
    throw new Error('Generated bar model has invalid lesson content.');
  if (d.challenges.some(c => !answerable(c))) throw new Error('A bar-model challenge cannot be answered as generated.');
  return d;
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });

/** The current item: a session challenge, or an easier graph a simplify lever opened, rebuilt from its parent. */
export function barModelItem(challenges: readonly BarModelChallenge[], id: string | null | undefined): BarModelChallenge | undefined {
  const own = challenges.find(c => c.id === id);
  if (own) return own;
  const simpler = simplerParent(id, challenges);
  if (simpler) return simplerGraph(simpler) ?? undefined;
  const two = challenges.find(c => `${c.id}~two` === id);
  return two ? twoBarPractice(two) ?? undefined : undefined;
}

export const barModelBoss = spokenBoss<BarModelData, BarModelChallenge, BarModelMiss | SpokenGraphMiss>({
  card: barModelCard,
  validate: validateBarModelData,
  items: d => d.challenges,
  levers: BAR_LEVERS,
  speech: {
    ask: c => (isSpokenGraph(c) ? graphExplanationAsk(c) : c.prompt),
    // Only the two spoken modes have a key; the graph checks every other item.
    key: barModelKey,
    misses: barModelSpokenMisses,
    say: barModelHarnessAnswers,
    // Every shown mode through its real controls. A wrong number is another option; a wrong row the next row; a
    // sticker chart one sticker short in its first row; a made graph that ties, differs by one, or has one too many;
    // a built graph with the wrong step.
    show: (right, c, ctx) => {
      const wrong = !right;
      if (OPTION_MODES.has(c.evalMode)) return [choose(String(wrong ? (c.options ?? []).find(o => o !== c.expectedValue) : c.expectedValue))];
      const row = (i: number) => `${c.values[i].label} row`;
      if (ROW_TAP_MODES.has(c.evalMode)) {
        const target = c.targetBarIndex ?? 0;
        return [choose(row(wrong ? (target + 1) % c.values.length : target))];
      }
      const presses = (label: string, n: number): DriverInput[] => {
        if (n < 0) throw new Error(`bar-model ${c.evalMode}: the chart starts above its target`);
        return Array.from({ length: n }, () => choose(label));
      };
      if (c.evalMode === 'build_one_to_one') {
        const counts = (c.expectedCounts ?? []).map((n, i) => wrong && i === 0 ? (n === 0 ? 1 : n - 1) : n);
        return [...counts.flatMap((n, i) => presses(row(i), n - c.values[i].value)), { type: 'check' }];
      }
      // An open build keeps its graph through Try again, so the inputs move each bar from what the scene says it holds.
      if (c.evalMode === 'make_graph' && c.graphRule) {
        const r = c.graphRule, other = r.a === 0 ? 1 : 0;
        const want = c.values.map((_, i) => r.kind === 'most' ? (i === r.a ? (wrong ? 2 : 3) : wrong && i === other ? 2 : 1)
          : r.kind === 'fewest' ? (i === r.a || wrong && i === other ? 1 : 3)
            : r.kind === 'same' ? (i === r.a ? 2 : i === r.b ? (wrong ? 3 : 2) : 1)
              : i === r.a ? 1 + (r.by ?? 1) + (wrong ? 1 : 0) : 1);
        return [...c.values.flatMap((v, i) => {
          const now = Number(ctx.demand?.[v.label] ?? 0);
          return Array.from({ length: Math.abs(want[i] - now) }, () => ({ type: 'touch' as const, target: `${want[i] > now ? 'row' : 'top'}-${i}` }));
        }), choose("I'm done!")];
      }
      const steps = c.availableScaleSteps ?? [1, 2, 5, 10];
      const step = wrong ? steps.find(s => s !== c.expectedScaleStep) : c.expectedScaleStep;
      return [...(c.expectedDataset ?? []).flatMap(e => presses(`Increase ${e.label}`,
        e.value - (c.values.find(v => v.label === e.label)?.value ?? 0))), choose(`Step of ${step}`), choose('Submit graph')];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/BarModel.tsx',
    instanceId: 'graph',
    defaults: { grade: 'Kindergarten', mode: 'read_one_to_one', topic: 'Reading a picture graph where one picture stands for one thing' },
    mounted: '[data-pip-object="workspace"]',
    current: ctx => barModelItem((ctx.data as BarModelData).challenges ?? [], ctx.itemId),
  },
});
