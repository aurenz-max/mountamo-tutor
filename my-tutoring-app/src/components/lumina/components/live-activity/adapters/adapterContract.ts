/**
 * What the live session needs from ONE primitive family (LA-03).
 *
 * Every fact that differs per primitive lives in that primitive's own adapter
 * module under `adapters/`, and `activityContract.ts` only composes them. That
 * split is what lets a new adoption be a file plus a registry line instead of a
 * restructure of the host: the grade gate, the picker copy and the lesson-start
 * text used to be `primitiveId === 'ten-frame'` branches in the route and two
 * ternaries in the sandbox.
 *
 * Rendering is deliberately NOT here. This module is imported by the server
 * route, so it must stay free of React; the sandbox keeps its own renderer
 * registry keyed by the same ids.
 */
import type { TutoringScaffold } from '../../../types';
import { getComponentById } from '../../../service/manifest/catalog';
import { UNGRADED_MODE } from '../pinnedModes';

export interface LiveActivityAdapter<T = any> {
  /** Explicit null opts out of legacy catalog speech protocols in this host. */
  tutoring?: TutoringScaffold | null;
  /** The CATALOG eval modes the route accepts for this family. */
  modes: readonly string[];
  /** Whether the tutor may advance by tool call. Workspace families are false: the observer advances. */
  canAdvance: boolean;
  /** Grade levels this lesson supports. The route gate reads this, not a branch. */
  grades: readonly string[];
  /** What the model is told it may and may not claim. */
  guidance: string;
  teachingOwner: 'tutor';
  /** Picker copy for the development host. Data, not rendering. */
  copy: {
    label: string;
    checkbox: string;
    title: string;
    /** `[mode, human label]`, in the order the picker should offer them. */
    lessons: readonly (readonly [string, string])[];
  };
  /** The `[LESSON_START]` text for this family, in its own vocabulary. */
  lessonStart: (grade: string, mode: string) => string;
  /** Reject generated content that cannot be taught, at the service boundary. */
  validate: (value: unknown) => T;
  /** The state the tutor receives on mount. */
  initialState: (data: T) => Record<string, unknown>;
  /**
   * This family binds the shared tutor/JEV teaching workspace, so EVERY mode in
   * `modes` runs on it in an ordinary lesson as well as in the development host.
   * A capability fact, never a rollout gate: a mode that misbehaves in a lesson is
   * a defect to fix, not a mode to withhold (user ruling 2026-09-20). Absent = an
   * LA-04 live adoption with no workspace binding, which keeps its lesson path.
   */
  bindsTeachingWorkspace?: true;
}

/** A generated pool every spoken pack shares the envelope of: titled, 1-12 uniquely-keyed askable items. */
export function validateChallengePool<D extends { title: string; challenges: Array<{ id: string }> }>(
  value: unknown, valid: (challenge: D['challenges'][number]) => boolean,
  messages: { pool: string; item: string }, maxItems = 12): D {
  const d = value as D;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > maxItems
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error(messages.pool);
  // The same independent key check the component runs, at the service boundary:
  // an item the domain would silently drop must not reach a mounted lesson.
  if (!d.challenges.every(valid)) throw new Error(messages.item);
  return d;
}

/**
 * What every tutor/JEV workspace family tells the tutor, written once. It rides in each
 * family's guidance rather than the backend's session instruction because the guidance is
 * also echoed in the mount receipt, beside the conversation: moving these rules into the
 * session instruction cut visible demonstrations from 19/21 to 14/21 journeys
 * (qa/tutor-reports/workspace-doctrine-2026-09-21.md). The credit sentence is an instruction,
 * not a line to recite; a phrase the observer must hear verbatim would be a sentinel.
 */
export const WORKSPACE_DOCTRINE = 'You own the teaching: one step at a time, and let the learner try. '
  + 'Use begin_help before guiding questions, explanations or a demonstration. '
  + 'When asked to show something and demonstrate is offered, call it with target ids from workspace.objects '
  + 'and wait for its visible result before saying anything is marked; talk alone does not show. '
  + 'The transcript is noisy supporting context, never the answer. '
  + 'When an answer is right, credit the learner and name what they got right, in your own words: that they did it, '
  + 'and the number, word, shape or sound they gave. Praise that names nothing, or the answer alone, credits '
  + 'nothing. Praise straight after a smaller step credits only that step: return to the original question '
  + 'first. After a mistake, invite another try. The host records your feedback and handles retry and advance; '
  + 'call no recording or progression tool. No correction cap, no scripted wording.';

/** A workspace family's guidance: its own domain facts, then the shared doctrine. */
export const workspaceGuidance = (domain: string) => `${domain} ${WORKSPACE_DOCTRINE}`;

/**
 * What every UNGRADED teaching surface tells the tutor, written once (user ruling 2026-09-24:
 * adaptation-investigator is purely a teaching primitive). Nothing is graded and no observer
 * commits an outcome, so the crediting and progression sentences of `WORKSPACE_DOCTRINE` would
 * be false here. Same rule as that doctrine: instructions in the tutor's own words, no line to recite.
 */
export const TEACHING_DOCTRINE = 'Nothing on this screen is graded: you are teaching, not testing. '
  + 'Start from what the learner can see, ask what they notice, and build on what they say. '
  + 'Let them guess before you show a card, then show it and connect it to their guess. '
  + 'Use show with target ids from workspace.objects and wait for its visible result before saying anything is open '
  + 'or marked; talk alone does not show. One idea at a time, in short sentences; invite them to say a new word back. '
  + 'Answer their questions and follow their curiosity back to the screen. The transcript is noisy supporting context. '
  + 'There is no score: never quiz for one, and call no recording or progression tool. The learner presses Done when ready.';

/** The mount state of an ungraded teaching surface: what it teaches and how many things it can show. */
export const teachingOpening = ({ title, task, steps }: { title: string; task: string; steps: number }) => ({
  title, instruction: task, teachingOwner: 'tutor', totalSteps: steps,
  interaction: 'Teach from liveRuntime.task and its workspace. Nothing here is graded; the learner presses Done to move on.' });

/** The `[LESSON_START]` wording every tutor-owned workspace family uses. */
export const workspaceLessonStart = (noun: string, primitiveId: string) => (grade: string, mode: string) =>
  `[LESSON_START] Begin a ${noun} lesson for ${grade}, mode ${mode}. `
  + `Call request_activity with primitiveId ${primitiveId} and the requested mode. `
  + 'After mounting, teach from the current workspace.';

/**
 * The only per-primitive code a catalog-declared workspace family needs: reject content its
 * component cannot run, and the state the tutor receives on mount. Pure, because the server route
 * imports it.
 */
export interface WorkspaceDomain<T> {
  validate: (value: unknown) => T;
  initialState: (data: T) => Record<string, unknown>;
}

/** The mount state most families send: the first task, the item count, and how the host judges. */
export const workspaceOpening = ({ title, task, total }: { title: string; task: string; total: number }) => ({
  title, instruction: task, teachingOwner: 'tutor', totalChallenges: total,
  interaction: 'Teach from liveRuntime.task and its workspace. Judge spoken answers naturally; the host records '
    + 'your completed feedback and handles retry/advance. The activity checks a placement or selection itself.' });

const titleCase = (id: string) => id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * A live adapter built from the catalog's `teachingWorkspace` declaration and `evalModes`, plus the
 * primitive's `WorkspaceDomain`. Modes, picker copy, ownership, lesson start and guidance are
 * never restated per primitive, so the route, the lesson plan and the component switch read one fact.
 */
export function workspaceAdapter<T>(primitiveId: string, domain: WorkspaceDomain<T>): LiveActivityAdapter<T> {
  const entry = getComponentById(primitiveId);
  const declared = entry?.teachingWorkspace;
  if (!entry || !declared) throw new Error(`${primitiveId} declares no teachingWorkspace in the catalog`);
  const ungraded = !!declared.ungraded;
  const modes = ungraded ? [UNGRADED_MODE] : (entry.evalModes ?? []).map(m => m.evalMode);
  const label = titleCase(primitiveId);
  return {
    tutoring: null,
    teachingOwner: 'tutor',
    modes,
    bindsTeachingWorkspace: true,
    canAdvance: false, // The dialogue observer owns checked progression.
    grades: declared.grades,
    copy: { label, checkbox: label, title: `Learn with ${label}`,
      lessons: ungraded ? [[UNGRADED_MODE, 'Teach'] as const] : (entry.evalModes ?? []).map(m => [m.evalMode, m.label] as const) },
    lessonStart: workspaceLessonStart(primitiveId, primitiveId),
    guidance: ungraded ? `${declared.guidance} ${TEACHING_DOCTRINE}` : workspaceGuidance(declared.guidance),
    validate: domain.validate,
    initialState: domain.initialState,
  };
}
