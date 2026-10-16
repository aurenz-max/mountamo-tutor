/**
 * Physics Catalog - Component definitions for physics primitives
 *
 * Contains physics visualizations and interactive experiments for K-12 science education.
 * Covers mechanics, energy, forces, motion, waves, electricity, and other core physics concepts.
 */

import { ComponentDefinition } from '../../../types';
import type { SpokenPushPullMiss } from '../../../primitives/visual-primitives/physics/pushPullArenaWorkspace';
import type { RaceTrackMiss } from '../../../primitives/visual-primitives/physics/raceTrackWorkspace';
import type { SoundWaveMiss } from '../../../primitives/visual-primitives/physics/soundWaveWorkspace';
import type { GravityDropMiss } from '../../../primitives/visual-primitives/physics/gravityDropWorkspace';
import { missLists } from './missLists';

export const PHYSICS_CATALOG: ComponentDefinition[] = [
  {
    id: 'motion-diagram',
    description: 'Motion Diagram / Strobe Diagram showing object positions at equal time intervals with velocity and acceleration vectors. Perfect for teaching kinematics qualitatively. ESSENTIAL for Middle School - High School physics: introduction to motion (MS), velocity concepts (MS/HS), acceleration (HS), projectile motion (HS), circular motion (AP).',
    constraints: 'Best for grades 6-12. Use uniform motion for MS, accelerated/projectile for HS, circular for AP.',
    // No evalModes/challengeTypes declared here despite supportsEvaluation, so `answers`
    // is left out rather than inferred from the component's own click-to-place/identify
    // surface — the same class of gap as media-player's MP-3.
    affordances: { representation: 'pictorial', role: 'visualize', minutes: 5 },
    supportsEvaluation: true,
  },
  {
    id: 'sound-wave-explorer',
    description: 'Sound lab built on vibration and drawn sound waves: drums, guitar strings, rubber bands, bells and tuning forks, each with its wave (a taller wave is a louder sound, crests packed closer a higher one) and a real tone. Four eval modes: observe (a sound maker starts or stops shaking, or its sound starts or stops; the learner says what happens to the other; hard items have a loud speaker make rice on a drum shake), predict (one change to how a sound maker is played or heard: harder, more gently, tightened, loosened, walking away, the air pumped out of a bell jar; the learner predicts the loudness or the pitch before the After wave and sound appear), classify (read two or three drawn waves: which sound is louder, quieter, higher or lower; the sounds play only after the answer), apply (from a Before and an After wave, say what was done: played harder or more gently, tightened or loosened, or both at once). Every item, choice and key is built by code; the wrong choices are the classic errors (pitch and loudness mixed up, sound with no shaking, a wave read by the wrong feature). ESSENTIAL for Grade 1 Physical Science (NGSS 1-PS4-1) and early wave reading toward 4-PS4-1.',
    constraints: 'Best for K-3. Kindergarten defaults to observe; grade 1 observe and predict; grade 2 predict and classify; grade 3 classify and apply. Sound travels through air only here: no water or solid materials, no wave speed, wavelength numbers or decibels. Tones are short sine bursts (220-700 Hz).',
    affordances: { representation: ['concrete', 'pictorial'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3'],
      guidance: 'Code builds and checks every item, and you are not told the key; the learner taps a choice and presses Check '
        + 'Answer, or says it. Nothing that answers the item is shown or played before credit: the observe picture shows the '
        + 'moment before the change, the predict After panel shows "?", and the classify sounds play only afterwards. You are '
        + 'not told how tall a wave is or how close its crests are, so never describe a wave, compare two waves, or say which '
        + 'part of a wave shows loudness or pitch; ask what the learner sees in the waves and what in a wave could show how '
        + 'loud or how high a sound is. Never say which way a sound changes, that it "stays the same", which wave or change '
        + 'is right, or what a change does to the shaking ("it shakes faster"); ask what the change does to the shaking and '
        + 'what that does to the sound. After a miss, never say what the wrong choice mixed up. With a card on screen, '
        + 'you may read the whole card aloud; never read only the half about the asked feature, never follow it with a '
        + 'question about that half ("which wave is taller?" on a loudness question), and never add the step it leaves ("so '
        + 'plucking harder makes it louder"); ask what it tells them. The crest marks show height and spacing on every '
        + 'wave: never ask about only the one the question needs. You may say that loudness is how '
        + 'loud a sound is and pitch is how high or low it is. You cannot tap, check or play anything for the learner.',
      // observe publishes shake_card (and plain_link on medium and hard items); predict change_card (physical changes),
      // feature_card and easier_change; classify feature_card, crest_marks and one_difference; apply change_card,
      // feature_card, crest_marks and one_change (`soundWaveLevers.ts`). Every miss of every mode is answered by a help lever first.
      levers: true,
      // The activity's own check (`soundMiss`) on a tap, and the same ids as each spoken item's known misses (`soundSpokenMisses`).
      misses: missLists<SoundWaveMiss>({ observe: ['start_stop_swapped', 'said_no_change'],
        predict: ['mixed_up_features', 'opposite_direction', 'said_same'],
        classify: ['read_other_feature', 'opposite_end', 'missed_same', 'said_same'],
        apply: ['wrong_feature', 'opposite_change', 'loudness_misread', 'pitch_misread', 'both_misread'] }),
    },
    evalModes: [
      {
        evalMode: 'observe',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Observe (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'A sound maker starts or stops shaking (or its sound starts or stops): say what happens to the other; hard items have a loud sound make something else shake',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'One change to how a sound maker is played or heard: predict whether it gets louder, quieter, higher or lower, or stays the same, before the After wave and sound appear',
      },
      {
        evalMode: 'classify',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Classify (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['classify'],
        description: 'Read two or three drawn waves and say which sound is louder, quieter, higher or lower (height for loudness, crest spacing for pitch); the sounds play only after the answer',
      },
      {
        evalMode: 'apply',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Apply (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['apply'],
        description: 'Reverse reasoning: from a Before and an After wave, say what was done to the sound maker (played harder or more gently, tightened or loosened, or both)',
      },
    ],
    // The scripted fallback (no tutor-owned workspace) still sends this block.
    tutoring: {
      taskDescription: 'Student is in a sound lab ({{mode}}), item {{itemIndex}} of {{totalItems}}: {{ask}} Choices: {{choices}}.',
      contextKeys: ['gradeLevel', 'mode', 'itemIndex', 'totalItems', 'ask', 'choices', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What is shaking here? What does the shaking do?"',
        level2: '"Think about how big the shakes are and how fast they are. Which one changes how loud the sound is? Which one changes how high it is?"',
        level3: '"Here is the rule: bigger shakes make a louder sound and a taller wave; faster shakes make a higher sound and crests packed closer together. Now look again."',
      },
      commonStruggles: [
        { pattern: 'Student confuses pitch and loudness', response: '"Pitch is how high or low a sound is, like a bird or a bear. Loudness is how loud or quiet it is. Which one is this question about?"' },
        { pattern: 'Student thinks sound can go on without shaking', response: '"Hum with your hand on your throat. Feel it shake? Now stop. The shaking and the sound stop together."' },
        { pattern: 'Student thinks sound travels without air', response: '"Sound is shaking passed along through the air. What happens when there is less and less air to pass it along?"' },
        { pattern: 'Student reads the wrong part of the wave', response: '"A wave shows two things: how tall it is and how close its crests are. Which of those could show how loud a sound is?"' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'push-pull-arena',
    description: 'Live force arena with a spoken tutor where the child watches and runs canvas physics simulations — pushes and pulls on ice, wood, carpet and grass — and ANSWERS OUT LOUD: the tutor asks, responds to the spoken answer, corrects with the physics idea, and a credited answer advances. Modes: observe (watch the preset force, say "push" or "pull"), predict (say "moves" or "stays" before it runs; the sim plays the push once the answer is credited), compare (two objects, same push — say which slides farther), design (experiment with force controls, say whether the goal needs a big or little push). ESSENTIAL for K-5 Physical Science: pushes and pulls (K-PS2-1), motion from forces (K-PS2-2), balanced/unbalanced forces (3-PS2-1).',
    constraints: 'Best for K-5. Use observe mode for K-1, predict for 1-2, compare for 2-3, design for 4-5. Keep object weights 1-10 for clarity. Answers are single spoken words judged by the microphone-enabled Lumina tutor; there is no Check button and no printed answer options.',
    // reader: 'none' — shipped judged-loop DI port (same pattern as di-dice-roll /
    // di-math-facts): the runner owns every cue, the child never reads anything, the
    // constraint text itself says "no printed answer options."
    affordances: { representation: ['concrete', 'pictorial'], reader: 'none', answers: ['spoken'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Watch the preset force move the object, then SAY whether it was a push or a pull',
      },
      {
        evalMode: 'predict',
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'Given object weight + push strength, SAY "moves" or "stays" before the simulation runs',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['compare'],
        description: 'Two objects get the same push — SAY which one slides farther (by name)',
      },
      {
        evalMode: 'design',
        label: 'Design (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['design'],
        description: 'Experiment with the force controls, then SAY whether the goal needs a big or little push',
      },
    ],
    audioInput: { manual_activity: true },
    tutoring: {
      // The answer used to live in this sentence ("The correct spoken answer:
      // {{expectedAnswer}}."), which held it in the persistent state block for
      // the whole session while the child was still being asked for it. The
      // per-turn judging contract inside each cue names the answer, scoped to
      // the turn that needs it; the state block carries the STIMULUS only.
      taskDescription: 'LIVE-JUDGED forces practice (DI modality): you ask with scripted lines sent as cues, the child answers OUT LOUD, you judge what you HEARD, and your own affirmation is what advances the lesson. Current challenge type: {{challengeType}}. Object: {{objectName}} on {{surface}}. In the arena right now: {{stimulus}}.',
      contextKeys: ['challengeType', 'objectName', 'surface', 'stimulus'],
      // 18d: a rung that quotes a SPEAKABLE line is a third reply channel. On
      // repeat wrong answers the model speaks the rung verbatim; it opens with
      // neither sentinel, so the loop records `di-no-verdict` and the correction
      // counter freezes with the child waiting. Level 3 was the worst kind —
      // "Tap Go and watch closely. Then tell me." is the observe how-to-play
      // almost word for word, so the model had a fluent, on-topic, sentinel-less
      // line pre-approved. The pedagogy is good and survives; it now routes
      // through the correction, which already opens "My turn:".
      scaffoldingLevels: {
        level1: 'Speak the current item\'s scripted correction line, exactly as the cue gives it. It already models the physics idea and re-asks — that IS the first scaffold, and it opens with "My turn:" so the activity can hear it.',
        level2: 'Speak the SAME scripted correction line again, a little slower. Do not swap it for a look-at-the-evidence hint or any other wording: a reply that opens with neither "Yes" nor "My turn:" reaches the activity as no verdict at all and the lesson stalls.',
        level3: 'Still the same scripted correction line. If the child is stuck after it, say nothing further — the activity moves the lesson on by itself and carries the next ask to you.',
      },
      commonStruggles: [
        { pattern: 'Describes the motion without committing to an answer word', response: 'The scripted ask names the two choices — re-speak it once and wait. The judging happens on the answer word.' },
        { pattern: 'Long silence', response: 'Silence is the child thinking or watching — wait. If they truly seem stuck, re-speak the current ask once.' },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it.',
        },
        {
          title: 'SENTINEL DISCIPLINE — AND YOUR WHOLE REPLY IS ONE OF TWO LINES',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener. Your whole reply to an attempt is ONE of those two '
            + 'quoted lines and nothing else — not the first time, not any time: no praise, no encouragement, no hint, '
            + 'no reminder of the method, however kind it would be. A reply that is neither reaches the activity as no '
            + 'verdict at all, and the child waits.',
        },
        {
          title: 'THE CHILD IS WATCHING PHYSICS — WAIT',
          instruction:
            'Think time is unbounded. Never narrate the simulation, never name the outcome, never fill silence. '
            + 'The cue names the accepted answer words; judge what you heard against them.',
        },
        {
          title: 'NEVER READ BRACKET TAGS OR NARRATE THE SCREEN',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken. '
            + 'Never announce the activity\'s state or describe what has changed in the arena, and never announce that you '
            + 'are waiting or listening — simply stop speaking.',
        },
      ],
    },
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'A sim arena of objects on ice, wood, carpet or grass; every answer is one spoken word computed from the '
        + 'sim\'s physics. Observe: the learner presses Go to watch the preset force, then says push or pull (away is a '
        + 'push, closer is a pull). Predict: moves or stays, said before anything moves. Compare: two objects get the '
        + 'same push and the learner names the one that slides farther (the lighter one; heavier does not slide '
        + 'farther). Design: the learner experiments with direction, strength and Go, then says big or little. The '
        + 'arena plays predict and compare once the answer is credited. A description of the motion or a restated '
        + 'setup is not an answer. Before an attempt never say the answer. You cannot press Go or move an object.',
      // Every item is one spoken word: its known wrong answers by kind (`pushPullSpokenMisses`, handoff 20 Part B).
      misses: missLists<SpokenPushPullMiss>({ observe: ['opposite_force', 'described_motion'], predict: ['opposite_outcome'],
        compare: ['other_object'], design: ['opposite_size'] }),
      // In-item levers (`pushPullArenaLevers.ts`): help in every mode, an easier item in predict, compare and design.
      levers: true,
    },
  },
  {
    id: 'race-track-lab',
    description: 'Race track lab: toy cars named by colour on a track of numbered squares, each moving a whole number of squares per second. Five eval modes, each a task with a code-built key: observe (run a timed race that a bell stops; which car is fastest? same time, so the one that moved the most squares), predict (read each car\'s speed and starting square, predict which crosses the finish line first, then the race runs), measure (run a timed race and count how many squares a car moved, or how many more than another car), calculate (from a race log, speed = distance ÷ time), graph (read a position-time graph: the steeper line is faster; a speed from the slope). Harder items change the shape, not the numbers: a head start that puts a slower car in front, three cars, two cars with different times. No speed readout, medal or finish time is shown before the answer. ESSENTIAL for K-5 Physical Science and extends to Middle School: comparing speeds (K-1), predicting motion (1-2), measuring distance (2-4), computing speed (4-5), position-time graphs and slope as velocity (MS).',
    constraints: 'Best for K-5, extends to MS. Use observe for K-1, predict for 1-2, measure for 2-4, calculate for 4-5, graph for MS. Constant speeds only (no acceleration); one to three cars per race.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'observe',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Observe (K-1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Run a timed race and say which car is fastest: every car ran the same time, so the one that moved the most squares (hard: a slower car with a head start ends in front)',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Predict (1-2)',
        beta: 3.0,
        scaffoldingMode: 2,
        challengeTypes: ['predict'],
        description: 'Read each car\'s speed and starting square and predict which crosses the finish line first, before the race runs (medium: squares in a few seconds; hard: a head start)',
      },
      {
        evalMode: 'measure',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Measure (2-4)',
        beta: 4.5,
        scaffoldingMode: 3,
        challengeTypes: ['measure'],
        description: 'Run a timed race and count the squares a car moved (medium: how many more than another car; hard: from a head start)',
      },
      {
        evalMode: 'calculate',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Calculate (4-5)',
        beta: 6.0,
        scaffoldingMode: 4,
        challengeTypes: ['calculate'],
        description: 'From a race log of start, stop and seconds, compute speed = distance ÷ time (medium: a start past square 0; hard: two cars with different times, the faster one\'s speed)',
      },
      {
        evalMode: 'graph',
        affordances: { answers: ['tap', 'spoken'] },
        label: 'Graph (MS)',
        beta: 7.5,
        scaffoldingMode: 5,
        challengeTypes: ['graph'],
        description: 'Read a position-time graph: which car is fastest from the steepest line (medium: a head start makes the highest line not the steepest); hard: a car\'s speed from its slope',
      },
    ],
    tutoring: {
      taskDescription: 'Student is in a race track lab ({{mode}}), race {{itemIndex}} of {{totalItems}}: {{ask}} Choices: {{choices}}. Attempt {{attemptNumber}}.',
      contextKeys: ['mode', 'itemIndex', 'totalItems', 'ask', 'choices', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"How many squares did each car move? How many seconds did it run?"',
        level2: '"Every car ran for the same time. Which tells you more about speed: where a car ended up, or how many squares it moved?"',
        level3: '"Speed is how many squares a car moves in one second. Count the squares it moved, then share them out over the seconds."',
      },
      commonStruggles: [
        { pattern: 'Student picks the car that is in front, or the line that ends highest', response: 'Ask where that car started, and how many squares it actually moved.' },
        { pattern: 'Student cannot read the position-time graph', response: 'Each line shows where a car was at each second. Ask how far up the line goes in one second.' },
      ],
    },
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Code builds and checks every race, and you are not told the key; the learner taps a choice and presses Check '
        + 'Answer, or says the answer. The cars are named by colour, and each moves a whole number of squares every second. '
        + 'Observe and measure: the learner presses Run the race; a timer counts the seconds and a bell stops every car '
        + 'before the end of the track, and each lane keeps a trail from where the car started to where it stopped. You are '
        + 'not told where any car stopped: reading it off the track is the task. Observe asks which car is fastest, and '
        + 'every car ran for the same time. Predict: a card gives each car\'s speed (or how far it goes in a few seconds) '
        + 'and its starting square; the race to the finish line runs only after the answer is credited. Measure asks how '
        + 'many squares a car moved, or how many more than another car. Calculate: a race log gives where each car '
        + 'started, where it stopped and the seconds, and its speed reads "?". Graph: a position-time graph with a dot at '
        + 'every second on each line. On some items one car starts ahead, so the car in front, or the line that ends '
        + 'highest, is not always the fastest, and seeing that is the task. Never say which car is fastest or wins, which '
        + 'car is in front, where a car stopped, how far it moved, a speed, or a number to divide or multiply by; never '
        + 'point at a car or a line by what makes it the answer ("the one with the longest trail", "the steepest line", '
        + '"the one that started behind"). With two or more cars, ask about every car alike and never single one out by '
        + 'name: on "the faster car\'s speed", never ask how far one named car went in a second, because which car is '
        + 'faster is half the answer; ask "how many squares does each car move in one second?". Never ask a which-car '
        + 'question that one look settles on this item ("which car has fewer squares to go?", "which car is fastest?" on '
        + 'a predict race, "which car is closest to the finish?"). Ask what the learner sees: how many squares each car '
        + 'moved, for how many seconds, how far each goes in one second. After a miss, never say what the wrong choice came from or what the learner left '
        + 'out ("you counted from square 0", "you forgot the head start", "you multiplied"); ask the learner how they '
        + 'worked it out. With a lever on screen, describe it only by what the scene says it shows, and ask what it tells '
        + 'them. You cannot run the race, tap or check for the learner.',
      // observe trail_count; predict step_marks (squares_to_go on head-start items); measure trail_ticks or
      // gap_bracket; calculate second_marks; graph one_second_step; each mode a simpler race (`raceTrackLevers.ts`).
      // Every miss of every mode is answered by a help lever first.
      levers: true,
      // The activity's own check (`raceMiss`) on a tap, and the same ids as each spoken item's known misses (`raceSpokenMisses`).
      misses: missLists<RaceTrackMiss>({ observe: ['ahead_not_fastest', 'slower_racer'],
        predict: ['fastest_not_winner', 'head_start_not_winner', 'slower_racer'],
        measure: ['read_position', 'farther_total', 'other_racer', 'off_by_one', 'shorter_total', 'added', 'time_as_distance'],
        calculate: ['ignored_start', 'farther_racer', 'distance_as_speed', 'multiplied'],
        graph: ['highest_line', 'ignored_start', 'read_position', 'distance_as_speed', 'slower_racer'] }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'gravity-drop-tower',
    description: 'Drop tower where the learner reasons about falling objects before seeing the answer. A canvas tower drops objects (a bowling ball, a feather, a flat or crumpled sheet of paper, a rock...) in ordinary air or in a tube with the air pumped out, from heights code chooses. Five eval modes: observe (drop and watch, then tell which landed first or whether it sped up), predict (which of two lands first, and on hard items why, before the drop), compare (put three drops from different heights in landing order), measure (read a stopwatch table to find the fall time for a new height, or the height for a new time), calculate (h = ½gt²: fall time, drop height, impact speed). Every item, choice and key is built by code from one physics model; outside observe the drop runs after the answer is credited, and wrong choices are the classic errors (heavier falls faster, air ignored, time grows in step with height, the ½ or the square root left out). Busts the misconception that heavier objects fall faster. ESSENTIAL for K-5 Physical Science: gravity pulls objects down (5-PS2-1), forces and motion (3-PS2-2), extends to MS free fall.',
    constraints: 'Best for K-8. Use observe for K-1, predict for 1-3, compare for 2-4, measure for 4-5, calculate for 6-8. Air is set per item by code (no learner air toggle); measure and calculate are without air.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'observe', label: 'Observe (K-1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['observe'], affordances: { answers: ['tap', 'spoken'] },
        description: 'Drop two objects (or one) and watch, then tell which reached the ground first, that they landed together, or whether it sped up as it fell' },
      { evalMode: 'predict', label: 'Predict (1-3)', beta: 3.0, scaffoldingMode: 2, challengeTypes: ['predict'], affordances: { answers: ['tap', 'spoken'] },
        description: '"Which lands first, the bowling ball or the feather?" said before the drop, with or without air; hard items also give the reason' },
      { evalMode: 'compare', label: 'Compare (2-4)', beta: 4.5, scaffoldingMode: 3, challengeTypes: ['compare'], affordances: { answers: ['tap'] },
        description: 'Three objects let go together from different heights: tap them in landing order (mass against height; on hard items air against height)' },
      { evalMode: 'measure', label: 'Measure (4-5)', beta: 6.0, scaffoldingMode: 4, challengeTypes: ['measure'], affordances: { answers: ['tap', 'spoken'] },
        description: 'From a stopwatch table of measured drops, choose the fall time for a new height (4 or 9 times as high), or the height for a new fall time' },
      { evalMode: 'calculate', label: 'Calculate (6-8)', beta: 7.5, scaffoldingMode: 6, challengeTypes: ['calculate'], affordances: { answers: ['tap', 'spoken'] },
        description: 'Use h = ½gt² to find a fall time, a drop height, or the speed at the ground' },
    ],
    tutoring: {
      taskDescription: 'Student is at a gravity drop tower ({{mode}}), item {{itemIndex}} of {{totalItems}}: {{ask}} Choices: {{choices}}. Attempt {{attemptNumber}}.',
      contextKeys: ['mode', 'itemIndex', 'totalItems', 'ask', 'choices', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What pulls each of these objects down? Is anything pushing back on them as they fall?"',
        level2: '"Is there air in the tower? Which of the two would the air push back on harder for its weight?"',
        level3: '"Look at the table: when the height went up, how many times did the time go up?"',
      },
      commonStruggles: [
        { pattern: 'Student thinks heavier objects fall faster', response: 'Ask what happens with no air at all, and whether they have seen two different objects dropped together.' },
        { pattern: 'Student confuses air resistance with no-air results', response: 'Ask the learner to check whether the tower has air in it, and which object the air would slow more.' },
        { pattern: 'Student cannot connect height to fall time', response: 'Point to two rows of the table and ask how many times the height and how many times the time changed.' },
        { pattern: 'Student struggles with h = ½gt² formula', response: 'Ask which quantity is unknown and which are given, then how to get it alone in h = ½gt².' },
      ],
    },
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Code builds and checks every item, and you are not told the key. Observe: the learner presses Drop (Slow motion is '
        + 'theirs) and then says or taps what they saw; the choices open after the first drop, and no time or speed is printed. '
        + 'Predict: which of two lands first (hard items: and why), said or tapped before anything falls. Compare: the learner taps '
        + 'three objects in landing order. Measure: from a stopwatch table, the fall time for a new height or the height for a new '
        + 'time. Calculate: h = ½gt² for a time, a height or the speed at the ground. Outside observe the drop runs only after the '
        + 'answer is credited. Faint lines mean air in the tower; the tube with no air has none. Never say which object lands '
        + 'first, that they land together, that weight does or does not matter here, or which value or order is right; never ask '
        + 'a yes-or-no question that settles it ("does the air slow the feather?"). In observe never word a question or a '
        + 'description so it assumes one object lands first or that they fall together ("which one touches the ground first?", '
        + '"as they fall together", "side by side"); ask what the learner saw when they reached the ground. In measure never say '
        + 'how many times the asked height is, or that the time goes with a square root ("what times itself makes nine?"); ask '
        + 'how the rows compare. After a miss never say what the wrong answer came from or which step was left out. Ask what '
        + 'pulls each object down, what pushes back, and what the drop or the table showed. Describe a lever card only as the '
        + 'scene does, never as the conclusion. You cannot drop, tap or check for the learner.',
      // observe: slow_replay; predict: air_arrows (air items), moon_card, outcome_only (reason items); compare: air_arrows (air),
      // same_look (no air, different masses), fall_lines, two_drops; measure: pattern_line, one_row; calculate: formula_card,
      // fill_in, time_first (impact items) (`gravityDropLevers.ts`). Every miss of every mode is answered by a help lever first.
      levers: true,
      // The activity's own check (`dropMiss`) on a tap or order, and the same ids as each spoken item's known misses (`dropSpokenMisses`).
      misses: missLists<GravityDropMiss>({
        observe: ['heavier_first', 'lighter_first', 'said_together', 'slowed_first', 'said_steady', 'said_slowed'],
        predict: ['heavier_first', 'lighter_first', 'shape_first', 'ignored_air', 'slowed_first', 'heavier_reason', 'air_when_none'],
        compare: ['ranked_by_mass', 'ignored_air', 'reversed', 'other_order'],
        measure: ['linear_scaling', 'kept_value', 'added_step'],
        calculate: ['forgot_half', 'no_root', 'not_squared', 'gave_time'] }),
    },
  },
  // Additional physics primitives will be added here
  // Examples could include:
  // - force-diagram (visualize forces with arrows and magnitude)
  // - motion-simulator (position, velocity, acceleration graphs)
  // - energy-converter (potential/kinetic energy transformations)
  // - wave-simulator (frequency, amplitude, wavelength)
  // - circuit-builder (series/parallel circuits, Ohm's law)
  // - collision-lab (elastic/inelastic collisions, momentum conservation)
  // - pendulum-lab (period, energy transfer, simple harmonic motion)
  // - inclined-plane (forces on slopes, friction)
  // - projectile-motion (trajectory, range, max height)
  // - spring-oscillator (Hooke's law, oscillation)
];
