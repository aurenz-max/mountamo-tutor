/**
 * pattern-builder's boss (`components/live-activity/boss.ts`), bespoke because every mode is a row built or tapped and
 * then checked by the builder: the card is `patternBuilder.card.ts`; this file validates a lesson, lists its
 * challenges, asks one, carries the lever set and plays the harness.
 */
import type { PatternBuilderChallenge, PatternBuilderData } from './PatternBuilder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import {
  CREATE_SHAPES, activeSequence, paletteFor, patternBuilderHarnessInputs, tokensNeeded, translationOf,
} from './patternBuilderWorkspace';
import { PATTERN_LEVERS, practiceItem, practiceParent } from './patternBuilderLevers';
import { patternBuilderCard, type PatternBuilderMiss } from './patternBuilder.card';

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

export const patternBuilderBoss = defineBoss<PatternBuilderData, PatternBuilderChallenge, PatternBuilderMiss>({
  card: patternBuilderCard,
  validate: validatePatternBuilderData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A gesture the builder checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: PATTERN_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/PatternBuilder.tsx',
    instanceId: 'patterns',
    defaults: { grade: 'Kindergarten', mode: 'extend', topic: 'Extend AB and AAB color patterns' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice row a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as PatternBuilderData;
      const all = data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, all);
      return parent ? practiceItem(parent, data) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // Every mode through its real controls: palette tokens tapped into the blanks or the build row, or tokens of the
    // pattern row selected, then Check (create: "I'm done!"). An open-build create keeps its row through Try again, so
    // the driver starts over on a kept row.
    play: (right, c, ctx) => patternBuilderHarnessInputs(ctx.data as PatternBuilderData, c, !right,
      Number(ctx.demand?.tokensInRow ?? 0) > 0),
  },
});
