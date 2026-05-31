/**
 * LuminaTable — a data-driven glass data table.
 *
 * Extracted from DataTableBlock.tsx (deep-dive) — reference-quality Lumina
 * table styling. Bordered rounded container, accent-tinted header with
 * uppercase tracked column labels, subtle row dividers + hover, first-column
 * emphasis. Data-driven (columns + rows) because Lumina tables are almost
 * always generated data arrays; cells take ReactNode so they can hold badges,
 * buttons, etc.
 *
 *   <LuminaTable
 *     accent="emerald"
 *     caption="Comparative analysis of decoherence parameters…"
 *     columns={['Substrate Medium', 'Intrinsic Loss (dB/cm)', 'Coherence (ms)']}
 *     rows={[
 *       ['Fused Silica', '0.001 - 0.005', '500 - 800'],
 *       ['Standard Borosilicate', '0.02 - 0.05', '50 - 120'],
 *     ]}
 *   />
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { accentGlow, accentText, type LuminaAccent } from './tokens';

export interface LuminaTableProps extends React.HTMLAttributes<HTMLDivElement> {
  columns: React.ReactNode[];
  /** Row-major cell grid. Each inner array aligns to `columns`. */
  rows: React.ReactNode[][];
  accent?: LuminaAccent;
  /** Optional muted caption rendered above the table. */
  caption?: React.ReactNode;
  /** Render the first column as the row label (slate-100, medium). Default true. */
  emphasizeFirstColumn?: boolean;
}

export const LuminaTable = React.forwardRef<HTMLDivElement, LuminaTableProps>(
  (
    { className, columns, rows, accent = 'cyan', caption, emphasizeFirstColumn = true, ...props },
    ref
  ) => (
    <div ref={ref} className={className} {...props}>
      {caption && <p className="text-slate-300 text-sm mb-4 font-light">{caption}</p>}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead>
            <tr className={accentGlow[accent]}>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 text-left font-medium text-xs uppercase tracking-wide border-b border-white/10',
                    accentText[accent]
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'px-4 py-3',
                      emphasizeFirstColumn && ci === 0
                        ? 'text-slate-100 font-medium'
                        : 'text-slate-300'
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
);
LuminaTable.displayName = 'LuminaTable';
