/**
 * History Catalog - Component definitions for history / social studies primitives
 *
 * Contains C3 Framework social studies components for era studies,
 * continuity-vs-change reasoning, and historical thinking from K-6.
 */

import { ComponentDefinition } from '../../../types';
import { bossEntry } from '../../../components/live-activity/boss';
import { causeEffectChainCard } from '../../../primitives/visual-primitives/history/causeEffectChain.card';
import { eraExplorerCard } from '../../../primitives/visual-primitives/history/eraExplorer.card';
import { mapExplorerCard } from '../../../primitives/visual-primitives/history/mapExplorer.card';

export const HISTORY_CATALOG: ComponentDefinition[] = [
  {
    id: 'cause-effect-chain',
    // TWO MODES SPEAK, ONE IS HANDS. identify_cause is one spoken yes/no PER
    // CARD; root_vs_proximate is a spoken pick of one card; build_chain is the
    // cards placed in order with the HANDS -- the arrangement IS the answer,
    // committed on stillness and matched in code. All three run off ONE
    // emission (an ordered chain plus two named non-causes); THE TYPE IS
    // CODE-ASSIGNED by eligibility. The live wiring is the boss:
    // `causeEffectChain.card.ts` + `causeEffectChain.boss.ts`.
    description: 'Historical cause and effect with the live tutor, spoken and built. Students see an outcome and a bank of shuffled event cards and work out what had to happen before what: the tutor reads one event at a time and the child SAYS whether it helped cause the ending (rather than being a result of it, or just true at the time); the child BUILDS the chain with their hands by placing the causes in the order each one made the next possible; and the child SAYS which cause was the deep root versus the one that happened right before the end. Requires a microphone. Color-coded by category (political, economic, social, technological) so students SEE that big changes have causes from different corners of life. Ideal for "why did this happen" history, community-change and social-studies causation objectives, grades 1-6.',
    constraints: 'Explains ONE historical setting per session across 3-5 separate chains (causation depth, not chronology - use timeline-explorer for dating events, era-explorer for what one era was like). Requires a working microphone and the live tutor: two of the three moves are spoken exchanges and the third is a chain built by hand and checked by the activity. Chain length is set by grade (3 cards K-4, 4 cards at 5+), never by the manifest. The manifest must NOT supply events, causes or an order: the generator writes the chains, and CODE derives the answer key from the order Gemini emits and then shuffles the bank away from it.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken', 'build'], role: 'apply', minutes: 8 },
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
          "Spoken: the tutor states the ending, reads ONE event, and the child SAYS yes if it helped cause the ending or no if it did not - run over the real causes and the CONSEQUENCE and inert BACKGROUND cards the generator wrote. The PRD's Identify phase, and the confusion the whole primitive exists to fix: 'connected to the outcome' is not 'came before the outcome and made it possible'. The key names affirming a consequence because it is about the same things as the signature miss.",
      },
      {
        evalMode: 'build_chain',
        affordances: { answers: ['build'] },
        label: 'Build the Chain (Connect)',
        beta: 3.5,
        // 3! = 6 arrangements at K-4, 4! = 24 at grade 5+, and two corrections
        // are allowed - hence a floor above zero but well under a 4-option choice.
        discrimination: 1.5,
        scaffoldingMode: 3,
        challengeTypes: ['build_chain'],
        description:
          "Hands: the tutor states the ending, and the child places every cause card into the chain in the order each one made the next possible - the arrangement IS the answer, so this is honest page work rather than a spoken item. The chain commits when every slot is filled and the board sits still; the match is computed in code and graded all-or-nothing, and a correction clears the whole board, because leaving the right cards in place would hand back which ones were already right. The PRD's Connect phase and the primitive's anchor.",
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
          "Spoken: the tutor states the ending and the child SAYS which one card is the ROOT cause (the one without which none of the others could have happened) or, on other rounds, the PROXIMATE cause (the one right before the outcome) - by the card's own words or by its place on the screen. Asking both ends defeats 'always name the earliest-sounding card', and the key names the other end of the chain as the signature miss. The PRD's Analyze phase and its grade-6 goal.",
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(causeEffectChainCard),
  },
  {
    id: 'era-explorer',
    description: 'Live-judged Direct Instruction on one historical era, spoken end to end. The child explores the era through three lens cards (daily life, technology, school and work), and then the tutor reads one life detail at a time and the child SAYS which lens it came from, whether life looked like that only back then, only today, or in both times, which of two past eras it belongs to, and why life changed. Requires a microphone. Every answer is spoken aloud and judged from the audio - there is nothing to drag, tap or type. Perfect for long-ago-versus-today comparisons, community-history and American-history era studies. ESSENTIAL for K-6 social studies / history.',
    constraints: 'Covers ONE era per session (era depth, not chronological sequencing - use timeline-explorer for event sequences). Requires a working microphone and the live tutor: the whole activity is a spoken exchange. The manifest must NOT supply specific statements or lens text - the generator builds the era card and the challenges itself, and code owns every answer key.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 6 },
    // Every answer is one choice of three the ask names, said aloud; the era cards stay on screen as open-book
    // evidence. Wiring: `eraExplorer.card.ts` + `eraExplorer.boss.ts`.
    ...bossEntry(eraExplorerCard),
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
    supportsEvaluation: true,
  },
  {
    id: 'map-explorer',
    description: 'Real-world maps and the compass. A spinnable globe that unrolls into a flat map of the world, with the seven continents (North America, South America, Europe, Africa, Asia, Australia, Antarctica) and the five oceans; and picture maps of real neighborhoods (real places from Google Maps, such as a school, a park, a library and a museum, laid out on city blocks) or a pretend town, each with a compass rose. Students find places using north, south, east and west, say which way one place is from another by tapping the compass, plan a bus trip block by block with compass directions, and find continents and oceans on the globe. Harder maps are turned so north is not up, so students must read the compass rose. Perfect for lessons on maps and globes, cardinal directions, the compass rose, location and spatial thinking, continents and oceans, and neighborhoods and communities. ESSENTIAL for K-3 social studies geography.',
    constraints: 'Grades K-3. Each session is 4-5 asks on one map. Code lays out the map and writes every ask; the manifest must NOT name places, directions or answers. The intent may name a real city or neighborhood for the town map ("a map of downtown Chicago"); otherwise a well-known city is chosen.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'find_on_globe',
        label: 'Find It on the Globe',
        beta: -1.0,
        scaffoldingMode: 1,
        challengeTypes: ['find_on_globe'],
        affordances: { answers: ['tap'] },
        description: 'Spin a globe (or the flat world map) and tap a named continent or ocean; names appear only once found',
      },
      {
        evalMode: 'find_by_direction',
        label: 'Find by Direction',
        beta: -0.5,
        scaffoldingMode: 1,
        challengeTypes: ['find_by_direction'],
        affordances: { answers: ['tap'] },
        description: 'On a town map with a compass rose, find and tap the place that is north, south, east or west of a named place',
      },
      {
        evalMode: 'name_direction',
        label: 'Which Way?',
        beta: 0.0,
        scaffoldingMode: 2,
        challengeTypes: ['name_direction'],
        affordances: { answers: ['spoken', 'tap'] },
        description: 'On a town map, say (or tap the compass arm for) the way from one named place to another (north, south, east or west)',
      },
      {
        evalMode: 'world_direction',
        label: 'Directions on the World',
        beta: 0.5,
        scaffoldingMode: 2,
        challengeTypes: ['world_direction'],
        affordances: { answers: ['tap'] },
        description: 'On the world map, tap the continent or ocean just north, south, east or west of a named continent',
      },
      {
        evalMode: 'build_route',
        label: 'Plan the Trip',
        beta: 1.0,
        scaffoldingMode: 3,
        challengeTypes: ['build_route'],
        affordances: { answers: ['tap'] },
        description: 'Plan a bus trip between two places on a town map with compass steps (two blocks north, then one block east), then press Go',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(mapExplorerCard),
  },
];
