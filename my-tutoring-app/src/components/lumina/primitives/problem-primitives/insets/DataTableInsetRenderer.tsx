'use client';

import React from 'react';
import type { DataTableInset } from '../../../types';

interface DataTableInsetRendererProps {
  data: DataTableInset;
}

export const DataTableInsetRenderer: React.FC<DataTableInsetRendererProps> = ({ data }) => {
  const isHighlighted = (row: number, col: number) =>
    data.highlightCells?.some(c => c.row === row && c.col === col) ?? false;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {data.headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border-b border-white/10 first:rounded-tl-lg last:rounded-tr-lg"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-white/5 ${ri % 2 === 1 ? 'bg-white/[0.02]' : ''} hover:bg-white/5 transition-colors`}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-2.5 text-slate-300 ${
                    isHighlighted(ri, ci)
                      ? 'ring-1 ring-amber-400/60 bg-amber-400/10 rounded text-amber-200 font-medium'
                      : ''
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.caption && (
        <p className="text-xs text-slate-500 mt-2 font-mono">{data.caption}</p>
      )}
    </div>
  );
};
