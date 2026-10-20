/**
 * constellation-builder's boss, on the spoken preset (`components/live-activity/boss.ts`): identify and seasonal are
 * said (the tutor judges the name against the key) or tapped (the activity checks it), SAY_OR_SHOW items; guided trace
 * and free connect have no key, the activity checks every star tap, and they play through `show`. The card is
 * `constellationBuilder.card.ts`; this file holds the content check, the ask and key, the levers and the harness play.
 */
import type { ConstellationBuilderData, ConstellationChallenge } from './ConstellationBuilder';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { spokenBoss } from '../../../components/live-activity/boss';
import { constellationBuilderCard, type ConstellationMiss } from './constellationBuilder.card';
import { CONSTELLATION_LEVERS, PATTERNS, practiceItem, practiceParent } from './constellationLevers';
import {
  constellationItems, constellationSpokenMisses, nameHarnessAnswers, nameOptions, namesAnswer, sameName, shownInstruction,
  traceHarnessTaps,
} from './constellationWorkspace';

const CHALLENGE_TYPES = ['guided_trace', 'free_connect', 'identify', 'seasonal'];

/** Reject a star lesson whose challenges cannot be attempted: every check reads stars, lines or names it was built from. */
export function validateConstellationBuilderData(value: unknown): ConstellationBuilderData {
  const d = value as ConstellationBuilderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.stars) || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || typeof c.constellationName !== 'string' || !c.constellationName.trim()))
    throw new Error('Generated constellation builder has invalid lesson content.');
  const ids = new Set(d.stars.map(s => s?.id));
  for (const c of d.challenges) {
    const lines = Array.isArray(c.correctConnections) ? c.correctConnections : [];
    const linesOk = lines.length > 0 && lines.every(l => ids.has(l.fromStarId) && ids.has(l.toStarId));
    const ok = c.type === 'guided_trace' ? Array.isArray(c.starOrder) && c.starOrder.length >= 2 && c.starOrder.every(s => ids.has(s)) && linesOk
      : c.type === 'free_connect' || c.type === 'identify' ? linesOk
        : typeof c.season === 'string' && !!c.season.trim();
    if (!ok) throw new Error(`A constellation-builder ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/**
 * A name item's key: the constellation's name, and its other real names (the Big Dipper for Ursa Major) unless one of
 * them is another name on screen. A trace item has none: the activity checks the stars.
 */
export function constellationKey(c: ConstellationChallenge): SpokenKey | null {
  if (!namesAnswer(c)) return null;
  const pattern = PATTERNS.find(p => [p.name, ...(p.aliases ?? [])].some(n => sameName(n, c.constellationName)));
  const others = nameOptions(c).filter(o => !sameName(o, c.constellationName));
  const alsoAccept = pattern ? [pattern.name, ...(pattern.aliases ?? [])]
    .filter(n => !sameName(n, c.constellationName) && !others.some(o => sameName(o, n))) : [];
  return { answer: c.constellationName, alsoAccept };
}

const star = (id: string): DriverInput => ({ type: 'touch', target: `star-${id}` });

export const constellationBuilderBoss = spokenBoss<ConstellationBuilderData, ConstellationChallenge, ConstellationMiss>({
  card: constellationBuilderCard,
  validate: validateConstellationBuilderData,
  items: constellationItems,
  levers: CONSTELLATION_LEVERS,
  speech: {
    ask: shownInstruction,
    key: constellationKey,
    misses: constellationSpokenMisses,
    say: nameHarnessAnswers,
    modeOf: c => c.type,
    // A trace through the real stars (`star-<id>`): every star in order, or both ends of every line. A wrong one is the
    // first tap on a later star (guided) or two pattern stars the pattern does not join (free).
    show: (right, c) => {
      const taps = traceHarnessTaps(c);
      return (right ? taps.correct : taps.plainWrong).map(star);
    },
  },
  drive: {
    component: 'primitives/visual-primitives/astronomy/ConstellationBuilder.tsx',
    instanceId: 'constellation',
    defaults: { grade: 'Grade 2', mode: 'free_connect', topic: 'Star patterns in the night sky' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~easier`), rebuilt from its parent.
    current: ctx => {
      const items = constellationItems(ctx.data as ConstellationBuilderData);
      const parent = practiceParent(ctx.itemId, items);
      return parent ? practiceItem(parent) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
  },
});
