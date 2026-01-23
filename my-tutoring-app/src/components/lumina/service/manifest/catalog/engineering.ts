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
  {
    id: 'gear-train-builder',
    description: 'Interactive gear train sandbox for teaching speed/torque trade-offs fundamental to all machinery. Students place gears on a grid, connect them by proximity (auto-mesh), rotate driver gear, and watch followers spin. Count teeth and observe speed ratios. Build gear chains for specific ratios. Shows real-world connections: bicycle gears, clock mechanisms, wind-up toys, car transmissions. Features multiple themes (toy, machine, clock, bicycle) to connect engineering to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching gears, speed ratios, direction changes, and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for gears, speed ratios, direction changes, torque trade-offs. K-1: gears turn together (toy theme, free play). 1-2: direction changes with each gear (showDirection). 2-3: big gear turns small gear fast (showSpeedRatio). 3-4: counting teeth for ratios (showTeethCount). 4-5: design challenges with specific output speeds (targetRatio). Supports free exploration and guided design challenges.'
  },
  {
    id: 'bridge-builder',
    description: 'Interactive 2D bridge construction canvas for teaching structural engineering. Students place beams, cables, and supports to span gaps, then test bridges with loads (cars, trucks, trains) to see if they hold. Watch bridges deform under stress with color-coded feedback (green/yellow/red). Teaches triangles are strong, load distribution, and truss optimization. Shows real-world connections: highway bridges, railroad trestles, footbridges. Features multiple themes (construction, medieval, modern) to connect engineering to different contexts. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching structural engineering, forces, and design iteration.',
    constraints: 'Best for grades K-5. Use for bridges, structural engineering, trusses, load distribution. K-1: connect two sides (simple spanning). 1-2: supports at edges vs middle (support concepts). 2-3: triangles are strong (truss introduction). 3-4: load distribution concepts (stress visualization). 4-5: truss design optimization (budget constraints, efficiency). Supports free building exploration and guided design challenges with piece limits.'
  },
  {
    id: 'tower-stacker',
    description: 'Interactive vertical building challenge for teaching stability and center of gravity. Students stack blocks, beams, triangles, and arches to reach target heights while maintaining stability. Features wind/shake test to check structural integrity. Shows center of gravity indicator to help students understand balance. Teaches wider base = more stable, center of gravity concepts, material efficiency, and wind resistance design. Shows real-world connections: skyscrapers, building construction, architecture. Features multiple themes (blocks, construction, city) to adapt to different age groups. Perfect for K-5 engineering and NGSS standards. ESSENTIAL for teaching structural stability, balance, and physics of building.',
    constraints: 'Best for grades K-5. Use for stacking, balance, stability, center of gravity, building design. K: simple stacking exploration (blocks theme, no wind). K-1: wider base = more stable (introduce stability concept). 2-3: center of gravity exploration (showCenterOfGravity: true). 3-4: material efficiency - height per piece (limited pieces). 4-5: wind resistance design (high wind strength, optimization). Supports free building and height challenges with piece limits.'
  },
];
