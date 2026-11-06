/**
 * skid-steer-yard's card: how its mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `skidSteerYard.boss.ts`.
 * match_attachment is a tool the learner picks for a job; Do the job is the check. set_levers is a lever setting the
 * learner makes on screen; Go is the check. One item at a time, and no key reaches the tutor.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from `skidSteerModel.ts`. match_attachment (`attachmentMiss`):
 * `near_tool` (the tool that almost does the job), `wrong_tool` (any other). set_levers (`leverMiss`): `wrong_way`
 * (turned away from the thing), `drove_straight` (both sides the same way), `bumped` (turned toward it, but that turn
 * needed more room than the yard has).
 */
export const SKID_STEER_MISSES_BY_MODE = {
  match_attachment: ['near_tool', 'wrong_tool'],
  set_levers: ['wrong_way', 'drove_straight', 'bumped'],
} as const;
export type SkidSteerMiss = typeof SKID_STEER_MISSES_BY_MODE[keyof typeof SKID_STEER_MISSES_BY_MODE][number];

export const skidSteerYardCard = defineCard<SkidSteerMiss>({
  id: 'skid-steer-yard',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    match_attachment: { judge: 'activity', flow: 'one-at-a-time', answer: 'tap',
      misses: SKID_STEER_MISSES_BY_MODE.match_attachment, unanswered: SKID_STEER_MISSES_BY_MODE.match_attachment,
      moves: 'taps an attachment picture to click it onto the skid steer (they may swap as often as they like), then '
        + 'presses Do the job; Do the job is the check' },
    // The family declares no levers yet (/add-support-tiers): every miss is answered by the tutor's own teaching.
    set_levers: { judge: 'activity', flow: 'one-at-a-time', answer: 'build',
      misses: SKID_STEER_MISSES_BY_MODE.set_levers, unanswered: SKID_STEER_MISSES_BY_MODE.set_levers,
      moves: 'sets the left lever and the right lever each to forward, stop or back, then presses Go; Go is the check '
        + '(Turn back to the start only resets the camera)' },
  },
  words: {
    job: 'work a skid steer loader in a construction yard: pick the attachment (bucket, pallet forks, auger, broom, '
      + 'snow blade, grapple) a job needs, and drive it, with no steering wheel, by setting its left wheels and right '
      + 'wheels each forward, stopped or back to turn it to face something',
    answer: 'the attachment the learner picks for the job, or the two lever settings the learner picks before Go',
    question: 'the job and the thing in front of the machine and the tools on offer, or the thing to face, where it sits '
      + 'beside the machine, and any concrete barriers close around it',
  },
});
