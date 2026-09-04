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
    // -- PORT 24 -- the judged loop, FIRST history / social-studies port -------
    // ALL FOUR MODES SPEAK. Zero taps on the answer. The click era's three bins,
    // its Check button, its Next button, its hint disclosure and its two-strikes
    // reveal ladder are gone: every answer this primitive wants is a proposition
    // a child says out loud at a table.
    // THE SPLIT (standing gate 1): every mode is `closed_set_choice`, because
    // era-explorer is a three-bin CLASSIFICATION primitive in all four of them --
    // the answer is one whole proposition out of three the question itself
    // states, and free production in any of them would be open-set. So the MENU
    // stays (the ask names the groups; the answer sits inside the question by
    // construction) and the BUTTON is what the port deletes.
    // WHAT THE JUDGED SURFACE KEEPS: the ERA CARD. This primitive is open-book
    // by design -- the lens bodies ARE the evidence and consulting them IS the
    // historian's method -- so the card is the page on the table, not apparatus,
    // and its read-aloud is the pre-reader's only channel to it.
    // Cue lines and per-item judging contracts live in `eraExplorerScript.ts`
    // (hand-authored, DISTAR); this block is the session-level frame.
    // SENTINEL DISCIPLINE re-checked on every line: no sentence begins with
    // "Yes" or with "My turn".
    description: 'Live-judged Direct Instruction on one historical era, spoken end to end. The child explores the era through three lens cards (daily life, technology, school and work), and then the tutor reads one life detail at a time and the child SAYS which lens it came from, whether life looked like that only back then, only today, or in both times, which of two past eras it belongs to, and why life changed. Requires a microphone. Every answer is spoken aloud and judged from the audio - there is nothing to drag, tap or type. Perfect for long-ago-versus-today comparisons, community-history and American-history era studies. ESSENTIAL for K-6 social studies / history.',
    constraints: 'Covers ONE era per session (era depth, not chronological sequencing - use timeline-explorer for event sequences). Requires a working microphone and the live tutor: the whole activity is a spoken exchange. The manifest must NOT supply specific statements or lens text - the generator builds the era card and the challenges itself, and code owns every answer key.',
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'lens_id',
        label: 'Find the Lens (Locate)',
        beta: 2.0,
        discrimination: 1.2,
        scaffoldingMode: 2,
        challengeTypes: ['lens_id'],
        description:
          'DI judged, spoken: given a life detail from the era, the child SAYS which lens (Daily Life / Technology / School & Work) it came from. Locating information inside the source - the entry rung before any time judgment. Beta unchanged by the port: the answer set is still one of three, the child just has to say it instead of tapping it.',
      },
      {
        evalMode: 'era_sort',
        label: 'Then, Now, or Both (Continuity vs Change)',
        beta: 3.5,
        discrimination: 1.4,
        scaffoldingMode: 3,
        challengeTypes: ['era_sort'],
        description:
          'DI judged, spoken: the child SAYS whether a life detail was true only back then, only today, or in both times. The C3 continuity-and-change anchor skill. The judging contract names the both-times refusal - judging by how old-fashioned a detail sounds - as the signature miss.',
      },
      {
        evalMode: 'era_compare',
        label: 'Compare Two Eras (Contrast)',
        beta: 5.0,
        discrimination: 1.2,
        scaffoldingMode: 4,
        challengeTypes: ['era_compare'],
        description:
          'DI judged, spoken: the child SAYS whether a life detail belongs to this era, to the era that came just before it, or to both. Contrast between two past periods, with no present-day experience to lean on - so answering "today" is wrong by construction, and the contract says so.',
      },
      {
        evalMode: 'cause_of_change',
        label: 'Why Life Changed (Causation)',
        beta: 6.5,
        discrimination: 1.2,
        scaffoldingMode: 5,
        challengeTypes: ['cause_of_change'],
        description:
          'DI judged, spoken: given a way life changed between the era and now, the child SAYS which of three causes drove it - technological, economic, or political. Historical causation, not description; restating WHAT changed is refused as the signature miss.',
      },
    ],
    tutoring: {
      // Defect 12: `{{stimulus}}` goes LAST, with the never-read-aloud clause
      // IMMEDIATELY before it. Split that clause off into its own sentence
      // higher up and the block stops identifying itself as not-content at the
      // point it arrives.
      taskDescription: 'Live-judged Direct Instruction on one historical era with a young learner. The round type right now is "{{challengeType}}" (the special type free_explore means there is no judged loop at all - the child is simply browsing the era cards, and you react briefly and warmly as a guide without quizzing them). The learner answers OUT LOUD every round and you judge what you hear against the exact contract in each bracketed [ERA_ITEM] message; you speak the scripted lines from those messages and nothing else. Reading the era cards and working the judgment out from them is the entire skill being practiced, so never read a lens aloud unless a message asks you to, never say which of the three choices is right, and never rule one out. The question side of what is on screen, described for you alone and never read aloud: {{stimulus}}.',
      // Exactly what the pack pushes through contextFor. Every key the
      // click-era block interpolated (the statement, the active lens, the era
      // names) was either the answer or the material that gives it away.
      contextKeys: ['challengeType', 'stimulus'],
      // 18d: every rung routes through the SCRIPTED correction. A re-spoken ask
      // opens with neither "Yes" nor "My turn:", so the reducer records no
      // verdict and the child waits on a lesson that cannot advance.
      scaffoldingLevels: {
        level1: 'Speak this item\'s scripted correction line, exactly as the application gave it inside the [ERA_ITEM] message. It already re-models the rule for this historian move and hands the question back, and it opens with "My turn:" where the activity can hear it.',
        level2: 'Speak the SAME scripted correction line again, a little slower. Do not swap it for a re-spoken question or any other wording however patient: a reply that opens with neither "Yes" nor "My turn:" reaches the activity as no verdict at all.',
        level3: 'Still the same scripted correction line. If the child is stuck after it, say nothing further - the activity moves the lesson on by itself and carries the next question to you.',
      },
      // Observable behaviours only, with PERFORMABLE responses that produce a
      // VERDICT (defect 7: a sentiment without the verdict line stalls a
      // correct child). Every pattern here is a struggle this primitive had
      // before the port - the misconceptions did not change because the answer
      // became spoken.
      commonStruggles: [
        { pattern: 'Never picks the both-times answer - treats everything from the era as extinct', response: 'Run the item\'s scripted correction line, which re-models that some things happen in both times, then wait in silence for their next try.' },
        { pattern: 'Judges by whether the detail SOUNDS old-fashioned instead of by what the cards said', response: 'Run the item\'s scripted correction line for this round, then wait in silence while they look at the cards again.' },
        { pattern: 'On a compare round says "today" or "now", which is not one of the three choices', response: 'Run the item\'s scripted correction line - it re-models that both choices are old times - then wait in silence.' },
        { pattern: 'On a causation round restates WHAT changed instead of naming WHY', response: 'Run the item\'s scripted correction line, which re-models the three kinds of cause, then wait in silence.' },
        { pattern: 'Names something out of the sentence instead of naming a lens', response: 'Run the item\'s scripted correction line - the thing in the sentence is the question, not the answer - then wait in silence.' },
        { pattern: 'Goes quiet and does not speak for a long time', response: 'Wait longer in silence first, then say the question one more time exactly as written and wait again.' },
      ],
      aiDirectives: [
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'After an affirmation or a correction, the turn is OVER - never run on into another question, '
            + 'another statement, another era, or a next round of your own: the application sends every next '
            + 'question itself. A continued turn asks about a sentence the screen is not showing.',
        },
        {
          title: 'NEVER NAME THE BOX',
          instruction:
            'The three choices the question offers ARE the answer. Never say which one fits, never rule one '
            + 'out, and never say "it is not that one". The scripted correction re-models the rule and hands '
            + 'the question back - that is the whole of your help. Once the activity affirms, the screen shows '
            + 'the teaching note, and you may build on it if a later message asks you to.',
        },
        {
          title: 'THE ERA CARDS ARE THE EVIDENCE, NOT YOUR SCRIPT',
          instruction:
            'The lens cards on screen are the source the learner is meant to read and reason from. Reading one '
            + 'aloud unprompted hands over a locate round outright and does half of every other round. Speak a '
            + 'lens ONLY when an [ERA_SOURCE] message asks you to, and then read it word for word, add nothing, '
            + 'and never say which choice it points to.',
        },
      ],
    },
    supportsEvaluation: true,
  },
];
