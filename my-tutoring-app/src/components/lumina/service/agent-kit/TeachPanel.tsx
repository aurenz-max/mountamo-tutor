'use client';

/**
 * The kit's teaching section on screen: one frame at a time, the sentence the tutor says with its drawings, picture and
 * cards. The child taps through; the last tap opens the task. The host owns which frame is showing, and holds
 * `useTeachPictures` so a painted picture survives the panel closing and is never paid for twice.
 */
import React, { useCallback, useRef, useState } from 'react';
import { LuminaButton, LuminaPanel } from '../../ui';
import { generateConceptImage } from '../geminiClient-api';
import { DISPLAY_CSS } from './displays';
import { KitDisplay } from './KitDisplay';
import type { TeachPicture, TeachStep } from './teach';

const paint = (prompt: string) => `A clear, friendly, accurate educational illustration for children: ${prompt}. No text, letters or labels anywhere in the image.`;

interface PictureState { url?: string; loading?: boolean; failed?: boolean }

/** The session's painted pictures, by prompt. Nothing is painted until `load`. */
export function useTeachPictures() {
  const [pictures, setPictures] = useState<Record<string, PictureState>>({});
  const busy = useRef(new Set<string>());
  const load = useCallback(async (prompt: string) => {
    if (busy.current.has(prompt)) return;
    busy.current.add(prompt);
    setPictures(p => ({ ...p, [prompt]: { loading: true } }));
    const url = await generateConceptImage(paint(prompt), '16:9').catch(() => null);
    busy.current.delete(prompt);
    setPictures(p => ({ ...p, [prompt]: url ? { url } : { failed: true } }));
  }, []);
  const loaded = (picture?: TeachPicture) => !!picture && !!pictures[picture.prompt]?.url;
  return { pictures, load, loaded };
}
export type TeachPictures = ReturnType<typeof useTeachPictures>;

const Picture: React.FC<{ picture: TeachPicture; pictures: TeachPictures }> = ({ picture, pictures }) => {
  const state = pictures.pictures[picture.prompt] ?? {};
  if (state.url) {
    return (
      <figure className="m-0 flex w-full max-w-xl flex-col items-center gap-1" data-teach-picture="shown">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the image model */}
        <img src={state.url} alt={picture.caption} className="max-h-80 rounded-xl" />
        <figcaption className="text-sm text-slate-300">{picture.caption}</figcaption>
      </figure>
    );
  }
  return (
    <div className="flex min-h-40 w-full max-w-xl flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 p-4" data-teach-picture="waiting">
      <p className="text-center text-sm text-slate-300">{picture.caption}</p>
      <LuminaButton tone="ghost" data-pip-object="teach-picture" disabled={state.loading} onClick={() => void pictures.load(picture.prompt)}>
        {state.loading ? 'Painting…' : state.failed ? 'Try the picture again' : 'Show picture'}
      </LuminaButton>
    </div>
  );
};

export const TeachPanel: React.FC<{ steps: readonly TeachStep[]; step: number; onNext: () => void; pictures: TeachPictures }> = ({ steps, step, onNext, pictures }) => {
  const frame = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  return (
    <LuminaPanel className="space-y-3 p-4" data-teach-panel="">
      <style>{DISPLAY_CSS}</style>
      {frame.heading && <h3 className="text-center text-lg font-semibold text-slate-100" data-teach-heading="">{frame.heading}</h3>}
      {(frame.show.length > 0 || frame.picture) && (
        <div className="flex flex-wrap justify-center gap-4" data-teach-show="">
          {frame.show.map((d, i) => <KitDisplay key={i} display={d} className="flex min-w-0 max-w-xl flex-1 basis-64 justify-center" />)}
          {frame.picture && <Picture key={frame.picture.prompt} picture={frame.picture} pictures={pictures} />}
        </div>
      )}
      {!!frame.cards?.length && (
        <div className="flex flex-wrap justify-center gap-3" data-teach-cards="">
          {frame.cards.map((c, i) => (
            <div key={i} className="flex w-44 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              {c.display && <KitDisplay display={c.display} className="flex w-full justify-center" />}
              <span className="font-semibold text-slate-100">{c.title}</span>
              <span className="text-sm text-slate-300">{c.text}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-base text-slate-100" data-teach-says="">{frame.says}</p>
      <div className="flex items-center justify-center gap-3">
        {steps.length > 1 && <span className="text-xs text-slate-400">{step + 1} of {steps.length}</span>}
        <LuminaButton tone="primary" data-pip-object="teach-next" onClick={onNext}>{last ? "I'm ready" : 'Next'}</LuminaButton>
      </div>
    </LuminaPanel>
  );
};
