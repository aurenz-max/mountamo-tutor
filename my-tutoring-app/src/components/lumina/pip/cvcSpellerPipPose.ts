import type { PipPose } from './PipSurfaceStore';
import { pipPhasePose } from './pipPhasePose';
import type { CvcTask } from '../primitives/visual-primitives/literacy/cvcSpellerScript';

export interface CvcSpellerPipInput {
  running: boolean;
  preparing: boolean;
  /** The pack's stage word. `affirmed` outlives the praise: it stays set on the next item. */
  stage: 'idle' | 'asking' | 'judging' | 'affirmed' | 'done';
  task: CvcTask;
  /** The tutor's audio is playing and belongs to this instance. */
  tutorSpeaking: boolean;
  /** The loop's most recently SENT cue is about the item now on screen. */
  cueOnItem: boolean;
  /** Rendered targets: `gap` (fill-vowel), `picture` (word-sort, spell-word when
   *  the tier shows it), `boxes` and `box-<n>` (spell-word). */
  visibleIds: string[];
  /** spell-word: the box the child's last letter went into or cleared. */
  lastTouchedId?: string;
}

/** Where the child works, per mode — never what goes there:
 *  - fill-vowel: the "?" box, which the screen already marks as the gap.
 *  - word-sort: the word's picture. Never a vowel column, which is built from
 *    earlier answers and would say where this word goes; with the picture
 *    withdrawn there is nothing to point at.
 *  - spell-word: the row of boxes as a whole, never a bank letter. Pip watches
 *    the box the child just filled or cleared and receives the finished build
 *    while it is judged.
 * The next item opens on the affirming verdict, so the praise is held as the
 * confirmed result until that item's cue is sent.
 */
export function cvcSpellerPipPose(input: CvcSpellerPipInput): PipPose {
  const cueId = input.task === 'fill-vowel' ? 'gap' : input.task === 'word-sort' ? 'picture' : 'boxes';
  const spelling = input.task === 'spell-word';
  return pipPhasePose({
    running: input.running,
    preparing: input.preparing,
    currentSolved: false,
    revealHeld: input.stage === 'affirmed' && !input.cueOnItem,
    judging: input.stage === 'judging',
    tutorSpeaking: input.tutorSpeaking,
    cueMatchesItem: input.cueOnItem,
  }, {
    visibleIds: input.visibleIds,
    cueId,
    attendId: spelling ? input.lastTouchedId ?? cueId : cueId,
    handover: spelling,
  });
}
