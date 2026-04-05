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
      + 'Supports identify (find specific dates), count (count days or days between dates), and pattern (discover calendar patterns) challenge types. '
      + 'Grade range K-5.',
    constraints: 'Requires a month/year context and challenge array. Grade band determines complexity.',
    tutoring: {
      taskDescription:
        'Student is exploring a calendar for {{month}}/{{year}}, answering questions about dates, counting days, and finding patterns.',
      contextKeys: ['title', 'gradeBand', 'currentChallenge'],
      scaffoldingLevels: {
        level1: 'Can you look at the calendar and find what the question is asking about?',
        level2:
          "Let's break it down — first find {{month}} on the calendar, then look at the days row by row. What do you notice?",
        level3:
          'Look at the top row of the calendar. The days of the week go Sun, Mon, Tue, Wed, Thu, Fri, Sat. Count along the row to find your answer.',
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
      ],
    },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Identify Dates (Easy)',
        beta: -1.5,
        scaffoldingMode: 2,
        challengeTypes: ['identify'],
        description: 'Find specific dates on calendar',
      },
      {
        evalMode: 'count',
        label: 'Count Days (Medium)',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['count'],
        description: 'Count specific days or days between dates',
      },
      {
        evalMode: 'pattern',
        label: 'Calendar Patterns (Hard)',
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
