'use client';

import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { KatexInset } from '../../../types';

interface KatexInsetRendererProps {
  data: KatexInset;
}

export const KatexInsetRenderer: React.FC<KatexInsetRendererProps> = ({ data }) => {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(data.expression, {
        displayMode: data.displayMode === 'display',
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span class="text-red-400">Invalid expression</span>`;
    }
  }, [data.expression, data.displayMode]);

  return (
    <div className={data.displayMode === 'display' ? 'text-center' : ''}>
      <div
        className="text-slate-100 text-lg"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {data.caption && (
        <p className="text-xs text-slate-500 mt-2 text-center font-mono">
          {data.caption}
        </p>
      )}
    </div>
  );
};

/**
 * Render a single KaTeX string inline (for MC option text).
 * Returns raw HTML string for dangerouslySetInnerHTML.
 */
export function renderKatexString(expression: string): string {
  try {
    return katex.renderToString(expression, {
      displayMode: false,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return expression;
  }
}
