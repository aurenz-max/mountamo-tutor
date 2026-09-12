/**
 * syllableClapperModes — the three TASK IDENTITIES of the syllable pack.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────
 * The DI port shipped 2026-08-16 with `evalModes` of `easy` / `medium` / `hard`.
 * Those are WORD LENGTHS. One act — hear a word, say how many parts — wearing
 * three difficulty coats, which is the shape eval modes are specifically not
 * allowed to take: a mode is WHICH SKILL, and length is HOW HARD an instance of
 * one skill is. The cost was not cosmetic. `resolveEvalModes` blends 2-3 modes
 * when a lesson's intent spans them, so a K phonological-awareness objective
 * could resolve to `easy + medium` — a "blend" of two word lengths, which is
 * not a curriculum decision at all, and the resolver had no way to express the
 * one thing the objective actually distinguishes: blending versus segmenting
 * versus deleting.
 *
 * So the three bands became `config.difficulty` (where this primitive's ask
 * scaffolds already lived) and the modes became the three acts a phonological-
 * awareness sequence is actually made of:
 *
 *   blend_syllables  β1.5  the tutor chants the parts, the child says the WORD
 *   count_parts      β2.5  the tutor says the word joined, the child says HOW MANY
 *   delete_compound  β3.5  "say cupcake without cup" — the child says what is LEFT
 *
 * ⭐ THE CHANT CHANGES SIDES, AND THAT IS THE WHOLE DESIGN OF `blend_syllables`.
 * `syllableClapperScript` bans a chanted ask in the strongest terms it has —
 * saying "but … ter … fly" hands the count over, because three beats IS three,
 * and the port's headline finding was that the click era used the chant AS the
 * easy-tier scaffold. None of that applies when the answer is the WORD: the
 * chant is then the stimulus, the count is not what is being asked, and a child
 * who hears three beats still has to blend them into "butterfly". The banned
 * scaffold is this mode's legitimate question, which is also why it sits BELOW
 * counting on the ladder rather than above it — blending is the easier act, and
 * the pack previously had no rung under its own floor.
 *
 * ⭐ THE DELETION ACT IS COMPOUND DELETION, AND IT IS NAMED THAT WAY ON PURPOSE.
 * True syllable deletion — "banana without ba" — leaves "nana", and a judged loop
 * that asks a five-year-old to produce a nonword is asking for an answer neither
 * the child nor the judge can be confident about. What is askable is the rung
 * BELOW it in the standard sequence: take one WORD out of a compound, where the
 * leftover is a word the child already owns. That keeps the answer inside benched
 * `short_spoken_word`, and it is the rung a kindergartener meets first anyway.
 *
 * It was built as `delete_syllable` and the first live probe renamed it. The
 * draw came back with `dragonfly → dragon|fly` and `honeybee → honey|bee`,
 * which are good compound-deletion items and bad syllable splits — "dragon" is
 * two beats. A mode whose content contradicts its name mis-files every attempt
 * it measures, so the name changed rather than the content. Its parts are the
 * compound's two WORDS, gated positively against `COMPOUND_PART_WORDS` in
 * `syllableClapperScript` so that "peanut → pe|anut" — the same probe's other
 * finding — cannot ship.
 *
 * βs are unchanged in MAGNITUDE from the shipped registry (1.5 / 2.5 / 3.5) —
 * only the keys changed — so no student's ability estimate moves by more than
 * the task re-labelling itself implies.
 */
import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
} from '../../../hooks/diModeContract';

/** The task identity. This is `challengeType` on the wire and `evalMode` in the
 *  catalog — 1:1, because every act here is its own skill. */
export type SyllableTask = 'blend_syllables' | 'count_parts' | 'delete_compound';

export const SYLLABLE_TASKS: readonly SyllableTask[] = [
  'blend_syllables',
  'count_parts',
  'delete_compound',
];

export const isSyllableTask = (value: unknown): value is SyllableTask =>
  typeof value === 'string' && (SYLLABLE_TASKS as readonly string[]).includes(value);

/** What the mode needs of a word, checked in code by `itemFromChallenge`. */
export interface SyllableTaskShape {
  /** Fewest syllable parts an item of this mode may have. */
  partsMin: number;
  /** Most syllable parts an item of this mode may have. */
  partsMax: number;
  /** The challenge must name a part to remove and the real word left behind,
   *  and both parts must be ordinary words (`COMPOUND_PART_WORDS`). */
  needsResidue: boolean;
}

export interface SyllablePlanItem {
  id: string;
  challengeType: string;
  /** The fully built child-directed ask, composed by `syllableClapperScript`. */
  ask: string;
  /** What the child says: a count word, the blended word, or the residue. */
  answer: string;
}

const mode = defineDiMode<SyllablePlanItem, SyllableTaskShape>();

export const SYLLABLE_CLAPPER_MODES = defineDiModes<SyllablePlanItem, SyllableTaskShape>(
  mode({
    evalMode: 'blend_syllables',
    label: 'Put the Parts Together',
    beta: 1.5,
    scaffoldingMode: 1,
    challengeTypes: ['blend_syllables'],
    description:
      'Syllable blending. The tutor says a word one part at a time with a clear pause between '
      + 'the parts, and the child says the whole word. The easiest act in the pack: the parts are '
      + 'given and the child supplies only the join.',
    affordances: { answers: ['spoken'] },
    metadata: { partsMin: 2, partsMax: 4, needsResidue: false },
    challengeDocs: {
      blend_syllables: {
        promptDoc:
          '"blend_syllables": The tutor says the parts one at a time ("but … ter … fly") and the '
          + 'child says the whole word. Use 2-4 part words that are concrete, picturable and '
          + 'instantly recognisable by ear once joined. The word is the ANSWER, so it is never '
          + 'shown — choose words a child knows by sound, not by sight.',
        schemaDescription: "'blend_syllables' — hear the parts, say the whole word",
      },
    },
    responseClass: 'short_spoken_word',
    answerStepId: 'answer',
    groupingKey: () => 'blend_syllables',
    steps: [{
      id: 'answer',
      actionId: 'blend_syllables',
      label: 'Say the Word',
      icon: '🔗',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening for your word.',
    }],
  }),
  mode({
    evalMode: 'count_parts',
    label: 'Clap and Count',
    beta: 2.5,
    scaffoldingMode: 2,
    challengeTypes: ['count_parts'],
    description:
      'Syllable segmenting. The tutor says a word as one joined stream, the child claps its parts '
      + 'with their own hands and says how many parts they heard. The count is spoken, never '
      + 'tapped: a tally the child does not have to hold is the count done for them.',
    affordances: { answers: ['spoken'] },
    metadata: { partsMin: 1, partsMax: 5, needsResidue: false },
    challengeDocs: {
      count_parts: {
        promptDoc:
          '"count_parts": The tutor says the word joined and naturally; the child claps the parts '
          + 'and says HOW MANY. 1-5 parts. Every word must have one syllable count all English '
          + 'speakers agree on — a word two teachers would clap differently has no answer to grade.',
        schemaDescription: "'count_parts' — hear the word, say how many parts",
      },
    },
    responseClass: 'number_word_to_20',
    answerStepId: 'answer',
    groupingKey: () => 'count_parts',
    steps: [{
      id: 'answer',
      actionId: 'count_parts',
      label: 'Say How Many',
      icon: '👏',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening for your number.',
    }],
  }),
  mode({
    evalMode: 'delete_compound',
    label: 'Take a Part Away',
    beta: 3.5,
    scaffoldingMode: 3,
    challengeTypes: ['delete_compound'],
    description:
      'Compound-word deletion — the hardest act in the pack, because the child must hold the whole '
      + 'word, find one part inside it, and say what is left. Two-part compounds only, both parts '
      + 'ordinary words ("say cupcake without cup"), so the answer is always a word a child can say. '
      + 'True syllable deletion is deliberately NOT this mode: "banana without ba" leaves a nonword, '
      + 'which a judged loop cannot score honestly.',
    affordances: { answers: ['spoken'] },
    metadata: { partsMin: 2, partsMax: 2, needsResidue: true },
    challengeDocs: {
      delete_compound: {
        promptDoc:
          '"delete_compound": The tutor says a two-part COMPOUND word and names one part to take '
          + 'away; the child says the part that is left. BOTH parts must be ordinary words a '
          + 'five-year-old knows on their own (cupcake → cup + cake, bedroom → bed + room, raincoat '
          + '→ rain + coat, dragonfly → dragon + fly). The parts are WORDS, not syllables: a part '
          + 'may be two beats long, and a split that leaves a non-word ("peanut → pe + anut") is '
          + 'rejected in code. Supply "removePart" (the part taken away) and "residue" (the word '
          + 'left behind) — each must be exactly one of the two parts.',
        schemaDescription: "'delete_compound' — say the compound without one of its words",
      },
    },
    responseClass: 'short_spoken_word',
    answerStepId: 'answer',
    groupingKey: () => 'delete_compound',
    steps: [{
      id: 'answer',
      actionId: 'delete_compound',
      label: 'Say What Is Left',
      icon: '✂️',
      answerKind: 'voice',
      instruction: (item) => item.ask,
      checkingInstruction: 'Listening for your word.',
    }],
  }),
);

export const SYLLABLE_CLAPPER_EVAL_MODES = evalModeDefinitionsFromDiModes(SYLLABLE_CLAPPER_MODES);
export const SYLLABLE_CLAPPER_TYPE_DOCS = challengeTypeDocsFromDiModes(SYLLABLE_CLAPPER_MODES);

export const syllableClapperModePlan = (item: SyllablePlanItem) =>
  buildDiModePlan(SYLLABLE_CLAPPER_MODES, item);

/** The part-count window and residue requirement for one task. */
export const syllableTaskShape = (task: SyllableTask): SyllableTaskShape => {
  const found = SYLLABLE_CLAPPER_MODES.find((m) => m.evalMode === task);
  if (!found?.metadata) throw new Error(`No syllable task shape for ${task}`);
  return found.metadata;
};
