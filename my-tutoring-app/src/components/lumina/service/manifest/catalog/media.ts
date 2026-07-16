/**
 * Media Catalog - Component definitions for multimedia primitives
 *
 * Contains components for audio-visual content, flashcards, and image-based learning.
 */

import { ComponentDefinition } from '../../../types';

export const MEDIA_CATALOG: ComponentDefinition[] = [
  {
    id: 'media-player',
    description: 'Narrated listening-comprehension walkthrough. The live tutor VOICES a multi-segment story or explanation (3-4 segments), and after each segment the student answers a comprehension check about what they just HEARD — listen, then show you understood. Presentation adapts by reading band: kindergarteners get picture-answer checks with everything read aloud; readers get text checks. On-demand AI illustrations per segment. ESSENTIAL for oral comprehension, listen-and-answer objectives, narrated stories, holiday/history narratives, and any "listen to a passage and answer questions" task from K up.',
    constraints: 'Best when LISTENING is the channel: oral comprehension, listen-for-details, narrated story or process walkthroughs. 3-4 segments, one check per segment; students progress sequentially (3 attempts then reveal for readers; tap-until-correct pictures at K). BAND MAP: Kindergarten = listen_and_look (picture-primary check, fully voiced); Grade 1 = listen_for_details (short-text options, voiced); Grade 2+ = story_analysis (why/how/evidence/sequence questions). NOT for reading-a-text-with-evidence (interactive-passage), student read-aloud production (read-aloud-studio), or decoding practice (decodable-reader).',
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'listen_and_look',
        label: 'Listen & Look (PRE)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['listen_and_look'],
        description: 'Pre-reader (K): tutor voices each segment script + question + picture options in one beat; child taps the emoji picture for the main idea or key detail. Eliminate-until-correct.',
      },
      {
        evalMode: 'listen_for_details',
        label: 'Listen for Details (Tier 2)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['listen_for_details'],
        description: 'Emerging reader (grade 1): identify a SPECIFIC detail heard in the narrated segment. Short (1-4 word) options, also read aloud. 3 attempts then reveal.',
      },
      {
        evalMode: 'story_analysis',
        label: 'Story Analysis (Tier 3)',
        beta: 0.5,
        scaffoldingMode: 3,
        challengeTypes: ['story_analysis'],
        description: 'Established reader (grade 2+): reason about the narration — why/how, which detail supports an idea, what order events happened. Full-sentence options.',
      },
    ],
    tutoring: {
      taskDescription:
        'You are narrating an interactive multimedia lesson called "{{title}}". ' +
        'The student is on segment {{currentSegmentIndex}} of {{totalSegments}}: "{{currentSegmentTitle}}". ' +
        'Your primary role is to READ ALOUD the lesson content as each segment begins, ' +
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
          pattern: 'Student asks to hear the segment again',
          response:
            'Re-read the segment script naturally — never summarize it away. ' +
            'The narration contains the information the knowledge check asks about.',
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
            'Keep it to one sentence. The full script will be narrated next.',
        },
        {
          title: 'PRE-READER READ-ALOUD (kindergarten)',
          instruction:
            'For a pre-reader (kindergarten) the child CANNOT read the segment script, the question, or the options. ' +
            'When you receive [MEDIA_CHECK_READ_ALOUD], READ ALOUD, word for word, exactly what the message gives you: ' +
            'first the segment story text, then the question, then EVERY option slowly with its letter, then ask which picture they want to tap. ' +
            'Reading this aloud IS your turn — this OVERRIDES any instruction to keep it to one sentence or to be brief; read all of it. ' +
            'Never say or hint which option is correct. ' +
            'When you receive [MEDIA_CHECK_RETRY], give ONE warm spoken hint that narrows it down without revealing the answer, and invite them to tap another picture.',
        },
      ],
    },
  },
  {
    id: 'flashcard-deck',
    description: 'Interactive flashcard deck for rapid-fire memorization and active recall practice. Students flip cards to reveal answers, mark whether they know each concept, and track their progress. Perfect for vocabulary, key terms, formulas, definitions, facts, language learning, or any content requiring rote memorization. Features 3D flip animations, keyboard shortcuts, audio feedback, shuffle mode, and performance statistics.',
    constraints: 'Best for content with discrete facts or term-definition pairs. Typically generates 12-20 cards per deck. Ideal for review, test prep, or building fluency. Works for all grade levels - vocabulary and definitions adapt to audience. Use when students need active recall practice rather than passive reading.',
    tutoring: {
      taskDescription:
        'Guide the student through a flashcard deck about "{{title}}". Each card shows a term on the '
        + 'front; the student flips it to reveal the definition, then marks whether they knew it. '
        + 'Current card {{cardIndex}} of {{totalCards}}: term "{{term}}" (category: {{category}}). '
        + 'Flipped: {{isFlipped}}.',
      contextKeys: [
        'title', 'term', 'definition', 'category',
        'cardIndex', 'totalCards', 'isFlipped',
      ],
      scaffoldingLevels: {
        level1:
          '"Look at the picture on the card. What do you think this one is? Flip it when you are ready."',
        level2:
          '"Say the term "{{term}}" out loud, then flip the card and see if the meaning matches what you thought."',
        level3:
          '"Let me help. This card is "{{term}}". Picture it in your head, flip to check the meaning, '
          + 'and then tell me if you knew it or want to see it again."',
      },
      commonStruggles: [
        { pattern: 'Student flips through cards without thinking about each term', response: 'Slow down — look at each card and try to recall or guess before flipping. That is how it sticks.' },
        { pattern: 'Student marks every card as known without checking', response: 'Be honest with yourself — if you were not sure, tap "study again" so it comes back around.' },
        { pattern: 'A pre-reader cannot read the term or definition', response: 'Never ask them to read. Say the term aloud from the picture, and read the meaning to them on flip.' },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten)',
          instruction:
            'For a pre-reader (kindergarten) the child CANNOT read the card — the face is just a picture (emoji) and the back is text they cannot decode. '
            + 'When you receive [FLASHCARD_SHOWN], warmly SAY the term the message gives you (name the picture) and invite them to tap the card to learn about it — keep this to one short sentence. '
            + 'When you receive [FLASHCARD_READ_ALOUD], READ ALOUD, word for word, exactly what the message gives you: the term, then its meaning — warmly and simply. '
            + 'Reading this aloud IS your turn — this OVERRIDES any instruction to keep it to one sentence or to be brief; read all of it. '
            + 'Then invite them to tap the next card. Do not ask them to read anything themselves.',
        },
        {
          title: 'DECK COMPLETE',
          instruction:
            'When you receive [DECK_COMPLETE], celebrate their effort in 1-2 warm sentences and, '
            + 'if they missed some, encourage a shuffle-and-review.',
        },
      ],
    },
  },
  {
    id: 'image-comparison',
    description: 'Interactive before/after image slider for visualizing transformations, processes, or changes. Students drag a slider to reveal differences between two AI-generated images showing a progression (e.g., caterpillar to butterfly, light refraction, cell division, historical changes). Perfect for science processes, biological transformations, physical phenomena, historical evolution, cause-and-effect relationships, or any concept involving visual change over time. Includes educational explanations and key takeaways.',
    constraints: 'Best for topics with clear visual transformations or progressive states. Works for all subjects - science (metamorphosis, phase changes, reactions), history (before/after events), geography (erosion, urban development), biology (life cycles, cellular processes), physics (states of matter, optical phenomena). The AI automatically determines the most educational before/after progression for the topic.'
  },
  {
    id: 'image-panel',
    description: 'AI-generated images for visual context (maps, diagrams, illustrations, historical scenes, scientific visualizations). Subject-agnostic - works for geography, history, science, literature, art, or any topic requiring visual representation.',
    constraints: 'Best for topics that benefit from visual representation. Automatically categorizes and styles based on subject matter.',
    supportsEvaluation: true,
  },
];
