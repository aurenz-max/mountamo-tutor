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
    constraints: 'Best for grades K-5. Learning progression: K (planet names, order, Earth), 1 (inner vs outer, sizes), 2 (orbits, day/year), 3 (moons, rings, AU), 4 (orbital periods, distances), 5 (Kepler\'s laws, gravity, habitable zone). K-2: Show inner planets only or use hybrid scale mode for visibility. 3-5: Include all 8 planets, dwarf planets optional for grade 5. Use initialZoom to control starting view: "inner" for K-1, "system" for 2-5. Enable showDistances and showHabitableZone for grades 3+. Increase timeScale for younger grades (faster = more engaging). Supports both free exploration and guided inquiry about planetary characteristics.'
  },
  {
    id: 'scale-comparator',
    description: 'Interactive scale comparison tool for celestial objects that helps students grasp mind-bending cosmic scales through familiar references. Students compare sizes, distances, masses, and light-travel times side-by-side, overlay familiar objects (basketball, car, football field) for context, and create scale models with "if Sun were basketball..." scenarios. Features progressive difficulty from K (Earth vs Moon) to Grade 5 (light-year calculations). Includes D3 zoom controls to explore extreme size ratios, reference object library with everyday items for visceral understanding, and dynamic ratio calculations showing "Jupiter is 11× wider than Earth". Scale model builder (Grades 4-5) enables hands-on calculation practice with interactive placement. Walk-through mode (Grades 3-5) visualizes distances with speed controls from walking to light speed. ESSENTIAL for developing spatial reasoning and scale comprehension across astronomy curriculum.',
    constraints: 'Best for grades K-5 with distinct learning progressions. K: 2-3 objects (Earth, Moon), size only, no ratios, everyday references (balls). Grade 1: 3-4 planets, size comparisons, sport ball equivalents. Grade 2: Sun emphasis, integer ratios, "Sun is 109× Earth!". Grade 3: 5-6 planets, add distance mode, walk-through feature, football field references. Grade 4: All 8 planets, scale model builder, AU units, complex calculations. Grade 5: 8+ objects including Voyager/stars, light-travel time mode, scientific notation, geographic references. Use compareType to focus learning: "size" for K-2, "distance" for 3-4, "time" for 5. Enable interactiveWalk for grades 3+. Scale model builder for grades 4-5 only. showRatios should be false for K-1, true for 2+. Always enable showFamiliarEquivalent for all grades. Reference objects auto-filtered by grade appropriateness.'
  }
];
