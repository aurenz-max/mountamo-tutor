/**
 * Bar model's open build (`make_graph`, `/add-eval-modes` references/build-mode.md): the learner sets the bars of an
 * EMPTY picture graph so the data fits an ask ("apples have the most"), and any data that fits passes. Code judges
 * the data at "I'm done!"; there is no answer key, only the rule.
 *
 * Pure: the component, the workspace scene, the generator and the tests read the same rule, check and levers.
 * Levers start bare (keeping the bars straight IS the task) and come on a miss:
 * - `level_line` (help): a dashed line across the graph at the top of the bar the ask compares against.
 * - `bar_counts` (help): how many pictures the learner has put in each bar, above it. Never a number the ask needs.
 * - `two_bars` (simplify): an ungraded practice graph with only two bars and the same ask, then the full graph.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { BarModelChallenge } from './BarModel';

export type GraphRuleKind = 'most' | 'fewest' | 'same' | 'more_than';

/** What the made graph must show. `a` and `b` are row indexes; `by` is how many more (more_than). */
export interface GraphRule { kind: GraphRuleKind; a: number; b?: number; by?: number }

/** The tallest a bar can be: one picture per thing, up to ten. */
export const GRAPH_MAX = 10;

/**
 * What a made graph that does not fit the ask shows, in precedence order:
 * - most / fewest: `reversed` (the named bar is the other extreme), `tied` (it ties another for the most or the fewest),
 *   `other_row` (another bar has the most or the fewest);
 * - same: `left_empty` (both named bars are empty), `not_same`;
 * - more_than: `reversed` (the other bar has that many more), then `one_short` / `one_over` / `short_by_more` /
 *   `over_by_more` (how many more the graph shows, against how many the ask says).
 */
export type MakeGraphMiss = 'reversed' | 'tied' | 'other_row' | 'not_same' | 'left_empty'
  | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';

export const MAKE_GRAPH_MISSES: readonly MakeGraphMiss[] = ['reversed', 'tied', 'other_row', 'not_same', 'left_empty',
  'one_short', 'one_over', 'short_by_more', 'over_by_more'];

const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The ask, stated by code from the rule. The rule IS the task, so its words (and `by`) are not a leak. */
export function makeGraphAsk(labels: readonly string[], r: GraphRule): string {
  const a = labels[r.a] ?? 'the first row', b = labels[r.b ?? -1] ?? 'the other row';
  switch (r.kind) {
    case 'most': return `Make a graph where ${a} have the most.`;
    case 'fewest': return `Make a graph where ${a} have the fewest.`;
    case 'same': return `Make a graph where ${a} and ${b} have the same number.`;
    case 'more_than': return `Make a graph where there are ${NUMBER_WORD[r.by ?? 1] ?? r.by} more ${a} than ${b}.`;
  }
}

const offBy = (got: number, want: number): MakeGraphMiss | undefined => got === want ? undefined
  : got === want - 1 ? 'one_short' : got === want + 1 ? 'one_over' : got < want ? 'short_by_more' : 'over_by_more';

/** The check at "I'm done!": undefined when the bars fit the ask, else what they show instead. */
export function makeGraphMiss(r: GraphRule | undefined, bars: readonly number[]): MakeGraphMiss | undefined {
  if (!r) return undefined;
  const a = bars[r.a] ?? 0, b = bars[r.b ?? -1] ?? 0;
  const others = bars.filter((_, i) => i !== r.a);
  switch (r.kind) {
    case 'most': case 'fewest': {
      const beats = (x: number, y: number) => r.kind === 'most' ? x > y : x < y;
      if (others.every(x => beats(a, x))) return undefined;
      if (others.every(x => beats(x, a))) return 'reversed';
      return others.every(x => !beats(x, a)) ? 'tied' : 'other_row';
    }
    case 'same':
      if (a === 0 && b === 0) return 'left_empty';
      return a === b ? undefined : 'not_same';
    case 'more_than': {
      const by = r.by ?? 1;
      if (a - b === by) return undefined;
      return b - a === by ? 'reversed' : offBy(a - b, by);
    }
  }
}

/** The check's words under the graph: what the learner's own graph shows, never what to change. */
export function makeGraphVerdict(c: BarModelChallenge, bars: readonly number[]): string {
  const r = c.graphRule;
  if (!r) return '';
  const name = (i: number) => c.values[i]?.label ?? 'that bar';
  const a = name(r.a), b = name(r.b ?? -1);
  const miss = makeGraphMiss(r, bars);
  const extreme = (most: boolean) => {
    const v = most ? Math.max(...bars) : Math.min(...bars);
    return name(bars.findIndex((x, i) => x === v && i !== r.a));
  };
  if (!miss) return r.kind === 'most' ? `Your graph shows ${a} with the most.` : r.kind === 'fewest' ? `Your graph shows ${a} with the fewest.`
    : r.kind === 'same' ? `Your graph shows ${a} and ${b} the same.` : `Your graph shows ${r.by} more ${a} than ${b}.`;
  switch (miss) {
    case 'tied': return `On your graph ${a} are tied with ${extreme(r.kind === 'most')}.`;
    case 'reversed': return r.kind === 'more_than' ? `On your graph there are more ${b} than ${a}.`
      : `On your graph ${a} have the ${r.kind === 'most' ? 'fewest' : 'most'}.`;
    case 'other_row': return `On your graph ${extreme(r.kind === 'most')} have the ${r.kind === 'most' ? 'most' : 'fewest'}.`;
    case 'not_same': return `On your graph ${a} and ${b} are not the same.`;
    case 'left_empty': return `On your graph ${a} and ${b} have none yet.`;
    default: return `Look at how many more ${a} than ${b} your graph shows.`;
  }
}

// ── Levers ────────────────────────────────────────────────────────────────────

export const LINE_LEVER = 'level_line';
export const COUNTS_LEVER = 'bar_counts';
export const TWO_BARS_LEVER = 'two_bars';
const TWO_BARS = '~two';

export const isPracticeGraph = (c: Pick<BarModelChallenge, 'id'> | null) => !!c?.id.endsWith(TWO_BARS);

/** The bar the level line sits on: the one the ask compares against. */
export const levelLineRow = (r: GraphRule) => r.kind === 'more_than' ? r.b ?? r.a : r.a;

/** The easier graph for `two_bars`, or null: only the bars the ask names (most/fewest keep one other), all empty. */
export function twoBarPractice(c: BarModelChallenge): BarModelChallenge | null {
  const r = c.graphRule;
  if (!r || c.values.length <= 2 || isPracticeGraph(c)) return null;
  const keep = [r.a, r.b ?? (r.a === 0 ? 1 : 0)].sort((x, y) => x - y);
  const values = keep.map(i => ({ ...c.values[i], value: 0 }));
  const rule: GraphRule = { ...r, a: keep.indexOf(r.a), ...(r.b != null ? { b: keep.indexOf(r.b) } : {}) };
  return { ...c, id: `${c.id}${TWO_BARS}`, values, graphRule: rule, prompt: makeGraphAsk(values.map(v => v.label), rule) };
}

export function makeGraphLevers(c: BarModelChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  const r = c?.graphRule;
  if (!c || !r || c.evalMode !== 'make_graph') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: MakeGraphMiss[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const a = c.values[r.a]?.label ?? 'the named', b = c.values[r.b ?? -1]?.label ?? 'the other';
  const extreme = r.kind === 'fewest' ? 'shortest' : 'tallest';
  const line = r.kind === 'more_than'
    ? lever(LINE_LEVER, 'help', 'shown', ['reversed', 'short_by_more', 'over_by_more'],
      `The learner puts in far too many or too few extra ${a}, or makes ${b} the taller bar.`,
      `Draws a dashed line across the graph at the top of the ${b} bar; the ${a} pictures above the line are the extra ones. It moves as the learner puts pictures in or takes them out.`)
    : r.kind === 'same'
      ? lever(LINE_LEVER, 'help', 'shown', ['not_same'], `The learner makes the ${a} and ${b} bars different heights.`,
        `Draws a dashed line across the graph at the top of the ${a} bar, so the learner can see where the ${b} bar reaches against it. It moves as the learner puts pictures in or takes them out.`)
      : lever(LINE_LEVER, 'help', 'shown', ['reversed', 'tied', 'other_row'],
        `The learner cannot see which bar is ${extreme}, or makes another bar as ${r.kind === 'most' ? 'tall' : 'short'} as the ${a} bar.`,
        `Draws a dashed line across the graph at the top of the ${a} bar, so each bar shows whether it reaches past it. It moves as the learner puts pictures in or takes them out.`);
  const counts = lever(COUNTS_LEVER, 'help', 'both',
    r.kind === 'more_than' ? ['one_short', 'one_over'] : r.kind === 'same' ? ['not_same', 'left_empty'] : ['tied'],
    r.kind === 'more_than' ? `The learner puts in one too many or one too few extra ${a}.`
      : r.kind === 'same' ? `The learner cannot tell whether the ${a} and ${b} bars hold the same number of pictures.`
        : 'The learner makes two bars the same height without seeing it.',
    'Shows above each bar how many pictures the learner has put in it so far. Never a number the ask needs.');
  const practice = twoBarPractice(c);
  return [line, counts, ...(practice || pulled.includes(TWO_BARS_LEVER) ? [lever(TWO_BARS_LEVER, 'simplify', 'shown',
    [...MAKE_GRAPH_MISSES], 'The learner cannot keep every bar straight while they put pictures in.',
    `Opens an easier graph to make first with only the ${practice?.values.map(v => v.label).join(' and ') ?? 'two'} bars and the same ask, all empty. It is not graded; the full graph comes back after it.`)] : [])];
}
