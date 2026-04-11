'use client';

import React from 'react';
import type { PassageInset } from '../../../types';

interface PassageInsetRendererProps {
  data: PassageInset;
}

export const PassageInsetRenderer: React.FC<PassageInsetRendererProps> = ({ data }) => {
  const lines = data.text.split('\n');

  const renderContent = () => {
    switch (data.format) {
      case 'poem':
        return (
          <div className="space-y-1">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-3">
                {data.showLineNumbers && (
                  <span className="text-xs text-slate-600 font-mono w-6 flex-shrink-0 text-right select-none pt-0.5">
                    {i + 1}
                  </span>
                )}
                <span className="text-slate-200 italic leading-relaxed">
                  {line || '\u00A0'}
                </span>
              </div>
            ))}
          </div>
        );

      case 'quote':
        return (
          <div className="relative pl-4">
            <span className="absolute -left-1 -top-4 text-5xl text-slate-600 font-serif select-none leading-none">
              &ldquo;
            </span>
            <p className="text-slate-200 text-lg leading-relaxed italic">
              {data.text}
            </p>
          </div>
        );

      case 'letter':
        return (
          <div className="space-y-3 font-serif">
            {lines.map((line, i) => (
              <p key={i} className="text-slate-200 leading-relaxed">
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        );

      case 'source':
        return (
          <div className="space-y-0.5 font-mono text-sm">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-3">
                {data.showLineNumbers && (
                  <span className="text-xs text-slate-600 w-6 flex-shrink-0 text-right select-none pt-0.5">
                    {i + 1}
                  </span>
                )}
                <span className="text-slate-300 leading-relaxed">
                  {line || '\u00A0'}
                </span>
              </div>
            ))}
          </div>
        );

      case 'prose':
      default:
        return (
          <div className="space-y-3">
            {/* Split on double-newline for paragraphs, single newline lines within */}
            {data.text.split(/\n\n+/).map((para, i) => (
              <p key={i} className="text-slate-200 leading-relaxed text-[0.95rem]">
                {i === 0 && <span className="text-2xl font-serif text-slate-400 float-left mr-1.5 mt-0.5 leading-none">{para.charAt(0)}</span>}
                {i === 0 ? para.slice(1) : para}
              </p>
            ))}
          </div>
        );
    }
  };

  return (
    <div>
      <div className="max-h-64 overflow-y-auto pr-1">
        {renderContent()}
      </div>
      {data.attribution && (
        <p className="text-xs text-slate-500 mt-3 text-right italic">
          — {data.attribution}
        </p>
      )}
    </div>
  );
};
