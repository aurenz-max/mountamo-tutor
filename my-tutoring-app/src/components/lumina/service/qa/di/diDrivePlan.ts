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
  interactiveBookHarnessAnswers,
  interactiveBookPackBase,
  itemsFromChallenges as interactiveBookItems,
  tapVerdictCue as interactiveBookTapVerdictCue,
  type InteractiveBookChallengeLike,
  type InteractiveBookItem,
} from '@/components/lumina/primitives/visual-primitives/literacy/interactiveBookScript';
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
  answersFor: pictureVocabularyHarnessAnswers,
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
 * Ports the judged-loop harness can drive. One entry per `/add-di-loop` port.
 *
 * The cast erases the per-port item type: the plan builder only ever reads the
 * four fields every judged item has (`JudgedScriptItem`), and the adapter's own
 * closures keep their concrete type internally.
 */
export const DI_PORTS: Record<string, DiPortAdapter<JudgedScriptItem>> = {
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
  'story-talk': storyTalkAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'word-workout': wordWorkoutAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'word-sorter': wordSorterAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
  'text-structure-analyzer':
    textStructureAnalyzerAdapter as unknown as DiPortAdapter<JudgedScriptItem>,
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
