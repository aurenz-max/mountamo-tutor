/**
 * The live-activity registry: which primitive families the live session can mount,
 * and nothing about any one of them.
 *
 * Every primitive-specific fact — modes, validation, mounted state, grade gate,
 * picker copy, lesson-start wording, model guidance — lives in that primitive's own
 * module under `adapters/`. This file only composes them, so adopting a family is a
 * new adapter file plus one line here, and the server route, the capabilities route
 * and the sandbox all widen automatically.
 */
import { numberLineLiveDomain, validateActivityData, initialActivityState } from './adapters/numberLineLive';
import { tenFrameLiveDomain, validateTenFrameData } from './adapters/tenFrameLive';
import { countingBoardBoss } from '../../primitives/visual-primitives/math/countingBoard.boss';
import { numberSequencerLiveDomain } from './adapters/numberSequencerLive';
import { numberBondLiveDomain } from './adapters/numberBondLive';
import { ordinalLineBoss } from '../../primitives/visual-primitives/math/ordinalLine.boss';
import { compareObjectsBoss } from '../../primitives/visual-primitives/math/compareObjects.boss';
import { sortingStationBoss } from '../../primitives/visual-primitives/math/sortingStation.boss';
import { phonemeExplorerBoss } from '../../primitives/visual-primitives/literacy/phonemeExplorer.boss';
import { wordSorterBoss } from '../../primitives/visual-primitives/literacy/wordSorter.boss';
import { storyRibbonBoss } from '../../primitives/visual-primitives/literacy/storyRibbon.boss';
import { oralSentenceStudioBoss } from '../../primitives/visual-primitives/literacy/oralSentenceStudio.boss';
import { youAndMeBoss } from '../../primitives/visual-primitives/literacy/youAndMe.boss';
import { numberTracerLiveDomain } from './adapters/numberTracerLive';
import { shapeTracerLiveDomain } from './adapters/shapeTracerLive';
import { comparisonBuilderBoss } from '../../primitives/visual-primitives/math/comparisonBuilder.boss';
import { coinCounterBoss } from '../../primitives/visual-primitives/math/coinCounter.boss';
import { barModelBoss } from '../../primitives/visual-primitives/math/barModel.boss';
import { lengthLabBoss } from '../../primitives/visual-primitives/math/lengthLab.boss';
import { analogClockBoss } from '../../primitives/visual-primitives/math/analogClock.boss';
import { functionMachineLiveDomain } from './adapters/functionMachineLive';
import { regroupingWorkbenchLiveDomain } from './adapters/regroupingWorkbenchLive';
import { measureLabLiveDomain } from './adapters/measureLabLive';
import { measurementToolsLiveDomain } from './adapters/measurementToolsLive';
import { areaModelLiveDomain } from './adapters/areaModelLive';
import { percentBarLiveDomain } from './adapters/percentBarLive';
import { formulaLabLiveDomain } from './adapters/formulaLabLive';
import { parameterExplorerLiveDomain } from './adapters/parameterExplorerLive';
import { ratioTableLiveDomain } from './adapters/ratioTableLive';
import { matrixDisplayLiveDomain } from './adapters/matrixDisplayLive';
import { twoWayTableLiveDomain } from './adapters/twoWayTableLive';
import { histogramLiveDomain } from './adapters/histogramLive';
import { coordinateGraphLiveDomain } from './adapters/coordinateGraphLive';
import { systemsEquationsLiveDomain } from './adapters/systemsEquationsLive';
import { slopeTriangleLiveDomain } from './adapters/slopeTriangleLive';
import { functionSketchLiveDomain } from './adapters/functionSketchLive';
import { circleExplorerLiveDomain } from './adapters/circleExplorerLive';
import { distributionExplorerLiveDomain } from './adapters/distributionExplorerLive';
import { doubleNumberLineLiveDomain } from './adapters/doubleNumberLineLive';
import { factorTreeLiveDomain } from './adapters/factorTreeLive';
import { equationWorkspaceLiveDomain } from './adapters/equationWorkspaceLive';
import { practiceProblemLiveDomain } from './adapters/practiceProblemLive';
import { timeSequencerBoss } from '../../primitives/visual-primitives/math/timeSequencer.boss';
import { angleWorkshopLiveDomain } from './adapters/angleWorkshopLive';
import { transformationLabLiveDomain } from './adapters/transformationLabLive';
import { netFolderLiveDomain } from './adapters/netFolderLive';
import { arrayGridLiveDomain } from './adapters/arrayGridLive';
import { multiplicationExplorerLiveDomain } from './adapters/multiplicationExplorerLive';
import { balanceScaleLiveDomain } from './adapters/balanceScaleLive';
import { fractionCirclesLiveDomain } from './adapters/fractionCirclesLive';
import { fractionBarLiveDomain } from './adapters/fractionBarLive';
import { placeValueLiveDomain } from './adapters/placeValueLive';
import { baseTenBlocksLiveDomain } from './adapters/baseTenBlocksLive';
import { shapeSorterBoss, validateShapeSorterData } from '../../primitives/visual-primitives/math/shapeSorter.boss';
import { diLetterSoundsBoss } from '../../primitives/visual-primitives/direct-instruction/diLetterSounds.boss';
import { diWordReadingBoss } from '../../primitives/visual-primitives/direct-instruction/diWordReading.boss';
import { diMathFactsBoss } from '../../primitives/visual-primitives/direct-instruction/diMathFacts.boss';
import { diSentenceReadingBoss } from '../../primitives/visual-primitives/direct-instruction/diSentenceReading.boss';
import { letterSoundLinkBoss } from '../../primitives/visual-primitives/literacy/letterSoundLink.boss';
import { phonicsBlenderBoss } from '../../primitives/visual-primitives/literacy/phonicsBlender.boss';
import { adaptationInvestigatorLiveDomain } from './adapters/adaptationInvestigatorLive';
import { curatorBriefLiveDomain } from './adapters/curatorBriefLive';
import { wordFlipBoss } from '../../primitives/visual-primitives/literacy/wordFlip.boss';
import { soundSwapBoss } from '../../primitives/visual-primitives/literacy/soundSwap.boss';
import { spellingPatternExplorerLiveDomain } from './adapters/spellingPatternExplorerLive';
import { cvcSpellerBoss } from '../../primitives/visual-primitives/literacy/cvcSpeller.boss';
import { syllableClapperLiveDomain } from './adapters/syllableClapperLive';
import { rhymeStudioBoss } from '../../primitives/visual-primitives/literacy/rhymeStudio.boss';
import { wordWorkoutBoss } from '../../primitives/visual-primitives/literacy/wordWorkout.boss';
import { wordBuilderLiveDomain } from './adapters/wordBuilderLive';
import { pictureVocabularyBoss } from '../../primitives/visual-primitives/literacy/pictureVocabulary.boss';
import { letterSpotterBoss } from '../../primitives/visual-primitives/literacy/letterSpotter.boss';
import { letterWorkshopLiveDomain } from './adapters/letterWorkshopLive';
import { decodableReaderBoss } from '../../primitives/visual-primitives/literacy/decodableReader.boss';
import { interactiveBookBoss } from '../../primitives/visual-primitives/literacy/interactiveBook.boss';
import { storyBridgeBoss } from '../../primitives/visual-primitives/literacy/storyBridge.boss';
import { storyMapLiveDomain } from './adapters/storyMapLive';
import { poetryLabLiveDomain } from './adapters/poetryLabLive';
import { additionSubtractionSceneLiveDomain } from './adapters/additionSubtractionSceneLive';
import { threeDShapeExplorerBoss } from '../../primitives/visual-primitives/math/threeDShapeExplorer.boss';
import { calendarExplorerBoss } from '../../primitives/visual-primitives/calendar/calendarExplorer.boss';
import { timelineBuilderLiveDomain } from './adapters/timelineBuilderLive';
import { fastFactBoss } from '../../primitives/visual-primitives/core/fastFact.boss';
import { factFileBoss } from '../../primitives/visual-primitives/core/factFile.boss';
import { pushPullArenaBoss } from '../../primitives/visual-primitives/physics/pushPullArena.boss';
import { raceTrackLabBoss } from '../../primitives/visual-primitives/physics/raceTrackLab.boss';
import { habitatDioramaBoss } from '../../primitives/visual-primitives/biology/habitatDiorama.boss';
import { ecosystemDioramaLiveDomain } from './adapters/ecosystemDioramaLive';
import { foodWebBuilderLiveDomain } from './adapters/foodWebBuilderLive';
import { lifeCycleSequencerLiveDomain } from './adapters/lifeCycleSequencerLive';
import { classificationSorterBoss } from '../../primitives/visual-primitives/biology/classificationSorter.boss';
import { cellBuilderBoss } from '../../primitives/visual-primitives/biology/cellBuilder.boss';
import { towerStackerLiveDomain } from './adapters/towerStackerLive';
import { gearTrainBuilderLiveDomain } from './adapters/gearTrainBuilderLive';
import { matterExplorerBoss } from '../../primitives/visual-primitives/chemistry/matterExplorer.boss';
import { statesOfMatterBoss } from '../../primitives/visual-primitives/chemistry/statesOfMatter.boss';
import { moleculeConstructorLiveDomain } from './adapters/moleculeConstructorLive';
import { atomBuilderLiveDomain } from './adapters/atomBuilderLive';
import { mixingAndDissolvingBoss } from '../../primitives/visual-primitives/chemistry/mixingAndDissolving.boss';
import { reactionLabBoss } from '../../primitives/visual-primitives/chemistry/reactionLab.boss';
import { phExplorerBoss } from '../../primitives/visual-primitives/chemistry/phExplorer.boss';
import { genreExplorerBoss } from '../../primitives/visual-primitives/literacy/genreExplorer.boss';
import { textStructureAnalyzerBoss } from '../../primitives/visual-primitives/literacy/textStructureAnalyzer.boss';
import { contextCluesDetectiveLiveDomain } from './adapters/contextCluesDetectiveLive';
import { sentenceAnalyzerBoss } from '../../primitives/visual-primitives/literacy/sentenceAnalyzer.boss';
import { causeEffectChainBoss } from '../../primitives/visual-primitives/history/causeEffectChain.boss';
import { eraExplorerBoss } from '../../primitives/visual-primitives/history/eraExplorer.boss';
import { periodicTableBoss } from '../../primitives/periodicTable.boss';
import { knowledgeCheckLiveDomain } from './adapters/knowledgeCheckLive';
import { readAloudStudioLiveDomain } from './adapters/readAloudStudioLive';
import { solarSystemBoss } from '../../primitives/visual-primitives/astronomy/solarSystem.boss';
import { planetaryExplorerBoss } from '../../primitives/visual-primitives/astronomy/planetaryExplorer.boss';
import { constellationBuilderBoss } from '../../primitives/visual-primitives/astronomy/constellationBuilder.boss';
import { telescopeSimulatorBoss } from '../../primitives/visual-primitives/astronomy/telescopeSimulator.boss';
import { orbitMechanicsLabBoss } from '../../primitives/visual-primitives/astronomy/orbitMechanicsLab.boss';
import { rocketBuilderBoss } from '../../primitives/visual-primitives/astronomy/rocketBuilder.boss';
import { missionPlannerBoss } from '../../primitives/visual-primitives/astronomy/missionPlanner.boss';
import { lightShadowLabBoss } from '../../primitives/visual-primitives/astronomy/lightShadowLab.boss';
import { gasLawsSimulatorBoss } from '../../primitives/visual-primitives/chemistry/gasLawsSimulator.boss';
import { equationBalancerBoss } from '../../primitives/visual-primitives/chemistry/equationBalancer.boss';
import { energyOfReactionsBoss } from '../../primitives/visual-primitives/chemistry/energyOfReactions.boss';
import { stoichiometryLabBoss } from '../../primitives/visual-primitives/chemistry/stoichiometryLab.boss';
import { gravityDropTowerBoss } from '../../primitives/visual-primitives/physics/gravityDropTower.boss';
import { soundWaveExplorerBoss } from '../../primitives/visual-primitives/physics/soundWaveExplorer.boss';
import { rampLabLiveDomain } from './adapters/rampLabLive';
import { trainYardLiveDomain } from './adapters/trainYardLive';
import { airplaneDioramaLiveDomain } from './adapters/airplaneDioramaLive';
import { constructionSiteDioramaLiveDomain } from './adapters/constructionSiteDioramaLive';
import { mapExplorerBoss } from '../../primitives/visual-primitives/history/mapExplorer.boss';
import { flightForcesExplorerBoss } from '../../primitives/visual-primitives/engineering/flightForcesExplorer.boss';
import { constructionSequencePlannerBoss } from '../../primitives/visual-primitives/engineering/constructionSequencePlanner.boss';
import { timelineExplorerBoss } from '../../primitives/visual-primitives/core/timelineExplorer.boss';
import { vocabularyExplorerBoss } from '../../primitives/visual-primitives/core/vocabularyExplorer.boss';
import { howItWorksBoss } from '../../primitives/visual-primitives/core/howItWorks.boss';
import { vehicleComparisonLabBoss } from '../../primitives/visual-primitives/engineering/vehicleComparisonLab.boss';
import { transportChallengeBoss } from '../../primitives/visual-primitives/engineering/transportChallenge.boss';
import { propulsionLabBoss } from '../../primitives/visual-primitives/engineering/propulsionLab.boss';
import { digitalSkillsSimLiveDomain } from './adapters/digitalSkillsSimLive';
import { openBuilderLiveDomain } from './adapters/openBuilderLive';
import { shapeBuilderLiveDomain } from './adapters/shapeBuilderLive';
import { shapeComposerLiveDomain } from './adapters/shapeComposerLive';
import { diShapesBoss } from '../../primitives/visual-primitives/direct-instruction/diShapes.boss';
import { diSpokenPracticeBoss } from '../../primitives/visual-primitives/direct-instruction/diSpokenPractice.boss';
import { diDiceRollBoss } from '../../primitives/visual-primitives/direct-instruction/diDiceRoll.boss';
import { diDeductionBoss } from '../../primitives/visual-primitives/direct-instruction/diDeduction.boss';
import { diWorkedProcedureBoss } from '../../primitives/visual-primitives/direct-instruction/diWorkedProcedure.boss';
import { diWordProblemSetupBoss } from '../../primitives/visual-primitives/direct-instruction/diWordProblemSetup.boss';
import { spatialSceneBoss } from '../../primitives/visual-primitives/math/spatialScene.boss';
import { spatialPathBoss } from '../../primitives/visual-primitives/math/spatialPath.boss';
import { hundredsChartBoss } from '../../primitives/visual-primitives/math/hundredsChart.boss';
import { skipCountingBoss } from '../../primitives/visual-primitives/math/skipCounting.boss';
import { mathFactFluencyBoss } from '../../primitives/visual-primitives/math/mathFactFluency.boss';
import { additionFactStrategiesBoss } from '../../primitives/visual-primitives/math/additionFactStrategies.boss';
import { equationBuilderLiveDomain } from './adapters/equationBuilderLive';
import { paragraphArchitectLiveDomain } from './adapters/paragraphArchitectLive';
import { sentenceBuilderLiveDomain } from './adapters/sentenceBuilderLive';
import { revisionWorkshopLiveDomain } from './adapters/revisionWorkshopLive';
import { figurativeLanguageFinderLiveDomain } from './adapters/figurativeLanguageFinderLive';
import { evidenceFinderLiveDomain } from './adapters/evidenceFinderLive';
import { storyPlannerLiveDomain } from './adapters/storyPlannerLive';
import { opinionBuilderLiveDomain } from './adapters/opinionBuilderLive';
import { patternBuilderLiveDomain } from './adapters/patternBuilderLive';
import { strategyPickerLiveDomain } from './adapters/strategyPickerLive';
import { polygonAreaBuilderLiveDomain } from './adapters/polygonAreaBuilderLive';
import { bossAdapter, workspaceAdapter, type LiveActivityAdapter } from './adapters/adapterContract';

export type { LiveActivityAdapter } from './adapters/adapterContract';
// Re-exported for `activityContract.test.ts`; everything else reads `LIVE_ADAPTERS[id]`.
export { validateActivityData, initialActivityState, validateTenFrameData, validateShapeSorterData };

/**
 * Adopted families. Order is the picker's order.
 *
 * `satisfies` rather than an annotation, so `LivePrimitiveId` stays the literal
 * union of the keys and a missed registration is a type error at every consumer.
 */
export const LIVE_ADAPTERS = {
  'number-line': workspaceAdapter('number-line', numberLineLiveDomain),
  'ten-frame': workspaceAdapter('ten-frame', tenFrameLiveDomain),
  'counting-board': bossAdapter(countingBoardBoss),
  'number-sequencer': workspaceAdapter('number-sequencer', numberSequencerLiveDomain),
  'number-bond': workspaceAdapter('number-bond', numberBondLiveDomain),
  'ordinal-line': bossAdapter(ordinalLineBoss),
  'sorting-station': bossAdapter(sortingStationBoss),
  'number-tracer': workspaceAdapter('number-tracer', numberTracerLiveDomain),
  'shape-tracer': workspaceAdapter('shape-tracer', shapeTracerLiveDomain),
  'comparison-builder': bossAdapter(comparisonBuilderBoss),
  'coin-counter': bossAdapter(coinCounterBoss),
  'function-machine': workspaceAdapter('function-machine', functionMachineLiveDomain),
  'regrouping-workbench': workspaceAdapter('regrouping-workbench', regroupingWorkbenchLiveDomain),
  'measure-lab': workspaceAdapter('measure-lab', measureLabLiveDomain),
  'measurement-tools': workspaceAdapter('measurement-tools', measurementToolsLiveDomain),
  'area-model': workspaceAdapter('area-model', areaModelLiveDomain),
  'percent-bar': workspaceAdapter('percent-bar', percentBarLiveDomain),
  'formula-lab': workspaceAdapter('formula-lab', formulaLabLiveDomain),
  'parameter-explorer': workspaceAdapter('parameter-explorer', parameterExplorerLiveDomain),
  'ratio-table': workspaceAdapter('ratio-table', ratioTableLiveDomain),
  'matrix-display': workspaceAdapter('matrix-display', matrixDisplayLiveDomain),
  'two-way-table': workspaceAdapter('two-way-table', twoWayTableLiveDomain),
  'histogram': workspaceAdapter('histogram', histogramLiveDomain),
  'coordinate-graph': workspaceAdapter('coordinate-graph', coordinateGraphLiveDomain),
  'systems-equations-visualizer': workspaceAdapter('systems-equations-visualizer', systemsEquationsLiveDomain),
  'slope-triangle': workspaceAdapter('slope-triangle', slopeTriangleLiveDomain),
  'function-sketch': workspaceAdapter('function-sketch', functionSketchLiveDomain),
  'circle-explorer': workspaceAdapter('circle-explorer', circleExplorerLiveDomain),
  'distribution-explorer': workspaceAdapter('distribution-explorer', distributionExplorerLiveDomain),
  'double-number-line': workspaceAdapter('double-number-line', doubleNumberLineLiveDomain),
  'factor-tree': workspaceAdapter('factor-tree', factorTreeLiveDomain),
  'equation-workspace': workspaceAdapter('equation-workspace', equationWorkspaceLiveDomain),
  'practice-problem': workspaceAdapter('practice-problem', practiceProblemLiveDomain),
  'length-lab': bossAdapter(lengthLabBoss),
  'analog-clock': bossAdapter(analogClockBoss),
  'time-sequencer': bossAdapter(timeSequencerBoss),
  'angle-workshop': workspaceAdapter('angle-workshop', angleWorkshopLiveDomain),
  'transformation-lab': workspaceAdapter('transformation-lab', transformationLabLiveDomain),
  'net-folder': workspaceAdapter('net-folder', netFolderLiveDomain),
  'array-grid': workspaceAdapter('array-grid', arrayGridLiveDomain),
  'multiplication-explorer': workspaceAdapter('multiplication-explorer', multiplicationExplorerLiveDomain),
  'compare-objects': bossAdapter(compareObjectsBoss),
  'balance-scale': workspaceAdapter('balance-scale', balanceScaleLiveDomain),
  'fraction-circles': workspaceAdapter('fraction-circles', fractionCirclesLiveDomain),
  'fraction-bar': workspaceAdapter('fraction-bar', fractionBarLiveDomain),
  'place-value-chart': workspaceAdapter('place-value-chart', placeValueLiveDomain),
  'base-ten-blocks': workspaceAdapter('base-ten-blocks', baseTenBlocksLiveDomain),
  'shape-sorter': bossAdapter(shapeSorterBoss),
  'di-letter-sounds': bossAdapter(diLetterSoundsBoss),
  'di-word-reading': bossAdapter(diWordReadingBoss),
  'di-math-facts': bossAdapter(diMathFactsBoss),
  'di-sentence-reading': bossAdapter(diSentenceReadingBoss),
  'letter-sound-link': bossAdapter(letterSoundLinkBoss),
  'bar-model': bossAdapter(barModelBoss),
  'phonics-blender': bossAdapter(phonicsBlenderBoss),
  'adaptation-investigator': workspaceAdapter('adaptation-investigator', adaptationInvestigatorLiveDomain),
  'curator-brief': workspaceAdapter('curator-brief', curatorBriefLiveDomain),
  'word-flip': bossAdapter(wordFlipBoss),
  'sound-swap': bossAdapter(soundSwapBoss),
  'cvc-speller': bossAdapter(cvcSpellerBoss),
  'spelling-pattern-explorer': workspaceAdapter('spelling-pattern-explorer', spellingPatternExplorerLiveDomain),
  'syllable-clapper': workspaceAdapter('syllable-clapper', syllableClapperLiveDomain),
  'rhyme-studio': bossAdapter(rhymeStudioBoss),
  'phoneme-explorer': bossAdapter(phonemeExplorerBoss),
  'word-workout': bossAdapter(wordWorkoutBoss),
  'word-builder': workspaceAdapter('word-builder', wordBuilderLiveDomain),
  'word-sorter': bossAdapter(wordSorterBoss),
  'picture-vocabulary': bossAdapter(pictureVocabularyBoss),
  'letter-spotter': bossAdapter(letterSpotterBoss),
  'letter-workshop': workspaceAdapter('letter-workshop', letterWorkshopLiveDomain),
  'decodable-reader': bossAdapter(decodableReaderBoss),
  'interactive-book': bossAdapter(interactiveBookBoss),
  'story-bridge': bossAdapter(storyBridgeBoss),
  'story-ribbon': bossAdapter(storyRibbonBoss),
  'story-map': workspaceAdapter('story-map', storyMapLiveDomain),
  'poetry-lab': workspaceAdapter('poetry-lab', poetryLabLiveDomain),
  'addition-subtraction-scene': workspaceAdapter('addition-subtraction-scene', additionSubtractionSceneLiveDomain),
  '3d-shape-explorer': bossAdapter(threeDShapeExplorerBoss),
  'calendar-explorer': bossAdapter(calendarExplorerBoss),
  'timeline-builder': workspaceAdapter('timeline-builder', timelineBuilderLiveDomain),
  'fast-fact': bossAdapter(fastFactBoss),
  'fact-file': bossAdapter(factFileBoss),
  'push-pull-arena': bossAdapter(pushPullArenaBoss),
  'race-track-lab': bossAdapter(raceTrackLabBoss),
  'habitat-diorama': bossAdapter(habitatDioramaBoss),
  'ecosystem-diorama': workspaceAdapter('ecosystem-diorama', ecosystemDioramaLiveDomain),
  'food-web-builder': workspaceAdapter('food-web-builder', foodWebBuilderLiveDomain),
  'life-cycle-sequencer': workspaceAdapter('life-cycle-sequencer', lifeCycleSequencerLiveDomain),
  'classification-sorter': bossAdapter(classificationSorterBoss),
  'cell-builder': bossAdapter(cellBuilderBoss),
  'tower-stacker': workspaceAdapter('tower-stacker', towerStackerLiveDomain),
  'gear-train-builder': workspaceAdapter('gear-train-builder', gearTrainBuilderLiveDomain),
  'matter-explorer': bossAdapter(matterExplorerBoss),
  'molecule-constructor': workspaceAdapter('molecule-constructor', moleculeConstructorLiveDomain),
  'atom-builder': workspaceAdapter('atom-builder', atomBuilderLiveDomain),
  'mixing-and-dissolving': bossAdapter(mixingAndDissolvingBoss),
  'reaction-lab': bossAdapter(reactionLabBoss),
  'genre-explorer': bossAdapter(genreExplorerBoss),
  'text-structure-analyzer': bossAdapter(textStructureAnalyzerBoss),
  'context-clues-detective': workspaceAdapter('context-clues-detective', contextCluesDetectiveLiveDomain),
  'sentence-analyzer': bossAdapter(sentenceAnalyzerBoss),
  'cause-effect-chain': bossAdapter(causeEffectChainBoss),
  'era-explorer': bossAdapter(eraExplorerBoss),
  'periodic-table': bossAdapter(periodicTableBoss),
  'knowledge-check': workspaceAdapter('knowledge-check', knowledgeCheckLiveDomain),
  'read-aloud-studio': workspaceAdapter('read-aloud-studio', readAloudStudioLiveDomain),
  'oral-sentence-studio': bossAdapter(oralSentenceStudioBoss),
  'states-of-matter': bossAdapter(statesOfMatterBoss),
  'solar-system-explorer': bossAdapter(solarSystemBoss),
  'light-shadow-lab': bossAdapter(lightShadowLabBoss),
  'planetary-explorer': bossAdapter(planetaryExplorerBoss),
  'constellation-builder': bossAdapter(constellationBuilderBoss),
  'telescope-simulator': bossAdapter(telescopeSimulatorBoss),
  'orbit-mechanics-lab': bossAdapter(orbitMechanicsLabBoss),
  'rocket-builder': bossAdapter(rocketBuilderBoss),
  'mission-planner': bossAdapter(missionPlannerBoss),
  'ph-explorer': bossAdapter(phExplorerBoss),
  'gas-laws-simulator': bossAdapter(gasLawsSimulatorBoss),
  'equation-balancer': bossAdapter(equationBalancerBoss),
  'energy-of-reactions': bossAdapter(energyOfReactionsBoss),
  'stoichiometry-lab': bossAdapter(stoichiometryLabBoss),
  'gravity-drop-tower': bossAdapter(gravityDropTowerBoss),
  'sound-wave-explorer': bossAdapter(soundWaveExplorerBoss),
  'you-and-me': bossAdapter(youAndMeBoss),
  'ramp-lab': workspaceAdapter('ramp-lab', rampLabLiveDomain),
  'train-yard': workspaceAdapter('train-yard', trainYardLiveDomain),
  'airplane-diorama': workspaceAdapter('airplane-diorama', airplaneDioramaLiveDomain),
  'construction-site-diorama': workspaceAdapter('construction-site-diorama', constructionSiteDioramaLiveDomain),
  'map-explorer': bossAdapter(mapExplorerBoss),
  'flight-forces-explorer': bossAdapter(flightForcesExplorerBoss),
  'construction-sequence-planner': bossAdapter(constructionSequencePlannerBoss),
  'timeline-explorer': bossAdapter(timelineExplorerBoss),
  'vocabulary-explorer': bossAdapter(vocabularyExplorerBoss),
  'how-it-works': bossAdapter(howItWorksBoss),
  'vehicle-comparison-lab': bossAdapter(vehicleComparisonLabBoss),
  'transport-challenge': bossAdapter(transportChallengeBoss),
  'propulsion-lab': bossAdapter(propulsionLabBoss),
  'digital-skills-sim': workspaceAdapter('digital-skills-sim', digitalSkillsSimLiveDomain),
  'open-builder': workspaceAdapter('open-builder', openBuilderLiveDomain),
  'shape-builder': workspaceAdapter('shape-builder', shapeBuilderLiveDomain),
  'shape-composer': workspaceAdapter('shape-composer', shapeComposerLiveDomain),
  'di-shapes': bossAdapter(diShapesBoss),
  'di-spoken-practice': bossAdapter(diSpokenPracticeBoss),
  'di-dice-roll': bossAdapter(diDiceRollBoss),
  'di-deduction': bossAdapter(diDeductionBoss),
  'di-worked-procedure': bossAdapter(diWorkedProcedureBoss),
  'di-word-problem-setup': bossAdapter(diWordProblemSetupBoss),
  'spatial-scene': bossAdapter(spatialSceneBoss),
  'spatial-path': bossAdapter(spatialPathBoss),
  'hundreds-chart': bossAdapter(hundredsChartBoss),
  'skip-counting-runner': bossAdapter(skipCountingBoss),
  'math-fact-fluency': bossAdapter(mathFactFluencyBoss),
  'addition-fact-strategies': bossAdapter(additionFactStrategiesBoss),
  'equation-builder': workspaceAdapter('equation-builder', equationBuilderLiveDomain),
  'pattern-builder': workspaceAdapter('pattern-builder', patternBuilderLiveDomain),
  'strategy-picker': workspaceAdapter('strategy-picker', strategyPickerLiveDomain),
  'polygon-area-builder': workspaceAdapter('polygon-area-builder', polygonAreaBuilderLiveDomain),
  'paragraph-architect': workspaceAdapter('paragraph-architect', paragraphArchitectLiveDomain),
  'sentence-builder': workspaceAdapter('sentence-builder', sentenceBuilderLiveDomain),
  'opinion-builder': workspaceAdapter('opinion-builder', opinionBuilderLiveDomain),
  'revision-workshop': workspaceAdapter('revision-workshop', revisionWorkshopLiveDomain),
  'figurative-language-finder': workspaceAdapter('figurative-language-finder', figurativeLanguageFinderLiveDomain),
  'evidence-finder': workspaceAdapter('evidence-finder', evidenceFinderLiveDomain),
  'story-planner': workspaceAdapter('story-planner', storyPlannerLiveDomain),
} satisfies Record<string, LiveActivityAdapter<any>>;

export type LivePrimitiveId = keyof typeof LIVE_ADAPTERS;
/** Derived, so a new adapter widens it without an edit here. */
export type LiveActivityData = ReturnType<(typeof LIVE_ADAPTERS)[LivePrimitiveId]['validate']>;

export const LIVE_PRIMITIVE_IDS = Object.keys(LIVE_ADAPTERS) as LivePrimitiveId[];

export interface ActivityRequest {
  primitiveId: LivePrimitiveId;
  topic: string;
  intent: string;
  mode: string;
}

export interface MountedActivity {
  callId: string;
  instanceId: string;
  request: Pick<ActivityRequest, 'primitiveId'> & Partial<ActivityRequest>;
  data: LiveActivityData;
  /** Set when the activity came from a prepared lesson plan rather than a generation request. */
  planItemId?: string;
  /** Preserve the resolved plan mode, including blends. */
  resolvedEvalMode?: string;
}

export const isLivePrimitive = (id: string): id is LivePrimitiveId => Object.hasOwn(LIVE_ADAPTERS, id);

export function parseActivityRequest(value: unknown): ActivityRequest {
  const v = value as Record<string, unknown> | null;
  const id = v?.primitiveId as string;
  if (!v || typeof id !== 'string' || !isLivePrimitive(id) || !LIVE_ADAPTERS[id].modes.includes(v.mode as string)
      || ['topic', 'intent'].some(k => typeof v[k] !== 'string' || !(v[k] as string).trim()
        || (v[k] as string).length > 1000)) throw new Error('Unsupported activity request');
  return { primitiveId: id, topic: (v.topic as string).trim(),
    intent: (v.intent as string).trim(), mode: v.mode as string };
}

/** The grade gate, per family. Returns the refusal sentence, or null when allowed. */
export function gradeRefusal(primitiveId: LivePrimitiveId, gradeLevel: string): string | null {
  const adapter = LIVE_ADAPTERS[primitiveId];
  return adapter.grades.includes(gradeLevel)
    ? null
    : `The ${primitiveId} lesson supports ${adapter.grades[0]} through ${adapter.grades[adapter.grades.length - 1]}.`;
}

export function validateGeneratedActivity(primitiveId: LivePrimitiveId, value: unknown) {
  return LIVE_ADAPTERS[primitiveId].validate(value);
}

export function generatedActivityState(primitiveId: LivePrimitiveId, data: LiveActivityData) {
  // The id and the data are paired by `validateGeneratedActivity`; TypeScript cannot
  // carry that pairing across the registry, so the widened adapter is the cast site.
  return (LIVE_ADAPTERS[primitiveId] as LiveActivityAdapter).initialState(data);
}
