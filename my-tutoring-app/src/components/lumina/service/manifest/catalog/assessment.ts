/**
 * Assessment Catalog - Component definitions for knowledge assessment primitives
 *
 * Contains components for quizzes, knowledge checks, and learning assessment.
 */

import { ComponentDefinition } from '../../../types';

export const ASSESSMENT_CATALOG: ComponentDefinition[] = [
  {
    id: 'knowledge-check',
    description:
      'Assessment checkpoint with single or multiple problems of various types (multiple choice, true/false, '
      + 'fill-in-blanks, matching, sequencing, categorization). SPOKEN-FIRST: with a microphone the Live tutor '
      + 'runs it as a live-judged Direct Instruction check — it reads each question aloud (and the choices, where '
      + 'there are choices) and the student ANSWERS OUT LOUD; the tutor judges the audio and its own affirmation '
      + 'advances. Symbol/KaTeX choices are answered by touching the one you mean. Without a microphone it is a '
      + 'tap surface, one problem at a time.',
    constraints: 'Typically one per exhibit, at the end. The spoken form requires the live tutor and a microphone.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'tap'], role: 'assess', minutes: 4, maxPerLesson: 1 },
    // ── DI MODALITY (2026-08-18, qa/di/BACKLOG.md item 23 slice 2). The
    // judged surface is all-or-nothing per SET (completion is gated per
    // problem, so a partially-judged set would strand the check): if every
    // problem builds at least one judged item and a mic exists, the whole set
    // runs judged; otherwise the whole set runs as taps. The answer-material
    // fork, build gates and every spoken line live in
    // `primitives/knowledgeCheckScript.ts` (hand-authored, DISTAR).
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // sentence here begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'A knowledge check — the closing questions of the lesson. The current question is a '
        + '"{{challengeType}}": {{stimulus}}. With a microphone this runs as live-judged Direct '
        + 'Instruction: you speak the exact scripted lines from each bracketed application message '
        + 'and nothing else, then you judge what you heard. Without one it is a tap surface and the '
        + 'tap-surface directives below apply. Never reveal an answer before the learner has answered.',
      // Exactly what both surfaces push through updateContext. The answer key,
      // the correct option and the verdict are deliberately NOT here — the
      // judging contract tells the tutor what the answer is at the moment it
      // judges, and a second copy in runtime state is a second channel to
      // leak from.
      contextKeys: ['challengeType', 'stimulus'],
      scaffoldingLevels: {
        // 18d: every rung routes through a scripted VERDICT line or a plain
        // re-read of the question — never an improvised re-ask, which opens
        // with neither sentinel and stalls the judged loop.
        level1:
          'Help arrives through the scripted correction, never around it: after a miss, speak the '
          + 'correction line exactly as given and stop.',
        level2:
          'On the tap surface a struggling learner may hear the question again: read "{{stimulus}}" '
          + 'aloud word for word, then let them choose. On the spoken surface the [KC_HEAR] message '
          + 'carries that re-read for you.',
        level3:
          'Never name or hint at the answer at any level. The activity closes each question itself '
          + 'when the tries run out, and its closing line names the answer for you.',
      },
      commonStruggles: [
        { pattern: 'The learner hedges between two choices without committing', response: 'Stay silent and let them settle on one — a committed answer is the only thing to judge.' },
        { pattern: 'The learner says a piece of the question back instead of an answer', response: 'Treat it as thinking out loud, not an answer, and stay silent while they finish.' },
        { pattern: 'The learner goes quiet for a long time', response: 'Their think time is unbounded. Stay silent, and never announce that you are waiting.' },
        { pattern: 'The learner asks you to tell them the answer', response: 'Speak only: "It is your turn to answer." and stop.' },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DI (SPOKEN SURFACE)',
          instruction:
            'Messages tagged [KC_ITEM], [KC_MOVE], [KC_TAP], [KC_HEAR] and [KC_COMPLETE] carry exact '
            + 'scripted lines and a judging contract. Speak only what the quoted line contains, then judge '
            + 'what you hear against that contract. Affirmations open with the word "Yes," and corrections '
            + 'open with the words "My turn:" — no other sentence you speak may open with either. The '
            + 'verdict line ends your turn: never run on into the next question yourself; the application '
            + 'sends it.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [KC_ITEM] contains the greeting and the how-to-play inside its quoted line. '
            + 'Add nothing before it and nothing after it — no separate welcome, no instructions of your own.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (PER QUESTION KIND)',
          instruction:
            'The current kind is "{{challengeType}}". On true_false the child SAYS true or false — and a '
            + 'spoken yes or no counts the same way. On choice, match and sort the child SAYS which choice: '
            + 'the whole thing, or just the part that tells it apart, or where it sits in the list. On blank '
            + 'the child SAYS the missing word, alone or inside the sentence. On choice_tap the child TOUCHES '
            + 'a choice on the screen — there is nothing to listen for, and the application reports what they '
            + 'chose and which line to say. The answer is never spoken by you before your affirmation.',
        },
        {
          title: 'WAIT — THE SILENCE IS THEIRS',
          instruction:
            'After you speak a scripted ask, the learner is thinking, and their think time is unbounded. '
            + 'You stay silent while they work: no filler, no encouragement mid-think, and never an '
            + 'announcement that you are waiting or listening — you simply stop speaking.',
        },
        {
          title: 'PRE-READER READ-ALOUD (TAP SURFACE ONLY)',
          instruction:
            'When you receive [QUIZ_READ_ALOUD], a pre-reader is on this problem and CANNOT read it. '
            + 'Read the question aloud word for word, then read EACH choice slowly with its letter '
            + '(e.g. "A… cat. B… dog."), then ask which one they pick. Reading it all aloud IS your '
            + 'greeting for this problem — this OVERRIDES any instruction to keep it to one sentence. '
            + 'Never say or hint at which choice is correct. '
            + 'When you receive [QUIZ_RETRY], the child tapped a wrong choice: give ONE warm spoken hint '
            + 'without revealing the answer and invite them to tap another picture.',
        },
        {
          title: 'ANSWER FEEDBACK (TAP SURFACE)',
          instruction:
            'When you receive [ANSWER_CORRECT], briefly celebrate the student\'s success. '
            + 'Reinforce WHY the answer is correct in 1-2 sentences. Do not be overly verbose. '
            + 'If there are more problems, smoothly transition to encouraging them for the next one.',
        },
        {
          title: 'INCORRECT ANSWER GUIDANCE (TAP SURFACE)',
          instruction:
            'When you receive [ANSWER_INCORRECT], do NOT reveal the correct answer. '
            + 'Provide encouragement and a focused hint based on the scaffolding level. '
            + 'If the student has attempted multiple times, escalate to a more specific hint '
            + 'but still do not give the answer directly.',
        },
        {
          title: 'HINT WALKTHROUGH (TAP SURFACE)',
          instruction:
            'When you receive [HINT_REQUESTED], provide a progressive hint based on the level indicated. '
            + 'Level 1: Ask a guiding question to redirect thinking. '
            + 'Level 2: Break the problem into smaller parts and point to key details. '
            + 'Level 3: Walk through the reasoning step by step, stopping just short of the answer. '
            + 'NEVER reveal the correct answer in any hint level.',
        },
        {
          title: 'PROBLEM INTRODUCTION (TAP SURFACE)',
          instruction:
            'When you receive [PROBLEM_SHOWN], briefly read the question aloud in an encouraging way. '
            + 'For multi-problem sets, acknowledge the student\'s progress. '
            + 'Keep it to 1-2 sentences. Do NOT hint at the answer.',
        },
        {
          title: 'ASSESSMENT COMPLETION (TAP SURFACE)',
          instruction:
            'When you receive [ALL_COMPLETE], celebrate the student\'s effort. '
            + 'Mention how many they got correct out of the total. '
            + 'Highlight their growth if they improved over multiple attempts. '
            + 'Keep it to 2-3 encouraging sentences.',
        },
        {
          title: 'SCRATCH PAD WORK REVIEW (TAP SURFACE)',
          instruction:
            'When you receive [SCRATCH_PAD_ANALYSIS], the student has used the scratch pad '
            + 'to work through the problem by hand. The message includes a Gemini Flash Lite '
            + 'vision analysis of their handwritten work (summary, feedback, LaTeX if any, next steps). '
            + 'Use this context to give more targeted guidance: acknowledge their work, '
            + 'address any errors spotted in their scratch work, and connect their working '
            + 'to the current problem. Do NOT repeat the analysis verbatim — weave it naturally '
            + 'into your tutoring. If their scratch work shows a correct approach, encourage them '
            + 'to apply it to select the answer.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'recall',
        label: 'Recall (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity'],
        description: 'Fact retrieval: "What is X?" — definitions, simple recognition, obvious distractors.',
      },
      {
        evalMode: 'apply',
        label: 'Apply (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity', 'sequencing_activity'],
        description: 'Application: "Use X to solve Y" — standard problems, plausible procedural-error distractors.',
      },
      {
        evalMode: 'analyze',
        label: 'Analyze (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['multiple_choice', 'fill_in_blanks', 'sequencing_activity', 'categorization_activity'],
        description: 'Analysis: "Why does X happen?" — multi-step reasoning, highly plausible distractors, 4-5 options.',
      },
      {
        evalMode: 'evaluate',
        label: 'Evaluate (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 4,
        challengeTypes: ['multiple_choice', 'fill_in_blanks', 'categorization_activity'],
        description: 'Evaluation: "Which approach is best?" — expert reasoning, defensible-but-inferior distractors, 5 options.',
      },
    ],
  },
  {
    id: 'scale-spectrum',
    description: 'Interactive spectrum for placing items along a continuum. Use for teaching nuanced judgments, degrees of intensity, moral/ethical reasoning, or comparative analysis.',
    constraints: 'Best for middle-school and above. Requires items that can be meaningfully positioned on a spectrum.',
    affordances: { representation: ['pictorial', 'symbolic'], role: 'introduce', minutes: 3 },
  },
];
