/**
 * equation-builder's boss (`components/live-activity/boss.ts`), bespoke because the build and typed modes are not one
 * tap: the card is `equationBuilder.card.ts`; this file validates a lesson, lists its challenges, asks one, carries the
 * lever set and plays the harness.
 */
import type { EquationBuilderChallenge, EquationBuilderData } from './EquationBuilder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { equationBuilderHarnessInputs, evaluateEquation, matchesAcceptedForm, parseEquationTokens, referenceWays }
  from './equationBuilderWorkspace';
import { EQUATION_BUILDER_LEVERS, practiceItem, practiceParent } from './equationBuilderLevers';
import { equationBuilderCard, type EquationBuilderMiss } from './equationBuilder.card';

/** Whether the pool holds every token of an equation, counting repeats. */
const buildable = (form: string, tiles: string[]) => {
  const pool = [...tiles];
  return parseEquationTokens(form).every(t => { const i = pool.indexOf(t); if (i < 0) return false; pool.splice(i, 1); return true; });
};

/** Reject a challenge the builder cannot check: its answer must be reachable with the controls it draws. */
export const validateEquationBuilderData = (value: unknown): EquationBuilderData => validateChallengePool<EquationBuilderData>(value,
  c => {
    if (!c || typeof c.instruction !== 'string' || !c.instruction) return false;
    switch (c.type) {
      case 'build': return typeof c.targetEquation === 'string' && evaluateEquation(c.targetEquation)
        && Array.isArray(c.availableTiles) && buildable(c.targetEquation, c.availableTiles);
      case 'rewrite': return typeof c.originalEquation === 'string' && Array.isArray(c.acceptedForms)
        && Array.isArray(c.availableTiles) && c.acceptedForms.some(f => buildable(f, c.availableTiles!)
          && !matchesAcceptedForm(parseEquationTokens(c.originalEquation!), [f]));
      case 'missing-value': return typeof c.equation === 'string' && typeof c.correctValue === 'number'
        && Array.isArray(c.options) && c.options.includes(c.correctValue);
      case 'true-false': return typeof c.displayEquation === 'string' && typeof c.isTrue === 'boolean';
      case 'balance': return typeof c.leftSide === 'string' && typeof c.rightSide === 'string'
        && c.rightSide.includes('?') && typeof c.correctAnswer === 'number';
      // Open build: the bank must make the total with a sentence, and a second, different one when asked.
      case 'make-n': return typeof c.target === 'number' && Array.isArray(c.availableTiles) && referenceWays(c) !== null;
      default: return false;
    }
  },
  { pool: 'Generated equation builder has invalid lesson content.', item: 'An equation-builder challenge cannot be checked.' });

export const equationBuilderBoss = defineBoss<EquationBuilderData, EquationBuilderChallenge, EquationBuilderMiss>({
  card: equationBuilderCard,
  validate: validateEquationBuilderData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A gesture the builder checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: EQUATION_BUILDER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/EquationBuilder.tsx',
    instanceId: 'equations',
    defaults: { grade: 'Grade 1', mode: 'true-false', topic: 'The equal sign: true and false equations within 10' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~smaller`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as EquationBuilderData).challenges ?? [];
      const parent = practiceParent(String(ctx.itemId ?? ''), all);
      return parent ? practiceItem(parent) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // Every mode through its real controls: tiles pressed into the row, a number or True/False tapped, or the number
    // typed, then Check (make-n: "I'm done!"). A wrong answer leaves the last tile off, picks another number or the other
    // truth value, types one more, or puts the total down alone.
    play: (right, c) => equationBuilderHarnessInputs(c, !right),
  },
});
