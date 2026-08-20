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
  addSubHarnessAnswers,
  additionSubtractionScenePackBase,
  equationVerdictCue,
  itemsFromChallenges as addSubItems,
  sceneVerdictCue,
  type AddSubBand,
  type AddSubChallengeLike,
  type AddSubSceneItem,
} from '@/components/lumina/primitives/visual-primitives/math/additionSubtractionSceneScript';
import {
  countingBoardHarnessAnswers,
  countingBoardPackBase,
  handVerdictCue as countingHandVerdictCue,
  itemsFromChallenges as countingBoardItems,
  objectWordFor,
  type CountingChallengeLike,
  type CountingItem,
} from '@/components/lumina/primitives/visual-primitives/math/countingBoardScript';
import {
  bondVerdictCueForPlaced,
  buildBondItems,
  numberBondHarnessAnswers,
  numberBondPackBase,
  type BondBand,
  type NumberBondChallengeLike,
  type NumberBondItem,
} from '@/components/lumina/primitives/visual-primitives/math/numberBondScript';
import {
  buildCompareItems,
  compareObjectsHarnessAnswers,
  compareObjectsPackBase,
  orderCueForPlaced,
  type CompareBand,
  type CompareObjectsChallengeLike,
  type CompareObjectsItem,
} from '@/components/lumina/primitives/visual-primitives/math/compareObjectsScript';
import {
  itemsFromChallenges as solarItems,
  solarHarnessAnswers,
  solarSystemPackBase,
  type SolarBand,
  type SolarBodyLike,
  type SolarChallengeLike,
  type SolarItem,
} from '@/components/lumina/primitives/visual-primitives/astronomy/solarSystemScript';
import {
  gestureVerdictCue as habitatGestureVerdictCue,
  habitatDioramaHarnessAnswers,
  habitatDioramaPackBase,
  itemsFromChallenges as habitatItems,
  type HabitatItem,
} from '@/components/lumina/primitives/visual-primitives/biology/habitatDioramaScript';
import type {
  HabitatChallenge,
  HabitatDioramaData,
  HabitatZone,
} from '@/components/lumina/primitives/visual-primitives/biology/HabitatDiorama';
import {
  buildVerdictCue as placeValueBuildVerdictCue,
  digitAtPlace as pvDigitAtPlace,
  itemsFromChallenges as placeValueItems,
  placeValueHarnessAnswers,
  placeValuePackBase,
  type PlaceValueChallengeLike,
  type PlaceValueItem,
  type PlaceValueMode,
} from '@/components/lumina/primitives/visual-primitives/math/placeValueScript';
import {
  itemsFromChallenges as ordinalLineItems,
  ordinalLineHarnessAnswers,
  ordinalLinePackBase,
  placeCueForPlaced,
  VALID_CONTEXTS as ORDINAL_CONTEXTS,
  type OrdinalBand,
  type OrdinalContext,
  type OrdinalLineChallengeLike,
  type OrdinalLineItem,
} from '@/components/lumina/primitives/visual-primitives/math/ordinalLineScript';
import {
  interactiveBookHarnessAnswers,
  interactiveBookPackBase,
  itemsFromChallenges as interactiveBookItems,
  tapVerdictCue as interactiveBookTapVerdictCue,
  type InteractiveBookChallengeLike,
  type InteractiveBookItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/interactiveBookScript';
import {
  itemFromChallenge as rhymeItemFromChallenge,
  rhymeStudioHarnessAnswers,
  rhymeStudioPackBase,
  type RhymeChallengeLike,
  type RhymeItem,
  type RhymeTier,
} from '@/components/lumina/primitives/visual-primitives/literacy/rhymeStudioScript';
import {
  OPEN_SET_BENCH_STIMULI,
  type OpenSetProbe,
} from './openSetWordBench';
import { ASSOCIATION_BENCH_STIMULI } from './associationBench';
import {
  itemsFromChallenges as storyTalkItems,
  storyTalkHarnessAnswers,
  storyTalkPackBase,
  type StoryTalkChallengeLike,
  type StoryTalkItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/storyTalkScript';
import {
  itemsFromChallenge as wordWorkoutItemsFromChallenge,
  itemsFromChallenges as wordWorkoutItems,
  pictureVerdictCue,
  wordWorkoutHarnessAnswers,
  wordWorkoutPackBase,
  type WordWorkoutChallengeLike,
  type WordWorkoutItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/wordWorkoutScript';
import {
  itemsFromChallenges as pushPullArenaItems,
  pushPullArenaHarnessAnswers,
  pushPullArenaPackBase,
  type ArenaChallengeLike,
  type ArenaItem,
} from '@/components/lumina/primitives/visual-primitives/physics/pushPullArenaScript';
import {
  itemFromChallenge as pictureVocabularyItemFromChallenge,
  itemsFromChallenges as pictureVocabularyItems,
  pictureVocabularyHarnessAnswers,
  pictureVocabularyPackBase,
  tapVerdictCue as pictureVocabularyTapVerdictCue,
  type PictureVocabChallengeLike,
  type PictureVocabItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/pictureVocabularyScript';
import {
  itemsFromChallenges as phonemeExplorerItems,
  phonemeExplorerHarnessAnswers,
  phonemeExplorerPackBase,
  type PhonemeChallengeLike,
  type PhonemeExplorerItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/phonemeExplorerScript';
import {
  itemsFromChallenges as letterSpotterItems,
  letterSpotterHarnessAnswers,
  letterSpotterPackBase,
  tapVerdictCue as letterSpotterTapVerdictCue,
  type LetterSpotterChallengeLike,
  type LetterSpotterItem,
  type LetterSpotterTier,
} from '@/components/lumina/primitives/visual-primitives/literacy/letterSpotterScript';
import {
  itemsFromChallenges as letterSoundLinkItems,
  letterSoundLinkHarnessAnswers,
  letterSoundLinkPackBase,
  tapVerdictCue as letterSoundLinkTapVerdictCue,
  type LetterSoundChallengeLike,
  type LetterSoundItem,
  type LetterSoundTier,
} from '@/components/lumina/primitives/visual-primitives/literacy/letterSoundLinkScript';
import {
  itemsFromChallenges as shapeSorterItems,
  shapeSorterHarnessAnswers,
  shapeSorterPackBase,
  type ShapeSorterChallengeLike,
  type ShapeSorterItem,
} from '@/components/lumina/primitives/visual-primitives/math/shapeSorterScript';
import {
  itemsFromChallenge as wordSorterItemsFromChallenge,
  itemsFromChallenges as wordSorterItems,
  wordSorterHarnessAnswers,
  wordSorterPackBase,
  type WordSorterChallengeLike,
  type WordSorterItem,
  type WordSorterTier,
} from '@/components/lumina/primitives/visual-primitives/literacy/wordSorterScript';
import {
  itemsFromTargets as wordBuilderItems,
  wordBuilderHarnessAnswers,
  wordBuilderPackBase,
  type TargetWordLike as WordBuilderTargetLike,
  type WordBuilderComplexity,
  type WordBuilderItem,
  type WordPartLike as WordBuilderPartLike,
} from '@/components/lumina/primitives/visual-primitives/literacy/wordBuilderScript';
import {
  itemsFromChallenges as syllableClapperItems,
  syllableClapperHarnessAnswers,
  syllableClapperPackBase,
  type SyllableChallengeLike,
  type SyllableClapperItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/syllableClapperScript';
import {
  decodableReaderHarnessAnswers,
  decodableReaderPackBase,
  itemsFromChallenges as decodableReaderItems,
  type DecodableReaderItem,
  type DecodableReaderPayload,
} from '@/components/lumina/primitives/visual-primitives/literacy/decodableReaderScript';
import {
  itemsFromPayload as textStructureItems,
  textStructureAnalyzerHarnessAnswers,
  textStructureAnalyzerPackBase,
  type TextStructureItem,
  type TextStructurePayloadLike,
} from '@/components/lumina/primitives/visual-primitives/literacy/textStructureAnalyzerScript';
import {
  genreExplorerHarnessAnswers,
  genreExplorerPackBase,
  itemsFromPayload as genreExplorerItems,
  type GenreExplorerItem,
  type GenreExplorerPayloadLike,
} from '@/components/lumina/primitives/visual-primitives/literacy/genreExplorerScript';
import {
  sentenceAnalyzerHarnessAnswers,
  sentenceAnalyzerPackBase,
  itemsFromPayload as sentenceAnalyzerItems,
  type SentenceAnalyzerItem,
  type SentenceAnalyzerPayloadLike,
} from '@/components/lumina/primitives/visual-primitives/literacy/sentenceAnalyzerScript';
import {
  itemsFromChallenges as sortingStationItemsFromChallenges,
  sortingStationHarnessAnswers,
  sortingStationPackBase,
  type SortingStationItem,
  type SortingChallengeLike,
} from '../../../primitives/visual-primitives/math/sortingStationScript';
import {
  cellVerdictCue as periodicTableCellVerdictCue,
  itemsFromChallenges as periodicTableItems,
  periodicTableHarnessAnswers,
  periodicTablePackBase,
  type PeriodicChallengeLike,
  type PeriodicTableItem,
  type PeriodicTier,
} from '../../../primitives/chemistry-primitives/periodicTableScript';
import {
  itemsFromChallenges as statesOfMatterItems,
  statesOfMatterHarnessAnswers,
  statesOfMatterPackBase,
  type StatesBand,
  type StatesChallengeLike,
  type StatesOfMatterItem,
  type StatesTier,
} from '../../../primitives/visual-primitives/chemistry/statesOfMatterScript';

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
 * number-bond (third math port). Gesture commits carry a NUMBER whose encoding
 * is internal to numberBondScript — decompose packs the pair as left×100+right;
 * fact-family and build-equation use 1 for a correct commit and 0 for a wrong
 * one, because what they commit is a whole written form, not a quantity.
 */
const numberBondAdapter: DiPortAdapter<NumberBondItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as NumberBondChallengeLike[];
    const band: BondBand = data.gradeBand === '1' ? '1' : 'K';
    const maxNumber = typeof data.maxNumber === 'number' ? data.maxNumber : band === 'K' ? 5 : 10;
    const { items, droppedChallenges } = buildBondItems(challenges, { band, maxNumber });
    return { items, dropped: droppedChallenges, surface: numberBondPackBase(items) };
  },
  answersFor: numberBondHarnessAnswers,
  gestureVerdictCue: (item, gesture) =>
    bondVerdictCueForPlaced(item, typeof gesture === 'number' ? gesture : Number(gesture) || 0),
};

/**
 * compare-objects (fourth math port). Three spoken modes and one hands mode.
 * The gesture commit carries an ORDER, which `orderCueForPlaced` encodes as one
 * number — 1 = the correct order, 0 = the REVERSED order, which is the ordering
 * mode's own signature error rather than an arbitrary wrong shape.
 *
 * The spoken modes are where this adapter earns its keep: `compare_two`'s
 * `signatureWrong` is the direction reversal (the other object, named
 * confidently) and `non_standard`'s is the off-by-one — the two claims
 * `discriminationFor` makes, driven rather than asserted.
 */
const compareObjectsAdapter: DiPortAdapter<CompareObjectsItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as CompareObjectsChallengeLike[];
    const band: CompareBand = data.gradeBand === '1' ? '1' : 'K';
    const { items, droppedChallenges } = buildCompareItems(challenges, { band });
    return { items, dropped: droppedChallenges, surface: compareObjectsPackBase(items) };
  },
  answersFor: compareObjectsHarnessAnswers,
  gestureVerdictCue: (item, gesture) =>
    orderCueForPlaced(item, typeof gesture === 'number' ? gesture : Number(gesture) || 0),
};

/**
 * solar-system-explorer — the FIRST SCIENCE port, and an all-spoken pack:
 * every answer is a planet's name (`short_spoken_word`), so there is no
 * gesture cue builder at all. The adapter earns its keep on the signature
 * errors `discriminationFor` claims the judge refuses: the closest/farthest
 * reversal, the count-the-Sun off-by-one, "the Sun" for the biggest PLANET,
 * the closest-is-hottest trap, and the big-means-gas-giant conflation —
 * driven rather than asserted, one per facet from the item itself.
 */
const solarSystemAdapter: DiPortAdapter<SolarItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as SolarChallengeLike[];
    const bodies = (data.bodies ?? []) as SolarBodyLike[];
    const g = String(data.gradeLevel ?? '3');
    const rung: SolarBand = (['K', '1', '2', '3', '4', '5'] as const).includes(g as SolarBand)
      ? (g as SolarBand)
      : '3';
    const { items, droppedChallenges } = solarItems(challenges, { bodies, rung });
    return { items, dropped: droppedChallenges, surface: solarSystemPackBase(items) };
  },
  answersFor: solarHarnessAnswers,
};

/**
 * habitat-diorama — the ecosystem field-lab port. Observe, predict, and
 * defend are spoken closed choices; connect and restore commit the model move
 * itself. String gesture payloads are the selected destination ID or habitat
 * zone, matching the component's page-work exactly.
 */
const habitatDioramaAdapter: DiPortAdapter<HabitatItem> = {
  build: (data) => {
    const habitatData = data as unknown as HabitatDioramaData;
    const challenges = (habitatData.challenges ?? []) as HabitatChallenge[];
    const { items, dropped } = habitatItems(challenges, habitatData);
    return { items, dropped, surface: habitatDioramaPackBase(items) };
  },
  answersFor: habitatDioramaHarnessAnswers,
  gestureVerdictCue: (item, gesture) => item.kind === 'connect'
    ? habitatGestureVerdictCue(item, { fromId: item.fromId, toId: String(gesture) })
    : habitatGestureVerdictCue(item, { zone: String(gesture) as HabitatZone }),
};

/**
 * ordinal-line (sixth math port). Four spoken modes and one hands mode, and the
 * FIRST adapter whose answer material forks by BAND inside one eval mode:
 * `identify` at Kindergarten answers with a character NAME and at Grade 1 with a
 * PLACE WORD, so `build` has to read `gradeBand` off the payload or half the
 * drive tests the wrong contract.
 *
 * It is also the first math adapter where a challenge is not an item: a match
 * grid expands to one judged ask PER SYMBOL, so `dropped` counts CHALLENGES that
 * produced nothing rather than the items/challenges difference.
 *
 * The spoken modes are where it earns its keep. `discriminationFor` makes two
 * claims and both are driven rather than asserted: the WRONG-END count (the line
 * counted from the back — this primitive's #1 recorded misconception, computed
 * per item as `n + 1 - k`) and CARDINAL-FOR-ORDINAL ("three" for "third"), which
 * the contract refuses on purpose because it is the confusion the ordinal modes
 * exist to undo. `relative_position`'s signature wrong is neither: it is the
 * ANCHOR the question points at, named by a learner who found it and stopped.
 */
const ordinalLineAdapter: DiPortAdapter<OrdinalLineItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as OrdinalLineChallengeLike[];
    const band: OrdinalBand = data.gradeBand === '1' ? '1' : 'K';
    const raw = String(data.context ?? 'race');
    const context: OrdinalContext =
      (ORDINAL_CONTEXTS as readonly string[]).includes(raw) ? (raw as OrdinalContext) : 'race';
    const { items, droppedChallenges } = ordinalLineItems(challenges, { band, context });
    return { items, dropped: droppedChallenges, surface: ordinalLinePackBase(items) };
  },
  answersFor: ordinalLineHarnessAnswers,
  gestureVerdictCue: (item, gesture) =>
    placeCueForPlaced(item, typeof gesture === 'number' ? gesture : Number(gesture) || 0),
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
 * word-workout (sixteenth literacy port). MIXED, and the first adapter where a
 * challenge is not an item: a chain expands to a judged read per word and a
 * sentence to a read plus a spoken question, so `dropped` counts CHALLENGES
 * that produced nothing rather than the items/challenges difference.
 *
 * Its gesture commit carries the TAPPED WORD (interactive-book's shape), and
 * its most interesting drive is `real_word`, whose signature wrong is the
 * PSEUDOWORD — the one answer material in the family that is not a word at all.
 */
const wordWorkoutAdapter: DiPortAdapter<WordWorkoutItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as WordWorkoutChallengeLike[];
    const items = wordWorkoutItems(challenges);
    const dropped = challenges.filter(
      (ch) => wordWorkoutItemsFromChallenge(ch).length === 0,
    ).length;
    return { items, dropped, surface: wordWorkoutPackBase(items) };
  },
  answersFor: wordWorkoutHarnessAnswers,
  gestureVerdictCue: (item, gesture) => pictureVerdictCue(item, String(gesture)),
};

/**
 * counting-board (fourth math port, first of the 19h-i-b adapter sweep). Its
 * gesture commit carries a FINGER COUNT — the child taps one of three hand
 * images — so it uses the `placed` shape, but the number means "fingers shown",
 * not "how many were placed on the board".
 *
 * The drive worth having here is `--di-wrong signature` on the counted modes:
 * this pack's contract accepts a count said ALOUD that ends on the target
 * ("the last number said tells the total"), so the signature wrong is a fluent
 * walk that ends one PAST it. That utterance contains the answer word without
 * landing on it, and it is the only wrong answer on this port a string-matching
 * judge affirms.
 */
const countingBoardAdapter: DiPortAdapter<CountingItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as CountingChallengeLike[];
    const objects = (data.objects ?? {}) as { type?: string };
    const objectWord = objectWordFor(objects.type ?? 'custom');
    const items = countingBoardItems(challenges, { objectWord });
    return {
      items,
      dropped: challenges.length - items.length,
      surface: countingBoardPackBase(items),
    };
  },
  answersFor: countingBoardHarnessAnswers,
  gestureVerdictCue: (item, gesture) =>
    countingHandVerdictCue(item, typeof gesture === 'number' ? gesture : Number(gesture) || 0),
};

/**
 * addition-subtraction-scene (fifth math port, 19h-i-b port 2). FIRST adapter
 * whose port has TWO gesture commit shapes at once: `act-out`/`create-story`
 * commit a COUNT of objects on the scene, `build-equation` commits TILES. The
 * wire carries either as `number | string`, so the tile list rides space-joined
 * and is split back here — the same "encoding internal to the script module"
 * arrangement number-bond uses for its packed pair.
 *
 * Its signature wrong is the sharpest in the family so far, because the pack
 * has two different ones: a voice item echoes an operand THE STORY SAID ALOUD
 * (the `discriminationFor` echo clause), and `build-equation` builds the same
 * three numbers into an arithmetically VALID sentence with the story's
 * direction reversed — a miss a judge that never read the story cannot catch.
 */
const additionSubtractionSceneAdapter: DiPortAdapter<AddSubSceneItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as AddSubChallengeLike[];
    const band: AddSubBand = data.gradeBand === '1' ? '1' : 'K';
    const items = addSubItems(challenges, { band });
    return {
      items,
      dropped: challenges.length - items.length,
      surface: additionSubtractionScenePackBase(items),
    };
  },
  answersFor: addSubHarnessAnswers,
  gestureVerdictCue: (item, gesture) =>
    item.kind === 'build-equation'
      ? equationVerdictCue(item, String(gesture).trim().split(/\s+/).filter(Boolean))
      : sceneVerdictCue(item, typeof gesture === 'number' ? gesture : Number(gesture) || 0),
};

/**
 * push-pull-arena (the SCIENCE port, 19h-i-b port 3). ALL-VOICE — the child
 * watches or runs a canvas simulation and answers out loud, so there is no
 * gesture commit and every item is judged from the answer text.
 *
 * What is different about its answer material: every mode closes on a TWO-WORD
 * SPOKEN MENU, so the answer word is inside the ask by construction. That makes
 * it the first port where `leakExemptSpan` covers the QUESTION rather than a
 * stimulus — story-talk subtracts a story it read aloud, this subtracts the menu
 * it must name. The oracle stays live over the greeting, the how-to-play and the
 * hand-over, which is what caught predict's how-to-play saying "before anything
 * moves" on a `moves` item.
 *
 * Its signature wrongs are the four ways a child sounds fluent without
 * answering: describing the motion instead of naming the force, restating the
 * setup instead of committing, naming the heavier object WITH the
 * heavier-slides-farther reason, and reporting the experiment instead of the
 * push size it called for.
 */
const pushPullArenaAdapter: DiPortAdapter<ArenaItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as ArenaChallengeLike[];
    const items = pushPullArenaItems(challenges);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: pushPullArenaPackBase(items),
    };
  },
  answersFor: pushPullArenaHarnessAnswers,
};

/**
 * picture-vocabulary (19h-i-b port 4, and the widest fork in the sweep at SIX
 * eval modes). MIXED, and unusually its fork is a RESPONSE-CLASS ruling rather
 * than a difficulty one: `receptive_match` and `association` tap emoji cards
 * because "what goes with sock" has many honest spoken answers and open-set
 * spoken production is a benched class — so the cards close the answer set while
 * the relation stays the skill. Its gesture commit carries the TAPPED WORD
 * (interactive-book's shape), but the card list rides on the item, so unlike
 * interactive-book no wrong-tap side table is needed here.
 *
 * What is different about its answer material: `receptive_match` is the only
 * item in the family whose ask SAYS THE TARGET ALOUD and is still not a leak —
 * the tutor speaks the word and the child taps its picture, so the word is the
 * question and the picture is the answer. That is the one mode carrying a
 * `leakExemptSpan`; the other five have answer-free asks and keep a flat oracle.
 *
 * Its sharpest drive is `--di-wrong signature` on `opposite`: the signature
 * wrong is the BASE WORD said straight back, which the ask itself spoke seconds
 * earlier, so a judge grading on "did I hear a real word from the prompt"
 * affirms it. `gradable_scale` is that trap one step further — its signature
 * wrong is a rung the tutor read aloud as part of the stimulus.
 */
const pictureVocabularyAdapter: DiPortAdapter<PictureVocabItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as PictureVocabChallengeLike[];
    const items = pictureVocabularyItems(challenges);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: pictureVocabularyPackBase(items),
    };
  },

  /**
   * THE ASSOCIATION BENCH (item 25). Two builds, one surface — rhyme-studio's
   * shape, for rhyme-studio's reason: `build` answers a real generation
   * because the LOOP is what a drive tests, `benchBuild` answers a
   * hand-authored fixture because the JUDGE is what a bench tests, and that
   * needs a key known-correct before the run starts.
   *
   * It goes STRAIGHT THROUGH `itemFromChallenge`, the shipped build gate, so
   * the bench exercises the contract the primitive actually uses rather than a
   * parallel construction of items. Note what that gate now does NOT ask of
   * these challenges: no `options`. Association left `TAP_KINDS`, so the
   * cards-must-contain-the-target check no longer applies to it — which is
   * precisely why the fixture can be written as bare pairs.
   */
  benchBuild: () => {
    const items = ASSOCIATION_BENCH_STIMULI
      .map((s) => pictureVocabularyItemFromChallenge({
        id: s.id,
        type: 'association',
        word: s.partnerWord,
        emoji: s.partnerEmoji,
        baseWord: s.baseWord,
        baseEmoji: s.baseEmoji,
      }))
      .filter((item): item is PictureVocabItem => item !== null);
    return { items, surface: pictureVocabularyPackBase(items) };
  },

  /**
   * ⚠️ PROBES ARE ATTACHED BY ITEM ID ONLY — THERE IS NO FALLBACK MATCH, and
   * that omission is the load-bearing decision here.
   *
   * The rhyme adapter can fall back to matching a GENERATED item against a
   * fixture stimulus by RIME, because one thing genuinely transfers across
   * that match: a hand-checked valid rhyme is a valid rhyme for any word in
   * the family. Nothing transfers here. Whether "cloud" is a rationalised
   * chain or an honest partner depends entirely on the stimulus — it is a
   * chain for `sock` and very nearly a partner for `rain` — so borrowing a
   * probe set across stimuli would manufacture exactly the confident,
   * well-formatted, wrong finding that cost item 24 a verdict three times in
   * one day.
   *
   * A generated association item is still fully DRIVABLE, because
   * `pictureVocabularyHarnessAnswers` derives the only two wrong answers that
   * are stimulus-independent (the echo and a nonword — see its docblock). It
   * just is not SCORED. Scoring needs a human who read the stimulus first.
   */
  answersFor: (item) => {
    const answers = pictureVocabularyHarnessAnswers(item);
    if (item.kind !== 'association') return answers;
    const stimulus = ASSOCIATION_BENCH_STIMULI.find((s) => s.id === item.id);
    return stimulus ? { ...answers, probes: stimulus.probes } : answers;
  },

  /** `receptive_match` is the only gesture mode left in this pack. */
  gestureVerdictCue: (item, gesture) => pictureVocabularyTapVerdictCue(item, String(gesture)),
};

/**
 * phoneme-explorer (19h-i-b port 5). ALL-VOICE across four modes — the 4-choice
 * grid was a costume on every one of them — so there is no gesture commit and
 * every item is judged from the answer text.
 *
 * What is different about its answer material: this is the first port whose
 * answers are not all the same KIND. `segment` answers with a benched number
 * word ("three") while the other three answer with a short spoken word, so one
 * session mixes `number_word_to_20` and `short_spoken_word` response classes and
 * the leak oracle has to hold over both.
 *
 * Its `leakExemptSpan` is narrower than any other port's: not the whole ask
 * (picture-vocabulary) and not a two-word menu (push-pull-arena), but exactly
 * `isolate`'s four-card enumeration clause — and only at the tiers that read it
 * aloud, because the hard tier's ask drops the menu and the flat oracle is
 * correct there. The exemption is issued from the same builder the ask uses.
 *
 * Its sharpest drive is `--di-wrong signature` on `isolate`: the signature wrong
 * is the tutor's OWN EXAMPLE WORD, which genuinely starts with the target sound
 * and was spoken aloud seconds earlier, so a judge grading against the rule it
 * just stated ("does it start with mmm?") affirms it. `blend` is the same trap
 * in the other direction — the separate sounds carry every phoneme of the answer
 * without landing on the word.
 */
const phonemeExplorerAdapter: DiPortAdapter<PhonemeExplorerItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as PhonemeChallengeLike[];
    const items = phonemeExplorerItems(challenges);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: phonemeExplorerPackBase(items),
    };
  },
  answersFor: phonemeExplorerHarnessAnswers,
};

/**
 * letter-spotter (19h-i-b port 6). MIXED, and the first port whose fork is
 * decided by whether the answer HAS a spoken form at all: `name-it` says a
 * letter, while `find-it` answers with a POSITION ("third box, second row" is
 * not an answer a child says) and `match-it` answers with a lowercase FORM
 * (saying "S" would not prove the child knows it). Its gesture commit carries
 * the TAPPED LETTER — interactive-book's `tapped` shape — and both tap modes
 * draw their wrong tap off the item itself, so no side table is needed.
 *
 * What is different about its answer material: the answer is ONE CHARACTER, and
 * that breaks the flat leak oracle every earlier port has used. The harness
 * scans `\b<token>\b` over a lowercased turn, so targets `a` and `i` collide
 * with the article and the pronoun. Two of our own lines were reworded rather
 * than exempted, which leaves the collision only in the GENERATED sentence a
 * name-it ask reads aloud — exempted for exactly those two letters and flat for
 * the other twenty-four. `find-it` carries NO leak tokens at all, and that is
 * not the oracle switched off: the tutor is told the letter (its stimulus) and
 * never told where it is, so the answer is absent from its context entirely.
 *
 * ⚠️ TWO OF THREE MODES CANNOT BE CAP-DRIVEN. `--di-cap` hangs the drill off the
 * first VOICE item, and a session pinned to `find_it` or `match_it` has none —
 * the harness now raises rather than silently running a plain drive. Their
 * `moveOnCue` (which carries no close line, because their corrections already
 * modelled everything they may say) is covered by pack gates, not live.
 */
const letterSpotterAdapter: DiPortAdapter<LetterSpotterItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as LetterSpotterChallengeLike[];
    const tier = (data.supportTier as LetterSpotterTier) ?? 'medium';
    const items = letterSpotterItems(challenges, tier);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: letterSpotterPackBase(items),
    };
  },
  answersFor: letterSpotterHarnessAnswers,
  gestureVerdictCue: (item, gesture) => letterSpotterTapVerdictCue(item, String(gesture)),
};

/**
 * letter-sound-link (19h-i-b port 7). MIXED across three DIRECTIONS of the same
 * mapping, and the only port in the sweep where each direction answers with a
 * different KIND of thing: `see-hear` produces the SOUND (`continuant_sound`),
 * `hear-see` taps the GRAPHEME (`manipulation` — a letter cannot be spoken,
 * `letter_name` is a blocked class), `keyword-match` says the anchor WORD
 * (`short_spoken_word`). Its gesture commit carries the TAPPED LETTER —
 * interactive-book's `tapped` shape — drawn off the item, so no side table.
 *
 * What is different about its answer material, twice over:
 *
 *  1. **The exemption is the DISTAR MODEL, and only where the tier ships one.**
 *     `see-hear`'s answer IS the sound the lead-in says out loud at `easy` and
 *     `medium` — that is standing gate 3, not a leak — so `leakExemptSpan` is
 *     the lead-in itself, issued from the builder the ask uses. At `hard` the
 *     lead-in is empty and the oracle goes FLAT, which is the rung's whole
 *     point and the one place the scan catches the sound arriving through the
 *     catalog or a struggle response.
 *  2. **`hear-see` carries the sweep's second one-character answer, and this
 *     time the collision is with our OWN NOTATION.** `_norm` strips
 *     punctuation, so the stimulus "/t/" becomes the bare token "t" — the
 *     answer letter. For the thirteen letters spoken stretched ("sss", "aaa")
 *     the scan is exact; for the other thirteen no scan can separate the
 *     notation from the answer, so the token is declared off rather than left
 *     to fire on every ask. Narrow, because the tutor is never TOLD the letter.
 *
 * Its sharpest drive is `--di-wrong signature` on `see_hear`: the signature
 * wrong is the LETTER NAME ("ess" for s), which is this primitive's own
 * documented signature error and the exact distinction the whole lesson exists
 * to teach. `keyword_match` is the same trap through the other door — its
 * signature wrong is the SOUND the tutor modelled seconds earlier, on-topic and
 * fluent and naming no picture at all.
 */
const letterSoundLinkAdapter: DiPortAdapter<LetterSoundItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as LetterSoundChallengeLike[];
    const tier = (data.supportTier as LetterSoundTier) ?? 'medium';
    const maxAttempts = typeof data.maxAttempts === 'number' ? data.maxAttempts : undefined;
    const items = letterSoundLinkItems(challenges, tier);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: letterSoundLinkPackBase(items, maxAttempts),
    };
  },
  answersFor: letterSoundLinkHarnessAnswers,
  gestureVerdictCue: (item, gesture) => letterSoundLinkTapVerdictCue(item, String(gesture)),
};

/**
 * decodable-reader (19h-i-b port 8). ALL-VOICE across five modes and THREE
 * kinds of answer, and the first port in the sweep whose items are not all the
 * same SHAPE: a session is the passage read one sentence at a time
 * (`sentence_read_aloud`, the family's only multi-word judged utterance) and
 * then the comprehension questions asked about it — a word from the story said
 * aloud (`short_spoken_word`) or a whole proposition named from the menu the
 * tutor just read out (`closed_set_choice`). Nothing is tapped: the 2026-08-13
 * user ruling took the buttons out, and a `gesture` item appearing here is the
 * regression.
 *
 * What is different about its answer material, three ways over:
 *
 *  1. **The correct answer is a SENTENCE the harness has to say back.** Every
 *     other port's `correct` is a token. Here the plain wrong swaps one CONTENT
 *     word of the printed line (localisable — the contrastive branch) and the
 *     signature wrong swaps one SMALL word ("the" for "a"), which the reading
 *     contract calls the commonest miss there is: it keeps the meaning and the
 *     rhythm, and a judge grading the read on gist affirms it every time.
 *  2. **The choice items answer in the SHORT FORM on the correct beat too.**
 *     The contract's accept side is its whole design — "the mat" for "The cat
 *     sat on the mat" is a full answer, not a lesser one — so the harness says
 *     the short form when it is right, and the signature wrong is that same
 *     shape aimed at a wrong card, which on inference and main-idea is a TRUE
 *     detail of the story as well as a short one.
 *  3. **The read-line leak oracle is the sharpest in the sweep.** It scans the
 *     printed line's own content words with NO exemption: decoding print is the
 *     skill, so print is not the channel and the AUDIO is — which makes the
 *     catalog's `NEVER READ A LINE THE CHILD HAS NOT READ YET` directive
 *     machine-checkable for the first time. The other two forks subtract what
 *     the tutor legitimately says: the story in `read_along` (story-talk's
 *     rule) and the spoken menu on a choice item (push-pull-arena's, one size
 *     up) — and a read-along choice item needs BOTH, which is why
 *     `leakExemptSpan` grew a list form on this port.
 *
 * THREE CAP SHAPES, and unusually all three are drivable: the read move-on
 * carries a different apology ("we will read that one again another day"), the
 * spoken move-on carries none, and the choice move-on is the only one with a
 * CLOSE LINE — it names the answer, because its corrections never may. Only the
 * first is reachable by `--di-cap` alone (the drill hangs off the first VOICE
 * item, which in every decode mode is a read line), so the other two are driven
 * with `--di-cap-item`, added for this port.
 */
const decodableReaderAdapter: DiPortAdapter<DecodableReaderItem> = {
  build: (data) => {
    const { items, mode, dropped } = decodableReaderItems(data as DecodableReaderPayload);
    return { items, dropped, surface: decodableReaderPackBase(items, mode) };
  },
  answersFor: decodableReaderHarnessAnswers,
};

/**
 * syllable-clapper (the DI port, 2026-08-16). ALL-VOICE and SINGLE-ACTION — the
 * three eval modes are word-LENGTH bands, not different tasks, so every item is
 * `count-parts` and there is no gesture commit anywhere. The click era's `Clap!`
 * button was a tally widget wearing a manipulative's costume; the clapping now
 * happens with the child's own hands, off screen, and only the spoken count
 * crosses the wire.
 *
 * What is different about its answer material, twice over:
 *
 *  1. **The signature wrong is manufactured BY the accept clause, more sharply
 *     than anywhere else in the family.** A five-year-old counts out loud, so
 *     "one, two, three" must be accepted for a three-part word — which makes
 *     "one, two, three, four" an utterance that contains the correct answer,
 *     spoken fluently in a natural counting rhythm, and is wrong. Only reading
 *     the LANDING separates them. It is the same shape phoneme-explorer's
 *     `segment` and counting-board's counted modes drive, and it matters most
 *     here: over-counting (an extra beat on the last syllable) is this
 *     primitive's own documented commonest error.
 *  2. **The leak oracle is FLAT and the ask still says a number.** The
 *     how-to-play works a practice word ("Watch me first: pencil. Pen … cil.
 *     That is two parts.") and `pickModelWord` guarantees that count is never
 *     the item's own — so no `leakExemptSpan` is issued and the oracle stays
 *     live over the greeting, the worked example, the ask and the hand-over. A
 *     model that substitutes its own practice word is caught by it.
 *
 * ⚠️ Its `--di-cap` drill is a SINGLE contract shape: `moveOnCue` is
 * mode-invariant (one action) and every item is voice, so one cap drive covers
 * the port.
 */
const syllableClapperAdapter: DiPortAdapter<SyllableClapperItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as SyllableChallengeLike[];
    const items = syllableClapperItems(challenges);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: syllableClapperPackBase(items),
    };
  },
  answersFor: syllableClapperHarnessAnswers,
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
 * word-sorter (SEVENTEENTH literacy port). ALL-VOICE across three modes — every
 * tap failed the costume test, so there is no gesture commit and every item is
 * judged from the answer text.
 *
 * Like word-workout, ONE CHALLENGE IS NOT ONE ITEM: a sort challenge expands to
 * a judged ask PER WORD and a match challenge to one per pair, so `dropped`
 * counts CHALLENGES that produced nothing rather than the items/challenges
 * difference. A session is additionally length-capped, which is NOT a drop and
 * is reported by the script module rather than here.
 *
 * What is different about its answer material: the sort ask closes on a SPOKEN
 * MENU, so the answer is inside the question by construction — push-pull-arena's
 * shape. `leakExemptSpan` subtracts exactly that clause, and the exemption is
 * TIER-CONDITIONAL: at `hard` for a reader the ask names no groups and the
 * oracle goes flat, which is that rung's whole point. A `match_pairs` ask never
 * speaks its bank (it is printed), so those items carry no exemption at all.
 *
 * Its sharpest drive is `--di-wrong signature` on any mode: the signature wrong
 * is THE STIMULUS WORD SAID STRAIGHT BACK — a real word, said confidently, that
 * the tutor itself spoke two seconds earlier, so a judge grading on "did I hear
 * something relevant to this item" affirms it. picture-vocabulary's documented
 * trap, and here it is the same shape in both directions of the pack.
 */
/**
 * shape-sorter (FIFTH math port, item 18). ALL-VOICE across three modes, so
 * there is no gesture commit anywhere.
 *
 * ONE CHALLENGE IS NOT ONE ITEM: an identify pool expands to one judged ask per
 * DISTINCT shape kind and a sort to one per shape, so `dropped` counts
 * CHALLENGES that produced nothing rather than the items/challenges difference.
 * The session length cap is not a drop and is reported by the script module.
 *
 * ⚠️ ITS BUILD IS ORDER-DEPENDENT, which no earlier math adapter's was. The §4d
 * ledger lives in `itemsFromChallenges` — a shape kind whose NAME has been said
 * aloud is not asked again, and it also blocks a later COUNT on that kind
 * (hearing "triangle" hands the count over). Rebuilding a challenge in
 * isolation to count drops would therefore see a different item set than the
 * runner does, so `dropped` is computed from the SAME single pass, by asking
 * which challenge ids the built items came from.
 *
 * Its sharpest drives are the per-mode signature wrongs, and they are three
 * different traps rather than one: the NEAR NAME under identify ("rectangle" at
 * a square), the OFF-BY-ONE under count, and — under sort — THE SHAPE NAME SAID
 * INSTEAD OF THE GROUP, which is on-topic, confident, and true about the
 * drawing. A judge that reasons "a square does have four sides, close enough"
 * affirms a child who never sorted.
 */
const shapeSorterAdapter: DiPortAdapter<ShapeSorterItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as ShapeSorterChallengeLike[];
    const items = shapeSorterItems(challenges, {
      isPreReader: (data.gradeBand as string) === 'K',
    });
    const producing = new Set(items.map((item) => item.challengeId));
    const dropped = challenges.filter((ch) => !producing.has(ch.id)).length;
    return { items, dropped, surface: shapeSorterPackBase(items) };
  },
  answersFor: shapeSorterHarnessAnswers,
};

const wordSorterAdapter: DiPortAdapter<WordSorterItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as WordSorterChallengeLike[];
    const opts = {
      tier: (data.supportTier as WordSorterTier) ?? 'medium',
      isPreReader: (data.gradeLevel as string) === 'K',
    };
    const items = wordSorterItems(challenges, opts);
    const dropped = challenges.filter(
      (ch) => wordSorterItemsFromChallenge(ch, opts).length === 0,
    ).length;
    return { items, dropped, surface: wordSorterPackBase(items) };
  },
  answersFor: wordSorterHarnessAnswers,
};

/**
 * text-structure-analyzer (EIGHTEENTH literacy port, and the first of the
 * closed-set literacy frontier — item 22). ALL-VOICE across three STEPS of one
 * passage, so there is no gesture commit anywhere.
 *
 * ⚠️ ITS `build` READS A PAYLOAD, NOT A `challenges` ARRAY — the only adapter in
 * the registry whose port has no challenge list at all. One generation is ONE
 * passage with ONE `structureType`, and the pack expands it into a judged read
 * per signal word, a single structure question, and a judged placement per key
 * idea. `dropped` therefore counts askable CANDIDATES the build gates refused
 * (an ambiguous sentence, an excerpt naming its own mat), which is a generator
 * signal; the session-length cap is reported separately by the script module and
 * is not a drop.
 *
 * What is different about its answer material, three ways over:
 *
 *  1. **The one-per-session Identify ask.** The scope predicted a pinned session
 *     would repeat the same structure question with the same answer on every
 *     item — §4d as the default state of a production run. The PAYLOAD resolves
 *     it: one passage, one structureType, so the pack can only build one such
 *     ask. A drive sees exactly one `name-structure` item however many items it
 *     has, which is worth knowing before reading a judgment matrix.
 *  2. **The find-signal leak oracle is completely FLAT, and is this port's
 *     sharpest gate.** The ask names a sentence by POSITION and never reads it
 *     aloud — decoding the passage is the skill — so the answer word is absent
 *     from everything the tutor says. Nothing is subtracted, and a linking word
 *     arriving through the greeting, the lead-in, the catalog or a struggle
 *     response is always a finding. The other two steps close on a spoken menu
 *     and subtract exactly that clause (push-pull-arena's shape,
 *     tier-conditional like word-sorter's: at `hard` above the band floor no
 *     menu is spoken and those oracles go flat too).
 *  3. **Three different signature wrongs in one pack.** `find-signal`'s is a
 *     CONTENT WORD read straight off the sentence the child was pointed at —
 *     this primitive's own documented commonest error, and a real word clearly
 *     read from the line, so a judge grading on "did they say a word from that
 *     sentence" affirms it. `name-structure`'s is the NEAREST structure, the
 *     sibling axis-2 deliberately puts in the menu at `hard` because both mean
 *     "this leads to that". `place-idea`'s is the excerpt SAID BACK — the
 *     tutor's own words from two seconds earlier.
 */
const textStructureAnalyzerAdapter: DiPortAdapter<TextStructureItem> = {
  build: (data) => {
    const { items, dropped } = textStructureItems(data as TextStructurePayloadLike);
    return { items, dropped, surface: textStructureAnalyzerPackBase(items) };
  },
  answersFor: textStructureAnalyzerHarnessAnswers,
};

/**
 * genre-explorer (NINETEENTH literacy port, second of the closed-set literacy
 * frontier — item 22). ALL-VOICE across three STEPS over two or three short
 * texts, so there is no gesture commit anywhere.
 *
 * ⚠️ ITS `build` READS A PAYLOAD, NOT A `challenges` ARRAY — the second adapter
 * in the registry whose port has no challenge list. One generation is a small set
 * of texts plus a shared feature list, and the pack expands it into a judged
 * yes/no per feature-and-text, a judged contrast per distinguishing feature, and
 * one genre call per text. `dropped` therefore counts askable CANDIDATES the
 * build gates refused (an excerpt that names a genre, a checklist heading that is
 * not a base-verb phrase, a feature true of BOTH texts in compare mode), which is
 * a generator signal; the session-length caps are reported separately by the
 * script module and are not drops.
 *
 * What is different about its answer material, three ways over:
 *
 *  1. **TWO OF THE THREE ACTIONS SHIP WITH AN EMPTY `leakTokens`, DELIBERATELY.**
 *     A `check-feature` answer is the word "yes" or "no" and a `pick-excerpt`
 *     answer is "the first one" — tokens the ask MUST contain to be a question at
 *     all, and the tutor's own affirmation sentinel is literally the string "Yes".
 *     A leak oracle over either would fire on every turn and mean nothing. What
 *     carries those two is the DISCRIMINATION oracle; read a judgment matrix for
 *     this port knowing the leak column is only about `name-genre`.
 *  2. **`name-genre`'s leak oracle is the one that bites, and it is nearly flat.**
 *     The genre label is absent from the ask, from the read-aloud text (any
 *     excerpt naming a genre is dropped at build), from the how-to-play and from
 *     the lead-in — so anything outside the spoken menu clause is a finding, and
 *     at `hard` above the band floor no menu is spoken and the exemption
 *     disappears entirely.
 *  3. **Three different signature wrongs in one pack.** `check-feature`'s is the
 *     FEATURE SAID BACK — the tutor's own words from two seconds earlier, which a
 *     judge grading on relevance affirms. `pick-excerpt`'s is "both of them", the
 *     generous hedge of a child who never contrasted the two texts. `name-genre`'s
 *     is the SIBLING genre (folktale for fable, autobiography for biography) —
 *     drawn from the same `GENRE_SIBLING` map the generator uses to ORDER its
 *     distractors, so the wrong answer the tier deliberately admits is the exact
 *     one the drive checks the judge refuses.
 */
const genreExplorerAdapter: DiPortAdapter<GenreExplorerItem> = {
  build: (data) => {
    const { items, dropped } = genreExplorerItems(data as GenreExplorerPayloadLike);
    return { items, dropped, surface: genreExplorerPackBase(items) };
  },
  answersFor: genreExplorerHarnessAnswers,
};

/**
 * sentence-analyzer (TWENTIETH literacy port, third of the closed-set literacy
 * frontier — item 22). ALL-VOICE across four ACTIONS over up to three printed
 * sentences, so there is no gesture commit anywhere.
 *
 * ⚠️ **THIS PORT'S DRIVE IS THE PROOF THAT A CONTENT FIX LANDED, NOT ONLY THAT A
 * JUDGE BEHAVES.** The click era derived subject/predicate as
 * `role.includes('subject')`, which keyed every determiner and every subject-side
 * modifier to the PREDICATE — "The" and "clever" in "The clever fox jumped
 * quickly". A button marked those children wrong in silence; a judged loop makes
 * the tutor refuse a correct child out loud. `name-side`'s signature wrong is
 * therefore THE OTHER SIDE said about exactly those words, and a judgment matrix
 * for this port should be read starting from that column.
 *
 * Three more things are different about its answer material:
 *
 *  1. **`name-side` ships an empty `leakTokens`, deliberately.** Its answer is one
 *     of the two words the ask must contain to be a question ("in the subject or
 *     in the predicate?"). A leak oracle over it would fire on every turn and mean
 *     nothing; the DISCRIMINATION oracle carries that action.
 *  2. **The other three actions have a nearly FLAT leak oracle**, which is where
 *     this port's leak evidence comes from. The grammar label is absent from the
 *     ask, from the printed sentence (`namesAGrammarTerm` drops any sentence
 *     containing grammar vocabulary), from the lead-in and from the how-to-play —
 *     so anything outside the spoken WALL clause is a finding, and the wall is
 *     spoken only on the item that introduces its action, and only at the band
 *     floor or `easy`.
 *  3. **Four different signature wrongs in one pack.** `name-pos`'s is the
 *     CONFUSABLE TWIN drawn from the same `CONFUSABLE_WITH` map the contract uses
 *     to write its strictness clause — adverb for an adjective, noun for a pronoun,
 *     where one label literally contains the other. `name-role`'s is a PART OF
 *     SPEECH said where the job was asked for, which is usually TRUE of the word
 *     and therefore the miss a relevance-grading judge waves through.
 *     `name-type`'s is DECLARATIVE, the default a child says without reading the
 *     ending.
 *
 * Its `build` reads a `challenges` array, and `dropped` counts askable CANDIDATES
 * the build gates refused — a word whose label is off the grade wall, a sentence
 * naming a grammar term, a `parse_structure` sentence with no statable subject
 * boundary. The session-length caps are reported separately and are not drops.
 */
const sentenceAnalyzerAdapter: DiPortAdapter<SentenceAnalyzerItem> = {
  build: (data) => {
    const { items, dropped } = sentenceAnalyzerItems(data as SentenceAnalyzerPayloadLike);
    return { items, dropped, surface: sentenceAnalyzerPackBase(items) };
  },
  answersFor: sentenceAnalyzerHarnessAnswers,
};

/**
 * Ports the judged-loop harness can drive. One entry per `/add-di-loop` port.
 *
 * The cast erases the per-port item type: the plan builder only ever reads the
 * four fields every judged item has (`JudgedScriptItem`), and the adapter's own
 * closures keep their concrete type internally.
 */
/**
 * sorting-station (seventh math port). ALL-VOICE across seven eval modes — the
 * drag-to-bin, the Check buttons, the attribute buttons, the number steppers and
 * the odd-one-out tap are all gone, so there is no `gestureVerdictCue`.
 *
 * It is the widest answer-material spread in the family (a group label, a
 * sorting axis, an object name, a count, a comparison word and a yes/no), and
 * `sortingStationHarnessAnswers` names a DIFFERENT signature wrong for each —
 * the stimulus said back on a sort, the off-by-one on a count, one half of the
 * compound on a two-criteria yes/no, the reason-instead-of-the-choice on an odd
 * one out, a group name where a comparison was asked. Each is a claim
 * `judgingContract` makes; driving them is what turns those clauses from prose
 * into evidence.
 */
const sortingStationAdapter: DiPortAdapter<SortingStationItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as SortingChallengeLike[];
    const isPreReader = data.gradeBand !== '1';
    const tier = data.supportTier as 'easy' | 'medium' | 'hard' | undefined;
    const items = sortingStationItemsFromChallenges(challenges, { tier, isPreReader });
    // A challenge that produced no askable item was DROPPED by a build gate; the
    // count is per challenge, which is the unit the report speaks in.
    const dropped = challenges.filter(
      (ch) => !items.some((item) => item.challengeId === ch.id),
    ).length;
    return { items, dropped, surface: sortingStationPackBase(items) };
  },
  answersFor: sortingStationHarnessAnswers,
};

/**
 * place-value-chart (eighth math port) — THE FIRST PORT PAST THE ≤20 BENCH,
 * riding the `place_value_word` build-ahead class (user ruling 2026-08-19,
 * acceptance on #63). MIXED: two spoken kinds (a place name, a value word) and
 * one gesture (a number WRITTEN from dictation), where the gesture payload is
 * the whole committed number and `buildVerdictCue` re-derives the columns.
 *
 * Its drives are where the class earns its keep: `discriminationFor` claims
 * the judge refuses the digit's VALUE where its PLACE was asked, the BARE
 * DIGIT where its worth was asked ("four" for "forty" — the confusion the
 * mode exists to undo), and the place-shifted value ("four hundred" for
 * "forty" — the click era's own distractor design, now spoken). The wrong
 * build is the zero-trap/transposition (406 written as 460).
 */
const placeValueChartAdapter: DiPortAdapter<PlaceValueItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as PlaceValueChallengeLike[];
    const rawMode = String(data.challengeType ?? 'compare');
    const mode: PlaceValueMode =
      (['identify', 'build', 'compare', 'expanded_form'] as const).includes(
        rawMode as PlaceValueMode,
      )
        ? (rawMode as PlaceValueMode)
        : 'compare';
    const tier = (data.supportTier as 'easy' | 'medium' | 'hard' | undefined) ?? 'medium';
    const { items, droppedChallenges } = placeValueItems(challenges, { mode, tier });
    return { items, dropped: droppedChallenges, surface: placeValuePackBase(items) };
  },
  answersFor: placeValueHarnessAnswers,
  gestureVerdictCue: (item, gesture) => {
    const n = typeof gesture === 'number' ? gesture : Number(gesture) || 0;
    const written = item.chartPlaces.map((p) => pvDigitAtPlace(n, p));
    return placeValueBuildVerdictCue(item, written);
  },
};

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

/**
 * rhyme-studio (EIGHTH literacy port, adapter added 2026-08-18 for item 24).
 *
 * The port shipped its judged loop in August and never registered a drive
 * adapter, so `--di` could not reach it — which made the handoff's premise
 * ("the judge's semantics are machine-testable, so this is cheap now") true of
 * the family but not of this primitive. Registering it is step zero of the
 * `open_set_word` bench, and it is also what lets the three CLOSED modes be
 * driven headlessly for the first time.
 *
 * TWO BUILDS, ONE SURFACE. `build` answers a real generation the way every
 * other port does. `benchBuild` answers the hand-authored fixture, and its
 * items are `open_production` — a class `validateJudgedScriptPack` still
 * REFUSES. That refusal rides out in `packGateIssues` rather than throwing,
 * which is exactly right: it is the honest label on a bench run, and it is the
 * line that disappears when the class clears.
 */
const rhymeStudioAdapter: DiPortAdapter<RhymeItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as RhymeChallengeLike[];
    const tier = ((data.supportTier as RhymeTier) ?? 'medium') as RhymeTier;
    const items = challenges.map((ch) => rhymeItemFromChallenge(ch, tier));
    return {
      items,
      dropped: challenges.length - items.length,
      surface: rhymeStudioPackBase(items),
    };
  },

  benchBuild: () => {
    // Straight through the pack's own build gate: the bench must exercise the
    // SHIPPED `itemFromChallenge`, not a parallel construction of items, or it
    // would be benching a contract the primitive does not use.
    const items = OPEN_SET_BENCH_STIMULI.map((s) =>
      rhymeItemFromChallenge(
        { id: s.id, mode: 'production', targetWord: s.targetWord, rhymeFamily: s.rhymeFamily },
        'medium',
      ),
    );
    return { items, surface: rhymeStudioPackBase(items) };
  },

  answersFor: (item) => {
    if (item.mode !== 'production') return rhymeStudioHarnessAnswers(item);

    /**
     * Match the fixture by ITEM ID first (a bench run), then by RIME.
     *
     * The rime fallback is what keeps the ordinary `--di` drive working on this
     * port now that production is open. A closed item carried its own answer;
     * an open one does not have one to carry, and the only other candidate —
     * the generator's `acceptableAnswers` — is the list that has contained the
     * nonword "NAKE", so taking `correct` from there would make the harness
     * expect an AFFIRM on a nonword. The bench fixture's valid rhymes are
     * hand-checked, so a GENERATED item on one of its six rimes can borrow one.
     * This is harness material only: it is never spoken to a child.
     */
    const stimulus = OPEN_SET_BENCH_STIMULI.find((s) => s.id === item.id)
      ?? OPEN_SET_BENCH_STIMULI.find((s) => s.rhymeFamily.replace(/^-+/, '') === item.rime);
    if (!stimulus) {
      // No key and no covered rime: UNDRIVABLE by the plain drive, and saying so
      // beats inventing an answer. Drive it with `--di-bench`, or extend the
      // fixture with this rime.
      return {
        correct: '',
        plainWrong: item.targetWord,
        leakTokens: [],
        probes: [],
      };
    }
    /**
     * ⚠️ EXCLUDE THE TARGET. The rime fallback matches a GENERATED item against
     * a fixture stimulus, and the fixture's own valid rhymes can BE that item's
     * target: a generated `cat` (-at) borrowed the -at fixture's first rhyme,
     * which is "cat". The harness then said the target back, the tutor refused
     * it correctly (that is the echo guard doing its job), and the run recorded
     * a `di-false-refusal` against the tutor for our mistake. Caught in the
     * first pilot drive, item c1.
     */
    const firstAffirm = stimulus.probes.find(
      (p) => p.expect === 'affirm'
        && p.text.toLowerCase() !== item.targetWord.toLowerCase(),
    );
    return {
      // The ordinary --di drive still works on a bench item: it takes the
      // first valid rhyme and the echo, which is this mode's signature miss.
      correct: firstAffirm?.text ?? '',
      plainWrong: stimulus.probes.find((p) => p.bucket === 'nonword')?.text ?? item.targetWord,
      /**
       * ⚠️ THE ECHO IS THE ITEM'S OWN TARGET, NEVER THE FIXTURE'S — the third
       * miskey of this shape, and the last one.
       *
       * Taking it from the matched fixture's `echo` probe looks right and is
       * silently wrong the moment the match was by RIME: a generated `cat`
       * borrows the `-at` fixture, whose echo probe is "hat", and "hat" is a
       * perfectly VALID RHYME for cat. The drive then said a right answer,
       * the tutor affirmed it correctly, and the run filed `di-false-affirm`
       * against the tutor for our mistake.
       *
       * Only ONE thing is transferable across a rime match — a hand-checked
       * valid rhyme (and even that needs the target excluded, see above).
       * Everything else in a probe set is about ITS stimulus. The echo needs no
       * fixture at all: by definition it is the target said back.
       */
      signatureWrong: {
        text: item.targetWord,
        why:
          'the stimulus said straight back. A word rhymes with itself only trivially and the ask is '
          + 'for a DIFFERENT word; it is the documented signature error of this mode, and deleting the '
          + 'word bank made it likelier because there is no menu to pick from',
      },
      // The ask names only the stimulus — it cannot leak an answer because it
      // does not know one. That is the property the class is being benched for.
      leakTokens: [],
      probes: stimulus.probes,
    };
  },
};

/**
 * periodic-table (first CHEMISTRY port). MIXED: `find` commits a TAP carrying
 * the tapped element's NAME (interactive-book's text shape) with a
 * code-computed verdict; name/compare/valence are judged from the child's
 * voice. Content is code-drawn from the element table — no LLM in the answer
 * path — so the drive's packGateIssues re-run is near-deterministic and the
 * value here is the judge's SEMANTICS on the three spoken shapes,
 * especially the two signature wrongs chemistry hands over for free: the
 * symbol letters read straight back (name-by-symbol), and the group label
 * said instead of the outer-electron count (valence, group ≥ 13 — "seventeen"
 * for chlorine, printed on the very axis the child is reading).
 */
const periodicTableAdapter: DiPortAdapter<PeriodicTableItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as PeriodicChallengeLike[];
    const tier = (data.supportTier as PeriodicTier) ?? 'medium';
    const items = periodicTableItems(challenges, tier);
    return {
      items,
      dropped: challenges.length - items.length,
      surface: periodicTablePackBase(items),
    };
  },
  answersFor: periodicTableHarnessAnswers,
  gestureVerdictCue: (item, gesture) => periodicTableCellVerdictCue(item, String(gesture)),
};

/**
 * states-of-matter (THIRD science port, SECOND chemistry port) — an ALL-SPOKEN
 * pack, so there is no gesture cue builder at all. Content is code-drawn from
 * the substance table, so the drive's packGateIssues re-run is near-deterministic
 * and the value here is the judge's SEMANTICS on the four spoken shapes,
 * especially the three signature wrongs the science hands over for free: the
 * SUBSTANCE said back where its STATE was asked, the state it is in RIGHT NOW
 * given instead of the state it will reach, and the resulting STATE named where
 * the phase-change WORD was asked ("liquid" for "melting").
 */
const statesOfMatterAdapter: DiPortAdapter<StatesOfMatterItem> = {
  build: (data) => {
    const challenges = (data.challenges ?? []) as StatesChallengeLike[];
    const band = ((data.gradeBand as StatesBand) ?? '3-5') as StatesBand;
    const tier = (data.supportTier as StatesTier) ?? 'medium';
    const items = statesOfMatterItems(challenges, { band, tier });
    return {
      items,
      dropped: challenges.length - items.length,
      surface: statesOfMatterPackBase(items),
    };
  },
  answersFor: statesOfMatterHarnessAnswers,
};

export const DI_PORTS: Record<string, DiPortAdapter<JudgedScriptItem>> = {
  'knowledge-check': knowledgeCheckAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'ten-frame': tenFrameAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'counting-board': countingBoardAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'addition-subtraction-scene':
    additionSubtractionSceneAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'push-pull-arena': pushPullArenaAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'picture-vocabulary': pictureVocabularyAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'phoneme-explorer': phonemeExplorerAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'letter-spotter': letterSpotterAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'letter-sound-link': letterSoundLinkAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'syllable-clapper': syllableClapperAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'word-builder': wordBuilderAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'decodable-reader': decodableReaderAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'interactive-book': interactiveBookAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'number-bond': numberBondAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'compare-objects': compareObjectsAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'ordinal-line': ordinalLineAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'story-talk': storyTalkAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'word-workout': wordWorkoutAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'word-sorter': wordSorterAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'shape-sorter': shapeSorterAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'text-structure-analyzer':
    textStructureAnalyzerAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'genre-explorer': genreExplorerAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'sentence-analyzer': sentenceAnalyzerAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'sorting-station': sortingStationAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'place-value-chart': placeValueChartAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'solar-system-explorer': solarSystemAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'habitat-diorama': habitatDioramaAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'rhyme-studio': rhymeStudioAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'periodic-table': periodicTableAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'states-of-matter': statesOfMatterAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
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
