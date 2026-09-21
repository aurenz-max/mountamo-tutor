/**
 * Does a validated payload contain only what its pinned eval mode asks for?
 *
 * The catalog owns mode -> challenge types and the adapter owns where a payload
 * spells its challenge type, so neither the prepared-plan projection nor the
 * ordinary-lesson gate restates either fact.
 */
import { getComponentById } from '../../service/manifest/catalog';
import { LIVE_ADAPTERS, type LiveActivityAdapter, type LiveActivityData, type LivePrimitiveId } from './activityContract';

/** Catalog challenge types the pinned mode(s) allow, or an error describing the pin. */
export function allowedChallengeTypes(primitiveId: string, pin: string): Set<string> | string {
  const modes = getComponentById(primitiveId)?.evalModes ?? [];
  if (!pin) return 'no resolved eval mode';
  const keys = pin === 'mixed' ? modes.map(m => m.evalMode) : pin.split('|');
  const picked = keys.map(key => modes.find(m => m.evalMode === key));
  if (!keys.length || picked.some(m => !m)) return `eval mode "${pin}" is not in the ${primitiveId} catalog`;
  return new Set(picked.flatMap(m => m!.challengeTypes));
}

/** The distinct challenge types in a VALIDATED payload that the pinned mode does not allow. */
export function offModeChallengeTypes(primitiveId: LivePrimitiveId, data: LiveActivityData, allowed: Set<string>): string[] {
  const adapter = LIVE_ADAPTERS[primitiveId] as LiveActivityAdapter;
  const types = adapter.challengeTypes?.(data)
    ?? ((data.challenges ?? []) as Array<{ type: string }>).map(c => c.type);
  return Array.from(new Set(types.filter(type => !allowed.has(type))));
}
