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
import { numberLineBoss, validateNumberLineData } from '../../primitives/visual-primitives/math/numberLine.boss';
import { tenFrameBoss, validateTenFrameData } from '../../primitives/visual-primitives/math/tenFrame.boss';
import { countingBoardBoss } from '../../primitives/visual-primitives/math/countingBoard.boss';
import { numberSequencerLiveDomain } from './adapters/numberSequencerLive';
import { numberBondBoss } from '../../primitives/visual-primitives/math/numberBond.boss';
import { ordinalLineBoss } from '../../primitives/visual-primitives/math/ordinalLine.boss';
import { compareObjectsBoss } from '../../primitives/visual-primitives/math/compareObjects.boss';
import { sortingStationBoss } from '../../primitives/visual-primitives/math/sortingStation.boss';
import { phonemeExplorerBoss } from '../../primitives/visual-primitives/literacy/phonemeExplorer.boss';
import { wordSorterBoss } from '../../primitives/visual-primitives/literacy/wordSorter.boss';
import { storyRibbonBoss } from '../../primitives/visual-primitives/literacy/storyRibbon.boss';
import { oralSentenceStudioBoss } from '../../primitives/visual-primitives/literacy/oralSentenceStudio.boss';
import { youAndMeBoss } from '../../primitives/visual-primitives/literacy/youAndMe.boss';
import { numberTracerBoss } from '../../primitives/visual-primitives/math/numberTracer.boss';
import { comparisonBuilderBoss } from '../../primitives/visual-primitives/math/comparisonBuilder.boss';
import { coinCounterBoss } from '../../primitives/visual-primitives/math/coinCounter.boss';
import { barModelBoss } from '../../primitives/visual-primitives/math/barModel.boss';
import { lengthLabBoss } from '../../primitives/visual-primitives/math/lengthLab.boss';
import { analogClockBoss } from '../../primitives/visual-primitives/math/analogClock.boss';
import { functionMachineBoss } from '../../primitives/visual-primitives/math/functionMachine.boss';
import { regroupingWorkbenchBoss } from '../../primitives/visual-primitives/math/regroupingWorkbench.boss';
import { measureLabBoss } from '../../primitives/visual-primitives/math/measureLab.boss';
import { measurementToolsBoss } from '../../primitives/visual-primitives/math/measurementTools.boss';
import { areaModelBoss } from '../../primitives/visual-primitives/math/areaModel.boss';
import { percentBarBoss } from '../../primitives/visual-primitives/math/percentBar.boss';
import { formulaLabBoss } from '../../primitives/visual-primitives/math/formulaLab.boss';
import { parameterExplorerBoss } from '../../primitives/visual-primitives/math/parameterExplorer.boss';
import { ratioTableBoss } from '../../primitives/visual-primitives/math/ratioTable.boss';
import { matrixDisplayBoss } from '../../primitives/visual-primitives/math/matrixDisplay.boss';
import { twoWayTableBoss } from '../../primitives/visual-primitives/math/twoWayTable.boss';
import { equationBuilderBoss } from '../../primitives/visual-primitives/math/equationBuilder.boss';
import { factorTreeBoss } from '../../primitives/visual-primitives/math/factorTree.boss';
import { circleExplorerBoss } from '../../primitives/visual-primitives/math/circleExplorer.boss';
import { histogramBoss } from '../../primitives/visual-primitives/math/histogram.boss';
import { coordinateGraphBoss } from '../../primitives/visual-primitives/math/coordinateGraph.boss';
import { systemsEquationsBoss } from '../../primitives/visual-primitives/math/systemsEquations.boss';
import { slopeTriangleBoss } from '../../primitives/visual-primitives/math/slopeTriangle.boss';
import { functionSketchBoss } from '../../primitives/visual-primitives/math/functionSketch.boss';
import { distributionExplorerBoss } from '../../primitives/distribution-explorer/distributionExplorer.boss';
import { doubleNumberLineBoss } from '../../primitives/visual-primitives/math/doubleNumberLine.boss';
import { equationWorkspaceBoss } from '../../primitives/visual-primitives/math/equationWorkspace.boss';
import { practiceProblemBoss } from '../../primitives/visual-primitives/math/practiceProblem.boss';
import { timeSequencerBoss } from '../../primitives/visual-primitives/math/timeSequencer.boss';
import { angleWorkshopBoss } from '../../primitives/visual-primitives/math/angleWorkshop.boss';
import { transformationLabBoss } from '../../primitives/visual-primitives/math/transformationLab.boss';
import { netFolderBoss } from '../../primitives/visual-primitives/math/netFolder.boss';
import { arrayGridBoss } from '../../primitives/visual-primitives/math/arrayGrid.boss';
import { multiplicationExplorerBoss } from '../../primitives/visual-primitives/math/multiplicationExplorer.boss';
import { fractionCirclesBoss } from '../../primitives/visual-primitives/math/fractionCircles.boss';
import { fractionBarBoss } from '../../primitives/visual-primitives/math/fractionBar.boss';
import { placeValueChartBoss } from '../../primitives/visual-primitives/math/placeValueChart.boss';
import { baseTenBlocksBoss } from '../../primitives/visual-primitives/math/baseTenBlocks.boss';
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
import { spellingPatternExplorerBoss } from '../../primitives/visual-primitives/literacy/spellingPatternExplorer.boss';
import { cvcSpellerBoss } from '../../primitives/visual-primitives/literacy/cvcSpeller.boss';
import { syllableClapperBoss } from '../../primitives/visual-primitives/literacy/syllableClapper.boss';
import { rhymeStudioBoss } from '../../primitives/visual-primitives/literacy/rhymeStudio.boss';
import { wordWorkoutBoss } from '../../primitives/visual-primitives/literacy/wordWorkout.boss';
import { wordBuilderLiveDomain } from './adapters/wordBuilderLive';
import { pictureVocabularyBoss } from '../../primitives/visual-primitives/literacy/pictureVocabulary.boss';
import { letterSpotterBoss } from '../../primitives/visual-primitives/literacy/letterSpotter.boss';
import { letterWorkshopBoss } from '../../primitives/visual-primitives/literacy/letterWorkshop.boss';
import { decodableReaderBoss } from '../../primitives/visual-primitives/literacy/decodableReader.boss';
import { interactiveBookBoss } from '../../primitives/visual-primitives/literacy/interactiveBook.boss';
import { storyBridgeBoss } from '../../primitives/visual-primitives/literacy/storyBridge.boss';
import { storyMapBoss } from '../../primitives/visual-primitives/literacy/storyMap.boss';
import { poetryLabBoss } from '../../primitives/visual-primitives/literacy/poetryLab.boss';
import { additionSubtractionSceneBoss } from '../../primitives/visual-primitives/math/additionSubtractionScene.boss';
import { threeDShapeExplorerBoss } from '../../primitives/visual-primitives/math/threeDShapeExplorer.boss';
import { calendarExplorerBoss } from '../../primitives/visual-primitives/calendar/calendarExplorer.boss';
import { fastFactBoss } from '../../primitives/visual-primitives/core/fastFact.boss';
import { factFileBoss } from '../../primitives/visual-primitives/core/factFile.boss';
import { pushPullArenaBoss } from '../../primitives/visual-primitives/physics/pushPullArena.boss';
import { raceTrackLabBoss } from '../../primitives/visual-primitives/physics/raceTrackLab.boss';
import { habitatDioramaBoss } from '../../primitives/visual-primitives/biology/habitatDiorama.boss';
import { ecosystemDioramaBoss } from '../../primitives/visual-primitives/biology/ecosystemDiorama.boss';
import { foodWebBuilderBoss } from '../../primitives/visual-primitives/biology/foodWebBuilder.boss';
import { lifeCycleSequencerBoss } from '../../primitives/visual-primitives/biology/lifeCycleSequencer.boss';
import { classificationSorterBoss } from '../../primitives/visual-primitives/biology/classificationSorter.boss';
import { cellBuilderBoss } from '../../primitives/visual-primitives/biology/cellBuilder.boss';
import { towerStackerBoss } from '../../primitives/visual-primitives/engineering/towerStacker.boss';
import { gearTrainBuilderBoss } from '../../primitives/visual-primitives/engineering/gearTrainBuilder.boss';
import { matterExplorerBoss } from '../../primitives/visual-primitives/chemistry/matterExplorer.boss';
import { statesOfMatterBoss } from '../../primitives/visual-primitives/chemistry/statesOfMatter.boss';
import { moleculeConstructorBoss } from '../../primitives/visual-primitives/chemistry/moleculeConstructor.boss';
import { atomBuilderBoss } from '../../primitives/visual-primitives/chemistry/atomBuilder.boss';
import { mixingAndDissolvingBoss } from '../../primitives/visual-primitives/chemistry/mixingAndDissolving.boss';
import { reactionLabBoss } from '../../primitives/visual-primitives/chemistry/reactionLab.boss';
import { phExplorerBoss } from '../../primitives/visual-primitives/chemistry/phExplorer.boss';
import { genreExplorerBoss } from '../../primitives/visual-primitives/literacy/genreExplorer.boss';
import { textStructureAnalyzerBoss } from '../../primitives/visual-primitives/literacy/textStructureAnalyzer.boss';
import { contextCluesBoss } from '../../primitives/visual-primitives/literacy/contextClues.boss';
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
import { balanceScaleBoss } from '../../primitives/visual-primitives/math/balanceScale.boss';
import { energyOfReactionsBoss } from '../../primitives/visual-primitives/chemistry/energyOfReactions.boss';
import { stoichiometryLabBoss } from '../../primitives/visual-primitives/chemistry/stoichiometryLab.boss';
import { gravityDropTowerBoss } from '../../primitives/visual-primitives/physics/gravityDropTower.boss';
import { soundWaveExplorerBoss } from '../../primitives/visual-primitives/physics/soundWaveExplorer.boss';
import { rampLabBoss } from '../../primitives/visual-primitives/engineering/rampLab.boss';
import { trainYardBoss } from '../../primitives/visual-primitives/engineering/trainYard.boss';
import { airplaneDioramaBoss } from '../../primitives/visual-primitives/engineering/airplaneDiorama.boss';
import { constructionSiteDioramaBoss } from '../../primitives/visual-primitives/engineering/constructionSiteDiorama.boss';
import { mapExplorerBoss } from '../../primitives/visual-primitives/history/mapExplorer.boss';
import { flightForcesExplorerBoss } from '../../primitives/visual-primitives/engineering/flightForcesExplorer.boss';
import { constructionSequencePlannerBoss } from '../../primitives/visual-primitives/engineering/constructionSequencePlanner.boss';
import { timelineExplorerBoss } from '../../primitives/visual-primitives/core/timelineExplorer.boss';
import { timelineBuilderBoss } from '../../primitives/visual-primitives/calendar/timelineBuilder.boss';
import { vocabularyExplorerBoss } from '../../primitives/visual-primitives/core/vocabularyExplorer.boss';
import { howItWorksBoss } from '../../primitives/visual-primitives/core/howItWorks.boss';
import { vehicleComparisonLabBoss } from '../../primitives/visual-primitives/engineering/vehicleComparisonLab.boss';
import { transportChallengeBoss } from '../../primitives/visual-primitives/engineering/transportChallenge.boss';
import { propulsionLabBoss } from '../../primitives/visual-primitives/engineering/propulsionLab.boss';
import { digitalSkillsSimBoss } from '../../primitives/visual-primitives/core/digitalSkillsSim.boss';
import { openBuilderBoss } from '../../primitives/visual-primitives/creation/openBuilder.boss';
import { shapeBuilderBoss } from '../../primitives/visual-primitives/math/shapeBuilder.boss';
import { shapeComposerBoss } from '../../primitives/visual-primitives/math/shapeComposer.boss';
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
import { shapeTracerBoss } from '../../primitives/visual-primitives/math/shapeTracer.boss';
import { paragraphArchitectBoss } from '../../primitives/visual-primitives/literacy/paragraphArchitect.boss';
import { sentenceBuilderBoss } from '../../primitives/visual-primitives/literacy/sentenceBuilder.boss';
import { opinionBuilderBoss } from '../../primitives/visual-primitives/literacy/opinionBuilder.boss';
import { revisionWorkshopBoss } from '../../primitives/visual-primitives/literacy/revisionWorkshop.boss';
import { figurativeLanguageFinderBoss } from '../../primitives/visual-primitives/literacy/figurativeLanguageFinder.boss';
import { evidenceFinderBoss } from '../../primitives/visual-primitives/literacy/evidenceFinder.boss';
import { storyPlannerBoss } from '../../primitives/visual-primitives/literacy/storyPlanner.boss';
import { patternBuilderBoss } from '../../primitives/visual-primitives/math/patternBuilder.boss';
import { strategyPickerBoss } from '../../primitives/visual-primitives/math/strategyPicker.boss';
import { polygonAreaBuilderBoss } from '../../primitives/visual-primitives/math/polygonAreaBuilder.boss';
import { bossAdapter, workspaceAdapter, type LiveActivityAdapter } from './adapters/adapterContract';

export type { LiveActivityAdapter } from './adapters/adapterContract';
// Re-exported for `activityContract.test.ts`; everything else reads `LIVE_ADAPTERS[id]`.
export { validateNumberLineData, validateTenFrameData, validateShapeSorterData };

/**
 * Adopted families. Order is the picker's order.
 *
 * `satisfies` rather than an annotation, so `LivePrimitiveId` stays the literal
 * union of the keys and a missed registration is a type error at every consumer.
 */
export const LIVE_ADAPTERS = {
  'number-line': bossAdapter(numberLineBoss),
  'ten-frame': bossAdapter(tenFrameBoss),
  'counting-board': bossAdapter(countingBoardBoss),
  'number-sequencer': workspaceAdapter('number-sequencer', numberSequencerLiveDomain),
  'number-bond': bossAdapter(numberBondBoss),
  'ordinal-line': bossAdapter(ordinalLineBoss),
  'sorting-station': bossAdapter(sortingStationBoss),
  'number-tracer': bossAdapter(numberTracerBoss),
  'shape-tracer': bossAdapter(shapeTracerBoss),
  'comparison-builder': bossAdapter(comparisonBuilderBoss),
  'coin-counter': bossAdapter(coinCounterBoss),
  'function-machine': bossAdapter(functionMachineBoss),
  'regrouping-workbench': bossAdapter(regroupingWorkbenchBoss),
  'measure-lab': bossAdapter(measureLabBoss),
  'measurement-tools': bossAdapter(measurementToolsBoss),
  'area-model': bossAdapter(areaModelBoss),
  'percent-bar': bossAdapter(percentBarBoss),
  'formula-lab': bossAdapter(formulaLabBoss),
  'parameter-explorer': bossAdapter(parameterExplorerBoss),
  'ratio-table': bossAdapter(ratioTableBoss),
  'matrix-display': bossAdapter(matrixDisplayBoss),
  'two-way-table': bossAdapter(twoWayTableBoss),
  'histogram': bossAdapter(histogramBoss),
  'coordinate-graph': bossAdapter(coordinateGraphBoss),
  'systems-equations-visualizer': bossAdapter(systemsEquationsBoss),
  'slope-triangle': bossAdapter(slopeTriangleBoss),
  'function-sketch': bossAdapter(functionSketchBoss),
  'circle-explorer': bossAdapter(circleExplorerBoss),
  'distribution-explorer': bossAdapter(distributionExplorerBoss),
  'double-number-line': bossAdapter(doubleNumberLineBoss),
  'factor-tree': bossAdapter(factorTreeBoss),
  'equation-workspace': bossAdapter(equationWorkspaceBoss),
  'practice-problem': bossAdapter(practiceProblemBoss),
  'length-lab': bossAdapter(lengthLabBoss),
  'analog-clock': bossAdapter(analogClockBoss),
  'time-sequencer': bossAdapter(timeSequencerBoss),
  'angle-workshop': bossAdapter(angleWorkshopBoss),
  'transformation-lab': bossAdapter(transformationLabBoss),
  'net-folder': bossAdapter(netFolderBoss),
  'array-grid': bossAdapter(arrayGridBoss),
  'multiplication-explorer': bossAdapter(multiplicationExplorerBoss),
  'compare-objects': bossAdapter(compareObjectsBoss),
  'balance-scale': bossAdapter(balanceScaleBoss),
  'fraction-circles': bossAdapter(fractionCirclesBoss),
  'fraction-bar': bossAdapter(fractionBarBoss),
  'place-value-chart': bossAdapter(placeValueChartBoss),
  'base-ten-blocks': bossAdapter(baseTenBlocksBoss),
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
  'spelling-pattern-explorer': bossAdapter(spellingPatternExplorerBoss),
  'syllable-clapper': bossAdapter(syllableClapperBoss),
  'rhyme-studio': bossAdapter(rhymeStudioBoss),
  'phoneme-explorer': bossAdapter(phonemeExplorerBoss),
  'word-workout': bossAdapter(wordWorkoutBoss),
  'word-builder': workspaceAdapter('word-builder', wordBuilderLiveDomain),
  'word-sorter': bossAdapter(wordSorterBoss),
  'picture-vocabulary': bossAdapter(pictureVocabularyBoss),
  'letter-spotter': bossAdapter(letterSpotterBoss),
  'letter-workshop': bossAdapter(letterWorkshopBoss),
  'decodable-reader': bossAdapter(decodableReaderBoss),
  'interactive-book': bossAdapter(interactiveBookBoss),
  'story-bridge': bossAdapter(storyBridgeBoss),
  'story-ribbon': bossAdapter(storyRibbonBoss),
  'story-map': bossAdapter(storyMapBoss),
  'poetry-lab': bossAdapter(poetryLabBoss),
  'addition-subtraction-scene': bossAdapter(additionSubtractionSceneBoss),
  '3d-shape-explorer': bossAdapter(threeDShapeExplorerBoss),
  'calendar-explorer': bossAdapter(calendarExplorerBoss),
  'timeline-builder': bossAdapter(timelineBuilderBoss),
  'fast-fact': bossAdapter(fastFactBoss),
  'fact-file': bossAdapter(factFileBoss),
  'push-pull-arena': bossAdapter(pushPullArenaBoss),
  'race-track-lab': bossAdapter(raceTrackLabBoss),
  'habitat-diorama': bossAdapter(habitatDioramaBoss),
  'ecosystem-diorama': bossAdapter(ecosystemDioramaBoss),
  'food-web-builder': bossAdapter(foodWebBuilderBoss),
  'life-cycle-sequencer': bossAdapter(lifeCycleSequencerBoss),
  'classification-sorter': bossAdapter(classificationSorterBoss),
  'cell-builder': bossAdapter(cellBuilderBoss),
  'tower-stacker': bossAdapter(towerStackerBoss),
  'gear-train-builder': bossAdapter(gearTrainBuilderBoss),
  'matter-explorer': bossAdapter(matterExplorerBoss),
  'molecule-constructor': bossAdapter(moleculeConstructorBoss),
  'atom-builder': bossAdapter(atomBuilderBoss),
  'mixing-and-dissolving': bossAdapter(mixingAndDissolvingBoss),
  'reaction-lab': bossAdapter(reactionLabBoss),
  'genre-explorer': bossAdapter(genreExplorerBoss),
  'text-structure-analyzer': bossAdapter(textStructureAnalyzerBoss),
  'context-clues-detective': bossAdapter(contextCluesBoss),
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
  'ramp-lab': bossAdapter(rampLabBoss),
  'train-yard': bossAdapter(trainYardBoss),
  'airplane-diorama': bossAdapter(airplaneDioramaBoss),
  'construction-site-diorama': bossAdapter(constructionSiteDioramaBoss),
  'map-explorer': bossAdapter(mapExplorerBoss),
  'flight-forces-explorer': bossAdapter(flightForcesExplorerBoss),
  'construction-sequence-planner': bossAdapter(constructionSequencePlannerBoss),
  'timeline-explorer': bossAdapter(timelineExplorerBoss),
  'vocabulary-explorer': bossAdapter(vocabularyExplorerBoss),
  'how-it-works': bossAdapter(howItWorksBoss),
  'vehicle-comparison-lab': bossAdapter(vehicleComparisonLabBoss),
  'transport-challenge': bossAdapter(transportChallengeBoss),
  'propulsion-lab': bossAdapter(propulsionLabBoss),
  'digital-skills-sim': bossAdapter(digitalSkillsSimBoss),
  'open-builder': bossAdapter(openBuilderBoss),
  'shape-builder': bossAdapter(shapeBuilderBoss),
  'shape-composer': bossAdapter(shapeComposerBoss),
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
  'equation-builder': bossAdapter(equationBuilderBoss),
  'pattern-builder': bossAdapter(patternBuilderBoss),
  'strategy-picker': bossAdapter(strategyPickerBoss),
  'polygon-area-builder': bossAdapter(polygonAreaBuilderBoss),
  'paragraph-architect': bossAdapter(paragraphArchitectBoss),
  'sentence-builder': bossAdapter(sentenceBuilderBoss),
  'opinion-builder': bossAdapter(opinionBuilderBoss),
  'revision-workshop': bossAdapter(revisionWorkshopBoss),
  'figurative-language-finder': bossAdapter(figurativeLanguageFinderBoss),
  'evidence-finder': bossAdapter(evidenceFinderBoss),
  'story-planner': bossAdapter(storyPlannerBoss),
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
