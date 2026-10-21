/**
 * place-value-chart's boss, on the spoken preset (`components/live-activity/boss.ts`) and stepped: each challenge is a
 * printed number (a find_place and a say_value step, spoken numbers the tutor judges against the key) or a dictated
 * one (a build_number step with no key, which the chart checks and the harness plays through `show`). The card is
 * `placeValueChart.card.ts`; this file holds the content check, the items, the ask and key, the levers and the
 * harness play.
 */
import type { PlaceValueChartData } from './PlaceValueChart';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { placeValueChartCard, type PlaceValueChartMiss } from './placeValueChart.card';
import { PLACE_VALUE_LEVERS, placeValueLeverContext, plainItem } from './placeValueLevers';
import { askFor, itemsFromChallenges, placeValueHarnessAnswers, type PlaceValueItem, type PlaceValueMode } from './placeValueDomain';
import { placeValueKey, placeValueSpokenMisses } from './placeValueWorkspace';
import { placeLabel } from './spokenNumberWords';

const MODES: readonly PlaceValueMode[] = ['identify', 'build', 'compare', 'expanded_form'];

/** The session's items, built exactly as the component builds them: one mode per session, pinned on the payload. */
export const placeValueItems = (d: Pick<PlaceValueChartData, 'challenges' | 'challengeType' | 'supportTier'>): PlaceValueItem[] =>
  itemsFromChallenges(d.challenges ?? [], {
    mode: MODES.includes(d.challengeType as PlaceValueMode) ? d.challengeType as PlaceValueMode : 'compare',
    tier: d.supportTier ?? 'medium',
  }).items;

/** Reject a chart whose challenges cannot be ASKED before they reach a child. */
export function validatePlaceValueData(value: unknown): PlaceValueChartData {
  const d = value as PlaceValueChartData;
  if (!d || typeof d.title !== 'string' || !MODES.includes(d.challengeType as PlaceValueMode)
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated place value chart has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so no items means nothing to ask.
  if (!placeValueItems(d).length) throw new Error('A place-value challenge cannot run in the lesson.');
  return d;
}

/** The step an item is: the scene's `kind`, which names the card's step. */
export const stepOf = (item: PlaceValueItem): string => item.kind;

const placeValueChartBase = spokenBoss<PlaceValueChartData, PlaceValueItem, PlaceValueChartMiss>({
  card: placeValueChartCard,
  validate: validatePlaceValueData,
  items: placeValueItems,
  levers: PLACE_VALUE_LEVERS,
  speech: {
    ask: askFor,
    // A dictated number has no key: the chart checks what is written.
    key: placeValueKey,
    misses: placeValueSpokenMisses,
    say: item => { const { correct, plainWrong } = placeValueHarnessAnswers(item); return { correct, plainWrong }; },
    // Every column written, through its labelled input; wrong is the ones digit one off (a full chart, so it commits
    // as a number rather than a gap).
    show: (right, item) => item.chartPlaces.map((p, i): DriverInput => {
      const d = item.expectedDigits[i];
      return { type: 'write', label: placeLabel(p), text: String(!right && p === 0 ? (d + 1) % 10 : d) };
    }),
  },
  drive: {
    component: 'primitives/visual-primitives/math/PlaceValueChart.tsx',
    instanceId: 'chart',
    defaults: { grade: 'Grade 2', mode: 'compare', topic: 'What a digit is worth in the tens and ones places' },
    mounted: '[data-pip-object="stage"]',
    // The session item, or the plainer dictation a simplify lever opened (`<id>~plain::build`), rebuilt from its parent.
    current: ctx => {
      const all = placeValueItems(ctx.data as PlaceValueChartData);
      const parent = all.find(i => ctx.itemId === `${i.id}~plain::build`);
      return parent ? plainItem(parent, placeValueLeverContext(all).sessionNumbers) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});

export const placeValueChartBoss = { ...placeValueChartBase, stepOf };
