import type { ContextCluesDetectiveData } from '../../../primitives/visual-primitives/literacy/ContextCluesDetective';
import { CLUE_TYPES, clueAsk, clueSteps } from '../../../primitives/visual-primitives/literacy/contextCluesWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Each word is three checked steps; four words is the generator's most. */
const MAX_WORDS = 4;

/** Reject a context-clues lesson whose steps cannot be answered as generated. */
export function validateContextCluesData(value: unknown): ContextCluesDetectiveData {
  const d = value as ContextCluesDetectiveData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > MAX_WORDS
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated context clues detective has invalid lesson content.');
  for (const c of d.challenges) {
    const ids = new Set((c?.passage?.sentences ?? []).map(s => s?.id));
    const ok = !!c && typeof c.id === 'string' && !!c.id && !c.id.includes(':')
      && ids.size >= 2 && ids.size === c.passage.sentences.length
      && c.passage.sentences.every(s => typeof s.text === 'string' && !!s.text.trim())
      && typeof c.targetWord === 'string' && !!c.targetWord.trim() && ids.has(c.targetWordSentenceId)
      && CLUE_TYPES.includes(c.clueType)
      // Find needs a clue sentence to tap; define needs its key among the options (or a typed key).
      && Array.isArray(c.clueSentenceIds) && c.clueSentenceIds.some(id => ids.has(id))
      && typeof c.correctMeaning === 'string' && !!c.correctMeaning.trim()
      && (!c.meaningOptions?.length || c.meaningOptions.includes(c.correctMeaning));
    if (!ok) throw new Error(`A context-clues word (${c?.id ?? '?'}) cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the context clues detective; the catalog's `teachingWorkspace` declares the rest. */
export const contextCluesDetectiveLiveDomain: WorkspaceDomain<ContextCluesDetectiveData> = {
  validate: validateContextCluesData,
  initialState: d => {
    const steps = clueSteps(d.challenges);
    return workspaceOpening({ title: d.title, task: clueAsk(steps[0]), total: steps.length });
  },
};
