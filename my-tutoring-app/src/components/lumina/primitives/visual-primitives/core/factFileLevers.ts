/**
 * fact-file's in-item levers (`/add-support-tiers`; report qa/eval-reports/fact-file-levers-2026-10-16.md). The misses
 * are what `factFileMiss` observes on a tapped choice; there is no real-learner evidence.
 *
 * - `point_to_section` (help, shown + voiced): a chip under the question names the section the question comes from
 *   ("This is in: 🏆 Records"); on a look-it-up item the tab itself is ringed as well. It names a section, never quotes
 *   it, so it puts no answer on screen. Not offered when the generator already shows the hint (easy tier) or the
 *   check has no section, or for a pre-reader (no file on screen).
 * - `drop_far_choice` (simplify, shown, on the item): greys out one wrong choice the learner has not tapped, preferring
 *   one the file does not state. Guard: at least two untried choices remain after the drop, so it never leaves the
 *   answer alone (fast-fact's and knowledge-check's lever; user ruling 09-27: removing a choice is assisted work).
 *
 * Reopening the closed file on a recall or apply item is not a lever: it turns remembering into looking up, which is
 * the explore mode, and it would put the key on screen.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { FactFileCheck } from './FactFile';
import { SECTION_ICON, SECTION_LABEL, isCheckCorrect, statedInFile, type FactFileMiss } from './factFileWorkspace';

export const SECTION_LEVER = 'point_to_section';
export const DROP_LEVER = 'drop_far_choice';

/** Per item: the levers pulled, the choices greyed out (indexes), and the choices tapped wrong. */
export interface FactFileLeverState {
  pulled: readonly string[];
  dropped: readonly number[];
  picked: readonly number[];
}
export const NO_LEVERS: FactFileLeverState = { pulled: [], dropped: [], picked: [] };

const ALL_MISSES = ['other_file_fact', 'not_in_file'] satisfies FactFileMiss[];

/** The wrong choice the drop greys out now, or null when fewer than two untried choices would remain. */
export function farChoice(check: FactFileCheck, s: FactFileLeverState, text: string): number | null {
  const live = check.options.map((_, i) => i).filter(i => !s.dropped.includes(i));
  const tried = new Set(s.picked.filter(i => live.includes(i))).size;
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(i => !isCheckCorrect(check, i) && !s.picked.includes(i));
  return foils.find(i => !statedInFile(check.options[i], text)) ?? foils.at(-1) ?? null;
}

/** Whether the section hint is on screen now: from the start (easy tier) or pulled. */
export const hintShown = (check: FactFileCheck, s: FactFileLeverState) => !!check.sectionHint || s.pulled.includes(SECTION_LEVER);

/** The levers this item declares, with their state. A lever that cannot be pulled now and was not pulled is left out. */
export function factFileLevers(check: FactFileCheck | null | undefined, s: FactFileLeverState, text: string,
  preReader = false): WorkspaceLever[] {
  if (!check) return [];
  const levers: WorkspaceLever[] = [];
  // A pre-reader sees no file and cannot read a section's name, so the note would change nothing for them.
  if (check.relatedSection && !check.sectionHint && !preReader) levers.push({ id: SECTION_LEVER, kind: 'help', carrier: 'both',
    pulled: s.pulled.includes(SECTION_LEVER), answers: ALL_MISSES,
    when: 'The learner taps a wrong choice, or does not know where in the fact file the question comes from.',
    does: check.fileOpen
      ? 'Shows a note under the question naming the section of the fact file the question comes from, and rings that tab. '
        + 'It names the section only and opens nothing; the learner opens it and finds the fact.'
      : 'Shows a note under the question naming the section of the fact file the question comes from, as a memory cue. '
        + 'The file stays closed; nothing in the section is shown.' });
  const dropPulled = s.pulled.includes(DROP_LEVER);
  if (dropPulled || farChoice(check, s, text) !== null) levers.push({ id: DROP_LEVER, kind: 'simplify', carrier: 'shown',
    pulled: dropPulled, answers: ALL_MISSES,
    when: 'The learner still taps a wrong choice after help, or is stuck between too many choices.',
    does: 'Greys out one wrong choice the learner has not tapped, so fewer remain. The next answer counts as helped.' });
  return levers;
}

/** What the levers put on screen, for the tutor and JEV. Names a section or a greyed-out choice, never the key. */
export function leversOnScreen(check: FactFileCheck, s: FactFileLeverState): string | null {
  const parts: string[] = [];
  if (hintShown(check, s) && check.relatedSection) {
    const name = `${SECTION_ICON[check.relatedSection]} ${SECTION_LABEL[check.relatedSection]}`;
    parts.push(check.fileOpen
      ? `a note under the question says the question comes from the ${name} section, and that tab is ringed`
      : `a note under the question says the question comes from the ${name} section; the file stays closed`);
  }
  for (const i of s.dropped) {
    if (check.options[i] !== undefined) parts.push(`choice ${i + 1}, "${check.options[i]}", is greyed out and is not the answer`);
  }
  return parts.length ? parts.join('; ') : null;
}
