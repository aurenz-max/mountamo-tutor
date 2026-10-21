/**
 * context-clues-detective's boss (`components/live-activity/boss.ts`), bespoke because every step is a board or a tap
 * the activity checks: the card is `contextClues.card.ts`; this file validates a lesson, lists its steps, asks one,
 * carries the lever set and plays the harness.
 */
import type { ContextCluesDetectiveData } from './ContextCluesDetective';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss, hasText } from '../../../components/live-activity/boss';
import { contextCluesCard, type ContextClueMiss } from './contextClues.card';
import { CLUE_LEVERS } from './contextCluesLevers';
import { CLUE_TYPES, clueAsk, clueHarnessInputs, clueSteps, type ClueStep } from './contextCluesWorkspace';

/** Each word is up to three checked steps; four words is the generator's most. */
const MAX_WORDS = 4;

/** Reject a context-clues lesson whose steps cannot be answered as generated. */
export function validateContextCluesData(value: unknown): ContextCluesDetectiveData {
  const d = value as ContextCluesDetectiveData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > MAX_WORDS
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated context clues detective has invalid lesson content.');
  for (const c of d.challenges) {
    const ids = new Set((c?.passage?.sentences ?? []).map(s => s?.id));
    const ok = !!c && hasText(c.id) && !c.id.includes(':')
      && ids.size >= 2 && ids.size === c.passage.sentences.length
      && c.passage.sentences.every(s => hasText(s.text))
      && hasText(c.targetWord) && ids.has(c.targetWordSentenceId)
      && CLUE_TYPES.includes(c.clueType)
      // Find needs a clue sentence to tap; define needs its key among the options (or a typed key).
      && Array.isArray(c.clueSentenceIds) && c.clueSentenceIds.some(id => ids.has(id))
      && hasText(c.correctMeaning)
      && (!c.meaningOptions?.length || c.meaningOptions.includes(c.correctMeaning));
    if (!ok) throw new Error(`A context-clues word (${c?.id ?? '?'}) cannot be answered as generated.`);
  }
  return d;
}

export const contextCluesBoss = defineBoss<ContextCluesDetectiveData, ClueStep, ContextClueMiss>({
  card: contextCluesCard,
  validate: validateContextCluesData,
  items: d => clueSteps(d.challenges),
  ask: clueAsk,
  // Every step is a board or a tap the activity checks: no key reaches the tutor.
  assignment: step => bossAssignment(step.id, clueAsk(step), null),
  levers: CLUE_LEVERS,
  stepOf: step => step.phase,
  drive: {
    component: 'primitives/visual-primitives/literacy/ContextCluesDetective.tsx',
    instanceId: 'clues',
    defaults: { grade: 'Grade 4', mode: 'synonym_antonym', topic: 'Animals of the rainforest' },
    mounted: '[data-pip-object="workspace"]',
    // Every step through its real controls (item `<word id>:<step>`): a sentence ("sentence N") then Check Clue, a clue
    // type then Check Type, a meaning option (or the typed meaning) then Check Meaning. Wrong: a sentence that is not a
    // clue, the type's signature confusion, another option. A find step whose every sentence is a clue has no wrong tap.
    play: (right, step) => (clueHarnessInputs(step, right ? 'correct' : 'wrong') ?? []).map((i): DriverInput =>
      (i.kind === 'choose' ? { type: 'choose', label: i.label } : { type: 'write', label: i.label, text: i.text })),
  },
});
