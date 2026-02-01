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
  }
];
