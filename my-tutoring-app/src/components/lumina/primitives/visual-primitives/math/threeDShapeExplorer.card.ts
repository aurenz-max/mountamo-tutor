/**
 * 3d-shape-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `threeDShapeExplorer.boss.ts`.
 * Every item is one spoken answer about the solid, flat shape, object or riddle on screen, judged by the tutor
 * against the key, so the boss is the spoken preset.
 */
import type { SpokenSolidMiss } from './threeDShapeExplorerDomain';
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

const NAME = ['flat_look_alike', 'similar_solid', 'other_solid'] as const;

export const threeDShapeExplorerCard = defineCard<SpokenSolidMiss>({
  id: '3d-shape-explorer',
  grades: ['Kindergarten', 'Grade 1'],
  // Each item's known wrong answers (`threeDShapeSpokenMisses`), named by the `spoken_miss` observer.
  modes: {
    identify_3d: { ...SPOKEN, misses: NAME },
    match_real_world: { ...SPOKEN, misses: ['said_object', ...NAME] },
    '2d_vs_3d': { ...SPOKEN, misses: ['opposite_dimension', 'said_shape_name'] },
    faces_properties: { ...SPOKEN, misses: ['said_other_surface', 'said_all_surfaces', ...OFF_BY,
      'opposite_verdict', 'said_solid', 'side_view_shape', 'other_flat_shape'] },
    shape_riddle: { ...SPOKEN, misses: ['similar_solid', 'flat_look_alike', 'other_solid'] },
  },
  words: {
    job: 'name the solid drawn (cube, sphere, cylinder, cone or rectangular prism), the solid an everyday object is '
      + 'shaped like, or the solid a riddle describes; say whether a shape is flat or solid; or answer one question '
      + 'about a solid\'s faces: how many, yes or no, or the shape of a flat face',
    answer: 'the answer',
    question: 'the question and, on a riddle, its printed clues',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
