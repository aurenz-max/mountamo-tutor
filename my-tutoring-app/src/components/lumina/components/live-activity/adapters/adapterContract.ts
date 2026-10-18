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
import type { BossCard, BossMode, TutoringScaffold } from '../../../types';
import { bossInteraction, wiringsOf, type Boss } from '../boss';
import type { LeverType } from '../bossLevers';
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
/** `live_activity_tools.GUIDANCE_MAX`: the longest family guidance the backend accepts in an activity offer. */
export const OFFER_GUIDANCE_MAX = 4000;

export const WORKSPACE_DOCTRINE = 'You own the teaching: one step at a time, and let the learner try. '
  + 'Use begin_help before guiding questions, explanations or a demonstration. '
  + 'When asked to show something and demonstrate is offered, call it with target ids from workspace.objects '
  + 'and wait for its visible result before saying anything is marked; talk alone does not show. '
  + 'The transcript is noisy supporting context, never the answer. '
  + 'Everything you write is spoken aloud: say math in words ("x squared", "three fourths"), never as symbols, LaTeX or markup. '
  + 'When an answer is right, credit the learner in your own words: that they did it, and the number, word, shape '
  + 'or sound they gave; when the state shows how they got there (they checked, fixed a mistake, counted one by one), '
  + 'name that too, because that is the part they can do again. Praise that names nothing credits nothing. Praise straight after a smaller step credits only that step: return to the original question '
  + 'first. Before a try or after a mistake, never say the answer or a change the task does not ask for; after a '
  + 'mistake, invite another try. When told the learner has stopped, invite their next step or a check of their own '
  + 'work; never do the step for them or say what their work adds up to. The host records feedback and handles retry and advance; call no recording or progression tool.';

/**
 * What every family with in-item levers tells the tutor, written once. Only lever families carry it,
 * so the families that offer no lever keep their guidance under the cap. The 2026-09-27 number-line
 * bench: with the lever named only in the tool's own description, the tutor coached in words and
 * pulled nothing in 2 of 3 journeys.
 */
export const LEVER_DOCTRINE = 'When the learner is stuck and pull_lever is offered, let the screen help before words: '
  + 'pull the lever in workspace.levers whose "when" fits, then talk about what changed. Here begin_help is for help in words only.';

/**
 * What a lever TYPE tells the tutor, once for every family that has one (`bossLevers.ts`). A boss's guidance carries
 * the sentence of each type its lever set uses, so no card restates it in `special`.
 */
export const LEVER_TYPE_DOCTRINE: Partial<Record<LeverType, string>> = {
  model: "A model lever shows a DIFFERENT item, solved: say it as your turn, then ask the learner's own question again. "
    + "Never model the learner's own item; the model lever is your model.",
};

/** How one wiring is judged, in the tutor's terms. The card's modes pick these; no family writes them. */
const JUDGED_BY: Record<BossMode['judge'], (answer: string) => string> = {
  activity: answer => `The activity checks ${answer} against the lesson's key, which you are not told; that is the answer.`,
  tutor: answer => `The learner answers out loud, and you judge ${answer} against the key the task gives you; the key is the answer, and it `
    + 'names what else counts and the wrong answer that sounds right.',
};
const FLOW: Record<BossMode['flow'], string> = {
  'one-at-a-time': '',
  board: ' The learner answers every part, then checks the whole board; after a check you may say how many parts are right, never which. '
    + 'Before the check, never confirm a part, say how many are wrong, suggest a swap, or point at one part to look at again, '
    + 'by its name or by what it does; asking about the whole board (what the thing is for) is teaching.',
};

/**
 * The rules every graded workspace family shares, filled from its boss card. These sentences used to be
 * rewritten in each family's guidance (sorter: "never rule a group out"; sequencer: "never list more than two
 * stages in order"; both: "say it aloud for a learner who cannot read", "you cannot tap for the learner").
 * How a mode is judged comes from its wiring (`card.modes`): modes wired alike share one sentence, and a family
 * whose modes differ gets one per wiring, named by mode.
 */
export const ROTATION_DOCTRINE = ({ modes, words }: BossCard) => {
  // One entry per (mode, step) wiring. A card with no stepped mode reads exactly as it did before steps existed.
  const all = Object.entries(modes).flatMap(([name, mode]) => wiringsOf(mode).map(({ step, wiring }) => ({ name, step, wiring })));
  const stepped = all.some(entry => entry.step);
  const wirings = new Map<string, { mode: BossMode; entries: typeof all }>();
  for (const entry of all) {
    const key = `${entry.wiring.judge}|${entry.wiring.flow}`;
    wirings.set(key, { mode: entry.wiring, entries: [...(wirings.get(key)?.entries ?? []), entry] });
  }
  const label = (entries: typeof all) => (stepped ? `the ${listOf(stepNames(entries, all))} steps` : entries.map(e => e.name).join(' and '));
  const judged = Array.from(wirings.values()).map(({ mode, entries }) =>
    (wirings.size > 1 ? `In ${label(entries)}: ` : '') + JUDGED_BY[mode.judge](words.answer) + FLOW[mode.flow]).join(' ');
  const board = all.some(entry => entry.wiring.flow === 'board');
  const named = all.filter(entry => entry.wiring.moves);
  // A step with the same moves in several modes is said once, naming them all.
  const byMoves = new Map<string, typeof all>();
  for (const entry of named.filter(e => e.step)) {
    const key = `${entry.step}|${entry.wiring.moves}`;
    byMoves.set(key, [...(byMoves.get(key) ?? []), entry]);
  }
  const moves = stepped
    ? Array.from(byMoves.values()).map(group => `In the ${group[0].step} step of ${listOf(group.map(e => e.name))}, the learner `
      + `${group[0].wiring.moves}.`).join(' ')
    : named.map(entry => (named.length > 1 || Object.keys(modes).length > 1 ? `In ${entry.name}, the learner ` : 'The learner ')
      + `${entry.wiring.moves}.`).join(' ');
  const steps = stepped ? 'Each item is one step of the problem, and the task\'s kind names the step. ' : '';
  return `The learner's job is to ${words.job}. ${steps}${moves ? `${moves} ` : ''}${judged} ${cap(words.question)} are the question: say them freely `
    + 'and as often as needed, and read the instruction and every label aloud for a learner who cannot read, unless '
    + 'reading it is the task: then the print is the answer, so let the learner read it first. Never rule a choice out ("it is not that one") or state the one fact that decides it. '
    + 'Describing one thing on screen at a time is teaching; linking things the way the task asks is the answer. '
    + `When the learner is stuck, ask the question again, then point to the part of the screen that matters${board ? ' (on a board, the whole board)' : ''}, then `
    + 'ask what they know about it and whether it fits. You cannot do the task for the learner, in actions or in '
    + 'words, or change what is on screen except with a tool you are offered.'
    + `${words.special ? ` ${words.special}` : ''}`;
};
// Says only what WORKSPACE_DOCTRINE does not (it already forbids saying the answer and doing the step). When every
// graded family is on a card, the two merge into one constant and `guidance` prose is deleted (the ratchet in
// activityContract.test.ts).

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a", "a and b", "a, b and c". */
const listOf = (items: readonly string[]) =>
  (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** The step names of one wiring group, in the order of the mode with the most steps; a step wired differently in
 *  another mode is named with its modes. */
function stepNames(entries: ReadonlyArray<{ name: string; step?: string }>, all: ReadonlyArray<{ name: string; step?: string }>): string[] {
  const perMode = new Map<string, string[]>();
  for (const e of all) perMode.set(e.name, [...(perMode.get(e.name) ?? []), e.step ?? e.name]);
  const order = Array.from(perMode.values()).sort((a, b) => b.length - a.length).flat();
  const steps = Array.from(new Set(entries.map(e => e.step ?? e.name))).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return steps.map(step => {
    const here = entries.filter(e => (e.step ?? e.name) === step).map(e => e.name);
    const everywhere = all.filter(e => (e.step ?? e.name) === step).map(e => e.name);
    return here.length === everywhere.length ? step : `${step} (in ${here.join(' and ')})`;
  });
}

/** A workspace family's guidance: its own domain facts, then the shared doctrine. */
export const workspaceGuidance = (domain: string, levers = false) =>
  `${domain} ${WORKSPACE_DOCTRINE}${levers ? ` ${LEVER_DOCTRINE}` : ''}`;

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
    guidance: declared.card
      ? workspaceGuidance(ROTATION_DOCTRINE(declared.card), !!declared.levers)
      : ungraded ? `${declared.guidance} ${TEACHING_DOCTRINE}` : workspaceGuidance(declared.guidance, !!declared.levers),
    validate: domain.validate,
    initialState: domain.initialState,
  };
}

/**
 * A live adapter built from a boss (`boss.ts`). The catalog's `teachingWorkspace` is `bossEntry(boss.card)`, so
 * `workspaceAdapter` reads the same card; the boss supplies validation and the opening state.
 */
export function bossAdapter<D extends { title: string }>(boss: Boss<D>): LiveActivityAdapter<D> {
  const interaction = bossInteraction(boss.card);
  const adapter = workspaceAdapter<D>(boss.card.id, { validate: boss.validate, initialState: data => {
    const items = boss.items(data);
    return { ...workspaceOpening({ title: data.title, task: boss.ask(items[0], data), total: items.length }), interaction };
  } });
  const types = new Set(boss.levers?.specs.map(s => s.type) ?? []);
  const typed = Object.entries(LEVER_TYPE_DOCTRINE).filter(([type]) => types.has(type as LeverType)).map(([, line]) => line);
  return typed.length ? { ...adapter, guidance: `${adapter.guidance} ${typed.join(' ')}` } : adapter;
}
