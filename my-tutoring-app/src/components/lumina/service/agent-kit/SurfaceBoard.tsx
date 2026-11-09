'use client';

/**
 * The kit's answer board: an item's displays, its cards and the child's work on a choose, categorize or order surface,
 * built once for every agent primitive. The host keeps the Check button and the feedback. Tap targets are the harness's
 * names (`surfaceTaps` in `surfaces.ts`).
 */
import React, { useCallback, useState } from 'react';
import { answerStateClasses, surface } from '../../ui/tokens';
import { SoundManager } from '../../utils/SoundManager';
import { DISPLAY_CSS } from './displays';
import { KitDisplay } from './KitDisplay';
import type { SurfaceAnswer, SurfaceItem } from './surfaces';

const EMPTY: SurfaceAnswer = { choice: null, order: [], placed: {} };

/** What the child has done on the board. `reset` clears it for a new item or a retry. */
export function useSurfaceAnswer() {
  const [answer, setAnswer] = useState<SurfaceAnswer>(EMPTY);
  const [picked, setPicked] = useState<string | null>(null);
  const reset = useCallback(() => { setAnswer(EMPTY); setPicked(null); }, []);
  return { answer, picked, setAnswer, setPicked, reset };
}
export type SurfaceAnswerState = ReturnType<typeof useSurfaceAnswer>;

export const SurfaceBoard: React.FC<{ item: SurfaceItem; board: SurfaceAnswerState; locked: boolean; onChanged?: () => void }> = ({ item, board, locked, onChanged }) => {
  const { answer, picked, setAnswer, setPicked } = board;
  const change = (next: (a: SurfaceAnswer) => SurfaceAnswer) => {
    if (locked) return;
    setAnswer(a => next({ choice: a.choice ?? null, order: [...(a.order ?? [])], placed: { ...(a.placed ?? {}) } }));
    onChanged?.();
    SoundManager.tap();
  };
  const tapCard = (id: string) => {
    if (item.surface === 'choose') change(a => ({ ...a, choice: id }));
    if (item.surface === 'order') change(a => ({ ...a, order: a.order!.includes(id) ? a.order! : [...a.order!, id] }));
    if (item.surface === 'categorize' && !locked) { setPicked(p => (p === id ? null : id)); SoundManager.tap(); }
  };
  const tapCategory = (cat: string) => {
    if (!picked) return;
    const id = picked;
    change(a => ({ ...a, placed: { ...a.placed, [id]: cat } }));
    setPicked(null);
  };
  const indexOf = (id: string) => item.options.findIndex(o => o.id === id);
  const cardClass = (on: boolean) => `flex w-40 flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition-all duration-200 disabled:opacity-80 ${answerStateClasses[on ? 'selected' : 'idle']}`;

  return (
    <>
      <style>{DISPLAY_CSS}</style>
      {item.stimulus.length > 0 && (
        <div className={`flex flex-wrap justify-center gap-3 rounded-xl border p-3 ${surface.nested}`} data-studio-stimulus="">
          {item.stimulus.map((d, i) => <KitDisplay key={i} display={d} className="flex min-w-0 max-w-md flex-1 basis-56 justify-center" />)}
        </div>
      )}

      {item.surface === 'order' && (
        <div className="flex flex-wrap items-center gap-2" data-studio-slots="">
          {item.options.map((_, i) => {
            const id = answer.order?.[i];
            return (
              <button key={i} type="button" disabled={locked || !id} aria-label={id ? `take out of box ${i + 1}` : `box ${i + 1}`}
                data-pip-object={`slot-${i}`} onClick={() => change(a => ({ ...a, order: a.order!.filter((_, j) => j !== i) }))}
                className={`flex h-12 min-w-[3.5rem] items-center justify-center rounded-lg border-2 px-2 text-sm ${id ? 'border-cyan-400 bg-cyan-500/10 text-cyan-50' : 'border-dashed border-slate-500 text-slate-400'}`}>
                {id ? `Card ${indexOf(id) + 1}` : i + 1}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3" data-studio-cards="">
        {item.options.map((o, i) => {
          const on = item.surface === 'choose' ? answer.choice === o.id : item.surface === 'order' ? !!answer.order?.includes(o.id) : picked === o.id;
          const placedIn = item.surface === 'categorize' ? answer.placed?.[o.id] : undefined;
          return (
            <button key={o.id} type="button" disabled={locked || (item.surface === 'order' && on)} aria-pressed={on}
              aria-label={`card ${i + 1}`} data-pip-object={`card-${o.id}`} onClick={() => tapCard(o.id)} className={cardClass(on)}>
              <span className="text-xs font-semibold text-slate-400">Card {i + 1}</span>
              {o.display && <KitDisplay display={o.display} className="w-full" />}
              {o.label && <span className="text-sm text-slate-100">{o.label}</span>}
              {placedIn && <span className="rounded-full bg-cyan-500/20 px-2 text-xs text-cyan-100">{placedIn}</span>}
            </button>
          );
        })}
      </div>

      {item.surface === 'categorize' && (
        <div className="flex flex-wrap gap-3" data-studio-categories="">
          {(item.categories ?? []).map((c, ci) => (
            <button key={c} type="button" disabled={locked || !picked} data-pip-object={`category-${ci}`} aria-label={`box ${c}`}
              onClick={() => tapCategory(c)}
              className={`min-w-[8rem] rounded-xl border-2 border-dashed px-4 py-3 text-sm text-slate-100 ${picked ? 'border-cyan-400' : 'border-slate-500'}`}>
              {c}
              <span className="block text-xs text-slate-400">{item.options.filter(o => answer.placed?.[o.id] === c).map(o => `Card ${indexOf(o.id) + 1}`).join(', ')}</span>
            </button>
          ))}
        </div>
      )}
      {item.surface === 'categorize' && <p className="text-xs text-slate-400">{picked ? 'Now tap the box it goes in.' : 'Tap a card, then tap the box it goes in.'}</p>}
    </>
  );
};
