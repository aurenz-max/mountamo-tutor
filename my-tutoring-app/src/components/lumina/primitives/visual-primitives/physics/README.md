# Physics Primitives

This directory contains interactive React components for physics education.

## Purpose

Physics primitives are interactive visualizations and simulations that help students understand fundamental physics concepts through hands-on exploration.

## File Naming Convention

`[PrimitiveName].tsx`

Examples:
- `ForceDiagram.tsx`
- `MotionSimulator.tsx`
- `EnergyConverter.tsx`
- `CircuitBuilder.tsx`

## Component Structure

Each physics primitive should:
1. Export its data interface (single source of truth)
2. Accept `data` and optional `className` props
3. Include evaluation support for interactive primitives
4. Follow the Lumina glass card design system
5. Provide grade-appropriate progressive difficulty

## Suggested Physics Primitives

### Elementary (K-5)
- **SimpleMachines** - Levers, pulleys, ramps, wedges
- **PushPullLab** - Understanding forces through direct interaction
- **RampRacer** - Gravity, slopes, and speed relationships
- **BalanceBeam** - Mass, distance, and equilibrium
- **MagnetLab** - Attract/repel, magnetic fields

### Middle School (6-8)
- **ForceDiagram** - Free body diagrams with force vectors
- **MotionSimulator** - Position, velocity, acceleration graphs
- **EnergyConverter** - PE/KE transformations (roller coaster, pendulum)
- **WaveSimulator** - Frequency, amplitude, wavelength visualization
- **CircuitBuilder** - Series/parallel circuits, Ohm's law

### High School (9-12)
- **ProjectileMotion** - Trajectory calculation with angle/velocity
- **CollisionLab** - Elastic/inelastic, momentum conservation
- **ElectricField** - Field lines and equipotentials
- **SpectrumAnalyzer** - Light wavelengths and energy levels
- **RelativitySimulator** - Time dilation, length contraction (intro)

## Design Guidelines

### Interactive vs Display
- **Make interactive primitives evaluable** - Use `usePrimitiveEvaluation` hook
- Set `supportsEvaluation: true` in the primitive registry
- Track student approach, not just correctness

### Progressive Difficulty
For complex concepts, use phases:
1. **Explore** - Discover the relationship (1-2 values)
2. **Practice** - Apply with guidance (2-3 problems)
3. **Apply** - Solve independently (full problem)

### Visual Design
- Use Lumina glass card styling (backdrop-blur, borders)
- Include clear labels and units for all quantities
- Provide visual feedback (colors, animations, highlights)
- Use D3 for smooth animations and transitions
- Show formulas for middle/high school grades

### Grade Adaptation
- K-2: Focus on observation and cause/effect
- 3-5: Introduce measurement and simple calculations
- 6-8: Add quantitative analysis and graphing
- 9-12: Include formulas, advanced calculations, real-world applications

## Integration Checklist

When adding a new physics primitive:

- [ ] Create component in this directory
- [ ] Export data interface from component
- [ ] Create generator in `/service/physics/`
- [ ] Register generator in `/service/registry/generators/physicsGenerators.ts`
- [ ] Add to catalog in `/service/manifest/catalog/physics.ts`
- [ ] Register UI in `/config/primitiveRegistry.tsx`
- [ ] Add to `ComponentId` union in `/types.ts`
- [ ] Add evaluation metrics if interactive (in `/evaluation/types.ts`)
- [ ] Test TypeScript compilation: `npx tsc --noEmit`

See `/docs/ADDING_PRIMITIVES.md` for detailed instructions.
