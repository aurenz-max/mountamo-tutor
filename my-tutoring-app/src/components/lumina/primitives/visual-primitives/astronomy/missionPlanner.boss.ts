/**
 * mission-planner's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice the
 * learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. The card is `missionPlanner.card.ts`; this file holds the content check, the items, the ask and key,
 * the levers and the harness play. Grades 2-5: the K-1 story is ungraded and never mounts the workspace.
 */
import type { MissionPlannerData } from './MissionPlanner';
import { spokenBoss } from '../../../components/live-activity/boss';
import { missionPlannerCard } from './missionPlanner.card';
import { MISSION_LEVERS } from './missionLevers';
import {
  askOf, isStoryGrade, missionHarnessAnswers, missionItems, missionKey, missionSpokenMisses, optionLabel,
  resolveMissionModes, validMissionItem, type MissionItem, type MissionMiss,
} from './missionWorkspace';

/**
 * Reject a session a mode cannot be asked on: no title, the K-1 story (ungraded by user ruling 10-16; it renders
 * outside the workspace, as solar-system-explorer's exploration orrery does), a stored item code could not have built
 * (every key is computed from the item by code, so nothing else is trusted), or a requested mode with no item.
 */
export function validateMissionPlannerData(value: unknown): MissionPlannerData {
  const d = value as MissionPlannerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated mission planner has invalid lesson content.');
  if (isStoryGrade(d.gradeLevel)) throw new Error('The K-1 mission story is ungraded; the workspace does not run it.');
  if (Array.isArray(d.items) && d.items.some(i => !validMissionItem(i))) throw new Error('A generated mission item is not one code can key.');
  const items = missionItems(d);
  if (!items.length) throw new Error('The mission planner has no item.');
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated mission items repeat an id.');
  for (const mode of resolveMissionModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The mission-planner ${mode} mode has no item.`);
  }
  return d;
}

/** The journey's spoken answers: the key's label, or the choice that shows the mode's first-listed miss. */
const harnessWords = (item: MissionItem) => {
  const { correct, plainWrong } = missionHarnessAnswers(item);
  return { correct: optionLabel(item, correct.pick!), plainWrong: optionLabel(item, plainWrong.pick!) };
};

export const missionPlannerBoss = spokenBoss<MissionPlannerData, MissionItem, MissionMiss>({
  card: missionPlannerCard,
  validate: validateMissionPlannerData,
  items: missionItems,
  levers: MISSION_LEVERS,
  speech: {
    ask: askOf,
    key: missionKey,
    misses: missionSpokenMisses,
    say: harnessWords,
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/astronomy/MissionPlanner.tsx',
    instanceId: 'mission-planner',
    defaults: { grade: 'Grade 4', mode: 'farther_closer', topic: 'Planning a trip to the Moon, Mars and beyond' },
    mounted: '[data-pip-object="workspace"]',
  },
});
