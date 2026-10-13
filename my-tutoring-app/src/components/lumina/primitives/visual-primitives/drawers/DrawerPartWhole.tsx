'use client';

import React, { useMemo, useState } from 'react';
import { LuminaChoiceChip, LuminaPanel } from '../../../ui';
import { formatNumber } from './drawerExpr';
import { childParts, partWholeProblems, topParts, waffleCells, type DrawerPartWholeData } from './drawerSpecs';
import { DRAWER_FILLS, DrawerFrame } from './DrawerFrame';

export type { DrawerPartWholeData } from './drawerSpecs';

const digitsFor = (v: number) => (v >= 100 ? 0 : v >= 1 ? 1 : 2);

/**
 * Part-whole drawer: a whole as 100 squares, split into named parts. Tapping a part highlights
 * its squares; a part with its own breakdown opens it at its own scale, so a tiny slice can be
 * read. Code checks that parts sum to the whole and each breakdown to its part. Ungraded.
 */
const DrawerPartWhole: React.FC<{ data: DrawerPartWholeData; className?: string }> = ({ data, className }) => {
  const problems = useMemo(() => partWholeProblems(data), [data]);
  const [selected, setSelected] = useState<number | null>(null);
  if (problems.length) return <DrawerFrame kind="part-whole" title={data.title} caption={data.caption} problems={problems} className={className}>{null}</DrawerFrame>;
  const top = topParts(data);
  const cells = waffleCells(data);
  const squares = cells.flatMap((n, pi) => Array.from({ length: n }, () => pi));
  const open = selected !== null ? top[selected] : null;
  const kids = open ? childParts(data, open.label) : [];
  const fmt = (v: number) => `${formatNumber(v, digitsFor(v))}${data.unit === '%' ? '%' : ` ${data.unit}`}`;

  return (
    <DrawerFrame kind="part-whole" title={data.title} caption={data.caption} problems={problems} className={className}>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)] items-start">
        <div className="grid grid-cols-10 gap-[3px]" aria-hidden="true">
          {squares.map((pi, i) => (
            <span key={i} className={`aspect-square rounded-[3px] ${DRAWER_FILLS[pi % DRAWER_FILLS.length].fill} transition-opacity duration-200`}
              style={{ opacity: selected === null || selected === pi ? 1 : 0.18 }} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {top.map((x, i) => (
            <LuminaChoiceChip key={x.label} accent={DRAWER_FILLS[i % DRAWER_FILLS.length].accent} selected={selected === i}
              className="w-full justify-start text-left" onClick={() => setSelected(s => (s === i ? null : i))}
              label={`${x.label} · ${fmt(x.value)}${childParts(data, x.label).length ? ' · open' : ''}`} />
          ))}
          <p className="text-xs text-slate-500">Each square is 1% of {data.wholeLabel}. Tap a part.</p>
        </div>
      </div>

      {open && kids.length > 0 && (
        <LuminaPanel className="flex flex-col gap-3 p-4">
          <p className="text-sm font-semibold text-slate-200">Inside {open.label} ({fmt(open.value)})</p>
          <div className="flex h-6 overflow-hidden rounded-md bg-white/5" aria-hidden="true">
            {kids.map((k, i) => (
              <div key={k.label} className={`${DRAWER_FILLS[(i + 2) % DRAWER_FILLS.length].fill} h-full`}
                style={{ width: `${(k.value / open.value) * 100}%` }} />
            ))}
          </div>
          <ul className="flex flex-col gap-1 text-sm text-slate-300">
            {kids.map((k, i) => (
              <li key={k.label} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-sm ${DRAWER_FILLS[(i + 2) % DRAWER_FILLS.length].fill}`} />
                {k.label}: {fmt(k.value)} of {data.wholeLabel}, {formatNumber((k.value / open.value) * 100, 0)}% of this part
              </li>
            ))}
          </ul>
        </LuminaPanel>
      )}
    </DrawerFrame>
  );
};

export default DrawerPartWhole;
