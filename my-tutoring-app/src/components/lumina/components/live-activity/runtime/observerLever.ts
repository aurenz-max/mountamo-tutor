/**
 * The observer's lever pull (user ruling 2026-09-27, handoff 18): when a learner who has already
 * answered this item wrong says they are stuck, the observer pulls the next lever, so a stuck child
 * gets help from the screen whether or not the tutor chose a tool. The tutor can still pull one itself.
 *
 * Pure, and names no primitive: it reads the levers the item declares. Help comes before simplify,
 * because help keeps the full item on screen; the declared order breaks ties.
 */
import type { RuntimeSnapshot } from './contract';

export function observerLever(state: RuntimeSnapshot, helpRequested: boolean): string | null {
  const task = state.task, workspace = task?.workspace;
  if (!helpRequested || state.status !== 'active' || !task || !workspace?.levers?.length || workspace.practice) return null;
  if (!state.affordances.some(a => a.action.type === 'workspace' && a.action.operation === 'pull_lever')) return null;
  if (!workspace.attempts.some(a => a.itemId === task.itemId && !a.correct)) return null;
  return nextLever(workspace.levers);
}

/** The next lever to pull when no one named one: help before simplify, then the declared order. */
export function nextLever(levers: readonly { id: string; kind: string; pulled?: boolean }[]): string | null {
  const open = levers.filter(l => !l.pulled);
  return (open.find(l => l.kind === 'help') ?? open.find(l => l.kind === 'simplify'))?.id ?? null;
}
