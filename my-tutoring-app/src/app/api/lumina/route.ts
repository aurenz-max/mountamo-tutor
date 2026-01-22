import { NextRequest, NextResponse } from 'next/server';
import {
  generateItemDetail,
  generateConceptImage,
  generateCustomWebExhibit,
  generateCustomSVGExhibit,
  generateSentenceExhibit,
  generateMathVisualExhibit,
  generateSpecializedExhibits,
  generateComponentContent,
  generateIntroBriefing
} from '@/components/lumina/service/geminiService';

// Knowledge check imports from dedicated service (registry pattern)
import {
  generateMultipleChoiceProblems,
  generateTrueFalseProblems,
  generateFillInBlanksProblems,
  generateCategorizationProblems,
  generateMatchingProblems,
  generateSequencingProblems,
  generateKnowledgeCheck
} from '@/components/lumina/service/knowledge-check/gemini-knowledge-check';

import { generateExhibitManifest } from '@/components/lumina/service/manifest/gemini-manifest';
import { generateIntroBriefing as generateCuratorBrief } from '@/components/lumina/service/curator-brief/gemini-curator-brief';
import { generateMediaPlayer } from '@/components/lumina/service/media-player/gemini-media-player';
import { generateFractionBar } from '@/components/lumina/service/math/gemini-fraction-bar';
import { generatePlaceValueChart } from '@/components/lumina/service/math/gemini-place-value';
import { generateAreaModel } from '@/components/lumina/service/math/gemini-area-model';
import { generateArrayGrid } from '@/components/lumina/service/math/gemini-array-grid';
import { generateFactorTree } from '@/components/lumina/service/math/gemini-factor-tree';
import { generateRatioTable } from '@/components/lumina/service/math/gemini-ratio-table';
import { generateDoubleNumberLine } from '@/components/lumina/service/math/gemini-double-number-line';
import { generatePercentBar } from '@/components/lumina/service/math/gemini-percent-bar';
import { generateTapeDiagram } from '@/components/lumina/service/math/gemini-tape-diagram';
import { generateBalanceScale } from '@/components/lumina/service/math/gemini-balance-scale';
import { generateFunctionMachine } from '@/components/lumina/service/math/gemini-function-machine';
import { generateCoordinateGraph } from '@/components/lumina/service/math/gemini-coordinate-graph';
import { generateSlopeTriangle } from '@/components/lumina/service/math/gemini-slope-triangle';
import { generateSystemsEquations } from '@/components/lumina/service/math/gemini-systems-equations';
import { generateMatrix } from '@/components/lumina/service/math/gemini-matrix';
import { generateDotPlot } from '@/components/lumina/service/math/gemini-dot-plot';
import { generateHistogram } from '@/components/lumina/service/math/gemini-histogram';
import { generateTwoWayTable } from '@/components/lumina/service/math/gemini-two-way-table';
// Engineering Primitives
import { generateLeverLab } from '@/components/lumina/service/engineering/gemini-lever-lab';
import { generatePulleySystemBuilder } from '@/components/lumina/service/engineering/gemini-pulley-system';
import { generateRampLab } from '@/components/lumina/service/engineering/gemini-ramp-lab';
import { generateWheelAxleExplorer } from '@/components/lumina/service/engineering/gemini-wheel-axle';
// Foundational Concept Teaching
import { generateFoundationExplorer } from '@/components/lumina/service/foundation-explorer/gemini-foundation-explorer';
import { analyzeScratchPad, getScratchPadHint, generatePracticeProblem } from '@/components/lumina/service/scratch-pad/gemini-scratch-pad';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'generateItemDetail':
        const itemDetail = await generateItemDetail(params.contextTopic, params.item);
        return NextResponse.json(itemDetail);

      case 'generateConceptImage':
        const image = await generateConceptImage(params.prompt);
        return NextResponse.json({ image });

      case 'generateCustomWebExhibit':
        const webExhibit = await generateCustomWebExhibit(params.topic, params.gradeLevel);
        return NextResponse.json(webExhibit);

      case 'generateCustomSVGExhibit':
        const svgExhibit = await generateCustomSVGExhibit(params.topic, params.gradeLevel);
        return NextResponse.json(svgExhibit);

      case 'generateSentenceExhibit':
        const sentenceExhibit = await generateSentenceExhibit(params.topic, params.gradeLevel);
        return NextResponse.json(sentenceExhibit);

      case 'generateMathVisualExhibit':
        const mathExhibit = await generateMathVisualExhibit(params.topic, params.gradeLevel);
        return NextResponse.json(mathExhibit);

      case 'generateSpecializedExhibits':
        const specializedExhibits = await generateSpecializedExhibits(
          params.topic,
          params.gradeLevel,
          params.intent
        );
        return NextResponse.json(specializedExhibits);

      case 'generateMultipleChoiceProblems':
        const mcProblems = await generateMultipleChoiceProblems(
          params.topic,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(mcProblems);

      case 'generateTrueFalseProblems':
        const tfProblems = await generateTrueFalseProblems(
          params.topic,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(tfProblems);

      case 'generateFillInBlanksProblems':
        const fibProblems = await generateFillInBlanksProblems(
          params.topic,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(fibProblems);

      case 'generateCategorizationProblems':
        const catProblems = await generateCategorizationProblems(
          params.topic,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(catProblems);

      case 'generateMatchingProblems':
        const matchProblems = await generateMatchingProblems(
          params.topic,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(matchProblems);

      case 'generateKnowledgeCheckProblems':
        const kcProblems = await generateKnowledgeCheck(
          params.topic,
          params.gradeLevel,
          {
            problemType: params.problemType,
            count: params.count
          }
        );
        return NextResponse.json(kcProblems);

      case 'generateSequencingProblems':
        const seqProblems = await generateSequencingProblems(
          params.topic,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(seqProblems);

      case 'generateComponentContent':
        const componentContent = await generateComponentContent(
          params.componentId,
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(componentContent);

      case 'generateExhibitManifest':
        const manifest = await generateExhibitManifest(params.topic, params.gradeLevel);
        return NextResponse.json(manifest);

      case 'generateExhibitManifestWithObjectives':
        console.log('🗺️ API ROUTE: generateExhibitManifestWithObjectives called with', params.objectives?.length, 'objectives');
        const manifestWithObjectives = await generateExhibitManifest(
          params.topic,
          params.gradeLevel,
          params.objectives
        );
        return NextResponse.json(manifestWithObjectives);

      case 'buildCompleteExhibitFromManifest':
        console.log('🎯 API ROUTE: buildCompleteExhibitFromManifest called');
        const { buildCompleteExhibitFromManifest } = await import('@/components/lumina/service/geminiService');
        const exhibitFromManifest = await buildCompleteExhibitFromManifest(
          params.manifest,
          params.curatorBrief
        );
        return NextResponse.json(exhibitFromManifest);

      case 'generateIntroBriefing':
        console.log('📚 API ROUTE: generateIntroBriefing called for topic:', params.topic);
        const introBriefing = await generateIntroBriefing(params.topic, params.gradeLevel);
        return NextResponse.json(introBriefing);

      case 'generateCuratorBrief':
        const curatorBrief = await generateCuratorBrief(
          params.topic,
          params.subject,
          params.gradeLevel,
          params.estimatedTime
        );
        return NextResponse.json(curatorBrief);

      case 'generateProblemHint':
        const { generateProblemHint } = await import('@/components/lumina/service/problems/hint-generator');
        const hint = await generateProblemHint(params.problem, params.hintLevel);
        return NextResponse.json(hint);

      case 'generatePracticeAssessment':
        const { generatePracticeAssessment } = await import('@/components/lumina/service/problems/assessment-generator');
        const assessment = await generatePracticeAssessment(
          params.subject,
          params.gradeLevel,
          params.problemCount,
          params.problems
        );
        return NextResponse.json(assessment);

      case 'generateQuests':
        const { generateQuests } = await import('@/components/lumina/service/problems/quest-generator');
        const quests = await generateQuests(
          params.subject,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(quests);

      case 'generateWarmUpQuestion':
        const { generateWarmUpQuestion } = await import('@/components/lumina/service/problems/quest-generator');
        const warmUp = await generateWarmUpQuestion(
          params.subject,
          params.gradeLevel
        );
        return NextResponse.json(warmUp);

      case 'generateMediaPlayer':
        const mediaPlayer = await generateMediaPlayer(
          params.topic,
          params.gradeLevel,
          params.segmentCount,
          params.imageResolution
        );
        return NextResponse.json(mediaPlayer);

      case 'generateFractionBar':
        const fractionBar = await generateFractionBar(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(fractionBar);

      case 'generatePlaceValueChart':
        const placeValueChart = await generatePlaceValueChart(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(placeValueChart);

      case 'generateAreaModel':
        const areaModel = await generateAreaModel(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(areaModel);

      case 'generateArrayGrid':
        const arrayGrid = await generateArrayGrid(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(arrayGrid);

      case 'generateFactorTree':
        const factorTree = await generateFactorTree(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(factorTree);

      case 'generateRatioTable':
        const ratioTable = await generateRatioTable(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(ratioTable);

      case 'generateDoubleNumberLine':
        const doubleNumberLine = await generateDoubleNumberLine(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(doubleNumberLine);

      case 'generatePercentBar':
        const percentBar = await generatePercentBar(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(percentBar);

      case 'generateTapeDiagram':
        const tapeDiagram = await generateTapeDiagram(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(tapeDiagram);

      case 'generateBalanceScale':
        const balanceScale = await generateBalanceScale(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(balanceScale);

      case 'generateFunctionMachine':
        const functionMachine = await generateFunctionMachine(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(functionMachine);

      case 'generateCoordinateGraph':
        const coordinateGraph = await generateCoordinateGraph(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(coordinateGraph);

      case 'generateSlopeTriangle':
        const slopeTriangle = await generateSlopeTriangle(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(slopeTriangle);

      case 'generateSystemsEquations':
        const systemsEquations = await generateSystemsEquations(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(systemsEquations);

      case 'generateMatrix':
        const matrix = await generateMatrix(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(matrix);

      case 'generateDotPlot':
        const dotPlot = await generateDotPlot(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(dotPlot);

      case 'generateHistogram':
        const histogram = await generateHistogram(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(histogram);

      case 'generateTwoWayTable':
        const twoWayTable = await generateTwoWayTable(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(twoWayTable);

      // Engineering Primitives
      case 'generateLeverLab':
        const leverLab = await generateLeverLab(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(leverLab);

      case 'generatePulleySystemBuilder':
        const pulleySystem = await generatePulleySystemBuilder(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(pulleySystem);

      case 'generateRampLab':
        const rampLab = await generateRampLab(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(rampLab);

      case 'generateWheelAxleExplorer':
        const wheelAxle = await generateWheelAxleExplorer(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(wheelAxle);

      case 'generateFoundationExplorer':
        const foundationExplorer = await generateFoundationExplorer(
          params.topic,
          params.gradeLevel,
          params.config
        );
        return NextResponse.json(foundationExplorer);

      case 'analyzeScratchPad':
        const scratchPadAnalysis = await analyzeScratchPad(
          params.imageBase64,
          params.context
        );
        return NextResponse.json(scratchPadAnalysis);

      case 'getScratchPadHint':
        const scratchPadHint = await getScratchPadHint(
          params.imageBase64,
          params.hintLevel
        );
        return NextResponse.json({ hint: scratchPadHint });

      case 'generateScratchPadProblem':
        const scratchPadProblem = await generatePracticeProblem(
          params.topic,
          params.gradeLevel,
          params.difficulty
        );
        return NextResponse.json(scratchPadProblem);

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
