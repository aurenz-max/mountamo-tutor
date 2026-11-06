/**
 * Skid steer yard's scene on the shared tutor/JEV teaching workspace. Every item is one choice the activity checks:
 * a tool for a job (Do the job) or a lever setting (Go). The card, `skidSteerYard.card.ts`, names the moves; the boss
 * gives the assignment. The scene carries only this yard's own facts, never the tool that fits or the levers that work.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import {
  ATTACHMENT_NAME, goFeedback, jobFeedback, leverWords,
  type Attachment, type Job, type Levers, type Room, type SkidSteerChallenge,
} from './skidSteerModel';

export { SKID_STEER_MISSES_BY_MODE, type SkidSteerMiss } from './skidSteerYard.card';

export interface SkidSteerView {
  /** The levers as set now. */
  levers: Levers;
  /** The attachment on the quick-attach plate now, or null for a bare plate. */
  attached: Attachment | null;
  /** Times the check (Go, or Do the job) was pressed on this item. */
  goes: number;
  /** The levers at the last Go, or null before one. */
  lastGo: Levers | null;
  /** The tool at the last Do the job, or null before one. */
  lastTool: Attachment | null;
}

const ROOM_WORDS: Record<Room, string> = {
  open: 'open dirt all around the machine',
  wall_front: 'a concrete barrier close in front of the bucket',
  wall_back: 'a concrete barrier close behind the machine',
  boxed: 'concrete barriers close in front, close behind, and on the side away from the thing',
};

/** What is drawn in front of the machine for each job. */
const JOB_SCENE: Record<Job, string> = {
  scoop_dirt: 'a pile of loose brown dirt',
  move_pallet: 'a wooden pallet stacked with red bricks',
  plant_tree: 'a little tree with its roots wrapped in a sack, and an orange stake in the ground where it will go',
  sweep_path: 'a concrete path covered in dust and fallen leaves',
  push_snow: 'a driveway covered in deep snow',
  grab_branches: 'a messy pile of long tree branches',
};

export function skidSteerScene(c: SkidSteerChallenge, view: SkidSteerView): SceneOf {
  if (c.type === 'match_attachment') {
    return { objects: [], facts: {
      yard: `a construction yard drawn in 3D, seen from behind a yellow skid steer loader; in front of it is ${JOB_SCENE[c.job]}`,
      toolsOffered: c.options.map(a => ATTACHMENT_NAME[a]).join(', '),
      attachedNow: view.attached ? ATTACHMENT_NAME[view.attached] : 'nothing yet (a bare quick-attach plate)',
      // Choosing the tool is the task: the fit is the learner's step, not the tutor's.
      workingOut: 'the learner works out which tool does this job; never name the tool that fits or rule one out; ask '
        + 'what the job needs the machine to do (scoop, lift, drill, sweep, push, grab) and what each tool looks like it '
        + 'is made to do',
      triesSoFar: view.goes,
      ...(view.lastTool ? { lastTryShowed: jobFeedback(c, view.lastTool) } : {}),
      constraints: 'The machine starts with a bare plate; tapping a tool picture clicks it on, and the learner may swap '
        + 'freely. Nothing happens to the job until Do the job. After it the machine tries the job with that tool and the '
        + 'screen says what happened; the tutor may talk about that.',
    } };
  }
  return { objects: [], facts: {
    yard: `a construction yard drawn in 3D, seen from behind a yellow skid steer loader with its bucket down; a ${c.goal} `
      + `sits off to the machine's ${c.side}`,
    room: ROOM_WORDS[c.room],
    leversNow: leverWords(view.levers),
    // Choosing the levers is the task: the setting is the learner's step, not the tutor's.
    workingOut: 'the learner works out how to set the two sides to turn toward the thing; never name a lever setting '
      + 'that would work, and never say spin or pivot before they try one; ask which side the thing is on, which side '
      + 'of the machine has to move to swing the nose that way, and what happens when one side stops',
    goesSoFar: view.goes,
    ...(view.lastGo ? { lastGoShowed: goFeedback(c, view.lastGo) } : {}),
    constraints: 'Both levers start stopped. Each lever shows only arrows. Nothing on screen shows where the machine will '
      + 'go before Go. After Go the machine moves, leaves skid marks, and the screen says what it did; the tutor may '
      + 'talk about that.',
  } };
}
