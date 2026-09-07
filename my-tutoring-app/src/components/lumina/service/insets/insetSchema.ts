/**
 * Inset schema + author guidance — the ONE shared copy (KC redesign P0,
 * 2026-09-05; closes qa/di/BACKLOG.md item 17 P1 debt).
 *
 * Two copies used to exist: `service/knowledge-check/gemini-knowledge-check.ts`
 * (`getInsetSchema` / `buildInsetPrompt`) and
 * `service/annotated-example/inset-helpers.ts` (`getInsetGeminiSchema` /
 * `buildInsetPromptGuidance`). Both picked ONE inset type up front so the
 * schema stayed monomorphic (the simplify-the-schema rule). This module is
 * that implementation, once; both consumers import it and a third
 * (di-spoken-practice, item 17) can too.
 *
 * The three K-first STIMULUS insets (`number-sentence`, `arrangement`,
 * `glyph-card`) carry schemas here for completeness, but the knowledge-check
 * pilot never asks a model to author them — code builds them from a small
 * scope (`./build.ts`) so the answer is never rendered on the stimulus.
 */

import { Type, Schema } from '@google/genai';
import type { InsetType } from '../../types';

/** Inset variants a model may be asked to author. Excludes `image` (no base64
 *  generation hop in any pipeline). */
export type AuthorableInsetType = Exclude<InsetType, 'image'>;

const AUTHORABLE: ReadonlySet<string> = new Set<AuthorableInsetType>([
  'katex', 'data-table', 'passage', 'chart', 'code', 'number-line',
  'definition-box', 'equation-setup', 'number-sentence', 'arrangement', 'glyph-card',
]);

export function isAuthorableInsetType(t: string | undefined): t is AuthorableInsetType {
  return !!t && AUTHORABLE.has(t);
}

// ── Gemini schema per variant ────────────────────────────────────────

export function getInsetGeminiSchema(insetType: AuthorableInsetType): Schema {
  const baseProps: Record<string, Schema> = {
    insetType: { type: Type.STRING, description: `Must be "${insetType}"` },
    label: {
      type: Type.STRING,
      description: 'Short display label, e.g. "Figure 1", "Table A", "Equation".',
    },
  };

  switch (insetType) {
    case 'katex':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          expression: {
            type: Type.STRING,
            description:
              'LaTeX source string (e.g. "\\\\frac{d}{dx}[x^3]"). Do NOT wrap in $ or $$.',
          },
          displayMode: {
            type: Type.STRING,
            enum: ['display', 'inline'],
            description: '"display" for centered block, "inline" for flow.',
          },
          caption: { type: Type.STRING, description: 'Optional caption below the expression.' },
        },
        required: ['insetType', 'expression', 'displayMode'],
      };

    case 'data-table':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          headers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Column headers.',
          },
          rows: {
            type: Type.ARRAY,
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: '2D array of cell values.',
          },
          caption: { type: Type.STRING, description: 'Optional table caption.' },
        },
        required: ['insetType', 'headers', 'rows'],
      };

    case 'passage':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          text: { type: Type.STRING, description: 'Passage text. Use \\n for line breaks.' },
          format: {
            type: Type.STRING,
            enum: ['prose', 'poem', 'quote', 'letter', 'source'],
            description: 'Typography style.',
          },
          attribution: { type: Type.STRING, description: 'Author/source attribution.' },
        },
        required: ['insetType', 'text', 'format'],
      };

    case 'chart':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie'] },
          title: { type: Type.STRING, description: 'Chart title.' },
          xLabel: { type: Type.STRING },
          yLabel: { type: Type.STRING },
          data: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.NUMBER },
              },
              required: ['label', 'value'],
            },
            description: '3-8 data points.',
          },
        },
        required: ['insetType', 'chartType', 'title', 'data'],
      };

    case 'code':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          code: { type: Type.STRING, description: 'Source code content.' },
          language: { type: Type.STRING, description: 'e.g. python, javascript, java.' },
        },
        required: ['insetType', 'code', 'language'],
      };

    case 'number-line':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          min: { type: Type.NUMBER },
          max: { type: Type.NUMBER },
          ticks: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          points: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.NUMBER },
                label: { type: Type.STRING },
              },
              required: ['value', 'label'],
            },
            description: 'Named points on the line.',
          },
        },
        required: ['insetType', 'min', 'max', 'ticks'],
      };

    case 'definition-box':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          term: { type: Type.STRING },
          definition: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          exampleSentence: { type: Type.STRING },
        },
        required: ['insetType', 'term', 'definition'],
      };

    case 'equation-setup':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          scenario: { type: Type.STRING, description: 'One-sentence plain-English re-statement of what is being modeled.' },
          quantities: {
            type: Type.ARRAY,
            description: '2-5 labeled quantities the equation involves. Include the unknown plus at least one given.',
            items: {
              type: Type.OBJECT,
              properties: {
                symbol: { type: Type.STRING, description: 'KaTeX symbol (e.g. "C", "t").' },
                meaning: { type: Type.STRING, description: 'Plain-language meaning (e.g. "total cost in dollars").' },
                knownValue: { type: Type.STRING, description: 'KaTeX known value if given. Omit for unknowns.' },
              },
              required: ['symbol', 'meaning'],
            },
          },
          target: {
            type: Type.OBJECT,
            description: 'The unknown the student is solving for.',
            properties: {
              symbol: { type: Type.STRING },
              meaning: { type: Type.STRING },
            },
            required: ['symbol', 'meaning'],
          },
          canonicalEquation: { type: Type.STRING, description: 'KaTeX of the equation/inequality/system that captures the relationship. The student must produce this (or an equivalent form).' },
          acceptableForms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Algebraically equivalent rearrangements that should also count as correct. May be empty.',
          },
          distractorEquations: {
            type: Type.ARRAY,
            description: '2-3 misconception-driven wrong equations. Each models a REAL student error.',
            items: {
              type: Type.OBJECT,
              properties: {
                equation: { type: Type.STRING, description: 'KaTeX of the wrong equation.' },
                misconception: { type: Type.STRING, description: 'One-sentence description of the error this distractor models.' },
              },
              required: ['equation', 'misconception'],
            },
          },
          rationale: { type: Type.STRING, description: 'One sentence explaining WHY the canonical equation is the right model. Reference the relationship, not the algebra.' },
        },
        required: ['insetType', 'scenario', 'quantities', 'target', 'canonicalEquation', 'distractorEquations', 'rationale'],
      };

    // ── K-first stimulus insets. Flat, bounded, no nested arrays of objects
    //    beyond one level (flash-lite drops nested arrays under an emoji ask).
    case 'number-sentence':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          tokens: {
            type: Type.ARRAY,
            description: 'The printed sentence as tokens in reading order, e.g. ["3","−","1","=","2"]. Use "□" for a blank.',
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: 't1, t2, …' },
                text: { type: Type.STRING },
                kind: { type: Type.STRING, enum: ['number', 'operator', 'blank'] },
              },
              required: ['id', 'text', 'kind'],
            },
          },
        },
        required: ['insetType', 'tokens'],
      };

    case 'arrangement':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          emoji: { type: Type.STRING, description: 'ONE emoji, repeated `count` times.' },
          count: { type: Type.NUMBER, description: 'Objects drawn in total, 1-10.' },
          layout: { type: Type.STRING, enum: ['scattered', 'row', 'ten-frame', 'array', 'before-after'] },
          removed: { type: Type.NUMBER, description: 'Objects drawn crossed out (taken away), 0 ≤ removed < count.' },
          objectName: { type: Type.STRING, description: 'Plural object name for the spoken description ("apples").' },
        },
        required: ['insetType', 'emoji', 'count', 'layout'],
      };

    case 'glyph-card':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          glyphKind: { type: Type.STRING, enum: ['numeral', 'letter', 'word', 'operator', 'shape'] },
          glyph: { type: Type.STRING, description: 'The printed text. Empty for a shape.' },
          sides: { type: Type.NUMBER, description: 'Shape only: 0 for a circle, else 3-8.' },
        },
        required: ['insetType', 'glyphKind', 'glyph'],
      };
  }
}

/** Backward-compatible optional form used by the knowledge-check generators:
 *  `undefined`/`image`/unknown → null, so callers can keep `if (!schema)`. */
export function getInsetSchema(insetType?: InsetType | null): Schema | null {
  if (!insetType || !isAuthorableInsetType(insetType)) return null;
  return getInsetGeminiSchema(insetType);
}

// ── Author-prompt guidance per variant ───────────────────────────────

const INSET_GUIDANCE: Record<AuthorableInsetType, string> = {
  katex: `
## INSET: Mathematical Expression (KaTeX)
Author a LaTeX expression that the question depends on. The student must read or interpret the expression to solve. Use proper notation (\\frac, \\sqrt, ^{}, _{}, \\int, \\sum, Greek letters). The expression must be non-trivial — not just "x + 2".`,

  'data-table': `
## INSET: Data Table
Author a realistic data table (3-6 columns, 3-8 rows). The problem MUST require reading specific cells to solve — e.g. "from the table, find the row where X meets condition Y, then compute Z". Headers should be meaningful and the data should support a single unambiguous answer. Distractors should be plausible misreadings (wrong row, adjacent column).`,

  passage: `
## INSET: Text Passage
Author a passage (2-4 paragraphs prose / 8-16 lines poetry / 1-3 paragraphs quote). The question MUST require comprehending the passage. Include attribution when appropriate. Use \\n for poetry line breaks.`,

  chart: `
## INSET: Chart Data
Author 3-8 data points for a bar/line/pie chart. The question MUST require interpreting the chart (compare bars, read a trend, compute a fraction-of-pie). Title and axis labels should be specific. Data should produce a clear pattern, not noise.`,

  code: `
## INSET: Code Block
Author a 5-20 line code snippet. The question MUST require tracing or understanding the code. Use realistic identifiers and proper indentation. For "find the bug" framings include exactly one subtle, realistic bug.`,

  'number-line': `
## INSET: Number Line
Author a number line with grade-appropriate range, tick marks, and labeled points. The question MUST require interpreting positions, distances, or intervals on the line. Match grade level (integers for elementary, fractions/decimals for middle school, signed reals for high school).`,

  'definition-box': `
## INSET: Definition Box
Author one vocabulary term with definition, part of speech, and example sentence. The question MUST require understanding the definition — not just recognizing the word.`,

  'equation-setup': `
## INSET: Equation Setup (interactive modeling gate)
Use ONLY for word problems where the lesson is **translating prose into an equation**. The inset asks the student to commit to the equation BEFORE the algebra reveals.

Author:
- **scenario**: a one-sentence plain-English re-statement of what's being modeled (anchors the student in the relationship).
- **quantities**: 2-5 labeled quantities. Each has a KaTeX symbol, plain-language meaning, and a known value if the problem supplies one. Include at minimum the unknown plus one given.
- **target**: the unknown the student is solving for (symbol + meaning).
- **canonicalEquation**: the equation/inequality/system the student must produce (KaTeX).
- **acceptableForms**: 0-3 algebraically equivalent rearrangements ("100 = 5t + 20" ≡ "5t + 20 = 100"). Skip if the canonical form is the only natural way to write it.
- **distractorEquations**: 2-3 misconception-driven wrong equations. Each pairs a wrong equation with a one-sentence description of the error. Use real student errors:
  - swapped operands ("5t = 100 + 20")
  - sign flip on the constant ("100 = 5t - 20")
  - dropped coefficient ("100 = t + 20")
  - swapped target with given ("t = 5·100 + 20")
  - off-by-one constant ("100 = 5t + 25")
  Random or implausible alternatives are useless.
- **rationale**: one sentence on why the canonical equation is the right model. Reference the relationship between quantities, NOT the algebra.

NEVER use this inset when the problem statement already contains the equation ("Solve $2x + 3 = 7$") — the modeling work is already done. Reserve for genuine word problems.
NEVER attach a katex inset alongside this — equation-setup IS the modeling display.`,

  'number-sentence': `
## INSET: Number Sentence (stimulus only)
Author a printed number sentence as tokens in reading order (e.g. 3, −, 1, =, 2). The student is asked to POINT at one token or SAY a missing result. Never put the answer token's text in the question; use "□" only where the student supplies the result.`,

  arrangement: `
## INSET: Arrangement (stimulus only)
Author a set of identical emoji objects (1-10) in a layout. Crossed-out objects show a take-away. The student COUNTS or COMPARES what is shown. No digits anywhere; the question never states the count.`,

  'glyph-card': `
## INSET: Glyph Card (stimulus only)
Author ONE large printed symbol — a numeral, a letter, a short decodable word, an operator, or a shape by side count. The student SAYS its name, sound, or value. The name never appears in the question.`,
};

export function buildInsetPromptGuidance(insetType: AuthorableInsetType): string {
  return (
    INSET_GUIDANCE[insetType] +
    `

CRITICAL: The inset and the problem statement are ONE coherent unit.
- The problem must be UNANSWERABLE without reading the inset.
- The inset must contain exactly the data the problem references — no extra red herrings, no missing values.
- Generate them together; do not author the problem first and bolt an inset on.`
  );
}

/** Backward-compatible optional form used by the knowledge-check generators:
 *  `undefined`/`image`/unknown → '' so callers can interpolate unconditionally. */
export function buildInsetPrompt(insetType?: InsetType | null): string {
  if (!insetType || !isAuthorableInsetType(insetType)) return '';
  return buildInsetPromptGuidance(insetType);
}
