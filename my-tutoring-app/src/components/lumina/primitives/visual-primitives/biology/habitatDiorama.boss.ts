/**
 * habitat-diorama's boss, on the spoken preset (`components/live-activity/boss.ts`): an observe, predict or defend
 * item is one choice on screen the learner says, judged by the tutor against `habitatKey`; a connect, restore or
 * build_habitat item has no key, the activity checks it, and the harness plays it through `show`. The card is
 * `habitatDiorama.card.ts`; this file holds the content check, the items, the ask and key, the levers and the
 * harness play. A payload with no askable challenge is the ungraded exploration diorama, which no session binds.
 */
import type { HabitatDioramaData } from './HabitatDiorama';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { habitatDioramaCard, type HabitatDioramaMiss } from './habitatDiorama.card';
import { HABITAT_LEVERS, SIMPLER_SUFFIX } from './habitatDioramaLevers';
import {
  askFor, fewerNeedsItem, habitatKey, habitatSpokenMisses, habitatTapLabel, itemsFromChallenges, wrongGestureFor,
  type HabitatItem,
} from './habitatDioramaDomain';
import { FEWER_SUFFIX, animalById, pieceById } from './habitatBuild';

/** The habitat as the live adapter reads it: its name is the workspace title. */
export type HabitatBossData = HabitatDioramaData & { title: string };

/** The session's items, built through the family's own gates (a leaked, broken or repeated challenge is dropped). */
export const habitatItems = (data: Pick<HabitatDioramaData, 'challenges' | 'organisms' | 'relationships' | 'supportTier'>) =>
  itemsFromChallenges(data.challenges ?? [], data).items;

/** Reject a habitat with nothing askable: the build gates drop a leaked prompt, an inverted predation edge, choices
 *  the ear cannot tell apart. A payload with no challenges is the ungraded exploration diorama, which no session runs. */
export function validateHabitatDioramaData(value: unknown): HabitatBossData {
  const d = value as HabitatDioramaData;
  if (!d || !d.habitat || typeof d.habitat.name !== 'string' || !Array.isArray(d.organisms) || !Array.isArray(d.relationships))
    throw new Error('Generated habitat diorama has invalid lesson content.');
  if (!habitatItems(d).length) throw new Error('No habitat diorama challenge can be asked.');
  return { ...d, title: d.habitat.name };
}

/** The current item: a session item, or an easier practice item (`~simpler`, `~fewer`) rebuilt from its parent. */
function currentItem(data: HabitatDioramaData, itemId: string): HabitatItem | undefined {
  const items = habitatItems(data);
  const ctx = { data: { organisms: data.organisms ?? [], relationships: data.relationships ?? [] }, shownEmojis: [] };
  const fewer = items.find(i => `${i.id}${FEWER_SUFFIX}` === itemId);
  if (fewer) return fewerNeedsItem(fewer) ?? undefined;
  const simpler = items.find(i => `${i.id}${SIMPLER_SUFFIX}` === itemId);
  if (simpler) {
    const lever = HABITAT_LEVERS.specs.find(s => s.type === 'easier' && s.modes?.includes(simpler.kind));
    return (lever && HABITAT_LEVERS.simpler(simpler, ctx, lever.id)) ?? undefined;
  }
  return items.find(i => i.id === itemId);
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const habitatDioramaBoss = spokenBoss<HabitatBossData, HabitatItem, HabitatDioramaMiss>({
  card: habitatDioramaCard,
  validate: validateHabitatDioramaData,
  items: habitatItems,
  levers: HABITAT_LEVERS,
  speech: {
    ask: askFor,
    // connect, restore and build_habitat have no key: the activity checks the tap or the habitat.
    key: habitatKey,
    misses: habitatSpokenMisses,
    say: item => ({ correct: item.answerText, plainWrong: item.signatureWrong }),
    // A connect or restore tap on the button named for the living thing or the zone. build_habitat clears a kept
    // habitat, puts in one piece per asked need that serves the animal, and presses I'm done!; wrong leaves the last
    // need out (`one_need_unmet`).
    show: (right, item, ctx) => {
      if (item.kind === 'connect') return [choose(habitatTapLabel(item, right ? item.toId! : wrongGestureFor(item)))];
      if (item.kind === 'restore') return [choose(habitatTapLabel(item, right ? item.restorationZone! : wrongGestureFor(item)))];
      const animal = animalById(item.animalId);
      if (item.kind !== 'build_habitat' || !animal) throw new Error(`habitat-diorama: item ${item.id} is said, not shown`);
      const pieces = (item.needs ?? []).map(n => (item.tray ?? []).find(p => animal.meets[n].includes(p) && !animal.harmedBy.includes(p)));
      if (pieces.some(p => !p)) throw new Error(`habitat-diorama build: the tray cannot meet every need of the ${animal.name}`);
      const made = right ? (pieces as string[]) : (pieces as string[]).slice(0, -1);
      const start = Number(ctx.demand?.piecesPlaced ?? 0) > 0 ? [choose('Clear the habitat')] : [];
      return [...start, ...made.map(id => choose(`Put in ${pieceById(id)!.name}`)), choose("I'm done!")];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/biology/HabitatDiorama.tsx',
    instanceId: 'habitat',
    defaults: { grade: 'Grade 2', mode: 'connect', topic: 'Animals and plants in a pond habitat depend on each other' },
    mounted: '[data-pip-object="workspace"]',
    // The exploration diorama's tags: emitted only on a payload with no challenge, which no session binds.
    leakTokens: ['HABITAT_ORIENT', 'HABITAT_ORGANISM_SELECTED', 'HABITAT_READ_ALOUD'],
    current: ctx => currentItem(ctx.data as HabitatDioramaData, String(ctx.itemId ?? '')),
  },
});
