/**
 * History Catalog - Component definitions for history / social studies primitives
 *
 * Contains C3 Framework social studies components for era studies,
 * continuity-vs-change reasoning, and historical thinking from K-6.
 */

import { ComponentDefinition } from '../../../types';

export const HISTORY_CATALOG: ComponentDefinition[] = [
  {
    id: 'cause-effect-chain',
    // -- PORT 25 -- the judged loop, second history / social-studies port -----
    // TWO MODES SPEAK, ONE IS HANDS. identify_cause is one spoken yes/no PER
    // CARD (the click era's five-card set-pick expanded into the per-card
    // verdict a child can actually say); root_vs_proximate is a spoken pick of
    // one card; build_chain is the cards placed in order with the HANDS -- the
    // arrangement IS the answer, committed on stillness and matched in code.
    // The click era's pick chips, per-rung Check buttons, Next button, hint
    // disclosure, two-strikes reveal ladder and every improvised tutor turn
    // are gone.
    // -- L1 -- the ladder is the PRD's own three phases. All three run off ONE
    // emission (an ordered chain plus two named non-causes); THE TYPE IS
    // CODE-ASSIGNED by eligibility, never enum-constrained -- identify_cause
    // needs the non-cause cards, root_vs_proximate needs cards separable by ear.
    // Cue lines and per-item judging contracts live in
    // `causeEffectChainScript.ts` (hand-authored, DISTAR); this block is the
    // session-level frame. SENTINEL DISCIPLINE re-checked on every line: no
    // sentence begins with "Yes" or with "My turn".
    description: 'Live-judged Direct Instruction on historical cause and effect, spoken and built. Students see an outcome and a bank of shuffled event cards and work out what had to happen before what: the tutor reads one event at a time and the child SAYS whether it helped cause the ending (rather than being a result of it, or just true at the time); the child BUILDS the chain with their hands by placing the causes in the order each one made the next possible; and the child SAYS which cause was the deep root versus the one that happened right before the end. Requires a microphone. Color-coded by category (political, economic, social, technological) so students SEE that big changes have causes from different corners of life. Ideal for "why did this happen" history, community-change and social-studies causation objectives, grades 1-6.',
    constraints: 'Explains ONE historical setting per session across 3-5 separate chains (causation depth, not chronology - use timeline-explorer for dating events, era-explorer for what one era was like). Requires a working microphone and the live tutor: two of the three moves are spoken exchanges and the third is judged by the tutor. Chain length is set by grade (3 cards K-4, 4 cards at 5+), never by the manifest. The manifest must NOT supply events, causes or an order: the generator writes the chains, and CODE derives the answer key from the order Gemini emits and then shuffles the bank away from it.',
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'identify_cause',
        label: 'Which Ones Are Causes? (Locate)',
        beta: 2.0,
        // Since the port this is ONE yes/no PER CARD rather than a five-card
        // set-pick, so the guessing floor per item is 1/2 and the run is
        // balanced (as many causes as non-causes). The beta stays: it is still
        // the entry rung and the reasoning per card is unchanged; the
        // discrimination drops because a single yes/no is a noisier read than
        // a set.
        discrimination: 1.2,
        scaffoldingMode: 2,
        challengeTypes: ['identify_cause'],
        description:
          "DI judged, spoken: the tutor states the ending, reads ONE event, and the child SAYS yes if it helped cause the ending or no if it did not - run over the real causes and the CONSEQUENCE and inert BACKGROUND cards the generator wrote. The PRD's Identify phase, and the confusion the whole primitive exists to fix: 'connected to the outcome' is not 'came before the outcome and made it possible'. The judging contract names affirming a consequence because it is about the same things as the signature miss.",
      },
      {
        evalMode: 'build_chain',
        label: 'Build the Chain (Connect)',
        beta: 3.5,
        // 3! = 6 arrangements at K-4, 4! = 24 at grade 5+, and two corrections
        // are allowed - hence a floor above zero but well under a 4-option choice.
        discrimination: 1.5,
        scaffoldingMode: 3,
        challengeTypes: ['build_chain'],
        description:
          "DI judged, HANDS: the tutor states the ending, and the child places every cause card into the chain in the order each one made the next possible - the arrangement IS the answer, so this is honest page work rather than a spoken item. The chain commits when every slot is filled and the board sits still; the match is computed in code and graded all-or-nothing, and a correction clears the whole board, because leaving the right cards in place would hand back which ones were already right. The PRD's Connect phase and the primitive's anchor.",
      },
      {
        evalMode: 'root_vs_proximate',
        label: 'Root or Right Before? (Analyze)',
        beta: 6.0,
        // One card out of 3-4, so the guessing floor is the highest on the
        // ladder - the beta carries the difficulty, c carries the luck.
        discrimination: 1.5,
        scaffoldingMode: 5,
        challengeTypes: ['root_vs_proximate'],
        description:
          "DI judged, spoken: the tutor states the ending and the child SAYS which one card is the ROOT cause (the one without which none of the others could have happened) or, on other rounds, the PROXIMATE cause (the one right before the outcome) - by the card's own words or by its place on the screen. Asking both ends defeats 'always name the earliest-sounding card', and the judging contract names the other end of the chain as the signature miss. The PRD's Analyze phase and its grade-6 goal.",
      },
    ],
    tutoring: {
      // Defect 12: `{{stimulus}}` goes LAST, with the never-read-aloud clause
      // IMMEDIATELY before it. Split that clause off into its own sentence
      // higher up and the block stops identifying itself as not-content at the
      // point it arrives.
      taskDescription: 'Live-judged Direct Instruction on historical cause and effect with a young learner. The round type right now is "{{challengeType}}" (the special type free_explore means no rounds could be built - the child is only reading the background, and you react briefly and warmly as a guide without quizzing them). On an identify_cause round the learner answers OUT LOUD, yes or no; on a root_vs_proximate round the learner names ONE event out loud; on a build_chain round the learner answers with their HANDS by placing the cards, and you say nothing until a [CEC_CHAIN] message tells you what they built. You judge what you hear against the exact contract in each bracketed [CEC_ITEM] message and speak the scripted lines from those messages and nothing else. Working the events out is the entire skill being practised, so never read the cards or the background aloud unless a message asks you to, never say which event is a cause, which comes first, next or last, or which one the question is after, and never rule one out. The question side of what is on screen, described for you alone and never read aloud: {{stimulus}}.',
      // Exactly what the pack pushes through contextFor. Every key the
      // click-era block interpolated (the question, the outcome, the slot
      // count) was either the answer's material or a channel to it (TU-6).
      contextKeys: ['challengeType', 'stimulus'],
      // 18d: every rung routes through the SCRIPTED correction. A re-spoken ask
      // opens with neither "Yes" nor "My turn:", so the reducer records no
      // verdict and the child waits on a lesson that cannot advance.
      scaffoldingLevels: {
        level1: 'Speak this item\'s scripted correction line, exactly as the application gave it inside the [CEC_ITEM] message (or, on a build_chain round, inside the [CEC_CHAIN] message). It already re-models the historian\'s test and hands the question back, and it opens with "My turn:" where the activity can hear it.',
        level2: 'Speak the SAME scripted correction line again, a little slower. Do not swap it for a re-spoken question or any other wording however patient: a reply that opens with neither "Yes" nor "My turn:" reaches the activity as no verdict at all.',
        level3: 'Still the same scripted correction line. If the child is stuck after it, say nothing further - the activity moves the lesson on by itself and carries the next question to you.',
      },
      // Observable behaviours only, with PERFORMABLE responses that produce a
      // VERDICT (defect 7: a sentiment without the verdict line stalls a
      // correct child). Every pattern here is a struggle this primitive had
      // before the port - the misconceptions did not change because the answer
      // became spoken.
      commonStruggles: [
        { pattern: 'Says yes to every event on a find-the-causes round, because each one is about the same story', response: 'Run the item\'s scripted correction line, which re-models that connected is not the same as caused, then wait in silence for their next try.' },
        { pattern: 'Says no to a real cause because it is not the last thing that happened, or not the biggest', response: 'Run the item\'s scripted correction line - a cause only has to come before and make the ending possible - then wait in silence.' },
        { pattern: 'Builds the chain by which story sounds best rather than by what had to exist first', response: 'Say the scripted correction line the [CEC_CHAIN] message gives you, which re-models the test and asks for the chain again, then stay silent while they rebuild it.' },
        { pattern: 'On a root-or-right-before round always names the earliest-sounding event whichever end was asked for', response: 'Run the item\'s scripted correction line - it says the two ends of the chain apart - then wait in silence.' },
        { pattern: 'Names the ending itself as an event, or as the root', response: 'Run the item\'s scripted correction line; the ending is the thing being explained and is fixed in place at the end. Then wait in silence.' },
        { pattern: 'Goes quiet, or says they cannot read the events', response: 'Wait longer in silence first, then say the question one more time exactly as written and wait again. The activity reads the cards to a learner who cannot read them when they tap to hear it.' },
      ],
      aiDirectives: [
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'After an affirmation or a correction, the turn is OVER - never run on into another question, '
            + 'another event, another ending, or a next round of your own: the application sends every next '
            + 'question itself. A continued turn asks about a card the screen is not showing.',
        },
        {
          title: 'NEVER NAME A CARD OR A SLOT',
          instruction:
            'The events on screen ARE the answer, in pieces. Never say which of them is a cause, never say '
            + 'which comes first, next or last, never say where a card belongs, never say how many are causes, '
            + 'and never say "it is not that one". Singling one out counts even when you do not quote it: '
            + '"think about the pioneers", "picture the farmers", "what about the one with the water wheels" '
            + 'each point at a card, and pointing at a card is placing it. The scripted correction re-models '
            + 'the historian\'s test and hands the question back - that is the whole of your help. Once the '
            + 'activity affirms, the screen shows the teaching note, and you may build on it if a later '
            + 'message asks you to.',
        },
        {
          title: 'THE HANDS TURN IS SILENT',
          instruction:
            'On a build_chain round the learner answers by placing cards, and nothing they say while they '
            + 'work is an answer. Say nothing at all until a [CEC_CHAIN] message tells you what they built '
            + 'and hands you the line to say. Never narrate the board, never count the empty slots aloud, '
            + 'and never fill the pause.',
        },
        {
          title: 'READING ALOUD, ON REQUEST ONLY',
          instruction:
            'When a [CEC_HEAR] or [CEC_CONTEXT] message asks you to, read the text you were given word for '
            + 'word, warmly and slowly, in exactly the order it was given to you, and then stop. The cards '
            + 'are deliberately shuffled: reading them in any other order, grouping them, or leaning on one '
            + 'over another hands over the answer just as surely as saying it. This is how an emerging '
            + 'reader reaches the events at all, so never treat it as extra help and never make them earn it.',
        },
      ],
    },
    supportsEvaluation: true,
  },
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
