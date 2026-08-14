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
  frameVerdictCue,
  itemFromChallenge,
  tenFrameHarnessAnswers,
  tenFramePackBase,
  type TenFrameBand,
  type TenFrameChallengeLike,
  type TenFrameItem,
} from '@/components/lumina/primitives/visual-primitives/math/tenFrameScript';
import {
  interactiveBookHarnessAnswers,
  interactiveBookPackBase,
  itemsFromChallenges as interactiveBookItems,
  tapVerdictCue as interactiveBookTapVerdictCue,
  type InteractiveBookChallengeLike,
  type InteractiveBookItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/interactiveBookScript';

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
  context: Record<string, string>;
  answers: DiHarnessAnswers;
  /**
   * Gesture items commit a placement and the MATCH IS COMPUTED IN CODE, so
   * these two cues hand the tutor its verdict rather than asking it to judge.
   * Replaying them tests cue compliance, never the judge.
   */
  gestureVerdict?: { correct: string; wrong: string };
  pronounceCue?: string;
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
  answersFor: (item: Item) => DiHarnessAnswers;
  /** Only for packs with gesture items. The commit payload is whatever the
   *  port's gesture carries: a placed COUNT (ten-frame) or the tapped print
   *  TEXT (interactive-book) — `answersFor` supplies the matching shape. */
  gestureVerdictCue?: (item: Item, gesture: number | string) => string;
}

const tenFrameAdapter: DiPortAdapter<TenFrameItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as TenFrameChallengeLike[];
    const band = ((data.gradeBand as TenFrameBand) ?? 'K') as TenFrameBand;
    const capacity = data.mode === 'double' ? 20 : 10;
    const items = challenges
      .map((ch) => itemFromChallenge(ch, { capacity, band }))
      .filter((item): item is TenFrameItem => item !== null);
    return { items, dropped: challenges.length - items.length, surface: tenFramePackBase(items) };
  },
  answersFor: tenFrameHarnessAnswers,
  gestureVerdictCue: (item, gesture) =>
    frameVerdictCue(item, typeof gesture === 'number' ? gesture : Number(gesture) || 0),
};

/**
 * interactive-book (fourteenth literacy port). Gesture commits carry the TAPPED
 * PRINT TEXT, not a count, and the wrong tap must be a real printed candidate
 * from the same page — the items deliberately do not carry the candidate list
 * (the stage renders real page hotspots, not a menu), so `build` records one
 * wrong candidate per challenge for `answersFor` to hand the harness.
 */
const interactiveBookWrongTaps = new Map<string, string>();
const interactiveBookAdapter: DiPortAdapter<InteractiveBookItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as InteractiveBookChallengeLike[];
    interactiveBookWrongTaps.clear();
    for (const ch of challenges) {
      const wrong = (ch.optionTexts ?? []).find(
        (option) => option.trim().toLowerCase() !== (ch.targetText ?? '').trim().toLowerCase(),
      );
      if (wrong) interactiveBookWrongTaps.set(ch.id, wrong);
    }
    const items = interactiveBookItems(challenges);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: interactiveBookPackBase(items),
    };
  },
  answersFor: (item) =>
    interactiveBookHarnessAnswers(item, interactiveBookWrongTaps.get(item.id)),
  gestureVerdictCue: (item, gesture) => interactiveBookTapVerdictCue(item, String(gesture)),
};

/**
 * Ports the judged-loop harness can drive. One entry per `/add-di-loop` port.
 *
 * The cast erases the per-port item type: the plan builder only ever reads the
 * four fields every judged item has (`JudgedScriptItem`), and the adapter's own
 * closures keep their concrete type internally.
 */
export const DI_PORTS: Record<string, DiPortAdapter<JudgedScriptItem>> = {
  'ten-frame': tenFrameAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'interactive-book': interactiveBookAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
};

export const isDiPort = (componentId: string): boolean => componentId in DI_PORTS;

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

export function buildDiDrivePlan(
  componentId: string,
  data: Record<string, unknown>,
  gradeLevel: string,
): DiDrivePlan {
  const adapter = DI_PORTS[componentId];
  if (!adapter) {
    throw new Error(
      `"${componentId}" has no DI drive adapter. Judged-loop ports register in `
      + 'service/qa/di/diDrivePlan.ts (DI_PORTS) by naming their exported cue '
      + 'surface and answer material — never by re-declaring cues.',
    );
  }

  const { items, dropped, surface } = adapter.build(data);
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
      correctionLine: item.answerKind === 'voice' ? spans[2] : undefined,
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
  };
}
