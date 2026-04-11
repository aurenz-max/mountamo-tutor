'use client';

import React from 'react';
import type { CodeInset } from '../../../types';

interface CodeInsetRendererProps {
  data: CodeInset;
}

export const CodeInsetRenderer: React.FC<CodeInsetRendererProps> = ({ data }) => {
  const lines = data.code.split('\n');

  return (
    <div className="overflow-x-auto max-h-64">
      <pre className="text-sm font-mono leading-relaxed">
        <code>
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const isHighlighted = data.highlightLines?.includes(lineNum);
            return (
              <div
                key={i}
                className={`flex ${isHighlighted ? 'bg-amber-400/10 -mx-4 px-4' : ''}`}
              >
                {data.showLineNumbers && (
                  <span className="text-slate-600 w-8 flex-shrink-0 text-right mr-4 select-none text-xs leading-6">
                    {lineNum}
                  </span>
                )}
                <span className="text-slate-200 leading-6 whitespace-pre">{line}</span>
              </div>
            );
          })}
        </code>
      </pre>
      {data.language && (
        <div className="absolute top-2 right-3 text-[10px] text-slate-600 uppercase tracking-wider font-mono">
          {data.language}
        </div>
      )}
    </div>
  );
};
