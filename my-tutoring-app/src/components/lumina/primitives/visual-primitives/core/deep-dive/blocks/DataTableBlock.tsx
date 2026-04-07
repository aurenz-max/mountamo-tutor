'use client';

import React from 'react';
import type { DataTableBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

interface DataTableBlockProps {
  data: DataTableBlockData;
  index: number;
}

const DataTableBlock: React.FC<DataTableBlockProps> = ({ data, index }) => {
  return (
    <BlockWrapper label={data.label} index={index} accent="emerald" variant="feature">
      {data.caption && (
        <p className="text-slate-300 text-sm mb-4 font-light">{data.caption}</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-emerald-500/10">
              {data.headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-emerald-300/80 font-medium text-xs uppercase tracking-wide border-b border-white/10"
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
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-3 ${ci === 0 ? 'text-slate-100 font-medium' : 'text-slate-300'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockWrapper>
  );
};

export default DataTableBlock;
