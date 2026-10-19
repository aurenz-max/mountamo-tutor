/**
 * push-pull-arena's domain: the items, their code-computed answers, the ask, the spoken key, the known misses and the
 * scene. Pure; the boss (`pushPullArena.boss.ts`), the levers, the component and the generator read it.
 *
 * Item CONTENT (objects, surfaces, strengths) is generator-scoped; every answer is computed here from the sim's own
 * physics: observe from the push direction, predict from the static-friction check, compare from the lighter object,
 * design from the needed-force threshold.
 *
 * - The ask never models the answer. observe's stimulus is the motion itself (the learner presses Go and watches);
 *   naming the force kind before they answer would be the answer.
 * - Every ask closes on a two-word spoken menu ("push, or pull?", "moves, or stays?", "big, or little?", the two
 *   object names), so every key is a menu key. Naming both choices is not a leak; printing one of them was.
 *   predict avoids a yes/no menu: "moves, or stays?" is better physics talk.
 * - What looks like an answer and isn't: observe, the motion described in other words ("it went that way"); predict,
 *   the setup restated ("it's on ice"); compare, the other object's name (heavier-slides-farther is the signature
 *   misconception); design, the experiment reported instead of a push size.
 */
import type { JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';

export type ArenaItemKind = 'observe' | 'predict' | 'compare' | 'design';

export interface ArenaItem extends JudgedScriptItem {
  kind: ArenaItemKind;
  objectName: string;
  object2Name?: string;
  /** Spoken surface name ("the carpet", "the wood floor"). */
  surfaceSpoken: string;
  strength: number;
  direction: 'push' | 'pull';
  /** CODE-COMPUTED correct spoken answer (never from the LLM). */
  spokenAnswer: string;
  /** Equally right answers, stated in the key. */
  alternates: string[];
  /** The lesson's support tier; when the model lever comes (`supportFact`). */
  supportTier?: SupportTier;
}

// ── Physics the answers are computed from ───────────────────────────────────
// Mirrors the component's sim constants (FRICTION_COEFFICIENTS / FORCE_SCALE); the domain test pins them.

export const FRICTION_MU = { ice: 0.03, wood: 0.2, carpet: 0.5, grass: 0.4 } as const;
export type ArenaSurfaceId = keyof typeof FRICTION_MU;
export const FORCE_SCALE_N = 8;

/** Static-friction check: does this push move this object on this surface? */
export const predictMoves = (strength: number, weightKg: number, surface: ArenaSurfaceId): boolean =>
  strength * FORCE_SCALE_N > FRICTION_MU[surface] * weightKg * 9.8;

/** design's answer: does moving it need a big push? Threshold 24N (force 3) with a murky band [16, 32] the generator
 *  avoids by construction and `itemFromChallenge` drops: an ambiguous ask is not a harder task, it is a broken one. */
export const designPushSize = (weightKg: number, surface: ArenaSurfaceId): 'big' | 'little' =>
  FRICTION_MU[surface] * weightKg * 9.8 > 3 * FORCE_SCALE_N ? 'big' : 'little';

/**
 * design's setups, in the order a lesson walks them. Every entry is clear of `designPushSize`'s murky 16-32 N band
 * (the domain test asserts it against `FRICTION_MU`), and the answer alternates by position, so neither "big" nor
 * "little" said every time scores. It replaced `pickObject(Math.max(8, weight))`, which collapsed every draw between 5
 * and 8 onto the Barrel on carpet: byte-identical consecutive asks that answered "big" three times out of four.
 */
export const DESIGN_SETUPS: { objectName: string; surface: ArenaSurfaceId }[] = [
  { objectName: 'Toy Car', surface: 'wood' },        // ≈ 3.9 N  → little
  { objectName: 'Barrel', surface: 'carpet' },       // ≈ 39.2 N → big
  { objectName: 'Tennis Ball', surface: 'ice' },     // ≈ 0.3 N  → little
  { objectName: 'Rock', surface: 'grass' },          // ≈ 35.3 N → big
  { objectName: 'Book', surface: 'wood' },           // ≈ 5.9 N  → little
  { objectName: 'Refrigerator', surface: 'carpet' }, // ≈ 49.0 N → big
];

export const SURFACE_SPOKEN: Record<ArenaSurfaceId, string> = {
  ice: 'the ice',
  wood: 'the wood floor',
  carpet: 'the carpet',
  grass: 'the grass',
};

/** The head noun of an object name ("Tennis Ball" → "ball"), accepted because the contrasting pair never shares one. */
export const headNoun = (name: string): string => {
  const parts = name.trim().toLowerCase().split(/\s+/);
  return parts[parts.length - 1];
};

// ── The ask: each closes on a two-word spoken menu ──────────────────────────

export const askFor = (item: ArenaItem): string => {
  switch (item.kind) {
    case 'predict':
      return `The ${item.objectName} is on ${item.surfaceSpoken}, and a push is coming. Will it move, or stay? Say moves, or stays.`;
    case 'compare':
      return `The ${item.objectName} and the ${item.object2Name} get the same push. Which one slides farther?`;
    case 'design':
      return `The ${item.objectName} is on ${item.surfaceSpoken}. To move it all the way across, what kind of push does it need? Say big, or little.`;
    default:
      return `Watch the ${item.objectName}. Tap Go! Was that a push, or a pull?`;
  }
};

/** compare's non-answer object: the one the ask names but the physics does not reward. */
export const otherObjectName = (item: ArenaItem): string =>
  item.spokenAnswer.toLowerCase() === item.objectName.toLowerCase()
    ? (item.object2Name ?? item.objectName)
    : item.objectName;

// ── Items: one builder for the component, the boss and the levers ───────────

export const ACTION_FOR_KIND: Record<ArenaItemKind, string> = {
  observe: 'watch',
  predict: 'predict',
  compare: 'compare',
  design: 'experiment',
};

/** The generator fields an item is built from. Structural subset of `PushPullChallenge`. */
export interface ArenaChallengeLike {
  id: string;
  type: ArenaItemKind;
  objectName: string;
  objectWeight: number;
  surface: ArenaSurfaceId;
  pushStrength?: number;
  pushDirection?: 'push' | 'pull';
  object2Name?: string;
  object2Weight?: number;
}

/** The accepted alternates, one place: the key states them. */
const ALTERNATES: Record<string, string[]> = {
  moves: ['move', 'it moves', 'it will move', 'yes'],
  stays: ['stay', 'stay still', 'it stays', 'no'],
  big: ['a big push', 'strong', 'a strong push', 'hard'],
  little: ['a little push', 'small', 'gentle', 'soft'],
  push: ['a push', 'pushing', 'you pushed it'],
  pull: ['a pull', 'pulling', 'you pulled it'],
};

const frictionNewtons = (weightKg: number, surface: ArenaSurfaceId): number =>
  FRICTION_MU[surface] * weightKg * 9.8;

/**
 * One challenge's item, or null when its answer is not decisive: a predict within 0.6-1.4x of static friction, a
 * compare of equal weights or equal names, a design inside the murky band, a missing object or unknown surface. The
 * generator constructs decisive margins; this enforces them where the runner reads, and never backfills.
 */
export const itemFromChallenge = (ch: ArenaChallengeLike, supportTier?: SupportTier): ArenaItem | null => {
  const objectName = (ch.objectName ?? '').trim();
  if (!objectName) return null;
  if (!(ch.surface in FRICTION_MU)) return null;
  const weight = Number(ch.objectWeight);
  if (!Number.isFinite(weight) || weight <= 0) return null;

  const strength = ch.pushStrength ?? 5;
  const direction = ch.pushDirection ?? 'push';
  let spokenAnswer: string;

  switch (ch.type) {
    case 'predict': {
      const forceN = strength * FORCE_SCALE_N;
      const frictionN = frictionNewtons(weight, ch.surface);
      if (forceN >= frictionN * 1.4) spokenAnswer = 'moves';
      else if (forceN <= frictionN * 0.6) spokenAnswer = 'stays';
      else return null;
      break;
    }
    case 'compare': {
      const object2Name = (ch.object2Name ?? '').trim();
      const weight2 = Number(ch.object2Weight);
      if (!object2Name || !Number.isFinite(weight2) || weight2 <= 0) return null;
      if (weight2 === weight) return null;
      if (object2Name.toLowerCase() === objectName.toLowerCase()) return null;
      spokenAnswer = (weight2 < weight ? object2Name : objectName).toLowerCase();
      break;
    }
    case 'design': {
      const frictionN = frictionNewtons(weight, ch.surface);
      if (frictionN >= 16 && frictionN <= 32) return null;
      spokenAnswer = designPushSize(weight, ch.surface);
      break;
    }
    default:
      spokenAnswer = direction;
  }

  const alternates = ch.type === 'compare' ? [headNoun(spokenAnswer)] : ALTERNATES[spokenAnswer] ?? [];

  return {
    id: ch.id,
    kind: ch.type,
    answerKind: 'voice',
    responseClass: 'short_spoken_word',
    action: ACTION_FOR_KIND[ch.type],
    objectName,
    object2Name: ch.object2Name,
    surfaceSpoken: SURFACE_SPOKEN[ch.surface],
    strength,
    direction,
    spokenAnswer,
    alternates,
    ...(supportTier ? { supportTier } : {}),
  };
};

export const itemsFromChallenges = (challenges: readonly ArenaChallengeLike[], supportTier?: SupportTier): ArenaItem[] =>
  challenges
    .map((ch) => itemFromChallenge(ch, supportTier))
    .filter((item): item is ArenaItem => item !== null);

// ── The key ─────────────────────────────────────────────────────────────────

/** The words the ask offers, which the learner chooses from. */
const menuOf = (item: ArenaItem): string[] => {
  switch (item.kind) {
    case 'predict': return ['moves', 'stays'];
    case 'compare': return [item.objectName.toLowerCase(), (item.object2Name ?? '').toLowerCase()];
    case 'design': return ['big', 'little'];
    default: return ['push', 'pull'];
  }
};

const SIGNATURE_ERROR: Record<ArenaItemKind, (item: ArenaItem) => string> = {
  observe: () => 'Describing the motion in other words ("it went that way") is not it: the force word is.',
  predict: () => 'Restating the setup ("it is on the ice") is not it: moves or stays is.',
  compare: item => `"${otherObjectName(item)}" is not it: the heavier object does not slide farther.`,
  design: () => 'Reporting what happened when they tried it is not it: big or little is.',
};

export function pushPullArenaKey(item: ArenaItem): SpokenKey {
  return { answer: item.spokenAnswer, alsoAccept: item.alternates, menu: menuOf(item), signatureError: SIGNATURE_ERROR[item.kind](item) };
}

// ── Known misses ────────────────────────────────────────────────────────────

/** What a wrong spoken answer shows (handoff 20 Part B): the other word of the pair, or no force word. */
export type SpokenPushPullMiss = 'opposite_force' | 'described_motion' | 'opposite_outcome' | 'other_object' | 'opposite_size';

const OTHER_WORD: Record<string, string> = { push: 'pull', pull: 'push', moves: 'stays', stays: 'moves', big: 'little', little: 'big' };

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other word of the ask's
 * pair, the other object (compare), or a description of the motion with no force word (observe). Concrete per item.
 */
export function pushPullSpokenMisses(item: ArenaItem): KnownMiss[] {
  const answer = item.spokenAnswer.toLowerCase(), other = OTHER_WORD[answer];
  switch (item.kind) {
    case 'observe': return [
      ...(other ? [{ id: 'opposite_force', pattern: `The right answer is "${answer}": the ${item.objectName} was ${answer === 'push' ? 'pushed' : 'pulled'}. The learner gives the opposite force word, "${other}".`, examples: [other, `a ${other}`] }] : []),
      { id: 'described_motion', pattern: `The learner describes how the ${item.objectName} moved ("it went that way", "it rolled") and says neither push nor pull.`,
        examples: ['it went that way', 'it rolled'] }];
    case 'predict': return other ? [{ id: 'opposite_outcome',
      pattern: `The right answer is "${answer}": the ${item.objectName} on ${item.surfaceSpoken} ${answer === 'moves' ? 'moves' : 'stays still'}. `
        + `The learner gives the opposite answer, "${other}" (or "it ${other}", "it will ${other.replace(/s$/, '')}").`,
      examples: [other, other === 'stays' ? 'it stays' : 'it moves'] }] : [];
    case 'compare': {
      const wrong = otherObjectName(item);
      return [{ id: 'other_object', pattern: `The right answer is the ${item.spokenAnswer}: it slides farther than the ${wrong}. The learner names the other object, the ${wrong}.`, examples: [`the ${wrong.toLowerCase()}`] }];
    }
    case 'design': return other ? [{ id: 'opposite_size', pattern: `The right answer is "${answer}": the goal needs a ${answer} push. The learner gives the opposite answer, "${other}".`, examples: [other] }] : [];
  }
}

// ── Scene ───────────────────────────────────────────────────────────────────

/** What is in the arena and what the learner may do there. Never the outcome. */
export function pushPullArenaScene(item: ArenaItem, view: { goal?: string; observed: boolean; practice?: boolean }): SceneOf {
  const objects = item.kind === 'compare' ? `the ${item.objectName} and the ${item.object2Name}` : `the ${item.objectName}`;
  const facts: Record<string, string> = { shown: `${objects} on ${item.surfaceSpoken}, in the arena.` };
  if (item.kind === 'design' && view.goal) facts.goal = view.goal;
  if (view.practice) facts.practice = 'An easier practice item on other things, ungraded. The full item comes back after it.';
  // What the learner does before answering (observe's Go, design's tries) is the card's `moves`; the scene says only
  // whether observe's run has happened, and that predict and compare run after credit.
  if (item.kind === 'observe' && view.observed) facts.watched = 'The learner pressed Go and watched the preset force.';
  if (item.kind === 'predict' || item.kind === 'compare') facts.constraints = 'Nothing moves before the answer; the arena plays the push once it is credited.';
  return { objects: [], facts };
}

/** The harness's answers: the code-computed answer, or the other side of the menu. */
export const pushPullArenaHarnessAnswers = (item: ArenaItem): { correct: string; plainWrong: string } => ({
  correct: item.spokenAnswer,
  plainWrong: item.kind === 'compare' ? otherObjectName(item).toLowerCase() : OTHER_WORD[item.spokenAnswer] ?? 'I do not know',
});
