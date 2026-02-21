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
    id: 'knowledge-check',
    description: 'Assessment checkpoint with single or multiple problems of various types (multiple choice, true/false, fill-in-blanks, matching, sequencing, categorization, scenario, short answer).',
    tutoring: {
      taskDescription:
        'Guide the student through an assessment checkpoint. '
        + 'Problem count: {{problemCount}}. Current problem: {{currentProblemIndex}} of {{problemCount}}. '
        + 'Problem type: {{currentProblemType}}. Question: "{{currentQuestion}}". '
        + 'The student must answer each problem. Encourage careful thinking without revealing answers.',
      contextKeys: [
        'problemCount', 'currentProblemIndex', 'currentProblemType',
        'currentQuestion', 'attemptNumber', 'lastAnswerCorrect',
        'completedCount', 'correctCount',
      ],
      scaffoldingLevels: {
        level1:
          '"Read the question carefully. What do you already know about this topic?"',
        level2:
          '"Let\'s break this down. Think about {{currentQuestion}} — '
          + 'what key words or concepts stand out? Can you eliminate any options that don\'t fit?"',
        level3:
          '"Let me walk you through this step by step. First, re-read the question. '
          + 'Now think about what we learned earlier in the lesson. '
          + 'Focus on the most important detail in the question and match it to what you know."',
      },
      commonStruggles: [
        { pattern: 'Student selects an answer very quickly without reading all options', response: 'Slow down and read every option before choosing. Sometimes the best answer isn\'t the first one you see.' },
        { pattern: 'Student makes the same mistake repeatedly after reset', response: 'Let\'s try a different approach. Instead of jumping to an answer, tell me what the question is asking in your own words.' },
        { pattern: 'Student requests hints without attempting an answer first', response: 'Give it your best try first! Even a guess helps you learn. You can always try again.' },
        { pattern: 'Student is stuck between two plausible options', response: 'Good narrowing! Now compare those two options side by side. Which one more precisely answers what the question is asking?' },
      ],
      aiDirectives: [
        {
          title: 'ANSWER FEEDBACK',
          instruction:
            'When you receive [ANSWER_CORRECT], briefly celebrate the student\'s success. '
            + 'Reinforce WHY the answer is correct in 1-2 sentences. Do not be overly verbose. '
            + 'If there are more problems, smoothly transition to encouraging them for the next one.',
        },
        {
          title: 'INCORRECT ANSWER GUIDANCE',
          instruction:
            'When you receive [ANSWER_INCORRECT], do NOT reveal the correct answer. '
            + 'Provide encouragement and a focused hint based on the scaffolding level. '
            + 'If the student has attempted multiple times, escalate to a more specific hint '
            + 'but still do not give the answer directly.',
        },
        {
          title: 'HINT WALKTHROUGH',
          instruction:
            'When you receive [HINT_REQUESTED], provide a progressive hint based on the level indicated. '
            + 'Level 1: Ask a guiding question to redirect thinking. '
            + 'Level 2: Break the problem into smaller parts and point to key details. '
            + 'Level 3: Walk through the reasoning step by step, stopping just short of the answer. '
            + 'NEVER reveal the correct answer in any hint level.',
        },
        {
          title: 'PROBLEM INTRODUCTION',
          instruction:
            'When you receive [PROBLEM_SHOWN], briefly read the question aloud in an encouraging way. '
            + 'For multi-problem sets, acknowledge the student\'s progress. '
            + 'Keep it to 1-2 sentences. Do NOT hint at the answer.',
        },
        {
          title: 'ASSESSMENT COMPLETION',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate the student\'s effort. '
            + 'Mention how many they got correct out of the total. '
            + 'Highlight their growth if they improved over multiple attempts. '
            + 'Keep it to 2-3 encouraging sentences.',
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
    description: 'Deep-dive editorial section with multiple subsections. Use for comprehensive exploration of a topic.',
    supportsEvaluation: true,
  },
  {
    id: 'annotated-example',
    description: 'Step-by-step worked example with multi-layer annotations (procedural steps, strategic thinking, common errors, conceptual connections). Use for demonstrating problem-solving processes in math, science, or any domain requiring systematic reasoning.',
    constraints: 'Best for elementary and above. Requires a well-defined problem with clear solution steps.',
  },
  {
    id: 'nested-hierarchy',
    description: 'Interactive tree structure for exploring hierarchical systems (organizational charts, taxonomies, system architectures, anatomical structures). Users navigate through expandable nodes to see relationships and detailed information about each component.',
    constraints: 'Best for topics with clear hierarchical organization (2-4 levels deep). Use for biology (body systems), government (branches), classification systems, or any nested organizational structure.',
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
];
