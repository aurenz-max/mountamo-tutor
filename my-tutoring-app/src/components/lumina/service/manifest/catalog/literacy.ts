/**
 * Literacy Catalog - Component definitions for language arts primitives
 *
 * Contains components for reading, writing, vocabulary, and language learning.
 * Organized by Common Core ELA strands:
 *   RF: Reading Foundational Skills
 *   RL: Reading Literature
 *   RI: Reading Informational Text
 *   W:  Writing
 *   SL: Speaking & Listening
 *   L:  Language
 *
 * See PRD_LANGUAGE_ARTS_SUITE.md for full specification.
 */

import { ComponentDefinition } from '../../../types';
import { SYLLABLE_CLAPPER_EVAL_MODES } from '../../../primitives/visual-primitives/literacy/syllableClapperModes';
import { letterSpotterCard } from '../../../primitives/visual-primitives/literacy/letterSpotter.card';
import { interactiveBookCard } from '../../../primitives/visual-primitives/literacy/interactiveBook.card';
import type { LetterWorkshopMiss } from '../../../primitives/visual-primitives/literacy/letterWorkshopWorkspace';
import { storyBridgeCard } from '../../../primitives/visual-primitives/literacy/storyBridge.card';
import { rhymeStudioCard } from '../../../primitives/visual-primitives/literacy/rhymeStudio.card';
import { bossEntry } from '../../../components/live-activity/boss';
import { phonemeExplorerCard } from '../../../primitives/visual-primitives/literacy/phonemeExplorer.card';
import { wordSorterCard } from '../../../primitives/visual-primitives/literacy/wordSorter.card';
import { decodableReaderCard } from '../../../primitives/visual-primitives/literacy/decodableReader.card';
import { letterSoundLinkCard } from '../../../primitives/visual-primitives/literacy/letterSoundLink.card';
import { phonicsBlenderCard } from '../../../primitives/visual-primitives/literacy/phonicsBlender.card';
import { soundSwapCard } from '../../../primitives/visual-primitives/literacy/soundSwap.card';
import { cvcSpellerCard } from '../../../primitives/visual-primitives/literacy/cvcSpeller.card';
import { wordWorkoutCard } from '../../../primitives/visual-primitives/literacy/wordWorkout.card';
import type { SyllableMiss } from '../../../primitives/visual-primitives/literacy/syllableClapperLevers';
import { wordFlipCard } from '../../../primitives/visual-primitives/literacy/wordFlip.card';
import { pictureVocabularyCard } from '../../../primitives/visual-primitives/literacy/pictureVocabulary.card';
import type { SpokenWordBuilderMiss } from '../../../primitives/visual-primitives/literacy/wordBuilderWorkspace';
import type { AffixBuildMiss } from '../../../primitives/visual-primitives/literacy/affixBuild';
import type { LetterBuildMiss } from '../../../primitives/visual-primitives/literacy/letterBuild';
import type { SpellingMiss } from '../../../primitives/visual-primitives/literacy/spellingPatternExplorerWorkspace';
import { spatialPathCard } from '../../../primitives/visual-primitives/math/spatialPath.card';
import { youAndMeCard } from '../../../primitives/visual-primitives/literacy/youAndMe.card';
import { oralSentenceStudioCard } from '../../../primitives/visual-primitives/literacy/oralSentenceStudio.card';
import { storyRibbonCard } from '../../../primitives/visual-primitives/literacy/storyRibbon.card';
import { genreExplorerCard } from '../../../primitives/visual-primitives/literacy/genreExplorer.card';
import { textStructureAnalyzerCard } from '../../../primitives/visual-primitives/literacy/textStructureAnalyzer.card';
import { sentenceAnalyzerCard } from '../../../primitives/visual-primitives/literacy/sentenceAnalyzer.card';
import type { StoryMapMiss } from '../../../primitives/visual-primitives/literacy/storyMapWorkspace';
import type { PoetryMiss } from '../../../primitives/visual-primitives/literacy/poetryLabWorkspace';
import type { ContextClueMiss } from '../../../primitives/visual-primitives/literacy/contextCluesWorkspace';
import type { EvidenceFinderMiss } from '../../../primitives/visual-primitives/literacy/evidenceFinderWorkspace';
import { missLists, sameMisses } from './missLists';

export const LITERACY_CATALOG: ComponentDefinition[] = [
  {
    id: 'spatial-path',
    description: 'Animated route-choice scenes for Kindergarten movement prepositions and directional language. Students choose a visible path that goes over, under, through, around, or across a landmark, then watch the traveler follow the exact selected geometry. The route shape is the scored evidence; the final destination is deliberately identical for every candidate route. Serves Language Arts requirement LA004-05-H for creating and following directions with directional prepositions.',
    constraints: 'Kindergarten. The generator owns all route geometry and answer keys. Every challenge must expose at least three visually distinct routes with one shared start and one shared finish. Do not score the endpoint. Keep obstacles and candidate routes visible, but do not label or highlight the correct relation until submission. The current L0 contract is choose_route; drawing and multi-step route creation are future evaluation modes. Do not route Grade 1-2 attempts until those grades have an honest directional-preposition curriculum home.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 5 },
    evalModes: [
      { evalMode: 'choose_route', label: 'Choose the route (pictorial)', beta: 2.5,
        scaffoldingMode: 2, challengeTypes: ['choose_route'],
        description: 'Choose, from at least three routes with one shared start and finish, the route whose path goes over, under, through, around, or across the landmark. The route identity is checked; the endpoint is not.' },
    ],
    supportsEvaluation: true,
    ...bossEntry(spatialPathCard),
  },
  {
    id: 'you-and-me',
    description:
      'Kindergarten Language Arts spoken sentence production with the personal subject pronouns I and you. '
      + 'Children describe familiar partner routines from the CURRENT NAMED SPEAKER\'S perspective. '
      + 'Personal-pronoun mode uses I/you; independent-action mode uses myself/yourself with the same actor. '
      + 'Across paired scenes the actor and action stay '
      + 'the same while the speaker switches, so the required subject pronoun changes. '
      + 'A live tutor prompts and judges each spoken sentence, with correction and retry.',
    constraints:
      'Requires a microphone and live tutor. Use short, familiar '
      + 'past-tense actions and two clearly named participants per scene. The child speaks AS the named '
      + 'speaker, addressing the other partner. I identifies the speaker as actor; you identifies the '
      + 'listening partner as actor. Preserve each scene\'s participants, actor, action and object across '
      + 'its two turns while swapping the speaker. The live tutor asks each turn. '
      + 'describe_action assesses I/you; describe_independent_action also requires correctly bound myself/yourself '
      + 'for an action completed without help. Six turns per pinned mode; blends/mixed contain four turns per mode. '
      + 'Do not assign possessives, third-person/object reflexives, independent writing, or transfer to real conversations.',
    evalModes: [
      { evalMode: 'describe_action', label: 'Describe the action (I / you)', beta: 2.5,
        scaffoldingMode: 2, discrimination: 1.6, challengeTypes: ['describe_action'],
        description: 'Use I or you as the subject when describing a partner routine from the named speaker perspective. No self form is required.' },
      { evalMode: 'describe_independent_action', label: 'Did it independently (myself / yourself)', beta: 3.5,
        scaffoldingMode: 2, discrimination: 1.6, challengeTypes: ['describe_independent_action'],
        description: 'Use myself or yourself in guided speaking to express doing an action without help, binding the self form to the same actor as I or you. Assess both referents together.' },
    ],
    supportsEvaluation: true,
    ...bossEntry(youAndMeCard),
    affordances: { representation: 'pictorial', answers: ['spoken'], role: 'apply', minutes: 5 },
  },
  {
    id: 'story-bridge',
    description:
      'Kindergarten Language Arts comparing texts across TWO illustrated read-aloud stories. Children match '
      + 'similar characters and settings, describe how characters are alike or different, place details in a '
      + 'guided picture Venn diagram, pair beginning/middle/ending events, and compare simple main ideas. '
      + 'Every task retains both story references and requires evidence from both texts.',
    constraints:
      'Requires a microphone and live tutor. One generated pair of two five-sentence stories stays in context '
      + 'for the whole session. Story text is audio-only before a verdict; relevant excerpts appear side by side '
      + 'after credit. Gesture modes use pictured choices and never judge microphone speech. Spoken modes '
      + 'accept age-appropriate defensible comparisons but reject a response that references only one story. '
      + 'The manifest must not supply story text, names, comparison answers, or event pairings.',
    evalModes: [
      {
        evalMode: 'match_character', label: 'Match characters', beta: 2.0, discrimination: 1.2,
        scaffoldingMode: 2, challengeTypes: ['match_character'],
        description: 'Tap the character in the other illustrated story who acted or felt alike.',
      },
      {
        evalMode: 'match_setting', label: 'Match settings', beta: 2.0, discrimination: 1.0,
        scaffoldingMode: 2, challengeTypes: ['match_setting'],
        description: 'Use both setting pictures to choose whether the stories happen in the same kind or different kinds of places.',
      },
      {
        evalMode: 'venn_place', label: 'Picture Venn diagram', beta: 2.5, discrimination: 1.8,
        scaffoldingMode: 2, challengeTypes: ['venn_place'],
        description: 'Place a character detail in the first character only, both characters, or the second character only.',
      },
      {
        evalMode: 'say_alike', label: 'Say how alike', beta: 3.0, discrimination: 1.6,
        scaffoldingMode: 3, challengeTypes: ['say_alike'],
        description: 'Say one defensible way two characters are alike using evidence from both stories.',
      },
      {
        evalMode: 'sequence_two', label: 'Compare event sequences', beta: 3.0, discrimination: 1.4,
        scaffoldingMode: 3, challengeTypes: ['sequence_two'],
        description: 'Match beginning, middle, and ending event pictures across the two stories.',
      },
      {
        evalMode: 'say_different', label: 'Say how different', beta: 3.5, discrimination: 1.6,
        scaffoldingMode: 3, challengeTypes: ['say_different'],
        description: 'Say one defensible difference between two characters using evidence from both stories.',
      },
      {
        evalMode: 'main_idea_compare', label: 'Compare big ideas', beta: 4.0, discrimination: 1.6,
        scaffoldingMode: 4, challengeTypes: ['main_idea_compare'],
        description: 'State a defensible similarity or difference between the two simple story main ideas.',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(storyBridgeCard),
    affordances: { representation: 'pictorial', answers: ['tap', 'spoken'], role: 'apply', minutes: 6 },
  },
  {
    id: 'story-ribbon',
    description:
      'Kindergarten Language Arts oral storytelling: arrange three pictorial event cues and tell one connected account '
      + 'of what happened from beginning to end. Children produce an original spoken retelling that covers all three '
      + 'events in chronological order; they are not choosing a sentence or repeating a visible script. ESSENTIAL for '
      + 'K speaking and listening, guided storytelling, temporal sequence, and connected oral language. Mode-specific '
      + 'tasks also assess present/past/future tense control or an explained story-to-experience connection.',
    constraints:
      'Requires a microphone and live tutor. Use exactly three familiar, concrete, safely picturable events per story. '
      + 'Picture labels are short time-neutral noun phrases; full model sentences remain hidden until a verdict. The '
      + 'manifest must NOT supply story events or model sentences — the Fork B orchestrator generates and validates them. '
      + 'The base mode scores event coverage, connection, and chronological order without requiring a tense or the literal '
      + 'words first/next/last. Tense modes score consistent present, future, or past time without demanding exact model verbs. '
      + 'Within each retell mode, difficulty changes narrative structure from a familiar routine to a direct problem-solution '
      + 'arc to a failed-attempt/adapted-solution arc; event count and time requirements stay fixed. '
      + 'Story-to-experience accepts personal, familiar, observed, heard-about, or imagined examples; never require private '
      + 'disclosure or grade the truth or emotional value of a memory. Its structural axis intentionally saturates because '
      + 'the current response contract permits a connection to any one event.',
    ...bossEntry(storyRibbonCard),
    evalModes: [
      {
        evalMode: 'tell_connected_account', label: 'Connected account', beta: 2.5, discrimination: 1.0,
        scaffoldingMode: 2, challengeTypes: ['tell_connected_account'],
        description: 'Arrange three pictured events and tell one connected chronological account; any consistent tense is accepted.',
      },
      {
        evalMode: 'tell_present_account', label: 'Present-time account', beta: 3.0, discrimination: 1.6,
        scaffoldingMode: 3, challengeTypes: ['tell_present_account'],
        description: 'Tell all three pictured events consistently in present time, as if they are happening today.',
      },
      {
        evalMode: 'tell_future_account', label: 'Future-time account', beta: 3.5, discrimination: 1.6,
        scaffoldingMode: 3, challengeTypes: ['tell_future_account'],
        description: 'Tell all three pictured events consistently in future time, as if they will happen tomorrow.',
      },
      {
        evalMode: 'tell_past_account', label: 'Past-time account', beta: 3.5, discrimination: 1.6,
        scaffoldingMode: 3, challengeTypes: ['tell_past_account'],
        description: 'Tell all three pictured events consistently in past time, as if they happened yesterday.',
      },
      {
        evalMode: 'story_to_experience', label: 'Story-to-world connection', beta: 4.0, discrimination: 1.0,
        scaffoldingMode: 4, challengeTypes: ['story_to_experience'],
        description: 'Identify one story event and explain its connection to a personal, familiar, observed, heard-about, or imagined experience.',
      },
    ],
    supportsEvaluation: true,
    affordances: { representation: 'pictorial', answers: ['spoken', 'manipulate'], role: 'apply', minutes: 5 },
  },
  {
    id: 'letter-workshop',
    description: 'Letter formation practice: trace guided strokes, copy a separate model onto blank writing lines, or write from an audible letter name and case. All 26 letters in both cases, with cumulative Groups 1-4 and 3-6 challenges.',
    constraints: 'Code owns letter templates and scope. difficulty easy/medium/hard withdraws support and selects low/middle/high available form complexity within each allowed case, widening to the neighbouring complexity band so every item in a session is a different letter; only a narrow scope saturates. Use letters, letterCase, letterGroup (1-4), and count (3-6). Trace is assisted path following. Copy/write use provisional geometric feedback retained locally, excluded from adaptive updates pending calibration. Independent write hides the target until submission and requires audio playback. Mixed write after a model is practice, not an unaided baseline.',
    evalModes: [
      { evalMode: 'trace', label: 'Assisted tracing', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['trace'], description: 'Follow visible letter paths with numbered starts and direction arrows.' },
      { evalMode: 'copy', label: 'Copy beside a model', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['copy'], description: 'Reproduce a separate visible letter model on blank writing lines. Provisional practice feedback.' },
      { evalMode: 'write', label: 'Write from listening', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['write'], description: 'Produce a letter from its spoken name and case without a visible model. Provisional practice feedback.' },
    ],
    tutoring: {
      taskDescription: 'Letter formation practice in {{challengeType}} mode, item {{challengeNumber}} of {{totalChallenges}}. Assistance: {{assistance}}. Current activity: {{interactionState}}. Results are provisional geometric feedback, not handwriting mastery.',
      contextKeys: ['challengeType', 'letter', 'letterCase', 'assistance', 'challengeNumber', 'totalChallenges', 'instruction', 'interactionState', 'cueState', 'modelVisible', 'feedback', 'feedbackFocus', 'attemptCount', 'hintLevel', 'assessmentScope', 'supportTier', 'showStarts', 'showArrows', 'showLineLabels', 'showChecklist'],
      scaffoldingLevels: {
        level1: 'Offer one brief nudge. In trace, point to a starting dot only when showStarts is true; otherwise invite comparison with the visible path. In copy, invite comparison with the separate model. In write without a model, say "You can hear the letter name again." Never name, describe, or infer the hidden letter.',
        level2: 'Offer one concrete action tied to the current support. Trace: follow one visible stroke, then lift. Copy: notice how the visible model meets the writing lines. Write without a model: replay the audio, then make your own marks; do not describe target strokes.',
        level3: 'When a model is visible, coach one visible part at a time, then let the child draw. Do not draw for the child. Without a visible model, limit help to replaying the cue and using the paper; do not supply a letter shape, letter name, or stroke recipe.',
      },
      commonStruggles: [
        { pattern: 'Submitted trace starts away from its numbered dot or follows the wrong stroke order', response: 'After submission, point to a numbered start only when showStarts is true; otherwise invite comparison with the visible path. Invite a retry from that dot.' },
        { pattern: 'Submitted trace travels against its direction arrow', response: 'After submission, point to an arrow only when showArrows is true; otherwise invite comparison with the visible path and invite one stroke in that direction.' },
        { pattern: 'Submitted work leaves part of a visible model incomplete', response: 'Invite comparison of the child\'s marks with one missing part of the visible model. Never infer missing parts before a write model is revealed.' },
        { pattern: 'Submitted work contains extra strokes', response: 'With a model visible, compare its separate strokes and the child\'s marks. Suggest lifting between strokes. Do not diagnose from pointer movement alone.' },
        { pattern: 'The spoken letter cue has not played or failed', response: 'Point to Hear the letter name and invite retry. Do not replace the cue with a written target or guess the letter.' },
        { pattern: 'Repeated clearing or retries', response: 'Offer one small action using only visible support. Let the child try again or move on without pressure.' },
      ],
      aiDirectives: [
        { title: 'SUPPORT TIER', instruction: 'Current support tier: {{supportTier}}. Never restore hidden starts, arrow directions, stroke recipes, or line labels through speech, including requested hints. Use showStarts/showArrows/showLineLabels to know which aids actually exist. Hard trace still has a guide; hard copy still has a model; write never receives a target shape. Do not infer the target from difficulty or structural complexity.' },
        { title: 'DRAWING AND AUDIO', instruction: 'Stay silent while interactionState is drawing or cueState is speaking. Context updates and pen lifts are not requests for speech. Never narrate live ink, count strokes aloud, or speak over the letter cue. Give at most one short sentence per requested moment, then wait.' },
        { title: 'MODE AND TARGET BOUNDARY', instruction: 'Trace has an intentional visible guide; copy has a separate model, never an overlaid guide. In write, letter and letterCase are withheld even after feedback. Never infer the target from lesson history, a previous item, or objective metadata. Only a [SAY_LETTER] message supplies the name: say its quoted line exactly, once, then stay silent. Never repeat that name, its sound, or its shape in any other turn. With no model visible, all hints stay procedural. Never claim unaided performance after a model was shown.' },
        { title: 'MOMENTS', instruction: 'For [ACTIVITY_START] and [NEXT_ITEM], use only the current supplied instruction and assistance; never reuse a previous target. For [READ_ALOUD], read the supplied instruction once without elaboration. For [SAY_LETTER], say only its quoted line. For [ANSWER_CORRECT] or [ANSWER_INCORRECT], use the supplied provisional feedback without inventing a diagnosis. For [ALL_COMPLETE], acknowledge practice without claiming mastery or prompting another task. Bracketed tags are private and must never be spoken.' },
      ],
    },
    // The scripted fallback (withWorkspaceController) still sends the tutoring block above.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1'],
      guidance: 'The learner writes the letter on the writing paper with a finger, pen or mouse and presses Check; the paper '
        + 'checks the writing itself, and talk about a half-written letter is teaching, not a verdict. On trace the dotted '
        + 'letter is on the paper; on copy a model is beside it. On write nothing on the screen shows or names the letter: '
        + 'the learner knows it only from you. Say its case and NAME as the task gives it, at the start and whenever asked, '
        + 'never its sound, a word that starts with it, or how its strokes go. After a write check a model appears beside '
        + 'the paper. You cannot draw, trace or clear.',
      // Levers: `letterWorkshopLevers.ts`; every miss in every mode has a help lever, so nothing is unanswered.
      levers: true,
      // The paper's own check (`letterWorkshopMiss`). Trace is geometry alone; copy and write also read the vision judge.
      misses: missLists<LetterWorkshopMiss>({
        trace: ['stroke_count', 'start_or_order', 'part_left_out', 'extra_ink', 'direction_or_shape'],
        copy: ['other_letter', 'reversed', 'wrong_case', 'stroke_count', 'start_or_order', 'part_left_out', 'extra_ink', 'direction_or_shape'],
        write: ['other_letter', 'reversed', 'wrong_case', 'stroke_count', 'start_or_order', 'part_left_out', 'extra_ink', 'direction_or_shape'],
      }),
    },
    supportsEvaluation: true,
    affordances: { representation: 'symbolic', answers: ['manipulate'], role: 'apply', minutes: 5 },
  },
  // ===== EXISTING PRIMITIVES =====
  {
    id: 'sentence-analyzer',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction GRAMMAR with a spoken tutor. The tutor names one word of a printed '
      + 'sentence, waits, judges what it hears, and a credited answer moves the lesson on. The child '
      + 'SAYS the grammar label out loud — "adjective", "subject", "predicate", "declarative" — with a '
      + 'printed word wall of the vocabulary in scope beside them for reference. Nothing is tapped, there '
      + 'are no multiple-choice options anywhere, and no label appears on screen before the answer is '
      + 'credited. Four progressive tasks from naming one word\'s part of speech to walking a whole sentence and '
      + 'parsing its structure. Requires a microphone. Ideal for grades 2-8 grammar and language arts.',
    constraints:
      'Requires the live tutor and a microphone. Grades 2-8. The sentence is PRINTED (and read aloud at '
      + 'grade 2), so the child must be able to follow written text at their grade. Sentences containing '
      + 'grammar vocabulary are excluded — the tutor reads the sentence aloud, and a sentence containing '
      + 'the word "noun" says an answer before it is asked. The answer is SPOKEN, so pick this for '
      + 'objectives about NAMING grammatical structure, not for editing or writing objectives — those need '
      + 'a written surface.',
    affordances: { representation: 'symbolic', answers: ['spoken'], role: 'apply', minutes: 5 },
    ...bossEntry(sentenceAnalyzerCard),
    evalModes: [
      // ⚠️ EVERY `description` BELOW IS MANIFEST STEERING AND NOTHING ELSE.
      // The β rationale lives in this comment deliberately: a description is read
      // by the model that PICKS this primitive and this mode, and a paragraph
      // about what the click era used to do is tokens spent describing a surface
      // that no longer exists.
      //
      // β MOVED ON THREE OF FOUR, and only where the STRUCTURE moved:
      //   identify_pos    1.5 → 2.0  four options per item at a 1-in-4 floor
      //                              became unaided production from the wall.
      //   identify_role   3.0 → 3.5  same change, same size.
      //   label_all       5.0 → 5.5  the chip bank listed exactly the sentence's
      //                              own labels and could be counted against the
      //                              words; the grade wall carries labels it does
      //                              not use. One judged ask per word also
      //                              replaces a single 80%-threshold score.
      //   parse_structure 6.5 → 6.5  UNCHANGED. There was no menu here to delete;
      //                              what changed is that its answer key is now
      //                              correct, which makes it fairer, not harder.
      {
        evalMode: 'identify_pos',
        label: 'Identify POS (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['identify_pos'],
        description:
          'The tutor names one word of the sentence and the student SAYS its part of speech, unaided, '
          + "with the grade's word wall printed beside them for reference.",
      },
      {
        evalMode: 'identify_role',
        label: 'Identify Role (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['identify_role'],
        description:
          'The tutor names one word and the student SAYS what job it does in the sentence. Starts at '
          + 'grade 3 — grade 2 has no role vocabulary in scope.',
      },
      {
        evalMode: 'label_all',
        label: 'Label All (Tier 4)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['label_all'],
        description:
          'The tutor walks the sentence word by word and the student SAYS each part of speech in turn '
          + '— one judged answer per word, across a whole sentence.',
      },
      {
        evalMode: 'parse_structure',
        label: 'Parse Structure (Tier 5)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['parse_structure'],
        description:
          'The tutor names words one at a time and the student SAYS whether each is in the subject or '
          + 'the predicate, then SAYS what kind of sentence it is.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'word-builder',
    misconceptionScope: 'primitive',
    description:
      'Live MORPHOLOGY practice with a spoken tutor. The tutor asks, waits and responds to what it '
      + 'hears, and a credited answer moves the lesson on. A board of word parts — prefixes, roots and '
      + 'suffixes, each printed with its meaning — stays on screen as a reference wall; the tutor says what '
      + 'a word MEANS and the child works out which parts make it and SAYS THE WHOLE WORD out loud. Nothing '
      + 'is assembled by hand, nothing is tapped and nothing on screen shows the word before it is '
      + 'credited. '
      + 'Four complexity tiers from single affixes to Greek/Latin and multi-morpheme academic vocabulary. '
      + 'Requires a microphone. Ideal for vocabulary development, etymology and morphological analysis — and '
      + 'for the skill those exist to serve: meeting an unfamiliar academic word in text and being able to '
      + 'say it and unpack it. One mode is the exception: in build_affix (open build, grades 1-8) the learner taps part '
      + 'cards into a row to MAKE a word for a stated meaning, and many words can pass.',
    constraints:
      'Requires the live tutor and a microphone. Best for grades 3-8 — the child READS the parts board, so '
      + 'this is not a pre-reader primitive. Requires words that break into morphemes that spell the word '
      + 'exactly when joined in order (un+help+ful, tele+scope); words needing a spelling change at the join '
      + '(happy+ly, run+ing) are excluded. The answer is SPOKEN, so pick this for objectives about building '
      + 'or unpacking word meaning, not for spelling objectives — those need a written surface.',
    affordances: { representation: 'symbolic', answers: ['spoken'], role: 'apply', minutes: 5 },
    teachingWorkspace: {
      // Grade 1-2 opens for build_affix (user ruling R11, 10-07: no heavy grade floors; the build's scope follows the lesson
      // grade). The spoken levels keep their own floors in the generator (contract R6).
      grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'A board of prefixes, roots and suffixes, each printed with its meaning, stays on screen. You tell the '
        + 'learner what a word means (the clue) and the learner says the whole word out loud, built from parts on the '
        + 'board. Building it aloud part by part counts when the whole '
        + 'word arrives at the end. Only the root, the parts never joined, the parts in the wrong order, or a word '
        + 'from only some of the parts is not yet it. Open each word with the clue and ask for the whole word. '
        + 'Never say the word, name which parts or meanings make it, or ask about one part; after '
        + 'an attempt, pull a lever, and never walk the meanings of the parts in order. Say the clue again '
        + 'asks you to repeat the clue only. You cannot mark or move a part. On build_affix the learner instead taps part '
        + 'cards into a row to MAKE a word for a meaning and presses "I\'m done!"; many words can fit. Never say a word that '
        + 'would fit or which parts to use; when they stop, invite them to read the word in their row and think what it means.',
      levers: true,
      // Every item is one spoken word: its known wrong answers (`wordBuilderSpokenMisses`, handoff 20 Part B; the lever
      // table 2026-10-03 adds four). A 2-part simple_affix word cannot show part_missing.
      misses: missLists<SpokenWordBuilderMiss | AffixBuildMiss>({
        simple_affix: ['root_only', 'other_part_only', 'parts_not_joined', 'parts_out_of_order', 'swapped_part', 'meaning_word'],
        ...Object.fromEntries(['compound_affix', 'greek_latin', 'multi_morpheme'].map(m => [m, ['root_only', 'other_part_only',
          'part_missing', 'parts_not_joined', 'parts_out_of_order', 'swapped_part', 'meaning_word'] as SpokenWordBuilderMiss[]])),
        // The open build: the row's shape (code), then the shared literacy judge (`affixBuild.ts`).
        build_affix: ['root_only', 'affix_only', 'parts_out_of_order', 'same_word', 'not_a_word', 'wrong_meaning'],
      }),
      // build_affix `same_word` has no lever: the word already made stays on screen above the row.
      unanswered: { build_affix: ['same_word'] },
    },
    // ── SPOKEN MODALITY (2026-08-16, user ruling) — all voice, no tap. The port
    // was queued as a hybrid ("tap to build, then speak"); the user overturned
    // it: "kind of disagree on tap, this feels like a pure spoken with cards on
    // the board". A spoken word CARRIES its morphemes — /ʌn/-/hɛlp/-/fəl/ is
    // audible where c-a-t is not.
    // THE CARDS SURVIVED THE BUTTON. The morpheme wall with meanings is what
    // makes this construction rather than vocabulary recall, but it is PRINT:
    // a tappable card is a menu and a menu is a guess floor.
    // THE OPEN-SET HALF WAS REFRAMED, NOT BENCHED. "tele means far, so what does
    // telescope mean?" is open-set, so the ask runs the other way: the clue
    // states the meaning and the child produces the word (one target).
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'build_affix',
        affordances: { answers: ['build'] },
        label: 'Make a Word (open build)',
        beta: 2.1,
        scaffoldingMode: 2,
        challengeTypes: ['build_affix'],
        description:
          'Open build: tap prefix, root and suffix cards (each printed with its meaning) into a row to MAKE a word for a '
          + 'stated meaning, then press done; some items ask for a second, different word. Many words pass (replay, redo, '
          + 'rewrite for "do it again"); the row\'s shape is checked in code and the word by the shared literacy judge. '
          + 'Grades 1-8, scoped to the lesson grade. β = simple_affix + 0.1, the offset build_n has over give_me_n.',
      },
      {
        evalMode: 'simple_affix',
        label: 'Simple Affixes (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['simple_affix'],
        description:
          'Single prefix or suffix with a common root (un+happy, play+ful), said aloud from its meaning. '
          + 'β 1.5 → 2.0 on the 2026-08-16 DI port: unlimited drag-and-Check became one spoken attempt plus '
          + 'two judged corrections, which is a STRUCTURAL change to what a correct response costs.',
      },
      {
        evalMode: 'compound_affix',
        label: 'Compound Affixes (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['compound_affix'],
        description:
          'Prefix + root + suffix said aloud from its meaning (un+help+ful, re+play+able). β 3.0 → 3.5, '
          + 'same structural reason as Tier 1.',
      },
      {
        evalMode: 'greek_latin',
        label: 'Greek/Latin Roots (Tier 4)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['greek_latin'],
        description:
          'Academic words from Greek/Latin morphemes said aloud (bio+graph+y, tele+scope). β 5.0 → 5.5, '
          + 'same structural reason — and this is the tier the spoken answer exists for, since pronouncing '
          + 'an unfamiliar academic word IS the outcome the mode teaches.',
      },
      {
        evalMode: 'multi_morpheme',
        label: 'Multi-Morpheme (Tier 6)',
        beta: 7.5,
        scaffoldingMode: 6,
        challengeTypes: ['multi_morpheme'],
        description:
          'Complex multi-morpheme words with abstract bound roots said aloud (pre+dict+able, anti+bio+tic). '
          + 'β 7.0 → 7.5, same structural reason.',
      },
    ],
    // tutoring removed 2026-10-04 (WB-5): its taskDescription, scaffolds, struggles and aiDirectives ordered
    // bracketed [WB_ITEM] turns and "the scripted correction line" of the retired runner. Word-builder is
    // workspace-only; bound sessions send `tutoring: null`, and an unbound mount shows the needs-the-tutor card.
    // The no-answer rule and the clue-only repeat live in teachingWorkspace.guidance.
    supportsEvaluation: true,
  },

  // ===== READING: FOUNDATIONAL SKILLS (RF) =====
    {
      id: 'phonics-blender',
      misconceptionScope: 'primitive',
    description: 'Decode and blend: the student reads the letters of a word, may tap a letter to hear its sound (voiced by '
      + 'the live tutor), and says the whole word out loud; the tutor judges it. Supports CVC, CVCE, blends, digraphs, '
      + 'diphthongs, and r-controlled vowels, plus an open build that joins two tiles into a word with a blend. An emoji '
      + 'word-picture appears once the word is said. ESSENTIAL for K-2 phonics instruction.',
    constraints: 'Grades K-2 only. Requires phonics/decoding content.',
    // reader: 'none' — READY @ PRE (cvc, the K census route), live-confirmed 3/3
    // (qa/reader-fit/phonics-blender-PRE-2026-07-15.md).
    affordances: { representation: 'symbolic', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 4 },
    evalModes: [
      {
        evalMode: 'cvc',
        label: 'CVC (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['cvc'],
        description: 'Simple CVC blending (cat, dog).',
      },
      {
        evalMode: 'cvce_blend',
        label: 'CVCE & Blends (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['cvce', 'blend'],
        description: 'Silent-e and consonant blends.',
      },
      {
        evalMode: 'digraph',
        label: 'Digraphs (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['digraph'],
        description: 'Two letters, one sound (sh, ch, th).',
      },
      {
        evalMode: 'advanced',
        label: 'Advanced (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['r-controlled', 'diphthong'],
        description: 'R-controlled vowels and diphthongs.',
      },
      {
        evalMode: 'build_blend',
        affordances: { answers: ['build'] },
        label: 'Build a Blend Word (open build)',
        beta: 2.6,
        scaffoldingMode: 2,
        challengeTypes: ['build_blend'],
        description: 'Open build: join a start tile and an ending tile into any real word that STARTS with a blend (bl + ock, '
          + 'st + op) or ENDS with one (l + amp, s + and), then press done; some items ask for a second word. Many words '
          + 'pass. Code checks the blend and the tile order; the shared word judge checks it is a real word. Beta = '
          + 'cvce_blend + 0.1.',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(phonicsBlenderCard),
    // tutoring removed 2026-10-20 (boss migration): its [DI_BLEND_*] scripted-cue directives and contextKeys fed the
    // retired runner; bound sessions send `tutoring: null`. The card (`phonicsBlender.card.ts`) is the wiring.
  },
  {
    id: 'decodable-reader',
    misconceptionScope: 'primitive',
    description:
      'Live DECODABLE READING with a spoken tutor. A short controlled-vocabulary story '
      + 'is on screen ONE SENTENCE AT A TIME and the child reads each one out loud into an open microphone; the '
      + 'tutor responds to every read from the audio WORD BY WORD — a skipped, added or swapped word is corrected, not '
      + 'waved through — and a credited read moves the story on. Then it asks comprehension questions about '
      + 'the story, and EVERY answer is spoken: where the answer is a WORD from the text the child says that word, '
      + 'and where the answer is a whole idea the tutor reads three or four picture choices aloud and the child '
      + 'says which one it is. Nothing is tapped. Two reading modes: READ-ALONG (the tutor reads '
      + 'the whole story aloud to a pre-reader who then answers questions about it) for Kindergarten, and DECODE '
      + '(the child reads it themselves) for Grade 1-2. Every word is phonics-tagged, so the passage is controlled '
      + 'text, not a generic passage. Nothing advances on a click. Requires a microphone. ESSENTIAL for K-2 reading.',
    constraints:
      'Grades K-5. Requires the live tutor and a microphone. K-2 passages use controlled phonics patterns matching '
      + 'the student decoding level; grades 3-5 read grade-level connected text. config.difficulty (easy/medium/hard) '
      + 'sets the sentence length, story length and decoding load for the grade (decodableReaderLadder.ts): K stays '
      + '3-8 words a sentence, grade 1 hard reaches 10, grade 5 hard 18. BAND FLOOR: at Kindergarten use the read_along mode (pre-readers cannot yet decode connected '
      + 'text); the decoding comprehension modes (literal/sequence/inference/main_idea) are for Grade 1+. Use '
      + 'di-sentence-reading instead for ISOLATED decodable or sight-word sentences with no story around them, and '
      + 'read-aloud-studio for grade 1-6 fluency where comprehension is not being measured.',
    // reader: 'emerging' base (decode modes — READY @ EMERGING, Gr1) with
    // read_along overridden to 'none' (READY @ PRE, live 3/3) —
    // qa/reader-fit/decodable-reader-PRE-2026-07-14.md.
    affordances: { representation: 'symbolic', reader: 'emerging', answers: ['spoken'], role: 'apply', minutes: 8 },
    ...bossEntry(decodableReaderCard),
    evalModes: [
      // βs raised with the STRUCTURE (skill rule: only then). Every decode mode
      // now contains unaided oral reading of the whole story judged word by
      // word — it inherits di-sentence-reading's `decodable_sentence` (2.5) as
      // a FLOOR and adds a comprehension question on top, so the ladder starts
      // above it and keeps its old spacing. read_along gains a spoken answer
      // where it used to take a tap, which is a smaller structural step.
      { evalMode: 'read_along', affordances: { reader: 'none' }, label: 'Read-Along (Tier 0)', beta: 1.0, scaffoldingMode: 1, challengeTypes: ['literal'], description: 'Kindergarten shared reading: the tutor reads the whole story aloud while the child follows the print, then the child SAYS the answer to each question out loud. For pre-readers who cannot yet decode connected text.' },
      { evalMode: 'literal', label: 'Literal Recall (Tier 1)', beta: 3.0, scaffoldingMode: 1, challengeTypes: ['literal'], description: 'Read the story aloud, then say the one word that answers a fact stated directly in it.' },
      { evalMode: 'sequence', label: 'Sequence/Cause-Effect (Tier 2)', beta: 4.0, scaffoldingMode: 2, challengeTypes: ['sequence'], description: 'Read the story aloud, then SAY which of two text-explicit parts came first, or the stated cause of an effect, from the choices the tutor reads out.' },
      { evalMode: 'inference', label: 'Inference (Tier 3)', beta: 5.0, scaffoldingMode: 3, challengeTypes: ['inference'], description: 'Read the story aloud, then SAY what the text implies but does not state, from the choices the tutor reads out.' },
      { evalMode: 'main_idea', label: 'Main Idea (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['main_idea'], description: 'Read the story aloud, then SAY what the whole story is mostly about, from the choices the tutor reads out.' },
    ],
    supportsEvaluation: true,
  },

  {
    id: 'interactive-book',
    description:
      'Live picture-book work with a spoken tutor, who teaches in its own words. Two directions, and the answer is '
      + 'made of something different in each: Read Together (the tutor reads a real book sentence up to one glowing '
      + 'word, stops, and the child READS that word out loud, judged by the tutor: supported oral reading), and Book '
      + 'Detective (the tutor names a printed book part (title, author, heading, caption, page number) and the child '
      + 'TAPS it on the page, which checks the tap: print awareness and text features). The tap direction taps because '
      + 'its answer is WHICH printed element on the page it is, a position, like pointing at a real book, while reading '
      + 'the words of the part aloud would be a different skill. Nothing on screen shows an answer before it is credited. '
      + 'Read Together requires a microphone. ESSENTIAL for K-2 print awareness and early oral reading.',
    constraints:
      'Requires the live tutor; Read Together also needs a microphone. Uses one generated nonfiction book. The manifest '
      + 'must not provide book text, feature answers, focus-word answers, page data, image prompts, or challenges; the '
      + 'generator derives all scored contracts from visible book content. Every focus word needs at least two '
      + 'natural words before it in its sentence so the tutor has a real lead-in to read and stop after. Not a '
      + 'story or compare activity yet.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['spoken', 'tap'], role: 'apply', minutes: 8 },
    ...bossEntry(interactiveBookCard),
    evalModes: [
      {
        evalMode: 'find-feature',
        affordances: { answers: ['tap'] },
        label: 'Find Book Features',
        beta: 1.5,
        discrimination: 1.8,
        scaffoldingMode: 1,
        challengeTypes: ['find-feature'],
        description: 'Locate title, author, heading, caption, and page number by tapping the real printed element on a picture-rich book page. Task identity unchanged by the DI port; β holds.',
      },
      {
        evalMode: 'read-focus-word',
        affordances: { answers: ['spoken'] },
        label: 'Read the Glowing Word',
        beta: 2.5,
        discrimination: 1.6,
        scaffoldingMode: 2,
        challengeTypes: ['read-focus-word'],
        description: 'The tutor reads a book sentence up to one glowing word and stops; the child reads that word aloud and the tutor judges it in-band. Already priced as spoken production; the old partial-credit tap escape is deleted, not restructured; β holds.',
      },
    ],
    supportsEvaluation: true,
    // tutoring removed 2026-10-20 (boss migration): its [IB_*] scripted-cue directives and contextKeys fed the retired
    // runner; bound sessions send `tutoring: null`. The card (`interactiveBook.card.ts`) is the wiring.
  },

  {
    id: 'rhyme-studio',
    misconceptionScope: 'primitive',
    description:
      'Live rhyme practice with a spoken tutor. The tutor asks, waits and responds to the child’s '
      + 'spoken answer, and a credited answer moves the lesson on. ALL FOUR MODES ARE ANSWERED '
      + 'ALOUD — the child says yes or no to whether two spoken words rhyme (Do They Rhyme?), says the word that '
      + 'rhymes from a small set (Find the Rhyme), or THINKS OF A RHYME with nothing on screen but the target '
      + 'word (Think of a Rhyme), or fills three retained slots with three different valid rhymes (Build a Rhyme Family). '
      + 'Only identification shows choices, and they are the closed set the child '
      + 'speaks from; in those four modes nothing is tapped to answer. Rhyme Pairs (the open build) is the one tapped '
      + 'mode: the child puts two pictures whose names rhyme in a tray. Tap-to-hear repeats the question. The spoken '
      + 'modes require a microphone. ESSENTIAL for K-2 phonological awareness — and Think of a Rhyme is rhyme GENERATION, the '
      + 'Bloom tier above recognising one.',
    constraints:
      'Use 8-10 challenges for recognition/identification mixes; collection uses 1-2 base-word challenges because '
      + 'each expands to three judged responses. Recognition needs doesRhyme boolean. Identification needs 2-3 options with one '
      + 'onset-sharing distractor (cat → cap). PRODUCTION IS OPEN — it needs ONLY a targetWord and its '
      + 'rhymeFamily, and the target must have many common rhymes a young child knows (cat, sun, bed — never '
      + 'orange or month). COLLECTION uses the same open rule but retains three learner-produced words, rejects '
      + 'duplicates, and supplies no example answers. Generate 1-2 collection challenges because each one elicits '
      + 'three judged responses. Route FREE rhyme generation ("tell me a word that rhymes with cat") HERE. '
      + 'Every answer in the four spoken modes is spoken; they require the live tutor and a microphone. '
      + 'PRE-READER (K): all four modes route at K. Each word in recognition and identification (target, '
      + 'comparison, every option) carries a single depicting emoji so a non-reader can tell the words apart; '
      + 'production needs no answer surface, while collection shows only the child’s accepted words in three slots.',
    // reader: 'none' — READY @ PRE for recognition + identification, live 3/3
    // (qa/reader-fit/rhyme-studio-PRE-2026-07-15.md); production is purely oral
    // with nothing on screen but the target, so it carries no higher demand.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 4 },
    // The live-tutor wiring is the boss (`rhymeStudio.card.ts`, `rhymeStudio.boss.ts`): the card's modes, misses and
    // words, and the microphone. Bound sessions send no catalog tutoring block; the boss describes the activity.
    ...bossEntry(rhymeStudioCard),
    evalModes: [
      {
        evalMode: 'recognition',
        label: 'Do They Rhyme? (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['recognition'],
        description:
          'Rhyme judgment — hear two words spoken, say yes or no. The tutor judges the meaning of what it hears, '
          + 'so "yeah", "nope" and "they do" all count; the verdict is the advance.',
      },
      {
        evalMode: 'identification',
        label: 'Find the Rhyme (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['identification'],
        description:
          'Rhyme identification — hear a target word and 2-3 choices, say the one that rhymes out loud. The tutor '
          + 'judges the audio in-band. An onset-sharing choice (cat → cap) is the distractor that diagnoses '
          + 'rhyme-versus-alliteration confusion.',
      },
      {
        evalMode: 'pair_build',
        affordances: { answers: ['build'] },
        label: 'Rhyme Pairs (open build)',
        beta: 2.6,
        scaffoldingMode: 2,
        challengeTypes: ['pair_build'],
        description: 'Open build, pre-reader: eight pictures, no print; tap two that rhyme into a pair tray and press done '
          + '(cat and hat, moon and spoon); some boards ask for a second pair. Several pairs pass. Every board holds a '
          + 'same-first-sound decoy (cat and car), named same_start. Checked in code from the pictures\' known rimes. '
          + 'Beta = identification + 0.1.',
      },
      {
        evalMode: 'production',
        // The target word card always carries its emoji, and at PRE the picture
        // too (RhymeStudio.tsx: showWordImage = isPreReader || …) — the child
        // hears the word and SEES the thing, then produces. Tagged symbolic alone,
        // Q3 read this picture-first K block as a symbols-first opener
        // (…p5m6 obj3, 2026-09-06).
        affordances: { representation: ['pictorial', 'symbolic'] },
        label: 'Think of a Rhyme (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['production'],
        description:
          'OPEN rhyme production — hear one word, think of any real word that rhymes with it, and say it. There '
          + 'is no word bank, no menu and nothing on screen but the target: the tutor judges the answer against '
          + 'a RULE, not a list. This is generation, not recognition — the child supplies the word. Purely oral, '
          + 'so it works at K (K.RF.2.a) as well as any later grade.',
      },
      {
        evalMode: 'collection',
        affordances: { representation: ['pictorial', 'symbolic'] },
        label: 'Build a Rhyme Family (Tier 5)',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['collection'],
        description:
          'OPEN three-word rhyme-family construction — hear one base word, then supply three distinct real rhymes '
          + 'one at a time. Each accepted response remains visible in its slot and is excluded from later turns. '
          + 'The tutor validates sound and uniqueness by rule, so an unlisted real rhyme is accepted while a '
          + 'duplicate, target echo, non-rhyme, or invented word is explained and retried without revealing examples.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'syllable-clapper',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction syllable work with a spoken tutor, across the three acts of syllable '
      + 'awareness: BLENDING (the tutor says the parts one at a time, the child says the whole word), '
      + 'COUNTING (the tutor says the word as one joined stream, the child claps the parts with their own '
      + 'hands and says how many), and DELETION (the tutor says a two-part compound and takes one part '
      + 'away, the child says what is left). Every answer is spoken and judged from the audio, and a '
      + 'credited answer moves the lesson on. Nothing is printed before the answer is affirmed, '
      + 'so a reader cannot solve by sight instead of by ear; the only thing on screen before then is a '
      + 'tap-to-hear button. There are no clap buttons, no counters, no answer buttons and nothing to '
      + 'click to advance. Requires a microphone. ESSENTIAL for kindergarten phonological awareness.',
    constraints:
      'Words must be ONE word, concrete, picturable, and recognisable BY EAR — the child never sees them. '
      + 'Every word must have ONE syllable count all English speakers agree on: words whose count varies by '
      + 'speaker ("squirrel", "fire", "flower", "every", "chocolate", "comfortable", "interesting") are '
      + 'rejected in code, because a judged tutor would refuse a child who was right. 1-4 syllables '
      + '(5 tolerated). Spoken answers are a COUNT, a whole WORD, or a leftover WORD — never letters or '
      + 'individual sounds. DELETION items must be two-part compounds whose BOTH halves are ordinary words '
      + '(cupcake, bedtime, starfish): a deletion that leaves a nonword ("banana without ba") is dropped in '
      + 'code, because a child cannot confidently say it and a judge cannot honestly score it. Requires the '
      + 'live tutor and a microphone.',
    // reader: 'none' — a shipped judged-loop port with a live gate
    // (qa/tutor-reports/syllable-clapper-live-di-cap-2026-08-16.md,
    // -signature-2026-08-16.md); the word is never printed at all, before or
    // after the answer, so there is nothing to read at any point.
    affordances: { reader: 'none', answers: ['spoken'], role: 'apply', minutes: 4 },
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1'],
      guidance: 'Nothing is printed: you say each word and the learner answers out loud. On blend syllables you say the '
        + 'parts one at a time and the learner says the whole word; on count parts you say the word joined and the '
        + 'learner says how many parts (counting aloud is fine when the count lands on the number); on delete compound '
        + 'you say a two-part word, name the part to take away, and the learner says the word left. Say the stimulus '
        + 'exactly as the voicing fact tells you: splitting a count or delete word into parts before the learner has '
        + 'tried hands over the answer. The learner claps with their own hands; there is nothing to tap. The '
        + 'hear-again button asks you to repeat the question only. You cannot show the word or its parts. On build parts '
        + '(the open build) the learner taps word-part cards, one clap each, into a word with the number of parts the task '
        + 'names and presses "I am done"; many words pass, and a speaker on each card, the task and their word asks you to '
        + 'say just that. Never say a word that would fit, which cards to use, or how many parts their word has.',
      levers: true,
      // Spoken misses (`syllableClapperLevers.ts`), emitted by `syllableSpokenMisses` on blend and count (delete names none yet).
      // `unanswered` stays the levers' own list (`syllableClapperLevers.test.ts` pins it).
      misses: { ...missLists<SyllableMiss>({ blend_syllables: ['parts_back'], count_parts: ['count_one_over', 'counted_sounds', 'word_for_count'],
        delete_compound: ['whole_word', 'removed_part'] }),
        // build_parts (`syllableBuild.ts`): the part count in code, then the word judge.
        build_parts: ['too_few_parts', 'too_many_parts', 'counted_letters', 'same_word', 'pick_another', 'not_a_word'] },
      unanswered: { blend_syllables: ['parts_back'], count_parts: ['count_one_over', 'counted_sounds', 'word_for_count'],
        delete_compound: ['whole_word', 'removed_part'],
        // build_parts: the word already made stays on screen; a word not for lessons has no smaller form.
        build_parts: ['same_word', 'pick_another'] },
    },
    // ── DI MODALITY (2026-08-16) — literacy port. The click era shipped a
    // `👏 Clap!` button, six counter circles and a `Check (3 claps)` label: the
    // button failed the costume test outright (a child who cannot hear a single
    // boundary can press it three times) and the circles did the COUNTING, which
    // is the one act the primitive exists to train. The clapping is not deleted
    // — it moved off the screen and into the room, where the child's own hands
    // are, exactly as at a teacher's table.
    // ⭐ THE ENUNCIATION IS THE INSTRUMENT AND IT IS A LADDER: chanted in parts
    // hands the count over (legal ONLY in the correction, and on a model word
    // the session never asks about); stretched-but-joined supports; whole at
    // natural pace is the real task. The click era had this backwards — its own
    // reveal policy said "never state the NUMBER of parts before the student
    // claps" while telling the easy tier to say the word "broken into its parts
    // with clear pauses" as the scaffold. Three beats IS three.
    // Cue lines and per-item judging contracts live in `syllableClapperScript.ts`
    // (hand-authored, DISTAR); items a tutor could not honestly ask (parts that
    // do not spell their word, a count outside 1..5, a dialect-variable word)
    // are DROPPED at build, never degraded.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    // ⭐ THE MODES ARE THE THREE ACTS, NOT THREE WORD LENGTHS (2026-09-11).
    // The 2026-08-16 port registered `easy` / `medium` / `hard` — word-length
    // bands — as eval modes, which made ONE act look like three skills and left
    // the three acts a phonological-awareness sequence is actually made of with
    // nowhere to be declared. Length moved to config.difficulty beside the ask
    // scaffolds; the modes are now blending, counting and deleting. Declared
    // ONCE in `syllableClapperModes.ts`, which also feeds the generator's prompt
    // docs, the judged response classes and the step sequence — before that, the
    // same three facts lived in three hand-maintained copies and a rename in one
    // of them left a mode that still generated and simply stopped being routable.
    // βs are unchanged in magnitude from the shipped registry (1.5 / 2.5 / 3.5).
    evalModes: [...SYLLABLE_CLAPPER_EVAL_MODES, {
      evalMode: 'build_parts',
      affordances: { answers: ['build'] },
      label: 'Make a Word With N Parts (open build)',
      beta: 2.6,
      scaffoldingMode: 2,
      challengeTypes: ['build_parts'],
      description: 'Open build: tap syllable cards (one clap each) into a word with the number of parts the task names '
        + '("make a word with three parts": but-ter-fly, ba-na-na; pop-corn for two), then press done; some items ask for '
        + 'a second word. Many words pass. Every card, the task and the made word can be heard. Code counts the parts; '
        + 'the shared word judge checks it is a real word. The count varies across the session. Beta = count_parts + 0.1.',
    }],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction syllable work for a young child. Right now the act is '
        + '"{{challengeType}}" and the thing you are voicing is "{{stimulus}}". There are three acts and '
        + 'they ask for different answers: on "blend_syllables" you say the parts one at a time and the '
        + 'child says the WHOLE WORD; on "count_parts" you say the word as one joined stream and the child '
        + 'claps its parts and answers with a NUMBER; on "delete_compound" you say a two-part word and name '
        + 'a part to take away, and the child says the WORD THAT IS LEFT. You judge the audio you heard. '
        + 'You speak the exact scripted lines from each bracketed application message and nothing else. '
        + 'Hearing the parts inside a spoken word — not reading them — is the entire skill being practiced, '
        + 'so the word is never shown on screen and nothing prints an answer.',
      // Exactly what the pack pushes through updateContext (and what the
      // connect-time primitive_data also carries). The stimulus is ANSWER-FREE
      // by construction, and ⭐ WHICH STRING IT IS DEPENDS ON THE ACT: on
      // counting and deleting the WORD is the question (the answer is a count or
      // a residue), while on blending the CHANT is the question and the word is
      // the answer — so `stimulusFor` pushes the chant there and the word never
      // crosses this channel. The old seven keys went with the improvised turns
      // they served — there is no `studentClaps` any more because there is no
      // clap button, and no `supportTier` directive because tier latitude now
      // lives IN the scripted ask (the second saying, the clap invitation).
      contextKeys: ['challengeType', 'stimulus'],
      // 18d — ALL THREE RUNGS ROUTE THROUGH THE SCRIPTED CORRECTION. A re-spoken
      // ask or a quoted hint opens with neither "Yes" nor "My turn:", so the
      // reducer records no verdict, the correction counter freezes, and the child
      // waits on a tutor that has already spoken. Authored correct at birth.
      scaffoldingLevels: {
        level1: 'Speak the current item\'s scripted correction line, exactly as the cue gives it. It already says the word, says its parts one at a time, names the count and asks again — that IS the first scaffold, and it opens with "My turn:" so the activity can hear it.',
        level2: 'Speak the SAME scripted correction line again, a little slower. Do not swap it for a re-spoken question, a slower saying of the word, a chin-drop tip or any other wording: a reply that opens with neither "Yes" nor "My turn:" reaches the activity as no verdict at all and the lesson stalls.',
        level3: 'Still the same scripted correction line. If the child is stuck after it, say nothing further — the activity moves the lesson on by itself and carries the next word to you.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak or do — never meta-instructions, which get recited).
      commonStruggles: [
        {
          pattern: 'Says a number that is one MORE than the parts - an extra beat on the last part',
          response: 'Treat it as not yet answered: give the scripted correction for this word, which says the parts one at a time and names the count, then asks again.',
        },
        {
          pattern: 'Counts out loud and keeps going past the total - "one, two, three, four" for a three-part word',
          response: 'Judge the number they LAND on, not the numbers along the way. If they landed past the total, give the scripted correction for this word.',
        },
        {
          pattern: 'Says the word back, or says its parts, without ever saying a number',
          response: 'Treat it as not yet answered: give the scripted correction, which ends by asking how many parts.',
        },
        {
          pattern: 'Counts the little sounds instead of the big parts - says "nine" for butterfly',
          response: 'Treat it as not yet answered: the scripted correction says the parts as whole beats, names the count, then asks again.',
        },
        {
          pattern: 'Blending: says the parts back one at a time instead of joining them into a word',
          response: 'Treat it as not yet answered: give the scripted correction for this item, which says the parts once more, then says the whole word, then asks again.',
        },
        {
          pattern: 'Deleting: says the whole word back, or says the part that was taken away',
          response: 'Treat it as not yet answered: give the scripted correction, which states the word without that part and then asks again.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the question once more, then wait for them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [SC_ITEM], [SC_MOVE], [SC_COMPLETE] or [SC_HEAR] contain the only lesson words '
            + 'you may speak. The square-bracket label is private metadata: never speak, reproduce, or invent '
            + 'it. Each carries a judging rule: affirmations must begin with "Yes" and corrections must begin '
            + 'with "My turn", using the exact quoted lines. Never begin any other sentence with those words. '
            + 'Judge honestly from the audio: affirm a right answer, correct a wrong or missing one, and do '
            + 'not praise to be kind. The application decides which word comes next; never introduce one '
            + 'yourself.',
        },
        {
          title: 'HOW YOU SAY THE WORD IS THE LESSON, AND IT FLIPS BETWEEN THE ACTS',
          instruction:
            'On "count_parts" and "delete_compound" the word is ONE JOINED STREAM every time you say it '
            + 'in the ask — even, unhurried, and never broken into parts, because the parts are exactly '
            + 'what the child is working out. Saying it in beats there gives the answer away just as '
            + 'surely as saying the number would. On "blend_syllables" it is the reverse: the parts one '
            + 'at a time with a clear pause between them IS the question, and the joined word is the '
            + 'answer, so you never say the whole word in that ask. Follow the spaced dots in the quoted '
            + 'line and you will always be right — where the line writes "but … ter … fly" say separate '
            + 'beats, and where it writes the word say one stream. When a cue tells you to voice the '
            + 'stimulus a second time, that repeat takes the same form as the first, just unhurried.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [SC_ITEM] of a session has the greeting, the rule, a worked example on a practice '
            + 'word, and the question INSIDE its quoted line. Speak that quote exactly and add nothing of '
            + 'your own: no separate greeting, no how-to-play of your own wording, no rephrased question. '
            + 'The practice word in that example is deliberately not one of the words the child will be '
            + 'asked about, so say it as written and do not substitute a word of your own. This OVERRIDES '
            + 'any "keep it to one sentence" cap from a lesson switch.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER (and the answer law)',
          instruction:
            'The answer always comes from the child\'s own mouth, and what it is made of depends on the '
            + 'act. On "count_parts" it is ONE NUMBER; counting the parts aloud counts too — judge the '
            + 'number they LAND on, and a count that keeps going past the total is wrong even though the '
            + 'right number was said along the way. On "blend_syllables" it is the WHOLE WORD; the parts '
            + 'said back still separated are not it, because those parts were handed to them. On '
            + '"delete_compound" it is the WORD THAT IS LEFT; the whole word repeated is not it, and '
            + 'neither is the part that was taken away. An answer inside a little phrase counts on every '
            + 'act. LAW: never speak the answer before the child has been affirmed — the microphone is '
            + 'open the whole time; the scripted correction is the one place the answer is spoken, and '
            + 'only because the attempt is already judged.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child answers. Do not re-ask, do not fill the '
            + 'pause, do not voice the stimulus again unprompted, and do not answer for them. They are '
            + 'holding the word in their own head — clapping it, joining it, or taking a part out of it — '
            + 'and that IS the activity, so the pause is longer here than it feels. If they tap to hear '
            + 'the question you will receive a separate [SC_HEAR] message: answer that and nothing more, '
            + 'then go back to waiting.',
        },
        {
          title: 'WORD OR PART ON DEMAND ([SC_HEAR])',
          instruction:
            'When you receive a message starting with [SC_HEAR], immediately and clearly say ONLY what it '
            + 'quotes — the question again, or one single word part — and nothing else. Do NOT spell '
            + 'anything, do NOT break a word into parts unless the quote itself writes them out, do NOT add '
            + 'commentary, and do NOT treat anything you just heard as an attempt to judge. This is the '
            + 'child tapping to re-hear the stimulus, which is how a pre-reader recovers it, and it is '
            + 'answered at every grade, including while you are waiting for their answer.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'phoneme-explorer',
    misconceptionScope: 'primitive',
    description:
      'Live Direct Instruction phoneme awareness with a spoken tutor — BEGINNING, ENDING, and MIDDLE (short-vowel) '
      + 'sounds, distinct from whole-word rhyme. The tutor asks, waits and responds to the child’s spoken '
      + 'answer, and a credited answer moves the lesson on. ALL SIX modes are ANSWERED ALOUD: Sound Match '
      + '(hear a sound and a 4-word menu, SAY the word that starts with it), Middle Sound Match (hear a CVC word — '
      + 'never printed — and a 4-word menu, SAY the word with the SAME MIDDLE VOWEL: "same middle sound as cat: hat '
      + 'or hot?"; THIS is the mode for "identify the short a/e/i/o/u sound in spoken words" and any medial-vowel '
      + 'auditory-awareness objective), Ending Sound Match (hear a CVC word and a picture-only spoken menu, SAY the '
      + 'word with the SAME final phoneme), Sound Blend (hear the sounds one at a time, SAY the word they make), Sound '
      + 'Count (hear a word, SAY how many sounds it has — the word is deliberately never printed, so letters cannot '
      + 'be counted), Sound Swap (hear a word and one change, SAY the new word). '
      + 'Every tile and card is tap-to-hear; there are no answer buttons and nothing to click to advance. '
      + 'Requires a microphone. ESSENTIAL for K-2 literacy.',
    constraints: 'Use concrete, picturable words with clear emoji matches. Isolate matches the '
      + 'INITIAL/beginning phoneme only, ending matches the FINAL phoneme only, and medial matches the MIDDLE short '
      + 'vowel only. Ending-mode target and menu spellings stay hidden until feedback; rhyme tasks still route to '
      + 'rhyme-studio / poetry-lab. '
      + 'K: CVC words. Spoken answers are WORDS or COUNTS — the child is never asked to produce an isolated '
      + 'letter sound, which is why the medial mode is a same-middle-sound CHOICE rather than "say the middle '
      + 'sound". Requires the live tutor and a microphone.',
    // reader: 'none' — shipped judged-loop port (port 6, 2026-08-11) and USER-DRIVEN
    // 2026-08-12 ("this passes human check"): the runner owns every cue; all modes are
    // answered aloud, and segment deliberately never prints the word.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    ...bossEntry(phonemeExplorerCard),
    evalModes: [
      {
        evalMode: 'isolate',
        label: 'Sound Match (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['isolate'],
        description:
          'Identify the INITIAL phoneme — hear a sound and a 4-word menu, SAY the word that starts with it. '
          + 'The cards stay on screen as the menu; the answer is spoken, judged by the live tutor.',
      },
      {
        evalMode: 'ending',
        label: 'Ending Sound Match (Tier 2)',
        beta: 1.75,
        scaffoldingMode: 2,
        challengeTypes: ['ending'],
        affordances: { representation: 'pictorial' },
        description:
          'Identify the FINAL phoneme — hear a CVC target and four picture-card words, then SAY the card word '
          + 'with the same ending sound. Target and card spellings stay hidden until feedback. Curated contrasts '
          + 'include minimal final changes such as cap/cat, while the correct pair does not rhyme, so initial-sound '
          + 'and whole-word rhyme cues cannot solve the task.',
      },
      {
        evalMode: 'medial',
        label: 'Middle Sound Match (Tier 2)',
        beta: 2.0,
        scaffoldingMode: 2,
        challengeTypes: ['medial'],
        // The stimulus word is never printed, so the screen is picture-only —
        // the same reason segment carries this override.
        affordances: { representation: 'pictorial' },
        description:
          'Identify the MIDDLE short-vowel sound — hear a CVC word (never printed, picture only) and a 4-word '
          + 'menu, SAY the menu word with the SAME middle sound ("same middle sound as cat: hat, hot, hut or '
          + 'hit?"). This is the mode for "identify the short a/e/i/o/u sound in spoken words" and every other '
          + 'medial-vowel auditory-awareness objective. The stimulus word said straight back is the signature '
          + 'error and takes the correction.',
      },
      {
        evalMode: 'blend',
        label: 'Sound Blend (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['blend'],
        description:
          'Blend phonemes into a word — hear /k/ /a/ /t/ one sound at a time, SAY "cat". Sounding it out and '
          + 'landing on the word counts; the separate sounds alone do not.',
      },
      {
        evalMode: 'segment',
        // The word is deliberately never printed here (letters must not be countable),
        // so the stimulus is picture-only.
        affordances: { representation: 'pictorial' },
        label: 'Sound Count (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['segment'],
        description:
          'Segment a word by ear — hear it spoken (never printed) and SAY how many sounds it has. '
          + 'Counting the sounds aloud and landing on the total counts.',
      },
      {
        evalMode: 'manipulate',
        label: 'Sound Swap (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['manipulate'],
        description:
          'Add, delete, or substitute a phoneme — hear the word and the one change, SAY the new word. '
          + 'The original word said back is the signature error and takes the correction.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'sound-swap',
    misconceptionScope: 'primitive',
    description:
      'Spoken phoneme manipulation with the live tutor. The student hears a starting word and one named sound to add, '
      + 'take away, or change, and SAYS THE NEW WORD ALOUD; the tutor judges the answer and a credited word moves the '
      + 'lesson on. Three operation modes: Addition (add a phoneme to make a new word), Deletion (remove a phoneme to '
      + 'reveal a new word), and Substitution (swap one phoneme for another). The starting word and its sounds are on '
      + 'screen and every sound is tappable to hear; there are no answer buttons. Change One Letter is an open build: the '
      + 'student changes one letter of a word in letter boxes to make any new real word and presses done. Requires a '
      + 'microphone for the spoken modes. ESSENTIAL for K-2 reading readiness.',
    constraints: 'Use simple CVC/CVCC words. All result words must be real words. Use proper phoneme notation with slashes. Spoken answers — requires the live tutor and a microphone.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['spoken'], role: 'apply', minutes: 4 },
    evalModes: [
      {
        evalMode: 'addition',
        label: 'Addition (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['addition'],
        description: 'Add a phoneme to make a new word.',
      },
      {
        evalMode: 'deletion',
        label: 'Deletion (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['deletion'],
        description: 'Remove a phoneme — what word remains?',
      },
      {
        evalMode: 'substitution',
        label: 'Substitution (Tier 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['substitution'],
        description: 'Swap a phoneme to change the word.',
      },
      {
        evalMode: 'swap_build',
        affordances: { answers: ['build'] },
        label: 'Change One Letter (open build)',
        beta: 4.1,
        scaffoldingMode: 3,
        challengeTypes: ['swap_build'],
        description: 'Open build: the boxes hold a familiar CVC word (cat); the learner changes ONE letter from a bank to make '
          + 'any new real word (bat, cot, cap) and presses done; some items ask for a second word. Many words pass. Code '
          + 'checks one letter changed and the CVC shape; the shared word judge checks it is a real word. β = substitution + 0.1.',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(soundSwapCard),
  },
  {
    id: 'letter-spotter',
    misconceptionScope: 'primitive',
    description:
      'Live letter RECOGNITION with the live tutor, who asks and teaches in its own words. Three directions, and '
      + 'the answer is made of something different in each: Sentence Spotter (the tutor reads a sentence with one word’s first letter hidden behind a '
      + 'star and the child SAYS the letter it hides, out loud with no answer choices on screen — initial '
      + 'sound to grapheme), Find It (the tutor names a letter and the child TAPS the one cell holding it '
      + 'among sixteen — letterform discrimination under visual search), and Match It (a capital is printed '
      + 'and the child TAPS its lowercase form — case correspondence). The two tap directions tap because '
      + 'their answers are a POSITION and a FORM, neither of which has a spoken shape. Nothing on screen '
      + 'shows the answer before it is credited. Cumulative letter groups 1-4. Requires a microphone. '
      + 'ESSENTIAL for kindergarten alphabet knowledge.',
    constraints:
      'Requires the live tutor and a microphone. Requires letterGroup (1-4). Group 1: s,a,t,i,p,n. '
      + 'Group 2: adds c,k,e,h,r,m,d. Group 3: adds g,o,u,l,f,b. Group 4: adds j,z,w,v,y,x,q. b and d are '
      + 'deliberately separated across groups. Sentence Spotter is a SPOKEN answer (the child says the letter '
      + 'or the sound it makes); Find It and Match It are touched. Letter-SOUND production objectives still '
      + 'route to letter-sound-link, which owns grapheme→phoneme and its continuant gate — this primitive '
      + 'teaches recognition. The manifest must NOT supply sentences or letters — the generator authors them '
      + 'from the letter group.',
    // name_it's spoken answer overturned the click-era 4-tile menu (2026-08-13
    // user ruling, drive 6ada8c0a1bcf) — voice GONE nowhere, it is the mode's
    // ONLY surface now; find_it/match_it stay tapped (position/form, unspeakable).
    affordances: { representation: 'symbolic', answers: ['spoken', 'tap'], role: 'apply', minutes: 5 },
    ...bossEntry(letterSpotterCard),
    evalModes: [
      {
        evalMode: 'name_it',
        affordances: { answers: ['spoken'] },
        label: 'Name It (Sentence Spotter)',
        // β RAISED 1.5 → 2.0 on the 2026-08-13 conversion, because the STRUCTURE
        // changed and not just the surface: a 1-of-4 menu (25% guess floor,
        // recognition) became unaided production from the sound of a word. This
        // is the exact case the family's β rule names.
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['name-it'],
        description:
          'The tutor reads a sentence aloud; one word’s first letter is hidden behind a star on screen and '
          + 'the child SAYS the letter it hides — no answer choices, either the letter’s name or its sound. '
          + 'Initial sound to grapheme as unaided production, with the rest of the word still printed as the '
          + 'decodable cue.',
      },
      {
        evalMode: 'find_it',
        affordances: { answers: ['tap'] },
        label: 'Find It (Visual Search)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['find-it'],
        // β UNCHANGED through the DI port, deliberately. The commit shape moved
        // (select-every-instance-then-Check became one target, one tap) but β
        // measures the DISCRIMINATION load, and that is set by scanning sixteen
        // cells whose distractor similarity the support tier controls — which is
        // untouched. Finding one of three got easier; losing the second look a
        // Check button allowed got harder; the search itself is the same.
        description:
          'The tutor names a letter; the child finds the ONE cell holding it among sixteen and taps it. '
          + 'Letterform discrimination under visual search, with distractor similarity set by the support tier.',
      },
      {
        evalMode: 'match_it',
        affordances: { answers: ['tap'] },
        label: 'Match It (Case Matching)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['match-it'],
        description:
          'A capital letter is printed; the child taps its lowercase form from three or four. The tutor does not '
          + 'name the big letter or describe any letter — case correspondence is the skill, so the pairing is what '
          + 'must be earned.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'letter-sound-link',
    ...bossEntry(letterSoundLinkCard),
    misconceptionScope: 'primitive',
    description:
      'Letter-sound practice with the live tutor, who asks and teaches in its own words. Three directions, and the '
      + 'answer is made of something different in each: Say the Sound (a letter is printed and the child SAYS the sound '
      + 'it makes, grapheme→phoneme PRODUCTION: held sounds, short vowels and clipped stops), Find the Letter (the tutor '
      + 'says a sound and the child TAPS which of two confusable letters makes it, phoneme→grapheme; the activity checks '
      + 'the tap), and Say the Word (a letter plus two pictures; the child SAYS the picture word that starts with that '
      + 'letter\'s sound). Nothing on screen prints a sound, a word or a keyword before the answer is credited. Cumulative '
      + 'letter groups 1-4. Requires a microphone. ESSENTIAL for kindergarten and first-grade phonics.',
    constraints:
      'Requires the live tutor and a microphone. Supports 4 cumulative letter groups. '
      + 'Say the Sound can only target letters whose sound a child can say alone: held sounds (s n m f l r v z), the '
      + 'short vowels and the clipped stops t p c k h d g b. Affricates, glides and clusters (j w y x qu) are not '
      + 'askable as isolated child production and the generator retargets them; they are covered by the other two '
      + 'directions instead. '
      + 'Say the Word cannot target x or i — /ks/ never begins an English word, and no short-i word has a picture '
      + 'a pre-reader names; both keep full coverage in the other two directions. '
      + 'One letter is asked ONCE per session, so a group bounds how many challenges a lesson can carry. '
      + 'Do not route letter-NAMING objectives here — naming a letter aloud has no reliable judge.',
    // reader: 'none' — READY @ PRE after the --fix loop, live-confirmed
    // (qa/reader-fit/letter-sound-link-PRE-2026-07-14.md + the 2026-08-16 live DI reports).
    // `hear_see` is the one tapped direction: a grapheme cannot be spoken, so it is touched.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'tap'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'see_hear',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
        // Beta RAISED 1.5 → 3.0 with the DI port: this stopped being a 1-of-2
        // audio discrimination (guessable at 50%) and became unaided
        // grapheme→phoneme PRODUCTION with no options on screen.
        label: 'Say the Sound (Letter → Spoken Phoneme)',
        beta: 3.0,
        scaffoldingMode: 1,
        challengeTypes: ['see-hear'],
        description:
          'Grapheme→phoneme PRODUCTION — see a letter and say the sound it makes aloud; the tutor judges it '
          + 'against the key. No options are shown. Held sounds, short vowels and clipped stops; affricates, glides '
          + 'and clusters cannot be produced in isolation by a five-year-old for a judge.',
      },
      {
        evalMode: 'hear_see',
        // A grapheme cannot be spoken: the tutor says the sound and the child TAPS the letter.
        affordances: { representation: 'symbolic', answers: ['tap'] },
        label: 'Find the Letter (Sound → Grapheme)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['hear-see'],
        description:
          'Phoneme→grapheme — the tutor says a sound, the child taps which of two confusable letters makes it. '
          + 'Tapped rather than spoken: a letter NAME has no reliable judge (b/p/d/e/g are homophonic), so the '
          + 'grapheme is touched. The only direction that covers stop consonants.',
      },
      {
        evalMode: 'keyword_match',
        affordances: { representation: 'pictorial', answers: ['spoken'] },
        label: 'Say the Word (Letter → Spoken Keyword)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['keyword-match'],
        description:
          'Sound-to-word anchoring — see a letter and two pictures, say aloud the picture word that starts with '
          + 'that letter\'s sound. Spoken from a closed two-picture set; nothing prints the word.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'oral-sentence-studio',
    description:
      'Kindergarten Language Arts oral vocabulary and sentence production. A child studies a meaningful visible scene and '
      + 'exactly two new target vocabulary words, then produces one original complete spoken sentence that describes '
      + 'the scene and uses both words meaningfully. A semantic live tutor judge accepts natural paraphrases and '
      + 'multiple valid sentences while distinguishing successful concept use from fragments, irrelevant responses, '
      + 'and unrelated memorized sentences. Supports guided vocabulary activities, creating simple sentences from '
      + 'newly learned story words, multiword image or scenario descriptions from a word bank, and oral rehearsal for '
      + 'class stories, recipes, and other guided writing. ESSENTIAL for Kindergarten vocabulary use, complete oral sentences, '
      + 'scene description, and expressive language.',
    constraints:
      'Requires a microphone and live tutor. Use exactly three content-bearing challenges per session. '
      + 'Keep the meaningful scene and exactly two target vocabulary words visible while the child answers; hide all '
      + 'model sentences and answer wording until feedback. Each response must be one child-generated complete oral '
      + 'sentence that describes the current scene and uses both target words coherently and with appropriate meaning. '
      + 'Judge meaning and use rather than exact wording; accept age-appropriate grammar, inflections, and paraphrases '
      + 'when the sentence remains complete and both concepts are clear. Reject fragments, word lists, irrelevant '
      + 'sentences, and unrelated memorized responses. After an attempt, acknowledge conveyed meaning first, then model '
      + 'or prompt revision only for the specific missing word, meaning, or sentence structure. The manifest must NOT '
      + 'supply scenes, target words, or model sentences; the content-bearing generator builds all three challenges.',
    evalModes: [
      {
        evalMode: 'describe_scene', label: 'Picture Sentences', beta: 3.5, discrimination: 1.6,
        scaffoldingMode: 3, challengeTypes: ['describe_scene'],
        description: 'Describe a visible scene in one original complete sentence that uses two shown words with their meanings.',
      },
      {
        evalMode: 'guided_writing_rehearsal', label: 'Say It Before We Write', beta: 4.0, discrimination: 1.6,
        scaffoldingMode: 4, challengeTypes: ['guided_writing_rehearsal'],
        description: 'Oral rehearsal for shared writing (class story, recipe, how-to): say the sentence for the pictured next step with an order word and a vocabulary word.',
      },
      {
        evalMode: 'use_story_words', label: 'Story Words', beta: 5.0, discrimination: 1.0,
        scaffoldingMode: 4, challengeTypes: ['use_story_words'],
        description: 'Hear two new words in a short story, then use both in a new sentence of their own, about the story or anything else; a story line said back does not count.',
      },
    ],
    // The answer is one spoken sentence (the card's SPOKEN modes). Reader and minutes are not tagged: no reader-fit verdict yet.
    affordances: { answers: ['spoken'] },
    supportsEvaluation: true,
    ...bossEntry(oralSentenceStudioCard),
  },
  {
    id: 'picture-vocabulary',
    misconceptionScope: 'skill',
    description:
      'Live picture-vocabulary practice with a spoken tutor. ORAL VOCABULARY for K-1: the tutor '
      + 'asks, waits and judges the child’s answer, and a credited answer moves the lesson on. FIVE of '
      + 'the six modes are ANSWERED ALOUD — the child names a picture (Say It), produces an opposite (Opposites), '
      + 'says what goes with a shown thing (Goes Together), says the missing rung of a spoken word scale (Word '
      + 'Scale), or finishes a spoken sentence (Finish the Sentence) — there are no word chips to tap and nothing '
      + 'on screen prints the answer. ONE mode is ANSWERED WITH THE HANDS on emoji-only picture cards: Listen & '
      + 'Find (hear a word, tap its picture), where picking the referent out of four IS the receptive skill; the '
      + 'tap is the commit and the activity checks it. Tap-to-hear repeats the question. Requires a '
      + 'microphone. ESSENTIAL for K-1 vocabulary development and oral language. One more mode is an open build: Picture '
      + 'Pairs, where the child MAKES a pair by tapping two of eight wordless pictures that are opposites or go together, '
      + 'and many pairs pass.',
    constraints:
      'Use concrete, picturable words with clear emoji matches. K: everyday nouns (animals, foods, clothes, home). '
      + 'Answers are single spoken words or (receptive_match only) a picture tap. Goes Together accepts an OPEN set '
      + 'of single-word answers judged against a rule; every other spoken mode has one defensible answer plus fair '
      + 'synonyms. Do not route open-ended PHRASE production (define a word, use it in a sentence) here — the open '
      + 'set is one word wide, not one sentence wide. Requires the live tutor and a microphone. '
      + 'The manifest must NOT supply specific words — the generator builds the word pool and challenges '
      + 'deterministically from the eval mode.',
    // reader: 'none' — nothing on screen prints the word before credit; five modes are answered aloud,
    // receptive_match taps a picture and pair_build puts two pictures in a tray.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken', 'tap', 'build'], role: 'apply', minutes: 5 },
    ...bossEntry(pictureVocabularyCard),
    evalModes: [
      {
        evalMode: 'receptive_match',
        // The one tapped mode: the tutor says the word and the child taps its picture.
        affordances: { answers: ['tap'] },
        label: 'Listen & Find (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['receptive_match'],
        description:
          'Receptive vocabulary — hear a word spoken, tap the matching picture from 4 emoji-only cards. The tap '
          + 'is the commit, and the activity checks it.',
      },
      {
        evalMode: 'naming',
        affordances: { answers: ['spoken'] },
        label: 'Say It (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['naming'],
        description:
          'Expressive naming — see a picture, say the word aloud; the tutor judges the audio in-band. No word '
          + 'chips — the child retrieves the word from memory.',
      },
      {
        evalMode: 'association',
        affordances: { answers: ['spoken'] },
        label: 'Goes Together (Tier 3)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['association'],
        description:
          'Word associations — see and hear a thing, SAY something that goes with it aloud (sock→shoe). An OPEN '
          + 'answer set: "what goes with sock" has several honest answers (shoe, foot, drawer), so the judge is '
          + 'given the RULE rather than a list and any everyday thing that plainly goes with the stimulus counts. '
          + 'A connection that needs a story to explain it does not, and neither does the name of the group '
          + '(clothes) or another member of it (shirt). No picture cards — the child retrieves the partner.',
      },
      {
        evalMode: 'opposite',
        affordances: { answers: ['spoken'] },
        label: 'Opposites (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['opposite'],
        description:
          'Word relationships — hear and see a word, say its opposite aloud. The shown word said back is the '
          + 'signature error and takes the correction.',
      },
      {
        evalMode: 'pair_build',
        affordances: { answers: ['build'] },
        label: 'Picture Pairs (open build)',
        beta: 3.6,
        scaffoldingMode: 3,
        challengeTypes: ['pair_build'],
        description: 'Open build, pre-reader: eight pictures, no print; tap two that are opposites (hot and cold) or two '
          + 'that go together (sock and shoe) into a pair tray and press done; some boards ask for a second pair. Several '
          + 'pairs pass. Opposites boards hold an alike decoy (happy and laughing, named alike); goes-together boards hold '
          + 'a same-kind decoy (sock and hat, named same_kind). Checked in code from the pictures\' known relations. The '
          + 'intent picks opposites or goes together when it names one, else items alternate. Beta = opposite + 0.1.',
      },
      {
        evalMode: 'sentence_frame',
        affordances: { answers: ['spoken'] },
        label: 'Finish the Sentence (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['sentence_frame'],
        description:
          'Vocabulary in context — hear a sentence with a missing word, say the word that completes it aloud.',
      },
      {
        evalMode: 'gradable_scale',
        affordances: { answers: ['spoken'] },
        label: 'Word Scale (Tier 5)',
        beta: 6.0,
        scaffoldingMode: 5,
        challengeTypes: ['gradable_scale'],
        description:
          'Gradable vocabulary — hear an ordered low→high word list with one rung missing, say the missing word '
          + '(freezing→cold→__→warm→hot). A word already in the list is never the answer.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'cvc-speller',
    misconceptionScope: 'primitive',
    description:
      'CVC sounds-and-letters practice with the live tutor. PHONICS / ENCODING for K-1: the child hears a CVC word and '
      + 'the tutor teaches in its own words. Two of the word modes are ANSWERED ALOUD \u2014 the child hears a word and '
      + 'SAYS ITS MIDDLE SOUND (there are no vowel buttons and no sound buckets to tap), judged by the tutor. Spell It is '
      + 'answered WITH THE HANDS: the child puts a letter in each of three Elkonin boxes from a letter bank, and the third '
      + 'letter landing is the answer, checked by the activity \u2014 there is no Check button. Make a Word is an open '
      + 'build of any real word that fits the ask. Tap-to-hear repeats the word. Requires a microphone. ESSENTIAL for K-1 '
      + 'phonics encoding (sound \u2192 letter), the direction phonics-blender does not cover.',
    constraints:
      'Only CVC (3-letter) words. SCOPE IS THE CUMULATIVE LETTER GROUP (1-4, the shared phonics progression that '
      + 'letter-spotter and letter-sound-link also use): every letter of every word comes from that group, and the '
      + 'group carries its own vowels (group 1 = s a t i p n spans two). A single vowel focus is applied ONLY when '
      + 'the objective actually names one ("short a words") \u2014 otherwise the words spread across the group\'s vowels, '
      + 'because the K curriculum\'s CVC spelling objective carries no vowel scoping and its letter-sound objective '
      + 'names all five. Set config.letterGroup to control breadth; a named vowel can only RAISE the group, never '
      + 'lower it. Spoken answers are SOUNDS, never letter names \u2014 letter NAMES are a blocked response class here, '
      + 'so do not route letter-naming or alphabet-recognition objectives to this primitive. Requires the live tutor '
      + 'and a microphone. The manifest must NOT supply per-challenge words \u2014 the generator authors the word pool '
      + 'from the letter group and the objective.',
    // reader: 'none' \u2014 READY @ PRE for all three modes (qa/reader-fit/cvc-speller-PRE-2026-07-14.md).
    affordances: { representation: ['concrete', 'symbolic'], reader: 'none', answers: ['spoken', 'build'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'fill_vowel',
        affordances: { answers: ['spoken'] },
        label: 'Middle Sound (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['fill-vowel'],
        description:
          'Hear a word and SAY its middle sound aloud. A consonant frame (c _ t) is on screen and the vowel letter '
          + 'fills the blank only once the tutor affirms \u2014 that reveal is the sound-to-letter link. Words spread '
          + 'across the letter group\'s vowels unless the objective names one, in which case the set is massed '
          + 'practice on that sound.',
      },
      {
        evalMode: 'spell_word',
        affordances: { representation: 'concrete', answers: ['build'] },
        label: 'Spell It (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['spell-word'],
        description:
          'Hear a word and put a letter in each of three Elkonin boxes from a letter bank. The third letter landing '
          + 'is the answer, checked by the activity; Try again keeps the letters that were right.',
      },
      {
        evalMode: 'make_word',
        affordances: { answers: ['build'] },
        label: 'Make a Word (open build)',
        beta: 2.6,
        scaffoldingMode: 2,
        challengeTypes: ['make-word'],
        description: 'Open build: put a letter from a bank in each of three boxes to MAKE any real CVC word that fits the ask '
          + '(the short a sound in the middle; rhymes with cat), then press done; some items ask for a second word. Many '
          + 'words pass. Code checks the vowel, the family and the shape; the shared word judge checks it is a real word. '
          + 'K-2, scoped to the letter group. β = spell_word + 0.1.',
      },
      {
        evalMode: 'word_sort',
        affordances: { answers: ['spoken'] },
        label: 'Sound Groups (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['word-sort'],
        description:
          'Hear a word and SAY its middle sound aloud, across a pool that MIXES two vowels \u2014 so unlike fill_vowel '
          + 'the answer changes from word to word. Affirmed words collect into two on-screen vowel groups.',
      },
    ],
    supportsEvaluation: true,
    ...bossEntry(cvcSpellerCard),
  },
  {
    id: 'word-workout',
    ...bossEntry(wordWorkoutCard),
    description:
      'Live CVC word reading with a spoken tutor, who teaches in its own words; the activity checks each picture '
      + 'tap. THE PRINT IS DECODED COLD AND '
      + 'MOST ANSWERS ARE SPOKEN: the child READS two printed words and SAYS the real one (Real or Silly?), reads '
      + 'each word of a one-letter-change chain OUT LOUD (Word Chain), and READS a decodable sentence ALOUD before '
      + 'SAYING the answer to a question about it (Read It). It also extends decoding beyond isolated CVC: the '
      + 'child cold-reads code-bounded words with -s, -ing, or -ed, reads familiar two-part compounds, and reads '
      + 'both words in a near-spelled pair before using sentence context to say which one fits. A meaning question '
      + 'is a separate judged turn only when the objective asks for comprehension, so decoding and meaning never '
      + 'share one score. Picture Match is the one hands mode — the word is '
      + 'printed, the child decodes it silently and taps the picture it means, which is what shows they know what '
      + 'the word MEANS rather than only how it sounds. Nothing on screen marks the answer before it is '
      + 'credited, there is nothing to click to advance, and the tutor never reads the print for the child. '
      + 'Requires a microphone. Capstone practice for CVC decoding, blending automaticity and word-in-context '
      + 'fluency. ESSENTIAL for K-2 literacy.',
    constraints:
      'Requires the live tutor and a microphone. THIS PRIMITIVE ASSUMES THE CHILD CAN DECODE CVC PRINT: the tutor '
      + 'never says a printed word before the child reads it, so a pre-reader who cannot yet sound out a CVC word '
      + 'has nothing to work from — route those objectives to letter-sound-link / phonics-blender instead. '
      + 'BAND FLOOR: sentence_reading (connected-text decoding + comprehension) is Grade 1+. '
      + 'Real/Nonsense needs phonetically plausible nonsense words that START WITH A DIFFERENT CONSONANT from '
      + 'their real partner (the child says one aloud and the tutor judges it by ear, so a pair differing only in '
      + 'its last sound cannot be scored). Word Chains must follow the one-letter-change rule. Sentences use only '
      + 'mastered CVC words + approved sight words and must fit the benched 3-8 word read-aloud window; the '
      + 'comprehension answer must be a word IN the sentence and must NOT appear in the question. Inflected and '
      + 'compound modes select only from the code-owned Kindergarten early-decoding pool; Gemini cannot invent a '
      + 'harder word, its decoding parts, or its meaning key. Context trials likewise use only code-owned CVC '
      + 'near-word pairs with exactly one sentence fit. All printed targets stay visible; tutor pronunciation and '
      + 'answer-identifying pictures stay withheld before the cold read. Word parts are shown only after an '
      + 'attempt, then the next word checks independent transfer.',
    // reader: 'none' base — READY @ PRE for real_vs_nonsense/picture_match/
    // word_chains (qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md);
    // sentence_reading overridden 'emerging' — floored Grade 1+, the
    // decodable-reader precedent that doc invokes by name.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken', 'tap'], role: 'apply', minutes: 6 },
    evalModes: [
      {
        evalMode: 'real_vs_nonsense',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
        label: 'Real vs Nonsense (Tier 1)',
        // β RAISED 1.5 → 2.5 on the DI port: a 1-of-2 tap with a 50% guess floor
        // became unaided spoken production of the decoded word, which is the
        // structural case the family's β rule names (letter-spotter name_it and
        // story-talk, same conversion, same step).
        beta: 2.5,
        scaffoldingMode: 1,
        challengeTypes: ['real-vs-nonsense'],
        description: 'Read both printed words and SAY the real one aloud. The guess floor is gone with the tap; β raised for unaided production.',
      },
      {
        evalMode: 'picture_match',
        affordances: { answers: ['tap'] },
        label: 'Picture Match (Tier 2)',
        // β UNCHANGED: still a tap of the same size. What changed is a SCAFFOLD
        // (the speaker button that read the word aloud), not the structure of
        // the answer — the β rule moves on structure only.
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['picture-match'],
        description: 'Decode the printed word silently, then tap the picture it means — word-meaning connection. The tutor never says the word.',
      },
      {
        evalMode: 'word_chains',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
        label: 'Word Chains (Tier 3)',
        // β RAISED 3.5 → 4.0: the click era advanced on a "Next Word" button and
        // scored every chain 100 regardless of what was said, so the reading was
        // never measured at all. Every word is now a judged oral read.
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['word-chains'],
        description: 'READ ALOUD every word of a one-letter-change chain; each word is judged on its own. β raised because the reading was previously unmeasured.',
      },
      {
        evalMode: 'read_inflected',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
        label: 'Read Common Endings',
        beta: 4.5,
        discrimination: 1.6,
        scaffoldingMode: 4,
        challengeTypes: ['inflected-word'],
        description:
          'Cold-read code-bounded early words with -s, -ing, and -ed. After a first try a bar can split base and ending, '
          + 'and the parts show once it is read; a new word checks transfer. A separate meaning turn appears only for an '
          + 'explicit comprehension objective.',
      },
      {
        evalMode: 'read_compound',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
        label: 'Read Compound Words',
        beta: 4.5,
        discrimination: 1.6,
        scaffoldingMode: 4,
        challengeTypes: ['compound-word'],
        description:
          'Cold-read a code-bounded compound made from two familiar decodable words. After a first try a bar can split '
          + 'the two parts, and they show once it is read; a new word checks transfer. Meaning is a separate turn when '
          + 'comprehension is named.',
      },
      {
        evalMode: 'choose_in_context',
        affordances: { representation: 'symbolic', answers: ['spoken'] },
        label: 'Choose a Near Word in Context',
        beta: 5.0,
        discrimination: 1.0,
        scaffoldingMode: 4,
        challengeTypes: ['context-discrimination'],
        description:
          'Read both words in a one-letter-different CVC pair aloud, then use a short sentence to SAY which word fits. '
          + 'The two cold reads and the later context decision are retained as separate evidence.',
      },
      {
        evalMode: 'sentence_reading',
        affordances: { representation: 'symbolic', reader: 'emerging', answers: ['spoken'] },
        label: 'Sentence Reading (Tier 4)',
        // β RAISED 5.0 → 5.5: an unjudged "I Read It!" button plus a 1-of-N
        // comprehension tap became a judged whole-sentence read PLUS unaided
        // spoken production of the answer.
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['sentence-reading'],
        description: 'READ the decodable sentence ALOUD (judged word by word), then SAY the answer to a question about it. β raised for judged reading and unaided production.',
      },
    ],
    supportsEvaluation: true,
  },

  // ===== READING: LITERATURE (RL) =====
  {
    id: 'story-map',
    description: 'Interactive plot structure diagram where students identify and place story elements on a visual arc. Supports beginning-middle-end (K-1), story mountain (2-3), full plot diagram (4-5), and hero\'s journey (5-6). Students drag event cards to arc positions. ESSENTIAL for reading comprehension K-6.',
    constraints: 'Requires narrative text. Structure type should match grade level.',
    affordances: { representation: 'symbolic', answers: ['manipulate'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      { evalMode: 'bme', label: 'BME (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['bme'], description: 'Beginning-Middle-End (K-1).' },
      { evalMode: 'story_mountain', label: 'Story Mountain (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['story-mountain'], description: '5-part narrative arc (2-3).' },
      { evalMode: 'plot_diagram', label: 'Plot Diagram (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['plot-diagram'], description: 'Freytag\'s pyramid (4-6).' },
      { evalMode: 'heros_journey', label: 'Hero\'s Journey (Tier 5)', beta: 6.5, scaffoldingMode: 5, challengeTypes: ['heros-journey'], description: 'Complex narrative structure (5-6).' },
    ],
    supportsEvaluation: true,
    // W1 plain shape (batch C13): each phase of the one story is a checked item (identify, sequence, and analyze at
    // Grade 4+ with a conflict); `storyMapWorkspace.ts` owns the check, the scene and `storyMapMiss`.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'The activity checks every answer itself, and you are not told the answers. First the learner taps every '
        + 'printed name that is a character in the story (some printed names are not in it) and one setting, then '
        + 'checks. Next they tap an event card and then a part of the story arc, and with every card placed they '
        + 'check; the cards are listed mixed up on purpose. At Grade 4 and up they then pick the kind of conflict. '
        + 'Never say which names are characters (reading the story is fine, but never say a printed name is or is not '
        + 'in it), which setting is right, which part an event goes in, or the kind of conflict, before a check or '
        + 'after a wrong one. After a sequence '
        + 'check the screen marks each card green or red; you may say how many are right, not where the red ones go. '
        + 'Teaching is asking about the story: who did something, where they were, what happened first or after the '
        + 'problem, how it ended, who or what the main character struggles against. You may read the story and the '
        + 'choices aloud, and must for a Kindergarten or Grade 1 learner. You cannot tap or place for the learner.',
      // The activity's own check (`storyMapMiss`); the conflict phase is asked on the Grade 4+ structures only.
      misses: missLists<StoryMapMiss>({
        bme: ['picked_not_in_story', 'missed_character', 'wrong_setting', 'one_part', 'reversed', 'next_part', 'far_part'],
        story_mountain: ['picked_not_in_story', 'missed_character', 'wrong_setting', 'one_part', 'reversed', 'next_part', 'far_part'],
        plot_diagram: ['picked_not_in_story', 'missed_character', 'wrong_setting', 'one_part', 'reversed', 'next_part', 'far_part',
          'inside_outside', 'other_outside'],
        heros_journey: ['picked_not_in_story', 'missed_character', 'wrong_setting', 'one_part', 'reversed', 'next_part', 'far_part',
          'inside_outside', 'other_outside'],
      }),
      // character_count, part_pictures, arc_arrow, conflict_pictures, easier_story, easier_conflict
      // (`storyMapLevers.ts`); every miss answered on every mode.
      levers: true,
    },
    tutoring: {
      taskDescription: 'Map story elements to {{structureType}} structure. Current phase: {{currentPhase}}. Elements found: {{elementsIdentified}}.',
      contextKeys: ['structureType', 'currentPhase', 'elementsIdentified'],
      scaffoldingLevels: {
        level1: 'Think about what happens at this part of the story.',
        level2: 'Remember when [character] did [action]? Which part does that belong in?',
        level3: 'The [element] usually comes here. Look for clues like [signal words].',
      },
      commonStruggles: [
        { pattern: 'Confusing parts', response: 'Point to visual structure, ask where event fits' },
        { pattern: 'Missing elements', response: "What haven't we filled in yet?" },
        { pattern: 'Wrong sequence', response: 'Think about what happened first, next, last' },
      ],
    },
  },
  {
    id: 'story-talk',
    description:
      'Live Direct Instruction listening comprehension with a spoken tutor. The tutor reads a short 3-5 '
      + 'sentence story aloud with character voices, asks one question, waits, judges the child\'s answer from '
      + 'the audio in-band, and its own affirmation moves the lesson on. ALL THREE MODES ARE ANSWERED ALOUD — '
      + 'the child SAYS the detail the story stated (Listen & Tell: "Who hid the acorn?"), SAYS how a character '
      + 'felt when the story never named the feeling (How Did They Feel?), or SAYS why something happened (Why '
      + 'Did It Happen?). Every answer is one short word a five-year-old can say, so the child produces it '
      + 'rather than picking it; there are no answer pictures, no chips and nothing to click to advance. The '
      + 'story is audio-only while they answer and prints afterwards. Requires a microphone. Builds oral '
      + 'listening comprehension, recall of key story details, emotion inference and causal reasoning. '
      + 'ESSENTIAL for K Reading Comprehension and Speaking & Listening (recall key details from a read-aloud). '
      + 'Works for pre-readers: nothing has to be read.',
    constraints:
      'Requires the live tutor and a microphone. Listening comprehension only — the child never reads, so do '
      + 'NOT route decoding, phonics, sight-word or print-concept objectives here. Answers must be single '
      + 'concrete words a five-year-old can pronounce (a picturable noun, or one common feeling word). K '
      + 'comprehension: 3-5 short sentences, one scene, one problem. The manifest must NOT supply story text, '
      + 'questions, or answers — the generator authors the mini-stories, questions and near misses '
      + 'self-consistently from the topic.',
    // reader: 'none' — the reader-fit skill's own PRE reference model, cited as
    // a negative control because it is structurally mute to a non-reader risk
    // (qa/reader-fit/BACKLOG.md, qa/reader-fit/supply-sweep-triage-2026-08-06.md);
    // "Works for pre-readers: nothing has to be read" per this entry's own description.
    affordances: { reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    // ── DI MODALITY (2026-08-14) — FIFTEENTH literacy port. The tutor owns the
    // clock: it reads the story, asks once, waits, judges the spoken answer from
    // the audio in-band, and its own line is the advance. No advance timer, no
    // Next button, no push-to-talk mic, no start-screen fork.
    // THE FORK HAS NO SPLIT — every mode's answer is ONE WORD (a noun, a
    // feeling, a cause), which is sayable, so all three are spoken and the
    // four-picture menu is DELETED. A menu here converted production into
    // recognition and floored a guess at 1 in 4; a teacher reading a story to
    // one child and asking "Who hid the acorn?" has no cards on the table. The
    // distractors survive OFF SCREEN as generator quality material and as the
    // judged harness's signature wrong answer — nothing renders them.
    // IT ALSO DELETED THE FAMILY'S LAST TUTOR-BUSY MIC GATE. The click era ran
    // the mic only while the tutor was silent, because a separate capture could
    // hear the TUTOR read the answer out of the story. The judged loop removes
    // the reason rather than the rule: the judge is the tutor, judging its own
    // session audio, so it cannot mistake its read-aloud for the learner.
    // Cue lines and the per-item judging contracts live in `storyTalkScript.ts`
    // (hand-authored, DISTAR); this block is the session-level frame. SENTINEL
    // DISCIPLINE (standing gate 2) re-checked on every line below: no sentence
    // begins with "Yes" or with "My turn". That gate binds the GENERATED stories
    // too — this is the one primitive whose read-aloud is character dialogue,
    // and "Yes, I found it!" read verbatim would be a phantom verdict.
    audioInput: { manual_activity: true },
    evalModes: [
      {
        evalMode: 'who_what_where',
        label: 'Listen & Tell (Tier 1)',
        // β RAISED 2.0 → 2.5 on the DI port: a 1-of-4 picture tap became unaided
        // spoken production, which is the structural case the family's β rule
        // names (letter-spotter name_it, same conversion, same step).
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['who_what_where'],
        description: 'Literal recall — hear a story, then SAY the who/what/where detail the story stated. The guess floor is gone with the picture menu; β raised for unaided production.',
      },
      {
        evalMode: 'feeling_check',
        label: 'How Did They Feel? (Tier 2)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['feeling_check'],
        description: 'Emotion inference — SAY how a character felt when the story showed it through events and never named it. β raised for unaided production; the feeling is now also gated absent from the story text, which the click era never checked.',
      },
      {
        evalMode: 'why_because',
        label: 'Why Did It Happen? (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['why_because'],
        description: 'Causal inference — SAY why something happened in the story. β raised for unaided production; the cause said as a whole reason ("because of the rain") is accepted and is a better answer than the word alone.',
      },
    ],
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction listening comprehension for a young child. You read a short story '
        + 'aloud, ask one question about it, and the child answers OUT LOUD with one word. Right now the '
        + 'comprehension skill is "{{challengeType}}" and the question you are asking is "{{stimulus}}". You '
        + 'speak the exact scripted lines from each bracketed application message, you re-read the story when '
        + 'the child asks to hear it again, and you judge each spoken attempt from the audio you heard using '
        + 'only the two allowed reply branches. Holding a story in mind and finding the answer inside it is the '
        + 'entire skill being practiced, so the child produces the answer — never picks it from a list you '
        + 'offer.',
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory, and every level is a
      // BEHAVIOUR rather than a line you may say. A ladder that quotes speakable
      // hints is a no-verdict stall: on a repeated wrong answer the model
      // reaches for the sanctioned-sounding alternative and says something that
      // opens with neither sentinel, so the loop records no verdict at all and
      // the correction counter freezes (proven by number-bond's cap drill,
      // 2026-08-14; queue item 18d).
      scaffoldingLevels: {
        level1: 'Use the scripted correction line for this story, then hand the question back and wait.',
        level2: 'Use that same scripted correction line again, unchanged, and give them longer in silence.',
        level3: 'Use that same scripted correction line again — the wording is fixed, the patience is what changes.',
      },
      // Observable behaviours only, and the first entry in each mode's family is
      // that mode's signature error: the wrong answer that arrives fluent,
      // confident, and most likely to be affirmed by mistake.
      commonStruggles: [
        {
          pattern: 'Says a different thing from the story — whatever they heard last, said confidently',
          response: 'Treat it as not yet answered: run the scripted correction for this story, then hand the question back and wait.',
        },
        {
          pattern: 'Says what HAPPENED when asked how someone felt — "he lost his acorn" instead of a feeling',
          response: 'An event is not a feeling, and this is the miss to catch. Run the scripted correction, then ask once more and wait.',
        },
        {
          pattern: 'Says what happened when asked WHY it happened — the event repeated back',
          response: 'Naming the event is not naming its cause. Run the scripted correction, then hand the question back and wait.',
        },
        {
          pattern: 'Says a fair word for the same idea — "unhappy" for sad, "puppy" for dog',
          response: 'That is a correct answer — affirm it and echo the story\'s own word. Comprehension is what is being measured, not vocabulary.',
        },
        {
          pattern: 'Answers inside a phrase — "the squirrel" or "because it rained" instead of one bare word',
          response: 'That is a correct answer, and the fuller reason is the better one. Affirm it and echo the word.',
        },
        {
          pattern: 'Goes quiet after the question, or asks to hear the story again',
          response: 'Silence is a five-year-old holding a whole story in mind — wait. If they ask, the application sends the re-read; never volunteer one.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [ST_ITEM], [ST_MOVE], [ST_HEAR] or [ST_COMPLETE] contain the only lesson words '
            + 'you may speak, and each one quotes the exact line after "Say exactly:". The square-bracket label '
            + 'is private metadata: never speak, reproduce, or invent it. Affirmations begin with "Yes" and '
            + 'corrections begin with "My turn" — never begin any other sentence with those words. Judge '
            + 'honestly from the audio and do not praise to be kind. The application decides which story comes '
            + 'next; never introduce one yourself and never announce progress.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [ST_ITEM] carries the greeting, how the game works, the whole first story and its '
            + 'question inside one quoted line. Speak it and stop. Do not greet the child separately, do not '
            + 'explain the activity in your own words, and do not add a warm-up question — the quoted line is '
            + 'the whole opening. Read the story slowly and expressively, with character voices; it is the '
            + 'only thing the child has to work from.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER',
          instruction:
            'Every answer here is SPOKEN and every answer is one short word, and the [ST_ITEM] message names '
            + 'the word that is correct. The word alone, or inside a little phrase ("the squirrel", "because '
            + 'of the rain"), is the answer. A fair word for the same idea is the answer too — unhappy for '
            + 'sad, afraid for scared — and you affirm it while echoing the story\'s own word. What is not an '
            + 'answer: a different thing from the story, an event given where a feeling or a cause was asked '
            + 'for, or the question said back to you. There is nothing on screen for the child to choose from '
            + 'and nothing for them to tap, so never suggest picking, pointing, or showing you anything.',
        },
        {
          title: 'THE STORY IS THE MATERIAL — NEVER THE ANSWER SERVICE',
          instruction:
            'You read the story exactly as written. For a who, what, where or why question the answer word is '
            + 'inside that story, and hearing it there is precisely the task — so reading the story is never a '
            + 'leak. What you must never do is single that word out, say it on its own, tell the child which '
            + 'part of the story holds it, stress it as you read, or answer for them. For a feeling question '
            + 'the story never names the feeling at all, and neither do you until you have given a verdict.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP. Do not re-ask, do not fill the pause, do not offer a clue, and do not repeat '
            + 'part of the story to nudge them. A long pause is a five-year-old replaying a whole story in '
            + 'their head, and that work IS the activity. Think time is unbounded and the application, not the '
            + 'clock, decides when to move on.',
        },
        {
          title: 'HEAR IT AGAIN ON DEMAND',
          instruction:
            'When you receive [ST_HEAR], the child asked to hear the story again. Say ONLY the quoted line — '
            + 'the whole story once more, then the question — warmly and slowly, then go back to waiting. Add '
            + 'nothing, judge nothing you just heard, and never let the repeat carry more help than the first '
            + 'telling did: no extra stress on any word, no shortened version, no clue about which part '
            + 'matters. This channel is answered at every grade and every support tier.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'word-flip',
    description:
      'Spoken word-transformation practice with a live tutor. GRAMMAR / oral language for K-2 '
      + '(plural nouns and past-tense verbs) — NOT a phonics or decoding primitive (never select for CVC-decoding, letter-sound, '
      + 'blending, or spelling objectives; route those to cvc-speller / word-workout / phonics-blender). A '
      + 'before/after frame shows either one→many ("dog → dogs") or today→yesterday ("jump → jumped"); the tutor '
      + 'asks for the changed word, waits, and the child SAYS THE CHANGED WORD ALOUD. The tutor '
      + 'judges the answer from the audio, and the lesson moves on once it is credited. The one-thing word is on '
      + 'screen and tappable to hear; there are no answer chips and nothing to click to advance. Requires a '
      + 'microphone. Teaches regular and irregular noun plurals plus regular -ed and common irregular past forms. '
      + 'ESSENTIAL for early-elementary Language Arts grammar. One mode is the exception: in build_inflect (open build, '
      + 'grades 1-2) the learner taps a base-word card and an ending card (s, es, ies, ed) to MAKE a word that means more '
      + 'than one or that tells it already happened, and many words can pass.',
    constraints:
      'GRAMMAR objectives only (plural nouns or past-tense verbs). Do NOT route decoding/CVC/phonics/spelling objectives here — the pool is chosen for honest morphology, not decodability. Modes cover regular -s, regular -es, consonant-y → -ies, common irregular plurals, add-only -ed verbs, and code-owned irregular past forms. The -ies and past modes are Grade 1-2 extensions; keep K objectives on -s/-es and familiar irregular plurals. Every noun or action must be concrete and picturable. The manifest must NOT supply per-challenge words — the generator authors typed candidates and code validates and derives every answer deterministically. Spoken answers require the live tutor and a microphone.',
    // reader: 'none' — READY @ PRE (word-flip is the reader-fit skill's own PRE
    // reference model for a voice-first counted-picture frame), tap chips since
    // removed entirely by the 2026-08-09 DI port
    // (qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md).
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken'], role: 'apply', minutes: 4 },
    ...bossEntry(wordFlipCard),
    evalModes: [
      {
        evalMode: 'build_inflect',
        affordances: { answers: ['build'] },
        label: 'Make a Word with an Ending (open build)',
        beta: 3.6,
        discrimination: 1.6,
        scaffoldingMode: 3,
        challengeTypes: ['build_inflect'],
        description:
          'Open build: tap a base-word card and an ending card (s, es, ies, ed) into a row to MAKE a word that means more '
          + 'than one or that tells it already happened, then press done; every second item asks for a second, different word. '
          + 'Many words pass (cats, boxes, babies). The learner chooses the spelling change (ies for a word ending in a '
          + 'consonant and y; the card takes the place of the y); no doubled consonant is asked. Code checks the ending '
          + 'against the ask and the base, the shared literacy judge reads the made word. Grades 1-2. '
          + 'β = past_ed + 0.1: the board mixes the -es, y to -ies and -ed choices.',
      },
      {
        evalMode: 'plural_s',
        label: 'Add -s (Tier 1)',
        beta: 1.5,
        discrimination: 1.6,
        scaffoldingMode: 1,
        challengeTypes: ['plural_s'],
        description:
          'Produce regular plurals formed by adding only -s to a familiar pictured noun (dog → dogs).',
      },
      {
        evalMode: 'plural_es',
        label: 'Add -es (Tier 3)',
        beta: 3.0,
        discrimination: 1.6,
        scaffoldingMode: 3,
        challengeTypes: ['plural_es'],
        description:
          'Produce regular plurals for nouns ending in s, x, ch, or sh by adding -es (bus → buses; dish → dishes).',
      },
      {
        evalMode: 'past_ed',
        label: 'Add -ed (Tier 3)',
        beta: 3.5,
        discrimination: 1.6,
        scaffoldingMode: 3,
        challengeTypes: ['past_ed'],
        description:
          'Produce the past form of familiar action words by adding only -ed (jump → jumped; walk → walked).',
      },
      {
        evalMode: 'plural_y',
        label: 'Change -y to -ies (Tier 4)',
        beta: 4.0,
        discrimination: 1.6,
        scaffoldingMode: 4,
        challengeTypes: ['plural_y'],
        description:
          'Produce plurals of consonant-y nouns by changing y to -ies (baby → babies; puppy → puppies).',
      },
      {
        evalMode: 'irregulars',
        label: 'Irregular Plurals (Tier 4)',
        beta: 5.0,
        discrimination: 1.6,
        scaffoldingMode: 4,
        challengeTypes: ['irregulars'],
        description:
          'Recall and produce common irregular plural forms that cannot be made by appending -s or -es (mouse → mice).',
      },
      {
        evalMode: 'past_irregular',
        label: 'Irregular Past (Tier 5)',
        beta: 5.5,
        discrimination: 1.6,
        scaffoldingMode: 5,
        challengeTypes: ['past_irregular'],
        description:
          'Recall and produce common irregular past forms that cannot be made by appending -ed (run → ran; go → went).',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'character-web',
    description: 'Interactive node-and-edge graph for character analysis and relationship mapping. Students build character profiles with traits and text evidence citations, then map relationships between characters. Tracks character change over time. Perfect for literary analysis grades 2-6.',
    constraints: 'Requires narrative text with 2+ characters. Best for grades 2-6.',
    affordances: { representation: 'symbolic', answers: ['type', 'tap'], role: 'apply', minutes: 8 },
    evalModes: [
      { evalMode: 'trait_id', label: 'Identify Traits (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['trait_id'], description: 'Name single-word traits a character shows through what they do and say.' },
      { evalMode: 'trait_evidence', label: 'Trait Evidence (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['trait_evidence'], description: 'Support each trait claim with a specific quote or paraphrase from the text.' },
      { evalMode: 'relationship_map', label: 'Relationship Map (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['relationship_map'], description: 'Analyze how character relationships drive the plot.' },
      { evalMode: 'character_change', label: 'Character Change (Tier 5)', beta: 4.5, scaffoldingMode: 5, challengeTypes: ['character_change'], description: 'Analyze a dynamic character\'s development and the cause behind it.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'poetry-lab',
    description: 'Audio-first and text-based poetry lab for grades K-6. At K-1, the tutor reads nursery-style poems aloud and students tap the two pictured ending words that rhyme, with no reading required. Analysis mode examines rhyme scheme, mood, and figurative language in grades 2-6. Composition mode supports structured poetry writing in grades 3-6.',
    constraints: 'rhyme_hunt: grades K-1 (audio-first, no reading required; the tutor reads each poem aloud and the child taps two pictured ending words). Analysis: grades 2-6 (poem reading, mood vocabulary, figurative language, rhyme notation). Composition: grades 3-6 (typed free-text writing). The manifest must not supply poem text, candidate words, answers, or templates; the generator authors mode-specific content.',
    // reader: 'none' on rhyme_hunt only — READY @ PRE for that mode specifically
    // (qa/reader-fit/poetry-lab-PRE-2026-07-14.md recovery re-audit, 8/8). analysis
    // and composition remain untested at their own 2-6/3-6 bands.
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'type'], role: 'apply', minutes: 6 },
    evalModes: [
      { evalMode: 'rhyme_hunt', affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] }, label: 'Rhyme Hunt (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['rhyme_hunt'], description: 'Hear a short poem read aloud, then tap the pair of words that rhyme.' },
      { evalMode: 'analysis', affordances: { representation: 'symbolic', answers: ['tap'] }, label: 'Analysis (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['analysis'], description: 'Identify poetic elements in given poem.' },
      { evalMode: 'composition', affordances: { representation: 'symbolic', answers: ['type'] }, label: 'Composition (Tier 5)', beta: 6.0, scaffoldingMode: 5, challengeTypes: ['composition'], description: 'Compose poem using template structure.' },
    ],
    // W1 (C22, `poetryLabWorkspace.ts`): every item is checked by the activity's own code. The scripted fallback still
    // reads the `tutoring` block below.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'The activity checks every answer itself, and you are not told the answers. Rhyme hunt (Kindergarten and '
        + 'Grade 1): read the poem aloud slowly, every line ending alike, and read the word cards; the learner taps the two '
        + 'cards that rhyme. Never say which two rhyme, never say two of the endings together, and never say a word that '
        + 'rhymes with one of them. After a wrong pair you may stretch the two words they tapped and ask whether the ends '
        + 'sound the same. Analysis, one step at a time: the learner picks the mood, taps a word of each figurative phrase '
        + '(every word is a button; a word in no figurative phrase makes it wrong), and picks the rhyme scheme. Never say '
        + 'the mood or a word that means it, never narrow the moods to the right one, never say which words are figurative, which lines rhyme or the scheme\'s letters; ask which words make them feel '
        + 'that way, whether a phrase means exactly what it says, and which last words sound alike. Composition: the '
        + 'learner types each line, then checks; the activity checks the form only (every line written, no line repeated, '
        + 'acrostic letters, syllables within one of the target). Never write a line or a word for them; ask what they '
        + 'picture, and help them clap the syllables of their own line. You may read the poem and the choices aloud. You '
        + 'cannot tap, pick or type for the learner.',
      // rhyme_model, fewer_cards; mood_faces, easier_mood, figure_models, phrase_count, easier_figures, end_words,
      // easier_scheme; model_poem, syllable_beats, first_letters, one_line (`poetryLabLevers.ts`). Every miss answered.
      levers: true,
      misses: missLists<PoetryMiss>({
        rhyme_hunt: ['same_start', 'one_of_pair', 'neither_of_pair'],
        analysis: ['other_mood', 'literal_picked', 'missed_some', 'aabb_abab', 'other_scheme'],
        composition: ['line_missing', 'line_too_short', 'line_repeated', 'wrong_first_letter', 'syllables_off'],
      }),
    },
    tutoring: {
      taskDescription:
        'You are the rhyme and poetry coach for "{{title}}" at Grade {{gradeLevel}}. '
        + 'Mode: {{mode}}. In rhyme_hunt, this is round {{currentRound}} of {{roundsTotal}}. '
        + 'The poem for this round is: {{roundPoem}}. The candidate ending words are {{candidateWords}}. '
        + 'The rhyming pair is {{rhymeWordA}}/{{rhymeWordB}} — this is the answer the student must discover by EAR. '
        + 'Never name the pair outright; stretch word endings so the student hears the relationship. '
        + 'Attempts: {{attempts}}. First-try correct so far: {{firstTryCorrect}}.',
      contextKeys: [
        'title', 'gradeLevel', 'mode', 'currentRound', 'roundsTotal', 'roundPoem',
        'candidateWords', 'rhymeWordA', 'rhymeWordB', 'attempts', 'firstTryCorrect',
      ],
      scaffoldingLevels: {
        level1: 'Ask the student to listen again for the sounds at the very ends of the lines. Do not name either answer word.',
        level2: 'Slowly stretch the endings of the two words the student tapped and ask whether those ending sounds match. Do not offer a replacement word.',
        level3: 'Re-read the four line endings with equal emphasis, then invite the student to compare two choices at a time. Never say which pair is correct.',
      },
      commonStruggles: [
        { pattern: 'The student taps words that share a beginning sound', response: 'Contrast beginning and ending sounds, then re-read the tapped words with their endings stretched.' },
        { pattern: 'The student misses the same round more than once', response: 'Re-read the stanza slowly and isolate all four line endings without grouping or naming the answer pair.' },
        { pattern: 'The student waits without choosing', response: 'Repeat the tap-two protocol in ear terms and encourage one exploratory pair without narrowing the choices.' },
      ],
      aiDirectives: [
        {
          title: 'ORIENT',
          instruction: 'On [ACTIVITY_START], greet once and frame the activity: "We\'re going to listen to a little poem and find the two words that rhyme."',
        },
        {
          title: 'STIMULUS',
          instruction: 'On [ACTIVITY_START] or [ROUND_START] in rhyme_hunt, read {{roundPoem}} aloud slowly with playful prosody, emphasizing every line-ending word equally. Do not group, repeat, or name {{rhymeWordA}} and {{rhymeWordB}} as a pair. In analysis mode, offer to read the poem aloud on request.',
        },
        {
          title: 'DISAMBIGUATE',
          instruction: 'For rhyme_hunt, explain once that rhyming words sound the same at the end, using an unrelated example such as cat/hat, then say: "Tap the two words that rhyme." For analysis, enact rhyme notation in sound terms before using letters such as AABB.',
        },
        {
          title: 'RECOVER',
          instruction: 'On [RHYME_MISS], stretch only the two words the student tapped and ask whether their endings match. Never name, contrast with, or hint {{rhymeWordA}}/{{rhymeWordB}}.',
        },
        {
          title: 'QUIET CELEBRATION',
          instruction: 'On [RHYME_CORRECT], celebrate only for the first round, a comeback, or the final round. On [ACTIVITY_COMPLETE], close in one short sentence. Never repeat the answer pair.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'genre-explorer',
    description:
      'LIVE-JUDGED SPOKEN genre classification (Direct Instruction). The student meets two or three short '
      + 'texts and ANSWERS OUT LOUD three ways: saying yes or no to what is actually in a text ("does this one '
      + 'have animals that talk?"), saying which of two texts something is true of, and NAMING what kind of '
      + 'writing each text is from a printed menu (fiction/nonfiction, fable, myth, biography, informational, '
      + 'poem…). The tutor judges each spoken answer and teaches after a miss; a credited answer moves the '
      + 'lesson on. Nothing is tapped, checked or dragged. REQUIRES A MICROPHONE. Perfect for grades 1-6 genre '
      + 'study; at grades 1-2 the tutor reads each text aloud to the child.',
    constraints:
      'REQUIRES A MICROPHONE — every answer is spoken; there is no checkbox, tap or button path. '
      + 'Best for grades 1-6. Needs two or three SHORT texts of different genres (a single text gives one '
      + 'genre question and one is not a measurement). No text may contain the name of a kind of writing — an '
      + 'excerpt saying "this fable" hands over the answer the moment it is read, and is dropped. Feature rows '
      + 'must be base-verb phrases that complete "Does this one ___?" ("have animals that talk"), not headings. '
      + 'At grades 1-2 each text must be 2-3 short sentences, because the tutor reads it aloud and repeats it '
      + 'in a correction.',
    // No reader-fit verdict on file for this primitive: reader omitted rather than guessed.
    affordances: { representation: 'symbolic', answers: ['spoken'], role: 'apply', minutes: 5 },
    // Every step is spoken, zero taps: a yes/no about a text, a genre name and "which of these two" are all said
    // across a table. The texts and the printed genre menu stay; the tutor reads the text at grades 1-2, which is safe
    // because the answer is a category name no text contains. Wiring: `genreExplorer.card.ts` + `genreExplorer.boss.ts`.
    ...bossEntry(genreExplorerCard),
    evalModes: [
      // βs UNCHANGED, and that is the word-sorter rule rather than an oversight:
      // the genre menu is still printed and still named aloud at most tiers, so
      // the answer set did not change size — only the response channel moved from
      // recognition to production. What DID change is the number of asks per
      // session (one excerpt became two or three), and that is a reliability
      // change, not a difficulty one.
      { evalMode: 'identify_basic', label: 'Fiction vs Nonfiction (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['identify_basic'], description: 'SAY yes or no about what is in each text, then SAY whether it is Fiction or Nonfiction. Two or three texts per sitting — a binary answered once is a coin flip, answered three times it is not.' },
      { evalMode: 'classify_genre', label: 'Classify Genre (Tier 3)', beta: 3.0, scaffoldingMode: 3, challengeTypes: ['classify_genre'], description: 'SAY yes or no about what is in each text, then NAME its genre aloud from the printed menu (fable, myth, folktale, biography, informational, poem).' },
      { evalMode: 'compare_genres', label: 'Compare Genres (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['compare_genres'], description: 'Two texts on one topic: SAY which of the two each distinguishing feature belongs to, then NAME both genres aloud. Only a feature true of exactly ONE text is asked.' },
    ],
    supportsEvaluation: true,
  },

  // ===== READING: INFORMATIONAL TEXT (RI) =====
  {
    id: 'text-structure-analyzer',
    description:
      'LIVE-JUDGED SPOKEN informational text structure analysis (Direct Instruction). The student READS a printed '
      + 'passage and ANSWERS OUT LOUD three ways: naming the linking word in a sentence the tutor points them at, '
      + 'naming how the whole passage is organised (cause-effect, compare-contrast, problem-solution, time order or '
      + 'description) from a printed menu, and naming which part of a chart each key idea belongs in. The tutor judges '
      + 'each spoken answer and teaches after a miss; a credited answer moves the lesson on. Nothing is tapped, '
      + 'highlighted or dragged. REQUIRES A MICROPHONE. ESSENTIAL for grades 2-6 informational reading.',
    constraints:
      'REQUIRES A MICROPHONE — every answer is spoken; there is no tap, highlight, drag or button path. '
      + 'Best for grades 2-6 (the student reads the passage themselves; the tutor never reads it aloud). Requires '
      + 'informational text with ONE clear organizational structure and AT MOST ONE connecting word per sentence — a '
      + 'sentence carrying two of them has two right answers and its question is dropped. Chart regions must be one or '
      + 'two plain words a child can say back and tell apart by ear (never "Item A" / "Item B"), and a key idea may '
      + 'never contain the name of the region it belongs to.',
    // No reader-fit verdict on file for this primitive: reader omitted rather than guessed.
    affordances: { representation: 'symbolic', answers: ['spoken'], role: 'apply', minutes: 5 },
    // Every step is spoken, zero taps: a linking word, a structure name and a chart part are all said across a table.
    // The passage, the printed structure menu and the labelled parts stay; the tutor never reads the passage, because
    // reading it is the skill and a linking word is a word in it. Wiring: `textStructureAnalyzer.card.ts` +
    // `textStructureAnalyzer.boss.ts`.
    ...bossEntry(textStructureAnalyzerCard),
    evalModes: [
      // β RAISED 0.5 ACROSS THE BOARD, and only because the STRUCTURE changed at
      // the first step. The click era rendered the signal words as the only
      // clickable spans in the passage — the answer set was visually delimited,
      // so a child could click every marked span and score full marks on that
      // phase with no knowledge at all, and at `easy` they arrived
      // pre-highlighted. That is now unaided spoken PRODUCTION of a word from a
      // sentence. (The Identify step's β would NOT have moved on its own:
      // word-sorter's rule — the menu is still printed and still named aloud, so
      // the answer set did not change size and only the response channel moved.)
      { evalMode: 'chronological_description', label: 'Chronological/Description (Tier 1)', beta: 2.5, scaffoldingMode: 1, challengeTypes: ['chronological', 'description'], description: 'SAY the linking word, then SAY whether the passage is Time Order or Description, then SAY where each idea goes. Spoken production; nothing is tapped.' },
      { evalMode: 'cause_effect', label: 'Cause-Effect (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['cause-effect'], description: 'SAY the linking word (because, so, as a result), then NAME the cause-effect structure aloud, then SAY whether each idea is a Cause or an Effect.' },
      { evalMode: 'compare_contrast', label: 'Compare-Contrast (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['compare-contrast'], description: 'SAY the linking word (however, similarly, unlike), then NAME the compare-contrast structure aloud, then SAY which side of the chart each idea belongs on.' },
      { evalMode: 'problem_solution', label: 'Problem-Solution (Tier 3)', beta: 4.0, scaffoldingMode: 3, challengeTypes: ['problem-solution'], description: 'SAY the linking word, then NAME the problem-solution structure aloud — the hardest discrimination in the set, since cause-effect also means "this leads to that" — then SAY whether each idea is the Problem or a Solution.' },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'evidence-finder',
    description: 'Students find and highlight specific text evidence supporting claims in informational passages. Supports multiple claims, evidence strength ranking, and Claim-Evidence-Reasoning (CER) framework. Multi-color highlighting. Perfect for grades 2-6 evidence-based reading.',
    constraints: 'Best for grades 2-6. Requires informational passage with identifiable evidence.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: 'apply', minutes: 5 },
    evalModes: [
      { evalMode: 'locate_evidence', label: 'Locate Evidence (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['locate_evidence'], description: 'Find explicit, directly-stated evidence for one claim.' },
      { evalMode: 'match_evidence_to_claim', label: 'Match Evidence to Claim (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['match_evidence_to_claim'], description: 'Assign each evidence sentence to the correct of two claims.' },
      { evalMode: 'evaluate_evidence_strength', label: 'Evaluate Evidence Strength (Tier 4)', beta: 4.5, scaffoldingMode: 4, challengeTypes: ['evaluate_evidence_strength'], description: 'Rate evidence strength and justify it (CER framework).' },
    ],
    supportsEvaluation: true,
    // W1 C21 (`evidenceFinderWorkspace.ts`): find is checked on every mode, the strength rating on CER passages.
    // The CER reasoning box is open writing with no check and stays on the scripted path (contract G1).
    teachingWorkspace: {
      grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'The activity checks every answer itself, and you are not told the answers. The learner reads a short '
        + 'informational passage and highlights every sentence that is evidence for the claim: they tap a sentence to '
        + 'highlight it (with two claims, they first tap the claim it supports), then press Check Evidence. Evidence '
        + 'states a fact that proves the claim; a sentence that is only about the topic, or is someone\'s opinion, is '
        + 'not evidence. On a passage with strength ratings they then rate each evidence sentence Strong, Moderate or '
        + 'Weak and check: strong evidence gives a specific fact that proves the claim, weak evidence only mentions the '
        + 'idea. Never say which sentences are evidence, which claim one supports, or how strong one is, before a check '
        + 'or after a wrong one. Teaching is asking about the claim: what would prove it, does this sentence prove it '
        + 'or only talk about the topic, is it a fact or an opinion. You may read the passage, the claims and the '
        + 'sentences aloud. You cannot highlight or rate for the learner.',
      // The activity's own check (`evidenceFinderMiss`); `wrong_claim` needs two claims, the ratings a CER passage.
      misses: missLists<EvidenceFinderMiss>({
        locate_evidence: ['not_evidence', 'missed_evidence'],
        match_evidence_to_claim: ['not_evidence', 'wrong_claim', 'missed_evidence'],
        evaluate_evidence_strength: ['not_evidence', 'wrong_claim', 'missed_evidence',
          'weak_as_strong', 'rated_too_strong', 'rated_too_weak', 'mixed_ratings'],
      }),
      // evidence_count, proof_example, practice_passage (find); strength_guide, practice_ratings (rate)
      // (`evidenceFinderLevers.ts`); every miss answered on every mode.
      levers: true,
    },
    tutoring: {
      taskDescription: 'Find textual evidence for claims. Claim: {{currentClaim}}.',
      contextKeys: ['currentClaim'],
      scaffoldingLevels: {
        level1: 'What part of the text talks about this idea?',
        level2: 'Look for sentences with words like [keywords].',
        level3: 'The evidence is in paragraph X. Highlight the sentence that proves the claim.',
      },
      commonStruggles: [
        { pattern: 'Opinion vs evidence', response: 'Did the author say that, or is it your idea?' },
        { pattern: 'Weak evidence', response: 'Does this PROVE the claim or just mention it?' },
        { pattern: 'Wrong section', response: 'Direct to correct paragraph' },
      ],
    },
  },

  // ===== WRITING (W) =====
  {
    id: 'paragraph-architect',
    description: 'Scaffolded paragraph construction using hamburger model (topic sentence -> details -> conclusion). Supports informational, narrative, and opinion paragraph types. Sentence-starter frames, linking word guidance, TTS read-back. ESSENTIAL for grades 1-6 writing instruction.',
    constraints: 'Best for grades 1-6. Select paragraph type appropriate to grade level.',
    affordances: { representation: 'symbolic', answers: ['type', 'tap'], role: 'apply', minutes: 9 },
    evalModes: [
      { evalMode: 'informational', label: 'Informational (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['informational'], description: 'Structured informational paragraph.' },
      { evalMode: 'narrative', label: 'Narrative (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['narrative'], description: 'Narrative paragraph with elements.' },
      { evalMode: 'opinion', label: 'Opinion (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['opinion'], description: 'Opinion with claim + support.' },
      {
        evalMode: 'build_paragraph',
        affordances: { answers: ['build'] },
        label: 'Build a Paragraph (open build)',
        beta: 2.6,
        scaffoldingMode: 2,
        challengeTypes: ['build_paragraph'],
        description: 'Open build, on the live tutor: tap sentence cards into a paragraph in order: the topic sentence first, '
          + 'two or more facts that belong (any order), the closing last, leaving out the two facts about a different topic. '
          + 'Many paragraphs pass. Checked in code from the cards\' roles. Organization only; the writing modes judge no '
          + 'sentence. Beta = informational + 0.1.',
      },
    ],
    supportsEvaluation: true,
    // Every mode is on the teaching workspace (R12, user ruling 2026-10-08): the writing modes write one sentence per
    // step (`writingStages.ts`), build_paragraph orders cards (`paragraphBuild.ts`).
    teachingWorkspace: {
      grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'On the writing modes the learner writes a paragraph one sentence per step (the topic sentence, a fact, '
        + 'another fact, the closing; or a story\'s beginning, middle and end; or an opinion, two reasons, the opinion '
        + 'again), typing each and pressing "I am done"; the builder checks each sentence makes sense and does its '
        + 'step\'s job, and spelling is not judged. Never write or say a sentence for them; ask what they want to say '
        + 'and let them type it. Build a paragraph: sentence cards are on screen and the learner taps them into a paragraph in order, then '
        + 'presses "I am done". A paragraph passes with the sentence that tells the topic first, two or more facts that '
        + 'belong in any order, and the sentence that wraps it up last; the two facts about something else stay out. Many '
        + 'paragraphs pass. A card speaker asks you to read that card only. Never say which card goes first or last or '
        + 'which facts do not belong; ask what the paragraph is about and whether each fact tells about it. You cannot '
        + 'move a card.',
      levers: true,
      misses: { build_paragraph: ['topic_not_first', 'closing_not_last', 'too_few_details', 'off_topic_detail'],
        ...Object.fromEntries(['informational', 'narrative', 'opinion'].map(m => [m, ['too_short', 'blank_left', 'repeat',
          'not_sense', 'wrong_job']])) },
      // blank_left and repeat need no lever: the box keeps the sentence and the words say what to change.
      unanswered: Object.fromEntries(['informational', 'narrative', 'opinion'].map(m => [m, ['blank_left', 'repeat']])),
    },
    // tutoring removed 2026-10-08 (R12): every mode is workspace-only, and bound sessions send `tutoring: null`.

  },
  {
    id: 'story-planner',
    description: 'Pre-writing planning tool for narrative writing. Students fill structured cards: characters, setting, conflict, key events, resolution, theme. Generates visual story arc from inputs. AI-generated character/setting illustrations. Connects to story-map for read-to-write cycle. Perfect for K-6 narrative writing.',
    constraints: 'Best for K-6. Focus complexity on grade level.',
    // reader: 'none' on story_structure only — READY @ PRE for that mode
    // (qa/reader-fit/story-planner-PRE-2026-08-07.md, 8/8): K-3 picks pictures and
    // taps events into order, no reading required. character_setting/
    // conflict_resolution/theme_craft are grade 2-6 typed-card identities, untested.
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 9 },
    evalModes: [
      { evalMode: 'story_structure', affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'] }, label: 'Story Structure (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['story_structure'], description: 'Sequence the narrative arc: beginning-middle-end.' },
      { evalMode: 'character_setting', label: 'Character & Setting (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['character_setting'], description: 'Develop a believable character and a vivid setting.' },
      { evalMode: 'conflict_resolution', label: 'Conflict & Resolution (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['conflict_resolution'], description: 'Plan a central conflict and a connected resolution.' },
      { evalMode: 'theme_craft', label: 'Theme & Craft (Tier 5)', beta: 5.0, scaffoldingMode: 5, challengeTypes: ['theme_craft'], description: 'Weave theme, dialogue, and craft into the plan.' },
    ],
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'At K-1 the learner cannot read: read the story idea, each question and every picture\'s words aloud; '
        + 'one tap picks a picture (every picture is a fine choice) and moves on. Then they tap the story\'s event '
        + 'pictures into numbered slots and press "I am done"; describe the pictures when asked, but never say which '
        + 'comes first or which cannot (ruling one out tells the order). At grade 2 and up the learner types each planning card and presses "I am done"; the builder '
        + 'checks it answers the card\'s question for this story and makes sense, and spelling is not judged. Any idea '
        + 'that fits passes. Never write a card for them. You cannot tap or type.',
      levers: true,
      // Only story_structure orders events (the K-1 picture band); every mode writes cards at grade 2+.
      misses: Object.fromEntries(['story_structure', 'character_setting', 'conflict_resolution', 'theme_craft']
        .map(m => [m, ['too_short', 'repeat', 'not_sense', 'wrong_job', ...(m === 'story_structure' ? ['wrong_order'] : [])]])),
      // repeat needs no lever: the words say to write something new.
      unanswered: Object.fromEntries(['story_structure', 'character_setting', 'conflict_resolution', 'theme_craft'].map(m => [m, ['repeat']])),
    },
  },
  {
    id: 'opinion-builder',
    description: 'Structured scaffold for opinion/argumentative writing. Uses OREO model (grades 2-4) transitioning to CER framework (grades 5-6). Students construct arguments piece by piece with validation. Counter-argument support at grades 5-6. TTS read-back. ESSENTIAL for persuasive writing grades 2-6.',
    constraints: 'Best for grades 2-4 (OREO), grades 5-6 (CER).',
    affordances: { representation: 'symbolic', answers: ['type'], role: 'apply', minutes: 8 },
    evalModes: [
      { evalMode: 'oreo', label: 'OREO (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['oreo'], description: 'Opinion-Reason-Example-Opinion (grades 2-4).' },
      { evalMode: 'cer', label: 'CER (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['cer'], description: 'Claim-Evidence-Reasoning (grades 5-6).' },
      {
        evalMode: 'build_opinion',
        affordances: { answers: ['build'] },
        label: 'Build an Opinion (open build)',
        beta: 3.1,
        scaffoldingMode: 2,
        challengeTypes: ['build_opinion'],
        description: 'Open build, on the live tutor: for a yes/no question, tap cards into an OREO answer for EITHER side: '
          + 'the opinion first, a reason and an example for that side, the opinion again last. Cards for the other side '
          + 'and an off-topic card are mixed in. Many answers pass. Checked in code from the cards\' roles and sides. '
          + 'Beta = oreo + 0.1.',
      },
    ],
    supportsEvaluation: true,
    // Every mode is on the teaching workspace (OB-7L, following R12): OREO and CER write one sentence per step
    // (`writingStages.ts`), build_opinion orders cards (`opinionBuild.ts`).
    teachingWorkspace: {
      grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'On OREO and CER the learner writes an answer to the question one sentence per step (opinion, reason, '
        + 'example, opinion again; or claim, evidence, reasoning, conclusion), typing each and pressing "I am done"; the '
        + 'builder checks each sentence makes sense and does its step\'s job, and spelling is not judged. Either side of '
        + 'the question is fine. Never write a sentence for them or pick their side. On build an opinion the learner taps '
        + 'cards for one side into an answer in order and presses "I am done"; never say which cards go together or which '
        + 'side to take. You cannot type or move a card.',
      levers: true,
      misses: { ...Object.fromEntries(['oreo', 'cer'].map(m => [m, ['too_short', 'blank_left', 'repeat', 'not_sense', 'wrong_job']])),
        build_opinion: ['opinion_not_first', 'restate_not_last', 'no_reason', 'no_example', 'other_side', 'off_topic', 'out_of_order'] },
      // blank_left and repeat need no lever: the box keeps the sentence and the words say what to change.
      unanswered: Object.fromEntries(['oreo', 'cer'].map(m => [m, ['blank_left', 'repeat']])),
    },
  },
  {
    id: 'revision-workshop',
    description: 'Students apply specific revision strategies to draft passages: adding details, strengthening word choice, combining sentences, fixing run-ons, improving transitions, reorganizing. Before/after comparison with TTS read-aloud. Perfect for grades 2-6 revision skills.',
    constraints: 'Best for grades 2-6. Focus on one revision skill at a time.',
    affordances: { representation: 'symbolic', answers: ['type', 'manipulate'], role: 'apply', minutes: 9 },
    evalModes: [
      { evalMode: 'add_details', label: 'Add Details (Tier 1)', beta: 2.0, scaffoldingMode: 1, challengeTypes: ['add-details'], description: 'Expand with sensory/specific details.' },
      { evalMode: 'word_choice', label: 'Word Choice (Tier 2)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['word-choice'], description: 'Replace weak/vague words.' },
      { evalMode: 'combine_sentences', label: 'Combine Sentences (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['combine-sentences'], description: 'Combine choppy sentences.' },
      { evalMode: 'transitions', label: 'Transitions (Tier 3)', beta: 4.5, scaffoldingMode: 3, challengeTypes: ['transitions'], description: 'Add/improve transition words.' },
      { evalMode: 'reorganize', affordances: { answers: ['manipulate'] }, label: 'Reorganize (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['reorganize'], description: 'Reorder for logical flow.' },
      { evalMode: 'concision', label: 'Concision (Tier 5)', beta: 6.5, scaffoldingMode: 5, challengeTypes: ['concision'], description: 'Eliminate wordiness.' },
    ],
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'The draft is on screen with one sentence marked. The learner types a revision of that sentence and presses '
        + '"I am done"; the builder checks it changed and does the job of this revision (add a detail, a stronger word, one '
        + 'joined sentence, a transition, fewer words), and spelling is not judged. Many revisions pass. Never say a revised '
        + 'sentence for them. On reorganize the learner taps the sentences of the draft into the order that makes sense; never '
        + 'say which sentence goes first. You cannot type or move a sentence.',
      levers: true,
      misses: { ...Object.fromEntries(['add_details', 'word_choice', 'transitions'].map(m => [m, ['unchanged', 'too_short', 'not_sense', 'wrong_job']])),
        combine_sentences: ['unchanged', 'too_short', 'not_combined', 'not_sense', 'wrong_job'],
        concision: ['unchanged', 'too_short', 'not_shorter', 'not_sense', 'wrong_job'],
        reorganize: ['wrong_order'] },
    },
  },

  // ===== SPEAKING & LISTENING (SL) =====
  {
    id: 'reading-repair-studio',
    description: 'Grade 2 language arts reading foundations: self-correction and monitoring reading fluency. Students identify and correct their own word recognition errors using sentence context clues, checking the printed letters and rereading accurately. Read unfamiliar sentences before any model, replay their own recording, mark words to revisit, and reread. Distinguishes accurate first reading, independent repair, repair after support, and unresolved or uncertain readings.',
    constraints: 'Core task notice_and_repair only. Generates three fresh, complete 5-8 word sentences for grade 2. The manifest must not supply sentences or intentional reading errors. Microphone required for audio evidence; partner-reading fallback is unscored. Provisional local practice feedback only: no adaptive mastery updates until child-voice calibration. No prosody or speed assessment. No error location or model is disclosed before independent checking ends.',
    // L1 task routing is available before assessment calibration. This design
    // prior does not enable adaptive scoring; supportsEvaluation stays false.
    evalModes: [{
      evalMode: 'notice_and_repair', label: 'Notice and Repair (Practice)', beta: 4.5, scaffoldingMode: 4,
      challengeTypes: ['notice_and_repair'],
      description: 'Read a fresh sentence, compare your own reading with the print, mark words to revisit and reread. Distinguish accurate first reading, independent repair and repair after help. Provisional local evidence only; no mastery updates.',
    }],
    supportsEvaluation: false,
    tutoring: {
      taskDescription: 'Quiet Grade 2 reading-checking practice, {{challengeType}}. Sentence {{challengeNumber}} of {{totalChallenges}}. '
        + 'Current stage: {{stage}}; independent window open: {{independentWindowOpen}}; help recorded: {{supportRecorded}}; '
        + 'support level: {{supportLevel}}. Recordings: {{recordingsCount}}, replays: {{replayCount}}, words marked by the child: {{selectedWordCount}}. '
        + 'Assessment: {{assessmentStatus}}. Session complete: {{sessionComplete}}. These counts are actions, never proof of an error or repair. '
        + 'The application owns recording, verdicts and advancement. You are a checking-strategy coach, never this activity\'s speech judge.',
      contextKeys: ['challengeType', 'challengeNumber', 'totalChallenges', 'stage', 'independentWindowOpen',
        'supportRecorded', 'supportLevel', 'recordingsCount', 'replayCount', 'selectedWordCount', 'assessmentStatus', 'sessionComplete'],
      scaffoldingLevels: {
        level1: 'Only after requested help is recorded: Look at every letter. Does the word you said match?',
        level2: 'Only after requested help is recorded: Think about what the sentence means. Then check the letters, too. A word that makes sense still needs to match the print.',
        level3: 'Only after requested help is recorded: Listen to your recording. Follow the printed words. Tap a word you want to check, look at all its letters, and read the whole sentence again.',
      },
      commonStruggles: [
        { pattern: 'Child asks how to check the letters', response: 'When help is requested, remind them to look at every letter and compare with what they said. Do not identify a word for them.' },
        { pattern: 'Child says a different word is fine because it makes sense', response: 'Meaning helps, and the spoken word also needs to match the printed letters. Do not invent a miscue or quote the sentence.' },
        { pattern: 'Child asks how to use listening back or word marking', response: 'Explain how to replay their own recording, follow the print, and tap any word they want to revisit. Replaying or marking alone never proves correction.' },
        { pattern: 'Child reports the recording could not be checked', response: 'Explain that the audio check is unsure. They can try again or continue without a score. Do not diagnose a reading error.' },
      ],
      aiDirectives: [
        { title: 'QUIET INDEPENDENT CHECKING', instruction: 'Do not greet, introduce sentences, narrate context updates, react to marks or recordings, or speak on a new challenge. Remain silent during cold_read, recording and independent checking. No proactive hints. Missing state is not permission to speak. Never model, quote, complete or identify words in the printed sentence, even if raw lesson data includes it. Never infer miscue locations from counts.' },
        { title: 'REQUESTED READING HELP', instruction: 'On [READING_HELP], support has already been recorded by the application. Speak only the checking tip supplied in that message, once, without a greeting or extra question. The explicit request is authoritative if the debounced context is older. It does not authorize a model reading, an answer, a verdict, or advancement.' },
        { title: 'PROVISIONAL COMPLETION', instruction: 'On [ALL_COMPLETE], offer one brief encouragement for practicing careful checking, then stop. Never claim correct reading, independent repair, fluency, speed, or mastery. No accuracy or self-correction score is available to you. Optional reflection, help, replay and button taps are not evidence of correction.' },
      ],
    },
  },
  {
    id: 'read-aloud-studio',
    misconceptionScope: 'primitive',
    description:
      'Live-judged READ-ALOUD FLUENCY with a spoken Direct Instruction tutor. A short connected passage is '
      + 'split into single-breath lines and the child reads them ONE AT A TIME, out loud, into an open '
      + 'microphone; the tutor judges each read from the audio WORD BY WORD — a skipped, added or swapped word '
      + 'is corrected, not waved through — and a credited read moves the lesson to the next line. Three '
      + 'fluency identities: Read It (the child decodes the printed line COLD, with nothing spoken first), Phrase '
      + 'and Read (the child marks phrase breaks, reads once, hears a suggested grouping and rereads), and Character '
      + 'Voice (the tutor models one character\'s line in that character\'s voice and the child reads it back '
      + 'their way). Phrase planning is unscored page work; the activity commits the plan and the runtime owns progression. Requires '
      + 'a microphone. Perfect for grades 1-6 oral reading fluency.',
    constraints:
      'Best for grades 1-6. Requires the live tutor and a microphone. Judged lines are 3-8 words — the benched '
      + 'ceiling for reliable one-word-error detection — so the grade ladder rides on vocabulary, line count '
      + 'and Lexile, never on longer utterances. The passage must READ AS ONE CONNECTED TEXT across its lines; '
      + 'use di-sentence-reading instead for K-2 practice on ISOLATED decodable or sight-word sentences. '
      + 'The tutor judges WORDS, never how the reading sounded: prosody is taught by model-and-imitate and is '
      + 'not graded. Expression scores only word accuracy on the modeled reread; its first reading and phrase '
      + 'plan are separate practice evidence. Phrase groups are suggestions, not a unique correct answer. '
      + 'No comprehension questions — this primitive measures oral reading, not understanding.',
    // reader omitted, not 'none' — the child DECODES the printed line themselves
    // (accuracy mode is explicitly cold-read); the tutor models the line first
    // only in expression/dialogue mode, it never reads for the child. No
    // reader-fit verdict on file (qa/reader-fit/BACKLOG.md names this only as a
    // media-player rebuild boundary, not an audited entry).
    affordances: { representation: 'symbolic', answers: ['spoken'], role: 'apply', minutes: 5 },
    // ── DI MODALITY (2026-08-12) — ninth literacy port, consumer of
    // useJudgedScriptRunner. Before this, the primitive judged NOTHING: its
    // score was modelListened + recordingMade + selfAssessment + comparisonUsed
    // (four button presses) and "estimated WPM" was wall-clock duration divided
    // by the passage word count, computed whether or not the child said a word.
    // Every graded action passed the costume test — a child who cannot read
    // could tap Play, Start, Stop and "5 out of 5" for a full score.
    // THE PASSAGE IS NOW READ ONE LINE AT A TIME. A 120-word blob cannot be
    // judged (there is nothing to contrast against) and `sentence_read_aloud`
    // is benched at 3-8 words per utterance, so the passage arrives already
    // split and each line is one judged item. MIN/MAX_SENTENCE_WORDS are
    // IMPORTED from di-sentence-reading — the bench ceiling lives in one place.
    // PROSODY IS TAUGHT, NOT GRADED: no prosody response class exists, and a
    // judge asked "did that sound expressive?" rubber-stamps. expression and
    // dialogue model the delivery and grade the WORDS, and every contract on
    // those modes carries an explicit clause forbidding a sound-based refusal.
    // Cue lines, delivery notes, the cold-read guard and the judging contracts
    // live in `readAloudStudioScript.ts` (hand-authored, DISTAR); lines that
    // cannot be asked honestly (outside the word window, a sentence opening
    // with a verdict sentinel, dialogue with no speaker) are DROPPED at build.
    // SENTINEL DISCIPLINE (standing gate 2) re-checked on every line below: no
    // taskDescription, scaffolding level, struggle response or directive
    // sentence begins with "Yes" or with "My turn".
    audioInput: { manual_activity: true },
    evalModes: [
      // βs raised with the STRUCTURE (skill rule: only then). Every mode went
      // from an ungraded button press to unaided spoken production judged word
      // by word. `accuracy` is pinned to di-sentence-reading's `read_sentence`
      // (3.0) — the same act on the same benched utterance window — and the
      // other two keep their spacing above it.
      { evalMode: 'accuracy', label: 'Read It (Tier 2)', beta: 3.0, scaffoldingMode: 1, challengeTypes: ['accuracy'], description: 'Decode the printed line COLD and read it aloud, every word in order. Nothing speaks it first.' },
      { evalMode: 'expression', label: 'Phrase and Read (Tier 3)', beta: 4.5, scaffoldingMode: 3, challengeTypes: ['expression'], affordances: { answers: ['manipulate', 'spoken'] }, description: 'Mark phrase breaks, read the line, hear a suggested phrasing model, and reread. Planning and expression receive coaching; only modeled reread word accuracy is scored.' },
      { evalMode: 'dialogue', label: 'Character Voice (Tier 4)', beta: 5.5, scaffoldingMode: 4, challengeTypes: ['dialogue'], description: 'The tutor models one character\'s line in that character\'s voice; the child reads it back their way.' },
    ],
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'One printed line at a time, read aloud and judged word for word against the print. Read It is a cold read: '
        + 'never say the line or any word of it before the learner reads it. Character Voice: read the line in the '
        + 'character voice first, then the learner reads it back. Phrase and Read: the learner taps pause marks and '
        + 'commits a phrase plan (any plan is fine, it is not graded), reads the line once without a model, then you read '
        + 'the given groups and the learner rereads. A skipped, added or swapped word is wrong; a self-correction and slow '
        + 'sounding-out count. Never grade phrasing, voice or speed. You cannot tap the pause marks.',
      levers: true,
      // Spoken misses (`readAloudStudioLevers.ts`), emitted by `readAloudSpokenMisses`. `unanswered` stays the levers' own
      // list (`readAloudStudioLevers.test.ts` pins it). Expression's reads are answered (underline, dots, short line on
      // the reread; 2026-10-09), so it has no unanswered entry.
      misses: { accuracy: ['word_swap', 'word_drop'], expression: ['word_swap', 'word_drop'], dialogue: ['word_swap', 'word_drop', 'paraphrase'] },
      unanswered: { accuracy: ['word_swap', 'word_drop'], dialogue: ['word_swap', 'word_drop', 'paraphrase'] },
    },
    tutoring: {
      taskDescription:
        'Live-judged Direct Instruction read-aloud practice. A short passage is on the child\'s screen ONE LINE '
        + 'AT A TIME. Word accuracy is scored. Expression includes an unscored phrase plan, a first read, '
        + 'then a modeled reread; the current application cue owns the step and its response channel. Right now the mode is '
        + '"{{challengeType}}" and the line in front of them is "{{stimulus}}". You speak the exact scripted '
        + 'lines from each bracketed application message and nothing else, then you judge the audio you heard '
        + 'against the printed words. The application decides which line comes next; never introduce one '
        + 'yourself and never read ahead to a line the child has not reached.',
      // Trimmed 11 -> 2, to exactly what the component pushes through
      // updateContext (and that the connect-time primitive_data also carries).
      // There is nothing to WITHHOLD in the stimulus here — unlike the sibling
      // packs, the printed line is both the question and the target and it is
      // already on the child's screen. What must not happen is the tutor
      // SPEAKING an accuracy line early, and the per-item cold-read guard in
      // readAloudStudioScript forbids that on every cue that can reach it.
      contextKeys: ['challengeType', 'stimulus'],
      // Correction territory, not answer territory: every level describes what
      // happens AFTER an attempt. Re-modeling is the scripted correction's job,
      // and on an accuracy line NOTHING here may read the line — that is the
      // second channel the cold-read guard exists to close.
      // 18d, fixed OFF-QUEUE from port 8's census (the sweep's own rule: census
      // every DI catalog entry, not the queue — this entry is a shipped DI port
      // still waiting for its adapter, so the stall is live). Both rungs said
      // "say the instruction once more", which opens with neither sentinel: the
      // reducer records no verdict, the correction counter freezes, and the
      // child waits on a loop that cannot advance. GATE-COVERED, NOT DRIVEN —
      // 19h-i-b port 9 drives these when read-aloud-studio gets its adapter.
      scaffoldingLevels: {
        level1: 'Use the scripted correction line for this item exactly as the cue quotes it, then wait for them alone.',
        level2: 'Use the same scripted correction line again, said more slowly. Add nothing to it, and do not read the line for them outside that quote.',
        level3: 'Use the scripted correction line for this item, then hand the reading back one more time.',
      },
      // Observable behaviours only, with PERFORMABLE responses (script moves a
      // tutor can speak or do — never meta-instructions, which get recited to
      // the child verbatim).
      commonStruggles: [
        {
          pattern: 'Swaps a small word for another small word - "the" for "a", "and" for "then", "her" for "his"',
          response: 'Treat it as a miss however fluent it sounded: the scripted correction names the words they said, reads the line correctly, and asks again.',
        },
        {
          pattern: 'Drops a word out of the middle of a smooth, confident reading',
          response: 'Treat the missing word as a miss: the scripted correction names it, reads the line correctly, and asks again.',
        },
        {
          pattern: 'Says the IDEA of the line in their own words instead of reading the printed words',
          response: 'Treat a retelling as not yet read: the scripted correction reads the printed words, then asks them to read it again.',
        },
        {
          pattern: 'Sounds out slowly, word by word, but lands on every word correctly',
          // The accept-side 18d, same row as decodable-reader's and fixed in
          // the same census pass. Gate-covered, not driven — see the rungs above.
          response: 'Treat it as correct: say the cue\'s scripted affirmation line for this item, word for word, and nothing else. Effortful decoding that reaches the right words is reading.',
        },
        {
          pattern: 'Stops in the middle of a line and starts again',
          response: 'Wait for them to finish the whole line, then judge the reading they finished on.',
        },
        {
          pattern: 'Goes quiet after being asked',
          response: 'Say the instruction once more, then wait for them alone.',
        },
      ],
      aiDirectives: [
        {
          title: 'LIVE-JUDGED DIRECT INSTRUCTION',
          instruction:
            'Messages tagged [RA_ITEM], [RA_PLAN], [RA_MOVE], [RA_COMPLETE] or [RA_HEAR] contain the only lesson words you '
            + 'may speak. The square-bracket label is private metadata: never speak, reproduce, or invent it. '
            + 'Each carries a judging rule: affirmations must begin with "Yes" and corrections must begin with '
            + '"My turn", using the exact quoted lines. Never begin any other sentence with those words. Judge '
            + 'honestly from the audio, word by word, and do not praise a misread to be kind.',
        },
        {
          title: 'THE OPENING LINE ALREADY TEACHES THE GAME',
          instruction:
            'The first [RA_ITEM] of a session, and any later one that carries a how-to-play sentence, has the '
            + 'greeting, the action and the instruction INSIDE its quoted line. Speak that quote exactly and add '
            + 'nothing of your own: no separate greeting, no how-to-play in your own wording, no rephrased '
            + 'instruction. This OVERRIDES any "keep it to one sentence" cap from a lesson switch.',
        },
        {
          title: 'NEVER READ A LINE THE CHILD HAS NOT READ YET',
          instruction:
            'In the "accuracy" mode the child is decoding the printed line cold, and that is the whole '
            + 'measurement. Do NOT read that line, or any part of it, before they do — not to help, not to '
            + 'check, not as an example, and not because a scaffolding instruction seems to invite it. In the '
            + 'expression mode, wait through phrase planning and the first reading before the modeled reread. '
            + 'During planning do not judge microphone speech or phrase correctness; acknowledge only an explicit '
            + '[RA_PLAN] commit. The first-read cue also forbids an early model. In dialogue mode the cue quotes '
            + 'a model first. Speak a model only when the current cue explicitly quotes it. Never '
            + 'read a line further down the passage than the one the application has put in front of them.',
        },
        {
          title: 'THE WORDS ARE THE VERDICT, NOT THE SOUND OF IT',
          instruction:
            'Judge whether every printed word was read, correctly and in order. Do NOT judge how the reading '
            + 'sounded: a flat, plain, unexpressive delivery with every word right is CORRECT, and so is a slow, '
            + 'effortful, sounded-out reading that lands on the right words. Speed is never judged. Where a cue '
            + 'asks you to model a phrase or a character voice, that model is TEACHING — it never becomes a '
            + 'standard you then refuse the child against.',
        },
        {
          title: 'WAIT (the silence is theirs)',
          instruction:
            'After you ask, STOP and stay silent until the child has finished reading the whole line. Do not '
            + 're-ask, do not fill the pause, do not read along with them, and do not finish a word they are '
            + 'working out. A reader pauses in the middle of a line and that pause is part of ONE reading, not '
            + 'the end of it. If they tap to hear the instruction again you will receive a separate [RA_HEAR] '
            + 'message: answer that and nothing more, then go back to waiting.',
        },
        {
          title: 'INSTRUCTION ON DEMAND ([RA_HEAR])',
          instruction:
            'When you receive a message starting with [RA_HEAR], immediately say ONLY what it quotes and '
            + 'nothing else, then wait again. Do not treat anything you just heard as a reading to judge, do '
            + 'not add commentary, and on an accuracy line do not read the line itself — the child is asking to '
            + 'hear the INSTRUCTION again, which is how a reader recovers what they were asked to do.',
        },
      ],
    },
  },

  // ===== LANGUAGE (L) =====
  {
    id: 'sentence-builder',
    description: 'Students construct grammatical sentences by arranging color-coded word/phrase tiles by grammatical role (subject=blue, predicate=red, object=green, modifier=yellow). Progressive complexity from simple S-V to compound-complex sentences. TTS read-back. ESSENTIAL for grades 1-6 grammar.',
    constraints: 'Best for grades 1-6. Sentence complexity should match grade level.',
    affordances: { representation: 'symbolic', answers: ['build'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'simple',
        label: 'Simple (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['simple'],
        description: 'Build simple sentence from tiles.',
      },
      {
        evalMode: 'compound',
        label: 'Compound (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['compound'],
        description: 'Join clauses with conjunction.',
      },
      {
        evalMode: 'complex',
        label: 'Complex (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['complex'],
        description: 'Subordinate clause construction.',
      },
      {
        evalMode: 'compound_complex',
        label: 'Compound-Complex (Tier 5)',
        beta: 7.0,
        scaffoldingMode: 5,
        challengeTypes: ['compound-complex'],
        description: 'Multi-clause sentence building.',
      },
      {
        evalMode: 'build_sentence',
        affordances: { answers: ['build'] },
        label: 'Make a Sentence (open build)',
        beta: 1.6,
        scaffoldingMode: 1,
        challengeTypes: ['build_sentence'],
        description: 'Open build, on the live tutor: tap word tiles and an end mark to MAKE a question or a telling sentence '
          + 'about a named thing ("Make a question about the dog."), then press done; some items ask for a second sentence. '
          + 'Many sentences pass. Code checks the end mark and how a question starts; the shared judge checks it makes sense '
          + 'and is about the thing. Beta = simple + 0.1.',
      },
    ],
    // Every mode is on the teaching workspace (R12, user ruling 2026-10-08): the tile modes order given tiles
    // (`sentenceOrder.ts`), build_sentence makes a sentence from word tiles (`sentenceBuild.ts`).
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'On the tile modes the learner puts ALL the given tiles in order to make one sentence and presses "I am '
        + 'done"; more than one order can be right, and the sentence is never printed before. Never say the sentence or '
        + 'which tile goes next; ask what the sentence is about, or which tile tells who. Make a sentence: word tiles and the end marks . and ? are on screen; the learner taps them into a row to '
        + 'make a question or a telling sentence about the thing named, and presses "I am done". Many sentences pass. A '
        + 'question starts with an asking word and ends with ?; a telling sentence ends with a period. Never say a '
        + 'sentence that would work or which tile goes next; ask the learner to read their sentence aloud. You cannot '
        + 'move a tile.',
      levers: true,
      misses: { ...Object.fromEntries(['simple', 'compound', 'complex', 'compound_complex'].map(m => [m,
          ['tiles_left', 'end_mark_not_last', 'not_sense']])),
        build_sentence: ['no_end_mark', 'end_mark_inside', 'wrong_end_mark', 'too_short', 'not_question_start',
        'question_start', 'same_sentence', 'not_sense', 'off_topic'] },
      // same_sentence has no lever: the sentence already made stays on screen.
      unanswered: { build_sentence: ['same_sentence'] },
    },
    // tutoring removed 2026-10-08 (R12): every mode is workspace-only, and bound sessions send `tutoring: null`.
    supportsEvaluation: true,
  },
  {
    id: 'context-clues-detective',
    description: 'Students determine unfamiliar word meaning using context clues. Teaches clue types: definition, synonym/antonym, example, inference. Students highlight clues, identify type, provide meaning. Dictionary comparison reveal. Perfect for grades 2-6 vocabulary.',
    constraints: 'Best for grades 2-6. Requires passage with context clues near target word.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'definition',
        label: 'Definition (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['definition'],
        description: 'Meaning stated directly in text.',
      },
      {
        evalMode: 'synonym_antonym',
        label: 'Synonym/Antonym (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['synonym', 'antonym'],
        description: 'Meaning from similar/opposite words.',
      },
      {
        evalMode: 'example',
        label: 'Example (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['example'],
        description: 'Meaning from given examples.',
      },
      {
        evalMode: 'inference',
        label: 'Inference (Tier 4)',
        beta: 5.5,
        scaffoldingMode: 4,
        challengeTypes: ['inference'],
        description: 'Meaning from broader context.',
      },
    ],
    teachingWorkspace: {
      grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'Each word is a few steps, each checked by the activity, and you are not told the answers: the learner taps '
        + 'sentences and presses Check Clue, then (only when the lesson mixes clue types) taps one of five clue types and '
        + 'presses Check Type, then taps (or types) a meaning and presses Check Meaning. Until a step is credited, never say which sentence holds the clue, which clue '
        + 'type it is, or what the word means, and never say which option to tap. On the find step, do not name, number, '
        + 'quote or point to any sentence or line for the learner to look at, the word\'s own one included (on many words '
        + 'the clue is inside it), also when a lever changed the passage; ask what the passage tells us about the word and '
        + 'let the learner choose. On a type step, the lesson\'s mode names the clue types in play: do not say which one '
        + 'this word has. Reading the whole passage aloud, reading the five type '
        + 'names as a list, and asking what a sentence the learner tapped tells us about the word is teaching. The find step passes when the tapped '
        + 'sentences are clues (the word\'s own sentence may be among them, but alone it passes only when the clue is inside '
        + 'it), so tapping every sentence does not pass. The dictionary '
        + 'definition appears only after the meaning is credited. A wrong check\'s miss names the confusion: extra_sentence, '
        + 'a clue tapped with sentences that are not; similar_opposite, synonym against antonym; definition_synonym, a meaning '
        + 'spelled out against one similar word; said_inference, inference for a clue the text states; teach that contrast. '
        + 'A definition clue says what the word means in the text; a synonym is a similar word nearby; an antonym is an '
        + 'opposite set against it (unlike, but, however); an example clue lists cases (such as, for example); an inference '
        + 'is pieced together from several sentences. You cannot tap, type or press Check.',
      // Every step declares help levers (`contextCluesLevers.ts`); every miss is answered by one on every step it occurs.
      levers: true,
      // The activity's own check (`clueMiss`), every mode: three steps per word.
      misses: missLists<ContextClueMiss>({
        // One clue type per session in these three modes: no classify step, so no type misses.
        definition: ['target_sentence_only', 'extra_sentence', 'no_clue', 'other_meaning'],
        synonym_antonym: ['target_sentence_only', 'extra_sentence', 'no_clue', 'similar_opposite', 'definition_synonym', 'said_inference', 'other_type', 'other_meaning'],
        example: ['target_sentence_only', 'extra_sentence', 'no_clue', 'other_meaning'],
        inference: ['target_sentence_only', 'extra_sentence', 'no_clue', 'other_meaning'],
      }),
    },
    supportsEvaluation: true,
    tutoring: {
      taskDescription:
        'You ARE the detective coach for this context-clues activity. '
        + 'The student is figuring out what an unfamiliar word means using clues in the passage — '
        + 'NEVER reveal the meaning, the clue type, or which sentence is the clue; coach the strategy instead. '
        + 'Grade {{gradeLevel}}. Mystery word {{itemIndex}}/{{totalItems}}: "{{targetWord}}". '
        + 'Phase: {{currentPhase}} (find the clue sentence -> classify the clue type -> define the word). '
        + 'Student has highlighted {{highlightCount}} sentence(s); their current clue-type guess is "{{selectedClueType}}".',
      contextKeys: [
        'gradeLevel', 'targetWord', 'currentPhase', 'clueType',
        'itemIndex', 'totalItems', 'selectedClueType', 'highlightCount',
      ],
      scaffoldingLevels: {
        level1:
          'FIND phase: "Which sentence tells you something about {{targetWord}}?" '
          + 'CLASSIFY phase: "What is that clue sentence DOING for {{targetWord}}?" '
          + 'DEFINE phase: "Use the clue — what could {{targetWord}} mean?"',
        level2:
          'FIND phase: "Read the sentence right next to {{targetWord}} — does it hint at the meaning?" '
          + 'CLASSIFY phase: "Does the clue define it, give a similar or opposite word, give an example, or make you infer?" '
          + 'DEFINE phase: "Put the clue in your own words — that is close to what {{targetWord}} means."',
        level3:
          'FIND phase: "Look for the sentence that explains or hints at {{targetWord}}, then click it." '
          + 'CLASSIFY phase: "Compare the clue to {{targetWord}}: a matching word is a synonym, an opposite is an antonym, a meaning spelled out is a definition." '
          + 'DEFINE phase: "Re-read the clue sentence and say the meaning of {{targetWord}} using those words."',
      },
      commonStruggles: [
        { pattern: 'Highlights a sentence with no clue', response: 'A clue sentence helps explain {{targetWord}} — does this one do that, or is it just part of the story?' },
        { pattern: 'Cannot tell which clue type it is', response: 'Ask: does the clue sentence DEFINE {{targetWord}}, give a similar/opposite word, give an example, or make you figure it out?' },
        { pattern: 'Confuses synonym and antonym clues', response: 'Is the nearby word similar to {{targetWord}} or the opposite of it?' },
        { pattern: 'Guesses the meaning without using the clue', response: 'Point back to the clue sentence — what does it tell you {{targetWord}} is about?' },
        { pattern: 'Repeated wrong attempts on the meaning', response: 'Read just the clue sentence again slowly and say the meaning of {{targetWord}} in your own words.' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], warmly introduce the context-clues detective activity. '
            + 'Frame the student as a detective who figures out word meanings from clues in the passage, '
            + 'then point them to the first mystery word and tell them to click the sentence that gives a clue. '
            + 'NEVER reveal the meaning or which sentence is the clue. Keep it brief (2-3 sentences), warm, and enthusiastic. '
            + 'Use age-appropriate language for the grade level.',
        },
        {
          title: 'NEVER REVEAL THE ANSWER',
          instruction:
            'Across all phases, you must never state what {{targetWord}} means, never name the correct clue type, '
            + 'and never point to the exact clue sentence. Coach the strategy (find -> classify -> define) and nudge with questions. '
            + 'The on-screen dictionary definition appears only AFTER the student answers — do not preempt it.',
        },
      ],
    },
  },
  {
    id: 'figurative-language-finder',
    description: 'Students identify and classify figurative language in passages: simile, metaphor, personification, hyperbole, idiom, alliteration, onomatopoeia, imagery. Color-coded highlighting by type. Literal translation mode. Connects to poetry-lab. Perfect for grades 3-6.',
    constraints: 'Best for grades 3-6. Requires passage rich in figurative language.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'sound_devices',
        label: 'Sound Devices (Tier 1)',
        beta: 2.0,
        scaffoldingMode: 1,
        challengeTypes: ['alliteration', 'onomatopoeia'],
        description: 'Identify sound-based devices.',
      },
      {
        evalMode: 'comparison',
        label: 'Comparison (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['simile', 'metaphor'],
        description: 'Identify explicit/implicit comparisons.',
      },
      {
        evalMode: 'advanced',
        label: 'Advanced (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['personification', 'hyperbole', 'imagery'],
        description: 'Non-literal expression identification.',
      },
      {
        evalMode: 'idiom',
        label: 'Idiom (Tier 5)',
        beta: 6.0,
        scaffoldingMode: 5,
        challengeTypes: ['idiom'],
        description: 'Interpret culturally specific expressions.',
      },
      {
        evalMode: 'build_figurative',
        affordances: { answers: ['build'] },
        label: 'Make a Figure (open build)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['figurative_build'],
        description: 'Write your own simile, metaphor, personification, hyperbole or alliteration about a subject; many sentences pass.',
      },
    ],
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      guidance: 'On the find steps the learner taps a sentence of the passage, taps the kind of figure of speech in it and '
        + 'presses "I am done"; any figure the passage holds passes, in any order. Never say which sentence holds one or '
        + 'what kind it is. On the meaning steps the learner types what a marked phrase really means; on make a figure '
        + 'the learner writes their own. Those are checked for doing the job and making sense; spelling is not judged and '
        + 'many answers pass. Never write it for them. You cannot tap or type.',
      levers: true,
      misses: { ...Object.fromEntries(['sound_devices', 'comparison', 'advanced', 'idiom'].map(m => [m,
        ['wrong_type', 'no_device', 'already_found', 'too_short', 'unchanged', 'not_sense', 'wrong_job']])),
        build_figurative: ['too_short', 'not_sense', 'wrong_job'] },
      // already_found and too_short need no lever: the words say what to do next.
      unanswered: Object.fromEntries(['sound_devices', 'comparison', 'advanced', 'idiom'].map(m => [m, ['already_found', 'too_short']])),
    },
    tutoring: {
      taskDescription:
        'You coach a student through a figurative-language activity. '
        + 'They progress through phases: FIND (tap figurative phrases in the passage), '
        + 'CLASSIFY (label each phrase by type), INTERPRET (write the literal meaning), and REVIEW. '
        + 'Grade {{gradeLevel}}. Phase: {{currentPhase}}. '
        + 'Found {{instancesFound}} of {{totalInstances}} phrases; {{classifiedCount}} labeled so far. '
        + 'Types present in this passage: {{typesPresent}}. '
        + 'NEVER name which phrases are figurative or what type they are — guide with signal words and the literal-vs-figurative distinction only.',
      contextKeys: [
        'gradeLevel', 'currentPhase', 'totalInstances',
        'instancesFound', 'typesPresent', 'classifiedCount',
      ],
      scaffoldingLevels: {
        level1:
          'FIND: "Read slowly — which words paint a picture or do not mean exactly what they say?" '
          + 'CLASSIFY: "How does this phrase work — is it comparing, exaggerating, or making a sound?" '
          + 'INTERPRET: "If you said this in plain words, what would it really mean?"',
        level2:
          'FIND: "Look for comparisons (like/as), exaggerations, or human actions given to objects." '
          + 'CLASSIFY: "Does it use \'like\' or \'as\'? Does it give an object a human action? That tells you the type." '
          + 'INTERPRET: "Picture what is literally happening, then write it as a plain fact."',
        level3:
          'FIND: "Scan each sentence for a phrase that cannot be literally true — that is your figurative phrase." '
          + 'CLASSIFY: "Match the signal: \'like/as\' = comparison, an action only people do = personification, a wild overstatement = exaggeration." '
          + 'INTERPRET: "Restate it directly: drop the imagery and say the underlying meaning in one plain sentence."',
      },
      commonStruggles: [
        { pattern: 'Cannot find any figurative phrases', response: 'Read one sentence at a time — does any part stretch the truth or compare two things?' },
        { pattern: 'Confuses simile and metaphor', response: 'Check for the words "like" or "as" — that is the difference between the two comparison types.' },
        { pattern: 'Labels literal language as figurative', response: 'Could this sentence be literally true? If yes, it may not be figurative.' },
        { pattern: 'Literal interpretation just repeats the phrase', response: 'Do not reuse the figurative words — say what actually, plainly happens.' },
        { pattern: 'Repeated wrong classification', response: 'Think about HOW the phrase works — comparing, exaggerating, making a sound, or giving human traits?' },
      ],
      aiDirectives: [
        {
          title: 'ACTIVITY INTRODUCTION',
          instruction:
            'When you receive [ACTIVITY_START], warmly introduce the figurative-language activity in 2 sentences max. '
            + 'Mention we will find, classify, and interpret figurative language, and encourage the student to tap each figurative phrase they spot. '
            + 'Never reveal which phrases are figurative or their types. Use age-appropriate language for the grade level.',
        },
        {
          title: 'PHASE TRANSITIONS',
          instruction:
            'When you receive [PHASE_CLASSIFY], [PHASE_INTERPRET], or [PHASE_REVIEW], give one brief sentence orienting the student to the new step. '
            + 'Do not reveal any answer or correct type.',
        },
        {
          title: 'CLASSIFICATION FEEDBACK',
          instruction:
            'When you receive [CLASSIFY_CORRECT], affirm in one short sentence and name the signal that makes the phrase that type. '
            + 'When you receive [CLASSIFY_INCORRECT], give a brief hint about what to look for WITHOUT naming the correct type.',
        },
        {
          title: 'COMPLETION',
          instruction:
            'When you receive [ACTIVITY_COMPLETE], give a brief, warm wrap-up (one or two sentences) acknowledging their results, plus one tip for spotting figurative language next time.',
        },
      ],
    },
  },
  {
    id: 'spelling-pattern-explorer',
    description: 'Students investigate word groups sharing spelling patterns, discover underlying rules, then apply via audio dictation practice. Supports word families, vowel patterns, suffix rules, Latin/Greek roots. TTS pronunciation and slow syllable mode. Perfect for grades 1-6 spelling.',
    constraints: 'Best for grades 1-6. Pattern complexity should match grade level.',
    affordances: { representation: 'symbolic', answers: ['type', 'build'], role: ['visualize', 'apply'], minutes: 5 },
    evalModes: [
      {
        evalMode: 'short_vowel',
        affordances: { answers: ['type'] },
        label: 'Short Vowel (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['short-vowel'],
        description: 'CVC and short vowel patterns.',
      },
      {
        evalMode: 'long_vowel',
        affordances: { answers: ['type'] },
        label: 'Long Vowel (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['long-vowel'],
        description: 'CVCe, vowel teams.',
      },
      {
        evalMode: 'r_controlled',
        affordances: { answers: ['type'] },
        label: 'R-Controlled (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['r-controlled'],
        description: 'ar, er, ir, or, ur patterns.',
      },
      {
        evalMode: 'silent_letter',
        affordances: { answers: ['type'] },
        label: 'Silent Letter (Tier 3)',
        beta: 4.0,
        scaffoldingMode: 3,
        challengeTypes: ['silent-letter'],
        description: 'Silent letter conventions.',
      },
      {
        evalMode: 'morphological',
        affordances: { answers: ['type'] },
        label: 'Morphological (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['suffix-change', 'latin-root'],
        description: 'Morpheme-based spelling.',
      },
      {
        evalMode: 'pattern_build',
        affordances: { answers: ['build'] },
        label: 'Make a Pattern Word (open build)',
        beta: 2.6,
        scaffoldingMode: 2,
        challengeTypes: ['pattern-build'],
        description: 'Open build: put letters from a bank into the boxes to MAKE any real word that uses a named spelling '
          + 'pattern (long a spelled ai, a_e, ar, a silent k as kn), then press done; every second item asks for a second '
          + 'word. Many words pass. Code checks the pattern, its place and that the letters make the sound; the shared word '
          + 'judge checks it is a real word. Grades 1-3. β = long_vowel + 0.1.',
      },
    ],
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
      levers: true,
      guidance: 'On the classic modes the learner first looks at the pattern words and writes the rule in their own words '
        + '(not checked), then spells one dictation word at a time: say the word, the learner types it and presses Check, '
        + 'and the activity checks the spelling itself. Never spell the word, name its letters or say the pattern before '
        + 'the learner has tried; when the pattern panel is hidden the learner finds the pattern. You cannot type for them. '
        + 'On make a pattern word the learner puts letters from the bank into the boxes to make any real word with the '
        + 'spelling the ask names and presses "I am done"; many words pass, and some items ask for a second word. Never say '
        + 'a word that would fit or a letter to add. You cannot place or remove a letter.',
      // Classic: the typed spelling's own check (`spellingMiss`). The build: what the ask states, in code
      // (`spellingPatternBuild.ts`), then the word judge's not_a_word.
      misses: missLists<SpellingMiss | LetterBuildMiss>({
        ...sameMisses<SpellingMiss>(['short_vowel', 'long_vowel', 'r_controlled', 'silent_letter', 'morphological'],
          ['pattern_missing', 'other_letters', 'misspelled']),
        pattern_build: ['other_spelling', 'wrong_place', 'no_pattern', 'not_the_sound', 'same_word', 'pick_another', 'not_a_word'] }),
      // pattern_build: the word already made stays on screen; a word not for lessons has no smaller form.
      unanswered: { pattern_build: ['same_word', 'pick_another'] },
    },
  },
  {
    id: 'word-sorter',
    description:
      'LIVE-JUDGED SPOKEN word sorting (Direct Instruction). The tutor says a word out loud and the student ANSWERS OUT LOUD — '
      + 'naming the group it belongs with (two groups, or three), or naming its partner from a printed word bank '
      + '(opposites, synonyms, plurals, rhymes). The tutor responds to the spoken answer, and a credited answer '
      + 'advances the lesson. Nothing is tapped or dragged. REQUIRES A MICROPHONE. '
      + 'ESSENTIAL for K-2 grammar, vocabulary and categorization.',
    constraints:
      'REQUIRES A MICROPHONE — every answer is spoken; there is no tap, drag or button path. '
      + 'Requires 2-3 group categories per challenge, each labelled with ONE or TWO plain words a child can say back '
      + '(a label that is a phrase, or that shares a word with another label, is dropped). Words must be age-appropriate '
      + 'and sortable by a single clear criterion. Match pairs limited to 5-6 per challenge and every term must have ONE '
      + 'defensible partner. BAND FLOOR: at Kindergarten use binary_sort or ternary_sort only — match_pairs answers from a '
      + 'printed bank, which requires decoding, so it is for Grade 1+.',
    // reader: 'none' — READY @ PRE for binary_sort / ternary_sort
    // (qa/reader-fit/word-sorter-PRE-2026-07-14.md), and the DI port (port 18, 2026-08-16)
    // forces `namesChoices` at the K band floor precisely because a pre-reader cannot read a
    // mat — the ask names the groups aloud. Zero taps in all three modes.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    ...bossEntry(wordSorterCard),
    evalModes: [
      {
        evalMode: 'binary_sort',
        label: 'Two Groups (Tier 1)',
        // β UNCHANGED on the DI port, deliberately. The tap became speech, but
        // the answer SET did not change size and the ask re-states both choices
        // every round, so the discrimination demand is identical — only the
        // response channel moved. (Contrast story-talk/letter-spotter, where a
        // 1-of-4 MENU was deleted outright and the guess floor went with it.)
        beta: 1.5,
        scaffoldingMode: 2,
        challengeTypes: ['binary_sort'],
        description: 'Hear a word, then SAY which of 2 groups it belongs with (nouns vs verbs, singular vs plural). Spoken production; nothing is tapped.',
      },
      {
        evalMode: 'ternary_sort',
        label: 'Three Groups (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 3,
        challengeTypes: ['ternary_sort'],
        description: 'Hear a word, then SAY which of 3 groups it belongs with (past/present/future tense). Spoken production; nothing is tapped.',
      },
      {
        evalMode: 'match_pairs',
        // Grade 1+ only — the eval-mode description states the cause itself: the word bank
        // is READ, not heard, so this mode's own path needs reading where the sorts do not.
        affordances: { reader: 'developing' },
        label: 'Find the Partner (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 4,
        challengeTypes: ['match_pairs'],
        description: 'Grade 1+ ONLY (never Kindergarten — the word bank is read, not heard). Hear a word, then SAY its partner from the printed bank (singular→plural, word→antonym, word→synonym, rhyme). The bank stays whole all challenge, so no answer is ever reachable by elimination.',
      },
    ],
    supportsEvaluation: true,
  },
];
