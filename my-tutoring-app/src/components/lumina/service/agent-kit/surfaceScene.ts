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
  if (item.surface === 'point') return a.part ? `tapped "${a.part}" on the picture` : 'nothing tapped yet';
  if (item.surface === 'choose') return a.choice ? `chose ${cardName(item, a.choice)}` : 'nothing chosen yet';
  if (item.surface === 'set') return a.board ? `the board now: ${displayWords(a.board)}` : 'the board is as it started';
  if (item.surface === 'make') return a.made?.length ? `on the tray: ${a.made.map(id => cardName(item, id)).join(', ')}` : 'nothing on the tray yet';
  if (item.surface === 'order') return a.order?.length ? `order: ${a.order.map(id => cardName(item, id)).join(', ')}` : 'no cards in order yet';
  const placed = Object.entries(a.placed ?? {});
  return placed.length ? placed.map(([id, c]) => `${cardName(item, id)} in ${c}`).join('; ') : 'no cards sorted yet';
}

/** A long picture to tap (a passage, a table) in the 500-character pieces a scene fact holds, at word breaks. */
const boardFacts = (words: string): Record<string, string> =>
  Object.fromEntries((words.match(/[\s\S]{1,480}(?:\s|$)/g) ?? [words]).slice(0, 4).map((part, i) => [i ? `board${i + 1}` : 'board', part.trim()]));

export function surfaceScene(item: SurfaceItem, view: { answer: SurfaceAnswer; tries: readonly SurfaceTry[]; solved: boolean }): SceneOf {
  const facts: Record<string, string | number> = {
    task: item.surface === 'point' ? 'tap one part of the picture, then press Check' : item.surface === 'choose' ? 'choose one card' : item.surface === 'set' ? 'change the board until it meets the goal the prompt gives; more than one finished board can be right' : item.surface === 'make' ? 'put pieces on the tray until they meet the goal the prompt gives; more than one set can be right' : item.surface === 'order' ? 'put the cards in order in the numbered boxes' : `sort each card into a box: ${(item.categories ?? []).join(', ')}`,
    prompt: item.prompt,
    shown: (item.stimulus ?? []).map(displayWords).join('; ').slice(0, 500) || 'nothing above the cards',
    ...(item.board ? (item.surface === 'point' ? boardFacts(`the picture to tap: ${displayWords(item.board)}`) : { board: `starts as ${displayWords(item.board)}`.slice(0, 300) }) : {}),
    cards: item.options.map((o, i) => `card ${i + 1}: ${[o.label, o.display ? displayWords(o.display) : ''].filter(Boolean).join(', ')}`).join('; ').slice(0, 600),
    set: describeSurfaceWork(item, view.answer).slice(0, 300),
    step: view.solved ? 'it worked' : view.tries.length ? 'trying again' : 'not started',
    tries: view.tries.length ? view.tries.map((t, i) => `try ${i + 1}: ${t.work}`).join('; ').slice(0, 400) : 'none yet',
    constraints: 'Check judges the answer. The pictures are drawn by the lesson; describe what they show, never which card or part is right or which pieces to use.',
  };
  return { objects: [], facts };
}
