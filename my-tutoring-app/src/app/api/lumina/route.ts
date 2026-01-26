import { NextRequest, NextResponse } from 'next/server';

// Core geminiService exports (cleaned up - only essential functions)
import {
  generateItemDetail,
  generateConceptImage,
  generateComponentContent,
  generateIntroBriefing,
  buildCompleteExhibitFromManifest
} from '@/components/lumina/service/geminiService';

// Manifest generation
import { generateExhibitManifest } from '@/components/lumina/service/manifest/gemini-manifest';

// Curator brief
import { generateIntroBriefing as generateCuratorBrief } from '@/components/lumina/service/curator-brief/gemini-curator-brief';

// Knowledge check (universal endpoint)
import { generateKnowledgeCheck } from '@/components/lumina/service/knowledge-check/gemini-knowledge-check';

// Scratch pad analysis
import { analyzeScratchPad, getScratchPadHint, generatePracticeProblem } from '@/components/lumina/service/scratch-pad/gemini-scratch-pad';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      // ============================================
      // CORE CONTENT GENERATION (Universal Endpoints)
      // ============================================

      case 'generateItemDetail':
        const itemDetail = await generateItemDetail(params.contextTopic, params.item);
        return NextResponse.json(itemDetail);

      case 'generateConceptImage':
        const image = await generateConceptImage(params.prompt);
        return NextResponse.json({ image });

      // Universal component content generator - routes to all primitives via registry
      case 'generateComponentContent': {
        // Build manifest item from params
        const item = {
          componentId: params.componentId,
          instanceId: params.instanceId || `${params.componentId}-${Date.now()}`,
          config: params.config || {}
        };
        const componentContent = await generateComponentContent(
          item,
          params.topic,
          params.gradeLevel
        );
        return NextResponse.json(componentContent);
      }

      // ============================================
      // MANIFEST & EXHIBIT ORCHESTRATION
      // ============================================

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
        const exhibitFromManifest = await buildCompleteExhibitFromManifest(
          params.manifest,
          params.curatorBrief
        );
        return NextResponse.json(exhibitFromManifest);

      // ============================================
      // CURATOR BRIEF & INTRO
      // ============================================

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

      // ============================================
      // KNOWLEDGE CHECK & ASSESSMENT
      // ============================================

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

      case 'generateProblemHint': {
        const { generateProblemHint } = await import('@/components/lumina/service/problems/hint-generator');
        const hint = await generateProblemHint(params.problem, params.hintLevel);
        return NextResponse.json(hint);
      }

      case 'generatePracticeAssessment': {
        const { generatePracticeAssessment } = await import('@/components/lumina/service/problems/assessment-generator');
        const assessment = await generatePracticeAssessment(
          params.subject,
          params.gradeLevel,
          params.problemCount,
          params.problems
        );
        return NextResponse.json(assessment);
      }

      // ============================================
      // QUESTS & WARM-UP
      // ============================================

      case 'generateQuests': {
        const { generateQuests } = await import('@/components/lumina/service/problems/quest-generator');
        const quests = await generateQuests(
          params.subject,
          params.gradeLevel,
          params.count
        );
        return NextResponse.json(quests);
      }

      case 'generateWarmUpQuestion': {
        const { generateWarmUpQuestion } = await import('@/components/lumina/service/problems/quest-generator');
        const warmUp = await generateWarmUpQuestion(
          params.subject,
          params.gradeLevel
        );
        return NextResponse.json(warmUp);
      }

      // ============================================
      // SCRATCH PAD
      // ============================================

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

      // ============================================
      // IMAGE PANEL EVALUATION
      // ============================================

      case 'evaluateImageAnnotations':
        const { evaluateImageAnnotations } = await import(
          '@/components/lumina/service/image-panel/gemini-image-evaluation'
        );
        const imageEvaluation = await evaluateImageAnnotations(
          params.imageBase64,
          params.annotations,
          params.studentPlacements,
          params.learningObjective
        );
        return NextResponse.json(imageEvaluation);

      // ============================================
      // BIOLOGY PRIMITIVES
      // ============================================

      case 'generateSpeciesImage':
        const { generateSpeciesImage } = await import(
          '@/components/lumina/service/biology/gemini-species-profile'
        );
        const speciesImageUrl = await generateSpeciesImage(params.imagePrompt);
        return NextResponse.json({ imageUrl: speciesImageUrl });

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
