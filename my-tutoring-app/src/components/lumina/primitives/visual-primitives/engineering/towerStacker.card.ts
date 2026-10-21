/**
 * tower-stacker's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `towerStacker.boss.ts`.
 * Every mode is one open build the learner makes and hands in with "I'm done!", and the activity tests it with code
 * (`towerMiss`): a bespoke boss, one tower at a time.
 */
import { defineCard } from '../../../components/live-activity/boss';

export type TowerMode = 'build_tall' | 'build_few' | 'build_windproof';

/**
 * What a wrong tower shows (`TeachingAttempt.miss`), in the order the activity tests it:
 * - `tips_over`: a part of the tower falls under its own weight (its balance point is past what holds it up);
 * - `too_short`: it stands, but its top is below the green line;
 * - `too_many_pieces` (build_few): it stands and reaches the line with more pieces than the ask allows;
 * - `blown_over` (build_windproof): it stands and reaches the line, and the wind blows a part of it over.
 */
export type TowerMiss = 'tips_over' | 'too_short' | 'too_many_pieces' | 'blown_over';
export const TOWER_MISSES: Record<TowerMode, readonly TowerMiss[]> = {
  build_tall: ['tips_over', 'too_short'],
  build_few: ['tips_over', 'too_short', 'too_many_pieces'],
  build_windproof: ['tips_over', 'too_short', 'blown_over'],
};

const BUILD = { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
  moves: 'picks a piece from the tray, may press Turn to stand it on end, and taps a spot in the building area to drop it '
    + '(tapping a piece with nothing on it takes it off; Clear empties the area), then presses I\'m done! to hand it in',
  // `too_short` has no lever: the green line is on screen.
  unanswered: ['too_short'] } as const;

export const towerStackerCard = defineCard<TowerMiss>({
  id: 'tower-stacker',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Every mode publishes levers (`towerLevers.ts`).
  modes: {
    build_tall: { ...BUILD, misses: TOWER_MISSES.build_tall },
    build_few: { ...BUILD, misses: TOWER_MISSES.build_few },
    build_windproof: { ...BUILD, misses: TOWER_MISSES.build_windproof },
  },
  words: {
    job: 'build a tower of blocks and beams that reaches the green line and stays standing, on some towers with no more '
      + 'pieces than the ask allows or in a strong wind; many different towers pass',
    answer: 'the tower they built',
    question: 'the ask, the green line and the pieces in the tray',
  },
  levers: true,
});
