
import React from 'react';
import { TableData } from '../types';

interface GenerativeTableProps {
  data: TableData;
  index: number;
  onRowClick?: (item: string) => void;
}

export const GenerativeTable: React.FC<GenerativeTableProps> = ({ data, index, onRowClick }) => {
  return (
    <div className="w-full max-w-4xl mx-auto my-8 animate-fade-in" style={{ animationDelay: `${index * 200}ms` }}>
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative">
        {/* Decor - Header Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-70"></div>
        
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center border border-blue-400/30 text-blue-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{data.title || 'Data Log'}</h3>
                    <span className="text-xs text-slate-400 font-mono">Dataset 0{index + 1}</span>
                </div>
            </div>
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                {data.headers.map((header, i) => (
                  <th 
                    key={i} 
                    className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider bg-black/20 border-b border-white/10 whitespace-nowrap first:pl-8"
                  >
                    {header}
                  </th>
                ))}
                {/* Extra column for arrow */}
                <th className="px-6 py-4 bg-black/20 border-b border-white/10 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm font-light text-slate-300">
              {data.rows.map((row, rIndex) => (
                <tr 
                    key={rIndex} 
                    onClick={() => onRowClick && onRowClick(row[0])}
                    className="group hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                >
                  {row.map((cell, cIndex) => (
                    <td 
                        key={cIndex} 
                        className={`px-6 py-4 border-b border-white/5 whitespace-nowrap group-last:border-0 first:pl-8 
                            ${cIndex === 0 ? 'font-medium text-white font-mono group-hover:text-blue-300 transition-colors' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                  {/* Action Arrow */}
                  <td className="px-6 py-4 border-b border-white/5 group-last:border-0 text-right">
                      <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer status bar */}
        <div className="px-4 py-2 bg-black/20 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500 font-mono uppercase">
            <span>{data.rows.length} Records Loaded</span>
            <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Verified by Gemini
            </span>
        </div>
      </div>
    </div>
  );
};
