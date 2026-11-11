import React from 'react';
import { LuminaCard, LuminaCardContent } from '../../../../ui';
import { PipDock, PipWorkspace } from '../../../../pip/WorkspacePip';
import { isMark, trackLength, type WordThing, type WordWorld } from './wonderWalkWords';

/**
 * A language stop on screen (`wonderWalkWords.ts`): the scene shows the refs the tutor names (a cat to rhyme with, a
 * big letter, a story's character); the cards are pictures (no printed word, so a sound is heard, not read off the
 * card), letter tiles, a picture drawn once or as many, or drawn in, on, under or next to a landmark. A sentence
 * stop's cards are word tiles: the printed word, with its picture when it has one (the tutor names every card).
 *
 * Tap: tap one card. Sort: tap a card, then its basket (tap a card in a basket to take it out), then Done. Order: tap
 * cards onto the track in turn (tap one on the track to take it off), then Done. A sentence track shows the words that
 * are not cards already in place; a sentence with one word left out is drawn in the scene with an empty box there.
 * Deterministic from the data: code stored the card order; nothing here randomises.
 */

export interface WordStageProps {
  words: WordWorld;
  open: boolean;
  /** Ring classes for a tap target's state (idle, right, wrong). */
  ring: (id: string) => string;
  held: string | null;
  basketOf: Record<string, string | null>;
  track: string[];
  onThing: (id: string) => void;
  onBasket: (id: string) => void;
  onDone: () => void;
}

const Face: React.FC<{ t: WordThing; big?: boolean }> = ({ t, big }) => {
  if (t.tile) {
    return (
      <span data-tile className="flex flex-col items-center justify-center gap-1 select-none">
        {t.emoji && <span data-tile className="text-3xl sm:text-4xl leading-none">{t.emoji}</span>}
        <span data-tile className={`font-bold leading-none text-slate-100 ${isMark(t.tile) ? 'text-6xl' : t.emoji ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}>{t.tile}</span>
      </span>
    );
  }
  if (t.letter) return <span className={`font-bold leading-none select-none text-slate-100 ${big ? 'text-8xl' : 'text-6xl sm:text-7xl'}`}>{t.letter}</span>;
  if ((t.count ?? 1) > 1) {
    return (
      <span className="flex flex-wrap justify-center gap-0.5 max-w-[8rem] select-none">
        {Array.from({ length: t.count! }, (_, k) => <span key={k} className="text-3xl sm:text-4xl leading-none">{t.emoji}</span>)}
      </span>
    );
  }
  if (t.rel && t.landmark) {
    const thing = <span className="text-3xl sm:text-4xl leading-none">{t.emoji}</span>;
    const mark = <span className="text-5xl sm:text-6xl leading-none">{t.landmark.emoji}</span>;
    if (t.rel === 'in') {
      return (
        <span className="relative inline-flex items-center justify-center select-none">
          {mark}
          <span className="absolute inset-0 flex items-center justify-center"><span className="text-2xl sm:text-3xl leading-none">{t.emoji}</span></span>
        </span>
      );
    }
    return (
      <span className={`flex items-center justify-center select-none ${t.rel === 'next-to' ? 'flex-row gap-1' : 'flex-col gap-0'}`}>
        {t.rel === 'on' ? <>{thing}{mark}</> : <>{mark}{thing}</>}
      </span>
    );
  }
  return <span className={`leading-none select-none ${big ? 'text-8xl' : 'text-6xl sm:text-7xl'}`}>{t.emoji}</span>;
};

const card = 'rounded-3xl border-4 flex items-center justify-center p-2 bg-slate-800/60 transition-transform';
/** A sentence word that is not a card: already in its place, not a tap target. */
const fixedWord = 'min-w-[4rem] h-24 px-3 rounded-2xl border-2 border-white/10 bg-slate-800/40 flex items-center justify-center text-2xl sm:text-3xl font-bold text-slate-200 select-none';
const emptySlot = 'w-24 h-24 rounded-2xl border-4 border-dashed border-sky-300/50 bg-sky-900/20 flex items-center justify-center';

export const WonderWalkWordStage: React.FC<WordStageProps> = ({ words, open, ring, held, basketOf, track, onThing, onBasket, onDone }) => {
  const a = words.answer;
  const label = (id: string) => `card ${words.things.findIndex(t => t.id === id) + 1}`;
  const thingButton = (t: WordThing, extra = '') => (
    <button key={t.id} type="button" data-pip-object={`thing-${t.id}`} aria-label={label(t.id)} disabled={!open}
      onClick={e => { e.stopPropagation(); onThing(t.id); }}
      className={`${card} ${extra} ${a.kind === 'tap' ? ring(`thing-${t.id}`) : held === t.id ? 'border-violet-300 scale-105' : 'border-white/10'}
        ${open ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-default'}`}>
      <Face t={t} />
    </button>
  );
  const ref = (id: string) => words.refs.find(r => r.id === id) ?? words.things.find(t => t.id === id);
  const inBasket = (id: string) => a.kind === 'sort' && !!basketOf[id];
  const onTrack = (id: string) => a.kind === 'order' && track.includes(id);
  const tray = words.things.filter(t => !inBasket(t.id) && !onTrack(t.id));
  const slots = a.kind === 'order' ? trackLength(words) : 0;
  const sentence = words.sentence ?? [];
  const bySentence = a.kind === 'order' && a.by === 'sentence';
  const fill = a.kind === 'tap' && a.rule.type === 'fills';
  // A sentence track: each word in turn, a card's place as the next empty slot.
  let slot = 0;
  const sentenceTrack = sentence.map((k, i) => {
    if (!k.card) return <div key={i} className={fixedWord}>{k.say}</div>;
    const at = slot++;
    const t = words.things.find(x => x.id === track[at]);
    return <div key={i} className={emptySlot}>{t ? thingButton(t, 'w-20 h-20') : <span aria-hidden className="text-slate-500 text-xl">{at + 1}</span>}</div>;
  });

  return (
    <>
      <LuminaCard className="mb-6 overflow-hidden">
        <LuminaCardContent className="p-0">
          <div data-pip-object="scene" className="w-full min-h-[12rem] bg-slate-900/60 flex flex-wrap items-center justify-center gap-8 p-6">
            {fill ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {sentence.map((k, i) => (k.card
                  ? <div key={i} aria-label="the missing word" className={emptySlot} />
                  : <div key={i} className={fixedWord}>{k.say}</div>))}
              </div>
            ) : words.refs.length
              ? words.refs.filter(r => !(a.kind === 'sort' && a.baskets.some(b => b.label === r.id))).map(r => <Face key={r.id} t={r} big />)
              : <span aria-hidden className="text-8xl select-none">👂</span>}
            {a.kind === 'sort' && words.refs.every(r => a.baskets.some(b => b.label === r.id)) && <span aria-hidden className="text-7xl select-none">🧺</span>}
          </div>
        </LuminaCardContent>
      </LuminaCard>

      <PipDock />
      <PipWorkspace>
        {a.kind === 'sort' && (
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${a.baskets.length}, minmax(0, 1fr))` }}>
            {a.baskets.map((b, k) => {
              const lab = ref(b.label);
              return (
                <div key={b.id} role="button" tabIndex={0} data-pip-object={`basket-${b.id}`} aria-label={`basket ${k + 1}`}
                  onClick={() => onBasket(b.id)} onKeyDown={e => { if (e.key === 'Enter') onBasket(b.id); }}
                  className={`min-h-[9rem] rounded-3xl border-4 border-dashed bg-amber-900/20 p-2 flex flex-col items-center gap-2
                    ${held ? 'border-violet-300/70 cursor-pointer' : 'border-amber-300/50'}`}>
                  <span className="flex items-center gap-1">{lab && <Face t={lab} />}<span aria-hidden className="text-3xl">🧺</span></span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {words.things.filter(t => basketOf[t.id] === b.id).map(t => thingButton(t, 'w-20 h-20 [&_span]:!text-4xl'))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {bySentence && <div className="flex flex-wrap justify-center gap-3 mb-6" data-pip-object="track">{sentenceTrack}</div>}
        {a.kind === 'order' && !bySentence && (
          <div className="flex justify-center gap-3 mb-6" data-pip-object="track">
            {Array.from({ length: slots }, (_, k) => {
              const t = words.things.find(x => x.id === track[k]);
              return (
                <div key={k} className={emptySlot}>
                  {t ? thingButton(t, 'w-20 h-20 [&_span]:!text-5xl') : <span aria-hidden className="text-slate-500 text-xl">{k + 1}</span>}
                </div>
              );
            })}
          </div>
        )}
        <div className={`grid gap-4 sm:gap-6 ${tray.length <= 2 ? 'grid-cols-2' : tray.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {(a.kind === 'tap' ? words.things : tray).map(t => thingButton(t, 'aspect-square'))}
        </div>
        {a.kind !== 'tap' && (
          <div className="flex justify-center mt-6">
            <button type="button" data-pip-object="done" aria-label="Done" disabled={!open} onClick={onDone}
              className={`w-28 h-20 rounded-3xl border-4 bg-emerald-800/40 text-4xl ${ring('done')} ${open ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-default opacity-60'}`}>✅</button>
          </div>
        )}
      </PipWorkspace>
    </>
  );
};
