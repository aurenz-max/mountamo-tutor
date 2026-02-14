# Add New Lumina Primitive

All primitive code lives under `my-tutoring-app/src/components/lumina/`. Do NOT search in `src/components/primitives/`, `src/services/`, `src/types/`, `src/registry/`, or `src/catalog/` — those paths do not exist.

## Required Reading

Before starting, read the full checklist:
- `my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md`
- `my-tutoring-app/src/components/lumina/docs/ADDING_TUTORING_SCAFFOLD.md` (for interactive primitives)

## Exact File Paths (6-7 files)

| Step | File | Action |
|------|------|--------|
| 1 | `lumina/primitives/visual-primitives/<domain>/<Name>.tsx` | Create React component with exported data interface |
| 2 | `lumina/types.ts` | Add to `ComponentId` union type + re-export data type |
| 3 | `lumina/service/<domain>/gemini-<name>.ts` | Create Gemini generator service (import type from component) |
| 4 | `lumina/service/registry/generators/<domain>Generators.ts` | Register generator with `registerGenerator()` |
| 5 | `lumina/service/manifest/catalog/<domain>.ts` | Add `ComponentDefinition` entry for AI selection (include `tutoring` field for interactive primitives) |
| 6 | `lumina/config/primitiveRegistry.tsx` | Register UI component for rendering |
| 7 | `lumina/evaluation/types.ts` | (Optional) Add metrics type if primitive supports evaluation |

All paths above are relative to `my-tutoring-app/src/components/`.

## Domain Directories

| Domain | Component Dir | Generator Dir | Catalog | Generator Registry | Tester Component |
|--------|--------------|---------------|---------|-------------------|------------------|
| astronomy | `primitives/visual-primitives/astronomy/` | `service/astronomy/` | `catalog/astronomy.ts` | `generators/astronomyGenerators.ts` | `components/AstronomyPrimitivesTester.tsx` |
| math | `primitives/visual-primitives/math/` | `service/math/` | `catalog/math.ts` | `generators/mathGenerators.ts` | `components/MathPrimitivesTester.tsx` |
| engineering | `primitives/visual-primitives/engineering/` | `service/engineering/` | `catalog/engineering.ts` | `generators/engineeringGenerators.ts` | `components/EngineeringPrimitivesTester.tsx` |
| physics | `primitives/visual-primitives/physics/` | `service/physics/` | `catalog/physics.ts` | `generators/physicsGenerators.ts` | `components/PhysicsPrimitivesTester.tsx` |
| science | `primitives/visual-primitives/science/` | `service/science/` | `catalog/science.ts` | `generators/scienceGenerators.ts` | N/A |
| literacy | `primitives/visual-primitives/literacy/` | `service/literacy/` | `catalog/literacy.ts` | `generators/literacyGenerators.ts` | N/A |
| media | `primitives/visual-primitives/media/` | `service/media/` | `catalog/media.ts` | `generators/mediaGenerators.ts` | N/A |
| assessment | `primitives/visual-primitives/assessment/` | `service/assessment/` | `catalog/assessment.ts` | N/A | N/A |
| core | `primitives/visual-primitives/core/` | `service/core/` | `catalog/core.ts` | `generators/coreGenerators.ts` | N/A |

## Index Files to Update

When adding a new domain or generator, also update these index files:
- `lumina/service/registry/generators/index.ts` — import new generator registry files
- `lumina/service/manifest/catalog/index.ts` — import and spread new catalog arrays

## Key Patterns

1. **Single source of truth**: Define and export the data interface in the component file. The generator imports it — never redefine it.
2. **Evaluation by default**: If the primitive is interactive, use the evaluable pattern with `usePrimitiveEvaluation` hook and set `supportsEvaluation: true` in the primitive registry.
3. **Progressive difficulty**: For complex primitives, implement explore → practice → apply phases.
4. **AI tutoring awareness**: If the primitive has interactions where a human tutor would speak (correct/incorrect, phase transitions, new items), design those as AI touchpoints from the start. Add a `tutoring` field to the catalog entry and `sendText` triggers in the component. A primitive with 2-3 well-placed speech triggers is dramatically more engaging than one where the AI goes silent after the greeting. See `ADDING_TUTORING_SCAFFOLD.md` or use the `add-tutoring-scaffold` skill for the full workflow.

## Reference Examples

- Component: `lumina/primitives/visual-primitives/engineering/TowerStacker.tsx`
- Generator: `lumina/service/astronomy/gemini-mission-planner.ts`
- Generator registry: `lumina/service/registry/generators/astronomyGenerators.ts`
- Catalog: `lumina/service/manifest/catalog/astronomy.ts`
- Primitive registry: `lumina/config/primitiveRegistry.tsx`
- Types: `lumina/types.ts`
- Evaluation types: `lumina/evaluation/types.ts`
- Catalog with tutoring: `lumina/service/manifest/catalog/literacy.ts` (PhonicsBlender is the reference)

## Workflow

1. Ask the user for: primitive name, domain, purpose, interactive or display-only, grade range
2. Read ADDING_PRIMITIVES.md and at least one reference example from the same domain
3. Read `lumina/types.ts` and `lumina/config/primitiveRegistry.tsx` to see current registrations
4. **Identify AI interaction points**: If the primitive is interactive, ask: "Where would a human tutor speak?" Map out the pedagogical moments (correct/incorrect, phase transitions, item progression, completion). These will become `sendText` triggers.
5. Create all files following the checklist in order (steps 1-7). When building the component (step 1), wire `sendText` calls at the pedagogical moments identified in step 4. When writing the catalog entry (step 5), include the `tutoring` field with scaffolding levels, contextKeys, and commonStruggles.
6. Add the new primitive to the relevant tester component (e.g., `lumina/components/EngineeringPrimitivesTester.tsx` for engineering domain, `lumina/components/AstronomyPrimitivesTester.tsx` for astronomy, etc.)
7. Report all files created/modified, including: pedagogical moments wired, sendText tags defined, tutoring scaffold added (or why it was skipped for display-only primitives)

**Note:** For adding tutoring scaffolding to an *existing* primitive that was built without it, use the `add-tutoring-scaffold` skill instead.

## PRD Reference

Primitive specs and requirements are documented in:
- `lumina/docs/space-primitives-prd.md` — Astronomy/space primitives
