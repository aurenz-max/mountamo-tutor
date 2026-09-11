/**
 * Calendar Catalog - Component definitions for calendar primitives
 *
 * Contains interactive calendar components for teaching date concepts,
 * counting days, and discovering calendar patterns from K-5.
 */

import { ComponentDefinition } from '../../../types';

export const CALENDAR_CATALOG: ComponentDefinition[] = [
  {
    id: 'calendar-explorer',
    description:
      'Interactive monthly calendar where students click days, navigate months, identify patterns, count days, and answer date questions. '
      + 'Supports finding dates, marking events, counting occurrences and intervals, counting forward by weekdays, '
      + 'discovering patterns, and live-judged spoken day/month successor chains. '
      + 'Grade range K-5.',
    constraints:
      'Visual calendar modes require valid month/year context and code-verified keys for date arithmetic. '
      + 'Spoken sequence modes require at least five code-built successor turns, a random start, no printed sequence strip, '
      + 'and live tutor judgment.',
    affordances: { representation: 'symbolic', answers: ['tap', 'spoken'], role: 'apply', minutes: 5 },
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Student is doing calendar practice ({{challengeType}}), question {{challengeNumber}} of {{totalChallenges}}. '
        + 'Current prompt: {{currentChallenge}}. Calendar context when used: {{month}} {{year}}. '
        + 'In day_sequence and month_sequence modes, speak only the exact scripted application cue and judge the child\'s spoken successor.',
      contextKeys: [
        'title', 'gradeBand', 'currentChallenge', 'challengeNumber', 'totalChallenges',
        'challengeType', 'month', 'year', 'supportTier',
      ],
      scaffoldingLevels: {
        level1: 'Can you look at the calendar and find what the question is asking about?',
        level2:
          "Let's break it down — first find {{month}} on the calendar, then look at the days row by row. What do you notice?",
        level3:
          'ONLY when supportTier is easy, medium, or null: look at the top row of the calendar. '
          + 'The days of the week go Sun, Mon, Tue, Wed, Thu, Fri, Sat. Count along the row to find your answer. '
          + 'When supportTier is hard that header row is NOT on screen — do not recite it, and do not name the column; '
          + 'ask the student what they notice about where the dates sit instead.',
      },
      commonStruggles: [
        {
          pattern: 'Student clicks random dates without reading the question',
          response: 'Read the question again carefully. What exactly is it asking you to find?',
        },
        {
          pattern: 'Student confuses day-of-week with date number',
          response:
            'Remember, the number in each box is the date, and the column tells you the day of the week.',
        },
        {
          pattern: 'Student says the wrong successor during the spoken day chain',
          response:
            'Follow the scripted correction: say the full week together from Sunday, model the current successor, and ask the same turn again.',
        },
        {
          pattern: 'Student says the wrong successor during the spoken month chain',
          response:
            'Follow the scripted correction: say all months together from January, model the current successor, and ask the same turn again.',
        },
      ],
      aiDirectives: [
        {
          title: 'SUPPORT TIER — REVEAL POLICY',
          instruction:
            'The current support tier is {{supportTier}}. The tier controls how much of the calendar help is on '
            + 'screen, so it also bounds what YOU may say — you are the second scaffold channel and must match the first. '
            + 'easy: the day headers, the month caption and the highlighted target-day cells are all visible — you may '
            + 'name the day-of-week order and point at the column to use. '
            + 'medium: the month caption is withdrawn (the question names the month) — nudge the method, do not pre-solve it. '
            + 'hard: the Sun-Sat header row, the month caption AND the target-day highlighting are ALL withdrawn on purpose. '
            + 'Do NOT recite the Sun, Mon, Tue... order, do not say which column to look at, and do not hand over the '
            + 'counting strategy — that would put back the exact scaffold this tier removed. Ask what the student notices '
            + 'and guide by questioning; on a wrong attempt at hard you are not told the answer, so do not guess it aloud. '
            + 'When supportTier is null no tier is set — behave as at easy. At EVERY tier, never state the answer.',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        affordances: { answers: ['tap'] },
        label: 'Identify Dates',
        beta: -1.5,
        scaffoldingMode: 2,
        challengeTypes: ['identify'],
        description: 'Find specific dates on calendar',
      },
      {
        evalMode: 'mark_events',
        affordances: { answers: ['tap'] },
        label: 'Mark Events',
        beta: -1.0,
        scaffoldingMode: 2,
        challengeTypes: ['mark_events'],
        description: 'Place a named event marker on its requested date in a monthly calendar',
      },
      {
        evalMode: 'day_sequence',
        label: 'Days in Order',
        beta: -0.5,
        scaffoldingMode: 3,
        challengeTypes: ['day_sequence'],
        description: 'Hear one day and say each successor in a live-judged chain of at least five turns',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
      },
      {
        evalMode: 'count',
        affordances: { answers: ['tap'] },
        label: 'Count Days',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['count'],
        description: 'Count occurrences of a weekday in a monthly calendar',
      },
      {
        evalMode: 'month_sequence',
        label: 'Months in Order',
        beta: 0.5,
        scaffoldingMode: 3,
        challengeTypes: ['month_sequence'],
        description: 'Hear one month and say each successor in a live-judged chain of at least five turns',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
      },
      {
        evalMode: 'day_offset',
        affordances: { answers: ['tap'] },
        label: 'Count Days Forward',
        beta: 1.0,
        scaffoldingMode: 4,
        challengeTypes: ['day_offset'],
        description: 'Count forward one to seven days from any named weekday and choose the landing day',
      },
      {
        evalMode: 'interval_count',
        affordances: { answers: ['tap'] },
        label: 'Days Between Events',
        beta: 1.25,
        scaffoldingMode: 4,
        challengeTypes: ['interval_count'],
        description: 'Count an explicitly defined interval between two visibly marked calendar dates',
      },
      {
        evalMode: 'pattern',
        affordances: { answers: ['tap'] },
        label: 'Calendar Patterns',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['pattern'],
        description: 'Discover and apply calendar patterns',
      },
    ],
  },
  {
    id: 'timeline-builder',
    description:
      'Interactive timeline where students drag event cards onto a scaled time axis. '
      + 'Supports daily (hours within a day), yearly (months/seasons), and historical (decades/centuries) timelines. '
      + 'Students learn chronological sequencing, before/after relationships, and temporal scale. '
      + 'ESSENTIAL for K-8 social studies and math time concepts.',
    constraints: 'Requires 3-6 events with labels and correct chronological positions. Scale labels define the timeline range.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['manipulate'], role: ['visualize', 'apply'], minutes: 8 },
    tutoring: {
      taskDescription:
        'Student is building a timeline for "{{title}}" by placing events in chronological order from {{scaleStart}} to {{scaleEnd}}.',
      contextKeys: ['title', 'gradeBand', 'currentChallenge'],
      scaffoldingLevels: {
        level1: '"Which event do you think happened first? Think about what comes earliest in time."',
        level2: '"Let\'s think step by step — look at {{scaleStart}} on the left. Which event is closest to that? Now look at the next slot."',
        level3: '"Start from the left side ({{scaleStart}}). Place the earliest event first. Then think: what happened next? Work from left to right, earliest to latest."',
      },
      commonStruggles: [
        {
          pattern: 'Student places events randomly without reading labels',
          response: 'Read each event card carefully. Think about when each one happens — which comes first?',
        },
        {
          pattern: 'Student confuses two events that are close in time',
          response: 'These two events are close! Think carefully: does one usually happen before the other?',
        },
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'sequence-daily',
        label: 'Daily Sequences (Easy)',
        beta: -1.5,
        scaffoldingMode: 2,
        challengeTypes: ['daily'],
        description: 'Order events within a day',
      },
      {
        evalMode: 'sequence-yearly',
        label: 'Yearly Sequences (Medium)',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['yearly'],
        description: 'Order events across months/seasons',
      },
      {
        evalMode: 'place-historical',
        label: 'Historical Timeline (Hard)',
        beta: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['historical'],
        description: 'Place events on decade/century timelines',
      },
    ],
  },
];
