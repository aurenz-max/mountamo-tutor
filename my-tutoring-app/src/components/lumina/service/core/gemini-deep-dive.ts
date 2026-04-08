/**
 * DeepDive Orchestrator Generator
 *
 * Two-stage generation:
 * 1. ORCHESTRATOR (gemini-flash-lite-latest) — plans which blocks to use, in what order,
 *    with per-block briefs and tutoring instructions.
 * 2. PARALLEL BLOCK GENERATORS (gemini-flash-lite-latest) — each gets a tight brief
 *    and a fixed schema for its block type. Runs concurrently.
 *
 * Image blocks use gemini-flash-lite-latest-image for real AI-generated images.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  DeepDiveData,
  DeepDiveBlock,
  HeroImageBlockData,
  KeyFactsBlockData,
  DataTableBlockData,
  MultipleChoiceBlockData,
  PullQuoteBlockData,
  ProseBlockData,
  TimelineBlockData,
  FillInBlankBlockData,
  CompareContrastBlockData,
  DiagramBlockData,
  MiniSimBlockData,
  BlockType,
  WrapperLayout,
} from '../../primitives/visual-primitives/core/deep-dive/types';
import { matchTemplate } from '../../primitives/visual-primitives/core/deep-dive/composition-templates';

// ═══════════════════════════════════════════════════════════════════════
// Stage 1: Orchestrator — plans the block layout
// ═══════════════════════════════════════════════════════════════════════

interface OrchestratorBlockPlan {
  blockType: string;
  label: string;
  brief: string;
  tutoringBrief: string;
  transitionCue: string;
}

interface OrchestratorPlan {
  title: string;
  subtitle: string;
  narrativeArc: string;
  layout: string;
  blocks: OrchestratorBlockPlan[];
}

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Engaging title for the deep dive' },
    subtitle: { type: Type.STRING, description: 'One-sentence subtitle explaining the scope' },
    narrativeArc: { type: Type.STRING, description: '2-3 sentences describing the learning journey from start to finish' },
    layout: {
      type: Type.STRING,
      description: 'Wrapper layout strategy: stack (vertical single column, default), grid_2col (two-column grid for comparison/analytical content), reveal_progressive (cards appear one at a time after interaction — great for misconception repair), masonry (Pinterest-style variable-height grid for broad overviews with many small blocks)',
    },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockType: {
            type: Type.STRING,
            description: 'One of: hero-image, key-facts, data-table, multiple-choice, pull-quote, prose, timeline, fill-in-blank, compare-contrast, diagram, mini-sim',
          },
          label: { type: Type.STRING, description: 'Short display label for this block (e.g. "Key Facts", "Quick Quiz")' },
          brief: { type: Type.STRING, description: 'Detailed content brief for the block generator. Be specific about what to include.' },
          tutoringBrief: { type: Type.STRING, description: 'What the AI tutor should do when the student is on this block' },
          transitionCue: { type: Type.STRING, description: 'How this block connects to the next one — narrative flow' },
        },
        required: ['blockType', 'label', 'brief', 'tutoringBrief', 'transitionCue'],
      },
    },
  },
  required: ['title', 'subtitle', 'narrativeArc', 'layout', 'blocks'],
};

function buildOrchestratorPrompt(
  topic: string,
  gradeLevel: string,
  evalMode?: string,
  templateId?: string,
): string {
  const evalGuidance = getEvalModeGuidance(evalMode);
  const { promptHint } = matchTemplate(evalMode, templateId);

  return `You are an expert learning experience designer. Plan a DeepDive lesson on "${topic}" for ${gradeLevel} students.

A DeepDive is a vertical scroll experience assembled from modular blocks. Your job is to plan which blocks to use, in what order, write a content brief for each, and choose a wrapper layout strategy.

## Available Block Types
- **hero-image**: An AI-generated image that anchors attention. Brief should describe the visual scene in detail.
- **key-facts**: 3-5 bullet-point facts with emoji icons. Quick knowledge transfer.
- **data-table**: Structured comparison or data table. Brief should specify headers and what data to include.
- **multiple-choice**: A comprehension question with 4 options and explanation. Brief should specify what concept to test and the difficulty level.
- **pull-quote**: An editorial highlight — 1-2 sentences that capture the most important insight from the surrounding content. The brief IS the quote text (pithy, not a paragraph). The label is the attribution source. No separate generation needed. Use pull quotes after display blocks to highlight key takeaways. Never place two pull quotes adjacent.
- **prose**: Explanatory narrative text — 2-4 paragraphs that explain *why* something matters, provide context, or connect structured blocks narratively. Brief should specify the explanatory focus and tone. Place between display blocks (e.g., KeyFacts → Prose → DataTable) to create reading flow. Never place two prose blocks adjacent. Optionally include a figure by mentioning "include a figure of [description]" in the brief. Layout options: mention "masonry layout" in the brief for card-grid style (best with 3-4+ short paragraphs, e.g., fun facts, multiple perspectives, comparisons). Mention "reveal animation" for text that animates in line-by-line on scroll (great for dramatic or climactic content). Mention "columns layout" to force newspaper-style multi-column text.
- **timeline**: A chronological sequence of 3-6 events with dates, titles, and descriptions. Perfect for history, biology (evolution), technology (inventions), and any narrative with a temporal dimension. Brief should specify the time period and what events to include.
- **fill-in-blank**: A vocabulary/concept question where one key word is blanked out of a sentence and the student picks from a word bank. Brief should specify the concept area and difficulty. Use for precise vocabulary testing — complements multiple-choice by testing recall rather than recognition.
- **compare-contrast**: Side-by-side comparison of two items, concepts, or perspectives with 3-4 points each. Brief should specify what two things to compare and what dimensions to highlight. Great for science (plant vs animal cell), history (opposing viewpoints), geography (regions), etc.
- **diagram**: AI-generated labeled diagram for spatial/structural understanding — how parts relate to a whole. Brief should describe the visual scene to generate and list 3-6 key features to label with their descriptions. Perfect for physics (double-slit apparatus, force diagrams), biology (cell organelles, organ systems), chemistry (molecular structure), geography (map features). In explore/recall modes, labels are pre-placed and clickable (display). In apply/analyze modes, students drag labels onto the image (evaluable). Use when spatial relationships ARE the concept — don't flatten spatial insights into bullet points.
- **mini-sim**: An interactive "what if?" experiment — the student manipulates ONE variable (toggle or slider) and observes what changes. Includes a prediction question asked BEFORE manipulation ("What do you think will happen?") that makes it evaluable. Brief should describe the experiment scenario, what variable the student controls (toggle for on/off, slider for continuous), and what observable outcomes change. Perfect for physics (double-slit detector on/off, temperature change), chemistry (concentration effects), biology (variable isolation), and any topic where manipulating a variable reveals counterintuitive behavior. Place after Prose or KeyFacts that introduce the concept — the student should understand the setup before experimenting.

## Wrapper Layout Strategies
Choose a layout for the entire deep dive. This controls how blocks are spatially arranged:
- **stack** — Vertical single-column. Default. Best for narrative-heavy lessons with a clear linear flow.
- **grid_2col** — Two-column grid. Compact/standard blocks fill cells; wide/full blocks span both columns. Best for comparison/analytical content where blocks pair naturally (e.g., evidence cards side by side).
- **reveal_progressive** — Cards appear one at a time after the student interacts with or dwells on the previous card. Best for misconception repair, dramatic reveals, or guided reasoning where premature exposure to later content would undermine the pedagogy.
- **masonry** — Pinterest-style variable-height grid. Best for broad overviews with many small, self-contained blocks (fun facts, multiple perspectives, mosaic-style exploration). Requires 5+ blocks to look good.

## Rules
1. Start with a hero-image to anchor the topic visually.
2. Place display blocks (key-facts, data-table) BEFORE the MC questions that reference them.
3. Each MC question should test comprehension of a specific display block above it.
4. The brief for each block must be detailed enough that a separate AI can generate the content without seeing the other blocks.
5. Include the topic name and grade level context in each brief.
6. Tutoring briefs describe what the AI tutor should SAY when the student reaches this block.
7. Transition cues create narrative flow between blocks.
8. IMPORTANT: Use a VARIETY of block types for visual and cognitive diversity. Every lesson MUST include at least one prose block and at least one pull-quote block. Use timeline for topics with chronological dimension. Use compare-contrast when two concepts can be juxtaposed. Use fill-in-blank alongside multiple-choice to vary assessment types.

${evalGuidance}

${promptHint}

Plan the blocks now. Choose a layout strategy and make each brief specific and detailed.`;
}

function getEvalModeGuidance(evalMode?: string): string {
  switch (evalMode) {
    case 'explore':
      return `## Eval Mode: EXPLORE (easy)
Favor display blocks. Include at most 1-2 easy MC questions. 5-6 blocks total.
MC questions should test basic recall of directly stated facts.
Use prose blocks to explain concepts narratively. Use pull-quote blocks after display blocks to highlight key insights.
Use diagram blocks (explore mode — clickable labels) when the topic has spatial structure.`;
    case 'recall':
      return `## Eval Mode: RECALL (medium-easy)
Mix of display and MC blocks. Include 2-3 MC questions testing direct recall.
6-7 blocks total.
Use prose blocks between display blocks for narrative flow. Use pull-quote blocks to highlight key takeaways.
Use diagram blocks (explore mode) when spatial relationships help explain the concept.`;
    case 'apply':
      return `## Eval Mode: APPLY (medium-hard)
Include a data-table and MC questions that require cross-referencing data.
7-8 blocks total. MC questions should require multi-step reasoning.
Use prose blocks to explain context before data tables. Use pull-quote blocks to highlight important relationships.
Use diagram blocks (label mode — student places labels) when spatial understanding is a key learning objective.`;
    case 'analyze':
      return `## Eval Mode: ANALYZE (hard)
Include 3-4 challenging MC questions requiring synthesis across blocks.
7-9 blocks total. Questions should test analysis, not just recall.
Use prose blocks to build narrative depth. Use pull-quote blocks to highlight key insights for synthesis.
Use diagram blocks (label mode) to test spatial reasoning — students must demonstrate they know where things are and why.`;
    default:
      return `## Default Mode
Include a good mix of ALL block types: hero-image, key-facts, prose, pull-quote, data-table, and 2-3 MC questions.
Use prose blocks for narrative explanations between structured blocks. Use pull-quote blocks to highlight key insights.
6-8 blocks total.`;
  }
}

async function runOrchestrator(
  topic: string,
  gradeLevel: string,
  evalMode?: string,
  templateId?: string,
): Promise<OrchestratorPlan> {
  const prompt = buildOrchestratorPrompt(topic, gradeLevel, evalMode, templateId);
  const { template } = matchTemplate(evalMode, templateId);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: ORCHESTRATOR_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Orchestrator returned empty response');

  const plan: OrchestratorPlan = JSON.parse(text);

  // When a template was explicitly selected, enforce its slots deterministically.
  // The LLM planned content briefs; we override block types, order, and layout.
  if (templateId) {
    plan.layout = template.wrapperLayout;

    // Map LLM-generated briefs by blockType for reuse
    const briefsByType = new Map<string, OrchestratorBlockPlan[]>();
    for (const b of plan.blocks) {
      const list = briefsByType.get(b.blockType) || [];
      list.push(b);
      briefsByType.set(b.blockType, list);
    }

    plan.blocks = template.slots.map((slot) => {
      // Try to reuse a brief the LLM wrote for this block type
      const candidates = briefsByType.get(slot.primitive);
      const reused = candidates?.shift();
      return {
        blockType: slot.primitive,
        label: reused?.label || `${slot.primitive} (${slot.role})`,
        brief: reused?.brief || `Generate ${slot.primitive} content about "${topic}" for ${gradeLevel} students. Role: ${slot.role}.`,
        tutoringBrief: reused?.tutoringBrief || `Guide the student through this ${slot.role} section.`,
        transitionCue: reused?.transitionCue || '',
      };
    });
  }

  // Validate: filter to only known block types
  const validTypes = new Set<string>(['hero-image', 'key-facts', 'data-table', 'multiple-choice', 'pull-quote', 'prose', 'timeline', 'fill-in-blank', 'compare-contrast', 'diagram', 'mini-sim']);
  plan.blocks = plan.blocks.filter((b) => validTypes.has(b.blockType));

  if (plan.blocks.length === 0) {
    throw new Error('Orchestrator produced no valid blocks');
  }

  return plan;
}

// ═══════════════════════════════════════════════════════════════════════
// Stage 2: Parallel Block Generators
// ═══════════════════════════════════════════════════════════════════════

// ── Image generation ────────────────────────────────────────────────

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: '16:9' },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error('[DeepDive] Image generation failed:', error);
    return null;
  }
}

// ── Key Facts generator ─────────────────────────────────────────────

const KEY_FACTS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    fact0Icon: { type: Type.STRING, description: 'Emoji icon for fact 1' },
    fact0Text: { type: Type.STRING, description: 'Fact 1 text' },
    fact1Icon: { type: Type.STRING, description: 'Emoji icon for fact 2' },
    fact1Text: { type: Type.STRING, description: 'Fact 2 text' },
    fact2Icon: { type: Type.STRING, description: 'Emoji icon for fact 3' },
    fact2Text: { type: Type.STRING, description: 'Fact 3 text' },
    fact3Icon: { type: Type.STRING, description: 'Emoji icon for fact 4 (optional)', nullable: true },
    fact3Text: { type: Type.STRING, description: 'Fact 4 text (optional)', nullable: true },
    fact4Icon: { type: Type.STRING, description: 'Emoji icon for fact 5 (optional)', nullable: true },
    fact4Text: { type: Type.STRING, description: 'Fact 5 text (optional)', nullable: true },
  },
  required: ['fact0Icon', 'fact0Text', 'fact1Icon', 'fact1Text', 'fact2Icon', 'fact2Text'],
};

async function generateKeyFacts(brief: string, topic: string, gradeLevel: string): Promise<KeyFactsBlockData['facts']> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate key facts for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate 3-5 facts. Each fact should be a clear, memorable statement with an appropriate emoji icon.
Keep facts concise (1-2 sentences max). Use age-appropriate vocabulary for ${gradeLevel}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: KEY_FACTS_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return [{ icon: '\u2139\uFE0F', text: `Key fact about ${topic}` }];

  const data = JSON.parse(text);
  const facts: KeyFactsBlockData['facts'] = [];

  for (let i = 0; i < 5; i++) {
    const icon = data[`fact${i}Icon`];
    const factText = data[`fact${i}Text`];
    if (icon && factText) {
      facts.push({ icon, text: factText });
    }
  }

  return facts.length > 0 ? facts : [{ icon: '\u2139\uFE0F', text: `Key fact about ${topic}` }];
}

// ── Data Table generator ────────────────────────────────────────────

const DATA_TABLE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    caption: { type: Type.STRING, description: 'Brief caption for the table' },
    header0: { type: Type.STRING, description: 'Column 1 header' },
    header1: { type: Type.STRING, description: 'Column 2 header' },
    header2: { type: Type.STRING, description: 'Column 3 header', nullable: true },
    header3: { type: Type.STRING, description: 'Column 4 header', nullable: true },
    // Up to 6 rows with up to 4 columns each (flat)
    row0col0: { type: Type.STRING }, row0col1: { type: Type.STRING },
    row0col2: { type: Type.STRING, nullable: true }, row0col3: { type: Type.STRING, nullable: true },
    row1col0: { type: Type.STRING }, row1col1: { type: Type.STRING },
    row1col2: { type: Type.STRING, nullable: true }, row1col3: { type: Type.STRING, nullable: true },
    row2col0: { type: Type.STRING }, row2col1: { type: Type.STRING },
    row2col2: { type: Type.STRING, nullable: true }, row2col3: { type: Type.STRING, nullable: true },
    row3col0: { type: Type.STRING, nullable: true }, row3col1: { type: Type.STRING, nullable: true },
    row3col2: { type: Type.STRING, nullable: true }, row3col3: { type: Type.STRING, nullable: true },
    row4col0: { type: Type.STRING, nullable: true }, row4col1: { type: Type.STRING, nullable: true },
    row4col2: { type: Type.STRING, nullable: true }, row4col3: { type: Type.STRING, nullable: true },
    row5col0: { type: Type.STRING, nullable: true }, row5col1: { type: Type.STRING, nullable: true },
    row5col2: { type: Type.STRING, nullable: true }, row5col3: { type: Type.STRING, nullable: true },
  },
  required: [
    'caption', 'header0', 'header1',
    'row0col0', 'row0col1', 'row1col0', 'row1col1', 'row2col0', 'row2col1',
  ],
};

async function generateDataTable(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{ headers: string[]; rows: string[][]; caption: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a data table for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate a table with 2-4 columns and 3-6 rows. The data should be factually accurate and educational.
Use age-appropriate language for ${gradeLevel}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: DATA_TABLE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return {
      headers: ['Item', 'Detail'],
      rows: [['(data)', '(unavailable)']],
      caption: `Table about ${topic}`,
    };
  }

  const data = JSON.parse(text);

  // Reconstruct headers
  const headers: string[] = [data.header0, data.header1];
  if (data.header2) headers.push(data.header2);
  if (data.header3) headers.push(data.header3);

  // Reconstruct rows
  const colCount = headers.length;
  const rows: string[][] = [];
  for (let r = 0; r < 6; r++) {
    const col0 = data[`row${r}col0`];
    if (!col0) break;
    const row: string[] = [col0];
    for (let c = 1; c < colCount; c++) {
      row.push(data[`row${r}col${c}`] || '');
    }
    rows.push(row);
  }

  return {
    headers,
    rows: rows.length > 0 ? rows : [['(data)', '(unavailable)']],
    caption: data.caption || `Table about ${topic}`,
  };
}

// ── Multiple Choice generator ───────────────────────────────────────

const MC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING, description: 'The question text' },
    option0: { type: Type.STRING, description: 'Option A' },
    option1: { type: Type.STRING, description: 'Option B' },
    option2: { type: Type.STRING, description: 'Option C' },
    option3: { type: Type.STRING, description: 'Option D' },
    correctIndex: { type: Type.NUMBER, description: 'Index of the correct option (0-3)' },
    explanation: { type: Type.STRING, description: 'Explanation of why the correct answer is right (2-3 sentences)' },
  },
  required: ['question', 'option0', 'option1', 'option2', 'option3', 'correctIndex', 'explanation'],
};

async function generateMultipleChoice(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{ question: string; options: string[]; correctIndex: number; explanation: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a multiple choice question for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate exactly 4 options. Make distractors plausible but clearly wrong.
The explanation should teach, not just state the correct answer.
Use age-appropriate language for ${gradeLevel}.
IMPORTANT: Do NOT make the correct answer obvious from its position or length.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: MC_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return {
      question: `Question about ${topic}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: 'Unable to generate explanation.',
    };
  }

  const data = JSON.parse(text);

  // Validate correctIndex
  const correctIndex = Math.max(0, Math.min(3, Math.round(data.correctIndex)));

  return {
    question: data.question,
    options: [data.option0, data.option1, data.option2, data.option3],
    correctIndex,
    explanation: data.explanation,
  };
}

// ── Prose generator ───────────────────────────────────────────────────

const PROSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    paragraph0: { type: Type.STRING, description: 'First paragraph' },
    paragraph1: { type: Type.STRING, description: 'Second paragraph' },
    paragraph2: { type: Type.STRING, description: 'Third paragraph (optional)', nullable: true },
    paragraph3: { type: Type.STRING, description: 'Fourth paragraph (optional)', nullable: true },
    figureCaption: { type: Type.STRING, description: 'Caption for optional inline figure', nullable: true },
    figureAltText: { type: Type.STRING, description: 'Alt text for optional inline figure', nullable: true },
    figurePlacement: { type: Type.STRING, description: 'Figure placement: left or right', nullable: true },
    figurePrompt: { type: Type.STRING, description: 'Detailed image generation prompt for the figure (only if the brief requests a figure)', nullable: true },
    layout: { type: Type.STRING, description: 'Layout mode: flow (default), masonry (card grid), or columns (newspaper). Only set if the brief requests a specific layout.', nullable: true },
    reveal: { type: Type.BOOLEAN, description: 'Whether to animate text appearing line-by-line on scroll. Only true if the brief requests reveal animation.', nullable: true },
    // Inset key facts — embedded alongside prose text via Pretext reflow
    insetFact0Icon: { type: Type.STRING, description: 'Emoji icon for inset fact 1 (only if brief requests embedded key facts)', nullable: true },
    insetFact0Text: { type: Type.STRING, description: 'Inset fact 1 text — concise takeaway from the prose', nullable: true },
    insetFact1Icon: { type: Type.STRING, description: 'Emoji icon for inset fact 2', nullable: true },
    insetFact1Text: { type: Type.STRING, description: 'Inset fact 2 text', nullable: true },
    insetFact2Icon: { type: Type.STRING, description: 'Emoji icon for inset fact 3', nullable: true },
    insetFact2Text: { type: Type.STRING, description: 'Inset fact 3 text', nullable: true },
    insetFactsPlacement: { type: Type.STRING, description: 'Inset facts placement: left or right (default right)', nullable: true },
  },
  required: ['paragraph0', 'paragraph1'],
};

async function generateProse(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{
  paragraphs: string[];
  figure?: { imageBase64: string; caption: string; altText: string; placement: 'left' | 'right' };
  insetFacts?: { facts: Array<{ icon: string; text: string }>; placement: 'left' | 'right' };
  layout?: 'flow' | 'masonry' | 'columns';
  reveal?: boolean;
}> {
  const wantsFigure = /figure|image|illustration|picture|visual/i.test(brief);
  const wantsMasonry = /masonry/i.test(brief);
  const wantsColumns = /columns?\s+layout/i.test(brief);
  const wantsReveal = /reveal\s+anim/i.test(brief);

  const layoutHint = wantsMasonry
    ? '\n\nThe brief requests masonry layout. Write 3-4+ SHORT paragraphs (1-2 sentences each) — each becomes a card in a masonry grid. Make each paragraph a self-contained point, fact, or perspective.'
    : wantsColumns
      ? '\n\nThe brief requests columns layout. Write 2-3 longer paragraphs — they will be split into newspaper-style columns.'
      : '';

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Write explanatory narrative prose for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Write 2-3 paragraphs of clear, engaging explanatory text. Use age-appropriate vocabulary for ${gradeLevel}.
Write in an editorial, article-like tone — not bullet points, not a textbook. Explain *why* things matter, not just *what* they are.
Each paragraph should be 2-4 sentences.${wantsFigure ? '\n\nThe brief requests a figure. Provide a figureCaption, figureAltText, figurePlacement (left or right), and a figurePrompt describing the image to generate.' : ''}${layoutHint}

## Visual variety — Inset Key Facts
To improve visual variety, consider adding an INSET KEY FACTS card that floats alongside the prose text. This works best when the prose has clear takeaways worth highlighting. If you choose to include them, provide exactly 3 inset facts: each with an emoji icon (insetFact0Icon, insetFact1Icon, insetFact2Icon) and a concise takeaway sentence (insetFact0Text, insetFact1Text, insetFact2Text). Set insetFactsPlacement to "right" (or "left"). When including inset facts, write 2-3 longer paragraphs so there is enough text for the card to float alongside.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: PROSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return { paragraphs: [`Learn more about ${topic}.`] };
  }

  const data = JSON.parse(text);

  // Reconstruct paragraphs
  const paragraphs: string[] = [];
  for (let i = 0; i < 4; i++) {
    const p = data[`paragraph${i}`];
    if (p) paragraphs.push(p);
  }

  if (paragraphs.length === 0) {
    return { paragraphs: [`Learn more about ${topic}.`] };
  }

  // Generate figure image if requested and prompt provided
  let figure: { imageBase64: string; caption: string; altText: string; placement: 'left' | 'right' } | undefined;
  if (wantsFigure && data.figurePrompt) {
    const figureImage = await generateImage(
      `Educational illustration for ${gradeLevel} students: ${data.figurePrompt}. Clean, informative, no text overlays.`,
    );
    if (figureImage) {
      figure = {
        imageBase64: figureImage,
        caption: data.figureCaption || '',
        altText: data.figureAltText || `Illustration for ${topic}`,
        placement: data.figurePlacement === 'left' ? 'left' : 'right',
      };
    }
  }

  // Reconstruct inset facts if the LLM chose to include them
  let insetFacts: { facts: Array<{ icon: string; text: string }>; placement: 'left' | 'right' } | undefined;
  const insetFactsList: Array<{ icon: string; text: string }> = [];
  for (let i = 0; i < 3; i++) {
    const icon = data[`insetFact${i}Icon`];
    const factText = data[`insetFact${i}Text`];
    if (icon && factText) {
      insetFactsList.push({ icon, text: factText });
    }
  }
  if (insetFactsList.length > 0) {
    insetFacts = {
      facts: insetFactsList,
      placement: data.insetFactsPlacement === 'left' ? 'left' : 'right',
    };
  }

  // Resolve layout mode
  const layoutVal = data.layout as string | undefined;
  const layout: 'flow' | 'masonry' | 'columns' | undefined =
    wantsMasonry || layoutVal === 'masonry' ? 'masonry'
    : wantsColumns || layoutVal === 'columns' ? 'columns'
    : undefined;

  const reveal = wantsReveal || data.reveal === true || undefined;

  return { paragraphs, figure, insetFacts, layout, reveal };
}

// ── Timeline generator ──────────────────────────────────────────────

const TIMELINE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    event0Date: { type: Type.STRING, description: 'Date or time period for event 1' },
    event0Title: { type: Type.STRING, description: 'Short title for event 1' },
    event0Desc: { type: Type.STRING, description: '1-2 sentence description of event 1' },
    event1Date: { type: Type.STRING },
    event1Title: { type: Type.STRING },
    event1Desc: { type: Type.STRING },
    event2Date: { type: Type.STRING },
    event2Title: { type: Type.STRING },
    event2Desc: { type: Type.STRING },
    event3Date: { type: Type.STRING, nullable: true },
    event3Title: { type: Type.STRING, nullable: true },
    event3Desc: { type: Type.STRING, nullable: true },
    event4Date: { type: Type.STRING, nullable: true },
    event4Title: { type: Type.STRING, nullable: true },
    event4Desc: { type: Type.STRING, nullable: true },
    event5Date: { type: Type.STRING, nullable: true },
    event5Title: { type: Type.STRING, nullable: true },
    event5Desc: { type: Type.STRING, nullable: true },
  },
  required: [
    'event0Date', 'event0Title', 'event0Desc',
    'event1Date', 'event1Title', 'event1Desc',
    'event2Date', 'event2Title', 'event2Desc',
  ],
};

async function generateTimeline(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<TimelineBlockData['events']> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a chronological timeline for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate 3-6 events in chronological order. Each event needs a date/time period, a short title, and a 1-2 sentence description.
Use age-appropriate language for ${gradeLevel}. Dates can be exact years, decades, or relative periods.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: TIMELINE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return [{ date: '?', title: topic, description: `Key event in ${topic}` }];

  const data = JSON.parse(text);
  const events: TimelineBlockData['events'] = [];

  for (let i = 0; i < 6; i++) {
    const date = data[`event${i}Date`];
    const title = data[`event${i}Title`];
    const desc = data[`event${i}Desc`];
    if (date && title && desc) {
      events.push({ date, title, description: desc });
    }
  }

  return events.length >= 3 ? events : [{ date: '?', title: topic, description: `Key event in ${topic}` }];
}

// ── Fill-in-Blank generator ─────────────────────────────────────────

const FILL_IN_BLANK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sentence: {
      type: Type.STRING,
      description: 'A complete sentence with ONE word that will be blanked out. The blank word should be at the position indicated by blankIndex.',
    },
    blankIndex: {
      type: Type.NUMBER,
      description: 'The 0-based word index of the word to blank out (splitting by spaces).',
    },
    correctAnswer: {
      type: Type.STRING,
      description: 'The exact word that fills the blank.',
    },
    distractor0: { type: Type.STRING, description: 'Plausible wrong word 1' },
    distractor1: { type: Type.STRING, description: 'Plausible wrong word 2' },
    distractor2: { type: Type.STRING, description: 'Plausible wrong word 3' },
  },
  required: ['sentence', 'blankIndex', 'correctAnswer', 'distractor0', 'distractor1', 'distractor2'],
};

async function generateFillInBlank(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{
  sentence: string;
  blankIndex: number;
  correctAnswer: string;
  wordBank: string[];
}> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a fill-in-the-blank vocabulary question for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Write a single complete sentence about the topic. Choose ONE important vocabulary word to blank out.
The blankIndex is the 0-based position of that word when the sentence is split by spaces.
Provide 3 plausible distractors that are wrong but related to the topic.
Use age-appropriate vocabulary for ${gradeLevel}.
IMPORTANT: The blank word must be a key vocabulary term, not a common word like "the" or "is".`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: FILL_IN_BLANK_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return {
      sentence: `The key concept in ${topic} is important.`,
      blankIndex: 4,
      correctAnswer: topic.split(' ')[0],
      wordBank: [topic.split(' ')[0], 'concept', 'idea', 'theory'],
    };
  }

  const data = JSON.parse(text);

  const correctAnswer: string = data.correctAnswer;
  const words: string[] = data.sentence.split(' ');

  // Don't trust Gemini's blankIndex — find the answer word in the sentence ourselves.
  // Strip punctuation for comparison but keep the original sentence intact.
  let blankIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const stripped = words[i].replace(/[.,;:!?"'()]/g, '');
    if (stripped.toLowerCase() === correctAnswer.toLowerCase()) {
      blankIndex = i;
      break;
    }
  }

  // If the answer isn't found verbatim, fall back to Gemini's blankIndex (clamped)
  if (blankIndex === -1) {
    blankIndex = Math.max(0, Math.min(words.length - 1, Math.round(data.blankIndex)));
  }

  // Replace the answer word in the sentence so it isn't visible in the text.
  // Preserve any trailing punctuation from the original word.
  const originalWord = words[blankIndex];
  const trailingPunct = originalWord.match(/[.,;:!?"'()]+$/)?.[0] || '';
  words[blankIndex] = '______' + trailingPunct;
  const sentence = words.join(' ');

  // Build word bank: correct answer + 3 distractors, shuffled
  const wordBank = [correctAnswer, data.distractor0, data.distractor1, data.distractor2]
    .filter(Boolean)
    .sort(() => Math.random() - 0.5);

  return { sentence, blankIndex, correctAnswer, wordBank };
}

// ── Compare/Contrast generator ──────────────────────────────────────

const COMPARE_CONTRAST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    itemATitle: { type: Type.STRING, description: 'Title of first item' },
    itemAPoint0: { type: Type.STRING, description: 'First point about item A' },
    itemAPoint1: { type: Type.STRING, description: 'Second point about item A' },
    itemAPoint2: { type: Type.STRING, description: 'Third point about item A' },
    itemAPoint3: { type: Type.STRING, description: 'Fourth point about item A (optional)', nullable: true },
    itemBTitle: { type: Type.STRING, description: 'Title of second item' },
    itemBPoint0: { type: Type.STRING, description: 'First point about item B' },
    itemBPoint1: { type: Type.STRING, description: 'Second point about item B' },
    itemBPoint2: { type: Type.STRING, description: 'Third point about item B' },
    itemBPoint3: { type: Type.STRING, description: 'Fourth point about item B (optional)', nullable: true },
  },
  required: [
    'itemATitle', 'itemAPoint0', 'itemAPoint1', 'itemAPoint2',
    'itemBTitle', 'itemBPoint0', 'itemBPoint1', 'itemBPoint2',
  ],
};

async function generateCompareContrast(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{ itemA: { title: string; points: string[] }; itemB: { title: string; points: string[] } }> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a compare/contrast analysis for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Compare two related items, concepts, or perspectives. Each item gets a title and 3-4 distinct points.
Points should highlight differences and unique characteristics.
Use age-appropriate language for ${gradeLevel}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: COMPARE_CONTRAST_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return {
      itemA: { title: 'Item A', points: ['Point 1', 'Point 2', 'Point 3'] },
      itemB: { title: 'Item B', points: ['Point 1', 'Point 2', 'Point 3'] },
    };
  }

  const data = JSON.parse(text);

  const itemAPoints: string[] = [];
  const itemBPoints: string[] = [];
  for (let i = 0; i < 4; i++) {
    const ap = data[`itemAPoint${i}`];
    const bp = data[`itemBPoint${i}`];
    if (ap) itemAPoints.push(ap);
    if (bp) itemBPoints.push(bp);
  }

  return {
    itemA: { title: data.itemATitle, points: itemAPoints.length > 0 ? itemAPoints : ['No data available'] },
    itemB: { title: data.itemBTitle, points: itemBPoints.length > 0 ? itemBPoints : ['No data available'] },
  };
}

// ── Diagram generator ──────────────────────────────────────────────

const DIAGRAM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    imagePrompt: { type: Type.STRING, description: 'Detailed prompt for generating the diagram image. Describe the visual scene, layout, and key features clearly. NO text labels in the image.' },
    caption: { type: Type.STRING, description: 'Brief caption describing the diagram' },
    altText: { type: Type.STRING, description: 'Accessible alt text for the diagram image' },
    learningObjective: { type: Type.STRING, description: 'What the student should understand from this diagram' },
    label0Text: { type: Type.STRING, description: 'Label 1 name' },
    label0Desc: { type: Type.STRING, description: 'Label 1 description — what this part is and why it matters' },
    label1Text: { type: Type.STRING, description: 'Label 2 name' },
    label1Desc: { type: Type.STRING, description: 'Label 2 description' },
    label2Text: { type: Type.STRING, description: 'Label 3 name' },
    label2Desc: { type: Type.STRING, description: 'Label 3 description' },
    label3Text: { type: Type.STRING, description: 'Label 4 name' },
    label3Desc: { type: Type.STRING, description: 'Label 4 description' },
    label4Text: { type: Type.STRING, description: 'Label 5 name' },
    label4Desc: { type: Type.STRING, description: 'Label 5 description' },
    label5Text: { type: Type.STRING, description: 'Label 6 name (optional)', nullable: true },
    label5Desc: { type: Type.STRING, description: 'Label 6 description (optional)', nullable: true },
  },
  required: [
    'imagePrompt', 'caption', 'altText', 'learningObjective',
    'label0Text', 'label0Desc', 'label1Text', 'label1Desc', 'label2Text', 'label2Desc',
    'label3Text', 'label3Desc', 'label4Text', 'label4Desc',
  ],
};

const DIAGRAM_PLACEMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    label0X: { type: Type.NUMBER, description: 'Label 1 X position (0-100 percentage from left)' },
    label0Y: { type: Type.NUMBER, description: 'Label 1 Y position (0-100 percentage from top)' },
    label1X: { type: Type.NUMBER, description: 'Label 2 X position' },
    label1Y: { type: Type.NUMBER, description: 'Label 2 Y position' },
    label2X: { type: Type.NUMBER, description: 'Label 3 X position' },
    label2Y: { type: Type.NUMBER, description: 'Label 3 Y position' },
    label3X: { type: Type.NUMBER, description: 'Label 4 X position' },
    label3Y: { type: Type.NUMBER, description: 'Label 4 Y position' },
    label4X: { type: Type.NUMBER, description: 'Label 5 X position' },
    label4Y: { type: Type.NUMBER, description: 'Label 5 Y position' },
    label5X: { type: Type.NUMBER, description: 'Label 6 X position', nullable: true },
    label5Y: { type: Type.NUMBER, description: 'Label 6 Y position', nullable: true },
  },
  required: ['label0X', 'label0Y', 'label1X', 'label1Y', 'label2X', 'label2Y', 'label3X', 'label3Y', 'label4X', 'label4Y'],
};

async function generateDiagram(
  brief: string,
  topic: string,
  gradeLevel: string,
  evalMode?: string,
): Promise<{
  imageBase64: string;
  caption: string;
  altText: string;
  learningObjective: string;
  interactionMode: 'explore' | 'label';
  labels: DiagramBlockData['labels'];
}> {
  // Step 1: Generate diagram metadata (labels, image prompt)
  const metaResponse = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a labeled diagram for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate an image prompt describing the diagram visual (no text/labels in the image — labels are overlaid separately). Then generate 5-6 labels, each with a name and a 1-2 sentence description of what it is and why it matters.

IMPORTANT requirements for the image prompt:
- Specify a DARK background (dark navy, charcoal, or black) — the diagram renders on a dark UI.
- Use bright, high-contrast colors for the diagram elements (glowing lines, vivid fills) so features pop against the dark background.
- Describe spatially distinct features spread across the image so labels don't cluster.
- NO text, labels, or annotations in the image itself.
- Think scientific illustration style: precise, beautiful, luminous on dark.

IMPORTANT: Generate at least 5 labels. 3 is not enough — dig into the topic's spatial details. For example, a double-slit experiment needs: coherent light source, collimating slit, double slit barrier, slit separation, constructive interference fringes, destructive interference fringes, detection screen, path length difference. Pick the 5-6 most important.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: DIAGRAM_SCHEMA,
    },
  });

  const metaText = metaResponse.text;
  if (!metaText) {
    throw new Error('Diagram meta generation returned empty');
  }

  const meta = JSON.parse(metaText);

  // Reconstruct labels
  const labels: DiagramBlockData['labels'] = [];
  for (let i = 0; i < 6; i++) {
    const text = meta[`label${i}Text`];
    const desc = meta[`label${i}Desc`];
    if (text && desc) {
      labels.push({ id: `label-${i}`, text, description: desc });
    }
  }

  if (labels.length === 0) {
    throw new Error('Diagram generated no labels');
  }

  // Determine interaction mode from eval mode
  const interactionMode: 'explore' | 'label' =
    evalMode === 'apply' || evalMode === 'analyze' ? 'label' : 'explore';

  // Step 2: Generate the diagram image
  const imagePrompt = `Educational diagram for ${gradeLevel} students: ${meta.imagePrompt}. DARK BACKGROUND (dark navy or charcoal). Bright, luminous, high-contrast diagram elements. Scientific illustration style. Clean, professional, clearly showing distinct spatial features. Do NOT include any text, labels, or annotations in the image.`;
  const imageBase64 = await generateImage(imagePrompt);

  if (!imageBase64) {
    throw new Error('Diagram image generation failed');
  }

  // Step 3 (explore mode only): Vision model places labels on the image
  if (interactionMode === 'explore') {
    try {
      const labelList = labels.map((l, i) => `${i + 1}. "${l.text}"`).join('\n');

      const placementResponse = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                data: imageBase64.replace(/^data:image\/[^;]+;base64,/, ''),
              },
            },
            {
              text: `Look at this educational diagram image. Place each of these labels at the correct position on the image. Return X and Y as percentages (0-100) where 0,0 is the top-left corner.

Labels to place:
${labelList}

For each label, identify the feature it describes in the image and return the center position of that feature as a percentage of the image dimensions.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: DIAGRAM_PLACEMENT_SCHEMA,
        },
      });

      const placementText = placementResponse.text;
      if (placementText) {
        const positions = JSON.parse(placementText);
        for (let i = 0; i < labels.length; i++) {
          const x = positions[`label${i}X`];
          const y = positions[`label${i}Y`];
          if (typeof x === 'number' && typeof y === 'number') {
            labels[i].position = {
              x: Math.max(5, Math.min(95, x)),
              y: Math.max(5, Math.min(95, y)),
            };
          }
        }
      }
    } catch (error) {
      console.warn('[DeepDive] Diagram label placement failed, falling back to grid layout:', error);
      // Fallback: distribute labels evenly across the image
      labels.forEach((label, i) => {
        const cols = Math.min(3, labels.length);
        const row = Math.floor(i / cols);
        const col = i % cols;
        label.position = {
          x: 20 + (col * 60) / Math.max(1, cols - 1),
          y: 25 + (row * 50) / Math.max(1, Math.ceil(labels.length / cols) - 1),
        };
      });
    }
  }

  return {
    imageBase64,
    caption: meta.caption,
    altText: meta.altText,
    learningObjective: meta.learningObjective,
    interactionMode,
    labels,
  };
}

// ── MiniSim generator ─────────────────────────────────────────────

const MINI_SIM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    scenario: { type: Type.STRING, description: 'Setup context — describes the experiment/scenario in 2-3 sentences' },
    controlType: { type: Type.STRING, description: 'Either "toggle" or "slider"' },
    controlLabel: { type: Type.STRING, description: 'Label displayed above the control' },
    toggleOffLabel: { type: Type.STRING, description: 'Label for OFF state (toggle only)', nullable: true },
    toggleOnLabel: { type: Type.STRING, description: 'Label for ON state (toggle only)', nullable: true },
    sliderMin: { type: Type.NUMBER, description: 'Slider minimum value', nullable: true },
    sliderMax: { type: Type.NUMBER, description: 'Slider maximum value', nullable: true },
    sliderStep: { type: Type.NUMBER, description: 'Slider step increment', nullable: true },
    sliderUnit: { type: Type.STRING, description: 'Slider value unit (e.g., "nm", "°C")', nullable: true },
    sliderDefault: { type: Type.NUMBER, description: 'Slider starting value', nullable: true },
    state0Condition: { type: Type.STRING, description: 'State 0 condition: "off"/"on" for toggle, or "min-max" range for slider' },
    state0Title: { type: Type.STRING, description: 'State 0 title — short label for what happens' },
    state0Description: { type: Type.STRING, description: 'State 0 description — what the student observes (2-3 sentences)' },
    state0KeyObservation: { type: Type.STRING, description: 'State 0 key insight — the conceptual "aha" moment (1 sentence)' },
    state1Condition: { type: Type.STRING, description: 'State 1 condition' },
    state1Title: { type: Type.STRING, description: 'State 1 title' },
    state1Description: { type: Type.STRING, description: 'State 1 description' },
    state1KeyObservation: { type: Type.STRING, description: 'State 1 key insight' },
    state2Condition: { type: Type.STRING, description: 'State 2 condition (optional, slider only)', nullable: true },
    state2Title: { type: Type.STRING, description: 'State 2 title', nullable: true },
    state2Description: { type: Type.STRING, description: 'State 2 description', nullable: true },
    state2KeyObservation: { type: Type.STRING, description: 'State 2 key insight', nullable: true },
    predictionQuestion: { type: Type.STRING, description: 'Question asked BEFORE the student manipulates: "What do you think will happen when X?"' },
    predictionOption0: { type: Type.STRING, description: 'Prediction option A' },
    predictionOption1: { type: Type.STRING, description: 'Prediction option B' },
    predictionOption2: { type: Type.STRING, description: 'Prediction option C' },
    predictionOption3: { type: Type.STRING, description: 'Prediction option D' },
    predictionCorrectIndex: { type: Type.NUMBER, description: 'Index (0-3) of the correct prediction option' },
    predictionExplanation: { type: Type.STRING, description: 'Explanation of why the correct prediction is right — revealed after the student answers' },
  },
  required: [
    'scenario', 'controlType', 'controlLabel',
    'state0Condition', 'state0Title', 'state0Description', 'state0KeyObservation',
    'state1Condition', 'state1Title', 'state1Description', 'state1KeyObservation',
    'predictionQuestion', 'predictionOption0', 'predictionOption1',
    'predictionOption2', 'predictionOption3', 'predictionCorrectIndex', 'predictionExplanation',
  ],
};

async function generateMiniSim(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<MiniSimBlockData['states'] extends (infer _) ? {
  scenario: string;
  controlType: 'toggle' | 'slider';
  controlLabel: string;
  toggleOffLabel?: string;
  toggleOnLabel?: string;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderUnit?: string;
  sliderDefault?: number;
  states: MiniSimBlockData['states'];
  prediction: NonNullable<MiniSimBlockData['prediction']>;
} : never> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate an interactive mini-simulation for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

A MiniSim lets the student manipulate ONE variable and observe what changes. The goal is to build intuition through experimentation, not memorization.

Design a simulation where:
1. There is ONE control — either a toggle (on/off binary) or a slider (continuous range).
2. Changing the control reveals different observable states (2 for toggle, 2-3 for slider).
3. Each state has a title, description of what the student observes, and a key insight.
4. A PREDICTION QUESTION is asked BEFORE the student can manipulate — "What do you think will happen when X?" with 4 options.

For toggles: states should have conditions "off" and "on".
For sliders: states should have conditions as "min-max" range strings (e.g., "0-33", "34-66", "67-100").

The prediction question should test the student's mental model — the kind of question where many students would guess wrong because the answer is counterintuitive.

IMPORTANT: The prediction must have exactly 4 options, one correct. The correctIndex is 0-based.
Use age-appropriate language for ${gradeLevel}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: MINI_SIM_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('MiniSim generation returned empty');
  }

  const data = JSON.parse(text);

  const controlType: 'toggle' | 'slider' = data.controlType === 'slider' ? 'slider' : 'toggle';

  // Reconstruct states
  const states: MiniSimBlockData['states'] = [];
  for (let i = 0; i < 3; i++) {
    const cond = data[`state${i}Condition`];
    const title = data[`state${i}Title`];
    const desc = data[`state${i}Description`];
    const obs = data[`state${i}KeyObservation`];
    if (cond && title && desc && obs) {
      states.push({ condition: cond, title, description: desc, keyObservation: obs });
    }
  }

  if (states.length < 2) {
    throw new Error('MiniSim generated fewer than 2 states');
  }

  const prediction = {
    question: data.predictionQuestion,
    options: [data.predictionOption0, data.predictionOption1, data.predictionOption2, data.predictionOption3].filter(Boolean),
    correctIndex: Math.max(0, Math.min(3, Math.round(data.predictionCorrectIndex))),
    explanation: data.predictionExplanation,
  };

  return {
    scenario: data.scenario,
    controlType,
    controlLabel: data.controlLabel,
    ...(controlType === 'toggle' && {
      toggleOffLabel: data.toggleOffLabel,
      toggleOnLabel: data.toggleOnLabel,
    }),
    ...(controlType === 'slider' && {
      sliderMin: data.sliderMin,
      sliderMax: data.sliderMax,
      sliderStep: data.sliderStep,
      sliderUnit: data.sliderUnit,
      sliderDefault: data.sliderDefault,
    }),
    states,
    prediction,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Assembly: Orchestrate + Generate in Parallel
// ═══════════════════════════════════════════════════════════════════════

async function generateBlock(
  plan: OrchestratorBlockPlan,
  index: number,
  topic: string,
  gradeLevel: string,
  evalMode?: string,
): Promise<DeepDiveBlock | null> {
  const baseId = `block-${index}`;

  try {
    switch (plan.blockType as BlockType) {
      case 'hero-image': {
        const imagePrompt = `Educational illustration for ${gradeLevel} students: ${plan.brief}. Clean, professional, visually engaging. No text overlays.`;
        const imageBase64 = await generateImage(imagePrompt);
        return {
          id: baseId,
          blockType: 'hero-image',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          imageBase64: imageBase64 || '',
          caption: plan.brief.slice(0, 200),
          altText: `Visual illustration for ${topic}`,
        } as HeroImageBlockData;
      }

      case 'key-facts': {
        const facts = await generateKeyFacts(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'key-facts',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          facts,
        } as KeyFactsBlockData;
      }

      case 'data-table': {
        const tableData = await generateDataTable(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'data-table',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          headers: tableData.headers,
          rows: tableData.rows,
          caption: tableData.caption,
        } as DataTableBlockData;
      }

      case 'pull-quote': {
        // No Gemini call — the orchestrator generates quote content inline
        return {
          id: baseId,
          blockType: 'pull-quote',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          text: plan.brief,
          attribution: plan.label,
        } as PullQuoteBlockData;
      }

      case 'prose': {
        const proseData = await generateProse(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'prose',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          paragraphs: proseData.paragraphs,
          figure: proseData.figure,
          insetFacts: proseData.insetFacts,
          layout: proseData.layout,
          reveal: proseData.reveal,
        } as ProseBlockData;
      }

      case 'multiple-choice': {
        const mcData = await generateMultipleChoice(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'multiple-choice',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          question: mcData.question,
          options: mcData.options,
          correctIndex: mcData.correctIndex,
          explanation: mcData.explanation,
        } as MultipleChoiceBlockData;
      }

      case 'timeline': {
        const events = await generateTimeline(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'timeline',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          events,
        } as TimelineBlockData;
      }

      case 'fill-in-blank': {
        const fibData = await generateFillInBlank(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'fill-in-blank',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          sentence: fibData.sentence,
          blankIndex: fibData.blankIndex,
          correctAnswer: fibData.correctAnswer,
          wordBank: fibData.wordBank,
        } as FillInBlankBlockData;
      }

      case 'compare-contrast': {
        const ccData = await generateCompareContrast(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'compare-contrast',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          itemA: ccData.itemA,
          itemB: ccData.itemB,
        } as CompareContrastBlockData;
      }

      case 'diagram': {
        const diagramData = await generateDiagram(plan.brief, topic, gradeLevel, evalMode);
        return {
          id: baseId,
          blockType: 'diagram',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          imageBase64: diagramData.imageBase64,
          caption: diagramData.caption,
          altText: diagramData.altText,
          interactionMode: diagramData.interactionMode,
          labels: diagramData.labels,
          learningObjective: diagramData.learningObjective,
        } as DiagramBlockData;
      }

      case 'mini-sim': {
        const simData = await generateMiniSim(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'mini-sim',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          ...simData,
        } as MiniSimBlockData;
      }

      default:
        console.warn(`[DeepDive] Unknown block type: ${plan.blockType}`);
        return null;
    }
  } catch (error) {
    console.error(`[DeepDive] Failed to generate block ${index} (${plan.blockType}):`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════════════════════════════════

export async function generateDeepDive(
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string; templateId?: string; layoutOverride?: string }>,
): Promise<DeepDiveData> {
  const evalMode = config?.targetEvalMode;
  const templateId = config?.templateId;
  const layoutOverride = config?.layoutOverride;

  console.log(`[DeepDive] Starting orchestration for "${topic}" (grade: ${gradeLevel}, eval: ${evalMode || 'default'})`);

  // Stage 1: Orchestrator plans the blocks
  const plan = await runOrchestrator(topic, gradeLevel, evalMode, templateId);
  // Resolve layout — explicit override > orchestrator choice > default stack
  const validLayouts = new Set(['stack', 'grid_2col', 'reveal_progressive', 'masonry']);
  const resolvedLayout: WrapperLayout = (layoutOverride && validLayouts.has(layoutOverride))
    ? layoutOverride as WrapperLayout
    : validLayouts.has(plan.layout) ? plan.layout as WrapperLayout : 'stack';
  console.log(`[DeepDive] Orchestrator planned ${plan.blocks.length} blocks (layout: ${resolvedLayout}): ${plan.blocks.map((b) => b.blockType).join(', ')}`);

  // Stage 2: Generate all blocks in parallel
  const blockPromises = plan.blocks.map((blockPlan, index) =>
    generateBlock(blockPlan, index, topic, gradeLevel, evalMode),
  );

  const generatedBlocks = await Promise.all(blockPromises);

  // Filter out failed blocks
  const validBlocks = generatedBlocks.filter((b): b is DeepDiveBlock => b !== null);

  const rejected = generatedBlocks.length - validBlocks.length;
  if (rejected > 0) {
    console.warn(`[DeepDive] ${rejected} block(s) failed generation and were filtered out`);
  }

  if (validBlocks.length === 0) {
    // Hardcoded fallback — should never happen but prevents empty render
    return {
      title: `Deep Dive: ${topic}`,
      subtitle: 'Content generation encountered an issue. Please try again.',
      topic,
      gradeLevel,
      blocks: [
        {
          id: 'fallback-0',
          blockType: 'key-facts',
          label: 'Key Facts',
          facts: [{ icon: '\u26A0\uFE0F', text: `We couldn't generate content for "${topic}". Please try again.` }],
        } as KeyFactsBlockData,
      ],
    };
  }

  console.log(`[DeepDive] Successfully assembled ${validBlocks.length} blocks`);

  return {
    title: plan.title,
    subtitle: plan.subtitle,
    topic,
    gradeLevel,
    narrativeArc: plan.narrativeArc,
    layout: resolvedLayout,
    blocks: validBlocks,
  };
}
