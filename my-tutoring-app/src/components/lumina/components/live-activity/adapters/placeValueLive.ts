import type { PlaceValueChartData } from '../../../primitives/visual-primitives/math/PlaceValueChart';
import { askFor, itemsFromChallenges } from '../../../primitives/visual-primitives/math/placeValueScript';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const PLACE_VALUE_MODES = ['identify', 'build', 'compare', 'expanded_form'] as const;

/**
 * The session's items, built exactly as the component builds them: this primitive
 * pins ONE mode per session on the payload rather than per challenge, so the mode
 * comes from `challengeType`, not from a per-item field.
 */
const placeValueItems = (d: PlaceValueChartData) => itemsFromChallenges(d.challenges as any[], {
  mode: (PLACE_VALUE_MODES as readonly string[]).includes(d.challengeType) ? d.challengeType : 'compare',
  tier: d.supportTier ?? 'medium',
} as any).items;

/** Reject a chart whose challenges cannot be ASKED before they reach a child. */
export function validatePlaceValueData(value: unknown): PlaceValueChartData {
  const d = value as PlaceValueChartData;
  if (!d || typeof d.title !== 'string'
      || !(PLACE_VALUE_MODES as readonly string[]).includes(d.challengeType)
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated place value chart has invalid lesson content.');
  // `itemsFromChallenges` DROPS anything unaskable rather than repairing it, so
  // an empty build means this lesson would mount with nothing to ask.
  if (!placeValueItems(d).length) throw new Error('A place-value challenge cannot run in the lesson.');
  return d;
}

/** What the live adapter needs from the place value chart; the catalog's `teachingWorkspace` declares the rest. */
export const placeValueLiveDomain: WorkspaceDomain<PlaceValueChartData> = {
  validate: validatePlaceValueData,
  initialState: d => { const items = placeValueItems(d); return workspaceOpening({ title: d.title, task: askFor(items[0]), total: items.length }); },
};
