/**
 * skid-steer-yard's boss (`components/live-activity/boss.ts`), bespoke because the answer is a tool or a lever setting the
 * activity checks on Do the job or Go: the card is `skidSteerYard.card.ts`; this file validates a yard, lists its
 * items, asks one and plays the harness through the real buttons.
 */
import type { SkidSteerYardData } from './SkidSteerYard';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { skidSteerYardCard, type SkidSteerMiss } from './skidSteerYard.card';
import {
  ALL_LEVERS, attachmentItemHolds, attachmentMiss, GOAL_THINGS, JOB_TOOL, leverMiss, roomHolds, SKID_STEER_TASKS,
  solutions, type Levers, type SetLeversChallenge, type SkidSteerChallenge,
} from './skidSteerModel';

/**
 * An item the workspace can run: an id and an instruction, and either a fair job (the right tool offered once) or a
 * turn with a known thing, a side, and a yard whose room holds what it was built for.
 */
function validTurn(c: SkidSteerChallenge | undefined): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(SKID_STEER_TASKS as readonly string[]).includes(c.type)
    || typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  if (c.type === 'match_attachment') return Array.isArray(c.options) && attachmentItemHolds(c);
  return (GOAL_THINGS as readonly string[]).includes(c.goal) && (c.side === 'left' || c.side === 'right')
    && Array.isArray(c.barriers) && roomHolds(c);
}

/** Reject a yard the workspace cannot run: every turn needs an id, an instruction, a thing to face and a fair room. */
export function validateSkidSteerYardData(value: unknown): SkidSteerYardData {
  const d = value as SkidSteerYardData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated skid steer yard has no title.');
  const turns = Array.isArray(d.challenges) ? d.challenges : [];
  if (!turns.length || turns.length > 12 || new Set(turns.map(c => c?.id)).size !== turns.length || !turns.every(validTurn))
    throw new Error('Generated skid steer yard has invalid lesson content.');
  return d;
}

/** A lever setting for the harness: one that solves the turn, or one that names a miss. */
function harnessLevers(c: SetLeversChallenge, right: boolean): Levers {
  return right ? solutions(c)[0] : ALL_LEVERS.find(l => leverMiss(c, l) === 'wrong_way')!;
}

export const skidSteerYardBoss = defineBoss<SkidSteerYardData, SkidSteerChallenge, SkidSteerMiss>({
  card: skidSteerYardCard,
  validate: validateSkidSteerYardData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A setting the activity checks on Go: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  drive: {
    component: 'primitives/visual-primitives/engineering/SkidSteerYard.tsx',
    instanceId: 'skid-yard',
    defaults: { grade: 'Grade 1', mode: 'match_attachment', topic: 'Skid steer loaders and their attachments' },
    mounted: '[data-skid-steer-scene]',
    // The tool tiles, the levers, Go and Do the job are DOM buttons beside the 3D yard, so the sweep presses them as a
    // learner does.
    play: (right, c) => {
      if (c.type === 'match_attachment') {
        const tool = right ? JOB_TOOL[c.job] : c.options.find(a => attachmentMiss(c, a))!;
        return [{ type: 'touch', target: `tool-${tool}` }, { type: 'choose', label: 'Do the job' }];
      }
      const l = harnessLevers(c, right);
      return [{ type: 'touch', target: `lever-left-${l.left}` }, { type: 'touch', target: `lever-right-${l.right}` },
        { type: 'choose', label: 'Go' }];
    },
  },
});
