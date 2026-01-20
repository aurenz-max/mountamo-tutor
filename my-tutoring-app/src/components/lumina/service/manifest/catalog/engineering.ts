/**
 * Engineering Catalog - Component definitions for engineering/STEM primitives
 *
 * Contains 4 simple machines and engineering concepts for K-5 STEM education.
 */

import { ComponentDefinition } from '../../../types';

export const ENGINEERING_CATALOG: ComponentDefinition[] = [
  {
    id: 'lever-lab',
    description: 'Interactive lever/fulcrum simulation for teaching simple machines. Students explore balance, mechanical advantage, and force trade-offs by manipulating loads, fulcrum position, and effort force. Features multiple themes (seesaw, excavator, crowbar) to connect abstract physics to real-world tools. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for elementary engineering and physics.',
    constraints: 'Best for grades K-5. Use for simple machines, balance concepts, mechanical advantage, force multiplication. Themes adapt complexity: seesaw for K-2 (basic balance), excavator/crowbar for 3-5 (mechanical advantage). Supports both exploration (movable fulcrum) and problem-solving (fixed challenges).'
  },
  {
    id: 'pulley-system-builder',
    description: 'Interactive pulley system simulation for teaching mechanical advantage and simple machines. Students build and explore pulley configurations by adding fixed and movable pulleys, threading rope, and lifting loads. Shows how cranes, flagpoles, wells, and construction hoists work. Features multiple themes (crane, flagpole, well, construction) to connect physics to real-world applications. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching pulleys and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for pulleys, mechanical advantage, force reduction, rope systems. Themes adapt complexity: flagpole for K-1 (direction change), well for 1-2 (fixed vs movable), crane/construction for 3-5 (mechanical advantage calculations). Supports exploration (add pulleys) and guided challenges (fixed configurations).'
  },
  {
    id: 'ramp-lab',
    description: 'Interactive inclined plane (ramp) simulation for teaching simple machines. Students explore how ramps reduce the force needed to lift objects by trading distance for effort. Adjust angle, friction, and push force to see how steeper ramps require more force. Shows real-world connections: loading docks, wheelchair ramps (ADA), dump trucks, skateboard ramps. Features multiple themes (loading_dock, dump_truck, skateboard, generic) and load types (box, barrel, wheel). Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching inclined planes and force trade-offs.',
    constraints: 'Best for grades K-5. Use for inclined planes, ramps, force reduction, friction effects. K-1: rolling vs sliding exploration (wheel vs box). 1-2: steeper = harder to push. 2-3: height vs length trade-off. 4-5: mechanical advantage calculations, force decomposition. Themes adapt context: skateboard for fun exploration, loading_dock/dump_truck for real-world applications.'
  },
  {
    id: 'wheel-axle-explorer',
    description: 'Interactive wheel and axle simulation for teaching simple machines and force multiplication. Students rotate wheels of different sizes connected to axles to discover how steering wheels, doorknobs, winches, and well cranks multiply force. Adjust wheel and axle diameters to see how larger wheels make turning easier. Attach loads to axle to simulate lifting with a winch. Shows real-world connections: steering wheel, doorknob, well crank, winch, screwdriver. Features multiple themes (steering_wheel, winch, doorknob, well_crank) to connect physics to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching wheel and axle machines and gear ratios.',
    constraints: 'Best for grades K-5. Use for wheel and axle, force multiplication, gear ratios. K-1: doorknobs are easier than handles (doorknob theme). 1-2: well cranks and turning (well_crank theme). 2-3: bigger wheel = easier turn (winch theme). 4-5: mechanical advantage calculations, gear ratio introduction (steering_wheel theme). Supports exploration (adjustable sizes) and challenges (fixed configurations with loads to lift).'
  },
];
