/**
 * Volcano Island's layers-over-time test, pure: the rock layers past eruptions laid on the volcano, the items code builds,
 * and the check. The cutaway (`VolcanoIsland.tsx`) draws the layers this file lists, bottom first.
 *
 * Each eruption lays a new layer on top of the ones already there, so the bottom layer is the oldest and the top the
 * youngest. A crack of lava that cuts up through layers (a dike) came after every layer it cuts. The learner erupts the
 * volcano once and watches the new layer go on top of everything, the crack too, then puts the layers in order.
 */
import type { Rng, Tier } from './volcanoModel';

export type LayerKind = 'lava' | 'ash' | 'pumice' | 'soil';
export interface Layer {
  /** A short id, unique within the item. */
  id: string;
  kind: LayerKind;
}

export const LAYER_WORDS: Record<LayerKind, string> = {
  lava: 'dark lava rock', ash: 'grey ash', pumice: 'pale pumice', soil: 'soil with old roots',
};
export const LAYER_COLORS: Record<LayerKind, string> = { lava: '#3b3a40', ash: '#9aa0a6', pumice: '#e8dcc0', soil: '#7a5233' };
export const DIKE_ID = 'dike';
export const NEW_ID = 'new';

export interface LayersChallenge {
  id: string;
  type: 'layers_over_time';
  instruction: string;
  /** The layers already in the volcano, bottom (oldest) first. */
  layers: Layer[];
  /** What the learner's own eruption lays on top. */
  newKind: LayerKind;
  /** A lava crack cutting up through every old layer (hard): younger than them, older than the learner's new layer. */
  dike: boolean;
  supportTier?: Tier;
  startLevers?: string[];
}

export const layersInstruction = (dike: boolean) =>
  `Erupt the volcano and watch where its new layer goes. Then tap the layers${dike ? ' and the lava crack' : ''} in order, oldest first.`;

export function makeLayers(id: string, kinds: LayerKind[], newKind: LayerKind, dike: boolean): LayersChallenge {
  return {
    id, type: 'layers_over_time', instruction: layersInstruction(dike),
    layers: kinds.map((kind, i) => ({ id: `L${i + 1}`, kind })), newKind, dike,
  };
}

/** The right order, oldest first: the old layers bottom to top, then the crack that cuts them, then the learner's new layer. */
export const correctOrder = (c: LayersChallenge): string[] => [...c.layers.map(l => l.id), ...(c.dike ? [DIKE_ID] : []), NEW_ID];

const KINDS: LayerKind[] = ['lava', 'ash', 'pumice', 'soil'];
const ERUPTED: LayerKind[] = ['lava', 'ash', 'pumice'];
const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** Easy: two old layers. Medium: three. Hard: three and a lava crack cutting through them all. */
export function buildLayers(tier: Tier, rng: Rng, id: string): LayersChallenge {
  const n = tier === 'easy' ? 2 : 3;
  // Every old layer a different kind, so each can be named by what it looks like.
  const kinds: LayerKind[] = shuffle(KINDS, rng).slice(0, n);
  // An eruption lays lava, ash or pumice; soil only forms over quiet years.
  const newKind = shuffle(ERUPTED, rng).find(x => x !== kinds[n - 1])!;
  return makeLayers(id, kinds, newKind, tier === 'hard');
}

export function pickLayers(n: number, tier: Tier, rng: Rng, idPrefix = 'layers'): LayersChallenge[] {
  return Array.from({ length: n }, (_, i) => buildLayers(tier, rng, `${idPrefix}-${i + 1}`));
}

// ============================================================================
// The check
// ============================================================================

export type LayersMiss = 'top_is_oldest' | 'crack_too_early' | 'order_slip';

export const layersMatches = (c: LayersChallenge, order: readonly string[]) =>
  order.length === correctOrder(c).length && order.every((x, i) => x === correctOrder(c)[i]);

/** The named miss: the layers read top-down (the top one first), the crack placed before a layer it cuts, or another slip. */
export function layersMiss(c: LayersChallenge, order: readonly string[]): LayersMiss | undefined {
  if (layersMatches(c, order)) return undefined;
  const stack = [...c.layers.map(l => l.id), NEW_ID];
  const withoutCrack = order.filter(x => x !== DIKE_ID);
  if (withoutCrack.length && (withoutCrack[0] === NEW_ID || withoutCrack.join() === [...stack].reverse().join())) return 'top_is_oldest';
  // The crack before any old layer it cuts.
  if (c.dike && order.includes(DIKE_ID) && c.layers.some(l => order.indexOf(l.id) > order.indexOf(DIKE_ID))) return 'crack_too_early';
  return 'order_slip';
}

export const layerName = (c: LayersChallenge, id: string): string =>
  id === NEW_ID ? `the new ${LAYER_WORDS[c.newKind]} layer from the eruption` : id === DIKE_ID ? 'the lava crack'
    : `the ${LAYER_WORDS[c.layers.find(l => l.id === id)!.kind]} layer`;

/** The learner's order in words (layers named by what they look like, never by their place). */
export const describeLayers = (c: LayersChallenge, order: readonly string[]) =>
  `put the layers in this order, oldest first: ${order.map(x => layerName(c, x)).join(', then ') || 'none yet'}`;

export function layersFeedback(c: LayersChallenge, order: readonly string[]): string {
  const miss = layersMiss(c, order);
  if (!miss) {
    return 'Yes! Each eruption lays a layer on top, so the bottom is the oldest and the top is the youngest.'
      + (c.dike ? ' The crack cuts through the old layers, so it came after them, and before your new layer on top.' : '');
  }
  if (miss === 'top_is_oldest') return 'Where did your new layer go when you erupted the volcano? Is the top layer old or new?';
  if (miss === 'crack_too_early') return 'The crack cuts through the layers. Could it cut a layer that was not there yet?';
  return 'Not quite. Start at the bottom: which layer was there first?';
}
