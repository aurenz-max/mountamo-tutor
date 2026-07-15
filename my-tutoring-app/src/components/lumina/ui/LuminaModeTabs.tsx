/**
 * LuminaModeTabs — the eval-mode / phase pill row.
 *
 * The tab strip at the top of multi-phase primitives (CountingBoard:
 * Count·Subitize·See & Show·Organize·Count On; TenFrame: Build·Subitize·
 * Make Ten·Operate). The active phase takes the accent; the rest are muted.
 * Extracted from CountingBoard.tsx's PHASE_CONFIG header.
 *
 * Usually a read-only indicator of the current phase (omit onSelect). Pass
 * onSelect to make the tabs clickable.
 *
 *   <LuminaModeTabs tabs={[{value:'count',label:'Count'},…]} active={phase} accent="orange" />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { accentChipBg, accentSoftBorder, accentText, motion, type LuminaAccent } from './tokens';

export interface LuminaModeTab {
  value: string;
  label: string;
}

export interface LuminaModeTabsProps {
  tabs: LuminaModeTab[];
  active: string;
  accent?: LuminaAccent;
  /** When provided, tabs become clickable buttons. Omit for a read-only indicator. */
  onSelect?: (value: string) => void;
  className?: string;
}

export const LuminaModeTabs: React.FC<LuminaModeTabsProps> = ({
  tabs,
  active,
  accent = 'orange',
  onSelect,
  className,
}) => (
  <div className={cn('flex items-center gap-2 flex-wrap', className)}>
    {tabs.map((tab) => {
      const isActive = tab.value === active;
      const cls = cn(
        'rounded-full border px-3 py-1 text-xs font-semibold',
        motion.transition,
        isActive
          ? cn(accentChipBg[accent], accentSoftBorder[accent], accentText[accent])
          : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
      );
      return onSelect ? (
        <button
          key={tab.value}
          type="button"
          aria-pressed={isActive}
          onClick={() => onSelect(tab.value)}
          className={cn(
            cls,
            motion.press,
            !isActive && 'hover:text-slate-300 hover:bg-slate-800/50'
          )}
        >
          {tab.label}
        </button>
      ) : (
        <span key={tab.value} className={cls}>
          {tab.label}
        </span>
      );
    })}
  </div>
);
