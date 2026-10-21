/**
 * matrix-display's boss (`components/live-activity/boss.ts`), bespoke because every mode is a typed grid or number the
 * activity checks: the card is `matrixDisplay.card.ts`; this file validates a lesson, lists its problems, asks one,
 * carries the lever set and plays the harness.
 */
import type { MatrixDisplayData } from './MatrixDisplay';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { SCALAR_LABEL, boxLabel, formatEntry, matrixHarnessInput } from './matrixDisplayWorkspace';
import { MATRIX_LEVERS, practiceParent, simplerMatrix } from './matrixDisplayLevers';
import { matrixDisplayCard, type MatrixMiss } from './matrixDisplay.card';

const TYPES = ['transpose', 'add', 'subtract', 'multiply', 'determinant', 'inverse'];
const isGrid = (m: unknown): m is number[][] => Array.isArray(m) && m.length > 0 && m.every(row => Array.isArray(row)
  && row.length === (m as unknown[][])[0].length && row.length > 0 && row.every(v => typeof v === 'number' && Number.isFinite(v)));

/** Reject a matrix lesson whose challenges cannot be attempted. */
export function validateMatrixDisplayData(value: unknown): MatrixDisplayData {
  const d = value as MatrixDisplayData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated matrix display has invalid lesson content.');
  // Each item needs what its own check reads: the matrix, the second matrix of a two-matrix operation, and either a
  // determinant (determinant) or a result grid (every other operation).
  for (const c of d.challenges) {
    const two = c.challengeType === 'add' || c.challengeType === 'subtract' || c.challengeType === 'multiply';
    const ok = isGrid(c.values) && (!two || isGrid(c.secondMatrix?.values))
      && (c.challengeType === 'determinant'
        ? typeof c.expectedScalar === 'number' && Number.isFinite(c.expectedScalar)
        : c.expectedScalar === undefined && isGrid(c.expectedMatrix));
    if (!ok) throw new Error(`A matrix-display ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

type Challenge = MatrixDisplayData['challenges'][number];

export const matrixDisplayBoss = defineBoss<MatrixDisplayData, Challenge, MatrixMiss>({
  card: matrixDisplayCard,
  validate: validateMatrixDisplayData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A typed grid or determinant the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: MATRIX_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/MatrixDisplay.tsx',
    instanceId: 'matrix',
    defaults: { grade: 'Grade 10', mode: 'transpose', topic: 'Matrix operations' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice problem a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as MatrixDisplayData).challenges ?? [];
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = all.find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? simplerMatrix(parent) ?? undefined : parent;
    },
    // A number typed into each answer box ("Answer row i, column j") or the determinant box, then Check. A wrong
    // answer is the item's signature miss from `matrixMiss` (reading order kept, the other operation, B·A, the products
    // added, the swap without the negation), else one box off.
    play: (right, c) => {
      const input = matrixHarnessInput(c, right ? 'correct' : 'wrong');
      if (input.kind === 'scalar') return [{ type: 'write', label: SCALAR_LABEL, text: input.text }, { type: 'check' }];
      return [...input.cells.flatMap((row, i) => row.map((text, j) => ({ type: 'write' as const, label: boxLabel(i, j), text }))),
        { type: 'check' }];
    },
    // The typed boxes name the answer in parts, most of them numbers the matrices already show. The key is the
    // determinant, or the result entries the screen does not show (a sum, a product, a sign changed).
    replayKeys: ctx => {
      const c = ctx.challenge as Challenge | undefined;
      if (!c) return [];
      // A determinant equal to one of the drawn entries ([[3, 5], [-1, -2]] is -1) cannot be told from reading the matrix.
      const shown = new Set([...(c.values ?? []).flat(), ...(c.secondMatrix?.values ?? []).flat()].map(formatEntry));
      if (typeof c.expectedScalar === 'number') return shown.has(formatEntry(c.expectedScalar)) ? [] : [formatEntry(c.expectedScalar)];
      return Array.from(new Set((c.expectedMatrix ?? []).flat().map(formatEntry)))
        .filter(k => !shown.has(k) && !['0', '1', '2', '3'].includes(k));
    },
  },
});
