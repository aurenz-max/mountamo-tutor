/**
 * Core Catalog - Essential component definitions used across all topics
 *
 * Contains foundational components like curator brief, concept cards,
 * tables, comparisons, and general-purpose primitives.
 */

import { ComponentDefinition } from '../../../types';
import { bossEntry } from '../../../components/live-activity/boss';
import { curatorBriefCard } from '../../../primitives/curatorBrief.card';
import { fastFactCard } from '../../../primitives/visual-primitives/core/fastFact.card';
import { vocabularyExplorerCard } from '../../../primitives/visual-primitives/core/vocabularyExplorer.card';
import { factFileCard } from '../../../primitives/visual-primitives/core/factFile.card';
import { timelineExplorerCard } from '../../../primitives/visual-primitives/core/timelineExplorer.card';
import { howItWorksCard } from '../../../primitives/visual-primitives/core/howItWorks.card';
import { digitalSkillsSimCard } from '../../../primitives/visual-primitives/core/digitalSkillsSim.card';

export const CORE_CATALOG: ComponentDefinition[] = [
  {
    id: 'curator-brief',
    description: 'Introduction, learning objectives, and hook. REQUIRED: Always include this first.',
    constraints: 'Must be first component',
    affordances: { representation: 'symbolic', reader: 'none', role: 'introduce', minutes: 2, maxPerLesson: 1 },
    // The lesson's opening screen, an ungraded teaching surface (2026-10-11). It replaces the tabbed
    // brief and its [READ_SECTION] scaffold: a bound brief owns the lesson opening, so the greeting
    // and the hook are one turn. Its wiring is the ungraded boss card (`curatorBrief.card.ts`). Contract:
    // docs/contracts/curator-brief.md.
    ...bossEntry(curatorBriefCard),
  },
  {
    id: 'concept-card-grid',
    description: 'A set of 3-4 distinct key terms or concepts defined with visuals. Use for vocabulary or core principles.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'], role: 'introduce', minutes: 3 },
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
          title: 'PRE-READER READ-ALOUD (kindergarten)',
          instruction:
            'For a pre-reader (kindergarten) the child CANNOT read the card — the face is just a picture (emoji) and the back is text they cannot decode. '
            + 'When you receive [CARD_READ_ALOUD], READ ALOUD, word for word, exactly what the message gives you: '
            + 'the concept name, then its definition, then the curiosity note — warmly and simply. '
            + 'Reading this aloud IS your turn — this OVERRIDES any instruction to keep it to one sentence or to be brief; read all of it. '
            + 'Then invite them to tap the card again to close it, or tap another picture card if there are more. '
            + 'Do not ask them to read anything themselves.',
        },
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
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap'], role: ['introduce', 'visualize'], minutes: 4 },
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
          title: 'PRE-READER READ-ALOUD (kindergarten)',
          instruction:
            'For a pre-reader (kindergarten) the child CANNOT read the cards, the true/false statement, or any label. '
            + 'When you receive [COMPARE_START], warmly tell the child to tap each of the two pictures to hear about it — keep it to one friendly sentence. '
            + 'When you receive [ITEM_READ_ALOUD], READ ALOUD, word for word, exactly what the message gives you about the card the child just tapped: '
            + 'its name and its two features, warmly and simply, then invite them to tap the other card. '
            + 'When you receive [GATE_READ_ALOUD], READ ALOUD the true/false statement word for word, then say: '
            + 'tap the thumbs up if it is right, or the thumbs down if it is wrong. '
            + 'Reading this aloud IS your turn — this OVERRIDES any instruction to keep it to one sentence or to be brief; read all of it. '
            + 'Never say or hint whether the statement is true or false. '
            + 'When you receive [GATE_RETRY], give ONE warm spoken hint that points them back to what they can SEE on the two cards, without revealing the answer, and invite them to tap again.',
        },
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
    affordances: { representation: 'symbolic', role: 'visualize', minutes: 3 },
  },
  {
    id: 'custom-visual',
    description: 'A bespoke HTML/JS simulation or SVG diagram. Use for complex systems (biology, physics, counting games) that standard math visuals cannot handle. TIP: Provide config with subject, keyTerms, and conceptsCovered for richer content.',
    affordances: { representation: 'pictorial', role: 'visualize', minutes: 5 },
  },
  {
    id: 'formula-card',
    description: 'Mathematical formula display with LaTeX. Use for equations, theorems, or scientific formulas.',
    constraints: 'Requires mathematical formulas',
    affordances: { representation: 'symbolic', role: 'introduce', minutes: 2 },
  },
  {
    id: 'feature-exhibit',
    description: 'Static editorial section with subsections. Legacy — prefer deep-dive for comprehensive topic exploration.',
    affordances: { representation: 'pictorial', role: 'introduce', minutes: 3 },
    supportsEvaluation: true,
  },
  {
    id: 'annotated-example',
    description: 'Step-by-step worked example with multi-layer annotations (procedural steps, strategic thinking, common errors, conceptual connections). Use for demonstrating problem-solving processes in math, science, or any domain requiring systematic reasoning.',
    constraints: 'Best for elementary and above. Requires a well-defined problem with clear solution steps.',
    affordances: { representation: 'symbolic', role: 'introduce', minutes: 3 },
  },
  {
    id: 'take-home-activity',
    description: 'Hands-on activity using common household materials. Screen-free learning experience with step-by-step instructions, safety notes, reflection prompts, and optional extensions. Perfect for reinforcing concepts through kinesthetic learning and real-world application.',
    constraints: 'Best for science experiments, math manipulatives, art projects, or any topic that benefits from hands-on exploration. Automatically adapts complexity and safety guidance to grade level.',
    affordances: { audience: 'caregiver', representation: 'concrete', answers: ['manipulate'], role: 'apply', minutes: 10, maxPerLesson: 1 },
  },
  {
    id: 'graph-board',
    description: 'Interactive polynomial graphing board where users plot points and visualize fitted polynomial curves. Use for algebra, functions, data analysis, or polynomial interpolation concepts.',
    constraints: 'Best for middle-school and above. Requires mathematical/data analysis context.',
    affordances: { representation: 'symbolic', role: 'visualize', minutes: 5 },
  },
  {
    id: 'foundation-explorer',
    description: 'Objective-driven concept exploration with clear diagrams, definitions, and self-checks. Shows a central diagram with multiple labeled concepts that students explore one at a time. Self-check questions match the learning objective verb (IDENTIFY, EXPLAIN, APPLY). BEST for IDENTIFY objectives where students need to learn foundational vocabulary and recognize key parts/components of a system. Use when introducing 2-4 core concepts that students must master before deeper learning.',
    constraints: 'Best for IDENTIFY and EXPLAIN objectives. Requires 2-4 foundational concepts with clear visual representations. Works across all subjects: science (parts of a cell), engineering (parts of a lever), language arts (parts of a sentence), math (components of an equation). Always connects to a specific learning objective from the curator brief.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap'], role: 'introduce', minutes: 4 },
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
          '"Picture {{selectedConceptName}} in your head for a second — where would you expect to see it in the diagram? Point roughly and I\'ll tell you if you\'re warm."',
        level2:
          '"Here\'s the key idea about {{selectedConceptName}} in one breath, then a question back to you: <one-sentence teaching insight>. '
          + 'Now — how do you think it connects to the other concepts you\'ve explored?"',
        level3:
          '"Let\'s reason it out together. {{selectedConceptName}} does <what it does> — the reason that matters is <why>. '
          + 'A real-world version: <concrete example>. Given that, take a swing at the self-check — I\'ll steer, not solve."',
      },
      commonStruggles: [
        { pattern: 'Student clicks "I understand" without engaging the self-check', response: 'Warmly ask them the self-check question yourself before they move on — understanding sticks when they say it back in their own words.' },
        { pattern: 'Student stays on one concept without exploring others', response: 'Celebrate what they got, then tease the next concept with a hook ("the next one is what actually makes this work…").' },
        { pattern: 'Student skips the "In Context" real-world example', response: 'Offer your own quick real-world example unprompted — make the abstract concept concrete before they ask.' },
        { pattern: 'Student struggles with the self-check question', response: 'Do NOT give the answer. Narrow the question, offer a smaller sub-question, or point at the diagram detail that unlocks it.' },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten)',
          instruction:
            'For a pre-reader (kindergarten) the child CANNOT read any of the concept text or the self-check. '
            + 'When you receive [CONCEPT_READ_ALOUD] or [SELFCHECK_READ_ALOUD], READ ALOUD, word for word, exactly what the message gives you: '
            + 'the concept definition and the real-world example first, then the self-check question, then EVERY option slowly with its letter, then ask which picture they want to tap. '
            + 'Reading this aloud IS your turn — this OVERRIDES any instruction to keep it to one sentence or to be brief; read all of it. '
            + 'Never say or hint which option is correct. '
            + 'When you receive [SELFCHECK_RETRY], give ONE warm spoken hint that narrows it down without revealing the answer, and invite them to tap another picture.',
        },
        {
          title: 'CONCEPT EXPLORATION WALKTHROUGH',
          instruction:
            'When you receive [CONCEPT_SELECTED], actively TEACH — do not tell them to read the panel. '
            + 'Give ONE vivid, curiosity-sparking hook about the concept: a mental image, a surprising fact, '
            + 'or a "notice how…" observation (1-2 sentences). '
            + 'If they have already explored other concepts, connect this one to what they learned before.',
        },
        {
          title: 'SELF-CHECK GUIDANCE',
          instruction:
            'Each concept ends in a quick multiple-choice self-check the student answers on-screen. '
            + 'When you receive [HINT_REQUESTED] (the student either asked for a hint or picked a wrong option), '
            + 'narrow the choice down — point at the definition or the diagram detail that rules an option out — '
            + 'but NEVER name the correct answer. '
            + 'When you receive [CONCEPT_COMPLETED], celebrate the correct answer briefly and preview the next concept if there is one. '
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
      studentPrompts: [
        {
          kind: 'explain',
          label: 'Explain {{selectedConceptName}}',
          prompt: 'Can you explain "{{selectedConceptName}}" to me in a simple way?',
        },
        { kind: 'hint', label: "I'm stuck on the self-check", hintLevel: 1 },
        { kind: 'hint', label: 'Give me a bigger hint', hintLevel: 2 },
        {
          kind: 'check',
          label: 'How does this fit the goal?',
          prompt:
            'How does {{selectedConceptName}} connect to the objective "{{objectiveText}}"?',
        },
        {
          kind: 'advance',
          label: 'What should I explore next?',
          prompt:
            "I've explored {{completedCount}} of {{totalConcepts}} concepts. Which one should I look at next?",
          showWhen: { key: 'allCompleted', equals: false },
        },
      ],
    },
  },
  {
    id: 'fast-fact',
    // The live wiring is fastFact.card.ts + fastFact.boss.ts.
    ...bossEntry(fastFactCard),
    description: 'Untimed fluency drill for rapid recall across any subject. '
      + 'Multiple-choice challenges with configurable phases and visual prompts. No countdown or time pressure — students answer at their own pace, and nothing is timed. '
      + 'Use for: math facts, sight words, vocabulary, element symbols, dates & events, translations — '
      + 'any domain requiring automaticity. Generates 8-12 challenges across 2-3 phases with streak tracking. '
      + 'ESSENTIAL for building fluency and automaticity at any grade level.',
    constraints: 'Best for factual recall (not reasoning or multi-step problems). '
      + 'Challenges should have single correct answers. Keep to 8-15 challenges per session for engagement. '
      + 'No timers — never frame challenges around speed or deadlines. '
      + 'NOT for a K-2 Language Arts beginning/middle-sound identification objective — '
      + 'phoneme-explorer already owns that ground answered ALOUD (spoken-first ruling); '
      + 'picking fast-fact there duplicates it tap-only. Fine for other K-2 LA automaticity '
      + '(sight words, vocabulary) where no spoken-native primitive already claims the objective.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'spoken'], role: ['apply', 'assess'], minutes: 3 },
    evalModes: [
      {
        evalMode: 'recognize',
        label: 'Recognize a Cue',
        beta: 2.5,
        discrimination: 1.2,
        scaffoldingMode: 2,
        challengeTypes: ['recognize'],
        description: 'Translate a visible, symbolic, pictorial, or patterned cue into its matching name or value.',
      },
      {
        evalMode: 'recall',
        label: 'Recall a Fact',
        beta: 3.5,
        discrimination: 1.2,
        scaffoldingMode: 3,
        challengeTypes: ['recall'],
        description: 'Retrieve one directly requested fact without an answer-bearing visual cue.',
      },
      {
        evalMode: 'apply',
        label: 'Apply in Context',
        beta: 5.0,
        discrimination: 1.2,
        scaffoldingMode: 4,
        challengeTypes: ['apply'],
        description: 'Use a known fact in a short context, cloze, comparison, or reverse-direction association.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'fact-file',
    // The live wiring is factFile.card.ts + factFile.boss.ts.
    ...bossEntry(factFileCard),
    description: 'Magazine-style profile card with key stats, quick facts, deep dive sections, records, and "did you know?" callouts. Students explore tabbed sections then answer self-check questions. Works for ANY topic — trash trucks, volcanoes, ancient civilizations, animals. ESSENTIAL for K-8 general content delivery.',
    constraints: 'Best for topics with concrete facts and stats. Not ideal for purely narrative content.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['tap', 'spoken'], role: ['introduce', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'explore',
        label: 'Explore & Recall (Guided)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['recall_easy'],
        description: 'Student answers 3 easy recall questions with the Fact File open above them, finding each answer in its sections (look it up)',
      },
      {
        evalMode: 'recall',
        label: 'Recall (Unguided)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['recall_easy', 'recall_medium'],
        description: 'Student reads the Fact File, then answers 4 questions with the file closed (key stats included). Mix of easy and medium.',
      },
      {
        evalMode: 'apply',
        label: 'Apply & Analyze',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['recall_medium', 'recall_hard'],
        description: 'Student reads the Fact File, then answers 4 harder questions with the file closed, requiring inference, comparison, or application of facts to new scenarios',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'how-it-works',
    description: 'Step-by-step process exhibit. Students read how something works in 4-6 sequential steps (garbage collection, water cycle, digestion, bill-making), each with a description, an optional "What\'s Happening?" deeper explanation, key terms and fun facts; a pre-reader gets 3-4 picture steps that the tutor reads aloud. Then questions that code builds from the steps and checks from their order: which step a description tells of (its own name blanked out), putting the steps in order, what happens next after the first few steps, and why a step matters. ESSENTIAL for K-8 procedural knowledge across all subjects.',
    constraints: 'Best for processes with clear sequential steps (4-6). Not ideal for non-linear or branching processes. Code builds every question, choice and answer from the steps; the manifest picks the process, never the questions. Evaluable: every answer is checked by code.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['tap', 'spoken', 'manipulate'], role: ['introduce', 'visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'guided',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Guided Walkthrough (Easy)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Student reads all the steps, then answers 3 identify questions: which step a description tells of, with its own name blanked out and the step list still on screen (hard: both neighbouring steps among the choices)',
      },
      {
        evalMode: 'sequence',
        affordances: { answers: ['manipulate', 'tap', 'spoken'] },
        label: 'Sequence & Identify (Medium)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['sequence', 'identify'],
        description: 'Student puts the step cards in order (easy 3 cards, medium 4, hard every step written as its description) AND answers identify questions with no step list on screen',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Predict & Explain (Hard)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['predict', 'explain'],
        description: 'Student sees the first steps and predicts the next one (hard: both wrong choices come later in the process), and explains why a step matters by choosing what it makes possible. Requires inference beyond memorization.',
      },
    ],
    ...bossEntry(howItWorksCard),
    supportsEvaluation: true,
  },
  {
    id: 'timeline-explorer',
    description: 'Interactive chronological timeline with 5-8 events. Students first read every event on the timeline (its date, a description, an impact line and how it connects to the next), then the timeline closes and a check built by code from the events\' time order begins: name the event a clue describes, say when an event happened, put event cards in time order, or match each cause to the event it led to. No card in the check shows a date. Works for ANY chronological topic — history of aviation, evolution of computers, life of a city, scientific discoveries. ESSENTIAL for K-8 chronological understanding across all subjects.',
    constraints: 'Best for topics with clear chronological progression (5-8 events). Not ideal for non-sequential topics. Code builds every question, option and answer from the events; the manifest picks the topic, never the questions. Evaluable: every answer is checked by code.',
    affordances: { representation: 'symbolic', answers: ['tap', 'spoken', 'manipulate'], role: ['introduce', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'explore',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Guided Exploration (Easy)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        description: 'Student reads every event, then answers 3 "which event is this?" questions from a clue that names neither the event nor its date (easy: 3 choices far apart in time; hard: 4 choices including the events next to it). The timeline can come back as help.',
      },
      {
        evalMode: 'order',
        affordances: { answers: ['manipulate', 'tap', 'spoken'] },
        label: 'Chronological Ordering (Medium)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['order', 'identify'],
        description: 'Student puts event cards (titles, no dates) in time order and identifies an event from a clue, with the timeline hidden (easy: 3 cards spread out in time; hard: 5 cards next to each other in time)',
      },
      {
        evalMode: 'connect',
        affordances: { answers: ['manipulate', 'tap', 'spoken'] },
        label: 'Cause & Effect (Hard)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['cause_effect', 'date'],
        description: 'Student matches each cause to the later event it led to and says when events happened, with the timeline hidden (easy: 2 pairs; hard: 3 pairs and an extra event that happened before every cause). Requires understanding WHY things happened, not just WHEN.',
      },
    ],
    ...bossEntry(timelineExplorerCard),
    supportsEvaluation: true,
  },
  {
    id: 'vocabulary-explorer',
    description: 'Topic-specific vocabulary: 6-8 word cards (what each word means, a sentence using it, related words, pronunciation and origin) that students study, then a check built by code from those words. The cards close when the check starts. Tasks: match words to their meanings; choose the word that completes a new sentence; choose the word that fits a described situation that never names it. Students say the word or tap it. Natural complement to any content primitive. ESSENTIAL for K-8 vocabulary building across all subjects.',
    constraints: 'Best for topics with specialized terminology (6-8 words). Not ideal for topics without distinct vocabulary. Code builds every question, choice and answer from the word cards; the manifest picks the topic, never the questions. Evaluable: every answer is checked by code.',
    affordances: { representation: 'symbolic', answers: ['tap', 'spoken'], role: ['introduce', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'explore',
        affordances: { answers: ['tap'] },
        label: 'Explore & Match (Guided)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['match'],
        description: 'Student studies the word cards, then matches words to their meanings (easy 3 pairs, medium 4, hard 4 with one extra meaning that goes with none)',
      },
      {
        evalMode: 'recall',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Recall & Fill (Unguided)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match', 'fill_blank'],
        description: 'Student matches words to meanings AND chooses the word that completes new sentences, with the cards closed (hard: the other choices are related words of the same kind)',
      },
      {
        evalMode: 'apply',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Apply in Context (Hard)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['fill_blank', 'context'],
        description: 'Student chooses the word that completes a new sentence and the word that fits a described situation that never names it. Requires transferring vocabulary to novel contexts.',
      },
    ],
    ...bossEntry(vocabularyExplorerCard),
    supportsEvaluation: true,
  },
  {
    id: 'digital-skills-sim',
    description: 'Guided practice of basic device skills for young learners: click the named picture among several, press, hold and drag a picture into the named box, and find and press letters on an on-screen keyboard (a capital letter, a small letter, or a short word in order). Pictures and boxes carry no words and nothing marks the right picture, box or key; harder items add more and smaller pictures and boxes. Perfect for teaching basic computer interaction. ESSENTIAL for K-1 digital literacy.',
    constraints: 'K-1 only. Challenges are very simple motor-skill tasks, not academic content. Code builds every item and its answer; the manifest picks the picture theme, never the items.',
    affordances: { answers: ['tap', 'manipulate', 'type'], role: ['introduce', 'apply'], minutes: 4 },
    evalModes: [
      {
        evalMode: 'click',
        affordances: { answers: ['tap'] },
        label: 'Click Practice (Easy)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['click'],
        description: 'Click the named picture among 2 to 4 pictures with no words (harder: more, smaller pictures)',
      },
      {
        evalMode: 'drag',
        affordances: { answers: ['manipulate'] },
        label: 'Drag Practice (Easy)',
        beta: -1.0,
        scaffoldingMode: 2,
        challengeTypes: ['drag'],
        description: 'Press, hold and drag a picture into the named box among 2 to 4 boxes (harder: more, smaller boxes)',
      },
      {
        evalMode: 'type',
        affordances: { answers: ['type'] },
        label: 'Type Practice (Easy)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['type'],
        description: 'Find and press a letter on an on-screen keyboard (easy: a capital letter; medium: a small letter on a capital key; hard: a three-letter word in order)',
      },
    ],
    ...bossEntry(digitalSkillsSimCard),
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
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'manipulate'], role: ['introduce', 'visualize', 'apply'], minutes: 7 },
    evalModes: [
      {
        evalMode: 'explore',
        affordances: { answers: ['tap'] },
        label: 'Explore (Tier 1)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['explore'],
        description: 'Mostly display blocks (flip-card facts, tap-to-explore content) with 1-2 easy MC questions. Low retrieval demand.',
      },
      {
        evalMode: 'recall',
        label: 'Recall (Tier 2)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['recall'],
        description: 'More MC questions testing direct recall; compare-contrast blocks become graded sort-the-statements challenges.',
      },
      {
        evalMode: 'apply',
        label: 'Apply (Tier 3)',
        beta: 0.5,
        scaffoldingMode: 3,
        challengeTypes: ['apply'],
        description: 'Data tables gain graded find-the-pattern questions (compare rows), timelines become graded sequencing challenges, plus MC requiring cross-referencing.',
      },
      {
        evalMode: 'analyze',
        label: 'Analyze (Tier 4)',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['analyze'],
        description: 'Hard MC + synthesis questions alongside graded sorting, sequencing, and pattern-finding. Student must analyze, not just retrieve.',
      },
    ],
    tutoring: {
      taskDescription:
        'Guide the student through an orchestrated DeepDive on "{{topic}}". The experience has {{blockCount}} blocks '
        + 'including {{evaluableBlockCount}} interactive questions. Sections: {{blockLabels}}. Narrative arc: {{narrativeArc}}.',
      contextKeys: ['title', 'topic', 'blockCount', 'evaluableBlockCount', 'narrativeArc', 'blockLabels'],
      scaffoldingLevels: {
        level1:
          '"Look at the information presented in this section. What stands out to you?"',
        level2:
          '"Which section talks about this? Re-read it carefully — the answer connects to what you learned there."',
        level3:
          '"Here\'s what that section tells us: [restate the key idea in one simple sentence]. So — [re-ask the question in your own words] — what do you think?"',
      },
      commonStruggles: [
        { pattern: 'Student skips display blocks and jumps straight to questions', response: 'Encourage the student to read through each section before answering questions — the answers are embedded in the content above.' },
        { pattern: 'Student answers MC without reading the explanation', response: 'Ask the student to read the explanation after answering — it reinforces the concept and connects back to the content.' },
        { pattern: 'Student taps the same content card several times', response: 'Give a fresh angle each time — a new example, comparison, or story detail — never repeat the previous response.' },
        { pattern: 'Student places sort/sequence items rapidly without reading (guess-and-check)', response: 'Slow them down: pick ONE statement or event and ask what it means in their own words before placing it.' },
      ],
      aiDirectives: [
        {
          title: 'TAP-TO-EXPLORE RESPONSES',
          instruction:
            'Messages tagged [FACT_EXPLORE], [COMPARE_EXPLORE], [TIMELINE_EXPLORE], [QUOTE_EXPLORE], [TABLE_EXPLORE], [DIAGRAM_EXPLORE], or [PROSE_EXPLORE] '
            + 'mean the student tapped a content card (or diagram hotspot) to hear more. Respond with 2-3 short, conversational, grade-appropriate sentences '
            + 'that expand on that exact content, then end with one inviting question. Never turn it into a quiz, never say "you tapped" '
            + 'or refer to cards/buttons, and never reveal answers to the interactive questions elsewhere in this DeepDive.',
        },
        {
          title: 'ANSWER MOMENTS',
          instruction:
            'On [ANSWER_CORRECT], celebrate in one sentence and point the student forward. On [ANSWER_INCORRECT], the correct answer was '
            + 'already revealed on screen — encourage gently and restate the key idea in fresh words. On [ALL_COMPLETE], give brief, '
            + 'phase-specific praise.',
        },
        {
          title: 'PRE-READER READ-ALOUD (KINDERGARTEN)',
          instruction:
            'When the student is a kindergarten/pre-reader, the on-screen text is invisible to them — YOUR VOICE is the reading channel. '
            + 'Messages tagged [QUIZ_READ_ALOUD], [BLOCK_READ_ALOUD], [SIM_READ_ALOUD], or [SIM_OBSERVE] contain content that MUST be read '
            + 'aloud word for word, warmly and clearly, in full — this read-aloud IS your response and OVERRIDES any one-sentence or '
            + 'keep-it-brief instruction. For [QUIZ_READ_ALOUD]: read the question, then each answer choice slowly, then ask which one they '
            + 'pick — NEVER hint at or reveal which is correct. For [SIM_READ_ALOUD]: read the little experiment setup, then the question, '
            + 'then each choice slowly, then ask which they think will happen — NEVER reveal which is right. For [SIM_OBSERVE]: read what the '
            + 'child now sees after they changed the control, word for word. On explore taps ([FACT_EXPLORE] etc.) from a pre-reader, FIRST '
            + 'read the card\'s text word for word, THEN add one lively sentence. On [QUIZ_RETRY] or [SIM_PREDICT_RETRY], give one warm '
            + 'spoken hint without revealing the answer and invite another tap.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'passage-studio',
    description:
      'Multi-block close-reading experience anchored to a single text stimulus (prose excerpt, poem, dialogue, or sentence set). '
      + 'Walks the student from reading → comprehension → analysis → synthesis using anchored MCQ, evidence-highlight, vocab-in-context, '
      + 'inference-builder, and rubric-judged theme-statement blocks. ESSENTIAL for any language-arts topic that benefits from grounded '
      + 'textual analysis. Distinct from deep-dive: PassageStudio orbits a fixed text, not a topic abstraction.',
    constraints:
      'Best for grade-appropriate literature, poetry, opinion writing, dialogue analysis, and grammar/syntax work. Requires a passage worth '
      + 'reading carefully; not appropriate for purely factual recall topics (use deep-dive instead).',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: ['introduce', 'apply'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'explore',
        affordances: { answers: ['tap'] },
        label: 'Explore (Tier 1)',
        beta: -1.5,
        scaffoldingMode: 1,
        challengeTypes: ['explore'],
        description: 'Mostly display blocks (passage + author context) with 1–2 easy comprehension MCQs. No theme-statement.',
      },
      {
        evalMode: 'recall',
        affordances: { answers: ['tap'] },
        label: 'Recall (Tier 2)',
        beta: -0.5,
        scaffoldingMode: 2,
        challengeTypes: ['recall'],
        description: '2–3 comprehension-mcq + 1 vocab-in-context. Direct retrieval from the passage.',
      },
      {
        evalMode: 'apply',
        affordances: { answers: ['tap'] },
        label: 'Apply (Tier 3)',
        beta: 0.5,
        scaffoldingMode: 3,
        challengeTypes: ['apply'],
        description: 'Comprehension + evidence-highlight + vocab-in-context. Student must support claims with textual evidence.',
      },
      {
        evalMode: 'analyze',
        label: 'Analyze (Tier 4)',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['analyze'],
        description: 'Comprehension + evidence + inference-builder + theme-statement (rubric judge). Use reveal_beat or annotated_passage layout.',
      },
    ],
    tutoring: {
      taskDescription:
        'Guide the student through a PassageStudio close-reading lesson titled "{{title}}". '
        + 'The full {{stimulusKind}} stimulus is provided below as STIMULUS — read it carefully, since every '
        + 'response should ground itself in specific phrases from this text. '
        + '{{stimulusTitle}}{{stimulusAuthor}} '
        + 'Lesson layout: {{layout}}. The lesson has {{blockCount}} blocks ({{evaluableBlockCount}} interactive); '
        + 'student has answered {{answeredCount}} so far. '
        + 'Currently focused block: "{{currentBlockLabel}}" ({{currentBlockType}}). '
        + 'Block-specific tutoring brief: {{currentBlockBrief}}\n\n'
        + 'STIMULUS:\n{{stimulusFullText}}',
      contextKeys: [
        'title',
        'stimulusKind',
        'stimulusTitle',
        'stimulusAuthor',
        'stimulusFullText',
        'layout',
        'blockCount',
        'evaluableBlockCount',
        'answeredCount',
        'narrativeArc',
        'blockLabels',
        'currentBlockId',
        'currentBlockLabel',
        'currentBlockType',
        'currentBlockBrief',
      ],
      scaffoldingLevels: {
        level1:
          '"Look back at the passage. What lines stand out for this question?"',
        level2:
          '"Re-read the part of the passage that connects to {{currentBlockLabel}}. The evidence is in the text — point to a specific phrase."',
        level3:
          '"Let me point you to the evidence. Quote a specific phrase from the passage that grounds the answer, then ask the student how that phrase connects to the question. Do not reveal the answer."',
      },
      commonStruggles: [
        { pattern: 'Student answers without referring back to the passage', response: 'Encourage rereading. Ask: "Which line in the passage tells you that?" — every answer must be grounded in textual evidence.' },
        { pattern: 'Student picks a literal answer when an inference is needed', response: 'Ask: "Does the passage say this directly, or are we putting clues together?" — distinguish stated from implied.' },
        { pattern: 'Student writes a generic theme-statement', response: 'Push for specificity: "What in THIS passage tells you that?" — themes must be rooted in the specific text, not generic life lessons.' },
        { pattern: 'Student rushes past poetry without hearing the rhythm', response: 'Offer to read the poem aloud. Pause at line breaks and let the imagery land before discussing.' },
        { pattern: 'Student gives the same wrong answer repeatedly', response: 'Switch to level-3 scaffolding: name the specific phrase in the passage that grounds the correct answer. Still do not state the answer itself.' },
      ],
      aiDirectives: [
        {
          title: 'PASSAGE READING',
          instruction:
            'When you receive [READ_ALOUD], the student tapped the Listen button — begin reading the '
            + 'stimulus from your context IMMEDIATELY with no preamble, no introduction, no commentary '
            + 'before or after. Read straight through. '
            + 'When the student asks you to read the passage in chat, or when a [PASSAGE_STUDIO_START] '
            + 'arrives for a poem or dialogue, you may offer a one-sentence introduction first.\n'
            + 'Cadence rules apply in both cases:\n'
            + '- Poems: pause at line breaks; let imagery land.\n'
            + '- Dialogue: voice each speaker distinctly.\n'
            + '- Prose: natural reading rhythm with emphasis on key phrases.\n'
            + '- Sentence sets: brief pauses between sentences.',
        },
        {
          title: 'BLOCK FOCUS UPDATES',
          instruction:
            'The currentBlockLabel, currentBlockType, and currentBlockBrief fields update silently as the '
            + 'student scrolls between blocks. Note these changes but do NOT speak unless the student is '
            + 'clearly struggling, asks a question, or a [TAG] message arrives. The currentBlockBrief is '
            + 'the orchestrator\'s pedagogical intent for this block — let it shape your tone and focus.',
        },
        {
          title: 'ANSWER FEEDBACK',
          instruction:
            'When you receive [ANSWER_CORRECT], briefly congratulate. If the block has an evidenceAnchor, '
            + 'quote the specific passage phrase that grounds the correct answer to reinforce textual evidence.\n'
            + 'When you receive [ANSWER_INCORRECT] with attempt < 3, give one short hint that points the '
            + 'student back to a specific section of the passage WITHOUT revealing the answer.\n'
            + 'When you receive [ANSWER_INCORRECT] with attempt >= 3, switch to level-3 scaffolding: '
            + 'quote a specific phrase from the passage that grounds the correct answer, then ask the '
            + 'student to connect that phrase to the question. Still do not state the answer itself.',
        },
        {
          title: 'COMPLETION',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate the close-reading work and reflect on one '
            + 'specific insight from the passage that the lesson illuminated. Reference a phrase from the '
            + 'stimulus by name. Keep it to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
];
