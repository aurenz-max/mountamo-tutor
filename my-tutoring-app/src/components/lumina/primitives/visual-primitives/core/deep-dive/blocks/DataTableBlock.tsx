'use client';

import React from 'react';
import type { DataTableBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import { LuminaTable, LuminaMathText } from '../../../../../ui';
import BlockChoiceCheck from './BlockChoiceCheck';
import { useTapTutor, TapHint } from './TapTutor';

interface DataTableBlockProps {
  data: DataTableBlockData;
  index: number;
  /** Called when the student answers the pattern check (only when patternCheck present) */
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  /** On the tutor workspace: every check reports here, the block never shows the answer itself, and the host owns Try again. */
  onAttempt?: (correct: boolean, work: string) => void;
  /** Whether the block has already been answered (from parent state) */
  answered?: boolean;
  /** Bridge to the DeepDive live tutor; tapping a row asks it to explain that row. */
  onAskTutor?: (message: string) => void;
}

const DataTableBlock: React.FC<DataTableBlockProps> = ({
  data,
  index,
  onAnswer,
  onAttempt,
  answered,
  onAskTutor,
}) => {
  const { enabled, activeKey, ask } = useTapTutor(onAskTutor);
  const patternCheck = data.patternCheck;
  const hasCheck = !!patternCheck && !!onAnswer;

  // ── Tap-to-explore rows ───────────────────────────────────────────
  const askAboutRow = (ri: number, row: string[]) => {
    const rowSummary = data.headers.map((h, ci) => `${h}: ${row[ci] ?? ''}`).join('; ');
    ask(
      `row-${ri}`,
      `[TABLE_EXPLORE] In the "${data.label || data.caption || 'data table'}" table, the student tapped the row "${row[0]}" (${rowSummary}). Explain what this row tells us in 1-2 friendly sentences and point out the most interesting comparison with another row. End with one quick question. Do not mention that they tapped${
        hasCheck ? ', and do NOT answer or hint at the comprehension question below the table' : ''
      }.`,
    );
  };

  // First-column cells become tap targets when the tutor bridge is wired —
  // LuminaTable cells take ReactNode, so the tap affordance rides inside the cell.
  const math = (cell: string, k: number) => <LuminaMathText key={k} text={cell} />;
  const rows: React.ReactNode[][] = enabled
    ? data.rows.map((row, ri) => [
        <button
          key={`tap-${ri}`}
          type="button"
          onClick={() => askAboutRow(ri, row)}
          className={`w-full text-left cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-white/10 underline decoration-dotted decoration-emerald-400/40 underline-offset-4 ${
            activeKey === `row-${ri}` ? 'bg-white/10' : ''
          }`}
        >
          <LuminaMathText text={row[0]} />
        </button>,
        ...row.slice(1).map((cell, k) => math(cell, k + 1)),
      ])
    : data.rows.map((row) => row.map(math));

  return (
    <BlockWrapper label={data.label} index={index} accent="emerald" variant="feature">
      <LuminaTable
        accent="emerald"
        caption={data.caption ? <LuminaMathText text={data.caption} /> : undefined}
        columns={data.headers.map(math)}
        rows={rows}
      />
      {enabled && <TapHint text="Tap a row name to hear what it means" />}

      {/* Find-the-pattern check — answering requires comparing rows above */}
      {hasCheck && patternCheck && (
        <BlockChoiceCheck
          check={patternCheck}
          blockId={data.id}
          onAnswer={onAnswer!}
          onAttempt={onAttempt}
          answered={answered}
          onAskTutor={onAskTutor}
          about={`the "${data.label || data.caption || 'data'}" table`}
          lookAt="WHICH rows of the table to compare"
        />
      )}
    </BlockWrapper>
  );
};

export default DataTableBlock;
