'use client';

/**
 * The kit's teach step on screen: one frame at a time, a drawing and the sentence the tutor says. The child taps through;
 * the last tap opens the task. The host owns which frame is showing.
 */
import React from 'react';
import { LuminaButton, LuminaPanel } from '../../ui';
import { DISPLAY_CSS } from './displays';
import { KitDisplay } from './KitDisplay';
import type { TeachStep } from './teach';

export const TeachPanel: React.FC<{ steps: readonly TeachStep[]; step: number; onNext: () => void }> = ({ steps, step, onNext }) => {
  const frame = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  return (
    <LuminaPanel className="space-y-3 p-4" data-teach-panel="">
      <style>{DISPLAY_CSS}</style>
      <div className="flex flex-wrap justify-center gap-4" data-teach-show="">
        {frame.show.map((d, i) => <KitDisplay key={i} display={d} className="flex min-w-0 max-w-xl flex-1 basis-64 justify-center" />)}
      </div>
      <p className="text-center text-base text-slate-100" data-teach-says="">{frame.says}</p>
      <div className="flex items-center justify-center gap-3">
        {steps.length > 1 && <span className="text-xs text-slate-400">{step + 1} of {steps.length}</span>}
        <LuminaButton tone="primary" data-pip-object="teach-next" onClick={onNext}>{last ? "I'm ready" : 'Next'}</LuminaButton>
      </div>
    </LuminaPanel>
  );
};
