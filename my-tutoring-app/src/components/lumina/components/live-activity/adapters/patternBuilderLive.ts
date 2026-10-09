import type { PatternBuilderChallenge, PatternBuilderData } from '../../../primitives/visual-primitives/math/PatternBuilder';
import { CREATE_SHAPES, activeSequence, paletteFor, patternBuilderAssignment, tokensNeeded, translationOf }
  from '../../../primitives/visual-primitives/math/patternBuilderWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(t => typeof t === 'string');
const inPalette = (palette: string[], row: string[]) => row.every(t => palette.some(p => p.toLowerCase() === t.toLowerCase()));

/** Reject a challenge the builder cannot check: its answer must be reachable with the tokens it draws. */
export const validatePatternBuilderData = (value: unknown): PatternBuilderData => {
  const data = value as PatternBuilderData;
  return validateChallengePool<PatternBuilderData>(value, (c: PatternBuilderChallenge) => {
    if (!c || typeof c.instruction !== 'string' || !c.instruction || !data?.sequence || !data.tokens) return false;
    const seq = activeSequence(data, c);
    if (!seq || !strings(seq.given) || !strings(seq.hidden) || !strings(seq.core)) return false;
    const palette = paletteFor(data, c);
    if (!strings(palette)) return false;
    switch (c.type) {
      case 'extend':
      case 'find_rule': return seq.given.length > 0 && seq.hidden.length > 0 && inPalette(palette, seq.hidden);
      case 'identify_core': return seq.core.length > 0 && seq.given.some((_, i) => seq.core.every((t, k) =>
        seq.given[i + k]?.toLowerCase() === t.toLowerCase()));
      case 'translate': { const row = translationOf(data, c); return !!row && row.length > 0 && inPalette(palette, row); }
      // An asked shape must be a known one and the palette must hold enough different tokens to make it.
      case 'create': return (!c.createShape || (CREATE_SHAPES as readonly string[]).includes(c.createShape))
        && new Set(palette.map(t => t.toLowerCase())).size >= Math.max(2, c.createShape ? tokensNeeded(c.createShape) : 2);
      default: return false;
    }
  }, { pool: 'Generated pattern builder has invalid lesson content.', item: 'A pattern-builder challenge cannot be checked.' });
};

/** What the live adapter needs from the pattern builder; the catalog's `teachingWorkspace` declares the rest. */
export const patternBuilderLiveDomain: WorkspaceDomain<PatternBuilderData> = {
  validate: validatePatternBuilderData,
  initialState: data => workspaceOpening({ title: data.title, task: patternBuilderAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
