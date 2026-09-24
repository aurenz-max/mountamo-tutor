import type { YouAndMeData } from '../../../primitives/visual-primitives/literacy/YouAndMe';
import { youAndMeAssignment } from '../../../primitives/visual-primitives/literacy/youAndMeWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const MODES = ['describe_action', 'describe_independent_action'];

/** Reject a turn that cannot be asked: two named partners, an actor and a speaker among them, and an action. */
export const validateYouAndMeData = (value: unknown): YouAndMeData => validateChallengePool<YouAndMeData>(value,
  c => !!c && MODES.includes(c.type) && Array.isArray(c.participants) && c.participants.length === 2
    && c.participants.every(p => !!p?.name) && [0, 1].includes(c.actor) && [0, 1].includes(c.speaker)
    && typeof c.action === 'string' && !!c.action.trim(),
  { pool: 'Generated You & Me has invalid lesson content.', item: 'A You & Me turn cannot be asked.' });

/** What the live adapter needs from You & Me; the catalog's `teachingWorkspace` declares the rest. */
export const youAndMeLiveDomain: WorkspaceDomain<YouAndMeData> = {
  validate: validateYouAndMeData,
  initialState: data => workspaceOpening({ title: data.title, task: youAndMeAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
