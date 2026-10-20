/**
 * Astronomy Catalog - Component definitions for astronomy primitives
 *
 * Contains astronomy and space science visualizations for K-5 science education.
 */

import { ComponentDefinition } from '../../../types';
import { bossEntry } from '../../../components/live-activity/boss';
import { solarSystemCard } from '../../../primitives/visual-primitives/astronomy/solarSystem.card';
import { lightShadowLabCard } from '../../../primitives/visual-primitives/astronomy/lightShadowLab.card';
import { planetaryExplorerCard } from '../../../primitives/visual-primitives/astronomy/planetaryExplorer.card';
import { constellationBuilderCard } from '../../../primitives/visual-primitives/astronomy/constellationBuilder.card';
import { telescopeSimulatorCard } from '../../../primitives/visual-primitives/astronomy/telescopeSimulator.card';
import { orbitMechanicsLabCard } from '../../../primitives/visual-primitives/astronomy/orbitMechanicsLab.card';
import { rocketBuilderCard } from '../../../primitives/visual-primitives/astronomy/rocketBuilder.card';
import { missionPlannerCard } from '../../../primitives/visual-primitives/astronomy/missionPlanner.card';
import { missLists } from './missLists';

export const ASTRONOMY_CATALOG: ComponentDefinition[] = [
  {
    id: 'solar-system-explorer',
    description: 'Interactive solar system model with accurate orbital mechanics, zoom controls, and planet details. Students explore planetary motion, compare sizes and distances, watch orbits in real-time, and discover facts about each celestial body. Features dynamic zoom from full system view down to individual planets, adjustable time scale to speed up orbital motion, and multiple scale modes (size-accurate, distance-accurate, hybrid) to teach the challenge of representing space at scale. Shows the habitable zone (Goldilocks zone) for astrobiology concepts. Includes all 8 planets plus optional dwarf planets (Pluto, Ceres, Eris) for advanced grades. Perfect for K-5 astronomy, NGSS space science standards, and next-generation science education. ESSENTIAL for teaching solar system structure, planetary motion, and scale of space. Assessment runs as LIVE-JUDGED direct instruction: the tutor asks about the sky out loud and the student answers OUT LOUD with a planet\'s name — tapping and zooming stay free as research on the model. Requires a microphone.',
    constraints: 'Best for grades K-5. Learning progression: K (planet names, order, Earth), 1 (inner vs outer, sizes), 2 (orbits, day/year), 3 (moons, rings, AU), 4 (orbital periods, distances), 5 (Kepler\'s laws, gravity, habitable zone). K-2: Show inner planets only or use hybrid scale mode for visibility. 3-5: Include all 8 planets, dwarf planets optional for grade 5. Use initialZoom to control starting view: "inner" for K-1, "system" for 2-5. Enable showDistances and showHabitableZone for grades 3+. Increase timeScale for younger grades (faster = more engaging). Assessment is SPOKEN (DI judged loop, microphone required): every eval mode is answered by saying a planet\'s name to the Live tutor, whose own affirmation advances the session — there is no confirm button, no Next button, and no attempts ladder.',
    // Live-tutor wiring: `solarSystem.card.ts` + `solarSystem.boss.ts` (the spoken preset); asks, keys and build
    // gates in `solarSystemDomain.ts`, levers in `solarSystemLevers.ts`.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['spoken'], role: ['visualize', 'apply'], minutes: 6 },
    ...bossEntry(solarSystemCard),
    evalModes: [
      {
        evalMode: 'identify',
        label: 'Name It (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['identify'],
        // β HELD despite recognition → production: the vocabulary the K
        // objective is ABOUT now leaves the child's mouth, which is the
        // standard, not a difficulty tier.
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
        // β HELD — comparison across bodies is the demand either way. Named-pair
        // items (which one is bigger, A or B) sit beside the extremes, same
        // skill at the same rung.
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
    supportsEvaluation: true,
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
    evalModes: [
      { evalMode: 'can_it_lift', affordances: { answers: ['tap', 'spoken'] }, label: 'Will it lift off? (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['can_it_lift'], description: 'Say or tap whether one rocket lifts off, from its parts\' weight blocks and its engines\' push arrows (hard: two engines to add up, push one away from weight or equal to it)' },
      { evalMode: 'add_to_lift', affordances: { answers: ['tap', 'spoken'] }, label: 'Add one part (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['add_to_lift'], description: 'Say or tap the one part (an engine, a fuel tank or a cargo box) that makes a grounded rocket lift off (hard: the engine with the biggest push is too heavy to help)' },
      { evalMode: 'on_budget', affordances: { answers: ['tap', 'spoken'] }, label: 'On budget (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['on_budget'], description: 'Say or tap the rocket that lifts off and costs no more than a budget of coins (hard: four rockets, one a coin over, the cheapest stays down)' },
      { evalMode: 'reach_target', affordances: { answers: ['tap', 'spoken'] }, label: 'Which flies highest (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['reach_target'], description: 'Say or tap which rocket flies highest (or least high), when they differ in fuel, engine, weight or dropping empty tanks (hard: the rocket with the most fuel is too heavy to lift off)' },
    ],
    // Wired to the live tutor by its boss (rocketBuilder.card.ts + rocketBuilder.boss.ts).
    ...bossEntry(rocketBuilderCard),
    supportsEvaluation: true,
  },
  {
    id: 'orbit-mechanics-lab',
    description: 'Newton\'s cannon with a rocket: the rocket is high above Earth\'s air and gets one sideways push, and gravity alone decides its path: it falls back, goes around in a circle, swings out in a stretched loop, or flies away. Every item, push, rocket and answer is built by code from real orbital physics, and nothing flies until the learner has answered, so the first answer is a prediction, never a trial. Four tasks: pick the push (drawn as an arrow) that makes the rocket fall back, circle or fly away; pick which of several rockets on round tracks moves fastest or slowest, or takes the shortest or longest trip around Earth; predict what a push forward or backward does to a circling rocket\'s path; and choose where and which way to fire once to turn a stretched loop into a circle. ESSENTIAL for orbits, gravity and spaceflight in K-5: why things in orbit do not fall down, why closer orbits are faster, and how a push changes an orbit.',
    constraints: 'Best for grades K-5. K and Grade 1 MAY be routed here: pick_speed is a tap (or a spoken word) on one of two to four push pictures (arrows), the asked outcome is shown as a picture too, and the tutor reads the question; there is no slider, number or unit on screen. Code builds every item and answer; the manifest picks the topic, never the questions. Default modes when nothing pins them: K-1 pick_speed; Grade 2 adds orbit_speed; Grade 3 adds predict_burn; Grades 4-5 all four. Not for the parts of a rocket or thrust and lift-off (rocket-builder), or planning a trip to another planet (mission-planner).',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'pick_speed', affordances: { answers: ['tap', 'spoken'] }, label: 'Pick the push (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['pick_speed'], description: 'Say or tap the sideways push (an arrow) that makes the rocket fall back, go around in a circle or fly away; the asked outcome varies (hard: four pushes, a stretched loop beside the circle)' },
      { evalMode: 'orbit_speed', affordances: { answers: ['tap', 'spoken'] }, label: 'Which rocket (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['orbit_speed'], description: 'Say or tap the fastest or slowest rocket on its round track, or the one with the shortest or longest trip around Earth (hard: four tracks close together, rockets drawn at different sizes)' },
      { evalMode: 'predict_burn', affordances: { answers: ['tap', 'spoken'] }, label: 'Predict the burn (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['predict_burn'], description: 'Say or tap what a small or big push forward or backward does to a circling rocket\'s path (hard: all five outcomes offered)' },
      { evalMode: 'circularize', affordances: { answers: ['tap', 'spoken'] }, label: 'Make it a circle (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['circularize'], description: 'Say or tap where (near or far point) and which way to fire once to turn a stretched loop into a circle at a given height (hard: the height is a dashed circle, not named)' },
    ],
    // Wired to the live tutor by its boss (orbitMechanicsLab.card.ts + orbitMechanicsLab.boss.ts).
    ...bossEntry(orbitMechanicsLabCard),
    supportsEvaluation: true,
  },
  {
    id: 'mission-planner',
    description: 'Space-mission planning with every choice and answer built by code. Grades 2-5, four graded tasks, each answered by tapping or saying one choice: which place in space (the Moon, Mars, the asteroid belt, the giant planets) is farthest or closest from Earth, from same-size pictures with no map or distance drawn until the answer; which launch month needs the least or the most fuel, from small pictures of the Sun, Earth\'s orbit and the target planet\'s orbit with both planets where they really are that month; how many food packs a trip to the Moon needs, there, staying and home the same way, for each astronaut; and which route to Jupiter or Saturn uses the least fuel (each flyby past a planet gives a free push) and still arrives within a year limit. Kindergarten and Grade 1 get an ungraded planning story instead: pick the Moon or Mars, pack food, water and air, watch the ship fly, and hear how long the trip takes in words; nothing is scored. ESSENTIAL for space travel in K-5: near and far in the solar system, why launch timing matters (planets move), supplies for a round trip, and gravity-assist trade-offs.',
    constraints: 'Graded for Grades 2-5. Kindergarten and Grade 1 MAY be routed here only as an ungraded story (no score is submitted): use it there for exposure, never as an assessment. Code builds every place, month, trip, route and answer; the manifest picks the topic, never the content. Default modes when nothing pins them: Grade 2 farther_closer and pick_window; Grade 3 adds pack_days; Grades 4-5 all four. Not for the order of planets out from the Sun on a live model (solar-system-explorer), orbits and speeds (orbit-mechanics-lab), or what a rocket needs to lift off (rocket-builder).',
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'emerging', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'farther_closer', affordances: { answers: ['tap', 'spoken'] }, label: 'Near or far? (Tier 1)', beta: 1.5, scaffoldingMode: 1, challengeTypes: ['farther_closer'], description: 'Say or tap which place (the Moon, Mars, the asteroid belt or a giant planet) is farthest or closest from Earth; no map is drawn until the answer (hard: four places, two of them next to each other in order)' },
      { evalMode: 'pick_window', affordances: { answers: ['tap', 'spoken'] }, label: 'When to launch (Tier 2)', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['pick_window'], description: 'Say or tap the launch month that needs the least or the most fuel, from where Earth and the target planet are that month (hard: four months, one a near miss)' },
      { evalMode: 'pack_days', affordances: { answers: ['tap', 'spoken'] }, label: 'Pack the food (Tier 3)', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['pack_days'], description: 'Say or tap how many food packs a Moon trip needs: days there, days staying and the same days home, one pack per astronaut per day (hard: a crew of 2-4)' },
      { evalMode: 'assist_tradeoff', affordances: { answers: ['tap', 'spoken'] }, label: 'Pick a route (Tier 4)', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['assist_tradeoff'], description: 'Say or tap the route to Jupiter or Saturn that uses the least fuel (more flybys, less fuel) and still arrives within a year limit (hard: four routes; the one with the most flybys may be too slow)' },
    ],
    // Wired to the live tutor by its boss (missionPlanner.card.ts + missionPlanner.boss.ts), grades 2-5 only: the K-1
    // story is ungraded and renders outside the workspace (the boss refuses it).
    ...bossEntry(missionPlannerCard),
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
    ...bossEntry(telescopeSimulatorCard),
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
    ...bossEntry(lightShadowLabCard),
    supportsEvaluation: true,
  },
  {
    id: 'constellation-builder',
    description: 'Interactive connect-the-dots star field where students trace constellations by connecting stars. Builds spatial pattern recognition and star identification skills. Students connect numbered dots (guided), find pattern stars in a field (free), identify named constellations (reverse), and match constellations to seasons. Features real star positions for Big Dipper, Orion, Cassiopeia, Leo, and more. Progressive difficulty from K (numbered dots) to Grade 5 (seasonal sky knowledge). Perfect for K-5 astronomy, NGSS 1-ESS1-1. ESSENTIAL for teaching star patterns and constellation recognition.',
    constraints: 'Best for grades K-5. K: 3 constellations, numbered dots, large stars. Grade 1: 4-5 constellations, guided trace. Grade 2: unnumbered free connect, star brightness varies. Grade 3: identify mode, background distractors, seasonal grouping. Grade 4-5: seasonal sky rotation, no numbers, mythology connections.',
    // Live-tutor wiring: `constellationBuilder.card.ts` + `constellationBuilder.boss.ts` (the spoken preset: trace modes
    // drawn and checked tap by tap, identify and seasonal SAY_OR_SHOW); items, scene and checks in `constellationWorkspace.ts`.
    affordances: { representation: 'pictorial', reader: 'none', answers: ['build', 'spoken', 'tap'], role: 'apply', minutes: 5 },
    evalModes: [
      {
        evalMode: 'guided_trace',
        affordances: { answers: ['build'] },
        label: 'Guided Trace (Tier 1)',
        beta: 1.5,
        scaffoldingMode: 1,
        challengeTypes: ['guided_trace'],
        description: 'Numbered dots — student taps stars in order to trace the constellation',
      },
      {
        evalMode: 'free_connect',
        affordances: { answers: ['build'] },
        label: 'Free Connect (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['free_connect'],
        description: 'No numbers — student identifies and connects correct stars from the field',
      },
      {
        evalMode: 'identify',
        affordances: { representation: 'symbolic', answers: ['spoken', 'tap'] },
        label: 'Identify (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['identify'],
        description: 'Constellation lines already drawn — student selects the correct name from options',
      },
      {
        evalMode: 'seasonal',
        affordances: { representation: 'symbolic', answers: ['spoken', 'tap'] },
        label: 'Seasonal (Tier 4)',
        beta: 6.0,
        scaffoldingMode: 6,
        challengeTypes: ['seasonal'],
        description: 'Identify which constellations are visible in a given season',
      },
    ],
    ...bossEntry(constellationBuilderCard),
    supportsEvaluation: true,
  },
  {
    id: 'planetary-explorer',
    description: 'Guided Gemini-driven solar system deep-dive where students explore 3-5 planets sequentially with targeted questions at every stop. Students journey from planet to planet, tap stats to learn about each world, answer questions about planetary properties, compare planets they have visited, and apply reasoning about temperature, atmosphere, and habitability. Features pedagogical moments at every stage: journey start, planet arrival, stat exploration, answer feedback, planet completion, transitions, and journey completion. Gemini generates contextual questions per planet based on focus themes (size, temperature, atmosphere, moons, rings, distance). Progressive difficulty from K (basic recall) to Grade 8 (cross-planet reasoning and application). Supports multiple-choice, true-false, and comparison challenge types. ESSENTIAL for teaching planetary science, comparative planetology, and scientific reasoning across K-8.',
    constraints: 'Best for grades K-8. K-2: 3 planets, explore mode with true-false and simple MC, focus on one property per planet. Grades 3-5: 4 planets, identify and compare modes, multi-property focus themes, comparison challenges. Grades 6-8: 5 planets, apply mode, reasoning about habitability, atmosphere composition, and temperature patterns. Focus themes should be age-appropriate: size and color for K-1, temperature and moons for 2-3, atmosphere and habitability for 4-5, multi-factor reasoning for 6-8.',
    // Live-tutor wiring: `planetaryExplorer.card.ts` + `planetaryExplorer.boss.ts` (the spoken preset, every mode
    // SAY_OR_SHOW); items, keys and scene in `planetaryExplorerWorkspace.ts`, levers in `planetaryExplorerLevers.ts`.
    affordances: { representation: ['pictorial', 'symbolic'], reader: 'none', answers: ['tap', 'spoken'], role: ['visualize', 'apply'], minutes: 8 },
    ...bossEntry(planetaryExplorerCard),
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
    supportsEvaluation: true,
  },
];
