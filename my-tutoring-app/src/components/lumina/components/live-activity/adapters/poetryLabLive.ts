import type { PoetryLabData } from '../../../primitives/visual-primitives/literacy/PoetryLab';
import { poetryItems, workspaceAssignment } from '../../../primitives/visual-primitives/literacy/poetryLabWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const text = (s: unknown) => typeof s === 'string' && !!s.trim();

/**
 * Reject a poetry lab whose items cannot be answered: rhyme rounds with four distinct cards holding the pair; an
 * analysis poem with at least one phase whose key is among its choices (a figurative phrase located in the poem);
 * a composition prompt with a line count (and an acrostic word as long as the poem).
 */
export function validatePoetryLabData(value: unknown): PoetryLabData {
  const d = value as PoetryLabData;
  if (!d || !text(d.title) || !['rhyme_hunt', 'analysis', 'composition'].includes(d.mode))
    throw new Error('Generated poetry lab has invalid lesson content.');
  if (d.mode === 'rhyme_hunt') {
    const rounds = d.rounds ?? [];
    if (!rounds.length || rounds.length > 12 || new Set(rounds.map(r => r?.id)).size !== rounds.length
        || rounds.some(r => !r || !text(r.id) || r.poemLines?.length !== 4 || r.candidates?.length !== 4
          || new Set(r.candidates.map(c => c.word.toLowerCase())).size !== 4
          || ![r.rhymeWordA, r.rhymeWordB].every(w => r.candidates.some(c => c.word.toLowerCase() === String(w).toLowerCase()))))
      throw new Error('A poetry-lab rhyme_hunt round cannot be answered as generated.');
    return d;
  }
  if (d.mode === 'analysis') {
    if (!d.poemLines?.length) throw new Error('A poetry-lab analysis has no poem.');
    if (d.moodOptions?.length && d.correctMood && !d.moodOptions.some(m => m.toLowerCase() === d.correctMood!.toLowerCase()))
      throw new Error('A poetry-lab analysis mood is not among its choices.');
    if (d.rhymeSchemeOptions?.length && d.rhymeScheme && !d.rhymeSchemeOptions.includes(d.rhymeScheme))
      throw new Error('A poetry-lab analysis rhyme scheme is not among its choices.');
    const poem = d.poem ?? d.poemLines.join('\n');
    if ((d.figurativeInstances ?? []).some(f => !(f.startIndex >= 0 && f.endIndex > f.startIndex && f.endIndex <= poem.length)))
      throw new Error('A poetry-lab figurative phrase is not located in the poem.');
  } else {
    const tc = d.templateConstraints;
    if (!text(d.compositionPrompt) || !tc || !(tc.lineCount >= 1)
        || (tc.acrosticWord && tc.acrosticWord.length !== tc.lineCount))
      throw new Error('A poetry-lab composition cannot be answered as generated.');
  }
  if (!poetryItems(d).length) throw new Error('A poetry-lab lesson has nothing to check.');
  return d;
}

/** What the live adapter needs from the poetry lab; the catalog's `teachingWorkspace` declares the rest. */
export const poetryLabLiveDomain: WorkspaceDomain<PoetryLabData> = {
  validate: validatePoetryLabData,
  initialState: d => {
    const items = poetryItems(d);
    return workspaceOpening({ title: d.title, task: workspaceAssignment(items[0], d).task, total: items.length });
  },
};
