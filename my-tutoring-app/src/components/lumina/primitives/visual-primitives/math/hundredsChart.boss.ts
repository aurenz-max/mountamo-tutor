/**
 * hundreds-chart's boss, on the spoken preset (`components/live-activity/boss.ts`): identifying the shape and finding
 * the skip value are said (the tutor judges the words against the key) or tapped and checked (the chart checks the
 * tap), SAY_OR_SHOW items; highlighting and completing a pattern have no key, the chart checks the set of cells, and
 * they play through `show`. The card is `hundredsChart.card.ts`; this file holds the content check, the items, the ask
 * and key, the levers and the harness play.
 */
import type { HundredsChartData } from './HundredsChart';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { hundredsChartCard, type HundredsChartMiss } from './hundredsChart.card';
import { HUNDREDS_LEVERS, practiceItem, practiceParent } from './hundredsChartLevers';
import {
  CELL_TYPES, hundredsChartAsk, hundredsChartHarnessInputs, hundredsChartHarnessWords, hundredsChartKey,
  hundredsChartSpokenMisses, neededCells,
} from './hundredsChartWorkspace';

/** Reject a challenge the chart cannot check: a cell mode needs numbers left to tap, a choice mode its key among the choices. */
export const validateHundredsChartData = (value: unknown): HundredsChartData => validateChallengePool<HundredsChartData>(value,
  c => !!c && typeof c.instruction === 'string' && !!c.instruction
    && (CELL_TYPES.has(c.type) ? Array.isArray(c.correctCells) && neededCells(c).length > 0
      : c.type === 'identify_pattern' ? Array.isArray(c.options) && c.options.includes(c.correctAnswer)
        : c.type === 'find_skip_value' && Array.isArray(c.options) && c.options.includes(String(c.skipValue))),
  { pool: 'Generated hundreds chart has invalid lesson content.', item: 'A hundreds-chart challenge cannot be checked.' });

export const hundredsChartBoss = spokenBoss<HundredsChartData, HundredsChartData['challenges'][number], HundredsChartMiss>({
  card: hundredsChartCard,
  validate: validateHundredsChartData,
  items: d => d.challenges,
  levers: HUNDREDS_LEVERS,
  speech: {
    ask: hundredsChartAsk,
    // A cell item has no key: the chart checks the set of cells.
    key: hundredsChartKey,
    misses: hundredsChartSpokenMisses,
    say: hundredsChartHarnessWords,
    modeOf: c => c.type,
    // The keyless items through their real controls: every needed cell (one stray in place of the last when wrong),
    // then Check.
    show: (right, c, ctx) => hundredsChartHarnessInputs(c, !right, ctx.data.gridMax ?? 100) as DriverInput[],
  },
  drive: {
    component: 'primitives/visual-primitives/math/HundredsChart.tsx',
    instanceId: 'chart',
    defaults: { grade: 'Grade 1', mode: 'highlight_sequence', topic: 'Skip counting by 2s, 5s and 10s on the hundreds chart' },
    mounted: '[data-pip-object="chart"]',
    // The session item, or the easier practice chart a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as HundredsChartData;
      const all = data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, all);
      return parent ? practiceItem(parent, data) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
  },
});
