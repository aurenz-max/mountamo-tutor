/**
 * Astronomy Catalog - Component definitions for astronomy primitives
 *
 * Contains astronomy and space science visualizations for K-5 science education.
 */

import { ComponentDefinition } from '../../../types';

export const ASTRONOMY_CATALOG: ComponentDefinition[] = [
  {
    id: 'solar-system-explorer',
    description: 'Interactive solar system model with accurate orbital mechanics, zoom controls, and planet details. Students explore planetary motion, compare sizes and distances, watch orbits in real-time, and discover facts about each celestial body. Features dynamic zoom from full system view down to individual planets, adjustable time scale to speed up orbital motion, and multiple scale modes (size-accurate, distance-accurate, hybrid) to teach the challenge of representing space at scale. Shows the habitable zone (Goldilocks zone) for astrobiology concepts. Includes all 8 planets plus optional dwarf planets (Pluto, Ceres, Eris) for advanced grades. Perfect for K-5 astronomy, NGSS space science standards, and next-generation science education. ESSENTIAL for teaching solar system structure, planetary motion, and scale of space.',
    constraints: 'Best for grades K-5. Learning progression: K (planet names, order, Earth), 1 (inner vs outer, sizes), 2 (orbits, day/year), 3 (moons, rings, AU), 4 (orbital periods, distances), 5 (Kepler\'s laws, gravity, habitable zone). K-2: Show inner planets only or use hybrid scale mode for visibility. 3-5: Include all 8 planets, dwarf planets optional for grade 5. Use initialZoom to control starting view: "inner" for K-1, "system" for 2-5. Enable showDistances and showHabitableZone for grades 3+. Increase timeScale for younger grades (faster = more engaging). Supports both free exploration and guided inquiry about planetary characteristics.',
    tutoring: {
      taskDescription:
        'Student is exploring a live model of the solar system ("{{title}}"). '
        + 'View: {{initialZoom}}. Bodies on screen: {{bodyNames}}. '
        + 'They are looking at: {{selectedBodyName}}. Motion is {{motionState}}. '
        + 'They tap a planet to learn about it, and can zoom and pan around the Sun.',
      contextKeys: [
        'title',
        'initialZoom',
        'gradeLevel',
        'bodyNames',
        'bodyCount',
        'selectedBodyName',
        'selectedBodyDescription',
        'motionState',
      ],
      scaffoldingLevels: {
        level1: '"Tap one of the planets going around the Sun. Which one looks most interesting to you?"',
        level2: '"You are looking at {{selectedBodyName}}. Watch how it travels around the Sun — the ones close in go around fast, and the far ones take a long time."',
        level3: '"Everything here goes around the Sun in the middle. The Sun is the biggest thing by far. Tap each planet one at a time and I will tell you about it — start with the one closest to the Sun and work your way out."',
      },
      commonStruggles: [
        {
          pattern: 'Student thinks the planets are lined up in a row in real life',
          response: '"Good noticing! On the screen they look lined up because it is easier to see. In real space they are spread all around the Sun, each on its own path, and they are almost never in a line."',
        },
        {
          pattern: 'Student thinks the planets are as close together as they look here',
          response: '"Space is much emptier than this picture. We squeeze the planets closer so they fit on the screen. If we drew it truly, the planets would be tiny specks miles apart."',
        },
        {
          pattern: 'Student taps rapidly through planets without looking at any',
          response: '"Stay on this one for a moment. Look at its colour and its size next to the others. What do you notice about it?"',
        },
        {
          pattern: 'Student asks which planet is best or biggest without exploring',
          response: '"Let us find out together instead of me telling you. Tap two of them and compare — which one looks bigger on screen?"',
        },
        {
          pattern: 'A pre-reader cannot read the planet names, the fact card, or any of the numbers',
          response: '"Never ask them to read. Say the planet name aloud when they tap it, and describe it in child words — \'this one is the biggest\', \'this one is the red one\'. Never read out kilometres, degrees, or AU to a young child."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the planet names, the description card, the fun fact, or any of the numbers on this screen. Your voice is the only channel. '
            + 'When you receive [SOLAR_ORIENT], say in one or two warm child-sized sentences that these are the planets going around our Sun, and that they can tap one to hear about it. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [SOLAR_BODY_SELECTED], SAY the name of the body they tapped and one short child-sized thing about it. '
            + 'When you receive [SOLAR_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'NEVER speak a measurement to a pre-reader — no kilometres, no AU, no degrees Celsius, no orbital periods in days. Say "the biggest one", "really really hot", "it takes a long time to go around" instead.',
        },
        {
          title: 'SCALE HONESTY',
          instruction:
            'This model cannot show size and distance truthfully at the same time — that is a real teaching point, not a flaw to hide. '
            + 'If a student draws a conclusion from how things LOOK on screen (how close together the planets are, how big they are next to each other), '
            + 'gently name the trade-off in child words rather than letting the misconception stand.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'scale-comparator',
    description: 'Interactive scale comparison tool for celestial objects that helps students grasp mind-bending cosmic scales through familiar references. Students compare sizes, distances, masses, and light-travel times side-by-side, overlay familiar objects (basketball, car, football field) for context, and create scale models with "if Sun were basketball..." scenarios. Features progressive difficulty from K (Earth vs Moon) to Grade 5 (light-year calculations). Includes D3 zoom controls to explore extreme size ratios, reference object library with everyday items for visceral understanding, and dynamic ratio calculations showing "Jupiter is 11× wider than Earth". Scale model builder (Grades 4-5) enables hands-on calculation practice with interactive placement. Walk-through mode (Grades 3-5) visualizes distances with speed controls from walking to light speed. ESSENTIAL for developing spatial reasoning and scale comprehension across astronomy curriculum.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K: 2-3 objects (Earth, Moon), size only, no ratios, everyday references (balls). Grade 1: 3-4 planets, size comparisons, sport ball equivalents. Grade 2: Sun emphasis, integer ratios, "Sun is 109× Earth!". Grade 3: 5-6 planets, add distance mode, walk-through feature, football field references. Grade 4: All 8 planets, scale model builder, AU units, complex calculations. Grade 5: 8+ objects including Voyager/stars, light-travel time mode, scientific notation, geographic references. Use compareType to focus learning: "size" for K-2, "distance" for 3-4, "time" for 5. Enable interactiveWalk for grades 3+. Scale model builder for grades 4-5 only. showRatios should be false for K-1, true for 2+. Always enable showFamiliarEquivalent for all grades. Reference objects auto-filtered by grade appropriateness.',
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
    description: 'Comprehensive rocket design and simulation tool where students assemble rockets from components, balance thrust and weight, and launch to see if their designs reach space. The flagship spaceflight primitive. Students select rocket stages and components (capsules, fuel tanks, engines, boosters, fins), stack stages vertically, choose engine types and fuel amounts, adjust payload, check thrust-to-weight ratio, launch and watch flight profile with real-time D3 animation, see staging events during flight, and analyze why designs succeed or fail. Features progressive difficulty from K (rockets have parts) to Grade 5 (delta-v budgets and orbit insertion). Includes budget constraints for resource management, guided mode with hints, multiple atmosphere models, and detailed flight profile graphs showing altitude, velocity, and staging events. ESSENTIAL for NGSS engineering design standards and spaceflight education.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K and Grade 1 are fully supported and MAY be routed here: at those grades each part is shown as a PICTURE with a short name and is added by a single tap, and no masses, thrusts, fuel figures, ratios, budgets or altitudes appear on screen — the tutor narrates outcomes by voice. K: 1 stage, 3-5 simple components, no TWR/budget, target 10-20 km, focus on "rockets have parts". Grade 1: 1-2 stages, 5-7 components, show fuel gauge, target 20-50 km, focus on "engines use fuel". Grade 2: 2 stages, 7-10 components with mass variation, show TWR, target 50-100 km, focus on "heavy rockets need more thrust". Grade 3: 2-3 stages, 10-12 components, show forces, optional budget, target 100 km (space!), focus on staging. Grade 4: 3-4 stages, 12-15 components with Isp stats, realistic atmosphere, budget required, target 150-200 km, focus on efficiency. Grade 5: 3-5 stages, 15+ components, targetOrbit: true, full budget constraints, target orbit (200 km + velocity), focus on delta-v and orbital mechanics. Use maxStages to control complexity. Enable showTWR for grades 2+. Enable showForces for grades 3+. Use atmosphereModel: "simple" for K-3, "realistic" for 4-5. Enable guidedMode for K-3, optional for 4-5. Include budget for grades 3+ to teach resource management.',
    tutoring: {
      taskDescription:
        'Student is building a rocket out of parts and launching it ("{{title}}"). '
        + 'Parts they can choose from: {{partNames}}. On the rocket so far: {{builtParts}} '
        + '({{partCount}} parts). Goal: {{missionGoal}}. Launches so far: {{launchCount}}. '
        + 'Last flight: {{flightOutcome}}. At kindergarten and grade 1 each part is a picture '
        + 'they tap once to add; from grade 2 they also see mass, thrust and ratios.',
      contextKeys: [
        'title',
        'gradeLevel',
        'partNames',
        'builtParts',
        'partCount',
        'missionGoal',
        'launchCount',
        'flightOutcome',
        'learningFocus',
      ],
      scaffoldingLevels: {
        level1: '"Tap a part to put it on your rocket. What do you think a rocket needs?"',
        level2: '"You have {{partCount}} parts on so far. A rocket needs something to sit in, something to burn, and something to push. Is anything missing?"',
        level3: '"Every rocket needs three things: a place for the astronaut, a tank to hold the fuel, and an engine to push it up. Tap one of each, then press the big launch button and watch what happens."',
      },
      commonStruggles: [
        {
          pattern: 'Student adds only an engine, or only a fuel tank, and the rocket will not fly',
          response: '"An engine on its own has nothing to burn. Fuel on its own has nothing to push it. They work as a team — see if you can find the other one."',
        },
        {
          pattern: 'Student piles on many heavy parts and the rocket cannot lift off',
          response: '"That is a really heavy rocket! Heavy things are hard to push up. What could you take off to make it lighter, or what could you add to push harder?"',
        },
        {
          pattern: 'Student thinks the rocket failed because they did something wrong',
          response: '"Nothing went wrong — you just found out what that rocket does. Real rocket builders test lots of rockets. Change one thing and launch it again."',
        },
        {
          pattern: 'Student launches repeatedly without changing the rocket',
          response: '"That rocket will do the same thing every time. Add a part or take one off first, then launch and see what is different."',
        },
        {
          pattern: 'A pre-reader cannot read the part names, the mission goal, or any of the numbers',
          response: '"Never ask them to read. Name each part out loud when they tap it and say what it is for in child words — \'that is the engine, it pushes\'. Never speak a kilogram, a kilonewton, a ratio or an altitude to a young child; say \'heavy\', \'a big push\', \'really high up\' instead."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the title, the part names, the mission goal, or any number on this screen. Your voice is the only channel. '
            + 'When you receive [ROCKET_ORIENT], say in one or two warm child-sized sentences that these are rocket parts and they can tap one to add it, then launch. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [ROCKET_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'When you receive [ROCKET_PART_ADDED], SAY the name of the part they just added and ONE short thing it does. Do not list numbers and do not ask a question. '
            + 'When you receive [ROCKET_LAUNCH_RESULT], say in ONE short sentence what the rocket did, using only what they can see: "it flew way up!", "it did not lift off", "it went up and came back down". '
            + 'NEVER speak a measurement to a pre-reader — no kilograms, no kilonewtons, no thrust-to-weight, no kilometres, no dollars. '
            + 'NEVER say the words thrust, mass, ratio, altitude, payload, staging or delta-v to a pre-reader. Say "push", "heavy", "how high", "the top part" instead.',
        },
        {
          title: 'WHAT A ROCKET NEEDS IS THE ANSWER — LEAD THEM TO IT',
          instruction:
            'At kindergarten and grade 1 the task is discovering that a rocket needs a capsule, a fuel tank and an engine together. That combination is the ANSWER. '
            + 'You may say the goal freely — "let us make it fly all the way up" — because the goal is the QUESTION. '
            + 'Do NOT list the three required parts as a checklist on the first ask, and do not name the exact part they are missing while they still have tries left. '
            + 'Ask what they think is missing first, let them launch and see, and only spell out all three at scaffolding level 3 after they have tried and asked for help.',
        },
        {
          title: 'A ROCKET THAT DOES NOT FLY IS DATA, NOT FAILURE',
          instruction:
            'Rockets that fail to lift off or fall short are the primitive working — the whole point is testing designs. '
            + 'Never use disappointed language, never call a build wrong, and never say "you failed". Name what the rocket did, then invite one change and another launch.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'orbit-mechanics-lab',
    description: 'Interactive orbital mechanics sandbox where students discover that orbiting is falling while moving sideways, and learn how to change orbits with carefully timed burns. Students launch objects at different speeds and angles, observe resulting orbits (or crashes!), add velocity at different points to see how burns change orbit shape, raise/lower orbits with prograde/retrograde burns, and plan transfers between orbits. Features real-time physics simulation with D3 animation, velocity vector display, gravity field visualization, apogee/perigee markers, and orbital period tracking. Progressive difficulty from K (things go around and around) to Grade 5 (Hohmann transfers and orbital rendezvous). Includes challenge modes for goal-oriented learning: reach specific altitudes, circularize orbits, change to target orbits, or rendezvous with other spacecraft. Burn controls adapt by grade from simple direction pickers to prograde/retrograde maneuver planning. ESSENTIAL for teaching orbital mechanics, gravity, and spaceflight concepts.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K and Grade 1 are fully supported and MAY be routed here: at those grades the launch controls are not sliders but three tappable picture buttons for how fast to go, so the whole task is one tap with no reading, no typing and no numbers on screen, and the tutor narrates by voice. Discovering which speed keeps the rocket going around is the K-1 task, so never state which choice is correct in generated text. K: Focus on "things go around and around", circular motion only, no burns, no orbital vocabulary, showOrbitPath only. Grade 1: Focus on "satellites don\'t fall because they\'re fast", speed determines orbit vs crash, reach_altitude challenge, allowLaunch: true. Grade 2: High vs low orbits, circular vs elliptical shapes, showVelocityVector and showApogeePerigee enabled, reach_altitude challenge with specific height. Grade 3: Speed-orbit relationship, introduce eccentricity concept, gravityVisualization: "field_lines", allowBurns with direction_picker, circularize challenge. Grade 4: Orbital maneuvers vocabulary (prograde/retrograde), burnMode: "prograde_retrograde", showOrbitalPeriod, change_orbit challenge with maxBurns. Grade 5: Hohmann transfers, efficient orbit changes, burnMode: "prograde_retrograde" or "manual", rendezvous challenges, maxBurns constraints (3-5). Use centralBody: "earth" for K-3, add "moon" and "mars" options for 4-5. Enable gravityVisualization for grades 3+. Burn controls are critical: direction_picker for 3, prograde_retrograde for 4-5. Challenge modes provide goal-oriented learning with age-appropriate targets.',
    tutoring: {
      taskDescription:
        'Student is flying a rocket around a planet ("{{title}}"). They are orbiting {{centralBodyName}}. '
        + 'At kindergarten and grade 1 they choose how fast to go by tapping one of three picture buttons '
        + '({{speedChoiceNames}}) and the rocket launches; at grade 2 and up they set thrust and angle with sliders. '
        + 'They picked: {{chosenSpeed}}. The rocket is {{flightState}}. Tries so far: {{attemptCount}}. '
        + 'Goal on screen: {{challengeText}}.',
      contextKeys: [
        'title',
        'gradeLevel',
        'centralBodyName',
        'speedChoiceNames',
        'chosenSpeed',
        'flightState',
        'attemptCount',
        'challengeText',
        'funFact',
      ],
      scaffoldingLevels: {
        level1: '"Pick one of the pictures and watch what your rocket does. You can try them all."',
        level2: '"Look at what happened that time — did your rocket keep going around, or did it come back down? Try a different picture and watch the difference."',
        level3: '"A rocket stays up by going sideways really fast, so it keeps missing the ground as it falls. Too slow and it comes straight back down. Way too fast and it shoots off far away. Try each picture and watch which one keeps going around and around."',
      },
      commonStruggles: [
        {
          pattern: 'Student thinks the rocket stays up because there is no gravity in space',
          response: '"Gravity is still pulling on it up there — that is the surprising part! It keeps falling toward the planet the whole time, but it is moving sideways so fast that it keeps missing. That is what going around means."',
        },
        {
          pattern: 'Student thinks going faster always makes a better orbit',
          response: '"Try the fastest one and watch where it goes. Did it stay where you could see it? There is such a thing as too fast — it shoots away instead of going around."',
        },
        {
          pattern: 'Student is discouraged after the rocket falls back down',
          response: '"That is exactly what a too-slow rocket does, and finding that out is the whole job. Real rocket engineers crash a lot of them. Pick a different picture and watch what changes."',
        },
        {
          pattern: 'Student taps every button quickly without watching the flight',
          response: '"Stay with this one and watch it for a moment. Where does your rocket go after it stops pushing? Watch the line it draws."',
        },
        {
          pattern: 'A pre-reader cannot read the button words, the flight numbers, or the goal text',
          response: '"Never ask them to read. Name the pictures out loud — the turtle, the rocket, the lightning bolt — and say what happened in child words: \'it came back down\', \'it is going around and around\', \'it flew way off\'. Never speak a kilometre, a speed, or a thrust number to a young child."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the title, the button words, the goal banner, or any number on this screen. Your voice is the only channel. '
            + 'When you receive [ORBIT_ORIENT], say in one or two warm child-sized sentences that this is their rocket and they can tap a picture to choose how fast it goes, then watch what happens. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [ORBIT_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'When you receive [ORBIT_FLIGHT_RESULT], say in ONE short sentence what the rocket did, using only what a child can see: "it came back down", "it is going around and around!", "it flew way off past the edge". '
            + 'NEVER speak a measurement to a pre-reader — no kilometres, no kilonewtons, no degrees, no thrust-to-weight, no minutes per orbit. '
            + 'NEVER say the words orbit, altitude, apogee, perigee, eccentricity, prograde or retrograde to a pre-reader. Say "going around and around", "how high", "the far part", "the close part" instead.',
        },
        {
          title: 'WHICH SPEED IS THE ANSWER — NEVER SAY IT',
          instruction:
            'At kindergarten and grade 1 the student\'s whole task is discovering WHICH of the three speed pictures keeps the rocket going around. That choice is the ANSWER. '
            + 'You may say the goal out loud as often as you like — "we want it to keep going around and around without falling" — because the goal is the QUESTION. '
            + 'You must NEVER name the correct picture, NEVER say "the middle one", NEVER rule pictures out by elimination, and NEVER say a thrust number. '
            + 'If they ask you which to pick, turn it back: "I want to see what YOU think — try one and we will watch together." '
            + 'After a wrong pick, describe what happened and invite another try; do not steer them to the right one.',
        },
        {
          title: 'FALLING IS NOT FAILING',
          instruction:
            'A rocket that comes back down or shoots away is the primitive working, not the student failing — both outcomes are the lesson. '
            + 'Never use disappointed language for a crash and never call it wrong. Treat every launch as an experiment that produced information, and say what it showed.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'mission-planner',
    description: 'Simplified mission design tool where students plan trips to the Moon, Mars, and beyond. Students select destinations on an interactive D3 solar system map, choose launch windows based on planetary alignment, plan trajectories (direct route vs gravity assist via other planets), pack supplies for crew (food, water, oxygen), estimate travel time, calculate fuel requirements, and monitor animated mission progress. Features progressive learning phases: explore destinations, plan route and timing, prepare supplies, and launch with real-time progress tracking. Includes interactive supply calculator for food/water/oxygen planning, launch window selection showing optimal planetary alignment, gravity assist trajectory visualization, mission clock with elapsed time, and destination info panels with fun facts. D3 solar system visualization shows orbital paths, planet positions, trajectory lines, and animated spacecraft icon. Progressive difficulty from K (pick a destination!) to Grade 5 (optimize fuel vs payload trade-offs with gravity assists and tight fuel constraints). ESSENTIAL for teaching space travel concepts, mission planning, supply logistics, and interplanetary navigation for K-5 astronomy.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K: 2-3 destinations (Moon, Mars), flyby mission, no trajectory/supplies/launch windows shown, focus on "we can visit other places in space". Grade 1: 3 destinations, showTrajectory enabled, missionClock enabled, focus on "different places take different times to reach". Grade 2: 3 destinations, supplyCalculator enabled with 3 items (food, water, oxygen), crewed: true, focus on "astronauts need food, water, and air". Grade 3: 4 destinations, showLaunchWindows with 3-4 options (one optimal), supplyCalculator with 4 items, focus on "can\'t launch anytime - planets move!". Grade 4: 4-5 destinations, gravityAssistOption enabled, all features active, missionType: "return", focus on "gravity assists give speed boosts from planets". Grade 5: All 5 destinations, tight fuelConstraint (30 tons), 5 supply types including science equipment, missionType: "return", focus on "trade-offs: speed vs fuel vs payload". Always provide age-appropriate hints and fun facts per destination.',
    supportsEvaluation: true,
  },
  {
    id: 'telescope-simulator',
    description: 'Virtual telescope experience where students explore the night sky, find celestial objects, and understand how astronomers work. Features an interactive D3 circular viewport simulating telescope eyepiece views. Students point the telescope at sky regions by dragging, adjust magnification with zoom slider, find specific objects (Moon, Venus, planets, stars, nebulae, galaxies), switch between telescope types (binoculars, small scope, large scope, space telescope), toggle viewing modes (visible, infrared, radio), log observations in a journal, and compare what different equipment reveals. Intuitive pan-to-aim controls with optional coordinate grid. Auto-focus mode for easy exploration (Grades 2-4), manual focus mode for realistic challenge (Grade 5). Venus is ALWAYS included as a featured object. Progressive difficulty from Grade 2 (finding things in the sky) to Grade 5 (professional astronomy techniques with manual focus). Each celestial object has grade-appropriate descriptions, fun facts, and detail levels showing what\'s visible at each telescope power. ESSENTIAL for teaching observational astronomy, telescope operation, and sky navigation for Grade 2-5 science.',
    constraints: 'Best for grades 2-5 with distinct learning progressions. BAND FLOOR: Grade 2+ ONLY — do NOT route this to Kindergarten or Grade 1 under any topic. The instrument panel is permanently on screen (magnification slider, four telescope-type buttons, three view-mode buttons, Labels/Grid/Manual-Focus checkboxes, an AZ/ALT/magnification coordinate readout, and the target list) and every control is a text label with no spoken twin, so a pre-reader or emerging reader cannot even learn what the task is — the "find this object" instruction lives in the hints panel behind a "Show hints" toggle. For Kindergarten and Grade 1 astronomy route solar-system-explorer, day-night-seasons, or moon-phases-lab instead; they are tap-and-watch primitives that carry the same "we can see space" ideas without an instrument panel. Grade 2: small telescope, 6 objects including star cluster, telescope switching enabled, focus on "finding things in the sky". Grade 3: small telescope, 7 objects with varying visibility, IR view mode, journalMode: true, focus on "different telescopes see different things". Grade 4: large telescope, 8 objects including nebulae and galaxies, all controls, grid optional, journal required, focus on "systematic observation and logging". Grade 5: large telescope, 8-10 objects, focusMode: "manual" (hard mode!), showGrid: true, full journal, focus on "professional astronomy techniques". Venus MUST always be included as a target object. Use targetObjects to set discovery goals. celestialObjects need azimuth (0-360), altitude (5-85), magnitude, angularSize, color, and detailLevels for each telescope type.',
    supportsEvaluation: true,
  },
  {
    id: 'light-shadow-lab',
    description: 'Interactive shadow exploration lab where students manipulate a virtual sun to observe how shadow length, direction, and shape change throughout the day. Perfect for teaching light and shadow phenomena. ESSENTIAL for K-2 science (NGSS 1-ESS1-1).',
    constraints: 'Best for K-5. Requires understanding of directional vocabulary (East/West). Themes: playground (K-1), sundial (2-3), science_lab (4-5).',
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
        label: 'Predict (Tier 2)',
        beta: 3.0,
        scaffoldingMode: 3,
        challengeTypes: ['predict'],
        description: 'Given a sun position, predict the shadow direction and length before checking',
      },
      {
        evalMode: 'measure',
        label: 'Measure (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['measure'],
        description: 'Record shadow direction and length at multiple time points, identify the pattern',
      },
      {
        evalMode: 'apply',
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
        { pattern: 'Student confuses direction labels', response: '"Remember: the sun rises in the East (point right) and sets in the West (point left). Morning shadows point West, evening shadows point East."' },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'constellation-builder',
    description: 'Interactive connect-the-dots star field where students trace constellations by connecting stars. Builds spatial pattern recognition and star identification skills. Students connect numbered dots (guided), find pattern stars in a field (free), identify named constellations (reverse), and match constellations to seasons. Features real star positions for Big Dipper, Orion, Cassiopeia, Leo, and more. Progressive difficulty from K (numbered dots) to Grade 5 (seasonal sky knowledge). Perfect for K-5 astronomy, NGSS 1-ESS1-1. ESSENTIAL for teaching star patterns and constellation recognition.',
    constraints: 'Best for grades K-5. K: 3 constellations, numbered dots, large stars. Grade 1: 4-5 constellations, guided trace. Grade 2: unnumbered free connect, star brightness varies. Grade 3: identify mode, background distractors, seasonal grouping. Grade 4-5: seasonal sky rotation, no numbers, mythology connections.',
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
        label: 'Identify (Tier 3)',
        beta: 4.5,
        scaffoldingMode: 4,
        challengeTypes: ['identify'],
        description: 'Constellation lines already drawn — student selects the correct name from options',
      },
      {
        evalMode: 'seasonal',
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
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'planetary-explorer',
    description: 'Guided Gemini-driven solar system deep-dive where students explore 3-5 planets sequentially with targeted questions at every stop. Students journey from planet to planet, tap stats to learn about each world, answer questions about planetary properties, compare planets they have visited, and apply reasoning about temperature, atmosphere, and habitability. Features pedagogical moments at every stage: journey start, planet arrival, stat exploration, answer feedback, planet completion, transitions, and journey completion. Gemini generates contextual questions per planet based on focus themes (size, temperature, atmosphere, moons, rings, distance). Progressive difficulty from K (basic recall) to Grade 8 (cross-planet reasoning and application). Supports multiple-choice, true-false, and comparison challenge types. ESSENTIAL for teaching planetary science, comparative planetology, and scientific reasoning across K-8.',
    constraints: 'Best for grades K-8. K-2: 3 planets, explore mode with true-false and simple MC, focus on one property per planet. Grades 3-5: 4 planets, identify and compare modes, multi-property focus themes, comparison challenges. Grades 6-8: 5 planets, apply mode, reasoning about habitability, atmosphere composition, and temperature patterns. Focus themes should be age-appropriate: size and color for K-1, temperature and moons for 2-3, atmosphere and habitability for 4-5, multi-factor reasoning for 6-8.',
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
      contextKeys: ['currentPlanet', 'focusTheme', 'questionText', 'studentAnswer', 'correctAnswer', 'planetsVisited', 'planetsRemaining', 'currentScore', 'attemptNumber'],
      scaffoldingLevels: {
        level1: '"Look at the stats panel — one of those numbers will help you."',
        level2: '"The question is about {{focusTheme}}. Check the relevant stat value for {{currentPlanet}}."',
        level3: '"Look at {{currentPlanet}}\'s stats carefully. Compare the values you see to what the question is asking about."',
      },
      commonStruggles: [
        { pattern: 'Student taps answer without reading planet stats', response: '"Hold on! Before you answer, tap the stats panel for {{currentPlanet}}. The answer is hiding in those numbers."' },
        { pattern: 'Student confuses properties between planets already visited', response: '"You have visited {{planetsVisited}} so far. Each planet has different numbers. Go back and check {{currentPlanet}}\'s stats — do not mix them up with the last planet!"' },
        { pattern: 'Student struggles with comparison questions across planets', response: '"For comparison questions, think about one property at a time. Look at {{focusTheme}} for each planet you visited. Which one had the biggest or smallest value?"' },
      ],
    },
    supportsEvaluation: true,
  },
];
