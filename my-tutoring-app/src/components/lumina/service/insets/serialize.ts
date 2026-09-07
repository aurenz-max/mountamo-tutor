/**
 * `serializeInsetForPrompt` — flatten an Inset into compact plain text so a
 * downstream LLM (the Live tutor, a judge, a transcriber) sees the same
 * "problem context" the student does. The tutor is BLIND to the screen; this
 * line is how it can SAY the stimulus. Every inset type needs a line here —
 * a type without one is a stimulus the tutor cannot describe.
 */

import type { Inset, NumberSentenceInset, ArrangementInset, GlyphCardInset } from '../../types';

const spokenToken = (text: string, kind: 'number' | 'operator' | 'blank'): string => {
  if (kind === 'blank') return 'blank';
  switch (text) {
    case '−': case '-': return 'minus';
    case '+': return 'plus';
    case '=': return 'equals';
    case '<': return 'less than';
    case '>': return 'greater than';
    case '×': return 'times';
    case '÷': return 'divided by';
    default: return text;
  }
};

/** "3 minus 1 equals blank" — the sentence as the tutor would read it. */
export const spokenNumberSentence = (inset: NumberSentenceInset): string =>
  inset.tokens.map((t) => spokenToken(t.text, t.kind)).join(' ');

/** "five apples in a row, two crossed out (taken away)". */
export const spokenArrangement = (inset: ArrangementInset): string => {
  const name = inset.objectName || 'objects';
  if (inset.layout === 'groups' && inset.groups && inset.groups.length >= 2) {
    return `${inset.groups.map((g) => `${g} ${name}`).join(' and ')}, put together as two groups`;
  }
  const layout = inset.layout === 'ten-frame' ? 'on a ten-frame'
    : inset.layout === 'array' ? 'in rows'
      : inset.layout === 'row' ? 'in a row'
        : inset.layout === 'before-after' ? 'in a group'
          : 'scattered';
  const removed = inset.removed && inset.removed > 0
    ? `, ${inset.removed} crossed out (taken away)`
    : '';
  return `${inset.count} ${name} ${layout}${removed}`;
};

export const spokenGlyphCard = (inset: GlyphCardInset): string => {
  switch (inset.glyphKind) {
    case 'numeral': return `a card showing the numeral ${inset.glyph}`;
    case 'letter': return `a card showing the letter ${inset.glyph}`;
    case 'word': return `a card showing the printed word "${inset.glyph}"`;
    case 'operator': return `a card showing the symbol ${inset.glyph}`;
    case 'shape': return inset.sides === 0
      ? 'a card showing a circle outline'
      : `a card showing a shape outline with ${inset.sides ?? '?'} straight sides`;
  }
};

export function serializeInsetForPrompt(inset: Inset): string {
  const labelPrefix = inset.label ? `[${inset.label}] ` : '';

  switch (inset.insetType) {
    case 'katex':
      return `${labelPrefix}Equation (KaTeX): ${inset.expression}${
        inset.caption ? `  — ${inset.caption}` : ''
      }`;

    case 'data-table': {
      const header = inset.headers.join(' | ');
      const rows = inset.rows.map((r) => r.join(' | ')).join('\n  ');
      return `${labelPrefix}Data table${inset.caption ? ` "${inset.caption}"` : ''}:
  ${header}
  ${rows}`;
    }

    case 'passage':
      return `${labelPrefix}${inset.format} passage${
        inset.attribution ? ` (${inset.attribution})` : ''
      }:
"${inset.text}"`;

    case 'chart': {
      const points = inset.data
        .map((d) => `${d.label}=${d.value}${d.group ? ` [${d.group}]` : ''}`)
        .join(', ');
      const axes =
        inset.xLabel || inset.yLabel
          ? ` (x=${inset.xLabel ?? '?'}, y=${inset.yLabel ?? '?'})`
          : '';
      return `${labelPrefix}${inset.chartType} chart "${inset.title}"${axes}: ${points}`;
    }

    case 'code':
      return `${labelPrefix}${inset.language} code:
\`\`\`
${inset.code}
\`\`\``;

    case 'image':
      return `${labelPrefix}image: ${inset.altText}${
        inset.caption ? ` — ${inset.caption}` : ''
      }`;

    case 'number-line': {
      const ticks = inset.ticks.join(', ');
      const points = inset.points
        ? ` Points: ${inset.points.map((p) => `${p.label}@${p.value}`).join(', ')}.`
        : '';
      const region = inset.region
        ? ` Region: ${inset.region.from}..${inset.region.to}${
            inset.region.label ? ` (${inset.region.label})` : ''
          }.`
        : '';
      return `${labelPrefix}Number line [${inset.min}, ${inset.max}], ticks {${ticks}}.${points}${region}`;
    }

    case 'definition-box':
      return `${labelPrefix}Definition — ${inset.term}${
        inset.partOfSpeech ? ` (${inset.partOfSpeech})` : ''
      }: ${inset.definition}${
        inset.exampleSentence ? `  Example: "${inset.exampleSentence}"` : ''
      }`;

    case 'equation-setup': {
      const givens = inset.quantities
        .filter((q) => q.knownValue !== undefined)
        .map((q) => `${q.symbol}=${q.knownValue}`)
        .join(', ');
      return `${labelPrefix}Modeling: "${inset.scenario}"; given ${givens || '(none)'}; find ${inset.target.symbol} (${inset.target.meaning}); canonical equation ${inset.canonicalEquation}`;
    }

    case 'number-sentence':
      return `${labelPrefix}Printed number sentence: ${inset.tokens.map((t) => t.text).join(' ')} (read: ${spokenNumberSentence(inset)})`;

    case 'arrangement':
      return `${labelPrefix}Picture: ${spokenArrangement(inset)}`;

    case 'glyph-card':
      return `${labelPrefix}${spokenGlyphCard(inset)}`;
  }
}
