/**
 * Spoken practice's boss, on the spoken preset (`components/live-activity/boss.ts`): the card is
 * `diSpokenPractice.card.ts`; this file is what the preset cannot know — the content check, the key, the known
 * misses, the levers and the harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiSpokenPracticeData } from './DiSpokenPractice';
import type { SpokenPracticeItem } from './diSpokenPracticeScript';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diSpokenPracticeCard } from './diSpokenPractice.card';
import { diSpokenPracticeHarnessAnswers, spokenPracticeAskFor, spokenPracticeItemValid, spokenPracticeKey,
  spokenPracticeSpokenMisses, type SpokenPracticeMiss } from './diSpokenPracticeWorkspace';
import { SPOKEN_LEVERS } from './diSpokenPracticeLevers';

/** Reject a pool whose items cannot be asked: a known mode, an ask and a key (and pictures to count). */
export function validateDiSpokenPracticeData(value: unknown): DiSpokenPracticeData {
  const d = value as DiSpokenPracticeData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.items) || !d.items.length || d.items.length > 12
      || new Set(d.items.map(item => item?.id)).size !== d.items.length)
    throw new Error('Generated spoken practice has invalid lesson content.');
  if (!d.items.every(spokenPracticeItemValid)) throw new Error('A spoken practice item cannot run in the teaching workspace.');
  return d;
}

export const diSpokenPracticeBoss = spokenBoss<DiSpokenPracticeData, SpokenPracticeItem, SpokenPracticeMiss>({
  card: diSpokenPracticeCard,
  validate: validateDiSpokenPracticeData,
  items: data => data.items,
  levers: SPOKEN_LEVERS,
  speech: {
    ask: spokenPracticeAskFor,
    key: spokenPracticeKey,
    misses: spokenPracticeSpokenMisses,
    say: diSpokenPracticeHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx',
    instanceId: 'spoken',
    defaults: { grade: 'Grade 1', mode: 'compare_choice', topic: 'Comparing lengths: longer and shorter' },
    mounted: '[data-spoken-object="stimulus"]',
    leakTokens: ['SAY_ITEM', 'SAY_MOVE', 'SAY_HEAR', 'SAY_COMPLETE'],
    probes: { reward: { selector: '[data-spoken-credited]', kind: 'count' } },
  },
});
