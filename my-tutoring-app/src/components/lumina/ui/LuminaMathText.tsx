/**
 * LuminaMathText — model-written text with its math typeset.
 *
 * Any string a generator or agent writes may carry LaTeX between `$...$` (inline) or `$$...$$` (display); `\$` is a
 * literal dollar. Text segments render as React text (never as HTML), math through KaTeX. Text with no math renders
 * as the string itself, so wrapping every model string costs nothing. The convention, the code check and the spoken
 * form live in `utils/mathText.ts`.
 *
 *   <p><LuminaMathText text={paragraph} /></p>
 *   <LuminaMathText text={option} className="font-medium" />
 */
import * as React from 'react';
import 'katex/dist/katex.min.css';
import { renderTex, splitMath } from '../utils/mathText';

export interface LuminaMathTextProps {
  text: string | undefined | null;
  className?: string;
}

export const LuminaMathText: React.FC<LuminaMathTextProps> = ({ text, className }) => {
  const segments = React.useMemo(() => splitMath(text ?? ''), [text]);
  if (!segments.some((s) => s.kind === 'math')) return className ? <span className={className}>{text}</span> : <>{text}</>;
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.kind === 'text' ? (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        ) : (
          <span
            key={i}
            // normal-case: a heading's uppercase transform would turn $x$ into X.
            className={s.display ? 'block my-2 overflow-x-auto text-center normal-case' : 'inline-block max-w-full overflow-x-auto align-middle normal-case'}
            dangerouslySetInnerHTML={{ __html: renderTex(s.tex, s.display) }}
          />
        ),
      )}
    </span>
  );
};
