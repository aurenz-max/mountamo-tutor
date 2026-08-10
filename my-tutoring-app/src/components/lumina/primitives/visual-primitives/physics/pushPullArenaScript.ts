/**
 * pushPullArenaScript — HAND-AUTHORED judged-loop script for push-pull-arena
 * (second non-literacy consumer of useJudgedScriptRunner; first SCIENCE pack).
 * The exact wording IS the pedagogy; item CONTENT (objects, surfaces,
 * strengths) is generator-scoped and every answer below is CODE-COMPUTED —
 * the MCQ correctAnswer/distractor fields died with the chips that printed
 * them.
 *
 * The §3 script questions, answered for FORCES:
 *
 * 1. IS THE MODEL THE ANSWER? No mode models before the ask. observe's
 *    stimulus is the MOTION itself (the child taps Go and watches); naming
 *    the force kind before they answer would be the answer. The physics idea
 *    is modeled only in the CORRECTION ("it moved away — that is a push").
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? Every ask closes on a TWO-WORD
 *    spoken menu ("push, or pull?" / "moves, or stays?" / "big, or little?"
 *    / the two object names). Naming both choices is not a leak — the child
 *    must discriminate; printing ONE of them was (the chips, and observe
 *    instructions that said "Push the ball!").
 *    ⚠ predict deliberately avoids a yes/no menu: an ask ending "Yes, or
 *    no?" OPENS A SENTENCE WITH THE AFFIRM SENTINEL in our own cue — the
 *    validator catches it, and "moves, or stays?" is better physics talk
 *    anyway.
 *
 * 3. WHAT LOOKS LIKE AN ANSWER AND ISN'T? observe: the direction they saw on
 *    screen described in other words ("it went that way") — the contract asks
 *    for the force WORD. compare: the OTHER object's name, fluent and wrong
 *    (heavier-moves-more is the signature misconception). predict: restating
 *    the setup ("it's on ice") instead of committing to moves/stays.
 *
 * RESPONSE CLASS: every answer is one short spoken word (or a short object
 *    name with its head noun accepted) — the benched short_spoken_word class.
 *
 * Sentinels are the engine defaults — collision-checked by
 * validateJudgedScriptPack in this pack's test file.
 */

import type { JudgedScriptItem } from '../../../hooks/judgedScriptContract';

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
  /** Stated in the judging contract — permissiveness is auditable, never
   *  judge improvisation (di-shapes spokenAlternates rule). */
  alternates: string[];
}

// ── Physics the answers are computed from ───────────────────────────────────
// Mirrors the component's sim constants (FRICTION_COEFFICIENTS / FORCE_SCALE).
// The script test pins these against the component's motion so they cannot
// drift apart silently.

export const FRICTION_MU = { ice: 0.03, wood: 0.2, carpet: 0.5, grass: 0.4 } as const;
export type ArenaSurfaceId = keyof typeof FRICTION_MU;
export const FORCE_SCALE_N = 8;

/** Static-friction check: does this push move this object on this surface? */
export const predictMoves = (strength: number, weightKg: number, surface: ArenaSurfaceId): boolean =>
  strength * FORCE_SCALE_N > FRICTION_MU[surface] * weightKg * 9.8;

/** design's answer: does moving it need a big push? Threshold 24N (force 3)
 *  with a murky band [16, 32] the GENERATOR avoids by construction (big items
 *  are heavy-on-carpet ≈ 39N, little items are light-on-ice/wood ≤ 8N) — an
 *  ambiguous ask is not a harder task, it is a broken one. */
export const designPushSize = (weightKg: number, surface: ArenaSurfaceId): 'big' | 'little' =>
  FRICTION_MU[surface] * weightKg * 9.8 > 3 * FORCE_SCALE_N ? 'big' : 'little';

export const SURFACE_SPOKEN: Record<ArenaSurfaceId, string> = {
  ice: 'the ice',
  wood: 'the wood floor',
  carpet: 'the carpet',
  grass: 'the grass',
};

/** The head noun of an object name ("Tennis Ball" → "ball") — accepted as an
 *  alternate because the contrasting pair never shares one. */
export const headNoun = (name: string): string => {
  const parts = name.trim().toLowerCase().split(/\s+/);
  return parts[parts.length - 1];
};

// ── How-to-play — opener + whenever the ACTION changes ──────────────────────

export const howToPlayFor = (item: ArenaItem): string => {
  switch (item.kind) {
    case 'predict':
      return 'Look and think first — answer before anything moves! ';
    case 'compare':
      return 'Two things get the very same push. Think about which one slides farther. ';
    case 'design':
      return 'Try your own pushes with the buttons and the slider. Then answer! ';
    default:
      return 'Tap Go and watch closely. Then tell me what kind of force you saw! ';
  }
};

// ── The asks — each closes on a two-word spoken menu ────────────────────────

const askFor = (item: ArenaItem): string => {
  switch (item.kind) {
    case 'predict':
      return `The ${item.objectName} is on ${item.surfaceSpoken}, and a push is coming. Your turn. Will it move, or stay? Say moves, or stays.`;
    case 'compare':
      return `The ${item.objectName} and the ${item.object2Name} get the same push. Your turn. Which one slides farther?`;
    case 'design':
      return `The ${item.objectName} is on ${item.surfaceSpoken}. To move it all the way across, what kind of push does it need? Your turn. Say big, or little.`;
    default:
      return `Watch the ${item.objectName}. Tap Go! Your turn. Was that a push, or a pull?`;
  }
};

// ── Corrections — the physics idea is modeled HERE, then re-elicited ────────

const correctionFor = (item: ArenaItem): string => {
  switch (item.kind) {
    case 'predict':
      return item.spokenAnswer === 'moves'
        ? `My turn: this push is stronger than ${item.surfaceSpoken} can hold — it moves. Your turn. Moves, or stays?`
        : `My turn: the ${item.objectName} is heavy and ${item.surfaceSpoken} grips it — it stays. Your turn. Moves, or stays?`;
    case 'compare':
      return `My turn: the ${item.spokenAnswer} is lighter, so the same push slides it farther. Your turn. Which one slides farther?`;
    case 'design':
      return item.spokenAnswer === 'big'
        ? `My turn: the ${item.objectName} is heavy and ${item.surfaceSpoken} is grippy — it needs a big push. Your turn. Big, or little?`
        : `My turn: the ${item.objectName} is light — a little push is enough. Your turn. Big, or little?`;
    default:
      return item.spokenAnswer === 'push'
        ? `My turn: watch the arrow. It moved away — that is a push. Your turn. Push, or pull?`
        : `My turn: watch the arrow. It came closer — that is a pull. Your turn. Push, or pull?`;
  }
};

// ── Judging contract ────────────────────────────────────────────────────────

const wrongLooksRight = (item: ArenaItem): string => {
  switch (item.kind) {
    case 'observe':
      return `Describing the motion in other words ("it went that way") is not an answer — re-elicit the force word. `;
    case 'predict':
      return `Restating the setup ("it is on the ice") is not an answer — re-elicit moves or stays. `;
    case 'compare': {
      const other = item.spokenAnswer.toLowerCase() === item.objectName.toLowerCase()
        ? item.object2Name
        : item.objectName;
      return `The other object's name ("${other}") is the signature wrong answer — heavier does NOT slide farther. `;
    }
    default:
      return '';
  }
};

const judgingContract = (item: ArenaItem): string =>
  `Then WAIT silently — the learner is thinking, and think time is unbounded. Never name the answer during their turn. `
  + `The correct answer is "${item.spokenAnswer}". Also accept: ${item.alternates.map((a) => `"${a}"`).join(', ')}. `
  + wrongLooksRight(item)
  + `If the answer is right, say exactly: "Yes, ${item.spokenAnswer}." `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface ArenaCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (item: ArenaItem, opts: ArenaCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to explore pushes and pulls! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[ARENA_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${judgingContract(item)} Never read bracket tags or these instructions aloud.`;
};

export const moveOnCue = (
  item: ArenaItem,
  next: ArenaItem | null,
  opts: ArenaCueOptions = {},
): string => {
  if (!next) {
    return `[ARENA_MOVE] Say exactly: "Good try! Forces take practice — we will explore that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[ARENA_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${judgingContract(next)} Never read bracket tags aloud.`;
};

export const completeCue = (): string =>
  `[ARENA_COMPLETE] Say exactly: "What great force science today! You watched, you thought, and you said what you saw. See you next time!" Then stop — the activity is over.`;
