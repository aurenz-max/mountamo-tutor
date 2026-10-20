/**
 * math-fact-fluency's boss, on the spoken preset (`components/live-activity/boss.ts`): a visual fact, a bare fact, a
 * missing number and a rapid recall ask for one number, said (the tutor judges it against the key) or tapped or set and
 * Submitted (the activity checks it), SAY_OR_SHOW items; a match has no key, the activity checks the tap, and it plays
 * through `show`. The card is `mathFactFluency.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { MathFactFluencyChallenge, MathFactFluencyData } from './MathFactFluency';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { mathFactFluencyCard, type MathFactMiss } from './mathFactFluency.card';
import { FLUENCY_LEVERS, simplerItem } from './mathFactFluencyLevers';
import {
  equationResult, mathFactAsk, mathFactChannel, mathFactGiven, mathFactHarnessInputs, mathFactHarnessWords, mathFactKey,
  mathFactMode, mathFactSpokenMisses,
} from './mathFactFluencyWorkspace';

/** Reject a fact the activity cannot check: a choice row, equation row or picture row must hold the answer. */
export const validateMathFactFluencyData = (value: unknown): MathFactFluencyData => validateChallengePool<MathFactFluencyData>(value,
  c => {
    if (!c || typeof c.instruction !== 'string' || !c.instruction || typeof c.correctAnswer !== 'number') return false;
    const channel = mathFactChannel(c);
    if (channel === 'choice') return c.options!.includes(c.correctAnswer);
    if (channel === 'equation') return Array.isArray(c.equationOptions) && c.equationOptions.some(eq => equationResult(eq) === c.correctAnswer);
    if (channel === 'picture') return Array.isArray(c.visualOptions) && c.visualOptions.some(v => v.count === c.correctAnswer);
    return true;
  },
  { pool: 'Generated math fact fluency has invalid lesson content.', item: 'A math fact cannot be checked.' });

const maxOf = (data: unknown) => (data as Partial<MathFactFluencyData>)?.maxNumber ?? 5;

export const mathFactFluencyBoss = spokenBoss<MathFactFluencyData, MathFactFluencyChallenge, MathFactMiss>({
  card: mathFactFluencyCard,
  validate: validateMathFactFluencyData,
  items: data => data.challenges,
  levers: FLUENCY_LEVERS,
  speech: {
    ask: mathFactAsk,
    // A match is tapped only: no key, the activity checks the tap.
    key: mathFactKey,
    given: mathFactGiven,
    misses: mathFactSpokenMisses,
    say: mathFactHarnessWords,
    modeOf: mathFactMode,
    // A match through its real controls: the matching equation or picture tapped (wrong: another one).
    show: (right, c, ctx) => mathFactHarnessInputs(c, !right, maxOf(ctx.data)) as DriverInput[],
  },
  drive: {
    component: 'primitives/visual-primitives/math/MathFactFluency.tsx',
    instanceId: 'facts',
    defaults: { grade: 'Kindergarten', mode: 'visual_fact', topic: 'Addition facts within 5' },
    // The old journey row's mounted probe: the printed fact, or the picture on a picture-to-equation match.
    mounted: '[data-pip-object="problem"], [data-pip-object="visual"]',
    // The session fact, or the easier fact a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as MathFactFluencyData).challenges ?? [];
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find(c => `${c.id}~simpler` === ctx.itemId) : null;
      return parent ? simplerItem(parent, maxOf(ctx.data)) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
  },
});
