/**
 * Calendar Catalog - Component definitions for calendar primitives
 *
 * Contains interactive calendar components for teaching date concepts,
 * counting days, and discovering calendar patterns from K-5.
 */

import { ComponentDefinition } from '../../../types';
import { bossEntry } from '../../../components/live-activity/boss';
import { calendarExplorerCard } from '../../../primitives/visual-primitives/calendar/calendarExplorer.card';
import type { TimelineMiss } from '../../../primitives/visual-primitives/calendar/timelineBuilderWorkspace';
import { missLists, sameMisses } from './missLists';

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
    ...bossEntry(calendarExplorerCard),
    affordances: { representation: 'symbolic', answers: ['tap', 'spoken'], role: 'apply', minutes: 5 },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'identify',
        affordances: { answers: ['tap', 'spoken'] },
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
        affordances: { answers: ['tap', 'spoken'] },
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
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Count Days Forward',
        beta: 1.0,
        scaffoldingMode: 4,
        challengeTypes: ['day_offset'],
        description: 'Count forward one to seven days from any named weekday and choose the landing day',
      },
      {
        evalMode: 'interval_count',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Days Between Events',
        beta: 1.25,
        scaffoldingMode: 4,
        challengeTypes: ['interval_count'],
        description: 'Count an explicitly defined interval between two visibly marked calendar dates',
      },
      {
        evalMode: 'pattern',
        affordances: { answers: ['tap', 'spoken'] },
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
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'The activity checks the order itself, and you are not told it: the learner taps an event in the bank, taps '
        + 'a slot to place it, and with every slot filled presses Check Order. The bank is mixed up on purpose: when you '
        + 'read the events, read them in the order given, never sorted by time, and never list more than two events, '
        + 'dates or months in time order (that is the answer). Before the check, and after a wrong one, never say which '
        + 'event comes first, next or last, which slot an event belongs in, or which two to trade. After a check the '
        + 'screen marks each slot green or red; you may say how many are right, not where the red ones go. Asking about '
        + 'one event (what happens when you wake up, which came before people had cars) and comparing two events is '
        + 'teaching. A Kindergarten or Grade 1 learner may not read: read the instruction and the event names aloud. You '
        + 'cannot place events for the learner.',
      // The activity's own check (`timelineMiss`), read from the placed order; the same kinds on every timeline.
      misses: missLists<TimelineMiss>(sameMisses(['sequence-daily', 'sequence-yearly', 'place-historical'],
        ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'])),
      // time_arrow, time_ruler, fewer_events (`timelineBuilderLevers.ts`); every miss answered on every mode.
      levers: true,
    },
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
