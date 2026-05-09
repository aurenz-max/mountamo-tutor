'use client';

import React from 'react';
import { Card } from '../../../ui/card';
import { FAMILY_LIST } from '../../lib/probability';
import type { DistributionFamily } from './types';

interface FamilySelectorProps {
  active: DistributionFamily;
  onChange: (family: DistributionFamily) => void;
  /** Disable when an identify challenge is pending — student should NOT see the answer in the picker. */
  disabled?: boolean;
}

export const FamilySelector: React.FC<FamilySelectorProps> = ({ active, onChange, disabled }) => {
  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Family</p>
      <div className="grid grid-cols-3 gap-2">
        {FAMILY_LIST.map((def) => {
          const isActive = def.family === active;
          return (
            <button
              key={def.family}
              type="button"
              disabled={disabled}
              onClick={() => onChange(def.family)}
              className={`text-xs px-2 py-2 rounded border transition-colors text-center ${
                isActive
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800/70'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-semibold">{def.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{def.kind}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};
