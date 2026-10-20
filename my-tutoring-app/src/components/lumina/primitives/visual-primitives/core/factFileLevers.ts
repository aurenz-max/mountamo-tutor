/**
 * fact-file's in-item levers, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/fact-file-levers-2026-10-16.md). The misses are what `factFileMiss` observes on a choice; there is no
 * real-learner evidence.
 *
 * - `point_to_section` (clue): a chip under the question names the section the question comes from
 *   ("This is in: 🏆 Records"); on a look-it-up item the tab itself is ringed as well. It names a section, never quotes
 *   it, so it puts no answer on screen. Not offered when the generator already shows the note (easy tier) or the
 *   check has no section, or for a pre-reader (no file on screen).
 * - `drop_far_choice` (custom, user ruling 09-27: a removed choice is assisted work): greys out one wrong choice the
 *   learner has not tried, preferring one the file does not state. Guard: at least two untried choices remain after
 *   the drop (a wrong try counts as one choice tried, spoken or tapped), so it never leaves the answer alone.
 *
 * Reopening the closed file on a recall or apply item is not a lever: it turns remembering into looking up, which is
 * the explore mode, and it would put the key on screen.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { FACT_FILE_MISSES } from './factFile.card';
import { SECTION_ICON, SECTION_LABEL, isCheckCorrect, keyOf, statedInFile, type FactFileItem } from './factFileWorkspace';
import type { FactFileCheck, FactFileSection } from './FactFile';

export const SECTION_LEVER = 'point_to_section';
export const DROP_LEVER = 'drop_far_choice';

/** Per item: the levers pulled, the choices greyed out (indexes), the choices tapped wrong, and the wrong tries in all
 *  (a spoken wrong answer counts here; which choice it named is not known). */
export interface FactFileLeverState {
  pulled: readonly string[];
  dropped: readonly number[];
  picked: readonly number[];
  wrongs?: number;
}
export const NO_LEVERS: FactFileLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

/** The wrong choice the drop greys out now, or null when fewer than two untried choices would remain. */
export function farChoice(check: FactFileCheck, s: FactFileLeverState, text: string): number | null {
  const live = check.options.map((_, i) => i).filter(i => !s.dropped.includes(i));
  const tried = Math.max(s.wrongs ?? 0, new Set(s.picked.filter(i => live.includes(i))).size);
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(i => !isCheckCorrect(check, i) && !s.picked.includes(i));
  return foils.find(i => !statedInFile(check.options[i], text)) ?? foils.at(-1) ?? null;
}

/** Whether the section note is on screen now: from the start (easy tier) or pulled. */
export const hintShown = (check: FactFileCheck, s: FactFileLeverState) => !!check.sectionHint || s.pulled.includes(SECTION_LEVER);

/** The lesson's lever state for the item on screen, and whether the screen is the pre-reader's (no file). */
export interface FactFileLeverContext { state: FactFileLeverState; preReader: boolean }

const sectionName = (section: FactFileSection) => `${SECTION_ICON[section]} ${SECTION_LABEL[section]}`;

export const FACT_FILE_LEVERS = leverSet<FactFileItem, FactFileLeverContext>({
  missesOf: () => FACT_FILE_MISSES,
  answersOf: item => [keyOf(item)],
  specs: [
    { id: SECTION_LEVER, type: 'clue', answers: 'all',
      when: 'The learner gives a wrong choice, or does not know where in the fact file the question comes from.',
      does: item => (item.fileOpen
        ? 'Shows a note under the question naming the section of the fact file the question comes from, and rings that tab. '
          + 'It names the section only and opens nothing; the learner opens it and finds the fact.'
        : 'Shows a note under the question naming the section of the fact file the question comes from, as a memory cue. '
          + 'The file stays closed; nothing in the section is shown.'),
      // A pre-reader sees no file and cannot read a section's name; the easy tier shows the note from the start.
      content: (item, { preReader }) => (item.relatedSection && !item.sectionHint && !preReader ? item.relatedSection : null),
      fact: (section: FactFileSection, item) => (item.fileOpen
        ? `a note under the question says the question comes from the ${sectionName(section)} section, and that tab is ringed`
        : `a note under the question says the question comes from the ${sectionName(section)} section; the file stays closed`) },
    { id: DROP_LEVER, type: 'custom', carrier: 'shown', answers: 'all',
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'The learner still gives a wrong choice after help, or is stuck between too many choices.',
      does: 'Greys out one wrong choice the learner has not tried, so fewer remain. The next answer counts as helped.',
      // Offered while one more can be greyed out; once pulled, its fact names every greyed-out choice.
      content: (item, { state }) => (state.pulled.includes(DROP_LEVER) || farChoice(item, state, item.fileText) !== null
        ? state.dropped : null),
      fact: (dropped: readonly number[], item) => dropped.filter(i => item.options[i] !== undefined)
        .map(i => `choice ${i + 1}, "${item.options[i]}", is greyed out and is not the answer`).join('; ') },
  ],
});
