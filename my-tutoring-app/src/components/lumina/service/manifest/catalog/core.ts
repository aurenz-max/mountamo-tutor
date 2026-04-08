/**
 * Core Catalog - Essential component definitions used across all topics
 *
 * Contains foundational components like curator brief, concept cards,
 * tables, comparisons, and general-purpose primitives.
 */

import { ComponentDefinition } from '../../../types';

export const CORE_CATALOG: ComponentDefinition[] = [
  {
    id: 'curator-brief',
    description: 'Introduction, learning objectives, and hook. REQUIRED: Always include this first.',
    constraints: 'Must be first component'
  },
  {
    id: 'concept-card-grid',
    description: 'A set of 3-4 distinct key terms or concepts defined with visuals. Use for vocabulary or core principles.',
    tutoring: {
      taskDescription:
        'Guide the student through a set of concept cards. Each card has a front side (visual image + title) '
        + 'and a back side (definition, component breakdown, curiosity note). The student flips cards by clicking '
        + 'to explore key concepts. Current card: "{{title}}". Card {{cardIndex}} of {{totalCards}}.',
      contextKeys: [
        'title', 'definition', 'conceptElementLabels',
        'curiosityNote', 'timelineContext',
        'cardIndex', 'totalCards', 'isFlipped',
      ],
      scaffoldingLevels: {
        level1:
          '"Look at the visual on the card. What do you think this concept might be about?"',
        level2:
          '"Flip the card and read the definition of {{title}}. '
          + 'Can you find the key elements that make up this concept?"',
        level3:
          '"Let me walk you through this. {{title}} — read the definition at the top first. '
          + 'Then look at each component in the breakdown section. '
          + 'The curiosity note at the bottom has an interesting extra detail."',
      },
      commonStruggles: [
        { pattern: 'Student flips cards quickly without reading the back content', response: 'Slow down and read the full definition and component breakdown. Each element is important for understanding the concept.' },
        { pattern: 'Student only explores one card and ignores the others', response: 'Make sure to explore all the concept cards. Each one covers a different key term you need to know.' },
        { pattern: 'Student does not scroll down to the curiosity note', response: 'Don\'t miss the curiosity note at the bottom — it has a fascinating extra detail about this concept.' },
      ],
      aiDirectives: [
        {
          title: 'CARD EXPLORATION',
          instruction:
            'When you receive [CARD_FLIPPED], introduce the concept on the card the student just flipped. '
            + 'Mention the title and briefly highlight what to look for in the definition and component breakdown. '
            + 'If this is the first card the student explores, welcome them to the concept cards section. '
            + 'Keep it to 1-2 conversational sentences.',
        },
        {
          title: 'CARD RETURNED',
          instruction:
            'When you receive [CARD_RETURNED], briefly ask the student what they learned or found interesting. '
            + 'Encourage them to explore the next card if there are more to explore. '
            + 'Keep it to 1 sentence.',
        },
      ],
    },
  },
  {
    id: 'comparison-panel',
    description: 'Side-by-side comparison of two entities. Use when distinct "A vs B" analysis aids understanding.',
    tutoring: {
      taskDescription:
        'Guide the student through a side-by-side comparison of "{{item1Name}}" vs "{{item2Name}}". '
        + 'Topic: {{title}}. The student explores each card by clicking it, then answers true/false '
        + 'comprehension gates to unlock the synthesis section. '
        + 'Exploration status: Item 1 explored={{item1Explored}}, Item 2 explored={{item2Explored}}. '
        + 'Gates: {{currentGateIndex}} of {{totalGates}} completed.',
      contextKeys: [
        'title', 'item1Name', 'item2Name',
        'item1Explored', 'item2Explored',
        'currentGateIndex', 'totalGates',
        'currentGateQuestion', 'allGatesCompleted',
      ],
      scaffoldingLevels: {
        level1:
          '"Take a look at both options. What stands out to you about each one?"',
        level2:
          '"Compare the key features of {{item1Name}} and {{item2Name}}. '
          + 'What is different? What do they have in common?"',
        level3:
          '"Let me walk you through this. {{item1Name}} is known for its key features — read through them. '
          + 'Then do the same for {{item2Name}}. We\'ll compare them together."',
      },
      commonStruggles: [
        { pattern: 'Student only clicks one card and does not explore the other', response: 'Make sure to click and read both cards! You need to understand both options before the quiz.' },
        { pattern: 'Student selects wrong answer on true/false gate', response: 'Go back and re-read the key features on both cards. The answer is in the material you explored.' },
        { pattern: 'Student rushes through without reading card details', response: 'Slow down and read through the key features. Each point is important for understanding the comparison.' },
        { pattern: 'Student struggles with synthesis concepts', response: 'Think about what makes each option unique, and what they share. The differences and similarities are the key takeaways.' },
      ],
      aiDirectives: [
        {
          title: 'CARD EXPLORATION WALKTHROUGH',
          instruction:
            'When you receive [ITEM_EXPLORED], walk the student through the material on that card. '
            + 'Mention the item name and highlight 1-2 of its key features in a conversational way. '
            + 'If this is the first card explored, build curiosity about the other card. '
            + 'If both cards are now explored, congratulate and prepare them for the comprehension check. '
            + 'Keep it to 2-3 sentences.',
        },
        {
          title: 'GATE QUESTION PRESENTATION',
          instruction:
            'When you receive [GATE_OPENED], read the true/false question aloud to the student. '
            + 'Encourage them to think carefully about what they just read before answering. '
            + 'Do NOT hint at the correct answer. Keep it to 1-2 sentences.',
        },
        {
          title: 'GATE ANSWER FEEDBACK',
          instruction:
            'When you receive [GATE_CORRECT], briefly celebrate and acknowledge the correct answer. '
            + 'When you receive [GATE_INCORRECT], encourage the student to re-read the material and try again. '
            + 'Do NOT reveal the answer on incorrect attempts. Keep feedback to 1-2 sentences.',
        },
        {
          title: 'SYNTHESIS WALKTHROUGH',
          instruction:
            'When you receive [SYNTHESIS_UNLOCKED], congratulate the student on completing all gates. '
            + 'Walk them through the synthesis section: mention the main insight, then briefly highlight '
            + 'the key differences and similarities. Keep it engaging and conversational, 3-4 sentences.',
        },
        {
          title: 'FINAL CARDS WALKTHROUGH',
          instruction:
            'When you receive [FINAL_CARDS], speak about the "When to Use Each" and/or '
            + '"Common Misconception" sections. Help the student understand when each option '
            + 'is appropriate and clear up the misconception. Keep it to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'generative-table',
    description: 'Structured rows/columns. Use for datasets, timelines, or categorical attributes.',
  },
  {
    id: 'custom-visual',
    description: 'A bespoke HTML/JS simulation or SVG diagram. Use for complex systems (biology, physics, counting games) that standard math visuals cannot handle. TIP: Provide config with subject, keyTerms, and conceptsCovered for richer content.',
  },
  {
    id: 'formula-card',
    description: 'Mathematical formula display with LaTeX. Use for equations, theorems, or scientific formulas.',
    constraints: 'Requires mathematical formulas',
  },
  {
    id: 'feature-exhibit',
    description: 'Static editorial section with subsections. Legacy — prefer deep-dive for comprehensive topic exploration.',
    supportsEvaluation: true,
  },
  {
    id: 'annotated-example',
    description: 'Step-by-step worked example with multi-layer annotations (procedural steps, strategic thinking, common errors, conceptual connections). Use for demonstrating problem-solving processes in math, science, or any domain requiring systematic reasoning.',
    constraints: 'Best for elementary and above. Requires a well-defined problem with clear solution steps.',
  },
  {
    id: 'take-home-activity',
    description: 'Hands-on activity using common household materials. Screen-free learning experience with step-by-step instructions, safety notes, reflection prompts, and optional extensions. Perfect for reinforcing concepts through kinesthetic learning and real-world application.',
    constraints: 'Best for science experiments, math manipulatives, art projects, or any topic that benefits from hands-on exploration. Automatically adapts complexity and safety guidance to grade level.',
  },
  {
    id: 'graph-board',
    description: 'Interactive polynomial graphing board where users plot points and visualize fitted polynomial curves. Use for algebra, functions, data analysis, or polynomial interpolation concepts.',
    constraints: 'Best for middle-school and above. Requires mathematical/data analysis context.',
  },
  {
    id: 'foundation-explorer',
    description: 'Objective-driven concept exploration with clear diagrams, definitions, and self-checks. Shows a central diagram with multiple labeled concepts that students explore one at a time. Self-check questions match the learning objective verb (IDENTIFY, EXPLAIN, APPLY). BEST for IDENTIFY objectives where students need to learn foundational vocabulary and recognize key parts/components of a system. Use when introducing 2-4 core concepts that students must master before deeper learning.',
    constraints: 'Best for IDENTIFY and EXPLAIN objectives. Requires 2-4 foundational concepts with clear visual representations. Works across all subjects: science (parts of a cell), engineering (parts of a lever), language arts (parts of a sentence), math (components of an equation). Always connects to a specific learning objective from the curator brief.',
    tutoring: {
      taskDescription:
        'Guide the student through objective-driven concept exploration. '
        + 'Objective: "{{objectiveText}}" (verb: {{objectiveVerb}}). '
        + 'The student explores {{totalConcepts}} foundational concepts by clicking tabs, '
        + 'reading definitions and context, then completing self-checks. '
        + 'Currently viewing: "{{selectedConceptName}}". '
        + 'Progress: {{completedCount}} of {{totalConcepts}} concepts explored.',
      contextKeys: [
        'objectiveText', 'objectiveVerb',
        'selectedConceptName', 'completedCount', 'totalConcepts',
        'allCompleted',
      ],
      scaffoldingLevels: {
        level1:
          '"Look at the diagram carefully. Can you find where {{selectedConceptName}} appears?"',
        level2:
          '"Read the definition of {{selectedConceptName}} and look at where it appears in the diagram. '
          + 'How does it connect to the other concepts you\'ve explored?"',
        level3:
          '"Let\'s work through this together. First, read the definition of {{selectedConceptName}}. '
          + 'Now look at the \'In Context\' section — it shows a real-world example. '
          + 'Finally, check the diagram to see exactly where this concept fits. '
          + 'When you\'re ready, try the self-check question."',
      },
      commonStruggles: [
        { pattern: 'Student clicks "I understand" without revealing the self-check hint', response: 'Encourage the student to try the self-check question first. Understanding is deeper when you test yourself.' },
        { pattern: 'Student stays on one concept without exploring others', response: 'Remind the student there are more concepts to explore. Each one builds on the others.' },
        { pattern: 'Student skips reading the "In Context" section', response: 'Point the student to the "In Context" section — real-world examples make the concept stick.' },
        { pattern: 'Student struggles with the self-check question', response: 'Guide them back to the definition and diagram. The answer connects to what they just read.' },
      ],
      aiDirectives: [
        {
          title: 'CONCEPT EXPLORATION WALKTHROUGH',
          instruction:
            'When you receive [CONCEPT_SELECTED], briefly introduce the concept the student is about to explore. '
            + 'Mention its name and encourage them to read the definition and look at the diagram. '
            + 'If they have already explored other concepts, connect this one to what they learned before. '
            + 'Keep it to 1-2 sentences.',
        },
        {
          title: 'SELF-CHECK GUIDANCE',
          instruction:
            'When you receive [HINT_REQUESTED], encourage the student to think about the definition '
            + 'and the diagram before reading the hint. Do NOT reveal the answer. '
            + 'When you receive [CONCEPT_COMPLETED], celebrate briefly and preview the next concept if there is one. '
            + 'Keep feedback to 1-2 sentences.',
        },
        {
          title: 'SESSION COMPLETION',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate the student finishing all concepts. '
            + 'Briefly recap what they learned by connecting the concepts back to the learning objective. '
            + 'Keep it to 2-3 encouraging sentences.',
        },
      ],
    },
  },
  {
    id: 'fast-fact',
    description: 'Timed fluency drill for rapid recall across any subject. '
      + 'Supports choice and type-in response modes with configurable phases, time limits, and visual prompts. '
      + 'Use for: math facts, sight words, vocabulary, element symbols, dates & events, translations — '
      + 'any domain requiring automaticity. Generates 8-12 challenges across 2-3 phases with streak tracking and speed metrics. '
      + 'ESSENTIAL for building fluency and automaticity at any grade level.',
    constraints: 'Best for factual recall (not reasoning or multi-step problems). '
      + 'Challenges should have single correct answers. Keep to 8-15 challenges per session for engagement.',
    tutoring: {
      taskDescription:
        'Guide the student through a timed fluency drill. Subject: {{subject}}. '
        + 'Current challenge: "{{promptText}}" ({{challengeType}}, {{responseMode}} mode). '
        + 'Correct answer: "{{correctAnswer}}". '
        + 'Attempt {{attemptNumber}}. Streak: {{streak}}. Accuracy: {{accuracy}}%. '
        + 'Average time: {{averageTime}}s (target: {{targetResponseTime}}s). '
        + 'Challenge {{currentIndex}} of {{totalChallenges}}.',
      contextKeys: [
        'subject', 'challengeType', 'promptText', 'correctAnswer',
        'responseMode', 'difficulty', 'attemptNumber', 'streak',
        'accuracy', 'averageTime', 'totalChallenges', 'currentIndex',
        'gradeBand', 'targetResponseTime',
      ],
      scaffoldingLevels: {
        level1:
          '"Take a moment and think. What do you already know about this?"',
        level2:
          '"Let\'s break it down. Look at the question again — what clue stands out? '
          + 'Can you narrow it to two options?"',
        level3:
          '"Here\'s a strategy: {{correctAnswer}} relates to what we learned. '
          + 'Think about the key connection and try again."',
      },
      commonStruggles: [
        { pattern: 'Student answers very quickly but incorrectly', response: 'Slow down just a little. Speed matters, but accuracy comes first. Read the question one more time.' },
        { pattern: 'Student freezes and lets the timer run out repeatedly', response: 'It is okay to guess! Even a guess helps you learn. Try your best answer before time runs out.' },
        { pattern: 'Student gets frustrated after wrong answers', response: 'Every wrong answer teaches your brain something. You are getting faster — keep going!' },
        { pattern: 'Student answers correctly but slowly', response: 'You know this! The more you practice, the faster it will come. Try to beat your own time on the next one.' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], welcome the student to the fluency drill. '
            + 'Mention the subject and number of challenges. Encourage them to be fast AND accurate. '
            + 'Keep it to 2-3 sentences.',
        },
        {
          title: 'CORRECT ANSWER FEEDBACK',
          instruction:
            'When you receive [ANSWER_CORRECT], briefly celebrate. '
            + 'If the answer was fast, be extra enthusiastic. If slow but correct, affirm and encourage speed. '
            + 'If on a streak, mention it. Keep to 1-2 sentences.',
        },
        {
          title: 'INCORRECT ANSWER GUIDANCE',
          instruction:
            'When you receive [ANSWER_INCORRECT], do NOT punish. '
            + 'If more attempts remain, give a brief subject-appropriate hint without revealing the answer. '
            + 'If max attempts reached, acknowledge the correct answer and move on encouragingly. '
            + 'Keep to 1-2 sentences.',
        },
        {
          title: 'TIME UP HANDLING',
          instruction:
            'When you receive [TIME_UP], be supportive. '
            + 'Say the correct answer matter-of-factly and encourage the student to try to remember it. '
            + 'Never shame for running out of time. Keep to 1 sentence.',
        },
        {
          title: 'NEXT CHALLENGE TRANSITION',
          instruction:
            'When you receive [NEXT_ITEM], briefly introduce the new challenge. '
            + 'Acknowledge progress if relevant. Keep to 1 sentence.',
        },
        {
          title: 'COMPLETION CELEBRATION',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate the student\'s effort. '
            + 'Mention phase scores, best streak, and speed improvements. '
            + 'Give subject-specific encouragement. Keep to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'fact-file',
    description: 'Magazine-style profile card with key stats, quick facts, deep dive sections, records, and "did you know?" callouts. Students explore tabbed sections then answer self-check questions. Works for ANY topic — trash trucks, volcanoes, ancient civilizations, animals. ESSENTIAL for K-8 general content delivery.',
    constraints: 'Best for topics with concrete facts and stats. Not ideal for purely narrative content.',
    evalModes: [
      {
        evalMode: 'explore',
        label: 'Explore & Recall (Guided)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['recall_easy'],
        description: 'Student explores all sections, then answers 3 easy recall questions with section hints visible',
      },
      {
        evalMode: 'recall',
        label: 'Recall (Unguided)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['recall_easy', 'recall_medium'],
        description: 'Student reads the Fact File, then answers 4 questions without section hints. Mix of easy and medium.',
      },
      {
        evalMode: 'apply',
        label: 'Apply & Analyze',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['recall_medium', 'recall_hard'],
        description: 'Student answers harder questions requiring inference, comparison, or application of facts to new scenarios',
      },
    ],
    tutoring: {
      taskDescription:
        'Guide the student through a Fact File about "{{title}}" ({{category}}). '
        + 'The student explores key stats, quick facts, deep dive sections, records, and "did you know" callouts. '
        + 'Currently viewing: {{activeTab}}. Sections explored: {{sectionsExplored}} of {{totalSections}}. '
        + 'Self-check progress: {{checksCompleted}} of {{totalChecks}}.',
      contextKeys: [
        'title', 'category', 'activeTab', 'sectionsExplored', 'totalSections',
        'checksCompleted', 'totalChecks', 'currentKeyStats',
      ],
      scaffoldingLevels: {
        level1: '"Look at the key stats at the top. What number surprises you the most?"',
        level2: '"Click on the {{activeTab}} tab and read through the details. '
          + 'What connection do you see between this and the key stats?"',
        level3: '"Let me walk you through this. Start with the key stats — {{title}} has some amazing numbers. '
          + 'Now click Deep Dive to understand WHY those numbers matter. '
          + 'Finally, check the Records section for the most extreme examples."',
      },
      commonStruggles: [
        { pattern: 'Student only looks at key stats and skips other tabs', response: 'The key stats are just the beginning! Click on the other tabs — Deep Dive has the best details, and Did You Know has surprising facts.' },
        { pattern: 'Student clicks through tabs too quickly without reading', response: 'Slow down and read each section carefully. There are some amazing details hidden in there that you will want to remember.' },
        { pattern: 'Student struggles with self-check questions', response: 'Go back and re-read the section related to this question. The answer is in the facts you just explored.' },
        { pattern: 'Student does not connect facts across sections', response: 'Try to connect what you learned in different sections. How do the key stats relate to the deep dive details?' },
      ],
      aiDirectives: [
        {
          title: 'TAB EXPLORATION',
          instruction:
            'When you receive [TAB_OPENED], briefly introduce the section the student opened. '
            + 'Highlight one interesting detail to look for. If this is Deep Dive, connect it to a key stat. '
            + 'If this is Did You Know, build excitement. Keep to 1-2 sentences.',
        },
        {
          title: 'KEY STAT REACTION',
          instruction:
            'When you receive [STAT_TAPPED], react to the specific stat the student tapped. '
            + 'Provide a relatable comparison (e.g., "That is as heavy as 8 elephants!"). '
            + 'Keep to 1-2 sentences.',
        },
        {
          title: 'SELF-CHECK FEEDBACK',
          instruction:
            'When you receive [CHECK_CORRECT], celebrate briefly and reinforce the fact. '
            + 'When you receive [CHECK_INCORRECT], hint at which section contains the answer '
            + 'without revealing it. Keep to 1-2 sentences.',
        },
        {
          title: 'ALL EXPLORED',
          instruction:
            'When you receive [ALL_SECTIONS_EXPLORED], congratulate the student on reading everything. '
            + 'Ask them what their favorite fact was. If self-checks are coming, preview them. '
            + 'Keep to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'how-it-works',
    description: 'Interactive step-by-step process diagram. Students navigate through 4-6 sequential stages learning how something works (garbage collection, water cycle, digestion, bill-making). Each step has description, optional "What\'s Happening?" deeper explanation, key terms, and fun facts. Comprehension challenges test understanding via sequencing, identifying, predicting, and explaining. ESSENTIAL for K-8 procedural knowledge across all subjects.',
    constraints: 'Best for processes with clear sequential steps (4-6). Not ideal for non-linear or branching processes.',
    evalModes: [
      {
        evalMode: 'guided',
        label: 'Guided Walkthrough (Easy)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Student walks through all steps with full guidance, then answers 3 "identify" questions with steps still visible',
      },
      {
        evalMode: 'sequence',
        label: 'Sequence & Identify (Medium)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['sequence', 'identify'],
        description: 'Student must drag steps into correct order AND answer identify questions without step details visible',
      },
      {
        evalMode: 'predict',
        label: 'Predict & Explain (Hard)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['predict', 'explain'],
        description: 'Student sees partial process and must predict next step or explain why a step happens. Requires inference beyond memorization.',
      },
    ],
    tutoring: {
      taskDescription:
        'Guide the student through a step-by-step process: "{{title}}". '
        + 'Overview: {{overview}}. Currently on Step {{currentStep}} of {{totalSteps}}: "{{currentStepTitle}}". '
        + 'Steps explored: {{stepsExplored}} of {{totalSteps}}. '
        + 'Detail expanded: {{detailExpanded}}. '
        + 'Challenges completed: {{challengesCompleted}} of {{totalChallenges}}.',
      contextKeys: [
        'title', 'overview', 'totalSteps', 'currentStep', 'currentStepTitle',
        'detailExpanded', 'stepsExplored', 'challengesCompleted', 'totalChallenges',
      ],
      scaffoldingLevels: {
        level1: '"Look at this step carefully. What do you think is happening here?"',
        level2: '"Read the description of Step {{currentStep}}: \\"{{currentStepTitle}}\\". '
          + 'How does this connect to what happened in the previous step?"',
        level3: '"Let me walk you through this. First, read the step description carefully. '
          + 'Then open the \\"What\'s Happening?\\" section for deeper details. '
          + 'Think about WHY this step needs to happen before the next one."',
      },
      commonStruggles: [
        { pattern: 'Student clicks Next rapidly without reading step descriptions', response: 'Slow down! Each step builds on the last. Go back and read the description — the details matter for understanding the whole process.' },
        { pattern: 'Student never opens "What\'s Happening?" sections', response: 'Try opening the "What\'s Happening?" section — it explains the science and mechanics behind each step with cool details.' },
        { pattern: 'Student struggles with sequence challenges', response: 'Think about cause and effect. What has to happen BEFORE this step? What would break if you swapped these two?' },
        { pattern: 'Student gets predict question wrong', response: 'Go back and re-read the step before this one. The clue is in how it ends — each step sets up the next.' },
      ],
      aiDirectives: [
        {
          title: 'STEP NAVIGATION',
          instruction:
            'When you receive [STEP_NAVIGATION], briefly introduce the new step and connect it to the previous one '
            + 'with "Now that X happened..." transitions. If student skipped steps, gently remind them. '
            + 'Keep to 1-2 sentences.',
        },
        {
          title: 'DETAIL EXPANSION',
          instruction:
            'When you receive [DETAIL_EXPANDED], react with enthusiasm about the deeper explanation. '
            + 'Add a relatable comparison or real-world context. Keep to 1-2 sentences.',
        },
        {
          title: 'CHALLENGE FEEDBACK',
          instruction:
            'When you receive [CHALLENGE_CORRECT], celebrate and reinforce understanding. '
            + 'When you receive [CHALLENGE_INCORRECT], hint at the relevant step without giving the answer. '
            + 'For sequence challenges, ask "What needs to happen BEFORE this?" '
            + 'Keep to 1-2 sentences.',
        },
        {
          title: 'PROCESS COMPLETE',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate understanding. '
            + 'Summarize the full process in one sentence. Highlight the most important takeaway. '
            + 'Keep to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'timeline-explorer',
    description: 'Interactive chronological timeline with 5-8 event cards. Students explore events spanning a time period, reading descriptions, impact callouts, and connections between events. Comprehension challenges test chronological understanding via ordering, identification, dating, and cause-effect reasoning. Works for ANY chronological topic — history of aviation, evolution of computers, life of a city, scientific discoveries. ESSENTIAL for K-8 chronological understanding across all subjects.',
    constraints: 'Best for topics with clear chronological progression (5-8 events). Not ideal for non-sequential topics.',
    evalModes: [
      {
        evalMode: 'explore',
        label: 'Guided Exploration (Easy)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Student explores all events with full guidance, then answers 3 "which event?" identification questions with timeline visible',
      },
      {
        evalMode: 'order',
        label: 'Chronological Ordering (Medium)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order', 'identify'],
        description: 'Student must arrange events chronologically AND identify events by description, timeline hidden during challenges',
      },
      {
        evalMode: 'connect',
        label: 'Cause & Effect (Hard)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['cause_effect', 'date'],
        description: 'Student matches causes to effects across events and places events in correct time periods. Requires understanding WHY things happened, not just WHEN.',
      },
    ],
    tutoring: {
      taskDescription:
        'Guide the student through a timeline: "{{title}}" spanning {{timeSpan}}. '
        + 'Total events: {{totalEvents}}. Currently viewing event {{currentEventIndex}}: "{{currentEventTitle}}" ({{currentEventDate}}). '
        + 'Events explored: {{eventsExplored}} of {{totalEvents}}. '
        + 'Challenge progress: {{challengesCompleted}} of {{totalChallenges}}.',
      contextKeys: [
        'title', 'timeSpan', 'totalEvents', 'currentEventIndex',
        'currentEventTitle', 'currentEventDate', 'eventsExplored',
        'challengesCompleted', 'totalChallenges',
      ],
      scaffoldingLevels: {
        level1: '"Look at event {{currentEventIndex}}. When did this happen? What changed?"',
        level2: '"Read about {{currentEventTitle}} ({{currentEventDate}}). '
          + 'How is it different from the event before it? What made it possible?"',
        level3: '"Let me help you connect the dots. {{currentEventTitle}} happened in {{currentEventDate}}. '
          + 'Look at the Impact section — it tells you why this was a turning point. '
          + 'Now think about what came before and what came after."',
      },
      commonStruggles: [
        { pattern: 'Student jumps to the end without reading middle events', response: 'The middle events are where the most interesting changes happen. Go back and explore them — each one builds on the last.' },
        { pattern: 'Student struggles with chronological ordering', response: 'Think about what technology or idea had to exist FIRST before the next one could happen. Cause comes before effect.' },
        { pattern: 'Student confuses similar events', response: 'Look at the dates and the key difference between those two events. What changed between them?' },
        { pattern: 'Student does not read the Impact sections', response: 'The Impact line tells you WHY this event mattered. Read it — it helps you understand the whole timeline story.' },
      ],
      aiDirectives: [
        {
          title: 'EVENT EXPLORATION',
          instruction:
            'When you receive [EVENT_SELECTED], introduce the event with historical context. '
            + 'Connect it to the previous event with "X years later..." or "Building on..." '
            + 'Highlight the impact. Keep to 1-2 sentences.',
        },
        {
          title: 'CHALLENGE FEEDBACK',
          instruction:
            'When you receive [CHALLENGE_CORRECT], reinforce the chronological connection. '
            + 'When you receive [CHALLENGE_INCORRECT], ask about cause-and-effect to guide thinking. '
            + 'For ordering: "Think about what had to happen first." '
            + 'Keep to 1-2 sentences.',
        },
        {
          title: 'TIMELINE COMPLETE',
          instruction:
            'When you receive [ALL_COMPLETE], summarize the arc of the timeline in one sentence. '
            + 'Highlight the key theme and ask the student what they think comes next. '
            + 'Keep to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'vocabulary-explorer',
    description: 'Topic-specific vocabulary explorer with rich contextual definitions, example sentences, word origins, related words, and pronunciation guides. Students explore 5-8 terms through an interactive card interface, then demonstrate comprehension via matching, fill-in-blank, context usage, and identification challenges. Natural complement to any content primitive. ESSENTIAL for K-8 vocabulary building across all subjects.',
    constraints: 'Best for topics with specialized terminology (5-8 terms). Not ideal for topics without distinct vocabulary.',
    evalModes: [
      {
        evalMode: 'explore',
        label: 'Explore & Match (Guided)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['match'],
        description: 'Student explores all terms, then matches terms to definitions with term cards still visible',
      },
      {
        evalMode: 'recall',
        label: 'Recall & Fill (Unguided)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match', 'fill_blank'],
        description: 'Student matches terms AND fills in blanks in sentences, without definitions visible',
      },
      {
        evalMode: 'apply',
        label: 'Apply in Context (Hard)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['fill_blank', 'context'],
        description: 'Student fills blanks and uses terms in new sentences/scenarios. Requires transferring vocabulary to novel contexts.',
      },
    ],
    tutoring: {
      taskDescription:
        'Guide the student through vocabulary exploration for "{{topic}}". '
        + 'Total terms: {{totalTerms}}. Currently viewing: "{{currentWord}}" ({{partOfSpeech}}). '
        + 'Terms explored: {{termsExplored}} of {{totalTerms}}. '
        + 'Challenge progress: {{challengesCompleted}} of {{totalChallenges}}.',
      contextKeys: [
        'topic', 'totalTerms', 'currentWord', 'partOfSpeech',
        'termsExplored', 'challengesCompleted', 'totalChallenges',
      ],
      scaffoldingLevels: {
        level1: '"Read the definition of {{currentWord}}. Have you heard this word before?"',
        level2: '"Look at the example sentence for {{currentWord}}. '
          + 'Can you see how it connects to the related words listed below?"',
        level3: '"Let me help you learn {{currentWord}}. First, read the definition out loud. '
          + 'Then read the example sentence. Now look at the Word Origin section — '
          + 'knowing where a word comes from helps you remember what it means."',
      },
      commonStruggles: [
        { pattern: 'Student skips reading definitions and goes straight to challenges', response: 'Go back and read each definition carefully first. The challenges will be much easier if you understand the terms.' },
        { pattern: 'Student confuses similar terms', response: 'Compare those two terms side by side. Read both definitions and example sentences — what makes them different?' },
        { pattern: 'Student struggles with fill-in-blank challenges', response: 'Think about which word makes the sentence make sense. Try reading the sentence with each option and see which one sounds right.' },
        { pattern: 'Student does not read example sentences', response: 'The example sentence shows you how the word is actually used. Read it out loud — it makes the definition click.' },
      ],
      aiDirectives: [
        {
          title: 'TERM INTRODUCTION',
          instruction:
            'When you receive [TERM_SELECTED], pronounce the word and give a brief, '
            + 'kid-friendly introduction. Connect it to something the student might already know. '
            + 'If the word has an interesting origin, tease it. Keep to 1-2 sentences.',
        },
        {
          title: 'RELATED WORD CONNECTION',
          instruction:
            'When you receive [RELATED_WORD_CLICKED], briefly explain how the two terms '
            + 'connect to each other. Build a mental web of vocabulary. Keep to 1-2 sentences.',
        },
        {
          title: 'CHALLENGE FEEDBACK',
          instruction:
            'When you receive [CHALLENGE_CORRECT], celebrate and use the word in a new sentence. '
            + 'When you receive [CHALLENGE_INCORRECT], give a contextual hint using the word\'s '
            + 'definition or origin without revealing the answer. Keep to 1-2 sentences.',
        },
        {
          title: 'ALL TERMS EXPLORED',
          instruction:
            'When you receive [ALL_TERMS_EXPLORED], congratulate the student and challenge them '
            + 'to use one of the new words in their own sentence. Preview the challenges. '
            + 'Keep to 2-3 sentences.',
        },
        {
          title: 'VOCABULARY MASTERY',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate vocabulary mastery. '
            + 'Mention the total terms learned and encourage using them in conversation. '
            + 'Keep to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'digital-skills-sim',
    description: 'Guided tutorial teaching fundamental digital device skills: clicking targets, dragging objects to zones, and typing on a virtual keyboard. Gamified with score tracking. Perfect for teaching basic computer interaction. ESSENTIAL for K-1 digital literacy.',
    constraints: 'K-1 only. Challenges are very simple motor-skill tasks, not academic content.',
    evalModes: [
      {
        evalMode: 'click',
        label: 'Click Practice (Easy)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['click'],
        description: 'Click accuracy and speed practice',
      },
      {
        evalMode: 'drag',
        label: 'Drag Practice (Easy)',
        beta: -1.0,
        scaffoldingMode: 2,
        challengeTypes: ['drag'],
        description: 'Drag objects to target zones',
      },
      {
        evalMode: 'type',
        label: 'Type Practice (Easy)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['type'],
        description: 'Find and press the correct key',
      },
    ],
    tutoring: {
      taskDescription:
        'Student is practicing basic digital skills: {{currentPhase}} phase, challenge {{challengeIndex}} of {{totalChallenges}}. Current instruction: "{{instruction}}".',
      contextKeys: ['title', 'currentPhase', 'challengeIndex', 'totalChallenges', 'instruction'],
      scaffoldingLevels: {
        level1:
          '"Can you find the [target]? Look carefully at the screen!"',
        level2:
          '"Try moving your mouse slowly toward the [target]. Take your time!"',
        level3:
          '"I see the [target] right here — move your mouse to it and click! You can do it!"',
      },
      commonStruggles: [
        { pattern: 'Student clicks but misses the target repeatedly', response: 'Encourage slower, more deliberate mouse movement. Suggest making the pointer touch the target before clicking.' },
        { pattern: 'Student cannot complete drag — drops item before reaching zone', response: 'Remind student to hold the mouse button down while moving. Practice the hold-and-move motion.' },
        { pattern: 'Student presses wrong keys repeatedly', response: 'Point out where the highlighted key is on the keyboard. Use positional hints like "top row" or "bottom left".' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'deep-dive',
    description:
      'Orchestrated multi-block learning experience. Assembles hero images, key facts, data tables, and interactive questions '
      + 'into a cohesive vertical scroll lesson on any topic. Perfect for introducing new subjects, building background knowledge, '
      + 'or creating comprehensive topic overviews. ESSENTIAL for any topic requiring broad coverage with embedded comprehension checks.',
    constraints:
      'Requires orchestrator + parallel generation. Best for topics with enough depth for 5+ blocks.',
    evalModes: [
      {
        evalMode: 'explore',
        label: 'Explore (Tier 1)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['explore'],
        description: 'Mostly display blocks with 1-2 easy MC questions. Low retrieval demand.',
      },
      {
        evalMode: 'recall',
        label: 'Recall (Tier 2)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['recall'],
        description: 'More MC questions testing direct recall from display blocks.',
      },
      {
        evalMode: 'apply',
        label: 'Apply (Tier 3)',
        beta: 0.5,
        scaffoldingMode: 3,
        challengeTypes: ['apply'],
        description: 'Data tables + MC requiring cross-referencing and multi-step reasoning.',
      },
      {
        evalMode: 'analyze',
        label: 'Analyze (Tier 4)',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['analyze'],
        description: 'Hard MC + synthesis questions. Student must analyze, not just retrieve.',
      },
    ],
    tutoring: {
      taskDescription:
        'Guide the student through an orchestrated DeepDive on "{{topic}}". The experience has {{blockCount}} blocks '
        + 'including {{evaluableBlockCount}} interactive questions. Current block: {{currentBlockLabel}}.',
      contextKeys: ['title', 'topic', 'blockCount', 'evaluableBlockCount', 'narrativeArc', 'blockLabels'],
      scaffoldingLevels: {
        level1:
          '"Look at the information presented in this section. What stands out to you?"',
        level2:
          '"Re-read the {{currentBlockLabel}} section carefully. The answer connects to what you learned there."',
        level3:
          '"Let me walk you through this. The {{currentBlockLabel}} section shows us that... Now look at the question again with that in mind."',
      },
      commonStruggles: [
        { pattern: 'Student skips display blocks and jumps straight to questions', response: 'Encourage the student to read through each section before answering questions — the answers are embedded in the content above.' },
        { pattern: 'Student answers MC without reading the explanation', response: 'Ask the student to read the explanation after answering — it reinforces the concept and connects back to the content.' },
      ],
    },
    supportsEvaluation: true,
  },
];
