/**
 * History Catalog - Component definitions for history / social studies primitives
 *
 * Contains C3 Framework social studies components for era studies,
 * continuity-vs-change reasoning, and historical thinking from K-6.
 */

import { ComponentDefinition } from '../../../types';

export const HISTORY_CATALOG: ComponentDefinition[] = [
  {
    id: 'era-explorer',
    description: 'Deep-dive exploration of a single historical era: students explore the era through lenses (daily life, technology, school and work), then answer questions about it — locating details in the right lens, sorting life details into the era / today / both then and now, contrasting the era against the one before it, and explaining what caused life to change. Perfect for "long ago vs today" comparisons, community-history and American-history era studies. ESSENTIAL for K-6 social studies / history.',
    constraints: 'Covers ONE era per session (era depth, not chronological sequencing — use timeline-explorer for event sequences). The manifest must NOT supply specific statements or lens text — the generator builds the era card and sort challenges itself.',
    evalModes: [
      {
        evalMode: 'lens_id',
        label: 'Find the Lens (Locate)',
        beta: 2.0,
        discrimination: 1.2,
        scaffoldingMode: 2,
        challengeTypes: ['lens_id'],
        description:
          'Given a life detail from the era, identify WHICH lens (Daily Life / Technology / School & Work) it came from. Locating information inside the source — the entry rung before any time judgment.',
      },
      {
        evalMode: 'era_sort',
        label: 'Then, Now, or Both (Continuity vs Change)',
        beta: 3.5,
        discrimination: 1.4,
        scaffoldingMode: 3,
        challengeTypes: ['era_sort'],
        description:
          'Classify a life detail as true only in the era, true only today, or true in both times. The C3 continuity-and-change anchor skill.',
      },
      {
        evalMode: 'era_compare',
        label: 'Compare Two Eras (Contrast)',
        beta: 5.0,
        discrimination: 1.2,
        scaffoldingMode: 4,
        challengeTypes: ['era_compare'],
        description:
          'Decide whether a life detail belongs to this era, to the era that came just before it, or to both. Contrast between two past periods, with no present-day experience to lean on.',
      },
      {
        evalMode: 'cause_of_change',
        label: 'Why Life Changed (Causation)',
        beta: 6.5,
        discrimination: 1.2,
        scaffoldingMode: 5,
        challengeTypes: ['cause_of_change'],
        description:
          'Given a way life changed between the era and now, choose the cause that drove it — technological, economic, or political. Historical causation, not description.',
      },
    ],
    tutoring: {
      taskDescription:
        'Student is exploring one historical era, "{{eraName}}" ({{eraPeriod}}), in "{{title}}". '
        + 'They read {{totalLenses}} lenses on life back then — {{lensesVisited}} opened so far, currently the "{{activeLens}}" lens — '
        + 'and then judge {{totalChallenges}} statements about it. Right now they are {{phase}}, on question {{challengeIndex}} of {{totalChallenges}}. '
        + 'That question asks "{{question}}" — the historian move is {{challengeType}} — and the statement on screen is "{{currentStatement}}". '
        + 'The era just before this one is {{priorEraName}}. Student grade: {{gradeLevel}}.',
      contextKeys: [
        'title',
        'gradeLevel',
        'eraName',
        'eraPeriod',
        'priorEraName',
        'phase',
        'activeLens',
        'lensesVisited',
        'totalLenses',
        'challengeType',
        'question',
        'challengeIndex',
        'totalChallenges',
        'currentStatement',
      ],
      scaffoldingLevels: {
        level1:
          '"The lenses told you what life in {{eraName}} was like. Picture that, then look at the statement again."',
        level2:
          '"Go back into a lens and hunt for this one. Which lens would talk about something like \u201c{{currentStatement}}\u201d?"',
        level3:
          '"Let us go back through the {{eraName}} lenses together, one line at a time, and stop at the line that touches this idea. Then picture your own day and see whether it happens now too. Say what you found, then choose."',
      },
      commonStruggles: [
        {
          pattern: 'Student never chooses the "both then and now" box — treats everything from the era as extinct',
          response:
            '"Some things really did keep going. Before you choose, picture your own day and see whether anything like this still happens."',
        },
        {
          pattern: 'Student judges by whether the thing SOUNDS old-fashioned instead of by what the lens said',
          response:
            '"Do not go by how old it sounds. Go by what the lens told you — point to the line that gave you the idea."',
        },
        {
          pattern: 'On a compare question the student weighs the era against TODAY instead of against the era before it',
          response:
            '"Today is not on the table for this one. The two times to weigh are {{eraName}} and {{priorEraName}}."',
        },
        {
          pattern: 'On a causation question the student restates WHAT changed instead of naming what caused it',
          response:
            '"That is what changed. Now think about what made it change — a new invention, the way people earned money, or a new rule."',
        },
        {
          pattern: 'Student answers without ever opening the lens tabs',
          response:
            '"The lens tabs at the top are where the evidence lives. Open one before you decide — I will go through it with you."',
        },
        {
          pattern: 'Student cannot read the lens text or the statement (kindergarten / grade 1)',
          response:
            '"Never ask them to read. Read the lens aloud yourself, say the statement aloud, and let them answer out loud or by tapping."',
        },
      ],
      aiDirectives: [
        {
          title: 'NEVER NAME THE BOX',
          instruction:
            'The three choices on screen ARE the answer. Never say which one fits, never rule one out, and never say "it is not that one". '
            + 'Send the student to a lens, or to their own day, and let them choose. '
            + 'Once they have answered, the screen shows the explanation — build on that all you like.',
        },
        {
          title: 'THE FOUR HISTORIAN MOVES',
          instruction:
            'The current move is {{challengeType}}. Nudge with the method that move needs:\n'
            + '- lens_id: send them across the lens TABS ("which lens would talk about this?") — never name the lens yourself, that is the answer.\n'
            + '- era_sort: two pictures, one at a time — life in {{eraName}}, then their own day. The box follows from which pictures the statement fits.\n'
            + '- era_compare: today is not a choice. Weigh {{eraName}} against {{priorEraName}} only, using the two era cards on screen.\n'
            + '- cause_of_change: separate WHAT changed from WHY. Ask what had to be invented, paid for, or decided before life could change that way.',
        },
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader cannot read the lens text, the statement, or the choice labels — your voice is the only channel. '
            + 'When you receive [ERA_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, warmly and slowly, then wait. '
            + 'Do not summarize it, do not add a quiz, and do not say which choice it points to. '
            + 'Reading it aloud IS your turn — this overrides any instruction to be brief. '
            + 'For a pre-reader, say the era name and the choices aloud each round instead of expecting them to read the boxes, '
            + 'and use time words a young child owns — "back then", "now", "still happens today" — never a year or a century.',
        },
        {
          title: 'VOICE OF SOMEONE WHO LIVED THEN',
          instruction:
            'When you receive [ERA_FIGURE_VOICE], speak as an ordinary person living in {{eraName}} — first person, two or three sentences, '
            + 'about the lens the message names, in plain words a child hears easily. Say what you do, touch, and hear on a normal day. '
            + 'Then drop back into your own voice with one short line inviting them to keep exploring. '
            + 'Stay inside what that lens says. Never mention "{{currentStatement}}" or anything about the questions coming next, '
            + 'and never claim to be a named famous person unless the lens names them.',
        },
      ],
    },
    supportsEvaluation: true,
  },
];
