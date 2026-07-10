# Lumina Architecture

This document describes Lumina as it exists today. Lumina is not only a component
library: it is the tutoring application's lesson orchestrator, generative-content
pipeline, interactive primitive platform, evaluation layer, and adaptive practice
surface.

For implementation-specific guides, see the documents under `docs/` and the README
files within individual subsystems. This file is the high-level map and the source of
truth for system boundaries and runtime flow.

## System at a Glance

```text
Next.js /lumina route
        |
        v
App.tsx + StudentProvider
        |
        +---- home, curriculum, daily plan, and developer surfaces
        |
        +---- useExhibitSession
                  |
                  +---- curator brief
                  +---- student/curriculum personalization
                  +---- objective-centric manifest
                  +---- per-component content generation
                  |
                  v
             ExhibitData
                  |
                  v
             LessonScreen
                  |
                  +---- EvaluationProvider
                  +---- ExhibitProvider
                  +---- LuminaAIProvider
                  |
                  v
        ManifestOrderRenderer
                  |
                  v
          primitiveRegistry
                  |
                  v
       interactive primitives
```

The primary data contract is:

```text
topic + grade + objectives + student context
                    |
                    v
             ExhibitManifest
                    |
                    v
       OrderedComponent[] / ExhibitData
                    |
                    v
        registry-backed React rendering
                    |
                    v
       evaluations + tutoring interaction
```

## Entry Point and Application State

The public application route is `src/app/lumina/page.tsx`. It accepts optional
`?topic=` and `?grade=` handoff parameters and mounts `lumina/App.tsx`.

`App.tsx` is the top-level client orchestrator. Its responsibilities include:

- resolving the active student through `StudentProvider`;
- managing the `IDLE`, `GENERATING`, `PLAYING`, and `ERROR` states;
- launching free-form, curriculum-selected, grouped, and daily-session lessons;
- coordinating daily lesson blocks, Pulse blocks, breaks, and completion;
- retaining curriculum context so evaluation events use canonical IDs;
- selecting the appropriate screen for the current state; and
- delegating lesson generation to `useExhibitSession`.

Keep primitive-specific behavior out of `App.tsx`. Cross-session navigation and
application state belong here; content rendering and primitive interaction do not.

## Lesson Generation Pipeline

`hooks/useExhibitSession.ts` owns the normal lesson-generation lifecycle.

### Standard lesson

```text
1. Fetch lightweight student persona (fail-soft)
2. Generate curator introduction and learning objectives
3. Resolve objectives against curriculum/student state (fail-soft)
4. Generate an objective-centric exhibit manifest
5. Generate and hydrate every manifest component
6. Assemble ExhibitData and enter PLAYING
```

The manifest and build steps stream progress to the browser. The client wrappers live
in `service/geminiClient-api.ts`; server-only generation lives under `service/` and is
exposed through routes under `src/app/api/lumina/`.

Important streaming routes:

- `manifest-stream`: generates the manifest and emits progress, thinking, partial,
  and completion events;
- `build-stream`: generates manifest component content and reports each completed
  instance;
- `practice-stream`: builds and hydrates practice manifests; and
- `pulse-stream`: builds and hydrates adaptive Pulse activities.

`src/app/api/lumina/route.ts` is also a multiplexed endpoint for focused operations
such as hints, assessments, content generation, audio judgment, image evaluation,
scratch-pad analysis, and misconception distillation.

### Daily Pulse lesson shape

The `sessionShape: 'pulse'` path deliberately skips the narrative brief and manifest
LLM. It constructs a deterministic measurement manifest from known objectives, then
uses the normal component build and rendering path. Pulse is measurement, not a
miniature narrative lesson.

## Manifest Model

`ExhibitManifest` is objective-centric:

- `objectiveBlocks` associate one or more components with each objective;
- `finalAssessment` may cover all lesson objectives;
- `layout` is the flattened compatibility/rendering order; and
- each `ManifestItem` has a stable `componentId` and `instanceId`.

The completed `ExhibitData` retains both the manifest and an `orderedComponents`
array. Each `OrderedComponent` contains:

```ts
interface OrderedComponent {
  componentId: ComponentId;
  instanceId: string;
  title: string;
  data: any;
  objectiveIds?: string[];
}
```

`orderedComponents` is the authoritative runtime rendering order. Older typed arrays
on `ExhibitData` remain for legacy compatibility and should not be the basis of new
lesson rendering work.

## Catalog, Generator Registry, and UI Registry

Lumina has multiple registries with different responsibilities. They must agree on a
component ID, but they are not interchangeable.

### Universal catalog: what may be selected

`service/manifest/catalog/` describes the components available to manifest planning.
It is split into domain catalogs:

- core;
- math;
- engineering;
- science;
- chemistry;
- biology;
- astronomy;
- physics;
- literacy;
- media;
- assessment; and
- calendar.

`catalog/index.ts` combines these into `UNIVERSAL_CATALOG` and provides component and
domain lookup helpers. Catalog definitions describe intent, constraints, evaluation
modes, tutoring scaffolds, and selection metadata.

### Generator registry: how content is produced

The service registry and domain generator modules map a selected component ID to its
server-side content generator. Most domain implementations live in directories such
as `service/math/`, `service/literacy/`, `service/biology/`, and
`service/engineering/`.

`service/geminiService.ts` is the build coordinator. It normalizes grade context,
looks up generators, builds components, tolerates component-level failures where
appropriate, and assembles `ExhibitData`.

### Primitive registry: how content is rendered

`config/primitiveRegistry.tsx` maps component IDs to React components and presentation
configuration. A registry entry can define:

- the React component;
- section title and divider behavior;
- container styling;
- whether multiple instances are supported;
- additional props; and
- whether evaluation props should be injected.

Primitive components should render one concept or activity, manage their local
interaction state, and expose results through the shared evaluation contract. They
should not know about manifest ordering, lesson-level headers, or sibling primitives.

## Lesson Rendering and Runtime Contexts

`components/LessonScreen.tsx` establishes the runtime provider stack:

```text
EvaluationProvider
  ExhibitProvider
    LuminaAIProvider
      LessonAIBootstrap
      ManifestOrderRenderer
      evaluation/results UI
      lesson completion UI
```

The providers have separate roles:

- `EvaluationProvider` owns the evaluation session, batching/submission state,
  curriculum fallbacks, competency updates, and session summaries.
- `ExhibitProvider` exposes objectives and manifest-instance relationships.
- `LuminaAIProvider` owns the live tutoring connection and current primitive context.

`ManifestOrderRenderer` iterates through `orderedComponents`, looks each component up
in the primitive registry, attaches objective badges and shared props, and renders it
in manifest order. For evaluable registry entries it injects instance and curriculum
metadata needed by `usePrimitiveEvaluation`.

The renderer also tracks the primitive nearest the viewport focus line. After a
debounce it updates the live tutor's primitive context, keeping tutoring help aligned
with what the student is currently viewing.

`PrimitiveRenderer` and `PrimitiveCollectionRenderer` remain useful for isolated or
legacy rendering. Manifest-driven lessons should use `ManifestOrderRenderer`.

## Evaluation and Curriculum Attribution

The evaluation subsystem lives under `evaluation/`:

- `contexts/EvaluationContext.tsx` owns session-level evaluation state;
- `hooks/usePrimitiveEvaluation.ts` is the primitive-facing submission API;
- `api/evaluationApi.ts` converts and submits results to backend services;
- `diagnosis/` captures structured failure evidence and distills misconceptions; and
- `types.ts` defines shared result and metric contracts.

The intended curriculum-ID resolution order is:

```text
item/primitive curriculum IDs
          |
          v
session-level EvaluationProvider curriculum IDs
          |
          v
backend mapping fallback
```

Canonical curriculum IDs should be preserved as close to the generated item as
possible. Daily-session and curriculum-browser launches already know these IDs and
must not replace them with AI-inferred identifiers.

To make a primitive evaluable:

1. mark its primitive-registry entry with `supportsEvaluation: true`;
2. use `usePrimitiveEvaluation` inside the primitive;
3. emit the appropriate typed metrics and structured failure evidence; and
4. verify curriculum identifiers flow from the manifest/item or provider.

## Practice, Pulse, and Other Product Surfaces

Lumina contains several experiences that reuse the same primitives but have different
orchestration:

- lesson/exhibit mode uses curator brief -> manifest -> build -> lesson rendering;
- practice mode uses a practice manifest paired with answer-mechanism primitives;
- Pulse uses adaptive or deterministic measurement activities and session summaries;
- daily learning sequences lesson and Pulse blocks with persisted block progress;
- analytics and progress surfaces consume evaluation and curriculum state; and
- developer panels exercise catalogs, primitives, generators, tutoring scaffolds,
  calibration, and deterministic QA.

Do not assume all surfaces use `App.tsx`'s full narrative pipeline. Reuse contracts
(manifest items, hydrated items, registry IDs, and evaluation results), not necessarily
the same orchestrator.

## Shared UI and Interaction Utilities

`ui/` is the reusable Lumina design-system layer: buttons, panels, prompts, feedback,
progress, input, voice controls, and tokens. Prefer these components for new Lumina UI
instead of introducing one-off visual conventions.

Shared hooks and utilities cover recurring interaction patterns:

- multi-phase challenge progress and results;
- lesson exit protection;
- exhibit session state;
- voice capture, spoken-word judging, and audio encoding; and
- template interpolation and editorial layout.

Primitives with Explore -> Practice -> Apply flows should use the shared multi-phase
hooks rather than recreating phase bookkeeping.

## Server and Client Boundaries

Lumina is a Next.js client/server system:

- React components, contexts, hooks, and `geminiClient-api.ts` run in the browser;
- API routes provide the network boundary;
- Gemini SDK calls, prompts, generator registries, and content hydration run on the
  server; and
- backend tutoring, curriculum, evaluation, and session APIs are accessed through
  their dedicated clients/routes.

Do not import server generation modules into client components. Add or extend a route
and call it through a client wrapper instead.

## Directory Map

```text
lumina/
|-- App.tsx                   top-level application/session orchestrator
|-- DailyLessonPlan.tsx       daily block-plan UI
|-- types.ts                  cross-system manifest and content contracts
|-- components/               screens, renderers, dashboards, and dev tools
|-- config/                   primitive/problem registries and feature flags
|-- contexts/                 student and exhibit runtime contexts
|-- docs/                     PRDs, guides, audits, and subsystem references
|-- evaluation/               evaluation, submission, and diagnosis pipeline
|-- hooks/                    reusable session and interaction hooks
|-- lib/                      focused domain utilities
|-- primitives/               content and interactive visual primitives
|-- pulse/                    adaptive Pulse session UI and client logic
|-- service/                  server generation, manifests, registries, and QA
|-- ui/                       shared Lumina UI system
`-- utils/                    audio, voice, layout, and template utilities
```

## Adding a New Primitive

Adding a primitive is a multi-contract change, not only a React component addition.
Use `docs/ADDING_PRIMITIVES.md` for the detailed checklist. At minimum:

1. define or colocate the data contract;
2. implement the React primitive under `primitives/`;
3. add the component ID and any shared types;
4. register the component in `config/primitiveRegistry.tsx`;
5. add its definition to the appropriate manifest domain catalog;
6. implement and register its server-side content generator;
7. add evaluation metrics, curriculum flow, and tutoring scaffold metadata when
   applicable; and
8. validate generation, rendering, evaluation, and QA paths.

Useful deterministic checks are exposed through the Lumina API routes for evaluation
shape, content oracles, and tutoring scaffolds. A primitive is not complete merely
because its gallery fixture renders.

## Architectural Rules

1. **The manifest controls lesson composition.** Do not hard-code new lesson sections
   in `App.tsx`.
2. **The catalog selects, the generator produces, and the primitive registry renders.**
   Keep those responsibilities separate.
3. **Component IDs are cross-layer contracts.** Catalog, generator, types, renderer,
   evaluation, and QA must use the same ID.
4. **Primitives are locally self-contained.** Lesson/session coordination stays above
   them.
5. **Canonical curriculum metadata beats inference.** Preserve known IDs end to end.
6. **Evaluation is part of the primitive contract.** Interactive success without a
   valid result payload is incomplete.
7. **Personalization is fail-soft.** Loss of optional student context should degrade
   to a generic valid lesson, not prevent learning.
8. **Server-only AI work stays behind API routes.** Client code uses the wrappers.
9. **Shared Lumina UI and hooks are preferred extension points.** Avoid duplicated
   interaction and styling systems.
10. **Documentation near a subsystem may be more detailed, but this document owns the
    system-level boundaries.**

## Legacy Notes

Some types and render paths remain for backward compatibility:

- typed arrays such as `tables`, `graphBoards`, and other fields on `ExhibitData`;
- `PrimitiveCollectionRenderer` for collection-oriented rendering; and
- older docs that describe adding a primitive by editing only `App.tsx` or a single
  monolithic service file.

New manifest-driven work should favor `orderedComponents`, domain catalogs, registered
generators, `ManifestOrderRenderer`, and the shared evaluation pipeline.
