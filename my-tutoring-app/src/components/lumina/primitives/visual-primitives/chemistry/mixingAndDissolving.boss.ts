/**
 * mixing-and-dissolving's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed
 * choice the learner says (the tutor judges the words against the key) or taps and submits (the activity judges the
 * tap), a SAY_OR_SHOW card. The card is `mixingAndDissolving.card.ts`; this file holds the content check, the items,
 * the ask and key, the levers and the harness play.
 */
import type { DissolvingChallenge, MixingAndDissolvingData } from './MixingAndDissolving';
import { spokenBoss } from '../../../components/live-activity/boss';
import { mixingAndDissolvingCard } from './mixingAndDissolving.card';
import { DISSOLVING_LEVERS } from './mixingAndDissolvingLevers';
import {
  dissolvingHarnessAnswers, dissolvingKey, dissolvingMode, dissolvingSpokenMisses, type DissolvingMiss,
} from './mixingAndDissolvingWorkspace';

const TYPES = ['dissolve_sort', 'particle_explain', 'factor_test', 'saturation', 'separate', 'concentration', 'classify'];

/** Reject a lab whose challenges cannot be attempted: every check reads the challenge's own `correctOptionIndex`. */
export function validateMixingAndDissolvingData(value: unknown): MixingAndDissolvingData {
  const d = value as MixingAndDissolvingData;
  if (!d || typeof d.title !== 'string' || !d.solvent || typeof d.solvent.name !== 'string'
      || !Array.isArray(d.substances) || !d.substances.length
      || d.substances.some(s => !s || typeof s.id !== 'string' || typeof s.name !== 'string' || !s.name.trim())
      || new Set(d.substances.map(s => s.id)).size !== d.substances.length)
    throw new Error('Generated mixing and dissolving lab has invalid lesson content.');
  const chs = Array.isArray(d.challenges) ? d.challenges : [];
  if (!chs.length || chs.length > 12) throw new Error('Generated mixing and dissolving lab has no askable challenge.');
  if (new Set(chs.map(c => c?.id)).size !== chs.length) throw new Error('Mixing and dissolving challenge ids repeat.');
  for (const c of chs) {
    if (!c || typeof c.id !== 'string' || !TYPES.includes(c.type) || typeof c.instruction !== 'string' || !c.instruction.trim()
        || !Array.isArray(c.options) || c.options.length < 2 || c.options.some(o => typeof o !== 'string' || !o.trim())
        || new Set(c.options.map(o => o.trim().toLowerCase())).size !== c.options.length
        || !Number.isInteger(c.correctOptionIndex) || c.correctOptionIndex < 0 || c.correctOptionIndex >= c.options.length)
      throw new Error('A mixing-and-dissolving challenge cannot be answered as generated.');
  }
  return d;
}

export const mixingAndDissolvingBoss = spokenBoss<MixingAndDissolvingData, DissolvingChallenge, DissolvingMiss>({
  card: mixingAndDissolvingCard,
  validate: validateMixingAndDissolvingData,
  items: d => d.challenges,
  levers: DISSOLVING_LEVERS,
  speech: {
    ask: ch => ch.instruction.trim(),
    key: dissolvingKey,
    misses: dissolvingSpokenMisses,
    say: dissolvingHarnessAnswers,
    modeOf: dissolvingMode,
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/MixingAndDissolving.tsx',
    instanceId: 'dissolving',
    defaults: { grade: 'Grade 4', mode: 'dissolve', topic: 'What dissolves in water' },
    mounted: '[data-pip-object="workspace"]',
  },
});
