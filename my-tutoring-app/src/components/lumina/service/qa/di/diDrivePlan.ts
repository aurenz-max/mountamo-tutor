import { buildSequencerItems, sequencerPackBase, sequencerHarnessAnswers, sequencerOrderCue, type SequencerItem } from '../../../primitives/visual-primitives/math/numberSequencerScript';
import type { NumberSequencerChallenge } from '../../../primitives/visual-primitives/math/NumberSequencer';
/**
 * diDrivePlan — the judged loop, serialized so a headless student can drive it.
 *
 * WHY THIS EXISTS (qa/di/BACKLOG.md item 19h(i)): the only gate that has ever
 * exercised the JUDGE is a human sitting with a microphone, which is why the
 * open mic rows (#82-#98) accumulate faster than they drain. `run_tutor_live.py`
 * could already hold a real Gemini Live session — but it knew nothing about the
 * DI shape (its own cvc journey docblock records "zero DI_* tags anywhere in
 * this file"), and every journey in it re-typed the component's cue templates in
 * Python, which is a second source of truth for the exact strings the pedagogy
 * lives in.
 *
 * So the cues cross the wire instead. This module runs the REAL generator
 * output through the REAL script module — the same `itemFromChallenge` build
 * gates, the same `itemCue`, the same judging contract, in the same order the
 * runner sends them — and emits a plan the harness replays verbatim. Nothing
 * about the tutor's side of the session is simulated: it is the production
 * prompt, the production cue, and the production Live model.
 *
 * WHAT THE STUDENT SENDS BACK IS TEXT, AND THAT IS THE ONE SUBSTITUTION.
 * A spoken answer would need TTS on the way in and would then be testing our
 * synthesizer's diction as much as the judge. A text turn arrives at Gemini
 * through the same `send_realtime_input` floor a student utterance does
 * (`lumina_tutor.py`: `classify_cue` returns "text" for anything untagged, so
 * it is not a cue and arms no mute window) and the judge grades it under the
 * same contract. What that buys and what it does NOT is stated plainly in the
 * skill: this drives the LOOP and the JUDGE'S SEMANTICS — refusal of a wrong
 * answer, affirmation of a right one, leak discipline, sentinel discipline,
 * correction shape — and it does NOT test acoustics, ASR, the mic transport,
 * VAD, or the audio tail. Ear-separability and "can the judge hear a five-year-
 * old say /s/" remain human-drive questions. A green run here retires the
 * SEMANTIC half of a mic row's criteria, never the row.
 *
 * ADDING A PORT is a `DiPortAdapter` in the registry below. The adapter must
 * NOT re-declare cues: it names the port's exported cue surface (`packBase`)
 * and its answer material, both of which live in the script module beside the
 * contract they mirror.
 */

import {
  spokenSpansOf,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type JudgedScriptPack,
} from '@/components/lumina/hooks/judgedScriptContract';
import { checkPackGates } from '@/components/lumina/hooks/judgedScriptContract.testkit';
import { DI_SENTINELS } from '@/components/lumina/hooks/judgedLoopModel';
import {
  itemsFromProblems as kcItemsFromProblems,
  knowledgeCheckHarnessAnswers,
  knowledgeCheckPackBase,
  tapVerdictCue as kcTapVerdictCue,
  type KnowledgeCheckItem,
} from '@/components/lumina/primitives/knowledgeCheckScript';
import type { OpenSetProbe } from './openSetWordBench';
import { numberWordFor } from '@/components/lumina/primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';
import {
  itemsFromChallenges as storyTalkItems,
  storyTalkHarnessAnswers,
  storyTalkPackBase,
  type StoryTalkChallengeLike,
  type StoryTalkItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/storyTalkScript';
import {
  itemsFromTargets as wordBuilderItems,
  wordBuilderHarnessAnswers,
  wordBuilderPackBase,
  type TargetWordLike as WordBuilderTargetLike,
  type WordBuilderComplexity,
  type WordBuilderItem,
  type WordPartLike as WordBuilderPartLike,
} from '@/components/lumina/primitives/visual-primitives/literacy/wordBuilderScript';

// ---------------------------------------------------------------------------
// The plan a harness replays
// ---------------------------------------------------------------------------

/** What a right and a wrong child sound like on one item. */
export interface DiHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Count-committed gestures (ten-frame): how many were placed. */
  placed?: { correct: number; wrong: number };
  /** Text-committed gestures (interactive-book): what the tapped print reads. */
  tapped?: { correct: string; wrong: string };
  /** Answer tokens the spoken ask must not contain. */
  leakTokens: string[];
  /**
   * SCORED BUCKETS — open-set items only, and the reason `--di-bench` exists.
   *
   * `correct`/`plainWrong`/`signatureWrong` is enough to drive a CLOSED item:
   * the judge is handed the exact target and asked to classify against it, so
   * one right answer and one or two wrong ones exercise the whole contract.
   * An OPEN item hands the judge a rule instead, and a rule fails in ways a
   * three-answer probe cannot see — it can accept a nonword, accept the
   * stimulus echoed back, accept an onset match, or quietly re-close the set
   * around the first few words it thought of and refuse a valid rarer one.
   *
   * So an open item carries a KEY: ~11 probes across buckets weighted toward
   * the wrong answers, each with the verdict the contract owes it. The gate is
   * asymmetric and lives in `openSetWordBench.ts` — zero false affirmations in
   * the hard REFUSE buckets, missed valid rhymes reported but not fatal.
   */
  probes?: OpenSetProbe[];
  /**
   * A span of the ask INSIDE which `leakTokens` may legitimately appear, so the
   * leak scan subtracts it before looking.
   *
   * It exists because story-talk (port 15) was the first pack whose ask carries
   * a STIMULUS that contains the answer by design: the tutor reads a story
   * aloud and the child recalls a detail from it, so the answer word is in the
   * read-aloud or the question is unanswerable. Every earlier port's ask
   * referred to a stimulus on screen, so "the ask must not contain the answer"
   * and "the tutor must not give the answer away" were the same rule; here they
   * come apart. Subtracting the stimulus keeps the oracle STRONGER than
   * silently emptying `leakTokens` would: an answer mentioned in the greeting,
   * the how-to-play, the question or the hand-over is still a HIGH.
   *
   * Omit it wherever the flat rule is true (story-talk's own feeling_check mode
   * omits it — the feeling is absent from the story, so any mention is a leak).
   *
   * ⭐ A LIST, because decodable-reader (port 8) is the first pack with TWO
   * legitimate spans in ONE ask: a read-along choice question reads the whole
   * story aloud (the mode's stimulus) AND names every card (the closed set),
   * with the QUESTION sitting between them. One contiguous span covering both
   * would swallow the question too, and the question is exactly where a tutor
   * that gave the answer away would have done it. The harness subtracts each
   * span in turn; a bare string still works and no earlier port changed.
   */
  leakExemptSpan?: string | string[];
}

export interface DiDriveItem {
  id: string;
  answerKind: 'voice' | 'gesture';
  responseClass: string;
  action?: string;
  /** The cue the runner sends to open this item, byte-identical. */
  cue: string;
  /** The line the tutor is told to speak NOW. */
  askLine: string;
  /** The exact line the contract owes on a correct answer (voice items). */
  affirmLine?: string;
  /** The exact line the contract owes on a wrong answer (voice items). */
  correctionLine?: string;
  /**
   * ⭐ EVERY scripted correction branch, in cue order — specific ones first,
   * the catch-all last, so `correctionLine` is always the last entry here.
   *
   * `correctionLine` alone was a harness DEFECT the moment a pack scripted more
   * than one correction (qa/di/BACKLOG.md item 27, I1). picture-vocabulary
   * `association` scripts three — echo, category-word, then the general
   * re-model — and each is ~8 words the others do not contain. The harness
   * compared every correction to the ONE general line, so a correctly-fired
   * echo branch scored as 8 words of embellishment: 8 bogus WARNs on the bench
   * and 5 more on the signature drive, with the plain drive as the control that
   * proved it was the instrument (general branch only → zero WARNs).
   *
   * Absent for a pack with a single correction, where the old field is already
   * the whole truth. The harness matches an observed line to its CLOSEST branch
   * and scores compliance against THAT — a pure widening: nothing that passed
   * before can start failing, because a one-branch pack's closest branch is the
   * branch it already used.
   */
  correctionLines?: string[];
  context: Record<string, string>;
  answers: DiHarnessAnswers;
  /**
   * Gesture items commit a placement and the MATCH IS COMPUTED IN CODE, so
   * these two cues hand the tutor its verdict rather than asking it to judge.
   * Replaying them tests cue compliance, never the judge.
   */
  gestureVerdict?: { correct: string; wrong: string };
  pronounceCue?: string;
  /**
   * The same ask with the OPENING and how-to-play suppressed — item 0's steady-
   * state form, which no drive ever needs because a drive visits each item once.
   *
   * A BENCH revisits one item ~11 times, and re-sending `cue` to re-open it
   * replays whatever that item's first cue was. On item 0 that is the greeting,
   * the how-to-play AND the code-owned rule model, so the first bench run
   * re-taught "Words rhyme when they end the same way. Listen: bee, tree" before
   * every trial — measuring the judge under more support than production would
   * ever give it, and burning turns on a greeting a child would hear once.
   */
  reanchorCue: string;
  /** Sent when the corrections cap is reached — carries the NEXT item's ask. */
  moveOnCue: string;
}

export interface DiDrivePlan {
  componentId: string;
  primitiveType: string;
  activityLine: string;
  gradeLevel: string;
  audioInput: { manual_activity: boolean };
  /** The engine's verdict openers as TOKEN SEQUENCES, so the harness classifies
   *  a turn exactly the way `judgedLoopModel`'s reducer does rather than
   *  string-matching "Yes," by eye. */
  sentinels: { affirm: string[][]; correct: string[][] };
  maxCorrections: number;
  items: DiDriveItem[];
  completeCue: string;
  /** Challenges the pack's build gates DROPPED — an unaskable item is never
   *  backfilled, so a high drop rate is a generator finding, not a harness one. */
  droppedChallenges: number;
  /**
   * This plan answers a hand-authored bench fixture, not a generation.
   *
   * It rides on the plan rather than being inferred by the harness because a
   * bench run's headline number is different in KIND — it scores verdicts
   * against a key instead of checking that one loop advanced — and a run
   * record that mixed the two would be unreadable.
   */
  isBench?: boolean;
  /**
   * `checkPackGates` run over a pack built from LIVE generated content. This is
   * step-7.3's live probe (the sentinel scan over generated words) folded into
   * the endpoint, so a generator edit can re-run it without a delete-after-run
   * vitest file — 19h(ii), for the ports that have an adapter.
   */
  packGateIssues: string[];
}

// ---------------------------------------------------------------------------
// Port adapters
// ---------------------------------------------------------------------------

export interface DiPortAdapter<Item extends JudgedScriptItem> {
  /** Rebuild the component's items from the generated payload — the SAME
   *  `itemFromChallenge` call, so the same items drop. */
  build: (data: Record<string, unknown>) => {
    items: Item[];
    dropped: number;
    surface: JudgedCueSurface<Item>;
  };
  /**
   * BENCH BUILD — a fixture, not a generation, for ports that carry one.
   *
   * A drive answers real generated content because the loop is what is under
   * test. A BENCH answers a hand-authored fixture because the JUDGE is what is
   * under test, and that needs a key known-correct before the run starts.
   * `openSetWordBench.ts` states the argument in full: our own generator put
   * the nonword "NAKE" in an acceptable-answer list, so a bench keyed off
   * generated material would score a correct refusal as a failure.
   *
   * Ports without one return undefined and `--di-bench` refuses them by name.
   */
  benchBuild?: () => {
    items: Item[];
    surface: JudgedCueSurface<Item>;
  };
  answersFor: (item: Item) => DiHarnessAnswers;
  /** Only for packs with gesture items. The commit payload is whatever the
   *  port's gesture carries: a placed COUNT (ten-frame) or the tapped print
   *  TEXT (interactive-book) — `answersFor` supplies the matching shape. */
  gestureVerdictCue?: (item: Item, gesture: number | string) => string;
}

const numberSequencerAdapter: DiPortAdapter<SequencerItem> = {
  build: data => {
    const { items, droppedChallenges } = buildSequencerItems((data.challenges ?? []) as NumberSequencerChallenge[]);
    return { items, dropped: droppedChallenges, surface: sequencerPackBase(items) };
  },
  answersFor: sequencerHarnessAnswers,
  gestureVerdictCue: (item, gesture) => sequencerOrderCue(item, String(gesture).split(',').map(Number)),
};

/**
 * story-talk (fifteenth literacy port). ALL-VOICE — the picture menu is deleted,
 * so there is no `gestureVerdictCue` and every item is judged from the answer
 * text. Its signature wrong is the same-category near miss the deleted menu used
 * to display (another animal, another feeling), which is exactly the
 * discrimination `wrongClauseFor` claims: driving it is what turns that clause
 * from prose into evidence.
 */
const storyTalkAdapter: DiPortAdapter<StoryTalkItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as StoryTalkChallengeLike[];
    const items = storyTalkItems(challenges);
    return { items, dropped: challenges.length - items.length, surface: storyTalkPackBase(items) };
  },
  answersFor: storyTalkHarnessAnswers,
};

/**
 * word-builder — the FIRST judged port above the K-2 band (grades 3-8
 * morphology). ALL-VOICE across all four complexity tiers, so there is no
 * gesture commit; the tiers are DIFFICULTY, not task identities, so one session
 * is one `action` and the how-to-play is spoken once.
 *
 * ⚠️ Its `build` reads TWO fields, not one. Every other adapter maps
 * `data.challenges`; a word-builder item is a target word joined to the shared
 * `availableParts` pool, and the pool is where the morphemes and their meanings
 * live — an adapter that passed only the targets would build zero items and
 * report the generator as broken.
 *
 * What is different about its answer material:
 *
 *  1. **`plainWrong` is a real morphology error rather than an unrelated
 *     token.** It is the parts IN THE WRONG ORDER ("fulhelpun"), which is the
 *     one miss the printed board cannot help with — the cards say what each
 *     part MEANS and nothing about where it goes. Every other port's plain
 *     wrong is arbitrary; this one drives the ordering half of the skill.
 *  2. **The signature wrong is the ROOT said straight back** ("help" for
 *     unhelpful, "scope" for telescope) — picture-vocabulary's base-word shape,
 *     sharpened by the board: the root is a real word, it is printed in front
 *     of the child, it carries the target's core meaning, and the tutor's own
 *     correction says what it means out loud. A judge listening for "did they
 *     say something from the parts" affirms it.
 *  3. **The leak oracle is FLAT with no exemption anywhere.** The two ports
 *     before it needed one because their answer was a single character; a
 *     multi-syllable word collides with nothing, the ask never says it, and the
 *     build gate drops any clue or context sentence that contains it.
 */
const wordBuilderAdapter: DiPortAdapter<WordBuilderItem> = {
  build: (data) => {
    const targets = (data.targets ?? []) as WordBuilderTargetLike[];
    const pool = (data.availableParts ?? []) as WordBuilderPartLike[];
    const complexity = ((data.complexityLevel as WordBuilderComplexity)
      ?? 'compound_affix') as WordBuilderComplexity;
    const items = wordBuilderItems(targets, pool, complexity);
    return {
      items,
      dropped: targets.length - items.length,
      surface: wordBuilderPackBase(items),
    };
  },
  answersFor: wordBuilderHarnessAnswers,
};

/**
 * Ports the judged-loop harness can drive. One entry per `/add-di-loop` port.
 *
 * The cast erases the per-port item type: the plan builder only ever reads the
 * four fields every judged item has (`JudgedScriptItem`), and the adapter's own
 * closures keep their concrete type internally.
 */
/**
 * knowledge-check (item 23 slice 2) — the first CROSS-CUTTING port: not a
 * subject primitive but the closing assessment carrier, so one payload mixes
 * up to five judged kinds (true_false / choice / choice_tap / blank / match /
 * sort) and ONE gesture (`choice_tap`, the point-at-a-KaTeX-choice fork).
 *
 * ⚠️ ITS BUILD IS ALL-OR-NOTHING, and the adapter mirrors it. Completion is
 * gated per problem (`::pN`), so the component refuses a judged session that
 * cannot ask every problem — a set with a sequencing/scenario problem, or one
 * whose only MCQ failed the leak gate, runs as taps instead. The adapter
 * returns ZERO items for those payloads (never a partial session the child
 * would not get), and `dropped` then counts every candidate.
 *
 * The signature wrongs are per kind, each one the miss its own contract names:
 * a fragment of the STATEMENT on true_false (engaged-sounding, judges
 * nothing), a word-bank distractor on blank (on screen, on topic, wrong), the
 * focus item said back on sort/match (fluent non-placement), the short form
 * of a WRONG card on choice (the accept clause pointed at the wrong option).
 */
const knowledgeCheckAdapter: DiPortAdapter<KnowledgeCheckItem> = {
  build: (data) => {
    const problems = (data.problems ?? []) as import('../../../types').ProblemData[];
    const { items, judgedViable, dropped } = kcItemsFromProblems(problems);
    return {
      items: judgedViable ? items : [],
      dropped: judgedViable ? dropped : dropped + items.length,
      surface: knowledgeCheckPackBase(judgedViable ? items : []),
    };
  },
  answersFor: knowledgeCheckHarnessAnswers,
  gestureVerdictCue: (item, gesture) =>
    kcTapVerdictCue(item, typeof gesture === 'number' ? gesture : Number(gesture) || 0),
};

export const DI_PORTS: Record<string, DiPortAdapter<JudgedScriptItem>> = {
  'knowledge-check': knowledgeCheckAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'word-builder': wordBuilderAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'number-sequencer': numberSequencerAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'story-talk': storyTalkAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
};

export const isDiPort = (componentId: string): boolean => componentId in DI_PORTS;

/**
 * The template bag a judged-loop port pushes at connect — the pack's own
 * `contextFor` over the first live item — so the tutor-test audit resolves
 * `{{keys}}` against what the RUNNER sends, not a flattened generator payload
 * (a judged primitive has no static `primitiveData` bag). Null when the port
 * is unknown or the generated payload builds no items.
 */
export const diPortContextBag = (
  componentId: string,
  data: Record<string, unknown>,
): Record<string, string> | null => {
  const adapter = DI_PORTS[componentId];
  if (!adapter) return null;
  const { items, surface } = adapter.build(data);
  const first = items[0];
  return first ? surface.contextFor(first) : null;
};

// ---------------------------------------------------------------------------
// Plan assembly
// ---------------------------------------------------------------------------

/**
 * The runner's cue options policy, mirrored: item 0 opens the run and always
 * re-speaks the how-to-play; later items re-speak it only when the ACTION
 * changed, because "what to do" is not a static protocol a non-reader can look
 * up (useJudgedScriptRunner.ts:316-322).
 */
const cueOptionsFor = <Item extends JudgedScriptItem>(items: Item[], index: number) =>
  index === 0
    ? { opening: true, howToPlay: true }
    : { opening: false, howToPlay: items[index - 1]?.action !== items[index]?.action };

export interface DiDrivePlanOptions {
  /** Build from the port's hand-authored BENCH fixture instead of the
   *  generated payload. See `DiPortAdapter.benchBuild`. */
  bench?: boolean;
}

export function buildDiDrivePlan(
  componentId: string,
  data: Record<string, unknown>,
  gradeLevel: string,
  options: DiDrivePlanOptions = {},
): DiDrivePlan {
  const adapter = DI_PORTS[componentId];
  if (!adapter) {
    throw new Error(
      `"${componentId}" has no DI drive adapter. Judged-loop ports register in `
      + 'service/qa/di/diDrivePlan.ts (DI_PORTS) by naming their exported cue '
      + 'surface and answer material — never by re-declaring cues.',
    );
  }
  if (options.bench && !adapter.benchBuild) {
    throw new Error(
      `"${componentId}" has no bench fixture. A bench answers a hand-authored `
      + 'key rather than a generation (DiPortAdapter.benchBuild); only a port '
      + 'benching a response class carries one.',
    );
  }

  const { items, dropped, surface } = options.bench
    ? { ...adapter.benchBuild!(), dropped: 0 }
    : adapter.build(data);
  const pack = surface as unknown as JudgedScriptPack<JudgedScriptItem>;
  const sentinels = surface.sentinels ?? DI_SENTINELS;

  const driveItems: DiDriveItem[] = items.map((item, index) => {
    const opts = cueOptionsFor(items, index);
    const cue = surface.itemCue(item, opts);
    // The family writes its contract in one order: the ask, then the line owed
    // on a right answer, then the line owed on a wrong one. A gesture item's
    // silence contract carries only the ask — nothing is owed until the
    // placement is described — so the verdict spans are legitimately absent.
    const spans = spokenSpansOf(cue);
    const next = items[index + 1] ?? null;
    const moveOnOpts = next
      ? { opening: false, howToPlay: item.action !== next.action }
      : { opening: false, howToPlay: false };

    return {
      id: item.id,
      answerKind: item.answerKind,
      responseClass: item.responseClass,
      action: item.action,
      cue,
      askLine: spans[0] ?? '',
      affirmLine: item.answerKind === 'voice' ? spans[1] : undefined,
      /**
       * THE LAST span, not `spans[2]` — because a pack may script MORE THAN ONE
       * correction and the general case is always written last.
       *
       * rhyme-studio's open production is the first: it scripts a dedicated
       * ECHO correction ("a word cannot rhyme with itself") ahead of the
       * generic one, because the generic line re-models the rime and is a
       * non-sequitur to a child who said the target back — the tutor went off
       * script and lost the verdict sentinel on 5 of 9 items before it existed.
       * The specific branch is written FIRST so the model reaches it before the
       * catch-all "if it is wrong", which means the general line — the one the
       * harness's `plainWrong` should draw — moved to the end.
       */
      correctionLine: item.answerKind === 'voice' ? spans[spans.length - 1] : undefined,
      /**
       * spans[0] is the ask and spans[1] the affirmation — the family writes its
       * contract in that order — so everything from index 2 on is a correction
       * branch. Left `undefined` below three spans so a pack with one
       * correction is byte-identical to what it emitted before item 27.
       */
      correctionLines:
        item.answerKind === 'voice' && spans.length > 2 ? spans.slice(2) : undefined,
      context: surface.contextFor(item),
      answers: adapter.answersFor(item),
      gestureVerdict:
        item.answerKind === 'gesture' && adapter.gestureVerdictCue
          ? (() => {
              const answers = adapter.answersFor(item);
              return {
                correct: adapter.gestureVerdictCue!(
                  item,
                  answers.placed?.correct ?? answers.tapped?.correct ?? 0,
                ),
                wrong: adapter.gestureVerdictCue!(
                  item,
                  answers.placed?.wrong ?? answers.tapped?.wrong ?? 0,
                ),
              };
            })()
          : undefined,
      pronounceCue: surface.pronounceCue?.(item),
      reanchorCue: surface.itemCue(item, { opening: false, howToPlay: false }),
      moveOnCue: surface.moveOnCue(item, next, moveOnOpts),
    };
  });

  return {
    componentId,
    primitiveType: surface.primitiveType,
    activityLine: surface.activityLine,
    gradeLevel,
    audioInput: { manual_activity: true },
    sentinels: { affirm: sentinels.affirm, correct: sentinels.correct },
    maxCorrections: surface.maxCorrections ?? 2,
    items: driveItems,
    completeCue: surface.completeCue(),
    droppedChallenges: dropped,
    packGateIssues: items.length > 0 ? checkPackGates(pack) : ['no items survived the build gates'],
    isBench: options.bench === true,
  };
}
