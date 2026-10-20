/**
 * light-shadow-lab's boss, on the tap preset (`components/live-activity/boss.ts`): every item is one tapped choice and a
 * Check Answer press, judged by the activity. The card is `lightShadowLab.card.ts`; this file holds the content check,
 * the items, the ask, the levers and the harness's taps. The live adapter and the journey row are built from it.
 */
import type { LightShadowLabData, ShadowChallenge } from './LightShadowLab';
import { tapBoss } from '../../../components/live-activity/boss';
import { lightShadowLabCard } from './lightShadowLab.card';
import { SHADOW_LEVERS, practiceItem, practiceParent } from './lightShadowLevers';
import { shadowHarnessAnswers, shadowOptions, type ShadowMiss } from './lightShadowWorkspace';

const CHALLENGE_TYPES = ['observe', 'predict', 'measure', 'apply'];
const degrees = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;

/** Reject a shadow lesson whose challenges cannot be attempted: every check reads the sun position it was built from. */
export function validateLightShadowLabData(value: unknown): LightShadowLabData {
  const d = value as LightShadowLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated light and shadow lab has invalid lesson content.');
  for (const c of d.challenges) {
    const sun = c.sunPosition;
    if (!sun || !degrees(sun.altitude, 0, 90) || !degrees(sun.azimuth, 0, 180) || (c.type === 'apply' && !sun.time?.trim()))
      throw new Error(`A light-shadow-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The harness's taps: the key's choice button, and the one showing the most telling miss (`shadowHarnessAnswers`). */
function shadowTargets(c: ShadowChallenge, data: LightShadowLabData) {
  const options = shadowOptions(c, data.sunPositions ?? []);
  const { correct, plainWrong } = shadowHarnessAnswers(c, data.sunPositions ?? []);
  return { correct: `option-${options.indexOf(correct)}`, wrong: plainWrong ? `option-${options.indexOf(plainWrong)}` : null };
}

export const lightShadowLabBoss = tapBoss<LightShadowLabData, ShadowChallenge, ShadowMiss>({
  card: lightShadowLabCard,
  validate: validateLightShadowLabData,
  items: data => data.challenges,
  levers: SHADOW_LEVERS,
  choice: { ask: c => c.instruction, targets: shadowTargets, commit: 'Check Answer' },
  drive: {
    component: 'primitives/visual-primitives/astronomy/LightShadowLab.tsx',
    instanceId: 'shadow',
    defaults: { grade: 'Grade 2', mode: 'predict', topic: 'How shadows change during the day' },
    mounted: '[data-pip-object="workspace"]',
    // An easier item (`~easier`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const challenges: ShadowChallenge[] = ctx.data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, challenges);
      return parent ? practiceItem(parent) ?? undefined : challenges.find(c => c.id === ctx.itemId);
    },
  },
});
