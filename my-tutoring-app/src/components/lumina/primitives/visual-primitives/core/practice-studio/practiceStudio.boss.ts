/**
 * practice-studio's boss on the spoken preset (2026-11-13; the tap preset before): a tap item is answered on screen and
 * the activity's own check judges it (`gradeAnswer` in `service/agent-kit/surfaces.ts`), so it carries no key and the
 * harness plays its taps; a `teach` item is answered out loud and carries the meaning key code derives from it
 * (`teachSurface.ts`), which the tutor judges by. This file validates a lesson (every item, and every lever item,
 * re-checked from its stored structure), asks one item, and plays the harness from the item's key.
 */
import { authoredLeverSet } from '../../../../service/agent-kit/levers';
import { hasText, spokenBoss } from '../../../../components/live-activity/boss';
import type { DriverInput } from '../../../../components/live-activity/liveJourneySpec';
import { SURFACE_MISSES, inAnswerOrder, itemErrors, rightAnswer, surfaceTaps, wrongAnswer, type SurfaceAnswer, type SurfaceItem } from '../../../../service/agent-kit/surfaces';
import { teachMisses, teachSay, teachSpokenKey } from '../../../../service/agent-kit/teachSurface';
import { practiceStudioCard } from './practiceStudio.card';
import type { PracticeStudioData } from './PracticeStudio';

/** Why a stored item cannot run, or null. */
export function studioItemError(c: SurfaceItem): string | null {
  if (!c || !hasText(c.id)) return 'it has no id';
  const errs = itemErrors(c);
  if (errs.length) return errs[0];
  if (inAnswerOrder(c)) return 'its cards are stored in the answer\'s own order';
  return null;
}

/** Reject a practice-studio lesson the workspace cannot run. */
export function validatePracticeStudioData(value: unknown): PracticeStudioData {
  const d = value as PracticeStudioData;
  if (!d || !hasText(d.title) || !Array.isArray(d.challenges) || d.challenges.length < 2 || d.challenges.length > 6)
    throw new Error('Generated practice studio session has invalid lesson content.');
  if (new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length) throw new Error('Practice studio items need distinct ids.');
  for (const c of d.challenges) {
    const error = studioItemError(c);
    if (error) throw new Error(`Practice studio item ${c?.id}: ${error}.`);
    for (const l of c.levers ?? []) {
      const le = studioItemError(l.item);
      if (le) throw new Error(`Practice studio item ${c.id} lever ${l.id}: ${le}.`);
    }
  }
  return d;
}

/** The taps that make an answer on the board, then Check. Targets are the component's `data-pip-object` names. */
export function studioTaps(item: SurfaceItem, a: SurfaceAnswer): DriverInput[] {
  return surfaceTaps(item, a, 'Check');
}

/** The item's own levers (authored with it, checked by the kit): one lever set for every agent primitive. */
export const practiceStudioLevers = authoredLeverSet<SurfaceItem>({
  modeOf: () => 'practice',
  missesOf: () => SURFACE_MISSES,
});

export const practiceStudioBoss = spokenBoss<PracticeStudioData, SurfaceItem, (typeof SURFACE_MISSES)[number]>({
  levers: practiceStudioLevers,
  card: practiceStudioCard,
  validate: validatePracticeStudioData,
  items: d => d.challenges,
  speech: {
    ask: c => c.prompt,
    // A tap item has no key (the activity judges it) and plays its taps; a teach item's key is the idea, as a meaning.
    key: c => (c.surface === 'teach' && c.teach ? teachSpokenKey(c.teach) : null),
    misses: c => (c.surface === 'teach' && c.teach ? teachMisses(c.teach) : []),
    say: c => (c.surface === 'teach' && c.teach ? teachSay(c.teach) : { correct: '', plainWrong: '' }),
    show: (right, item) => studioTaps(item, right ? rightAnswer(item) : wrongAnswer(item)),
  },
  drive: {
    component: 'primitives/visual-primitives/core/practice-studio/PracticeStudio.tsx',
    instanceId: 'practice-studio',
    defaults: { grade: 'Grade 2', mode: 'practice', topic: 'Bar graphs' },
    mounted: '[data-pip-object="workspace"]',
  },
});
