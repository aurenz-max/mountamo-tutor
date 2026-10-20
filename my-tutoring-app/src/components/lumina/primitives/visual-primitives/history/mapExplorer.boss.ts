/**
 * map-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): "which way?" (name_direction) is
 * said (the tutor judges the direction against the key) or tapped on the compass and checked by the activity, a
 * SAY_OR_SHOW item; finding a place, a continent or an ocean and planning a trip have no key, the map checks them,
 * and they play through `show`. The card is `mapExplorer.card.ts`; this file holds the content check, the items, the
 * ask and key, the levers and the harness play.
 */
import type { MapExplorerData } from './MapExplorer';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { hasText, spokenBoss } from '../../../components/live-activity/boss';
import { mapExplorerCard } from './mapExplorer.card';
import { MAP_LEVERS } from './mapExplorerLevers';
import { mapAsk, mapGiven, mapHarnessWords, mapKey, mapSpokenMisses } from './mapExplorerWorkspace';
import { CONTINENTS, OCEANS } from './map/mapGeo';
import { MAP_TASKS, flyRoute, isTownTask, placeById, type MapChallenge, type MapMiss } from './map/mapModel';

const REGIONS: readonly string[] = [...CONTINENTS, ...OCEANS];

/**
 * Reject a map the workspace cannot run: every ask needs an id, a task, an instruction and a target that is on
 * the map (a place on the session's town map, or a continent or ocean).
 */
export function validateMapExplorerData(value: unknown): MapExplorerData {
  const d = value as MapExplorerData;
  if (!d || !hasText(d.title)) throw new Error('Generated map has no title.');
  const asks = Array.isArray(d.challenges) ? d.challenges : [];
  const town = asks.some(c => (MAP_TASKS as readonly string[]).includes(c?.type) && isTownTask(c.type));
  if (town && (!d.townMap || !Array.isArray(d.townMap.places) || d.townMap.places.length < 3))
    throw new Error('Generated map has no town map.');
  if (!asks.length || asks.length > 12 || new Set(asks.map(c => c?.id)).size !== asks.length
      || asks.some(c => !c || !hasText(c.id) || !(MAP_TASKS as readonly string[]).includes(c.type) || !hasText(c.instruction)
        || (isTownTask(c.type) ? !placeById(d.townMap, c.targetId) || !placeById(d.townMap, c.fromId) : !REGIONS.includes(c.targetId ?? ''))
        || (c.type === 'name_direction' && !c.direction)))
    throw new Error('Generated map has invalid lesson content.');
  return d;
}

const FLIP: Record<string, string> = { North: 'South', South: 'North', East: 'West', West: 'East' };

export const mapExplorerBoss = spokenBoss<MapExplorerData, MapChallenge, MapMiss>({
  card: mapExplorerCard,
  validate: validateMapExplorerData,
  items: d => d.challenges,
  levers: MAP_LEVERS,
  speech: {
    ask: mapAsk,
    key: mapKey,
    given: mapGiven,
    misses: mapSpokenMisses,
    say: mapHarnessWords,
    modeOf: c => c.type,
    // Every keyless ask through the real controls: a place pin (wrong: the place the ask starts from); a continent or
    // ocean (wrong: another continent, or the starting continent); a trip's arrows, one hop each, then Land (wrong:
    // the east-west leg mirrored).
    show: (right, c, ctx) => {
      if (c.type === 'find_by_direction') return [{ type: 'touch', target: right ? c.targetId! : c.fromId! }];
      if (c.type === 'find_on_globe')
        return [{ type: 'touch', target: `region-${right ? c.targetId : c.targetId === 'africa' ? 'asia' : 'africa'}` }];
      if (c.type === 'world_direction') return [{ type: 'touch', target: `region-${right ? c.targetId : c.fromId}` }];
      if (c.type === 'build_route') {
        const town = (ctx.data as MapExplorerData).townMap;
        if (!town) throw new Error('map-explorer build_route: no map');
        const { wanted } = flyRoute(town, c, []);
        const e = Math.round(wanted.east), n = Math.round(wanted.north);
        const ew = e > 0 ? 'East' : 'West', ns = n > 0 ? 'North' : 'South';
        return [
          ...Array.from({ length: Math.abs(e) }, (): DriverInput => ({ type: 'choose', label: right ? ew : FLIP[ew] })),
          ...Array.from({ length: Math.abs(n) }, (): DriverInput => ({ type: 'choose', label: ns })),
          { type: 'choose', label: 'Land!' },
        ];
      }
      throw new Error(`map-explorer ${c.type} has a key: it is said, not shown`);
    },
  },
  drive: {
    component: 'primitives/visual-primitives/history/MapExplorer.tsx',
    instanceId: 'map',
    defaults: { grade: 'Grade 1', mode: 'find_by_direction', topic: 'Using a compass rose to find places on a map' },
    mounted: '[data-live-map]',
  },
});
