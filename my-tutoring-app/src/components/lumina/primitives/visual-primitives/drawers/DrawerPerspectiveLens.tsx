'use client';

import React, { useMemo, useState } from 'react';
import { LuminaButton, LuminaPanel } from '../../../ui';
import { perspectiveLensProblems, type DrawerPerspectiveLensData } from './textSpecs';
import { DRAWER_FILLS, DrawerFrame } from './DrawerFrame';

export type { DrawerPerspectiveLensData } from './textSpecs';

/**
 * Perspective lens: one event, several people who were part of it, the same questions put to
 * each. Viewpoints open one at a time so the learner reads one account before comparing; once
 * two are open they sit side by side, question by question. Ungraded.
 */
const DrawerPerspectiveLens: React.FC<{ data: DrawerPerspectiveLensData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => perspectiveLensProblems(data), [data]);
  const [open, setOpen] = useState<number[]>([]);
  if (problems.length) return <DrawerFrame kind="perspective-lens" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;

  const toggle = (i: number) => setOpen(o => (o.includes(i) ? o.filter(x => x !== i) : [...o, i].sort()));
  const shown = open.map(i => ({ i, v: data.views[i] }));

  return (
    <DrawerFrame kind="perspective-lens" title={data.title} caption={data.caption} problems={problems} className={className}>
      <LuminaPanel className="p-4 text-sm text-slate-200">{data.event}</LuminaPanel>

      <div className="flex flex-wrap gap-2">
        {data.views.map((v, i) => (
          <LuminaButton key={v.label} tone={open.includes(i) ? 'primary' : 'ghost'} onClick={() => toggle(i)}>
            <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${DRAWER_FILLS[i % DRAWER_FILLS.length].fill}`} />{v.label}
          </LuminaButton>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400">Open one viewpoint and read it before opening another.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-full gap-x-4" style={{ gridTemplateColumns: `minmax(110px,150px) repeat(${shown.length}, minmax(180px,1fr))` }}>
            <span />
            {shown.map(({ i, v }) => (
              <span key={v.label} className={`pb-2 text-sm font-semibold ${DRAWER_FILLS[i % DRAWER_FILLS.length].text}`}>{v.label}</span>
            ))}
            {data.prompts.map((q, qi) => (
              <React.Fragment key={q}>
                <span className="border-t border-white/10 py-3 text-sm font-semibold text-slate-100">{q}</span>
                {shown.map(({ v }) => (
                  <span key={v.label} className="border-t border-white/10 py-3 text-sm text-slate-300">{v.answers[qi]}</span>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </DrawerFrame>
  );
};

export default DrawerPerspectiveLens;
