/**
 * What a live-runtime JOURNEY needs to know about one primitive.
 *
 * Same rule as `LiveActivitySpec`, one layer down: the host declares, the wire
 * relays, and Python names no primitive. `run_live_runtime.py` is a transport and
 * a phase program; every fact that differs per primitive is declared here, beside
 * the primitive, and resolved by the mounted driver — which already loads this
 * module live. A new adoption adds a row to `LIVE_JOURNEYS`, never a new harness.
 *
 * The split is deliberate:
 *   - **Python says what should happen next** ("the learner answers wrongly now").
 *   - **TypeScript says how to do it and whether it was right** (which DOM events
 *     that means on this primitive, and whether the drawn example taught its claim).
 *
 * A value computed from generated content — a wrong landing on a number line, the
 * spoken answer for a counting board — is therefore never computed in Python. That
 * was how `first['targetValues'][0] + 1` ended up in a backend test file.
 *
 * Development only. The capabilities route that serves it 404s in production, and
 * nothing in the shipped lesson path imports this module.
 */
import type { SupportArtifact } from './runtime/contract';
import type { LivePrimitiveId } from './activityContract';
import type { ClassificationItem } from '../../primitives/visual-primitives/biology/ClassificationSorter';
import { sortHarnessTargets } from '../../primitives/visual-primitives/biology/classificationSorterWorkspace';
import { itemsFromChallenges as shapeItems, shapeSorterHarnessAnswers } from '../../primitives/visual-primitives/math/shapeSorterScript';
import { simplerFromId as simplerShapeFromId } from '../../primitives/visual-primitives/math/shapeSorterLevers';
import { simplerItem } from '../../primitives/visual-primitives/math/numberLineLevers';
import { settledView } from '../../primitives/visual-primitives/math/numberLineView';
import { CHANGE_ONE_LEVER, COUNT_ON_LEVER, FEWER_GROUPS_LEVER, SMALLER_SET_LEVER, spokenPractice }
  from '../../primitives/visual-primitives/math/countingBoardSpokenLevers';
import { itemsFromChallenges as countingItems } from '../../primitives/visual-primitives/math/countingBoardDomain';
import { hopsHarnessBuilds, hopsTaskOf, simplerHops } from '../../primitives/visual-primitives/math/numberLineBuildHops';
import type { NumberLineChallenge } from '../../primitives/visual-primitives/math/NumberLine';
import { simplerItem as simplerComparison } from '../../primitives/visual-primitives/math/comparisonBuilderLevers';
import { simplerItem as simplerMathFact } from '../../primitives/visual-primitives/math/mathFactFluencyLevers';
import { farThree } from '../../primitives/visual-primitives/math/compareObjectsLevers';
import { threeCards } from '../../primitives/visual-primitives/math/numberSequencerLevers';
import { threePlaces } from '../../primitives/visual-primitives/math/ordinalLineLevers';
import { COIN_CENTS, fewestCoins } from '../../primitives/visual-primitives/math/coinCounterWorkspace';
import { evaluateRule as functionRuleAt } from '../../primitives/visual-primitives/math/functionMachineDomain';
import { harnessMachines as functionMachines, harnessWrongRule as functionWrongRule, observePairsNeeded, ruleTiles }
  from '../../primitives/visual-primitives/math/functionMachineWorkspace';
import type { FunctionMachineChallenge } from '../../primitives/visual-primitives/math/FunctionMachine';
import { operandsOf as regroupOperands, regroupingHarnessDigits } from '../../primitives/visual-primitives/math/regroupingWorkbenchWorkspace';
import { percentHarnessSteps } from '../../primitives/visual-primitives/math/percentBarWorkspace';
import { itemSolid as netItemSolid, netHarnessInput } from '../../primitives/visual-primitives/math/netFolderWorkspace';
import { practiceParent as netPracticeParent, simplerNet } from '../../primitives/visual-primitives/math/netFolderLevers';
import { formatNumber as formulaNumber, formulaHarnessInput, tokenizeFormula as formulaTokensOf }
  from '../../primitives/visual-primitives/math/formulaLabWorkspace';
import { practiceParent as formulaPracticeParent, simplerFormula } from '../../primitives/visual-primitives/math/formulaLabLevers';
import { askedOutput as parameterAskedOutput, formatOutput as parameterNumber, parameterHarnessInput }
  from '../../primitives/visual-primitives/math/parameterExplorerWorkspace';
import { practiceParent as parameterPracticeParent, simplerParameter }
  from '../../primitives/visual-primitives/math/parameterExplorerLevers';
import { practiceParent as percentPracticeParent, simplerPercent } from '../../primitives/visual-primitives/math/percentBarLevers';
import { factorHarnessSplits, factorizationForms } from '../../primitives/visual-primitives/math/factorTreeWorkspace';
import { practiceParent as factorPracticeParent, smallerTree } from '../../primitives/visual-primitives/math/factorTreeLevers';
import { equationHarnessChoices, mergeCommutingSteps, stepsDoneFrom } from '../../primitives/visual-primitives/math/equationWorkspaceDomain';
import { fewerSteps as equationFewerSteps, practiceParent as equationPracticeParent } from '../../primitives/visual-primitives/math/equationWorkspaceLevers';
import { ratioHarnessInput } from '../../primitives/visual-primitives/math/ratioTableWorkspace';
import { SCALAR_LABEL as MATRIX_SCALAR_LABEL, boxLabel as matrixBoxLabel, formatEntry as matrixEntry, matrixHarnessInput }
  from '../../primitives/visual-primitives/math/matrixDisplayWorkspace';
import { practiceParent as matrixPracticeParent, simplerMatrix } from '../../primitives/visual-primitives/math/matrixDisplayLevers';
import { twoWayHarnessText } from '../../primitives/visual-primitives/math/twoWayTableWorkspace';
import { coordinateHarnessInput, keyText as coordinateKeyText, planePixel }
  from '../../primitives/visual-primitives/math/coordinateGraphWorkspace';
import { practiceParent as coordinatePracticeParent, simplerItem as simplerCoordinate }
  from '../../primitives/visual-primitives/math/coordinateGraphLevers';
import { pairText as systemsPairText, systemsHarnessPoint } from '../../primitives/visual-primitives/math/systemsEquationsWorkspace';
import { practiceParent as systemsPracticeParent, simplerItem as simplerSystem }
  from '../../primitives/visual-primitives/math/systemsEquationsLevers';
import { builtTriangle as slopeBuiltTriangle, ratioText as slopeRatioText, slopeHarnessSteps }
  from '../../primitives/visual-primitives/math/slopeTriangleWorkspace';
import { canvasPixel as sketchCanvasPixel, functionSketchHarnessInput }
  from '../../primitives/visual-primitives/math/functionSketchWorkspace';
import { practiceParent as sketchPracticeParent, simplerItem as simplerSketchItem }
  from '../../primitives/visual-primitives/math/functionSketchLevers';
import { practiceParent as twoWayPracticeParent, simplerTable } from '../../primitives/visual-primitives/math/twoWayTableLevers';
import { histogramHarnessInput } from '../../primitives/visual-primitives/math/histogramWorkspace';
import { practiceParent as histogramPracticeParent, simplerHistogram } from '../../primitives/visual-primitives/math/histogramLevers';
import { practiceParent as ratioPracticeParent, simplerRatio } from '../../primitives/visual-primitives/math/ratioTableLevers';
import { circleHarnessText } from '../../primitives/visual-primitives/math/circleExplorerWorkspace';
import { distributionHarnessChoice, distributionHarnessSlider }
  from '../../primitives/distribution-explorer/distributionExplorerWorkspace';
import { practiceItem as distributionPracticeItem, practiceParent as distributionPracticeParent }
  from '../../primitives/distribution-explorer/distributionExplorerLevers';
import { practiceParent as circlePracticeParent, simplerCircle } from '../../primitives/visual-primitives/math/circleExplorerLevers';
import { practiceParent as regroupPracticeParent, smallerProblem as smallerRegroupProblem }
  from '../../primitives/visual-primitives/math/regroupingWorkbenchLevers';
import { practiceItem as coinPracticeItem, practiceParent as coinPracticeParent } from '../../primitives/visual-primitives/math/coinCounterLevers';
import { practiceItem as clockPracticeItem, practiceParent as clockPracticeParent } from '../../primitives/visual-primitives/math/analogClockLevers';
import { practiceItem as measurePracticeItem, practiceParent as measurePracticeParent } from '../../primitives/visual-primitives/math/measureLabLevers';
import { practiceItem as rulerPracticeItem, practiceParent as rulerPracticeParent } from '../../primitives/visual-primitives/math/measurementToolsLevers';
import { lessonOf as rulerLessonOf, measurementItems } from '../../primitives/visual-primitives/math/measurementToolsWorkspace';
import { cellProducts as areaCellProducts, partsFit as areaPartsFit } from '../../primitives/visual-primitives/math/areaModelWorkspace';
import { practiceItem as areaPracticeItem, practiceParent as areaPracticeParent } from '../../primitives/visual-primitives/math/areaModelLevers';
import { practiceItem as timePracticeItem, practiceParent as timePracticeParent } from '../../primitives/visual-primitives/math/timeSequencerLevers';
import { simplerLength } from '../../primitives/visual-primitives/math/lengthLabLevers';
import { simplerShape } from '../../primitives/visual-primitives/math/shapeComposerLevers';
import { fastFactMiss, isAnswerCorrect as isFactCorrect } from '../../primitives/visual-primitives/core/fastFactWorkspace';
import { arraysOf, gridFor } from '../../primitives/visual-primitives/math/arrayGridWorkspace';
import { smallerArray } from '../../primitives/visual-primitives/math/arrayGridLevers';
import type { ArrayGridChallenge } from '../../primitives/visual-primitives/math/ArrayGrid';
import type { MultiplicationExplorerChallenge } from '../../primitives/visual-primitives/math/MultiplicationExplorer';
import { askedSlot as explorerSlot, expectedAnswer as explorerAnswer, resolveChallengeFact as explorerFact }
  from '../../primitives/visual-primitives/math/multiplicationExplorerWorkspace';
import { practiceParent as explorerPracticeParent, smallerFact as explorerSmallerFact }
  from '../../primitives/visual-primitives/math/multiplicationExplorerLevers';
import { smallerArea, smallerPerimeter } from '../../primitives/visual-primitives/math/polygonAreaBuild';
import { smallerFigure } from '../../primitives/visual-primitives/math/polygonAreaLevers';
import { askOf } from '../../primitives/visual-primitives/math/shapeBuilderWorkspace';
import { witnessesFor } from '../../primitives/visual-primitives/math/shapeMakeBuild';
import { simplerItem as simplerFraction } from '../../primitives/visual-primitives/math/fractionCirclesLevers';
import { cutsFor, equalWays } from '../../primitives/visual-primitives/math/fractionEqualBuild';
import { buildFractionTouchItems, twoPictureItem } from '../../primitives/visual-primitives/math/fractionCirclesWorkspace';
import { barPractice } from '../../primitives/visual-primitives/math/fractionBarLevers';

/** touch_fraction's easier item (two_pictures) as the fraction to touch; the builder reads only the parent's fraction. */
const twoPictureFraction = (parent: any) => {
  const easier = twoPictureItem(buildFractionTouchItems([parent])[0]);
  return easier ? { numerator: easier.numerator, denominator: easier.denominator } : {};
};
import { practiceItem } from '../../primitives/visual-primitives/math/tenFrameLevers';
import { buildSequencerItems as sequencerItems, sequencerHarnessAnswers }
  from '../../primitives/visual-primitives/math/numberSequencerDomain';
import { buildLetterSoundItems, letterSoundHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diLetterSoundsDomain';
import { buildWordReadingItems, wordReadingHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diWordReadingDomain';
import { buildMathFactItems, mathFactsHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diMathFactsDomain';
import { buildSentenceReadingItems, sentenceReadingHarnessAnswers }
  from '../../primitives/visual-primitives/direct-instruction/diSentenceReadingDomain';
import { buildLetterSoundLinkItems, letterSoundLinkWorkspaceAnswers }
  from '../../primitives/visual-primitives/literacy/letterSoundLinkDomain';
import { fartherPair } from '../../primitives/visual-primitives/literacy/letterSoundLinkLevers';
import { itemsFromChallenges as frameItems, tenFrameHarnessAnswers, type TenFrameItem }
  from '../../primitives/visual-primitives/math/tenFrameScript';
import { countsFlips } from '../../primitives/visual-primitives/math/tenFrameWorkspace';
import { buildBondItems, familyFormKeyFor } from '../../primitives/visual-primitives/math/numberBondScript';
import { expandNumberBondInteractions } from '../../primitives/visual-primitives/math/numberBondModes';
import { buildCompareItems, compareObjectsHarnessAnswers } from '../../primitives/visual-primitives/math/compareObjectsScript';
import { itemsFromChallenges as placeValueItems, placeValueHarnessAnswers } from '../../primitives/visual-primitives/math/placeValueScript';
import { getDigitPaths } from '../../primitives/visual-primitives/math/numberTracerPaths';
import { letterWorkshopHarnessStrokes } from '../../primitives/visual-primitives/literacy/letterWorkshopWorkspace';
import { practiceItem as letterPracticeItem, practiceParent as letterPracticeParent } from '../../primitives/visual-primitives/literacy/letterWorkshopLevers';
import { tracePart } from '../../primitives/visual-primitives/math/numberTracerLevers';
import { drawCorners as shapeTracerDrawCorners } from '../../primitives/visual-primitives/math/shapeTracerWorkspace';
import { itemsFromChallenges as sortingItems, sortingStationHarnessAnswers } from '../../primitives/visual-primitives/math/sortingStationScript';
import { simplerFromParent as sortingSimplerFromParent } from '../../primitives/visual-primitives/math/sortingStationLevers';
import { placeLabel } from '../../primitives/visual-primitives/math/spokenNumberWords';
import { baseTenHarnessAnswers, itemsFromChallenges as baseTenItems, usesBaseTenDi, wrongTradePlace }
  from '../../primitives/visual-primitives/math/baseTenScript';
import { practiceFromId as baseTenPracticeFromId } from '../../primitives/visual-primitives/math/baseTenLevers';
import { blockNoun, blockNounPlural, readCount } from '../../primitives/visual-primitives/math/baseTenModel';
import { itemsFromChallenges as ordinalItems, ordinalLineHarnessAnswers } from '../../primitives/visual-primitives/math/ordinalLineScript';
import { balanceSurface, explainHarnessAnswers, weightsFor } from '../../primitives/visual-primitives/math/balanceScaleWorkspace';
import { equalityItems, equalityProblem, WEIGHTS } from '../../primitives/visual-primitives/math/balanceEqualityModel';
import { isHands, TRAY, workshopItems, workshopProblem } from '../../primitives/visual-primitives/math/balanceWorkshopModel';
import type { BarModelChallenge } from '../../primitives/visual-primitives/math/BarModel';
import { blendHarnessAnswers, blendItems } from '../../primitives/visual-primitives/literacy/phonicsBlenderWorkspace';
import { flipHarnessAnswers } from '../../primitives/visual-primitives/literacy/wordFlipWorkspace';
import { swapHarnessAnswers } from '../../primitives/visual-primitives/literacy/soundSwapWorkspace';
import { dictationItems, spellingHarnessAnswers } from '../../primitives/visual-primitives/literacy/spellingPatternExplorerWorkspace';
import { practiceItem as spellingPracticeItem, practiceParent as spellingPracticeParent } from '../../primitives/visual-primitives/literacy/spellingPatternLevers';
import { cvcHarnessAnswers } from '../../primitives/visual-primitives/literacy/cvcSpellerWorkspace';
import { OPTION_MODES, ROW_TAP_MODES, barModelHarnessAnswers, isSpokenGraph }
  from '../../primitives/visual-primitives/math/barModelWorkspace';
import { simplerGraph, simplerParent } from '../../primitives/visual-primitives/math/barModelLevers';
import { twoBarPractice } from '../../primitives/visual-primitives/math/barModelBuild';
import { youAndMeHarnessAnswers } from '../../primitives/visual-primitives/literacy/youAndMeWorkspace';
import { itemsFromChallenges as syllableItems } from '../../primitives/visual-primitives/literacy/syllableClapperScript';
import { syllableHarnessAnswers } from '../../primitives/visual-primitives/literacy/syllableClapperWorkspace';
import { itemsFromChallenge as rhymeItems } from '../../primitives/visual-primitives/literacy/rhymeStudioScript';
import { rhymeHarnessAnswers } from '../../primitives/visual-primitives/literacy/rhymeStudioWorkspace';
import { itemsFromChallenges as phonemeItems } from '../../primitives/visual-primitives/literacy/phonemeExplorerScript';
import { phonemeHarnessAnswers } from '../../primitives/visual-primitives/literacy/phonemeExplorerWorkspace';
import { itemsFromChallenges as workoutItems } from '../../primitives/visual-primitives/literacy/wordWorkoutScript';
import { wordWorkoutJourneyAnswers } from '../../primitives/visual-primitives/literacy/wordWorkoutWorkspace';
import { itemsFromTargets as builderItems } from '../../primitives/visual-primitives/literacy/wordBuilderScript';
import { wordBuilderJourneyAnswers } from '../../primitives/visual-primitives/literacy/wordBuilderWorkspace';
import { itemsFromChallenges as sorterItems } from '../../primitives/visual-primitives/literacy/wordSorterScript';
import { wordSorterJourneyAnswers } from '../../primitives/visual-primitives/literacy/wordSorterWorkspace';
import { itemsFromChallenges as vocabItems } from '../../primitives/visual-primitives/literacy/pictureVocabularyScript';
import { pictureVocabJourneyAnswers } from '../../primitives/visual-primitives/literacy/pictureVocabularyWorkspace';
import { passingPairs, picturePairItemsFrom, picturePairMiss } from '../../primitives/visual-primitives/literacy/picturePairBuild';
import { itemsFromChallenges as spotterItems } from '../../primitives/visual-primitives/literacy/letterSpotterScript';
import { letterSpotterJourneyAnswers } from '../../primitives/visual-primitives/literacy/letterSpotterWorkspace';
import { itemsFromChallenges as decodableItems } from '../../primitives/visual-primitives/literacy/decodableReaderScript';
import { decodableReaderJourneyAnswers } from '../../primitives/visual-primitives/literacy/decodableReaderWorkspace';
import { simplerFor as decodableSimplerFor } from '../../primitives/visual-primitives/literacy/decodableReaderLevers';
import { itemsFromChallenges as bookItems } from '../../primitives/visual-primitives/literacy/interactiveBookScript';
import { interactiveBookJourneyAnswers } from '../../primitives/visual-primitives/literacy/interactiveBookWorkspace';
import { itemsFromChallenges as bridgeItems } from '../../primitives/visual-primitives/literacy/storyBridgeScript';
import { storyBridgeJourneyAnswers } from '../../primitives/visual-primitives/literacy/storyBridgeWorkspace';
import { itemsFromChallenges as ribbonItems } from '../../primitives/visual-primitives/literacy/storyRibbonScript';
import { storyRibbonJourneyAnswers } from '../../primitives/visual-primitives/literacy/storyRibbonWorkspace';
import type { StoryMapData } from '../../primitives/visual-primitives/literacy/StoryMap';
import { CONFLICT_LABELS as STORY_CONFLICT_LABELS, arcLabels as storyArcLabels, eventBank as storyEventBank, settingChoices }
  from '../../primitives/visual-primitives/literacy/storyMapWorkspace';
import { practiceFor as storyPracticeFor, practicePhase as storyPracticePhase, type PracticeStory }
  from '../../primitives/visual-primitives/literacy/storyMapLevers';
import { itemsFromChallenges as addSubItems } from '../../primitives/visual-primitives/math/additionSubtractionSceneScript';
import { additionSubtractionJourneyAnswers } from '../../primitives/visual-primitives/math/additionSubtractionSceneWorkspace';
import { practiceParent as addSubPracticeParent, smallerStory as addSubSmallerStory }
  from '../../primitives/visual-primitives/math/additionSubtractionSceneLevers';
import { buildThreeDShapeItems } from '../../primitives/visual-primitives/math/threeDShapeExplorerScript';
import { threeDShapeJourneyAnswers } from '../../primitives/visual-primitives/math/threeDShapeExplorerWorkspace';
import { simplerFromId as simplerSolidFromId } from '../../primitives/visual-primitives/math/threeDShapeExplorerLevers';
import type { CalendarExplorerChallenge } from '../../primitives/visual-primitives/calendar/CalendarExplorer';
import { calendarSequenceItemsFromChallenges, calendarSequenceJourneyAnswers, isGridDateAnswer }
  from '../../primitives/visual-primitives/calendar/calendarExplorerWorkspace';
import { calendarPracticeItem, calendarPracticeParent } from '../../primitives/visual-primitives/calendar/calendarExplorerLevers';
import { practiceParentId as timelinePracticeParent, practiceTimeline } from '../../primitives/visual-primitives/calendar/timelineBuilderLevers';
import { tapPlaces as lifeCycleTapPlaces } from '../../primitives/visual-primitives/biology/lifeCycleSequencerWorkspace';
import { lifeCycleJourneyItem } from '../../primitives/visual-primitives/biology/lifeCycleSequencerLevers';
import { itemsFromChallenges as arenaItems } from '../../primitives/visual-primitives/physics/pushPullArenaScript';
import { pushPullArenaJourneyAnswers } from '../../primitives/visual-primitives/physics/pushPullArenaWorkspace';
import { ARENA_SIMPLER, arenaPracticeItem } from '../../primitives/visual-primitives/physics/pushPullArenaLevers';
import { itemsFromChallenges as habitatItems } from '../../primitives/visual-primitives/biology/habitatDioramaScript';
import { fewerNeedsItem as habitatFewerNeedsItem, habitatJourneyAnswers } from '../../primitives/visual-primitives/biology/habitatDioramaWorkspace';
import { SIMPLER_SUFFIX as HABITAT_SIMPLER, easierItemFor as habitatEasierItem }
  from '../../primitives/visual-primitives/biology/habitatDioramaLevers';
import { FEWER_SUFFIX as HABITAT_FEWER, animalById as habitatAnimalById, pieceById as habitatPieceById }
  from '../../primitives/visual-primitives/biology/habitatBuild';
import { feedingRelations as foodWebRelations, foodWebHarnessInputs } from '../../primitives/visual-primitives/biology/foodWebWorkspace';
import { shorterChain, smallerWeb } from '../../primitives/visual-primitives/biology/foodWebLevers';
import { towerHarnessInputs } from '../../primitives/visual-primitives/engineering/towerWorkspace';
import { shorterTower } from '../../primitives/visual-primitives/engineering/towerLevers';
import { gearHarnessInputs } from '../../primitives/visual-primitives/engineering/gearWorkspace';
import { simplerTrain } from '../../primitives/visual-primitives/engineering/gearLevers';
import type { FoodWebChallenge } from '../../primitives/visual-primitives/biology/FoodWebBuilder';
import { matterItems } from './adapters/matterExplorerLive';
import { matterJourneyAnswers } from '../../primitives/visual-primitives/chemistry/matterExplorerWorkspace';
import { matterLeverSession, practiceItem as matterPracticeItem, practiceParent as matterPracticeParent } from '../../primitives/visual-primitives/chemistry/matterExplorerLevers';
import { moleculeHarnessInputs } from '../../primitives/visual-primitives/chemistry/moleculeConstructorWorkspace';
import { simplerMolecule } from '../../primitives/visual-primitives/chemistry/moleculeConstructorLevers';
import type { MoleculeConstructorChallenge } from '../../primitives/visual-primitives/chemistry/MoleculeConstructor';
import { itemsFromPayload as genreItems } from '../../primitives/visual-primitives/literacy/genreExplorerScript';
import { genreJourneyAnswers } from '../../primitives/visual-primitives/literacy/genreExplorerWorkspace';
import { textStructureItems, textStructureJourneyAnswers } from '../../primitives/visual-primitives/literacy/textStructureAnalyzerWorkspace';
import { itemsFromPayload as sentenceItems } from '../../primitives/visual-primitives/literacy/sentenceAnalyzerScript';
import { sentenceJourneyAnswers } from '../../primitives/visual-primitives/literacy/sentenceAnalyzerWorkspace';
import { readAloudItems } from './adapters/readAloudStudioLive';
import { readAloudJourneyAnswers } from '../../primitives/visual-primitives/literacy/readAloudStudioWorkspace';
import { shortLine as readAloudShortLine } from '../../primitives/visual-primitives/literacy/readAloudStudioLevers';
import { itemsFromChallenges as oralSentenceItems } from '../../primitives/visual-primitives/literacy/oralSentenceStudioScript';
import { oralSentenceJourneyAnswers } from '../../primitives/visual-primitives/literacy/oralSentenceStudioWorkspace';
import { causeEffectItems, causeEffectJourneyAnswers } from '../../primitives/visual-primitives/history/causeEffectChainWorkspace';
import { practiceItem as causeEffectPracticeItem, practiceParent as causeEffectPracticeParent }
  from '../../primitives/visual-primitives/history/causeEffectChainLevers';
import { eraItems, eraJourneyAnswers } from '../../primitives/visual-primitives/history/eraExplorerWorkspace';
import { eraLeverSession, practiceItem as eraPracticeItem, practiceParent as eraPracticeParent }
  from '../../primitives/visual-primitives/history/eraExplorerLevers';
import { periodicItems, periodicJourneyAnswers } from '../../primitives/chemistry-primitives/periodicTableWorkspace';
import { periodicPracticeItem, periodicPracticeParent } from '../../primitives/chemistry-primitives/periodicTableLevers';
import { knowledgeCheckItems, knowledgeCheckJourneyAnswers } from '../../primitives/knowledgeCheckWorkspace';
import { statesItems } from './adapters/statesOfMatterLive';
import { statesJourneyAnswers } from '../../primitives/visual-primitives/chemistry/statesOfMatterWorkspace';
import { practiceItem as statesPracticeItem, practiceParent as statesPracticeParent, statesLeverSession } from '../../primitives/visual-primitives/chemistry/statesOfMatterLevers';
import { solarJourneyItem } from './adapters/solarSystemExplorerLive';
import { solarJourneyAnswers } from '../../primitives/visual-primitives/astronomy/solarSystemWorkspace';
import { shadowHarnessAnswers } from '../../primitives/visual-primitives/astronomy/lightShadowWorkspace';
import { practiceItem as shadowPracticeItem, practiceParent as shadowPracticeParent }
  from '../../primitives/visual-primitives/astronomy/lightShadowLevers';
import { easierComparisonChoice, maxWorkableAngle, minimumPushSetting, rampConclusion } from '../../primitives/visual-primitives/engineering/rampLabWorkspace';
import { practiceFromId as rampPracticeFromId } from '../../primitives/visual-primitives/engineering/rampLabLevers';
import { diShapesHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diShapesWorkspace';
import { diSpokenPracticeHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeWorkspace';
import { diDiceRollHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diDiceRollWorkspace';
import { deductionItems, diDeductionHarnessAnswers } from '../../primitives/visual-primitives/direct-instruction/diDeductionWorkspace';
import { diWorkedProcedureHarnessAnswers, workedProcedureItems } from '../../primitives/visual-primitives/direct-instruction/diWorkedProcedureWorkspace';
import { diWordProblemHarnessAnswers, wordProblemHarnessPlacements, wordProblemItems } from '../../primitives/visual-primitives/direct-instruction/diWordProblemWorkspace';
import { spatialHarnessInputs } from '../../primitives/visual-primitives/math/spatialSceneWorkspace';
import { practiceItem as spatialPracticeItem, practiceParent as spatialPracticeParent } from '../../primitives/visual-primitives/math/spatialSceneLevers';
import { hundredsChartHarnessInputs } from '../../primitives/visual-primitives/math/hundredsChartWorkspace';
import { practiceItem as hundredsChartPracticeItem, practiceParent as hundredsChartPracticeParent }
  from '../../primitives/visual-primitives/math/hundredsChartLevers';
import { skipHarnessInputs } from '../../primitives/visual-primitives/math/skipCountingWorkspace';
import { practiceItem as skipPracticeItem, practiceParent as skipPracticeParent }
  from '../../primitives/visual-primitives/math/skipCountingLevers';
import { mathFactHarnessInputs } from '../../primitives/visual-primitives/math/mathFactFluencyWorkspace';
import { additionFactHarnessInputs } from '../../primitives/visual-primitives/math/additionFactStrategiesWorkspace';
import { smallerFact as smallerAdditionFact } from '../../primitives/visual-primitives/math/additionFactStrategiesLevers';
import { equationBuilderHarnessInputs } from '../../primitives/visual-primitives/math/equationBuilderWorkspace';
import { practiceItem as equationBuilderPracticeItem, practiceParent as equationBuilderPracticeParent } from '../../primitives/visual-primitives/math/equationBuilderLevers';
import { patternBuilderHarnessInputs } from '../../primitives/visual-primitives/math/patternBuilderWorkspace';
import { practiceItem as patternPracticeItem, practiceParent } from '../../primitives/visual-primitives/math/patternBuilderLevers';
import { angleWorkshopHarnessInputs } from '../../primitives/visual-primitives/math/angleWorkshopWorkspace';
import { transformHarnessInputs, transformReplayKeys } from '../../primitives/visual-primitives/math/transformationLabWorkspace';
import { practiceParent as transformPracticeParent, simplerItem as simplerTransform }
  from '../../primitives/visual-primitives/math/transformationLabLevers';

/** transformation-lab's current challenge; an easier one (`~simpler`) is rebuilt from its parent with the same builder. */
function transformItem(ctx: { data: Record<string, any>; itemId: string | null }): any {
  const parentId = transformPracticeParent(String(ctx.itemId ?? ''));
  const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerTransform(parent) : parent;
}
import { practiceFor as angleWorkshopPracticeFor, practiceParent as angleWorkshopPracticeParent }
  from '../../primitives/visual-primitives/math/angleWorkshopLevers';
import { sentenceOf as figSentenceOf, sentencesOf as figSentencesOf, typeChoices as figTypeChoices } from '../../primitives/visual-primitives/literacy/figurativeSteps';
import { splitPictureOption as storySplitPicture } from '../../primitives/visual-primitives/literacy/storySteps';
import { strategyPickerHarnessInputs } from '../../primitives/visual-primitives/math/strategyPickerWorkspace';
import { practiceItem as strategyPracticeItem, practiceParent as strategyPracticeParent }
  from '../../primitives/visual-primitives/math/strategyPickerLevers';
import { carButtonName, carFor as trainCarFor, fewestCars as trainFewestCars, fewestEngines as trainFewestEngines } from '../../primitives/visual-primitives/engineering/trainYardModel';
import { simplerJob as simplerTrainJob } from '../../primitives/visual-primitives/engineering/trainYardLevers';
import { answerLabel as dnlAnswerLabel, ratioLineHarnessValues as dnlHarnessValues }
  from '../../primitives/visual-primitives/math/doubleNumberLineWorkspace';
import { practiceParent as dnlPracticeParent, simplerLine as dnlSimplerLine }
  from '../../primitives/visual-primitives/math/doubleNumberLineLevers';

/** One real learner action for the mounted driver to perform. */
export type DriverInput =
  | { type: 'place'; value: number }
  | { type: 'check' }
  /** The index-th `object-N`, or the object whose `data-pip-object` id is `target`. */
  | { type: 'touch'; index?: number; target?: string }
  | { type: 'give' }
  | { type: 'choose'; label: string }
  /** Text typed into the input (or textarea) with this `aria-label`. */
  | { type: 'write'; label: string; text: string }
  /** Strokes drawn on the canvas, in canvas pixel coordinates; or, with `target`, on the SVG with that `data-pip-object`
   *  id, with pointer events, in its viewBox coordinates. */
  | { type: 'draw'; strokes: { x: number; y: number }[][]; target?: string }
  | { type: 'answer'; text: string };

/** What the program is asking the learner to do, independent of how this primitive does it. */
export type LearnerIntent = 'warmup' | 'wrong' | 'correct'
  /** An ungraded teaching surface (`execution: 'teaching'`): look at one thing, then finish with the surface's own Done. */
  | 'explore' | 'finish';

export interface JourneyContext {
  /** The generated payload as mounted. */
  data: Record<string, any>;
  /** The item the runtime currently reports, resolved to its generated challenge. */
  challenge: Record<string, any> | null;
  /** `buildDiDrivePlan` items, when the primitive is a registered DI port. */
  diItems: Array<{ id: string; answers: Record<string, string> }>;
  /**
   * The JUDGED ITEM the runtime currently reports, which is not always a challenge.
   * Six primitives expand one generated challenge into several asks with derived ids,
   * so `challenge` is null for them and this is the only handle on "which ask is open".
   */
  itemId: string | null;
  /** The runtime's current `task.demand`: scene facts and whether the stimulus is ready. */
  demand?: Record<string, unknown> | null;
  /** What the workspace tells the tutor the spoken answer is. */
  expectedAnswer?: string | null;
}

export interface JourneyProbe {
  selector: string;
  /** `present` (default) reports a boolean, `count` a number, `focused` compares to activeElement. */
  kind?: 'present' | 'count' | 'focused';
}

export interface LiveJourney {
  /** `workspace`: graded items the observer advances. `teaching`: an ungraded surface the learner finishes. */
  execution?: 'workspace' | 'teaching';
  /** Module path under `src/components/lumina/`, so the driver needs no primitive map of its own. */
  component: string;
  /** The mounted instance id. The driver owns it and reports it in its ready handshake. */
  instanceId: string;
  /** Defaults for a fresh generation; every one is overridable from the command line. */
  defaults: { topic: string; grade: string; mode: string; di: boolean };
  /** Bracket tags this primitive's own script emits. The model must never voice one. */
  leakTokens: string[];
  /** What the learner says to ask for each action, in this primitive's own vocabulary. */
  prompts: Record<string, string>;
  /** How this primitive performs an intent. Returning [] means the intent does not apply. */
  inputsFor: (intent: LearnerIntent, ctx: JourneyContext) => DriverInput[];
  /**
   * Did the drawn example teach the relationship it claims? Return null for yes, or
   * the reason it did not. This is pedagogy, so it stays beside the primitive — an
   * assertion copied between journeys encodes the wrong primitive's teaching.
   */
  exampleTaught?: (artifact: SupportArtifact, spoken: string) => string | null;
  /** Extra DOM probes. `reminder` and `support` are shared and supplied by the driver. */
  probes?: Record<string, JourneyProbe>;
  /**
   * The tutor replay's keys, when the inputs type the answer in parts (one digit per place box): the whole answer as
   * the screen would print it. Without it each typed part is a key, and a part that is also an operand's digit reads
   * as a leak when the tutor reads the problem's column ("7 plus 5" over 27 + 45 = 72). The sweep's J3/J13 still check
   * every part.
   */
  replayKeys?: (ctx: JourneyContext) => string[];
}

/** What a learner says to ask for each action on any shared-workspace surface. */
const WORKSPACE_PROMPTS = { opening: 'What do I do?', hint: 'Can you help me?', example: 'Can you show me what you mean?' };

/** regrouping-workbench's current item; an easier practice problem (`~simpler`) is rebuilt from its parent with the same builder. */
/** net-folder's current challenge and the solid it draws; an easier one (`~simpler`) is rebuilt from its parent. */
function netFolderItem(ctx: JourneyContext): { challenge: any; solid: any } | null {
  const parentId = netPracticeParent(String(ctx.itemId ?? ''));
  const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
  if (!parent) return null;
  const challenge = parentId !== ctx.itemId ? simplerNet(parent, netItemSolid(ctx.data.solid, parent)) : parent;
  return challenge ? { challenge, solid: netItemSolid(ctx.data.solid, challenge) } : null;
}

/** percent-bar's current challenge; an easier one (`~simpler`) is rebuilt from its parent with the same builder. */
function percentBarItem(ctx: JourneyContext): any {
  const parentId = percentPracticeParent(String(ctx.itemId ?? ''));
  const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerPercent(parent) : parent;
}

/** parameter-explorer's current challenge; an easier one (`~simpler`) is rebuilt from its parent with the same builder. */
function parameterExplorerItem(ctx: JourneyContext): any {
  const parentId = parameterPracticeParent(String(ctx.itemId ?? ''));
  const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerParameter(ctx.data as any, parent) : parent;
}

/** formula-lab's current challenge; an easier one (`~simpler`) is rebuilt from its parent with the same builder. */
function formulaLabItem(ctx: JourneyContext): any {
  const parentId = formulaPracticeParent(String(ctx.itemId ?? ''));
  const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerFormula(ctx.data as any, parent) : parent;
}

function regroupItem(ctx: JourneyContext): any {
  const parentId = regroupPracticeParent(String(ctx.itemId ?? ''));
  const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
  return parent && parentId !== ctx.itemId ? smallerRegroupProblem(parent, ctx.data.operation, ctx.data as { operand1: number; operand2: number }) : parent;
}

/** The retiring cue tags. The workspace emits none of them; a model that voices
 *  one is reading a legacy pack it should no longer be sent. */
const RETIRED_DI_CUE_TAGS = ['DI_ITEM', 'DI_MOVE_ON', 'DI_COMPLETE'];

/** Every mode of a spoken pack is one utterance per intent, and the utterance comes
 *  from the pack's own domain, never from Python. */
const spokenWorkspaceInputs = <I extends { id: string }>(build: (challenges: any[]) => I[],
    answersFor: (item: I) => { correct: string; plainWrong: string }, noun: string): LiveJourney['inputsFor'] =>
  (intent, ctx) => {
    if (intent === 'warmup') return [];
    const item = build(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
    if (!item) throw new Error(`No current ${noun} assignment`);
    const answers = answersFor(item);
    return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
  };

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** Does the turn say this number, as a digit or as its word? */
const says = (text: string, n: number) =>
  new RegExp(`\\b(?:${n}${NUMBER_WORDS[n] ? `|${NUMBER_WORDS[n]}` : ''})\\b`, 'i').test(text);

/** A counter example IS its three quantities; a turn that omits one has announced an example, not taught it. */
const omittedQuantities = (artifact: SupportArtifact, text: string): string | null => {
  if (artifact.kind === 'contrast-pair' || artifact.kind === 'generated-image' || artifact.kind === 'demonstration') return `Expected a counter example or a step sequence, got ${artifact.kind}`;
  // A step sequence's relationship is its LAST step: each part and the whole they make.
  const last = artifact.kind === 'step-sequence' ? artifact.frames[artifact.frames.length - 1].segments.map(s => s.count) : [];
  const quantities = artifact.kind === 'step-sequence' ? [...last, last.reduce((a, b) => a + b, 0)]
    : [artifact.total - artifact.removed, artifact.removed, artifact.total];
  const missing = Array.from(new Set(quantities)).filter(n => !says(text, n));
  return missing.length ? `Worked example omitted its actual quantities: ${missing.join(', ')}` : null;
};

/** The cells a ten-frame placement touches, in order: the seeded counters to flip, or the empty boxes to fill. */
const frameCells = (item: TenFrameItem): number[] => {
  const seeded = item.seedCells ?? Array.from({ length: item.kind === 'subitize' ? 0 : item.shown }, (_, i) => i);
  return countsFlips(item) ? seeded
    : Array.from({ length: item.capacity }, (_, i) => i).filter(cell => !seeded.includes(cell));
};

/** A spoken workspace item answered with the number the workspace publishes, or one more. */
const spokenExpected = (ctx: JourneyContext, intent: LearnerIntent): DriverInput[] => {
  const n = Number(ctx.expectedAnswer);
  if (!Number.isInteger(n)) throw new Error('No published numeric answer for this spoken item');
  const said = intent === 'wrong' ? n + 1 : n;
  return [{ type: 'answer', text: NUMBER_WORDS[said] ?? String(said) }];
};

/** A judged runner's spoken answer comes from the port's own DI plan, never from the harness. */
const spoken = (ctx: JourneyContext, key: 'correct' | 'plainWrong'): DriverInput[] => {
  // Match the JUDGED ITEM first. Falling straight back to `diItems[0]` meant every
  // expanding primitive spoke the first ask's answer on every later ask, which the
  // runner then correctly judged wrong — a harness bug that reads as a model failure.
  const item = ctx.diItems.find(i => i.id === ctx.itemId)
    ?? ctx.diItems.find(i => i.id === ctx.challenge?.id)
    ?? ctx.diItems[0];
  const text = item?.answers?.[key];
  return text ? [{ type: 'answer', text }] : [];
};

export const LIVE_JOURNEYS: Record<LivePrimitiveId, LiveJourney> = {
  'number-line': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberLine.tsx',
    instanceId: 'line',
    defaults: { grade: 'Grade 1', mode: 'jump', di: false,
      topic: 'Subtract within 10: two independent single backward jumps, each taking away 1 to 4, starting at 5 to 9. No addition.' },
    leakTokens: ['ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // The landing the jump actually reaches; one past it is the wrong placement the
    // line's own Check rejects. Derived from the mounted challenge, not from Python.
    // An easier practice jump (the simplify lever) is not a generated challenge: rebuild it with the
    // same deterministic builder the component used, from the item it stands in for.
    inputsFor: (intent, ctx) => {
      const parent = ctx.itemId?.endsWith('~simpler')
        ? (ctx.data.challenges ?? []).find((c: { id: string }) => `${c.id}~simpler` === ctx.itemId) : null;
      // build_hops (open build): hop buttons, then I'm done. Correct: Start over (Try again keeps the build), a first
      // way, I'm done (kept, no commit), a different second way, I'm done. Wrong: a first way one short (`one_short`).
      if (parent?.type === 'build_hops' || ctx.challenge?.type === 'build_hops') {
        const task = hopsTaskOf(parent ? simplerHops(parent, ctx.data.range) : ctx.challenge as NumberLineChallenge | null);
        if (intent === 'warmup' || !task) return [];
        const builds = hopsHarnessBuilds(task);
        const hops = (sizes: number[]) => sizes.map((n): DriverInput => ({ type: 'choose', label: `Hop ${n}` }));
        const done: DriverInput = { type: 'choose', label: "I'm done!" };
        if (intent === 'wrong') return [...hops(builds.wrong), done];
        return [{ type: 'choose', label: 'Start over' }, ...hops(builds.first), done, ...hops(builds.second), done];
      }
      const challenge = parent ? simplerItem(parent, ctx.data as never, settledView(ctx.data as never, parent)) : ctx.challenge;
      if (intent !== 'warmup' && challenge?.type === 'order_values') {
        // Tap each value, then its own spot on the line (smallest at the left). Wrong: each at its mirror's spot (`reversed`).
        const values: number[] = challenge.targetValues, sorted = [...values].sort((a, b) => a - b);
        const spot = (v: number) => intent === 'wrong' ? sorted[sorted.length - 1 - sorted.indexOf(v)] : v;
        return [...values.flatMap((v): DriverInput[] => [{ type: 'choose', label: String(v) }, { type: 'place', value: spot(v) }]),
          { type: 'check' }];
      }
      if (intent !== 'warmup' && challenge?.type === 'find_between') {
        // One point inside (the exact missing number when the item has one). Wrong: on the lower given number (`on_end`).
        const lo = Math.min(...challenge.targetValues), hi = Math.max(...challenge.targetValues);
        const inside = typeof challenge.exactTargetValue === 'number' ? challenge.exactTargetValue : lo + 1 < hi ? lo + 1 : (lo + hi) / 2;
        return [{ type: 'place', value: intent === 'wrong' ? lo : inside }, { type: 'check' }];
      }
      // One landing per jump, in order. On two chained jumps the wrong answer lands the first right and the second one
      // past (`second_jump_off`, the miss the easier single jump answers).
      const landings: number[] = (challenge?.targetValues ?? []).filter((v: unknown): v is number => typeof v === 'number');
      if (intent === 'warmup' || !landings.length) return [];
      const placed = intent === 'wrong' ? landings.map((v, i) => i === landings.length - 1 ? v + 1 : v) : landings;
      return [...placed.map((value): DriverInput => ({ type: 'place', value })), { type: 'check' }];
    },
    probes: { mounted: { selector: 'svg[viewBox="0 0 760 240"]' },
      modelHop: { selector: '[data-lever="model-hop"]', kind: 'count' } },
  },

  'ten-frame': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/TenFrame.tsx',
    instanceId: 'frame',
    defaults: { grade: 'Kindergarten', mode: 'build', di: false, topic: 'Build numbers to 10 on a ten frame' },
    leakTokens: ['TF_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the pack's own answer; a placement taps the frame's real cells:
    // empty ones on a placing mode, seeded counters on a flipping mode.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const d = ctx.data;
      const all = frameItems(d.challenges ?? [], { capacity: d.mode === 'double' ? 20 : 10, band: d.gradeBand ?? 'K' });
      // An easier item (any simplify lever) is not a generated challenge: rebuild it with the component's builder.
      const parent = ctx.itemId?.endsWith('~smaller') ? all.find(i => `${i.id}~smaller` === ctx.itemId) : undefined;
      const item = parent ? practiceItem(parent, d.gradeBand ?? 'K', all) ?? undefined : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current ten-frame assignment');
      const answers = tenFrameHarnessAnswers(item);
      // build_pair (open build): Try again keeps the build, so a kept frame is cleared counter by counter first (the
      // driver placed it from cell 0). Wrong: the whole number in red. Correct: red, then yellow, a pair that moves
      // with the item's ordinal so a repeated total gets a different way; then I'm done.
      if (item.kind === 'build_pair') {
        const cell = (i: number): DriverInput => ({ type: 'touch', target: `cell-${i}` });
        const kept = Number(ctx.demand?.countersOnFrame ?? 0);
        const clear = Array.from({ length: Number.isInteger(kept) ? kept : 0 }, (_, i) => cell(i));
        const n = item.answer;
        const yellow = intent === 'wrong' ? 0 : Math.min(n - 1, Math.max(1, Math.floor(n / 2) + (item.splitOrdinal ?? 1) - 1));
        return [...clear, { type: 'choose', label: 'Red counters' }, ...Array.from({ length: n - yellow }, (_, i) => cell(i)),
          ...(yellow ? [{ type: 'choose' as const, label: 'Yellow counters' }, ...Array.from({ length: yellow }, (_, i) => cell(n - yellow + i))] : []),
          { type: 'choose', label: "I'm done!" }];
      }
      // A quick look not yet shown is the learner's to start: they press Show me, then answer.
      const look: DriverInput[] = item.kind === 'subitize' && ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Show me' }] : [];
      if (item.answerKind !== 'gesture' || !answers.placed) return [...look, { type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      return frameCells(item).slice(0, intent === 'wrong' ? answers.placed.wrong : answers.placed.correct)
        .map(cell => ({ type: 'touch' as const, target: `cell-${cell}` }));
    },
    probes: { mounted: { selector: '[data-pip-object="frame"]' } },
  },

  'counting-board': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/CountingBoard.tsx', instanceId: 'board',
    defaults: { grade: 'Kindergarten', mode: 'give_me_n', di: false, topic: 'Giving a requested number of objects from a larger collection' },
    leakTokens: ['CB_', 'COUNT_'],
    prompts: WORKSPACE_PROMPTS,
    // The easier ask (the `smaller_give` lever) is not a generated challenge: the same pile, about half as many,
    // as `smallerGive` builds it. A spoken kind's easier board (`~simpler`) is rebuilt from its parent with the
    // same builder (`spokenPractice`). A hand match picks the hand by its finger count; the wrong one is one finger off.
    inputsFor: (intent, ctx) => {
      const parent = ctx.itemId?.endsWith('~smaller')
        ? (ctx.data.challenges ?? []).find((c: { id: string }) => `${c.id}~smaller` === ctx.itemId) : null;
      const simpler = ctx.itemId?.endsWith('~simpler') ? (() => {
        const session = countingItems(ctx.data.challenges ?? [], { objectWord: ctx.data.objects?.type ?? 'objects' });
        const from = session.find(i => `${i.id}~simpler` === ctx.itemId);
        const lever = from && ({ count_all: SMALLER_SET_LEVER, recount_moved: SMALLER_SET_LEVER, take_away: CHANGE_ONE_LEVER,
          add_more: CHANGE_ONE_LEVER, count_on: COUNT_ON_LEVER, group_count: FEWER_GROUPS_LEVER } as Record<string, string>)[from.kind];
        const easier = from && lever ? spokenPractice(from, lever, session) : null;
        return easier ? { ...(ctx.data.challenges ?? []).find((c: { id: string }) => c.id === from!.id), ...easier.challenge } : null;
      })() : null;
      const ch = parent ? { ...parent, targetAnswer: Math.ceil(parent.targetAnswer / 2) } : simpler ?? ctx.challenge;
      if (!ch) throw new Error('No current counting task');
      if (intent === 'warmup') return [];
      const n = ch.targetAnswer + (intent === 'wrong' ? 1 : 0);
      if (ch.type === 'subitize_perceptual')
        return [{ type: 'touch', target: `hand-${intent === 'wrong' ? (ch.targetAnswer === 3 ? 2 : ch.targetAnswer + 1) : ch.targetAnswer}` }];
      if (ch.type === 'give_me_n') return [...Array.from({ length: n }, (_, index) => ({ type: 'touch' as const, index })), { type: 'give' as const }];
      const work: DriverInput[] = ch.type === 'take_away' ? Array.from({ length: ch.changeBy }, (_, index) => ({ type: 'touch', index }))
        : ch.type === 'add_more' ? Array.from({ length: ch.changeBy }, (_, index) => ({ type: 'touch', index: ch.count + index }))
        : ch.type === 'recount_moved' ? Array.from({ length: ch.count }, (_, index) => ({ type: 'touch', index })) : [];
      return [...work, { type: 'answer', text: ch.type === 'count_all'
        ? Array.from({ length: n }, (_, i) => String(i + 1)).join(' ') : String(n) }];
    },
    probes: { mounted: { selector: '[data-pip-object^="object-"]', kind: 'count' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },
  'number-sequencer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberSequencer.tsx',
    instanceId: 'train',
    // `before_after` asks exactly ONE question per generated challenge, so the two
    // challenges this harness mounts are two items. A mode whose challenge expands
    // into several asks (count_from, fill_missing, decade_fill) leaves items open
    // after the program's second correct answer and cannot reach completion here.
    defaults: { grade: 'Kindergarten', mode: 'before_after', di: false,
      topic: 'The number that comes just before or just after a given number' },
    leakTokens: ['NS_'],
    prompts: WORKSPACE_PROMPTS,
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const built = sequencerItems(ctx.data.challenges ?? []).items;
      // An easier train (the simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = ctx.itemId?.endsWith('~simpler') ? built.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      const item = parent ? threeCards(parent, ctx.data.gradeBand ?? 'K') : built.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current number-train assignment');
      const answers = sequencerHarnessAnswers(item);
      const text = intent === 'wrong' ? answers.plainWrong : answers.correct;
      // Page work: the cards carry their own number as their whole label, so a
      // placement is the shared `choose`, not a primitive-specific verb.
      return item.answerKind === 'gesture'
        ? text.split(',').map(label => ({ type: 'choose' as const, label }))
        : [{ type: 'answer', text }];
    },
    probes: { mounted: { selector: '[data-testid^="train-car-"]', kind: 'count' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },

  'number-bond': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberBond.tsx',
    instanceId: 'bond',
    defaults: { grade: 'Kindergarten', mode: 'ten_and_ones', di: false, topic: 'Teen numbers as a ten and some ones' },
    leakTokens: ['NB_', 'NS_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken phase says the number the workspace publishes; a split phase presses the board's own
    // move buttons: everything back to the whole, then a complete split (an incomplete one never
    // commits). Wrong is a split with no full ten, or a decompose pair already made. A model phase
    // presses its move button (the only moves on offer are right ones, so it has no wrong input); an
    // equation phase types the equation for the move the row made (join), wrong by one on the result.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = expandNumberBondInteractions(buildBondItems(ctx.data.challenges ?? [],
        { band: ctx.data.gradeBand ?? 'K', maxNumber: ctx.data.maxNumber ?? 10 }).items).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current number-bond assignment');
      if (item.answerKind !== 'gesture') return spokenExpected(ctx, intent);
      const wrong = intent === 'wrong';
      const phase = item.interactionPhase;
      if (phase === 'equation-model' || phase === 'family-model' || phase === 'related-join' || phase === 'related-separate') {
        if (wrong) return [];
        const label = phase === 'equation-model' || item.bondAction === 'join' ? 'Join the groups'
          : item.bondAction === 'swap' ? 'Swap the groups' : item.bondAction === 'separate-left' ? 'Move red group away' : 'Move blue group away';
        return [{ type: 'choose', label }];
      }
      if (phase === 'equation-build' || phase === 'family-build') {
        const key = phase === 'family-build' && item.familyForm
          ? familyFormKeyFor(item.familyForm, item.whole, item.knownPart, item.otherPart) : `${item.knownPart}+${item.otherPart}=${item.whole}`;
        const [lhs, result] = key.split('=');
        return [{ type: 'write', label: 'Equation keyboard entry', text: `${lhs}=${wrong ? Number(result) + 1 : result}` }];
      }
      if (item.splitPhase !== 'build') throw new Error(`Number-bond ${item.interactionPhase ?? item.kind} hands phase is not driven at W1`);
      // The first way to split a whole has no pair to repeat: every complete split is a new way, so no wrong input.
      if (wrong && item.kind === 'decompose' && item.pairIndex === 0) return [];
      const placed = Number(ctx.demand?.countersInLeftPart ?? 0) + Number(ctx.demand?.countersInRightPart ?? 0);
      const left = item.kind === 'ten-and-ones' ? (wrong ? 9 : 10) : wrong && item.pairIndex > 0 ? 0 : item.pairIndex;
      const right = item.whole - left;
      const press = (place: string, n: number) => Array.from({ length: n }, () => ({ type: 'choose' as const, label: `Move counter to ${place}` }));
      return [...press('whole', placed), ...press('left', left), ...press('right', right)];
    },
    probes: { mounted: { selector: '[data-pip-dock]' } },
  },
  'ordinal-line': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/OrdinalLine.tsx',
    instanceId: 'line-up',
    defaults: { grade: 'Kindergarten', mode: 'identify', di: false,
      topic: 'Saying which place someone is standing in a line' },
    leakTokens: ['OL_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the pack's own answer (a name or a place word); a build touches
    // each real picture and then its place, in the clued order or reversed (the wrong-end
    // error through the hands), so a wrong line is complete.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const built = ordinalItems(ctx.data.challenges ?? [], { band: ctx.data.gradeBand ?? 'K', context: ctx.data.context ?? 'race' }).items;
      // An easier line (the simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = ctx.itemId?.endsWith('~simpler') ? built.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      const item = parent ? threePlaces(parent)?.item : built.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current ordinal-line assignment');
      if (item.answerKind === 'gesture') {
        const order = intent === 'wrong' ? [...item.answerOrder].reverse() : item.answerOrder;
        return order.flatMap((name, i) => [{ type: 'touch' as const, target: `picture-${name}` },
          { type: 'touch' as const, target: `slot-${i + 1}` }]);
      }
      const answers = ordinalLineHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stage"]' } },
  },
  'sorting-station': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/SortingStation.tsx',
    instanceId: 'station',
    defaults: { grade: 'Kindergarten', mode: 'sort_one', di: false,
      topic: 'Sorting objects into groups by one attribute' },
    leakTokens: ['SS_'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is spoken: the pack's own right answer, or its plain wrong one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const built = sortingItems(ctx.data.challenges ?? [], { tier: ctx.data.supportTier,
        isPreReader: (ctx.data.gradeBand ?? 'K') === 'K' });
      // An easier item (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = ctx.itemId?.endsWith('~simpler') ? built.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      const item = parent ? sortingSimplerFromParent(parent, (ctx.data.challenges ?? []).find((c: { id: string }) => c.id === parent.challengeId) ?? null)?.item
        : built.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current sorting-station assignment');
      const answers = sortingStationHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object^="tray-"]', kind: 'count' } },
  },
  'number-tracer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NumberTracer.tsx',
    instanceId: 'tracer',
    defaults: { grade: 'Kindergarten', mode: 'trace', di: false,
      topic: 'Writing the numerals zero through five' },
    leakTokens: ['ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // `trace` only: the right answer follows the challenge's own guide strokes, densified; the wrong
    // one is the same strokes shifted off the guide. Other modes need a drawn numeral the vision
    // judge reads, which the driver cannot produce, so they throw.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A trace_part practice item (`~simpler`, numberTracerLevers.ts) is rebuilt from its parent with the same builder.
      const parent = ctx.itemId?.endsWith('~simpler')
        ? (ctx.data.challenges ?? []).find((c: { id: string }) => `${c.id}~simpler` === ctx.itemId) : null;
      const challenge = parent ? tracePart(parent) : ctx.challenge;
      if (challenge?.type !== 'trace') throw new Error(`Number-tracer ${challenge?.type ?? 'unknown'} is not driven at W1`);
      // The component's own fallback when a challenge carries no strokes (the generator never sends them).
      const guide: { x: number; y: number }[][] = challenge.strokePaths?.length ? challenge.strokePaths : getDigitPaths(challenge.digit);
      const dx = intent === 'wrong' ? 160 : 0;
      const strokes = guide.map(stroke => stroke.slice(1).flatMap((b, k) => {
        const a = stroke[k];
        return Array.from({ length: 12 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / 12 + dx, y: a.y + ((b.y - a.y) * i) / 12 }));
      }).concat([{ x: stroke[stroke.length - 1].x + dx, y: stroke[stroke.length - 1].y }]));
      return [{ type: 'draw', strokes }, { type: 'choose', label: 'Check' }];
    },
    probes: { mounted: { selector: 'canvas' } },
  },
  'letter-workshop': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/LetterWorkshop.tsx',
    instanceId: 'letters',
    defaults: { grade: 'Kindergarten', mode: 'trace', di: false, topic: 'Writing lowercase letters' },
    leakTokens: ['SAY_LETTER', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START', 'READ_ALOUD'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode on the writing paper with pointer strokes: the right answer is the letter's own model strokes, which
    // every mode's check accepts; the wrong one draws each stroke backwards (`start_or_order`), which geometry fails
    // and the vision judge (no 2D canvas in the driver) never overrides.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      // A practice item (`~simpler`, letterWorkshopLevers.ts) is rebuilt from its parent with the same builder.
      const parent = letterPracticeParent(all, ctx.itemId);
      const c = parent ? letterPracticeItem(parent, all) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current letter-workshop challenge');
      return [{ type: 'draw', target: 'paper', strokes: letterWorkshopHarnessStrokes(c, intent === 'wrong') },
        { type: 'choose', label: c.type === 'trace' ? 'Check my tracing' : 'Check my writing' }];
    },
    probes: { mounted: { selector: '[data-pip-object="paper"]' } },
  },
  'shape-tracer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ShapeTracer.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'trace', di: false, topic: 'Drawing triangles, squares and rectangles' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START', 'SIDE_COMPLETE', 'WRONG_DOT', 'REVEAL:'],
    prompts: WORKSPACE_PROMPTS,
    // Every type through its real dots. trace and complete tap the corners in turn and finish themselves; a tap out of
    // turn is refused on the dot, never checked, so they have no wrong input. connect-dots: the wrong answer starts at
    // the second number (`started_elsewhere`). draw-from-description places a regular polygon on the grid
    // (`drawCorners`) and presses Check Shape; the wrong one has one corner fewer (one more on a triangle).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current shape-tracer challenge');
      const wrong = intent === 'wrong';
      const touch = (prefix: string, ids: number[]): DriverInput[] => ids.map(i => ({ type: 'touch', target: `${prefix}-${i}` }));
      if (c.type === 'trace') return wrong ? [] : touch('vertex', (c.tracePath ?? []).map((_: unknown, i: number) => i));
      if (c.type === 'complete') return wrong ? [] : touch('remaining', (c.remainingVertices ?? []).map((_: unknown, i: number) => i));
      if (c.type === 'connect-dots') {
        const order: number[] = c.correctOrder ?? [];
        return touch('dot', wrong ? [order[1]] : order);
      }
      return [...touch('grid', shapeTracerDrawCorners(c, ctx.data.gridSize ?? 50, wrong)), { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="canvas"]' } },
  },
  'comparison-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ComparisonBuilder.tsx',
    instanceId: 'compare',
    // Grade 1, because that is the band with labelled choice buttons and a Check
    // button the driver can press. Kindergarten answers by tapping the group
    // pictures themselves, which is an SVG gesture the driver has no verb for.
    defaults: { grade: 'Grade 1', mode: 'compare_groups', di: false,
      topic: 'Deciding which of two groups has more' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'DISAMBIGUATE', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // Every Grade-1 mode through its real buttons, then Check. A wrong answer is the
    // mode's signature error: the opposite word or symbol, the reversed order, a step
    // the wrong way. Derived from the mounted challenge, not from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice item (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const all = ctx.data.challenges ?? [];
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find((x: { id: string }) => `${x.id}~simpler` === ctx.itemId) : null;
      const c = parent ? simplerComparison(parent, ctx.data.gradeBand ?? 'K') : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current comparison-builder challenge');
      if ((ctx.data.gradeBand ?? 'K') !== '1') throw new Error(`comparison-builder ${c.type}: Kindergarten taps pictures; the row drives Grade 1`);
      const wrong = intent === 'wrong';
      const check: DriverInput = { type: 'check' };
      if (c.type === 'compare-groups') {
        const label = (answer: string) => answer === 'equal' ? 'The Same' : answer === 'more' ? 'More' : 'Fewer';
        return [{ type: 'choose', label: label(wrong ? (c.correctAnswer === 'more' ? 'less' : 'more') : c.correctAnswer) }, check];
      }
      if (c.type === 'compare-numbers') {
        const symbol = wrong ? (c.correctSymbol === '<' ? '>' : '<') : c.correctSymbol;
        return [{ type: 'choose', label: symbol }, check];
      }
      if (c.type === 'order') {
        const sorted = [...c.numbers].sort((a: number, b: number) => c.direction === 'descending' ? b - a : a - b);
        return [...(wrong ? sorted.reverse() : sorted).map((n: number): DriverInput => ({ type: 'choose', label: String(n) })), check];
      }
      const step = (c.askFor === 'one-less' ? -1 : 1) * (wrong ? -1 : 1);
      // Both rows: each cell is named by its row ("one more 9"); wrong exchanges the two answers.
      if (c.askFor !== 'one-more' && c.askFor !== 'one-less') return [
        { type: 'choose', label: `one more ${c.targetNumber + (wrong ? -1 : 1)}` },
        { type: 'choose', label: `one less ${c.targetNumber + (wrong ? 1 : -1)}` }, check];
      return [{ type: 'choose', label: String(c.targetNumber + step) }, check];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'function-machine': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/FunctionMachine.tsx',
    instanceId: 'fm',
    defaults: { grade: 'Grade 5', mode: 'discover_rule', di: false, topic: 'Function machines: input and output rules' },
    leakTokens: ['PREDICTION_CORRECT', 'PREDICTION_INCORRECT', 'GUESS_INCORRECT', 'MACHINE_CHECKED', 'PHASE_COMPLETE', 'ALL_COMPLETE', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: feed buttons, the prediction and rule boxes, the tile keypad. The inputs
    // and pairs still on screen are read from the scene facts, since a miss keeps what was already fed. Observe has no
    // wrong answer (Continue is its end). A wrong answer is the mode's signature error: a prediction one over, the
    // shape's typical wrong rule (`harnessWrongRule`), a machine that gives one more than the pair asks.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = ctx.challenge;
      if (!c) throw new Error('No current function-machine challenge');
      const mode = ctx.data.challengeType as string, wrong = intent === 'wrong';
      const left = String(ctx.demand?.inputsToFeed ?? '').split(',').map(t => t.trim()).filter(t => /^-?\d+(\.\d+)?$/.test(t)).map(Number);
      const shown = (String(ctx.demand?.pairsOnScreen ?? '').match(/→/g) ?? []).length;
      const feed = (x: number): DriverInput => ({ type: 'choose', label: `Feed ${x}` });
      const check: DriverInput = { type: 'check' };
      const out = (x: number) => functionRuleAt(c.rule, x)!;
      if (mode === 'observe') {
        if (wrong) return [];
        return [...left.slice(0, Math.max(0, observePairsNeeded(c as FunctionMachineChallenge) - shown)).map(feed), { type: 'choose', label: 'Continue →' }];
      }
      if (mode === 'predict') {
        const predict = (x: number, value: number): DriverInput[] => [{ type: 'write', label: 'My prediction', text: String(value) }, feed(x)];
        if (!wrong) return left.flatMap(x => predict(x, out(x)));
        // An input that is no other input's output, so naming it after the miss names no key.
        const outputs = new Set(left.map(out));
        const x = left.find(i => !outputs.has(i)) ?? left[0];
        return predict(x, out(x) + 1);
      }
      if (mode === 'discover_rule' || mode === 'create_rule') {
        const feeds = mode === 'discover_rule' ? left.slice(0, Math.max(0, 2 - shown)).map(feed) : [];
        return [...feeds, { type: 'write', label: 'Your rule', text: wrong ? functionWrongRule(c.rule) : c.rule }, check];
      }
      if (mode === 'make_rule') {
        const machines = functionMachines(c as FunctionMachineChallenge);
        if (!machines) throw new Error('function-machine make_rule: the item names no pair');
        const build = (rule: string): DriverInput[] => [...ruleTiles(rule).map((t): DriverInput => ({ type: 'choose', label: `Add ${t}` })),
          { type: 'choose', label: "I'm done!" }];
        if (wrong) return build(machines.wrong);
        return [{ type: 'choose', label: 'Start over' }, ...build(machines.right[0]), ...build(machines.right[1])];
      }
      throw new Error(`function-machine: no driver for mode ${mode}`);
    },
    // The key per mode: the hidden rule (discover, create), the outputs not yet fed (predict), the stored machine (make,
    // one of many that pass). A pair already on screen is not a key.
    replayKeys: ctx => {
      const c = ctx.challenge, mode = ctx.data.challengeType as string;
      if (!c) return [];
      if (mode === 'predict') return (c.inputQueue as number[]).map(x => String(functionRuleAt(c.rule, x)));
      if (mode === 'discover_rule' || mode === 'create_rule' || mode === 'make_rule') return [c.rule];
      return [];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'coin-counter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/CoinCounter.tsx',
    instanceId: 'coins',
    defaults: { grade: 'Grade 2', mode: 'count-mixed', di: false, topic: 'Counting mixed coins' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START', '[TIER', '[G1 ENACTED'],
    prompts: WORKSPACE_PROMPTS,
    // Every type through its real controls, then Check. A wrong answer is the mode's signature error from
    // `coinMiss`: another silver coin, the number of coins for a total, one coin too many, the group with more
    // coins, the price given as the change. Kindergarten like coins have no wrong check: the wrong intent taps
    // one coin twice, a double count the activity refuses on the coin itself.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier item (`~smaller`) is rebuilt from its parent with the same builder.
      const parent = coinPracticeParent(ctx.itemId, ctx.data.challenges ?? []);
      const c: any = parent ? coinPracticeItem(parent) : (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current coin-counter challenge');
      const wrong = intent === 'wrong', band = ctx.data.gradeBand ?? '1';
      const check: DriverInput = { type: 'check' };
      const count = (coins: { count: number }[]) => coins.reduce((n, x) => n + x.count, 0);
      const coinTaps = (n: number): DriverInput[] => Array.from({ length: n }, (_, i) => ({ type: 'choose', label: `Coin ${i + 1}` }));
      if (c.type === 'identify') {
        const options: string[] = c.options ?? ['penny', 'nickel', 'dime', 'quarter'];
        const silver = ['nickel', 'dime', 'quarter', 'half-dollar'];
        const pick = wrong ? options.find(o => o !== c.targetCoin && silver.includes(o) === silver.includes(c.targetCoin))
          ?? options.find(o => o !== c.targetCoin)! : c.targetCoin;
        return [{ type: 'choose', label: `Coin ${options.indexOf(pick) + 1}` }, check];
      }
      if (c.type === 'count') {
        const n = count(c.displayedCoins), total = c.correctTotal;
        if (band === 'K' && c.countMode === 'like') return wrong ? [...coinTaps(1), ...coinTaps(1)] : coinTaps(n);
        const typedTotal = !wrong ? total : n !== total ? n : total - 1;
        const tags = band === '1' && c.countMode === 'like' ? coinTaps(n) : [];
        return [...tags, { type: 'write', label: 'Total in cents', text: String(typedTotal) }, check];
      }
      if (c.type === 'make-amount') {
        const available = c.availableCoins ?? ['penny', 'nickel', 'dime', 'quarter'];
        const coins = fewestCoins(c.targetAmount, available);
        if (!coins) throw new Error(`coin-counter make-amount: ${c.targetAmount}¢ cannot be made from ${available.join(', ')}`);
        const smallest = [...available].sort((a, b) => COIN_CENTS[a as keyof typeof COIN_CENTS] - COIN_CENTS[b as keyof typeof COIN_CENTS])[0];
        return [...(wrong ? [...coins, smallest] : coins).map((coin): DriverInput => ({ type: 'choose', label: `Add a ${coin}` })), check];
      }
      if (c.type === 'show-amount') {
        // Open build: Try again keeps the tray, so the driver reads what is on it (`centsMade`) and adds to it. A wrong
        // build is one coin short; pressing done again on the kept build is the second wrong.
        const bins = c.availableCoins ?? ['penny', 'nickel', 'dime'];
        const made = Number(ctx.demand?.centsMade ?? 0), target = c.targetAmount;
        const add = (coins: string[]) => coins.map((coin): DriverInput => ({ type: 'choose', label: `Add a ${coin}` }));
        const done: DriverInput = { type: 'choose', label: "I'm done!" };
        if (made > target || (wrong && made === target)) throw new Error(`coin-counter show-amount: ${made}¢ on the tray for ${target}¢`);
        if (wrong) return made ? [done] : [...add((fewestCoins(target, bins) ?? []).slice(0, -1)), done];
        const rest = fewestCoins(target - made, bins);
        if (!rest) throw new Error(`coin-counter show-amount: ${target - made}¢ cannot be made from ${bins.join(', ')}`);
        return [...add(rest), done];
      }
      if (c.type === 'compare') {
        const label = (g: string) => g === 'equal' ? "They're Equal" : `Group ${g}`;
        if (!wrong) return [{ type: 'choose', label: label(c.correctGroup) }, check];
        if (c.correctGroup === 'equal') return [{ type: 'choose', label: 'Group A' }, check];
        const other = c.correctGroup === 'A' ? 'B' : 'A';
        return [{ type: 'choose', label: label(other) }, check];
      }
      const change = c.correctChange ?? (c.paidAmount - c.itemCost);
      const typedChange = !wrong ? change : c.itemCost !== change ? c.itemCost : change + 1;
      return [{ type: 'write', label: 'Change in cents', text: String(typedChange) }, check];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'regrouping-workbench': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/RegroupingWorkbench.tsx',
    instanceId: 'regroup',
    defaults: { grade: 'Grade 2', mode: 'add_regroup', di: false, topic: 'Adding two-digit numbers with regrouping' },
    leakTokens: ['ACTIVITY_START', 'REGROUP_CARRY', 'REGROUP_BORROW', 'REGROUP_NOT_NEEDED', 'SOLVE_CORRECT', 'SOLVE_INCORRECT',
      'PHASE_TRANSITION', 'ALL_COMPLETE', '[TIER'],
    prompts: WORKSPACE_PROMPTS,
    // The answer is typed one digit per place box ("Ones digit", "Tens digit", ...) and checked. A wrong answer is the
    // mode's signature error from `regroupMiss`: the carry left out, the smaller digit taken from the larger, or (no
    // regroup) the ones digit off by one. Trades are optional and never checked, so the row does not make them.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = regroupItem(ctx);
      if (!c) throw new Error('No current regrouping-workbench challenge');
      const [a, b] = regroupOperands(c, ctx.data as { operand1: number; operand2: number });
      const op = ctx.data.operation as 'addition' | 'subtraction';
      const places = ({ tens: 2, hundreds: 3, thousands: 4 } as Record<string, number>)[ctx.data.maxPlace] ?? 2;
      const digits = regroupingHarnessDigits(op, a, b, places, intent === 'wrong' ? 'wrong' : 'correct');
      const names = ['Ones', 'Tens', 'Hundreds', 'Thousands'];
      return [...digits.map((d, i): DriverInput => ({ type: 'write', label: `${names[i]} digit`, text: String(d) })), { type: 'check' }];
    },
    replayKeys: ctx => {
      const c = regroupItem(ctx);
      if (!c) return [];
      const [a, b] = regroupOperands(c, ctx.data as { operand1: number; operand2: number });
      return [String(ctx.data.operation === 'addition' ? a + b : a - b)];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'area-model': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/AreaModel.tsx',
    instanceId: 'area',
    defaults: { grade: 'Grade 4', mode: 'find_area', di: false, topic: 'Multiplying with the area model' },
    leakTokens: ['CELL_INCORRECT', 'SUM_INCORRECT', 'PERIMETER_INCORRECT', 'FACTOR_INCORRECT', 'CHALLENGE_CORRECT',
      'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls. A forward item: tap each cell not yet right (the scene's `learnerWork`
    // lists the right ones; Try again keeps them), type its product and Check, then type the sum and Submit. A wrong
    // answer is the mode's signature error from `areaMiss`: the first open cell with its zeros dropped (or its parts
    // added), the sum less one cell once every cell is right, the two sides added for a perimeter, the parts swapped.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const mode = ctx.data.challengeType, wrong = intent === 'wrong';
      // An easier item (`~easier`) is rebuilt from its parent with the same builder.
      const parent = areaPracticeParent(ctx.itemId, ctx.data.challenges ?? []);
      const c: any = parent ? areaPracticeItem(parent, mode) : (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current area-model challenge');
      const f1: number[] = c.factor1Parts, f2: number[] = c.factor2Parts;
      const total = (p: number[]) => p.reduce((s, v) => s + v, 0);
      const write = (label: string, text: number | string): DriverInput => ({ type: 'write', label, text: String(text) });
      if (mode === 'perimeter') {
        const w = total(f1), h = total(f2);
        return [write('Perimeter', wrong ? w + h : 2 * (w + h)), { type: 'choose', label: 'Submit' }];
      }
      if (mode === 'factor') {
        const swapFits = areaPartsFit(c, f2.map(String), f1.map(String));
        const [top, left] = !wrong ? [f1, f2] : f1.length === f2.length && !swapFits ? [f2, f1] : [[f1[0] + 1, ...f1.slice(1)], f2];
        return [...top.map((v, i) => write(`Column part ${i + 1}`, v)), ...left.map((v, i) => write(`Row part ${i + 1}`, v)),
          { type: 'check' }];
      }
      if (mode !== 'build_model' && mode !== 'find_area' && mode !== 'multiply') throw new Error(`area-model: no driver for ${mode}`);
      const right = new Set(Array.from(String(ctx.demand?.learnerWork ?? '').matchAll(/in row (\d+), column (\d+)/g), m => `${+m[1] - 1},${+m[2] - 1}`));
      const open = f2.flatMap((_, r) => f1.map((_, k) => [r, k] as const)).filter(([r, k]) => !right.has(`${r},${k}`));
      const cell = (r: number, k: number, value: number): DriverInput[] => [{ type: 'choose', label: `Cell row ${r + 1} column ${k + 1}` },
        write('Cell product', value), { type: 'check' }];
      const products = areaCellProducts(c);
      if (wrong && open.length) {
        const [r, k] = open[0], a = f1[k], b = f2[r], p = a * b;
        return cell(r, k, p % 10 === 0 && p >= 10 && p / 10 !== a + b ? p / 10 : a + b !== p ? a + b : p + a);
      }
      const sum = total(f1) * total(f2);
      return [...open.flatMap(([r, k]) => cell(r, k, products[r][k])),
        write('Sum of the cell products', wrong ? sum - products[0][0] : sum), { type: 'choose', label: 'Submit Final Answer' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'percent-bar': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/PercentBar.tsx',
    instanceId: 'percent',
    defaults: { grade: 'Grade 6', mode: 'find_part', di: false, topic: 'Percents of a whole: discounts, tax and tips' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_INCORRECT', 'NEXT_STEP', 'CHALLENGE_CORRECT', 'NEXT_ITEM', 'ALL_COMPLETE',
      'HINT_REQUESTED', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls, from the step the scene reports (Try again keeps the steps already right):
    // each place step sets the bar's slider ("Percent on the bar") and presses Check; the compare step taps an option.
    // A wrong answer is the step's signature error from `percentMiss`: the discount placed, the rate not added to the
    // whole, the rest of the whole, or the other option; else ten points off.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c: any = percentBarItem(ctx);
      if (!c) throw new Error('No current percent-bar challenge');
      const from = Math.max(0, Number(String(ctx.demand?.step ?? '1').split(' ')[0]) - 1);
      return percentHarnessSteps(c, from, intent === 'wrong' ? 'wrong' : 'correct').flatMap((s): DriverInput[] => s.kind === 'place'
        ? [{ type: 'write', label: 'Percent on the bar', text: String(s.percent) }, { type: 'check' }]
        : [{ type: 'choose', label: s.label }, { type: 'check' }]);
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'net-folder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/NetFolder.tsx',
    instanceId: 'netfold',
    defaults: { grade: 'Grade 4', mode: 'match_faces', di: false, topic: '3D solids and their nets' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls (`netHarnessInput`): the three counts typed into Faces, Edges and Vertices;
    // a solid, a face, or Valid net / Invalid net tapped; the total typed into "Total surface area"; then Check. A wrong
    // answer is the mode's signature miss: faces and edges swapped, a solid from the other family, the opposite face,
    // the other verdict, half the total.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = netFolderItem(ctx);
      if (!item) throw new Error('No current net-folder challenge');
      const input = netHarnessInput(item.challenge, item.solid, intent === 'wrong' ? 'wrong' : 'correct');
      if (input.kind === 'counts') return [{ type: 'write', label: 'Faces', text: String(input.faces) },
        { type: 'write', label: 'Edges', text: String(input.edges) }, { type: 'write', label: 'Vertices', text: String(input.vertices) },
        { type: 'check' }];
      if (input.kind === 'total') return [{ type: 'write', label: 'Total surface area', text: String(input.value) }, { type: 'check' }];
      return [{ type: 'choose', label: input.label }, { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'formula-lab': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/FormulaLab.tsx',
    instanceId: 'formula',
    defaults: { grade: 'Grade 8', mode: 'predict-direction', di: false, topic: 'How changing one quantity in a formula changes the output' },
    leakTokens: ['ACTIVITY_START', 'PREDICTION_LOCKED', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE',
      'EASY support', 'MEDIUM support', 'HARD support'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls (`formulaHarnessInput`): the slider ("Changed quantity") set to the target;
    // the prediction ("Your prediction", hundredths of the track) and Lock prediction; the tokens tapped in order and
    // Check formula; the output typed ("Transferred output") and Check. A wrong answer is the mode's signature miss
    // (the other direction, the far end of the track, the reciprocal or another order, the starting values' output).
    // free-explore has no wrong move: every finished move is credited.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c: any = formulaLabItem(ctx);
      if (!c) throw new Error('No current formula-lab challenge');
      const input = formulaHarnessInput(ctx.data as any, c, intent === 'wrong' ? 'wrong' : 'correct');
      if (!input) return [];
      const reason = (label: string, text?: string): DriverInput[] => (text ? [{ type: 'write', label, text }] : []);
      switch (input.kind) {
        case 'value': return [{ type: 'write', label: 'Changed quantity', text: String(input.value) }];
        case 'predict': return [...reason('Prediction reason', input.reason),
          { type: 'write', label: 'Your prediction', text: String(input.percent) }, { type: 'choose', label: 'Lock prediction' }];
        case 'build': return [...input.tokens.map((label): DriverInput => ({ type: 'choose', label })), { type: 'check' }];
        case 'type': return [{ type: 'write', label: 'Transferred output', text: input.text },
          ...reason('Calculation reason', input.reason), { type: 'check' }];
      }
    },
    // The answer as the screen would print it: the output, and on construct the hidden expression.
    replayKeys: (ctx) => {
      const c: any = formulaLabItem(ctx);
      if (!c) return [];
      return c.type === 'construct-formula' ? [formulaTokensOf(String(ctx.data.expression)).join(' ')]
        : c.type === 'free-explore' ? [] : [formulaNumber(c.expectedTargetOutput)];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'parameter-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ParameterExplorer.tsx',
    instanceId: 'parameter',
    defaults: { grade: 'Grade 9', mode: 'predict-direction', di: false, topic: 'How each variable in a physics formula affects the result' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'REVEAL POLICY'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls (`parameterHarnessInput`): explore writes the first parameter's slider
    // ("<name> (<symbol>) slider") one step and presses Done Exploring; predict-direction chooses Increase / Decrease /
    // Stay Same and Check; predict-value types "Your prediction" and Check; identify chooses "<symbol> (<name>)" and
    // Check. A wrong answer is the mode's signature miss (the other direction, the starting output, the parameter with
    // the largest starting number). explore has no wrong move: Done Exploring opens only after a move.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c: any = parameterExplorerItem(ctx);
      if (!c) throw new Error('No current parameter-explorer challenge');
      const input = parameterHarnessInput(ctx.data as any, c, intent === 'wrong' ? 'wrong' : 'correct');
      if (!input) {
        if (c.type === 'explore') return [];
        throw new Error(`parameter-explorer ${c.type}: no input for this item`);
      }
      switch (input.kind) {
        case 'move': return [{ type: 'write', label: input.label, text: String(input.value) }, { type: 'choose', label: 'Done Exploring' }];
        case 'direction': return [{ type: 'choose', label: input.label }, { type: 'check' }];
        case 'type': return [{ type: 'write', label: 'Your prediction', text: input.text }, { type: 'check' }];
        case 'parameter': return [{ type: 'choose', label: input.label }, { type: 'check' }];
      }
    },
    // The answer as the screen would print it: predict-value's output. The direction words and the parameter names are
    // on screen as choices, so they are read by hand in the replies.
    replayKeys: (ctx) => {
      const c: any = parameterExplorerItem(ctx);
      const value = c?.type === 'predict-value' ? parameterAskedOutput(ctx.data as any, c) : null;
      return value === null || value === undefined ? [] : [parameterNumber(value)];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'ratio-table': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/RatioTable.tsx',
    instanceId: 'ratio',
    defaults: { grade: 'Grade 6', mode: 'missing_value', di: false, topic: 'Equivalent ratios and unit rates' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ANSWER_CLOSE', 'HINT_REQUESTED', 'NEXT_ITEM',
      'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: a number typed into "Your answer" and Check, or the multiplier slider
    // ("Multiplier") set and Check. A wrong answer is the item's signature error from `ratioMiss` (the change added,
    // the multiplier upside down, the rate inverted, one step off), else half again too high.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice problem (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = ratioPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerRatio(parent) : parent;
      if (!c) throw new Error('No current ratio-table challenge');
      const input = ratioHarnessInput(c, intent === 'wrong' ? 'wrong' : 'correct', ctx.data.maxMultiplier ?? 10);
      return input.kind === 'type'
        ? [{ type: 'write', label: 'Your answer', text: input.text }, { type: 'check' }]
        : [{ type: 'write', label: 'Multiplier', text: String(input.value) }, { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'matrix-display': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/MatrixDisplay.tsx',
    instanceId: 'matrix',
    defaults: { grade: 'Grade 10', mode: 'transpose', di: false, topic: 'Matrix operations' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'SHOW_STEPS', 'NEXT_ITEM', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: a number typed into each answer box ("Answer row i, column j") or the
    // determinant box, then Check. A wrong answer is the item's signature miss from `matrixMiss` (reading order kept,
    // the other operation, B·A, the products added, the swap without the negation), else one box off.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice problem (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = matrixPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerMatrix(parent) : parent;
      if (!c) throw new Error('No current matrix-display challenge');
      const input = matrixHarnessInput(c, intent === 'wrong' ? 'wrong' : 'correct');
      if (input.kind === 'scalar') return [{ type: 'write', label: MATRIX_SCALAR_LABEL, text: input.text }, { type: 'check' }];
      return [...input.cells.flatMap((row, i) => row.map((text, j) => ({ type: 'write' as const, label: matrixBoxLabel(i, j), text }))),
        { type: 'check' }];
    },
    // The typed boxes name the answer in parts, most of them numbers the matrices already show. The key is the
    // determinant, or the result entries the screen does not show (a sum, a product, a sign changed).
    replayKeys: (ctx) => {
      const c: any = ctx.challenge;
      if (!c) return [];
      // A determinant equal to one of the drawn entries ([[3, 5], [-1, -2]] is -1) cannot be told from reading the matrix.
      const shown = new Set([...(c.values ?? []).flat(), ...(c.secondMatrix?.values ?? []).flat()].map(matrixEntry));
      if (typeof c.expectedScalar === 'number') return shown.has(matrixEntry(c.expectedScalar)) ? [] : [matrixEntry(c.expectedScalar)];
      return Array.from(new Set(((c.expectedMatrix ?? []) as number[][]).flat().map(matrixEntry)))
        .filter(k => !shown.has(k) && !['0', '1', '2', '3'].includes(k));
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'histogram': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/Histogram.tsx',
    instanceId: 'histo',
    defaults: { grade: 'Grade 7', mode: 'read_frequency', di: false, topic: 'Reading histograms: shape, modal bin, frequency and center' },
    leakTokens: ['ACTIVITY_START', 'NEXT_HISTOGRAM', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls (`histogramHarnessInput`): a shape chip tapped, a bar tapped (`bar-<i>`), or
    // a number typed into "Your answer", then Check. A wrong answer is the item's signature miss: the other skew or one
    // peak for two, the bar next to the tallest, an edge of the asked bin, two bar widths off the center.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice graph (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = histogramPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerHistogram(parent) : parent;
      if (!c) throw new Error('No current histogram challenge');
      const input = histogramHarnessInput(c, intent === 'wrong' ? 'wrong' : 'correct');
      if (input.kind === 'choose') return [{ type: 'choose', label: input.label }, { type: 'check' }];
      if (input.kind === 'bar') return [{ type: 'touch', target: `bar-${input.index}` }, { type: 'check' }];
      return [{ type: 'write', label: 'Your answer', text: input.text }, { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'two-way-table': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/TwoWayTable.tsx',
    instanceId: 'twt',
    defaults: { grade: 'Grade 8', mode: 'joint_probability', di: false, topic: 'Probability from two-way tables' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'TIER:'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: a probability typed into "Your answer" and Check. A wrong answer is the
    // item's signature miss from `twoWayMiss` (the cell out of its own row, a conditional out of everyone, one cell for a
    // marginal, the observed cell for independence), else 0.3 off.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice table (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = twoWayPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerTable(parent) : parent;
      if (!c) throw new Error('No current two-way-table challenge');
      return [{ type: 'write', label: 'Your answer', text: twoWayHarnessText(c, intent === 'wrong' ? 'wrong' : 'correct') },
        { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'coordinate-graph': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/CoordinateGraph.tsx',
    instanceId: 'coord',
    defaults: { grade: 'Grade 6', mode: 'plot_point', di: false, topic: 'Ordered pairs on the coordinate plane' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'Support tier'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: plot_point taps the grid crossing on the plane (a one-point pointer stroke
    // in its viewBox), the other modes tap a choice; the tap is the check. A wrong answer is the item's signature miss
    // (`coordinateHarnessInput`): x and y swapped or a sign flipped, or the first wrong choice with a named miss.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const grid = { gridMin: ctx.data.gridMin, gridMax: ctx.data.gridMax };
      // An easier practice item (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = coordinatePracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerCoordinate(parent, grid) : parent;
      if (!c) throw new Error('No current coordinate-graph challenge');
      const input = coordinateHarnessInput(c, intent === 'wrong' ? 'wrong' : 'correct', grid);
      if (input.kind === 'choose') return [{ type: 'choose', label: input.label }];
      return [{ type: 'draw', target: 'plane', strokes: [[planePixel(grid.gridMin, grid.gridMax, input.point)]] }];
    },
    // The key as the screen prints it: the pair, the slope or the intercept choice. plot_point's pair is its own ask.
    replayKeys: ctx => {
      const parentId = coordinatePracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId
        ? simplerCoordinate(parent, { gridMin: ctx.data.gridMin, gridMax: ctx.data.gridMax }) : parent;
      return c && c.type !== 'plot_point' ? [coordinateKeyText(c)] : [];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'systems-equations-visualizer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/SystemsEquationsVisualizer.tsx',
    instanceId: 'systems',
    defaults: { grade: 'Grade 8', mode: 'graph', di: false, topic: 'Solving systems of linear equations' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: x and y typed into their boxes, then Check. A wrong answer is the item's first
    // signature miss (`systemsHarnessPoint`): x and y swapped, a sign flipped, or one step off. A practice item
    // (`~simpler`) is rebuilt from its parent with the same builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const parentId = systemsPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerSystem(parent) : parent;
      if (!c) throw new Error('No current systems-equations-visualizer challenge');
      const p = systemsHarnessPoint(c, intent === 'wrong' ? 'wrong' : 'correct');
      return [{ type: 'write', label: 'x', text: String(p.x) }, { type: 'write', label: 'y', text: String(p.y) }, { type: 'check' }];
    },
    // The key as a pair, as the screen prints it once solved.
    replayKeys: ctx => {
      const parentId = systemsPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerSystem(parent) : parent;
      return c ? [systemsPairText({ x: c.expectedX, y: c.expectedY })] : [];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'slope-triangle': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/SlopeTriangle.tsx',
    instanceId: 'slope',
    defaults: { grade: 'Grade 8', mode: 'identify_slope', di: false, topic: 'Slope as rise over run' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'Support tier'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls (`slopeHarnessSteps`): identify types the rise and the run, calculate types the
    // slope, draw presses the run and rise buttons from the run and rise the scene prints to the generated example
    // triangle; then Check. A wrong answer is the item's signature miss: the legs swapped (or the rise's sign lost), the
    // slope turned over, the built rise the wrong way.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c: any = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current slope-triangle challenge');
      return slopeHarnessSteps(c, intent === 'wrong' ? 'wrong' : 'correct', slopeBuiltTriangle(c, ctx.demand?.learnerWork))
        .map((s): DriverInput => (s.kind === 'check' ? { type: 'check' } : s.kind === 'write'
          ? { type: 'write', label: s.label, text: s.text } : { type: 'choose', label: s.label }));
    },
    // The key: the rise and the run (identify), the slope in lowest terms (calculate). A build has no single key: any
    // run with its rise fits.
    replayKeys: ctx => {
      const c: any = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c || c.type === 'draw_triangle') return [];
      return c.type === 'identify_slope' ? [String(c.expectedRise), String(c.expectedRun)] : [slopeRatioText(c.expectedRise, c.expectedRun)];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'function-sketch': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/FunctionSketch.tsx',
    instanceId: 'fsketch',
    defaults: { grade: 'Grade 10', mode: 'classify-shape', di: false, topic: 'Families of functions and their graphs' },
    leakTokens: ['FEATURE_FOUND', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', '[TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls (`functionSketchHarnessInput`), then Check Answer: classify taps a family,
    // compare taps a curve's button, identify taps features on the canvas (one-point strokes in canvas pixels), sketch
    // taps the function's own curve point by point. A wrong answer is the item's signature miss: a confused family, the
    // other curve, one feature only, the sketch upside down or a flat line.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice item (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = sketchPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerSketchItem(parent) : parent;
      if (!c) throw new Error('No current function-sketch challenge');
      const input = functionSketchHarnessInput(c, intent === 'wrong' ? 'wrong' : 'correct');
      if (input.kind === 'choose') return [{ type: 'choose', label: input.label }, { type: 'check' }];
      return [{ type: 'draw', strokes: input.points.map(p => [sketchCanvasPixel(c, p)]) }, { type: 'check' }];
    },
    // The key as the screen prints it: the family (classify). A curve, a feature or a sketch has no one printed key.
    replayKeys: ctx => {
      const parentId = sketchPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerSketchItem(parent) : parent;
      return c?.type === 'classify-shape' && c.correctType ? [String(c.correctType)] : [];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'distribution-explorer': {
    execution: 'workspace',
    component: 'primitives/DistributionExplorer.tsx',
    instanceId: 'distribution',
    defaults: { grade: 'Grade 11', mode: 'identify', di: false, topic: 'Binomial and Poisson distributions' },
    leakTokens: ['ACTIVITY_START', 'EXPLORATION_DONE', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_CHALLENGE', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls. A choice item: the choice's button (its aria-label), then Check; a wrong
    // answer is the first other choice on screen. Explore: the first slider moved to a new value (read from the scene's
    // workbench fact), then Got it; a wrong answer is Got it with nothing moved.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice item (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = distributionPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? distributionPracticeItem(parent) : parent;
      if (!c) throw new Error('No current distribution-explorer challenge');
      if (c.type === 'guided_exploration') {
        if (intent === 'wrong') return [{ type: 'choose', label: 'Got it' }];
        const slider = distributionHarnessSlider(String(ctx.demand?.workbench ?? ''));
        if (!slider) throw new Error('distribution-explorer explore: no slider in the scene');
        return [{ type: 'write', label: slider.label, text: slider.text }, { type: 'choose', label: 'Got it' }];
      }
      const label = distributionHarnessChoice(c, intent === 'wrong' ? 'wrong' : 'correct');
      if (!label) throw new Error(`distribution-explorer ${c.type}: no choice to press`);
      return [{ type: 'choose', label }, { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'circle-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/CircleExplorer.tsx',
    instanceId: 'circle',
    defaults: { grade: 'Grade 7', mode: 'circumference', di: false, topic: 'Circumference and area of a circle' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: on discover π "Unroll the circumference" first (until the scene says it is
    // unrolled; Try again keeps it), then the number typed into "Your answer" and Check. A wrong answer is the item's
    // signature error from `circleMiss` (the radius for the diameter, the radius not squared, the diameter for the
    // radius, the whole circle for the half, d ÷ C), else half again too high.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice problem (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = circlePracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId ? simplerCircle(parent) : parent;
      if (!c) throw new Error('No current circle-explorer challenge');
      const unroll: DriverInput[] = c.type === 'discover_pi' && /has not unrolled/.test(String(ctx.demand?.learnerWork ?? ''))
        ? [{ type: 'choose', label: 'Unroll the circumference' }] : [];
      return [...unroll, { type: 'write', label: 'Your answer', text: circleHarnessText(c, intent === 'wrong' ? 'wrong' : 'correct') },
        { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'double-number-line': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/DoubleNumberLine.tsx',
    instanceId: 'dnl',
    defaults: { grade: 'Grade 6', mode: 'find_missing', di: false, topic: 'Ratios on a double number line' },
    leakTokens: ['ACTIVITY_START', 'CHALLENGE_START', 'PHASE_COMPLETE', 'WRONG_ANSWER', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real control: the bottom value typed into the box named for the asked point ("<bottom>
    // when <top> is <n>") and Check. A wrong answer is the item's signature error from `ratioLineMiss`: the given
    // bottom value on a find-the-rate item, else the top value plus the rate (added once, not scaled).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier item (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = dnlPracticeParent(String(ctx.itemId ?? ''));
      const parent: any = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = parent && parentId !== ctx.itemId
        ? dnlSimplerLine(parent, { topLabel: ctx.data.topLabel, bottomLabel: ctx.data.bottomLabel }) : parent;
      if (!c) throw new Error('No current double-number-line challenge');
      const values = dnlHarnessValues(c, intent === 'wrong' ? 'wrong' : 'correct');
      return [...c.targetPoints.map((t: { topValue: number }, i: number): DriverInput => ({ type: 'write',
        label: dnlAnswerLabel(ctx.data.bottomLabel, ctx.data.topLabel, t.topValue), text: values[i] })), { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'factor-tree': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/FactorTree.tsx',
    instanceId: 'factor',
    defaults: { grade: 'Grade 5', mode: 'unguided', di: false, topic: 'Prime factorization with factor trees' },
    leakTokens: ['ACTIVITY_START', 'SPLIT_INVALID', 'SPLIT_CORRECT', 'NODE_SELECTED', 'TREE_RESET', 'TREE_COMPLETE',
      'HINT_USED', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls, from the leaves the scene reports (Try again keeps the right splits): tap
    // a number that is not prime ("Split 36"), type "Factor 1" and "Factor 2", press Split, until every leaf is prime.
    // A wrong answer is the first composite leaf split into its smallest prime and the partner plus one (`factorMiss`).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const leaves = String(ctx.demand?.leaves ?? '').split(',').map(s => Number(s.trim())).filter(n => n > 0);
      if (!leaves.length) throw new Error('No factor-tree leaves in the scene');
      return factorHarnessSplits(leaves, intent === 'wrong' ? 'wrong' : 'correct').flatMap((s): DriverInput[] => [
        { type: 'choose', label: `Split ${s.value}` },
        { type: 'write', label: 'Factor 1', text: String(s.factor1) },
        { type: 'write', label: 'Factor 2', text: String(s.factor2) },
        { type: 'choose', label: 'Split' },
      ]);
    },
    // The typed factors are steps; the answer is the factorization the finished tree prints.
    replayKeys: ctx => {
      // A practice tree (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = factorPracticeParent(String(ctx.itemId ?? ''));
      const parent = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c = parent && parentId !== ctx.itemId ? smallerTree(parent) : parent;
      return c ? factorizationForms(c.rootValue) : [];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'equation-workspace': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/EquationWorkspace.tsx',
    instanceId: 'equation',
    defaults: { grade: 'Grade 8', mode: 'solve', di: false, topic: 'Solving two-step linear equations' },
    leakTokens: ['NEXT_ITEM', 'STEP_CORRECT', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls, from the line the scene reports (Try again keeps the applied steps): tap
    // each remaining step's operation by its label, or under identify-operation choose one and press Check. A wrong
    // answer is the item's signature error from `equationMiss`: the opposite operation on the same number, else a
    // later step, else another operation in the menu.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A practice equation (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = equationPracticeParent(String(ctx.itemId ?? ''));
      // The component merges adjacent combine steps (`mergeCommutingSteps`); the row drives what it renders.
      const raw: any = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const parent: any = raw ? mergeCommutingSteps(raw) : raw;
      const c: any = parent && parentId !== ctx.itemId ? equationFewerSteps(parent) : parent;
      if (!c) throw new Error('No current equation-workspace challenge');
      const done = stepsDoneFrom(c, ctx.demand?.currentEquation as string | undefined);
      const labels = equationHarnessChoices(c, done, intent === 'wrong' ? 'wrong' : 'correct');
      if (!labels.length) throw new Error(`equation-workspace ${c.type}: no ${intent} operation in the menu`);
      const taps = labels.map((label): DriverInput => ({ type: 'choose', label }));
      return c.type === 'identify-operation' ? [...taps, { type: 'check' }] : taps;
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'practice-problem': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/PracticeProblem.tsx',
    instanceId: 'practice',
    defaults: { grade: 'Grade 8', mode: 'derive_medium', di: false, topic: 'Solving two-step linear equations' },
    leakTokens: ['PROBLEM_LOADED', 'VERDICT_CORRECT', 'VERDICT_PARTIAL', 'VERDICT_INCORRECT', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode is a handwritten derivation the checker reads with a vision transcription and a model judge
    // (`transcribeWork`, `compareWork`). The driver's jsdom has no canvas image and the sweep no judge, so the row
    // cannot produce a checked answer: every mode throws. `PracticeProblem.workspace.test.tsx` drives the binding
    // with both routes stubbed.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      throw new Error(`practice-problem ${String(ctx.data.evalMode ?? 'derive')} is not driven at W1 (handwriting read by a model judge)`);
    },
    probes: { mounted: { selector: 'canvas' } },
  },
  'measure-lab': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/MeasureLab.tsx',
    instanceId: 'measure',
    defaults: { grade: 'Kindergarten', mode: 'balance_predict', di: false, topic: 'Heavier and lighter' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // Every type through its real controls: a guess then the test (both on the scale, or Pour), cups poured one at a
    // time then a number, or the jars tapped in order. A wrong answer is the mode's signature error from
    // `measureMiss`: the lighter guess, the guess that holds less, one cup short, the order reversed. Try again
    // clears the bench, so every program starts from a blank one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier item (`~smaller`) is rebuilt from its parent with the same builder.
      const parent = measurePracticeParent(ctx.itemId, ctx.data.challenges ?? []);
      const c: any = parent ? measurePracticeItem(parent) : (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current measure-lab challenge');
      const wrong = intent === 'wrong';
      const choose = (label: string): DriverInput => ({ type: 'choose', label });
      if (c.type === 'balance_predict') {
        const guess = wrong ? [c.left, c.right].find((o: { id: string }) => o.id !== c.expectedChoice) : [c.left, c.right].find((o: { id: string }) => o.id === c.expectedChoice);
        return [choose(guess.name), choose(`Put ${c.left.name} on`), choose(`Put ${c.right.name} on`)];
      }
      if (c.type === 'capacity_predict') {
        const guess = [c.containerA, c.containerB].find((x: { id: string }) => (x.id === c.expectedChoice) !== wrong);
        return [choose(guess.name), choose(`Pour ${c.unitName || 'cups'} into both`)];
      }
      if (c.type === 'pour_count') {
        const want: number = c.expectedCount, options: number[] = c.options ?? [];
        const pick = !wrong ? want : options.includes(want - 1) ? want - 1 : options.find(n => n !== want);
        if (pick === undefined) throw new Error('measure-lab pour_count: no wrong number offered');
        return [...Array.from({ length: c.container.capacity }, () => choose('Pour one in')), choose(String(pick))];
      }
      if (c.type === 'order_capacity') {
        const byId = new Map((c.containers ?? []).map((j: { id: string; name: string }) => [j.id, j.name]));
        const ids: string[] = wrong ? [...c.expectedOrder].reverse() : c.expectedOrder;
        return ids.map(id => choose(String(byId.get(id))));
      }
      throw new Error(`measure-lab: no driver for ${c.type}`);
    },
    probes: { mounted: { selector: '[data-pip-object]' } },
  },
  'measurement-tools': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/MeasurementTools.tsx',
    instanceId: 'ruler',
    defaults: { grade: 'Grade 2', mode: 'measure', di: false, topic: 'Measuring length with a ruler' },
    leakTokens: ['ACTIVITY_START', 'SHAPE_PLACED', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'MEASURE_CORRECT', 'CONVERT_CORRECT',
      'CONVERT_INCORRECT', 'COMPARE_CORRECT', 'COMPARE_INCORRECT', 'MEASURE_PHASE_DONE', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: Put it on the ruler, the length typed into its box, Check Answer; convert
    // then types the converted length and presses Check Conversion; compare's last item taps the shapes shortest to
    // longest. A wrong answer is the mode's signature error from `measurementMiss`: one unit over (measure, compare),
    // the whole number above the half (estimate), the measured number kept (convert), the order reversed. Try again on
    // a conversion keeps the checked measurement (the scene's `step` says which step is open).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const wrong = intent === 'wrong';
      const d = ctx.data as { challengeType: string; unit: string; convertToUnit?: string;
        challenges: Array<{ id: string; label: string; widthInches: number }> };
      const choose = (label: string): DriverInput => ({ type: 'choose', label });
      // An easier practice item (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = rulerPracticeParent(ctx.itemId);
      const all = measurementItems(d.challengeType as 'measure', (d.challenges ?? []) as any);
      const item = parentId ? rulerPracticeItem(all.find(i => i.id === parentId)!, rulerLessonOf(ctx.data as any))
        : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current measurement-tools item');
      if (item.kind === 'order') {
        const sorted = [...(item.shapes ?? d.challenges ?? [])].sort((a, b) => a.widthInches - b.widthInches).map(s => s.label);
        return [...(wrong ? sorted.reverse() : sorted).map(choose), choose('Check Order')];
      }
      const c = item.challenge;
      const toUnit = d.convertToUnit || (d.unit === 'inches' ? 'centimeters' : 'inches');
      const measure = (value: number): DriverInput[] => [
        ...(String(ctx.demand?.placed ?? '').startsWith('on the ruler') ? [] : [choose('Put it on the ruler')]),
        { type: 'write', label: `Length in ${d.unit}`, text: String(value) }, choose('Check Answer')];
      if (d.challengeType === 'convert') {
        const exact = d.unit === 'inches' ? c.widthInches * 2.54 : c.widthInches / 2.54;
        const converted = wrong ? c.widthInches : Math.round(exact * 10) / 10;
        const convert: DriverInput[] = [{ type: 'write', label: `Length in ${toUnit}`, text: String(converted) }, choose('Check Conversion')];
        return ctx.demand?.step === 'convert' ? convert : [...measure(c.widthInches), ...convert];
      }
      if (!wrong) return measure(c.widthInches);
      return measure(c.widthInches + (d.challengeType === 'estimate' ? 0.5 : 1));
    },
    probes: { mounted: { selector: '[data-pip-object]' } },
  },
  'length-lab': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/LengthLab.tsx',
    instanceId: 'length',
    defaults: { grade: 'Kindergarten', mode: 'compare', di: false, topic: 'Comparing and measuring lengths' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START', '[ESTIMATE', '[TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every type through its real controls. A wrong answer is the mode's signature error from `lengthMiss`: the
    // other comparison, one unit too many, tiling to the guess, the bigger unit, the order reversed, the other object.
    // A guess kept from a wrong attempt (Try again keeps it) is read from the scene's `guess` fact.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier item (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = String(ctx.itemId ?? '').replace(/~simpler$/, '');
      const found = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = found && parentId !== ctx.itemId ? simplerLength(found, ctx.data.unitType) : found;
      if (!c) throw new Error('No current length-lab challenge');
      const wrong = intent === 'wrong', check: DriverInput = { type: 'check' };
      const unitOf = (u?: string) => (u || ctx.data.unitType || 'cubes').replace('_', ' ');
      const lay = (unit: string, n: number): DriverInput[] => Array.from({ length: n }, () => ({ type: 'choose', label: `Add ${unit}` }));
      const truth: number = c.correctUnitCount || c.objectLength0;
      if (c.type === 'compare') {
        const pick = !wrong ? c.correctAnswer : c.correctAnswer === 'same' ? 'longer' : c.correctAnswer === 'longer' ? 'shorter' : 'longer';
        return [{ type: 'choose', label: pick === 'same' ? 'They are the same length' : `${c.objectName0} is ${pick}` }];
      }
      if (c.type === 'tile_and_count') return [...lay(unitOf(c.unitType), wrong ? truth + 1 : truth), check];
      if (c.type === 'estimate_then_tile') {
        const kept = Number(ctx.demand?.guess);
        const guess = Number.isInteger(kept) ? kept
          : wrong ? (c.estimateOptions ?? []).find((g: number) => g !== truth) ?? truth : truth;
        const pick: DriverInput[] = Number.isInteger(kept) ? [] : [{ type: 'choose', label: String(guess) }];
        return [...pick, ...lay(unitOf(c.unitType), !wrong ? truth : guess !== truth ? guess : truth + 1), check];
      }
      if (c.type === 'two_unit_compare') {
        const a = unitOf(c.unitType), b = unitOf(c.unitTypeB);
        const more = c.correctUnitCount > c.correctUnitCountB ? a : b;
        return [...lay(a, c.correctUnitCount), check, ...lay(b, c.correctUnitCountB), check,
          { type: 'choose', label: wrong ? (more === a ? b : a) : more }];
      }
      if (c.type === 'order') {
        const names = String(c.correctOrderCsv ?? '').split(',').map((s: string) => s.trim());
        return [...(wrong ? [...names].reverse() : names).map((label): DriverInput => ({ type: 'choose', label })), check];
      }
      if (c.type === 'indirect') {
        const other = c.correctAnswer === c.objectName0 ? c.objectName1 : c.objectName0;
        const pick = !wrong ? c.correctAnswer : c.correctAnswer === 'same' ? c.objectName0 : other;
        return [{ type: 'choose', label: pick === 'same' ? 'Same length' : `${pick} is longer` }];
      }
      throw new Error(`length-lab: no driver input for ${c.type}`);
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'analog-clock': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/AnalogClock.tsx',
    instanceId: 'clock',
    defaults: { grade: 'Grade 1', mode: 'read', di: false, topic: 'Telling time to the hour and half hour' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every type through its real controls, then Check. A wrong answer is another option or face, or the other hand
    // (`clockMiss`). count_face has no wrong check: a number out of order restarts the count, so wrong is empty.
    // set_time moves the hands by dragging the dial or the bar under it; the driver has no drag input.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A simpler item (`~simpler`, the simplify lever) is rebuilt from its parent with the same builder.
      const parent = clockPracticeParent(ctx.itemId, ctx.data.challenges ?? []);
      const c: any = parent ? clockPracticeItem(parent) : (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current analog-clock challenge');
      const wrong = intent === 'wrong';
      const check: DriverInput = { type: 'check' };
      if (c.type === 'set_time') throw new Error('analog-clock set_time: the hands move by drag (dial or time bar); the driver has no drag input');
      if (c.type === 'count_face') {
        if (wrong) return [];
        return [...Array.from({ length: 12 }, (_, i): DriverInput => ({ type: 'touch', target: `number-${i + 1}` })), check];
      }
      if (c.type === 'hand_name') {
        const hand = (c.targetHand === 'hour') !== wrong ? 'short' : 'long';
        return [{ type: 'touch', target: `hand-${hand}` }, check];
      }
      const options: string[] = [c.option0, c.option1, c.option2, c.option3].filter(Boolean);
      // A wrong option that does not contain the right one's words ("2 hours 45 minutes" holds "45 minutes").
      const right = options[c.correctOptionIndex] ?? '';
      const at = wrong ? options.findIndex((o, i) => i !== c.correctOptionIndex && !o.includes(right)) : c.correctOptionIndex;
      if (at < 0 || !options[at]) throw new Error(`analog-clock ${c.type}: no ${intent} option`);
      return [{ type: 'choose', label: c.type === 'hear_time' ? `Clock face ${at + 1}` : options[at] }, check];
    },
    probes: { mounted: { selector: '[data-pip-object="clock"]' } },
  },
  'time-sequencer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/TimeSequencer.tsx',
    instanceId: 'times',
    defaults: { grade: 'Kindergarten', mode: 'sequence-3', di: false, topic: 'Daily routines and the order of the day' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every type through its real buttons (cards and choices are named by their `aria-label`), then Check. A wrong
    // answer is the mode's signature error from `timeSequencerMiss`: the day reversed (after a pre-placed first card,
    // the rest reversed), the neighbouring time of day, another card, the shorter activity, another schedule row.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice item (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const all = ctx.data.challenges ?? [], parent = timePracticeParent(ctx.itemId, all);
      const c: any = parent ? timePracticeItem(parent) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current time-sequencer challenge');
      const wrong = intent === 'wrong';
      const check: DriverInput = { type: 'check' };
      const choose = (label: string): DriverInput => ({ type: 'choose', label });
      const labelOf = (cards: { id: string; label: string }[], id: string) => cards.find(e => e.id === id)!.label;
      if (c.type === 'sequence-events' || c.type === 'clock-sequence') {
        const order: string[] = c.correctOrder;
        // The start-here card is already placed (and placed again after Try again): tapping it would take it out.
        const rest = c.prelabelFirstSlot && order.length > 1 ? order.slice(1) : order;
        if (wrong && rest.length < 2) throw new Error(`time-sequencer ${c.type}: one card left to place has no wrong order`);
        return [...(wrong ? [...rest].reverse() : rest).map(id => choose(labelOf(c.events, id))), check];
      }
      if (c.type === 'match-time-of-day') {
        const periods = ['morning', 'afternoon', 'evening', 'night'];
        // A two-choice practice item offers only its own time of day and the opposite one.
        const pick = !wrong ? c.correctPeriod : c.periodChoices ? c.periodChoices.find((p: string) => p !== c.correctPeriod)
          : periods[(periods.indexOf(c.correctPeriod) + 1) % 4];
        return [choose(pick.charAt(0).toUpperCase() + pick.slice(1)), check];
      }
      if (c.type === 'before-after') {
        const pick = wrong ? c.options.find((e: { id: string }) => e.id !== c.correctEvent).id : c.correctEvent;
        return [choose(labelOf(c.options, pick)), check];
      }
      if (c.type === 'duration-compare') {
        const label = (k: string) => k === 'same' ? 'About the Same' : (k === 'A' ? c.eventA : c.eventB).label;
        const pick = !wrong ? c.correctAnswer : c.correctAnswer === 'A' ? 'B' : 'A';
        return [choose(label(pick)), check];
      }
      const options: string[] = c.activityOptions ?? c.schedule.map((r: { activity: string }) => r.activity);
      return [choose(wrong ? options.find(o => o !== c.correctActivity)! : c.correctActivity), check];
    },
    probes: { mounted: { selector: '[data-pip-object="events"], [data-pip-object="event"], [data-pip-object="reference"], '
      + '[data-pip-object="durations"], [data-pip-object="schedule"]' } },
  },
  'angle-workshop': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/AngleWorkshop.tsx',
    instanceId: 'angles',
    defaults: { grade: 'Grade 4', mode: 'make_angle', di: false, topic: 'Acute, right, obtuse and straight angles' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: make_angle starts over, turns the ray with Open wider and presses I'm done!
    // (wrong: an angle of another kind, or outside the range); measure places the protractor and types; the solving
    // modes type; classify taps a relationship; then Check. The easier practice ask is rebuilt from its parent.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      const parent = angleWorkshopPracticeParent(ctx.itemId, all);
      const c = parent ? angleWorkshopPracticeFor(parent) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current angle-workshop challenge');
      return angleWorkshopHarnessInputs(c, intent === 'wrong', ctx.demand);
    },
    probes: { mounted: { selector: '[data-pip-object="angle-build"], canvas' } },
  },
  'transformation-lab': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/TransformationLab.tsx',
    instanceId: 'transform',
    defaults: { grade: 'Grade 8', mode: 'apply_rotation', di: false, topic: 'Rigid motions and dilations on the coordinate plane' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE', 'REVEAL'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls, from a blank start (Try again puts the figure back on the pre-image): the
    // drag modes drag each pink corner on the grid canvas; identify taps an option; compose presses
    // the flip or turn and then the slides; then Check. Wrong is the mode's signature miss (`transformHarnessInputs`).
    // An easier practice item (`~simpler`) is rebuilt from its parent with the same builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = transformItem(ctx);
      if (!c) throw new Error('No current transformation-lab challenge');
      return transformHarnessInputs(c, intent === 'wrong' ? 'wrong' : 'correct');
    },
    // A drag's key is its image corners as printed, "(6, 0)", not the lone digits of the credited response.
    replayKeys: ctx => {
      const c = transformItem(ctx);
      return c ? transformReplayKeys(c) : [];
    },
    probes: { mounted: { selector: 'canvas[data-pip-object="canvas"]' } },
  },
  'array-grid': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ArrayGrid.tsx',
    instanceId: 'arrays',
    defaults: { grade: 'Grade 3', mode: 'count_array', di: false, topic: 'Arrays and multiplication' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // build, count and multiply type through the real inputs, build first pressing its rows and columns; wrong types
    // rows + columns as the total (`added_sides`). make_array clears the kept grid, fills a rectangle from the top-left
    // cell and presses I'm done; a two-ways item then clears and makes an array with other rows. Wrong: the first
    // array with one more square under it (`ragged`).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const wrong = intent === 'wrong', all: ArrayGridChallenge[] = ctx.data.challenges ?? [];
      // An easier array (the simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = ctx.itemId?.endsWith('~smaller') ? all.find(x => `${x.id}~smaller` === ctx.itemId) : undefined;
      const c = parent ? smallerArray(parent) : all.find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current array-grid challenge');
      const check: DriverInput = { type: 'check' };
      if (ctx.data.challengeType === 'make_array') {
        const total = c.total ?? 0, arrays = arraysOf(total), grid = gridFor(total);
        const first = arrays.find(a => a.rows >= 2 && a.columns >= 2) ?? arrays[0];
        const second = arrays.find(a => a.rows !== first?.rows);
        if (!first) throw new Error(`array-grid make_array: ${total} squares make no array on the grid`);
        const fill = (a: { rows: number; columns: number }) => Array.from({ length: a.rows * a.columns },
          (_, i): DriverInput => ({ type: 'touch', target: `cell-${Math.floor(i / a.columns)}-${i % a.columns}` }));
        const clear: DriverInput = { type: 'choose', label: 'Clear the grid' }, done: DriverInput = { type: 'choose', label: "I'm done!" };
        const start = Number(ctx.demand?.squaresMade ?? 0) > 0 ? [clear] : [];
        if (wrong) return [...start, ...fill(first),
          { type: 'touch', target: first.rows < grid.rows ? `cell-${first.rows}-0` : `cell-0-${first.columns}` }, done];
        if (c.ways !== 2) return [...start, ...fill(first), done];
        if (!second) throw new Error(`array-grid make_array: ${total} squares have no second array on the grid`);
        return [...start, ...fill(first), done, clear, ...fill(second), done];
      }
      const r = c.targetRows, cols = c.targetColumns;
      const total = String(!wrong ? r * cols : r + cols !== r * cols ? r + cols : r * cols + 1);
      const write = (label: string, text: string): DriverInput => ({ type: 'write', label, text });
      if (ctx.data.challengeType === 'build_array') return [{ type: 'choose', label: `Rows: ${r}` },
        { type: 'choose', label: `Columns: ${cols}` }, write('Total', total), check];
      if (ctx.data.challengeType === 'count_array') return [write('Total', total), check];
      return [write('Rows', String(r)), write('Columns', String(cols)), write('Total', total), check];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'multiplication-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/MultiplicationExplorer.tsx',
    instanceId: 'multiply',
    defaults: { grade: 'Grade 3', mode: 'build', di: false, topic: 'Multiplication facts' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_CHALLENGE', 'PHASE_CHANGE', 'SESSION_COMPLETE', 'SUPPORT TIER'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode types one number into "Your answer" and presses Check. Wrong is the mode's signature error from
    // `multiplicationMiss`: the two factors added when the product is asked (one more when that is the product), the
    // product typed back when a factor is asked.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all: MultiplicationExplorerChallenge[] = ctx.data.challenges ?? [];
      // An easier fact (the simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = explorerPracticeParent(ctx.itemId ?? undefined, all);
      const c = parent ? explorerSmallerFact(parent, ctx.data.fact) : all.find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current multiplication-explorer challenge');
      if (!['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'].includes(c.type))
        throw new Error(`multiplication-explorer: no driver for ${c.type}`);
      const f = explorerFact(c, ctx.data.fact ?? { factor1: NaN, factor2: NaN, product: NaN });
      const key = explorerAnswer(c, f);
      const wrong = explorerSlot(c) !== 'product' ? f.product : f.factor1 + f.factor2 !== f.product ? f.factor1 + f.factor2 : f.product + 1;
      return [{ type: 'write', label: 'Your answer', text: String(intent === 'wrong' ? wrong : key) }, { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'compare-objects': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/CompareObjects.tsx',
    instanceId: 'measure',
    defaults: { grade: 'Kindergarten', mode: 'compare_two', di: false,
      topic: 'Deciding which of two objects is longer' },
    leakTokens: ['CO_'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the pack's own answer; an ordering touches the real object
    // buttons, in the right order or reversed (the mode's signature error).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const band = ctx.data.gradeBand ?? 'K', built = buildCompareItems(ctx.data.challenges ?? [], { band }).items;
      // An easier order (the simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = ctx.itemId?.endsWith('~simpler') ? built.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      const item = parent ? farThree(parent, (ctx.data.challenges ?? []).find((c: { id: string }) => c.id === parent.id))?.item
        : built.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current compare-objects assignment');
      if (item.answerKind === 'gesture') {
        const order = intent === 'wrong' ? [...item.answerNames].reverse() : item.answerNames;
        return order.map(name => ({ type: 'touch' as const, target: `pick-${name}` }));
      }
      const answers = compareObjectsHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="drawing"]' } },
  },
  'fraction-circles': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/FractionCircles.tsx',
    instanceId: 'circles',
    defaults: { grade: 'Grade 2', mode: 'build', di: false, topic: 'Building halves, thirds and fourths by shading equal slices' },
    leakTokens: ['FT_', 'IDENTIFY_', 'BUILD_', 'COMPARE_', 'EQUIVALENT_', 'ALL_COMPLETE', 'PHASE_TRANSITION'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is a gesture through the circle's own controls: typed text, shaded slices or a
    // choice, then Check. A wrong answer is one slice or one numerator off, or another choice.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier practice item (a simplify lever) is not a generated challenge: rebuild it from its parent
      // with the same deterministic builder. touch_fraction's easier item needs only its own fraction.
      const [parentId, easier] = (ctx.itemId ?? '').split('~');
      const parent = (ctx.data.challenges ?? []).find((ch: { id: string }) => ch.id === parentId);
      const c = !easier ? parent : !parent ? null : parent.type === 'touch_fraction'
        ? { ...parent, ...twoPictureFraction(parent) } : simplerFraction(parent, ctx.data.gradeBand);
      if (!c) throw new Error('No current fraction-circles assignment');
      const wrong = intent === 'wrong';
      const off = (n: number, max: number) => (n + 1 <= max ? n + 1 : n - 1);
      const check: DriverInput = { type: 'check' };
      const shade = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'touch' as const, target: `slice-${i}` }));
      switch (c.type) {
        case 'identify':
          return [{ type: 'write', label: 'Fraction answer', text: `${wrong ? off(c.numerator, c.denominator) : c.numerator}/${c.denominator}` }, check];
        case 'build': return [...shade(wrong ? off(c.numerator, c.denominator) : c.numerator), check];
        case 'equivalent': {
          const built = c.numerator * c.equivalentDenominator / c.denominator;
          return [...shade(wrong ? off(built, c.equivalentDenominator) : built), check];
        }
        case 'compare': {
          const left = c.numerator / c.denominator, right = c.compareFraction.numerator / c.compareFraction.denominator;
          const key = Math.abs(left - right) < 0.001 ? 'equal' : left > right ? 'left' : 'right';
          const choice = wrong ? (key === 'left' ? 'right' : 'left') : key;
          const labels = c.showFractionLabels !== false;
          const label = choice === 'equal' ? 'They are equal'
            : choice === 'left' ? (labels ? `Left (${c.numerator}/${c.denominator}) is larger` : 'Left is larger')
              : (labels ? `Right (${c.compareFraction.numerator}/${c.compareFraction.denominator}) is larger` : 'Right is larger');
          return [{ type: 'choose', label }, check];
        }
        case 'build_equal': {
          // The first other way the circle can make; halving every piece of the target's cut when no button makes it.
          // Wrong: one piece too many shaded on that cut (`one_off`).
          const band = ctx.data.gradeBand, way = equalWays(c.numerator, c.denominator, band)[0];
          if (!way) throw new Error(`fraction-circles build_equal ${c.numerator}/${c.denominator}: no other way to make it`);
          const direct = cutsFor(band).includes(way.pieces);
          const cut: DriverInput[] = direct ? [{ type: 'choose', label: `Cut into ${way.pieces} equal pieces` }]
            : [{ type: 'choose', label: `Cut into ${c.denominator} equal pieces` }, { type: 'choose', label: '✂️ Cut a piece in half' },
              ...Array.from({ length: c.denominator }, (_, k) => ({ type: 'touch' as const, target: `slice-${2 * k}` })),
              { type: 'choose', label: '✂️ Cut a piece in half' }];
          return [...cut, ...shade(wrong ? off(way.shaded, way.pieces) : way.shaded), { type: 'choose', label: "I'm done!" }];
        }
        case 'touch_fraction':
          // The two wrong pictures are drawn at random on mount, so the row cannot name one.
          if (wrong) throw new Error('fraction-circles touch_fraction: the wrong pictures are random per mount; no driver input for a wrong touch');
          return [{ type: 'touch', target: `picture-${c.numerator}-of-${c.denominator}` }];
        default: throw new Error(`fraction-circles ${c.type}: no driver input`);
      }
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"], [data-pip-object="stimulus"]' } },
  },
  'fraction-bar': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/FractionBar.tsx',
    instanceId: 'bar',
    defaults: { grade: 'Grade 3', mode: 'build', di: false, topic: 'Naming and building fractions on a bar' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'BUILD_', 'PHASE_TRANSITION', 'ACTIVITY_START', 'HINT_REQUESTED'],
    prompts: WORKSPACE_PROMPTS,
    // The three-step item goes through the bar's own controls from the step the scene names: the numerator button and
    // Check, the denominator button and Check, then the bar part that shades up to the numerator and Submit Fraction.
    // A wrong answer is the wrong number at the current step (the denominator for the numerator, and back), or one
    // part over on the bar. build_equal: the first other way the bar can make, split directly or by halving every part
    // of the target's split, shaded and "I'm done!" (wrong: one part too many, `one_off`).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const [parentId, easier] = (ctx.itemId ?? '').split('~');
      const parent = (ctx.data.challenges ?? []).find((ch: { id: string }) => ch.id === parentId);
      const band = ctx.data.gradeBand;
      // An easier practice item (the simplify lever) is not a generated challenge: rebuild it from its parent.
      const c = !easier ? parent : parent ? barPractice(ctx.data.challengeType, parent, band) : null;
      if (!c) throw new Error('No current fraction-bar assignment');
      const wrong = intent === 'wrong';
      const off = (n: number, max: number) => (n + 1 <= max ? n + 1 : n - 1);
      const part = (i: number): DriverInput => ({ type: 'touch', target: `part-${i}` });
      if (ctx.data.challengeType === 'build_equal') {
        const way = equalWays(c.numerator, c.denominator, band)[0];
        if (!way) throw new Error(`fraction-bar build_equal ${c.numerator}/${c.denominator}: no other way to make it`);
        const knife: DriverInput = { type: 'choose', label: '✂️ Cut a part in half' };
        const split: DriverInput[] = cutsFor(band).includes(way.pieces) ? [{ type: 'choose', label: `Split into ${way.pieces} equal parts` }]
          : [{ type: 'choose', label: `Split into ${c.denominator} equal parts` }, knife,
            ...Array.from({ length: c.denominator }, (_, k) => part(2 * k)), knife];
        const shaded = wrong ? off(way.shaded, way.pieces) : way.shaded;
        return [...split, ...Array.from({ length: shaded }, (_, i) => part(i)), { type: 'choose', label: "I'm done!" }];
      }
      const check: DriverInput = { type: 'choose', label: 'Check Answer' };
      const pick = (value: number, choices: number[], other: number) => {
        if (!wrong) return String(value);
        return String(choices.includes(other) && other !== value ? other : choices.find(x => x !== value));
      };
      const shade = (n: number): DriverInput[] => [...(n > 0 ? [part(n - 1)] : []), { type: 'choose', label: 'Submit Fraction' }];
      const step = ctx.demand?.step;
      if (step === 'shade') return shade(wrong ? off(c.numerator, c.denominator) : c.numerator);
      const denominator: DriverInput[] = [{ type: 'choose', label: pick(c.denominator, c.denominatorChoices, c.numerator) }, check];
      if (step === 'denominator') return wrong ? denominator : [...denominator, ...shade(c.numerator)];
      const numerator: DriverInput[] = [{ type: 'choose', label: pick(c.numerator, c.numeratorChoices, c.denominator) }, check];
      return wrong ? numerator : [...numerator, ...denominator, ...shade(c.numerator)];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'base-ten-blocks': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/BaseTenBlocks.tsx',
    instanceId: 'blocks',
    defaults: { grade: 'Grade 1', mode: 'build_number', di: false, topic: 'Building two-digit numbers with tens and ones' },
    leakTokens: ['BT_', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'BUILD_', 'TRADE_', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // Two surfaces, chosen by the payload. The judged mat (read_blocks, regroup): a spoken step says the
    // pack's own answer; a trade taps a block (wrong: another size, or the asked size twice). build_two_ways builds,
    // says I'm done, swaps one block for ten smaller and says I'm done again (wrong: a ten short). The click mat:
    // build_number presses each column's "Add one to ..." (wrong: a ten left as ten ones), then Check My Blocks;
    // operate types the result on the keypad (wrong: a ten off; on addition after modelling both numbers), then the check key.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const challenges = ctx.data.challenges ?? [];
      const wrong = intent === 'wrong';
      if (usesBaseTenDi(challenges)) {
        const item = baseTenItems(challenges, challenges[0].type).find(i => i.id === ctx.itemId);
        if (!item) throw new Error('No current base-ten-blocks assignment');
        if (item.answerKind !== 'gesture') {
          const answers = baseTenHarnessAnswers(item);
          return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
        }
        const tap = (place: number): DriverInput => ({ type: 'choose', label: `Trade one ${blockNoun(place, 1)} for ten ${blockNounPlural(place - 1)}` });
        if (!wrong) return [tap(item.problem.place)];
        const other = wrongTradePlace(item.problem);
        if (other >= 1) return [tap(other)];
        if (readCount(item.problem) >= 2) return [tap(item.problem.place), tap(item.problem.place)];
        throw new Error('base-ten-blocks regroup: this mat has no wrong trade the driver can tap');
      }
      // The click mat's challenge ids are `${type}-${index}` (assigned by the component). A simplify lever's practice
      // item (`<id>~plainer|simpler|smaller`) is rebuilt from its parent by the lever's own builder.
      const [parentId, practiceSuffix] = (ctx.itemId ?? '').split('~');
      const parent = challenges[Number(parentId.split('-').pop())];
      const c = parent && practiceSuffix ? baseTenPracticeFromId({ ...parent, id: parentId }, ctx.itemId!) : parent;
      if (!c) throw new Error('No current base-ten-blocks challenge');
      if (ctx.data.decimalMode) throw new Error(`base-ten-blocks ${c.type}: decimal mats are not driven at W1`);
      if (c.type === 'build_number') {
        // Wrong: the catalog's documented struggle, a ten left as ten ones (24 as 1 ten and 14 ones); one ones cube
        // too many when there is no ten to leave.
        const digits = String(c.targetNumber).padStart(4, '0').split('').map(Number);
        if (wrong && digits[2] > 0) { digits[2] -= 1; digits[3] += 10; } else if (wrong) digits[3] += 1;
        const presses = ['Thousands', 'Hundreds', 'Tens', 'Ones'].flatMap((column, i) =>
          Array.from({ length: digits[i] }, (): DriverInput => ({ type: 'choose', label: `Add one to ${column}` })));
        return [...presses, { type: 'choose', label: 'Check My Blocks' }];
      }
      if (c.type === 'build_two_ways') {
        // The open build. Correct: clear the mat (Try again keeps the build), build the standard form, I'm done (the
        // first way, no commit), then swap the largest block for ten of the next size and I'm done. Wrong: a ten short
        // (one ones cube over when there is no ten), the miss a lost ten shows.
        const columns = ['Thousands', 'Hundreds', 'Tens', 'Ones'];
        const digits = String(c.targetNumber).padStart(4, '0').split('').map(Number);
        if (wrong && digits[2] > 0) digits[2] -= 1; else if (wrong) digits[3] += 1;
        const presses = columns.flatMap((column, i) =>
          Array.from({ length: digits[i] }, (): DriverInput => ({ type: 'choose', label: `Add one to ${column}` })));
        const done: DriverInput = { type: 'choose', label: "I'm done!" };
        if (wrong) return [...presses, done];
        const top = digits.findIndex(d => d > 0);
        if (top < 0 || top === 3) throw new Error(`base-ten-blocks build_two_ways ${c.targetNumber}: no block above the ones to swap`);
        const swap: DriverInput[] = [{ type: 'choose', label: `Take one from ${columns[top]}` },
          ...Array.from({ length: 10 }, (): DriverInput => ({ type: 'choose', label: `Add one to ${columns[top + 1]}` }))];
        return [{ type: 'choose', label: 'Reset' }, ...presses, done, ...swap, done];
      }
      if (c.type === 'regroup') {
        // A mixed payload's regroup: any trade that keeps the value is right. Correct breaks one of the largest
        // block into ten of the next size; wrong checks with no trade (`no_trade`, the documented miss).
        const digits = String(c.targetNumber).padStart(4, '0').split('').map(Number);
        const from = digits.findIndex((d, i) => d > 0 && i < 3);
        if (from < 0) throw new Error(`base-ten-blocks regroup ${c.targetNumber}: no block above the ones to break`);
        const lower = ['Thousands', 'Hundreds', 'Tens', 'Ones'][from + 1].slice(0, 4);
        return [...(wrong ? [] : [{ type: 'choose', label: `1 → 10 ${lower}` } as DriverInput]), { type: 'choose', label: 'Check My Trade' }];
      }
      // Wrong: the documented struggle, a lost carry or borrow (a ten off). On addition the learner first models both
      // numbers on the mat without trading, so a column holds ten or more.
      const add = c.type === 'add_with_blocks';
      const modelled = wrong && add ? [c.targetNumber - c.secondNumber, c.secondNumber].flatMap((n: number) => {
        const digits = String(n).padStart(4, '0').split('').map(Number);
        return ['Thousands', 'Hundreds', 'Tens', 'Ones'].flatMap((column, i) =>
          Array.from({ length: digits[i] }, (): DriverInput => ({ type: 'choose', label: `Add one to ${column}` })));
      }) : [];
      const typed = String(wrong ? c.targetNumber + (add ? -10 : 10) : c.targetNumber);
      return [...modelled, ...typed.split('').map((key): DriverInput => ({ type: 'choose', label: key })), { type: 'choose', label: '✓' }];
    },
    probes: { mounted: { selector: '[data-base-ten-mat]' } },
  },
  'balance-scale': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/BalanceScale.tsx',
    instanceId: 'scale',
    defaults: { grade: 'Grade 1', mode: 'equality', di: false,
      topic: 'Balancing a mystery weight with numbered weights, then adding them' },
    leakTokens: ['BE_', 'BW_', 'ANSWER_CORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'STEP_TAKEN'],
    prompts: WORKSPACE_PROMPTS,
    // Spoken steps say the published number (the explanation says the domain's sentence). Hands steps
    // press the real controls after clearing the step. A hands step commits only when complete, so
    // "wrong" is an incomplete move (one weight short, one group filled) that stays exploration: the
    // program then records guidance without a verdict. The plain solver (mixed sessions) is not driven.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A simplify lever's practice step (`~simpler`, balanceScaleLevers.ts) is always a spoken number step that
      // publishes its own key, built from its parent by the same builder; it is answered like any spoken step.
      if (ctx.itemId?.endsWith('~simpler')) return spokenExpected(ctx, intent);
      const data = ctx.data as any;
      const wrong = intent === 'wrong';
      const add = (values: number[]) => values.map((v): DriverInput => ({ type: 'choose', label: `Add ${v} weight` }));
      // An incomplete hands move commits nothing, so the tutor gets no turn from it; the learner
      // then claims it is done, as a child does, and the tutor answers that claim.
      const claim = (inputs: DriverInput[]): DriverInput[] => wrong
        ? [...inputs, { type: 'answer', text: 'I think I am done.' }] : inputs;
      const short = (target: number, tray: readonly number[]) => weightsFor(wrong ? Math.max(0, target - 1) : target, tray);
      if (balanceSurface(data) === 'equality') {
        const item = equalityItems((data.challenges ?? []).map(equalityProblem)).find(i => i.id === ctx.itemId);
        if (!item) throw new Error('No current balance-scale equality assignment');
        if (item.step !== 'build') return spokenExpected(ctx, intent);
        const clear: DriverInput[] = Number(ctx.demand?.weightsOnRight ?? 0) > 0 ? [{ type: 'choose', label: 'Clear weights' }] : [];
        return claim([...clear, ...add(short(item.problem.target, WEIGHTS))]);
      }
      if (balanceSurface(data) !== 'workshop') throw new Error('balance-scale mixed-equation solver is not driven at W1');
      const item = workshopItems((data.challenges ?? []).map(workshopProblem)).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current balance-scale workshop assignment');
      const p = item.problem;
      if (item.step === 'explain') return [{ type: 'answer', text: wrong ? explainHarnessAnswers.plainWrong : explainHarnessAnswers.correct }];
      if (!isHands(item.step)) return spokenExpected(ctx, intent);
      const reset: DriverInput = { type: 'choose', label: 'Reset this step' };
      if (item.step === 'separate') return claim([reset, { type: 'choose', label: `Set aside known ${p.known} weight` },
        ...Array.from({ length: wrong ? p.known - 1 : p.known }, (_, i): DriverInput => ({ type: 'choose', label: `Unit ${i + 1}` }))]);
      if (item.step === 'share') return claim([reset, ...Array.from({ length: wrong ? 1 : p.parcels }, (_, g) =>
        Array.from({ length: p.target }, (): DriverInput => ({ type: 'choose', label: `Place unit in group ${g + 1}` }))).flat()]);
      // A second combination must differ from the first (greedy), so it is all ones.
      if (item.step === 'recompose') return claim([reset, ...add(wrong ? short(p.target, TRAY) : Array(p.target).fill(1))]);
      return claim([reset, ...add(short(p.target, TRAY))]);
    },
    probes: { mounted: { selector: '[aria-label="Balance scale workspace"]' } },
  },
  'place-value-chart': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/PlaceValueChart.tsx',
    instanceId: 'chart',
    defaults: { grade: 'Grade 2', mode: 'compare', di: false,
      topic: 'What a digit is worth in the tens and ones places' },
    leakTokens: ['PV_', 'PVC_'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode alternates a printed number (spoken answer) with a dictated one, written
    // into the chart's labelled columns. A wrong chart is complete, with its ones digit off
    // by one. A half-written chart also commits once the learner stops (contract R6), so every column is written.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = placeValueItems(ctx.data.challenges ?? [], { mode: ctx.data.challengeType,
        tier: ctx.data.supportTier ?? 'medium' }).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current place-value assignment');
      if (item.answerKind === 'gesture') return item.chartPlaces.map((p, i) => {
        const d = item.expectedDigits[i];
        return { type: 'write' as const, label: placeLabel(p), text: String(intent === 'wrong' && p === 0 ? (d + 1) % 10 : d) };
      });
      const answers = placeValueHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stage"]' } },
  },
  'shape-sorter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ShapeSorter.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'identify', di: false,
      topic: 'Naming flat shapes by their sides and corners' },
    leakTokens: ['SH_'],
    prompts: WORKSPACE_PROMPTS,
    // A practice item (`~simpler`, shapeSorterLevers.ts) is rebuilt from its parent with the component's builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const challenges = ctx.data.challenges ?? [];
      const built = shapeItems(challenges, { isPreReader: (ctx.data.gradeBand ?? 'K') === 'K' });
      const item = built.find(i => i.id === ctx.itemId) ?? simplerShapeFromId(ctx.itemId ?? '', built,
        parent => challenges.find((c: { id: string }) => c.id === parent.challengeId)?.shapes ?? [])?.item;
      if (!item) throw new Error('No current shape assignment');
      const answers = shapeSorterHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="shape"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },
  'di-letter-sounds': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiLetterSounds.tsx',
    instanceId: 'sounds',
    defaults: { grade: 'Kindergarten', mode: 'letter_sound', di: false,
      topic: 'Saying the continuous sound a printed letter makes' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The sound itself comes from the domain: the harness must not invent a phoneme.
    inputsFor: spokenWorkspaceInputs(buildLetterSoundItems, letterSoundHarnessAnswers, 'letter-sound'),
    probes: { mounted: { selector: '[data-sound-object="stimulus"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },
  'di-word-reading': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiWordReading.tsx',
    instanceId: 'words',
    defaults: { grade: 'Kindergarten', mode: 'cvc_reading', di: false,
      topic: 'Blending and reading short-vowel CVC words in print' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The wrong answer is a plainly different word: the near neighbour this pack
    // exists to correct belongs in the JEV probe, where the tutor's reply is fixed
    // and only the observer is under test.
    inputsFor: spokenWorkspaceInputs(buildWordReadingItems, wordReadingHarnessAnswers, 'word-reading'),
    probes: { mounted: { selector: '[data-word-object="printed"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The reward reveal, so a transcript inspection can check mechanically that
      // no picture appeared before a committed success: this counts 0 until the
      // observer has credited a read.
      reward: { selector: '[data-word-read]', kind: 'count' } },
  },
  'di-sentence-reading': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiSentenceReading.tsx',
    instanceId: 'sentences',
    defaults: { grade: 'Kindergarten', mode: 'read_sentence', di: false,
      topic: 'Reading a printed short sentence aloud, every word in order' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The wrong answer is a plainly different sentence: the near-neighbour misread
    // this pack exists to correct belongs in the JEV probe, where the tutor's reply
    // is fixed and only the observer is under test.
    inputsFor: spokenWorkspaceInputs(buildSentenceReadingItems, sentenceReadingHarnessAnswers, 'sentence-reading'),
    probes: { mounted: { selector: '[data-sentence-object="printed"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The reward reveal, so a transcript inspection can check mechanically that
      // no picture appeared before a committed success: this counts 0 until the
      // observer has credited a read.
      reward: { selector: '[data-sentence-read]', kind: 'count' } },
  },
  'di-math-facts': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiMathFacts.tsx',
    instanceId: 'facts',
    defaults: { grade: 'Kindergarten', mode: 'answer_fact', di: false,
      topic: 'Adding within five and saying the answer out loud' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // The wrong answer is a plainly different quantity: the off-by-one this pack
    // exists to correct belongs in the JEV probe, where the tutor's reply is fixed
    // and only the observer is under test.
    inputsFor: spokenWorkspaceInputs(buildMathFactItems, mathFactsHarnessAnswers, 'math-fact'),
    probes: { mounted: { selector: '[data-fact-object="problem"]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The completed-equation reveal, so a transcript inspection can check
      // mechanically that no answer appeared on the stage before a committed
      // success: this counts 0 until the observer has credited a fact.
      reward: { selector: '[data-fact-solved]', kind: 'count' } },
  },
  'letter-sound-link': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/LetterSoundLink.tsx',
    instanceId: 'links',
    defaults: { grade: 'Kindergarten', mode: 'see_hear', di: false,
      topic: 'Saying the sound a printed letter makes' },
    leakTokens: ['LSL_'],
    prompts: WORKSPACE_PROMPTS,
    // The only MIXED-CHANNEL journey: two directions answer with an utterance
    // and `hear_see` answers by tapping a letter card, whose label is the
    // uppercase letter the stage prints. Both answers come from the domain —
    // the harness invents neither a phoneme nor a grapheme.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const built = buildLetterSoundLinkItems(ctx.data.challenges ?? [], ctx.data.supportTier);
      // A far_letter_pair practice item (`~simpler`) is rebuilt from its parent with the component's builder.
      const parent = ctx.itemId?.endsWith('~simpler') ? built.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      const item = parent ? fartherPair(parent, built, ctx.data.letterGroup) : built.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current letter-sound assignment');
      const answers = letterSoundLinkWorkspaceAnswers(item);
      const value = intent === 'wrong' ? answers.plainWrong : answers.correct;
      return [item.answerKind === 'gesture' ? { type: 'choose', label: value } : { type: 'answer', text: value }];
    },
    probes: { mounted: { selector: '[data-letter-stage]' },
      demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The keyword anchor, so a transcript inspection can check mechanically
      // that no picture or word appeared before a committed success.
      reward: { selector: '[data-letter-revealed]', kind: 'count' } },
  },
  'bar-model': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/BarModel.tsx',
    instanceId: 'graph',
    defaults: { grade: 'Kindergarten', mode: 'read_one_to_one', di: false,
      topic: 'Reading a picture graph where one picture stands for one thing' },
    leakTokens: ['ACTIVITY_START', 'CHALLENGE_START', 'PHASE_COMPLETE', 'ALL_COMPLETE', 'GRAPH_'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls, derived from the mounted challenge. A spoken item says a
    // true comparison from the rows or the same claim reversed; a number or row choice picks the key
    // or another; a sticker chart or built graph is complete, with one row a sticker off or the wrong step.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = (ctx.data.challenges ?? []) as BarModelChallenge[];
      // An easier graph (a simplify lever) is not a generated challenge: rebuild it from its parent with the same builder.
      const twoParent = ctx.itemId?.endsWith('~two') ? all.find(x => `${x.id}~two` === ctx.itemId) : undefined;
      const simpler = simplerParent(ctx.itemId, all);
      const c = all.find(x => x.id === ctx.itemId) ?? (simpler ? simplerGraph(simpler) : twoParent ? twoBarPractice(twoParent) : null);
      if (!c) throw new Error('No current bar-model challenge');
      const wrong = intent === 'wrong';
      if (isSpokenGraph(c)) {
        const answers = barModelHarnessAnswers(c);
        return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
      }
      if (OPTION_MODES.has(c.evalMode)) {
        const pick = wrong ? (c.options ?? []).find(o => o !== c.expectedValue) : c.expectedValue;
        return [{ type: 'choose', label: String(pick) }];
      }
      const row = (i: number) => `${c.values[i].label} row`;
      if (ROW_TAP_MODES.has(c.evalMode)) {
        const target = c.targetBarIndex ?? 0;
        return [{ type: 'choose', label: row(wrong ? (target + 1) % c.values.length : target) }];
      }
      const presses = (label: string, n: number): DriverInput[] => {
        if (n < 0) throw new Error(`bar-model ${c.evalMode}: the chart starts above its target`);
        return Array.from({ length: n }, () => ({ type: 'choose' as const, label }));
      };
      if (c.evalMode === 'build_one_to_one') {
        const counts = (c.expectedCounts ?? []).map((n, i) => wrong && i === 0 ? (n === 0 ? 1 : n - 1) : n);
        return [...counts.flatMap((n, i) => presses(row(i), n - c.values[i].value)), { type: 'check' }];
      }
      // An open build keeps its graph through Try again, so the inputs move each bar from what the scene says it holds.
      // A fitting graph per ask; the wrong one ties (most, fewest), differs by one (same) or has one too many (N more).
      if (c.evalMode === 'make_graph' && c.graphRule) {
        const r = c.graphRule, other = r.a === 0 ? 1 : 0;
        const want = c.values.map((_, i) => r.kind === 'most' ? (i === r.a ? (wrong ? 2 : 3) : wrong && i === other ? 2 : 1)
          : r.kind === 'fewest' ? (i === r.a || wrong && i === other ? 1 : 3)
            : r.kind === 'same' ? (i === r.a ? 2 : i === r.b ? (wrong ? 3 : 2) : 1)
              : i === r.a ? 1 + (r.by ?? 1) + (wrong ? 1 : 0) : 1);
        return [...c.values.flatMap((v, i) => {
          const now = Number(ctx.demand?.[v.label] ?? 0);
          return Array.from({ length: Math.abs(want[i] - now) }, () => ({ type: 'touch' as const, target: `${want[i] > now ? 'row' : 'top'}-${i}` }));
        }), { type: 'choose', label: "I'm done!" }];
      }
      const steps = c.availableScaleSteps ?? [1, 2, 5, 10];
      const step = wrong ? steps.find(s => s !== c.expectedScaleStep) : c.expectedScaleStep;
      return [...(c.expectedDataset ?? []).flatMap(e => presses(`Increase ${e.label}`,
        e.value - (c.values.find(v => v.label === e.label)?.value ?? 0))),
        { type: 'choose', label: `Step of ${step}` }, { type: 'choose', label: 'Submit graph' }];
    },
    probes: { mounted: { selector: '[data-pip-object="graph"]' } },
  },
  'phonics-blender': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/PhonicsBlender.tsx',
    instanceId: 'blend',
    defaults: { grade: 'Kindergarten', mode: 'cvc', di: false,
      topic: 'Blending the sounds of short-vowel CVC words into whole words' },
    leakTokens: ['DI_BLEND_ITEM', 'DI_BLEND_MOVE_ON', 'DI_BLEND_COMPLETE', 'PRONOUNCE_SOUND'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item: the word itself, or a plainly different word.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // build_blend is checked by the shared word judge (a model) after its code checks; LetterBuild.workspace.test.tsx drives it.
      if (ctx.data.task === 'letter_build') throw new Error('phonics-blender build_blend is judged by the word judge, not driven at W1');
      const item = blendItems(ctx.data.words ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current phonics-blender word');
      const answers = blendHarnessAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    // The reward picture, counted so a transcript inspection can check it never shows before a credit.
    probes: { mounted: { selector: '[data-pip-object="letters"], [data-testid="lb-row"]' }, reward: { selector: '[data-blend-reward]', kind: 'count' } },
  },
  'word-flip': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/WordFlip.tsx',
    instanceId: 'flip',
    defaults: { grade: 'Kindergarten', mode: 'plural_s', di: false,
      topic: 'Saying the plural of a noun when there is more than one' },
    leakTokens: ['DI_FLIP_ITEM', 'DI_FLIP_MOVE_ON', 'DI_FLIP_COMPLETE', 'SAY_WORD'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item: the changed word, or the source word said back unchanged.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // build_inflect is checked in code, then by the shared literacy judge (a model), which the dry sweep has none of;
      // WordFlip.buildInflect.workspace.test.tsx drives the commit with a stubbed judge.
      if (ctx.data.task === 'build_inflect') throw new Error('word-flip build_inflect is judged by the word judge, not driven at W1');
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current word-flip challenge');
      const answers = flipHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="frame"], [data-testid="wb-row"]' }, reward: { selector: '[data-flip-reward]', kind: 'count' } },
  },
  'sound-swap': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/SoundSwap.tsx',
    instanceId: 'swap',
    defaults: { grade: 'Kindergarten', mode: 'addition', di: false,
      topic: 'Adding one sound to the beginning of a word to make a new word' },
    leakTokens: ['DI_SWAP_ITEM', 'DI_SWAP_MOVE_ON', 'DI_SWAP_COMPLETE', 'PRONOUNCE_SOUND'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item: the new word, or the starting word said back unchanged.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // swap_build is checked by the shared word judge (a model) after its code checks; LetterBuild.workspace.test.tsx drives it.
      if (ctx.data.task === 'letter_build') throw new Error('sound-swap swap_build is judged by the word judge, not driven at W1');
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current sound-swap challenge');
      const answers = swapHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="word"], [data-testid="lb-row"]' }, reward: { selector: '[data-swap-reward]', kind: 'count' } },
  },
  'cvc-speller': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/CvcSpeller.tsx',
    instanceId: 'cvc',
    defaults: { grade: 'Kindergarten', mode: 'spell_word', di: false,
      topic: 'Spelling short-vowel CVC words by putting a letter in each sound box' },
    leakTokens: ['DI_CVC_ITEM', 'DI_CVC_MOVE_ON', 'DI_CVC_COMPLETE', 'DI_CVC_BUILD', 'SAY_WORD'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken item says the middle sound or the whole word back; a spelling presses bank letters
    // into the boxes, the right word or its first letter swapped. The third letter is the commit.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // make_word is checked by the shared word judge (a model) after its code checks; LetterBuild.workspace.test.tsx drives it.
      if (ctx.data.task === 'letter_build') throw new Error('cvc-speller make_word is judged by the word judge, not driven at W1');
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current cvc-speller challenge');
      const answers = cvcHarnessAnswers(c, ctx.demand?.boxes as string | undefined)[intent === 'wrong' ? 'plainWrong' : 'correct'];
      return c.taskType === 'spell-word' ? answers.map(l => ({ type: 'choose' as const, label: `letter ${l}` }))
        : [{ type: 'answer', text: answers[0] }];
    },
    probes: { mounted: { selector: '[aria-label="hear the word"], [data-testid="lb-row"]' }, reward: { selector: '[data-cvc-reward]', kind: 'count' } },
  },
  'spelling-pattern-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/SpellingPatternExplorer.tsx',
    instanceId: 'spe',
    defaults: { grade: 'Grade 2', mode: 'long_vowel', di: false, topic: 'Long vowel spelling patterns: vowel teams and silent e' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // Classic: look at the pattern words and write a rule (warmup, first item only), then type each dictation word and
    // press Check; the wrong spelling swaps the pattern's letters.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup' && ctx.data.task === 'letter_build') return [];
      // pattern_build is checked by the shared word judge (a model) after its code checks; SpellingPatternExplorer.workspace.test.tsx drives it.
      if (ctx.data.task === 'letter_build') throw new Error('spelling-pattern-explorer pattern_build is judged by the word judge, not driven at W1');
      if (intent === 'warmup') {
        const phase = ctx.demand?.phase;
        return phase === 'observe' ? [{ type: 'choose', label: 'I see the pattern! Next: Write the Rule' },
          { type: 'write', label: 'Your spelling rule', text: 'The words share the same spelling pattern.' },
          { type: 'choose', label: 'Next: Apply the Rule' }] as DriverInput[] : [];
      }
      const words = dictationItems(ctx.data.dictationWords, ctx.data.dictationHints);
      // The shorter practice word (a simplify lever) is not a generated word: rebuild it from its parent.
      const parent = spellingPracticeParent(ctx.itemId, words);
      const item = parent ? spellingPracticeItem(parent, { patternWords: ctx.data.patternWords ?? [],
        highlightPattern: String(ctx.data.highlightPattern ?? ''), items: words }) : words.find(d => d.id === ctx.itemId);
      if (!item) throw new Error('No current spelling-pattern-explorer word');
      const answers = spellingHarnessAnswers(item, String(ctx.data.highlightPattern ?? ''));
      return [{ type: 'write', label: 'Your spelling', text: intent === 'wrong' ? answers.plainWrong : answers.correct },
        { type: 'choose', label: 'Check spelling' }];
    },
    probes: { mounted: { selector: '[data-testid="spe-board"], [data-testid="lb-row"]' }, reward: { selector: '[data-spe-reward]', kind: 'count' } },
  },
  'adaptation-investigator': {
    execution: 'teaching',
    component: 'primitives/visual-primitives/biology/AdaptationInvestigator.tsx',
    instanceId: 'adapt',
    defaults: { grade: 'Grade 1', mode: 'mixed', di: false, topic: 'Why pink flowers have bright pink petals' },
    leakTokens: [],
    // A young learner's own questions: what the picture is, why, and asking to be shown.
    prompts: { opening: 'What is that flower?', hint: 'Why is it so pink?', example: 'Can you show me?' },
    // Nothing is graded, so there is no wrong or correct: the learner opens a card still closed (the
    // tutor may already have shown one), and later opens the rest and presses Done. A card already
    // open is tapped again harmlessly.
    inputsFor: (intent, ctx) => intent === 'explore'
      ? [{ type: 'touch', target: ['trait', 'environment', 'connection'].find(c => !String(ctx.demand?.cardsOpen ?? '').includes(c)) ?? 'trait' }]
      : intent === 'finish' ? [{ type: 'touch', target: 'trait' }, { type: 'touch', target: 'environment' },
        { type: 'touch', target: 'connection' }, { type: 'choose', label: 'Done' }]
      : [],
    probes: { mounted: { selector: '[data-pip-object="trait"]' }, demonstration: { selector: '[data-tutor-ring]', kind: 'count' },
      closed: { selector: '[aria-label^="Open The"]', kind: 'count' } },
  },
  'you-and-me': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/YouAndMe.tsx',
    instanceId: 'partners',
    defaults: { grade: 'Kindergarten', mode: 'describe_action', di: false,
      topic: 'Using I and you to tell a partner what happened' },
    leakTokens: ['YOU_AND_ME_ITEM', 'YOU_AND_ME_MOVE_ON', 'YOU_AND_ME_COMPLETE', 'YOU_AND_ME_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken sentence per turn: the model sentence, or the same action with I and you swapped.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current you-and-me turn');
      const answers = youAndMeHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="scene"]' } },
  },
  'ramp-lab': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/engineering/RampLab.tsx',
    instanceId: 'ramp',
    defaults: { grade: 'Grade 3', mode: 'compare_conditions', di: false,
      topic: 'How the angle and surface of a ramp change the push needed to move a load' },
    leakTokens: ['RAMP_EVIDENCE_ITEM', 'RAMP_EVIDENCE_HEAR', 'RAMP_EVIDENCE_MOVE', 'RAMP_EVIDENCE_DONE', 'RAMP_PLAN_RETRY'],
    prompts: WORKSPACE_PROMPTS,
    // Compare: pick a setup and reveal. Explain: predict and run both trials once, then speak the
    // supported comparison or its reverse. Threshold and design: Reset Challenge, then the step buttons to one
    // step short of the answer (one step too steep) or to it, then check. The plan's selects have no driver input.
    // A practice item (`~simpler`, rampLabLevers.ts) is rebuilt from its parent with the same builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const challenges = ctx.data.challenges ?? [];
      const c = challenges.find((x: { id: string }) => x.id === ctx.itemId) ?? rampPracticeFromId(challenges, ctx.itemId ?? '');
      if (!c) throw new Error('No current ramp-lab challenge');
      const wrong = intent === 'wrong';
      const steps = (n: number, up: string, down: string): DriverInput[] =>
        Array.from({ length: Math.abs(n) }, () => ({ type: 'choose', label: n > 0 ? up : down }));
      if (c.mode === 'find_threshold') {
        const answer = minimumPushSetting(c.scenario, c.forceStep);
        const n = Math.round(((wrong ? answer - c.forceStep : answer) - (ctx.data.pushForce ?? 0)) / c.forceStep);
        return [{ type: 'choose', label: 'Reset Challenge' }, ...steps(n, 'More push', 'Less push'), { type: 'choose', label: 'Test This Force' }];
      }
      if (c.mode === 'design_with_budget') {
        const answer = maxWorkableAngle(c.scenario, c.forceBudget, c.angleRange);
        return [{ type: 'choose', label: 'Reset Challenge' }, ...steps((wrong ? answer + 1 : answer) - c.scenario.angle, 'Steeper', 'Gentler'),
          { type: 'choose', label: 'Check This Design' }];
      }
      if (c.mode === 'compare_conditions') {
        const right = easierComparisonChoice(c);
        const pick = wrong ? (right === 'a' ? 'b' : 'a') : right;
        return [{ type: 'choose', label: `Setup ${pick.toUpperCase()}` }, { type: 'choose', label: 'Reveal Force Evidence' }];
      }
      if (c.mode === 'explain_from_trials') {
        const conclusion = rampConclusion(c);
        const reversed = conclusion.replace(/Setup ([AB]) needed less/, (_m: string, s: string) => `Setup ${s === 'A' ? 'B' : 'A'} needed less`);
        const speak: DriverInput = { type: 'answer', text: wrong ? reversed : conclusion };
        if (ctx.demand?.step === 'explain') return [speak];
        return [{ type: 'choose', label: 'Setup A' }, { type: 'choose', label: 'Record prediction' },
          { type: 'choose', label: 'Run trial A' }, { type: 'choose', label: 'Run trial B' },
          { type: 'choose', label: 'Explain my results' }, speak];
      }
      throw new Error(`ramp-lab ${c.mode} uses selects the driver cannot set; RampLab.levers.workspace.test.tsx drives it`);
    },
    probes: { mounted: { selector: '[data-testid="ramp-investigation"], svg' } },
  },
  'train-yard': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/engineering/TrainYard.tsx',
    instanceId: 'yard',
    defaults: { grade: 'Grade 3', mode: 'build_train', di: false,
      topic: 'Passenger trains and freight trains: how they move people and goods' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // Build the learner's part of the train through the yard's own buttons, then Highball. Correct: the
    // right car kind, the fewest cars, the fewest engines. Wrong: a car that cannot carry the cargo
    // (match_car, build_train) or one car / one engine too many (enough_cars, enough_pull).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier job (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const jobs = ctx.data.challenges ?? [];
      const parent = ctx.itemId?.endsWith('~simpler') ? jobs.find((x: { id: string }) => `${x.id}~simpler` === ctx.itemId) : undefined;
      const c = parent ? simplerTrainJob(parent, ctx.data.gradeBand ?? '3-5') : jobs.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current train-yard job');
      const right = trainCarFor(c);
      const wrongKind = c.carChoices?.find((k: string) => k !== right) ?? (right === 'boxcar' ? 'tank' : 'boxcar');
      const extra = intent === 'wrong' ? 1 : 0;
      const repeat = (label: string, n: number): DriverInput[] => Array.from({ length: n }, () => ({ type: 'choose', label }));
      const send: DriverInput = { type: 'choose', label: 'Highball! Send the train' };
      if (c.type === 'match_car') return [{ type: 'choose', label: `Choose ${carButtonName(intent === 'wrong' ? wrongKind : right)}` }, send];
      if (c.type === 'enough_cars') return [...repeat(`Add ${carButtonName(right)}`, trainFewestCars(c) + extra), send];
      if (c.type === 'enough_pull') return [...repeat('Add an engine', trainFewestEngines(c) + extra), send];
      const car = intent === 'wrong' ? wrongKind : right;
      return [...repeat('Add an engine', trainFewestEngines(c)), ...repeat(`Add ${carButtonName(car)}`, trainFewestCars(c)), send];
    },
    probes: { mounted: { selector: 'canvas[aria-label^="The route from"]' } },
  },
  'open-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/creation/OpenBuilder.tsx',
    instanceId: 'ob',
    defaults: { grade: 'Grade 1', mode: 'build_to_goal', di: false,
      topic: 'Building a home: foundation, walls, a door and a roof' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // The check is the inspector (a Gemini judge over the build), which the dry sweep has no model for, as
    // number-tracer's drawn modes have no vision judge; OpenBuilder.workspace.test.tsx drives the commit
    // with a stubbed inspector.
    inputsFor: (intent) => {
      if (intent === 'warmup') return [];
      throw new Error('Open-builder build_to_goal is judged by the inspector, not driven at W1');
    },
    probes: { mounted: { selector: '[aria-label^="Building site"]' } },
  },
  'shape-composer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ShapeComposer.tsx',
    instanceId: 'shape-composer',
    defaults: { grade: 'Kindergarten', mode: 'decompose', di: false, topic: 'Composing and decomposing shapes' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'ACTIVITY_START'],
    prompts: WORKSPACE_PROMPTS,
    // decompose taps each part's shape (wrong: one part left out, `missed_part`); how-many-ways types the number (wrong:
    // one more than the fewest, `too_many`). The other modes are answered by dragging pieces on the board, which the
    // driver has no input for: ShapeComposer.workspace.test.tsx drives them with pointer events.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier item (`~simpler`) is rebuilt from its parent with the same builder.
      const parentId = String(ctx.itemId ?? '').replace(/~simpler$/, '');
      const found = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === parentId);
      const c: any = found && parentId !== ctx.itemId ? simplerShape(found) : found;
      if (!c) throw new Error('No current shape-composer challenge');
      const wrong = intent === 'wrong', check: DriverInput = { type: 'check' };
      if (c.type === 'decompose') {
        const taps: string[] = (c.expectedComponents ?? []).flatMap((p: { shape: string; count: number }) =>
          Array.from({ length: p.count }, () => p.shape));
        return [...(wrong ? taps.slice(0, -1) : taps).map((label): DriverInput => ({ type: 'choose', label })), check];
      }
      if (c.type === 'how-many-ways') {
        return [{ type: 'write', label: 'How many pieces', text: String(c.minimumPiecesNeeded + (wrong ? 1 : 0)) }, check];
      }
      throw new Error(`shape-composer ${c.type}: pieces are dragged on the board; the driver has no drag input`);
    },
    probes: { mounted: { selector: '[data-pip-object="canvas"], [data-pip-object="choices"]' } },
  },
  'shape-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ShapeBuilder.tsx',
    instanceId: 'shapes-grid',
    defaults: { grade: 'Grade 3', mode: 'make_shape', di: false, topic: 'Quadrilaterals by their properties' },
    leakTokens: ['ACTIVITY_START', 'SHAPE_CLOSED', 'FIRST_VERTEX', 'BUILD_CORRECT', 'BUILD_INCORRECT', 'NEXT_ITEM',
      'ALL_COMPLETE', '[TIER'],
    prompts: WORKSPACE_PROMPTS,
    // make_shape through the real dot taps: the first shape the ask's menu proves passes, then "I'm done!". Try again
    // keeps the build, so a correct try clears the kept shape first. Wrong: a shape with the wrong number of sides
    // (`sides_off`); pressing done again on the kept wrong shape is the second wrong. The other modes place corners and
    // pick shapes by grid position on the svg, which the driver has no input for: undriven at W1.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current shape-builder challenge');
      if (c.type !== 'make_shape') throw new Error(`shape-builder ${c.type}: placed by svg position, undriven at W1`);
      const ask = askOf(c);
      const done: DriverInput = { type: 'choose', label: "I'm done!" };
      const kept = Number(ctx.demand?.cornersPlaced ?? 0) > 0;
      if (intent === 'wrong' && ctx.demand?.shapeClosed === 'yes') return [done];
      const shape = intent === 'wrong' ? (ask.sides === 3 ? witnessesFor({ sides: 4 })[0] : witnessesFor({ sides: 3 })[0])
        : witnessesFor(ask)[0];
      if (!shape) throw new Error(`shape-builder make_shape: no passing shape for ${JSON.stringify(ask)}`);
      const tap = (p: { x: number; y: number }): DriverInput => ({ type: 'touch', target: `dot-${p.x + 1}-${p.y + 1}` });
      return [...(kept ? [{ type: 'choose' as const, label: 'Clear Shape' }] : []), ...shape.map(tap), tap(shape[0]), done];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'di-shapes': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiShapes.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'name_shape', di: false,
      topic: 'Naming flat shapes: circle, square, triangle, rectangle' },
    leakTokens: RETIRED_DI_CUE_TAGS,
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the shape name or count, or a plainly different one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-shapes item');
      const answers = diShapesHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-shape-object="shape"]' }, reward: { selector: '[data-shape-credited]', kind: 'count' } },
  },
  'di-spoken-practice': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx',
    instanceId: 'spoken',
    defaults: { grade: 'Grade 1', mode: 'compare_choice', di: false,
      topic: 'Comparing lengths: longer and shorter' },
    leakTokens: ['SAY_ITEM', 'SAY_MOVE', 'SAY_HEAR', 'SAY_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the key's own words, or a plainly different answer of the same kind.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.items ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-spoken-practice item');
      const answers = diSpokenPracticeHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-spoken-object="stimulus"]' }, reward: { selector: '[data-spoken-credited]', kind: 'count' } },
  },
  'di-dice-roll': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiDiceRoll.tsx',
    instanceId: 'dice',
    defaults: { grade: 'Kindergarten', mode: 'count_pips', di: false,
      topic: 'Counting the dots on a die' },
    leakTokens: ['DICE_ITEM', 'DICE_MOVE_ON', 'DICE_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Roll first (the dice are covered until then), then one spoken answer, or a plainly different one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-dice-roll item');
      const answers = diDiceRollHarnessAnswers(c);
      const say: DriverInput = { type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct };
      return ctx.demand?.rolled === 'yes' ? [say]
        : [{ type: 'choose', label: c.challengeType === 'count_pips' ? 'Roll the die' : 'Roll both dice' }, say];
    },
    probes: { mounted: { selector: '[data-dice-object="dice"]' }, reward: { selector: '[data-dice-trail]', kind: 'count' } },
  },
  'di-deduction': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiDeduction.tsx',
    instanceId: 'deduction',
    defaults: { grade: 'Grade 3', mode: 'deny', di: false,
      topic: 'Using a rule about animal groups to decide what follows' },
    leakTokens: ['DD_ITEM', 'DD_MOVE_ON', 'DD_COMPLETE', 'DD_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per case: the pack's canonical verdict and reason, or the plainest wrong verdict.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = deductionItems(ctx.data as never).find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-deduction case');
      const answers = diDeductionHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-deduction-object="rule"]' }, reward: { selector: '[data-deduction-credited]', kind: 'count' } },
  },
  'di-worked-procedure': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiWorkedProcedure.tsx',
    instanceId: 'procedure',
    defaults: { grade: 'Grade 2', mode: 'subtract_regroup', di: false,
      topic: 'Two-digit subtraction with regrouping' },
    leakTokens: ['WP_ITEM', 'WP_MOVE_ON', 'WP_COMPLETE', 'WP_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken step per item: the pack's canonical move or number, or the column's signature miss.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = workedProcedureItems(ctx.data as never).find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-worked-procedure step');
      const answers = diWorkedProcedureHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-procedure-object="problem"]' }, reward: { selector: '[data-procedure-digit]', kind: 'count' } },
  },
  'di-word-problem-setup': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/direct-instruction/DiWordProblemSetup.tsx',
    instanceId: 'wordproblem',
    defaults: { grade: 'Grade 1', mode: 'find_big_number', di: false,
      topic: 'Addition and subtraction word problems within 20' },
    leakTokens: ['WPS_ITEM', 'WPS_MOVE_ON', 'WPS_COMPLETE', 'WPS_HEAR', 'WPS_BIG'],
    prompts: WORKSPACE_PROMPTS,
    // The hands step taps each card, then its slot (the build commits after the stillness window); a wrong
    // build puts a small amount in the big slot. Every other step is one spoken answer.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = wordProblemItems(ctx.data as never).find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current di-word-problem-setup step');
      if (c.kind === 'big_number') {
        const board = wordProblemHarnessPlacements(c, intent === 'wrong');
        return (['small1', 'small2', 'big'] as const).flatMap((slot): DriverInput[] => {
          const id = board[slot];
          const label = c.plan.quantities.find(q => q.id === id)?.label;
          return label ? [{ type: 'choose', label: `Select ${label}` }, { type: 'touch', target: `slot-${slot}` }] : [];
        });
      }
      const answers = diWordProblemHarnessAnswers(c);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-word-problem-object="story"]' } },
  },
  'spatial-scene': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/SpatialScene.tsx',
    instanceId: 'scene',
    defaults: { grade: 'Kindergarten', mode: 'identify', di: false,
      topic: 'Position words: above, below, beside and next to' },
    leakTokens: ['ACTIVITY_START', 'NEXT_ITEM', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'STEP_CORRECT', 'ALL_COMPLETE', 'SPATIAL_DESCRIPTION_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: a word and Check, a cell and Check, each direction step, or
    // a spoken description. Derived from the mounted challenge, never from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      // The easier practice scene (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = spatialPracticeParent(ctx.itemId, all);
      const c = parent ? spatialPracticeItem(parent, ctx.data.gridSize ?? 3) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current spatial-scene challenge');
      return spatialHarnessInputs(c, intent === 'wrong', ctx.data.gridSize ?? 3, ctx.demand?.step as string | undefined);
    },
    probes: { mounted: { selector: '[data-pip-object^="cell-"], [aria-label="Viewer position"]' } },
  },
  'syllable-clapper': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/SyllableClapper.tsx',
    instanceId: 'syllables',
    defaults: { grade: 'Kindergarten', mode: 'count_parts', di: false,
      topic: 'Counting the syllables in familiar animal words' },
    leakTokens: ['SC_ITEM', 'SC_MOVE', 'SC_COMPLETE', 'SC_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the count, the blended word or the word left, or the pack's plain wrong answer.
    // build_parts is checked by the shared word judge (a model) after its code count; SyllableBuild.workspace.test.tsx drives it.
    inputsFor: (intent, ctx) => {
      if (intent !== 'warmup' && ctx.data.task === 'letter_build') throw new Error('syllable-clapper build_parts is judged by the word judge, not driven at W1');
      return spokenWorkspaceInputs(syllableItems, syllableHarnessAnswers, 'syllable-clapper')(intent, ctx);
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"], [data-testid="lb-row"]' }, reward: { selector: '[data-testid="reveal"]', kind: 'count' } },
  },
  'rhyme-studio': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/RhymeStudio.tsx',
    instanceId: 'rhymes',
    defaults: { grade: 'Kindergarten', mode: 'recognition', di: false,
      topic: 'Hearing whether two short words rhyme' },
    leakTokens: ['RS_ITEM', 'RS_MOVE', 'RS_COMPLETE', 'RS_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: yes or no, or the rhyming choice. Production and collection have no
    // code-owned answer, so their rows throw with the mode name (undriven at W1).
    inputsFor: spokenWorkspaceInputs(
      (challenges: any[]) => challenges.flatMap(c => rhymeItems(c)), rhymeHarnessAnswers, 'rhyme-studio'),
    probes: { mounted: { selector: '[data-pip-object="target"], [data-pip-object="pair"], [data-testid="rp-tray"]' } },
  },
  'phoneme-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/PhonemeExplorer.tsx',
    instanceId: 'phonemes',
    defaults: { grade: 'Kindergarten', mode: 'isolate', di: false,
      topic: 'Hearing the first sound in short picture words' },
    leakTokens: ['PE_ITEM', 'PE_MOVE', 'PE_COMPLETE', 'PE_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the pack's right answer, or a real card / plainly different word.
    inputsFor: spokenWorkspaceInputs(phonemeItems, phonemeHarnessAnswers, 'phoneme-explorer'),
    probes: { mounted: { selector: '[data-pip-object="stimulus"], [data-pip-object="sounds"]' } },
  },
  'word-workout': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/WordWorkout.tsx',
    instanceId: 'workout',
    defaults: { grade: 'Grade 1', mode: 'real_vs_nonsense', di: false,
      topic: 'Reading short-vowel CVC words and telling real words from silly ones' },
    leakTokens: ['WW_ITEM', 'WW_MOVE', 'WW_COMPLETE', 'WW_HEAR', 'WW_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken read or answer per item; picture match taps the picture (a wrong tap is another picture).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // pair_build is driven by picture taps in RhymePair.workspace.test.tsx; the dry sweep has no picture input.
      if (ctx.data.task === 'pair_build') throw new Error('rhyme-studio pair_build is driven in RhymePair.workspace.test.tsx, not at W1');
      const item = workoutItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current word-workout item');
      const answers = wordWorkoutJourneyAnswers(item);
      if (answers.tapped) {
        const word = intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct;
        return [{ type: 'touch', target: `picture-${word}` }];
      }
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[aria-label="Hear the question again"]' } },
  },
  'word-builder': {
    execution: 'workspace',
    component: 'primitives/WordBuilder.tsx',
    instanceId: 'builder',
    defaults: { grade: 'Grade 4', mode: 'compound_affix', di: false,
      topic: 'Building words from prefixes, roots and suffixes' },
    leakTokens: ['WB_ITEM', 'WB_MOVE', 'WB_COMPLETE', 'WB_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken word per item (the pool is `targets`): the word, or its parts in reverse order.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // build_affix is checked by the shared literacy judge (a model), which the dry sweep has none of, as open-builder's
      // inspector; WordBuildAffix.workspace.test.tsx drives the commit with a stubbed judge.
      if (ctx.data.task === 'build_affix') throw new Error('word-builder build_affix is judged by the word judge, not driven at W1');
      const item = builderItems(ctx.data.targets ?? [], ctx.data.availableParts ?? [], ctx.data.complexityLevel ?? 'compound_affix')
        .find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current word-builder word');
      const answers = wordBuilderJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"], [data-pip-object="workspace"]' } },
  },
  'word-sorter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/WordSorter.tsx',
    instanceId: 'sorter',
    defaults: { grade: 'Kindergarten', mode: 'binary_sort', di: false, topic: 'Sorting animals and foods' },
    leakTokens: ['WSR_ITEM', 'WSR_MOVE', 'WSR_COMPLETE', 'WSR_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // One spoken answer per item: the right group or partner, or another printed choice.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = sorterItems(ctx.data.challenges ?? [], { tier: ctx.data.supportTier, isPreReader: (ctx.data.gradeLevel ?? 'K') === 'K' })
        .find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current word-sorter item');
      const answers = wordSorterJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="word"]' } },
  },
  'picture-vocabulary': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/PictureVocabulary.tsx',
    instanceId: 'vocab',
    defaults: { grade: 'Kindergarten', mode: 'naming', di: false, topic: 'Naming everyday things at home' },
    leakTokens: ['PV_ITEM', 'PV_MOVE', 'PV_COMPLETE', 'PV_HEAR', 'PV_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken word per item; listen and find taps a card (a wrong tap is another card).
    // pair_build (open build) through its real pictures: wrong is the board's misconception decoy (alike / same kind);
    // correct is a right pair not made yet, two of them on a two-pair item. Try again keeps the tray, so it is cleared.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      if (ctx.data.task === 'pair_build') return picturePairInputs(ctx, intent === 'wrong');
      const item = vocabItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current picture-vocabulary item');
      const answers = pictureVocabJourneyAnswers(item);
      if (answers.tapped) return [{ type: 'touch', target: `card-${intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct}` }];
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"], [data-pip-object="cards"], [data-testid="rp-tray"]' } },
  },
  'letter-spotter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/LetterSpotter.tsx',
    instanceId: 'spotter',
    defaults: { grade: 'Kindergarten', mode: 'find_it', di: false, topic: 'Finding the letters s, a, t, i, p and n' },
    leakTokens: ['LSP_ITEM', 'LSP_MOVE', 'LSP_COMPLETE', 'LSP_HEAR', 'LSP_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Name it answers aloud; find it taps a grid cell and match it a little letter (a wrong tap is another letter).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = spotterItems(ctx.data.challenges ?? [], ctx.data.supportTier ?? 'medium').find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current letter-spotter item');
      const answers = letterSpotterJourneyAnswers(item);
      if (!answers.tapped) return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      const letter = intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct;
      if (item.mode === 'match-it') return [{ type: 'touch', target: `option-${letter}` }];
      const cell = (item.letterGrid ?? []).findIndex(l => l.toLowerCase() === letter.toLowerCase());
      if (cell < 0) throw new Error(`letter-spotter find_it: no cell holds ${letter}`);
      return [{ type: 'touch', target: `cell-${cell}` }];
    },
    probes: { mounted: { selector: '[data-pip-object="grid"], [data-pip-object="letter"], [data-pip-object="marker"]' } },
  },
  'decodable-reader': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/DecodableReader.tsx',
    instanceId: 'decodable',
    defaults: { grade: 'Grade 1', mode: 'literal', di: false, topic: 'A short story with short-a words' },
    leakTokens: ['DR_ITEM', 'DR_MOVE', 'DR_COMPLETE', 'DR_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is spoken: the printed line read aloud, a word from the story, or the right choice said.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A practice item (`~simpler`: short_line, short_story) is rebuilt from its parent with the same builder.
      const built = decodableItems(ctx.data as never).items, sentences = ctx.data.passage?.sentences ?? [];
      const parent = ctx.itemId?.endsWith('~simpler') ? built.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      const item = parent ? decodableSimplerFor(parent, sentences, built) : built.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current decodable-reader item');
      const answers = decodableReaderJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="line"], [data-pip-object="question"], [data-pip-object="story"]' } },
  },
  'interactive-book': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/InteractiveBook.tsx',
    instanceId: 'book',
    defaults: { grade: 'Kindergarten', mode: 'find-feature', di: false, topic: 'A picture book about a day at the farm' },
    leakTokens: ['IB_ITEM', 'IB_MOVE', 'IB_COMPLETE', 'IB_HEAR', 'IB_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Read the glowing word aloud; find a book part taps a printed part (a wrong tap is another part on the page).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = bookItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current interactive-book item');
      const answers = interactiveBookJourneyAnswers(item, ctx.data.books[0]);
      if (!answers.tapped) return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      return [{ type: 'touch', target: intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="page"]' } },
  },
  'story-bridge': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/StoryBridge.tsx',
    instanceId: 'bridge',
    defaults: { grade: 'Kindergarten', mode: 'match_character', di: false, topic: 'Two stories about friends who share' },
    leakTokens: ['SB_ITEM', 'SB_MOVE', 'SB_COMPLETE', 'SB_HEAR', 'SB_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Say alike / different / big ideas answer aloud; the other modes tap a choice (a wrong tap is another choice).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = bridgeItems(ctx.data.challenges ?? [], ctx.data.stories ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current story-bridge item');
      const answers = storyBridgeJourneyAnswers(item);
      if (!answers.tapped) return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
      return [{ type: 'touch', target: intent === 'wrong' ? answers.tapped.wrong : answers.tapped.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stories"]' } },
  },
  'story-ribbon': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/StoryRibbon.tsx',
    instanceId: 'ribbon',
    defaults: { grade: 'Kindergarten', mode: 'tell_connected_account', di: false, topic: 'A day at the park' },
    leakTokens: ['SR_ITEM', 'SR_MOVE', 'SR_COMPLETE', 'SR_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken account; a wrong one is a single picture label said alone. The cards are not graded.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = ribbonItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current story-ribbon item');
      const answers = storyRibbonJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="ribbon"]' } },
  },
  'story-map': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/StoryMap.tsx',
    instanceId: 'storymap',
    defaults: { grade: 'Grade 2', mode: 'story_mountain', di: false, topic: 'A lost puppy finds its way home' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // Each phase through its real controls. identify: tap every character and the setting, then Check; a wrong one
    // leaves out a character (`missed_character`), or with one character picks another setting. sequence: tap each
    // card, then its part of the arc, then Check; a wrong one puts the first event in the last part. analyze: tap
    // the conflict, then Check; a wrong one crosses inside and outside (`inside_outside`).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A practice story (`<phase>~simpler`, storyMapLevers.ts) is rebuilt from the session story with the same builder.
      const phase = storyPracticePhase(ctx.itemId) ?? ctx.itemId;
      const practice = storyPracticePhase(ctx.itemId) ? storyPracticeFor({ id: phase as never }, ctx.data as StoryMapData) : null;
      const d = (practice ?? ctx.data) as PracticeStory;
      const wrong = intent === 'wrong';
      if (phase === 'identify') {
        const names = d.elements.characters.map(c => c.name);
        const setting = settingChoices(d);
        const right = setting.find(s => s.isCorrect)!, other = setting.find(s => !s.isCorrect)!;
        const picked = wrong && names.length > 1 ? names.slice(1) : names;
        const where = wrong && names.length === 1 ? other : right;
        return [...picked.map((label): DriverInput => ({ type: 'choose', label })), { type: 'choose', label: where.text }, { type: 'check' }];
      }
      if (phase === 'sequence') {
        const parts = storyArcLabels(d).map(z => z.key);
        const first = [...d.events].sort((a, b) => a.order - b.order)[0];
        return [...storyEventBank(d).flatMap((e): DriverInput[] => [{ type: 'choose', label: e.text },
          { type: 'touch', target: `zone-${wrong && e.id === first.id ? parts[parts.length - 1] : e.arcPosition}` }]), { type: 'check' }];
      }
      if (phase === 'analyze') {
        const type = d.elements.conflict?.type;
        if (!type) throw new Error('story-map analyze: the story has no conflict');
        // A practice story prints three choices; the crossed one (inside for outside) is always among them.
        const pick = !wrong ? type : type === 'person-vs-self' ? 'person-vs-nature' : 'person-vs-self';
        return [{ type: 'choose', label: STORY_CONFLICT_LABELS[pick] }, { type: 'check' }];
      }
      throw new Error(`story-map: no input for item ${ctx.itemId}`);
    },
    // The replay's word check. identify's key is a character's name, which the story itself says, so reading the
    // story (allowed, required at K-1) reads as the key: identify's replies are read by hand. sequence's touches
    // name no word. analyze: the conflict's printed label.
    replayKeys: ctx => {
      const type = (ctx.data as StoryMapData).elements?.conflict?.type;
      return (storyPracticePhase(ctx.itemId) ?? ctx.itemId) === 'analyze' && type && !storyPracticePhase(ctx.itemId)
        ? [STORY_CONFLICT_LABELS[type]] : [];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'addition-subtraction-scene': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/AdditionSubtractionScene.tsx',
    instanceId: 'story',
    defaults: { grade: 'Kindergarten', mode: 'act_out', di: false, topic: 'Ducks joining and leaving a pond' },
    leakTokens: ['ASS_ITEM', 'ASS_MOVE', 'ASS_COMPLETE', 'ASS_HEAR', 'ASS_SCENE', 'ASS_EQUATION'],
    prompts: WORKSPACE_PROMPTS,
    // A spoken number; tiles pressed for a number sentence; or the picture brought to a count (the add
    // button brings one in, a tap on the last object sends it away). Hands turns commit on stillness.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = addSubItems(ctx.data.challenges ?? [], { band: ctx.data.gradeBand ?? 'K' });
      // A practice story (`~simpler`) is rebuilt from its parent with the same builder.
      const parent = addSubPracticeParent(ctx.itemId, all);
      const item = parent ? addSubSmallerStory(parent, { items: all, maxNumber: ctx.data.maxNumber ?? 10 }) ?? undefined
        : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current addition-subtraction-scene item');
      const answers = additionSubtractionJourneyAnswers(item);
      const wrong = intent === 'wrong';
      if (answers.tapped) return (wrong ? answers.tapped.wrong : answers.tapped.correct).split(' ')
        .map((tile): DriverInput => ({ type: 'choose', label: `Add tile ${tile}` }));
      if (answers.placed) {
        const now = Number(ctx.demand?.inPicture ?? 0);
        // A wrong scene must be a move: when one short is where the picture starts, go one past instead.
        const target = !wrong ? answers.placed.correct
          : answers.placed.wrong !== now ? answers.placed.wrong : answers.placed.correct + 1;
        return target >= now
          ? Array.from({ length: target - now }, (): DriverInput => ({ type: 'choose', label: `Add one ${item.objectType}` }))
          : Array.from({ length: now - target }, (_, i): DriverInput => ({ type: 'touch', target: `object-${now - 1 - i}` }));
      }
      return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="scene"]' } },
  },
  '3d-shape-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/ThreeDShapeExplorer.tsx',
    instanceId: 'solids',
    defaults: { grade: 'Kindergarten', mode: 'identify_3d', di: false, topic: 'Naming solid shapes: cube, sphere, cylinder, cone' },
    leakTokens: ['3DS_ITEM', '3DS_MOVE', '3DS_COMPLETE', '3DS_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer (a challenge may fan out into several items). A practice item (`~simpler`,
    // threeDShapeExplorerLevers.ts) is rebuilt from its parent with the component's builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const built = buildThreeDShapeItems(ctx.data.challenges ?? []).items;
      const item = built.find(i => i.id === ctx.itemId) ?? simplerSolidFromId(ctx.itemId ?? '', built);
      if (!item) throw new Error('No current 3d-shape-explorer item');
      const answers = threeDShapeJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'calendar-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/calendar/CalendarExplorer.tsx',
    instanceId: 'calendar',
    defaults: { grade: 'Grade 1', mode: 'identify', di: false, topic: 'Finding dates on a monthly calendar' },
    leakTokens: ['CE_SEQUENCE_ITEM', 'CE_SEQUENCE_MOVE', 'CE_SEQUENCE_COMPLETE', 'CE_SEQUENCE_HEAR', 'ANSWER_CORRECT', 'NEXT_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // The chain answers aloud; a grid question taps a date or an option, then Check (a wrong pick is another one).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const wrong = intent === 'wrong';
      const turn = calendarSequenceItemsFromChallenges(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (turn) {
        const answers = calendarSequenceJourneyAnswers(turn);
        return [{ type: 'answer', text: wrong ? answers.plainWrong : answers.correct }];
      }
      // A simpler question (`<item>~simpler`) is not a generated challenge: rebuild it from its parent with the same builder.
      const all = (ctx.data.challenges ?? []) as CalendarExplorerChallenge[];
      const parent = calendarPracticeParent(ctx.itemId, all);
      const c = parent ? calendarPracticeItem(parent, { challenges: all, supportTier: ctx.data.supportTier as never }) ?? undefined
        : all.find(ch => ch.id === ctx.itemId);
      if (!c) throw new Error('No current calendar-explorer question');
      const check: DriverInput = { type: 'choose', label: 'Check Answer' };
      if (isGridDateAnswer(c)) {
        const right = Number(c.correctAnswer);
        const day = wrong ? (right > 1 ? right - 1 : right + 1) : right;
        return [{ type: 'touch', target: c.todayDate === day ? 'today' : `date-${day}` }, check];
      }
      const pick = wrong ? c.options.find(o => o.trim().toLowerCase() !== c.correctAnswer.trim().toLowerCase()) : c.correctAnswer;
      if (!pick) throw new Error(`calendar-explorer ${c.type}: no wrong option to choose`);
      return [{ type: 'choose', label: c.options.find(o => o.trim().toLowerCase() === pick.trim().toLowerCase()) ?? pick }, check];
    },
    probes: { mounted: { selector: '[data-pip-object="grid"], [data-pip-object="offset"], [data-pip-object="stimulus"]' } },
  },
  'timeline-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/calendar/TimelineBuilder.tsx',
    instanceId: 'timeline',
    defaults: { grade: 'Grade 2', mode: 'sequence-daily', di: false, topic: 'Ordering the events of a school day' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: tap an event in the bank, tap its slot, then Check Order. A wrong order
    // trades the first two events (`adjacent_swap`), every slot still filled.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A practice timeline (`<item>~simpler`) is not a generated challenge: rebuild it from its parent with the same builder.
      const all = ctx.data.challenges ?? [];
      const parentId = timelinePracticeParent(ctx.itemId);
      const parent = parentId ? all.find((x: { id: string }) => x.id === parentId) : undefined;
      const c = parent ? practiceTimeline(parent, all) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current timeline-builder challenge');
      const ordered: { label: string }[] = [...c.events].sort((a: any, b: any) => a.correctPosition - b.correctPosition);
      if (ordered.length < 2) throw new Error(`timeline-builder ${c.type}: fewer than two events`);
      const order = intent === 'wrong' ? [ordered[1], ordered[0], ...ordered.slice(2)] : ordered;
      return [...order.flatMap((e, i): DriverInput[] => [{ type: 'choose', label: e.label }, { type: 'choose', label: `Slot ${i + 1}` }]),
        { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'life-cycle-sequencer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/biology/LifeCycleSequencer.tsx',
    instanceId: 'cycle',
    defaults: { grade: 'Grade 1', mode: 'sequence', di: false, topic: 'The life cycle of a butterfly' },
    leakTokens: ['CYCLE_ORIENT', 'CYCLE_STAGE_PLACED', 'CYCLE_READ_ALOUD'],
    prompts: WORKSPACE_PROMPTS,
    // The one item through its real controls: at K-2 a tap on a picture places it in the next empty slot; older bands
    // tap the card, then its slot. Then Check Answer. A wrong order trades the first two stages (`adjacent_swap`).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = lifeCycleJourneyItem(ctx.data as never, ctx.itemId);
      if (!c) throw new Error(`No life-cycle-sequencer item ${ctx.itemId}`);
      const ordered = [...c.stages].sort((a, b) => a.correctPosition - b.correctPosition);
      if (ordered.length < 2) throw new Error('life-cycle-sequencer: fewer than two stages');
      const order = intent === 'wrong' ? [ordered[1], ordered[0], ...ordered.slice(2)] : ordered;
      const card = (id: string): DriverInput => ({ type: 'touch', target: `card-${id}` });
      return [...order.flatMap((s, i): DriverInput[] => (lifeCycleTapPlaces(c) ? [card(s.id)]
        : [card(s.id), { type: 'touch', target: `slot-${i + 1}` }])), { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'fast-fact': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/core/FastFact.tsx',
    instanceId: 'facts',
    defaults: { grade: 'Grade 2', mode: 'recall', di: false, topic: 'Addition facts within 20' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode is one tap on a choice button (its text). A wrong tap is the most telling wrong choice by
    // `fastFactMiss`: another operation's result, then a number one away, then the first other choice.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current fast-fact challenge');
      const options: string[] = c.options ?? [];
      const right = options.find(o => isFactCorrect(o, c));
      if (!right) throw new Error(`fast-fact ${c.challengeType}: no choice is credited`);
      if (intent !== 'wrong') return [{ type: 'choose', label: right }];
      const others = options.filter(o => o !== right);
      const rank = (o: string) => ['wrong_operation', 'one_less', 'one_more', 'other_number', 'other_choice']
        .indexOf(fastFactMiss(c, { picked: o }) ?? 'other_choice');
      const pick = [...others].sort((a, b) => rank(a) - rank(b))[0];
      if (!pick) throw new Error(`fast-fact ${c.challengeType}: one choice has no wrong tap`);
      return [{ type: 'choose', label: pick }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'push-pull-arena': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/physics/PushPullArena.tsx',
    instanceId: 'arena',
    defaults: { grade: 'Grade 1', mode: 'observe', di: false, topic: 'Pushes and pulls move objects' },
    leakTokens: ['ARENA_ITEM', 'ARENA_MOVE', 'ARENA_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken word; observe first presses Go to watch the preset force.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // The easier item (`~simpler`, simplify lever) is rebuilt from its parent with the same builder.
      const parent = ctx.itemId?.endsWith(ARENA_SIMPLER)
        ? (ctx.data.challenges ?? []).find((c: { id: string }) => `${c.id}${ARENA_SIMPLER}` === ctx.itemId) : undefined;
      const item = parent ? arenaPracticeItem(parent, ctx.data.challenges ?? [])?.item
        : arenaItems(ctx.data.challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current push-pull-arena item');
      const answers = pushPullArenaJourneyAnswers(item);
      const say: DriverInput = { type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct };
      return item.kind === 'observe' && ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Go!' }, say] : [say];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'habitat-diorama': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/biology/HabitatDiorama.tsx',
    instanceId: 'habitat',
    defaults: { grade: 'Grade 2', mode: 'connect', di: false, topic: 'Animals and plants in a pond habitat depend on each other' },
    leakTokens: ['HABITAT_ITEM', 'HABITAT_GESTURE', 'HABITAT_MOVE', 'HABITAT_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Observe, predict and defend are one spoken choice; connect taps the living thing, restore the zone.
    // build_habitat clears a kept habitat, puts in one piece per asked need that serves the animal, and presses I'm
    // done; wrong leaves the last need out (`one_need_unmet`). The easier ask (simplify lever) is rebuilt from its parent.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = habitatItems(ctx.data.challenges ?? [], ctx.data as never).items;
      const parent = ctx.itemId?.endsWith(HABITAT_FEWER) ? all.find(i => `${i.id}${HABITAT_FEWER}` === ctx.itemId) : undefined;
      // observe/connect/predict/defend's easier item (`~simpler`) is rebuilt from its parent with the same builder.
      const simplerOf = ctx.itemId?.endsWith(HABITAT_SIMPLER) ? all.find(i => `${i.id}${HABITAT_SIMPLER}` === ctx.itemId) : undefined;
      const habitat = { organisms: ctx.data.organisms ?? [], relationships: ctx.data.relationships ?? [] };
      const item = parent ? habitatFewerNeedsItem(parent)
        : simplerOf ? habitatEasierItem(simplerOf, habitat)
          : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current habitat-diorama item');
      if (item.kind === 'build_habitat') {
        const animal = habitatAnimalById(item.animalId);
        if (!animal) throw new Error(`habitat-diorama build: unknown animal ${item.animalId}`);
        const pieces = (item.needs ?? []).map(n => (item.tray ?? []).find(p => animal.meets[n].includes(p) && !animal.harmedBy.includes(p)));
        if (pieces.some(p => !p)) throw new Error(`habitat-diorama build: the tray cannot meet every need of the ${animal.name}`);
        const put = (ids: string[]): DriverInput[] => ids.map(id => ({ type: 'choose', label: `Put in ${habitatPieceById(id)!.name}` }));
        const start: DriverInput[] = Number(ctx.demand?.piecesPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear the habitat' }] : [];
        const made = intent === 'wrong' ? (pieces as string[]).slice(0, -1) : (pieces as string[]);
        return [...start, ...put(made), { type: 'choose', label: "I'm done!" }];
      }
      const answers = habitatJourneyAnswers(item);
      const pick = intent === 'wrong' ? answers.plainWrong : answers.correct;
      return [item.answerKind === 'gesture' ? { type: 'choose', label: pick } : { type: 'answer', text: pick }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'classification-sorter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/biology/ClassificationSorter.tsx',
    instanceId: 'sorter-bio',
    defaults: { grade: 'Kindergarten', mode: 'sort', di: false, topic: 'Animals with wings and animals without wings' },
    leakTokens: ['SORT_ORIENT', 'SORT_ITEM_STAGED', 'SORT_INCORRECT', 'SORT_READ_ALOUD', 'SORT_ITEM_TAP', 'SORT_ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Each item is staged alone: tap its group card (wrong: the first other group).
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = (ctx.data.items ?? []).find((i: ClassificationItem) => i.id === ctx.itemId);
      if (!item) throw new Error('No current classification-sorter item');
      const targets = sortHarnessTargets(ctx.data.categories ?? [], item);
      const target = intent === 'wrong' ? targets.wrong : targets.correct;
      if (!target) throw new Error('classification-sorter: no wrong group to tap');
      return [{ type: 'touch', target }];
    },
    probes: { mounted: { selector: '[data-pip-object="card"]' } },
  },
  'food-web-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/biology/FoodWebBuilder.tsx',
    instanceId: 'food-web',
    defaults: { grade: 'Grade 5', mode: 'build_chain', di: false, topic: 'Food chains: energy moves from producers to consumers' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // build_chain clears a kept scene, puts in a chain the lesson's relations make, draws its arrows and presses I'm
    // done! (wrong: every arrow turned round). complete_web taps each relation food then eater and presses Check (wrong:
    // the first turned round). The easier practice chain is rebuilt from its parent.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      if (ctx.data.challengeType !== 'build_chain') {
        // The smaller practice web is rebuilt from the whole web with the same builder.
        const whole: FoodWebChallenge = { id: 'web', type: 'complete_web' };
        const web = ctx.itemId?.endsWith('~smaller') ? smallerWeb(whole, ctx.data.organisms ?? [], ctx.data.correctConnections ?? []) : whole;
        if (!web) throw new Error('No smaller food web to rebuild');
        return foodWebHarnessInputs(ctx.data as never, web, intent === 'wrong', ctx.demand);
      }
      const all: FoodWebChallenge[] = ctx.data.challenges ?? [];
      const parent = ctx.itemId?.endsWith('~shorter') ? all.find(x => `${x.id}~shorter` === ctx.itemId) : undefined;
      const c = parent ? shorterChain(parent, ctx.data.organisms ?? [], foodWebRelations(ctx.data.organisms ?? [], ctx.data.correctConnections ?? []))
        : all.find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current food-web-builder challenge');
      return foodWebHarnessInputs(ctx.data as never, c, intent === 'wrong', ctx.demand);
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'gear-train-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/engineering/GearTrainBuilder.tsx',
    instanceId: 'gears',
    defaults: { grade: 'Grade 4', mode: 'build_ratio', di: false, topic: 'Gears in clocks and bicycles' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // Clear a kept train, add a train that passes and press I'm done!. Wrong: one gear more where a way is asked
    // (the last gear turns the other way), else the first and last gear swapped (the speed turned round).
    // The easier practice train is rebuilt from its parent.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find((x: { id: string }) => `${x.id}~simpler` === ctx.itemId) : undefined;
      const c = parent ? simplerTrain(parent) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current gear-train-builder train');
      return gearHarnessInputs(c, intent === 'wrong', ctx.demand);
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'tower-stacker': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/engineering/TowerStacker.tsx',
    instanceId: 'tower',
    defaults: { grade: 'Grade 3', mode: 'build_windproof', di: false, topic: 'Building towers that stay up' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // Clear a kept build, drop a tower that passes (flat beams; on build_few beams stood on end) and press I'm done!.
    // Wrong: a block column one short of the line, and on windproof a block column to the line the wind blows over.
    // The easier practice tower is rebuilt from its parent.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      const parent = ctx.itemId?.endsWith('~shorter') ? all.find((x: { id: string }) => `${x.id}~shorter` === ctx.itemId) : undefined;
      const c = parent ? shorterTower(parent) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current tower-stacker tower');
      return towerHarnessInputs(c, intent === 'wrong', ctx.demand);
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'matter-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/chemistry/MatterExplorer.tsx',
    instanceId: 'matter',
    defaults: { grade: 'Kindergarten', mode: 'sort', di: false, topic: 'Solids, liquids and gases around us' },
    leakTokens: ['MEX_ITEM', 'MEX_MOVE', 'MEX_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer computed from the object. A practice item (`~simpler`) is rebuilt from its parent
    // with the same builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = matterItems(ctx.data as never);
      const parent = ctx.itemId ? matterPracticeParent(ctx.itemId, all) : null;
      const item = parent ? matterPracticeItem(parent, matterLeverSession(ctx.data as never)) : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current matter-explorer item');
      const answers = matterJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'molecule-constructor': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/chemistry/MoleculeConstructor.tsx',
    instanceId: 'molecules',
    defaults: { grade: 'Grade 4', mode: 'make_molecule', di: false, topic: 'Atoms bond to make molecules' },
    leakTokens: ['FIRST_BOND', 'MOLECULE_COMPLETE', 'MOLECULE_INCORRECT', 'NEXT_CHALLENGE', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every challenge type through its real controls (`moleculeHarnessInputs`): make_molecule adds a molecule the
    // ask's menu proves passes and presses "I'm done!" (wrong: the same molecule one hydrogen short, `open_valence`);
    // build_target adds the target's atoms and joins them; identify and formula_write type. The easier practice item
    // (make_molecule's smaller ask, build_target's smaller target) is rebuilt from its parent with the session's data.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all: MoleculeConstructorChallenge[] = ctx.data.challenges ?? [];
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find(x => `${x.id}~simpler` === ctx.itemId) : undefined;
      const c = parent ? simplerMolecule(parent, { challenges: all, palette: ctx.data.palette }) : all.find(x => x.id === ctx.itemId);
      if (!c) throw new Error('No current molecule-constructor challenge');
      return moleculeHarnessInputs(c, intent === 'wrong', ctx.demand);
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'states-of-matter': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/chemistry/StatesOfMatter.tsx',
    instanceId: 'states',
    defaults: { grade: 'Grade 2', mode: 'observe', di: false, topic: 'Heating and cooling change solids, liquids and gases' },
    leakTokens: ['SOM_ITEM', 'SOM_MOVE', 'SOM_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer computed from the substance table.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A practice item (`~simpler`) is rebuilt from its parent with the same builder.
      const all = statesItems(ctx.data as never);
      const parent = ctx.itemId ? statesPracticeParent(ctx.itemId, all) : null;
      const item = parent ? statesPracticeItem(parent, statesLeverSession(all, (ctx.data as { gradeBand?: 'K-2' | '3-5' }).gradeBand ?? '3-5'))
        : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current states-of-matter item');
      const answers = statesJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'solar-system-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/astronomy/SolarSystemExplorer.tsx',
    instanceId: 'solar',
    defaults: { grade: 'Grade 2', mode: 'identify', di: false, topic: 'The planets of our solar system' },
    leakTokens: ['SOLAR_ITEM', 'SOLAR_MOVE', 'SOLAR_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken planet name computed from the bodies on screen.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier item a simplify lever opened is not a generated challenge: rebuilt from its parent.
      const item = solarJourneyItem(ctx.data as never, ctx.itemId);
      if (!item) throw new Error('No current solar-system-explorer item');
      const answers = solarJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'light-shadow-lab': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/astronomy/LightShadowLab.tsx',
    instanceId: 'shadow',
    defaults: { grade: 'Grade 2', mode: 'predict', di: false, topic: 'How shadows change during the day' },
    leakTokens: ['ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE', 'NEXT_ITEM', 'SUPPORT='],
    prompts: WORKSPACE_PROMPTS,
    // Every mode is one tapped choice and Check Answer. A wrong answer is the most telling error `shadowMiss` names on
    // that item: the shadow on the sun's side, the time on the other side of noon, the length of a high sun for a low one.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // An easier item (`~easier`) is rebuilt from its parent with the same builder.
      const parent = shadowPracticeParent(ctx.itemId, ctx.data.challenges ?? []);
      const c: any = parent ? shadowPracticeItem(parent) : (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current light-shadow-lab challenge');
      const answers = shadowHarnessAnswers(c, ctx.data.sunPositions ?? []);
      return [{ type: 'choose', label: intent === 'wrong' ? answers.plainWrong : answers.correct }, { type: 'check' }];
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'genre-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/GenreExplorer.tsx',
    instanceId: 'genre-explorer',
    defaults: { grade: 'Grade 3', mode: 'classify_genre', di: false, topic: 'Fables, myths and informational texts' },
    leakTokens: ['GEX_ITEM', 'GEX_MOVE', 'GEX_COMPLETE', 'GEX_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer: yes or no, which text, or the kind of writing.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = genreItems(ctx.data as never).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current genre-explorer item');
      const answers = genreJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'text-structure-analyzer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/TextStructureAnalyzer.tsx',
    instanceId: 'text-structure-analyzer',
    defaults: { grade: 'Grade 4', mode: 'cause_effect', di: false, topic: 'Why rivers flood' },
    leakTokens: ['TSA_ITEM', 'TSA_MOVE', 'TSA_COMPLETE', 'TSA_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken answer: the linking word, the structure, or the part an idea goes in.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = textStructureItems(ctx.data as never, 'text-structure-analyzer').items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current text-structure-analyzer item');
      const answers = textStructureJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'sentence-analyzer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/SentenceAnalyzer.tsx',
    instanceId: 'sentence-analyzer',
    defaults: { grade: 'Grade 3', mode: 'identify_pos', di: false, topic: 'Nouns, verbs and adjectives' },
    leakTokens: ['SAN_ITEM', 'SAN_MOVE', 'SAN_COMPLETE', 'SAN_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken grammar label.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = sentenceItems(ctx.data as never).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current sentence-analyzer item');
      const answers = sentenceJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'read-aloud-studio': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/ReadAloudStudio.tsx',
    instanceId: 'read-aloud-studio',
    defaults: { grade: 'Grade 2', mode: 'accuracy', di: false, topic: 'A day at the pond' },
    leakTokens: ['RA_ITEM', 'RA_MOVE', 'RA_COMPLETE', 'RA_HEAR', 'RA_PLAN'],
    prompts: WORKSPACE_PROMPTS,
    // Every scored item is the printed line read aloud. Expression's phrase plan accepts any plan, so it has no
    // wrong answer: the driver commits the plan as it stands. A practice line (`~simpler`) is rebuilt from its
    // parent with `shortLine`.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = readAloudItems(ctx.data as never);
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find(i => `${i.id}~simpler` === ctx.itemId) : undefined;
      const item = parent ? readAloudShortLine(parent, all) : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current read-aloud-studio item');
      if (item.step === 'mark') return intent === 'wrong' ? [] : [{ type: 'choose', label: 'Use my phrase plan' }];
      const answers = readAloudJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'oral-sentence-studio': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/OralSentenceStudio.tsx',
    instanceId: 'oral',
    defaults: { grade: 'Kindergarten', mode: 'describe_scene', di: false, topic: 'Using new vocabulary words' },
    leakTokens: ['OSS_ITEM', 'OSS_MOVE', 'OSS_COMPLETE', 'OSS_HEAR'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one original spoken sentence: a valid example, or the pack's signature wrong answer.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = oralSentenceItems((ctx.data as { challenges?: never[] }).challenges ?? []).find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current oral-sentence-studio item');
      const answers = oralSentenceJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'cause-effect-chain': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/history/CauseEffectChain.tsx',
    instanceId: 'cause-effect-chain',
    defaults: { grade: 'Grade 3', mode: 'build_chain', di: false, topic: 'How the railroad changed a river town' },
    leakTokens: ['CEC_ITEM', 'CEC_MOVE', 'CEC_COMPLETE', 'CEC_HEAR', 'CEC_CHAIN', 'CEC_CONTEXT'],
    prompts: WORKSPACE_PROMPTS,
    // identify_cause and root_vs_proximate are spoken; build_chain taps every card into the chain, in causal
    // order or reversed, and the board commits once it sits still. A practice item (`~simpler`) is rebuilt from its
    // parent with the same builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const d = ctx.data as { gradeLevel?: string; supportTier?: 'easy' | 'medium' | 'hard' };
      const all = causeEffectItems(d as never);
      const parent = ctx.itemId ? causeEffectPracticeParent(ctx.itemId, all) : null;
      const item = parent ? causeEffectPracticeItem(parent, { items: all, gradeLevel: d.gradeLevel, tier: d.supportTier })
        : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current cause-effect-chain item');
      const answers = causeEffectJourneyAnswers(item);
      if (answers.order) {
        const text = (id: string) => item.cards.find(c => c.id === id)?.text ?? id;
        return (intent === 'wrong' ? answers.order.wrong : answers.order.correct)
          .map(id => ({ type: 'choose' as const, label: `Place "${text(id)}"` }));
      }
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'era-explorer': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/history/EraExplorer.tsx',
    instanceId: 'era-explorer',
    defaults: { grade: 'Grade 2', mode: 'era_sort', di: false, topic: 'Life in pioneer times' },
    leakTokens: ['ERA_ITEM', 'ERA_MOVE', 'ERA_COMPLETE', 'ERA_HEAR', 'ERA_SOURCE', 'ERA_EXPLORE'],
    prompts: WORKSPACE_PROMPTS,
    // Every item is one spoken pick from the three-part menu the ask states. A practice item (`~simpler`) is rebuilt
    // from its parent with the same builder.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = eraItems(ctx.data as never);
      const parent = ctx.itemId ? eraPracticeParent(ctx.itemId, all) : null;
      const item = parent ? eraPracticeItem(parent, eraLeverSession(all, ctx.data as never)) : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current era-explorer item');
      const answers = eraJourneyAnswers(item);
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'periodic-table': {
    execution: 'workspace',
    component: 'primitives/PeriodicTable.tsx',
    instanceId: 'periodic-table',
    defaults: { grade: 'Grade 8', mode: 'explore', di: false, topic: 'Organization of the periodic table' },
    leakTokens: ['PT_ITEM', 'PT_MOVE', 'PT_COMPLETE', 'PT_HEAR', 'PT_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Element Hunt taps a box by element name (a wrong tap is a neighbouring box); the other asks are spoken.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // The easier practice item (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const all = periodicItems(ctx.data as never);
      const parent = periodicPracticeParent(ctx.itemId, all);
      const item = parent ? periodicPracticeItem(parent, all) : all.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current periodic-table item');
      const answers = periodicJourneyAnswers(item);
      if (answers.tap) {
        return [{ type: 'touch', target: `element-${(intent === 'wrong' ? answers.tap.wrong : answers.tap.correct).toLowerCase()}` }];
      }
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="stimulus"]' } },
  },
  'knowledge-check': {
    execution: 'workspace',
    component: 'primitives/KnowledgeCheck.tsx',
    instanceId: 'knowledge-check',
    defaults: { grade: 'Grade 2', mode: 'recall', di: false, topic: 'Plants and what they need to grow' },
    leakTokens: ['KC_ITEM', 'KC_MOVE', 'KC_COMPLETE', 'KC_HEAR', 'KC_TAP'],
    prompts: WORKSPACE_PROMPTS,
    // Spoken kinds answer with the pack's short form; a symbol menu or a sign in a number sentence is pressed.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const item = knowledgeCheckItems(ctx.data as never).items.find(i => i.id === ctx.itemId);
      if (!item) throw new Error('No current knowledge-check item');
      const answers = knowledgeCheckJourneyAnswers(item);
      if (answers.press) return [{ type: 'choose', label: intent === 'wrong' ? answers.press.wrong : answers.press.correct }];
      return [{ type: 'answer', text: intent === 'wrong' ? answers.plainWrong : answers.correct }];
    },
    probes: { mounted: { selector: '[data-pip-object="question"]' } },
  },
  'hundreds-chart': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/HundredsChart.tsx',
    instanceId: 'chart',
    defaults: { grade: 'Grade 1', mode: 'highlight_sequence', di: false, topic: 'Skip counting by 2s, 5s and 10s on the hundreds chart' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: each needed cell, or a choice, then Check. Derived from the
    // mounted challenge, never from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      // The easier practice chart (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = hundredsChartPracticeParent(ctx.itemId, all);
      const c = parent ? hundredsChartPracticeItem(parent, ctx.data as never) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current hundreds-chart challenge');
      return hundredsChartHarnessInputs(c, intent === 'wrong', ctx.data.gridMax ?? 100);
    },
    probes: { mounted: { selector: '[data-pip-object="chart"]' } },
  },
  'skip-counting-runner': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/SkipCountingRunner.tsx',
    instanceId: 'skip',
    defaults: { grade: 'Grade 2', mode: 'count_along', di: false, topic: 'Skip counting by 5s on a number line' },
    leakTokens: ['ACTIVITY_START', 'JUMP_LANDING', 'JUMP_WRONG_TARGET', 'PREDICT_', 'FILL_', 'SKIP_VALUE_', 'MULTIPLY_',
      'COUNT_COMPLETE', 'PHASE_TRANSITION', 'CHALLENGE_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: count_along taps each next tick (`tick-<n>`) then Check; the typed modes
    // write the number into their box and Check (fill_missing one gap at a time). Try again keeps the landings and the
    // gaps filled, so the row reads where the character stands (`at`) and what is filled from the scene facts.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      const line = { skipValue: ctx.data.skipValue, startFrom: ctx.data.startFrom ?? 0, endAt: ctx.data.endAt,
        direction: ctx.data.direction ?? 'forward' };
      // The easier practice count (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = skipPracticeParent(ctx.itemId, all);
      const practice = parent ? skipPracticeItem(parent, { challenges: all, line, showOptions: ctx.data.showOptions,
        supportTier: ctx.data.supportTier }) : null;
      const c = practice?.challenge ?? all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current skip-counting-runner challenge');
      const at = Number(ctx.demand?.at);
      const filled = String(ctx.demand?.filled ?? '').split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && String(ctx.demand?.filled ?? '').trim() !== '');
      return skipHarnessInputs(c, practice?.line ?? line, intent === 'wrong', { at: Number.isFinite(at) ? at : undefined, filled });
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'math-fact-fluency': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/MathFactFluency.tsx',
    instanceId: 'facts',
    defaults: { grade: 'Kindergarten', mode: 'visual_fact', di: false, topic: 'Addition facts within 5' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: a number, equation or picture tapped, or the stepper
    // pressed up to a number and Submit. Derived from the mounted challenge, never from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      // A simplify lever's easier fact is not a generated challenge: rebuild it with the same builder.
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find((x: { id: string }) => `${x.id}~simpler` === ctx.itemId) : null;
      const c = parent ? simplerMathFact(parent, ctx.data.maxNumber ?? 5) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current math-fact-fluency challenge');
      return mathFactHarnessInputs(c, intent === 'wrong', ctx.data.maxNumber ?? 5);
    },
    probes: { mounted: { selector: '[data-pip-object="problem"], [data-pip-object="visual"]' } },
  },
  'addition-fact-strategies': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/AdditionFactStrategies.tsx',
    instanceId: 'fact-strategies',
    defaults: { grade: 'Grade 1', mode: 'doubles', di: false, topic: 'Doubles facts' },
    leakTokens: ['STRATEGY_INTRO', 'NEXT_ITEM', 'COMEBACK', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through the real pad: the sum, or one away from it. Derived from the mounted fact, never from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      // A simplify lever's smaller fact is not a generated challenge: rebuild it with the same builder.
      const parent = ctx.itemId?.endsWith('~simpler') ? all.find((x: { id: string }) => `${x.id}~simpler` === ctx.itemId) : null;
      const c = parent ? smallerAdditionFact(ctx.data.strategy, parent, all) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current addition-fact-strategies fact');
      return additionFactHarnessInputs(c, intent === 'wrong');
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'equation-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/EquationBuilder.tsx',
    instanceId: 'equations',
    defaults: { grade: 'Grade 1', mode: 'true-false', di: false, topic: 'The equal sign: true and false equations within 10' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: tiles pressed into the row, a number or True/False tapped,
    // or the number typed, then Check. Derived from the mounted challenge, never from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      // An easier practice item (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = equationBuilderPracticeParent(ctx.itemId, all);
      const c = parent ? equationBuilderPracticeItem(parent) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current equation-builder challenge');
      return equationBuilderHarnessInputs(c, intent === 'wrong');
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"], [data-pip-object="equation"]' } },
  },
  'pattern-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/PatternBuilder.tsx',
    instanceId: 'patterns',
    defaults: { grade: 'Kindergarten', mode: 'extend', di: false, topic: 'Extend AB and AAB color patterns' },
    leakTokens: ['ACTIVITY_START', 'EXTEND_CORRECT', 'EXTEND_INCORRECT', 'CORE_CORRECT', 'CORE_INCORRECT', 'PHASE_TRANSITION', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: palette tokens tapped into the blanks or the build row, or
    // tokens of the pattern row selected, then Check. Derived from the mounted challenge, never from Python.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const all = ctx.data.challenges ?? [];
      // The easier practice row (a simplify lever) is not a generated challenge: rebuild it from its parent.
      const parent = practiceParent(ctx.itemId, all);
      const c = parent ? patternPracticeItem(parent, ctx.data as never) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current pattern-builder challenge');
      // An open-build create keeps its row through Try again; the driver starts over on a kept row.
      return patternBuilderHarnessInputs(ctx.data as never, c, intent === 'wrong', Number(ctx.demand?.tokensInRow ?? 0) > 0);
    },
    probes: { mounted: { selector: '[data-pip-object="pattern"], [data-pip-object="build"]' } },
  },
  'strategy-picker': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/StrategyPicker.tsx',
    instanceId: 'strategies',
    defaults: { grade: 'Grade 1', mode: 'guided', di: false, topic: 'Addition strategies within 10: counting on, doubles and making ten' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'MATCH_CORRECT', 'MATCH_INCORRECT', 'COMPARE_COMPLETE',
      'STRATEGY_CHOSEN', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    // Every mode through its real controls: a menu strategy, the stepper's "One more", or an option tapped,
    // then Check. Compare has no wrong answer, so its wrong phase throws. Derived from the mounted challenge.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // A simpler item (`<item>~simpler`) is not a generated challenge: rebuild it from its parent with the same builder.
      const all = ctx.data.challenges ?? [];
      const parent = strategyPracticeParent(ctx.itemId ?? '', all);
      const c = parent ? strategyPracticeItem(parent, ctx.data as never) : all.find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current strategy-picker challenge');
      // Try again keeps a choose item's menu pick; the scene publishes it.
      const picked = typeof ctx.demand?.chosen === 'string' && ctx.demand.chosen !== 'none yet';
      return strategyPickerHarnessInputs(c, intent === 'wrong', picked);
    },
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
  'opinion-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/OpinionBuilder.tsx',
    instanceId: 'opinions',
    defaults: { grade: 'Grade 3', mode: 'build_opinion', di: false, topic: 'Opinions about school and home' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // build_opinion through its real cards: the yes side's opinion, reason, example, restatement for a pass; the restatement
    // first for a wrong one. OREO and CER sentences are checked by the writing judge (a model): OpinionBuild.workspace.test.tsx.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      if (ctx.data.task !== 'opinion_build') throw new Error('opinion-builder writing steps are judged by the writing judge, not driven at W1');
      const q = (ctx.data.opinions ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!q) throw new Error('No current opinion-builder question');
      const id = (role: string) => q.cards.find((c: { role: string; side?: string }) => c.role === role && c.side === 'yes').id as string;
      const order = intent === 'wrong' ? [id('restate'), id('reason'), id('example'), id('opinion')]
        : [id('opinion'), id('reason'), id('example'), id('restate')];
      const placed = Number(ctx.demand?.cardsPlaced ?? 0) > 0;
      return [...(placed ? [{ type: 'choose' as const, label: 'Clear' }] : []),
        ...order.map(c => ({ type: 'choose' as const, label: `card ${c}` })), { type: 'choose' as const, label: "I'm done!" }];
    },
    probes: { mounted: { selector: '[data-testid="ob-answer"], [data-testid="ws-paragraph"]' } },
  },
  'figurative-language-finder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/FigurativeLanguageFinder.tsx',
    instanceId: 'figures',
    defaults: { grade: 'Grade 4', mode: 'comparison', di: false, topic: 'A stormy day at the lake' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // Find steps through the real passage and kind buttons: the first tagged figure not yet found, by its sentence and
    // kind, passes in code; wrong names a kind that sentence's tags do not hold (a wrong_type in code). Meaning and make
    // steps are checked by the writing judge (a model): FigurativeLanguageFinder.workspace.test.tsx.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      if (!String(ctx.itemId).startsWith('find')) throw new Error('figurative-language-finder meaning and make steps are judged by the writing judge, not driven at W1');
      const sentences = figSentencesOf(ctx.data.passage ?? '');
      const foundSoFar = String(ctx.demand?.foundSoFar ?? '');
      const inst = (ctx.data.instances ?? []).find((i: { text: string }) => figSentenceOf(sentences, i.text) >= 0 && !foundSoFar.includes(`"${i.text.trim()}"`));
      if (!inst) throw new Error('No unfound figure left');
      const n = figSentenceOf(sentences, inst.text);
      const tagged = (ctx.data.instances ?? []).filter((i: { text: string }) => figSentenceOf(sentences, i.text) === n).map((i: { type: string }) => i.type);
      const kind = intent === 'wrong' ? figTypeChoices(ctx.data).find(t => !tagged.includes(t))! : inst.type;
      return [{ type: 'choose' as const, label: `sentence ${n + 1}` }, { type: 'choose' as const, label: `kind ${kind}` },
        { type: 'choose' as const, label: "I'm done!" }];
    },
    probes: { mounted: { selector: '[data-testid="fig-passage"], [data-testid="fig-sentence"], textarea' } },
  },
  'story-planner': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/StoryPlanner.tsx',
    instanceId: 'story',
    defaults: { grade: 'Grade 1', mode: 'story_structure', di: false, topic: 'A lost puppy' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // K-1 through its real pictures: one tap per card (every picture passes), then the arc events in generated order
    // (correct) or the last event first (wrong). Grade 2+ cards are checked by the writing judge (a model):
    // StoryPlanner.workspace.test.tsx.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      const cap = (t: string) => storySplitPicture(t).label;
      // Every picture is a fair creative pick (reader-fit contract), so the plan item has no wrong input.
      if (ctx.itemId === 'plan') return intent === 'wrong' ? [] : (ctx.data.elements ?? []).filter((e: { choices?: string[] }) => e.choices?.length)
        .map((e: { choices: string[] }) => ({ type: 'choose' as const, label: cap(e.choices[0]) }));
      if (ctx.itemId !== 'arc') throw new Error('story-planner cards are judged by the writing judge, not driven at W1');
      const events = (ctx.data.arcEvents ?? []) as string[];
      const order = intent === 'wrong' ? [...events.slice(-1), ...events.slice(0, -1)] : events;
      const placed = ctx.demand?.placed !== undefined && ctx.demand.placed !== 'nothing placed';
      return [...(placed ? [{ type: 'choose' as const, label: 'Clear' }] : []),
        ...order.map(e => ({ type: 'choose' as const, label: cap(e) })), { type: 'choose' as const, label: "I'm done!" }];
    },
    probes: { mounted: { selector: '[data-testid="sp-order"], [role="group"], textarea' } },
  },
  'revision-workshop': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/RevisionWorkshop.tsx',
    instanceId: 'revisions',
    defaults: { grade: 'Grade 5', mode: 'reorganize', di: false, topic: 'A day at the beach' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // reorganize through its real sentence cards: the targets' order passes in code; wrong is the last sentence first.
    // The typed revisions are checked by the writing judge (a model): RevisionWorkshop.workspace.test.tsx.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      if (ctx.data.revisionSkill !== 'reorganize') throw new Error('revision-workshop typed revisions are judged by the writing judge, not driven at W1');
      const ids = (ctx.data.targets ?? []).map((t: { targetId: string }) => t.targetId) as string[];
      const order = intent === 'wrong' ? [...ids.slice(-1), ...ids.slice(0, -1)] : ids;
      const placed = ctx.demand?.order !== undefined && ctx.demand.order !== 'nothing placed';
      return [...(placed ? [{ type: 'choose' as const, label: 'Clear' }] : []),
        ...order.map(id => ({ type: 'choose' as const, label: `sentence ${id}` })), { type: 'choose' as const, label: "I'm done!" }];
    },
    probes: { mounted: { selector: '[data-testid="rv-order"], [data-testid="rv-draft"]' } },
  },
  'sentence-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/SentenceBuilder.tsx',
    instanceId: 'sentences',
    defaults: { grade: 'Grade 1', mode: 'build_sentence', di: false, topic: 'Questions and telling sentences about pets' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // build_sentence is checked by the shared literacy judge (a model) after its code checks;
    // SentenceBuild.workspace.test.tsx drives it with a stubbed judge.
    // The tile modes through their real tiles: a listed order passes in code; wrong is the reverse order (the end mark
    // first). Try again keeps the row, so a correct try clears it first. build_sentence is judged by the sentence judge.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      if (ctx.data.task === 'sentence_build') throw new Error('sentence-builder build_sentence is judged by the sentence judge, not driven at W1');
      const c = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!c) throw new Error('No current sentence-builder challenge');
      const order: string[] = intent === 'wrong' ? [...c.validArrangements[0]].reverse() : c.validArrangements[0];
      const text = (id: string) => c.tiles.find((t: { id: string }) => t.id === id).text as string;
      const placed = Number(ctx.demand?.tilesPlaced ?? 0) > 0;
      return [...(placed ? [{ type: 'choose' as const, label: 'Clear' }] : []),
        ...order.map(id => ({ type: 'choose' as const, label: `tile ${text(id)}` })), { type: 'choose' as const, label: "I'm done!" }];
    },
    probes: { mounted: { selector: '[data-testid="sb-row"], [data-testid="so-row"]' } },
  },
  'paragraph-architect': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/literacy/ParagraphArchitect.tsx',
    instanceId: 'paragraphs',
    defaults: { grade: 'Grade 2', mode: 'build_paragraph', di: false, topic: 'Informative paragraphs about animals' },
    leakTokens: [],
    prompts: WORKSPACE_PROMPTS,
    // build_paragraph through its real cards: topic, two facts, closing for a pass; the closing first for a wrong one.
    // Try again keeps the paragraph, so a correct try clears it first.
    inputsFor: (intent, ctx) => {
      if (intent === 'warmup') return [];
      // The writing modes' sentences are checked by the writing judge (a model); OlderModes.workspace.test.tsx drives them.
      if (ctx.data.task !== 'paragraph_build') throw new Error('paragraph-architect writing steps are judged by the writing judge, not driven at W1');
      const p = (ctx.data.paragraphs ?? []).find((x: { id: string }) => x.id === ctx.itemId);
      if (!p) throw new Error('No current paragraph-architect paragraph');
      const id = (role: string, n = 0) => p.cards.filter((c: { role: string }) => c.role === role)[n].id as string;
      const order = intent === 'wrong' ? [id('closing'), id('detail'), id('detail', 1), id('topic')]
        : [id('topic'), id('detail'), id('detail', 1), id('closing')];
      const placed = Number(ctx.demand?.sentencesPlaced ?? 0) > 0;
      return [...(placed ? [{ type: 'choose' as const, label: 'Clear' }] : []),
        ...order.map(c => ({ type: 'choose' as const, label: `card ${c}` })), { type: 'choose' as const, label: "I'm done!" }];
    },
    probes: { mounted: { selector: '[data-testid="pb-paragraph"], [data-testid="ws-paragraph"]' } },
  },
  'polygon-area-builder': {
    execution: 'workspace',
    component: 'primitives/visual-primitives/math/PolygonAreaBuilder.tsx',
    instanceId: 'polygon-area',
    defaults: { grade: 'Grade 3', mode: 'build_area', di: false, topic: 'Area: make shapes with a given number of unit squares' },
    leakTokens: ['ACTIVITY_START', 'ANSWER_CORRECT', 'ANSWER_INCORRECT', 'DECOMPOSE_DONE', 'NEXT_ITEM', 'ALL_COMPLETE'],
    prompts: WORKSPACE_PROMPTS,
    inputsFor: (intent, ctx) => intent === 'warmup' ? [] : polygonAreaInputs(ctx, intent === 'wrong'),
    probes: { mounted: { selector: '[data-pip-object="workspace"]' } },
  },
};

/** picture-vocabulary pair_build through its real picture buttons (rules in `picturePairBuild.ts`). */
function picturePairInputs(ctx: JourneyContext, wrong: boolean): DriverInput[] {
  const item = picturePairItemsFrom(ctx.data.pairItems ?? [], ctx.data.supportTier).find(i => i.id === ctx.itemId);
  if (!item) throw new Error('No current picture-vocabulary pair_build board');
  const pick = (pair: string[]) => [...pair.map(w => ({ type: 'choose' as const, label: `picture ${w}` })),
    { type: 'choose' as const, label: "I'm done!" }];
  const clear = Number(ctx.demand?.picturesInTray ?? 0) > 0 ? [{ type: 'choose' as const, label: 'Clear' }] : [];
  if (wrong) {
    const want = item.relation === 'opposite' ? 'alike' : 'same_kind';
    const decoy = item.board.flatMap((a, i) => item.board.slice(i + 1).map(b => [a, b]))
      .find(p => picturePairMiss(p, [], item.relation) === want);
    if (!decoy) throw new Error(`pair_build ${item.id}: no ${want} decoy on the board`);
    return [...clear, ...pick(decoy)];
  }
  const made = String(ctx.demand?.madeBefore ?? '').split('; ').filter(m => m && m !== 'none')
    .map(m => m.split(' and ').sort().join('+'));
  const left = passingPairs(item.board, item.relation).filter(p => !made.includes(p)).map(p => p.split('+'));
  const need = Math.max(1, item.ways - made.length);
  if (left.length < need) throw new Error(`pair_build ${item.id}: ${left.length} right pairs left, ${need} needed`);
  return [...clear, ...left.slice(0, need).flatMap(pick)];
}

/**
 * Polygon area builder through its real controls. A typed area goes in the Area box, then Check; wrong is the mode's
 * signature error (the ½ left out of a triangle or trapezoid, else half the area). The open build shades squares on
 * the grid, then I'm done: the first shape fills rows left to right, a second shape fills columns three squares tall
 * (never the first one turned for any area of 4 or more). Try again keeps the build, so it is cleared first; wrong is
 * one square short. decompose needs a canvas drag the row does not drive. A practice item (`~smaller`) is rebuilt from
 * its parent with the builder its lever used (`smallerArea` or `smallerFigure`).
 */
function polygonAreaInputs(ctx: JourneyContext, wrong: boolean): DriverInput[] {
  const id = ctx.itemId ?? '';
  const session = (ctx.data.challenges ?? []).find((x: { id: string }) => x.id === id.replace(/~smaller$/, ''));
  const c = id.endsWith('~smaller') && session
    ? (session.type === 'build_perimeter' ? smallerPerimeter(session)
      : session.type === 'build_area' ? smallerArea(session) : smallerFigure(session)) : session;
  if (!c) throw new Error('No current polygon-area-builder challenge');
  if (c.type === 'decompose') throw new Error('polygon-area-builder decompose: the cut-triangle drag on the canvas is not driven');
  if (c.type === 'build_perimeter') return perimeterBuildInputs(ctx, c, wrong);
  if (c.type !== 'build_area') {
    const halfLeftOut = c.figureType === 'triangle' || c.figureType === 'trapezoid';
    const typed = wrong ? (halfLeftOut ? c.expectedArea * 2 : c.expectedArea / 2) : c.expectedArea;
    return [{ type: 'write', label: 'Area', text: String(typed) }, { type: 'check' }];
  }
  const area: number = c.targetArea;
  const shade = (n: number, at: (i: number) => [number, number]): DriverInput[] =>
    Array.from({ length: n }, (_, i) => ({ type: 'touch' as const, target: `cell-${at(i)[0]}-${at(i)[1]}` }));
  const rows = (n: number) => shade(n, i => [i % 10, Math.floor(i / 10)]);
  const columns = (n: number) => shade(n, i => [Math.floor(i / 3), i % 3]);
  const clear: DriverInput[] = Number(ctx.demand?.squaresPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear grid' }] : [];
  const done: DriverInput = { type: 'choose', label: "I'm done!" };
  const second = ctx.demand?.shape === 'second';
  if (wrong) return [...clear, ...(second ? columns(area - 1) : rows(area - 1)), done];
  if (second) return [...clear, ...columns(area), done];
  return [...clear, ...rows(area), done, ...(c.shapesAsked === 2 ? [{ type: 'choose', label: 'Clear grid' } as DriverInput,
    ...columns(area), done] : [])];
}

/**
 * The perimeter build (`build_perimeter`): a P-unit perimeter as a rectangle h rows tall and P/2 - h wide. The first
 * shape is 1 row tall (2 when that would not fit the 10-wide grid), the second one row taller, so never the first one
 * turned. Wrong is the same rectangle one column narrower: its perimeter is two short.
 */
function perimeterBuildInputs(ctx: JourneyContext, c: { targetPerimeter?: number; shapesAsked?: number }, wrong: boolean): DriverInput[] {
  const p = c.targetPerimeter ?? 0;
  const firstRows = p / 2 - 1 > 10 ? 2 : 1;
  const rect = (rows: number, narrower = 0): DriverInput[] => {
    const cols = p / 2 - rows - narrower;
    return Array.from({ length: rows * cols }, (_, i) => ({ type: 'touch' as const, target: `cell-${i % cols}-${Math.floor(i / cols)}` }));
  };
  const clear: DriverInput[] = Number(ctx.demand?.squaresPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear grid' }] : [];
  const done: DriverInput = { type: 'choose', label: "I'm done!" };
  const rows = ctx.demand?.shape === 'second' ? firstRows + 1 : firstRows;
  if (wrong) return [...clear, ...rect(rows, 1), done];
  return [...clear, ...rect(rows), done, ...(c.shapesAsked === 2 && rows === firstRows
    ? [{ type: 'choose', label: 'Clear grid' } as DriverInput, ...rect(firstRows + 1), done] : [])];
}

/** Shared by every primitive: both belong to the runtime shell, not to any one board. */
export const SHARED_PROBES: Record<string, JourneyProbe> = {
  reminder: { selector: '[data-runtime-hint]' },
  support: { selector: '[aria-label="Worked example"]' },
  // Whatever a pulled in-item lever drew (`/add-support-tiers`): every primitive marks it `data-lever`.
  leverMarks: { selector: '[data-lever]', kind: 'count' },
};

/** The JSON-serializable half — everything but the two resolver functions. */
export function journeyDescriptor(id: LivePrimitiveId) {
  const j = LIVE_JOURNEYS[id];
  if (!j) throw new Error('No live journey for ' + id);
  return { primitiveId: id, component: j.component, instanceId: j.instanceId, defaults: j.defaults, execution: j.execution,
    leakTokens: j.leakTokens, prompts: j.prompts, judgesExample: !!j.exampleTaught,
    probes: { ...SHARED_PROBES, ...(j.probes ?? {}) } };
}
