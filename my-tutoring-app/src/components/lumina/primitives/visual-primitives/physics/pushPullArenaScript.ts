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

import type { JudgedCueSurface, JudgedScriptItem } from '../../../hooks/judgedScriptContract';

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

/**
 * design's setups, in the order a lesson walks them.
 *
 * It lives here rather than in the generator because the rule it has to satisfy
 * lives here: every entry is clear of `designPushSize`'s murky 16–32 N band, and
 * the script test asserts that against `FRICTION_MU` rather than trusting the
 * comments. The generator's own design branch is a deterministic override — it
 * always replaced the LLM's object and surface — so this is not authority taken
 * from the model, it is the override made non-degenerate.
 *
 * WHAT IT REPLACED: `pickObject(Math.max(8, weight))` returns the FIRST library
 * object at that weight, so every LLM draw between 5 and 8 collapsed onto the
 * Barrel, and the big branch pinned the surface to carpet. A live probe drew
 * "The Barrel is on the carpet…" as items 2 AND 3 — byte-identical consecutive
 * asks, which `checkPackGates` refuses — inside a set that answered "big" three
 * times out of four, so a child who says "big" every time scores 75% without
 * looking at the arena.
 *
 * Alternating the answer by POSITION is what makes N challenges N problems: the
 * object varies, the surface varies, and neither answer word can be guessed.
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
      // "before anything happens", never "before anything moves" — `moves` is
      // this mode's graded answer word, and the how-to-play is spoken before
      // the child commits. It primed the answer AND tripped the drive's leak
      // oracle, which scans the whole ask outside the declared menu span.
      return 'Look and think first — answer before anything happens! ';
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
      const other = otherObjectName(item);
      return `The other object's name ("${other}") is the signature wrong answer — heavier does NOT slide farther. `;
    }
    default:
      // design was the one mode in this pack with NO discrimination clause,
      // which left its most natural miss ungoverned: the child experiments, then
      // REPORTS the experiment instead of committing to a push size. The ask is
      // "what kind of push does it need", not "what happened".
      return `Reporting what happened when they tried it ("it moved", "it went across") is not an answer — re-elicit big or little. `;
  }
};

/** compare's non-answer object — the one the ask names but the physics does not
 *  reward. Shared by the contract clause and the harness's signature wrong so
 *  the claim and the test of the claim cannot drift. */
export const otherObjectName = (item: ArenaItem): string =>
  item.spokenAnswer.toLowerCase() === item.objectName.toLowerCase()
    ? (item.object2Name ?? item.objectName)
    : item.objectName;

/**
 * Consumed from `wordWorkoutScript`'s `TWO_BRANCH_LAW`, extended the way
 * counting-board and addition-subtraction-scene extend it (`no reminder of the
 * method, no scaffolding line`). Wording is kept identical across the family on
 * purpose, so a grep finds every pack that carries it.
 *
 * It is stated BEFORE the branches because the defect it fixes is a reply that
 * is NEITHER branch: the earlier phrasing ("say the same correction line on
 * every wrong answer") reads as a rule about REPEATS and leaves the first wrong
 * answer apparently free for improvised warmth. A reply opening with neither
 * sentinel reaches the loop as no verdict at all and the child waits.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

const judgingContract = (item: ArenaItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. Never name the answer during their turn. `
  + `The correct answer is "${item.spokenAnswer}". Also accept: ${item.alternates.map((a) => `"${a}"`).join(', ')}. `
  + wrongLooksRight(item)
  + TWO_BRANCH_LAW
  + `If the answer is right, say exactly: "Yes, ${item.spokenAnswer}." `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

// ── Cues ────────────────────────────────────────────────────────────────────

/**
 * The tail every cue ends with, consumed from counting-board's — which is the
 * version with a measured before/after (item 21: a fabricated `[CURRENT STATE]`
 * block spoken to the child on 2 of 7 beats, 0 of 7 once the tail forbade
 * announcing the STATE rather than merely reading the tag).
 *
 * This port's tail was the weaker "Never read bracket tags aloud." Nothing here
 * had driven yet, so this is prophylactic rather than a reproduction — but the
 * sweep's ruling is that every port carries it, and the arena's move-on beat is
 * the one where the screen genuinely changes underneath the tutor.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

export interface ArenaCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (item: ArenaItem, opts: ArenaCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to explore pushes and pulls! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[ARENA_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${judgingContract(item)} ${NEVER_PERFORM}`;
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
  return `[ARENA_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${judgingContract(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[ARENA_COMPLETE] Say exactly: "What great force science today! You watched, you thought, and you said what you saw. See you next time!" Then stop — the activity is over.`;

// ── Items — ONE builder for the component and the DI harness ────────────────

export const ACTION_FOR_KIND: Record<ArenaItemKind, string> = {
  observe: 'watch',
  predict: 'predict',
  compare: 'compare',
  design: 'experiment',
};

/** The generator fields an item is built from. Structural subset of
 *  `PushPullChallenge`, so the script module owes the component no import. */
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

/** The accepted-alternate table. It lived in the generator AND in the
 *  component's `resolveSpokenAnswer`, which is two places for the wording the
 *  judging contract publishes as its permissiveness. One place now. */
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
 * The build gate this port did not have.
 *
 * Every drop here is an ask whose ANSWER IS NOT DECISIVE, which is a broken
 * item rather than a hard one: the generator constructs decisive margins
 * (predict ≥1.4× or ≤0.6× of static friction; design clear of the 16–32 N band
 * `designPushSize` is murky inside), but nothing enforced them at the boundary
 * the runner reads, so hand-authored or older payloads could ship a coin flip
 * the child is then corrected for missing.
 *
 * Returns null instead of repairing: an unaskable item is never backfilled, so
 * a high drop rate is a GENERATOR finding surfaced by `droppedChallenges`.
 */
export const itemFromChallenge = (ch: ArenaChallengeLike): ArenaItem | null => {
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
      // Decisive or nothing — the band between is where the sim's own outcome
      // and a five-year-old's reading of it can disagree.
      if (forceN >= frictionN * 1.4) spokenAnswer = 'moves';
      else if (forceN <= frictionN * 0.6) spokenAnswer = 'stays';
      else return null;
      break;
    }
    case 'compare': {
      const object2Name = (ch.object2Name ?? '').trim();
      const weight2 = Number(ch.object2Weight);
      if (!object2Name || !Number.isFinite(weight2) || weight2 <= 0) return null;
      // Equal weights make "which slides farther" unanswerable; equal names make
      // the ask unspeakable ("the Rock and the Rock").
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

  const alternates = ch.type === 'compare'
    ? [headNoun(spokenAnswer)]
    : ALTERNATES[spokenAnswer] ?? [];

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
  };
};

export const itemsFromChallenges = (challenges: ArenaChallengeLike[]): ArenaItem[] =>
  challenges
    .map((ch) => itemFromChallenge(ch))
    .filter((item): item is ArenaItem => item !== null);

// ── The context channel — STIMULUS-SIDE ONLY ────────────────────────────────

/**
 * What is in the arena right now, ANSWER-FREE BY CONSTRUCTION.
 *
 * This replaced an `expectedAnswer` key that pushed the graded spoken answer
 * into the persistent state block on every item — and the catalog's
 * `taskDescription` then rendered it as a sentence ("The correct spoken answer:
 * push."), so the tutor held the answer in prose for the whole session while the
 * child was still being asked for it. It was redundant (the per-turn judging
 * contract inside the cue names the answer, scoped to the turn that needs it)
 * and it is the exact text 19h-i-a caught a model NARRATING to a child.
 *
 * counting-board's `targetCount` was the same defect; this one was worse, since
 * a number in a state block still has to be read as an answer, and this said
 * "the correct spoken answer" in words.
 */
export const stimulusFor = (item: ArenaItem): string => {
  switch (item.kind) {
    case 'predict':
      return `the ${item.objectName} resting on ${item.surfaceSpoken}, with a push about to run`;
    case 'compare':
      return `the ${item.objectName} and the ${item.object2Name} side by side, waiting for the same push`;
    case 'design':
      return `the ${item.objectName} on ${item.surfaceSpoken}, with force controls to try`;
    default:
      return `the ${item.objectName} on ${item.surfaceSpoken}, and a force about to run`;
  }
};

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything push-pull-arena ever sends the tutor. `PushPullArena.tsx` spreads
 * this and adds what only a mounted component can own (status lines, and the
 * `diagnosisObservation` that reads the live arena); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 *
 * The split exists so the harness cannot drift from production — and it had
 * already drifted here: the di-script suite carried a hand-rolled `packOf`
 * literal that could go green while production sent something else.
 */
export const pushPullArenaPackBase = (
  items: ArenaItem[],
): JudgedCueSurface<ArenaItem> => ({
  primitiveType: 'push-pull-arena',
  activityLine: 'live direct instruction pushes-and-pulls practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    // compare names BOTH objects here, never just the primary one. Its answer
    // is which of the two slides farther, and `item.objectName` is the primary
    // object — which on half the draws IS the answer, sitting alone in a state
    // block key. A two-way discrimination may show the state block both
    // candidates or neither; naming one is naming the answer half the time.
    objectName: item.kind === 'compare'
      ? `${item.objectName} and ${item.object2Name}`
      : item.objectName,
    surface: item.surfaceSpoken,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

/**
 * The span of the ask inside which the answer legitimately appears.
 *
 * EVERY mode here closes on a two-word spoken menu, so the answer word is in
 * the ask by construction — naming both choices is not a leak (the child must
 * discriminate), naming ONE would be. A flat `leakTokens: []` would say the
 * same thing by emptying the oracle; subtracting the menu keeps it sharp, so an
 * answer that turns up in the greeting, the how-to-play or the hand-over is
 * still a HIGH. That is what caught predict's how-to-play saying "before
 * anything moves" on a `moves` item.
 */
export const menuSpanFor = (item: ArenaItem): string => {
  switch (item.kind) {
    case 'predict':
      return 'Will it move, or stay? Say moves, or stays.';
    case 'compare':
      return `The ${item.objectName} and the ${item.object2Name} get the same push.`;
    case 'design':
      return 'Say big, or little.';
    default:
      return 'Was that a push, or a pull?';
  }
};

export interface ArenaHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  leakTokens: string[];
  leakExemptSpan?: string;
}

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `wrongLooksRight` above CLAIMS the judge
 * refuses these, and this is the claim made testable. Change one, change both.
 *
 * Each mode's signature wrong is its named miss, said the way a fluent child
 * says it — not a random wrong word. observe describes the motion it saw
 * instead of naming the force; predict restates the setup instead of
 * committing; compare names the heavier object AND gives the misconception as
 * its reason, which is the utterance most likely to talk a judge into it; design
 * reports the experiment rather than the push size it called for.
 */
export const pushPullArenaHarnessAnswers = (item: ArenaItem): ArenaHarnessAnswers => {
  const base = {
    correct: item.spokenAnswer,
    leakTokens: [item.spokenAnswer],
    leakExemptSpan: menuSpanFor(item),
  };

  switch (item.kind) {
    case 'predict':
      return {
        ...base,
        plainWrong: item.spokenAnswer === 'moves' ? 'stays' : 'moves',
        signatureWrong: {
          text: `it is on ${item.surfaceSpoken}`,
          why: 'the setup restated instead of a commitment — the contract names it as not an answer',
        },
      };
    case 'compare': {
      const other = otherObjectName(item);
      return {
        ...base,
        plainWrong: other.toLowerCase(),
        signatureWrong: {
          text: `the ${other}, because it is heavier`,
          why: 'the heavier-slides-farther misconception WITH its reasoning — fluent, confident, and the contract\'s named miss',
        },
      };
    }
    case 'design':
      return {
        ...base,
        plainWrong: item.spokenAnswer === 'big' ? 'little' : 'big',
        signatureWrong: {
          text: 'I tried it and it moved',
          why: 'the experiment reported instead of a push size — design\'s named miss',
        },
      };
    default:
      return {
        ...base,
        plainWrong: item.spokenAnswer === 'push' ? 'pull' : 'push',
        signatureWrong: {
          text: 'it went that way',
          why: 'the motion described in other words — the contract asks for the force WORD',
        },
      };
  }
};
