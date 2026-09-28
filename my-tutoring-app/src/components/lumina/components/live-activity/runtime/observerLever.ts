/**
 * The observer's lever pulls: the trigger ladder (user rulings 2026-09-27, handoffs 18 and 21), so a
 * struggling child gets help from the screen whether or not the tutor chose a tool. The tutor can still
 * pull any lever itself at any time. Nothing here is triggered by a timer.
 *
 * - The first wrong answer on an item pulls nothing (its miss is named; the tutor answers it).
 * - The second wrong answer on the same item pulls help, never simplify.
 * - A wrong answer with a help lever already pulled for this learner pulls simplify (a help an easy tier
 *   starts with is the item's presentation, not a pull).
 * - "I'm stuck" after a wrong answer pulls the next lever of either kind.
 * - "I'm stuck" before any attempt pulls help only. The pull records the item as assisted, so the next
 *   attempt is assisted work, never a first-response success.
 *
 * Every item on the workspace can be tried again after a miss (the observer's retry), so a pull always
 * leaves one more try, and that try carries the lever. There is no single-try item on this path.
 *
 * Pure, and names no primitive: it reads the levers the item declares.
 */
import type { RuntimeSnapshot } from './contract';

/** What happened: a wrong attempt was committed on the item, or the learner asked for help. */
export type LeverEvent = 'wrong' | 'help';

type Lever = { id: string; kind: string; pulled?: boolean; answers?: readonly string[] };

export function leverTrigger(state: RuntimeSnapshot, event: LeverEvent): string | null {
  const task = state.task, workspace = task?.workspace;
  if (state.status !== 'active' || !task || !workspace?.levers?.length || workspace.practice) return null;
  if (!state.affordances.some(a => a.action.type === 'workspace' && a.action.operation === 'pull_lever')) return null;
  const wrongs = workspace.attempts.filter(a => a.itemId === task.itemId && !a.correct && !a.practice).length;
  const miss = lastMiss(workspace.attempts, task.itemId);
  if (event === 'help') return nextLever(workspace.levers, miss, wrongs ? undefined : 'help');
  if (helpBeforeLastWrong(workspace, task.itemId)) return nextLever(workspace.levers, miss, 'simplify');
  return wrongs >= 2 ? nextLever(workspace.levers, miss, 'help') : null;
}

/**
 * Whether the item's latest wrong attempt was made with a help lever pulled for this learner. Read from the
 * attempt's own `levers`, not from `pulled`: an easy tier starts with its help already on screen, and that
 * is the item's presentation, not a pull the ladder made or the tutor chose.
 */
export function helpBeforeLastWrong(workspace: { levers?: readonly Lever[]; attempts: readonly { itemId: string; correct: boolean;
  practice?: true; levers?: readonly string[] }[] }, itemId: string): boolean {
  const last = workspace.attempts.filter(a => a.itemId === itemId && !a.correct && !a.practice).at(-1);
  return !!last?.levers?.some(id => workspace.levers?.find(l => l.id === id)?.kind === 'help');
}

/** The ladder's help-request rung, for callers that only know whether the learner asked for help. */
export function observerLever(state: RuntimeSnapshot, helpRequested: boolean): string | null {
  return helpRequested ? leverTrigger(state, 'help') : null;
}

/** The miss the item's latest wrong attempt showed, if its check named one. */
export function lastMiss(attempts: readonly { itemId: string; correct: boolean; miss?: string }[], itemId: string): string | undefined {
  return attempts.filter(a => a.itemId === itemId && !a.correct).at(-1)?.miss;
}

/**
 * The next lever to pull when no one named one, within `kind` when the ladder allows only one kind. After a
 * named miss, the first open lever that declares it answers that miss; otherwise help before simplify, then
 * the declared order. Code, so "this wrong answer, then this lever" is a unit test, never a Live session.
 */
export function nextLever(levers: readonly Lever[], miss?: string, kind?: 'help' | 'simplify'): string | null {
  const open = levers.filter(l => !l.pulled && (!kind || l.kind === kind));
  const fits = miss ? open.find(l => l.answers?.includes(miss)) : undefined;
  return (fits ?? open.find(l => l.kind === 'help') ?? open.find(l => l.kind === 'simplify'))?.id ?? null;
}
