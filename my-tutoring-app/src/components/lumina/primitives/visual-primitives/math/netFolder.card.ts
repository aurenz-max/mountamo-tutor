/**
 * net-folder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `netFolder.boss.ts`.
 * Every mode is one item at a time, answered on screen and checked by the activity's own Check: count and surface
 * type numbers, identify, match and valid tap one option. A bespoke boss: the modes mix typing and a tap.
 */
import type { NetFolderChallenge } from './NetFolder';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`netFolderMiss`, `TeachingAttempt.miss`, handoff 20), from the item and what was typed or
 * tapped, drawn from the old catalog's commonStruggles (faces and edges confused, net faces not matched to the solid,
 * surface area miscounted, an invalid net taken as valid):
 * - count: `swapped_counts` two counts in each other's boxes; `faces_off` / `edges_off` / `vertices_off` one count
 *   wrong; `several_off` more than one;
 * - identify: `prism_pyramid` a prism taken for a pyramid or back; `base_shape` the right family, the wrong base;
 *   `curved_solid` a solid with a curved surface;
 * - match: `opposite_face` the face opposite the right one; `adjacent_face` a face beside it;
 * - valid: `missed_overlap` valid said of six squares two of which land on one face; `missed_count` valid said of a net
 *   that is not six squares; `rejected_valid` invalid said of a net that folds;
 * - surface: `half_the_faces` one face of each pair; `missed_a_face` a face left out; `extra_face` a face counted
 *   twice; `one_face` one face's area; `volume` length times width times height; `other_total` anything else.
 */
export type NetFolderMiss = 'swapped_counts' | 'faces_off' | 'edges_off' | 'vertices_off' | 'several_off'
  | 'prism_pyramid' | 'base_shape' | 'curved_solid'
  | 'opposite_face' | 'adjacent_face'
  | 'missed_overlap' | 'missed_count' | 'rejected_valid'
  | 'half_the_faces' | 'missed_a_face' | 'extra_face' | 'one_face' | 'volume' | 'other_total';

export const NET_MISSES_BY_MODE: Record<NetFolderChallenge['type'], readonly NetFolderMiss[]> = {
  count_faces_edges_vertices: ['swapped_counts', 'faces_off', 'edges_off', 'vertices_off', 'several_off'],
  identify_solid: ['prism_pyramid', 'base_shape', 'curved_solid'],
  match_faces: ['opposite_face', 'adjacent_face'],
  valid_net: ['missed_overlap', 'missed_count', 'rejected_valid'],
  surface_area: ['half_the_faces', 'missed_a_face', 'extra_face', 'one_face', 'volume', 'other_total'],
};

const TYPED = { answer: 'type', judge: 'activity', flow: 'one-at-a-time' } as const;

export const netFolderCard = defineCard<NetFolderMiss>({
  id: 'net-folder',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every mode publishes levers (`netFolderLevers.ts`); every miss is answered by a lever on every item.
  modes: {
    count_faces_edges_vertices: { ...TYPED, misses: NET_MISSES_BY_MODE.count_faces_edges_vertices,
      moves: 'types a number in each of the Faces, Edges and Vertices boxes, then presses Check Answer (the solid turns '
        + 'when dragged, and Unfold opens its net)' },
    identify_solid: { ...TAP_ONE, misses: NET_MISSES_BY_MODE.identify_solid,
      moves: 'taps one solid name, then presses Check Answer (the solid turns when dragged, and Unfold opens its net)' },
    match_faces: { ...TAP_ONE, misses: NET_MISSES_BY_MODE.match_faces,
      moves: 'taps one face name, then presses Check Answer' },
    valid_net: { ...TAP_ONE, misses: NET_MISSES_BY_MODE.valid_net,
      moves: 'taps Valid Net or Invalid Net, then presses Check Answer' },
    surface_area: { ...TYPED, misses: NET_MISSES_BY_MODE.surface_area,
      moves: 'types the total surface area in the Total box, then presses Check Answer (Unfold opens the box\'s net)' },
  },
  words: {
    job: 'work with 3D solids and their nets: count a solid\'s faces, edges and vertices, name a solid, find which face '
      + 'of a cube a square of its net becomes, decide whether a net folds into a cube, or add up a box\'s face areas '
      + 'for its surface area',
    answer: 'the counts or the total they type, or the solid, face or verdict they tap',
    question: 'the instruction, the option names, and each face size the face list prints',
  },
  levers: true,
});
