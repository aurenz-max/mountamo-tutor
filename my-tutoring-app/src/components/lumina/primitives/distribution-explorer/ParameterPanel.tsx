'use client';

import React from 'react';
import { Card } from '../../../ui/card';
import type { FamilyDefinition } from './types';

interface ParameterPanelProps {
  familyDef: FamilyDefinition;
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
  /** Disable controls (e.g. while an identify challenge is pending). */
  disabled?: boolean;
  /** Parameter names ringed by the `slider_glow` lever. */
  highlight?: readonly string[];
}

/**
 * One slider per parameter declared in the family's schema. Integer-flagged
 * params (n in Binomial) snap to whole numbers; everything else uses the
 * schema's step. Values are clamped at the input layer — we trust the
 * engine to clamp again on evaluation.
 */
export const ParameterPanel: React.FC<ParameterPanelProps> = ({
  familyDef,
  values,
  onChange,
  disabled,
  highlight,
}) => {
  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Parameters · {familyDef.label}
      </p>
      {familyDef.parameters.map((schema) => {
        const value = values[schema.name] ?? schema.defaultValue;
        const formatted = schema.integer ? value.toString() : value.toFixed(2);
        return (
          <div
            key={schema.name}
            data-lever={highlight?.includes(schema.name) ? 'slider-glow' : undefined}
            className={`space-y-1.5 ${highlight?.includes(schema.name) ? 'rounded-md ring-2 ring-amber-300/70 p-2 -m-2' : ''}`}
          >
            <div className="flex items-baseline justify-between">
              <label className="text-sm text-slate-200 font-medium">{schema.label}</label>
              <span className="text-sm font-mono text-indigo-300">{formatted}</span>
            </div>
            <input
              type="range"
              aria-label={schema.label}
              min={schema.min}
              max={schema.max}
              step={schema.step}
              value={value}
              disabled={disabled}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                const next = schema.integer ? Math.round(raw) : raw;
                onChange(schema.name, next);
              }}
              className="w-full accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{schema.min}</span>
              <span>{schema.max}</span>
            </div>
          </div>
        );
      })}
    </Card>
  );
};
