/**
 * Core Catalog - Essential component definitions used across all topics
 *
 * Contains foundational components like curator brief, concept cards,
 * tables, comparisons, and general-purpose primitives.
 */

import { ComponentDefinition } from '../../../types';
import type { FastFactMiss } from '../../../primitives/visual-primitives/core/fastFactWorkspace';
import type { VocabMiss } from '../../../primitives/visual-primitives/core/vocabularyExplorerWorkspace';
import type { FactFileMiss } from '../../../primitives/visual-primitives/core/factFileWorkspace';
import type { TimelineMiss } from '../../../primitives/visual-primitives/core/timelineExplorerWorkspace';
import type { HowMiss } from '../../../primitives/visual-primitives/core/howItWorksWorkspace';
import { missLists, sameMisses } from './missLists';
import type { SkillMiss } from '../../../primitives/visual-primitives/core/digitalSkillsWorkspace';

export const CORE_CATALOG: ComponentDefinition[] = [
  {
    id: 'curator-brief',
    description: 'Introduction, learning objectives, and hook. REQUIRED: Always include this first.',
    constraints: 'Must be first component',
    affordances: { representation: 'symbolic', reader: 'none', role: 'introduce', minutes: 2, maxPerLesson: 1 },
    // The lesson's opening screen, an ungraded teaching surface (2026-10-11). It replaces the tabbed
    // brief and its [READ_SECTION] scaffold: a bound brief owns the lesson opening, so the greeting
    // and the hook are one turn. Contract: docs/contracts/curator-brief.md.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
        'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
      ungraded: true,
      guidance: 'This is the first screen of the lesson and your first words to the learner, so it is also your greeting. '
        + 'A picture of where the hook happens (it arrives a few seconds in) sits above three short captions: the hook, '
        + 'the big idea, and what the learner will do today. Below them are the lesson steps, two or three "I wonder" '
        + 'choices and a Start button, which works as Done on this screen. The captions are three beats of about one sentence each; '
        + 'the learner may not read yet, so the captions reach them through you, in your own words. A tapped "I wonder" '
        + 'choice is curiosity with no right answer. The picture sets the scene only. You cannot change a caption or the picture.',
    },
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
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
        'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
      guidance: 'A fact drill with no timer: never mention speed, a clock or answering quickly. The learner says a choice or '
        + 'taps it; a spoken choice is a real answer, and a tap is checked by the activity at once. When the choices are '
        + 'pictures you are not told the answer. Read the question aloud, and for a young learner read every choice aloud '
        + 'in the order shown, in the same voice for each. Before an answer, and after a wrong one, never say the answer, which choice it is, or rule choices out until one is left. A counting picture '
        + 'is counted by the learner: point them to it, never say how many. Teaching is how to get to the fact: what the '
        + 'question asks, a related fact they know, a way to work it out that the learner then carries out. Never count, '
        + 'add or work it through yourself, not even to one step short of the end. You cannot tap for the learner.',
      // Every mode has levers (`fastFactLevers.ts`): spread_pictures on counting pictures, count_model on a sum,
      // difference or product, drop_far_choice on any menu with two untried choices to spare. No miss is unanswered by
      // decision; a two-choice item, or a three-choice text item after one wrong tap, offers none (reported).
      levers: true,
      // The tap's own check (`fastFactMiss`), every mode: the drill is subject-agnostic, so the misses are the shapes a
      // wrong choice has in any subject.
      misses: sameMisses<FastFactMiss>(['recognize', 'recall', 'apply'],
        ['wrong_operation', 'one_less', 'one_more', 'other_number', 'other_choice']),
    },
    description: 'Untimed fluency drill for rapid recall across any subject. '
      + 'Multiple-choice challenges with configurable phases and visual prompts. No countdown or time pressure — students answer at their own pace; response time is measured silently for the automaticity signal only. '
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
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap'], role: ['apply', 'assess'], minutes: 3 },
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
    tutoring: {
      taskDescription:
        'Guide the student through an untimed fluency drill (no clock, no time pressure). Subject: {{subject}}. '
        + 'Current challenge: "{{promptText}}" ({{challengeType}}, {{responseMode}} mode). '
        + 'Correct answer: "{{correctAnswer}}". '
        + 'Attempt {{attemptNumber}}. Streak: {{streak}}. Accuracy: {{accuracy}}%. '
        + 'Challenge {{currentIndex}} of {{totalChallenges}}. Never rush the student or mention speed.',
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
          '"Here\'s a strong strategy: connect this to something you already know well, '
          + 'then rule out the choices that clearly do not fit. Which one feels right now?"',
      },
      commonStruggles: [
        { pattern: 'Student answers without reading carefully and gets it wrong', response: 'There is no rush — take a breath and read the whole question once more. What is it really asking?' },
        { pattern: 'Student freezes or seems unsure', response: 'It is okay to take your time, and okay to make your best guess! Even a guess helps you learn. What feels closest?' },
        { pattern: 'Student gets frustrated after wrong answers', response: 'Every wrong answer teaches your brain something. You are making progress — keep going!' },
        { pattern: 'Student answers correctly but is still working it out step by step', response: 'You know this! The more you practice, the more it will just pop into your head — no rush at all.' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], welcome the student to the fluency drill. '
            + 'Mention the subject and number of challenges. Reassure them it is untimed and they can take all the time they need. '
            + 'Then say the first question out loud, word for word — a young student may not be able to read it. '
            + 'Keep it to 2-3 sentences.',
        },
        {
          title: 'CORRECT ANSWER FEEDBACK',
          instruction:
            'When you receive [ANSWER_CORRECT], briefly celebrate the correct thinking. '
            + 'Do NOT mention speed or how fast they answered. '
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
          title: 'NEXT CHALLENGE TRANSITION',
          instruction:
            'When you receive [NEXT_ITEM], say the new question itself out loud ("{{promptText}}") — a young student may not be able to read it. '
            + 'Acknowledge progress if relevant. Keep to 1-2 sentences.',
        },
        {
          title: 'COMPLETION CELEBRATION',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate the student\'s effort. '
            + 'Mention phase scores and best streak, and affirm their accuracy and growing confidence — not speed. '
            + 'Give subject-specific encouragement. Keep to 2-3 sentences.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'fact-file',
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'A fact file (key stats and tabbed sections) with multiple-choice questions about it. You cannot see the '
        + 'file text, so never state a fact, number or detail as if from it. Open file: the learner looks the answer up. '
        + 'Closed file: the learner remembers it. While the learner is reading, the question is hidden: help them read '
        + 'and do not ask it. Read the question aloud, and for a young learner every choice, in the same voice. Before '
        + 'an answer and after a wrong one: never say the answer or which choice it is; never describe a choice by what '
        + 'it says or is about ("the one about species"); never hint at the idea the answer rests on ("think about '
        + 'what makes things float", "heavier or lighter?"); never say what a wrong choice is or means; never rule '
        + 'choices out until one is left. Never name a section in words, not even as a memory cue ("think back to the '
        + 'Key Stats", "what you read about records"): point_to_section shows it, recorded as help. Teaching is what the '
        + 'question asks and how to look or remember, never the content of the answer. You cannot tap or open a tab '
        + 'for the learner.',
      // Every mode: point_to_section (help) and drop_far_choice (simplify), `factFileLevers.ts`.
      levers: true,
      // The tap's own check (`factFileMiss`): the wrong choice is a fact the file states elsewhere, or one it does not state.
      misses: sameMisses<FactFileMiss>(['explore', 'recall', 'apply'], ['other_file_fact', 'not_in_file']),
    },
    description: 'Magazine-style profile card with key stats, quick facts, deep dive sections, records, and "did you know?" callouts. Students explore tabbed sections then answer self-check questions. Works for ANY topic — trash trucks, volcanoes, ancient civilizations, animals. ESSENTIAL for K-8 general content delivery.',
    constraints: 'Best for topics with concrete facts and stats. Not ideal for purely narrative content.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['tap'], role: ['introduce', 'apply'], minutes: 6 },
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
        {
          title: 'PRE-READER READ-ALOUD (kindergarten)',
          instruction:
            'For a pre-reader (kindergarten) the child CANNOT read the self-check question or options. '
            + 'When you receive [FACTCHECK_READ_ALOUD], READ ALOUD, word for word, exactly what the message gives you: '
            + 'the question, then EVERY option slowly with its letter, then ask which picture they want to tap. '
            + 'Reading this aloud IS your turn — this OVERRIDES any instruction to keep it to one sentence or to be brief; read all of it. '
            + 'Never say or hint which option is correct. '
            + 'When you receive [FACTCHECK_RETRY], give ONE warm spoken hint that narrows it down without revealing the answer, and invite them to tap another picture.',
        },
      ],
    },
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
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Code builds every question from the process steps and checks every answer; you are not told the key. '
        + 'The learner first reads the steps (a pre-reader sees pictures: read them aloud); the questions start when they press Start. '
        + 'Once they start, never retell the steps in order. IDENTIFY: the description of a step, its own name blanked; never say '
        + 'which step it is, its number, or the blanked words. SEQUENCE: no step list is on screen; never say or imply which card '
        + 'comes first, next or last, what comes before or after any card, or that two cards are swapped, even as a question '
        + '("what happens after your foot pushes down?"). PREDICT: never say or describe what the next step does, or hint with a '
        + 'word from the name of a choice. EXPLAIN: never say in your own words what the asked step makes possible, carries or '
        + 'connects (that is the answer), or which choice fits. Outside SEQUENCE you may ask what has to happen before or after a '
        + 'step the learner names. After a miss, never say why the wrong choice was chosen. Describe a lever only by what the '
        + 'scene says it shows. You cannot tap, place, check or press Start for the learner.',
      // identify: step_numbers (no step list on screen), two_choices, easier_item; predict: last_step, two_choices,
      // easier_item; explain: show_step, two_choices, easier_item; sequence: show_why (every card has a purpose) and
      // fewer_cards (`howItWorksLevers.ts`). A pre-reader's picture order has only fewer_cards.
      levers: true,
      // The activity's own check (`howMiss`) on a tap or an order, and the same ids as each spoken item's known misses.
      misses: missLists<HowMiss>({
        guided: ['neighbour_step', 'far_step'],
        sequence: ['adjacent_swap', 'reversed', 'one_moved', 'two_swapped', 'mixed_order', 'neighbour_step', 'far_step'],
        predict: ['skipped_ahead', 'went_back', 'neighbour_step', 'far_step'],
      }),
    },
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
          title: 'PRE-READER PICTURE STORY (K)',
          instruction:
            'If this activity is the picture story for a young child (you will receive [ACTIVITY_START_PRE] with a numbered list of steps), READ IT ALOUD as your greeting: read every step out loud in order, word for word, and invite the child to tap the big play button when ready for the questions. '
            + 'Reading the steps aloud IS your greeting — this OVERRIDES any one-sentence or "keep it brief" cap; do not shorten it or skip a step. '
            + 'When you receive [READ_QUESTION] or [NEXT_QUESTION], read the question aloud word for word. Once the questions start, never say the order of the steps or which picture is right.',
        },
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
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'First the learner reads the timeline: they open every event, then press Begin the questions. While they read, talk '
        + 'about the events freely. Then the timeline closes and code builds and checks every question from the events; you are '
        + 'not told the key. IDENTIFY: a clue describes one event; the learner says or taps its title. DATE: the learner says or '
        + 'taps when an event happened. ORDER: the learner moves cards into time order, earliest at the top. '
        + 'CAUSE AND EFFECT: the learner matches each cause to the event it led to. During the questions never say an '
        + 'event\'s date, which event fits the clue, where an event falls in time (first, last, next to another), which card comes before another (never name a card or a pair to look at), or which effect '
        + 'goes with a cause, and never retell what an event was about; ask what the learner remembers of it. When you restate a clue, never add a word from a choice\'s title. After a miss, never '
        + 'say which choice it was close to. Describe a lever card only by what the scene says it shows. You cannot open, tap, '
        + 'move, match or check for the learner.',
      // identify: show_timeline, two_choices; date: before_after, date_line, two_dates; order: read_cards, led_to,
      // fewer_cards; cause_effect: read_cards, show_dates, two_links (`timelineExplorerLevers.ts`). Every miss is answered
      // by a help lever first.
      levers: true,
      // The activity's own check (`timelineMiss`) on a tap or a check, and the same ids as each spoken item's known misses.
      misses: missLists<TimelineMiss>({
        explore: ['adjacent_event', 'distant_event'],
        order: ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order', 'adjacent_event', 'distant_event'],
        connect: ['used_extra', 'effect_before_cause', 'pairs_swapped', 'mixed_links', 'adjacent_date', 'distant_date'],
      }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'vocabulary-explorer',
    description: 'Topic-specific vocabulary: 6-8 word cards (what each word means, a sentence using it, related words, pronunciation and origin) that students study, then a check built by code from those words. The cards close when the check starts. Tasks: match words to their meanings; choose the word that completes a new sentence; choose the word that fits a described situation that never names it. Students say the word or tap it. Natural complement to any content primitive. ESSENTIAL for K-8 vocabulary building across all subjects.',
    constraints: 'Best for topics with specialized terminology (6-8 words). Not ideal for topics without distinct vocabulary. Code builds every question, choice and answer from the word cards; the manifest picks the topic, never the questions. Evaluable: every answer is checked by code.',
    affordances: { representation: 'symbolic', answers: ['tap', 'spoken'], role: ['introduce', 'apply'], minutes: 6 },
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Code builds and checks every item from the word cards; you are not told which word or meaning is right. '
        + 'Before the check the learner reads the cards (what each word means, a sentence using it): talk about the words then, '
        + 'and do not ask the questions of the check. Start the check closes the cards for good. MATCH: the words and meanings are '
        + 'on screen; never say which meaning goes with a word, never retell a meaning so it points to one word, never say which '
        + 'pairs are wrong, and never name an idea from one meaning for the learner to look for ("warming up into a gas", '
        + '"cooling into drops"), in the meanings or in the example sentences. SENTENCE and '
        + 'SITUATION items: the learner says the word or taps it. Never say the word, its first sound or letter, and never rule a '
        + 'choice out. Never put what is happening into the words of the right meaning ("liquid turning into a gas", "water '
        + 'gathering together"): read the sentence or situation as written and ask what is happening in it and which words are '
        + 'clues. Never say what kind of word the blank needs (an action word, a thing), even when the choices are labeled. Never '
        + 'say what a choice means unless the meanings are on screen; then the learner reads them (read them aloud only when '
        + 'asked, every one in order), and never point to one. You cannot tap, '
        + 'pair or check for the learner.',
      // match publishes show_examples and fewer_pairs (when other words are left for a smaller match); fill_blank
      // tag_word_kinds (choices of two kinds), show_meanings, drop_choice; context show_meanings, drop_choice
      // (`vocabularyExplorerLevers.ts`). Every miss is answered by a help lever first.
      levers: true,
      // The activity's own check (`vocabMiss`) on a tap, and the same ids as each spoken item's known misses.
      misses: missLists<VocabMiss>({ explore: ['extra_meaning', 'swapped_pair', 'several_wrong'],
        recall: ['extra_meaning', 'swapped_pair', 'several_wrong', 'related_word', 'wrong_kind_of_word', 'other_word'],
        apply: ['related_word', 'wrong_kind_of_word', 'other_word'] }),
    },
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
          title: 'CHECK STARTED',
          instruction:
            'When you receive [CHECK_STARTED], the word cards have closed. Read the first question aloud '
            + 'and let the student answer. Keep to 1-2 sentences.',
        },
        {
          title: 'CHALLENGE FEEDBACK',
          instruction:
            'When you receive [ANSWER_CORRECT], celebrate and use the word in a new sentence. '
            + 'When you receive [ANSWER_INCORRECT], give a hint about the meaning '
            + 'without naming a word or ruling a choice out. Keep to 1-2 sentences.',
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
    tutoring: {
      taskDescription:
        'Student is practicing basic digital skills: {{currentPhase}} phase, challenge {{challengeIndex}} of {{totalChallenges}}. Current instruction: "{{instruction}}".',
      contextKeys: ['title', 'currentPhase', 'challengeIndex', 'totalChallenges', 'instruction'],
      scaffoldingLevels: {
        level1:
          '"Listen again: what are we looking for? Look at every picture before you click."',
        level2:
          '"Move the pointer slowly until it sits right on the picture, keep your hand still, then click."',
        level3:
          '"Say the name of each picture you see, one by one. Which one did I ask for?"',
      },
      commonStruggles: [
        { pattern: 'Student clicks but misses the pictures', response: 'Encourage slower, more deliberate mouse movement: the pointer touches the picture before clicking.' },
        { pattern: 'Student cannot complete drag — lets go before reaching a box', response: 'Remind the student to hold the button down while moving, and let go only when the picture is over the box.' },
        { pattern: 'Student presses wrong keys repeatedly', response: 'Ask the student to look along each row of keys, one row at a time, without naming the row.' },
      ],
    },
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1'],
      guidance: 'Code builds and checks every item; you are not told where the target is. The learner may not read yet, so say '
        + 'the question in your own words. CLICK: pictures with no words spread across a play area; the learner clicks the one '
        + 'the question names. DRAG: the learner presses on the picture, holds, moves it and lets go over the box the question '
        + 'names; the boxes are pictures with no words. TYPE: an on-screen keyboard of capital letters; the learner presses the '
        + 'letter on the card (a small letter is pressed on its capital key), or the letters of a word in order. Coach the movement: '
        + 'move the pointer onto a picture before clicking, keep the hand still when clicking, hold the button down while moving, '
        + 'let go only over a box, look along each row of keys. Never say where a picture, box or key is (left, right, top, bottom, '
        + 'which row, next to; a row that glows may be named), never describe the right one beyond the name the question uses, and never say which one is right '
        + 'or which one the learner should have chosen. For a small letter, never say or spell its capital: matching it to the '
        + 'capital key is the task. Describe a lever card only by what the scene says it shows. You cannot '
        + 'click, drag or press keys for the learner.',
      // click publishes show_picture, big_targets and fewer_pictures (3 or more pictures); drag show_picture, big_boxes and
      // fewer_boxes (3 or more boxes); type glow_row, big_keys, capital_card (small letters) and one_letter (words)
      // (`digitalSkillsLevers.ts`). Every miss is answered by a help lever first.
      levers: true,
      // The activity's own check (`skillMiss`) on a click, a drop or a key.
      misses: missLists<SkillMiss>({ click: ['wrong_picture', 'missed_picture'], drag: ['wrong_box', 'let_go_outside'],
        type: ['neighbour_key', 'mirror_letter', 'wrong_key'] }),
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
