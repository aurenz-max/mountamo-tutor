/**
 * A surface item's scene on the shared tutor/JEV teaching workspace. Every item is checked by the activity, so no key
 * reaches the tutor. The scene says what is drawn (the displays in words, the cards by number and label, the boxes) and
 * what the learner has done, never which card is right.
 */
import type { SceneOf } from '../../components/live-activity/bossLevers';
import { displayWords } from './displays';
import type { SurfaceAnswer, SurfaceItem } from './surfaces';

export interface SurfaceTry { work: string; correct: boolean }

const cardName = (item: SurfaceItem, id: string) => {
  const i = item.options.findIndex(o => o.id === id);
  const o = item.options[i];
  return `card ${i + 1}${o?.label ? ` (${o.label})` : ''}`;
};

/** What the learner has set, in words. */
export function describeSurfaceWork(item: SurfaceItem, a: SurfaceAnswer): string {
  if (item.surface === 'choose') return a.choice ? `chose ${cardName(item, a.choice)}` : 'nothing chosen yet';
  if (item.surface === 'order') return a.order?.length ? `order: ${a.order.map(id => cardName(item, id)).join(', ')}` : 'no cards in order yet';
  const placed = Object.entries(a.placed ?? {});
  return placed.length ? placed.map(([id, c]) => `${cardName(item, id)} in ${c}`).join('; ') : 'no cards sorted yet';
}

export function surfaceScene(item: SurfaceItem, view: { answer: SurfaceAnswer; tries: readonly SurfaceTry[]; solved: boolean }): SceneOf {
  const facts: Record<string, string | number> = {
    task: item.surface === 'choose' ? 'choose one card' : item.surface === 'order' ? 'put the cards in order in the numbered boxes' : `sort each card into a box: ${(item.categories ?? []).join(', ')}`,
    prompt: item.prompt,
    shown: (item.stimulus ?? []).map(displayWords).join('; ').slice(0, 500) || 'nothing above the cards',
    cards: item.options.map((o, i) => `card ${i + 1}: ${[o.label, o.display ? displayWords(o.display) : ''].filter(Boolean).join(', ')}`).join('; ').slice(0, 600),
    set: describeSurfaceWork(item, view.answer).slice(0, 300),
    step: view.solved ? 'it worked' : view.tries.length ? 'trying again' : 'not started',
    tries: view.tries.length ? view.tries.map((t, i) => `try ${i + 1}: ${t.work}`).join('; ').slice(0, 400) : 'none yet',
    constraints: 'Check judges the answer. The pictures are drawn by the lesson; describe what they show, never which card is right.',
  };
  return { objects: [], facts };
}
