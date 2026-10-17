/**
 * Astronomy Catalog - Component definitions for astronomy primitives
 *
 * Contains astronomy and space science visualizations for K-5 science education.
 */

import { ComponentDefinition } from '../../../types';
import type { SpokenSolarMiss } from '../../../primitives/visual-primitives/astronomy/solarSystemWorkspace';
import type { ShadowMiss } from '../../../primitives/visual-primitives/astronomy/lightShadowWorkspace';
import type { PlanetMiss } from '../../../primitives/visual-primitives/astronomy/planetaryExplorerWorkspace';
import type { ConstellationMiss } from '../../../primitives/visual-primitives/astronomy/constellationWorkspace';
import type { TelescopeMiss } from '../../../primitives/visual-primitives/astronomy/telescopeWorkspace';
import type { OrbitMiss } from '../../../primitives/visual-primitives/astronomy/orbitWorkspace';
import type { RocketMiss } from '../../../primitives/visual-primitives/astronomy/rocketWorkspace';
import { missLists } from './missLists';

export const ASTRONOMY_CATALOG: ComponentDefinition[] = [
  {
    id: 'solar-system-explorer',
    description: 'Interactive solar system model with accurate orbital mechanics, zoom controls, and planet details. Students explore planetary motion, compare sizes and distances, watch orbits in real-time, and discover facts about each celestial body. Features dynamic zoom from full system view down to individual planets, adjustable time scale to speed up orbital motion, and multiple scale modes (size-accurate, distance-accurate, hybrid) to teach the challenge of representing space at scale. Shows the habitable zone (Goldilocks zone) for astrobiology concepts. Includes all 8 planets plus optional dwarf planets (Pluto, Ceres, Eris) for advanced grades. Perfect for K-5 astronomy, NGSS space science standards, and next-generation science education. ESSENTIAL for teaching solar system structure, planetary motion, and scale of space. Assessment runs as LIVE-JUDGED direct instruction: the tutor asks about the sky out loud and the student answers OUT LOUD with a planet\'s name — tapping and zooming stay free as research on the model. Requires a microphone.',
    constraints: 'Best for grades K-5. Learning progression: K (planet names, order, Earth), 1 (inner vs outer, sizes), 2 (orbits, day/year), 3 (moons, rings, AU), 4 (orbital periods, distances), 5 (Kepler\'s laws, gravity, habitable zone). K-2: Show inner planets only or use hybrid scale mode for visibility. 3-5: Include all 8 planets, dwarf planets optional for grade 5. Use initialZoom to control starting view: "inner" for K-1, "system" for 2-5. Enable showDistances and showHabitableZone for grades 3+. Increase timeScale for younger grades (faster = more engaging). Assessment is SPOKEN (DI judged loop, microphone required): every eval mode is answered by saying a planet\'s name to the Live tutor, whose own affirmation advances the session — there is no confirm button, no Next button, and no attempts ladder.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Name It (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        // β HELD despite recognition → production: the DI correction models the
        // name and re-elicits (model–lead–test), so the effective demand at K —
        // the band this mode serves — is echo-then-own, not cold recall. The
        // vocabulary the K objective is ABOUT now leaves the child's mouth,
        // which is the standard, not a difficulty tier.
        description: 'say the name of the planet the model spotlights — planet-name production, judged by the Live tutor',
      },
      {
        evalMode: 'order_from_sun',
        label: 'Order from the Sun (Tier 2)',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['order_from_sun'],
        // β HELD — the cognitive act (read position off the rings) is unchanged;
        // only the answer channel moved from a tap to the planet's spoken name.
        description: 'say the planet at a position out from the Sun — closest, farthest, or the Nth',
      },
      {
        evalMode: 'classify',
        label: 'Sort the Planets (Tier 3)',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['classify'],
        // β HELD — same category rule, spoken member instead of tapped member.
        description: 'say the name of any member of a named category — rocky planet, gas giant, dwarf planet',
      },
      {
        evalMode: 'compare_attribute',
        label: 'Compare Planets (Tier 4)',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['compare_attribute'],
        // β HELD — comparison across bodies is the demand either way. The DI
        // port adds named-pair items (which one is bigger, A or B) beside the
        // extremes, same skill at the same rung.
        description: 'say the planet that wins one attribute — biggest, smallest, hottest, most moons, or the bigger of a named pair',
      },
      {
        evalMode: 'orbital_reasoning',
        label: 'Orbits & Years (Tier 5)',
        beta: 8.0,
        scaffoldingMode: 6,
        challengeTypes: ['orbital_reasoning'],
        // β HELD — the distance↔period relationship is the demand; pair items
        // (which goes around faster) join the extremes at the same rung.
        description: 'say the planet by its orbital period — the longest year, the quickest trip, or the faster of a named pair',
      },
    ],
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'LIVE-JUDGED solar system practice (DI modality) under a moving model of the planets: you ask '
        + 'about the sky with scripted lines sent as cues, the child answers OUT LOUD with a planet\'s '
        + 'name, you judge what you heard, and your own affirmation is what advances the lesson. '
        + 'Current challenge type: {{challengeType}} (the special type free_explore means there is no '
        + 'judged loop — the child is exploring and you follow the FREE EXPLORATION directive instead). '
        + 'The question side of what is on screen, described for you alone and never read aloud: {{stimulus}}.',
      contextKeys: ['challengeType', 'stimulus'],
      // ⚠️ 18d, applied at conversion: no level of this ladder may OFFER a
      // speakable line of its own. A quoted hint here is a sanctioned-sounding
      // replacement for the scripted correction at exactly the moment the model
      // wants one — it opens with neither sentinel, so the engine sees no
      // verdict and the correction counter stalls. The ladder commands script
      // fidelity; it never supplies an alternative.
      scaffoldingLevels: {
        level1: 'Repeat the current scripted ask exactly once, a little slower. Never name a planet of your own and never describe one.',
        level2: 'A wrong answer is never met with a hint of your own — speak the cue\'s scripted "My turn:" correction again, exactly as written, even if you just said it.',
        level3: 'If the child stays stuck, stay with the script: the correction line names the planet and re-asks for you. Never invent encouragement, a new question, or a softer hint.',
      },
      commonStruggles: [
        {
          pattern: 'Long silence',
          response: 'Silence is the child looking at the sky and thinking — the wait is theirs. If they truly seem stuck, re-speak the current ask once; never answer for them.',
        },
        {
          pattern: 'Names the Sun when a question asks for a planet',
          response: 'That is wrong, and the scripted correction is how it is taught: speak it exactly. The star/planet line is part of the lesson, not a technicality to wave through.',
        },
        {
          pattern: 'Answers with a description instead of a name ("the red one", "that one")',
          response: 'A description with no name does not answer the question, so it is wrong: speak the scripted correction, which names the planet and asks again.',
        },
        {
          pattern: 'Taps planets and zooms around while the question is open',
          response: 'That is the child LOOKING — research on the model, never an answer. Stay silent while they look, and judge only what they say.',
        },
        {
          pattern: 'The same wrong answer comes twice in a row',
          response: 'Speak the SAME scripted "My turn:" correction again, word for word. Repetition is the method — never swap it for a paraphrase or a hint.',
        },
        {
          pattern: 'Thinks the planets are lined up in a row, or as crowded as they look on screen (free exploration only)',
          response: 'In free exploration, name the trade-off in child words: on screen they sit close and tidy so we can see them, but in real space they are spread all around the Sun, far emptier and almost never in a line. During a judged item, stay with the script and let the scripted lines carry the turn.',
        },
      ],
      aiDirectives: [
        {
          title: 'THE OPENING LINE ALREADY SAYS HOW TO PLAY',
          instruction:
            'Your first cue contains a scripted opening line with the how-to-play inside it. Speak that line exactly. '
            + 'Never invent a greeting, add instructions, or ask a question of your own before or after it.',
        },
        {
          title: 'WHAT COUNTS AS AN ANSWER — A PLANET\'S NAME, SAID OUT LOUD',
          instruction:
            'The current type is {{challengeType}}, and every cue states its own item\'s contract. On every judged type the answer is ONE '
            + 'planet name spoken aloud — the spotlighted planet\'s name (identify), the planet at a position from the Sun (order-from-sun), '
            + 'any member of the named category (classify), the winner of an attribute or of a named pair (compare-attribute), or the planet '
            + 'picked by its trip around the Sun (orbital-reasoning). The cue names the correct answer, the wrong answer most likely to sound '
            + 'right, and what to accept — judge by that cue and nothing else. A tap on the model is the child LOOKING, never an answer. '
            + 'THE LAW, on every type: never say the answer, or any part of it, before the child has answered. The answer belongs to the correction.',
        },
        {
          title: 'THE VERDICT ENDS THE TURN',
          instruction:
            'An affirmation is the WHOLE turn. After it, stop speaking — never carry on into another question, another planet, or the next item, '
            + 'even one you can see on the screen. The next ask always arrives as its own cue.',
        },
        {
          title: 'THE CHILD IS THINKING — WAIT',
          instruction:
            'Think time is unbounded. Never fill a silence, never describe the sky out loud, and never prompt while the child is looking. The silence is theirs.',
        },
        {
          title: 'SENTINEL DISCIPLINE',
          instruction:
            'Every affirmation begins with "Yes" and EVERY correction begins with "My turn:" exactly as the cue scripts. '
            + 'Never begin any other sentence with either opener.',
        },
        {
          title: 'HEAR-THE-QUESTION ON DEMAND',
          instruction:
            'The child can ask to hear the question again ([SOLAR_HEAR]). That re-speaks the QUESTION only — speak the scripted line you are given, '
            + 'treat nothing you just heard as an answer, and never say the answer.',
        },
        {
          title: 'FREE EXPLORATION (challenge type free_explore ONLY)',
          instruction:
            'When the challenge type is free_explore there is no judged loop and no scripted cues: the child taps planets to hear about them. '
            + 'On [SOLAR_ORIENT], say in one or two warm child-sized sentences that these are the planets going around our Sun, and that they can tap one to hear about it — that IS your greeting. '
            + 'On [SOLAR_BODY_SELECTED], say the body\'s name and one short child-sized thing about it. '
            + 'On [SOLAR_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'NEVER speak a measurement to a pre-reader — no kilometres, no AU, no degrees Celsius, no day counts. Say "the biggest one", "really really hot", "it takes a long time to go around" instead. '
            + 'Scale honesty: this model cannot show size and distance truthfully at once — when a child concludes the planets are crowded together, name the trade-off in child words.',
        },
        {
          title: 'NEVER READ BRACKET TAGS',
          instruction:
            'Text in [BRACKETS] and instruction text outside quoted lines is stage direction for you. It is never spoken.',
        },
      ],
    },
    supportsEvaluation: true,
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'A live model of the Sun and planets; every answer is one planet name said out loud, computed from the bodies '
        + 'on screen (classify accepts any one member of the kind). Tapping, zooming or panning is looking, never an answer. '
        + 'Identify: one planet glows and no planet wears its name, so the name is the whole answer. Pair questions light the '
        + 'two planets being compared. From Grade 2 a tap opens the card of facts for that planet; a Kindergarten or Grade 1 '
        + 'learner has no cards and does not read, so say the question aloud. The Sun is a star, not a planet answer. A '
        + 'colour or "that one" with no name does not answer. Before an attempt never say the answer or describe the '
        + 'planets for them, and never point them to the ring or place in the sky where the answer is. You cannot move a planet '
        + 'or mark one yourself; only a pulled lever changes the picture.',
      // In-item levers (`solarSystemLevers.ts`): star mark, close-up, models beside the sky, size row, fact strip, easier items.
      levers: true,
      // Every item is one spoken planet name: its known wrong answers (`solarSpokenMisses`, handoff 20 Part B).
      misses: missLists<SpokenSolarMiss>({ identify: ['said_sun', 'neighbour_planet', 'other_planet'],
        order_from_sun: ['said_sun', 'signature_planet', 'other_planet'], classify: ['said_sun', 'signature_planet', 'other_planet'],
        compare_attribute: ['said_sun', 'signature_planet', 'other_planet'], orbital_reasoning: ['said_sun', 'signature_planet', 'other_planet'] }),
    },
  },
  {
    id: 'scale-comparator',
    description: 'Interactive scale comparison tool for celestial objects that helps students grasp mind-bending cosmic scales through familiar references. Students compare sizes, distances, masses, and light-travel times side-by-side, overlay familiar objects (basketball, car, football field) for context, and create scale models with "if Sun were basketball..." scenarios. Features progressive difficulty from K (Earth vs Moon) to Grade 5 (light-year calculations). Includes D3 zoom controls to explore extreme size ratios, reference object library with everyday items for visceral understanding, and dynamic ratio calculations showing "Jupiter is 11× wider than Earth". Scale model builder (Grades 4-5) enables hands-on calculation practice with interactive placement. Walk-through mode (Grades 3-5) visualizes distances with speed controls from walking to light speed. ESSENTIAL for developing spatial reasoning and scale comprehension across astronomy curriculum.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K: 2-3 objects (Earth, Moon), size only, no ratios, everyday references (balls). Grade 1: 3-4 planets, size comparisons, sport ball equivalents. Grade 2: Sun emphasis, integer ratios, "Sun is 109× Earth!". Grade 3: 5-6 planets, add distance mode, walk-through feature, football field references. Grade 4: All 8 planets, scale model builder, AU units, complex calculations. Grade 5: 8+ objects including Voyager/stars, light-travel time mode, scientific notation, geographic references. Use compareType to focus learning: "size" for K-2, "distance" for 3-4, "time" for 5. Enable interactiveWalk for grades 3+. Scale model builder for grades 4-5 only. showRatios should be false for K-1, true for 2+. Always enable showFamiliarEquivalent for all grades. Reference objects auto-filtered by grade appropriateness.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap'], role: 'visualize', minutes: 5 },
    tutoring: {
      taskDescription:
        'Student is comparing how big things are in space ("{{title}}"). Comparing by: {{compareType}}. '
        + 'Objects they can pick from: {{availableObjects}}. Side by side right now: {{comparedObjects}} '
        + '({{comparedCount}} of them). The biggest one on screen is {{biggestObject}}. '
        + 'They tap objects to add them to the comparison and see the sizes drawn next to each other.',
      contextKeys: [
        'title',
        'compareType',
        'gradeLevel',
        'availableObjects',
        'comparedObjects',
        'comparedCount',
        'biggestObject',
      ],
      scaffoldingLevels: {
        level1: '"Tap two things to put them next to each other. Which one do you think will be bigger?"',
        level2: '"You are looking at {{comparedObjects}}. Look at the two circles — which one takes up more room?"',
        level3: '"Put them side by side and look at the picture, not the words. The bigger circle is the bigger object. {{biggestObject}} is the biggest one you have on screen right now."',
      },
      commonStruggles: [
        {
          pattern: 'Student thinks the object drawn bigger on screen is closer, not larger',
          response: '"Here the bigger circle means it really IS bigger — not closer. This picture is about size only."',
        },
        {
          pattern: 'Student is surprised the Sun dwarfs everything and thinks it is a mistake',
          response: '"It is not a mistake — the Sun really is that much bigger than everything else. That is one of the most surprising things about space."',
        },
        {
          pattern: 'Student picks many objects at once and the small ones become invisible',
          response: '"When something huge is on screen, the little ones get very tiny. Try taking the big one off and comparing just the two small ones."',
        },
        {
          pattern: 'Student guesses without looking at the drawing',
          response: '"Do not guess — look at the two circles. Point to the one that takes up more room on the screen."',
        },
        {
          pattern: 'A pre-reader cannot read the object names or any of the numbers',
          response: '"Never ask them to read. Say the object names aloud, and compare with words a child owns — \'much bigger\', \'tiny next to it\', \'about the same\'. Never say kilometres or a times-bigger number."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the object names, the size figures, or the fun fact. Your voice is the only channel. '
            + 'When you receive [SCALE_ORIENT], say in one or two warm child-sized sentences that they can tap things to put them side by side and see which is bigger. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [SCALE_OBJECT_ADDED], say the object name and how it LOOKS next to what is already there, in ONE short sentence. '
            + 'When you receive [SCALE_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'NEVER give a pre-reader a measurement or a ratio — no kilometres, no AU, no "eleven times bigger". '
            + 'Compare with words they own: "much bigger", "tiny next to it", "about the same".',
        },
        {
          title: 'COMPARISON IS THE ANSWER, NOT THE NUMBER',
          instruction:
            'The learning here is the visual comparison, so let the picture do the work. '
            + 'If a student asks which is bigger, turn it back to the drawing ("look at the two circles — which takes up more room?") before confirming. '
            + 'Never lead with a ratio or a figure at any grade; name it only after the student has seen the difference.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'day-night-seasons',
    description: 'Interactive Earth model showing how rotation creates day/night and how tilted orbit creates seasons. Critical for correcting the common misconception that seasons come from distance to Sun. Students spin Earth to see day/night terminator move, position Earth at different orbital points (equinoxes, solstices), observe how 23.5° tilt affects sunlight angle, place markers at different latitudes, track hours of daylight, and view from multiple perspectives (space north, space side, surface, sun view). Features real-time daylight hour calculations for any latitude, animated rotation and orbital motion, temperature zone visualization (tropical, temperate, polar), and parallel sun ray display. Progressive learning from K (day happens when we spin toward Sun) to Grade 5 (Arctic 24-hour daylight, latitude effects on seasons). D3-powered smooth animations with adjustable time speed. Includes guided questions to check understanding and correct misconceptions. ESSENTIAL for NGSS space science standards, addressing day/night cycle and seasonal patterns.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K: Focus on day/night only, 2-3 familiar locations, simple questions ("When is it daytime?"), fast animation (8x speed), no tilt axis shown. Grade 1: Day/night emphasis, "Sun doesn\'t move—we do!", 2-3 locations, 7x speed. Grade 2: Introduce both concepts, show tilt axis, 3 locations including equator, both rotation and orbit animation. Grade 3: Seasons focus, emphasize TILT not distance, show hemisphere differences, 3-4 locations with varied latitudes, orbital animation. Grade 4: Both day/night and seasons, equinox vs solstice, temperature zones, 4-5 locations including polar region, complex questions. Grade 5: Advanced concepts (Arctic phenomena, latitude effects), all visual elements enabled, scientific questions. Set focusMode: "day-night" for K-1, "seasons" for 3, "both" for 2,4-5. Use viewPerspective: "space_side" (best for showing tilt). Enable showTiltAxis for grades 2+. Enable showTemperatureZones for grades 4-5 only. Always include markerLatitudes with VARIED latitudes (equator, mid-latitude, polar for 4-5). Initial position should match current season or learning focus. Essential for teaching that seasons are caused by tilt, NOT distance from Sun.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['manipulate', 'tap'], role: 'visualize', minutes: 5 },
    tutoring: {
      taskDescription:
        'Student is exploring "{{title}}" — an Earth model that shows why we have day and night, and why we have seasons. '
        + 'Focus: {{focusMode}}. View: {{viewPerspective}}. It is currently {{timeOfDayAtMarker}} at {{primaryLocation}}. '
        + 'Earth is at {{orbitalPosition}} in its orbit. Animation: {{animationState}}. '
        + 'They spin Earth with their finger, move it around its orbit, and watch the lit half change.',
      contextKeys: [
        'title',
        'focusMode',
        'viewPerspective',
        'gradeLevel',
        'primaryLocation',
        'timeOfDayAtMarker',
        'orbitalPosition',
        'animationState',
        'daylightHours',
      ],
      scaffoldingLevels: {
        level1: '"Spin the Earth with your finger and watch the dark part move. What happens to {{primaryLocation}}?"',
        level2: '"Look at {{primaryLocation}} right now — it is {{timeOfDayAtMarker}} there. Keep spinning and watch it move into the light, then back into the dark."',
        level3: '"The Sun shines on only one half of Earth at a time, like a flashlight on a ball. The half facing the Sun has day; the half facing away has night. Earth spins all the way around once every day, so every place takes a turn in the light."',
      },
      commonStruggles: [
        {
          pattern: 'Student says the Sun moves across the sky / goes down at night',
          response: '"It really looks that way! But watch the Sun on the screen — it stays still. It is the Earth that is spinning. We are the ones moving, and that is what makes the Sun look like it goes up and down."',
        },
        {
          pattern: 'Student says seasons happen because Earth gets closer to the Sun',
          response: '"That is the most common idea, and it is not what happens. Look at the orbit — Earth stays about the same distance the whole way around. It is the TILT that matters: the tilted half leaning toward the Sun gets more direct light, and that is summer."',
        },
        {
          pattern: 'Student thinks the whole Earth is dark at night',
          response: '"Look at the whole ball. Half of it is always lit and half is always dark — at the same time. When it is night where you are, it is daytime for someone on the other side."',
        },
        {
          pattern: 'Student spins the Earth fast without watching what changes',
          response: '"Stop it right there for a second. Look at {{primaryLocation}}. Is it in the light or in the dark right now?"',
        },
        {
          pattern: 'A pre-reader cannot read the location names, the hour readouts, or the labels',
          response: '"Never ask them to read. Say the place name for them, and describe what they see in child words — \'it is dark where they live now\', \'now they are turning into the sunshine\'. They spin the Earth with a finger."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the title, the location names, the hour readouts, or any label on this screen. Your voice is the only channel. '
            + 'When you receive [EARTH_ORIENT], say in one or two warm child-sized sentences that they can spin the Earth with their finger and watch the dark part move. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [EARTH_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, warmly and slowly, then wait. '
            + 'Never read a number of hours to a pre-reader — say "a long time" or "just a little while" instead.',
        },
        {
          title: 'PLACE NARRATION (stay quiet while they explore)',
          instruction:
            'When you receive [EARTH_LOCATION_SELECTED], the student has chosen a place to watch. '
            + 'The message tells you whether it is DAYTIME or NIGHT there on screen right now. '
            + 'Say ONE short sentence naming the place and which it is ("Right now it is night-time in New York"). '
            + 'Do NOT ask a question, do NOT add a fact, and do NOT speak again until another moment fires. '
            + 'Nothing fires while they are spinning the Earth, so never narrate a moving Earth.',
        },
        {
          title: 'THE TILT, NOT THE DISTANCE',
          instruction:
            'This primitive exists largely to correct one misconception: that seasons come from Earth being closer to or further from the Sun. '
            + 'Whenever seasons come up, anchor on the TILT. Never say "closer" or "farther" as a cause, even loosely, even as a thing to reject in passing — '
            + 'a young child remembers the phrase and loses the correction.',
        },
      ],
    },
  },
  {
    id: 'moon-phases-lab',
    description: 'Interactive Earth-Moon-Sun model that explains why the Moon appears to change shape through the lunar cycle. Students position Moon in orbit around Earth, view from Earth\'s surface (how Moon looks in the sky), view from space (orbital geometry showing why phases occur), match phase to orbital position, predict next phase in sequence, track full 29.5-day cycle with animation, and understand tidal locking (why same side always faces us). Features dual-view mode (Earth view + space view), smooth D3 animations of lunar orbit, interactive dragging to explore phases, illumination percentage display, day-in-cycle counter, and challenge mode to identify specific phases. Corrects common misconception that phases are caused by Earth\'s shadow (that\'s eclipses, not phases!). Progressive learning from K (Moon looks different) to Grade 5 (tidal locking, eclipse geometry). ESSENTIAL for NGSS space science standards on Moon phases and lunar cycles.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K: from_earth view only, focus on "Moon looks different on different nights", no orbital diagram, fast animation (8x speed), 1-2 simple questions. Grade 1: from_earth view, introduce phase names and sequence, show phase emojis as labels. Grade 2: split_view to show Moon orbits Earth, introduce orbital path, explain ~1 month cycle. Grade 3: split_view, show sun direction arrows, emphasize geometry NOT Earth\'s shadow, match phase to position. Grade 4: split_view with all features, predict phases, introduce tidal locking concept, calculate illumination percentage. Grade 5: All features enabled, tidal locking explanation, eclipse geometry hints, scientific vocabulary. Set viewMode: "from_earth" for K-1, "split_view" for 2-5. Enable showSunDirection for grades 2+. Enable showTidalLocking for grades 4-5 only. Enable phaseLabels for all grades (use emojis for K-1, text for 2-5). Always enable interactivePosition for hands-on exploration. Use animateOrbit with cycleSpeed 8 for K-1, 5 for 2-3, 3-4 for 4-5. Optional challengePhase for assessment (ask student to find specific phase). Critical teaching point: Phases are NOT caused by Earth\'s shadow!',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['manipulate', 'tap'], role: 'visualize', minutes: 5 },
    tutoring: {
      taskDescription:
        'Student is exploring why the Moon looks different on different nights, using an Earth-Moon-Sun model ("{{title}}"). '
        + 'View: {{viewMode}}. The Moon is right now showing {{currentPhaseName}} ({{currentPhaseEmoji}}) — {{currentPhaseDescription}}. '
        + 'They have found {{phasesExplored}} of {{totalPhases}} phases. Challenge: {{challengeTask}}. '
        + 'They move the Moon by dragging it, sliding the position control, or tapping a phase button, and can play the orbit animation.',
      contextKeys: [
        'title',
        'viewMode',
        'gradeLevel',
        'currentPhaseName',
        'currentPhaseEmoji',
        'currentPhaseDescription',
        'phasesExplored',
        'totalPhases',
        'challengeTask',
        'isAnimating',
        'illumination',
      ],
      scaffoldingLevels: {
        level1: '"Move the Moon around Earth and watch the Moon picture change. What do you notice about how much of it is bright?"',
        level2: '"Right now the Moon looks like {{currentPhaseEmoji}} — that is called {{currentPhaseName}}. Keep moving it slowly and watch the bright part grow and shrink."',
        level3: '"The Sun always lights up one half of the Moon. What changes is how much of that bright half we can see from Earth. Move the Moon slowly all the way around and watch the bright part go from none, to half, to all, and back again."',
      },
      commonStruggles: [
        {
          pattern: 'Student says the phases are caused by Earth\'s shadow falling on the Moon',
          response: '"That is what a lot of people think, but look closely — the Moon is not in Earth\'s shadow. The Sun lights up half the Moon all the time. We just see that bright half from different sides as the Moon goes around us. Earth\'s shadow on the Moon is something different, called an eclipse."',
        },
        {
          pattern: 'Student thinks the Moon actually changes shape or gets eaten',
          response: '"The Moon never changes shape — it is always a big round ball of rock. Watch the bright part and the dark part as you move it. The whole Moon is always there; we just cannot see the dark part."',
        },
        {
          pattern: 'Student drags the Moon fast and never stops to look at what changed',
          response: '"Stop right there for a second. Look at the Moon picture. How much of it is bright right now — none, a sliver, half, or all of it?"',
        },
        {
          pattern: 'Student cannot find the phase the challenge asked for',
          response: '"Do not worry about the name. Just think about the picture: how much of the Moon should be bright for that one? Move the Moon slowly and stop when it looks that way."',
        },
        {
          pattern: 'A pre-reader cannot read the phase names or the labels on screen',
          response: '"Never ask them to read. Say the phase name for them, describe the picture in child words (\'almost none of it is bright\', \'half bright, half dark\'), and tell them to move the Moon with their finger."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read anything on this screen — not the title, not the phase names, not the challenge. Pictures and your voice are the only channels. '
            + 'When you receive [MOON_ORIENT], say what to do in one or two warm child-sized sentences: they can move the Moon with their finger and watch how it changes. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [MOON_READ_ALOUD], READ ALOUD, word for word, exactly the text the message gives you, warmly and slowly, then wait. Do not summarize it and do not add a quiz. '
            + 'Never tell them which position or which button to tap — describe what the Moon should LOOK like instead.',
        },
        {
          title: 'PHASE NARRATION (stay quiet while they explore)',
          instruction:
            'When you receive [MOON_PHASE_SETTLED], the student has stopped moving the Moon and is looking at it. '
            + 'Say ONE short sentence: name the phase and describe the picture in child words (for example "That is a first quarter — half bright, half dark"). '
            + 'Do NOT ask a question, do NOT add a fact, and do NOT speak again until another moment fires. '
            + 'This message does not fire while the animation is playing, so never narrate a moving Moon.',
        },
        {
          title: 'CHALLENGE ANSWER DISCIPLINE',
          instruction:
            'When a challenge is active, the target phase is the QUESTION and you may say it out loud so a non-reader knows the task. '
            + 'You must NEVER say the orbit position, the degree number, or which phase button produces it. '
            + 'Describe the target by how it LOOKS ("half of it bright") so the student still has to find it by looking.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'rocket-builder',
    description: 'Rockets made of parts: each part shows its weight as grey blocks, each engine its push as orange arrows, fuel tanks are heavy, and some rockets drop each tank once it is empty. Every rocket, part and answer is built by code from one flight model, and nothing launches until the learner has answered, so each answer is a prediction, never a trial. Four tasks: predict whether a rocket lifts off the pad (a rocket lifts off only when its push is more than its weight); choose the one part to add so a grounded rocket lifts off (an engine adds its own weight too); choose the rocket that lifts off and costs no more than a budget of coins; and predict which of several rockets, differing in fuel, engine, weight or dropped tanks, flies the highest. ESSENTIAL for forces and spaceflight in K-5 and engineering criteria and constraints: what a rocket needs to lift off, why fuel is heavy, why rockets drop empty stages.',
    constraints: 'Best for grades K-5. K and Grade 1 MAY be routed here: can_it_lift is a count of blocks and arrows on one rocket and a tap (or a spoken yes or no), and the tutor reads the question; no total, ratio, unit or altitude is on screen. Code builds every item and answer; the manifest picks the topic, never the rockets. Default modes when nothing pins them: K-1 can_it_lift; Grade 2 adds add_to_lift; Grade 3 adds on_budget; Grades 4-5 all four. Not for action and reaction or which engines need air (propulsion-lab), or orbits after launch (orbit-mechanics-lab).',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    tutoring: {
      taskDescription: 'Student predicts what a rocket made of parts will do: {{ask}} (item {{itemIndex}} of {{totalItems}}, {{mode}}, grade {{gradeLevel}}).',
      contextKeys: ['gradeLevel', 'mode', 'itemIndex', 'totalItems', 'ask', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Look at the grey blocks and the orange arrows on each part. What do the blocks show? What do the arrows show?"',
        level2: '"Count all the weight blocks on the rocket, then all the push arrows. What has to be true for the rocket to go up?"',
        level3: '"A rocket lifts off only when its push is more than its weight. Use that on the rocket you see."',
      },
      commonStruggles: [
        { pattern: 'Thinks a rocket lifts off when push and weight are the same', response: '"If the push and the weight are the same, which one wins? Does anything move?"' },
        { pattern: 'Thinks the biggest engine or the most fuel is always the answer', response: '"What else does that part bring with it? Look at its grey blocks too."' },
        { pattern: 'Picks a rocket on budget without checking that it lifts off', response: '"There are two things to check for each rocket. What are they?"' },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the question or the buttons. When you receive [READ_CHALLENGE], read the question aloud, word for word, then wait. '
            + 'Never speak a unit to a pre-reader, and never say thrust, mass, ratio or altitude: say "push", "heavy", "weight blocks", "push arrows", "goes up".',
        },
        {
          title: 'NEVER NAME THE ANSWER',
          instruction:
            'Code checks every answer. Never say which choice, part or rocket is right, never say a total of blocks, arrows or coins, never say whether the push is more or less than the weight, and never rule a choice out. '
            + 'After a wrong answer, say what the screen shows, if a rocket launched, and ask what the learner noticed.',
        },
      ],
    },
    evalModes: [
      { evalMode: 'can_it_lift', affordances: { answers: ['tap', 'spoken'] }, label: 'Will it lift off? (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['can_it_lift'], description: 'Say or tap whether one rocket lifts off, from its parts\' weight blocks and its engines\' push arrows (hard: two engines to add up, push one away from weight or equal to it)' },
      { evalMode: 'add_to_lift', affordances: { answers: ['tap', 'spoken'] }, label: 'Add one part (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['add_to_lift'], description: 'Say or tap the one part (an engine, a fuel tank or a cargo box) that makes a grounded rocket lift off (hard: the engine with the biggest push is too heavy to help)' },
      { evalMode: 'on_budget', affordances: { answers: ['tap', 'spoken'] }, label: 'On budget (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['on_budget'], description: 'Say or tap the rocket that lifts off and costs no more than a budget of coins (hard: four rockets, one a coin over, the cheapest stays down)' },
      { evalMode: 'reach_target', affordances: { answers: ['tap', 'spoken'] }, label: 'Which flies highest (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['reach_target'], description: 'Say or tap which rocket flies highest (or least high), when they differ in fuel, engine, weight or dropping empty tanks (hard: the rocket with the most fuel is too heavy to lift off)' },
    ],
    // Shared teaching workspace (W1, plain shape): `rocketWorkspace.ts`, levers in `rocketLevers.ts`.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'Code builds and checks every item from its flight model; you are not told the key. Nothing launches until an '
        + 'answer is checked. Each part shows its weight as grey blocks and each engine its push as orange arrows; no total is '
        + 'drawn, and adding them up and comparing is the learner\'s work. Never say a total of blocks, arrows or coins, never '
        + 'say whether a rocket\'s push is more, less or the same as its weight, and never say which choice, part or rocket is '
        + 'right or rule one out. WILL IT LIFT OFF: the learner says yes or no, or taps. ADD ONE PART: never say that an '
        + 'engine is strong or weak enough, that a part only adds weight, or that the biggest engine is too heavy. ON BUDGET: '
        + 'never say which rocket is over budget or stays down. WHICH FLIES HIGHEST: never say that more fuel, a stronger '
        + 'engine, less weight or dropping tanks makes a rocket go higher or lower, or which rocket cannot lift off, unless a '
        + 'card the scene lists says it, and never send the learner to look for one feature (the rocket that drops its tanks, '
        + 'has the most fuel or the strongest engine, or that the card describes). You may ask what the blocks and arrows show and what the learner counts. After a wrong '
        + 'answer nothing launches, except the learner\'s own part in ADD ONE PART: never say a rocket stayed on the pad or flew, '
        + 'never say why the learner\'s pick was wrong (it cannot lift off, costs too much, flies lower), and never suggest a '
        + 'part, a rocket or a kind of part to try; ask the learner to check their pick. Never speak a unit to a K-1 learner. '
        + 'Describe a lever card only by what the scene says it shows. You cannot tap, check or launch for the learner.',
      levers: true,
      // The activity's own check (`rocketMiss`) on a tap, and the same ids as each spoken item's known misses.
      // Every miss is answered by a help lever (`rocketLevers.ts`): count_marks, lift_card, own_weight, fuel_card.
      misses: missLists<RocketMiss>({
        can_it_lift: ['said_equal_lifts', 'said_lifts', 'said_stays'],
        add_to_lift: ['heavy_engine', 'added_no_push', 'too_weak'],
        on_budget: ['fails_both', 'over_budget', 'no_lift'],
        reach_target: ['picked_no_lift', 'picked_lower', 'picked_higher'],
      }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'orbit-mechanics-lab',
    description: 'Newton\'s cannon with a rocket: the rocket is high above Earth\'s air and gets one sideways push, and gravity alone decides its path: it falls back, goes around in a circle, swings out in a stretched loop, or flies away. Every item, push, rocket and answer is built by code from real orbital physics, and nothing flies until the learner has answered, so the first answer is a prediction, never a trial. Four tasks: pick the push (drawn as an arrow) that makes the rocket fall back, circle or fly away; pick which of several rockets on round tracks moves fastest or slowest, or takes the shortest or longest trip around Earth; predict what a push forward or backward does to a circling rocket\'s path; and choose where and which way to fire once to turn a stretched loop into a circle. ESSENTIAL for orbits, gravity and spaceflight in K-5: why things in orbit do not fall down, why closer orbits are faster, and how a push changes an orbit.',
    constraints: 'Best for grades K-5. K and Grade 1 MAY be routed here: pick_speed is a tap (or a spoken word) on one of two to four push pictures (arrows), the asked outcome is shown as a picture too, and the tutor reads the question; there is no slider, number or unit on screen. Code builds every item and answer; the manifest picks the topic, never the questions. Default modes when nothing pins them: K-1 pick_speed; Grade 2 adds orbit_speed; Grade 3 adds predict_burn; Grades 4-5 all four. Not for the parts of a rocket or thrust and lift-off (rocket-builder), or planning a trip to another planet (mission-planner).',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    tutoring: {
      taskDescription: 'Student works out what gravity does with a rocket: {{ask}} (item {{itemIndex}} of {{totalItems}}, {{mode}}, grade {{gradeLevel}}).',
      contextKeys: ['gradeLevel', 'mode', 'itemIndex', 'totalItems', 'ask', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"What does gravity do to the rocket all the time? Now think about how fast it is going sideways."',
        level2: '"If it goes sideways only a little, where does gravity pull it? If it goes sideways really fast, can gravity still pull it back?"',
        level3: '"A rocket in orbit is falling the whole time, but it moves sideways so fast that it keeps missing Earth. Use that idea on the pushes you see."',
      },
      commonStruggles: [
        { pattern: 'Thinks there is no gravity in space', response: '"Gravity still pulls on the rocket up there. What would happen if it stopped moving sideways?"' },
        { pattern: 'Thinks the biggest push or the biggest rocket is always the answer', response: '"What does the question ask for? Could too much speed be a problem too?"' },
        { pattern: 'Thinks a rocket farther out must go faster', response: '"Where does Earth pull harder, close in or far out? What does a rocket close in need to keep from falling?"' },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the question or the button words. When you receive [READ_CHALLENGE], read the question aloud, word for word, then wait. '
            + 'Never speak a number, a speed or a unit to a pre-reader, and never say orbit, altitude or eccentricity: say "going around and around", "falls back down", "flies away".',
        },
        {
          title: 'NEVER NAME THE ANSWER',
          instruction:
            'Code checks every answer. Never say which push, rocket or choice is right, never say "the medium one" or point at a place in the row, and never rule a choice out. '
            + 'Never say what a push size does ("a small push falls") or which rocket is faster. After a wrong answer, say what the flight on screen showed, if one flew, and ask what the learner noticed.',
        },
      ],
    },
    evalModes: [
      { evalMode: 'pick_speed', affordances: { answers: ['tap', 'spoken'] }, label: 'Pick the push (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['pick_speed'], description: 'Say or tap the sideways push (an arrow) that makes the rocket fall back, go around in a circle or fly away; the asked outcome varies (hard: four pushes, a stretched loop beside the circle)' },
      { evalMode: 'orbit_speed', affordances: { answers: ['tap', 'spoken'] }, label: 'Which rocket (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['orbit_speed'], description: 'Say or tap the fastest or slowest rocket on its round track, or the one with the shortest or longest trip around Earth (hard: four tracks close together, rockets drawn at different sizes)' },
      { evalMode: 'predict_burn', affordances: { answers: ['tap', 'spoken'] }, label: 'Predict the burn (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['predict_burn'], description: 'Say or tap what a small or big push forward or backward does to a circling rocket\'s path (hard: all five outcomes offered)' },
      { evalMode: 'circularize', affordances: { answers: ['tap', 'spoken'] }, label: 'Make it a circle (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['circularize'], description: 'Say or tap where (near or far point) and which way to fire once to turn a stretched loop into a circle at a given height (hard: the height is a dashed circle, not named)' },
    ],
    // Shared teaching workspace (W1, plain shape): `orbitWorkspace.ts`, levers in `orbitLevers.ts`.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'Code builds and checks every item from the physics; you are not told the key. Nothing flies until an answer '
        + 'is checked. PICK THE PUSH: the pushes are arrows of different lengths; the learner says which, or taps one and presses '
        + 'Launch and check. Never say which push, never say what a push size does ("a small push falls back", "the medium one goes '
        + 'around"), never point at a place in the row, and never tell the learner to try a bigger, smaller, faster or slower '
        + 'push or say that more or less speed is needed. Ask what gravity does and what the learner thinks each push does. WHICH '
        + 'ROCKET: the rockets stand still on round tracks; the learner says or taps one. Never say which rocket is fastest or '
        + 'slowest or takes longest, never say that closer or farther rockets, or rockets pulled harder, go faster or slower, and '
        + 'never turn the question into which track is longest or shortest: ask where Earth pulls harder and stop there. PREDICT '
        + 'THE BURN: the learner says or taps what the push does to the path. Never say what a push forward or backward does, '
        + 'whether the loop grows, shrinks, falls or flies off, or what gravity does once the rocket is slower or faster. MAKE A '
        + 'CIRCLE: the learner says or taps where and which way to fire. Never say which point or which way, which side of the '
        + 'loop must move or in which direction, or which point a dashed circle touches, and never state what a push does to the '
        + 'other side of a loop unless a card the scene lists says it. After a miss, describe only what the flight on screen '
        + 'showed, if one flew, and ask what the learner makes of it. Never speak a number, speed or unit to a K-1 learner. '
        + 'Describe a lever card only by what the scene says it shows. You cannot tap, check or fly for the learner.',
      levers: true,
      // The activity's own check (`orbitMiss`) on a tap, and the same ids as each spoken item's known misses.
      // Every miss is answered by a help lever (`orbitLevers.ts`): throw_model, pull_card/same_size, speed_arrows,
      // mark_points/burn_card.
      misses: missLists<OrbitMiss>({
        pick_speed: ['picked_slower', 'picked_faster'],
        orbit_speed: ['picked_biggest', 'picked_farther', 'picked_closer'],
        predict_burn: ['wrong_way', 'said_no_change', 'too_strong', 'too_weak'],
        circularize: ['other_circle', 'wrong_way', 'wrong_place'],
      }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'mission-planner',
    description: 'Simplified mission design tool where students plan trips to the Moon, Mars, and beyond. Students select destinations on an interactive D3 solar system map, choose launch windows based on planetary alignment, plan trajectories (direct route vs gravity assist via other planets), pack supplies for crew (food, water, oxygen), estimate travel time, calculate fuel requirements, and monitor animated mission progress. Features progressive learning phases: explore destinations, plan route and timing, prepare supplies, and launch with real-time progress tracking. Includes interactive supply calculator for food/water/oxygen planning, launch window selection showing optimal planetary alignment, gravity assist trajectory visualization, mission clock with elapsed time, and destination info panels with fun facts. D3 solar system visualization shows orbital paths, planet positions, trajectory lines, and animated spacecraft icon. Progressive difficulty from K (pick a destination!) to Grade 5 (optimize fuel vs payload trade-offs with gravity assists and tight fuel constraints). ESSENTIAL for teaching space travel concepts, mission planning, supply logistics, and interplanetary navigation for K-5 astronomy.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K: 2-3 destinations (Moon, Mars), flyby mission, no trajectory/supplies/launch windows shown, focus on "we can visit other places in space". Grade 1: 3 destinations, showTrajectory enabled, missionClock enabled, focus on "different places take different times to reach". Grade 2: 3 destinations, supplyCalculator enabled with 3 items (food, water, oxygen), crewed: true, focus on "astronauts need food, water, and air". Grade 3: 4 destinations, showLaunchWindows with 3-4 options (one optimal), supplyCalculator with 4 items, focus on "can\'t launch anytime - planets move!". Grade 4: 4-5 destinations, gravityAssistOption enabled, all features active, missionType: "return", focus on "gravity assists give speed boosts from planets". Grade 5: All 5 destinations, tight fuelConstraint (30 tons), 5 supply types including science equipment, missionType: "return", focus on "trade-offs: speed vs fuel vs payload". Always provide age-appropriate hints and fun facts per destination.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap'], role: 'visualize', minutes: 8 },
    tutoring: {
      taskDescription:
        'Student is planning a space mission — "{{title}}". Grade rung: {{gradeLevel}}. '
        + 'They are in the {{currentPhase}} phase. Places they can choose from: {{destinationNames}}. '
        + 'Chosen so far: {{selectedDestination}}. Mission type: {{missionType}}. '
        + 'The instruction currently on screen reads: "{{phaseInstruction}}". '
        + 'At K-1 the whole task is choosing a place and watching the ship fly; supplies, launch windows and gravity assists are switched off.',
      contextKeys: [
        'title',
        'gradeLevel',
        'currentPhase',
        'destinationNames',
        'selectedDestination',
        'missionType',
        'phaseInstruction',
        'destinationCount',
      ],
      scaffoldingLevels: {
        level1: '"Where in space would you like to go? Any of them is a good choice."',
        level2: '"Some places are close to us and some are very far away. Which one do you want to see?"',
        level3: '"Let me tell you a little about each place, and then you pick the one you like best."',
      },
      commonStruggles: [
        {
          pattern: 'Student is waiting to be told the right destination',
          response: '"There is no wrong one here — this is YOUR mission. Pick the place you most want to see."',
        },
        {
          pattern: 'Student thinks the trip is instant, like in a cartoon',
          response: '"Real space trips take a long time. The Moon takes a few days. Mars takes months and months — longer than a whole school year."',
        },
        {
          pattern: 'Student thinks the spaceship flies in a straight line to a planet',
          response: '"The planets keep moving around the Sun, so the ship has to aim at where the planet is GOING to be, not where it is right now."',
        },
        {
          pattern: 'Student wants to fly to the Sun or somewhere impossible',
          response: 'Take the idea seriously and say warmly what would really happen, then steer to a place they can actually plan a trip to.',
        },
        {
          pattern: 'A pre-reader cannot read the instruction line or the destination names',
          response: '"Never ask them to read. Say the instruction aloud every time the phase changes, and name each place as they look at it. The words are yours to speak."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 1)',
          instruction:
            'A pre-reader CANNOT read the instruction line, the destination names, the travel times or the buttons. Your voice is the only channel. '
            + 'When you receive [MISSION_ORIENT], say what to do in one or two warm child-sized sentences — they are choosing a place in space to fly to. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [MISSION_PHASE_CHANGED], SAY the new instruction aloud in child words: the screen just changed and they cannot read what it now says. '
            + 'When you receive [MISSION_DESTINATION_SELECTED], say the name of the place they picked and one thing about it they can picture. '
            + 'When you receive [MISSION_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait.',
        },
        {
          title: 'THERE IS NO WRONG DESTINATION — DO NOT MANUFACTURE ONE',
          instruction:
            'Choosing where to go is a CHOICE, not an answer. Never imply one destination is the correct one, never ask "are you sure?" about a valid pick, and never steer them to the Moon because it is the easy trip. '
            + 'The real learning is that different places are different distances away, so once they choose, talk about how long THAT trip takes. '
            + 'Where a later phase does have a right answer — which launch window uses least fuel, at grade 3 and up — that one IS the answer: do not state it, and do not narrow it by elimination.',
        },
        {
          title: 'NO NUMBERS AT K-1 — SAY HOW LONG IT FEELS',
          instruction:
            'At grade rung K and 1 do NOT say kilometres, miles, tons, AU, or a count of days. The screen deliberately hides travel times at K, so saying them puts back what was taken out. '
            + 'Say "a few sleeps", "longer than the summer holidays", "really really far away". '
            + 'From grade 2 up the numbers ARE the objective — say them, and help the student compare them.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'telescope-simulator',
    description: 'A telescope eyepiece on the night sky with real objects (the Moon, planets, stars, star clusters, nebulae, galaxies), drawn as each looks through an instrument, from just your eyes to binoculars, small and large telescopes and a space telescope. Every item is built and keyed by code, and no object is named until the learner answers. Four tasks: find an unnamed object from a description of its look (a ball with a ring around it, a dot that twinkles); tap the brightest of a few objects drawn as bright as they shine (a big faint patch is not bright); say what kind of object is in the view; and pick the least powerful instrument that shows a named detail (Saturn\'s rings, craters on the Moon). ESSENTIAL for observational astronomy in Grades 2-5: what sky objects look like, apparent brightness, kinds of objects, and what telescopes reveal.',
    constraints: 'Best for grades 2-5. BAND FLOOR: Grade 2+ ONLY — do NOT route this to Kindergarten or Grade 1 under any topic. The asks, the instrument names and the kind names are written words, and the looks to match are described in words, so a pre-reader cannot work it even with the tutor reading aloud. For Kindergarten and Grade 1 astronomy route solar-system-explorer, day-night-seasons, or moon-phases-lab instead. Default modes when nothing pins them: Grade 2 find_by_look and brightest; Grade 3 adds object_type; Grades 4-5 all four.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'developing', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'find_by_look', affordances: { answers: ['tap'] }, label: 'Find by look (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['find_by_look'], description: 'Tap the unnamed object in the telescope view that matches a described look (hard: a look-alike shows every clue but one)' },
      { evalMode: 'brightest', affordances: { answers: ['tap'] }, label: 'Brightest (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['brightest'], description: 'Tap the brightest of 2-4 unnamed objects drawn as bright as they shine (hard: a big faint patch is drawn bigger than the brightest)' },
      { evalMode: 'object_type', affordances: { answers: ['tap', 'spoken'] }, label: 'Object type (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['object_type'], description: 'Say or tap what kind of object is in the view: moon, planet, star, star cluster, nebula or galaxy (hard: both look-alike kinds offered, seen through binoculars)' },
      { evalMode: 'pick_instrument', affordances: { answers: ['tap', 'spoken'] }, label: 'Pick the instrument (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['pick_instrument'], description: 'Say or tap the least powerful instrument that shows a named detail, from a code table (hard: four instruments to choose from)' },
    ],
    // Shared teaching workspace (W1, plain shape): `telescopeWorkspace.ts`, levers in `telescopeLevers.ts`.
    teachingWorkspace: {
      grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'Code builds and checks every item; you are not told the key. No object in the view is named until an '
        + 'answer is credited. FIND BY LOOK: the ask describes one object\'s look; the learner taps it and presses Check '
        + 'Answer. BRIGHTEST: the learner taps the brightest object; each is drawn as bright as it shines. Until credit, '
        + 'never say which object matches or is brightest, where it is, or that the big one is not the brightest; ask '
        + 'what the learner notices about each clue or each object. OBJECT TYPE: the learner says or taps what kind of '
        + 'object is in the middle. Never say its kind or its name, never say what a look means or which kind has it '
        + '("twinkling like a star", "a cloud like a nebula", "planets shine steadily"), and never rule a kind in or out; '
        + 'describe only what is drawn and ask about its shape, its edges and its light. PICK THE INSTRUMENT: the learner '
        + 'says or taps the least powerful instrument that still shows the named detail. Never say which instrument, what '
        + 'any instrument shows of this object, or how much magnifying the detail needs, and never point at a choice by its '
        + 'place in the order ("the least powerful one on your list", "one step up from your eyes"). After a miss, never say what the wrong pick was or why it was wrong. Describe a lever card only by '
        + 'what the scene says it shows. You cannot tap, check or point for the learner.',
      levers: true,
      // The activity's own check (`telescopeMiss`) on a tap, and the same ids as each spoken item's known misses.
      // Every miss is answered by a help lever (`telescopeLevers.ts`): clue_pictures, side_by_side, type_pictures, ladder.
      misses: missLists<TelescopeMiss>({
        find_by_look: ['near_match', 'shares_clue', 'other_object'],
        brightest: ['picked_biggest', 'picked_dimmer'],
        object_type: ['sharp_mixup', 'fuzzy_mixup', 'other_family'],
        pick_instrument: ['too_weak', 'too_strong'],
      }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'light-shadow-lab',
    description: 'Interactive shadow exploration lab where students manipulate a virtual sun to observe how shadow length, direction, and shape change throughout the day. Perfect for teaching light and shadow phenomena. ESSENTIAL for K-2 science (NGSS 1-ESS1-1).',
    constraints: 'Best for K-5. Requires understanding of directional vocabulary (East/West). Themes: playground (K-1), sundial (2-3), science_lab (4-5).',
    affordances: { representation: 'pictorial', answers: ['manipulate', 'tap'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'observe',
        label: 'Observe (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['observe'],
        description: 'Drag the sun to different positions and answer multiple-choice questions about shadow changes',
      },
      {
        evalMode: 'predict',
        affordances: { answers: ['tap'] },
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'Given a sun position, predict the shadow direction and length before checking',
      },
      {
        evalMode: 'measure',
        affordances: { answers: ['tap'] },
        label: 'Measure (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['measure'],
        description: 'Record shadow direction and length at multiple time points, identify the pattern',
      },
      {
        evalMode: 'apply',
        affordances: { answers: ['tap'] },
        label: 'Apply (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['apply'],
        description: 'Reverse reasoning — determine time of day from shadow direction and length',
      },
    ],
    tutoring: {
      taskDescription: 'Student is exploring shadows with a {{theme}} setup. Sun at {{sunPosition}} ({{timeOfDay}}). Shadow pointing {{shadowDirection}}, length {{shadowLength}}. Phase: {{phase}}.',
      contextKeys: ['theme', 'sunPosition', 'timeOfDay', 'shadowDirection', 'shadowLength', 'phase', 'challengeActive'],
      scaffoldingLevels: {
        level1: '"Move the sun and watch what happens to the shadow. What do you notice?"',
        level2: '"The shadow is pointing {{shadowDirection}}. The sun is in the {{sunPosition}}. See how they are on opposite sides?"',
        level3: '"When the sun is low (morning/evening), shadows are long. When the sun is high (noon), shadows are short. The shadow always points AWAY from the sun."',
      },
      commonStruggles: [
        { pattern: 'Student thinks shadow should point toward the sun', response: '"Try holding your hand up to a flashlight. Where does the shadow go? It goes the OTHER way! Shadows always point away from the light."' },
        { pattern: 'Student does not connect shadow length to sun height', response: '"Drag the sun to the very top of the sky. Now drag it low. See how the shadow gets longer? Lower sun = longer shadow!"' },
        { pattern: 'Student confuses direction labels', response: '"Remember: the sun rises in the East (the left side of the picture) and sets in the West (the right side). Morning shadows point West, evening shadows point East."' },
      ],
    },
    // Shared teaching workspace (W1, plain shape): `lightShadowWorkspace.ts`. The scripted fallback still reads `tutoring`.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'Every item is answered by tapping one choice and checking it; the activity judges it against the '
        + 'shadow worked out from the sun\'s position, and you are not told the answer. In this picture east is the left side '
        + 'and west the right side, even when the ground labels are hidden. Observe: the learner drags the sun to the time '
        + 'mark the question names. Predict: no shadow is drawn until the prediction is right. Measure: the shadow is drawn '
        + 'and reading it is the task. Apply: the sun and the clock are hidden; only the shadow shows. Never say or hint '
        + 'which way the shadow points, how long it is, or on apply the time or part of the day: not as a statement, not '
        + 'as a choice to try, not as a yes-or-no question that names one ("does it point right?"). Ask questions that '
        + 'name both sides or none: where is the sun, which side can the light not reach, left or right, long or short. '
        + 'Read the question and the choices aloud for a young learner. You cannot move the sun, tap or check for the learner.',
      // Every mode's misses are answered by a drawn lever (`lightShadowLevers.ts`).
      levers: true,
      // The activity's own check (`shadowMiss`), every mode.
      misses: missLists<ShadowMiss>({
        observe: ['toward_sun', 'side_when_overhead', 'below_when_side', 'length_flipped', 'length_off', 'both_wrong'],
        predict: ['toward_sun', 'side_when_overhead', 'below_when_side', 'length_flipped', 'length_off', 'both_wrong'],
        measure: ['toward_sun', 'side_when_overhead', 'below_when_side', 'length_flipped', 'length_off', 'both_wrong'],
        apply: ['mirror_time', 'wrong_height', 'other_time'],
      }),
    },
    supportsEvaluation: true,
  },
  {
    id: 'constellation-builder',
    description: 'Interactive connect-the-dots star field where students trace constellations by connecting stars. Builds spatial pattern recognition and star identification skills. Students connect numbered dots (guided), find pattern stars in a field (free), identify named constellations (reverse), and match constellations to seasons. Features real star positions for Big Dipper, Orion, Cassiopeia, Leo, and more. Progressive difficulty from K (numbered dots) to Grade 5 (seasonal sky knowledge). Perfect for K-5 astronomy, NGSS 1-ESS1-1. ESSENTIAL for teaching star patterns and constellation recognition.',
    constraints: 'Best for grades K-5. K: 3 constellations, numbered dots, large stars. Grade 1: 4-5 constellations, guided trace. Grade 2: unnumbered free connect, star brightness varies. Grade 3: identify mode, background distractors, seasonal grouping. Grade 4-5: seasonal sky rotation, no numbers, mythology connections.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'guided_trace',
        label: 'Guided Trace (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['guided_trace'],
        description: 'Numbered dots — student taps stars in order to trace the constellation',
      },
      {
        evalMode: 'free_connect',
        label: 'Free Connect (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['free_connect'],
        description: 'No numbers — student identifies and connects correct stars from the field',
      },
      {
        evalMode: 'identify',
        affordances: { representation: 'symbolic' },
        label: 'Identify (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['identify'],
        description: 'Constellation lines already drawn — student selects the correct name from options',
      },
      {
        evalMode: 'seasonal',
        affordances: { representation: 'symbolic' },
        label: 'Seasonal (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['seasonal'],
        description: 'Identify which constellations are visible in a given season',
      },
    ],
    tutoring: {
      taskDescription: 'Student is building the {{constellationName}} constellation. Stars connected: {{connectedCount}}/{{totalStars}}. Mode: {{evalMode}}. Season: {{season}}.',
      contextKeys: ['constellationName', 'connectedCount', 'totalStars', 'evalMode', 'season', 'lastStarTapped', 'mythologyFact'],
      scaffoldingLevels: {
        level1: '"Look at all those stars! Can you find a group that looks like a pattern? Start with the brightest ones."',
        level2: '"{{constellationName}} has {{totalStars}} main stars. You have found {{connectedCount}} so far. Look for a bright star near the ones you already connected."',
        level3: '"Let me help — see that bright star nearby? That is the next one in {{constellationName}}. Tap it to connect the line!"',
      },
      commonStruggles: [
        { pattern: 'Student taps random stars without looking for the pattern', response: '"Slow down! Constellations are like connect-the-dots in the sky. Look for a shape — does any group of bright stars look like a dipper or a person?"' },
        { pattern: 'Student connects wrong stars', response: '"Good try! That star is close, but look for a slightly brighter one nearby. The stars in {{constellationName}} are some of the brightest in this part of the sky."' },
        { pattern: 'Student completes constellation and does not explore mythology', response: '"You found {{constellationName}}! Did you know ancient people told stories about this star pattern? {{mythologyFact}}"' },
        {
          pattern: 'A pre-reader cannot read the instruction line, the star numbers or the Star Lore card',
          response: '"Never ask them to read anything. Say the instruction aloud each time the picture changes, and read the star story to them when they finish. The words are yours to speak."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 1)',
          instruction:
            'A pre-reader CANNOT read the instruction line, the constellation name, the Star Lore card or the buttons. Your voice is the only channel. '
            + 'When you receive [CONSTELLATION_ORIENT], say what to do in one or two warm child-sized sentences — they are tapping stars to draw a picture in the sky. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [CONSTELLATION_CHALLENGE_CHANGED], SAY the new instruction aloud in child words: the sky just changed to a new pattern and they cannot read what it now says. '
            + 'When you receive [CONSTELLATION_COMPLETE], celebrate warmly by name and then read the star story aloud — it is on screen as text they cannot read. '
            + 'When you receive [CONSTELLATION_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait.',
        },
        {
          title: 'NEVER SAY WHICH STAR IS NEXT — THE SCREEN ALREADY POINTS',
          instruction:
            'In guided trace the answer IS the order, and the screen already pulses a ring around the one star to tap next. Naming it, or saying where it sits ("the one up on the left"), hands over the whole task. '
            + 'On [CONSTELLATION_WRONG_STAR] say only that it was a different star and send them back to the twinkling ring — "look for the star with the sparkly circle around it". '
            + 'Only at scaffolding level 3, after several misses, may you describe where the ringed star is. In free connect, never name the pair to join; say "look for a bright one close to the last one you tapped".',
        },
        {
          title: 'NO STAR NUMBERS OR MAGNITUDES AT K-1 — SAY WHAT THEY CAN SEE',
          instruction:
            'At grade rung K and 1 do NOT say a star count, a step number ("star 3 of 5"), a magnitude, a compass direction, or a season name as if they knew it. The screen deliberately hides those at K, so saying them puts back what was taken out. '
            + 'Say "the twinkling one", "the bright one right next to it", "you have a few more to go", "almost done". '
            + 'From grade 2 up the counts and the brightness ARE part of the objective — say them, and help the student use brightness to tell constellation stars from the dim ones behind them.',
        },
      ],
    },
    supportsEvaluation: true,
    // Shared teaching workspace (W1, plain shape): `constellationWorkspace.ts`. The scripted fallback still reads `tutoring`.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'Guided trace and free connect are star taps: the activity checks every tap against the pattern, and you '
        + 'are not told the stars. Guided trace: a pulsing ring marks the next star, and a tap on another star is a miss. '
        + 'Free connect: the learner taps one star, then the star it joins to, for each line. Identify: the lines of one '
        + 'constellation are drawn and no name is shown; the learner says a name or taps it. Seasonal: only a season and a list of '
        + 'names; the learner says the one best seen then, or taps it and checks it. Before an attempt never say which star '
        + 'is next, where a star is or which stars join, and on identify and seasonal never say the answer, its '
        + 'shape, its figure (a hunter, a bear) or its story: not as a statement, a choice to try, or a yes-or-no question. '
        + 'On identify ask what the lines look like; on seasonal ask what they remember about the night sky in that season. '
        + 'A Kindergarten or Grade 1 learner cannot read: say the instruction and the names aloud, and give no star counts '
        + 'or step numbers. After a wrong name, do not say which season or shape that name has: it rules out choices for '
        + 'them. Once an answer is credited you may read the star story on screen. You cannot tap a star, draw a line, '
        + 'choose or check for the learner.',
      // In-item levers (`constellationLevers.ts`): spotlight, shape card, bright stars, an easier pattern.
      levers: true,
      // The activity's own checks (`guidedMiss`, `freeMiss`, `nameMiss`); identify and seasonal also list them spoken.
      misses: missLists<ConstellationMiss>({
        guided_trace: ['later_star', 'traced_star', 'other_star'],
        free_connect: ['background_star', 'wrong_pair'],
        identify: ['wrong_name'],
        seasonal: ['other_name', 'several_names'],
      }),
    },
  },
  {
    id: 'planetary-explorer',
    description: 'Guided Gemini-driven solar system deep-dive where students explore 3-5 planets sequentially with targeted questions at every stop. Students journey from planet to planet, tap stats to learn about each world, answer questions about planetary properties, compare planets they have visited, and apply reasoning about temperature, atmosphere, and habitability. Features pedagogical moments at every stage: journey start, planet arrival, stat exploration, answer feedback, planet completion, transitions, and journey completion. Gemini generates contextual questions per planet based on focus themes (size, temperature, atmosphere, moons, rings, distance). Progressive difficulty from K (basic recall) to Grade 8 (cross-planet reasoning and application). Supports multiple-choice, true-false, and comparison challenge types. ESSENTIAL for teaching planetary science, comparative planetology, and scientific reasoning across K-8.',
    constraints: 'Best for grades K-8. K-2: 3 planets, explore mode with true-false and simple MC, focus on one property per planet. Grades 3-5: 4 planets, identify and compare modes, multi-property focus themes, comparison challenges. Grades 6-8: 5 planets, apply mode, reasoning about habitability, atmosphere composition, and temperature patterns. Focus themes should be age-appropriate: size and color for K-1, temperature and moons for 2-3, atmosphere and habitability for 4-5, multi-factor reasoning for 6-8.',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap'], role: ['visualize', 'apply'], minutes: 8 },
    evalModes: [
      {
        evalMode: 'explore',
        label: 'Explore (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['mc', 'true-false'],
        description: 'Basic recall after reading planet info',
      },
      {
        evalMode: 'identify',
        label: 'Identify (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['mc'],
        description: 'Identify planets from descriptions without naming them',
      },
      {
        evalMode: 'compare',
        label: 'Compare (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['compare', 'mc'],
        description: 'Compare properties across multiple planets visited',
      },
      {
        evalMode: 'apply',
        label: 'Apply (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['mc', 'compare'],
        description: 'Reasoning about why — apply knowledge of temperature, atmosphere, habitability',
      },
    ],
    tutoring: {
      taskDescription: 'Student is on a guided journey through the solar system, currently exploring {{currentPlanet}}. Focus theme: {{focusTheme}}. They are answering questions about planetary properties, comparisons, and reasoning.',
      // `correctAnswer` was declared here but never resolved, and resolving it
      // would have parked the answer key in the tutor's prompt for the WHOLE
      // question — a standing leak. The component already hands over the correct
      // option at the one moment it is pedagogically right (the final attempt),
      // via [ANSWER_INCORRECT]. Removed rather than wired.
      contextKeys: ['currentPlanet', 'focusTheme', 'questionText', 'studentAnswer', 'planetsVisited', 'planetsRemaining', 'currentScore', 'attemptNumber'],
      scaffoldingLevels: {
        // These ENACT the question rather than narrating the screen. The old set
        // ("Look at the stats panel — one of those numbers will help you") only
        // worked for a student who could already read the panel, which is the
        // whole reader-fit failure at K-1.
        level1: '"{{questionText}}" — what do you think? Everything you need to decide is right here on {{currentPlanet}}.',
        level2: '"{{questionText}}" This one is about {{focusTheme}}. What do you already know about {{currentPlanet}} that could help?',
        level3: 'Say the question again, then describe {{currentPlanet}}\'s {{focusTheme}} out loud in plain words and ask them which choice matches what they just heard. Do not say which choice is right.',
      },
      commonStruggles: [
        { pattern: 'Student taps answer without reading planet stats', response: '"Hold on! Before you answer, tap the stats panel for {{currentPlanet}}. The answer is hiding in those numbers."' },
        { pattern: 'Student confuses properties between planets already visited', response: '"You have visited {{planetsVisited}} so far. Each planet has different numbers. Go back and check {{currentPlanet}}\'s stats — do not mix them up with the last planet!"' },
        { pattern: 'Student struggles with comparison questions across planets', response: '"For comparison questions, think about one property at a time. Look at {{focusTheme}} for each planet you visited. Which one had the biggest or smallest value?"' },
        {
          pattern: 'A pre-reader cannot read the planet description, the stat cards or the answer options',
          response: '"Never ask them to read anything. Say the planet\'s name, tell them what it looks like, then speak the question aloud followed by every choice in order. Invite them to tap a glowing card and say what it means in child words."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 1)',
          instruction:
            'A pre-reader CANNOT read the planet description, the stat cards, the fun fact, the question, or the answer options. Your voice is the only channel. '
            + 'On [JOURNEY_START] and [PLANET_ARRIVE], say where they are and what the planet looks like in one or two warm child-sized sentences. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'On [QUESTION_SHOWN] and [QUIZ_START], READ THE QUESTION ALOUD and then read EVERY option aloud in order, so a choice they cannot read is still a choice they can make. '
            + 'On [PLANET_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'On [STAT_TAPPED], say what that stat means in child words — they tapped a card they cannot read. '
            + 'On [TRANSITION] and [PLANET_COMPLETE], say what is happening; the screen just changed and they cannot see why.',
        },
        {
          title: 'NEVER SAY THE ANSWER BEFORE THEIR LAST TRY',
          instruction:
            'On the FIRST wrong attempt you are told what they picked but NOT what is right — steer them to the stat or the picture that decides it, and never eliminate options down to one. '
            + 'Only [ANSWER_INCORRECT] messages that explicitly give you the correct option are final-attempt reveals: there, say it plainly and explain why. '
            + 'On [QUIZ_HINT] describe the planet without naming it. Never read the correct option in a different tone, and never say "are you sure?" about a right answer.',
        },
        {
          title: 'NO NUMBERS OR UNITS AT K-1 — SAY WHAT THEY CAN SEE',
          instruction:
            'At grade rung K and 1 do NOT say kilometres, miles, degrees, hours, days, years, gravity, mass, or any decimal. The screen deliberately keeps the numbers plain at K, so reciting them puts back what was taken out. '
            + 'Say "really really big", "the red one", "so cold your nose would freeze", "it has rings around it", "it has two little moons". '
            + 'Do NOT tell a K-1 child to "look at the stats panel" or "check the numbers" — they cannot read it. Say "tap one of the glowing circles and I will tell you what it says". '
            + 'From grade 2 up the numbers and the Earth comparisons ARE the objective — say them, and help the student compare them.',
        },
      ],
    },
    // Shared teaching workspace (W1, plain shape): `planetaryExplorerWorkspace.ts`. The scripted fallback still reads `tutoring`.
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      guidance: 'Every item is one question from a trip through the solar system: a few questions at each planet, and in '
        + 'identify mode a quiz after the last planet. The learner answers by saying it, or by tapping one choice and '
        + 'checking it; the activity checks the tap against the question\'s own key. Before a planet\'s first question its '
        + 'card is on screen (a description, fact cards and a fun fact) until the learner presses Ready for Questions; then '
        + 'the card is gone and the questions ask what the card said. Read the card aloud while it is on screen. During a '
        + 'question, never say the fact that answers it, which fact card or number decides it, which choice is right, or '
        + 'rule a choice out. A planet\'s nickname or best-known description ("the Red Planet", "the one with rings") '
        + 'answers a question about it: never say one during a question, not even as a clue. On a why question, never '
        + 'name the reason or the facts the right choice uses. Ask what the learner remembers instead. A quiz question describes a planet '
        + 'without naming it, and the map shows no planet names during the quiz; never name or describe the planet it means. '
        + 'For kindergarten and grade 1, read the question and every choice aloud, and say no units or decimals. You cannot '
        + 'tap, check or point at a choice for the learner.',
      levers: true,
      // The activity's own check (`planetMiss`), a tap or a spoken choice, in every mode.
      // The quiz's planet misses are identify's only; true-false statements are explore's only (the modes' schema enums).
      misses: missLists<PlanetMiss>({
        explore: ['true_false_flipped', 'other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
        identify: ['neighbour_planet', 'same_family_planet', 'other_family_planet', 'other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
        compare: ['other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
        apply: ['other_planet', 'other_planet_fact', 'other_number', 'other_choice'],
      }),
      // Unanswered by decision (`planetaryExplorerLevers.ts`): a true-false statement is already the smallest judgement
      // and its truth is read off the cards, so no card may come back beside it.
      unanswered: missLists<PlanetMiss>({ explore: ['true_false_flipped'] }),
    },
    supportsEvaluation: true,
  },
];
