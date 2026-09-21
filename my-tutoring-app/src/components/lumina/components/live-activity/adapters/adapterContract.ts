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

export interface LiveActivityAdapter<T = any> {
  /** Explicit null opts out of legacy catalog speech protocols in this host. */
  tutoring?: TutoringScaffold | null;
  /** The CATALOG eval modes the route accepts for this family. */
  modes: readonly string[];
  /**
   * Whether the tutor may own progression. A `di-runner` family MUST be false —
   * a tutor clock beside the runner's is the defect the judged family prevents,
   * and the Python envelope validator rejects the pairing.
   */
  canAdvance: boolean;
  /** Grade levels this lesson supports. The route gate reads this, not a branch. */
  grades: readonly string[];
  /** What the model is told it may and may not claim. */
  guidance: string;
  teachingOwner: 'tutor' | 'di-runner';
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
  /** The catalog challenge type of each challenge in a VALIDATED payload. Absent = `challenges[].type`. */
  challengeTypes?: (data: T) => readonly string[];
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
  messages: { pool: string; item: string }): D {
  const d = value as D;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error(messages.pool);
  // The same independent key check the component runs, at the service boundary:
  // an item the domain would silently drop must not reach a mounted lesson.
  if (!d.challenges.every(valid)) throw new Error(messages.item);
  return d;
}

/** The `[LESSON_START]` wording every tutor-owned workspace family uses. */
export const workspaceLessonStart = (noun: string, primitiveId: string) => (grade: string, mode: string) =>
  `[LESSON_START] Begin a ${noun} lesson for ${grade}, mode ${mode}. `
  + `Call request_activity with primitiveId ${primitiveId} and the requested mode. `
  + 'After mounting, teach from the current workspace.';

/** The judged families share one opening contract; only the closing sentence differs. */
export const RUNNER_GUIDANCE = 'The mounted runner supplies the exact opening, question, correction, '
  + 'affirmation and closing cues. Follow those cues and their judging contract. Wait for its opening cue; '
  + 'do not invent a greeting, answer, verdict or progression.';

/** The `[LESSON_START]` wording every judged family uses; the runner delivers the opening. */
export const runnerLessonStart = (family: string) => (grade: string, mode: string) =>
  `[LESSON_START] Begin a full ${family} lesson now for ${grade}, mode ${mode}. Call request_activity with `
  + `primitiveId ${family}, mode ${mode}, a matching topic and intent. Use the existing full lesson with several `
  + 'practice items. Do not ask me to choose a topic or greet first. The DI runner will deliver the opening after mounting.';
