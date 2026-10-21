/**
 * letter-workshop's boss (`components/live-activity/boss.ts`), bespoke because every mode is a letter written on the
 * writing paper, which the paper checks itself: the card is `letterWorkshop.card.ts`; this file validates a lesson,
 * lists its items, asks one, carries the lever set and plays the harness.
 */
import type { LetterWorkshopChallenge, LetterWorkshopData } from './LetterWorkshop';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { getLetterTemplate } from './letterWorkshopGeometry';
import { isLetterWorkshopMode } from './letterWorkshopModes';
import { letterTask, letterWorkshopHarnessStrokes } from './letterWorkshopWorkspace';
import { LETTER_WORKSHOP_LEVERS, practiceItem, practiceParent } from './letterWorkshopLevers';
import { letterWorkshopCard, type LetterWorkshopMiss } from './letterWorkshop.card';

/** A challenge the paper can check: a known mode and a code-owned letter template. */
function answerable(c: LetterWorkshopChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !isLetterWorkshopMode(c.type)) return false;
  try { return !!getLetterTemplate(c.templateId); } catch { return false; }
}

/** Reject a letter lesson whose challenges the paper cannot check. */
export const validateLetterWorkshopData = (value: unknown) => validateChallengePool<LetterWorkshopData>(value, answerable, {
  pool: 'Generated letter workshop has invalid lesson content.',
  item: 'A letter-workshop challenge has no letter the paper can check.' });

export const letterWorkshopBoss = defineBoss<LetterWorkshopData, LetterWorkshopChallenge, LetterWorkshopMiss>({
  card: letterWorkshopCard,
  validate: validateLetterWorkshopData,
  items: d => d.challenges,
  // Trace and copy name the letter the screen shows; write names it by its said NAME, which is the task.
  ask: c => letterTask(c),
  // Writing the paper checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, letterTask(c), null),
  levers: LETTER_WORKSHOP_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/literacy/LetterWorkshop.tsx',
    instanceId: 'letters',
    defaults: { grade: 'Kindergarten', mode: 'trace', topic: 'Writing lowercase letters' },
    mounted: '[data-pip-object="paper"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = ((ctx.data as LetterWorkshopData).challenges ?? []) as LetterWorkshopChallenge[];
      const parent = practiceParent(all, String(ctx.itemId ?? ''));
      return parent ? practiceItem(parent, all) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // Every mode on the writing paper with pointer strokes: the right answer is the letter's own model strokes, which
    // every mode's check accepts; the wrong one draws each stroke backwards (`start_or_order`), which geometry fails
    // and the vision judge (no 2D canvas in the driver) never overrides.
    play: (right, c) => [{ type: 'draw', target: 'paper', strokes: letterWorkshopHarnessStrokes(c, !right) },
      { type: 'choose', label: c.type === 'trace' ? 'Check my tracing' : 'Check my writing' }],
  },
});
