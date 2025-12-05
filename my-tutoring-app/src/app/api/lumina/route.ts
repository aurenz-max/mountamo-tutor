import { NextRequest, NextResponse } from 'next/server';
import {
  generateItemDetail,
  generateConceptImage,
  generateCustomWebExhibit,
  generateCustomSVGExhibit,
  generateSentenceExhibit,
  generateMathVisualExhibit,
  generateSpecializedExhibits,
  generateMultipleChoiceProblems,
  generateTrueFalseProblems,
  generateFillInBlanksProblems,
  generateCategorizationProblems,
  generateMatchingProblems,
  generateKnowledgeCheckProblems,
  generateSequencingProblems,
  generateComponentContent,
  generateExhibitManifest,
  buildCompleteExhibitFromTopic,
  generateIntroBriefing,
  generateRelationalMappingChemistry
} from '@/components/lumina/service/geminiService';

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
        const kcProblems = await generateKnowledgeCheckProblems(
          params.topic,
          params.gradeLevel,
          params.problemType,
          params.count
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

      case 'buildCompleteExhibitFromTopic':
        const exhibit = await buildCompleteExhibitFromTopic(params.topic, params.gradeLevel);
        return NextResponse.json(exhibit);

      case 'generateIntroBriefing':
        const introBriefing = await generateIntroBriefing(params.topic, params.gradeLevel);
        return NextResponse.json(introBriefing);

      case 'generateRelationalMappingChemistry':
        const mapping = await generateRelationalMappingChemistry(
          params.molecule,
          params.gradeLevel,
          params.topic
        );
        return NextResponse.json(mapping);

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
