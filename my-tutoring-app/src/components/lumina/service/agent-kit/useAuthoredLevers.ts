/**
 * The kit's lever hook: what an agent primitive's component needs to play its items' authored levers
 * (`levers.ts`), written once. The component keeps its own surface and calls `reset` with the item now on screen.
 *
 * - `shown`: the item on screen: a simplify lever's practice item, else the session item with its pulled helps shown.
 * - `publish(scene)`: the workspace to publish, with the levers offered, their scene fact, `pullLever` and `endPractice`.
 */
import { useMemo, useState } from 'react';
import { leverScene, type LeverSet } from '../../components/live-activity/bossLevers';
import type { TeachingWorkspace, WorkspaceScene } from '../../components/live-activity/runtime/useTeachingWorkspace';
import { shownItem, type Leverable } from './levers';

export const PRACTICE_NOTE = 'An easier practice item of the same kind, ungraded; the item comes back after it.';

export function useAuthoredLevers<I extends Leverable<I>>(
  session: I | null,
  set: LeverSet<I, unknown>,
  assignment: (item: I) => unknown,
  reset: (onScreen: I) => void,
) {
  const [state, setState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<I | null>(null);
  const pulled = session && state.item === session.id ? state.pulled : [];
  const pulledKey = pulled.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => practice ?? (session ? shownItem(session, pulled) : null), [practice, session, pulledKey]);

  const publish = (scene: WorkspaceScene): TeachingWorkspace => {
    if (!session) return scene as TeachingWorkspace;
    const levers = practice ? [] : set.declare(session, null, pulled);
    const drawn = practice ? { ...scene, facts: { ...scene.facts, practice: PRACTICE_NOTE } } : scene;
    return {
      ...leverScene(drawn, { support: '', onScreen: practice ? '' : set.onScreen(session, null, pulled) }),
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: session.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = set.simpler(session, null, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setState(next); setPractice(easier); reset(easier);
          return { practice: assignment(easier) };
        }
        // The item with more shown: the same answer in a new arrangement, so the surface starts blank.
        setState(next); reset(shownItem(session, next.pulled));
        return true;
      },
      endPractice: () => { setPractice(null); reset(shownItem(session, pulled)); },
    } as TeachingWorkspace;
  };

  return { shown, practice, publish };
}
