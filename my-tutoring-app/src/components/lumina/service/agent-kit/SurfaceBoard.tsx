'use client';

/**
 * The kit's answer board: an item's displays, its cards and the child's work on a choose, categorize, order, make, set or point surface,
 * built once for every agent primitive. The host keeps the Check button and the feedback. Tap targets are the harness's
 * names (`surfaceTaps` in `surfaces.ts`).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { answerStateClasses, surface } from '../../ui/tokens';
import { SoundManager } from '../../utils/SoundManager';
import { DISPLAY_CSS, displayHtml, displayMaxWidth, displayParts, displayPointed, displayRevealed } from './displays';
import { setApply, setControls } from './setting';
import { KitDisplay } from './KitDisplay';
import { pointTarget, setTarget, type SurfaceAnswer, type SurfaceItem } from './surfaces';

const EMPTY: SurfaceAnswer = { part: null, choice: null, order: [], placed: {}, made: [] };

/** What the child has done on the board. `reset` clears it for a new item or a retry. */
export function useSurfaceAnswer() {
  const [answer, setAnswer] = useState<SurfaceAnswer>(EMPTY);
  const [picked, setPicked] = useState<string | null>(null);
  const reset = useCallback(() => { setAnswer(EMPTY); setPicked(null); }, []);
  return { answer, picked, setAnswer, setPicked, reset };
}
export type SurfaceAnswerState = ReturnType<typeof useSurfaceAnswer>;

/** `checked`: the child's answer has been checked, so a board that held something back (a model's results) now shows it. */
export const SurfaceBoard: React.FC<{ item: SurfaceItem; board: SurfaceAnswerState; locked: boolean; checked?: boolean; onChanged?: () => void }> = ({ item, board, locked, checked, onChanged }) => {
  const { answer, picked, setAnswer, setPicked } = board;
  const change = (next: (a: SurfaceAnswer) => SurfaceAnswer) => {
    if (locked) return;
    setAnswer(a => next({ part: a.part ?? null, choice: a.choice ?? null, order: [...(a.order ?? [])], placed: { ...(a.placed ?? {}) }, made: [...(a.made ?? [])], ...(a.board ? { board: a.board } : {}) }));
    onChanged?.();
    SoundManager.tap();
  };
  const tapCard = (id: string) => {
    if (item.surface === 'choose') change(a => ({ ...a, choice: id }));
    if (item.surface === 'order') change(a => ({ ...a, order: a.order!.includes(id) ? a.order! : [...a.order!, id] }));
    if (item.surface === 'make') change(a => ({ ...a, made: a.made!.includes(id) ? a.made!.filter(x => x !== id) : [...a.made!, id] }));
    if (item.surface === 'categorize' && !locked) { setPicked(p => (p === id ? null : id)); SoundManager.tap(); }
  };
  const tapCategory = (cat: string) => {
    if (!picked) return;
    const id = picked;
    change(a => ({ ...a, placed: { ...a.placed, [id]: cat } }));
    setPicked(null);
  };
  const indexOf = (id: string) => item.options.findIndex(o => o.id === id);
  // set: the board is the child's work. It redraws from its values after every tap; the marks sit over it as buttons.
  const boardNow = item.surface === 'set' && item.board ? answer.board ?? item.board : null;
  // point: the board is drawn again for each tapped part, with that part lit. Each part's unseen shape becomes a button.
  const pointParts = item.surface === 'point' ? displayParts(item.board) : [];
  const pointHtml = useMemo(() => {
    if (item.surface !== 'point' || !item.board) return null;
    const parts = displayParts(item.board);
    const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const drawn = displayHtml(answer.part ? displayPointed(item.board, answer.part) : item.board);
    return { __html: drawn.replace(/data-part="([^"]*)"/g, (all, name: string) => {
      const part = parts.find(p => attr(p) === name);
      return part === undefined ? all : `${all} data-pip-object="${attr(pointTarget(part))}" role="button" tabindex="${locked ? -1 : 0}" aria-label="${attr(`part: ${part}`)}" aria-pressed="${answer.part === part}"`;
    }) };
  }, [item.surface, item.board, answer.part, locked]);
  const tapPart = (target: EventTarget | null) => {
    const name = (target as Element | null)?.closest?.('[data-part]')?.getAttribute('data-part');
    if (name && pointParts.includes(name)) change(a => ({ ...a, part: name }));
  };
  const tapBoard = (id: string, dir?: 1 | -1) => change(a => ({ ...a, board: setApply(item, a.board ?? item.board!, { id, ...(dir ? { dir } : {}) }) }));
  const boardDrawn = useMemo(() => (boardNow && checked ? displayRevealed(boardNow) : boardNow), [boardNow, checked]);
  const controls = boardNow ? setControls(item, boardNow) : [];
  const placed = controls.filter(c => c.kind === 'toggle' && c.x !== undefined), loose = controls.filter(c => c.kind === 'toggle' && c.x === undefined);
  const cardClass = (on: boolean) => `flex w-40 flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition-all duration-200 disabled:opacity-80 ${answerStateClasses[on ? 'selected' : 'idle']}`;

  return (
    <>
      <style>{DISPLAY_CSS}</style>
      {item.stimulus.length > 0 && (
        <div className={`flex flex-wrap justify-center gap-3 rounded-xl border p-3 ${surface.nested}`} data-studio-stimulus="">
          {item.stimulus.map((d, i) => <KitDisplay key={i} display={d} className="flex min-w-0 max-w-md flex-1 basis-56 justify-center" />)}
        </div>
      )}

      {pointHtml && (
        <div className={`flex flex-col items-center gap-2 rounded-xl border p-3 ${surface.nested}`} data-studio-point="">
          <div className={`w-full ${locked ? '' : '[&_[data-part]]:cursor-pointer'}`} style={{ maxWidth: displayMaxWidth(item.board!) }}
            onClick={e => tapPart(e.target)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapPart(e.target); } }}
            dangerouslySetInnerHTML={pointHtml} />
          <p className="text-xs text-slate-400">{answer.part ? `You tapped ${answer.part}. Tap another part to change it.` : 'Tap one part of the picture.'}</p>
        </div>
      )}

      {boardNow && (
        <div className={`flex flex-col items-center gap-3 rounded-xl border p-3 ${surface.nested}`} data-studio-board="">
          {/* The box is exactly the drawing: the marks are placed in percent of it. */}
          <div className="relative w-full" style={{ maxWidth: displayMaxWidth(boardNow) }}>
            <KitDisplay display={boardDrawn!} className="w-full [&>svg]:block" />
            {placed.map(c => (
              <button key={c.id} type="button" disabled={locked} aria-pressed={!!c.on} aria-label={c.label} data-pip-object={setTarget(c.id)} onClick={() => tapBoard(c.id)}
                style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.size ?? 12}%` }}
                className={`absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors ${c.on ? 'border-cyan-300 bg-cyan-400/60' : 'border-slate-400/70 bg-slate-900/40 hover:border-cyan-300'}`} />
            ))}
          </div>
          {loose.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {loose.map(c => (
                <button key={c.id} type="button" disabled={locked} aria-pressed={!!c.on} aria-label={c.label} data-pip-object={setTarget(c.id)} onClick={() => tapBoard(c.id)}
                  className={`min-h-11 rounded-lg border-2 px-3 text-sm text-slate-100 ${c.on ? 'border-cyan-300 bg-cyan-400/30' : 'border-slate-500 hover:border-cyan-300'}`}>{c.label}</button>
              ))}
            </div>
          )}
          {controls.filter(c => c.kind === 'step').map(c => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-slate-100">
              <button type="button" disabled={locked} aria-label={`${c.label} back`} data-pip-object={setTarget(c.id, -1)} onClick={() => tapBoard(c.id, -1)} className="h-11 w-11 rounded-lg border-2 border-slate-500 text-lg hover:border-cyan-300">◀</button>
              <span className="min-w-[6rem] text-center">{c.label}</span>
              <button type="button" disabled={locked} aria-label={`${c.label} forward`} data-pip-object={setTarget(c.id, 1)} onClick={() => tapBoard(c.id, 1)} className="h-11 w-11 rounded-lg border-2 border-slate-500 text-lg hover:border-cyan-300">▶</button>
            </div>
          ))}
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
          const on = item.surface === 'choose' ? answer.choice === o.id : item.surface === 'make' ? !!answer.made?.includes(o.id) : item.surface === 'order' ? !!answer.order?.includes(o.id) : picked === o.id;
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
      {item.surface === 'make' && (
        // The tray names the pieces on it and never their total: working that out is the task.
        <div className="rounded-xl border-2 border-dashed border-slate-500 px-4 py-3 text-sm text-slate-100" data-studio-tray="">
          On the tray
          <span className="block text-xs text-slate-400">{answer.made?.length ? answer.made.map(id => `Card ${indexOf(id) + 1}`).join(', ') : 'Tap a piece to put it on. Tap it again to take it off.'}</span>
        </div>
      )}
      {item.surface === 'categorize' && <p className="text-xs text-slate-400">{picked ? 'Now tap the box it goes in.' : 'Tap a card, then tap the box it goes in.'}</p>}
    </>
  );
};
