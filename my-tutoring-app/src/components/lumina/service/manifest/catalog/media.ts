/**
 * Media Catalog - Component definitions for multimedia primitives
 *
 * Contains components for audio-visual content, flashcards, and image-based learning.
 */

import { ComponentDefinition } from '../../../types';

export const MEDIA_CATALOG: ComponentDefinition[] = [
  {
    id: 'media-player',
    description: 'Interactive audio-visual lesson player with synchronized narration, images, and segment-by-segment knowledge checks. Multi-segment presentation where each segment has AI-generated voiceover narration, accompanying visuals, and a comprehension question to verify understanding. Students must answer correctly (or exhaust 3 attempts) to unlock the next segment. Perfect for step-by-step explanations, processes, stories, or any content that benefits from multimedia presentation with active learning verification. Features play/pause controls, progress tracking, segment navigation, and built-in evaluation for student performance analytics. ESSENTIAL for interactive multimedia learning experiences with comprehension tracking.',
    constraints: 'Best for topics that benefit from sequential, narrative-driven explanation with comprehension checks (processes, stories, step-by-step concepts). Each lesson typically has 3-4 segments. Each segment includes one multiple-choice knowledge check question. Best for grades 3+ due to knowledge check reading requirements. Students progress through segments sequentially and can retry questions up to 3 times before seeing the answer.',
    tutoring: {
      taskDescription:
        'You are narrating an interactive multimedia lesson called "{{title}}". ' +
        'The student is on segment {{currentSegmentIndex}} of {{totalSegments}}: "{{currentSegmentTitle}}". ' +
        'Your primary role is to READ ALOUD the lesson content when the student presses play, ' +
        'and to READ the knowledge check questions and answer options when they appear. ' +
        'Speak naturally and engagingly as if you are the narrator of this lesson.',
      contextKeys: [
        'title',
        'currentSegmentIndex',
        'totalSegments',
        'currentSegmentTitle',
        'currentSegmentScript',
        'segmentPhase',
        'hasKnowledgeCheck',
        'knowledgeCheckQuestion',
        'knowledgeCheckOptions',
      ],
      scaffoldingLevels: {
        level1:
          '"Ask the student to think about what they just heard. ' +
          'For example: What stood out to you in that section?"',
        level2:
          '"Reread a key sentence from the segment script and ask the student to connect it ' +
          'to the knowledge check question. Reference {{currentSegmentTitle}} specifically."',
        level3:
          '"Walk through the segment content step by step, highlighting the key fact that ' +
          'answers the knowledge check. Point to specific details from the narration without ' +
          'directly giving the answer."',
      },
      commonStruggles: [
        {
          pattern: 'Student submits wrong answer on first attempt',
          response:
            'Encourage them to listen to the segment again using the replay button. ' +
            'Highlight which part of the narration relates to the question.',
        },
        {
          pattern: 'Student submits wrong answer on second attempt',
          response:
            'Narrow it down to two choices. Restate the relevant part of the script ' +
            'and ask them which option matches.',
        },
        {
          pattern: 'Student reaches max attempts without correct answer',
          response:
            'Read the correct answer aloud with the explanation. Reassure them that ' +
            'learning from mistakes is part of the process.',
        },
        {
          pattern: 'Student skips ahead without playing audio',
          response:
            'Gently remind them to press play and listen to the narration first — ' +
            'the audio contains important information for the knowledge check.',
        },
      ],
      aiDirectives: [
        {
          title: 'READ ALOUD MODE',
          instruction:
            'When you receive [READ_ALOUD], you MUST read the provided segment content ' +
            'aloud in a clear, engaging, narrator-style voice. Read the FULL text naturally. ' +
            'Do NOT summarize or paraphrase — read the actual script content provided. ' +
            'Add brief, natural transitions like "Let\'s learn about..." at the start.',
        },
        {
          title: 'KNOWLEDGE CHECK NARRATION',
          instruction:
            'When you receive [READ_KNOWLEDGE_CHECK], read the question aloud clearly, ' +
            'then read each answer option prefixed by its letter (A, B, C, D). ' +
            'Do NOT hint at which answer is correct. Keep your tone neutral and encouraging.',
        },
        {
          title: 'SEGMENT TRANSITIONS',
          instruction:
            'When you receive [NEXT_SEGMENT], briefly introduce the new segment by title. ' +
            'Keep it to one sentence. The student will press play to hear the full content.',
        },
      ],
    },
  },
  {
    id: 'flashcard-deck',
    description: 'Interactive flashcard deck for rapid-fire memorization and active recall practice. Students flip cards to reveal answers, mark whether they know each concept, and track their progress. Perfect for vocabulary, key terms, formulas, definitions, facts, language learning, or any content requiring rote memorization. Features 3D flip animations, keyboard shortcuts, audio feedback, shuffle mode, and performance statistics.',
    constraints: 'Best for content with discrete facts or term-definition pairs. Typically generates 12-20 cards per deck. Ideal for review, test prep, or building fluency. Works for all grade levels - vocabulary and definitions adapt to audience. Use when students need active recall practice rather than passive reading.'
  },
  {
    id: 'image-comparison',
    description: 'Interactive before/after image slider for visualizing transformations, processes, or changes. Students drag a slider to reveal differences between two AI-generated images showing a progression (e.g., caterpillar to butterfly, light refraction, cell division, historical changes). Perfect for science processes, biological transformations, physical phenomena, historical evolution, cause-and-effect relationships, or any concept involving visual change over time. Includes educational explanations and key takeaways.',
    constraints: 'Best for topics with clear visual transformations or progressive states. Works for all subjects - science (metamorphosis, phase changes, reactions), history (before/after events), geography (erosion, urban development), biology (life cycles, cellular processes), physics (states of matter, optical phenomena). The AI automatically determines the most educational before/after progression for the topic.'
  },
  {
    id: 'image-panel',
    description: 'AI-generated images for visual context (maps, diagrams, illustrations, historical scenes, scientific visualizations). Subject-agnostic - works for geography, history, science, literature, art, or any topic requiring visual representation.',
    constraints: 'Best for topics that benefit from visual representation. Automatically categorizes and styles based on subject matter.'
  },
];
