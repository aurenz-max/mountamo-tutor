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
import { classificationSorterBoss } from '../../primitives/visual-primitives/biology/classificationSorter.boss';
import type { Boss } from './boss';
import { diWordProblemSetupBoss } from '../../primitives/visual-primitives/direct-instruction/diWordProblemSetup.boss';
import { diShapesBoss } from '../../primitives/visual-primitives/direct-instruction/diShapes.boss';
import { diWorkedProcedureBoss } from '../../primitives/visual-primitives/direct-instruction/diWorkedProcedure.boss';
import { diDeductionBoss } from '../../primitives/visual-primitives/direct-instruction/diDeduction.boss';
import { diDiceRollBoss } from '../../primitives/visual-primitives/direct-instruction/diDiceRoll.boss';
import { diSentenceReadingBoss } from '../../primitives/visual-primitives/direct-instruction/diSentenceReading.boss';
import { diLetterSoundsBoss } from '../../primitives/visual-primitives/direct-instruction/diLetterSounds.boss';
import { diWordReadingBoss } from '../../primitives/visual-primitives/direct-instruction/diWordReading.boss';
import { cellBuilderBoss } from '../../primitives/visual-primitives/biology/cellBuilder.boss';
import { shapeSorterBoss } from '../../primitives/visual-primitives/math/shapeSorter.boss';
import { countingBoardBoss } from '../../primitives/visual-primitives/math/countingBoard.boss';
import { tenFrameBoss } from '../../primitives/visual-primitives/math/tenFrame.boss';
import { numberLineBoss } from '../../primitives/visual-primitives/math/numberLine.boss';
import { comparisonBuilderBoss } from '../../primitives/visual-primitives/math/comparisonBuilder.boss';
import { compareObjectsBoss } from '../../primitives/visual-primitives/math/compareObjects.boss';
import { adaptationInvestigatorBoss } from '../../primitives/visual-primitives/biology/adaptationInvestigator.boss';
import { curatorBriefBoss } from '../../primitives/curatorBrief.boss';
import { numberSequencerBoss } from '../../primitives/visual-primitives/math/numberSequencer.boss';
import { ordinalLineBoss } from '../../primitives/visual-primitives/math/ordinalLine.boss';
import { coinCounterBoss } from '../../primitives/visual-primitives/math/coinCounter.boss';
import { lengthLabBoss } from '../../primitives/visual-primitives/math/lengthLab.boss';
import { analogClockBoss } from '../../primitives/visual-primitives/math/analogClock.boss';
import { functionMachineBoss } from '../../primitives/visual-primitives/math/functionMachine.boss';
import { regroupingWorkbenchBoss } from '../../primitives/visual-primitives/math/regroupingWorkbench.boss';
import { percentBarBoss } from '../../primitives/visual-primitives/math/percentBar.boss';
import { netFolderBoss } from '../../primitives/visual-primitives/math/netFolder.boss';
import { formulaLabBoss } from '../../primitives/visual-primitives/math/formulaLab.boss';
import { parameterExplorerBoss } from '../../primitives/visual-primitives/math/parameterExplorer.boss';
import { equationWorkspaceBoss } from '../../primitives/visual-primitives/math/equationWorkspace.boss';
import { matrixDisplayBoss } from '../../primitives/visual-primitives/math/matrixDisplay.boss';
import { ratioTableBoss } from '../../primitives/visual-primitives/math/ratioTable.boss';
import { twoWayTableBoss } from '../../primitives/visual-primitives/math/twoWayTable.boss';
import { practiceProblemBoss } from '../../primitives/visual-primitives/math/practiceProblem.boss';
import { factorTreeBoss } from '../../primitives/visual-primitives/math/factorTree.boss';
import { circleExplorerBoss } from '../../primitives/visual-primitives/math/circleExplorer.boss';
import { systemsEquationsBoss } from '../../primitives/visual-primitives/math/systemsEquations.boss';
import { slopeTriangleBoss } from '../../primitives/visual-primitives/math/slopeTriangle.boss';
import { functionSketchBoss } from '../../primitives/visual-primitives/math/functionSketch.boss';
import { histogramBoss } from '../../primitives/visual-primitives/math/histogram.boss';
import { coordinateGraphBoss } from '../../primitives/visual-primitives/math/coordinateGraph.boss';
import { distributionExplorerBoss } from '../../primitives/distribution-explorer/distributionExplorer.boss';
import { measureLabBoss } from '../../primitives/visual-primitives/math/measureLab.boss';
import { measurementToolsBoss } from '../../primitives/visual-primitives/math/measurementTools.boss';
import { areaModelBoss } from '../../primitives/visual-primitives/math/areaModel.boss';
import { timeSequencerBoss } from '../../primitives/visual-primitives/math/timeSequencer.boss';
import { shapeComposerBoss } from '../../primitives/visual-primitives/math/shapeComposer.boss';
import { multiplicationExplorerBoss } from '../../primitives/visual-primitives/math/multiplicationExplorer.boss';
import { fastFactBoss } from '../../primitives/visual-primitives/core/fastFact.boss';
import { factFileBoss } from '../../primitives/visual-primitives/core/factFile.boss';
import { arrayGridBoss } from '../../primitives/visual-primitives/math/arrayGrid.boss';
import { polygonAreaBuilderBoss } from '../../primitives/visual-primitives/math/polygonAreaBuilder.boss';
import { paragraphArchitectBoss } from '../../primitives/visual-primitives/literacy/paragraphArchitect.boss';
import { sentenceBuilderBoss } from '../../primitives/visual-primitives/literacy/sentenceBuilder.boss';
import { revisionWorkshopBoss } from '../../primitives/visual-primitives/literacy/revisionWorkshop.boss';
import { opinionBuilderBoss } from '../../primitives/visual-primitives/literacy/opinionBuilder.boss';
import { fractionCirclesBoss } from '../../primitives/visual-primitives/math/fractionCircles.boss';
import { fractionBarBoss } from '../../primitives/visual-primitives/math/fractionBar.boss';
import { diMathFactsBoss } from '../../primitives/visual-primitives/direct-instruction/diMathFacts.boss';
import { letterSoundLinkBoss } from '../../primitives/visual-primitives/literacy/letterSoundLink.boss';
import { numberBondBoss } from '../../primitives/visual-primitives/math/numberBond.boss';
import { placeValueChartBoss } from '../../primitives/visual-primitives/math/placeValueChart.boss';
import { letterWorkshopBoss } from '../../primitives/visual-primitives/literacy/letterWorkshop.boss';
import { openBuilderBoss } from '../../primitives/visual-primitives/creation/openBuilder.boss';
import { numberTracerBoss } from '../../primitives/visual-primitives/math/numberTracer.boss';
import { shapeTracerBoss } from '../../primitives/visual-primitives/math/shapeTracer.boss';
import { shapeBuilderBoss } from '../../primitives/visual-primitives/math/shapeBuilder.boss';
import { sortingStationBoss } from '../../primitives/visual-primitives/math/sortingStation.boss';
import { phonemeExplorerBoss } from '../../primitives/visual-primitives/literacy/phonemeExplorer.boss';
import { baseTenBlocksBoss } from '../../primitives/visual-primitives/math/baseTenBlocks.boss';
import { phonicsBlenderBoss } from '../../primitives/visual-primitives/literacy/phonicsBlender.boss';
import { wordFlipBoss } from '../../primitives/visual-primitives/literacy/wordFlip.boss';
import { soundSwapBoss } from '../../primitives/visual-primitives/literacy/soundSwap.boss';
import { spellingPatternExplorerBoss } from '../../primitives/visual-primitives/literacy/spellingPatternExplorer.boss';
import { cvcSpellerBoss } from '../../primitives/visual-primitives/literacy/cvcSpeller.boss';
import { barModelBoss } from '../../primitives/visual-primitives/math/barModel.boss';
import { youAndMeBoss } from '../../primitives/visual-primitives/literacy/youAndMe.boss';
import { syllableClapperBoss } from '../../primitives/visual-primitives/literacy/syllableClapper.boss';
import { rhymeStudioBoss } from '../../primitives/visual-primitives/literacy/rhymeStudio.boss';
import { wordWorkoutBoss } from '../../primitives/visual-primitives/literacy/wordWorkout.boss';
import { wordBuilderBoss } from '../../primitives/visual-primitives/literacy/wordBuilder.boss';
import { wordSorterBoss } from '../../primitives/visual-primitives/literacy/wordSorter.boss';
import { storyRibbonBoss } from '../../primitives/visual-primitives/literacy/storyRibbon.boss';
import { oralSentenceStudioBoss } from '../../primitives/visual-primitives/literacy/oralSentenceStudio.boss';
import { pictureVocabularyBoss } from '../../primitives/visual-primitives/literacy/pictureVocabulary.boss';
import { letterSpotterBoss } from '../../primitives/visual-primitives/literacy/letterSpotter.boss';
import { decodableReaderBoss } from '../../primitives/visual-primitives/literacy/decodableReader.boss';
import { interactiveBookBoss } from '../../primitives/visual-primitives/literacy/interactiveBook.boss';
import { storyBridgeBoss } from '../../primitives/visual-primitives/literacy/storyBridge.boss';
import { storyMapBoss } from '../../primitives/visual-primitives/literacy/storyMap.boss';
import { poetryLabBoss } from '../../primitives/visual-primitives/literacy/poetryLab.boss';
import { evidenceFinderBoss } from '../../primitives/visual-primitives/literacy/evidenceFinder.boss';
import { additionSubtractionSceneBoss } from '../../primitives/visual-primitives/math/additionSubtractionScene.boss';
import { threeDShapeExplorerBoss } from '../../primitives/visual-primitives/math/threeDShapeExplorer.boss';
import { calendarExplorerBoss } from '../../primitives/visual-primitives/calendar/calendarExplorer.boss';
import { timelineBuilderBoss } from '../../primitives/visual-primitives/calendar/timelineBuilder.boss';
import { lifeCycleSequencerBoss } from '../../primitives/visual-primitives/biology/lifeCycleSequencer.boss';
import { pushPullArenaBoss } from '../../primitives/visual-primitives/physics/pushPullArena.boss';
import { habitatDioramaBoss } from '../../primitives/visual-primitives/biology/habitatDiorama.boss';
import { ecosystemDioramaBoss } from '../../primitives/visual-primitives/biology/ecosystemDiorama.boss';
import { foodWebBuilderBoss } from '../../primitives/visual-primitives/biology/foodWebBuilder.boss';
import { gearTrainBuilderBoss } from '../../primitives/visual-primitives/engineering/gearTrainBuilder.boss';
import { matterExplorerBoss } from '../../primitives/visual-primitives/chemistry/matterExplorer.boss';
import { statesOfMatterBoss } from '../../primitives/visual-primitives/chemistry/statesOfMatter.boss';
import { solarSystemBoss } from '../../primitives/visual-primitives/astronomy/solarSystem.boss';
import { moleculeConstructorBoss } from '../../primitives/visual-primitives/chemistry/moleculeConstructor.boss';
import { atomBuilderBoss } from '../../primitives/visual-primitives/chemistry/atomBuilder.boss';
import { genreExplorerBoss } from '../../primitives/visual-primitives/literacy/genreExplorer.boss';
import { textStructureAnalyzerBoss } from '../../primitives/visual-primitives/literacy/textStructureAnalyzer.boss';
import { sentenceAnalyzerBoss } from '../../primitives/visual-primitives/literacy/sentenceAnalyzer.boss';
import { readAloudStudioBoss } from '../../primitives/visual-primitives/literacy/readAloudStudio.boss';
import { causeEffectChainBoss } from '../../primitives/visual-primitives/history/causeEffectChain.boss';
import { eraExplorerBoss } from '../../primitives/visual-primitives/history/eraExplorer.boss';
import { periodicTableBoss } from '../../primitives/periodicTable.boss';
import { knowledgeCheckBoss } from '../../primitives/knowledgeCheck.boss';
import { planetaryExplorerBoss } from '../../primitives/visual-primitives/astronomy/planetaryExplorer.boss';
import { telescopeSimulatorBoss } from '../../primitives/visual-primitives/astronomy/telescopeSimulator.boss';
import { orbitMechanicsLabBoss } from '../../primitives/visual-primitives/astronomy/orbitMechanicsLab.boss';
import { rocketBuilderBoss } from '../../primitives/visual-primitives/astronomy/rocketBuilder.boss';
import { missionPlannerBoss } from '../../primitives/visual-primitives/astronomy/missionPlanner.boss';
import { lightShadowLabBoss } from '../../primitives/visual-primitives/astronomy/lightShadowLab.boss';
import { reactionLabBoss } from '../../primitives/visual-primitives/chemistry/reactionLab.boss';
import { phExplorerBoss } from '../../primitives/visual-primitives/chemistry/phExplorer.boss';
import { stoichiometryLabBoss } from '../../primitives/visual-primitives/chemistry/stoichiometryLab.boss';
import { gasLawsSimulatorBoss } from '../../primitives/visual-primitives/chemistry/gasLawsSimulator.boss';
import { towerStackerBoss } from '../../primitives/visual-primitives/engineering/towerStacker.boss';
import { gravityDropTowerBoss } from '../../primitives/visual-primitives/physics/gravityDropTower.boss';
import { soundWaveExplorerBoss } from '../../primitives/visual-primitives/physics/soundWaveExplorer.boss';
import { vehicleComparisonLabBoss } from '../../primitives/visual-primitives/engineering/vehicleComparisonLab.boss';
import { raceTrackLabBoss } from '../../primitives/visual-primitives/physics/raceTrackLab.boss';
import { equationBalancerBoss } from '../../primitives/visual-primitives/chemistry/equationBalancer.boss';
import { balanceScaleBoss } from '../../primitives/visual-primitives/math/balanceScale.boss';
import { energyOfReactionsBoss } from '../../primitives/visual-primitives/chemistry/energyOfReactions.boss';
import { mixingAndDissolvingBoss } from '../../primitives/visual-primitives/chemistry/mixingAndDissolving.boss';
import { constellationBuilderBoss } from '../../primitives/visual-primitives/astronomy/constellationBuilder.boss';
import { rampLabBoss } from '../../primitives/visual-primitives/engineering/rampLab.boss';
import { diSpokenPracticeBoss } from '../../primitives/visual-primitives/direct-instruction/diSpokenPractice.boss';
import { spatialSceneBoss } from '../../primitives/visual-primitives/math/spatialScene.boss';
import { spatialPathBoss } from '../../primitives/visual-primitives/math/spatialPath.boss';
import { hundredsChartBoss } from '../../primitives/visual-primitives/math/hundredsChart.boss';
import { skipCountingBoss } from '../../primitives/visual-primitives/math/skipCounting.boss';
import { mathFactFluencyBoss } from '../../primitives/visual-primitives/math/mathFactFluency.boss';
import { additionFactStrategiesBoss } from '../../primitives/visual-primitives/math/additionFactStrategies.boss';
import { equationBuilderBoss } from '../../primitives/visual-primitives/math/equationBuilder.boss';
import { patternBuilderBoss } from '../../primitives/visual-primitives/math/patternBuilder.boss';
import { angleWorkshopBoss } from '../../primitives/visual-primitives/math/angleWorkshop.boss';
import { transformationLabBoss } from '../../primitives/visual-primitives/math/transformationLab.boss';
import { figurativeLanguageFinderBoss } from '../../primitives/visual-primitives/literacy/figurativeLanguageFinder.boss';
import { contextCluesBoss } from '../../primitives/visual-primitives/literacy/contextClues.boss';
import { storyPlannerBoss } from '../../primitives/visual-primitives/literacy/storyPlanner.boss';
import { strategyPickerBoss } from '../../primitives/visual-primitives/math/strategyPicker.boss';
import { airplaneDioramaBoss } from '../../primitives/visual-primitives/engineering/airplaneDiorama.boss';
import { constructionSiteDioramaBoss } from '../../primitives/visual-primitives/engineering/constructionSiteDiorama.boss';
import { flightForcesExplorerBoss } from '../../primitives/visual-primitives/engineering/flightForcesExplorer.boss';
import { constructionSequencePlannerBoss } from '../../primitives/visual-primitives/engineering/constructionSequencePlanner.boss';
import { timelineExplorerBoss } from '../../primitives/visual-primitives/core/timelineExplorer.boss';
import { vocabularyExplorerBoss } from '../../primitives/visual-primitives/core/vocabularyExplorer.boss';
import { howItWorksBoss } from '../../primitives/visual-primitives/core/howItWorks.boss';
import { propulsionLabBoss } from '../../primitives/visual-primitives/engineering/propulsionLab.boss';
import { transportChallengeBoss } from '../../primitives/visual-primitives/engineering/transportChallenge.boss';
import { digitalSkillsSimBoss } from '../../primitives/visual-primitives/core/digitalSkillsSim.boss';
import { trainYardBoss } from '../../primitives/visual-primitives/engineering/trainYard.boss';
import { doubleNumberLineBoss } from '../../primitives/visual-primitives/math/doubleNumberLine.boss';

import { mapExplorerBoss } from '../../primitives/visual-primitives/history/mapExplorer.boss';

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

/** The journey row of a boss (`boss.ts`): every field comes from its `drive`, and warmup asks for nothing. An ungraded
 *  boss is a teaching journey: the learner looks at one thing, then finishes with the surface's own Done. */
const bossJourney = (boss: Boss): LiveJourney => (boss.card.ungraded ? {
  execution: 'teaching',
  component: boss.drive.component,
  instanceId: boss.drive.instanceId,
  defaults: { ...boss.drive.defaults, di: false },
  leakTokens: [...(boss.drive.leakTokens ?? [])],
  prompts: boss.drive.prompts ?? WORKSPACE_PROMPTS,
  inputsFor: (intent, ctx) => (intent === 'explore' || intent === 'finish' ? boss.drive.teach?.(intent, ctx) ?? [] : []),
  probes: { mounted: { selector: boss.drive.mounted }, ...boss.drive.probes },
} : {
  execution: 'workspace',
  component: boss.drive.component,
  instanceId: boss.drive.instanceId,
  defaults: { ...boss.drive.defaults, di: false },
  leakTokens: [...(boss.drive.leakTokens ?? [])],
  prompts: WORKSPACE_PROMPTS,
  inputsFor: (intent, ctx) => {
    if (intent !== 'correct' && intent !== 'wrong') return [];
    const item = boss.drive.current ? boss.drive.current(ctx)
      : boss.items(ctx.data).find((i: { id?: string }) => i.id === ctx.itemId);
    if (!item) throw new Error(`${boss.card.id}: no current item ${ctx.itemId}`);
    return boss.drive.play(intent === 'correct', item, ctx);
  },
  probes: { mounted: { selector: boss.drive.mounted }, ...boss.drive.probes },
  ...(boss.drive.replayKeys ? { replayKeys: boss.drive.replayKeys } : {}),
});

/** The retiring cue tags. The workspace emits none of them; a model that voices
 *  one is reading a legacy pack it should no longer be sent. */
const RETIRED_DI_CUE_TAGS = ['DI_ITEM', 'DI_MOVE_ON', 'DI_COMPLETE'];

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
  'number-line': bossJourney(numberLineBoss),
  'ten-frame': bossJourney(tenFrameBoss),
  'counting-board': bossJourney(countingBoardBoss),
  'number-sequencer': bossJourney(numberSequencerBoss),


  'number-bond': bossJourney(numberBondBoss),
  'ordinal-line': bossJourney(ordinalLineBoss),
  'sorting-station': bossJourney(sortingStationBoss),
  'number-tracer': bossJourney(numberTracerBoss),
  'letter-workshop': bossJourney(letterWorkshopBoss),
  'shape-tracer': bossJourney(shapeTracerBoss),
  'comparison-builder': bossJourney(comparisonBuilderBoss),
  'function-machine': bossJourney(functionMachineBoss),
  'coin-counter': bossJourney(coinCounterBoss),
  'regrouping-workbench': bossJourney(regroupingWorkbenchBoss),
  'area-model': bossJourney(areaModelBoss),
  'percent-bar': bossJourney(percentBarBoss),
  'net-folder': bossJourney(netFolderBoss),
  'formula-lab': bossJourney(formulaLabBoss),
  'parameter-explorer': bossJourney(parameterExplorerBoss),
  'ratio-table': bossJourney(ratioTableBoss),
  'matrix-display': bossJourney(matrixDisplayBoss),
  'histogram': bossJourney(histogramBoss),
  'two-way-table': bossJourney(twoWayTableBoss),
  'coordinate-graph': bossJourney(coordinateGraphBoss),
  'systems-equations-visualizer': bossJourney(systemsEquationsBoss),
  'slope-triangle': bossJourney(slopeTriangleBoss),
  'function-sketch': bossJourney(functionSketchBoss),
  'distribution-explorer': bossJourney(distributionExplorerBoss),
  'circle-explorer': bossJourney(circleExplorerBoss),
  'double-number-line': bossJourney(doubleNumberLineBoss),
  'factor-tree': bossJourney(factorTreeBoss),
  'equation-workspace': bossJourney(equationWorkspaceBoss),
  'practice-problem': bossJourney(practiceProblemBoss),
  'measure-lab': bossJourney(measureLabBoss),
  'measurement-tools': bossJourney(measurementToolsBoss),
  'length-lab': bossJourney(lengthLabBoss),
  'analog-clock': bossJourney(analogClockBoss),
  'time-sequencer': bossJourney(timeSequencerBoss),
  'angle-workshop': bossJourney(angleWorkshopBoss),
  'transformation-lab': bossJourney(transformationLabBoss),
  'array-grid': bossJourney(arrayGridBoss),
  'multiplication-explorer': bossJourney(multiplicationExplorerBoss),
  'compare-objects': bossJourney(compareObjectsBoss),
  'fraction-circles': bossJourney(fractionCirclesBoss),
  'fraction-bar': bossJourney(fractionBarBoss),
  'base-ten-blocks': bossJourney(baseTenBlocksBoss),
  'balance-scale': bossJourney(balanceScaleBoss),
  'place-value-chart': bossJourney(placeValueChartBoss),
  'shape-sorter': bossJourney(shapeSorterBoss),
  'di-letter-sounds': bossJourney(diLetterSoundsBoss),
  'di-word-reading': bossJourney(diWordReadingBoss),
  'di-sentence-reading': bossJourney(diSentenceReadingBoss),
  'di-math-facts': bossJourney(diMathFactsBoss),
  'letter-sound-link': bossJourney(letterSoundLinkBoss),
  'bar-model': bossJourney(barModelBoss),
  'phonics-blender': bossJourney(phonicsBlenderBoss),
  'word-flip': bossJourney(wordFlipBoss),
  'sound-swap': bossJourney(soundSwapBoss),
  'cvc-speller': bossJourney(cvcSpellerBoss),
  'spelling-pattern-explorer': bossJourney(spellingPatternExplorerBoss),
  'adaptation-investigator': bossJourney(adaptationInvestigatorBoss),

  'curator-brief': bossJourney(curatorBriefBoss),

  'you-and-me': bossJourney(youAndMeBoss),
  'ramp-lab': bossJourney(rampLabBoss),
  'train-yard': bossJourney(trainYardBoss),
  'construction-site-diorama': bossJourney(constructionSiteDioramaBoss),
  'map-explorer': bossJourney(mapExplorerBoss),
  'timeline-explorer': bossJourney(timelineExplorerBoss),
  'flight-forces-explorer': bossJourney(flightForcesExplorerBoss),
  'vocabulary-explorer': bossJourney(vocabularyExplorerBoss),
  'how-it-works': bossJourney(howItWorksBoss),
  'digital-skills-sim': bossJourney(digitalSkillsSimBoss),
  'transport-challenge': bossJourney(transportChallengeBoss),
  'propulsion-lab': bossJourney(propulsionLabBoss),
  'construction-sequence-planner': bossJourney(constructionSequencePlannerBoss),
  'airplane-diorama': bossJourney(airplaneDioramaBoss),
  'open-builder': bossJourney(openBuilderBoss),
  'shape-composer': bossJourney(shapeComposerBoss),
  'shape-builder': bossJourney(shapeBuilderBoss),
  'di-shapes': bossJourney(diShapesBoss),
  'di-spoken-practice': bossJourney(diSpokenPracticeBoss),
  'di-dice-roll': bossJourney(diDiceRollBoss),
  'di-deduction': bossJourney(diDeductionBoss),
  'di-worked-procedure': bossJourney(diWorkedProcedureBoss),
  'di-word-problem-setup': bossJourney(diWordProblemSetupBoss),
  'spatial-scene': bossJourney(spatialSceneBoss),
  'spatial-path': bossJourney(spatialPathBoss),
  'syllable-clapper': bossJourney(syllableClapperBoss),
  'rhyme-studio': bossJourney(rhymeStudioBoss),
  'phoneme-explorer': bossJourney(phonemeExplorerBoss),
  'word-workout': bossJourney(wordWorkoutBoss),
  'word-builder': bossJourney(wordBuilderBoss),
  'word-sorter': bossJourney(wordSorterBoss),
  'picture-vocabulary': bossJourney(pictureVocabularyBoss),
  'letter-spotter': bossJourney(letterSpotterBoss),
  'decodable-reader': bossJourney(decodableReaderBoss),
  'interactive-book': bossJourney(interactiveBookBoss),
  'story-bridge': bossJourney(storyBridgeBoss),
  'story-ribbon': bossJourney(storyRibbonBoss),
  'story-map': bossJourney(storyMapBoss),
  'poetry-lab': bossJourney(poetryLabBoss),
  'evidence-finder': bossJourney(evidenceFinderBoss),
  'addition-subtraction-scene': bossJourney(additionSubtractionSceneBoss),
  '3d-shape-explorer': bossJourney(threeDShapeExplorerBoss),
  'calendar-explorer': bossJourney(calendarExplorerBoss),
  'timeline-builder': bossJourney(timelineBuilderBoss),
  'life-cycle-sequencer': bossJourney(lifeCycleSequencerBoss),
  'fast-fact': bossJourney(fastFactBoss),
  'fact-file': bossJourney(factFileBoss),
  'race-track-lab': bossJourney(raceTrackLabBoss),
  'push-pull-arena': bossJourney(pushPullArenaBoss),
  'ecosystem-diorama': bossJourney(ecosystemDioramaBoss),
  'habitat-diorama': bossJourney(habitatDioramaBoss),
  'classification-sorter': bossJourney(classificationSorterBoss),
  'cell-builder': bossJourney(cellBuilderBoss),
  'food-web-builder': bossJourney(foodWebBuilderBoss),
  'gear-train-builder': bossJourney(gearTrainBuilderBoss),
  'tower-stacker': bossJourney(towerStackerBoss),
  'matter-explorer': bossJourney(matterExplorerBoss),
  'molecule-constructor': bossJourney(moleculeConstructorBoss),
  'atom-builder': bossJourney(atomBuilderBoss),
  'states-of-matter': bossJourney(statesOfMatterBoss),
  'solar-system-explorer': bossJourney(solarSystemBoss),
  'light-shadow-lab': bossJourney(lightShadowLabBoss),
  'mixing-and-dissolving': bossJourney(mixingAndDissolvingBoss),
  'reaction-lab': bossJourney(reactionLabBoss),
  'planetary-explorer': bossJourney(planetaryExplorerBoss),
  'telescope-simulator': bossJourney(telescopeSimulatorBoss),
  'orbit-mechanics-lab': bossJourney(orbitMechanicsLabBoss),
  'rocket-builder': bossJourney(rocketBuilderBoss),
  'mission-planner': bossJourney(missionPlannerBoss),
  'ph-explorer': bossJourney(phExplorerBoss),
  'energy-of-reactions': bossJourney(energyOfReactionsBoss),
  'equation-balancer': bossJourney(equationBalancerBoss),
  'gas-laws-simulator': bossJourney(gasLawsSimulatorBoss),
  'sound-wave-explorer': bossJourney(soundWaveExplorerBoss),
  'vehicle-comparison-lab': bossJourney(vehicleComparisonLabBoss),
  'gravity-drop-tower': bossJourney(gravityDropTowerBoss),
  'stoichiometry-lab': bossJourney(stoichiometryLabBoss),
  'constellation-builder': bossJourney(constellationBuilderBoss),
  'genre-explorer': bossJourney(genreExplorerBoss),
  'text-structure-analyzer': bossJourney(textStructureAnalyzerBoss),
  'sentence-analyzer': bossJourney(sentenceAnalyzerBoss),
  'read-aloud-studio': bossJourney(readAloudStudioBoss),

  'oral-sentence-studio': bossJourney(oralSentenceStudioBoss),
  'cause-effect-chain': bossJourney(causeEffectChainBoss),
  'era-explorer': bossJourney(eraExplorerBoss),
  'periodic-table': bossJourney(periodicTableBoss),
  'knowledge-check': bossJourney(knowledgeCheckBoss),
  'hundreds-chart': bossJourney(hundredsChartBoss),
  'skip-counting-runner': bossJourney(skipCountingBoss),
  'math-fact-fluency': bossJourney(mathFactFluencyBoss),
  'addition-fact-strategies': bossJourney(additionFactStrategiesBoss),
  'equation-builder': bossJourney(equationBuilderBoss),
  'pattern-builder': bossJourney(patternBuilderBoss),
  'strategy-picker': bossJourney(strategyPickerBoss),
  'opinion-builder': bossJourney(opinionBuilderBoss),
  'figurative-language-finder': bossJourney(figurativeLanguageFinderBoss),
  'context-clues-detective': bossJourney(contextCluesBoss),
  'story-planner': bossJourney(storyPlannerBoss),
  'revision-workshop': bossJourney(revisionWorkshopBoss),
  'sentence-builder': bossJourney(sentenceBuilderBoss),
  'paragraph-architect': bossJourney(paragraphArchitectBoss),
  'polygon-area-builder': bossJourney(polygonAreaBuilderBoss),
};

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
